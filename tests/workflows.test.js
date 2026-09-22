import test from 'node:test';import assert from 'node:assert/strict';import {existsSync,mkdtempSync,mkdirSync,writeFileSync,readFileSync,rmSync} from 'node:fs';import {tmpdir} from 'node:os';import path from 'node:path';import {execFileSync} from 'node:child_process';import {CodexRuns} from '../lib/codex.js';import {Workflows} from '../lib/workflows.js';
const delay=ms=>new Promise(r=>setTimeout(r,ms));
const flow={id:'flow',name:'Plan and build',version:1,steps:[{id:'plan',type:'agent',name:'Plan',model:'Fable',effort:'high',instructions:'Make the plan.'},{id:'review',type:'human',name:'Review',instructions:'Review plan',maxRetries:1,retryFrom:'plan'},{id:'build',type:'agent',name:'Build',model:'Opus',effort:'high',instructions:'Build it.'},{id:'check',type:'check',name:'Verify',instructions:'Record test evidence.'}]};
function setup(t,code){const root=mkdtempSync(path.join(tmpdir(),'skd-workflows-')),repo=path.join(root,'repo');execFileSync('git',['init','-b','main',repo]);writeFileSync(path.join(repo,'file.txt'),'original');execFileSync('git',['-C',repo,'add','.']);execFileSync('git',['-C',repo,'-c','user.name=Test','-c','user.email=test@example.invalid','commit','-m','initial']);const binary=path.join(root,'codex-fixture');writeFileSync(binary,'#!/usr/bin/env node\n'+(code||`const fs=require('node:fs'),path=require('node:path');let prompt='';process.stdin.on('data',c=>prompt+=c);process.stdin.on('end',()=>{const folder=process.argv[process.argv.indexOf('--cd')+1];if(process.argv.includes('workspace-write'))fs.appendFileSync(path.join(folder,'file.txt'),' edited');console.log(JSON.stringify({type:'item.started',item:{id:'fixture-shell',type:'command_execution',command:'private command'}}));console.log(JSON.stringify({type:'item.completed',item:{id:'fixture-shell',type:'command_execution',command:'private command',exit_code:0,status:'completed'}}));console.log(JSON.stringify({type:'item.completed',item:{type:'agent_message',text:'Output contains '+(prompt.includes('revise note')?'revision note':'initial plan')}}));console.log(JSON.stringify({type:'turn.completed',usage:{input_tokens:100,cached_input_tokens:50,output_tokens:20}}));});`),{mode:0o755});const directory=path.join(root,'data');mkdirSync(directory);const codex=new CodexRuns(directory,{binary,discover:async()=>({version:'fixture',models:[{id:'fixture',efforts:['low']}]})});const workflows=new Workflows(directory,codex);t.after(async()=>{workflows.shutdown();await delay(80);rmSync(root,{recursive:true,force:true});});return {workflows,codex,repo,directory,project:{id:'project',name:'Fixture',folderPath:repo},input:{flowVersion:1,task:'Task',acceptance:'Acceptance',mode:'worktree',maxAttempts:10,config:{plan:{model:'fixture',effort:'low'},build:{model:'fixture',effort:'low'}}}};}
async function wait(w,id,status){for(let i=0;i<250;i++){const r=w.get(id);if(status.includes(r.status))return r;await delay(20);}throw new Error('Timed out: '+JSON.stringify(w.get(id)));}
const act=(w,r,action,note='')=>w.action(r.id,{revision:r.revision,action,note});
test('flow hands off actual outputs, reviews retry boundedly, one worktree and all usage retained',async t=>{const {workflows:w,codex,repo,project,input}=setup(t);const started=await w.start(input,flow,project);let r=await wait(w,started.id,['waiting']);assert.equal(r.attempts.length,1);assert.equal(r.flow.steps[0].model,'Fable');assert.equal(r.config.plan.model,'fixture');await assert.rejects(codex.start({task:'x',model:'fixture',effort:'low',mode:'read-only'},project),/workflow owns/);const stale=r.revision;act(w,r,'changes','revise note');assert.throws(()=>w.action(r.id,{revision:stale,action:'approve'}),/changed/);r=await wait(w,r.id,['waiting']);assert.equal(r.attempts.filter(a=>a.kind==='agent').length,2);assert.match(r.attempts.at(-1).execution.task,/revise note/);assert.throws(()=>act(w,r,'changes','again'),/no change requests/);act(w,r,'approve');r=await wait(w,r.id,['checking']);assert.match(r.attempts.at(-1).execution.task,/Output contains revision note/);assert.throws(()=>act(w,r,'approve'),/Review note/);act(w,r,'approve','npm test passed in fixture');r=await wait(w,r.id,['completed']);assert.equal(r.usage.inputTokens,300);assert.equal(r.usage.outputTokens,60);assert.equal(r.usage.cachedInputTokens,150);assert.equal(r.usage.complete,true);assert.equal(r.toolActivity.coverage.status,'complete');assert.equal(r.toolActivity.attempts.length,3);assert.equal(r.toolActivity.aggregates.tools.find(item=>item.name==='shell').count,3);assert(!('events' in r.toolActivity));const children=r.attempts.filter(a=>a.execution);assert.equal(new Set(children.map(a=>a.execution.workingDirectory)).size,1);assert.equal(readFileSync(path.join(repo,'file.txt'),'utf8'),'original');assert.equal(readFileSync(path.join(r.workspace.worktreePath,'file.txt'),'utf8'),'original edited edited edited');assert.equal(codex.owner,null);});
test('snapshot is immutable and invalid provider mapping does not start a run',async t=>{const {workflows:w,project,input}=setup(t);await assert.rejects(w.start({...input,config:{}},flow,project),/supported Codex/);assert.equal(w.runs.length,0);const f=structuredClone(flow);const r=await w.start(input,f,project);f.name='Mutated';input.config.plan.model='changed';await wait(w,r.id,['waiting']);assert.equal(w.get(r.id).flow.name,'Plan and build');assert.equal(w.get(r.id).config.plan.model,'fixture');});
test('attempt cap fails visibly before another call; stop releases ownership',async t=>{const {workflows:w,codex,project,input}=setup(t);let r=await w.start({...input,maxAttempts:1},flow,project);r=await wait(w,r.id,['waiting']);act(w,r,'changes','revise');r=await wait(w,r.id,['failed']);assert.match(r.error,/limit/);assert.equal(codex.runs.length,1);assert.throws(()=>act(w,r,'retry'),/limit/);act(w,r,'stop');assert.equal(codex.owner,null);});
test('failure stops sequence with unknown usage; cancellation stops active child',async t=>{const {workflows:w,codex,project,input}=setup(t,`process.stdin.resume();process.stdin.on('end',()=>console.log(JSON.stringify({type:'turn.failed',error:{message:'Fixture failure'}})));`);let r=await w.start(input,flow,project);r=await wait(w,r.id,['failed']);assert.match(r.error,/Fixture failure/);assert.equal(r.usage.complete,false);assert.equal(codex.runs.length,1);act(w,r,'stop');});
test('restart retains review gate, child activity and children; active work is interrupted, never replayed',async t=>{const {workflows:w,codex,project,input,directory}=setup(t);let r=await w.start(input,flow,project);r=await wait(w,r.id,['waiting']);w.shutdown();const c2=new CodexRuns(directory);const w2=new Workflows(directory,c2);assert.equal(w2.get(r.id).status,'waiting');assert.equal(w2.get(r.id).attempts[0].execution.usage.inputTokens,100);assert.equal(w2.get(r.id).toolActivity.attempts[0].eventCount,1);assert.equal(w2.get(r.id).toolActivity.aggregates.tools[0].count,1);assert.equal(c2.owner,r.id);w2.change(r.id,x=>x.status='running');const c3=new CodexRuns(directory);const w3=new Workflows(directory,c3);assert.equal(w3.get(r.id).status,'interrupted');assert.equal(w3.get(r.id).toolActivity.aggregates.tools[0].count,1);assert.equal(c3.active,null);assert.equal(c3.runs.length,1);w3.shutdown();});
test('stop while provider discovery is pending prevents paid child launch',async t=>{const {workflows:w,codex,project,input}=setup(t);const original=codex.discover;let release;let calls=0;codex.discover=async()=>{if(++calls===2)await new Promise(r=>release=r);return original();};const r=await w.start(input,flow,project);for(let i=0;i<100&&!release;i++)await delay(10);assert(release);act(w,w.get(r.id),'stop');release();await delay(100);assert.equal(w.get(r.id).status,'cancelled');assert.equal(codex.runs.length,0);assert.equal(codex.owner,null);});
test('stopping an active workflow kills its child and never launches the next step',async t=>{const {workflows:w,codex,project,input}=setup(t,`process.stdin.resume();setInterval(()=>{},1000);`);let r=await w.start(input,flow,project);r=await wait(w,r.id,['running']);assert.throws(()=>codex.stop(r.attempts[0].childID),/from its workflow/);act(w,r,'stop');r=await wait(w,r.id,['cancelled']);assert.equal(codex.runs.length,1);assert.equal(codex.runs[0].status,'cancelled');assert.equal(codex.owner,null);});
test('oversized handoff stops visibly without truncation or a second model call',async t=>{const {workflows:w,codex,project,input}=setup(t,`process.stdin.resume();process.stdin.on('end',()=>{console.log(JSON.stringify({type:'item.completed',item:{type:'agent_message',text:'x'.repeat(128000)}}));console.log(JSON.stringify({type:'turn.completed',usage:{input_tokens:100,output_tokens:20}}));});`);let r=await w.start(input,flow,project);r=await wait(w,r.id,['waiting']);act(w,r,'approve');r=await wait(w,r.id,['failed']);assert.match(r.error,/no output was silently truncated/);assert.equal(codex.runs.length,1);assert.equal(r.attempts[0].execution.output.length,128000);});

