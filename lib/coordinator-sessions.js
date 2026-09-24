import {EventEmitter} from 'node:events';
import {existsSync,readFileSync,writeFileSync,renameSync,chmodSync,mkdirSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {randomUUID,randomBytes,timingSafeEqual} from 'node:crypto';
import * as pty from 'node-pty';
import {assert,now} from './domain.js';
import {controllerTools} from './controller-catalog.js';
import {createLineCollector} from './terminal-lines.js';
import {SessionHost} from './session-host.js';

// One interactive Claude Code or Codex session per conversation, in a real PTY the user can watch.
// The session has no built-in file or shell tools, only the Workbench MCP bridge. Reading and posting
// replies need no approval; every tool that manages or runs work shows the CLI's own permission prompt.
// Sessions end on Stop, settings change or idle. With the session host (the running app), they keep running in
// that separate process while Workbench restarts and are picked up again on startup; without it (tests), they end
// when the server stops.
// Routing work to project agents is free (the person chose this); stopping one still prompts.
export const freeTools=controllerTools.filter(({name,capability})=>capability==='read'||/^post_/.test(name)||name==='message_project_agent').map(({name})=>name);
// Project agents may read and report back without a prompt; everything else in their own CLI keeps its native prompts.
export const projectFreeTools=controllerTools.filter(({capability})=>capability==='read'||capability==='report').map(({name})=>name);
export const promptTools=controllerTools.filter(({name,capability})=>capability!=='report'&&!freeTools.includes(name)).map(({name})=>name);
const damaged='Damaged coordinator session history. Restore coordinator-sessions.json from backup.';
const bridge=fileURLToPath(new URL('../scripts/workbench-mcp.mjs',import.meta.url)),hook=fileURLToPath(new URL('../scripts/coordinator-signal.mjs',import.meta.url));
const PASTE_START='\x1b[200~',PASTE_END='\x1b[201~';
const toml=value=>JSON.stringify(value);

// A project agent runs the person's normal CLI in the project folder: their config, tools, CLAUDE.md/AGENTS.md
// and native permission prompts, plus the Workbench MCP server for reporting back and the waiting hook.
// With full permissions (the person's setting) the CLI runs without any permission prompt or sandbox.
export function projectSessionArgs(provider,{model,effort,system,prompt,server,cwd,full=false}){
 const hookCommand=`${toml(server.command)} ${toml(hook)} waiting`;
 if(provider==='claude')return ['--mcp-config',JSON.stringify({mcpServers:{workbench:{type:'stdio',command:server.command,args:server.args}}}),'--append-system-prompt',system,
  '--settings',JSON.stringify({hooks:{Notification:[{matcher:'permission_prompt',hooks:[{type:'command',command:hookCommand}]}]}}),
  ...(full?['--dangerously-skip-permissions']:[]),'--allowedTools',...projectFreeTools.map(t=>'mcp__workbench__'+t),'--model',model,...(effort==='default'?[]:['--effort',effort]),...(prompt?['--',prompt]:[])];
 return [...(full?['--dangerously-bypass-approvals-and-sandbox']:[]),'-c',`mcp_servers.workbench.command=${toml(server.command)}`,'-c',`mcp_servers.workbench.args=${toml(server.args)}`,'-c','mcp_servers.workbench.default_tools_approval_mode="approve"',
  '-c',`hooks.PermissionRequest=[{matcher="*",hooks=[{type="command",command=${toml(hookCommand)}}]}]`,
  ...(effort==='default'?[]:['-c',`model_reasoning_effort=${toml(effort)}`]),'-c',`developer_instructions=${toml(system)}`,'--model',model,'--cd',cwd,'--no-alt-screen',...(prompt?['--',prompt]:[])];
}
// The orchestrator runs the person's normal CLI setup (their settings, skills, plugins and MCP servers, #20) plus
// the Workbench server, with no file, shell or web tools. Claude keeps only the Skill tool so skills can load;
// Workbench tools that manage or run work still prompt natively.
// Full permissions: Workbench tools that manage or run work no longer prompt; the orchestrator still has no
// file, shell or web tools.
export function sessionArgs(provider,{model,effort,system,prompt,server,workspace,full=false}){
 const hookCommand=`${toml(server.command)} ${toml(hook)} waiting`;
 if(provider==='claude'){
  const settings={hooks:{Notification:[{matcher:'permission_prompt',hooks:[{type:'command',command:hookCommand}]}]}};
  return ['--append-system-prompt',system,'--mcp-config',JSON.stringify({mcpServers:{workbench:{type:'stdio',command:server.command,args:server.args}}}),
   '--settings',JSON.stringify(settings),'--no-chrome',...(full?['--dangerously-skip-permissions']:['--permission-mode','manual']),'--tools','Skill',
   '--allowedTools',...freeTools.map(t=>'mcp__workbench__'+t),'--model',model,...(effort==='default'?[]:['--effort',effort]),'--',prompt];
 }
 return ['--sandbox','read-only','--ask-for-approval',full?'never':'on-request','--disable','shell_tool','--disable','unified_exec','-c','features.multi_agent=false','-c','web_search="disabled"',
  '-c',`mcp_servers.workbench.command=${toml(server.command)}`,'-c',`mcp_servers.workbench.args=${toml(server.args)}`,'-c','mcp_servers.workbench.required=true','-c','mcp_servers.workbench.default_tools_approval_mode="approve"',
  ...(full?[]:promptTools.flatMap(t=>['-c',`mcp_servers.workbench.tools.${t}.approval_mode="prompt"`])),
  '-c',`hooks.PermissionRequest=[{matcher="*",hooks=[{type="command",command=${toml(hookCommand)}}]}]`,'-c',`projects.${toml(workspace)}.trust_level="trusted"`,
  ...(effort==='default'?[]:['-c',`model_reasoning_effort=${toml(effort)}`]),'-c',`developer_instructions=${toml(system)}`,'--model',model,'--cd',workspace,'--no-alt-screen','--',prompt];
}
// Before #20 the orchestrator read only a private Codex home with this configuration; kept for reference in tests.
export function codexConfig({server,workspace}){
 return [`[mcp_servers.workbench]`,`command = ${toml(server.command)}`,`args = ${toml(server.args)}`,'required = true','default_tools_approval_mode = "approve"','',
  ...promptTools.flatMap(t=>[`[mcp_servers.workbench.tools.${t}]`,'approval_mode = "prompt"','']),
  '[[hooks.PermissionRequest]]','matcher = "*"','[[hooks.PermissionRequest.hooks]]','type = "command"',`command = ${toml(`${toml(server.command)} ${toml(hook)} waiting`)}`,'',
  `[projects.${toml(workspace)}]`,'trust_level = "trusted"',''].join('\n');
}

export class CoordinatorSessions{
 constructor(directory,{spawn=pty.spawn,nodePath=process.execPath,idleMs=1800000,historyLimit=20,tailChars=262144,killDelay=3000,sessionHost=false,host=null}={}){
  Object.assign(this,{spawn,nodePath,idleMs,historyLimit,tailChars,killDelay});
  this.host=host||(sessionHost?new SessionHost(directory,{nodePath}):null);
  mkdirSync(directory,{recursive:true});this.file=path.join(directory,'coordinator-sessions.json');
  this.workspace=path.join(directory,'coordinator-workspace');this.codexHome=path.join(directory,'coordinator-codex');
  this.events=new EventEmitter();this.events.setMaxListeners(64);this.live=new Map();this.closed=false;this.signalURL=null;
  if(existsSync(this.file)){let parsed;try{parsed=JSON.parse(readFileSync(this.file,'utf8'));}catch{assert(false,damaged);}
   assert(parsed&&parsed.schema===1&&Array.isArray(parsed.sessions)&&parsed.sessions.every(s=>s&&typeof s.id==='string'&&typeof s.threadKey==='string'&&typeof s.output==='string'),damaged);this.data=parsed;}
  else this.data={schema:1,sessions:[]};
  this.restoring=this.host?this.restore().catch(error=>{console.error('Session host: '+error.message);}).finally(()=>{this.restoring=null;}):null;
 }
 persist(){writeFileSync(this.file+'.tmp',JSON.stringify(this.data),{mode:0o600});chmodSync(this.file+'.tmp',0o600);renameSync(this.file+'.tmp',this.file);}
 summary(r){return r&&{id:r.id,threadKey:r.threadKey,provider:r.provider,model:r.model,effort:r.effort,cwd:r.cwd||null,status:r.status,waiting:!!r.waiting,startedAt:r.startedAt,endedAt:r.endedAt||null,endReason:r.endReason||null};}
 current(threadKey){const r=this.live.get(threadKey);return r?this.summary(r):null;}
 waiting(){return [...this.live.values()].filter(r=>r.waiting&&r.status==='running').map(r=>this.summary(r));}
 history(threadKey,limit=5){return this.data.sessions.filter(s=>s.threadKey===threadKey).slice(-limit).reverse().map(({output,...s})=>({...s,status:'ended',waiting:false}));}
 find(id){for(const r of this.live.values())if(r.id===id)return r;const saved=this.data.sessions.find(s=>s.id===id);assert(saved,'Coordinator session not found.',404);return {...saved,status:'ended',offset:0};}
 // Stream interface shared with the workspace and agent terminals.
 subscribe(id,listener){this.find(id);this.events.on(id,listener);return ()=>this.events.off(id,listener);}
 output(id,cursor=0){const r=this.find(id);assert(Number.isSafeInteger(cursor)&&cursor>=0,'Invalid terminal cursor.');const end=r.offset+r.output.length,reset=cursor<r.offset||cursor>end;return {data:r.output.slice(reset?0:cursor-r.offset),cursor:end,reset,session:this.summary(r)};}
 input(id,data){const r=this.find(id);assert(typeof data==='string'&&data.length>0&&data.length<=16384,'Invalid terminal input.');assert(r.status==='running','This coordinator session has ended.',409);r.waiting=false;this.touch(r);r.child.write(data);this.record(r,data);return {ok:true};}
 // Lines typed straight into the CLI are copied to the conversation; a failed copy never blocks input.
 record(r,data){if(!this.onLine)return;r.lines??=createLineCollector();r.lineCount??=0;for(const text of r.lines.feed(data)){try{this.onLine(r.threadKey,text.slice(0,8000),`cli:${r.id}:${++r.lineCount}`);}catch(error){console.error(error);}}}
 resize(id,cols,rows){const r=this.find(id);assert(Number.isInteger(cols)&&cols>=20&&cols<=400&&Number.isInteger(rows)&&rows>=5&&rows<=200,'Invalid terminal dimensions.');if(r.status==='running')r.child.resize(cols,rows);return {ok:true};}
 touch(r){clearTimeout(r.idleTimer);r.idleTimer=setTimeout(()=>this.end(r,'idle'),this.idleMs);r.idleTimer.unref?.();}
 // Types a chat message into the running session, or starts one seeded with the conversation.
 deliver(threadKey,text,start){
  assert(!this.closed,'The server is stopping.',503);
  assert(!this.restoring,'Reconnecting to running agents. Try again in a moment.',503);
  const r=this.live.get(threadKey);
  if(r?.status==='running'){r.waiting=false;this.touch(r);this.submit(r,text);this.events.emit(r.id);return this.summary(r);}
  return this.start(threadKey,start());
 }
 // Types into a running session only; used to relay project agent reports to the orchestrator.
 paste(threadKey,text){const r=this.live.get(threadKey);if(r?.status!=='running')return false;this.touch(r);this.submit(r,text);this.events.emit(r.id);return true;}
 // Messages are queued per session: each is pasted and submitted before the next starts, so two
 // arriving together (a relayed report and the user's reply) never merge into one CLI message.
 submit(r,text){
  const wait=ms=>new Promise(resolve=>{const t=setTimeout(resolve,ms);t.unref?.();});
  r.chain=(r.chain||Promise.resolve()).then(async()=>{
   if(r.status!=='running')return;r.child.write(PASTE_START+text.replace(/\x1b\[20[01]~/g,'')+PASTE_END);await wait(60);
   if(r.status!=='running')return;r.child.write('\r');await wait(80);
  }).catch(()=>{});
 }
 isLive(threadKey){return this.live.get(threadKey)?.status==='running';}
 start(threadKey,{provider,model,effort,binary,credentialPath,system,prompt,env={},cwd=null,project=null,full=false}){
  assert(!this.live.has(threadKey),'A coordinator session is already running for this conversation.',409);
  assert(!this.restoring,'Reconnecting to running agents. Try again in a moment.',503);
  mkdirSync(this.workspace,{recursive:true,mode:0o700});
  const server={command:this.nodePath,args:[bridge,credentialPath]},secret=randomBytes(24).toString('hex'),id=randomUUID();
  const childEnv={...process.env,...env,TERM:'xterm-256color',WORKBENCH_COORDINATOR_SIGNAL:this.signalURL?`${this.signalURL}/${id}/signal`:'',WORKBENCH_COORDINATOR_SECRET:secret};
  if(!cwd)for(const key of ['GH_TOKEN','GITHUB_TOKEN','GH_ENTERPRISE_TOKEN','GITHUB_ENTERPRISE_TOKEN'])delete childEnv[key];
  const args=cwd?projectSessionArgs(provider,{model,effort,system,prompt,server,cwd,full}):sessionArgs(provider,{model,effort,system,prompt,server,workspace:this.workspace,full});
  const r={id,threadKey,provider,model,effort,cwd:cwd||null,project,status:'running',waiting:false,startedAt:now(),secret,output:'',offset:0};
  const options={name:'xterm-256color',cols:100,rows:30,cwd:cwd||this.workspace,env:childEnv};
  // The host keeps what a restarted Workbench needs to pick the session up again.
  r.child=this.host?this.host.spawn(binary,args,options,{id,meta:this.meta(r)}):this.spawn(binary,args,options);
  this.live.set(threadKey,r);this.touch(r);this.wire(r);
  return this.summary(r);
 }
 meta(r){const {id,threadKey,provider,model,effort,cwd,project,startedAt,secret}=r;return {id,threadKey,provider,model,effort,cwd,project,startedAt,secret};}
 wire(r){
  const child=r.child;
  // Startup questions the CLI asks in its own screen (Codex hook trust, folder trust) have no hook of their own;
  // surface them as waiting so the chat shows Open CLI instead of silence. Workbench never answers them.
  child.onData(data=>{if(!r.startupPrompt&&/Hooks need review|Do you trust the (?:files|contents) in this folder/.test(r.output.slice(-300)+data)){r.startupPrompt=true;r.waiting=true;}r.output+=data;r.lastOutputAt=Date.now();if(r.output.length>this.tailChars){const trim=r.output.length-this.tailChars;r.output=r.output.slice(trim);r.offset+=trim;}this.touch(r);this.events.emit(r.id);});
  child.onExit(()=>this.finish(r,r.endReason||'exited'));
 }
 // After a restart: take back every terminal still running in the host, and record the ones that ended meanwhile.
 async restore(){
  for(const view of await this.host.list()){
   const meta=view.meta;if(!meta?.threadKey){if(view.exited)this.host.forget(view.id);continue;}
   const r={...meta,status:'running',waiting:false,output:view.output,offset:view.offset};
   if(view.exited){if(this.data.sessions.some(s=>s.id===meta.id))this.host.forget(view.id);else{r.status='ending';this.finish(r,'exited');}continue;}
   if(this.live.has(meta.threadKey))continue;
   r.child=this.host.adopt(view);this.live.set(meta.threadKey,r);this.touch(r);this.wire(r);
  }
 }
 // Only the hook inside the session knows its secret; the route also refuses remote requests.
 signal(id,secret,kind){
  const r=[...this.live.values()].find(x=>x.id===id);assert(r&&r.status==='running','Coordinator session not found.',404);
  const a=Buffer.from(String(secret||'')),b=Buffer.from(r.secret);assert(a.length===b.length&&timingSafeEqual(a,b),'Invalid coordinator signal.',403);
  assert(kind==='waiting','Unknown coordinator signal.');r.waiting=true;this.events.emit(r.id);return this.summary(r);
 }
 end(r,reason){
  if(!r||r.status!=='running')return;r.endReason=reason;r.status='ending';r.waiting=false;clearTimeout(r.idleTimer);
  try{r.child.kill();}catch{}r.killTimer=setTimeout(()=>{try{r.child.kill('SIGKILL');}catch{}this.finish(r,reason);},this.killDelay);r.killTimer.unref?.();
  this.events.emit(r.id);
 }
 finish(r,reason){
  if(r.status==='ended')return;clearTimeout(r.idleTimer);clearTimeout(r.killTimer);
  Object.assign(r,{status:'ended',waiting:false,endedAt:now(),endReason:reason});if(this.live.get(r.threadKey)===r)this.live.delete(r.threadKey);
  const {child,secret,idleTimer,killTimer,waiting,status,lines,lineCount,chain,startupPrompt,lastOutputAt,...saved}=r;this.data.sessions.push({...saved});this.data.sessions=this.data.sessions.slice(-this.historyLimit);this.persist();
  this.host?.forget(r.id);
  this.events.emit(r.id);
 }
 stop(id,reason='stopped'){const r=[...this.live.values()].find(x=>x.id===id);assert(r,'This coordinator session is not running.',409);this.end(r,reason);return this.summary(r);}
 endAll(reason){for(const r of [...this.live.values()])this.end(r,reason);}
 shutdown(){
  this.closed=true;
  // With the host, stopping Workbench leaves the terminals running for the next start to pick up.
  if(this.host){for(const r of this.live.values()){clearTimeout(r.idleTimer);clearTimeout(r.killTimer);}this.host.close();return;}
  for(const r of [...this.live.values()]){r.endReason='server';try{r.child.kill('SIGKILL');}catch{}this.finish(r,'server');}}
}
