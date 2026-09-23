import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,writeFileSync,readFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {createServer} from '../server.js';
const delay=ms=>new Promise(r=>setTimeout(r,ms));
const flowInput={name:'Pilot review',steps:[{id:'review',type:'agent',name:'Review',model:'fixture',effort:'low',instructions:'Review'},{id:'human',type:'human',name:'Human review',instructions:'Check result',maxRetries:1,retryFrom:'review'}]};
async function boot(root){
 const binary=path.join(root,'fixture');
 const server=createServer({directory:path.join(root,'data'),codexOptions:{binary,discover:async()=>({version:'fixture',models:[{id:'fixture',efforts:['low']}]})}});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const url='http://127.0.0.1:'+server.address().port;
 const api=async(route,input,{method,token}={})=>{const res=await fetch(url+'/api/'+route,{method:method||(input?'POST':'GET'),headers:{'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{})},...(input?{body:JSON.stringify(input)}:{})});return {status:res.status,body:await res.json()};};
 const close=async()=>{server.shutdownCodex();server.closeAllConnections();await new Promise(r=>server.close(r));await delay(100);};
 return {server,api,close};
}
async function fixture(t){
 const root=mkdtempSync(path.join(tmpdir(),'skd-mandate-run-')),repo=path.join(root,'project');mkdirSync(repo);
 writeFileSync(path.join(root,'fixture'),`#!/usr/bin/env node\nprocess.stdin.resume();process.stdin.on('end',()=>{console.log(JSON.stringify({type:'item.completed',item:{type:'agent_message',text:'Fixture review: checks passed'}}));console.log(JSON.stringify({type:'turn.completed',usage:{input_tokens:1,output_tokens:2}}));});`,{mode:0o755});
 const f={root,...await boot(root)};t.after(async()=>{await f.close();rmSync(root,{recursive:true,force:true});});
 f.p=(await f.api('projects',{name:'Pilot',folderPath:repo})).body;
 const setup=(await f.api('controllers',{name:'Coordinator',projectIDs:[f.p.id],capabilities:['read','manage','run']})).body;
 f.setup=setup;f.token=JSON.parse(readFileSync(setup.credentialPath)).token;
 f.call=async(name,args,token=f.token)=>f.api('controller/call',{name,arguments:args},{token});
 f.flow=(await f.call('create_workflow',{projectID:f.p.id,requestKey:'create',input:flowInput})).body;
 f.other=(await f.call('create_workflow',{projectID:f.p.id,requestKey:'create-other',input:{...flowInput,name:'Outside'}})).body;
 f.owner=(await f.api('agent-profiles',{revision:0,name:'Pilot owner',scope:{kind:'project',projectID:f.p.id},providers:['codex'],systemPrompt:'Own the pilot.',skillIDs:[],connectionIDs:[]})).body;
 f.mandate=async(extra={})=>{const current=(await f.api('projects/'+f.p.id+'/mandate')).body.mandate;const r=await f.api('projects/'+f.p.id+'/mandate',{version:current?.version||0,enabled:true,agentProfile:{id:f.owner.id},objective:'Review the pilot.',tasks:[{ref:'local:pilot',title:'Pilot'}],workflowIDs:[f.flow.flowID],modes:['read-only'],limits:{maxAttempts:2,maxRuntimeMinutes:30},...extra},{method:'PUT'});assert.equal(r.status,200,JSON.stringify(r.body));return r.body;};
 f.launch=(extra={})=>({projectID:f.p.id,flowID:f.flow.flowID,flowVersion:1,projectVersion:f.p.version,input:{task:'Review pilot',acceptance:'Report checks',mode:'read-only',maxAttempts:2,config:{review:{model:'fixture',effort:'low'}}},...extra});
 f.operation=async id=>{for(let i=0;i<150;i++){const o=(await f.call('get_operation',{projectID:f.p.id,operationID:id})).body;if(o.status!=='preparing')return o;await delay(20);}throw Error('operation timeout');};
 f.waitRun=async(id,status)=>{let r;for(let i=0;i<150;i++){r=(await f.call('get_run',{projectID:f.p.id,runID:id})).body;if(r.status===status)return r;await delay(20);}throw Error('run is '+r?.status);};
 return f;
}

test('mandate binding rejects out-of-scope, stale and paused launches before execution',async t=>{
 const f=await fixture(t),m=await f.mandate(),bound={version:m.version,taskRef:'local:pilot'};
 const preview=async extra=>f.call('preview_run',f.launch(extra));
 assert.equal((await preview({mandate:{...bound,version:9}})).status,409);
 assert.equal((await preview({mandate:{...bound,taskRef:'local:elsewhere'}})).status,403);
 assert.equal((await preview({mandate:bound,flowID:f.other.flowID})).status,403);
 assert.equal((await preview({mandate:bound,input:{...f.launch().input,mode:'worktree'}})).status,403);
 assert.match((await preview({mandate:bound,input:{...f.launch().input,maxAttempts:3}})).body.error,/at most 2/);
 const ok=await preview({mandate:bound});assert.equal(ok.status,200,JSON.stringify(ok.body));assert.deepEqual(ok.body.mandate,{id:m.id,version:1,taskRef:'local:pilot',agentProfile:{id:f.owner.id,version:1},limits:{maxAttempts:2,maxRuntimeMinutes:30}});
 const legacy=await preview();assert.equal(legacy.status,200);assert.notEqual(legacy.body.previewToken,ok.body.previewToken,'Mandate state is part of the preview fingerprint.');
 // An edit between preview and start invalidates the earlier authorization.
 await f.mandate({objective:'Revised objective.'});
 const stale=(await f.call('start_run',{...f.launch({mandate:bound}),requestKey:'stale',previewToken:ok.body.previewToken})).body;
 const failed=await f.operation(stale.id);assert.equal(failed.status,'failed');assert.match(failed.error,/mandate changed/);
 const paused=await f.mandate({enabled:false});assert.match((await preview({mandate:{version:paused.version,taskRef:'local:pilot'}})).body.error,/paused/);
 const resumed=await f.mandate();
 const archived=await f.api('agent-profiles/'+f.owner.id+'/archive',{revision:1,version:1,archived:true});assert.equal(archived.status,200,JSON.stringify(archived.body));
 assert.match((await preview({mandate:{version:resumed.version,taskRef:'local:pilot'}})).body.error,/archived/);
 assert.equal((await f.api('workflows?projectID='+f.p.id)).body.length,0,'No rejected launch created a run.');
});

test('authorized launch records immutable origin; duplicate claims, revocation and restart do not replay',async t=>{
 const f=await fixture(t),m=await f.mandate(),bound={version:m.version,taskRef:'local:pilot'};
 const preview=(await f.call('preview_run',f.launch({mandate:bound}))).body;
 const start={...f.launch({mandate:bound}),requestKey:'pilot',previewToken:preview.previewToken};
 const [a,b]=await Promise.all([f.call('start_run',start),f.call('start_run',start)]);assert.equal(a.body.id,b.body.id,'Same request key recovers one operation.');
 const accepted=await f.operation(a.body.id);assert.equal(accepted.status,'accepted',JSON.stringify(accepted));
 const run=await f.waitRun(accepted.runID,'waiting');
 assert.deepEqual(run.controllerOrigin.mandate,{id:m.id,version:1,taskRef:'local:pilot',agentProfile:{id:f.owner.id,version:1},limits:{maxAttempts:2,maxRuntimeMinutes:30}});
 assert.equal(run.attempts.items.length,1);assert.match(run.attempts.items[0].execution.output,/checks passed/);
 const raw=(await f.api('workflows/'+run.id)).body;assert(Date.parse(raw.deadlineAt)-Date.parse(raw.createdAt)===30*60000);
 // A second claim on the same task is refused while the first run is unfinished.
 const again=(await f.call('preview_run',f.launch({mandate:bound})));assert.equal(again.status,409);assert.match(again.body.error,/already claims this task/);
 // Pausing blocks new launches but does not stop the existing run.
 const paused=await f.mandate({enabled:false});assert.equal(paused.version,2);
 assert.equal((await f.call('get_run',{projectID:f.p.id,runID:run.id})).body.status,'waiting');
 assert.equal((await f.call('get_run',{projectID:f.p.id,runID:run.id})).body.controllerOrigin.mandate.version,1,'Run origin keeps the authorizing revision.');
 // Restart: waiting run and origin survive, no attempt is replayed, and an expired runtime cap blocks the next attempt.
 await f.close();
 const file=path.join(f.root,'data','workflows.json'),runs=JSON.parse(readFileSync(file,'utf8'));runs.find(r=>r.id===run.id).deadlineAt=new Date(Date.now()-1000).toISOString();writeFileSync(file,JSON.stringify(runs));
 Object.assign(f,await boot(f.root));
 const restored=await f.waitRun(run.id,'waiting');assert.equal(restored.attempts.items.length,1);assert.equal(restored.controllerOrigin.mandate.taskRef,'local:pilot');
 assert.equal((await f.call('get_operation',{projectID:f.p.id,operationID:accepted.id})).body.status,'accepted');
 const changes=await f.api('workflows/'+run.id+'/action',{action:'changes',revision:restored.revision,note:'Try again'});assert.equal(changes.status,200,JSON.stringify(changes.body));
 const capped=await f.waitRun(run.id,'failed');assert.match(capped.error,/runtime limit/);assert.equal(capped.attempts.items.filter(x=>x.kind==='agent').length,1,'No attempt launched after the deadline.');
 const stop=(await f.call('stop_run',{projectID:f.p.id,runID:run.id,revision:capped.revision,requestKey:'stop'})).body;assert.equal(stop.status,'completed');
 // Grant revocation blocks further mandate launches.
 await f.mandate();await f.api('controllers/'+f.setup.id+'/revoke',{version:1});
 assert.equal((await f.call('preview_run',f.launch({mandate:{version:3,taskRef:'local:pilot'}}))).status,403);
 assert.equal((await f.api('workflows?projectID='+f.p.id)).body.length,1);
});

test('controller launches without a mandate and user-started workflows keep working',async t=>{
 const f=await fixture(t);await f.mandate();
 const preview=(await f.call('preview_run',f.launch())).body;
 const started=(await f.call('start_run',{...f.launch(),requestKey:'legacy',previewToken:preview.previewToken})).body;
 const o=await f.operation(started.id);assert.equal(o.status,'accepted',JSON.stringify(o));
 const run=await f.waitRun(o.runID,'waiting');assert.equal(run.controllerOrigin.mandate,undefined);assert.equal((await f.api('workflows/'+run.id)).body.deadlineAt,undefined);
 await f.call('stop_run',{projectID:f.p.id,runID:run.id,revision:run.revision,requestKey:'stop-legacy'});await f.waitRun(run.id,'cancelled');
 const user=await f.api('workflows',{flowID:f.flow.flowID,projectVersion:f.p.version,flowVersion:1,task:'User task',mode:'read-only',maxAttempts:5,config:{review:{model:'fixture',effort:'low'}}});
 assert.equal(user.status,202,JSON.stringify(user.body));assert.equal(user.body.controllerOrigin,undefined);
});
