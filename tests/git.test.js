import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync, readFileSync, mkdirSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { canonicalFolder, inspectFolder, safeRemote } from '../lib/projects.js';
function fixture(t){const root=mkdtempSync(path.join(tmpdir(),'skd-git-'));t.after(()=>rmSync(root,{recursive:true,force:true}));return root;}
function git(root,...args){return execFileSync('git',['-C',root,...args],{encoding:'utf8',stdio:['ignore','pipe','pipe']}).trim();}
function repo(root){git(root,'init','-b','main');writeFileSync(path.join(root,'sample.txt'),'initial');git(root,'add','.');git(root,'-c','user.name=Test','-c','user.email=test@example.invalid','commit','-m','initial');}
test('canonical local folders reject missing paths and files; support spaces and symlinks',async t=>{
 const root=fixture(t),folder=path.join(root,'folder with spaces');mkdirSync(folder);symlinkSync(folder,path.join(root,'link'));
 assert.equal(await canonicalFolder(path.join(root,'link')),await canonicalFolder(folder));
 writeFileSync(path.join(root,'file'),'x');await assert.rejects(canonicalFolder(path.join(root,'file')),/file/);
 await assert.rejects(canonicalFolder(path.join(root,'missing')),/missing/);await assert.rejects(canonicalFolder('relative'),/absolute/);
 assert.equal((await inspectFolder(folder)).git.status,'not-repository');
});
test('Git inspection records clean/dirty/detached/unborn states without rewriting the index',async t=>{
 const root=fixture(t);git(root,'init','-b','main');let c=await inspectFolder(root);assert.equal(c.git.commit,null);assert.equal(c.git.branch,'main');
 writeFileSync(path.join(root,'sample.txt'),'initial');git(root,'add','.');git(root,'-c','user.name=Test','-c','user.email=test@example.invalid','commit','-m','initial');
 const indexBefore=readFileSync(path.join(root,'.git','index'));
 c=await inspectFolder(root);assert.equal(c.git.dirty,false);assert.equal(c.git.branch,'main');assert.equal(c.git.commit,git(root,'rev-parse','HEAD'));
 assert.deepEqual(readFileSync(path.join(root,'.git','index')),indexBefore);
 writeFileSync(path.join(root,'new.txt'),'untracked');assert.equal((await inspectFolder(root)).git.dirty,true);
 git(root,'checkout','--detach');c=await inspectFolder(root);assert.equal(c.git.detached,true);assert.equal(c.git.branch,null);
});
test('worktrees have distinct roots but the same common Git directory',async t=>{
 const root=fixture(t),main=path.join(root,'main'),work=path.join(root,'work tree');mkdirSync(main);repo(main);git(main,'worktree','add','-b','feature',work);
 const a=await inspectFolder(main),b=await inspectFolder(work);assert.notEqual(a.git.root,b.git.root);assert.equal(a.git.commonDirectory,b.git.commonDirectory);assert.equal(b.git.branch,'feature');
});
test('detected remotes omit credentials, query strings and remote-helper commands',async t=>{
 const root=fixture(t);repo(root);
 git(root,'remote','add','origin','https://sample-user:sample-secret@example.com/team/repo.git?token=private#part');
 const c=await inspectFolder(root);assert.equal(c.git.remotes[0].url,'https://example.com/team/repo.git');assert.equal(c.git.remotes[0].webURL,'https://example.com/team/repo');
 assert.equal(JSON.stringify(c).includes('sample-secret'),false);assert.equal(JSON.stringify(c.git.remotes).includes('private'),false);
 assert.deepEqual(safeRemote('git@github.com:owner/repo.git'),{url:'github.com:owner/repo.git',webURL:'https://github.com/owner/repo'});
 assert.equal(safeRemote('ext::sh -c arbitrary').webURL,null);
});
