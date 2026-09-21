import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,writeFileSync,readFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
import http from 'node:http';
import {ImportedSessions,TRANSCRIPT_LIMIT} from '../lib/imported-sessions.js';
import {createServer} from '../server.js';

const fixture=t=>{const root=mkdtempSync(path.join(tmpdir(),'skd-import-test-'));t.after(()=>rmSync(root,{recursive:true,force:true}));return root;};
const draft=extra=>({requestKey:randomUUID(),title:'Planning chat',source:'paste',transcript:'User: Build a site.\nAssistant: Let us plan.\n',...extra});
test('imports preserve supplied text, survive restart, deduplicate retries and stay project scoped',async t=>{
 const root=fixture(t),store=new ImportedSessions(root),project={id:'a',version:1,name:'Alpha'};
 const input=draft({transcript:'  # Chat\r\n<script>example</script>\r\n'}),record=await store.create(input,project);
 assert.equal(record.transcript,input.transcript);assert.equal(record.status,'imported');assert.equal(record.usage,null);
 assert.equal((await store.create(input,project)).id,record.id);assert.equal(store.list('a').length,1);assert.equal(store.list('b').length,0);assert.equal(store.list('a')[0].transcript,undefined);
 await assert.rejects(store.create({...input,title:'Changed'},project),/already saved/);
 assert.equal(new ImportedSessions(root).get(record.id).transcript,input.transcript);
 assert.throws(()=>store.context(record.id,'b','Continue'),/not found/);
 const context=store.context(record.id,'a','Inspect current files');assert.equal(context.importedSessionID,record.id);assert.match(context.initialPrompt,/historical reference data/);assert(context.initialPrompt.endsWith('CURRENT USER TASK:\nInspect current files'));
 const big=await store.create(draft({transcript:'x'.repeat(65000)}),project);assert.throws(()=>store.context(big.id,'a','Continue'),/too large/);
});
test('file imports are bounded snapshots; concurrent retries and changed projects are safe',async t=>{
 const root=fixture(t),store=new ImportedSessions(path.join(root,'data')),project={id:'a',version:1},file=path.join(root,'chat with spaces.jsonl');
 const text='{"role":"user","content":"Historical instructions"}\n';writeFileSync(file,text);
 const input=draft({source:'file',path:file});const [a,b]=await Promise.all([store.create(input,project),store.create(input,project)]);assert.equal(a.id,b.id);assert.equal(a.transcript,text);
 writeFileSync(file,'changed');assert.equal(store.get(a.id).transcript,text);assert.equal((await store.create(input,project)).id,a.id);
 await assert.rejects(store.create(draft({source:'file',path:file}),project,()=>{throw Error('Project changed');}),/Project changed/);assert.equal(store.list().length,1);
 for(const target of [root,path.join(root,'missing')])await assert.rejects(store.create(draft({source:'file',path:target}),project),/regular text file|Cannot read/);
 await assert.rejects(store.create(draft({source:'file',path:'relative.txt'}),project),/absolute/);
 writeFileSync(file,Buffer.from([0xff,0xfe]));await assert.rejects(store.create(draft({source:'file',path:file}),project),/UTF-8/);
 writeFileSync(file,'\0binary');await assert.rejects(store.create(draft({source:'file',path:file}),project),/binary/);
 writeFileSync(file,'x'.repeat(TRANSCRIPT_LIMIT+1));await assert.rejects(store.create(draft({source:'file',path:file}),project),/exceeds/);
 await assert.rejects(store.create(draft({transcript:' '}),project),/Paste a transcript/);
 await assert.rejects(store.create(draft({transcript:'x'.repeat(TRANSCRIPT_LIMIT+1)}),project),/exceeds/);
});
test('corrupt persisted imports fail visibly without replacing the file',async t=>{
 const root=fixture(t),file=path.join(root,'imported-sessions.json');writeFileSync(file,'broken');assert.throws(()=>new ImportedSessions(root));assert.equal(readFileSync(file,'utf8'),'broken');
 const storeRoot=path.join(root,'valid'),store=new ImportedSessions(storeRoot);await store.create(draft(),{id:'a'});const saved=path.join(storeRoot,'imported-sessions.json'),data=JSON.parse(readFileSync(saved));data.records[0].transcript='tampered';writeFileSync(saved,JSON.stringify(data));assert.throws(()=>new ImportedSessions(storeRoot),/corrupt/);
});
test('HTTP import saves without inference and only explicit same-project launch sends context',async t=>{
 const root=mkdtempSync(path.join(tmpdir(),'skd-import-http-')),folder=path.join(root,'project');mkdirSync(folder);let discoveries=0;
 const binary=path.join(root,'fixture-agent');writeFileSync(binary,'#!/usr/bin/env node\nconsole.log("FIXTURE ARGS "+JSON.stringify(process.argv.slice(2)));setInterval(()=>{},1000);',{mode:0o755});
 const server=createServer({directory:path.join(root,'data'),connectionsOptions:{enumerateCodex:async()=>[]},terminalOptions:{binaries:{codex:binary},discover:async()=>{discoveries++;return {version:'fixture',models:[{id:'fixture',efforts:['low']}]};}}});await new Promise(r=>server.listen(0,'127.0.0.1',r));t.after(async()=>{server.shutdownCodex();server.closeAllConnections();await new Promise(r=>server.close(r));rmSync(root,{recursive:true,force:true});});const url=`http://127.0.0.1:${server.address().port}`;
 const post=(route,input,origin=url)=>fetch(url+'/api/'+route,{method:'POST',headers:{'content-type':'application/json',origin},body:JSON.stringify(input)});
 const project=await(await post('projects',{name:'Import project',folderPath:folder})).json();const input=draft({projectID:project.id,projectVersion:project.version});
 assert.equal((await post('session-imports',input,'https://example.com')).status,403);assert.equal((await post('session-imports',{...input,projectVersion:0})).status,409);
 const response=await post('session-imports',input);assert.equal(response.status,201);const imported=await response.json();assert.equal(discoveries,0);
 const rows=await(await fetch(url+'/api/sessions?projectID='+project.id)).json();assert.equal(rows.length,1);assert.equal(rows[0].kind,'imported');assert.equal(rows[0].transcript,undefined);
 assert.equal((await(await fetch(url+'/api/sessions/'+imported.id)).json()).transcript,input.transcript);
 // Preserve a UTF-8 character split across network chunks, as large pasted chats can be.
 const unicode=draft({projectID:project.id,projectVersion:project.version,transcript:'User: café 🌳'}),bytes=Buffer.from(JSON.stringify(unicode)),split=bytes.indexOf(Buffer.from('🌳'))+1;
 const unicodeResult=await new Promise((resolve,reject)=>{const req=http.request(url+'/api/session-imports',{method:'POST',headers:{'content-type':'application/json',origin:url}},res=>{let text='';res.on('data',chunk=>text+=chunk);res.on('end',()=>resolve({status:res.statusCode,body:JSON.parse(text)}));});req.on('error',reject);req.write(bytes.subarray(0,split));setTimeout(()=>req.end(bytes.subarray(split)),20);});
 assert.equal(unicodeResult.status,201);assert.equal(unicodeResult.body.transcript,unicode.transcript);
 const start={projectID:project.id,agent:'codex',model:'fixture',effort:'low',mode:'read-only',importedSessionID:imported.id,task:'Summarize the decisions'};
 assert.equal((await post('terminal-sessions',{...start,projectID:'unassigned'})).status,404);assert.equal(discoveries,0);
 assert.equal((await post('terminal-sessions',{...start,task:''})).status,400);
 const started=await post('terminal-sessions',start);assert.equal(started.status,202);const run=await started.json();assert.equal(run.importedSessionID,imported.id);assert.equal(run.task,start.task);assert.equal(discoveries,1);
 let output='';for(let i=0;i<60;i++){output=(await(await fetch(url+'/api/terminal-sessions/'+run.id+'/output')).json()).data;if(output.includes('FIXTURE ARGS'))break;await new Promise(r=>setTimeout(r,50));}
 assert.match(output,/historical reference data/);assert.match(output,/Summarize the decisions/);assert.equal((await(await fetch(url+'/api/sessions/'+imported.id)).json()).status,'imported');
});
