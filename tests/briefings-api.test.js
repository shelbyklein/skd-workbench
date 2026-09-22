import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,writeFileSync,readFileSync,rmSync,realpathSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {createServer} from '../server.js';
import {Briefings} from '../lib/briefings.js';

const git=(cwd,env,...args)=>execFileSync('git',['-C',cwd,...args],{encoding:'utf8',env:{...process.env,...env},stdio:['ignore','pipe','pipe']}).trim();
const now=Date.parse('2026-09-22T15:00:00Z');
async function fixture(t,{before}={}){
 const base=realpathSync(mkdtempSync(path.join(tmpdir(),'skd-brief-api-'))),root=path.join(base,'repo'),data=path.join(base,'data');mkdirSync(root);mkdirSync(data);
 git(root,{},'init','-q','-b','main');git(root,{},'config','user.name','Fixture');git(root,{},'config','user.email','fixture@example.invalid');
 writeFileSync(path.join(root,'a.txt'),'a');git(root,{},'add','.');git(root,{GIT_AUTHOR_DATE:'2026-09-21T10:00:00Z',GIT_COMMITTER_DATE:'2026-09-21T10:00:00Z'},'commit','-q','-m','Yesterday work');
 before?.(data);
 const server=createServer({directory:data,githubOptions:{binary:path.join(base,'missing-gh')},briefingOptions:{now:()=>now,timezone:()=>'UTC'}});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 t.after(async()=>{server.shutdownCodex();server.closeAllConnections();await new Promise(r=>server.close(r));rmSync(base,{recursive:true,force:true});});
 const url=`http://127.0.0.1:${server.address().port}`,request=(route,method='GET',body)=>fetch(url+route,{method,headers:body?{'Content-Type':'application/json'}:{},body:body?JSON.stringify(body):undefined});
 const project=await(await request('/api/projects','POST',{name:'Brief fixture',folderPath:root})).json();
 return {data,request,project,route:`/api/projects/${project.id}/briefing`};
}

test('HTTP briefing goes from absent to an evidence-only revision without inference',async t=>{
 const f=await fixture(t);
 const absent=await(await f.request(f.route)).json();
 assert.deepEqual([absent.status,absent.date,absent.timezone,absent.latest],['absent','2026-09-21','UTC',null]);
 const response=await f.request(f.route,'POST',{});assert.equal(response.status,201);
 const made=await response.json();
 assert.equal(made.status,'evidence-only');assert.equal(made.latest.revision,1);
 assert.deepEqual(made.latest.evidence.activity.map(a=>[a.kind,a.title]),[['commit','Yesterday work']]);
 assert.equal(made.latest.evidence.coverage.issues.status,'unavailable');
 assert.equal((await(await f.request('/api/sessions?projectID='+f.project.id)).json()).length,0);
 const home=await(await f.request('/api/briefings')).json();
 const row=home.find(r=>r.projectID===f.project.id);assert.equal(row.briefing.latest.revision,1);assert.equal(row.briefing.date,'2026-09-21');
});

test('HTTP regenerate adds a revision; invalid input keeps the prior revision',async t=>{
 const f=await fixture(t);
 await f.request(f.route,'POST',{});
 const second=await(await f.request(f.route,'POST',{})).json();assert.equal(second.latest.revision,2);
 assert.equal((await f.request(f.route,'POST',{timezone:'Mars/Base'})).status,400);
 assert.equal((await f.request(f.route,'POST',{date:'2026-02-30'})).status,400);
 assert.equal((await f.request(f.route,'POST',{command:'rm'})).status,400);
 const after=await(await f.request(f.route)).json();assert.equal(after.latest.revision,2);assert.equal(after.status,'evidence-only');
 const other=await(await f.request(f.route+'?date=2026-09-20')).json();assert.equal(other.status,'absent');
 const stored=JSON.parse(readFileSync(path.join(f.data,'briefings.json'),'utf8'));assert.equal(stored.schema,1);assert.deepEqual(stored.reports.map(r=>r.revision),[1,2]);
});

test('HTTP concurrent generate requests share one job',async t=>{
 const f=await fixture(t);
 const results=await Promise.all([1,2,3].map(()=>f.request(f.route,'POST',{}).then(r=>r.json())));
 assert.ok(results.every(r=>r.latest.revision===results[0].latest.revision));
 const stored=JSON.parse(readFileSync(path.join(f.data,'briefings.json'),'utf8'));assert.ok(stored.reports.length<=results.length);
});

test('Concurrent generate calls for one scope deduplicate to a single revision',async t=>{
 const dir=mkdtempSync(path.join(tmpdir(),'skd-brief-dedupe-'));t.after(()=>rmSync(dir,{recursive:true,force:true}));
 let release,calls=0;const gate=new Promise(r=>{release=r;});
 const briefings=new Briefings(dir,{now:()=>now,timezone:()=>'UTC',sources:()=>({sessions:async()=>{calls++;await gate;return [];}})});
 const project={id:'p1'},jobs=[briefings.generate(project),briefings.generate(project),briefings.generate(project,{date:'2026-09-21',timezone:'UTC'})];
 release();const views=await Promise.all(jobs);
 assert.equal(calls,1);assert.ok(views.every(v=>v.latest.revision===1));
 assert.equal((await briefings.generate(project)).latest.revision,2);
});

test('HTTP damaged briefing store fails visibly and is not replaced',async t=>{
 const f=await fixture(t,{before:data=>writeFileSync(path.join(data,'briefings.json'),'{not json')});
 const response=await f.request(f.route);assert.equal(response.status,500);assert.match((await response.json()).error,/damaged/);
 assert.equal((await f.request(f.route,'POST',{})).status,500);
 assert.equal((await f.request('/api/briefings')).status,500);
 assert.equal(readFileSync(path.join(f.data,'briefings.json'),'utf8'),'{not json');
 assert.equal((await f.request('/api/health')).status,200);
});
