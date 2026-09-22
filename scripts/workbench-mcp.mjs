#!/usr/bin/env node
import {readFileSync,statSync} from 'node:fs';
import {McpServer} from '@modelcontextprotocol/sdk/server/mcp.js';
import {StdioServerTransport} from '@modelcontextprotocol/sdk/server/stdio.js';
import {controllerTools} from '../lib/controller-catalog.js';
// This process is only a transport bridge. The running app owns all state and execution.
const configPath=process.argv[2];
let config;
try{
 if(!configPath||statSync(configPath).mode&0o077)throw new Error();
 config=JSON.parse(readFileSync(configPath,'utf8'));
 const endpoint=new URL(config.endpoint);
 if(endpoint.protocol!=='http:'||!['127.0.0.1','localhost'].includes(endpoint.hostname)||endpoint.pathname!=='/api/controller/call'||endpoint.username||endpoint.password||endpoint.search||endpoint.hash||!endpoint.port||!/^[a-f0-9]{64}$/.test(config.token))throw new Error();
}catch{process.stderr.write('Workbench MCP: supply a valid private controller configuration file (mode 600).\n');process.exit(1);}
const server=new McpServer({name:'skd-workbench',version:'0.5.0'});
let pending=0;
for(const tool of controllerTools)server.registerTool(tool.name,{description:tool.description,inputSchema:tool.shape,annotations:{readOnlyHint:tool.capability==='read',destructiveHint:tool.name==='stop_run',idempotentHint:true,openWorldHint:false}},async args=>{
 if(pending>=8)return {isError:true,content:[{type:'text',text:'Too many pending requests. Inspect existing operations before retrying.'}]};
 pending++;
 try{
  const response=await fetch(config.endpoint,{method:'POST',redirect:'error',headers:{'Content-Type':'application/json',Authorization:'Bearer '+config.token},body:JSON.stringify({name:tool.name,arguments:args}),signal:AbortSignal.timeout(60000)});
  const reader=response.body.getReader();let length=0;const chunks=[];
  while(true){const {done,value}=await reader.read();if(done)break;length+=value.length;if(length>512*1024){await reader.cancel();throw new Error();}chunks.push(Buffer.from(value));}
  const result=JSON.parse(Buffer.concat(chunks).toString('utf8'));
  return {isError:!response.ok,content:[{type:'text',text:JSON.stringify(result)}]};
 }catch{return {isError:true,content:[{type:'text',text:'Workbench is unavailable or the request outcome is unknown. Start or reconnect to the existing Workbench app. For a mutation, retry the same request key to recover its outcome; do not create a new key blindly.'}]};}
 finally{pending--;}
});
await server.connect(new StdioServerTransport());
