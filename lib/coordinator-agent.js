import {existsSync,readFileSync,writeFileSync,renameSync,chmodSync,mkdirSync} from 'node:fs';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
import {assert,copy} from './domain.js';
import {COORDINATOR} from './project-threads.js';
import {CoordinatorSessions,freeTools,promptTools} from './coordinator-sessions.js';
import {git} from './codex.js';
// The coordinator answers the Home and project conversations in one interactive Claude Code or Codex
// session per conversation (see coordinator-sessions.js). It runs outside the single execution lock
// because it cannot edit files: no worktree, no built-in tools, only the Workbench MCP bridge under an
// internal grant. Work it starts still goes through mandate-checked controller tools, which take the
// lock, and the CLI asks the user before any tool that manages or runs work. Nothing resumes on restart.
export const coordinatorProviders=['claude','codex'];
const damaged='Damaged coordinator settings. Restore coordinator-agent.json from backup.';
const labels={claude:'Claude Code',codex:'Codex'},workspaces=['folder','worktree'];
const validAgent=a=>a&&coordinatorProviders.includes(a.provider)&&typeof a.model==='string'&&a.model&&typeof a.effort==='string'&&a.effort&&workspaces.includes(a.workspace);
function validate(value){
 assert(value&&value.schema===2&&Number.isSafeInteger(value.version)&&typeof value.enabled==='boolean'&&coordinatorProviders.includes(value.provider)&&(value.model===null||typeof value.model==='string')&&typeof value.effort==='string'&&Array.isArray(value.legacyTurns),damaged);
 // Per-project agent defaults were added later; older files simply have none.
 assert(value.projectAgents===undefined||value.projectAgents&&typeof value.projectAgents==='object'&&!Array.isArray(value.projectAgents)&&Object.values(value.projectAgents).every(validAgent),damaged);
 value.projectAgents??={};
 return value;
}
const slug=name=>String(name).toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,40)||'project';
function projectInstructions(project,cwd,worktree){
 return `You are the ${project.name} project agent in SKD Workbench, working in ${cwd}${worktree?` (a dedicated worktree on branch ${worktree})`:''}. Follow this project's CLAUDE.md / AGENTS.md and use your normal tools.
Requests come from the Workbench orchestrator (lines starting "[from orchestrator]") or from the user typing here. The user follows your work mainly in the orchestrator chat, not this terminal: whenever you need an answer or decision, need the user to do something, or finish a request, call the workbench tool report_to_orchestrator with projectID ${project.id}, kind "question", "action" or "update", a short self-contained text and a new unique requestKey. Keep working on anything that does not depend on the answer.`;
}
function instructions(scope){
 if(!scope.projectID)return `You are the SKD Workbench orchestrator, chatting with the Workbench user in an interactive session they can watch. You act through the "workbench" MCP tools only; you have no shell or file tools. You do not do project work yourself: each project has its own live agent working in its folder.
Rules:
- When the user asks for work (often pasting an email or notes), decide which project it belongs to with list_projects and get_project_instructions. If it is unclear, ask the user in the chat.
- Hand the request to that project's agent with message_project_agent, passing the full relevant text and a new unique requestKey. Then tell the user briefly in the chat (post_coordinator_message) which project it went to.
- Messages that start "[from <Project> agent · question|action|update]" are reports from a project agent. They already appear in the user's chat, attributed to that agent, so do not repeat them. Post only if you add something the user needs (for example, which earlier request it concerns). When the user answers, forward the answer to that project with message_project_agent.
- Use get_project_agent to check on an agent. Use stop_project_agent only when the user asks. Do not use workflows (start_run, create_workflow) unless the user explicitly asks for one.
- After answering each user message, post your answer with post_coordinator_message and a new unique requestKey; the user reads the chat.
Answer concisely.`;
 return `You are the SKD Workbench coordinator, chatting with the Workbench user in an interactive session they can watch. You act through the "workbench" MCP tools only; you have no shell or file tools.
This conversation is scoped to the project "${scope.projectName}" (projectID ${scope.projectID}). You act as its project owner.
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
  mkdirSync(directory,{recursive:true});Object.assign(this,{directory,threads,controllers,projects,executor});this.endpoint=null;this.delivered=new Set();this.projectBusy=()=>false;
  this.file=path.join(directory,'coordinator-agent.json');this.sessions=sessions||new CoordinatorSessions(directory,sessionOptions);
  // What the person types in a live CLI joins the conversation as their message; it is already in the session, so it is not delivered again.
  this.sessions.onLine=(threadKey,text,requestKey)=>{const project=threadKey===COORDINATOR?{id:COORDINATOR}:this.projects().find(p=>p.id===threadKey);if(project)this.threads.post(project,{author:'user',text,requestKey,source:'cli'});};
  if(existsSync(this.file)){
   const original=readFileSync(this.file,'utf8');let parsed;try{parsed=JSON.parse(original);}catch{assert(false,damaged);}
   // Schema 1 held one-shot reply turns. Keep the settings and the old turns (read-only) after a backup.
   if(parsed?.schema===1&&Array.isArray(parsed.turns)){
    writeFileSync(`${this.file}.schema-1.${randomUUID()}.backup.json`,original,{flag:'wx',mode:0o600});
    const {turns,schema,...settings}=parsed;parsed={...settings,schema:2,legacyTurns:turns.slice(-50).map(t=>['running','queued'].includes(t.status)?{...t,status:'interrupted'}:t)};
    this.data=validate(parsed);this.persist();
   }else this.data=validate(parsed);
  }else this.data={schema:2,version:0,enabled:false,provider:'claude',model:null,effort:'default',legacyTurns:[],projectAgents:{}};
 }
 set endpoint(value){this._endpoint=value;if(this.sessions&&value)this.sessions.signalURL=value.replace(/\/api\/controller\/call$/,'/api/coordinator/sessions');}
 get endpoint(){return this._endpoint;}
 persist(){writeFileSync(this.file+'.tmp',JSON.stringify(this.data,null,2),{mode:0o600});chmodSync(this.file+'.tmp',0o600);renameSync(this.file+'.tmp',this.file);}
 connectedIDs(){return this.projects().filter(p=>p.id!=='unassigned'&&p.folderPath).map(p=>p.id);}
 // After a project is removed or restored, the orchestrator's grant follows the connected projects.
 syncGrant(){if(this.controllers.internal('coordinator'))this.controllers.ensureInternal('coordinator','Workbench coordinator',this.connectedIDs(),['read','manage','run'],null);}
 grant(){return this.controllers.internal('coordinator');}
 view(){
  const {legacyTurns,...settings}=this.data,g=this.grant();
  return {...copy(settings),grant:g?{id:g.id,projectIDs:[...g.projectIDs],capabilities:[...g.capabilities]}:null,freeTools,promptTools,waiting:this.sessions.waiting()};
 }
 state(threadKey){const v=this.view();return {enabled:v.enabled,provider:v.provider,model:v.model,grant:!!v.grant,session:this.sessions.current(threadKey),history:this.sessions.history(threadKey),...(threadKey===COORDINATOR?{}:{agent:this.projectAgent(threadKey)})};}
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
  if(threadKey!==COORDINATOR)return this.deliverProject(this.projects().find(p=>p.id===threadKey),message.text);
  return this.sessions.deliver(threadKey,message.text,()=>this.launch(threadKey,scope,'answer the last user message, then post your answer to the chat'));
 }
 // Opened from the CLI view without a message: load context and wait for the user.
 startSession(threadKey,scope){
  assert(this.data.enabled,'Turn on the coordinator agent first.',409);
  if(threadKey!==COORDINATOR)return this.sessions.current(threadKey)||this.startProject(this.projects().find(p=>p.id===threadKey),'');
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
 // Project agents: one live session per project in its folder (or its dedicated worktree), outside the global lock.
 projectAgent(projectID){const a=this.data.projectAgents[projectID];return a?{...a,inherited:false}:{provider:this.data.provider,model:this.data.model,effort:this.data.effort,workspace:'folder',inherited:true};}
 async saveProjectAgent(projectID,input){
  const project=this.projects().find(p=>p.id===projectID);assert(project&&project.id!=='unassigned','Project not found.',404);
  assert(input&&Object.keys(input).every(k=>['version','provider','model','effort','workspace'].includes(k)),'Unknown project agent setting.');
  assert(input.version===this.data.version,'Settings changed. Reload before saving.',409);
  assert(coordinatorProviders.includes(input.provider),'Choose Claude Code or Codex.');assert(workspaces.includes(input.workspace),'Choose the project folder or a dedicated worktree.');
  assert(typeof input.model==='string'&&input.model&&typeof input.effort==='string'&&input.effort,'Choose a model and effort.');
  const catalog=await (input.provider==='claude'?this.executor.discoverClaude():this.executor.discover());
  const model=catalog.models.find(m=>m.id===input.model);assert(model&&model.efforts.includes(input.effort),`Choose a supported ${labels[input.provider]} model and effort.`);
  const next={provider:input.provider,model:input.model,effort:input.effort,workspace:input.workspace},before=this.data.projectAgents[projectID];
  this.data.projectAgents[projectID]=next;this.data.version++;this.persist();
  if(!before||['provider','model','effort','workspace'].some(k=>before[k]!==next[k])){const live=this.sessions.current(projectID);if(live)this.sessions.stop(live.id,'settings');}
  return {version:this.data.version,agent:this.projectAgent(projectID)};
 }
 async worktree(project){
  const top=(await git(project.folderPath,['rev-parse','--show-toplevel']).catch(()=>'')).trim();assert(top,'A dedicated worktree needs a Git repository. Choose the project folder in the agent settings.',409);
  const destination=path.join(this.directory,'project-agent-worktrees',project.id),branch=`agent/${slug(project.name)}`;
  if(existsSync(path.join(destination,'.git')))return {cwd:destination,branch};
  mkdirSync(path.dirname(destination),{recursive:true});
  const exists=(await git(top,['branch','--list',branch])).trim();
  await git(top,exists?['worktree','add',destination,branch]:['worktree','add','-b',branch,destination,'HEAD']);
  return {cwd:destination,branch};
 }
 async startProject(project,prompt){
  assert(project&&project.id!=='unassigned'&&project.folderPath,'Choose a project with a connected folder.',404);
  if(this.sessions.isLive(project.id))return this.sessions.current(project.id);
  assert(!this.projectBusy(project.id),'Another session or workflow is running in this project. Finish it before starting the project agent.',409);
  const agent=this.projectAgent(project.id);assert(agent.model,'Choose a model for this project agent in its settings.',409);
  const place=agent.workspace==='worktree'?await this.worktree(project):{cwd:project.folderPath,branch:null};
  if(this.sessions.isLive(project.id))return this.sessions.current(project.id);
  const grant=this.controllers.ensureInternal('project-agent:'+project.id,`${project.name} agent`,[project.id],['read','report'],this.endpoint,{create:true});
  if(this.endpoint)this.controllers.refreshEndpoint(grant.id,this.endpoint);
  const credentialPath=this.controllers.list().find(c=>c.id===grant.id).credentialPath;
  return this.sessions.start(project.id,{provider:agent.provider,model:agent.model,effort:agent.effort,binary:agent.provider==='claude'?this.executor.claudeBinary:this.executor.binary,credentialPath,cwd:place.cwd,project:project.id,
   system:projectInstructions(project,place.cwd,place.branch),prompt});
 }
 async deliverProject(project,text){
  assert(project,'Project not found.',404);
  if(this.sessions.isLive(project.id)){this.sessions.paste(project.id,text);return this.sessions.current(project.id);}
  return this.startProject(project,text);
 }
 projectAgentView(projectID){return {projectID,agent:this.projectAgent(projectID),session:this.sessions.current(projectID)};}
 async messageProjectAgent(project,text,requestKey,controller){
  assert(this.data.enabled,'The coordinator agent is off.',409);
  const message=this.threads.post(project,{author:'agent',text:`From the orchestrator: ${text}`,requestKey:'orchestrator:'+requestKey,controller:{id:controller.id,name:'Orchestrator'}});
  if(this.delivered.has(message.id))return {projectID:project.id,messageID:message.id,session:this.sessions.current(project.id),duplicate:true};
  this.delivered.add(message.id);
  const session=await this.deliverProject(project,`[from orchestrator] ${text}`);
  return {projectID:project.id,messageID:message.id,session};
 }
 stopProjectAgent(projectID){const live=this.sessions.current(projectID);assert(live,'This project agent is not running.',409);return this.sessions.stop(live.id);}
 reportToOrchestrator(project,kind,text,requestKey,controller){
  const labelled={question:'Question',action:'Action needed',update:'Update'}[kind];
  const message=this.threads.post({id:COORDINATOR},{author:'agent',text:`${labelled}: ${text}`,refs:[{kind:'project',id:project.id}],requestKey:'report:'+project.id+':'+requestKey,controller:{id:controller.id,name:`${project.name} agent`}});
  const fresh=!this.delivered.has(message.id);this.delivered.add(message.id);
  const relayed=fresh&&this.sessions.paste(COORDINATOR,`[from ${project.name} agent · ${kind}] ${text}`);
  return {posted:true,messageID:message.id,relayedToOrchestratorSession:!!relayed};
 }
 shutdown(){this.sessions.shutdown();}
}
