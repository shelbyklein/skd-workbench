import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,readFileSync,rmSync,writeFileSync,realpathSync,existsSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {createServer} from '../server.js';
import {projectSessionArgs,projectFreeTools} from '../lib/coordinator-sessions.js';
const delay=ms=>new Promise(r=>setTimeout(r,ms));
const fixture=path.resolve('tests/fixtures/coordinator-cli.mjs');
const catalog=async()=>({version:'fixture',models:[{id:'fixture',efforts:['low','default']},{id:'other',efforts:['low']}]});
async function boot(root){
 const server=createServer({directory:path.join(root,'data'),codexOptions:{binary:fixture,discover:catalog},claudeOptions:{binary:fixture,discover:catalog}});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const url='http://127.0.0.1:'+server.address().port;
 const api=async(route,input,method)=>{const res=await fetch(url+'/api/'+route,{method:method||(input?'POST':'GET'),headers:{'Content-Type':'application/json'},...(input?{body:JSON.stringify(input)}:{})});return {status:res.status,body:await res.json()};};
 return {server,url,api,close:async()=>{server.shutdownCodex();server.closeAllConnections();await new Promise(r=>server.close(r));await delay(150);}};
}
async function setup(t,names=['Austin','Newton']){
 const root=mkdtempSync(path.join(tmpdir(),'skd-project-agents-')),log=path.join(root,'fixture.log');process.env.COORDINATOR_FIXTURE_LOG=log;
 const f={root,log,...await boot(root)};t.after(async()=>{await f.close();delete process.env.COORDINATOR_FIXTURE_LOG;rmSync(root,{recursive:true,force:true});});
 f.projects={};
 for(const name of names){const folder=path.join(root,name.toLowerCase());mkdirSync(folder);writeFileSync(path.join(folder,'CLAUDE.md'),`# ${name}\nThe ${name} website.`);f.projects[name]=(await f.api('projects',{name,folderPath:folder})).body;}
 f.enable=async(provider='claude')=>{const v=(await f.api('coordinator')).body;return f.api('coordinator',{version:v.version,enabled:true,provider,model:'fixture',effort:'low'},'PUT');};
 f.settings=async(name,input)=>{const id=f.projects[name].id,v=(await f.api(`projects/${id}/agent-settings`)).body;return f.api(`projects/${id}/agent-settings`,{version:v.version,provider:'claude',model:'fixture',effort:'low',workspace:'folder',...input},'PUT');};
 f.thread=key=>f.api(key==='coordinator'?'coordinator/messages':'projects/'+key+'/messages').then(r=>r.body.items);
 f.until=async(check,label,tries=400)=>{for(let i=0;i<tries;i++){const v=await check();if(v)return v;await delay(25);}throw Error('Timed out: '+label);};
 f.sessions=()=>existsSync(log)?readFileSync(log,'utf8').trim().split('\n').map(l=>JSON.parse(l)).filter(e=>e.mode==='session'):[];
 f.agent=name=>f.api(`projects/${f.projects[name].id}/agent`).then(r=>r.body.coordinator);
 return f;
}

test('project agent args use the normal CLI in the project folder plus the Workbench MCP server',()=>{
 const server={command:'node',args:['bridge.mjs','cred.json']};
 const claude=projectSessionArgs('claude',{model:'opus',effort:'high',system:'S',prompt:'P',server,cwd:'/p'});
 for(const flag of ['--strict-mcp-config','--tools','--permission-mode','--setting-sources','--system-prompt','--disable-slash-commands'])assert(!claude.includes(flag),flag);
 assert.equal(claude[claude.indexOf('--append-system-prompt')+1],'S');assert.deepEqual(Object.keys(JSON.parse(claude[claude.indexOf('--mcp-config')+1]).mcpServers),['workbench']);
 assert.deepEqual(claude.slice(claude.indexOf('--allowedTools')+1,claude.indexOf('--model')),projectFreeTools.map(t=>'mcp__workbench__'+t));
 assert(projectFreeTools.includes('report_to_orchestrator')&&!projectFreeTools.includes('start_run'));assert.deepEqual(claude.slice(-2),['--','P']);
 assert(!projectSessionArgs('claude',{model:'m',effort:'default',system:'S',prompt:'',server,cwd:'/p'}).includes('--'),'No prompt when opened without a message.');
 const codex=projectSessionArgs('codex',{model:'gpt',effort:'low',system:'S',prompt:'P',server,cwd:'/p'});
 assert(!codex.some(a=>/sandbox|approval_policy|dangerously|shell_tool/.test(a)));assert.equal(codex[codex.indexOf('--cd')+1],'/p');
 assert(codex.includes('mcp_servers.workbench.command="node"'));assert(codex.some(a=>a.startsWith('hooks.PermissionRequest=')));
});

