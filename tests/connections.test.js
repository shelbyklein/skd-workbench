import test from 'node:test';
import assert from 'node:assert/strict';
import {realpathSync,mkdtempSync,mkdirSync,writeFileSync,readFileSync,rmSync,chmodSync,symlinkSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {setTimeout as wait} from 'node:timers/promises';
import {Connections} from '../lib/connections.js';

function fixture(t){
 const root=mkdtempSync(path.join(tmpdir(),'skd-mcp-')),home=path.join(root,'home'),repo=path.join(home,'project'),data=path.join(root,'data');mkdirSync(path.join(home,'.codex'),{recursive:true});mkdirSync(repo,{recursive:true});
 const project={id:'project-a',name:'A',folderPath:repo};t.after(()=>rmSync(root,{recursive:true,force:true}));return {root,home,repo,data,project,connections:new Connections(data,{home,timeoutMs:1500})};
}
async function done(connections,id,projectID){for(let i=0;i<60;i++){const result=connections.check(id,projectID);if(result.status!=='checking')return result;await wait(25);}throw Error('check did not finish');}

test('MCP inventory parses bounded Codex and Claude sources without exposing secrets',async t=>{
 const {home,repo,project,connections}=fixture(t);
 writeFileSync(path.join(home,'.codex','config.toml'),'[mcp_servers.shared]\ncommand="node"\nargs=["server.js"]\nenv_vars=["SAFE_TOKEN"]\n[mcp_servers.secret]\nurl="https://user:pass@example.test/mcp?token=hidden"\n[mcp_servers.envsecret]\ncommand="node"\nenv={CUSTOM="abcdefghijklmnopqrstuvwxyz123456"}\n[mcp_servers.missing]\ncommand="/private/credential-path/should-not-leak"\n');
 writeFileSync(path.join(home,'.claude.json'),JSON.stringify({mcpServers:{remote:{type:'http',url:'https://example.test/mcp',headers:{Authorization:'Bearer hidden'}},local:{command:'node',args:['local.js'],env:{VISIBLE_NAME:'${VISIBLE_NAME}'}}},projects:{}}));
 mkdirSync(path.join(repo,'.codex'),{recursive:true});writeFileSync(path.join(repo,'.codex','config.toml'),'[mcp_servers.shared]\ncommand="node"\nargs=["project.js"]\n');
 const result=await connections.inventory([project],{kind:'project',projectID:project.id}),serialized=JSON.stringify(result);
 assert.equal(result.connections.filter(item=>item.name==='shared').length,2);assert(result.connections.some(item=>item.name==='shared'&&item.source==='user'&&item.shadowed));assert(result.connections.some(item=>item.name==='shared'&&item.source==='project'&&!item.shadowed));
 assert.equal(result.connections.find(item=>item.name==='remote').inlineCredentials,true);assert.equal(result.connections.find(item=>item.name==='envsecret').inlineCredentials,true);assert.deepEqual(result.connections.find(item=>item.name==='local').environmentNames,['VISIBLE_NAME']);
 for(const secret of ['server.js','project.js','Bearer hidden','user:pass','token=hidden','abcdefghijklmnopqrstuvwxyz123456','credential-path'])assert(!serialized.includes(secret));
 const missing=result.connections.find(item=>item.name==='missing'),started=await connections.startCheck(project,missing.id),failed=await done(connections,started.id,project.id);assert.equal(failed.status,'failed');assert(!JSON.stringify(failed).includes('credential-path'));
});

test('stored MCP policy stays revisioned and project-bound, while sessions resolve to native MCP (#20)',async t=>{
 const {home,project,connections}=fixture(t);writeFileSync(path.join(home,'.codex','config.toml'),'[mcp_servers.fixture]\ncommand="node"\nargs=["fixture.js"]\n');
 const inventory=await connections.inventory([project],{kind:'project',projectID:project.id}),id=inventory.connections.find(item=>item.name==='fixture').id;
 const policy=await connections.savePolicy({revision:0,policyRevision:0,projectID:project.id,provider:'codex',mode:'managed',connectionIDs:[id]},[project]);assert.equal(policy.revision,1);
 // Since #20 a saved managed policy is kept for history but sessions use the CLI's own MCP configuration.
 const managed=await connections.resolve(project,'codex',{mode:'inherit',connectionIDs:[]},{purpose:'session',mode:'worktree'});assert.equal(managed.status,'native');assert.deepEqual(managed.connections,[]);
 assert.equal((await connections.resolve(project,'codex',{mode:'inherit',connectionIDs:[]},{purpose:'workflow',mode:'worktree'})).status,'excluded');
 await assert.rejects(connections.savePolicy({revision:0,policyRevision:0,projectID:project.id,provider:'codex',mode:'native',connectionIDs:[]},[project]),/another tab/);
});

test('explicit stdio check initializes and lists tools without invoking one',async t=>{
 const {root,home,project,connections}=fixture(t),log=path.join(root,'calls.log'),server=path.join(root,'server.mjs');
 writeFileSync(server,`#!/usr/bin/env node\nimport fs from 'node:fs';let b='';process.stdin.setEncoding('utf8');process.stdin.on('data',c=>{b+=c;let n;while((n=b.indexOf('\\n'))>=0){const l=b.slice(0,n);b=b.slice(n+1);if(!l)continue;const m=JSON.parse(l);fs.appendFileSync(${JSON.stringify(log)},m.method+'\\n');if(m.id===1)console.log(JSON.stringify({jsonrpc:'2.0',id:1,result:{protocolVersion:'2025-06-18',capabilities:{tools:{}},serverInfo:{name:'fixture',version:'1'}}}));if(m.id===2)console.log(JSON.stringify({jsonrpc:'2.0',id:2,result:{tools:[{name:'harmless_fixture',inputSchema:{type:'object'}}]}}));}});`);chmodSync(server,0o755);
 writeFileSync(path.join(home,'.codex','config.toml'),`[mcp_servers.fixture]\ncommand=${JSON.stringify(process.execPath)}\nargs=[${JSON.stringify(server)}]\n`);
 const inventory=await connections.inventory([project],{kind:'project',projectID:project.id}),connection=inventory.connections.find(item=>item.name==='fixture'),started=await connections.startCheck(project,connection.id),result=await done(connections,started.id,project.id);
 assert.equal(result.status,'available');assert.deepEqual(result.tools,['harmless_fixture']);const calls=readFileSync(log,'utf8');assert.match(calls,/initialize/);assert.match(calls,/tools\/list/);assert.doesNotMatch(calls,/tools\/call/);
});

test('MCP inventory reports malformed and escaping sources and corrupt stores without leaking excerpts',async t=>{
 const {root,data,home,repo,project,connections}=fixture(t);writeFileSync(path.join(home,'.codex','config.toml'),'[mcp_servers.bad\nsecret="do not show"');const outside=path.join(root,'outside.json');writeFileSync(outside,JSON.stringify({mcpServers:{leak:{command:'secret-command'}}}));symlinkSync(outside,path.join(repo,'.mcp.json'));const inventory=await connections.inventory([project],{kind:'project',projectID:project.id});assert(inventory.diagnostics.some(item=>item.message==='Configuration is malformed.'));assert(inventory.diagnostics.some(item=>item.message.includes('outside its allowed root')));assert(!JSON.stringify(inventory).includes('do not show'));assert(!JSON.stringify(inventory).includes('secret-command'));
 const broken=path.join(data,'broken');mkdirSync(broken);writeFileSync(path.join(broken,'connections.json'),'{}');assert.throws(()=>new Connections(broken,{home}),/Damaged connections library/);
});

test('managed definitions migrate with backup and preserve scope, versions and idempotency without execution',async t=>{
 const {data,home,project}=fixture(t);const file=path.join(data,'connections.json');const legacy={schema:1,revision:8,policies:[],checks:[]};writeFileSync(file,JSON.stringify(legacy));const connections=new Connections(data,{home,spawnProcess:()=>{throw Error('must not launch');}});assert.deepEqual(JSON.parse(readFileSync(file+'.schema-1.bak')),legacy);
 const input={revision:8,creationRequestKey:'first',name:'managed',scope:{kind:'project',projectID:project.id},providers:['codex','claude'],transport:'stdio',config:{command:process.execPath,args:['fixture.mjs'],cwd:project.folderPath,environmentNames:[]}};
 const entry=connections.createDefinition(input,[project]);assert.equal(connections.createDefinition(input,[project]).id,entry.id);assert.throws(()=>connections.createDefinition({...input,name:'different'},[project]),/reused/);
 const rows=(await connections.inventory([project],input.scope)).connections.filter(r=>r.managedID===entry.id);assert.equal(rows.length,2);assert(!JSON.stringify(rows).includes('fixture.mjs'));assert.equal((await connections.inventory([{id:'other',folderPath:home}],{kind:'project',projectID:'other'})).connections.filter(r=>r.managedID).length,0);
 assert.throws(()=>connections.updateDefinition(entry.id,{...input,version:1},[project]),/another tab/);assert.throws(()=>connections.definition(entry.id,{kind:'project',projectID:'other'},[project,{id:'other'}]),/not found/);
 const updated=connections.updateDefinition(entry.id,{...input,revision:9,version:1,name:'renamed'},[project]);assert.equal(updated.version,2);const restarted=new Connections(data,{home});assert.equal(restarted.definition(entry.id,input.scope,[project]).name,'renamed');assert.equal(restarted.data.schema,2);
 restarted.archiveDefinition(entry.id,{scope:input.scope,revision:10,version:2,archived:true},[project]);assert((await restarted.inventory([project],input.scope)).connections.filter(r=>r.managedID).every(r=>!r.configured));
});

test('provider import is explicit, preserves cwd and detects drift without changing source',async t=>{
 const {home,project,connections}=fixture(t),file=path.join(home,'.codex','config.toml');const original='[mcp_servers.importme]\ncommand="node"\nargs=["server.mjs"]\ncwd="servers"\nenv_vars=["SERVICE_TOKEN"]\n';writeFileSync(file,original);let row=(await connections.inventory([project],{kind:'global'})).connections.find(r=>r.name==='importme');const input={scope:{kind:'global'},sourceID:row.id,fingerprint:row.fingerprint,creationRequestKey:'import-one',revision:0};const preview=await connections.importPreview(input,[project]);assert.equal(preview.definition.config.cwd,path.join(realpathSync(home),'.codex','servers'));assert.equal(connections.data.revision,0);const entry=await connections.importDefinition(input,[project]);assert.equal((await connections.importDefinition(input,[project])).id,entry.id);assert.equal(readFileSync(file,'utf8'),original);
 writeFileSync(file,original.replace('server.mjs','updated.mjs'));let inventory=await connections.inventory([project],{kind:'global'});assert.equal(inventory.connections.find(r=>r.managedID===entry.id).sourceState,'Update available');await assert.rejects(connections.importDefinition(input,[project]),/Source changed/);row=inventory.connections.find(r=>r.id===row.id);await assert.rejects(connections.importDefinition({...input,fingerprint:row.fingerprint,revision:1},[project]),/Review/);const updated=await connections.importDefinition({...input,fingerprint:row.fingerprint,revision:1,managedID:entry.id,version:1},[project]);assert.equal(updated.version,2);assert.equal(updated.config.args[0],'updated.mjs');rmSync(file);inventory=await connections.inventory([project],{kind:'global'});assert.equal(inventory.connections.find(r=>r.managedID===entry.id).sourceState,'Source unavailable');
});

test('managed HTTP checks list tools with session/auth; launches use native MCP (#20)',async t=>{
 const {createServer}=await import('node:http');const {project,connections}=fixture(t),calls=[];process.env.SKD_TEST_MCP_TOKEN='private-fixture-token';t.after(()=>delete process.env.SKD_TEST_MCP_TOKEN);
 const server=createServer(async(req,res)=>{calls.push({method:req.method,auth:req.headers.authorization,session:req.headers['mcp-session-id']});assert.equal(req.headers.authorization,'Bearer private-fixture-token');if(req.method==='DELETE'){res.writeHead(204).end();return;}let raw='';for await(const c of req)raw+=c;const m=JSON.parse(raw);calls.at(-1).rpc=m.method;if(m.id===1){res.setHeader('mcp-session-id','fixture-session');res.setHeader('content-type','application/json');res.end(JSON.stringify({jsonrpc:'2.0',id:1,result:{protocolVersion:'2025-06-18',serverInfo:{name:'fixture',version:'1'},capabilities:{tools:{}}}}));}else if(m.id){assert.equal(req.headers['mcp-session-id'],'fixture-session');res.setHeader('content-type','text/event-stream');res.write(`data: ${JSON.stringify({jsonrpc:'2.0',id:m.id,result:{tools:[{name:'fixture_tool'}]}})}\n\n`);}else res.writeHead(202).end();});await new Promise(r=>server.listen(0,'127.0.0.1',r));t.after(()=>{server.closeAllConnections();server.close();});
 const entry=connections.createDefinition({revision:0,creationRequestKey:'remote',name:'remote',scope:{kind:'global'},providers:['codex','claude'],transport:'http',config:{url:`http://127.0.0.1:${server.address().port}/mcp`,bearerTokenEnv:'SKD_TEST_MCP_TOKEN'}},[project]);assert.equal(calls.length,0);const rows=(await connections.inventory([project],{kind:'project',projectID:project.id})).connections.filter(r=>r.managedID===entry.id);const claude=rows.find(r=>r.provider==='claude');const check=await connections.startCheck(project,claude.id);assert.equal((await done(connections,check.id,project.id)).status,'available');assert.deepEqual(calls.filter(c=>c.rpc).map(c=>c.rpc),['initialize','notifications/initialized','tools/list']);assert.equal(calls.at(-1).method,'DELETE');
 // Since #20 a launch uses the CLI's own MCP configuration: no private file, no disabled servers, no tool list.
 for(const row of [claude,rows.find(r=>r.provider==='codex')]){const launch=await connections.prepareLaunch(project,row.provider,{mode:'replace',connectionIDs:[row.id]});assert.deepEqual([launch.args,launch.tools,launch.cleanup,launch.snapshot.status],[[],[],null,'native']);}
});

test('HTTP checks reject redirects, protocol failures and support explicit cancellation',async t=>{
 const {createServer}=await import('node:http');const {project,connections}=fixture(t);let targetCalls=0;const server=createServer((req,res)=>{if(req.url==='/redirect'){res.writeHead(302,{location:'/target'}).end();}else if(req.url==='/target'){targetCalls++;res.end('{}');}else if(req.url==='/error'){res.setHeader('content-type','application/json');res.end(JSON.stringify({id:1,error:{message:'private secret'}}));}});await new Promise(r=>server.listen(0,'127.0.0.1',r));t.after(()=>{server.closeAllConnections();server.close();});
 for(const endpoint of ['redirect','error','hang']){const entry=connections.createDefinition({revision:connections.data.revision,creationRequestKey:endpoint,name:endpoint,scope:{kind:'global'},providers:['codex'],transport:'http',config:{url:`http://127.0.0.1:${server.address().port}/${endpoint}`}},[project]);const id=connections.definitionConnectionIDs(entry)[0];const check=await connections.startCheck(project,id);if(endpoint==='hang')connections.cancelCheck(check.id,project.id);const result=await done(connections,check.id,project.id);assert.equal(result.status,'failed');assert(!JSON.stringify(result).includes('private secret'));}assert.equal(targetCalls,0);
});

test('managed stdio checks preserve cwd; edits clear the last check (#20: launches use native MCP)',async t=>{
 const {spawn}=await import('node:child_process');const {root,project,connections}=fixture(t);const cwd=path.join(root,'saved-cwd');mkdirSync(cwd);const marker=path.join(cwd,'marker.txt');writeFileSync(marker,'expected');const script=path.join(root,'cwd-server.mjs');writeFileSync(script,`import fs from 'node:fs';if(fs.readFileSync('marker.txt','utf8')!=='expected')process.exit(1);let b='';process.stdin.on('data',c=>{b+=c;let n;while((n=b.indexOf('\\n'))>=0){const m=JSON.parse(b.slice(0,n));b=b.slice(n+1);if(m.id)console.log(JSON.stringify({id:m.id,result:m.id===1?{protocolVersion:'2025-06-18',serverInfo:{name:'cwd',version:'1'}}:{tools:[{name:'cwd_ok'}]}}));}});`);
 const input={revision:0,creationRequestKey:'cwd',name:'cwd_server',scope:{kind:'global'},providers:['claude'],transport:'stdio',config:{command:process.execPath,args:[script],cwd,environmentNames:[]}},entry=connections.createDefinition(input,[project]);const id=connections.definitionConnectionIDs(entry)[0];const started=await connections.startGlobalCheck(id,[project]);assert.equal((await done(connections,started.id,'global')).status,'available');assert.equal((await connections.prepareLaunch(project,'claude',{mode:'replace',connectionIDs:[id]})).snapshot.status,'native');
 const updated=connections.updateDefinition(entry.id,{...input,revision:1,version:1,name:'renamed'},[project]);assert.equal(connections.definitionConnectionIDs(updated)[0],id);assert.equal((await connections.inventory([project],{kind:'global'})).connections.find(r=>r.id===id).lastCheck,null);
});

test('managed definitions reject credential-shaped fields and unsupported transport config before persistence',t=>{
 const {connections,project}=fixture(t);const base={revision:0,creationRequestKey:'invalid',name:'safe',scope:{kind:'global'},providers:['codex'],transport:'http'};
 for(const config of [{url:'https://example.test/mcp?key=private'},{url:'https://user:pass@example.test/mcp'},{url:'https://example.test/mcp',headers:{Authorization:'Bearer private'}},{url:'https://example.test/mcp',bearerTokenEnv:'Bearer private'}])assert.throws(()=>connections.createDefinition({...base,config},[project]));
 assert.throws(()=>connections.createDefinition({...base,transport:'stdio',config:{command:'node',args:['--token','private']}},[project]),/credential/);assert.equal(connections.data.revision,0);
});
