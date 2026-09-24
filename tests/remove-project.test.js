import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,readdirSync,rmSync} from 'node:fs';
import path from 'node:path';import {tmpdir} from 'node:os';
import {Store} from '../lib/store.js';

const fixture=()=>{const root=mkdtempSync(path.join(tmpdir(),'skd-remove-project-'));mkdirSync(path.join(root,'app'));const store=new Store(path.join(root,'data'));return {root,store,done:()=>rmSync(root,{recursive:true,force:true})};};
const flow=projectID=>({projectID,name:'Review',steps:[{id:'review',type:'agent',name:'Review',model:'m',effort:'low',instructions:'Review'}]});

test('removing archives the project and its workflows, keeps a backup, and restore brings back the same IDs', () => {
 const {root,store,done}=fixture();try{
  const project=store.createProject({name:'App',folderPath:path.join(root,'app')}),saved=store.createFlow(flow(project.id));
  const removed=store.removeProject(project.id,project.version);
  assert.equal(removed.workflowCount,1);
  assert.equal(store.snapshot().projects.some(p=>p.id===project.id),false);assert.equal(store.snapshot().flows.some(f=>f.id===saved.id),false);
  assert.throws(()=>store.project(project.id),/Project not found/);
  assert.deepEqual(store.removedProjects().map(p=>[p.id,p.name,p.workflowCount]),[[project.id,'App',1]]);
  assert.equal(readdirSync(path.join(root,'data')).filter(f=>f.startsWith(`store.json.remove-${project.id}.`)).length,1,'A backup is written before removal.');
  const again=new Store(path.join(root,'data'));assert.equal(again.removedProjects().length,1,'Removal persists.');
  const restored=again.restoreProject(project.id);
  assert.equal(restored.id,project.id);assert.equal(again.project(project.id).version,project.version);
  assert.deepEqual(again.snapshot().flows.filter(f=>f.projectID===project.id).map(f=>f.id),[saved.id]);assert.deepEqual(again.removedProjects(),[]);
 }finally{done();}
});

test('removal refuses unassigned, stale versions, benchmarks and unknown projects without changing anything', () => {
 const {root,store,done}=fixture();try{
  const project=store.createProject({name:'App',folderPath:path.join(root,'app')}),before=JSON.stringify(store.snapshot());
  assert.throws(()=>store.removeProject('unassigned',1),/Unassigned cannot be removed/);
  assert.throws(()=>store.removeProject(project.id,project.version+1),e=>e.status===409);
  assert.throws(()=>store.removeProject('missing',1),e=>e.status===404);
  assert.equal(JSON.stringify(store.snapshot()),before);
 }finally{done();}
});

test('adding a removed folder offers its project; restore refuses when another project took the folder', () => {
 const {root,store,done}=fixture();try{
  const folderPath=path.join(root,'app'),project=store.createProject({name:'App',folderPath});
  store.removeProject(project.id,project.version);
  assert.throws(()=>store.createProject({name:'Again',folderPath}),e=>e.status===409&&e.detail?.removedProjectID===project.id&&/removed project “App”/.test(e.message));
  mkdirSync(path.join(root,'other'));const other=store.createProject({name:'Other',folderPath:path.join(root,'other')});
  assert.throws(()=>store.updateProject(other.id,{name:'Other',folderPath,version:other.version}),/belongs to a removed project/);
  assert.throws(()=>store.restoreProject('missing'),e=>e.status===404);
 }finally{done();}
});

