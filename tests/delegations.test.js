import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,writeFileSync,readFileSync,rmSync,existsSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {CodexRuns} from '../lib/codex.js';
import {Workflows} from '../lib/workflows.js';
import {Delegations,delegationDecision} from '../lib/delegations.js';
import {createServer} from '../server.js';
const delay=ms=>new Promise(r=>setTimeout(r,ms));
function setup(t,{decision='accept',command=true,exit=0,slow=false,checks=[0],unrelatedFailure=false}={}){
 const root=mkdtempSync(path.join(tmpdir(),'skd-delegation-')),repo=path.join(root,'repo'),directory=path.join(root,'data');
 execFileSync('git',['init','-b','main',repo]);writeFileSync(path.join(repo,'file.txt'),'original');execFileSync('git',['-C',repo,'add','.']);execFileSync('git',['-C',repo,'-c','user.name=Test','-c','user.email=test@example.invalid','commit','-m','initial']);mkdirSync(directory);
 const binary=path.join(root,'fixture');writeFileSync(binary,`#!/usr/bin/env node
 const fs=require('node:fs');let p='';process.stdin.on('data',c=>p+=c);process.stdin.on('end',()=>{
 if(${slow}){setInterval(()=>{},1000);return;}
 const phase=p.match(/DELEGATION PHASE: (\\w+)/)[1],claude=process.argv.includes('--print');
 if(phase==='implement')fs.appendFileSync('file.txt',' edited');
 const output=phase==='implement'?'Implemented file.txt. Checks deferred to lead.':'<delegation>'+JSON.stringify({decision:phase==='plan'?'assign':${JSON.stringify(decision)},note:phase==='plan'?'Edit file.txt':'Reviewed file.txt',checks:phase==='review'?${JSON.stringify(checks)}:[]})+'</delegation>';
 if(claude){console.log(JSON.stringify({type:'result',subtype:'success',is_error:false,result:output,usage:{input_tokens:10,output_tokens:10}}));return;}
 if(phase==='review'&&${command})console.log(JSON.stringify({type:'item.completed',item:{id:'check',type:'command_execution',command:'node --test',aggregated_output:'fixture test output',exit_code:${exit}}}));
 if(phase==='review'&&${unrelatedFailure})console.log(JSON.stringify({type:'item.completed',item:{id:'other',type:'command_execution',command:'unavailable-reporting-command',exit_code:1}}));
 console.log(JSON.stringify({type:'item.completed',item:{type:'agent_message',text:output}}));console.log(JSON.stringify({type:'turn.completed',usage:{input_tokens:10,output_tokens:10}}));});`,{mode:0o755});
 const discover=async()=>({version:'fixture',models:[{id:'fixture',efforts:['low']}]});
 const options={binary,discover,claudeOptions:{binary,discover}},codex=new CodexRuns(directory,options),workflows=new Workflows(directory,codex),d=new Delegations(directory,codex);
 t.after(async()=>{d.shutdown();workflows.shutdown();await delay(100);rmSync(root,{recursive:true,force:true});});
 return {d,codex,directory,options,repo,project:{id:'project',name:'Fixture',folderPath:repo},input:{requestKey:'request-1',task:'Edit file.txt',acceptance:'Run checks and inspect file.txt',maxRevisions:1,lead:{agent:'codex',model:'fixture',effort:'low'},worker:{agent:'claude',model:'fixture',effort:'low'}}};
}
async function wait(d,id,statuses){for(let i=0;i<300;i++){const r=d.get(id);if(statuses.includes(r.status))return r;await delay(20);}throw Error('Timed out: '+JSON.stringify(d.get(id)));}
const action=(d,r,name,note)=>d.action(r.id,{revision:r.revision,action:name,note});
test('mixed-provider delegation registers one workspace and preserves output and command evidence',async t=>{
 const {d,codex,project,input,repo}=setup(t);const initial=await d.start(input,project);assert.equal(initial.workspace.status,'registered');assert.equal(initial.attempts.length,0);
 const duplicate=await d.start(input,project);assert.equal(duplicate.id,initial.id);await assert.rejects(d.start({...input,task:'different'},project),/different request/);
 const r=await wait(d,initial.id,['accepted','failed']);assert.equal(r.status,'accepted',r.error);assert.deepEqual(r.attempts.map(a=>a.execution.agent),['codex','claude','codex']);assert.equal(new Set(r.attempts.map(a=>a.execution.workingDirectory)).size,1);assert.equal(r.attempts[2].evidence.commands[0].exitCode,0);assert.match(r.attempts[2].execution.task,/Implemented file.txt/);assert.equal(readFileSync(path.join(repo,'file.txt'),'utf8'),'original');assert.equal(readFileSync(path.join(r.workspace.worktreePath,'file.txt'),'utf8'),'original edited');assert.equal(codex.owner,null);assert.equal(d.request(project.id,input.requestKey).id,r.id);
});
test('revisions stop at the budget and require user attention; no worktree cleanup',async t=>{
 const {d,codex,project,input}=setup(t,{decision:'revise'});const s=await d.start(input,project),r=await wait(d,s.id,['waiting','failed']);assert.equal(r.status,'waiting',r.error);assert.equal(r.revisions,1);assert.equal(r.attempts.length,5);assert.match(r.error,/Revision limit/);assert.equal(codex.owner,r.id);action(d,r,'stop');assert.equal(codex.owner,null);assert(existsSync(r.workspace.worktreePath));
});
for(const options of [{command:false},{exit:1}])test('model acceptance cannot bypass absent or failed command evidence '+JSON.stringify(options),async t=>{const {d,project,input}=setup(t,options);const s=await d.start(input,project),r=await wait(d,s.id,['waiting','failed']);assert.equal(r.status,'waiting');assert.match(r.error,/command evidence/);assert.equal(r.attempts.at(-1).decision.decision,'accept');});
test('decisions reject malformed, ambiguous and unsupported model output',()=>{for(const output of ['okay','<delegation>{}</delegation>','<delegation>{bad}</delegation>','<delegation>{"decision":"launch","note":"x"}</delegation>','<delegation>{"decision":"accept","note":"x"}</delegation>'.repeat(2)])assert.throws(()=>delegationDecision(output,'review'));});
test('unsupported selection fails before registration or inference',async t=>{const {d,codex,project,input}=setup(t);await assert.rejects(d.start({...input,worker:{...input.worker,model:'absent'}},project),/supported model/);assert.equal(d.runs.length,0);assert.equal(codex.owner,null);});
test('clarifications retain evidence and cannot bypass the total attempt cap',async t=>{const {d,project,input}=setup(t,{decision:'ask'});const s=await d.start({...input,maxRevisions:0},project);let r=await wait(d,s.id,['waiting']);while(r.attempts.length<r.maxAttempts){action(d,r,'clarify','Inspect the same acceptance checks');r=await wait(d,r.id,['waiting']);}assert.equal(r.attempts.length,6);assert.match(r.attempts.at(-1).execution.task,/Inspect the same acceptance checks/);assert.throws(()=>action(d,r,'clarify','Again'),/Attempt limit/);});
test('corrupt persisted history fails visibly without overwriting it',t=>{const {directory,codex,d}=setup(t);const file=path.join(directory,'delegations.json');d.shutdown();writeFileSync(file,'{"schema":99,"runs":[]}');assert.throws(()=>new Delegations(directory,codex),/Damaged/);assert.equal(readFileSync(file,'utf8'),'{"schema":99,"runs":[]}');});
test('changed workspace identity blocks the next provider turn',async t=>{const {d,codex,project,input}=setup(t,{decision:'ask'});const s=await d.start(input,project),r=await wait(d,s.id,['waiting']);execFileSync('git',['-C',r.workspace.worktreePath,'checkout','-b','unexpected']);action(d,r,'clarify','Continue');const failed=await wait(d,r.id,['failed']);assert.match(failed.error,/identity changed/);assert.equal(codex.runs.length,3);});
test('cancel active child, reject stale actions, preserve workspace and prevent another turn',async t=>{const {d,codex,project,input}=setup(t,{slow:true});const s=await d.start(input,project),r=await wait(d,s.id,['running']);assert.throws(()=>d.action(r.id,{revision:0,action:'stop'}),/changed/);action(d,r,'stop');await wait(d,r.id,['cancelled']);await delay(80);assert.equal(codex.runs.length,1);assert.equal(codex.owner,null);});
test('restart interrupts without inference and retains task/workspace association',async t=>{const {d,codex,project,input,directory,options}=setup(t,{slow:true});const s=await d.start(input,project);await wait(d,s.id,['running']);d.shutdown();codex.shutdown();await delay(100);const c2=new CodexRuns(directory,options),d2=new Delegations(directory,c2);const r=d2.get(s.id);assert.equal(r.status,'interrupted');assert.equal(c2.active,null);assert.equal(r.taskRef,s.taskRef);assert.equal(r.workspace.id,s.workspace.id);assert.equal(c2.runs.length,1);action(d2,r,'stop');d2.shutdown();});
test('cancel during second discovery prevents child registration and launch',async t=>{const {d,codex,project,input}=setup(t);const original=codex.discover;let release,calls=0;codex.discover=async()=>{if(++calls===2)await new Promise(r=>release=r);return original();};const s=await d.start(input,project);for(let i=0;i<100&&!release;i++)await delay(20);assert(release);action(d,d.get(s.id),'stop');release();await delay(100);assert.equal(d.get(s.id).status,'cancelled');assert.equal(codex.runs.length,0);});
test('HTTP API recovers requests, rejects stale/cross-project actions and retries explicitly',async t=>{
 const {directory,options,repo,input}=setup(t);let calls=0;const discover=async()=>{if(++calls===2)throw Error('Fixture transient discovery failure');return options.discover();};
 const server=createServer({directory:path.join(directory,'api'),codexOptions:{...options,discover},claudeOptions:options.claudeOptions});await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const url=`http://127.0.0.1:${server.address().port}/api/`,request=(p,method='GET',body)=>fetch(url+p,{method,headers:body?{'content-type':'application/json'}:{},body:body?JSON.stringify(body):undefined});
 try{
  const project=await(await request('projects','POST',{name:'API fixture',folderPath:repo})).json(),other=await(await request('projects','POST',{name:'Other'})).json(),base='projects/'+project.id+'/delegations';
  const launch={...input,projectVersion:project.version};let response=await request(base,'POST',launch);assert.equal(response.status,202);let r=await response.json();
  for(let i=0;i<100;i++){r=await(await request(base+'/'+r.id)).json();if(r.status==='failed')break;await delay(20);}assert.equal(r.status,'failed');assert.match(r.error,/transient/);
  assert.equal((await(await request(base+'/requests/'+input.requestKey)).json()).id,r.id);assert.equal((await(await request(base,'POST',launch)).json()).id,r.id);
  assert.equal((await request('projects/'+other.id+'/delegations/'+r.id+'/action','POST',{revision:r.revision,action:'retry'})).status,404);
  assert.equal((await request(base+'/'+r.id+'/action','POST',{revision:0,action:'retry'})).status,409);
  response=await request(base+'/'+r.id+'/action','POST',{revision:r.revision,action:'retry'});assert.equal(response.status,200);
  for(let i=0;i<150;i++){r=await(await request(base+'/'+r.id)).json();if(r.status==='accepted')break;await delay(20);}assert.equal(r.status,'accepted',r.error);assert.equal(r.attempts.length,4);
  const s=await(await request(base,'POST',{...launch,requestKey:'cancel-request'})).json();response=await request(base+'/'+s.id+'/action','POST',{revision:s.revision,action:'stop'});if(response.status===409){const current=await(await request(base+'/'+s.id)).json();response=await request(base+'/'+s.id+'/action','POST',{revision:current.revision,action:'stop'});}assert.equal(response.status,200);
 }finally{server.shutdownCodex();server.closeAllConnections();await new Promise(r=>server.close(r));}
});

test('unrelated command failures remain visible without overriding successful selected acceptance checks',async t=>{const {d,project,input}=setup(t,{unrelatedFailure:true});const s=await d.start(input,project),r=await wait(d,s.id,['accepted','failed']);assert.equal(r.status,'accepted',r.error);assert.deepEqual(r.attempts.at(-1).evidence.selectedCommandIndices,[0]);assert.equal(r.attempts.at(-1).evidence.commands[1].exitCode,1);});
for(const checks of [[],[99]])test('absent or nonexistent acceptance references cannot accept '+JSON.stringify(checks),async t=>{const {d,project,input}=setup(t,{checks});const s=await d.start(input,project),r=await wait(d,s.id,['waiting','failed']);assert.equal(r.status,'waiting');assert.match(r.error,/referenced acceptance/);});
