import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,readFileSync,rmSync,existsSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {createServer} from '../server.js';
const delay=ms=>new Promise(r=>setTimeout(r,ms));
const fixture=path.resolve('tests/fixtures/coordinator-cli.mjs');
const catalog=async()=>({version:'fixture',models:[{id:'fixture',efforts:['low','default']}]});
async function boot(root){
 const server=createServer({directory:path.join(root,'data'),codexOptions:{binary:fixture,discover:catalog},claudeOptions:{binary:fixture,discover:catalog}});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const url='http://127.0.0.1:'+server.address().port;
 const api=async(route,input,method)=>{const res=await fetch(url+'/api/'+route,{method:method||(input?'POST':'GET'),headers:{'Content-Type':'application/json'},...(input?{body:JSON.stringify(input)}:{})});return {status:res.status,body:await res.json()};};
 return {server,api,close:async()=>{server.shutdownCodex();server.closeAllConnections();await new Promise(r=>server.close(r));await delay(150);}};
}
async function setup(t){
 const root=mkdtempSync(path.join(tmpdir(),'skd-coordinator-')),repo=path.join(root,'repo');mkdirSync(repo);
 const log=path.join(root,'args.log');process.env.COORDINATOR_FIXTURE_LOG=log;
 const f={root,log,...await boot(root)};t.after(async()=>{await f.close();delete process.env.COORDINATOR_FIXTURE_LOG;rmSync(root,{recursive:true,force:true});});
 f.p=(await f.api('projects',{name:'Pilot',folderPath:repo})).body;
 f.turn=async(key,status)=>{let s;for(let i=0;i<300;i++){s=(await f.api(key==='coordinator'?'agents/overview':'projects/'+key+'/agent')).body.coordinator;const t=s.turns.at(-1);if(t&&(status?t.status===status:!['queued','running'].includes(t.status)))return t;await delay(25);}throw Error('Turn did not settle: '+JSON.stringify(s));};
 f.enable=async(provider,extra={})=>{const v=(await f.api('coordinator')).body;return f.api('coordinator',{version:v.version,enabled:true,provider,model:'fixture',effort:'low',...extra},'PUT');};
 return f;
}
test('coordinator is off by default; enabling validates settings and creates a visible internal grant',async t=>{
 const f=await setup(t),view=(await f.api('coordinator')).body;
 assert.equal(view.enabled,false);assert.equal(view.grant,null);
 const quiet=await f.api('coordinator/messages',{text:'Anyone there?',requestKey:'q1'});assert.equal(quiet.status,201);assert.equal(quiet.body.turn,null,'No reply runs while the coordinator is off.');
 assert.equal((await f.api('coordinator',{version:view.version,enabled:true,provider:'claude',model:'missing',effort:'low'},'PUT')).status,400);
 assert.equal((await f.api('coordinator',{version:99,enabled:true,provider:'claude',model:'fixture',effort:'low'},'PUT')).status,409);
 assert.equal((await f.api('coordinator',{version:view.version,enabled:true,provider:'shell',model:'fixture',effort:'low'},'PUT')).status,400);
 const saved=await f.enable('claude');assert.equal(saved.status,200,JSON.stringify(saved.body));assert.equal(saved.body.enabled,true);assert.deepEqual(saved.body.grant.projectIDs,[f.p.id]);
 const listed=(await f.api('controllers')).body.controllers.find(c=>c.id===saved.body.grant.id);assert.equal(listed.name,'Workbench coordinator');assert.deepEqual(listed.capabilities,['read','manage','run']);
 assert.equal((await f.api('workflows?projectID='+f.p.id)).body.length,0);assert.equal((await f.api('coordinator')).body.turns.length,0,'Saving starts no turn.');
});
test('Claude Code replies run read-only with only Workbench tools, outside the execution lock',async t=>{
 const f=await setup(t);await f.enable('claude');
 const sent=await f.api('coordinator/messages',{text:'hello there',requestKey:'m1'});assert.equal(sent.body.turn.status,'queued');
 const turn=await f.turn('coordinator');assert.equal(turn.status,'completed',JSON.stringify(turn));
 const thread=(await f.api('coordinator/messages')).body.items;assert.deepEqual(thread.map(m=>m.author),['user','agent']);
 assert.equal(thread[1].text,'Echo: hello there (1 granted project)');assert.equal(thread[1].controllerName,'Coordinator · Claude Code');assert.deepEqual(turn.tools,['list_projects']);
 const args=JSON.parse(readFileSync(f.log,'utf8').trim().split('\n').at(-1));
 assert.equal(args[args.indexOf('--tools')+1],'');assert.equal(args[args.indexOf('--allowedTools')+1],'mcp__workbench');assert(args.includes('--strict-mcp-config'));assert(!args.includes('--safe-mode'));assert.equal(args[args.indexOf('--permission-mode')+1],'dontAsk');
 assert.equal(Object.keys(JSON.parse(args[args.indexOf('--mcp-config')+1]).mcpServers).join(),'workbench');
 const again=await f.api('coordinator/messages',{text:'hello there',requestKey:'m1'});assert.equal(again.body.turn.id,sent.body.turn.id,'A retried send does not start a second reply.');
});
test('Codex project owner launches a mandate-bound workflow and still replies while the lock is held',async t=>{
 const f=await setup(t);await f.enable('codex');
 const flow=(await f.api('flows',{projectID:f.p.id,name:'Review',steps:[{id:'review',type:'agent',name:'Review',model:'fixture',effort:'low',instructions:'Review'},{id:'accept',type:'human',name:'Accept',instructions:'Check',maxRetries:1,retryFrom:'review'}]})).body;
 const owner=(await f.api('agent-profiles',{revision:0,name:'Pilot owner',scope:{kind:'project',projectID:f.p.id},providers:['codex'],systemPrompt:'Own it.',skillIDs:[],connectionIDs:[]})).body;
 await f.api('projects/'+f.p.id+'/mandate',{version:0,enabled:true,agentProfile:{id:owner.id},objective:'Pilot',tasks:[{ref:'local:pilot'}],workflowIDs:[flow.id],modes:['read-only'],limits:{maxAttempts:1,maxRuntimeMinutes:30}},'PUT');
 await f.api('projects/'+f.p.id+'/messages',{text:'please launch the pilot',requestKey:'p1'});
 const turn=await f.turn(f.p.id);assert.equal(turn.status,'completed',JSON.stringify(turn));
 const reply=(await f.api('projects/'+f.p.id+'/messages')).body.items.at(-1);
 assert.match(reply.text,/Started local:pilot under mandate v1/);assert.deepEqual(reply.refs.map(r=>r.kind),['run','operation']);
 const runs=(await f.api('workflows?projectID='+f.p.id)).body;assert.equal(runs.length,1);
 let run;for(let i=0;i<150;i++){run=(await f.api('workflows/'+runs[0].id)).body;if(run.status==='waiting')break;await delay(20);}
 assert.equal(run.status,'waiting');assert.equal(run.controllerOrigin.mandate.taskRef,'local:pilot');assert.equal(run.controllerOrigin.controllerName,'Workbench coordinator');
 const args=JSON.parse(readFileSync(f.log,'utf8').trim().split('\n').find(l=>l.includes('mcp_servers.workbench.command')));
 assert.equal(args[args.indexOf('--sandbox')+1],'read-only');assert(args.includes('mcp_servers.workbench.default_tools_approval_mode="approve"'));assert(args.includes('shell_tool'));assert(!args.some(a=>a.startsWith('mcp_servers.')&&!a.startsWith('mcp_servers.workbench.')));
 // The waiting workflow holds the execution lock; the coordinator lane still answers.
 await f.api('projects/'+f.p.id+'/messages',{text:'status please',requestKey:'p2'});
 const status=await f.turn(f.p.id);assert.equal(status.status,'completed');assert.match((await f.api('projects/'+f.p.id+'/messages')).body.items.at(-1).text,/Echo: status please/);
});
test('stop, revocation and restart leave replies inspectable without replay',async t=>{
 const f=await setup(t);const enabled=await f.enable('claude');
 await f.api('coordinator/messages',{text:'slow answer',requestKey:'s1'});const running=await f.turn('coordinator','running');
 const stopped=await f.api('coordinator/turns/'+running.id+'/stop',{});assert.equal(stopped.status,200);
 const cancelled=await f.turn('coordinator');assert.equal(cancelled.status,'cancelled');assert.equal((await f.api('coordinator/messages')).body.items.length,1,'A stopped reply posts nothing.');
 await f.api('controllers/'+enabled.body.grant.id+'/revoke',{version:1});
 await f.api('coordinator/messages',{text:'after revoke',requestKey:'s2'});const denied=await f.turn('coordinator');assert.equal(denied.status,'failed');assert.match(denied.error,/grant was revoked/);
 await f.enable('claude');assert.equal((await f.api('controllers')).body.controllers.filter(c=>c.name==='Workbench coordinator'&&!c.revoked).length,1,'Re-enabling explicitly creates one new grant.');
 await f.api('coordinator/messages',{text:'slow again',requestKey:'s3'});await f.turn('coordinator','running');
 await f.close();Object.assign(f,await boot(f.root));
 const after=(await f.api('agents/overview')).body.coordinator.turns.at(-1);assert.equal(after.status,'interrupted');assert.match(after.error,/nothing was replayed/);
 await delay(300);assert.equal((await f.api('coordinator/messages')).body.items.filter(m=>m.author==='agent').length,0);
 assert(existsSync(path.join(f.root,'data','coordinator-agent.json')));
});
