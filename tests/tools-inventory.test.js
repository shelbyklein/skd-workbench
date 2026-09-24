import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,writeFileSync,rmSync} from 'node:fs';
import path from 'node:path';import {tmpdir} from 'node:os';
import {Connections} from '../lib/connections.js';
import {toolsInventory} from '../lib/tools.js';

const skill=(dir,name,description)=>{mkdirSync(path.join(dir,name),{recursive:true});writeFileSync(path.join(dir,name,'SKILL.md'),`---\nname: ${name}\ndescription: ${description}\n---\nBody of ${name}`);};
function fixture(t){
 const root=mkdtempSync(path.join(tmpdir(),'skd-tools-')),home=path.join(root,'home'),folder=path.join(root,'app');t.after(()=>rmSync(root,{recursive:true,force:true}));
 skill(path.join(home,'.codex','skills'),'dev-plan','Plan work');skill(path.join(home,'.codex','skills','.system'),'openai-docs','Docs');
 skill(path.join(home,'.claude','skills'),'dev-plan','Plan work');skill(path.join(home,'.claude','skills'),'handoff','Hand off');skill(path.join(home,'.agents','skills'),'shared','Both CLIs');
 writeFileSync(path.join(home,'.codex','config.toml'),'[mcp_servers.local]\ncommand="node"\nargs=["server.js","--token=supersecret123"]\n[mcp_servers.remote]\nurl="https://example.test/mcp"\nenabled=false\n[plugins."pdf@market"]\nenabled=true\n[plugins."off@market"]\nenabled=false\n');
 skill(path.join(home,'.codex','plugins','cache','market','pdf','1.2.0','skills'),'pdf','PDF tools');skill(path.join(home,'.codex','plugins','cache','market','pdf','1.10.0','skills'),'pdf-new','Newest version');skill(path.join(home,'.codex','plugins','cache','market','off','1.0.0','skills'),'hidden','Disabled plugin');
 const install=path.join(home,'.claude','plugins','cache','m','stripe','1');skill(path.join(install,'skills'),'docs','Stripe docs');const off=path.join(home,'.claude','plugins','cache','m','bricks','1');skill(path.join(off,'skills'),'bricks','Off');
 writeFileSync(path.join(home,'.claude','plugins','installed_plugins.json'),JSON.stringify({version:2,plugins:{'stripe@m':[{scope:'user',installPath:install}],'bricks@m':[{scope:'user',installPath:off}]}}));
 writeFileSync(path.join(home,'.claude','settings.json'),JSON.stringify({enabledPlugins:{'stripe@m':true,'bricks@m':false}}));
 writeFileSync(path.join(home,'.claude.json'),JSON.stringify({mcpServers:{tracker:{command:'tt',args:['mcp'],env:{API_KEY:'hidden-value'}}}}));
 mkdirSync(folder);skill(path.join(folder,'.agents','skills'),'release','Project release');skill(path.join(folder,'.claude','skills'),'claude-only','Project Claude skill');
 const project={id:'p1',name:'App',folderPath:folder},connections=new Connections(path.join(root,'data'),{home,enumerateCodex:async()=>{throw Error('Inventory must not start the Codex CLI.');}});
 return {home,project,connections};
}

test('the Tools inventory lists each CLI\'s skills and MCP servers from its own setup, redacted, without starting anything',async t=>{
 const {home,project,connections}=fixture(t),r=await toolsInventory({connections,projects:[project],project,home}),names=p=>r[p].skills.map(s=>s.name).sort();
 assert.deepEqual(names('codex'),['dev-plan','openai-docs','pdf:pdf-new','release','shared']);
 assert.deepEqual(names('claude'),['claude-only','dev-plan','handoff','release','shared','stripe:docs']);
 assert.equal(r.codex.skills.find(s=>s.name==='openai-docs').source,'system');assert.equal(r.claude.skills.find(s=>s.name==='stripe:docs').source,'plugin');assert.equal(r.codex.skills.find(s=>s.name==='release').source,'project');
 assert.equal(r.codex.skills.find(s=>s.name==='dev-plan').both,true);assert.equal(r.claude.skills.find(s=>s.name==='handoff').both,undefined);
 assert.deepEqual(r.codex.mcp.map(m=>[m.name,m.transport,m.enabled]).sort(),[['local','stdio',true],['remote','http',false]]);
 assert.deepEqual(r.claude.mcp.map(m=>m.name),['tracker']);assert.deepEqual(r.claude.mcp[0].environmentNames,['API_KEY']);
 const serialized=JSON.stringify(r);for(const secret of ['supersecret123','hidden-value','Body of',home])assert(!serialized.includes(secret),secret);
 const global=await toolsInventory({connections,projects:[project],home});assert(!global.codex.skills.some(s=>s.source==='project'),'Without a project only user, system and plugin skills are listed.');
});

