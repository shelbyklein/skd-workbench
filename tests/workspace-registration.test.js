import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,writeFileSync,rmSync,existsSync,readFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {CodexRuns} from '../lib/codex.js';
import {Workflows} from '../lib/workflows.js';
import {TerminalSessions} from '../lib/terminals.js';
import {WorktreeNotes} from '../lib/worktree-notes.js';
import {LifecycleStore} from '../lib/lifecycle-store.js';
const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const provider={version:'fixture',models:[{id:'fixture',efforts:['low']}]};
const input={task:'Document the workspace lifecycle',model:'fixture',effort:'low',mode:'worktree'};
async function until(read,predicate){for(let i=0;i<300;i++){const value=read();if(predicate(value))return value;await delay(20);}throw Error('Fixture did not settle: '+JSON.stringify(read()));}
function setup(t){
 const root=mkdtempSync(path.join(tmpdir(),'skd-registration-')),repo=path.join(root,'repo'),directory=path.join(root,'data'),marker=path.join(root,'provider-started');
 execFileSync('git',['init','-b','main',repo]);writeFileSync(path.join(repo,'file.txt'),'original\n');execFileSync('git',['-C',repo,'add','.']);execFileSync('git',['-C',repo,'-c','user.name=Test','-c','user.email=test@example.invalid','commit','-m','fixture']);
 const binary=path.join(root,'fixture-provider');writeFileSync(binary,`#!/usr/bin/env node\nrequire('node:fs').appendFileSync(${JSON.stringify(marker)},'started\\n');process.stdin.resume();process.stdin.on('end',()=>{console.log(JSON.stringify({type:'item.completed',item:{type:'agent_message',text:'Fixture result'}}));console.log(JSON.stringify({type:'turn.completed'}));});`,{mode:0o755});
 const codex=new CodexRuns(directory,{binary,discover:async()=>provider});
 codex.lifecycle=new LifecycleStore(directory);codex.workspaceNotes.onRecord=r=>codex.lifecycle.ensure(r);
 const cleanup=[];t.after(async()=>{for(const close of cleanup)close();codex.shutdown();await delay(100);rmSync(root,{recursive:true,force:true});});
 return {root,repo,directory,binary,marker,codex,cleanup,project:{id:'registration-project',name:'Registration fixture',folderPath:repo}};
}
function registered(codex,run){
 assert(run.workspaceRegistrationID,'Execution must expose its canonical registration UUID');
 const record=codex.workspaceNotes.get(run.workspaceRegistrationID);
 assert.equal(record.state,'attached');assert.equal(record.id,run.workspaceRegistration.id);
 const lifecycle=codex.lifecycle.get(record.id);assert.equal(lifecycle.registrationID,record.id);assert.equal(lifecycle.attachmentState,'attached');assert(lifecycle.sourceRefs.some(s=>record.sources.some(r=>s.id===r.id&&s.kind===r.kind)));assert.equal(record.ownerKey,run.workspaceOwnerKey);
 return record;
}
test('standalone worktree is registered before fixture inference and registration survives restart',async t=>{
 const {codex,project,directory,marker,repo}=setup(t);
 const initial=await codex.start(input,project),done=await until(()=>codex.get(initial.id),r=>!['preparing','running','stopping'].includes(r.status));
 assert.equal(done.status,'completed',done.error);assert(existsSync(marker));
 const record=registered(codex,done);assert.equal(record.purpose,input.task);assert.equal(record.projectID,project.id);assert.equal(record.classification,'development');assert.equal(codex.workspaceNotes.list().length,1);
 assert.equal(new WorktreeNotes(directory).get(record.id).id,record.id);assert.equal(readFileSync(path.join(repo,'file.txt'),'utf8'),'original\n');
});
test('read-only execution creates no workspace annotation',async t=>{
 const {codex,project}=setup(t);const initial=await codex.start({...input,mode:'read-only'},project);
 const done=await until(()=>codex.get(initial.id),r=>!['preparing','running','stopping'].includes(r.status));assert.equal(done.status,'completed',done.error);assert.equal(codex.workspaceNotes.list().length,0);assert(!done.workspaceRegistrationID);
});
test('failed attachment retains the created folder and intent without launching the provider',async t=>{
 const {codex,project,marker}=setup(t);codex.workspaceNotes.attach=async()=>{throw Error('Injected attachment failure');};
 const initial=await codex.start(input,project),done=await until(()=>codex.get(initial.id),r=>!['preparing','running','stopping'].includes(r.status));
 assert.equal(done.status,'failed');assert.match(done.error,/Injected attachment failure/);assert.equal(existsSync(marker),false);assert(existsSync(done.worktreePath));assert.equal(codex.workspaceNotes.list().length,1);assert.notEqual(codex.workspaceNotes.list()[0].state,'attached');
});
test('workflow revisions keep one registration and original task purpose across child prompts',async t=>{
 const {codex,project,directory,cleanup}=setup(t),workflows=new Workflows(directory,codex);cleanup.push(()=>workflows.shutdown());
 const flow={id:'registration-flow',version:1,name:'Registration retry',steps:[{id:'work',type:'agent',name:'Work',model:'fixture',effort:'low',instructions:'Inspect the task.'},{id:'review',type:'human',name:'Review',instructions:'Review evidence.',maxRetries:1,retryFrom:'work'}]};
 const initial=await workflows.start({flowVersion:1,task:input.task,acceptance:'Report evidence',mode:'worktree',maxAttempts:3,config:{work:{model:'fixture',effort:'low'}}},flow,project);
 let run=await until(()=>workflows.get(initial.id),r=>['waiting','failed'].includes(r.status));assert.equal(run.status,'waiting',run.error);
 const first=registered(codex,run.attempts.find(a=>a.execution).execution);
 workflows.action(run.id,{revision:run.revision,action:'changes',note:'Include the retention behavior'});
 run=await until(()=>workflows.get(initial.id),r=>['waiting','failed'].includes(r.status)&&r.attempts.filter(a=>a.execution).length===2);assert.equal(run.status,'waiting',run.error);
 const children=run.attempts.filter(a=>a.execution).map(a=>a.execution);assert.equal(new Set(children.map(c=>c.workspaceRegistrationID)).size,1);assert.equal(new Set(children.map(c=>c.workspaceOwnerKey)).size,1);assert.equal(codex.workspaceNotes.list().length,1);assert.equal(codex.workspaceNotes.get(first.id).purpose,input.task);assert.notEqual(children[1].task,input.task);
 workflows.action(run.id,{revision:run.revision,action:'approve'});
});
for(const agent of ['codex','claude'])test(`${agent} interactive workspace shares the canonical registry before PTY launch`,async t=>{
 const {codex,project,directory,binary,cleanup}=setup(t);let launchCount=0;
 const manager=new TerminalSessions(directory,codex,{binaries:{codex:binary,claude:binary},discover:async()=>provider,spawn:()=>{launchCount++;assert.equal(codex.workspaceNotes.list().filter(r=>r.state==='attached').length,1);return {pid:987654,onData(){},onExit(){},kill(){},write(){},resize(){}};}});cleanup.push(()=>manager.shutdown());
 const run=await manager.start({agent,model:'fixture',effort:'low',mode:'worktree',initialPrompt:input.task},project);assert.equal(launchCount,1);registered(codex,manager.get(run.id));assert.equal(codex.workspaceNotes.list().length,1);
});
test('stopping a terminal during registration verification prevents PTY launch',async t=>{
 const {codex,project,directory,binary,cleanup}=setup(t);let release,launchCount=0;
 const verify=codex.workspaceNotes.verify.bind(codex.workspaceNotes);codex.workspaceNotes.verify=async(...args)=>{await new Promise(resolve=>{release=resolve;});return verify(...args);};
 const manager=new TerminalSessions(directory,codex,{binaries:{codex:binary},discover:async()=>provider,spawn:()=>{launchCount++;return {pid:987654,onData(){},onExit(){},kill(){},write(){},resize(){}};}});cleanup.push(()=>manager.shutdown());
 const pending=manager.start({agent:'codex',model:'fixture',effort:'low',mode:'worktree',task:input.task},project);const settled=pending.then(value=>({value}),error=>({error}));
 await until(()=>release,Boolean);manager.stop(manager.runs[0].id);release();await settled;
 assert.equal(launchCount,0);assert.equal(manager.runs[0].status,'cancelled');assert(existsSync(manager.runs[0].worktreePath));
});
test('benchmark attachment failure retains workspace instead of invoking normal benchmark cleanup',async t=>{
 const {pinBenchmark}=await import('../lib/benchmarks.js');const {codex,project,repo,marker}=setup(t);project.benchmark=await pinBenchmark(repo);
 codex.workspaceNotes.attach=async()=>{throw Error('Injected benchmark attachment failure');};
 const initial=await codex.start(input,project);await until(()=>codex.get(initial.id),r=>r.status==='failed');await until(()=>codex.cleaning,n=>n===0);
 const done=codex.get(initial.id);assert.equal(existsSync(marker),false);assert(existsSync(done.worktreePath),'Failed registration must retain even benchmark workspaces');assert.notEqual(done.reset?.status,'cleared');
});
test('delegation planning turn uses its pre-registered canonical workspace',async t=>{
 const {Delegations}=await import('../lib/delegations.js');const {codex,project,directory,cleanup}=setup(t);
 codex.discoverClaude=async()=>provider;
 const delegation=new Delegations(directory,codex);cleanup.push(()=>delegation.shutdown());
 const initial=await delegation.start({requestKey:'registration-delegation',task:input.task,acceptance:'Inspect workspace ownership',maxRevisions:1,lead:{agent:'codex',model:'fixture',effort:'low'},worker:{agent:'claude',model:'fixture',effort:'low'}},project);
 const run=await until(()=>delegation.get(initial.id),r=>r.attempts.some(a=>a.childID)&&!['launching','running'].includes(r.status));
 const child=codex.get(run.attempts[0].childID),record=registered(codex,child);
 assert.equal(child.mode,'read-only');assert.equal(record.id,run.workspace.workspaceRegistrationID);assert.equal(record.purpose,input.task);assert.equal(record.origin.kind,'delegation');assert.equal(record.origin.id,run.id);assert.equal(codex.workspaceNotes.list().length,1);
});

test('lifecycle persistence failure blocks fixture inference before workspace creation',async t=>{
 const {codex,project,marker}=setup(t);codex.workspaceNotes.onRecord=()=>{throw Error('Injected lifecycle persistence failure');};
 const initial=await codex.start(input,project),done=await until(()=>codex.get(initial.id),r=>!['preparing','running','stopping'].includes(r.status));
 assert.equal(done.status,'failed');assert.match(done.error,/lifecycle persistence failure/);assert.equal(existsSync(marker),false);assert.equal(codex.workspaceNotes.list().length,1);
});
