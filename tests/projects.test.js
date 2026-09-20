import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync, readFileSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { Store } from '../lib/store.js';
import { seedFlows, createRun } from '../lib/domain.js';
const fixture=t=>{const dir=mkdtempSync(path.join(tmpdir(),'skd-project-'));t.after(()=>rmSync(dir,{recursive:true,force:true}));return dir;};
test('schema 1 migration backs up exact bytes and preserves original run snapshot and history',t=>{
 const dir=fixture(t),flows=seedFlows(),runs=[createRun(flows[0],{flowVersion:1,task:'Legacy task'})];
 const original=JSON.stringify({schema:1,flows,runs});writeFileSync(path.join(dir,'store.json'),original);
 const store=new Store(dir),d=store.snapshot();assert.equal(d.schema,2);assert.equal(d.flows.length,flows.length);
 assert.equal(d.flows[0].projectID,'unassigned');assert.deepEqual(d.runs[0].flow,runs[0].flow);assert.equal(d.runs[0].sourceContext,null);
 const backup=readdirSync(dir).find(n=>n.endsWith('.backup.json'));assert.equal(readFileSync(path.join(dir,backup),'utf8'),original);
 assert.deepEqual(new Store(dir).snapshot(),d);assert.equal(readdirSync(dir).filter(n=>n.endsWith('.backup.json')).length,1);
});
test('moving a workflow changes its scope and version without changing historical runs',t=>{
 const store=new Store(fixture(t)),f=store.snapshot().flows[0];const r=store.createRun({flowID:f.id,flowVersion:1,task:'Before move'});
 const p=store.createProject({name:'Project',folderPath:'/tmp/project'});
 const moved=store.updateFlow(f.id,{...f,projectID:p.id});assert.equal(moved.version,2);assert.equal(moved.projectID,p.id);
 const historical=store.snapshot().runs[0];assert.equal(historical.projectID,'unassigned');assert.deepEqual(historical,r);
 assert.throws(()=>store.createFlow({name:'Invalid project',steps:[],projectID:'missing'}),/Project not found/);
});
test('project updates protect concurrent changes and original run project identity',t=>{
 const store=new Store(fixture(t)),p=store.createProject({name:'Project',folderPath:'/tmp/project'});
 const f=store.createFlow({...store.snapshot().flows[0],projectID:p.id});
 const source={folderPath:p.folderPath,available:true,git:{root:p.folderPath,commit:'abc',dirty:false}};
 const r=store.createRun({flowID:f.id,flowVersion:1,task:'Inspect'},source,p.version);
 store.updateProject(p.id,{...p,name:'Renamed'});
 assert.throws(()=>store.updateProject(p.id,{...p,name:'Stale'}),/another tab/);
 assert.throws(()=>store.createRun({flowID:f.id,flowVersion:1,task:'Inspect'},source,p.version),/connection changed/);
 assert.equal(store.snapshot().runs[0].projectSnapshot.name,'Project');assert.equal(r.sourceContext.git.commit,'abc');
 assert.throws(()=>store.updateProject('unassigned',{name:'No',folderPath:'/tmp'}),/cannot be edited/);
 assert.throws(()=>store.createProject({name:'Duplicate',folderPath:'/tmp/project'}),/already connected/);
});

test('comparison keys distinguish projects, commits and dirty state but not a project rename',t=>{
 const store=new Store(fixture(t));const a=store.createProject({name:'A',folderPath:'/tmp/a'}),b=store.createProject({name:'B',folderPath:'/tmp/b'});
 const f=store.createFlow({...store.snapshot().flows[0],projectID:a.id});
 const source={folderPath:a.folderPath,available:true,git:{root:a.folderPath,commit:'abc',dirty:false}};
 const input={flowID:f.id,flowVersion:f.version,task:'Same',acceptance:'Same checks'};
 const r1=store.createRun(input,source,a.version);
 const renamed=store.updateProject(a.id,{...a,name:'New A'});const r2=store.createRun(input,source,renamed.version);assert.equal(r1.comparisonKey,r2.comparisonKey);
 const r3=store.createRun(input,{...source,git:{...source.git,dirty:true}},renamed.version);assert.notEqual(r3.comparisonKey,r2.comparisonKey);
 const r4=store.createRun(input,{...source,git:{...source.git,commit:'def'}},renamed.version);assert.notEqual(r4.comparisonKey,r2.comparisonKey);
 const moved=store.updateFlow(f.id,{...f,projectID:b.id});const r5=store.createRun({...input,flowVersion:moved.version},{...source,folderPath:b.folderPath},b.version);assert.notEqual(r5.comparisonKey,r2.comparisonKey);
});
