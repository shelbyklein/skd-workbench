import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,readFileSync,writeFileSync,existsSync,statSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {AgentProfiles} from '../lib/playbooks.js';
import {Mandates} from '../lib/mandates.js';
import {createServer} from '../server.js';
const project={id:'p',name:'P',version:1,folderPath:'/tmp'},other={id:'q',name:'Q',version:1,folderPath:'/var'};
const flows=[{id:'f',projectID:'p'},{id:'g',projectID:'q'}];
async function fixture(){
 const dir=mkdtempSync(path.join(tmpdir(),'skd-mandates-')),playbooks=new AgentProfiles(dir);
 const owner=await playbooks.create({revision:0,name:'Newton owner',scope:{kind:'project',projectID:'p'},providers:['codex'],systemPrompt:'Own Newton.',skillIDs:[],connectionIDs:[]},[project,other]);
 const foreign=await playbooks.create({revision:1,name:'Other owner',scope:{kind:'project',projectID:'q'},providers:['codex'],systemPrompt:'Own Q.',skillIDs:[],connectionIDs:[]},[project,other]);
 const mandates=new Mandates(dir,{playbooks,projects:()=>[project,other],flows:()=>flows});
 return {dir,playbooks,owner,foreign,mandates};
}
const input=(owner,extra={})=>({version:0,enabled:false,agentProfile:{id:owner.id},objective:'Ship the pilot.',tasks:[{ref:'github:shelbyklein/skd-workbench#14',title:'Pilot'}],workflowIDs:['f'],modes:['read-only'],escalation:'Ask before worktree changes.',instructions:'Changes and tests allowed.',limits:{maxAttempts:3,maxRuntimeMinutes:30},report:{detail:'summary'},...extra});

test('mandates default off, pin the owner profile and keep revision history',async t=>{
 const f=await fixture();t.after(()=>rmSync(f.dir,{recursive:true,force:true}));
 assert.deepEqual(f.mandates.view(project),{mandate:null,profile:null});
 const first=f.mandates.save(project,input(f.owner));
 assert.equal(first.version,1);assert.equal(first.enabled,false);assert.deepEqual(first.agentProfile,{id:f.owner.id,version:1});assert.equal(first.updatedBy,'user');assert.deepEqual(first.history,[]);
 assert(!JSON.stringify(first).includes('Own Newton.'),'Owner prompt is referenced, not copied.');
 assert.equal(statSync(f.mandates.file).mode&0o777,0o600);
 const second=f.mandates.save(project,input(f.owner,{version:1,enabled:true}));
 assert.equal(second.version,2);assert.equal(second.enabled,true);assert.equal(second.id,first.id);assert.equal(second.history.length,1);assert.equal(second.history[0].version,1);assert.equal(second.history[0].enabled,false);
 assert(existsSync(f.mandates.file+'.bak'));
 assert.throws(()=>f.mandates.save(project,input(f.owner,{version:1})),e=>e.status===409&&/another tab/.test(e.message));
 const reloaded=new Mandates(f.dir,{playbooks:f.playbooks,projects:()=>[project],flows:()=>flows});assert.deepEqual(reloaded.get('p'),second);
 const paused=f.mandates.save(project,input(f.owner,{version:2,enabled:false}));assert.equal(paused.enabled,false);assert.equal(paused.history.length,2);
});

