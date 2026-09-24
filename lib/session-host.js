// Client for scripts/session-host.mjs, the separate process that owns the coordinator and project agent CLI
// terminals so they keep running while Workbench restarts. The host is started detached on first use.
// Each remote terminal looks like a node-pty child (write, resize, kill, onData, onExit), so the session code is
// the same with or without a host.
import net from 'node:net';
import {spawn} from 'node:child_process';
import {openSync,closeSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {randomUUID} from 'node:crypto';

const hostScript=fileURLToPath(new URL('../scripts/session-host.mjs',import.meta.url));
const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));

export class SessionHost{
 constructor(directory,{nodePath=process.execPath,startHost=true,connectTimeoutMs=5000}={}){
  Object.assign(this,{directory,nodePath,startHost,connectTimeoutMs});
  this.socketPath=path.join(directory,'session-host.sock');this.logPath=path.join(directory,'session-host.log');
  this.seq=0;this.waiters=new Map();this.children=new Map();this.queue=[];this.socket=null;this.connecting=null;this.closed=false;
 }
 connect(){
  if(this.socket&&!this.socket.destroyed)return Promise.resolve();
  return this.connecting??=this.open().finally(()=>{this.connecting=null;});
 }
 async open(){
  const deadline=Date.now()+this.connectTimeoutMs;let started=false;
  while(true){
   try{await this.attachSocket();return;}
   catch(error){
    if(this.startHost&&!started){started=true;this.launch();}
    if(Date.now()>deadline)throw new Error(`The session host did not start: ${error.message}`);
    await wait(100);
   }
  }
 }
 // setsid (detached) puts the host in its own process group, so stopping or restarting Workbench leaves it running.
 launch(){
  const log=openSync(this.logPath,'a',0o600);
  try{spawn(this.nodePath,[hostScript,this.socketPath],{detached:true,stdio:['ignore',log,log],cwd:this.directory}).unref();}finally{closeSync(log);}
 }
 attachSocket(){
  return new Promise((resolve,reject)=>{
   const socket=net.connect(this.socketPath);let buffer='';
   socket.once('connect',()=>{
    this.socket=socket;socket.setEncoding('utf8');
    for(const line of this.queue.splice(0))socket.write(line);
    resolve();
   });
   socket.once('error',error=>{if(this.socket!==socket)reject(error);});
   socket.on('data',chunk=>{buffer+=chunk;let index;while((index=buffer.indexOf('\n'))>=0){const line=buffer.slice(0,index);buffer=buffer.slice(index+1);if(line)this.receive(JSON.parse(line));}});
   socket.on('close',()=>{if(this.socket!==socket)return;this.socket=null;
    for(const {reject:fail} of this.waiters.values())fail(new Error('The session host connection closed.'));this.waiters.clear();
    // Without the host the terminals are gone for this process; report each one as ended.
    for(const child of this.children.values())child.emitExit({exitCode:null,lost:true});this.children.clear();
   });
  });
 }
 receive(message){
  if(message.seq!==undefined){const w=this.waiters.get(message.seq);if(!w)return;this.waiters.delete(message.seq);message.ok?w.resolve(message.result):w.reject(new Error(message.error));return;}
  const child=this.children.get(message.id);if(!child)return;
  if(message.event==='data')child.emitData(message.data);
  if(message.event==='exit'){this.children.delete(message.id);child.emitExit({exitCode:message.exitCode,error:message.error});}
 }
 send(cmd,args,{reply=true}={}){
  const seq=++this.seq,line=JSON.stringify({seq,cmd,args})+'\n';
  const promise=reply?new Promise((resolve,reject)=>this.waiters.set(seq,{resolve,reject})):null;
  if(this.socket&&!this.socket.destroyed)this.socket.write(line);else{this.queue.push(line);this.connect().catch(error=>{const w=this.waiters.get(seq);if(w){this.waiters.delete(seq);w.reject(error);}});}
  promise?.catch(()=>{});return promise;
 }
 request(cmd,args){return this.connect().then(()=>this.send(cmd,args));}
 // Same call shape as node-pty's spawn. Commands queue in order until the host is connected, so the
 // caller can write to the terminal straight away.
 spawn(file,args,options,{id=randomUUID(),meta=null}={}){
  const child=this.child(id);
  this.send('spawn',{id,file,args,options,meta}).then(view=>{child.pid=view.pid;}).catch(error=>child.emitExit({exitCode:null,error:error.message}));
  return child;
 }
 // A terminal that is already running in the host, after Workbench restarted.
 adopt(view){const child=this.child(view.id);child.pid=view.pid;return child;}
 child(id){
  const data=new Set(),exit=new Set(),host=this;let exited=false;
  const child={id,pid:null,
   write(value){if(!exited)host.send('write',{id,data:value},{reply:false});},
   resize(cols,rows){if(!exited)host.send('resize',{id,cols,rows},{reply:false});},
   kill(signal='SIGHUP'){if(!exited)host.send('kill',{id,signal},{reply:false});},
   onData(listener){data.add(listener);return {dispose:()=>data.delete(listener)};},
   onExit(listener){exit.add(listener);return {dispose:()=>exit.delete(listener)};},
   emitData(value){for(const l of data)l(value);},
   emitExit(event){if(exited)return;exited=true;for(const l of exit)l(event);},
  };
  this.children.set(id,child);return child;
 }
 list(){return this.request('list');}
 forget(id){return this.request('forget',{id}).catch(()=>{});}
 // Workbench is stopping: drop the connection and leave every terminal running in the host.
 close(){this.closed=true;const socket=this.socket;this.socket=null;this.children.clear();for(const {reject} of this.waiters.values())reject(new Error('Closed.'));this.waiters.clear();socket?.destroy();}
}
