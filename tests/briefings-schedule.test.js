import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync,readFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {Briefings} from '../lib/briefings.js';
import {Problem} from '../lib/domain.js';

const projects=[{id:'p1',name:'One',folderPath:'/tmp/one'},{id:'p2',name:'Two',folderPath:'/tmp/two'},{id:'unassigned',name:'Unassigned'},{id:'p3',name:'No folder'}];
const at=value=>Date.parse(value);
function fixture(t,{dir=mkdtempSync(path.join(tmpdir(),'skd-brief-sched-')),clock={value:at('2026-09-22T07:59:00Z')}}={}){
 t.after(()=>rmSync(dir,{recursive:true,force:true}));
 const executor={busy:false,starts:[],onFinish:()=>{},start:async(input,project)=>{if(executor.busy)throw new Problem('Another agent session is already running.',409);executor.busy=true;const run={id:`run-${executor.starts.length+1}`};executor.starts.push({...input,projectID:project.id,runID:run.id});return run;},get:id=>({id,status:'running'})};
 const sources=project=>({sessions:()=>[{id:`s-${project.id}`,projectID:project.id,task:'Work',status:'completed',createdAt:'2026-09-21T10:00:00Z',finishedAt:'2026-09-21T11:00:00Z'}]});
 const make=()=>new Briefings(dir,{executor,projects:()=>projects,sources,now:()=>clock.value,timezone:()=>'UTC',retryMs:10});
 return {dir,clock,executor,make,briefings:make()};
}
const enable=(b,extra={})=>b.saveSchedule({version:b.getSchedule().version,enabled:true,time:'08:00',timezone:'UTC',agent:'codex',model:'fixture',effort:'low',...extra});

test('schedule is off by default and a disabled schedule starts nothing',async t=>{
 const f=fixture(t),schedule=f.briefings.getSchedule();
 assert.equal(schedule.enabled,false);assert.equal(schedule.serverTimezone,'UTC');
 f.clock.value=at('2026-09-22T12:00:00Z');assert.equal(await f.briefings.tick(),null);assert.equal(f.executor.starts.length,0);f.briefings.close();
});

test('an enabled schedule runs one batch after the configured local time',async t=>{
 const f=fixture(t);enable(f.briefings);await new Promise(r=>setTimeout(r,5));
 assert.equal(await f.briefings.tick(),null);assert.equal(f.executor.starts.length,0);
 f.clock.value=at('2026-09-22T08:00:00Z');
 assert.deepEqual(await f.briefings.tick(),{date:'2026-09-21',projects:['p1','p2']});
 assert.equal(f.executor.starts.length,1,'provider runs are serialized');
 assert.deepEqual(f.briefings.view(projects[1],{date:'2026-09-21'}).status,'queued');
 f.clock.value=at('2026-09-22T20:00:00Z');assert.equal(await f.briefings.tick(),null);
 assert.equal(JSON.parse(readFileSync(path.join(f.dir,'briefings.json'),'utf8')).schedule.lastBatchDate,'2026-09-22');
 f.briefings.close();
});

test('schedule time follows the configured timezone',async t=>{
 const f=fixture(t);enable(f.briefings,{timezone:'America/New_York'});
 f.clock.value=at('2026-09-22T11:59:00Z');assert.equal(await f.briefings.tick(),null);
 f.clock.value=at('2026-09-22T12:00:00Z');assert.equal((await f.briefings.tick()).date,'2026-09-21');f.briefings.close();
});

test('restart after the time generates only today and never replays missed days',async t=>{
 const f=fixture(t);enable(f.briefings);f.briefings.schedule.lastBatchDate='2026-09-18';f.briefings.persist();f.briefings.close();
 f.clock.value=at('2026-09-22T15:00:00Z');
 const restarted=f.make();const result=await restarted.start();
 assert.deepEqual(result,{date:'2026-09-21',projects:['p1','p2']});
 assert.ok(restarted.reports.every(r=>r.date==='2026-09-21'));
 restarted.close();
 const again=f.make();assert.equal(await again.start(),null,'the same day is not repeated after another restart');again.close();
});

test('active user execution defers the batch instead of failing it',async t=>{
 const f=fixture(t);enable(f.briefings);f.executor.busy=true;f.clock.value=at('2026-09-22T09:00:00Z');
 await f.briefings.tick();
 assert.equal(f.executor.starts.length,0);
 assert.deepEqual(projects.slice(0,2).map(p=>f.briefings.view(p,{date:'2026-09-21'}).status),['queued','queued']);
 f.executor.busy=false;await new Promise(r=>setTimeout(r,50));
 assert.equal(f.executor.starts.length,1);assert.equal(f.briefings.view(projects[0],{date:'2026-09-21'}).status,'generating');
 f.briefings.close();
});

test('schedule saves validate input and reject stale versions',t=>{
 const f=fixture(t),version=f.briefings.getSchedule().version;
 assert.throws(()=>f.briefings.saveSchedule({version,enabled:true,time:'08:00',timezone:null,agent:'codex',model:null,effort:null}),/model and effort/);
 assert.throws(()=>f.briefings.saveSchedule({version,enabled:false,time:'25:00',timezone:null,agent:'codex',model:null,effort:null}),/HH:MM/);
 assert.throws(()=>f.briefings.saveSchedule({version,enabled:false,time:'08:00',timezone:'Mars/Base',agent:'codex',model:null,effort:null}),/timezone/);
 const saved=f.briefings.saveSchedule({version,enabled:false,time:'07:30',timezone:null,agent:'claude',model:'m',effort:'low'});assert.equal(saved.version,version+1);
 assert.throws(()=>f.briefings.saveSchedule({...saved,version}),e=>e.status===409);
 f.briefings.close();
});