test('mandate input is bounded and scoped to the project',async t=>{
 const f=await fixture();t.after(()=>rmSync(f.dir,{recursive:true,force:true}));
 const reject=(value,pattern,status=400)=>assert.throws(()=>f.mandates.save(project,value),e=>e.status===status&&pattern.test(e.message));
 reject({...input(f.owner),grant:'push'},/Unknown mandate setting/);
 reject(input(f.foreign),/outside this project/);
 reject(input(f.owner,{agentProfile:{id:f.owner.id,version:9}}),/changed after/,409);
 reject(input(f.owner,{workflowIDs:['g']}),/another project/,409);
 reject(input(f.owner,{modes:['merge']}),/workspace modes/);
 reject(input(f.owner,{tasks:[{ref:'https://evil.example/14'}]}),/github:owner\/repo#number/);
 reject(input(f.owner,{tasks:[{ref:'local:a'},{ref:'local:a'}]}),/once/);
 reject(input(f.owner,{tasks:Array.from({length:51},(_,i)=>({ref:'local:t'+i}))}),/at most 50/);
 reject(input(f.owner,{objective:'x'.repeat(4097)}),/Objective/);
 reject(input(f.owner,{objective:'  '}),/Objective is required/);
 reject(input(f.owner,{limits:{maxAttempts:61,maxRuntimeMinutes:30}}),/Attempt limit/);
 reject(input(f.owner,{limits:{maxAttempts:1,maxRuntimeMinutes:0}}),/Runtime limit/);
 reject(input(f.owner,{enabled:true,tasks:[]}),/active mandate needs/);
 assert.throws(()=>f.mandates.save({id:'unassigned',folderPath:null},input(f.owner)),/Connect a project folder/);
 assert.equal(f.mandates.data.revision,0,'Rejected input writes nothing.');assert(!existsSync(f.mandates.file));
 await f.playbooks.archive(f.owner.id,{revision:2,version:1,archived:true});reject(input(f.owner),/archived/);
});

test('owner profile drift is visible and corrupt stores fail startup',async t=>{
 const f=await fixture();t.after(()=>rmSync(f.dir,{recursive:true,force:true}));
 f.mandates.save(project,input(f.owner));
 await f.playbooks.update(f.owner.id,{revision:2,version:1,name:'Renamed owner',scope:{kind:'project',projectID:'p'},providers:['codex'],skillIDs:[],connectionIDs:[]},[project]);
 assert.equal(f.mandates.view(project).profile.status,'changed');
 const options={playbooks:f.playbooks,projects:()=>[project],flows:()=>flows};
 for(const damaged of ['{not json','{}',JSON.stringify({schema:1,revision:0,mandates:[{id:'x',projectID:'p'}]}),JSON.stringify({schema:2,revision:0,mandates:[]})]){
  writeFileSync(f.mandates.file,damaged);assert.throws(()=>new Mandates(f.dir,options),/Damaged project mandates/);
  assert.equal(readFileSync(f.mandates.file,'utf8'),damaged,'Corrupt data is left for inspection, not replaced.');
 }
});

test('HTTP save starts nothing; controllers read but cannot change mandates',async t=>{
 const root=mkdtempSync(path.join(tmpdir(),'skd-mandate-api-')),repo=path.join(root,'repo');mkdirSync(repo);
 let spawned=0;const server=createServer({directory:path.join(root,'data'),codexOptions:{discover:async()=>({version:'fixture',models:[{id:'fixture',efforts:['low']}]}),spawnProcess:()=>{spawned++;throw Error('No execution in mandate tests');}}});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const url='http://127.0.0.1:'+server.address().port;
 t.after(async()=>{server.shutdownCodex();await new Promise(r=>server.close(r));rmSync(root,{recursive:true,force:true});});
 const api=async(route,method='GET',value,token)=>{const res=await fetch(url+'/api/'+route,{method,headers:{'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{})},...(value?{body:JSON.stringify(value)}:{})});return {status:res.status,body:await res.json()};};
 const p=(await api('projects','POST',{name:'Pilot',folderPath:repo})).body;
 const flow=(await api('flows','POST',{projectID:p.id,name:'Review',steps:[{id:'review',type:'agent',name:'Review',model:'fixture',effort:'low',instructions:'Review'}]})).body;
 const owner=(await api('agent-profiles','POST',{revision:0,name:'Pilot owner',scope:{kind:'project',projectID:p.id},providers:['codex'],systemPrompt:'Own the pilot.',skillIDs:[],connectionIDs:[]})).body;
 assert.deepEqual((await api('projects/'+p.id+'/mandate')).body,{mandate:null,profile:null});
 const saved=await api('projects/'+p.id+'/mandate','PUT',{...input(owner),workflowIDs:[flow.id],enabled:true});
 assert.equal(saved.status,200,JSON.stringify(saved.body));assert.equal(saved.body.enabled,true);
 assert.equal((await api('projects/'+p.id+'/mandate','PUT',{...input(owner),workflowIDs:[flow.id]})).status,409);
 assert.equal((await api('projects/'+p.id+'/mandate','PUT',{...input(owner),version:1,workflowIDs:[flow.id],objective:'x'.repeat(70*1024)})).status,413);
 assert.equal((await api('workflows?projectID='+p.id)).body.length,0);assert.equal((await api('sessions?projectID='+p.id)).body.length,0);assert.equal(spawned,0);
 const setup=(await api('controllers','POST',{name:'Coordinator',projectIDs:[p.id],capabilities:['read','manage','run']})).body;const {token}=JSON.parse(readFileSync(setup.credentialPath));
 const read=await api('controller/call','POST',{name:'get_project_mandate',arguments:{projectID:p.id}},token);
 assert.equal(read.status,200);assert.equal(read.body.mandate.version,1);assert.equal(read.body.mandate.history,undefined);assert.equal(read.body.profile.status,'ready');
 for(const name of ['update_project_mandate','save_project_mandate'])assert.equal((await api('controller/call','POST',{name,arguments:{projectID:p.id}},token)).status,404);
 const outside=(await api('projects','POST',{name:'Outside',folderPath:root})).body;
 assert.equal((await api('controller/call','POST',{name:'get_project_mandate',arguments:{projectID:outside.id}},token)).status,403);
 assert.equal((await api('projects/'+p.id+'/mandate')).body.mandate.version,1,'Controller calls did not change the mandate.');
});