test('per-project agent settings validate, persist, fall back and end a live session when changed',async t=>{
 const f=await setup(t);await f.enable();const id=f.projects.Austin.id;
 assert.deepEqual((await f.api(`projects/${id}/agent-settings`)).body.agent,{provider:'claude',model:'fixture',effort:'low',workspace:'folder',inherited:true});
 assert.equal((await f.settings('Austin',{model:'missing'})).status,400);assert.equal((await f.settings('Austin',{workspace:'elsewhere'})).status,400);
 assert.equal((await f.api(`projects/${id}/agent-settings`,{version:99,provider:'claude',model:'fixture',effort:'low',workspace:'folder'},'PUT')).status,409);
 assert.equal((await f.api('projects/missing/agent-settings',{version:0,provider:'claude',model:'fixture',effort:'low',workspace:'folder'},'PUT')).status,404);
 const saved=await f.settings('Austin',{provider:'codex',model:'other',effort:'low'});assert.equal(saved.status,200,JSON.stringify(saved.body));assert.equal(saved.body.agent.inherited,false);
 await f.api(`projects/${id}/messages`,{text:'hello austin',requestKey:'a1'});const live=await f.until(async()=>(await f.agent('Austin')).session,'austin session');assert.equal(live.provider,'codex');assert.equal(live.model,'other');
 await f.settings('Austin',{provider:'claude',model:'fixture'});await f.until(async()=>!(await f.agent('Austin')).session,'session ended by settings');
 assert.equal((await f.agent('Austin')).history[0].endReason,'settings');
 await f.close();Object.assign(f,await boot(f.root));
 assert.deepEqual((await f.api(`projects/${id}/agent-settings`)).body.agent,{provider:'claude',model:'fixture',effort:'low',workspace:'folder',inherited:false});
});

test('project agents work in their folder, report to the orchestrator, and run side by side',async t=>{
 const f=await setup(t);await f.enable();
 await f.api(`projects/${f.projects.Austin.id}/messages`,{text:'fix the banner',requestKey:'a1'});
 const coordinator=await f.until(async()=>{const t=await f.thread('coordinator');return t.find(m=>/Update: Done: fix the banner/.test(m.text))&&t;},'austin report');
 const report=coordinator.find(m=>/Update: Done: fix the banner/.test(m.text));assert.equal(report.controllerName,'Austin agent');assert.deepEqual(report.refs,[{kind:'project',id:f.projects.Austin.id}]);
 const austin=f.sessions().find(s=>s.role==='project');assert.equal(realpathSync(austin.cwd),realpathSync(f.projects.Austin.folderPath));
 await f.api(`projects/${f.projects.Newton.id}/messages`,{text:'update copy',requestKey:'n1'});await f.until(async()=>(await f.thread('coordinator')).some(m=>/Done: update copy/.test(m.text)),'newton report');
 assert.equal((await f.agent('Austin')).session.status,'running');assert.equal((await f.agent('Newton')).session.status,'running','Two projects run at the same time.');
 await f.api(`projects/${f.projects.Austin.id}/messages`,{text:'and the footer',requestKey:'a2'});await f.until(async()=>(await f.thread('coordinator')).some(m=>/Done: and the footer/.test(m.text)),'second austin request');
 assert.equal(f.sessions().filter(s=>s.role==='project').length,2,'A second request goes to the same Austin session.');
 const grants=(await f.api('controllers')).body.controllers.filter(c=>/ agent$/.test(c.name));assert.deepEqual(grants.map(g=>[g.name,g.projectIDs.length,g.capabilities.join()]).sort(),[['Austin agent',1,'read,report'],['Newton agent',1,'read,report']]);
});

