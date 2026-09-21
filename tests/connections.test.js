import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,writeFileSync,readFileSync,rmSync,chmodSync,symlinkSync} from 'node:fs';
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

test('MCP policy keeps native and managed intent revisioned and project-bound',async t=>{
 const {home,project,connections}=fixture(t);writeFileSync(path.join(home,'.codex','config.toml'),'[mcp_servers.fixture]\ncommand="node"\nargs=["fixture.js"]\n');
 const inventory=await connections.inventory([project],{kind:'project',projectID:project.id}),id=inventory.connections.find(item=>item.name==='fixture').id;
 const policy=await connections.savePolicy({revision:0,policyRevision:0,projectID:project.id,provider:'codex',mode:'managed',connectionIDs:[id]},[project]);assert.equal(policy.revision,1);
 const managed=await connections.resolve(project,'codex',{mode:'inherit',connectionIDs:[]},{purpose:'session',mode:'worktree'});assert.equal(managed.status,'managed');assert.deepEqual(managed.connections.map(item=>item.id),[id]);assert(!JSON.stringify(managed.connections).includes('fixture.js'));
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
