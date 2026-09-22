import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,writeFileSync,rmSync,realpathSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {collectEvidence,dayInterval,localDate,previousDate,readCommits,SOURCE_LIMIT} from '../lib/briefings.js';

const project={id:'p1'},hours=i=>(Date.parse(i.end)-Date.parse(i.start))/3600000;
const now=Date.parse('2026-09-22T15:00:00Z');
const empty={sessions:()=>[],terminals:()=>[],imports:()=>[],workflows:()=>[],delegations:()=>[],issues:()=>[],commits:()=>[]};

test('day intervals follow the configured timezone across DST transitions',()=>{
 assert.deepEqual(dayInterval('2026-09-21','America/New_York'),{date:'2026-09-21',timezone:'America/New_York',start:'2026-09-21T04:00:00.000Z',end:'2026-09-22T04:00:00.000Z'});
 assert.equal(hours(dayInterval('2026-03-08','America/New_York')),23);
 assert.equal(hours(dayInterval('2026-11-01','America/New_York')),25);
 assert.equal(hours(dayInterval('2026-03-29','Europe/Berlin')),23);
 assert.equal(dayInterval('2026-09-21','UTC').start,'2026-09-21T00:00:00.000Z');
 assert.equal(localDate(Date.parse('2026-09-22T03:30:00Z'),'America/New_York'),'2026-09-21');
 assert.equal(previousDate('2026-03-01'),'2026-02-28');
 assert.throws(()=>dayInterval('2026-02-30','UTC'),/valid date/);
 assert.throws(()=>dayInterval('2026-09-21','Mars/Base'),/timezone/);
});

test('activity includes overlapping records and flags sessions crossing midnight',async()=>{
 const sessions=[
  {id:'inside',projectID:'p1',task:'Fix login',status:'completed',createdAt:'2026-09-21T14:00:00Z',startedAt:'2026-09-21T14:00:00Z',finishedAt:'2026-09-21T15:00:00Z'},
  {id:'crossing',projectID:'p1',task:'Long refactor',status:'completed',createdAt:'2026-09-21T02:00:00Z',startedAt:'2026-09-21T02:00:00Z',finishedAt:'2026-09-21T06:00:00Z'},
  {id:'before',projectID:'p1',task:'Old',status:'completed',createdAt:'2026-09-20T10:00:00Z',finishedAt:'2026-09-20T11:00:00Z'},
  {id:'other',projectID:'p2',task:'Other project',status:'completed',createdAt:'2026-09-21T14:00:00Z',finishedAt:'2026-09-21T15:00:00Z'}];
 const packet=await collectEvidence({project,date:'2026-09-21',timezone:'America/New_York',now,sources:{...empty,sessions:()=>sessions}});
 assert.deepEqual(packet.activity.map(a=>[a.id,a.partial]),[['session:crossing',true],['session:inside',false]]);
 assert.equal(packet.coverage.session.status,'complete');
});

test('workflow children, delegation children and internal briefing runs are not double counted',async()=>{
 const base={projectID:'p1',status:'completed',createdAt:'2026-09-21T14:00:00Z',finishedAt:'2026-09-21T15:00:00Z'};
 const packet=await collectEvidence({project,date:'2026-09-21',timezone:'UTC',now,sources:{...empty,
  sessions:()=>[{...base,id:'user',task:'User run'},{...base,id:'child',task:'Step',workflowID:'w1'},{...base,id:'del',task:'Lane',delegationID:'d1'},{...base,id:'brief',task:'Brief',purpose:'daily-briefing'},{...base,id:'prop',task:'Propose',purpose:'issue-proposal'}],
  workflows:()=>[{...base,id:'w1',task:'Ship it',flow:{name:'Review'}}]}});
 assert.deepEqual(packet.activity.map(a=>a.id).sort(),['session:user','workflow:w1']);
 assert.equal(packet.activity.find(a=>a.kind==='workflow').title,'Review: Ship it');
});

test('open loops come from recent unresolved records only',async()=>{
 const packet=await collectEvidence({project,date:'2026-09-21',timezone:'UTC',now,sources:{...empty,
  sessions:()=>[{id:'failed',projectID:'p1',task:'Broke',status:'failed',createdAt:'2026-09-19T10:00:00Z',finishedAt:'2026-09-19T10:05:00Z'},{id:'ancient',projectID:'p1',task:'Stale',status:'interrupted',createdAt:'2026-08-01T10:00:00Z'},{id:'done',projectID:'p1',task:'Ok',status:'completed',createdAt:'2026-09-20T10:00:00Z'}],
  workflows:()=>[{id:'wf',projectID:'p1',task:'Retry me',status:'interrupted',createdAt:'2026-09-18T10:00:00Z'},{id:'wf2',projectID:'p1',task:'Done',status:'completed',createdAt:'2026-09-18T10:00:00Z'}],
  delegations:()=>[{id:'dl',projectID:'p1',task:'Awaiting',status:'waiting',createdAt:'2026-09-20T10:00:00Z'},{id:'dl2',projectID:'p1',task:'Accepted',status:'accepted',createdAt:'2026-09-20T10:00:00Z'}]}});
 assert.deepEqual(packet.openLoops.map(l=>l.id).sort(),['delegation:dl','session:failed','workflow:wf']);
});

