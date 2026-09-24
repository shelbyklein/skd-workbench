import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {ReconcileLimits,defaultLimits} from '../lib/reconcile-limits.js';
import {gitDrift} from '../public/git-status-ui.js';

test('reconcile warning limits default, save per project, validate and survive a reload',t=>{
 const dir=mkdtempSync(path.join(tmpdir(),'skd-limits-'));t.after(()=>rmSync(dir,{recursive:true,force:true}));
 const limits=new ReconcileLimits(dir);
 assert.deepEqual(limits.get('p1'),defaultLimits);
 assert.deepEqual(limits.save('p1',{unmerged:1}),{...defaultLimits,unmerged:1});
 for(const bad of [{unmerged:0},{behind:1.5},{remote:'3'},{other:2}])assert.throws(()=>limits.save('p1',bad),/limit|Unknown/);
 const reloaded=new ReconcileLimits(dir);assert.equal(reloaded.get('p1').unmerged,1);assert.deepEqual(reloaded.get('p2'),defaultLimits);
 assert.deepEqual(reloaded.all(),{defaults:defaultLimits,projects:{p1:{...defaultLimits,unmerged:1}}});
 writeFileSync(path.join(dir,'reconcile-limits.json'),'{broken');assert.throws(()=>new ReconcileLimits(dir),/damaged/);
});

test('the Home warning follows the project limits',()=>{
 const status={target:{ref:'refs/heads/main',name:'main'},current:{available:true,branch:'main'},branches:[{ref:'refs/heads/main'},{ref:'refs/heads/a',comparison:{ahead:2,behind:0}}]};
 assert.deepEqual(gitDrift(status).reasons,[],'One unmerged branch is under the default limit of 3.');
 assert.deepEqual(gitDrift(status,{...defaultLimits,unmerged:1}).reasons,['1 branches have unmerged commits']);
});
