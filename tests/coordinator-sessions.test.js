import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync,writeFileSync,readFileSync,readdirSync,existsSync,statSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {CoordinatorSessions,sessionArgs,codexConfig,freeTools,promptTools} from '../lib/coordinator-sessions.js';
import {CoordinatorAgent} from '../lib/coordinator-agent.js';

const temp=t=>{const dir=mkdtempSync(path.join(tmpdir(),'skd-coord-sessions-'));t.after(()=>rmSync(dir,{recursive:true,force:true}));return dir;};
function fakePty(){
 const spawned=[];
 const spawn=(binary,args,options)=>{let data,exit;const child={binary,args,options,writes:[],killed:[],onData:fn=>data=fn,onExit:fn=>exit=fn,write:d=>child.writes.push(d),resize(){},kill:signal=>{child.killed.push(signal||'SIGTERM');exit?.({exitCode:0});},emit:d=>data(d),exit:()=>exit({exitCode:0})};spawned.push(child);return child;};
 return {spawn,spawned};
}
const start=(extra={})=>()=>({provider:'claude',model:'opus',effort:'default',binary:'claude',credentialPath:'/tmp/cred.json',system:'SYSTEM',prompt:'PROMPT',...extra});
const tick=ms=>new Promise(r=>setTimeout(r,ms));

test('tool split: reading and posting replies are free, managing or running work prompts',()=>{
 assert(freeTools.includes('list_runs')&&freeTools.includes('preview_run')&&freeTools.includes('post_message')&&freeTools.includes('post_coordinator_message')&&freeTools.includes('message_project_agent'));
 assert.deepEqual([...promptTools].sort(),['create_workflow','start_run','stop_project_agent','stop_run','update_workflow']);
 assert(!freeTools.includes('report_to_orchestrator')&&!promptTools.includes('report_to_orchestrator'),'Report tools are for project agents only.');
});

