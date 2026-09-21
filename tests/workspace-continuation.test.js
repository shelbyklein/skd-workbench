import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,writeFileSync,readFileSync,rmSync,realpathSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {CodexRuns} from '../lib/codex.js';
import {TerminalSessions} from '../lib/terminals.js';
import {benchmarkContext} from '../lib/benchmarks.js';
const provider={version:'fixture',models:[{id:'fixture',efforts:['low']}]};
const input={agent:'codex',model:'fixture',effort:'low',mode:'worktree',task:'Continue the original task'};
const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function until(fn){for(let i=0;i<200;i++){const value=fn();if(value)return value;await delay(10);}throw Error('Fixture did not reach pending boundary');}
async function fixture(t){
 const root=realpathSync(mkdtempSync(path.join(tmpdir(),'skd-continuation-'))),repo=path.join(root,'repo'),directory=path.join(root,'data');
 execFileSync('git',['init','-b','main',repo]);writeFileSync(path.join(repo,'file.txt'),'source\n');execFileSync('git',['-C',repo,'add','.']);execFileSync('git',['-C',repo,'-c','user.name=Test','-c','user.email=test@example.invalid','commit','-m','fixture']);
 const codex=new CodexRuns(directory,{discover:async()=>provider}),project={id:'project',name:'Fixture',folderPath:repo},managers=[],cleanup=[];let launches=0;
 function manager(){const m=new TerminalSessions(directory,codex,{discover:async()=>provider,spawn:()=>{launches++;return {pid:987654,onData(){},onExit(){},kill(){},write(){},resize(){}};}});managers.push(m);return m;}
 t.after(async()=>{for(const close of cleanup)await close();for(const m of managers)m.shutdown();codex.shutdown();rmSync(root,{recursive:true,force:true});});
 const first=manager(),run=await first.start({...input,task:'Original task'},project);first.shutdown();
 writeFileSync(path.join(run.worktreePath,'file.txt'),'retained changes\n');writeFileSync(path.join(run.worktreePath,'untracked.txt'),'retained untracked\n');
 const workspace={workingDirectory:run.worktreePath,worktreePath:run.worktreePath,branch:run.branch,sourceContext:await benchmarkContext(project,'read-only'),workspaceRegistrationID:run.workspaceRegistrationID,workspaceOwnerKey:run.workspaceOwnerKey,taskID:'original-task-id'};
 return {root,repo,directory,codex,project,workspace,manager,cleanup,launches:()=>launches};
}
test('dirty continuation preserves the worktree, UUID, task and source while linking the new terminal',async t=>{
 const f=await fixture(t),before=execFileSync('git',['-C',f.repo,'worktree','list','--porcelain'],{encoding:'utf8'});
 writeFileSync(path.join(f.repo,'file.txt'),'unrelated source changes\n');
 const m=f.manager(),run=await m.start(input,f.project,{workspace:f.workspace,shouldLaunch:async()=>true});
 assert.equal(run.worktreePath,f.workspace.worktreePath);assert.equal(run.workspaceRegistrationID,f.workspace.workspaceRegistrationID);assert.equal(run.taskID,f.workspace.taskID);assert.equal(run.workspaceOwnerKey,f.workspace.workspaceOwnerKey);assert.equal(run.continued,true);
 assert.equal(execFileSync('git',['-C',f.repo,'worktree','list','--porcelain'],{encoding:'utf8'}),before);
 assert.equal(readFileSync(path.join(f.repo,'file.txt'),'utf8'),'unrelated source changes\n');assert.equal(readFileSync(path.join(run.worktreePath,'file.txt'),'utf8'),'retained changes\n');assert.equal(readFileSync(path.join(run.worktreePath,'untracked.txt'),'utf8'),'retained untracked\n');
 const record=f.codex.workspaceNotes.get(run.workspaceRegistrationID);assert(record.sources.some(s=>s.kind==='terminal'&&s.id===run.id));assert.equal(record.purpose,'Original task');assert.equal(f.codex.workspaceNotes.list().length,1);
});
for(const boundary of ['shouldLaunch','verify'])test(`cancelling continuation during ${boundary} prevents provider launch`,async t=>{
 const f=await fixture(t),m=f.manager();let release;const internal={workspace:f.workspace};
 if(boundary==='shouldLaunch'){let calls=0;internal.shouldLaunch=()=>++calls===1?new Promise(resolve=>{release=()=>resolve(true);}):true;}
 else {const verify=f.codex.workspaceNotes.verify.bind(f.codex.workspaceNotes);let calls=0;f.codex.workspaceNotes.verify=async(...args)=>{if(++calls===2)await new Promise(resolve=>{release=resolve;});return verify(...args);};}
 const result=m.start(input,f.project,internal).then(value=>({value}),error=>({error}));await until(()=>release);m.stop(m.runs.at(-1).id);release();
 // A second callback must not conceal cancellation or cause another prompt wait.
 if(boundary==='shouldLaunch')internal.shouldLaunch=async()=>true;
 const outcome=await result;assert(outcome.error);assert.equal(f.launches(),1);assert.equal(m.runs.at(-1).status,'cancelled');
});
for(const mutation of ['project','owner','directory','benchmark'])test(`continuation rejects mismatched ${mutation} without launching`,async t=>{
 const f=await fixture(t),m=f.manager(),workspace={...f.workspace},project={...f.project};
 if(mutation==='project')project.id='different-project';if(mutation==='owner')workspace.workspaceOwnerKey='different-owner';if(mutation==='directory')workspace.workingDirectory=f.repo;if(mutation==='benchmark')project.benchmark={};
 await assert.rejects(m.start(input,project,{workspace}));assert.equal(f.launches(),1);
});
test('ordinary HTTP terminal launch cannot pass a trusted continuation workspace',async t=>{
 const {createServer}=await import('../server.js');const f=await fixture(t);let launches=0;
 const server=createServer({directory:path.join(f.root,'http-data'),terminalOptions:{discover:async()=>provider,spawn:()=>{launches++;throw Error('Unexpected provider launch');}}});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));f.cleanup.push(async()=>{server.shutdownCodex();server.closeAllConnections();await new Promise(resolve=>server.close(resolve));});const base=`http://127.0.0.1:${server.address().port}`;
 const post=(route,body)=>fetch(base+'/api/'+route,{method:'POST',headers:{origin:base,'content-type':'application/json'},body:JSON.stringify(body)});
 const project=await(await post('projects',{name:'HTTP fixture',folderPath:f.repo})).json();writeFileSync(path.join(f.repo,'file.txt'),'dirty source\n');
 const response=await post('terminal-sessions',{...input,projectID:project.id,workspace:f.workspace,internal:{workspace:f.workspace}});
 assert.equal(response.status,400);assert.match(JSON.stringify(await response.json()),/clean Git/);assert.equal(launches,0);
});
