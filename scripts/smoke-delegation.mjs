// Explicit real-provider smoke: consumes account usage. Never included in npm test.
import {mkdtempSync,mkdirSync,writeFileSync,readFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {CodexRuns} from '../lib/codex.js';
import {Delegations} from '../lib/delegations.js';
const root=mkdtempSync(path.join(tmpdir(),'skd-delegation-live-')),repo=path.join(root,'repo'),directory=path.join(root,'data');
execFileSync('git',['init','-b','main',repo]);writeFileSync(path.join(repo,'package.json'),'{"type":"module","scripts":{"test":"node --test"}}');writeFileSync(path.join(repo,'sum.js'),'export const sum = (a,b) => a - b;\n');writeFileSync(path.join(repo,'sum.test.js'),"import test from 'node:test';import assert from 'node:assert/strict';import {sum} from './sum.js';test('addition',()=>assert.equal(sum(2,3),5));\n");execFileSync('git',['-C',repo,'add','.']);execFileSync('git',['-C',repo,'-c','user.name=Smoke','-c','user.email=smoke@example.invalid','commit','-m','smoke baseline']);mkdirSync(directory);
const codex=new CodexRuns(directory),delegations=new Delegations(directory,codex);let run;
try{
 run=await delegations.start({requestKey:'live-smoke',taskRef:'github:shelbyklein/skd-workbench#10:smoke',task:'Fix sum(a,b) so it adds two numbers. Only change sum.js. Keep the test unchanged.',acceptance:'The lead must run npm test in the retained worktree, confirm it passes, and inspect that only sum.js changed. Worker should edit the file and leave test execution to the lead.',maxRevisions:1,lead:{agent:'codex',model:'gpt-6-astra',effort:'low'},worker:{agent:'claude',model:'claude-fable-5-1[1m]',effort:'low'}},{id:'smoke',name:'Disposable delegation smoke',folderPath:repo});
 console.log(JSON.stringify({root,runID:run.id}));let previous='';const deadline=Date.now()+8*60*1000;
 while(Date.now()<deadline){run=delegations.get(run.id);const state=run.status+':'+run.phase+':'+run.attempts.length;if(state!==previous){console.log(state);previous=state;}if(!['launching','running','stopping'].includes(run.status))break;await new Promise(r=>setTimeout(r,1000));}
 mkdirSync('output',{recursive:true});writeFileSync('output/delegation-live.json',JSON.stringify({root,run},null,2));
 if(run.status!=='accepted')throw Error('Smoke did not reach accepted: '+run.status+' '+run.error);
 if(readFileSync(path.join(repo,'sum.js'),'utf8')!=='export const sum = (a,b) => a - b;\n')throw Error('Source was changed.');
 execFileSync('npm',['test'],{cwd:run.workspace.workingDirectory,stdio:'inherit'});
 console.log('Real Astra → Fable → Astra smoke accepted; independent npm test passed. Evidence and worktree retained at '+root);
}finally{delegations.shutdown();codex.shutdown();}
