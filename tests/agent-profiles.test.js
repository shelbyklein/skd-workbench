import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,readFileSync,writeFileSync,readdirSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {AgentProfiles} from '../lib/playbooks.js';
import {terminalArgs} from '../lib/terminals.js';
import {codexArgs} from '../lib/codex.js';
import {claudeArgs} from '../lib/claude.js';
const project={id:'p',version:1,folderPath:'/tmp'};
const input={revision:0,name:'Reviewer',scope:{kind:'global'},providers:['codex','claude'],systemPrompt:'Specialize in accessible interfaces.',skillIDs:[],connectionIDs:[]};
const directory=()=>mkdtempSync(path.join(tmpdir(),'skd-profiles-'));
test('schema 1 migration preserves identity, history, defaults and byte-exact backup once',async()=>{
 const dir=directory(),books=new AgentProfiles(dir),entry=await books.create(input,[project]);await books.saveDefault({revision:1,defaultRevision:0,projectID:'p',provider:'codex',playbookID:entry.id},[project]);
 const legacy=structuredClone(books.data);legacy.schema=1;delete legacy.entries[0].systemPrompt;const bytes=JSON.stringify(legacy,null,1)+'\n';writeFileSync(path.join(dir,'playbooks.json'),bytes);
 const migrated=new AgentProfiles(dir);assert.equal(migrated.data.schema,2);assert.equal(migrated.get(entry.id).systemPrompt,'');assert.equal(migrated.get(entry.id).version,1);assert.deepEqual(migrated.data.defaults,legacy.defaults);
 const backups=readdirSync(dir).filter(n=>n.includes('.schema-1-'));assert.equal(backups.length,1);assert.equal(readFileSync(path.join(dir,backups[0]),'utf8'),bytes);new AgentProfiles(dir);assert.equal(readdirSync(dir).filter(n=>n.includes('.schema-1-')).length,1);
});
test('legacy update preserves prompt, duplicates copy it, payload reuse and byte overflow reject',async()=>{
 const books=new AgentProfiles(directory()),entry=await books.create({...input,creationRequestKey:'same'},[project]);assert.equal((await books.create({...input,revision:99,creationRequestKey:'same'},[project])).id,entry.id);
 await assert.rejects(books.create({...input,name:'Different',creationRequestKey:'same'},[project]),/different Agent settings/);
 const {systemPrompt,...old}=input;const updated=await books.update(entry.id,{...old,revision:1,version:1,name:'Updated'},[project]);assert.equal(updated.systemPrompt,input.systemPrompt);assert.equal(updated.history[0].systemPrompt,input.systemPrompt);
 const copy=await books.duplicate(entry.id,{revision:2,scope:{kind:'project',projectID:'p'}},[project]);assert.equal(copy.systemPrompt,input.systemPrompt);assert.equal(copy.projectID,'p');
 await assert.rejects(books.create({...input,revision:3,systemPrompt:'😀'.repeat(4097)},[project]),/16 KiB/);
});
test('prompt and project revisions invalidate preview; frozen prompt reaches both providers',async()=>{
 const books=new AgentProfiles(directory()),entry=await books.create(input,[project]),selection={mode:'selected',agentProfileID:entry.id};const preview=await books.preview(project,'codex',selection,{mode:'read-only'});
 await assert.rejects(books.resolveLaunch({...project,version:2},'codex',{...selection,expectedSignature:preview.signature},{mode:'read-only'}),/changed after preview/);
 const r={agent:'codex',model:'fixture',effort:'high',mode:'read-only',workingDirectory:'/tmp',sourceContext:{},agentContext:{agentProfile:preview,skills:{text:''},connections:{}}};
 const c=terminalArgs(r).find(a=>a.startsWith('developer_instructions='));assert.equal(JSON.parse(c.split('=').slice(1).join('=' )).replaceAll(input.systemPrompt,'').length,JSON.parse(c.split('=').slice(1).join('=')).length-input.systemPrompt.length);
 const claude=terminalArgs({...r,agent:'claude'});assert(claude[claude.indexOf('--append-system-prompt')+1].includes('Agent specialization:\n'+input.systemPrompt));
 assert(codexArgs(r).some(a=>a.includes(input.systemPrompt)));assert(claudeArgs({...r,agent:'claude'}).some(a=>a.includes(input.systemPrompt)));
 const draft=await books.sessionDraft({...r,id:'s',projectID:'p',initialPrompt:'DO NOT COPY',agentContext:{...r.agentContext,systemInstructions:'DO NOT COPY PROJECT'}},[project]);assert.equal(draft.systemPrompt,input.systemPrompt);assert(!JSON.stringify(draft).includes('DO NOT COPY'));
});
test('failed migration preserves original bytes and a retry migrates safely',async()=>{
 const dir=directory(),books=new AgentProfiles(dir);await books.create(input,[project]);const legacy=structuredClone(books.data);legacy.schema=1;delete legacy.entries[0].systemPrompt;const bytes=JSON.stringify(legacy);writeFileSync(path.join(dir,'playbooks.json'),bytes);
 class Failure extends AgentProfiles{persist(){throw Error('fixture disk failure');}}
 assert.throws(()=>new Failure(dir),/disk failure/);assert.equal(readFileSync(path.join(dir,'playbooks.json'),'utf8'),bytes);assert.equal(new AgentProfiles(dir).data.schema,2);
 const corrupt='{bad';writeFileSync(path.join(dir,'playbooks.json'),corrupt);assert.throws(()=>new AgentProfiles(dir));assert.equal(readFileSync(path.join(dir,'playbooks.json'),'utf8'),corrupt);
});
test('default scope/provider changes reject without changing the profile',async()=>{
 const books=new AgentProfiles(directory()),entry=await books.create(input,[project]);await books.saveDefault({revision:1,defaultRevision:0,projectID:'p',provider:'codex',playbookID:entry.id},[project]);
 await assert.rejects(books.update(entry.id,{...input,revision:2,version:1,providers:['claude']},[project]),/Change project defaults/);assert.equal(books.get(entry.id).version,1);
});
test('read-only connection exclusion requires acknowledgement and preserves saved selection',async()=>{
 const books=new AgentProfiles(directory());const entry=await books.create({...input,connectionIDs:['mcp']},[project]);books.connections={resolve:async()=>({status:'excluded',connections:[],reason:'Read only excludes MCP.'})};
 const selection={mode:'selected',agentProfileID:entry.id};await assert.rejects(books.preview(project,'codex',selection,{mode:'read-only'}),/confirm launch without/);
 const preview=await books.preview(project,'codex',{...selection,acknowledgeExclusions:true},{mode:'read-only'});assert.deepEqual(preview.connectionSelection.connectionIDs,[]);assert.deepEqual(books.get(entry.id).connectionIDs,['mcp']);assert.equal(preview.exclusions[0].id,'mcp');
});
test('new and legacy HTTP routes share one store and legacy updates preserve specialization',async()=>{
 const {createServer}=await import('../server.js'),dir=directory(),server=createServer({directory:dir,skillsOptions:{home:dir},connectionsOptions:{home:dir}});await new Promise(r=>server.listen(0,'127.0.0.1',r));const base=`http://127.0.0.1:${server.address().port}/api/`;
 const req=async(route,method='GET',body)=>{const r=await fetch(base+route,{method,headers:{'content-type':'application/json'},body:body?JSON.stringify(body):undefined});return {status:r.status,data:await r.json()};};
 try{
  assert.equal((await req('agent-profiles','POST',{...input,systemPrompt:''})).status,400);
  const created=await req('agent-profiles','POST',input);assert.equal(created.status,201);const old=await req('playbooks');assert.equal(old.data.entries[0].id,created.data.id);
  const {systemPrompt,...legacy}=input;const updated=await req('playbooks/'+created.data.id,'PUT',{...legacy,revision:1,version:1,name:'Legacy client edit'});assert.equal(updated.data.systemPrompt,input.systemPrompt);
  assert.equal((await req('agent-profiles')).data.entries[0].version,2);assert.equal((await req('agent-profiles/'+created.data.id+'/archive','POST',{revision:2,version:2,archived:true})).status,200);assert.equal((await req('playbooks')).data.entries[0].archived,true);
 }finally{server.shutdownCodex();server.closeAllConnections();await new Promise(r=>server.close(r));}
});
test('both interactive HTTP providers receive frozen prompt once and stale files block startup',async()=>{
 const {createServer}=await import('../server.js'),dir=directory(),binary=path.join(dir,'fixture-cli'),capture=path.join(dir,'argv.json'),system=path.join(dir,'SYSTEM.md');writeFileSync(system,'PROJECT SPECIALIZATION CONTEXT');
 writeFileSync(binary,`#!/usr/bin/env node\nconst fs=require('node:fs');if(process.argv.includes('mcp')){console.log('[]');process.exit(0);}fs.writeFileSync(${JSON.stringify(capture)},JSON.stringify(process.argv.slice(2)));process.stdin.resume();`,{mode:0o755});
 const provider={version:'fixture',models:[{id:'fixture',efforts:['low']}]};const server=createServer({directory:path.join(dir,'data'),skillsOptions:{home:dir},connectionsOptions:{home:dir},codexOptions:{binary,discover:async()=>provider},terminalOptions:{binaries:{codex:binary,claude:binary},discover:async()=>provider}});await new Promise(r=>server.listen(0,'127.0.0.1',r));const base=`http://127.0.0.1:${server.address().port}/api/`;
 const request=async(route,body)=>{const r=await fetch(base+route,{method:body?'POST':'GET',headers:{'content-type':'application/json'},body:body?JSON.stringify(body):undefined});return {status:r.status,data:await r.json()};};
 try{
  const project=(await request('projects',{name:'Fixture',folderPath:dir})).data,profile=(await request('agent-profiles',input)).data;
  for(const agent of ['codex','claude']){
   const choice={mode:'selected',agentProfileID:profile.id},preview=(await request(`projects/${project.id}/agent-profile-preview`,{agent,mode:'read-only',agentProfile:choice})).data;
   const launch={projectID:project.id,agent,model:'fixture',effort:'low',mode:'read-only',agentProfile:{...choice,expectedSignature:preview.signature}};
   writeFileSync(system,'CHANGED PROJECT CONTEXT');assert.equal((await request('terminal-sessions',launch)).status,409);writeFileSync(system,'PROJECT SPECIALIZATION CONTEXT');
   writeFileSync(capture,'null');const started=await request('terminal-sessions',launch);assert.equal(started.status,202,JSON.stringify(started.data));assert.equal(started.data.agentContext.agentProfile.systemPrompt,input.systemPrompt);assert.equal(started.data.initialPrompt,undefined);assert.equal(started.data.agentContext.playbook,undefined);
   let argv;for(let n=0;n<100;n++){argv=JSON.parse(readFileSync(capture,'utf8'));if(argv)break;await new Promise(r=>setTimeout(r,20));}assert(argv);const delivered=agent==='codex'?JSON.parse(argv.find(a=>a.startsWith('developer_instructions=')).slice('developer_instructions='.length)):argv[argv.indexOf('--append-system-prompt')+1];assert.equal(delivered.split(input.systemPrompt).length,2);assert(delivered.includes('PROJECT SPECIALIZATION CONTEXT'));
   await request('terminal-sessions/'+started.data.id+'/stop',{});for(let n=0;n<100;n++){if((await request('terminal-sessions/'+started.data.id)).data.status==='cancelled')break;await new Promise(r=>setTimeout(r,20));}
  }
 }finally{server.shutdownCodex();server.closeAllConnections();await new Promise(r=>server.close(r));}
});