import {AgentProfiles} from '../lib/playbooks.js';
import {Skills} from '../lib/skills.js';
import {Store} from '../lib/store.js';
import {validateFlow} from '../lib/domain.js';
async function withAgents(t){
 const f=setup(t,`process.stdin.resume();process.stdin.on('end',()=>{console.log(JSON.stringify({type:'item.completed',item:{type:'agent_message',text:process.argv.find(a=>a.startsWith('developer_instructions='))||'No instructions'}}));console.log(JSON.stringify({type:'turn.completed',usage:{input_tokens:1,output_tokens:1}}));});`);
 f.codex.skills=new Skills(f.directory);
 f.codex.playbooks=new AgentProfiles(f.directory,{skills:f.codex.skills});
 f.profileInput={revision:0,name:'Workflow specialist',scope:{kind:'global'},providers:['codex'],systemPrompt:'ORIGINAL SPECIALIZATION',skillIDs:[],connectionIDs:[]};
 f.profile=await f.codex.playbooks.create(f.profileInput,[f.project]);
 f.input.mode='read-only';f.input.config.plan.agentProfile={mode:'selected',agentProfileID:f.profile.id};f.input.config.build.agentProfile={mode:'inherit'};
 await f.codex.playbooks.saveDefault({revision:1,defaultRevision:0,projectID:f.project.id,provider:'codex',playbookID:f.profile.id},[f.project]);
 f.preview=async()=>{const p=await f.workflows.preview(f.input,flow,f.project);for(const [id,selection] of Object.entries(p.selections))f.input.config[id].agentProfile=selection;return p;};return f;
}
test('workflow assignments persist through settings, copy and old flows without storing launch signatures',()=>{
 const dir=mkdtempSync(path.join(tmpdir(),'skd-flow-profile-store-'));
 try{const store=new Store(dir),p=store.createProject({name:'Project',folderPath:'/tmp'}),saved=store.createFlow({...flow,projectID:p.id});
 const updated=store.saveRunSettings(saved.id,{version:saved.version,projectVersion:p.version,settings:{task:'x',acceptance:'',mode:'read-only',maxAttempts:2},config:{plan:{model:'fixture',effort:'low',agentProfile:{mode:'selected',agentProfileID:'profile',expectedSignature:'must not persist'}}}}).flow;
 assert.deepEqual(updated.steps[0].agentProfile,{mode:'selected',agentProfileID:'profile'});assert.equal(validateFlow(flow).steps[0].agentProfile,undefined);
 const copy=store.createFlow({...updated,name:'Copy'});assert.deepEqual(copy.steps[0].agentProfile,updated.steps[0].agentProfile);
 assert.throws(()=>validateFlow({...flow,steps:[{...flow.steps[0],agentProfile:{mode:'selected'}}]}),/Agent ID/);
 assert.throws(()=>validateFlow({...flow,steps:[{...flow.steps[0],agentProfile:{mode:'arbitrary'}}]}),/assignment/);
 }finally{rmSync(dir,{recursive:true,force:true});}
});
test('all step contexts freeze at start; edits and defaults cannot upgrade later steps or review retries',async t=>{
 const f=await withAgents(t),{workflows:w,codex,project,input}=f;await f.preview();
 let r=await w.start(input,flow,project);r=await wait(w,r.id,['waiting']);
 const frozen=structuredClone(r.agentContexts);
 await codex.playbooks.update(f.profile.id,{...f.profileInput,revision:2,version:1,systemPrompt:'NEW SPECIALIZATION'},[project]);
 act(w,r,'changes','revise note');r=await wait(w,r.id,['waiting']);
 assert.equal(r.attempts.filter(a=>a.execution).length,2);
 for(const a of r.attempts.filter(a=>a.execution)){assert.match(a.execution.output,/ORIGINAL SPECIALIZATION/);assert(!a.execution.output.includes('NEW SPECIALIZATION'));assert.equal(a.execution.agentContext.agentProfile.version,1);}
 act(w,r,'approve');r=await wait(w,r.id,['checking']);assert.match(r.attempts.at(-1).execution.output,/ORIGINAL SPECIALIZATION/);assert.deepEqual(r.agentContexts,frozen);
 assert.equal(r.attempts.at(-1).execution.agentContext.agentProfile.source,'project-default');act(w,r,'stop');
});
test('stale prompts, instructions and disappearing defaults reject before workflow persistence',async t=>{
 const f=await withAgents(t),{workflows:w,codex,project,input}=f;await f.preview();
 writeFileSync(path.join(f.repo,'AGENTS.md'),'changed instructions');await assert.rejects(w.start(input,flow,project),/changed after preview/);assert.equal(w.runs.length,0);assert.equal(codex.owner,null);
 await f.preview();codex.playbooks.clearDefault({revision:2,defaultRevision:1,projectID:project.id,provider:'codex'},[project]);
 await assert.rejects(w.start(input,flow,project),/changed after preview/);assert.equal(codex.runs.length,0);
 await f.preview();await codex.playbooks.update(f.profile.id,{...f.profileInput,revision:3,version:1,systemPrompt:'changed'},[project]);
 await assert.rejects(w.start(input,flow,project),/changed after preview/);assert.equal(w.runs.length,0);
});
test('archived or moved Agents revoke frozen attempts without modifying history or spawning',async t=>{
 const f=await withAgents(t),{workflows:w,codex,project,input}=f;await f.preview();let r=await w.start(input,flow,project);r=await wait(w,r.id,['waiting']);
 codex.playbooks.archive(f.profile.id,{revision:2,version:1,archived:true});act(w,r,'changes','revise');r=await wait(w,r.id,['failed']);assert.match(r.error,/revoked/);assert.equal(codex.runs.length,1);assert.equal(r.attempts[0].execution.agentContext.agentProfile.systemPrompt,'ORIGINAL SPECIALIZATION');act(w,r,'stop');
});
test('workflow Agent scope/provider guards, no-specialization and explicit empty skill overrides',async t=>{
 const f=await withAgents(t),{workflows:w,codex,project,input}=f;
 const skill=codex.skills.create({revision:0,name:'Skill',instructions:'FROZEN SKILL',scope:{kind:'global'}},[project]);
 await codex.playbooks.update(f.profile.id,{...f.profileInput,revision:2,version:1,skillIDs:[skill.id]},[project]);
 input.config.plan.skills={mode:'replace',skillIDs:[]};input.config.build.agentProfile={mode:'legacy'};const preview=await f.preview();assert.equal(preview.contexts.plan.skills.entries.length,0);assert.equal(preview.contexts.build.agentProfile.status,'legacy');
 let r=await w.start(input,flow,project);r=await wait(w,r.id,['waiting']);assert(!r.attempts[0].execution.output.includes('FROZEN SKILL'));act(w,r,'stop');
 const other={id:'other',folderPath:f.repo};await codex.playbooks.update(f.profile.id,{...f.profileInput,revision:3,version:2,scope:{kind:'project',projectID:project.id}},[project]);
 await assert.rejects(w.preview(input,flow,other),/another project/);
 codex.playbooks.clearDefault({revision:4,defaultRevision:1,projectID:project.id,provider:'codex'},[project]);
 await codex.playbooks.update(f.profile.id,{...f.profileInput,revision:5,version:3,providers:['claude']},[project]);await assert.rejects(f.preview(),/does not support/);
});
test('MCP-bearing workflow Agents need explicit exclusion acknowledgement; adapters remain MCP-free',async t=>{
 const f=await withAgents(t),{workflows:w,codex,project,input}=f;
 codex.playbooks.connections={resolve:async()=>({status:'excluded',connections:[],reason:'Structured workflows do not use MCP connections.'})};
 codex.playbooks.data.entries[0].connectionIDs=['private-connection'];const preview=await f.preview();assert.equal(preview.contexts.plan.agentProfile.exclusions[0].type,'connection');
 await assert.rejects(w.start(input,flow,project),/confirm launch without/);assert.equal(codex.runs.length,0);
 for(const c of Object.values(input.config))c.agentProfile.acknowledgeExclusions=true;
 let r=await w.start(input,flow,project);r=await wait(w,r.id,['waiting']);assert.deepEqual(r.attempts[0].execution.agentContext.agentProfile.connectionSelection.connectionIDs,[]);assert.equal(r.attempts[0].execution.agentContext.connections.status,'excluded');act(w,r,'stop');
});
test('frozen skills and Agents survive restart before a step launches; current skill revocation still blocks',async t=>{
 const f=await withAgents(t),{workflows:w,codex,project,input}=f;
 const skill=codex.skills.create({revision:0,name:'Frozen skill',instructions:'ORIGINAL SKILL',scope:{kind:'global'}},[project]);await codex.playbooks.update(f.profile.id,{...f.profileInput,revision:2,version:1,skillIDs:[skill.id]},[project]);
 await f.preview();let r=await w.start(input,flow,project);r=await wait(w,r.id,['waiting']);
 codex.skills.update(skill.id,{revision:1,name:'Edited skill',instructions:'CHANGED SKILL',scope:{kind:'global'}},[project]);w.shutdown();
 const c2=new CodexRuns(f.directory,{binary:codex.binary,discover:codex.discover,skills:codex.skills,playbooks:codex.playbooks}),w2=new Workflows(f.directory,c2);t.after(()=>{if(existsSync(f.directory))w2.shutdown();});
 r=w2.get(r.id);act(w2,r,'changes','Retry after restart');r=await wait(w2,r.id,['waiting']);assert.match(r.attempts.at(-1).execution.output,/ORIGINAL SKILL/);assert(!r.attempts.at(-1).execution.output.includes('CHANGED SKILL'));
 codex.skills.archive(skill.id,{revision:2,archived:true});act(w2,r,'approve');r=await wait(w2,r.id,['failed']);assert.match(r.error,/revoked/);assert.equal(c2.runs.length,2);act(w2,r,'stop');
});
