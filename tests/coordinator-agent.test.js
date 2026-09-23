import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,readFileSync,rmSync,existsSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {WebSocket} from 'ws';
import {createServer} from '../server.js';
const delay=ms=>new Promise(r=>setTimeout(r,ms));
const fixture=path.resolve('tests/fixtures/coordinator-cli.mjs');
const catalog=async()=>({version:'fixture',models:[{id:'fixture',efforts:['low','default']}]});
async function boot(root){
 const server=createServer({directory:path.join(root,'data'),codexOptions:{binary:fixture,discover:catalog},claudeOptions:{binary:fixture,discover:catalog}});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const url='http://127.0.0.1:'+server.address().port;
 const api=async(route,input,method)=>{const res=await fetch(url+'/api/'+route,{method:method||(input?'POST':'GET'),headers:{'Content-Type':'application/json'},...(input?{body:JSON.stringify(input)}:{})});return {status:res.status,body:await res.json()};};
 return {server,url,api,close:async()=>{server.shutdownCodex();server.closeAllConnections();await new Promise(r=>server.close(r));await delay(150);}};
}
async function setup(t){
 const root=mkdtempSync(path.join(tmpdir(),'skd-coordinator-')),repo=path.join(root,'repo');mkdirSync(repo);
 const log=path.join(root,'args.log');process.env.COORDINATOR_FIXTURE_LOG=log;
 const f={root,log,...await boot(root)};t.after(async()=>{await f.close();delete process.env.COORDINATOR_FIXTURE_LOG;rmSync(root,{recursive:true,force:true});});
 f.p=(await f.api('projects',{name:'Pilot',folderPath:repo})).body;
 f.thread=key=>f.api(key==='coordinator'?'coordinator/messages':'projects/'+key+'/messages').then(r=>r.body.items);
 f.state=async key=>(await f.api(key==='coordinator'?'agents/overview':'projects/'+key+'/agent')).body;
 f.replies=async(key,count)=>{let items;for(let i=0;i<400;i++){items=await f.thread(key);if(items.filter(m=>m.author==='agent').length>=count)return items;await delay(25);}throw Error('No reply: '+JSON.stringify(items));};
 f.until=async(check,label)=>{for(let i=0;i<400;i++){const v=await check();if(v)return v;await delay(25);}throw Error('Timed out: '+label);};
 f.sessions=()=>readFileSync(log,'utf8').trim().split('\n').map(l=>JSON.parse(l)).filter(e=>e.mode==='session');
 f.enable=async(provider,extra={})=>{const v=(await f.api('coordinator')).body;return f.api('coordinator',{version:v.version,enabled:true,provider,model:'fixture',effort:'low',...extra},'PUT');};
 f.type=async(sessionID,data)=>{const ws=new WebSocket(f.url.replace('http','ws')+`/api/coordinator-terminal/${sessionID}/stream`,{origin:f.url});await new Promise((r,j)=>{ws.once('message',r);ws.once('error',j);});ws.send(JSON.stringify({type:'input',data}));await delay(50);ws.close();};
 return f;
}
test('coordinator is off by default; enabling validates settings and creates a visible internal grant',async t=>{
 const f=await setup(t),view=(await f.api('coordinator')).body;
 assert.equal(view.enabled,false);assert.equal(view.grant,null);
 const quiet=await f.api('coordinator/messages',{text:'Anyone there?',requestKey:'q1'});assert.equal(quiet.status,201);assert.equal(quiet.body.session,null,'No session starts while the coordinator is off.');
 assert.equal((await f.api('coordinator',{version:view.version,enabled:true,provider:'claude',model:'missing',effort:'low'},'PUT')).status,400);
 assert.equal((await f.api('coordinator',{version:99,enabled:true,provider:'claude',model:'fixture',effort:'low'},'PUT')).status,409);
 assert.equal((await f.api('coordinator',{version:view.version,enabled:true,provider:'shell',model:'fixture',effort:'low'},'PUT')).status,400);
 const saved=await f.enable('claude');assert.equal(saved.status,200,JSON.stringify(saved.body));assert.equal(saved.body.enabled,true);assert.deepEqual(saved.body.grant.projectIDs,[f.p.id]);
 const listed=(await f.api('controllers')).body.controllers.find(c=>c.id===saved.body.grant.id);assert.equal(listed.name,'Workbench coordinator');assert.deepEqual(listed.capabilities,['read','manage','run']);
 assert.equal((await f.state('coordinator')).coordinator.session,null,'Saving starts no session.');assert(!existsSync(f.log));
});
test('Claude Code session: messages go into one live CLI and the agent posts replies to the chat',async t=>{
 const f=await setup(t);await f.enable('claude');
 const sent=await f.api('coordinator/messages',{text:'hello there',requestKey:'m1'});assert.equal(sent.body.session.status,'running');assert.equal(sent.body.session.provider,'claude');
 let thread=await f.replies('coordinator',1);assert.deepEqual(thread.map(m=>m.author),['user','agent']);
 assert.equal(thread[1].text,'Echo: hello there (1 granted project)');assert.equal(thread[1].controllerName,'Workbench coordinator');
 const second=await f.api('coordinator/messages',{text:'and again',requestKey:'m2'});assert.equal(second.body.session.id,sent.body.session.id,'One session per conversation.');
 thread=await f.replies('coordinator',2);assert.equal(thread.at(-1).text,'Echo: and again (1 granted project)');
 const retry=await f.api('coordinator/messages',{text:'and again',requestKey:'m2'});assert.equal(retry.body.id,second.body.id);await delay(300);
 assert.equal((await f.thread('coordinator')).filter(m=>m.author==='agent').length,2,'A retried send is not typed twice.');
 assert.equal(f.sessions().length,1,'No second CLI was started.');
 const args=f.sessions()[0].args;assert.equal(args[args.indexOf('--tools')+1],'');assert.equal(args[args.indexOf('--permission-mode')+1],'manual');assert(!args.some(a=>/dontAsk|bypass/.test(a)));
 const state=(await f.state('coordinator')).coordinator;assert.equal(state.session.id,sent.body.session.id);
 const output=await new Promise((resolve,reject)=>{const ws=new WebSocket(f.url.replace('http','ws')+`/api/coordinator-terminal/${state.session.id}/stream`,{origin:f.url});ws.once('message',m=>{resolve(JSON.parse(m));ws.close();});ws.once('error',reject);});
 assert.match(output.data,/⏺ workbench - list_projects \(MCP\)/);assert.match(output.data,/> and again/);assert.equal(output.session.status,'running');
});
test('Codex project session prompts before start_run, surfaces it as a decision and launches after approval',async t=>{
 const f=await setup(t);await f.enable('codex');
 const flow=(await f.api('flows',{projectID:f.p.id,name:'Review',steps:[{id:'review',type:'agent',name:'Review',model:'fixture',effort:'low',instructions:'Review'},{id:'accept',type:'human',name:'Accept',instructions:'Check',maxRetries:1,retryFrom:'review'}]})).body;
 const owner=(await f.api('agent-profiles',{revision:0,name:'Pilot owner',scope:{kind:'project',projectID:f.p.id},providers:['codex'],systemPrompt:'Own it.',skillIDs:[],connectionIDs:[]})).body;
 await f.api('projects/'+f.p.id+'/mandate',{version:0,enabled:true,agentProfile:{id:owner.id},objective:'Pilot',tasks:[{ref:'local:pilot'}],workflowIDs:[flow.id],modes:['read-only'],limits:{maxAttempts:1,maxRuntimeMinutes:30}},'PUT');
 const sent=await f.api('projects/'+f.p.id+'/messages',{text:'please launch the pilot',requestKey:'p1'});
 const waiting=await f.until(async()=>{const s=await f.state(f.p.id);return s.coordinator.session?.waiting&&s;},'waiting prompt');
 const decision=waiting.decisions.find(d=>d.kind==='coordinator');assert.equal(decision.sessionID,sent.body.session.id);assert.equal(decision.projectID,f.p.id);
 const home=(await f.state('coordinator'));assert(home.decisions.some(d=>d.kind==='coordinator'&&d.projectName==='Pilot'));assert.equal(home.counts.decisions,1);
 assert.equal((await f.api('workflows?projectID='+f.p.id)).body.length,0,'Nothing starts before approval.');
 await f.type(sent.body.session.id,'y\r');
 const thread=await f.replies(f.p.id,1);assert.match(thread.at(-1).text,/Started local:pilot under mandate v1/);
 assert.equal((await f.state(f.p.id)).coordinator.session.waiting,false);
 const runs=(await f.api('workflows?projectID='+f.p.id)).body;assert.equal(runs.length,1);
 let run;for(let i=0;i<150;i++){run=(await f.api('workflows/'+runs[0].id)).body;if(run.status==='waiting')break;await delay(20);}
 assert.equal(run.status,'waiting');assert.equal(run.controllerOrigin.mandate.taskRef,'local:pilot');assert.equal(run.controllerOrigin.controllerName,'Workbench coordinator');
 const session=f.sessions()[0];assert.equal(session.provider,'codex');assert.equal(session.codexHome,path.join(f.root,'data','coordinator-codex'));
 assert.deepEqual([...session.config.matchAll(/^\[mcp_servers\.(\w+)\]$/gm)].map(m=>m[1]),['workbench'],'Only the Workbench MCP server is configured.');
 // The waiting workflow holds the execution lock; the coordinator session still answers.
 await f.api('projects/'+f.p.id+'/messages',{text:'status please',requestKey:'p2'});
 assert.match((await f.replies(f.p.id,2)).at(-1).text,/Echo: status please/);
});
test('Stop and restart end sessions without replay; history stays readable',async t=>{
 const f=await setup(t);await f.enable('claude');
 const sent=await f.api('coordinator/messages',{text:'hello',requestKey:'s1'});await f.replies('coordinator',1);
 const stopped=await f.api('coordinator/sessions/'+sent.body.session.id+'/stop',{});assert.equal(stopped.status,200);
 const after=await f.until(async()=>{const c=(await f.state('coordinator')).coordinator;return !c.session&&c;},'session end');
 assert.equal(after.history[0].id,sent.body.session.id);assert.equal(after.history[0].endReason,'stopped');
 assert.equal((await f.api('coordinator/sessions/'+sent.body.session.id+'/signal',{secret:'x',kind:'waiting'})).status,404);
 const live=(await f.api('coordinator/messages',{text:'live',requestKey:'s1b'})).body.session;await f.replies('coordinator',2);
 const remote=await fetch(f.url+'/api/coordinator/sessions/'+live.id+'/signal',{method:'POST',headers:{'Content-Type':'application/json','cf-ray':'fixture'},body:JSON.stringify({secret:'x',kind:'waiting'})});
 assert.equal(remote.status,403,'Remote requests cannot signal a session.');
 assert.equal((await f.api('coordinator/sessions/'+live.id+'/signal',{secret:'wrong',kind:'waiting'})).status,403,'A wrong secret is refused.');
 await f.api('coordinator/sessions/'+live.id+'/stop',{});await f.until(async()=>!(await f.state('coordinator')).coordinator.session,'live session end');
 const next=await f.api('coordinator/messages',{text:'again',requestKey:'s2'});assert.notEqual(next.body.session.id,sent.body.session.id);await f.replies('coordinator',3);
 await f.close();Object.assign(f,await boot(f.root));
 const restarted=(await f.state('coordinator')).coordinator;assert.equal(restarted.session,null,'Restart never resumes.');assert.equal(restarted.history[0].endReason,'server');
 await delay(300);assert.equal(f.sessions().length,3,'No session was started by the restart.');assert.equal((await f.thread('coordinator')).filter(m=>m.author==='agent').length,3);
});
