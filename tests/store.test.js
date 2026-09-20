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
