import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,readFileSync,writeFileSync,rmSync,existsSync,readdirSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {AttentionStore,weekdayHours} from '../lib/lifecycle-attention.js';
const repo='a'.repeat(64),other='b'.repeat(64),at=Date.parse('2026-09-23T12:00:00Z');
const record=(id,extra={})=>({id,repositoryKey:repo,revision:1,effectiveState:'working',lastActivityAt:'2026-09-21T12:00:00Z',...extra});
function fixture(t){const directory=mkdtempSync(path.join(tmpdir(),'attention-'));t.after(()=>rmSync(directory,{recursive:true,force:true}));return {directory,store:new AttentionStore(directory,{clock:()=>at})};}
const observations=ids=>({complete:true,overlapComplete:true,activity:Object.fromEntries(ids.map(id=>[id,{state:'idle'}]))});
test('weekday clock counts exact boundaries, weekends, fractional offsets and DST in saved timezone',()=>{
 assert.equal(weekdayHours('2026-09-18T12:00:00Z','2026-09-22T12:00:00Z','UTC'),48);
 assert.equal(weekdayHours('2026-09-19T00:00:00Z','2026-09-21T00:00:00Z','UTC'),0);
 assert.equal(weekdayHours('2026-03-06T17:00:00Z','2026-03-10T16:00:00Z','America/New_York'),48);
 assert.equal(weekdayHours('2026-10-30T16:00:00Z','2026-11-03T17:00:00Z','America/New_York'),48);
 assert.equal(weekdayHours('2026-09-18T18:14:00Z','2026-09-20T18:16:00Z','Asia/Kathmandu'),2/60);
 assert.equal(weekdayHours('2026-09-21T00:00:00Z','2026-09-23T00:00:00Z','UTC'),48);
 assert.throws(()=>weekdayHours('bad',at,'UTC'),/time range/);assert.throws(()=>weekdayHours(at,at,'Mars/Olympus'),/timezone/);
});
test('threshold boundaries are soft, exclude target/retired/verified and qualify partial counts',t=>{
 const {store}=fixture(t),records=[record('one'),record('two',{effectiveState:'blocked'}),record('three'),record('target',{isTarget:true}),record('old',{effectiveState:'retired',attachmentState:'unattached',ownerState:'unknown'}),record('done',{effectiveState:'verified'}),record('foreign',{repositoryKey:other})],obs=observations(records.map(r=>r.id));
 const result=store.evaluate(repo,{records,observations:obs,now:at});assert.equal(result.unfinishedCount,3);assert.equal(result.soft,true);assert.equal(result.items.filter(i=>i.reason==='unfinished-limit').length,1);assert.equal(result.items.filter(i=>i.reason==='inactive').length,3);assert(result.items.every(i=>i.soft));
 assert.equal(store.evaluate(repo,{records:[records[0]],observations:obs,now:at-1}).items.length,0);
 const partial=store.evaluate(repo,{records:[],observations:{...obs,complete:false,unknownCandidates:[{id:'external',revision:1}]},now:at});assert.equal(partial.unfinishedCount,1);assert.equal(partial.countComplete,false);assert(partial.items.some(i=>i.reason==='incomplete-git'));assert(partial.items.some(i=>i.reason==='unknown-ownership'));
});
test('unknown/running activity is never counted as idle; verified retention requires current eligibility',t=>{
 const {store}=fixture(t),records=[record('unknown'),record('running'),record('verified',{effectiveState:'verified',verifiedAt:'2026-09-22T12:00:00Z',retirementEligible:true}),record('stale',{effectiveState:'verified',verifiedAt:'2026-09-01T12:00:00Z',retirementEligible:false})],obs={...observations(['verified','stale']),activity:{verified:'idle',stale:'idle',running:{state:'active'},unknown:{state:'unknown'}}};
 const result=store.evaluate(repo,{records,observations:obs,now:at});assert.equal(result.items.filter(i=>i.reason==='inactive').length,0);assert.equal(result.items.filter(i=>i.reason==='unknown-activity').length,1);assert.deepEqual(result.items.filter(i=>i.reason==='verified-retention').map(i=>i.recordID),['verified']);
 assert.equal(store.evaluate(repo,{records,observations:obs,now:at-1}).items.filter(i=>i.reason==='verified-retention').length,0);
});
test('deduplication and snoozes survive refresh/restart; material revisions and expiry reappear',t=>{
 const {store,directory}=fixture(t),records=[record('one')],obs=observations(['one']),input={records,observations:obs,now:at},initial=store.evaluate(repo,input),item=initial.items.find(i=>i.reason==='inactive');
 assert.equal(existsSync(store.file),false,'Viewing defaults must not persist activity or settings');assert.deepEqual(store.evaluate(repo,input),initial);
 store.snooze(repo,{expectedRevision:0,key:item.key,reason:'Review tomorrow',until:new Date(at+3600000).toISOString()});const bytes=readFileSync(store.file,'utf8');
 assert.equal(store.evaluate(repo,input).items.length,0);assert.equal(store.evaluate(repo,input).snoozed.length,1);assert.equal(readFileSync(store.file,'utf8'),bytes);assert.deepEqual(records,[record('one')]);
 assert.equal(new AttentionStore(directory).evaluate(repo,input).snoozed.length,1);
 assert.equal(store.evaluate(repo,{...input,now:at+3600000}).items.length,1);assert.equal(store.evaluate(repo,{...input,records:[record('one',{revision:2})]}).items.length,1);
 assert.throws(()=>store.snooze(repo,{expectedRevision:0,key:item.key,reason:'stale',until:at+100}),/changed/);
});
test('settings timezone and disabled thresholds recompute without suppressing immediate conditions',t=>{
 const {store}=fixture(t),records=[record('one',{lastActivityAt:'2026-09-18T12:00:00Z'})],obs={...observations(['one']),targetDirty:true,interruptedOperations:[{id:'op',revision:1},{id:'op',revision:1}],overlapComplete:false};
 const now=Date.parse('2026-09-22T12:00:00Z');assert(store.evaluate(repo,{records,observations:obs,now}).items.some(i=>i.reason==='inactive'));
 store.update(repo,{expectedRevision:0,timezone:'America/New_York'});assert.equal(store.evaluate(repo,{records,observations:obs,now:Date.parse('2026-09-21T00:00:00Z')}).items.some(i=>i.reason==='inactive'),false);
 store.update(repo,{expectedRevision:1,unfinishedLimit:0,inactivityDays:0,retentionDays:0});const result=store.evaluate(repo,{records,observations:obs,now});assert.deepEqual(result.items.map(i=>i.reason).sort(),['dirty-target','incomplete-overlap','interrupted-operation']);
 assert.throws(()=>store.update(repo,{expectedRevision:1,timezone:'UTC'}),/changed/);assert.throws(()=>store.update(repo,{expectedRevision:2,inactivityDays:-1}),/Invalid/);assert.throws(()=>store.update(repo,{expectedRevision:2,timezone:'Mars/City'}),/timezone/);assert.throws(()=>store.update(repo,{expectedRevision:2,snoozes:[]}),/request/);
});
test('overlap warnings are bounded, conservative, deduplicated and include incomplete analysis',t=>{
 const {store}=fixture(t),records=[record('one'),record('two')],obs={...observations(['one','two']),overlaps:[{ids:['two','one'],paths:['b.js','a.js'],incomplete:true},{ids:['one','two'],paths:['a.js','b.js'],incomplete:true}]};
 const result=store.evaluate(repo,{records,observations:obs,now:at-1});assert.equal(result.items.filter(i=>i.reason==='overlap').length,1);assert.equal(result.items.filter(i=>i.reason==='incomplete-overlap').length,1);const overlap=result.items.find(i=>i.reason==='overlap');assert.deepEqual(overlap.paths,['a.js','b.js']);assert.match(overlap.message,/does not predict/);
 assert.throws(()=>store.evaluate(repo,{records,observations:{...obs,overlaps:[{ids:['one','two'],paths:Array(1001).fill('x')}]},now:at}),/bounded overlap/);
});
test('settings store rejects corrupt/oversized data, preserves isolation and retains bounded backups',t=>{
 const {store,directory}=fixture(t);for(let i=0;i<8;i++)store.update(repo,{expectedRevision:i,unfinishedLimit:i});assert.equal(readdirSync(store.backups).length,5);assert.equal(store.get(other).revision,0);const value=store.get(repo);value.snoozes.push({});assert.equal(store.get(repo).snoozes.length,0);assert.equal(new AttentionStore(directory).get(repo).revision,8);
 assert.throws(()=>store.update('../escape',{expectedRevision:0}),/identity/);assert.throws(()=>store.snooze(repo,{expectedRevision:8,key:'a'.repeat(64),reason:'',until:at+1000}),/reason/);
 writeFileSync(store.file,'corrupt');assert.throws(()=>new AttentionStore(directory),/damaged/);assert.equal(readFileSync(store.file,'utf8'),'corrupt');
 writeFileSync(store.file,' '.repeat(4*1024*1024+1));assert.throws(()=>new AttentionStore(directory),/4 MiB/);
});
test('changing only the saved timezone recomputes weekday inactivity at the same instant',t=>{
 const {store}=fixture(t),records=[record('one',{lastActivityAt:'2026-09-18T02:00:00Z'})],input={records,observations:observations(['one']),now:Date.parse('2026-09-21T00:00:00Z')};
 store.update(repo,{expectedRevision:0,inactivityDays:1});assert(!store.evaluate(repo,input).items.some(i=>i.reason==='inactive'));
 store.update(repo,{expectedRevision:1,timezone:'America/New_York'});assert(store.evaluate(repo,input).items.some(i=>i.reason==='inactive'));
});
