#!/usr/bin/env node
// Fixture Claude Code / Codex CLI for coordinator tests. As an interactive session it runs in a PTY,
// connects to the Workbench MCP server named in its settings like the real CLIs, reads bracketed-paste
// messages, posts replies with post_message/post_coordinator_message and simulates the native permission
// prompt (running the configured hook) before tools that are not pre-approved.
import {appendFileSync,readFileSync} from 'node:fs';
import path from 'node:path';
import {execFile} from 'node:child_process';
import {Client} from '@modelcontextprotocol/sdk/client/index.js';
import {StdioClientTransport} from '@modelcontextprotocol/sdk/client/stdio.js';
const args=process.argv.slice(2),value=flag=>args[args.indexOf(flag)+1];
const log=entry=>{if(process.env.COORDINATOR_FIXTURE_LOG)appendFileSync(process.env.COORDINATOR_FIXTURE_LOG,JSON.stringify(entry)+'\n');};
// Workflow attempts started by the coordinator use the ordinary one-shot formats.
if(args[0]==='exec'||args.includes('--print')){
 log({mode:'attempt',args});readFileSync(0,'utf8');const out=e=>process.stdout.write(JSON.stringify(e)+'\n');
 if(args[0]==='exec'){out({type:'item.completed',item:{type:'agent_message',text:'Workflow fixture done.'}});out({type:'turn.completed',usage:{input_tokens:1,output_tokens:1}});}
 else out({type:'result',subtype:'success',is_error:false,result:'Workflow fixture done.',usage:{input_tokens:1,output_tokens:1}});
 process.exit(0);
}
const codex=!args.includes('--mcp-config'),prompt=args.includes('--')?args[args.indexOf('--')+1]:'';
// Since #20 both roles use the normal setup plus Workbench overrides; only the orchestrator restricts tools
// (Claude --tools, Codex --sandbox read-only).
const projectMode=codex?!args.includes('--sandbox'):!args.includes('--tools');
let server,system,hook,needsPrompt;
if(projectMode){
 // Project agent: the person's normal CLI in the project folder plus the Workbench MCP server.
 if(codex){const configs=args.filter((a,i)=>args[i-1]==='-c'),get=key=>configs.find(c=>c.startsWith(key+'='))?.slice(key.length+1);
  server={command:JSON.parse(get('mcp_servers.workbench.command')),args:JSON.parse(get('mcp_servers.workbench.args'))};system=JSON.parse(get('developer_instructions'));hook=JSON.parse(/command=("(?:[^"\\]|\\.)*")/.exec(get('hooks.PermissionRequest'))[1]);}
 else{server=JSON.parse(value('--mcp-config')).mcpServers.workbench;system=value('--append-system-prompt');hook=JSON.parse(value('--settings')).hooks.Notification[0].hooks[0].command;}
 needsPrompt=()=>false;
 log({mode:'session',role:'project',provider:codex?'codex':'claude',args,cwd:process.cwd(),codexHome:process.env.CODEX_HOME||null});
}else if(codex){
 const configs=args.filter((a,i)=>args[i-1]==='-c'),get=key=>configs.find(c=>c.startsWith(key+'='))?.slice(key.length+1);
 server={command:JSON.parse(get('mcp_servers.workbench.command')),args:JSON.parse(get('mcp_servers.workbench.args'))};hook=JSON.parse(/command=("(?:[^"\\]|\\.)*")/.exec(get('hooks.PermissionRequest'))[1]);
 system=JSON.parse(get('developer_instructions'));needsPrompt=tool=>configs.includes(`mcp_servers.workbench.tools.${tool}.approval_mode="prompt"`);
 log({mode:'session',provider:'codex',args,codexHome:process.env.CODEX_HOME||null});
}else{
 server=JSON.parse(value('--mcp-config')).mcpServers.workbench;system=value('--append-system-prompt');
 hook=JSON.parse(value('--settings')).hooks.Notification[0].hooks[0].command;
 const allowed=args.slice(args.indexOf('--allowedTools')+1,args.indexOf('--model'));needsPrompt=tool=>!allowed.includes('mcp__workbench__'+tool);
 log({mode:'session',provider:'claude',args});
}
const client=new Client({name:'coordinator-fixture',version:'1'});await client.connect(new StdioClientTransport({command:server.command,args:server.args,stderr:'ignore'}));
const say=text=>process.stdout.write(text.replace(/\n/g,'\r\n')+'\r\n');
let answer=null;
const call=async(name,input={})=>{
 say(`⏺ workbench - ${name} (MCP)`);
 if(needsPrompt(name)){
  say(`Do you want to allow workbench - ${name}? (y/n)`);
  execFile('/bin/sh',['-c',hook],{env:process.env},()=>{});
  const allowed=await new Promise(r=>{answer=r;});if(!allowed){say('  ⎿ Declined');throw new Error('declined by the user');}
 }
 const r=await client.callTool({name,arguments:input});const parsed=JSON.parse(r.content[0].text);if(r.isError)throw new Error(parsed.error||'tool failed');say(`  ⎿ ok`);return parsed;
};
const projectID=projectMode?/projectID ([\w-]+),/.exec(system)?.[1]:/projectID ([\w-]+)\)/.exec(system)?.[1]||null;let posts=0;
const key=()=>`fixture-${process.pid}-${++posts}`;
async function handle(text){
 say(`> ${text}`);let reply;
 if(projectMode){
  const request=text.replace(/^\[from orchestrator\] /,'');
  try{if(/ask me/i.test(request))await call('report_to_orchestrator',{projectID,kind:'question',text:`Which option for: ${request}?`,requestKey:key()});
   else await call('report_to_orchestrator',{projectID,kind:'update',text:`Done: ${request}`,requestKey:key()});}catch(error){say(`Report failed: ${error.message}`);}
  return;
 }
 if(!projectID){
  // Orchestrator routing and relay.
  const route=/(?:email about|for) ([\w-]+)/i.exec(text),relay=/^\[from (.+?) agent · (\w+)\] (.*)$/.exec(text),forward=/^reply to ([\w-]+): (.*)$/i.exec(text);
  try{
   if(relay)return;// Reports already appear in the chat, attributed to the agent.
   if(route||forward){
    const name=(route||forward)[1],target=(await call('list_projects')).items.find(p=>p.name.toLowerCase()===name.toLowerCase());
    if(!target)throw new Error(`No project named ${name}`);
    if(route)await call('get_project_instructions',{projectID:target.id});
    await call('message_project_agent',{projectID:target.id,text:forward?forward[2]:text,requestKey:key()});
    await call('post_coordinator_message',{text:`Passed to ${target.name}.`,requestKey:key()});return;
   }
  }catch(error){await call('post_coordinator_message',{text:`Tool error: ${error.message}`,requestKey:key()}).catch(()=>{});return;}
 }
 try{
  if(/launch/.test(text)){
   const pid=projectID||(await call('list_projects')).items[0].id;
   const {mandate}=await call('get_project_mandate',{projectID:pid}),project=await call('get_project',{projectID:pid}),flowID=mandate.workflowIDs[0],flow=await call('get_workflow',{projectID:pid,flowID});
   const launch={projectID:pid,flowID,flowVersion:flow.version,projectVersion:project.version,input:{task:'Coordinator task',acceptance:'Report',mode:mandate.modes[0],maxAttempts:1,config:{[flow.steps[0].id]:{model:'fixture',effort:'low'}}},mandate:{version:mandate.version,taskRef:mandate.tasks[0].ref}};
   const preview=await call('preview_run',launch),operation=await call('start_run',{...launch,requestKey:'coordinator-launch',previewToken:preview.previewToken});
   reply=`Started ${mandate.tasks[0].ref} under mandate v${mandate.version} (operation ${operation.id}).`;
  }else{const projects=await call('list_projects');reply=`Echo: ${text} (${projects.total} granted project${projects.total===1?'':'s'})`;}
 }catch(error){reply=`Tool error: ${error.message}`;}
 const requestKey=key();
 try{if(projectID)await call('post_message',{projectID,text:reply,requestKey});else await call('post_coordinator_message',{text:reply,requestKey});}catch(error){say(`Post failed: ${error.message}`);}
}
say(`Fixture ${codex?'Codex':'Claude Code'} session · ${codex?value('--model'):value('--model')}`);
let queue=Promise.resolve();const enqueue=text=>{queue=queue.then(()=>handle(text));};
const first=projectMode?prompt:[...prompt.matchAll(/\[User [^\]]+\] ([^\n]*)/g)].at(-1)?.[1];if(first&&!/WAIT FOR THE NEXT MESSAGE/.test(prompt))enqueue(first);
process.stdin.setRawMode?.(true);process.stdin.setEncoding('utf8');let buffer='';
process.stdin.on('data',chunk=>{
 buffer+=chunk;
 if(answer&&/^[yn]$/i.test(buffer.trim())){const r=answer;answer=null;const yes=/y/i.test(buffer);buffer='';r(yes);return;}
 if(buffer==='\x03'||buffer==='\x04')process.exit(0);
 let n;while((n=buffer.indexOf('\r'))>=0){const line=buffer.slice(0,n).replace(/\x1b\[20[01]~/g,'').trim();buffer=buffer.slice(n+1);if(line==='exit')process.exit(0);if(line)enqueue(line);}
});
