import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,writeFileSync,readFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {createServer} from '../server.js';
import {Client} from '@modelcontextprotocol/sdk/client/index.js';
import {StdioClientTransport} from '@modelcontextprotocol/sdk/client/stdio.js';
const delay=ms=>new Promise(r=>setTimeout(r,ms));
// PA-05 pilot: one external coordinator acting as project owner over the real stdio MCP bridge,
// against a temporary store and a fixture provider. No real-provider inference runs here.
test('pilot: coordinator reads mandate and direction, launches one bounded task, reports evidence and survives restart',async t=>{
 const root=mkdtempSync(path.join(tmpdir(),'skd-pilot-')),repo=path.join(root,'project'),directory=path.join(root,'data');mkdirSync(repo);
 const binary=path.join(root,'fixture');writeFileSync(binary,`#!/usr/bin/env node\nprocess.stdin.resume();process.stdin.on('end',()=>{console.log(JSON.stringify({type:'item.completed',item:{type:'agent_message',text:'Pilot review complete. Checks: npm test passed (fixture).'}}));console.log(JSON.stringify({type:'turn.completed',usage:{input_tokens:3,output_tokens:5}}));});`,{mode:0o755});
 const options={directory,codexOptions:{binary,discover:async()=>({version:'fixture',models:[{id:'fixture',efforts:['low']}]})}};
 let server=createServer(options);await new Promise(r=>server.listen(0,'127.0.0.1',r));const port=server.address().port,url='http://127.0.0.1:'+port;
 const clients=[];
 t.after(async()=>{for(const c of clients)await c.close().catch(()=>{});server.shutdownCodex();server.closeAllConnections();await new Promise(r=>server.close(r));await delay(100);rmSync(root,{recursive:true,force:true});});
 const api=async(route,input,method)=>{const res=await fetch(url+'/api/'+route,{method:method||(input?'POST':'GET'),headers:{'Content-Type':'application/json'},...(input?{body:JSON.stringify(input)}:{})});const body=await res.json();assert(res.ok,route+': '+JSON.stringify(body));return body;};
 // User setup: project, owner Agent, controller grant (read/manage/run), and an active mandate saved in Workbench.
 const p=await api('projects',{name:'Pilot',folderPath:repo});
 const owner=await api('agent-profiles',{revision:0,name:'Pilot owner',scope:{kind:'project',projectID:p.id},providers:['codex'],systemPrompt:'Own the pilot.',skillIDs:[],connectionIDs:[]});
 const grant=await api('controllers',{name:'Coordinator',projectIDs:[p.id],capabilities:['read','manage','run']});
 const connect=async()=>{const client=new Client({name:'pilot-coordinator',version:'1'});await client.connect(new StdioClientTransport({command:process.execPath,args:[path.resolve('scripts/workbench-mcp.mjs'),grant.credentialPath],stderr:'pipe'}));clients.push(client);
  return async(name,args={})=>{const r=await client.callTool({name,arguments:args});let value;try{value=JSON.parse(r.content[0].text);}catch{value={error:r.content[0].text};}return r.isError?{error:value.error||value,isError:true}:value;};};
 let mcp=await connect();
 const created=await mcp('create_workflow',{projectID:p.id,requestKey:'pilot-flow',input:{name:'Pilot review',steps:[{id:'review',type:'agent',name:'Review',model:'fixture',effort:'low',instructions:'Review the pilot.'},{id:'accept',type:'human',name:'Accept',instructions:'Accept the report',maxRetries:1,retryFrom:'review'}]}});
 assert.equal(created.status,'completed');
 await api('projects/'+p.id+'/mandate',{version:0,enabled:true,agentProfile:{id:owner.id},objective:'Run the Workbench pilot.',tasks:[{ref:'github:shelbyklein/skd-workbench#14',title:'Pilot'}],workflowIDs:[created.flowID],modes:['read-only'],limits:{maxAttempts:1,maxRuntimeMinutes:30},instructions:'Read-only review. Report checks.'},'PUT');
 await api('projects/'+p.id+'/messages',{text:'Run the pilot review and report back.',requestKey:'direction-1'});
 // Coordinator: read authority and direction, then launch only within the mandate.
 const {mandate}=await mcp('get_project_mandate',{projectID:p.id});assert.equal(mandate.enabled,true);
 assert.equal((await mcp('list_messages',{projectID:p.id})).items[0].text,'Run the pilot review and report back.');
 assert.equal((await mcp('update_project_mandate',{projectID:p.id})).isError,true,'No mandate write tool exists.');
 const launch={projectID:p.id,flowID:created.flowID,flowVersion:1,projectVersion:p.version,input:{task:'Review the pilot',acceptance:'Report checks',mode:'read-only',maxAttempts:1,config:{review:{model:'fixture',effort:'low'}}},mandate:{version:mandate.version,taskRef:'github:shelbyklein/skd-workbench#14'}};
 assert.equal((await mcp('preview_run',{...launch,input:{...launch.input,maxAttempts:2}})).isError,true,'Attempts above the mandate limit are refused.');
 assert.equal((await mcp('preview_run',{...launch,input:{...launch.input,mode:'worktree'}})).isError,true,'Unpermitted modes are refused.');
 const preview=await mcp('preview_run',launch);assert(preview.previewToken);
 const operation=await mcp('start_run',{...launch,requestKey:'pilot-start',previewToken:preview.previewToken});
 let op,run;for(let i=0;i<150;i++){op=await mcp('get_operation',{projectID:p.id,operationID:operation.id});if(op.runID){run=await mcp('get_run',{projectID:p.id,runID:op.runID});if(run.status==='waiting')break;}await delay(20);}
 assert.equal(run?.status,'waiting',JSON.stringify(op));assert.equal(run.controllerOrigin.mandate.taskRef,'github:shelbyklein/skd-workbench#14');
 const evidence=run.attempts.items[0].execution;assert.match(evidence.output,/Checks: npm test passed/);
 const report=await mcp('post_message',{projectID:p.id,requestKey:'report-1',text:'Pilot review finished and is waiting for your acceptance. Process completed; checks are agent-reported, not observed.',refs:[{kind:'run',id:run.id},{kind:'operation',id:operation.id},{kind:'issue',id:'shelbyklein/skd-workbench#14'}]});
 assert.deepEqual(report.refs.map(r=>r.kind),['run','operation','issue']);
 assert.deepEqual(await mcp('post_message',{projectID:p.id,requestKey:'report-1',text:'Pilot review finished and is waiting for your acceptance. Process completed; checks are agent-reported, not observed.',refs:[{kind:'run',id:run.id},{kind:'operation',id:operation.id},{kind:'issue',id:'shelbyklein/skd-workbench#14'}]}),report,'Retried report is not duplicated.');
 // The user sees the same records on the project overview.
 const overview=await api('projects/'+p.id+'/agent');
 assert.equal(overview.current.id,run.id);assert.equal(overview.decisions[0].runID,run.id);assert.equal(overview.thread.items.at(-1).refs[0].id,run.id);assert.equal(overview.next.length,0,'The claimed task is not offered again.');
 // Restart on the same port: nothing replays, records and conversation persist, and the coordinator reconnects.
 server.shutdownCodex();server.closeAllConnections();await new Promise(r=>server.close(r));await delay(100);
 server=createServer(options);await new Promise(r=>server.listen(port,'127.0.0.1',r));
 mcp=await connect();
 const after=await mcp('get_run',{projectID:p.id,runID:run.id});assert.equal(after.status,'waiting');assert.equal(after.attempts.items.length,1,'No attempt replayed after restart.');
 assert.equal((await mcp('get_operation',{projectID:p.id,operationID:operation.id})).status,'accepted');
 assert.equal((await mcp('list_messages',{projectID:p.id})).total,2);
 // Bounded: the user requests changes, and the one-attempt mandate cap stops a second attempt.
 await api('workflows/'+run.id+'/action',{action:'changes',revision:after.revision,note:'Tighten the report'});
 let capped;for(let i=0;i<150;i++){capped=await mcp('get_run',{projectID:p.id,runID:run.id});if(capped.status==='failed')break;await delay(20);}
 assert.equal(capped.status,'failed');assert.match(capped.error,/attempt limit/);assert.equal(capped.attempts.items.filter(a=>a.kind==='agent').length,1);
 const stopped=await mcp('stop_run',{projectID:p.id,runID:run.id,revision:capped.revision,requestKey:'pilot-stop'});assert.equal(stopped.status,'completed');
 assert.equal((await api('workflows?projectID='+p.id)).length,1,'Exactly one pilot run exists.');
});
