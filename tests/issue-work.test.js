import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {IssueWork,issueSourceHash,parseIssueWorkSignal} from '../lib/issue-work.js';

const base={repository:'owner/repo',id:42,number:7,title:'Build it',body:'Do the work.',state:'open',updatedAt:'2026-09-21T00:00:00Z'};
const models={codex:{version:'fixture',models:[{id:'gpt-5.6-sol',name:'Sol',efforts:['low','high']}]},claude:{version:'fixture',models:[{id:'sonnet',efforts:['medium']}]}};
function setup(t){
 const directory=mkdtempSync(path.join(tmpdir(),'skd-issue-work-')),state={issue:structuredClone(base),starts:[]};
 const github={repository:async()=>state.issue.repository,issue:async()=>structuredClone(state.issue)};
 const terminals={start:async(input,project)=>{state.starts.push({input,project});return {id:'terminal-1',status:'running'};},get:()=>({id:'terminal-1',status:'running'})};
 const work=new IssueWork(directory,{github,terminals,providers:async agent=>models[agent]});
 const project={id:'project',name:'Project',folderPath:'/tmp/project',version:3};t.after(()=>rmSync(directory,{recursive:true,force:true}));return {work,state,project};
}
const settings={agent:'codex',model:'gpt-5.6-sol',effort:'high',orchestration:false};
const graph={tasks:[{id:'one',instructions:'Implement it.',acceptance:'Tests pass.',dependencies:[]}]};

test('issue signal is parsed as unverified and cannot claim plan approval',async t=>{
 const f=setup(t);f.state.issue.body+='\n<!-- skd-workbench-work-settings {"agent":"codex","model":"gpt-5.6-sol","effort":"high","orchestration":false} -->';
 const r=await f.work.resolve(f.project,7);assert.deepEqual(r.signal,settings);assert.equal(r.origin,'unverified_issue_signal');assert.equal(r.readiness,'unverified');assert.equal(r.approval,null);
 assert.equal(parseIssueWorkSignal('<!-- skd-workbench-work-settings {"agent":"codex"} -->'),null);
});

test('approval is bound to exact server-recorded plan and issue hashes',async t=>{
 const f=setup(t),source=await f.work.source(f.project,7),plan=f.work.recordPlan(f.project,source,{schema:1,planID:'plan-1',version:1,settings,graph,planningRunID:'run-1',provider:'codex',requestedModel:'gpt-5.6-sol',requestedEffort:'high'});
 let r=await f.work.resolve(f.project,7);assert.equal(r.readiness,'needs_review');assert.equal(r.canStartOrchestration,false);
 f.work.approvePlan(plan.planID,plan.version,source.sourceHash,'Approved this exact plan.');r=await f.work.resolve(f.project,7,{validate:true});assert.equal(r.readiness,'approved');assert.equal(r.origin,'approved_plan');assert.equal(r.provider.model.id,'gpt-5.6-sol');
 f.state.issue.body='Changed';r=await f.work.resolve(f.project,7);assert.equal(r.readiness,'stale');assert.equal(r.approval,null);assert.equal(r.defaults,null);assert.notEqual(issueSourceHash({...f.state.issue}),source.sourceHash);
});

test('overrides validate provider support, reset to plan, and gate orchestration on a graph',async t=>{
 const f=setup(t),source=await f.work.source(f.project,7),plan=f.work.recordPlan(f.project,source,{schema:1,planID:'plan-1',version:1,settings,graph});f.work.approvePlan(plan.planID,1,source.sourceHash,'Approved.');
 let r=await f.work.saveSettings(f.project,7,{action:'save',sourceHash:source.sourceHash,settings:{...settings,effort:'low'}});assert.equal(r.origin,'override');assert.equal(r.effective.effort,'low');
 await assert.rejects(f.work.saveSettings(f.project,7,{action:'save',sourceHash:source.sourceHash,settings:{...settings,model:'missing'}}),/unavailable/);
 r=await f.work.saveSettings(f.project,7,{action:'reset',sourceHash:source.sourceHash});assert.equal(r.origin,'approved_plan');assert.equal(r.effective.effort,'high');
 const g=setup(t),s=await g.work.source(g.project,7);await assert.rejects(g.work.saveSettings(g.project,7,{action:'save',sourceHash:s.sourceHash,settings:{...settings,orchestration:true}}),/approved executable plan/);
});

test('directed solo launch freezes context and a request key launches once',async t=>{
 const f=setup(t),source=await f.work.source(f.project,7);await f.work.saveSettings(f.project,7,{action:'save',sourceHash:source.sourceHash,settings});
 const input={requestKey:'launch-12345678',sourceHash:source.sourceHash,instruction:'Keep the public API stable.'},first=await f.work.startSolo(f.project,7,input),second=await f.work.startSolo(f.project,7,input);
 assert.equal(first.id,second.id);assert.equal(f.state.starts.length,1);assert.match(f.state.starts[0].input.initialPrompt,/owner\/repo#7/);assert.match(f.state.starts[0].input.initialPrompt,/Keep the public API stable/);assert.equal(f.state.starts[0].input.model,'gpt-5.6-sol');
 await assert.rejects(f.work.startSolo(f.project,7,{...input,instruction:'Different'}),/already used/);
 f.state.issue.title='Changed after launch';assert.equal(f.work.getRun(first.id,f.project).source.title,'Build it');
});