// Server: guards against running work, the orchestrator's reach, and restore through the API.
import {writeFileSync} from 'node:fs';
import {createServer} from '../server.js';
const delay=ms=>new Promise(r=>setTimeout(r,ms));
const cli=path.resolve('tests/fixtures/coordinator-cli.mjs'),catalog=async()=>({version:'fixture',models:[{id:'fixture',efforts:['low','default']}]});
test('the API refuses removal while the project agent runs, then hides the project from the orchestrator until restored', async t => {
 const root=mkdtempSync(path.join(tmpdir(),'skd-remove-project-api-'));process.env.COORDINATOR_FIXTURE_LOG=path.join(root,'fixture.log');
 const server=createServer({directory:path.join(root,'data'),codexOptions:{binary:cli,discover:catalog},claudeOptions:{binary:cli,discover:catalog}});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const url='http://127.0.0.1:'+server.address().port;
 t.after(async()=>{server.shutdownCodex();server.closeAllConnections();await new Promise(r=>server.close(r));await delay(150);delete process.env.COORDINATOR_FIXTURE_LOG;rmSync(root,{recursive:true,force:true});});
 const api=async(route,input,method)=>{const res=await fetch(url+'/api/'+route,{method:method||(input?'POST':'GET'),headers:{'Content-Type':'application/json'},...(input?{body:JSON.stringify(input)}:{})});return {status:res.status,body:await res.json()};};
 const until=async(check,label)=>{for(let i=0;i<400;i++){const v=await check();if(v)return v;await delay(25);}throw Error('Timed out: '+label);};
 const projects={};for(const name of ['Keep','Gone']){const folder=path.join(root,name.toLowerCase());mkdirSync(folder);writeFileSync(path.join(folder,'CLAUDE.md'),'# '+name);projects[name]=(await api('projects',{name,folderPath:folder})).body;}
 const gone=projects.Gone,v=(await api('coordinator')).body;await api('coordinator',{version:v.version,enabled:true,provider:'claude',model:'fixture',effort:'low'},'PUT');
 assert.deepEqual((await api('coordinator')).body.grant.projectIDs.sort(),[projects.Keep.id,gone.id].sort());
 // A live project agent blocks removal and nothing changes.
 await api(`projects/${gone.id}/messages`,{text:'hello',requestKey:'m1'});
 await until(async()=>(await api(`projects/${gone.id}/agent`)).body.coordinator.session?.status==='running','agent session');
 const blocked=await api(`projects/${gone.id}/remove`,{version:gone.version,confirm:true});
 assert.equal(blocked.status,409);assert.match(blocked.body.error,/project agent session is running/);
 assert.equal((await api('state')).body.projects.some(p=>p.id===gone.id),true);
 const session=(await api(`projects/${gone.id}/agent`)).body.coordinator.session;await api(`coordinator/sessions/${session.id}/stop`,{});
 await until(async()=>!(await api(`projects/${gone.id}/agent`)).body.coordinator.session,'session stopped');
 assert.equal((await api(`projects/${gone.id}/remove`,{version:gone.version})).status,400,'Removal needs explicit confirmation.');
 // An open workflow run (waiting at its human gate) also blocks removal.
 const fl=(await api('flows',{projectID:gone.id,name:'Review',steps:[{id:'review',type:'agent',name:'Review',model:'fixture',effort:'low',instructions:'Review'},{id:'accept',type:'human',name:'Accept',instructions:'Check',maxRetries:1,retryFrom:'review'}]})).body;
 const run=await api('workflows',{flowID:fl.id,flowVersion:fl.version,projectID:gone.id,projectVersion:gone.version,task:'Task',acceptance:'Check',mode:'read-only',maxAttempts:1,requestKey:'r1',config:{review:{model:'fixture',effort:'low'}}});assert.equal(run.status,202,JSON.stringify(run.body));
 await until(async()=>(await api('workflows/'+run.body.id)).body.status==='waiting','run waiting');
 const open=await api(`projects/${gone.id}/remove`,{version:gone.version,confirm:true});assert.equal(open.status,409);assert.match(open.body.error,/workflow run in this project is still open/);
 const w=(await api('workflows/'+run.body.id)).body;await api(`workflows/${run.body.id}/action`,{action:'stop',revision:w.revision});await until(async()=>['cancelled','completed'].includes((await api('workflows/'+run.body.id)).body.status),'run cancelled');
 const removed=await api(`projects/${gone.id}/remove`,{version:gone.version,confirm:true});assert.equal(removed.status,200);
 // Gone from state, overview, orchestrator grant and project routes; the other project is untouched.
 assert.deepEqual((await api('state')).body.projects.filter(p=>p.id!=='unassigned').map(p=>p.id),[projects.Keep.id]);
 const overview=await api('agents/overview');assert.equal(overview.status,200);
 assert.deepEqual((await api('coordinator')).body.grant.projectIDs,[projects.Keep.id],'The orchestrator no longer reaches the removed project.');
 assert.equal((await api(`projects/${gone.id}/agent`)).status,404);assert.equal((await api(`projects/${gone.id}/messages`,{text:'x',requestKey:'m2'})).status,404);
 const again=await api('projects',{name:'Gone again',folderPath:path.join(root,'gone')});assert.equal(again.status,409);assert.equal(again.body.removedProjectID,gone.id);
 assert.deepEqual((await api('removed-projects')).body.map(p=>p.id),[gone.id]);
 // Restore brings back the same project and its conversation.
 assert.equal((await api(`removed-projects/${gone.id}/restore`,{})).status,200);
 assert.equal((await api('state')).body.projects.some(p=>p.id===gone.id),true);
 assert.equal((await api(`projects/${gone.id}/messages`)).body.items[0].text,'hello');
 assert.deepEqual((await api('removed-projects')).body,[]);
 assert.deepEqual((await api('coordinator')).body.grant.projectIDs.sort(),[projects.Keep.id,gone.id].sort(),'Restore gives the orchestrator the project back.');
});
