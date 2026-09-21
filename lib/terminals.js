import * as pty from 'node-pty';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {existsSync,mkdirSync,readFileSync,writeFileSync,renameSync,realpathSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
import {assert} from './domain.js';
import {benchmarkContext,archiveWorkspace,removeWorkspace} from './benchmarks.js';
import {discoverClaude} from './claude.js';
const exec=promisify(execFile),now=()=>new Date().toISOString(),live=r=>['preparing','running','stopping'].includes(r.status),LIMIT=1024*1024;
async function git(folder,args){const env={...process.env,GIT_TERMINAL_PROMPT:'0'};for(const k of Object.keys(env))if(k.startsWith('GIT_')&&k!=='GIT_TERMINAL_PROMPT')delete env[k];return(await exec('git',['-c','core.hooksPath=/dev/null','-c','core.fsmonitor=false','-C',folder,...args],{env,timeout:15000,maxBuffer:2*1024*1024})).stdout;}
export function terminalArgs(r){
 if(r.agent==='claude')return ['--model',r.model,'--effort',r.effort,'--safe-mode','--strict-mcp-config','--mcp-config','{"mcpServers":{}}','--disable-slash-commands','--disallowedTools','Agent,Task',...(r.mode==='read-only'?['--restricted','--tools','Read,Glob,Grep','--allowedTools','Read,Glob,Grep','--permission-mode','dontAsk']:[])];
 return ['--model',r.model,'-c',`model_reasoning_effort="${r.effort}"`,'-c','features.multi_agent=false','--sandbox',r.mode==='worktree'?'workspace-write':'read-only','--ask-for-approval',r.mode==='worktree'?'on-request':'never','--no-alt-screen','--cd',r.workingDirectory];
}
export class TerminalSessions{
 constructor(directory,executor,{spawn=pty.spawn,discover,binaries={}}={}){
  mkdirSync(directory,{recursive:true});this.directory=realpathSync(directory);this.executor=executor;this.spawn=spawn;this.binaries=binaries;this.provider=discover||((agent)=>agent==='claude'?discoverClaude(executor.claudeBinary,{allowSignedOut:true}):executor.discover());this.active=null;this.closed=false;this.saveTimer=null;
  this.file=path.join(this.directory,'terminal-sessions.json');this.runs=existsSync(this.file)?JSON.parse(readFileSync(this.file,'utf8')):[];assert(Array.isArray(this.runs),'Damaged terminal history.');
  let changed=false;for(const r of this.runs){if(live(r)){r.status='interrupted';r.error='Server stopped. The process was not restarted; the worktree is retained.';r.finishedAt=now();changed=true;}if(['saving','clearing'].includes(r.reset?.status)){r.reset={...r.reset,status:'retained',error:'Server stopped during reset; inspect the archive and worktree.'};changed=true;}}if(changed)this.persist();
 }
 persist(){clearTimeout(this.saveTimer);this.saveTimer=null;writeFileSync(this.file+'.tmp',JSON.stringify(this.runs,null,2),{mode:0o600});renameSync(this.file+'.tmp',this.file);}
 has(id){return this.runs.some(r=>r.id===id);}
 record(id){const r=this.runs.find(r=>r.id===id);assert(r,'Session not found.',404);return r;}
 summary(r){const {output,...meta}=r;return structuredClone(meta);}
 list(projectID){return this.runs.filter(r=>!projectID||r.projectID===projectID).map(r=>this.summary(r));}
 get(id){return this.summary(this.record(id));}
 output(id,cursor=0){const r=this.record(id);assert(Number.isSafeInteger(cursor)&&cursor>=0,'Invalid terminal cursor.');const end=r.offset+r.output.length,reset=cursor<r.offset||cursor>end;return {data:r.output.slice(reset?0:cursor-r.offset),cursor:end,reset,session:this.summary(r)};}
 append(r,data){if(this.closed)return;r.output+=data;if(r.output.length>LIMIT){const drop=r.output.length-LIMIT;r.output=r.output.slice(drop);r.offset+=drop;}if(!this.saveTimer)this.saveTimer=setTimeout(()=>this.persist(),500);}
 async start(input,project){
  assert(['codex','claude'].includes(input.agent),'Choose an agent.');assert(['read-only','worktree'].includes(input.mode),'Choose a workspace.');assert(project.folderPath,'Connect a project folder first.');
  assert(!this.closed&&!this.active&&!this.executor.owner&&!this.executor.active&&!this.executor.starting&&!this.executor.cleaning,'Finish the active session or workflow first.',409);
  const id=randomUUID(),owner='terminal:'+id;this.executor.owner=owner;
  const a={id,owner,child:null,ending:false,interrupted:false};this.active=a;
  let r;
  try{
   const provider=await this.provider(input.agent),model=provider.models.find(m=>m.id===input.model);assert(model&&model.efforts.includes(input.effort),'Choose an available model and effort.');
   const context=await benchmarkContext(project,input.mode);if(input.mode==='worktree')assert(context.git?.status==='connected'&&context.git.commit&&context.git.dirty===false,'A worktree needs a clean Git repository with a commit. Commit or stash changes first.');
   assert(!a.interrupted&&!this.closed,'Server stopped before launch.',409);
   r={id,kind:'terminal',agent:input.agent,model:input.model,effort:input.effort,mode:input.mode,task:`${input.agent==='claude'?'Claude':'Codex'} session`,projectID:project.id,projectSnapshot:structuredClone(project),sourceContext:context,workingDirectory:context.folderPath,createdAt:now(),status:'preparing',output:'',offset:0,usage:null,cost:null,cliVersion:provider.version,cols:80,rows:24};this.runs.push(r);this.persist();
   if(r.mode==='worktree'){
    const base=path.join(this.directory,'worktrees');mkdirSync(base,{recursive:true});r.worktreePath=path.join(base,id);r.branch='codex/skd-'+id;this.persist();
    await git(context.git.root,['worktree','add','-b',r.branch,r.worktreePath,context.git.commit]);r.workingDirectory=path.join(r.worktreePath,path.relative(context.git.root,context.folderPath));this.persist();
   }
   assert(!a.interrupted&&!this.closed,'Server stopped before launch.',409);
   const binary=this.binaries[r.agent]||(r.agent==='claude'?this.executor.claudeBinary:this.executor.binary);
   const env={...process.env,TERM:'xterm-256color',COLORTERM:'truecolor'};delete env.CLAUDECODE;
   const child=this.spawn(process.execPath,[fileURLToPath(new URL('../scripts/codex-child.mjs',import.meta.url)),binary,...terminalArgs(r)],{name:'xterm-256color',cwd:r.workingDirectory,cols:r.cols,rows:r.rows,env});a.child=child;r.status='running';r.startedAt=now();this.persist();
   child.onData(data=>this.append(r,data));child.onExit(event=>{this.finish(a,event).catch(e=>{if(this.closed)return;r.error=e.message;r.status='failed';this.release(a);this.persist();});});return this.summary(r);
  }catch(e){if(r){r.status=a.interrupted?'interrupted':'failed';r.error=e.message;r.finishedAt=now();this.persist();}this.release(a);throw e;}
 }
 release(a){clearTimeout(a.killTimer);if(this.active===a)this.active=null;if(this.executor.owner===a.owner)this.executor.owner=null;}
 async finish(a,event){
  if(a.finished)return;a.finished=true;clearTimeout(a.killTimer);const r=this.record(a.id);r.status=a.interrupted?'interrupted':a.ending?'cancelled':event.exitCode===0?'completed':'failed';r.exitCode=event.exitCode;r.finishedAt=now();
  if(r.status==='failed')r.error='The CLI exited with code '+event.exitCode+'. Check the terminal output.';
  this.persist();
  if(r.worktreePath&&!a.interrupted){
   try{r.diff=await git(r.worktreePath,['diff','--no-ext-diff','--no-textconv',r.sourceContext.git.commit,'--']);r.changes=await git(r.worktreePath,['status','--short']);}catch{r.diffNote='Inspect the retained worktree for changes.';}
   if(this.closed)return;
   if(r.projectSnapshot.benchmark){r.reset={status:'saving'};this.persist();try{const artifact=await archiveWorkspace(this.directory,r.id,r,this.get(r.id));if(this.closed)return;r.reset={status:'clearing',artifact};this.persist();r.reset={...await removeWorkspace(this.directory,r,artifact),artifact};}catch(e){r.reset={...r.reset,status:'retained',error:e.message};}}
  }
  this.release(a);if(!this.closed)this.persist();
 }
 input(id,data){const r=this.record(id);assert(this.active?.id===id&&r.status==='running','Session is not running.',409);assert(typeof data==='string'&&data.length>0&&Buffer.byteLength(data)<=16384,'Input must be between 1 and 16,384 bytes.');this.active.child.write(data);return {ok:true};}
 resize(id,cols,rows){const r=this.record(id);assert(Number.isInteger(cols)&&cols>=20&&cols<=400&&Number.isInteger(rows)&&rows>=5&&rows<=200,'Invalid terminal dimensions.');if(this.active?.id===id&&r.status==='running'){this.active.child.resize(cols,rows);r.cols=cols;r.rows=rows;}return {ok:true};}
 stop(id){const r=this.record(id),a=this.active;assert(a?.id===id&&live(r),'Session is not running.',409);if(a.ending)return this.get(id);a.ending=true;r.status='stopping';this.persist();this.kill(a,'SIGTERM');a.killTimer=setTimeout(()=>this.kill(a,'SIGKILL'),2000);return this.get(id);}
 kill(a,signal){try{process.kill(-a.child.pid,signal);}catch{try{a.child?.kill(signal);}catch{}}}
 shutdown(){this.closed=true;clearTimeout(this.saveTimer);const a=this.active;if(a){a.interrupted=true;a.finished=true;this.kill(a,'SIGKILL');if(this.has(a.id)){const r=this.record(a.id);r.status='interrupted';r.error='Server stopped; worktree retained.';r.finishedAt=now();}this.release(a);}if(this.runs.length)this.persist();}
}