// Install: exact argv preview, confirmation, no shell, per-CLI results, secrets masked.
import {createServer} from '../server.js';
import {readFileSync,existsSync} from 'node:fs';
import {mcpInstallPlan} from '../lib/tools.js';
test('Install MCP server previews each CLI command, runs it only after confirmation and reports each CLI',async t=>{
 const root=mkdtempSync(path.join(tmpdir(),'skd-tools-install-')),log=path.join(root,'calls.jsonl');mkdirSync(path.join(root,'app'));
 const cli=(name,fail)=>{const file=path.join(root,name);writeFileSync(file,`#!/usr/bin/env node\nrequire('node:fs').appendFileSync(${JSON.stringify(log)},JSON.stringify({cli:${JSON.stringify(name)},args:process.argv.slice(2)})+'\\n');${fail?"console.error('already exists: '+process.argv.slice(2).join(' '));process.exit(1);":"console.log('Added '+process.argv[4]);"}`,{mode:0o755});return file;};
 const server=createServer({directory:path.join(root,'data'),toolsOptions:{codexBinary:cli('codex'),claudeBinary:cli('claude',true)}});await new Promise(r=>server.listen(0,'127.0.0.1',r));
 t.after(async()=>{server.closeAllConnections();await new Promise(r=>server.close(r));rmSync(root,{recursive:true,force:true});});
 const api=async(route,input)=>{const res=await fetch(`http://127.0.0.1:${server.address().port}/api/${route}`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(input)});return {status:res.status,body:await res.json()};};
 const input={providers:['codex','claude'],name:'my-server',transport:'stdio',command:'npx',args:['-y','my mcp'],env:{API_KEY:'sk-secret-123'}};
 const preview=await api('tools/mcp/preview',input);assert.equal(preview.status,200);
 assert.deepEqual(preview.body.commands.map(c=>c.command),["codex mcp add my-server --env API_KEY=••• -- npx -y 'my mcp'","claude mcp add -s user my-server -e API_KEY=••• -- npx -y 'my mcp'"]);
 assert.deepEqual(preview.body.commands.map(c=>c.remove),['codex mcp remove my-server','claude mcp remove -s user my-server']);assert(!JSON.stringify(preview.body).includes('sk-secret-123'));
 assert.equal(existsSync(log),false,'Preview runs nothing.');
 const unconfirmed=await api('tools/mcp/install',input);assert.equal(unconfirmed.status,400);assert.match(unconfirmed.body.error,/Confirm/);assert.equal(existsSync(log),false);
 const installed=await api('tools/mcp/install',{...input,confirm:true});assert.equal(installed.status,200);
 assert.deepEqual(installed.body.results.map(r=>[r.provider,r.ok]),[['codex',true],['claude',false]],'Each CLI reports on its own.');
 assert(!JSON.stringify(installed.body).includes('sk-secret-123'),'Output is masked.');
 const calls=readFileSync(log,'utf8').trim().split('\n').map(l=>JSON.parse(l));
 assert.deepEqual(calls,[{cli:'codex',args:['mcp','add','my-server','--env','API_KEY=sk-secret-123','--','npx','-y','my mcp']},{cli:'claude',args:['mcp','add','-s','user','my-server','-e','API_KEY=sk-secret-123','--','npx','-y','my mcp']}],'Exact argv, no shell.');
 // HTTP servers use the URL and a bearer token variable name, never a token value.
 assert.deepEqual(mcpInstallPlan({providers:['codex','claude'],name:'remote',transport:'http',url:'https://example.test/mcp',bearerTokenEnv:'EXAMPLE_TOKEN'}).argv,{codex:['mcp','add','remote','--url','https://example.test/mcp','--bearer-token-env-var','EXAMPLE_TOKEN'],claude:['mcp','add','-s','user','-t','http','remote','https://example.test/mcp','-H','Authorization: Bearer ${EXAMPLE_TOKEN}']});
 for(const bad of [{...input,name:'bad name'},{...input,providers:[]},{...input,transport:'sse'},{...input,extra:1},{providers:['codex'],name:'x',transport:'http',url:'https://u:p@example.test'},{providers:['codex'],name:'x',transport:'http',url:'https://e.test',env:{A:'b'}}])assert.equal((await api('tools/mcp/preview',bad)).status,400,JSON.stringify(bad));
});
