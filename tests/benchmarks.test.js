import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,writeFileSync,readFileSync,existsSync,rmSync,symlinkSync,truncateSync,realpathSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {CodexRuns} from '../lib/codex.js';
import {Workflows} from '../lib/workflows.js';
import {pinBenchmark,archiveWorkspace,removeWorkspace} from '../lib/benchmarks.js';
import {Store} from '../lib/store.js';
const delay=ms=>new Promise(r=>setTimeout(r,ms));
const git=(repo,...args)=>execFileSync('git',['-C',repo,...args],{encoding:'utf8'}).trim();
const input={task:'fixture only',model:'fixture',effort:'low',mode:'worktree'};
async function fixture(t){
 const root=mkdtempSync(path.join(tmpdir(),'skd-reset-')),repo=path.join(root,'repo'),directory=path.join(root,'data');mkdirSync(repo);
 git(repo,'init','-b','main');writeFileSync(path.join(repo,'file.txt'),'baseline');writeFileSync(path.join(repo,'.gitignore'),'ignored.txt\n');git(repo,'add','.');git(repo,'-c','user.name=Test','-c','user.email=test@example.invalid','commit','-m','baseline');
 const binary=path.join(root,'fake-codex');writeFileSync(binary,`#!/usr/bin/env node
 const fs=require('node:fs'),p=require('node:path'),dir=process.argv[process.argv.indexOf('--cd')+1];
 process.stdin.resume();process.stdin.on('end',()=>{
 const before=fs.readFileSync(p.join(dir,'file.txt'),'utf8');fs.writeFileSync(p.join(dir,'file.txt'),'edited');fs.writeFileSync(p.join(dir,'new.bin'),Buffer.from([0,255,1]));fs.writeFileSync(p.join(dir,'ignored.txt'),'evidence');fs.symlinkSync('file.txt',p.join(dir,'link'));
 console.log(JSON.stringify({type:'item.completed',item:{type:'agent_message',text:'Started with '+before}}));console.log(JSON.stringify({type:'item.completed',item:{type:'command_execution',command:'fixture check',aggregated_output:'PASS fixture',exit_code:0}}));console.log(JSON.stringify({type:'turn.completed',usage:{input_tokens:10,output_tokens:2}}));});`,{mode:0o755});
 const codex=new CodexRuns(directory,{binary,discover:async()=>({version:'fixture',models:[{id:'fixture',efforts:['low']}]})}),workflows=new Workflows(directory,codex);
 const project={id:'project',name:'Benchmark',folderPath:repo,benchmark:await pinBenchmark(repo)};
 t.after(async()=>{workflows.shutdown();await delay(100);rmSync(root,{recursive:true,force:true});});return {root,repo,directory,codex,workflows,project};
}
async function wait(get,predicate){for(let i=0;i<400;i++){const r=get();if(predicate(r))return r;await delay(20);}throw new Error('Timeout: '+JSON.stringify(get()));}
const flow={id:'flow',name:'Review benchmark',version:1,steps:[{id:'build',name:'Build',type:'agent',model:'fixture',effort:'low',instructions:'Build'},{id:'review',name:'Review',type:'human',instructions:'Review',maxRetries:1,retryFrom:'build'}]};
const workflowInput={flowVersion:1,task:'fixture only',acceptance:'fixture passes',mode:'worktree',maxAttempts:3,config:{build:{model:'fixture',effort:'low'}}};
test('repeat runs use pinned commit after source HEAD advances; save complete files, evidence and usage before reset',async t=>{
 const {repo,directory,codex,project}=await fixture(t);
 writeFileSync(path.join(repo,'file.txt'),'later source');git(repo,'add','.');git(repo,'-c','user.name=Test','-c','user.email=test@example.invalid','commit','-m','later');
 await assert.rejects(codex.start({...input,mode:'read-only'},project),/isolated worktree/);
 for(let i=0;i<2;i++){
  const started=await codex.start(input,project);const r=await wait(()=>codex.get(started.id),r=>r.reset?.status==='cleared');
  assert.equal(r.output,'Started with baseline');assert.equal(r.usage.inputTokens,10);assert.equal(r.commands[0].output,'PASS fixture');assert(!existsSync(r.worktreePath));
  const archive=JSON.parse(readFileSync(path.join(directory,'artifacts',r.id+'.json')));
  assert.equal(archive.baseline,project.benchmark.commit);assert.match(archive.diff,/edited/);
  assert.equal(archive.evidence.finishedAt,r.finishedAt);assert.equal(archive.evidence.commands[0].exitCode,0);
  const file=name=>archive.files.find(f=>f.path===name);
  assert.deepEqual(Buffer.from(file('new.bin').data,'base64'),Buffer.from([0,255,1]));assert.equal(Buffer.from(file('ignored.txt').data,'base64').toString(),'evidence');assert.equal(file('link').target,'file.txt');assert(!file('.git'));
  assert.equal(readFileSync(path.join(repo,'file.txt'),'utf8'),'later source');assert.equal(git(repo,'status','--porcelain'),'');assert(!git(repo,'branch','--list').includes(r.branch));
 }
});
test('workflow review retains workspace and attempt archive; completion archives review notes and removes workspace',async t=>{
 const {project,workflows:w,directory,codex}=await fixture(t);let r=await w.start(workflowInput,flow,project);
 r=await wait(()=>w.get(r.id),r=>r.status==='waiting');assert(existsSync(r.workspace.worktreePath));assert(r.attempts[0].execution.artifact);assert(!r.reset);
 w.action(r.id,{revision:r.revision,action:'approve',note:'Acceptance checked by human fixture'});
 r=await wait(()=>w.get(r.id),r=>r.reset?.status==='cleared');assert.equal(r.status,'completed');assert(!existsSync(r.workspace.worktreePath));assert.equal(codex.owner,null);
 const archive=JSON.parse(readFileSync(path.join(directory,'artifacts',r.id+'.json')));assert.equal(archive.evidence.attempts.at(-1).note,'Acceptance checked by human fixture');assert.equal(archive.evidence.usage.inputTokens,10);
});
test('stop at a review clears workspace; archive failure retains it visibly and preserves output',async t=>{
 const {project,workflows:w}=await fixture(t);let r=await w.start(workflowInput,flow,project);r=await wait(()=>w.get(r.id),r=>r.status==='waiting');
 const large=path.join(r.workspace.worktreePath,'large');writeFileSync(large,'');truncateSync(large,33*1024*1024);
 w.action(r.id,{revision:r.revision,action:'stop'});r=await wait(()=>w.get(r.id),r=>r.reset?.status==='retained');assert.equal(r.status,'cancelled');assert.match(r.reset.error,/32 MiB/);assert(existsSync(r.workspace.worktreePath));assert.equal(r.attempts[0].execution.output,'Started with baseline');
});
test('stop at review archives and resets successfully',async t=>{
 const {project,workflows:w}=await fixture(t);let r=await w.start(workflowInput,flow,project);r=await wait(()=>w.get(r.id),r=>r.status==='waiting');w.action(r.id,{revision:r.revision,action:'stop'});r=await wait(()=>w.get(r.id),r=>r.reset?.status==='cleared');assert.equal(r.status,'cancelled');assert(!existsSync(r.workspace.worktreePath));
});
test('cleanup refuses source checkout or a symlink path; metadata survives project edits',async t=>{
 const {project,repo,directory}=await fixture(t);const source={worktreePath:repo,sourceContext:{git:{root:repo}}};await assert.rejects(removeWorkspace(directory,source),/owned worktree/);assert.equal(readFileSync(path.join(repo,'file.txt'),'utf8'),'baseline');
 const base=path.join(realpathSync(directory),'worktrees');mkdirSync(base);const link=path.join(base,'00000000-0000-0000-0000-000000000000');symlinkSync(repo,link);await assert.rejects(archiveWorkspace(directory,'fixture',{...source,worktreePath:link},{}),/symlink/);
 const store=new Store(directory),p=store.createProject({name:'Fixture',folderPath:repo});const pinned=store.setBenchmark(p.id,p.version,project.benchmark);const edited=store.updateProject(p.id,{name:'Renamed',folderPath:repo,version:pinned.version});assert.equal(edited.benchmark.commit,project.benchmark.commit);assert.throws(()=>store.updateProject(p.id,{name:'Changed',folderPath:directory,version:edited.version}),/Disable benchmark/);
});
test('restart never resumes pending cleanup automatically',async t=>{
 const {codex,directory}=await fixture(t);codex.runs.push({id:'stale',status:'completed',reset:{status:'clearing'}});codex.persist();const recovered=new CodexRuns(directory);assert.equal(recovered.get('stale').reset.status,'retained');assert.match(recovered.get('stale').reset.error,/no cleanup was resumed/);
});
test('changed files or deleted archive prevent removal after snapshot',async t=>{
 const {project,workflows:w,directory}=await fixture(t);let r=await w.start(workflowInput,flow,project);r=await wait(()=>w.get(r.id),r=>r.status==='waiting');
 const artifact=await archiveWorkspace(directory,r.id,r.workspace,w.get(r.id));writeFileSync(path.join(r.workspace.worktreePath,'extra.txt'),'keep me');
 await assert.rejects(removeWorkspace(directory,r.workspace,artifact),/changed after archiving/);assert(existsSync(r.workspace.worktreePath));
 const latest=await archiveWorkspace(directory,r.id,r.workspace,w.get(r.id));rmSync(path.join(directory,'artifacts',r.id+'.json'));await assert.rejects(removeWorkspace(directory,r.workspace,latest),/Archive is unavailable/);assert(existsSync(r.workspace.worktreePath));
});
test('failed workflow retains edits for retry; explicit stop then archives and clears',async t=>{
 const {project,workflows:w,codex}=await fixture(t);writeFileSync(codex.binary,`#!/usr/bin/env node
process.stdin.resume();process.stdin.on('end',()=>{require('node:fs').writeFileSync(require('node:path').join(process.argv[process.argv.indexOf('--cd')+1],'file.txt'),'partial');console.log(JSON.stringify({type:'turn.failed',error:{message:'fixture failure'}}));});`,{mode:0o755});
 let r=await w.start(workflowInput,flow,project);r=await wait(()=>w.get(r.id),r=>r.status==='failed');assert(existsSync(r.workspace.worktreePath));assert(!r.reset);assert.equal(r.usage.complete,false);
 w.action(r.id,{revision:r.revision,action:'stop'});r=await wait(()=>w.get(r.id),r=>r.reset?.status==='cleared');assert(!existsSync(r.workspace.worktreePath));assert.equal(r.attempts[0].execution.error,'fixture failure');
});
