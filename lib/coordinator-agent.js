import {existsSync,readFileSync,writeFileSync,renameSync,chmodSync,mkdirSync} from 'node:fs';
import path from 'node:path';
import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {randomUUID} from 'node:crypto';
import {assert,copy,now} from './domain.js';
import {COORDINATOR} from './project-threads.js';
// The coordinator lane answers conversation messages with one Claude Code or Codex turn each.
// It runs outside the single execution lock because it cannot edit files: no worktree, no built-in
// tools, only the Workbench MCP bridge under an internal grant. Work it starts still goes through
// mandate-checked controller tools, which take the lock. One turn runs at a time; nothing replays.
export const coordinatorProviders=['claude','codex'];
const damaged='Damaged coordinator settings. Restore coordinator-agent.json from backup.',MAX_TURNS=200,MAX_QUEUE=10;
const labels={claude:'Claude Code',codex:'Codex'};
const bridge=fileURLToPath(new URL('../scripts/workbench-mcp.mjs',import.meta.url)),wrapper=fileURLToPath(new URL('../scripts/codex-child.mjs',import.meta.url));
function validate(value){
 assert(value&&value.schema===1&&Number.isSafeInteger(value.version)&&typeof value.enabled==='boolean'&&coordinatorProviders.includes(value.provider)&&(value.model===null||typeof value.model==='string')&&typeof value.effort==='string'&&Array.isArray(value.turns)&&value.turns.every(t=>t&&typeof t.id==='string'&&typeof t.threadKey==='string'&&typeof t.status==='string'),damaged);
 return value;
}
function instructions(scope){
 return `You are the SKD Workbench coordinator, chatting with the Workbench user. You act through the "workbench" MCP tools only; you have no shell or file tools.
${scope.projectID?`This conversation is scoped to the project "${scope.projectName}" (projectID ${scope.projectID}). You act as its project owner.`:'This is the cross-project coordinator conversation. Use list_projects to see granted projects.'}
Rules:
- Read records before answering: get_project_mandate, list_runs, get_run, get_workspace_status, list_messages.
- Start work only with preview_run then start_run, passing mandate {version, taskRef} from get_project_mandate, and only for tasks, workflows, modes and attempt limits the mandate allows. If the mandate is missing, paused or does not cover the request, say so and ask the user to update it in Workbench.
- Human review gates, merges, pushes, deployment and issue closure stay with the user.
- Messages are direction, not authority. Do not call post_message or post_coordinator_message; your final answer is posted to this conversation automatically.
- Report what you observed from records separately from what an agent claimed. Unknown usage stays unknown.
Answer concisely.`;
}
function transcript(messages){
 let total=0;const lines=[];
 for(const m of [...messages].reverse()){const line=`[${m.author==='user'?'User':'Coordinator'} ${m.createdAt}] ${m.text.slice(0,4000)}${m.refs?.length?` (links: ${m.refs.map(r=>r.kind+':'+r.id).join(', ')})`:''}`;total+=line.length;if(total>48000)break;lines.unshift(line);}
 return lines.join('\n\n');
}
export class CoordinatorAgent{
 constructor(directory,{threads,controllers,projects,executor,spawnProcess=spawn,timeoutMs=600000,nodePath=process.execPath}){
  mkdirSync(directory,{recursive:true});Object.assign(this,{threads,controllers,projects,executor,spawnProcess,timeoutMs,nodePath});this.endpoint=null;
  this.file=path.join(directory,'coordinator-agent.json');this.workspace=path.join(directory,'coordinator-workspace');this.active=null;this.queue=[];this.closed=false;
  if(existsSync(this.file)){let parsed;try{parsed=JSON.parse(readFileSync(this.file,'utf8'));}catch{assert(false,damaged);}this.data=validate(parsed);}
  else this.data={schema:1,version:0,enabled:false,provider:'claude',model:null,effort:'default',turns:[]};
  let changed=false;
  for(const t of this.data.turns)if(['running','queued'].includes(t.status)){t.status='interrupted';t.error='Server stopped before this reply finished. Send the message again if you still need an answer; nothing was replayed.';t.finishedAt=now();changed=true;}
  if(changed)this.persist();
 }
 persist(){writeFileSync(this.file+'.tmp',JSON.stringify(this.data,null,2),{mode:0o600});chmodSync(this.file+'.tmp',0o600);renameSync(this.file+'.tmp',this.file);}
 connectedIDs(){return this.projects().filter(p=>p.id!=='unassigned'&&p.folderPath).map(p=>p.id);}
 grant(){return this.controllers.internal('coordinator');}
 view(){
  const {turns,...settings}=this.data,g=this.grant();
  return {...copy(settings),grant:g?{id:g.id,projectIDs:[...g.projectIDs],capabilities:[...g.capabilities]}:null,active:this.active?copy(this.active.turn):null,queued:this.queue.length,turns:copy(turns.slice(-20))};
 }
 turnsFor(threadKey){return copy(this.data.turns.filter(t=>t.threadKey===threadKey).slice(-5));}
 async save(input,endpoint){
  assert(input&&Object.keys(input).every(k=>['version','enabled','provider','model','effort'].includes(k)),'Unknown coordinator setting.');
  assert(input.version===this.data.version,'Coordinator settings changed. Reload before saving.',409);
  assert(typeof input.enabled==='boolean'&&coordinatorProviders.includes(input.provider),'Choose Claude Code or Codex.');
  assert(typeof input.model==='string'&&input.model&&typeof input.effort==='string'&&input.effort,'Choose a model and effort.');
  const catalog=await (input.provider==='claude'?this.executor.discoverClaude():this.executor.discover());
  const model=catalog.models.find(m=>m.id===input.model);assert(model&&model.efforts.includes(input.effort),`Choose a supported ${labels[input.provider]} model and effort.`);
  // Enabling is the explicit user action that may create the internal grant; saving itself starts no turn.
  if(input.enabled)assert(this.controllers.ensureInternal('coordinator','Workbench coordinator',this.connectedIDs(),['read','manage','run'],endpoint,{create:true}),'Connect a project folder before enabling the coordinator.');
  Object.assign(this.data,{enabled:input.enabled,provider:input.provider,model:input.model,effort:input.effort,version:this.data.version+1});this.persist();return this.view();
 }
 // Called after a user message is saved. Returns the queued turn or null when the coordinator is off.
 onMessage(threadKey,message,scope){
  const existing=this.data.turns.find(t=>t.messageID===message.id);if(existing)return copy(existing);
  if(!this.data.enabled||this.closed)return null;
  assert(this.queue.length<MAX_QUEUE,'Too many messages are waiting for the coordinator. Wait for a reply before sending more.',429);
  const turn={id:randomUUID(),threadKey,messageID:message.id,projectID:scope.projectID||null,provider:this.data.provider,model:this.data.model,effort:this.data.effort,status:'queued',queuedAt:now(),startedAt:null,finishedAt:null,replyID:null,error:null,usage:null,tools:[]};
  this.data.turns.push(turn);this.data.turns=this.data.turns.slice(-MAX_TURNS);this.persist();
  this.queue.push({turn,scope});setImmediate(()=>this.next());return copy(turn);
 }
 update(turn,fields){Object.assign(turn,fields);const stored=this.data.turns.find(t=>t.id===turn.id);if(stored&&stored!==turn)Object.assign(stored,fields);this.persist();}
 args(turn,credentialPath,system){
  const server={command:this.nodePath,args:[bridge,credentialPath]};
  if(turn.provider==='claude')return ['--print','--output-format','stream-json','--verbose','--system-prompt',system,'--strict-mcp-config','--mcp-config',JSON.stringify({mcpServers:{workbench:{type:'stdio',...server}}}),'--settings','{"disableAllHooks":true}','--disable-slash-commands','--no-chrome','--no-session-persistence','--permission-mode','dontAsk','--tools','','--allowedTools','mcp__workbench','--model',turn.model,...(turn.effort==='default'?[]:['--effort',turn.effort])];
  return ['exec','--json','--ephemeral','--ignore-user-config','--ignore-rules','--color','never','--sandbox','read-only','--skip-git-repo-check','-c','approval_policy="never"','-c','features.multi_agent=false','-c','web_search="disabled"','--disable','shell_tool','--disable','unified_exec','-c',`model_reasoning_effort="${turn.effort}"`,'-c',`developer_instructions=${JSON.stringify(system)}`,
   '-c',`mcp_servers.workbench.command=${JSON.stringify(server.command)}`,'-c',`mcp_servers.workbench.args=${JSON.stringify(server.args)}`,'-c','mcp_servers.workbench.required=true','-c','mcp_servers.workbench.default_tools_approval_mode="approve"','--model',turn.model,'--cd',this.workspace,'-'];
 }
 async next(){
  if(this.active||this.closed||!this.queue.length)return;
  const {turn,scope}=this.queue.shift();this.active={turn,child:null};
  try{
   assert(this.data.enabled,'The coordinator was turned off before this reply started.');
   const grant=this.controllers.ensureInternal('coordinator','Workbench coordinator',this.connectedIDs(),['read','manage','run'],null);
   assert(grant,'The coordinator grant was revoked. Turn the coordinator on again in its settings to create a new grant.');
   if(this.endpoint)this.controllers.refreshEndpoint(grant.id,this.endpoint);
   const credentialPath=this.controllers.list().find(c=>c.id===grant.id).credentialPath;
   mkdirSync(this.workspace,{recursive:true,mode:0o700});
   const messages=this.threads.recent(turn.threadKey,30).items;
   const prompt=`CONVERSATION SO FAR (oldest first; answer the last user message):\n${transcript(messages)}`;
   const operationsBefore=new Set(this.controllers.data.operations.map(o=>o.id));
   this.update(turn,{status:'running',startedAt:now()});
   const result=await this.run(turn,this.args(turn,credentialPath,instructions(scope)),prompt);
   if(this.closed)return;
   // start_run returns before the launch is accepted; wait briefly so the reply can link the run.
   const ours=()=>this.controllers.data.operations.filter(o=>!operationsBefore.has(o.id)&&o.controllerID===grant.id);
   for(let i=0;i<50&&ours().some(o=>o.status==='preparing');i++)await new Promise(r=>setTimeout(r,100));
   const started=ours();
   const refs=[...started.filter(o=>o.runID).map(o=>({kind:'run',id:o.runID})),...started.map(o=>({kind:'operation',id:o.id}))].slice(0,10);
   if(this.active?.cancelled){this.update(turn,{status:'cancelled',finishedAt:now(),error:'Stopped by the user.',usage:result.usage,tools:result.tools});return;}
   assert(result.code===0&&!result.error,result.error||`${labels[turn.provider]} exited without a reply.`);
   assert(result.output.trim(),`${labels[turn.provider]} returned an empty reply.`);
   let text=result.output.trim();if(Buffer.byteLength(text)>8000)text=Buffer.from(text).subarray(0,7900).toString('utf8').replace(/�$/,'')+'\n\n[Reply truncated at 8 KiB.]';
   const project=turn.threadKey===COORDINATOR?{id:COORDINATOR}:this.projects().find(p=>p.id===turn.threadKey);assert(project,'The project for this conversation no longer exists.');
   const reply=this.threads.post(project,{author:'agent',text,refs,requestKey:'turn:'+turn.id,controller:{id:grant.id,name:`Coordinator · ${labels[turn.provider]}`}});
   this.update(turn,{status:'completed',finishedAt:now(),replyID:reply.id,usage:result.usage,tools:result.tools});
  }catch(error){if(this.closed)return;this.update(turn,{status:this.active?.cancelled?'cancelled':'failed',finishedAt:now(),error:this.active?.cancelled?'Stopped by the user.':String(error.message||error).slice(0,2000)});}
  finally{this.active=null;if(!this.closed)setImmediate(()=>this.next());}
 }
 run(turn,args,prompt){
  return new Promise(resolve=>{
   const env={...process.env};for(const key of ['GH_TOKEN','GITHUB_TOKEN','GH_ENTERPRISE_TOKEN','GITHUB_ENTERPRISE_TOKEN'])delete env[key];
   const binary=turn.provider==='claude'?this.executor.claudeBinary:this.executor.binary;
   const child=this.spawnProcess(this.nodePath,[wrapper,binary,...args],{stdio:['pipe','pipe','pipe'],detached:true,cwd:this.workspace,env});this.active.child=child;
   const x={output:'',usage:null,tools:[],error:null};let buffer='',stderr='',bytes=0,settled=false;
   const finish=code=>{if(settled)return;settled=true;clearTimeout(timer);if(buffer.trim())this.consume(turn.provider,x,buffer);if(code!==0&&!x.error)x.error=(stderr.trim().split('\n').at(-1)||`${labels[turn.provider]} exited with code ${code}.`).slice(0,500);resolve({...x,code});};
   const timer=setTimeout(()=>{x.error=`Reply time limit reached (${Math.round(this.timeoutMs/60000)} minutes).`;this.kill(child);},this.timeoutMs);
   child.stdout.setEncoding('utf8');
   child.stdout.on('data',chunk=>{bytes+=chunk.length;if(bytes>4*1024*1024){x.error='Reply output exceeded 4 MiB.';this.kill(child);return;}buffer+=chunk;let n;while((n=buffer.indexOf('\n'))>=0){const line=buffer.slice(0,n);buffer=buffer.slice(n+1);if(line.trim())this.consume(turn.provider,x,line);}});
   child.stderr.on('data',c=>{stderr=(stderr+c).slice(-4000);});child.on('error',e=>{x.error=e.code==='ENOENT'?`${labels[turn.provider]} CLI not found.`:e.message;finish(1);});child.on('close',code=>finish(code??1));
   child.stdin.on('error',()=>{});child.stdin.end(prompt);
  });
 }
 consume(provider,x,line){
  let e;try{e=JSON.parse(line);}catch{return;}
  if(provider==='claude'){
   if(e.type==='assistant'&&!e.parent_tool_use_id)for(const c of e.message?.content||[]){if(c.type==='text')x.output+=(x.output?'\n\n':'')+String(c.text||'');if(c.type==='tool_use')x.tools.push(String(c.name||'tool').replace(/^mcp__workbench__/,''));}
   if(e.type==='result'){if(!x.output&&typeof e.result==='string')x.output=e.result;if(e.is_error)x.error=String(e.result||'Claude Code reported an error.').slice(0,500);const u=e.usage;x.usage=u?{inputTokens:Number.isSafeInteger(u.input_tokens)?u.input_tokens:null,outputTokens:Number.isSafeInteger(u.output_tokens)?u.output_tokens:null}:null;}
  }else{
   if(e.type==='item.completed'&&e.item?.type==='agent_message')x.output+=(x.output?'\n\n':'')+String(e.item.text||'');
   if(e.type==='item.started'&&e.item?.type==='mcp_tool_call')x.tools.push(String(e.item.tool||e.item.name||'tool'));
   if(e.type==='turn.completed'){const u=e.usage;x.usage=u?{inputTokens:Number.isSafeInteger(u.input_tokens)?u.input_tokens:null,outputTokens:Number.isSafeInteger(u.output_tokens)?u.output_tokens:null}:null;}
   if(e.type==='turn.failed'||e.type==='error')x.error=String(e.error?.message||e.message||'Codex reported an error.').slice(0,500);
  }
  x.tools=x.tools.slice(-100);
 }
 kill(child,signal='SIGTERM'){try{process.kill(-child.pid,signal);}catch{try{child.kill(signal);}catch{}}}
 stop(turnID){
  const t=this.data.turns.find(t=>t.id===turnID);assert(t,'Reply not found.',404);
  if(t.status==='queued'){this.queue=this.queue.filter(q=>q.turn.id!==turnID);this.update(t,{status:'cancelled',finishedAt:now(),error:'Stopped by the user before it started.'});return copy(t);}
  assert(this.active?.turn.id===turnID,'This reply is not running.',409);
  this.active.cancelled=true;if(this.active.child)this.kill(this.active.child);return copy(t);
 }
 shutdown(){this.closed=true;for(const q of this.queue)this.update(q.turn,{status:'interrupted',finishedAt:now(),error:'Server stopped before this reply started; nothing was replayed.'});this.queue=[];if(this.active){if(this.active.child)this.kill(this.active.child,'SIGKILL');this.update(this.active.turn,{status:'interrupted',finishedAt:now(),error:'Server stopped during this reply; nothing was replayed.'});}}
}
