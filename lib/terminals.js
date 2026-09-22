import {profileSelection,deliveredInstructions} from './agent-context.js';
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
import {createToolActivity} from './activity.js';
const exec=promisify(execFile),now=()=>new Date().toISOString(),live=r=>['preparing','running','stopping'].includes(r.status),LIMIT=1024*1024;
async function git(folder,args){const env={...process.env,GIT_TERMINAL_PROMPT:'0'};for(const k of Object.keys(env))if(k.startsWith('GIT_')&&k!=='GIT_TERMINAL_PROMPT')delete env[k];return(await exec('git',['-c','core.hooksPath=/dev/null','-c','core.fsmonitor=false','-C',folder,...args],{env,timeout:15000,maxBuffer:2*1024*1024})).stdout;}
export function terminalArgs(r,connectionArgs=[],connectionTools=[]){
 const systemInstructions=deliveredInstructions(r.agentContext);
 const prompt=r.initialPrompt?[r.initialPrompt]:[];
 const reconcile=r.mode==='reconcile',write=r.mode==='worktree'||reconcile;
 const directories=reconcile?(r.writeDirectories||[]).flatMap(dir=>['--add-dir',dir]):[];
 if(reconcile&&r.agent==='claude')return ['--model',r.model,...(r.effort==='default'?[]:['--effort',r.effort]),'--safe-mode','--strict-mcp-config','--mcp-config','{"mcpServers":{}}','--settings','{"disableAllHooks":true}','--disable-slash-commands','--disallowedTools','Agent,Task','--tools','Read,Glob,Grep,Edit,Write,Bash','--permission-mode','manual',...(systemInstructions?['--append-system-prompt',systemInstructions]:[]),...directories,...prompt];
 if(r.agent==='claude'){const tools=r.mode==='read-only'?['Read','Glob','Grep']:['Read','Glob','Grep','Edit','Write',...connectionTools],toolList=tools.join(',');return ['--model',r.model,...(r.effort==='default'?[]:['--effort',r.effort]),...(r.agentContext?.connections?.status==='managed'?connectionArgs:['--safe-mode','--strict-mcp-config','--mcp-config','{"mcpServers":{}}']),...(systemInstructions?['--append-system-prompt',systemInstructions]:[]),'--settings','{"disableAllHooks":true}','--disable-slash-commands','--disallowedTools','Agent,Task','--tools',toolList,'--allowedTools',toolList,'--permission-mode','dontAsk',...(r.mode==='read-only'?['--restricted']:[]),...prompt];}
 return ['--model',r.model,'-c',`model_reasoning_effort="${r.effort}"`,'-c','features.multi_agent=false',...(systemInstructions?['-c',`developer_instructions=${JSON.stringify(systemInstructions)}`]:[]),...connectionArgs,'--sandbox',write?'workspace-write':'read-only','--ask-for-approval',write?'on-request':'never','--no-alt-screen','--cd',r.workingDirectory,...directories,...prompt];
}
export class TerminalSessions{
 constructor(directory,executor,{spawn=pty.spawn,discover,binaries={},skills=null,connections=null,playbooks=null}={}){
  mkdirSync(directory,{recursive:true});this.directory=realpathSync(directory);this.executor=executor;this.spawn=spawn;this.binaries=binaries;this.skills=skills;this.connections=connections;this.playbooks=playbooks;this.provider=discover||((agent)=>agent==='claude'?discoverClaude(executor.claudeBinary,{allowSignedOut:true}):executor.discover());this.active=null;this.closed=false;this.saveTimer=null;
  this.file=path.join(this.directory,'terminal-sessions.json');this.runs=existsSync(this.file)?JSON.parse(readFileSync(this.file,'utf8')):[];assert(Array.isArray(this.runs),'Damaged terminal history.');
  let changed=false;for(const r of this.runs){if(live(r)){r.status='interrupted';r.error='Server stopped. The process was not restarted; the worktree is retained.';r.finishedAt=now();if(r.mode==='reconcile')r.reconciliationResult={status:'needs-review',message:'Server stopped; reconciliation was not verified.'};changed=true;}if(['saving','clearing'].includes(r.reset?.status)){r.reset={...r.reset,status:'retained',error:'Server stopped during reset; inspect the archive and worktree.'};changed=true;}}if(changed)this.persist();
 }
 persist(){clearTimeout(this.saveTimer);this.saveTimer=null;writeFileSync(this.file+'.tmp',JSON.stringify(this.runs,null,2),{mode:0o600});renameSync(this.file+'.tmp',this.file);}
 has(id){return this.runs.some(r=>r.id===id);}
 record(id){const r=this.runs.find(r=>r.id===id);assert(r,'Session not found.',404);return r;}
 summary(r){const {output,...meta}=r;return structuredClone(meta);}
 list(projectID){return this.runs.filter(r=>!projectID||r.projectID===projectID).map(r=>this.summary(r));}
 get(id){return this.summary(this.record(id));}
 output(id,cursor=0){const r=this.record(id);assert(Number.isSafeInteger(cursor)&&cursor>=0,'Invalid terminal cursor.');const end=r.offset+r.output.length,reset=cursor<r.offset||cursor>end;return {data:r.output.slice(reset?0:cursor-r.offset),cursor:end,reset,session:this.summary(r)};}
 append(r,data){if(this.closed)return;r.output+=data;if(r.output.length>LIMIT){const drop=r.output.length-LIMIT;r.output=r.output.slice(drop);r.offset+=drop;}if(!this.saveTimer)this.saveTimer=setTimeout(()=>this.persist(),500);}
 async start(input,project,internal={}){
  assert(['codex','claude'].includes(input.agent),'Choose an agent.');assert(['read-only','worktree'].includes(input.mode)||(input.mode==='reconcile'&&input.reconciliation&&input.quickAction?.action==='reconcile'),'Choose a workspace.');assert(project.folderPath,'Connect a project folder first.');
  assert(!this.closed&&!this.active&&!this.executor.owner&&!this.executor.active&&!this.executor.starting&&!this.executor.cleaning,'Finish the active session or workflow first.',409);
  const id=randomUUID(),owner='terminal:'+id;this.executor.owner=owner;
  const a={id,owner,child:null,ending:false,interrupted:false,onFinished:input.onFinished};this.active=a;
  let r;
  try{
   const provider=await this.provider(input.agent),model=provider.models.find(m=>m.id===input.model);assert(model&&model.efforts.includes(input.effort),'Choose an available model and effort.');
   const shouldLaunch=internal.shouldLaunch||input.shouldLaunch;
   const context=internal.workspace?.sourceContext||await benchmarkContext(project,input.mode);
   if(internal.workspace){assert(input.mode==='worktree'&&!project.benchmark,'Continuation requires a normal development workspace.');const w=internal.workspace;const record=await this.executor.workspaceNotes.verify(w.workspaceRegistrationID,w.worktreePath,w.workspaceOwnerKey);assert(record.projectID===project.id&&record.classification==='development','Continue this workspace from its original non-benchmark project.',409);assert(realpathSync(w.workingDirectory)===record.destination,'Continuation directory changed.',409);}
   if(input.mode==='worktree'&&!internal.workspace)assert(context.git?.status==='connected'&&context.git.commit&&context.git.dirty===false,'A worktree needs a clean Git repository with a commit. Commit or stash changes first.');
   const playbookContext=this.playbooks?await this.playbooks.resolveLaunch(project,input.agent,profileSelection(input),{purpose:'session',mode:input.mode==='reconcile'?'read-only':input.mode}):null;
   const skillSelection=playbookContext?.skillSelection||input.skills||{mode:'inherit',skillIDs:[]},connectionSelection=playbookContext?.connectionSelection||input.connections||{mode:'inherit',connectionIDs:[]};
   const skillContext=this.skills?.resolve(project,input.agent,skillSelection,{purpose:'session'})||{status:'empty',entries:[],text:''};
   const connectionLaunch=this.connections?await this.connections.prepareLaunch(project,input.agent,connectionSelection,{purpose:'session',mode:input.mode==='reconcile'?'read-only':input.mode}):{snapshot:{status:'excluded',connections:[],reason:'Connections are unavailable.'},args:[],env:{},tools:[],cleanup:null};a.connectionCleanup=connectionLaunch.cleanup;a.connectionArgs=connectionLaunch.args;a.connectionEnv=connectionLaunch.env;a.connectionTools=connectionLaunch.tools;
   assert(!a.interrupted&&!a.ending&&!this.closed,'Session stopped before launch.',409);
   assert(input.initialPrompt===undefined||(typeof input.initialPrompt==='string'&&input.initialPrompt.trim()&&input.initialPrompt.length<=100000),'Initial task is invalid.');
   r={id,kind:'terminal',agent:input.agent,model:input.model,effort:input.effort,mode:input.mode,task:typeof input.task==='string'&&input.task.trim()?input.task.trim():`${input.agent==='claude'?'Claude':'Codex'} session`,...(input.initialPrompt?{initialPrompt:input.initialPrompt}:{}),...(input.importedSessionID?{importedSessionID:input.importedSessionID}:{}),projectID:project.id,projectSnapshot:structuredClone(project),sourceContext:context,workingDirectory:input.reconciliation?.workingDirectory||context.folderPath,...(input.quickAction?{quickAction:structuredClone(input.quickAction)}:{}),...(input.reconciliation?{writeDirectories:input.reconciliation.writeDirectories,reconciliationResult:{status:'pending',message:'Reconciliation session is running; completion is not verified.'}}:{}),createdAt:now(),status:'preparing',output:'',offset:0,usage:null,cost:null,toolActivity:createToolActivity(input.agent,{interactive:true}),cliVersion:provider.version,cols:80,rows:24,agentContext:{...(internal.systemInstructions?{systemInstructions:internal.systemInstructions}:{}),agentProfile:playbookContext?structuredClone(playbookContext):null,skills:skillContext,connections:connectionLaunch.snapshot}};if(internal.workspace){const w=internal.workspace;Object.assign(r,{workingDirectory:w.workingDirectory,worktreePath:w.worktreePath,branch:w.branch,workspaceRegistrationID:w.workspaceRegistrationID,workspaceOwnerKey:w.workspaceOwnerKey,taskID:w.taskID,continued:true});r.workspaceRegistration=this.executor.workspaceNotes.get(w.workspaceRegistrationID);}
   deliveredInstructions(r.agentContext);this.runs.push(r);this.persist();
   if(r.mode==='worktree'&&!internal.workspace){
    const base=path.join(this.directory,'worktrees');mkdirSync(base,{recursive:true});r.worktreePath=path.join(base,id);r.branch='codex/skd-'+id;this.persist();
    const registration=this.executor.workspaceNotes.prepare({intentID:id,projectID:r.projectID,sourceContext:context,destination:r.worktreePath,branch:r.branch,purpose:typeof input.task==='string'?input.task.trim().slice(0,240):'',origin:{kind:'terminal',id},workRef:'local:'+id,ownerKey:owner,classification:project.benchmark?'benchmark':'development'});
    r.workspaceRegistrationID=registration.id;r.workspaceOwnerKey=owner;this.persist();
    assert(!a.interrupted&&!a.ending&&!this.closed,'Session stopped before workspace creation.',409);
    await git(context.git.root,['worktree','add','-b',r.branch,r.worktreePath,context.git.commit]);
    r.workspaceRegistration=await this.executor.workspaceNotes.attach(id);r.workingDirectory=path.join(r.worktreePath,path.relative(context.git.root,context.folderPath));this.persist();
   }
   assert(!a.interrupted&&!a.ending&&!this.closed,'Session stopped before launch.',409);
   if(shouldLaunch)assert(await shouldLaunch(),'Issue or project changed during launch. Refresh before starting.',409);
   if(r.worktreePath)await this.executor.workspaceNotes.verify(r.workspaceRegistrationID,r.worktreePath,r.workspaceOwnerKey);
   if(shouldLaunch)assert(await shouldLaunch(),'Issue or project changed during launch. Refresh before starting.',409);
   assert(!a.interrupted&&!a.ending&&!this.closed,'Session stopped before launch.',409);
   if(r.worktreePath)this.executor.workspaceNotes.link(r.workspaceRegistrationID,{kind:'terminal',id},r.workspaceOwnerKey);
   if(playbookContext?.status==='selected')await this.playbooks.resolveLaunch(project,input.agent,profileSelection(input),{purpose:'session',mode:input.mode==='reconcile'?'read-only':input.mode});
   const binary=this.binaries[r.agent]||(r.agent==='claude'?this.executor.claudeBinary:this.executor.binary);
   const env={...process.env,...a.connectionEnv,TERM:'xterm-256color',COLORTERM:'truecolor'};delete env.CLAUDECODE;
   const child=this.spawn(process.execPath,[fileURLToPath(new URL('../scripts/codex-child.mjs',import.meta.url)),binary,...terminalArgs(r,a.connectionArgs,a.connectionTools)],{name:'xterm-256color',cwd:r.workingDirectory,cols:r.cols,rows:r.rows,env});a.child=child;r.status='running';r.startedAt=now();this.persist();
   child.onData(data=>this.append(r,data));child.onExit(event=>{this.finish(a,event).catch(e=>{if(this.closed)return;r.error=e.message;r.status='failed';this.release(a);this.persist();});});return this.summary(r);
  }catch(e){if(r){r.status=a.interrupted?'interrupted':a.ending?'cancelled':'failed';r.error=e.message;r.finishedAt=now();this.persist();}this.connections?.cleanupLaunch(a.connectionCleanup);this.release(a);throw e;}
 }
 release(a){clearTimeout(a.killTimer);this.connections?.cleanupLaunch(a.connectionCleanup);if(this.active===a)this.active=null;if(this.executor.owner===a.owner)this.executor.owner=null;}
 async finish(a,event){
  if(a.finished)return;a.finished=true;clearTimeout(a.killTimer);const r=this.record(a.id);r.status=a.interrupted?'interrupted':a.ending?'cancelled':event.exitCode===0?'completed':'failed';r.exitCode=event.exitCode;r.finishedAt=now();
  if(r.status==='failed')r.error='The CLI exited with code '+event.exitCode+'. Check the terminal output.';
  this.persist();
  if(r.worktreePath&&!a.interrupted){
   try{r.diff=await git(r.worktreePath,['diff','--no-ext-diff','--no-textconv',r.sourceContext.git.commit,'--']);r.changes=await git(r.worktreePath,['status','--short']);}catch{r.diffNote='Inspect the retained worktree for changes.';}
   if(this.closed)return;
   if(r.projectSnapshot.benchmark){r.reset={status:'saving'};this.persist();try{await this.executor.workspaceNotes.verify(r.workspaceRegistrationID,r.worktreePath,r.workspaceOwnerKey);const artifact=await archiveWorkspace(this.directory,r.id,r,this.get(r.id));if(this.closed)return;r.reset={status:'clearing',artifact};this.persist();r.reset={...await removeWorkspace(this.directory,r,artifact),artifact};}catch(e){r.reset={...r.reset,status:'retained',error:e.message};}}
  }
  if(a.onFinished&&!this.closed){try{await a.onFinished(r);}catch(e){r.reconciliationResult={status:'needs-review',message:e.message};}}
  this.release(a);if(!this.closed)this.persist();
 }
 input(id,data){const r=this.record(id);assert(this.active?.id===id&&r.status==='running','Session is not running.',409);assert(typeof data==='string'&&data.length>0&&Buffer.byteLength(data)<=16384,'Input must be between 1 and 16,384 bytes.');this.active.child.write(data);return {ok:true};}
 resize(id,cols,rows){const r=this.record(id);assert(Number.isInteger(cols)&&cols>=20&&cols<=400&&Number.isInteger(rows)&&rows>=5&&rows<=200,'Invalid terminal dimensions.');if(this.active?.id===id&&r.status==='running'){this.active.child.resize(cols,rows);r.cols=cols;r.rows=rows;}return {ok:true};}
 stop(id){const r=this.record(id),a=this.active;assert(a?.id===id&&live(r),'Session is not running.',409);if(a.ending)return this.get(id);a.ending=true;r.status='stopping';this.persist();this.kill(a,'SIGTERM');a.killTimer=setTimeout(()=>this.kill(a,'SIGKILL'),2000);return this.get(id);}
 kill(a,signal){try{process.kill(-a.child.pid,signal);}catch{try{a.child?.kill(signal);}catch{}}}
 shutdown(){this.closed=true;clearTimeout(this.saveTimer);const a=this.active;if(a){a.interrupted=true;a.finished=true;this.kill(a,'SIGKILL');if(this.has(a.id)){const r=this.record(a.id);r.status='interrupted';r.error='Server stopped; worktree retained.';r.finishedAt=now();if(r.mode==='reconcile')r.reconciliationResult={status:'needs-review',message:'Server stopped; reconciliation was not verified.'};}this.release(a);}if(this.runs.length)this.persist();}
}