test('empty sources differ from unavailable sources',async()=>{
 const packet=await collectEvidence({project,date:'2026-09-21',timezone:'UTC',now,sources:{sessions:()=>[],workflows:()=>{throw new Error('Workflow store is damaged.');},issues:async()=>{throw new Error('GitHub is unavailable.');}}});
 assert.deepEqual(packet.coverage.session,{status:'complete',count:0,reason:null});
 assert.deepEqual(packet.coverage.workflow,{status:'unavailable',count:0,reason:'Workflow store is damaged.'});
 assert.equal(packet.coverage.terminal.status,'unavailable');
 assert.equal(packet.coverage.issues.reason,'GitHub is unavailable.');
 assert.equal(packet.coverage.commits.status,'unavailable');
});

test('large sources are bounded and marked partial; text is clipped',async()=>{
 const many=Array.from({length:SOURCE_LIMIT+5},(_,i)=>({id:`s${i}`,projectID:'p1',task:'x'.repeat(500),status:'completed',createdAt:'2026-09-21T10:00:00Z',finishedAt:'2026-09-21T11:00:00Z'}));
 const packet=await collectEvidence({project,date:'2026-09-21',timezone:'UTC',now,sources:{...empty,sessions:()=>many,issues:()=>Array.from({length:60},(_,i)=>({number:i+1,title:'Issue',state:'open'}))}});
 assert.equal(packet.activity.length,SOURCE_LIMIT);
 assert.equal(packet.coverage.session.status,'partial');
 assert.equal(packet.coverage.session.count,SOURCE_LIMIT+5);
 assert.equal(packet.activity[0].title.length,200);
 assert.equal(packet.issues.length,SOURCE_LIMIT);
 assert.equal(packet.coverage.issues.status,'partial');
});

function repo(t){
 const root=realpathSync(mkdtempSync(path.join(tmpdir(),'skd-brief-')));t.after(()=>rmSync(root,{recursive:true,force:true}));
 const git=(cwd,env,...args)=>execFileSync('git',['-C',cwd,...args],{encoding:'utf8',env:{...process.env,...env}});
 git(root,{},'init','-q','-b','main');git(root,{},'config','user.name','Fixture');git(root,{},'config','user.email','fixture@example.com');
 let n=0;const commit=(at,subject,folder='.')=>{mkdirSync(path.join(root,folder),{recursive:true});writeFileSync(path.join(root,folder,`f${n++}.txt`),subject);git(root,{},'add','-A');git(root,{GIT_AUTHOR_DATE:at,GIT_COMMITTER_DATE:at},'commit','-q','-m',subject);};
 return {root,commit};
}

test('commit source returns only in-interval commits for the project folder',async t=>{
 const {root,commit}=repo(t),interval=dayInterval('2026-09-21','UTC');
 commit('2026-09-20T23:59:00Z','Before');commit('2026-09-21T09:00:00Z','Inside one');commit('2026-09-21T18:00:00Z','Inside two');commit('2026-09-21T12:00:00Z','Other folder','other');commit('2026-09-22T00:00:00Z','At end');
 assert.deepEqual((await readCommits(root,interval)).map(c=>c.subject),['Other folder','Inside two','Inside one']);
 commit('2026-09-21T10:00:00Z','App change','app');
 assert.deepEqual((await readCommits(path.join(root,'app'),interval)).map(c=>c.subject),['App change']);
 const packet=await collectEvidence({project,date:'2026-09-21',timezone:'UTC',now,sources:{...empty,commits:i=>readCommits(root,i)}});
 assert.equal(packet.coverage.commits.status,'complete');
 assert.ok(packet.activity.every(a=>a.kind==='commit'&&/^commit:[0-9a-f]{40}$/.test(a.id)));
});

test('commit source caps history as partial and reports plain folders as unavailable',async t=>{
 const {root,commit}=repo(t),interval=dayInterval('2026-09-21','UTC');
 for(let i=0;i<5;i++)commit(`2026-09-21T0${i}:00:00Z`,`Commit ${i}`);
 const capped=await readCommits(root,interval,{limit:3});
 assert.equal(capped.length,3);assert.equal(capped.truncated,true);assert.equal(capped[0].subject,'Commit 4');
 const packet=await collectEvidence({project,date:'2026-09-21',timezone:'UTC',now,sources:{...empty,commits:i=>readCommits(root,i,{limit:3})}});
 assert.equal(packet.coverage.commits.status,'partial');
 const plain=realpathSync(mkdtempSync(path.join(tmpdir(),'skd-plain-')));t.after(()=>rmSync(plain,{recursive:true,force:true}));
 const missing=await collectEvidence({project,date:'2026-09-21',timezone:'UTC',now,sources:{...empty,commits:i=>readCommits(plain,i)}});
 assert.deepEqual(missing.coverage.commits,{status:'unavailable',count:0,reason:'This folder is not a Git repository.'});
 const {root:fresh}=repo(t);
 assert.deepEqual(await readCommits(fresh,interval),[]);
});
