import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,writeFileSync,readFileSync,rmSync,realpathSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {QuickActions,launchSettings} from '../lib/quick-actions.js';
import {TerminalSessions,terminalArgs} from '../lib/terminals.js';
import {CodexRuns} from '../lib/codex.js';
import {inspectRepository} from '../lib/worktrees.js';
const config={agent:'codex',model:'fixture',effort:'low',playbook:{mode:'inherit'}};
const git=(cwd,...args)=>execFileSync('git',['-C',cwd,...args],{encoding:'utf8',stdio:['ignore','pipe','pipe']}).trim();
function fixture(t){
 const root=realpathSync(mkdtempSync(path.join(tmpdir(),'skd-quick-'))),repo=path.join(root,'repo'),data=path.join(root,'data'),remote=path.join(root,'remote.git');mkdirSync(repo);mkdirSync(data);git(repo,'init','-b','main');git(repo,'config','user.name','Fixture');git(repo,'config','user.email','fixture@example.invalid');writeFileSync(path.join(repo,'file'),'baseline');git(repo,'add','.');git(repo,'commit','-m','baseline');git(repo,'init','--bare',remote);git(repo,'remote','add','origin','https://example.invalid/fixture.git');
 let available=true,policy=true,spawnCount=0,child;
 const provider=async()=>({version:'fixture',models:available?[{id:'fixture',efforts:['low'],isDefault:true}]:[]});
 const executor=new CodexRuns(data,{discover:provider});
 const terminals=new TerminalSessions(data,executor,{discover:provider,playbooks:{resolveLaunch:async()=>{assert(policy,'Playbook policy changed');return null;}},spawn:()=>{spawnCount++;child={onData(){},onExit(fn){this.exit=fn;},write(){},resize(){},kill(){}};return child;}});
 const project={id:'p',version:1,name:'Fixture',folderPath:repo};
 const service=new QuickActions(data,{terminals,github:{list:async()=>({issues:[{number:3,title:'Next feature',url:'https://example.invalid/3'}]})},project:()=>project,advertise:async()=>({tips:{'refs/heads/main':git(remote,'rev-parse','refs/heads/main')}})});
 const done=async()=>{await terminals.finish(terminals.active,{exitCode:0});};
 t.after(()=>{terminals.shutdown();executor.shutdown();rmSync(root,{recursive:true,force:true});});
 return {root,repo,data,remote,terminals,executor,project,service,done,spawnCount:()=>spawnCount,setAvailable:v=>available=v,setPolicy:v=>policy=v};
}
test('project preferences validate, persist, isolate, reset and exclude secrets/history',async t=>{
 const f=fixture(t);assert.equal(f.service.settings(f.project).settings,null);
 const saved=await f.service.save(f.project,{revision:0,settings:{...config,token:'secret',initialPrompt:'private',sessionID:'old',playbook:{mode:'inherit',secret:'private'}}});
 assert.deepEqual(saved.settings,config);assert.equal(f.service.settings({id:'other'}).settings,null);
 const recovered=new QuickActions(f.data,{terminals:f.terminals});assert.deepEqual(recovered.settings(f.project),saved);
 await assert.rejects(f.service.save(f.project,{revision:0,settings:config}),/changed/);
 f.setAvailable(false);await assert.rejects(f.service.start(f.project,{action:'suggest',revision:1,requestKey:'unavailable-model'}),/unavailable/);assert.equal(f.spawnCount(),0);f.setAvailable(true);
 f.setPolicy(false);await assert.rejects(f.service.start(f.project,{action:'suggest',revision:1,requestKey:'changed-playbook'}),/policy changed/);f.setPolicy(true);
 await f.service.save(f.project,{revision:1,reset:true});assert.equal(f.service.settings(f.project).settings,null);
 assert(!readFileSync(path.join(f.data,'quick-actions.json'),'utf8').includes('secret'));
 assert.throws(()=>launchSettings({agent:'evil',model:'x',effort:'low'}));
});
test('suggestion launch is read-only with one prompt; duplicate requests and recovery never spawn again',async t=>{
 const f=fixture(t);await f.service.save(f.project,{revision:0,settings:config});const input={action:'suggest',revision:1,requestKey:'suggest-once'};
 const [a,b]=await Promise.all([f.service.start(f.project,input),f.service.start(f.project,input)]);assert.equal(a.terminalID,b.terminalID);assert.equal(f.spawnCount(),1);
 const r=f.terminals.get(a.terminalID);assert.equal(r.mode,'read-only');assert.equal(r.workingDirectory,f.repo);assert.match(r.initialPrompt,/read-only/);assert.match(r.initialPrompt,/Next feature/);assert.equal(terminalArgs(r).filter(v=>v===r.initialPrompt).length,1);assert(!r.worktreePath);
 await assert.rejects(f.service.start(f.project,{...input,action:'collaborate'}),/another action/);
 await f.done();const recovered=new QuickActions(f.data,{terminals:f.terminals});assert.equal((await recovered.start(f.project,input)).terminalID,a.terminalID);assert.equal(f.spawnCount(),1);
});
test('collaboration creates a fresh retained worktree using cached settings; executor ownership blocks other actions',async t=>{
 const f=fixture(t);f.service.remember(f.project,config);const a=await f.service.start(f.project,{action:'collaborate',revision:1,requestKey:'collaborate-once'});assert(a.session.worktreePath);assert.equal(a.session.initialPrompt,undefined);assert.equal(a.session.model,'fixture');
 await assert.rejects(f.service.start(f.project,{action:'suggest',revision:1,requestKey:'while-active'}),/active session/);assert.equal(f.spawnCount(),1);await f.done();
 const b=await f.service.start(f.project,{action:'collaborate',revision:1,requestKey:'collaborate-again'});assert.notEqual(a.terminalID,b.terminalID);assert.notEqual(a.session.worktreePath,b.session.worktreePath);await f.done();
});
test('reconciliation CLI can integrate actual fixture branches and remote main; exit independently verifies Git only',async t=>{
 const f=fixture(t);const work=path.join(f.root,'work');git(f.repo,'worktree','add','-b','feature',work);writeFileSync(path.join(work,'feature'),'new');git(work,'add','.');git(work,'commit','-m','feature');
 await f.service.save(f.project,{revision:0,settings:config});const r=await f.service.start(f.project,{action:'reconcile',revision:1,requestKey:'reconcile-once'});
 assert.equal(r.session.workingDirectory,f.repo);assert.equal(r.session.mode,'reconcile');assert(!r.session.worktreePath);assert.match(r.session.initialPrompt,/every work item/);
 for(const agent of ['codex','claude']){const args=terminalArgs({...r.session,agent});assert(args.includes('--add-dir'));assert(!args.includes('--dangerously-skip-permissions'));assert(args.includes(agent==='codex'?'on-request':'manual'));}
 git(f.repo,'merge','--no-edit','feature');git(f.repo,'push',f.remote,'main');await f.done();
 const verified=f.terminals.get(r.terminalID).reconciliationResult;assert.equal(verified.status,'git-synchronized',verified.message);assert.match(verified.message,/Review the CLI test evidence/);assert.equal(git(f.repo,'rev-parse','main'),git(f.remote,'rev-parse','main'));
});
test('reconciliation does not report success for dirty work, unmerged commits, remote divergence or unavailable remote',async t=>{
 const f=fixture(t);await f.service.save(f.project,{revision:0,settings:config});const before=await inspectRepository(f.repo,{targetRef:'refs/heads/main'});git(f.repo,'push',f.remote,'main');
 writeFileSync(path.join(f.repo,'dirty'),'keep');let v=await f.service.verify(f.project,before,{status:'completed'});assert.equal(v.status,'needs-review');assert.match(v.message,/Dirty/);assert.equal(readFileSync(path.join(f.repo,'dirty'),'utf8'),'keep');rmSync(path.join(f.repo,'dirty'));
 git(f.repo,'checkout','-b','pending');writeFileSync(path.join(f.repo,'new'),'pending');git(f.repo,'add','.');git(f.repo,'commit','-m','pending');git(f.repo,'checkout','main');v=await f.service.verify(f.project,before,{status:'completed'});assert.equal(v.status,'needs-review');assert.match(v.message,/Unintegrated/);git(f.repo,'merge','pending');v=await f.service.verify(f.project,before,{status:'completed'});assert.match(v.message,/do not match/);
 f.service.advertise=async()=>{throw Error('Authentication failed');};v=await f.service.verify(f.project,before,{status:'completed'});assert.match(v.message,/Authentication/);assert.equal((await f.service.verify(f.project,before,{status:'cancelled'})).status,'needs-review');
});
test('reconciliation preflight rejects missing main, active operations and stale source before spawning',async t=>{
 const f=fixture(t);await f.service.save(f.project,{revision:0,settings:config});git(f.repo,'branch','-m','main','other');await assert.rejects(f.service.start(f.project,{action:'reconcile',revision:1,requestKey:'missing-main'}));assert.equal(f.spawnCount(),0);git(f.repo,'branch','-m','other','main');
 writeFileSync(path.join(f.repo,'.git','MERGE_HEAD'),git(f.repo,'rev-parse','HEAD')+'\n');await assert.rejects(f.service.start(f.project,{action:'reconcile',revision:1,requestKey:'pending-operation'}),/pending Git/);rmSync(path.join(f.repo,'.git','MERGE_HEAD'));assert.equal(f.spawnCount(),0);
 let reads=0;f.service.inspect=async(...args)=>{const s=await inspectRepository(...args);if(++reads>1)s._identity='changed';return s;};await assert.rejects(f.service.start(f.project,{action:'reconcile',revision:1,requestKey:'stale-source'}),/changed during launch/);assert.equal(f.spawnCount(),0);
});
test('selected playbook survives cached launches and rejects version drift until explicitly saved again',async t=>{
 const f=fixture(t),{Playbooks}=await import('../lib/playbooks.js');const library=new Playbooks(f.data);f.terminals.playbooks=library;
 const book=await library.create({revision:0,name:'Quick preset',scope:{kind:'global'},providers:['codex'],skillIDs:[],connectionIDs:[],creationRequestKey:'quick-book'},[f.project]);
 const selected={...config,playbook:{mode:'selected',playbookID:book.id}};const saved=await f.service.save(f.project,{revision:0,settings:selected});assert(saved.settings.playbook.expectedSignature);
 const first=await f.service.start(f.project,{action:'suggest',revision:1,requestKey:'book-first'});assert.equal(first.session.agentContext.agentProfile.id,book.id);await f.done();
 await library.update(book.id,{revision:1,version:1,name:'Updated preset',scope:{kind:'global'},providers:['codex'],skillIDs:[],connectionIDs:[]},[f.project]);await assert.rejects(f.service.start(f.project,{action:'suggest',revision:1,requestKey:'book-stale'}),/changed/);assert.equal(f.spawnCount(),1);
 await f.service.save(f.project,{revision:1,settings:selected});const next=await f.service.start(f.project,{action:'suggest',revision:2,requestKey:'book-reviewed'});assert.equal(next.session.agentContext.agentProfile.version,2);await f.done();
});
test('reviewed specialization is forwarded and bound to the quick action request identity',async t=>{
 const f=fixture(t);const saved=await f.service.save(f.project,{revision:0,settings:config});let received;
 f.terminals.playbooks.resolveLaunch=async(_project,_provider,selection)=>{received=selection;return null;};
 const agentProfile={mode:'selected',agentProfileID:'reviewer',expectedSignature:'reviewed'},input={action:'suggest',revision:saved.revision,requestKey:'profile-launch-once',agentProfile};
 await f.service.start(f.project,input);assert.deepEqual(received,agentProfile);assert.equal(f.spawnCount(),1);await assert.rejects(f.service.start(f.project,{...input,agentProfile:{mode:'legacy'}}),/already belongs/);assert.equal(f.spawnCount(),1);await f.done();
});
