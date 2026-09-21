import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { Store } from '../lib/store.js';
function fixture(t){const dir=mkdtempSync(path.join(tmpdir(),'flow-store-'));t.after(()=>rmSync(dir,{recursive:true,force:true}));return {dir,store:new Store(dir)};}
test('flows persist, revisions reject stale saves without losing data',t=>{
 const {dir,store}=fixture(t);const flow=store.createFlow({name:'Empty',steps:[]});
 const saved=store.updateFlow(flow.id,{...flow,name:'Changed'});
 assert.equal(saved.version,2);
 assert.throws(()=>store.updateFlow(flow.id,{...flow,name:'Stale'}),/another tab/);
 assert.equal(new Store(dir).snapshot().flows.at(-1).name,'Changed');
});
test('invalid review return targets reject the save atomically',t=>{
 const {store}=fixture(t);const f=store.snapshot().flows[0];f.steps.reverse();
 assert.throws(()=>store.updateFlow(f.id,f),/earlier agent/);
 assert.equal(store.snapshot().flows[0].version,1);
});
test('corrupt data stops startup without overwriting file',t=>{
 const {dir}=fixture(t);const file=path.join(dir,'store.json');writeFileSync(file,'broken');
 assert.throws(()=>new Store(dir));assert.equal(readFileSync(file,'utf8'),'broken');
});
test('run settings persist with model edits and shared benchmark task; stale or invalid saves are atomic',t=>{
 const {dir,store}=fixture(t);let project=store.createProject({name:'Benchmark',folderPath:dir});project=store.setBenchmark(project.id,project.version,{commit:'fixture'});
 let flow=store.createFlow({name:'Builder',projectID:project.id,steps:[{id:'build',type:'agent',name:'Build',instructions:'Implement',model:'old',effort:'low'}]});
 const settings={task:'Shared task',acceptance:'Check result',mode:'worktree',maxAttempts:4};const input={version:flow.version,projectVersion:project.version,settings,config:{build:{model:'fixture',effort:'high'}}};
 const saved=store.saveRunSettings(flow.id,input);assert.equal(saved.flow.steps[0].model,'fixture');assert.equal(saved.project.benchmarkTask.task,'Shared task');assert.equal(new Store(dir).snapshot().flows.at(-1).runSettings.maxAttempts,4);
 assert.throws(()=>store.saveRunSettings(flow.id,input),/changed/);const before=store.snapshot();assert.throws(()=>store.saveRunSettings(flow.id,{...input,version:saved.flow.version,projectVersion:saved.project.version,settings:{...settings,maxAttempts:0}}),/1–60/);assert.deepEqual(store.snapshot(),before);
 const renamed=store.updateFlow(flow.id,{...saved.flow,name:'Renamed'});assert.deepEqual(renamed.runSettings,settings);const p=store.updateProject(project.id,{...saved.project,name:'Renamed project'});assert.equal(p.benchmarkTask.task,'Shared task');
});
