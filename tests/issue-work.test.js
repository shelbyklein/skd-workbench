import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync,writeFileSync} from 'node:fs';
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

test('overrides validate provider support and reset to plan',async t=>{
 const f=setup(t),source=await f.work.source(f.project,7),plan=f.work.recordPlan(f.project,source,{schema:1,planID:'plan-1',version:1,settings,graph});f.work.approvePlan(plan.planID,1,source.sourceHash,'Approved.');
 let r=await f.work.saveSettings(f.project,7,{action:'save',sourceHash:source.sourceHash,settings:{...settings,effort:'low'}});assert.equal(r.origin,'override');assert.equal(r.effective.effort,'low');
 await assert.rejects(f.work.saveSettings(f.project,7,{action:'save',sourceHash:source.sourceHash,settings:{...settings,model:'missing'}}),/unavailable/);
 r=await f.work.saveSettings(f.project,7,{action:'reset',sourceHash:source.sourceHash});assert.equal(r.origin,'approved_plan');assert.equal(r.effective.effort,'high');
 const g=setup(t),s=await g.work.source(g.project,7);
 const draft=await g.work.saveSettings(g.project,7,{action:'save',sourceHash:s.sourceHash,settings:{...settings,orchestration:true},prompt:'Plan and implement this issue.',orchestrationConfig:{orchestrator:settings,worker:settings}});
 assert.equal(draft.prompt,'Plan and implement this issue.');
 assert.equal(draft.effective.orchestration,true);
 assert.equal(draft.effective.orchestrationConfig.planHash,null);
 assert.deepEqual(draft.effective.orchestrationConfig.tasks,{});
 assert.equal(draft.canStartOrchestration,false);
 assert.equal(draft.approval,null);
 const reloaded=await g.work.resolve(g.project,7);assert.equal(reloaded.prompt,draft.prompt);
 await assert.rejects(g.work.startSolo(g.project,7,{requestKey:'draft-orchestration',sourceHash:s.sourceHash}),/single-agent settings/);
 assert.equal(g.state.starts.length,0);
});