test('Claude Code args: the person\'s normal setup plus Workbench MCP, only the Skill tool, prompts for action tools, no bypass (#20)',()=>{
 const args=sessionArgs('claude',{model:'opus',effort:'high',system:'S',prompt:'P',server:{command:'node',args:['bridge.mjs','cred.json']},workspace:'/w'});
 assert.equal(args[args.indexOf('--tools')+1],'Skill','No file, shell or web tools; skills can load.');for(const flag of ['--strict-mcp-config','--setting-sources','--disable-slash-commands','--system-prompt'])assert(!args.includes(flag),flag);assert.equal(args[args.indexOf('--append-system-prompt')+1],'S');assert.equal(args[args.indexOf('--permission-mode')+1],'manual');
 assert(!args.some(a=>/dontAsk|bypassPermissions|dangerously/.test(a)));
 assert.deepEqual(Object.keys(JSON.parse(args[args.indexOf('--mcp-config')+1]).mcpServers),['workbench']);
 const allowed=args.slice(args.indexOf('--allowedTools')+1,args.indexOf('--model'));assert.deepEqual(allowed,freeTools.map(t=>'mcp__workbench__'+t));assert(!allowed.some(a=>/start_run|stop_run|create_workflow|update_workflow/.test(a)));
 const hooks=JSON.parse(args[args.indexOf('--settings')+1]).hooks;assert.equal(hooks.Notification[0].matcher,'permission_prompt');assert.match(hooks.Notification[0].hooks[0].command,/coordinator-signal\.mjs" waiting$/);
 assert.deepEqual(args.slice(-2),['--','P']);assert.equal(args[args.indexOf('--effort')+1],'high');
});

test('Codex args: the person\'s normal home plus Workbench MCP overrides, read-only sandbox, no shell, action tools prompt (#20)',()=>{
 const args=sessionArgs('codex',{model:'gpt',effort:'default',system:'S',prompt:'P',server:{command:'node',args:['b','c']},workspace:'/w'});
 assert.equal(args[args.indexOf('--sandbox')+1],'read-only');assert(args.includes('shell_tool')&&args.includes('unified_exec'));assert(!args.some(a=>/dangerously|approval_policy="never"/.test(a)));assert.deepEqual(args.slice(-2),['--','P']);
 assert(args.includes('mcp_servers.workbench.command="node"')&&args.includes('mcp_servers.workbench.default_tools_approval_mode="approve"'));
 for(const t of promptTools)assert(args.includes(`mcp_servers.workbench.tools.${t}.approval_mode="prompt"`),t);
 assert(args.some(a=>a.startsWith('hooks.PermissionRequest=')));assert(args.includes('projects."/w".trust_level="trusted"'));
 assert(!args.some(a=>/mcp_servers\.(?!workbench)/.test(a)),'Other MCP servers come from the person\'s own config, untouched.');
});


test('one PTY per conversation; later messages are pasted into it; Codex uses the person\'s own home (#20)',async t=>{
 const dir=temp(t),fake=fakePty(),s=new CoordinatorSessions(dir,{spawn:fake.spawn});
 const first=s.deliver('coordinator','hi',start());assert.equal(fake.spawned.length,1);assert.equal(first.status,'running');
 assert.equal(fake.spawned[0].options.cwd,path.join(dir,'coordinator-workspace'));assert.equal(fake.spawned[0].options.env.GH_TOKEN,undefined);
 const again=s.deliver('coordinator','second \x1b[201~ line',start());assert.equal(again.id,first.id);assert.equal(fake.spawned.length,1);
 await tick(80);assert.deepEqual(fake.spawned[0].writes,['\x1b[200~second  line\x1b[201~','\r']);
 s.deliver('project-1','hello',start({provider:'codex',binary:'codex'}));assert.equal(fake.spawned.length,2);
 const env=fake.spawned[1].options.env;assert.equal(env.CODEX_HOME,process.env.CODEX_HOME,'No private Codex home.');
 assert.equal(fake.spawned[0].options.env.CODEX_HOME,undefined,'Claude sessions do not get the Codex home.');
});

test('Stop, idle, settings change and shutdown end sessions without respawning; history is bounded',async t=>{
 const dir=temp(t),fake=fakePty(),s=new CoordinatorSessions(dir,{spawn:fake.spawn,idleMs:60,historyLimit:3,tailChars:10});
 const a=s.deliver('a','x',start());fake.spawned[0].emit('0123456789abcdef');
 assert.equal(s.output(a.id,0).data,'6789abcdef');assert.equal(s.output(a.id,0).reset,true);
 s.stop(a.id);assert.equal(s.current('a'),null);assert.deepEqual(fake.spawned[0].killed,['SIGTERM']);assert.throws(()=>s.input(a.id,'y'),/ended/);
 assert.equal(s.history('a')[0].endReason,'stopped');assert.equal(s.output(a.id,0).data,'6789abcdef','Ended sessions stay readable.');
 const b=s.deliver('b','x',start());await tick(120);assert.equal(s.current('b'),null);assert.equal(s.history('b')[0].endReason,'idle');
 s.deliver('c','x',start());s.deliver('d','x',start());s.endAll('settings');assert.equal(s.history('c')[0].endReason,'settings');assert.equal(s.history('d')[0].endReason,'settings');
 assert.equal(s.data.sessions.length,3);assert(!s.data.sessions.some(x=>x.id===a.id),'The oldest session is evicted.');
 s.deliver('e','x',start());const count=fake.spawned.length;s.shutdown();assert.equal(s.history('e')[0].endReason,'server');assert.equal(fake.spawned.length,count,'Nothing respawns.');
 assert.throws(()=>s.deliver('e','again',start()),/stopping/);
 const reloaded=new CoordinatorSessions(dir,{spawn:fake.spawn});assert.equal(reloaded.current('e'),null,'Restart never resumes.');assert.equal(reloaded.history('e')[0].endReason,'server');
 const endedID=reloaded.history('e')[0].id;assert.throws(()=>reloaded.input(endedID,'y'),/ended/);assert.equal(reloaded.output(endedID,0).session.status,'ended');
 const defaults=new CoordinatorSessions(temp(t));assert.equal(defaults.historyLimit,20);assert.equal(defaults.tailChars,256*1024);assert.equal(defaults.idleMs,30*60000);
 assert.equal(statSync(path.join(dir,'coordinator-sessions.json')).mode&0o777,0o600);
});

test('waiting signal needs the session secret, and input clears it',t=>{
 const dir=temp(t),fake=fakePty(),s=new CoordinatorSessions(dir,{spawn:fake.spawn});
 const r=s.deliver('coordinator','x',start()),secret=fake.spawned[0].options.env.WORKBENCH_COORDINATOR_SECRET;
 assert.equal(fake.spawned[0].options.env.WORKBENCH_COORDINATOR_SIGNAL,'');
 assert.throws(()=>s.signal(r.id,'wrong','waiting'),e=>e.status===403);assert.throws(()=>s.signal('nope',secret,'waiting'),e=>e.status===404);assert.throws(()=>s.signal(r.id,secret,'other'),/Unknown/);
 assert.equal(s.signal(r.id,secret,'waiting').waiting,true);assert.deepEqual(s.waiting().map(w=>w.id),[r.id]);
 s.input(r.id,'y');assert.equal(s.current('coordinator').waiting,false);assert.deepEqual(s.waiting(),[]);
 s.signalURL='http://127.0.0.1:9/api/coordinator/sessions';s.deliver('other','x',start());assert.match(fake.spawned[1].options.env.WORKBENCH_COORDINATOR_SIGNAL,/^http:\/\/127\.0\.0\.1:9\/api\/coordinator\/sessions\/[\w-]+\/signal$/);
});

test('corrupt history fails visibly; schema 1 coordinator settings migrate with a backup',t=>{
 const dir=temp(t);writeFileSync(path.join(dir,'coordinator-sessions.json'),'{bad');assert.throws(()=>new CoordinatorSessions(dir),/Damaged coordinator session history/);
 const dir2=temp(t),legacy={schema:1,version:3,enabled:true,provider:'codex',model:'gpt',effort:'low',turns:[{id:'t1',threadKey:'coordinator',status:'completed'},{id:'t2',threadKey:'coordinator',status:'running'}]};
 writeFileSync(path.join(dir2,'coordinator-agent.json'),JSON.stringify(legacy));
 const agent=new CoordinatorAgent(dir2,{threads:{},controllers:{internal:()=>null},projects:()=>[],executor:{},sessions:new CoordinatorSessions(dir2,{spawn:fakePty().spawn})});
 assert.deepEqual({schema:agent.data.schema,version:agent.data.version,enabled:agent.data.enabled,provider:agent.data.provider,model:agent.data.model,effort:agent.data.effort},{schema:2,version:3,enabled:true,provider:'codex',model:'gpt',effort:'low'});
 assert.deepEqual(agent.data.legacyTurns.map(t=>t.status),['completed','interrupted']);
 const backups=readdirSync(dir2).filter(f=>/^coordinator-agent\.json\.schema-1\..+\.backup\.json$/.test(f));assert.equal(backups.length,1);assert.deepEqual(JSON.parse(readFileSync(path.join(dir2,backups[0]),'utf8')),legacy);
 writeFileSync(path.join(dir2,'coordinator-agent.json'),'{"schema":7}');assert.throws(()=>new CoordinatorAgent(dir2,{threads:{},controllers:{},projects:()=>[],executor:{},sessions:{}}),/Damaged coordinator settings/);
 assert(existsSync(path.join(dir2,'coordinator-agent.json')));
});

test('messages arriving together are submitted one at a time, never merged',async t=>{
 const dir=temp(t),fake=fakePty(),s=new CoordinatorSessions(dir,{spawn:fake.spawn});
 s.deliver('coordinator','first',start());s.deliver('coordinator','reply one',start());s.paste('coordinator','relayed report');
 await tick(500);
 assert.deepEqual(fake.spawned[0].writes,['\x1b[200~reply one\x1b[201~','\r','\x1b[200~relayed report\x1b[201~','\r']);
 assert.equal(s.paste('nobody','x'),false,'Relays never start a session.');
});

test('a CLI startup trust screen shows as waiting once; Workbench never answers it',t=>{
 const dir=temp(t),fake=fakePty(),s=new CoordinatorSessions(dir,{spawn:fake.spawn}),r=s.deliver('coordinator','x',start({provider:'codex',binary:'codex'})),child=fake.spawned[0];
 child.emit('Hooks need review\r\n1 hook is new or changed.\r\n› 1. Review hooks  2. Trust all and continue');
 assert.equal(s.current('coordinator').waiting,true,'The chat can offer Open CLI.');assert.deepEqual(child.writes.filter(w=>/^[123]$|\r/.test(w)&&!w.includes('\x1b[200~')),[],'Nothing is typed into the trust screen.');
 s.input(r.id,'2');assert.equal(s.current('coordinator').waiting,false);
 child.emit('Hooks need review (redraw)');assert.equal(s.current('coordinator').waiting,false,'Flagged once per session.');
});
