import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,writeFileSync,readFileSync,rmSync,existsSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {createServer} from '../server.js';
import {networkRemote,GitStatus} from '../lib/git-status.js';

const git=(cwd,...args)=>execFileSync('git',['-C',cwd,...args],{encoding:'utf8',stdio:['ignore','pipe','pipe']}).trim();
async function fixture(t){
 const base=mkdtempSync(path.join(tmpdir(),'skd-status-api-')),root=path.join(base,'repo');mkdirSync(root);
 git(root,'init','-b','main');git(root,'config','user.name','Fixture');git(root,'config','user.email','fixture@example.invalid');writeFileSync(path.join(root,'file'),'base');git(root,'add','.');git(root,'commit','-m','initial');git(root,'remote','add','origin','https://example.invalid/repo.git');
 const commit=git(root,'rev-parse','HEAD');let calls=0,fail=false,tip=commit,release=null;
 const server=createServer({directory:path.join(base,'data'),gitStatusOptions:{advertise:async url=>{calls++;assert.equal(url,'https://example.invalid/repo.git');if(release)await release;if(fail)throw new Error('secret-token');return {defaultBranch:'main',tips:{'refs/heads/main':tip}};}}});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 t.after(async()=>{server.shutdownCodex();server.closeAllConnections();await new Promise(r=>server.close(r));rmSync(base,{recursive:true,force:true});});
 const url=`http://127.0.0.1:${server.address().port}`,request=(route,method='GET',body,headers={})=>fetch(url+route,{method,headers:{...(body?{'Content-Type':'application/json'}:{}),...headers},body:body?JSON.stringify(body):undefined});
 const project=await(await request('/api/projects','POST',{name:'Git fixture',folderPath:root})).json();
 const route=`/api/projects/${project.id}/git-status`;
 return {root,project,request,route,calls:()=>calls,fail:()=>{fail=true;},tip:value=>{tip=value;},hold:()=>{let finish;release=new Promise(r=>{finish=r;});return finish;}};
}
test('HTTP local reads never contact remote; explicit checks compare tips without changing Git files',async t=>{
 const f=await fixture(t),index=readFileSync(path.join(f.root,'.git/index')),refs=git(f.root,'show-ref');
 const response=await f.request(f.route),s=await response.json();assert.equal(response.headers.get('cache-control'),'no-store');assert.equal(s.status,'connected');assert.equal(s.remote,null);assert.equal(f.calls(),0);assert.equal(s._remotes,undefined);assert.equal(s._identity,undefined);
 const input={snapshotID:s.snapshotID,projectVersion:f.project.version};
 const result=await(await f.request(f.route+'/remote-check','POST',input)).json();assert.equal(result.status,'observed');assert.equal(result.current.state,'equal');assert.equal(result.defaultBranch,'main');assert.equal(f.calls(),1);
 assert.equal((await(await f.request(f.route)).json()).remote.status,'observed');assert.equal(git(f.root,'show-ref'),refs);assert.deepEqual(readFileSync(path.join(f.root,'.git/index')),index);assert.equal(existsSync(path.join(f.root,'.git/FETCH_HEAD')),false);
 f.tip('a'.repeat(40));const changed=await(await f.request(f.route+'/remote-check','POST',input)).json();assert.equal(changed.current.state,'unknown');assert.equal(changed.current.ahead,null);
 f.tip(null);assert.equal((await(await f.request(f.route+'/remote-check','POST',input)).json()).current.state,'missing');
 f.fail();const failed=await(await f.request(f.route+'/remote-check','POST',input)).json();assert.equal(failed.status,'error');assert.equal(failed.previous.status,'observed');assert.doesNotMatch(JSON.stringify(failed),/secret-token/);assert.equal((await(await f.request(f.route)).json()).current.dirty,false);
});
test('HTTP scope, origin, stale identity and argument guards reject invalid remote actions',async t=>{
 const f=await fixture(t),s=await(await f.request(f.route)).json(),input={snapshotID:s.snapshotID,projectVersion:f.project.version};
 assert.equal((await f.request(f.route+'/remote-check')).status,404);
 assert.equal((await f.request(f.route+'/remote-check','POST',input,{Origin:'https://attacker.invalid'})).status,403);
 assert.equal((await f.request(f.route+'/remote-check','POST',{...input,projectVersion:999})).status,409);
 assert.equal((await f.request(f.route+'/remote-check','POST',{...input,url:'ext::evil'})).status,400);
 assert.equal((await f.request('/api/projects/unassigned/git-status/remote-check','POST',input)).status,409);
 assert.equal((await f.request(f.route+'?target=--evil')).status,409);
 git(f.root,'remote','set-url','origin','https://changed.invalid/repo');assert.equal((await f.request(f.route+'/remote-check','POST',input)).status,409);assert.equal(f.calls(),0);
 const fresh=await(await f.request(f.route)).json();writeFileSync(path.join(f.root,'draft'),'changed after local observation');
 assert.equal((await f.request(f.route+'/remote-check','POST',{snapshotID:fresh.snapshotID,projectVersion:f.project.version})).status,409);
});
test('remote checks deduplicate concurrent actions and reject results when refs move in flight',async t=>{
 const f=await fixture(t),s=await(await f.request(f.route)).json(),input={snapshotID:s.snapshotID,projectVersion:f.project.version};
 const release=f.hold();const one=f.request(f.route+'/remote-check','POST',input),two=f.request(f.route+'/remote-check','POST',input);
 while(!f.calls())await new Promise(r=>setTimeout(r,10));
 git(f.root,'branch','concurrent');release();assert.equal((await one).status,409);assert.equal((await two).status,409);assert.equal(f.calls(),1);
});
test('transport whitelist excludes secrets and arbitrary helper or local URLs',()=>{
 for(const raw of ['ext::sh -c evil','file:///tmp/repo','/tmp/repo','http://example.com/r','https://user:secret@example.com/r','https://example.com/r?token=secret','ssh://-evil/r','git@host:repo;evil','https://example.com/%0aevil'])assert.equal(networkRemote(raw),null,raw);
 assert.equal(networkRemote('git@github.com:owner/repo.git'),'ssh://git@github.com/owner/repo.git');assert.equal(networkRemote('https://github.com/owner/repo.git'),'https://github.com/owner/repo.git');
});
test('expired snapshot and unsupported remote do not perform a network request',async t=>{
 const f=await fixture(t);let clock=0,calls=0;const service=new GitStatus({clock:()=>clock,advertise:async()=>{calls++;throw new Error('unexpected');}});
 const s=await service.read(f.project);clock=300001;await assert.rejects(service.check(f.project,{snapshotID:s.snapshotID,projectVersion:f.project.version}),/expired/);
 git(f.root,'remote','set-url','origin','ext::sh -c secret');const fresh=await service.read(f.project),result=await service.check(f.project,{snapshotID:fresh.snapshotID,projectVersion:f.project.version});assert.equal(result.status,'error');assert.doesNotMatch(JSON.stringify(fresh)+JSON.stringify(result),/sh -c secret/);assert.equal(calls,0);
});
