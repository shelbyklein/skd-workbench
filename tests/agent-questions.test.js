import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import path from 'node:path';import {tmpdir} from 'node:os';
import {ProjectThreads,COORDINATOR} from '../lib/project-threads.js';
import {CoordinatorAgent} from '../lib/coordinator-agent.js';
const delay=ms=>new Promise(r=>setTimeout(r,ms));
test('agent questions and action requests stay open until the person replies; updates never do',async t=>{
 const dir=mkdtempSync(path.join(tmpdir(),'skd-agent-questions-'));t.after(()=>rmSync(dir,{recursive:true,force:true}));
 const projects=[{id:'p1',name:'Tiny Tasks',folderPath:dir},{id:'p2',name:'Newton',folderPath:dir}];
 const threads=new ProjectThreads(dir,{projects:()=>projects});
 const agent=new CoordinatorAgent(dir,{threads,controllers:{},projects:()=>projects,executor:{},sessions:{paste:()=>false,shutdown(){}}});
 const controller={id:'c1',name:'agent'};
 agent.reportToOrchestrator(projects[0],'update','Done: footer','u1',controller);
 assert.deepEqual(agent.openQuestions(),[],'Updates are not alerts.');
 await delay(5);agent.reportToOrchestrator(projects[0],'question','Toggle or tab?','q1',controller);
 await delay(5);agent.reportToOrchestrator(projects[1],'action','Approve the deploy','a1',controller);
 let open=agent.openQuestions();assert.deepEqual(open.map(o=>[o.projectName,o.title,o.detail]),[['Tiny Tasks','Agent asks','Toggle or tab?'],['Newton','Agent needs an action','Approve the deploy']]);
 assert.deepEqual(agent.openQuestions('p2').map(o=>o.projectID),['p2'],'Project pages see only their own.');
 // A reply in that project's conversation clears its question; a later orchestrator message clears everything older.
 await delay(5);threads.post(projects[0],{author:'user',text:'Toggle',requestKey:'r1'});
 assert.deepEqual(agent.openQuestions().map(o=>o.projectID),['p2']);
 await delay(5);threads.post({id:COORDINATOR},{author:'user',text:'Deploy approved',requestKey:'r2'});
 assert.deepEqual(agent.openQuestions(),[]);
 // A newer question after the reply is open again.
 await delay(5);agent.reportToOrchestrator(projects[0],'question','Ship it?','q2',controller);
 assert.deepEqual(agent.openQuestions().map(o=>o.detail),['Ship it?']);
});

test('the project timeline merges agent reports and the project conversation, newest first, and filters by issue',async t=>{
 const dir=mkdtempSync(path.join(tmpdir(),'skd-timeline-'));t.after(()=>rmSync(dir,{recursive:true,force:true}));
 const projects=[{id:'p1',name:'Tiny Tasks',folderPath:dir},{id:'p2',name:'Newton',folderPath:dir}];
 const threads=new ProjectThreads(dir,{projects:()=>projects});
 const agent=new CoordinatorAgent(dir,{threads,controllers:{},projects:()=>projects,executor:{},sessions:{paste:()=>false,shutdown(){}}});
 const c={id:'c1',name:'agent'};
 threads.post(projects[0],{author:'agent',text:'From the orchestrator: Work on #3 filters',requestKey:'o1',controller:{id:'o',name:'Orchestrator'}});await delay(5);
 agent.reportToOrchestrator(projects[0],'update','Started #3: selectTasks skeleton','u1',c);await delay(5);
 agent.reportToOrchestrator(projects[0],'question','For #3, toggle or tab?','q1',c);await delay(5);
 agent.reportToOrchestrator(projects[1],'update','Newton only','n1',c);await delay(5);
 agent.reportToOrchestrator(projects[0],'update','Refactored #30 styles','u2',c);await delay(5);
 threads.post(projects[0],{author:'user',text:'Toggle for #3',requestKey:'r1'});
 const all=agent.projectTimeline('p1');
 assert.deepEqual(all.map(e=>[e.kind,e.who]),[['you','You'],['update','Tiny Tasks agent'],['question','Tiny Tasks agent'],['update','Tiny Tasks agent'],['request','Orchestrator']],'Newest first; other projects excluded.');
 assert.equal(all.find(e=>e.kind==='question').answered,true);assert.equal(all.at(-1).text,'Work on #3 filters');
 assert.deepEqual(agent.projectTimeline('p1',{issue:3}).map(e=>e.text),['Toggle for #3','For #3, toggle or tab?','Started #3: selectTasks skeleton','Work on #3 filters'],'#30 does not match #3.');
});
