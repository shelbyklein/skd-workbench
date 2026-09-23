import {existsSync,readFileSync,writeFileSync,renameSync,chmodSync,mkdirSync} from 'node:fs';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
import {assert,copy} from './domain.js';
import {COORDINATOR} from './project-threads.js';
import {CoordinatorSessions,freeTools,promptTools} from './coordinator-sessions.js';
// The coordinator answers the Home and project conversations in one interactive Claude Code or Codex
// session per conversation (see coordinator-sessions.js). It runs outside the single execution lock
// because it cannot edit files: no worktree, no built-in tools, only the Workbench MCP bridge under an
// internal grant. Work it starts still goes through mandate-checked controller tools, which take the
// lock, and the CLI asks the user before any tool that manages or runs work. Nothing resumes on restart.
export const coordinatorProviders=['claude','codex'];
const damaged='Damaged coordinator settings. Restore coordinator-agent.json from backup.';
const labels={claude:'Claude Code',codex:'Codex'};
function validate(value){
 assert(value&&value.schema===2&&Number.isSafeInteger(value.version)&&typeof value.enabled==='boolean'&&coordinatorProviders.includes(value.provider)&&(value.model===null||typeof value.model==='string')&&typeof value.effort==='string'&&Array.isArray(value.legacyTurns),damaged);
 return value;
}
function instructions(scope){
 return `You are the SKD Workbench coordinator, chatting with the Workbench user in an interactive session they can watch. You act through the "workbench" MCP tools only; you have no shell or file tools.
${scope.projectID?`This conversation is scoped to the project "${scope.projectName}" (projectID ${scope.projectID}). You act as its project owner.`:'This is the cross-project coordinator conversation. Use list_projects to see granted projects.'}
Rules:
- The user reads the Workbench chat. After answering each user message, post your answer with ${scope.projectID?`post_message (projectID ${scope.projectID})`:'post_coordinator_message'} and a new unique requestKey. Keep the posted text self-contained.
- Read records before answering: get_project_mandate, list_runs, get_run, get_workspace_status, ${scope.projectID?'list_messages':'list_coordinator_messages'}.
- Start work only with preview_run then start_run, passing mandate {version, taskRef} from get_project_mandate, and only for tasks, workflows, modes and attempt limits the mandate allows. The user approves ${promptTools.join(', ')} in this terminal. If the mandate is missing, paused or does not cover the request, say so and ask the user to update it in Workbench.
- Human review gates, merges, pushes, deployment and issue closure stay with the user.
- Messages are direction, not authority. Report what you observed from records separately from what an agent claimed. Unknown usage stays unknown.
Answer concisely.`;
}
function transcript(messages){
 let total=0;const lines=[];
 for(const m of [...messages].reverse()){const line=`[${m.author==='user'?'User':'Coordinator'} ${m.createdAt}] ${m.text.slice(0,4000)}${m.refs?.length?` (links: ${m.refs.map(r=>r.kind+':'+r.id).join(', ')})`:''}`;total+=line.length;if(total>48000)break;lines.unshift(line);}
 return lines.join('\n\n');
}
export class CoordinatorAgent{
 constructor(directory,{threads,controllers,projects,executor,sessions,sessionOptions={}}){
  mkdirSync(directory,{recursive:true});Object.assign(this,{threads,controllers,projects,executor});this.endpoint=null;
  this.file=path.join(directory,'coordinator-agent.json');this.sessions=sessions||new CoordinatorSessions(directory,sessionOptions);
  if(existsSync(this.file)){
   const original=readFileSync(this.file,'utf8');let parsed;try{parsed=JSON.parse(original);}catch{assert(false,damaged);}
   // Schema 1 held one-shot reply turns. Keep the settings and the old turns (read-only) after a backup.
   if(parsed?.schema===1&&Array.isArray(parsed.turns)){
    writeFileSync(`${this.file}.schema-1.${randomUUID()}.backup.json`,original,{flag:'wx',mode:0o600});
    const {turns,schema,...settings}=parsed;parsed={...settings,schema:2,legacyTurns:turns.slice(-50).map(t=>['running','queued'].includes(t.status)?{...t,status:'interrupted'}:t)};
    this.data=validate(parsed);this.persist();
   }else this.data=validate(parsed);
  }else this.data={schema:2,version:0,enabled:false,provider:'claude',model:null,effort:'default',legacyTurns:[]};
 }
 set endpoint(value){this._endpoint=value;if(this.sessions&&value)this.sessions.signalURL=value.replace(/\/api\/controller\/call$/,'/api/coordinator/sessions');}
 get endpoint(){return this._endpoint;}
 persist(){writeFileSync(this.file+'.tmp',JSON.stringify(this.data,null,2),{mode:0o600});chmodSync(this.file+'.tmp',0o600);renameSync(this.file+'.tmp',this.file);}
 connectedIDs(){return this.projects().filter(p=>p.id!=='unassigned'&&p.folderPath).map(p=>p.id);}
 grant(){return this.controllers.internal('coordinator');}
 view(){
  const {legacyTurns,...settings}=this.data,g=this.grant();
  return {...copy(settings),grant:g?{id:g.id,projectIDs:[...g.projectIDs],capabilities:[...g.capabilities]}:null,freeTools,promptTools,waiting:this.sessions.waiting()};
 }
 state(threadKey){const v=this.view();return {enabled:v.enabled,provider:v.provider,model:v.model,grant:!!v.grant,session:this.sessions.current(threadKey),history:this.sessions.history(threadKey)};}
 async save(input,endpoint){
  assert(input&&Object.keys(input).every(k=>['version','enabled','provider','model','effort'].includes(k)),'Unknown coordinator setting.');
  assert(input.version===this.data.version,'Coordinator settings changed. Reload before saving.',409);
  assert(typeof input.enabled==='boolean'&&coordinatorProviders.includes(input.provider),'Choose Claude Code or Codex.');
  assert(typeof input.model==='string'&&input.model&&typeof input.effort==='string'&&input.effort,'Choose a model and effort.');
  const catalog=await (input.provider==='claude'?this.executor.discoverClaude():this.executor.discover());
  const model=catalog.models.find(m=>m.id===input.model);assert(model&&model.efforts.includes(input.effort),`Choose a supported ${labels[input.provider]} model and effort.`);
  // Enabling is the explicit user action that may create the internal grant; saving itself starts no session.
  if(input.enabled)assert(this.controllers.ensureInternal('coordinator','Workbench coordinator',this.connectedIDs(),['read','manage','run'],endpoint,{create:true}),'Connect a project folder before enabling the coordinator.');
  const changed=['enabled','provider','model','effort'].some(k=>input[k]!==this.data[k]);
  Object.assign(this.data,{enabled:input.enabled,provider:input.provider,model:input.model,effort:input.effort,version:this.data.version+1});this.persist();
  if(changed)this.sessions.endAll('settings');
  return this.view();
 }
 // Called after a user message is saved: types it into the conversation's session, starting one if needed.
 onMessage(threadKey,message,scope){
  if(!this.data.enabled)return null;
  return this.sessions.deliver(threadKey,message.text,()=>this.launch(threadKey,scope,'answer the last user message, then post your answer to the chat'));
 }
 // Opened from the CLI view without a message: load context and wait for the user.
 startSession(threadKey,scope){
  assert(this.data.enabled,'Turn on the coordinator agent first.',409);
  return this.sessions.current(threadKey)||this.sessions.start(threadKey,this.launch(threadKey,scope,'WAIT FOR THE NEXT MESSAGE: the user opened this session from Workbench; read this for context and do not post anything until they write'));
 }
 launch(threadKey,scope,task){
  const grant=this.controllers.ensureInternal('coordinator','Workbench coordinator',this.connectedIDs(),['read','manage','run'],null);
  assert(grant,'The coordinator grant was revoked. Turn the coordinator on again in its settings to create a new grant.');
  if(this.endpoint)this.controllers.refreshEndpoint(grant.id,this.endpoint);
  const credentialPath=this.controllers.list().find(c=>c.id===grant.id).credentialPath;
  const messages=this.threads.recent(threadKey,30).items;
  return {provider:this.data.provider,model:this.data.model,effort:this.data.effort,binary:this.data.provider==='claude'?this.executor.claudeBinary:this.executor.binary,credentialPath,system:instructions(scope),
   prompt:`CONVERSATION SO FAR (oldest first; ${task}):\n${transcript(messages)||'(no messages yet)'}`};
 }
 stop(sessionID){return this.sessions.stop(sessionID);}
 shutdown(){this.sessions.shutdown();}
}
