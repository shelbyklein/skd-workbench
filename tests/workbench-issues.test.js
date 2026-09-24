import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync,readFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {WorkbenchIssues} from '../lib/issues.js';
import {ControllerCommands} from '../lib/controller-commands.js';

// The coordinator files issues about Workbench itself on the Workbench repository, once per requestKey.
function fixture(t,{fail=false}={}){
 const dir=mkdtempSync(path.join(tmpdir(),'skd-wb-issues-'));t.after(()=>rmSync(dir,{recursive:true,force:true}));
 const calls=[],github={request:async(endpoint,method,payload)=>{calls.push({endpoint,method,payload});if(fail)throw new Error('GitHub sign-in is unavailable.');await new Promise(r=>setTimeout(r,10));return {number:41,html_url:'https://github.com/owner/skd-workbench/issues/41',title:payload.title};}};
 return {dir,calls,issues:new WorkbenchIssues(dir,{github,repository:async()=>'owner/skd-workbench'})};
}

test('files on the Workbench repository and never twice for one requestKey',async t=>{
 const f=fixture(t);
 const [a,b]=await Promise.all([f.issues.create({requestKey:'k1',title:' Chat loses drafts ',body:'Steps: type, switch page.'}),f.issues.create({requestKey:'k1',title:'Chat loses drafts',body:'x'})]);
 assert.equal(f.calls.length,1,'Concurrent retries share one request.');
 assert.deepEqual(f.calls[0].endpoint,'repos/owner/skd-workbench/issues');assert.equal(f.calls[0].method,'POST');
 assert.equal(f.calls[0].payload.title,'Chat loses drafts');assert.match(f.calls[0].payload.body,/^Steps: type, switch page\.\n\n_Filed by the SKD Workbench coordinator\._$/);
 assert.equal(a.number,41);assert.equal(b.url,a.url);
 const again=await f.issues.create({requestKey:'k1',title:'Chat loses drafts',body:'x'});assert.equal(again.duplicate,true);assert.equal(f.calls.length,1);
 assert.equal(JSON.parse(readFileSync(path.join(f.dir,'workbench-issues.json'),'utf8'))[0].number,41,'Filed issues survive a restart.');
 assert.equal((await new WorkbenchIssues(f.dir,{github:{request:()=>{throw new Error('must not file');}},repository:async()=>'owner/skd-workbench'}).create({requestKey:'k1',title:'t',body:''})).number,41);
});

test('a failed request records nothing, so it can be retried',async t=>{
 const f=fixture(t,{fail:true});
 await assert.rejects(f.issues.create({requestKey:'k2',title:'t',body:'b'}),/sign-in/);
 assert.equal(f.issues.records.length,0);
});

test('only a controller granted every connected project can file',async t=>{
 const f=fixture(t),projects=[{id:'p1',folderPath:'/a'},{id:'p2',folderPath:'/b'}];
 const commands=Object.assign(Object.create(ControllerCommands.prototype),{store:{snapshot:()=>({projects})},workbenchIssues:f.issues,controllers:{},codex:{}});
 await assert.rejects(commands.execute({id:'c',projectIDs:['p1'],capabilities:['manage']},'create_workbench_issue',{requestKey:'k3',title:'t',body:'b'}),/every connected project/);
 assert.equal((await commands.execute({id:'c',projectIDs:['p1','p2'],capabilities:['manage']},'create_workbench_issue',{requestKey:'k3',title:'t',body:'b'})).number,41);
});
