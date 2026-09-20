import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { Store } from '../lib/store.js';
function fixture(t){const dir=mkdtempSync(path.join(tmpdir(),'flow-run-'));t.after(()=>rmSync(dir,{recursive:true,force:true}));const store=new Store(dir);const f=store.snapshot().flows[0];return {dir,store,f,run:store.createRun({flowID:f.id,flowVersion:f.version,task:'Fix search',acceptance:'Empty query returns all entries.'})};}
test('run freezes flow and persists across restart',t=>{
 const {dir,store,f,run}=fixture(t);f.steps[0].model='another-model';store.updateFlow(f.id,f);
 const saved=new Store(dir).snapshot().runs[0];assert.notEqual(saved.flow.steps[0].model,'another-model');assert.equal(saved.flow.version,1);assert.equal(saved.id,run.id);assert.equal(saved.usage.costUSD,null);
});
test('human review pauses and bounded retries retain all attempts',t=>{
 const {store,run}=fixture(t);let r=store.transition(run.id,{revision:0,action:'advance'});assert.equal(r.status,'waiting');
 assert.throws(()=>store.transition(r.id,{revision:r.revision,action:'advance'}),/needs your review/);
 assert.throws(()=>store.transition(r.id,{revision:r.revision,action:'changes',note:''}),/required/);
 for(let i=0;i<2;i++){
 r=store.transition(r.id,{revision:r.revision,action:'changes',note:'Add edge checks'});assert.equal(r.cursor,0);
 r=store.transition(r.id,{revision:r.revision,action:'advance'});assert.equal(r.status,'waiting');assert.match(r.attempts.at(-1).output,/Add edge checks/);
 }
 assert.throws(()=>store.transition(r.id,{revision:r.revision,action:'changes',note:'One more'}),/used its change requests/);
 assert.equal(r.attempts.length,5);
 while(!['completed','cancelled'].includes(r.status))r=store.transition(r.id,{revision:r.revision,action:r.status==='waiting'?'approve':'advance'});
 assert.equal(r.status,'completed');assert.ok(r.finishedAt);assert.equal(r.usage.inputTokens,null);
 assert.throws(()=>store.transition(r.id,{revision:r.revision,action:'advance'}),/has ended/);
});
test('stale actions and cancellations cannot advance twice',t=>{
 const {store,run}=fixture(t);store.transition(run.id,{revision:0,action:'advance'});
 assert.throws(()=>store.transition(run.id,{revision:0,action:'advance'}),/another tab/);
 const r=store.transition(run.id,{revision:1,action:'cancel'});assert.equal(r.status,'cancelled');assert.equal(r.attempts.length,1);
 assert.throws(()=>store.transition(run.id,{revision:r.revision,action:'approve'}),/has ended/);
});
test('empty flows cannot run and deleted flows retain historical runs',t=>{
 const {store,run,f}=fixture(t);const empty=store.createFlow({name:'Empty',steps:[]});
 assert.throws(()=>store.createRun({flowID:empty.id,flowVersion:1,task:'Task'}),/at least one step/);
 store.deleteFlow(f.id,f.version);assert.equal(store.snapshot().runs[0].flow.id,run.flow.id);
});