test('one worker choice applies to all approved plan tasks',async t=>{
 const f=setup(t),source=await f.work.source(f.project,7);
 const plan=f.work.recordPlan(f.project,source,{schema:1,planID:'assigned-plan',version:1,settings,graph:{tasks:[{...graph.tasks[0],agent:'codex',model:'gpt-5.6-sol',effort:'low'},{...graph.tasks[0],id:'two',dependencies:['one']}]}});
 f.work.approvePlan(plan.planID,1,source.sourceHash,'Approved.');
 const result=await f.work.saveSettings(f.project,7,{action:'save',sourceHash:source.sourceHash,settings:{...settings,orchestration:true},orchestrationConfig:{orchestrator:settings,worker:{agent:'claude',model:'sonnet',effort:'medium'}}});
 assert.deepEqual(result.effective.orchestrationConfig.worker,{agent:'claude',model:'sonnet',effort:'medium'});
 assert.deepEqual(result.effective.orchestrationConfig.tasks,{one:result.effective.orchestrationConfig.worker,two:result.effective.orchestrationConfig.worker});
 assert.equal(result.effective.orchestrationConfig.orchestrator.effort,'high');
});
test('saved CLI prompt reaches the launch and rejected edits preserve it',async t=>{
 const f=setup(t),source=await f.work.source(f.project,7);
 await f.work.saveSettings(f.project,7,{action:'save',sourceHash:source.sourceHash,settings,prompt:'Implement the acceptance checks.'});
 await assert.rejects(f.work.saveSettings(f.project,7,{action:'save',sourceHash:source.sourceHash,settings,prompt:'x'.repeat(8001)}),/8,000/);
 assert.equal((await f.work.resolve(f.project,7)).prompt,'Implement the acceptance checks.');
 const run=await f.work.startSolo(f.project,7,{requestKey:'saved-prompt-launch',sourceHash:source.sourceHash});
 assert.equal(run.prompt,'Implement the acceptance checks.');assert.match(f.state.starts[0].input.initialPrompt,/User direction:\nImplement the acceptance checks\./);
});
test('directed solo launch freezes context and a request key launches once',async t=>{
 const f=setup(t),source=await f.work.source(f.project,7);await f.work.saveSettings(f.project,7,{action:'save',sourceHash:source.sourceHash,settings});
 const input={requestKey:'launch-12345678',sourceHash:source.sourceHash,instruction:'Keep the public API stable.'},first=await f.work.startSolo(f.project,7,input),second=await f.work.startSolo(f.project,7,input);
 assert.equal(first.id,second.id);assert.equal(f.state.starts.length,1);assert.match(f.state.starts[0].input.initialPrompt,/owner\/repo#7/);assert.match(f.state.starts[0].input.initialPrompt,/Keep the public API stable/);assert.equal(f.state.starts[0].input.model,'gpt-5.6-sol');
 await assert.rejects(f.work.startSolo(f.project,7,{...input,instruction:'Different'}),/already used/);
 f.state.issue.title='Changed after launch';assert.equal(f.work.getRun(first.id,f.project).source.title,'Build it');
});

test('planning launches once with planning-only instructions even when orchestration is enabled',async t=>{
 const f=setup(t),source=await f.work.source(f.project,7);
 await f.work.saveSettings(f.project,7,{action:'save',sourceHash:source.sourceHash,prompt:'Focus on accessibility.',settings:{...settings,orchestration:true},orchestrationConfig:{orchestrator:settings,worker:settings}});
 const input={requestKey:'create-plan-once',sourceHash:source.sourceHash};
 const first=await f.work.startPlanning(f.project,7,input),second=await f.work.startPlanning(f.project,7,input);
 assert.equal(first.id,second.id);assert.equal(f.state.starts.length,1);
 assert.equal(first.kind,'planning');assert.equal(f.state.starts[0].input.mode,'worktree');
 assert.match(f.state.starts[0].input.initialPrompt,/Do not implement the work/);
 assert.match(f.state.starts[0].input.initialPrompt,/Focus on accessibility/);
 assert(f.state.starts[0].input.initialPrompt.includes(first.planFile));
 assert.equal((await f.work.resolve(f.project,7)).approval,null);
});

test('direct review needs no plan, is read-only, freezes instructions and deduplicates concurrent launches',async t=>{
 const {work,state,project}=setup(t);work.reviewInstructions=async()=> 'Project system instructions';
 const input={requestKey:'review-request-1',sourceHash:issueSourceHash(base),settings,instruction:'Find missing checks'};
 const [a,b]=await Promise.all([work.startReview(project,7,input),work.startReview(project,7,input)]);
 assert.equal(a.id,b.id);assert.equal(state.starts.length,1);assert.equal(state.starts[0].input.mode,'read-only');assert.deepEqual(state.starts[0].input.playbook,{mode:'inherit'});assert.match(state.starts[0].input.initialPrompt,/Find missing checks/);assert.match(a.systemInstructions,/Project system instructions/);assert.match(a.systemInstructions,/Do not implement/);assert.equal(work.data.plans.length,0);
 state.issue.body='Changed after launch';assert.equal((await work.startReview(project,7,input)).id,a.id);
 await assert.rejects(work.startReview(project,7,{...input,settings:{...settings,effort:'low'}}),/already used/);
 await assert.rejects(work.startReview(project,7,{...input,requestKey:'review-request-2'}),/issue changed/);
});

test('review rechecks project and source before inference and records launch failures',async t=>{
 const {work,state,project}=setup(t);work.reviewInstructions=async()=>'';
 work.terminals.start=async(input,p,internal)=>{state.issue.body='changed';assert.equal(await internal.shouldLaunch(),false);throw Error('Source changed before launch');};
 await assert.rejects(work.startReview(project,7,{requestKey:'review-request-3',sourceHash:issueSourceHash(base),settings}),/Source changed/);
 assert.equal(work.data.runs[0].status,'failed');assert.equal(work.data.runs[0].terminalID,undefined);
});

 test('review loads bounded current system files and rejects unreadable or oversized context',async t=>{
 const {work,project}=setup(t);project.folderPath=path.dirname(work.file);writeFileSync(path.join(project.folderPath,'SYSTEM.md'),'Project guidance');writeFileSync(path.join(project.folderPath,'CLAUDE.md'),'Claude guidance');assert.match(await work.reviewInstructions(project,'claude'),/Claude guidance/);assert.doesNotMatch(await work.reviewInstructions(project,'codex'),/Claude guidance/);writeFileSync(path.join(project.folderPath,'SYSTEM.md'),'x'.repeat(64001));await assert.rejects(work.reviewInstructions(project,'codex'),/64,000/);
});
