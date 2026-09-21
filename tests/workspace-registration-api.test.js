import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,writeFileSync,readFileSync,rmSync,realpathSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {Store} from '../lib/store.js';
import {WorktreeNotes} from '../lib/worktree-notes.js';
import {createServer} from '../server.js';
const git=(cwd,...args)=>execFileSync('git',['-C',cwd,...args],{encoding:'utf8',stdio:['ignore','pipe','pipe']}).trim();
async function fixture(t,{unavailableWorktree=true}={}){
 const base=realpathSync(mkdtempSync(path.join(tmpdir(),'registration-api-'))),directory=path.join(base,'data');
 const repo=name=>{const root=path.join(base,name);mkdirSync(root);git(root,'init','-b','main');writeFileSync(path.join(root,'file'),'original');git(root,'add','.');git(root,'-c','user.name=Fixture','-c','user.email=fixture@example.invalid','commit','-m','initial');return root;};
 const root=repo('repo'),foreign=repo('foreign'),store=new Store(directory),project=store.createProject({name:'Primary',folderPath:root}),other=store.createProject({name:'Foreign',folderPath:foreign}),notes=new WorktreeNotes(directory);
 const seed=async(name,{attached=true,create=true,source=root,owner=project}={})=>{const destination=path.join(base,name),branch='codex/'+name,record=notes.prepare({intentID:name,projectID:owner.id,sourceContext:{folderPath:source,git:{root:source,commonDirectory:git(source,'rev-parse','--path-format=absolute','--git-common-dir')}},destination,branch,purpose:'Original '+name,origin:{kind:'workflow',id:'private-'+name},ownerKey:'workflow:'+name});if(create)git(source,'worktree','add','-b',branch,destination);return attached?await notes.attach(record.intentID):record;};
 const managed=await seed('managed'),pending=await seed('pending',{attached:false}),missing=await seed('missing',{attached:false,create:false}),foreignRecord=await seed('foreign-work',{source:foreign,owner:other});
 const sibling=store.createProject({name:'Sibling project',folderPath:managed.destination});
 git(root,'worktree','add','-b','codex/unassigned',path.join(base,'unassigned'));
 if(unavailableWorktree){const unavailable=path.join(base,'unavailable');git(root,'worktree','add','-b','codex/unavailable',unavailable);rmSync(unavailable,{recursive:true});}
 let launches=0;const server=createServer({directory,codexOptions:{spawnProcess:()=>{launches++;throw Error('No execution permitted');}},terminalOptions:{spawn:()=>{launches++;throw Error('No terminal permitted');}}});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 t.after(async()=>{server.shutdownCodex();server.closeAllConnections();await new Promise(resolve=>server.close(resolve));rmSync(base,{recursive:true,force:true});});
 const url=`http://127.0.0.1:${server.address().port}`,request=(route,method='GET',body,headers={})=>fetch(url+route,{method,headers:{...(body?{'Content-Type':'application/json'}:{}),...headers},body:body?JSON.stringify(body):undefined});
 const route=p=>`/api/projects/${p.id}`,snapshot=async(p=project)=>{const response=await request(route(p)+'/git-status');assert.equal(response.status,200);return response.json();};
 const input=(s,r=managed,p=project)=>({snapshotID:s.snapshotID,projectVersion:p.version,registrationID:r.id,expectedRevision:r.revision});
 return {base,root,project,other,sibling,managed,pending,missing,foreignRecord,request,route,snapshot,input,launches:()=>launches};
}
test('inventory distinguishes managed, unassigned, unknown and retained registrations without leaking sibling sources',async t=>{
 const f=await fixture(t),s=await f.snapshot();
 assert.equal(s.worktrees.find(w=>w.path===f.managed.destination).registration.status,'managed');
 assert.equal(s.worktrees.find(w=>w.path===path.join(f.base,'unassigned')).registration.status,'unassigned');
 assert.equal(s.worktrees.find(w=>w.path===path.join(f.base,'unavailable')).registration.status,'unknown');
 assert.equal(s.worktrees.find(w=>w.path===f.pending.destination).registration.status,'unknown');
 assert(s.registrations.some(r=>r.id===f.missing.id));assert(!s.registrations.some(r=>r.id===f.foreignRecord.id));
 const own=s.worktrees.find(w=>w.path===f.managed.destination).registration;assert.deepEqual(own.sources,f.managed.sources);
 const sibling=await f.snapshot(f.sibling),shared=sibling.worktrees.find(w=>w.path===f.managed.destination).registration;
 assert.equal(shared.id,own.id);assert.deepEqual(shared.sources,[]);assert.equal(shared.sourceAccess,'other-project');assert(!JSON.stringify(sibling).includes('private-managed'));assert.equal(f.launches(),0);
});
test('metadata edits preserve Git and reject stale revisions, project/snapshot identity and arbitrary fields',async t=>{
 const f=await fixture(t),s=await f.snapshot(),input=f.input(s),route=f.route(f.project)+'/workspace-registration';
 const refs=git(f.root,'show-ref'),index=readFileSync(path.join(f.root,'.git/index')),inventory=git(f.root,'worktree','list','--porcelain');
 const response=await f.request(route,'PUT',{...input,purpose:'Updated task',notes:'Literal <script> text'});assert.equal(response.status,200);const edited=await response.json();assert.equal(edited.purpose,'Updated task');assert.equal(edited.notes,'Literal <script> text');assert.equal(edited.revision,input.expectedRevision+1);
 assert.equal((await f.request(route,'PUT',{...input,purpose:'stale'})).status,409);
 const current={...input,expectedRevision:edited.revision};
 for(const extra of [{projectVersion:999},{snapshotID:'missing'}])assert.equal((await f.request(route,'PUT',{...current,...extra})).status,409);
 for(const extra of [{destination:'/tmp/arbitrary'},{path:'/tmp/arbitrary'},{ownerKey:'other'},{origin:{kind:'workflow',id:'other'}}])assert.equal((await f.request(route,'PUT',{...current,...extra})).status,400);
 assert.equal((await f.request(route,'PUT',current,{Origin:'https://attacker.invalid'})).status,403);
 assert.equal((await f.request(route,'PUT',f.input(s,f.foreignRecord))).status,403);
 const foreignSnapshot=await f.snapshot(f.other);assert.equal((await f.request(route,'PUT',{...current,snapshotID:foreignSnapshot.snapshotID})).status,409);
 assert.equal(git(f.root,'show-ref'),refs);assert.deepEqual(readFileSync(path.join(f.root,'.git/index')),index);assert.equal(git(f.root,'worktree','list','--porcelain'),inventory);assert.equal(readFileSync(path.join(f.root,'file'),'utf8'),'original');
 writeFileSync(path.join(f.root,'later'),'changed since observation');assert.equal((await f.request(route,'PUT',current)).status,409);assert.equal(f.launches(),0);
});
test('explicit recovery attaches retained intent once, rejects missing workspaces and never launches execution',async t=>{
 const f=await fixture(t,{unavailableWorktree:false}),s=await f.snapshot(),route=f.route(f.project)+'/workspace-registration/recover',input=f.input(s,f.pending),inventory=git(f.root,'worktree','list','--porcelain');
 const siblingSnapshot=await f.snapshot(f.sibling);assert.equal((await f.request(f.route(f.sibling)+'/workspace-registration/recover','POST',f.input(siblingSnapshot,f.pending,f.sibling))).status,403);
 assert.equal((await f.request(route,'POST',input,{Origin:'https://attacker.invalid'})).status,403);
 assert.equal((await f.request(route,'POST',{...input,destination:'/tmp/recreate'})).status,400);
 assert.equal((await f.request(route,'POST',f.input(s,f.missing))).status,409);
 const response=await f.request(route,'POST',input);assert.equal(response.status,200);const attached=await response.json();assert.equal(attached.state,'attached');assert.equal(attached.id,f.pending.id);
 assert.equal((await f.request(route,'POST',input)).status,409);assert.equal((await f.request(route,'POST',{...input,expectedRevision:attached.revision})).status,409);
 assert.equal(git(f.root,'worktree','list','--porcelain'),inventory);assert.equal(f.launches(),0);
 const fresh=await f.snapshot();assert.equal(fresh.worktrees.find(w=>w.path===f.pending.destination).registration.status,'managed');
});
test('concurrent recovery honors one expected revision and rejects the stale replay',async t=>{
 const f=await fixture(t,{unavailableWorktree:false}),s=await f.snapshot(),route=f.route(f.project)+'/workspace-registration/recover',input=f.input(s,f.pending);
 const responses=await Promise.all([f.request(route,'POST',input),f.request(route,'POST',input)]);
 assert.deepEqual(responses.map(r=>r.status).sort(),[200,409]);assert.equal(f.launches(),0);
});
test('recovery reserves execution and rejects project edits during attachment without persisting failure',async t=>{
 const f=await fixture(t,{unavailableWorktree:false}),s=await f.snapshot(),route=f.route(f.project)+'/workspace-registration/recover';
 const original=WorktreeNotes.prototype.attach;let release,entered;
 const held=new Promise(resolve=>{release=resolve;}),started=new Promise(resolve=>{entered=resolve;});
 WorktreeNotes.prototype.attach=async function(intentID,options){if(intentID===f.pending.intentID){entered();await held;}return original.call(this,intentID,options);};
 t.after(()=>{release();WorktreeNotes.prototype.attach=original;});
 const pending=f.request(route,'POST',f.input(s,f.pending));
 await Promise.race([started,new Promise((_,reject)=>{const timer=setTimeout(()=>reject(Error('Recovery did not enter attachment')),5000);timer.unref();})]);
 const launch=await f.request('/api/sessions','POST',{projectID:f.project.id,task:'Do not run',model:'fixture',effort:'low',mode:'read-only'});assert.equal(launch.status,409);assert.equal(f.launches(),0);
 const edited=await f.request(f.route(f.project),'PUT',{...f.project,name:'Changed while attaching'});assert.equal(edited.status,200);
 release();assert.equal((await pending).status,409);
 const persisted=JSON.parse(readFileSync(path.join(f.base,'data/worktree-notes.json'),'utf8')).records.find(r=>r.id===f.pending.id);
 assert.equal(persisted.revision,f.pending.revision);assert.equal(persisted.state,'prepared');assert.equal(persisted.error,null);
 WorktreeNotes.prototype.attach=original;
 const updated=await edited.json(),fresh=await f.snapshot(updated);
 const recovered=await f.request(route,'POST',f.input(fresh,f.pending,updated));assert.equal(recovered.status,200,'Recovery reservation must be released after rejected attachment');assert.equal(f.launches(),0);
});
