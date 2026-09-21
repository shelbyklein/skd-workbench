import {claudeBinary,discoverClaude,claudeArgs,consumeClaude} from './claude.js';
import {spawn,execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {existsSync,mkdirSync,readFileSync,writeFileSync,renameSync,realpathSync} from 'node:fs';
import {homedir} from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {randomUUID} from 'node:crypto';
import {assert,Problem} from './domain.js';
import {canonicalFolder} from './projects.js';
import {benchmarkContext,archiveWorkspace,removeWorkspace} from './benchmarks.js';
import {createToolActivity,finalizeToolActivity,finishToolCall,markActivityGap,startToolCall} from './activity.js';
const exec=promisify(execFile),activeStates=['preparing','running','stopping'];
const timestamp=()=>new Date().toISOString();
export function codexBinary(){return process.env.SKD_CODEX_BIN||[path.join(homedir(),'.local/bin/codex'),'/opt/homebrew/bin/codex','/usr/local/bin/codex'].find(existsSync)||'codex';}
function kill(child,signal='SIGTERM'){if(!child?.pid)return;try{process.kill(-child.pid,signal);}catch{try{child.kill(signal);}catch{}}}
export async function discoverCodex(binary=codexBinary()){
 const [{stdout:version},login]=await Promise.all([exec(binary,['--version'],{timeout:6000}),exec(binary,['login','status'],{timeout:6000}).then(r=>(r.stdout+r.stderr).trim()).catch(()=>null)]);
 if(!login)throw new Problem('Codex is not signed in. Run codex login in Terminal.',503);
 const models=await new Promise((resolve,reject)=>{
  const child=spawn(binary,['app-server','--stdio'],{stdio:['pipe','pipe','ignore'],detached:true});let buffer='',done=false;child.stdout.setEncoding('utf8');
  const finish=(err,result)=>{if(done)return;done=true;clearTimeout(timer);kill(child);err?reject(err):resolve(result);};
  const timer=setTimeout(()=>finish(new Error('Codex model discovery timed out.')),12000);
  const send=message=>child.stdin.write(JSON.stringify(message)+'\n');
  child.on('error',e=>finish(e));child.stdin.on('error',e=>finish(e));child.on('exit',()=>{if(!done)finish(new Error('Codex model discovery exited.'));});
  child.stdout.on('data',chunk=>{buffer+=chunk;if(buffer.length>2*1024*1024){finish(new Error('Codex discovery response too large.'));return;}let n;while((n=buffer.indexOf('\n'))>=0){const line=buffer.slice(0,n);buffer=buffer.slice(n+1);let event;try{event=JSON.parse(line);}catch{continue;}
   if(event.error){finish(new Error(event.error.message||'Model discovery failed.'));return;}
   if(event.id===1){send({method:'initialized'});send({id:2,method:'model/list',params:{limit:100}});}
   if(event.id===2)finish(null,event.result?.data||[]);
  }});
  send({id:1,method:'initialize',params:{clientInfo:{name:'skd_workbench',version:'0.4.0'}}});
 });
 return {available:true,version:version.trim(),auth:login.startsWith('Logged in using ChatGPT')?'ChatGPT':'Signed in',models:models.filter(m=>!m.hidden).map(m=>({id:m.model,name:m.displayName,efforts:m.supportedReasoningEfforts.map(e=>e.reasoningEffort).filter(e=>e!=='ultra'),defaultEffort:m.defaultReasoningEffort,isDefault:m.isDefault})),checkedAt:timestamp()};
}
export function usageFrom(event){
 if(!event||typeof event!=='object')return null;
 const value=k=>Number.isSafeInteger(event[k])&&event[k]>=0?event[k]:null;
 return {inputTokens:value('input_tokens'),cachedInputTokens:value('cached_input_tokens'),outputTokens:value('output_tokens'),reasoningOutputTokens:value('reasoning_output_tokens')};
}
export function codexArgs(r){
 let args=['exec','--json','--ephemeral','--ignore-user-config','--ignore-rules','--color','never','--sandbox',r.mode==='worktree'?'workspace-write':'read-only','-c','approval_policy="never"','-c','features.multi_agent=false','-c',`model_reasoning_effort="${r.effort}"`,...(r.agentContext?.skills?.text?['-c',`developer_instructions=${JSON.stringify(r.agentContext.skills.text)}`]:[]),'--model',r.model,'--cd',r.workingDirectory];
 if(r.purpose==='issue-proposal')args.push('--disable','shell_tool','--disable','unified_exec','-c','web_search="disabled"');
 if(r.sourceContext?.git?.status!=='connected')args.push('--skip-git-repo-check');
 args.push('-');
 return args;
}
async function git(folder,args){const env={...process.env,GIT_TERMINAL_PROMPT:'0'};for(const k of Object.keys(env))if(k.startsWith('GIT_')&&k!=='GIT_TERMINAL_PROMPT')delete env[k];return (await exec('git',['-c','core.hooksPath=/dev/null','-c','core.fsmonitor=false','-C',folder,...args],{env,timeout:15000,maxBuffer:1024*1024})).stdout;}
export class CodexRuns{
 constructor(directory,{binary=codexBinary(),discover=()=>discoverCodex(binary),spawnProcess=spawn,timeoutMs=600000,claudeOptions={},skills=null,connections=null,playbooks=null}={}){
  this.claudeBinary=claudeOptions.binary||claudeBinary();this.discoverClaude=claudeOptions.discover||(()=>discoverClaude(this.claudeBinary));this.directory=directory;this.binary=binary;this.discover=discover;this.spawnProcess=spawnProcess;this.timeoutMs=timeoutMs;this.skills=skills;this.connections=connections;this.playbooks=playbooks;this.active=null;this.starting=false;this.cleaning=0;this.owner=null;this.onFinish=()=>{};
  mkdirSync(directory,{recursive:true});this.directory=realpathSync(directory);this.file=path.join(directory,'codex-runs.json');this.runs=existsSync(this.file)?JSON.parse(readFileSync(this.file,'utf8')):[];assert(Array.isArray(this.runs),'Damaged Codex history. Restore a backup.');
  let changed=false;for(const r of this.runs)if(activeStates.includes(r.status)){r.status='interrupted';r.error='The server stopped before this run finished. It has not been restarted.';r.finishedAt=timestamp();if(r.toolActivity)finalizeToolActivity(r.toolActivity,'unknown',r.finishedAt);changed=true;}
  for(const r of this.runs)if(['saving','clearing'].includes(r.reset?.status)){r.reset={...r.reset,status:'retained',error:'Server stopped during reset. Inspect the archive and workspace; no cleanup was resumed.'};changed=true;}
  if(changed)this.persist();
 }
 persist(){writeFileSync(this.file+'.tmp',JSON.stringify(this.runs,null,2),{mode:0o600});renameSync(this.file+'.tmp',this.file);}
 list(projectID){return structuredClone(this.runs.filter(r=>!projectID||r.projectID===projectID));}
 get(id){const r=this.runs.find(r=>r.id===id);assert(r,'Codex run not found.',404);return structuredClone(r);}
 update(id,fn){const r=this.runs.find(r=>r.id===id);fn(r);this.persist();return r;}
 async start(input,project,internal={}){
  const agent=input.agent||'codex';assert(['codex','claude'].includes(agent),'Choose Codex or Claude.');assert(!internal.workflowID||agent==='codex','Claude workflows are not supported yet.');
  assert(!this.owner||this.owner===internal.workflowID,'A workflow owns the executor. Finish or stop it before starting another task.',409);
  assert(!this.active&&!this.starting&&!this.cleaning,'Another agent session is already running. Stop or finish it first.',409);
  assert(typeof input.task==='string'&&input.task.trim()&&input.task.length<=(internal.workflowID||internal.issueProposal?128000:16000),'Enter a task (up to 16,000 characters).');
  assert(['read-only','worktree'].includes(input.mode),'Choose read-only or isolated worktree.');
  assert(project.folderPath,'Connect a project folder before starting a session.');
  this.starting=true;
  try{
   const provider=await (agent==='claude'?this.discoverClaude():this.discover()),model=provider.models.find(m=>m.id===input.model);
   assert(model&&model.efforts.includes(input.effort),'Choose a supported agent model and effort.');
   const context=internal.workspace?.sourceContext||await benchmarkContext(project,input.mode);
   if(internal.workspace)await canonicalFolder(internal.workspace.workingDirectory);
   if(internal.expectedContext&&!internal.workspace&&input.mode==='worktree')assert(context.git?.commit===internal.expectedContext.git?.commit,'The source commit changed before execution. Start a new workflow.');
   if(internal.shouldLaunch)assert(internal.shouldLaunch(),'Workflow stopped before this step launched.',409);
   if(input.mode==='worktree'&&!internal.workspace)assert(context.git?.status==='connected'&&context.git.commit&&context.git.dirty===false,'Coding requires a clean Git repository with a commit. Commit or stash changes first.');
   const purpose=internal.issueProposal?'issue-proposal':internal.workflowID?'workflow':'session';
   const playbookContext=!internal.agentContext&&purpose==='session'&&this.playbooks?await this.playbooks.resolveLaunch(project,agent,input.playbook||{mode:'legacy',skills:input.skills,connections:input.connections},{purpose,mode:input.mode}):internal.agentContext?.playbook||null;
   const skillSelection=playbookContext?.skillSelection||input.skills||{mode:'inherit',skillIDs:[]},connectionSelection=playbookContext?.connectionSelection||input.connections||{mode:'inherit',connectionIDs:[]};
   const skillContext=internal.agentContext?.skills?(this.skills?.validateSnapshot(project,agent,internal.agentContext.skills)||internal.agentContext.skills):(this.skills?.resolve(project,agent,skillSelection,{purpose})||{status:'empty',entries:[],text:''});
   const connectionContext=this.connections?await this.connections.resolve(project,agent,connectionSelection,{purpose,mode:input.mode}):{status:'excluded',connections:[],reason:'Connections are unavailable.'};delete connectionContext._connections;
   const r={id:randomUUID(),agent,projectID:project.id,projectSnapshot:structuredClone(project),sourceContext:context,task:input.task.trim(),model:input.model,effort:input.effort,mode:input.mode,status:'preparing',createdAt:timestamp(),finishedAt:null,output:'',activity:[],toolActivity:createToolActivity(agent),usage:null,cost:null,error:null,threadID:null,cliVersion:provider.version,workingDirectory:context.folderPath,branch:null,...(internal.workspace||{}),purpose:internal.issueProposal?'issue-proposal':null,workflowID:internal.workflowID||null,attemptID:internal.attemptID||null,agentContext:{playbook:playbookContext?structuredClone(playbookContext):null,skills:skillContext,connections:connectionContext}};
   this.runs.push(r);this.persist();
   this.active={id:r.id,child:null,cancelled:false};
   // Return the durable record before launching; refreshing the UI never resubmits it.
   setImmediate(()=>this.execute(r).catch(e=>{if(this.active?.id===r.id)this.finish(r.id,'failed',e.message);}));
   return structuredClone(r);
  }finally{this.starting=false;}
 }
 async execute(r){
  const active=this.active;
  if(r.mode==='worktree'&&!r.worktreePath){
   const base=path.join(this.directory,'worktrees');mkdirSync(base,{recursive:true});const destination=path.join(base,r.id),branch=(r.agent==='claude'?'claude':'codex')+'/skd-'+r.id;
   await git(r.sourceContext.git.root,['worktree','add','-b',branch,destination,r.sourceContext.git.commit]);
   const relative=path.relative(r.sourceContext.git.root,r.sourceContext.folderPath);
   this.update(r.id,x=>{x.workingDirectory=path.join(destination,relative);x.worktreePath=destination;x.branch=branch;});
  }
  if(active.interrupted)return;
  if(active.cancelled){clearTimeout(active.killTimer);this.finish(r.id,'cancelled','Stopped before agent launched.');return;}
  let args=codexArgs(r);
  if(r.agent==='claude')args=claudeArgs(r);
  const env={...process.env};if(r.purpose==='issue-proposal')for(const key of ['GH_TOKEN','GITHUB_TOKEN','GH_ENTERPRISE_TOKEN','GITHUB_ENTERPRISE_TOKEN'])delete env[key];
  const child=this.spawnProcess(process.execPath,[fileURLToPath(new URL('../scripts/codex-child.mjs',import.meta.url)),r.agent==='claude'?this.claudeBinary:this.binary,...args],{stdio:['pipe','pipe','pipe'],detached:true,cwd:r.workingDirectory,env});active.child=child;
  this.update(r.id,x=>{x.status='running';x.startedAt=timestamp();});
  let buffer='',stderr='',bytes=0,completed=false,providerError=null,settled=false;
  const timer=setTimeout(()=>{providerError='Runtime limit reached (10 minutes).';kill(child);active.killTimer=setTimeout(()=>kill(child,'SIGKILL'),2000);},this.timeoutMs);
  const consume=line=>{
   let e;try{e=JSON.parse(line);}catch{providerError='Agent emitted an invalid JSON event.';this.update(r.id,x=>markActivityGap(x.toolActivity,'The provider emitted a malformed structured event.'));return;}
   this.update(r.id,x=>{
    if(r.agent==='claude'){const result=consumeClaude(x,e);if(result.completed)completed=true;if(result.error)providerError=result.error;return;}
    if(e.type==='thread.started')x.threadID=e.thread_id;
    if(e.type==='item.completed'&&e.item?.type==='agent_message')x.output+=(x.output?'\n\n':'')+String(e.item.text||'');
    if(e.type==='item.started'||e.type==='item.completed'){const item=e.item||{},tool=['command_execution','mcp_tool_call','web_search','file_change'].includes(item.type);x.activity.push({at:timestamp(),type:item.type||'event',status:item.status||e.type.slice(5),text:String(item.command||item.text||item.type||'').slice(0,1000)});x.activity=x.activity.slice(-100);if(tool){const callID=String(item.id||item.call_id||'');const toolName=item.type==='mcp_tool_call'?String(item.tool||item.name||'mcp_tool'):item.type==='command_execution'?'shell':item.type==='web_search'?'web_search':'file_change';if(e.type==='item.started')startToolCall(x.toolActivity,{callID,toolName,toolType:item.type,server:item.server,sourceEventID:e.id,connections:x.agentContext?.connections?.connections});else finishToolCall(x.toolActivity,{callID,outcome:item.status==='failed'||item.exit_code>0?'error':'success',error:item.error?.message,toolName,connections:x.agentContext?.connections?.connections});}if(e.type==='item.completed'&&item.type==='command_execution'){x.commands??=[];x.commands.push({command:item.command,output:item.aggregated_output??'',exitCode:item.exit_code??null});}}
    if(e.type==='turn.completed'){completed=true;x.usage=usageFrom(e.usage);}
    if(e.type==='turn.failed'||e.type==='error')providerError=String(e.error?.message||e.message||'Codex failed.');
   });
  };
  const settle=async(code,error)=>{
   if(settled)return;settled=true;clearTimeout(timer);clearTimeout(active.killTimer);
   if(buffer.trim())consume(buffer);
   const status=active.interrupted?'interrupted':active.cancelled?'cancelled':error||code!==0||!completed||providerError?'failed':'completed';this.update(r.id,x=>finalizeToolActivity(x.toolActivity,status==='cancelled'?'cancelled':'unknown'));
   if(r.worktreePath){try{const changes=await git(r.worktreePath,['status','--short']);const diff=await git(r.worktreePath,['diff','--no-ext-diff','--no-textconv',r.sourceContext.git.commit,'--']);this.update(r.id,x=>{x.changes=changes;x.diff=diff;x.diffNote='Tracked changes relative to the starting commit. New files are listed above; inspect them in the retained worktree.';});}catch{this.update(r.id,x=>{x.diffNote='Could not collect diff; inspect the retained worktree.';});}}
   if(r.projectSnapshot.benchmark&&r.worktreePath&&status!=='interrupted'){try{const artifact=await archiveWorkspace(this.directory,r.id,r,{...this.get(r.id),status});this.update(r.id,x=>{x.artifact=artifact;x.diffNote='Tracked diff shown below. Complete files and command evidence are saved in the downloadable archive.';});}catch(e){this.update(r.id,x=>{x.archiveError=e.message;});}}
   this.finish(r.id,status,active.interrupted?'Local server stopped.':active.cancelled?'Stopped by you.':error?.message||providerError||(status==='failed'?stderr.trim().slice(-3000)||'Agent exited without a completed turn.':null));
  };
  child.stdout.setEncoding('utf8');child.stderr.setEncoding('utf8');
  child.stdout.on('data',chunk=>{bytes+=Buffer.byteLength(chunk);if(bytes>2*1024*1024){providerError='Output limit reached (2 MiB).';kill(child,'SIGKILL');return;}buffer+=chunk;let n;while((n=buffer.indexOf('\n'))>=0){const line=buffer.slice(0,n);buffer=buffer.slice(n+1);if(line.trim())consume(line);}});
  child.stderr.on('data',c=>{stderr=(stderr+c).slice(-4000);});child.on('error',e=>settle(null,e));child.on('close',code=>settle(code));child.stdin.on('error',()=>{});
  child.stdin.end(`You are running a single task in SKD Workbench. Do not delegate to other agents. Do not push, merge, or modify other checkouts. ${r.mode==='read-only'?'Inspect and respond only; do not edit files.':'Make changes only in this isolated worktree. Report checks run and any limitations; leave changes for human review.'}\n\nUser task:\n${r.task}`);
 }
 finish(id,status,error){this.update(id,r=>{r.status=status;r.error=error;r.finishedAt=timestamp();});if(this.active?.id===id)this.active=null;
  const r=this.get(id);if(r.projectSnapshot?.benchmark&&!r.workflowID&&status!=='interrupted'&&r.worktreePath){this.resetWorkspace(id,r,r,x=>this.update(id,y=>{y.reset=x;}));}
  this.onFinish(this.get(id));
 }
 async resetWorkspace(id,workspace,evidence,save){
  this.cleaning++;save({status:'saving'});
  let artifact;
  try{artifact=await archiveWorkspace(this.directory,id,workspace,evidence);save({status:'clearing',artifact});const result=await removeWorkspace(this.directory,workspace,artifact);save({...result,artifact});}
  catch(e){save({status:'retained',error:e.message,...(artifact?{artifact}:{})});}
  finally{this.cleaning--;}
 }
 stop(id,workflowID=null){const r=this.get(id);assert(!r.workflowID||r.workflowID===workflowID,'Stop this task from its workflow.',409);assert(this.active?.id===id&&activeStates.includes(r.status),'This run is no longer active.',409);this.active.cancelled=true;kill(this.active.child);const a=this.active;a.killTimer=setTimeout(()=>kill(a.child,'SIGKILL'),2000);return structuredClone(this.update(id,r=>{r.status='stopping';}));}
 shutdown(){if(this.active){const a=this.active;a.interrupted=true;a.cancelled=true;clearTimeout(a.killTimer);kill(a.child,'SIGKILL');this.finish(a.id,'interrupted','Local server stopped. This run will not restart automatically.');}}
}
