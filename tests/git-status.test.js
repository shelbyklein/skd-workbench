import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,writeFileSync,readFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {inspectRepository} from '../lib/worktrees.js';
import {readGit} from '../lib/git-read.js';

export const git=(cwd,...args)=>execFileSync('git',['-C',cwd,...args],{encoding:'utf8',stdio:['ignore','pipe','pipe']}).trim();
export function fixture(t){
 const base=mkdtempSync(path.join(tmpdir(),'skd-status-')),root=path.join(base,'main');mkdirSync(root);
 t.after(()=>rmSync(base,{recursive:true,force:true}));git(root,'init','-b','main');git(root,'config','user.name','Fixture');git(root,'config','user.email','fixture@example.invalid');
 writeFileSync(path.join(root,'file'),'base');git(root,'add','.');git(root,'commit','-m','initial');return {base,root};
}
const commit=(root,text)=>{writeFileSync(path.join(root,'file'),text);git(root,'add','.');git(root,'commit','-m',text);return git(root,'rev-parse','HEAD');};
test('inventory distinguishes unchecked branches, worktrees, upstream and target without writing the index',async t=>{
 const {base,root}=fixture(t);git(root,'remote','add','origin','https://example.invalid/repo');git(root,'update-ref','refs/remotes/origin/main','HEAD');git(root,'symbolic-ref','refs/remotes/origin/HEAD','refs/remotes/origin/main');git(root,'branch','--set-upstream-to=origin/main');
 git(root,'branch','never-checked-out');const work=path.join(base,'work tree\nwith newline');git(root,'worktree','add','-b','feature',work);commit(work,'feature');
 writeFileSync(path.join(work,'file'),'staged');git(work,'add','.');writeFileSync(path.join(work,'file'),'unstaged');writeFileSync(path.join(work,'? new\nfile'),'new');
 const index=readFileSync(path.join(root,'.git','index')),refs=git(root,'show-ref');const s=await inspectRepository(root);
 assert.equal(s.target.ref,'refs/heads/main');assert.equal(s.defaultBranch,'main');assert.equal(s.current.dirty,false);assert.equal(s.summary.branchesWithCommits,1);assert.equal(s.summary.worktrees,2);assert.equal(s.summary.dirtyWorktrees,1);
 assert.equal(s.branches.find(b=>b.name==='never-checked-out').worktreeIDs.length,0);assert.equal(s.branches.find(b=>b.name==='main').upstreamComparison.state,'equal');
 const w=s.worktrees.find(w=>w.branch==='feature');assert.equal(w.path,work.replace(/^\/var\//,'/private/var/'));assert.deepEqual(w.changes,{staged:1,unstaged:1,untracked:1,conflicts:0});assert.equal(w.comparison.ahead,1);assert.equal(s.partial,false);
 assert.deepEqual(readFileSync(path.join(root,'.git','index')),index);assert.equal(git(root,'show-ref'),refs);
});
test('conflicts and merge operations are reported independently of dirty branches',async t=>{
 const {root}=fixture(t);git(root,'checkout','-b','feature');commit(root,'feature');git(root,'checkout','main');commit(root,'main');assert.throws(()=>git(root,'merge','feature'));
 const s=await inspectRepository(root);assert.equal(s.current.changes.conflicts,1);assert.equal(s.summary.conflictedWorktrees,1);assert.equal(s.summary.operationWorktrees,1);assert.deepEqual(s.current.operations,['Merge']);assert.equal(s.branches.find(b=>b.name==='feature').comparison.state,'diverged');
 git(root,'add','file');const resolved=await inspectRepository(root);assert.equal(resolved.current.changes.conflicts,0);assert.deepEqual(resolved.current.operations,['Merge']);
});
test('detached, locked, missing, contained and capped inventory never implies complete coverage',async t=>{
 const {root,base}=fixture(t);git(root,'branch','old');commit(root,'main advanced');const work=path.join(base,'detached');git(root,'worktree','add','--detach',work);commit(work,'detached work');git(root,'worktree','lock',work);
 let s=await inspectRepository(root);assert.equal(s.summary.detachedWithCommits,1);assert.equal(s.worktrees.find(w=>w.detached).locked,true);assert.equal(s.branches.find(b=>b.name==='old').comparison.state,'contained');
 s=await inspectRepository(root,{limit:1,worktreeLimit:1});assert.equal(s.truncated,true);assert.equal(s.partial,true);assert.equal(s.current.current,true);
 rmSync(work,{recursive:true});s=await inspectRepository(root);assert.equal(s.worktrees.find(w=>w.detached).available,false);assert.equal(s.partial,true);
});
test('unborn, non-Git, missing, invalid and ambiguous targets remain explicit',async t=>{
 const {base,root}=fixture(t);const empty=path.join(base,'empty');mkdirSync(empty);assert.equal((await inspectRepository(empty)).status,'not-repository');git(empty,'init','-b','main');
 let s=await inspectRepository(empty);assert.equal(s.current.commit,null);assert.equal(s.current.branch,'main');assert.equal(s.target,null);
 assert.equal((await inspectRepository(path.join(base,'missing'))).status,'unavailable');
 await assert.rejects(inspectRepository(root,{targetRef:'--upload-pack=evil'}),/target/);await assert.rejects(inspectRepository(root,{remoteName:'unknown'}),/Remote/);
 git(root,'branch','master');s=await inspectRepository(root);assert.equal(s.target,null);s=await inspectRepository(root,{targetRef:'refs/heads/main'});assert.equal(s.target.name,'main');
});
test('squash merges are not labeled contained; unrelated and shallow history do not manufacture counts',async t=>{
 const {root,base}=fixture(t);git(root,'checkout','-b','feature');commit(root,'feature 1');commit(root,'feature 2');git(root,'checkout','main');git(root,'merge','--squash','feature');git(root,'commit','-m','squashed');
 let s=await inspectRepository(root);assert.equal(s.branches.find(b=>b.name==='feature').comparison.state,'diverged');
 git(root,'checkout','--orphan','unrelated');git(root,'add','.');git(root,'commit','-m','unrelated');s=await inspectRepository(root);assert.equal(s.current.comparison.state,'unrelated');assert.equal(s.partial,true);
 const clone=path.join(base,'shallow');git(base,'clone','--depth=1','--branch','main',`file://${root}`,clone);git(clone,'config','user.name','Fixture');git(clone,'config','user.email','fixture@example.invalid');git(clone,'branch','old');commit(clone,'advanced');s=await inspectRepository(clone);assert.equal(s.shallow,true);assert.equal(s.branches.find(b=>b.name==='old').comparison.state,'unknown');
});
test('read failures and refs moving during inspection mark incomplete or stale snapshots',async t=>{
 const {root}=fixture(t);let reads=0;
 const run=async(cwd,args,opts)=>{if(args[0]==='for-each-ref'&&++reads===2)git(root,'branch','concurrent');return readGit(cwd,args,opts);};
 assert.equal((await inspectRepository(root,{run})).stale,true);
 const failStatus=(cwd,args,opts)=>args[0]==='status'?Promise.resolve({ok:false}):readGit(cwd,args,opts);
 const s=await inspectRepository(root,{run:failStatus});assert.equal(s.current.dirty,null);assert.equal(s.partial,true);
});
