#!/usr/bin/env node
// Fixture Claude Code / Codex CLI for coordinator tests. It connects to the Workbench MCP server
// named in its arguments, like the real CLIs, and answers in the matching JSON event format.
import {appendFileSync,readFileSync} from 'node:fs';
import {Client} from '@modelcontextprotocol/sdk/client/index.js';
import {StdioClientTransport} from '@modelcontextprotocol/sdk/client/stdio.js';
const args=process.argv.slice(2),codex=args[0]==='exec',value=flag=>args[args.indexOf(flag)+1];
if(process.env.COORDINATOR_FIXTURE_LOG)appendFileSync(process.env.COORDINATOR_FIXTURE_LOG,JSON.stringify(args)+'\n');
// Without Workbench MCP settings this is an ordinary workflow attempt.
if(codex&&!args.some(a=>a.startsWith('mcp_servers.workbench.command='))){readFileSync(0,'utf8');process.stdout.write(JSON.stringify({type:'item.completed',item:{type:'agent_message',text:'Workflow fixture done.'}})+'\n'+JSON.stringify({type:'turn.completed',usage:{input_tokens:1,output_tokens:1}})+'\n');process.exit(0);}
let server,system;
if(codex){
 const configs=args.filter((a,i)=>args[i-1]==='-c'),get=key=>configs.find(c=>c.startsWith(key+'='))?.slice(key.length+1);
 server={command:JSON.parse(get('mcp_servers.workbench.command')),args:JSON.parse(get('mcp_servers.workbench.args'))};system=JSON.parse(get('developer_instructions'));
}else{server=JSON.parse(value('--mcp-config')).mcpServers.workbench;system=value('--system-prompt');}
const prompt=readFileSync(0,'utf8'),last=[...prompt.matchAll(/\[User [^\]]+\] ([^\n]*)/g)].at(-1)?.[1]||'';
const client=new Client({name:'coordinator-fixture',version:'1'});await client.connect(new StdioClientTransport({command:server.command,args:server.args,stderr:'ignore'}));
const call=async(name,input={})=>{const r=await client.callTool({name,arguments:input});const parsed=JSON.parse(r.content[0].text);if(r.isError)throw new Error(parsed.error||'tool failed');return parsed;};
const tools=[];const use=async(name,input)=>{tools.push(name);return call(name,input);};
let reply;
try{
 if(/slow/.test(last)){await new Promise(r=>setTimeout(r,30000));reply='Slow reply';}
 else if(/launch/.test(last)){
  const projectID=/projectID ([\w-]+)/.exec(system)?.[1]||(await use('list_projects')).items[0].id;
  const {mandate}=await use('get_project_mandate',{projectID}),project=await use('get_project',{projectID}),flowID=mandate.workflowIDs[0],flow=await use('get_workflow',{projectID,flowID});
  const launch={projectID,flowID,flowVersion:flow.version,projectVersion:project.version,input:{task:'Coordinator task',acceptance:'Report',mode:mandate.modes[0],maxAttempts:1,config:{[flow.steps[0].id]:{model:'fixture',effort:'low'}}},mandate:{version:mandate.version,taskRef:mandate.tasks[0].ref}};
  const preview=await use('preview_run',launch),operation=await use('start_run',{...launch,requestKey:'coordinator-launch',previewToken:preview.previewToken});
  reply=`Started ${mandate.tasks[0].ref} under mandate v${mandate.version} (operation ${operation.id}).`;
 }else{const projects=await use('list_projects');reply=`Echo: ${last} (${projects.total} granted project${projects.total===1?'':'s'})`;}
}catch(error){reply=`Tool error: ${error.message}`;}
await client.close();
const out=event=>process.stdout.write(JSON.stringify(event)+'\n');
if(codex){out({type:'thread.started',thread_id:'fixture'});for(const t of tools)out({type:'item.started',item:{type:'mcp_tool_call',tool:t}});out({type:'item.completed',item:{type:'agent_message',text:reply}});out({type:'turn.completed',usage:{input_tokens:10,output_tokens:5}});}
else{out({type:'system',subtype:'init',session_id:'fixture',model:value('--model')});out({type:'assistant',message:{content:[...tools.map(t=>({type:'tool_use',id:t,name:'mcp__workbench__'+t,input:{}})),{type:'text',text:reply}]}});out({type:'result',subtype:'success',is_error:false,result:reply,usage:{input_tokens:10,output_tokens:5}});}
