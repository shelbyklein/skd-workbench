import test from 'node:test';
import assert from 'node:assert/strict';
import {branchWork} from '../lib/branch-work.js';

const c=n=>String(n).repeat(40);
const snapshot={status:'connected',root:'/repo',target:{ref:'refs/heads/main',name:'main',commit:c(1)},
 worktrees:[{id:'w1',path:'/repo/.wt/a',current:false,dirty:true,changes:{staged:1,unstaged:2,untracked:0,conflicts:0}}],
 branches:[
  {ref:'refs/heads/main',name:'main',commit:c(1),comparison:{ahead:0,behind:0},worktreeIDs:[]},
  {ref:'refs/heads/old',name:'old',commit:c(2),comparison:{ahead:1,behind:4},worktreeIDs:[]},
  {ref:'refs/heads/merged',name:'merged',commit:c(3),comparison:{ahead:0,behind:2},worktreeIDs:[]},
  {ref:'refs/heads/new',name:'new',commit:c(4),comparison:{ahead:7,behind:0},worktreeIDs:['w1']}
 ]};
const logs={[c(6)]:'400\0Ship the widget\n',[c(2)]:'100\0Old change\n',[c(4)]:'300\0Latest step\n200\0First step\n'};
const run=async(folder,args)=>{assert.equal(folder,'/repo');
 if(args[0]==='rev-parse')return {ok:true,value:'maintree'};
 if(args[0]==='log'&&!args.some(a=>a.includes('..')))return {ok:true,value:'Earlier work\nShip the widget (#12)\n'};
 if(args[0]==='merge-tree')return {ok:true,value:args[3]===c(5)?'maintree\n':'othertree\n'};
 const range=args.find(a=>a.includes('..'));return {ok:true,value:logs[range.split('..')[1]]};};

test('lists unmerged branches newest first with their commit subjects and worktree',async()=>{
 const result=await branchWork(snapshot,{run});
 assert.equal(result.target,'main');assert.equal(result.total,2);
 assert.deepEqual(result.branches.map(b=>b.name),['new','old']);
 assert.deepEqual(result.branches[0].subjects,['Latest step','First step']);
 assert.equal(result.branches[0].lastCommitAt,new Date(300000).toISOString());
 assert.deepEqual(result.branches[0].worktree,{path:'/repo/.wt/a',current:false,dirty:true,changes:3});
 assert.equal(result.branches[1].worktree,null);assert.equal(result.branches[1].behind,4);
});
test('skips a branch whose changes are already in main, such as after a squash merge',async()=>{
 const result=await branchWork({...snapshot,branches:[...snapshot.branches,{ref:'refs/heads/squashed',name:'squashed',commit:c(5),comparison:{ahead:3,behind:1},worktreeIDs:[]},{ref:'refs/heads/titled',name:'titled',commit:c(6),comparison:{ahead:1,behind:5},worktreeIDs:[]}]},{run});
 assert.deepEqual(result.branches.map(b=>b.name),['new','old']);assert.equal(result.total,2);
});
test('reports why nothing is listed',async()=>{
 assert.equal((await branchWork({status:'not-repository',message:'Not Git.'})).message,'Not Git.');
 assert.equal((await branchWork({...snapshot,target:null})).status,'no-target');
});