test('the orchestrator routes pasted email text, relays a question and forwards the answer',async t=>{
 const f=await setup(t);await f.enable();
 await f.api('coordinator/messages',{text:'I got an email about Austin: change the hours banner',requestKey:'o1'});
 await f.until(async()=>(await f.thread('coordinator')).some(m=>m.text==='Passed to Austin.'),'routed');
 const handoff=(await f.thread(f.projects.Austin.id)).at(0);assert.match(handoff.text,/^From the orchestrator: I got an email about Austin/);assert.equal(handoff.controllerName,'Orchestrator');
 await f.until(async()=>(await f.thread('coordinator')).some(m=>m.controllerName==='Austin agent'&&/Update: Done: I got an email about Austin/.test(m.text)),'relayed update');
 const austin=f.sessions().find(s=>s.role==='project');assert.equal(realpathSync(austin.cwd),realpathSync(f.projects.Austin.folderPath));
 await f.api('coordinator/messages',{text:'email about Newton: ask me which colours',requestKey:'o2'});
 await f.until(async()=>(await f.thread('coordinator')).some(m=>/^Question: Which option for: \[?.*email about Newton/.test(m.text)||/Question: Which option for: email about Newton/.test(m.text)),'question');
 await f.api('coordinator/messages',{text:'reply to Newton: blue and gold',requestKey:'o3'});
 await f.until(async()=>(await f.thread('coordinator')).some(m=>/Update: Done: blue and gold/.test(m.text)),'answer forwarded');
 assert.match((await f.thread(f.projects.Newton.id)).map(m=>m.text).join('\n'),/From the orchestrator: blue and gold/);
 assert.equal((await f.agent('Austin')).session.status,'running');assert.equal((await f.agent('Newton')).session.status,'running');
});

test('dedicated worktree is created once and reused; non-Git folders fail visibly',async t=>{
 const f=await setup(t,['Austin','Plain']);await f.enable();const folder=f.projects.Austin.folderPath;
 for(const args of [['init','-q','-b','main'],['-c','user.email=t@t','-c','user.name=t','commit','-q','--allow-empty','-m','init']])execFileSync('git',['-C',folder,...args]);
 assert.equal((await f.settings('Austin',{workspace:'worktree'})).status,200);
 await f.api(`projects/${f.projects.Austin.id}/messages`,{text:'in a worktree',requestKey:'w1'});await f.until(async()=>(await f.thread('coordinator')).some(m=>/Done: in a worktree/.test(m.text)),'worktree report');
 const destination=path.join(f.root,'data','project-agent-worktrees',f.projects.Austin.id);
 assert.equal(realpathSync(f.sessions().at(-1).cwd),realpathSync(destination));assert.match(execFileSync('git',['-C',folder,'branch','--list','agent/austin']).toString(),/agent\/austin/);
 const live=(await f.agent('Austin')).session;await f.api('coordinator/sessions/'+live.id+'/stop',{});await f.until(async()=>!(await f.agent('Austin')).session,'stopped');
 await f.api(`projects/${f.projects.Austin.id}/messages`,{text:'again',requestKey:'w2'});await f.until(async()=>(await f.thread('coordinator')).some(m=>/Done: again/.test(m.text)),'reused');
 assert.equal(realpathSync(f.sessions().at(-1).cwd),realpathSync(destination),'The same worktree is reused.');
 await f.settings('Plain',{workspace:'worktree'});const plain=await f.api(`projects/${f.projects.Plain.id}/messages`,{text:'x',requestKey:'p1'});
 assert.equal(plain.status,201);assert.match(plain.body.deliveryError,/needs a Git repository/);
});

test('per-project lock: a project agent blocks other agent work in its project only, and vice versa',async t=>{
 const f=await setup(t);await f.enable('codex');
 const flow=pid=>f.api('flows',{projectID:pid,name:'Review',steps:[{id:'review',type:'agent',name:'Review',model:'fixture',effort:'low',instructions:'Review'},{id:'accept',type:'human',name:'Accept',instructions:'Check',maxRetries:1,retryFrom:'review'}]}).then(r=>r.body);
 const launch=async(project,fl)=>f.api('workflows',{flowID:fl.id,flowVersion:fl.version,projectID:project.id,projectVersion:project.version,task:'Task',acceptance:'Check',mode:'read-only',maxAttempts:1,requestKey:'launch-'+project.id,config:{review:{model:'fixture',effort:'low'}}});
 await f.api(`projects/${f.projects.Austin.id}/messages`,{text:'working',requestKey:'l1'});await f.until(async()=>(await f.agent('Austin')).session,'austin live');
 const blocked=await launch(f.projects.Austin,await flow(f.projects.Austin.id));assert.equal(blocked.status,409);assert.match(blocked.body.error,/project agent is working in this project/);
 const newtonFlow=await flow(f.projects.Newton.id),started=await launch(f.projects.Newton,newtonFlow);assert.equal(started.status,202,JSON.stringify(started.body));
 await f.until(async()=>(await f.api('workflows/'+started.body.id)).body.status==='waiting','newton workflow waiting');
 const refused=await f.api(`projects/${f.projects.Newton.id}/messages`,{text:'please start',requestKey:'n1'});assert.match(refused.body.deliveryError,/Another session or workflow is running in this project/);
 assert.equal((await f.agent('Austin')).session.status,'running','Austin keeps working while Newton has a workflow.');
});

test('get_project_instructions reads the project CLAUDE.md for routing',async t=>{
 const f=await setup(t);await f.enable();
 await f.api('coordinator/messages',{text:'email about Newton: hello',requestKey:'i1'});await f.until(async()=>(await f.thread('coordinator')).some(m=>m.text==='Passed to Newton.'),'routed');
 const receipts=(await f.api('controllers')).body.controllers.find(c=>c.name==='Workbench coordinator');assert(receipts,'coordinator grant exists');
 const log=readFileSync(path.join(f.root,'data','controllers.json'),'utf8');assert.match(log,/get_project_instructions/);
});

test('a project agent the user stopped stays stopped: orchestrator messages wait until the user starts it',async t=>{
 const f=await setup(t);await f.enable();const austin=f.projects.Austin.id;
 await f.api(`projects/${austin}/messages`,{text:'first job',requestKey:'s1'});await f.until(async()=>(await f.thread('coordinator')).some(m=>/Done: first job/.test(m.text)),'first report');
 const live=(await f.agent('Austin')).session;await f.api('coordinator/sessions/'+live.id+'/stop',{});await f.until(async()=>!(await f.agent('Austin')).session,'stopped');
 const before=f.sessions().filter(s=>s.role==='project').length;
 await f.api('coordinator/messages',{text:'email about Austin: new hours',requestKey:'s2'});
 await f.until(async()=>(await f.thread(austin)).some(m=>/^From the orchestrator: email about Austin: new hours/.test(m.text)),'held message saved in the conversation');
 await delay(400);assert.equal((await f.agent('Austin')).session,null,'The orchestrator cannot start an agent the user stopped.');assert.equal(f.sessions().filter(s=>s.role==='project').length,before);
 // The user's own message starts it; the held orchestrator message follows.
 await f.api(`projects/${austin}/messages`,{text:'back to work',requestKey:'s3'});
 await f.until(async()=>{const t=await f.thread('coordinator');return t.some(m=>/Done: back to work[\s\S]*email about Austin: new hours/.test(m.text));},'held message delivered after the user started it');
 // Stopped again, Start session (the user's button) also releases it.
 const again=(await f.agent('Austin')).session;await f.api('coordinator/sessions/'+again.id+'/stop',{});await f.until(async()=>!(await f.agent('Austin')).session,'stopped again');
 assert.equal((await f.api('coordinator/sessions',{threadKey:austin})).status,201);await f.until(async()=>(await f.agent('Austin')).session,'started by the user');
});
