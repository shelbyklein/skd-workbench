import * as pty from 'node-pty';
import {realpathSync} from 'node:fs';
import {randomUUID} from 'node:crypto';
import {assert} from './domain.js';

// One plain shell per server, retained while its panel is hidden. Never auto-start.
export function createWorkspaceTerminal(folder,{spawn=pty.spawn,shell=process.platform==='darwin'?'/bin/zsh':'/bin/bash'}={}){
 const cwd=realpathSync(folder);let current=null;
 const summary=()=>current?{id:current.id,status:current.status,cwd}:null;
 const record=id=>{assert(current&&current.id===id,'Terminal session is no longer available.',404);return current;};
 return {
  open(){
   if(current?.status==='running')return summary();
   const child=spawn(shell,['-i'],{name:'xterm-256color',cols:80,rows:24,cwd,env:{...process.env,TERM:'xterm-256color'}});
   const r={id:randomUUID(),status:'running',child,output:'',offset:0};current=r;
   child.onData(data=>{r.output+=data;if(r.output.length>200000){const trim=r.output.length-200000;r.output=r.output.slice(trim);r.offset+=trim;}});
   child.onExit(()=>{if(r.status==='running')r.status='completed';});return summary();
  },
  output(id,cursor=0){const r=record(id);assert(Number.isSafeInteger(cursor)&&cursor>=0,'Invalid terminal cursor.');const end=r.offset+r.output.length,reset=cursor<r.offset||cursor>end;return {data:r.output.slice(reset?0:cursor-r.offset),cursor:end,reset,session:summary()};},
  input(id,data){const r=record(id);assert(typeof data==='string'&&data.length>0&&data.length<=16384,'Invalid terminal input.');assert(r.status==='running','Terminal has ended.',409);r.child.write(data);return {ok:true};},
  resize(id,cols,rows){const r=record(id);assert(Number.isInteger(cols)&&cols>=20&&cols<=400&&Number.isInteger(rows)&&rows>=5&&rows<=200,'Invalid terminal dimensions.');if(r.status==='running')r.child.resize(cols,rows);return {ok:true};},
  stop(id){const r=record(id);if(r.status==='running'){r.status='stopped';r.child.kill();}return summary();},
  shutdown(){if(current?.status==='running')this.stop(current.id);}
 };
}
