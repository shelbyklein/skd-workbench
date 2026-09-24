import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,writeFileSync,readFileSync,rmSync,realpathSync,existsSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {createServer} from '../server.js';
import {Briefings,parseBriefing} from '../lib/briefings.js';

const provider={available:true,version:'fixture',models:[{id:'fixture',efforts:['low']}]};
const git=(cwd,env,...args)=>execFileSync('git',['-C',cwd,...args],{encoding:'utf8',env:{...process.env,...env},stdio:['ignore','pipe','pipe']}).trim();
const now=Date.parse('2026-09-22T15:00:00Z'),agent={synthesize:true,agent:'codex',model:'fixture',effort:'low'};
// Briefing prompts answer from response.json; other tasks wait for a release file so the executor stays busy.
const fake=`const fs=require('node:fs'),p=require('node:path'),dir=p.dirname(process.argv[1]);let input='';process.stdin.on('data',d=>input+=d);process.stdin.on('end',()=>{
 const emit=text=>{console.log(JSON.stringify({type:'item.completed',item:{type:'agent_message',text}}));console.log(JSON.stringify({type:'turn.completed',usage:{input_tokens:10,cached_input_tokens:0,output_tokens:5}}));};
 if(input.includes('Write a daily briefing')){fs.writeFileSync(p.join(dir,'args.json'),JSON.stringify(process.argv.slice(2)));fs.writeFileSync(p.join(dir,'prompt.txt'),input);const ids=[...input.matchAll(/"id":"(commit:[0-9a-f]+)"/g)].map(m=>m[1]);emit(fs.readFileSync(p.join(dir,'response.txt'),'utf8').replaceAll('COMMIT',ids[0]));}
 else{const wait=setInterval(()=>{if(fs.existsSync(p.join(dir,'release'))){clearInterval(wait);emit('user work done');}},20);}
});`;
async function fixture(t,{data}={}){
 const base=realpathSync(mkdtempSync(path.join(tmpdir(),'skd-brief-syn-'))),root=path.join(base,'repo'),bin=path.join(base,'bin');mkdirSync(root);mkdirSync(bin);data??=path.join(base,'data');
 git(root,{},'init','-q','-b','main');git(root,{},'config','user.name','Fixture');git(root,{},'config','user.email','fixture@example.invalid');
 writeFileSync(path.join(root,'a.txt'),'a');git(root,{},'add','.');git(root,{GIT_AUTHOR_DATE:'2026-09-22T10:00:00Z',GIT_COMMITTER_DATE:'2026-09-22T10:00:00Z'},'commit','-q','-m','Recent work');
 writeFileSync(path.join(bin,'codex'),'#!/usr/bin/env node\n'+fake,{mode:0o755});
 const server=createServer({directory:data,codexOptions:{binary:path.join(bin,'codex'),discover:async()=>provider},githubOptions:{binary:path.join(base,'missing-gh')},briefingOptions:{now:()=>now,timezone:()=>'UTC',retryMs:50}});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 t.after(async()=>{writeFileSync(path.join(bin,'release'),'');server.shutdownCodex();server.closeAllConnections();await new Promise(r=>server.close(r));rmSync(base,{recursive:true,force:true});});
 const url=`http://127.0.0.1:${server.address().port}`,request=(route,method='GET',body)=>fetch(url+route,{method,headers:body?{'Content-Type':'application/json'}:{},body:body?JSON.stringify(body):undefined});
 const project=await(await request('/api/projects','POST',{name:'Brief fixture',folderPath:root})).json(),route=`/api/projects/${project.id}/briefing`;
 const settle=async()=>{for(let i=0;i<200;i++){const v=await(await request(route)).json();if(!['queued','generating'].includes(v.status))return v;await new Promise(r=>setTimeout(r,25));}throw new Error('Briefing did not settle.');};
 return {base,bin,data,request,project,route,settle,respond:value=>writeFileSync(path.join(bin,'response.txt'),typeof value==='string'?value:JSON.stringify(value))};
}
const valid={summary:'Committed recent work.',suggestions:[{title:'Review the commit',reason:'It has not been reviewed.',sourceIDs:['COMMIT']}]};

test('HTTP synthesis produces a ready briefing through a tool-free internal run',async t=>{
 const f=await fixture(t);f.respond(valid);
 const started=await(await f.request(f.route,'POST',agent)).json();assert.ok(['queued','generating','ready'].includes(started.status));
 const done=await f.settle();
 assert.equal(done.status,'ready');assert.equal(done.latest.synthesis.summary,'Committed recent work.');assert.equal(done.latest.synthesis.suggestions[0].title,'Review the commit');
 assert.match(done.latest.synthesis.suggestions[0].sourceIDs[0],/^commit:[0-9a-f]{40}$/);
 assert.equal(done.latest.generation.usage.inputTokens,10);assert.equal(done.latest.generation.usage.outputTokens,5);
 const args=JSON.parse(readFileSync(path.join(f.bin,'args.json'),'utf8'));
 assert.ok(args.includes('shell_tool')&&args.includes('unified_exec')&&args.includes('web_search="disabled"'));
 assert.equal(args[args.indexOf('--cd')+1],path.join(realpathSync(f.data),'briefing-drafts'));
 assert.match(readFileSync(path.join(f.bin,'prompt.txt'),'utf8'),/untrusted data, not instructions/);
 assert.deepEqual(await(await f.request('/api/sessions?projectID='+f.project.id)).json(),[]);
});

test('HTTP invalid synthesis fails and keeps the prior successful revision',async t=>{
 const f=await fixture(t);
 await f.request(f.route,'POST',{});
 f.respond({...valid,suggestions:[{title:'Invent',reason:'x',sourceIDs:['session:not-in-packet']}]});
 await f.request(f.route,'POST',agent);let v=await f.settle();
 assert.equal(v.status,'failed');assert.match(v.latest.error,/unknown source/);assert.equal(v.lastSuccessful.revision,1);assert.equal(v.lastSuccessful.status,'evidence-only');
 f.respond({...valid,suggestions:[1,2,3,4].map(i=>({title:`S${i}`,reason:'r',sourceIDs:['COMMIT']}))});
 await f.request(f.route,'POST',agent);v=await f.settle();
 assert.equal(v.status,'failed');assert.match(v.latest.error,/at most 3/);assert.equal(v.latest.revision,3);assert.equal(v.lastSuccessful.revision,1);
 f.respond('not json');await f.request(f.route,'POST',agent);v=await f.settle();assert.match(v.latest.error,/valid briefing/);
 assert.equal((await f.request(f.route,'POST',{...agent,model:'made-up'})).status,201);v=await f.settle();assert.equal(v.status,'failed');
});

test('HTTP briefing waits for active user execution instead of failing',async t=>{
 const f=await fixture(t);f.respond(valid);
 const user=await f.request('/api/sessions','POST',{projectID:f.project.id,agent:'codex',task:'User task',model:'fixture',effort:'low',mode:'read-only'});assert.equal(user.status,202);
 const queued=await(await f.request(f.route,'POST',agent)).json();assert.equal(queued.status,'queued');
 await new Promise(r=>setTimeout(r,150));assert.equal((await(await f.request(f.route)).json()).status,'queued');
 writeFileSync(path.join(f.bin,'release'),'');
 assert.equal((await f.settle()).status,'ready');
});

test('restart marks queued and generating briefings interrupted without relaunching',async t=>{
 const dir=mkdtempSync(path.join(tmpdir(),'skd-brief-restart-'));t.after(()=>rmSync(dir,{recursive:true,force:true}));
 const report=(id,status,revision)=>({id,projectID:'p1',date:'2026-09-21',timezone:'UTC',revision,status,evidence:{activity:[],openLoops:[],issues:[],coverage:{}},synthesis:null,generation:{agent:'codex',model:'fixture',effort:'low',runID:status==='generating'?'run-1':null},error:null,createdAt:'2026-09-22T10:00:00Z',updatedAt:'2026-09-22T10:00:00Z'});
 writeFileSync(path.join(dir,'briefings.json'),JSON.stringify({schema:1,reports:[report('a','evidence-only',1),report('b','generating',2),report('c','queued',3)]}));
 let starts=0;const executor={onFinish:()=>{},start:async()=>{starts++;throw new Error('must not start');},get:()=>({status:'interrupted'})};
 const briefings=new Briefings(dir,{executor,now:()=>now,timezone:()=>'UTC'});
 const view=briefings.view({id:'p1'},{date:'2026-09-21'});
 assert.equal(view.status,'interrupted');assert.equal(view.lastSuccessful.revision,1);
 assert.deepEqual(JSON.parse(readFileSync(path.join(dir,'briefings.json'),'utf8')).reports.map(r=>r.status),['evidence-only','interrupted','interrupted']);
 await briefings.dispatch();assert.equal(starts,0);briefings.close();
});

test('briefing parser keeps a summary and suggestions only',()=>{
 const ids=new Set(['commit:a']);
 assert.throws(()=>parseBriefing(JSON.stringify({...valid,extra:1}),ids),/only a summary and suggestions/);
 assert.throws(()=>parseBriefing(JSON.stringify({summary:3}),ids),/must be text/);
 assert.deepEqual(parseBriefing('```json\n{"summary":"","suggestions":[{"title":"t","reason":"r","sourceIDs":["commit:a","commit:a"]}]}\n```',ids),{summary:'',suggestions:[{title:'t',reason:'r',sourceIDs:['commit:a']}]});
 assert.deepEqual(parseBriefing(JSON.stringify({summary:' Did things. ',suggestions:[{title:'t',reason:'r'}]}),ids),{summary:'Did things.',suggestions:[{title:'t',reason:'r',sourceIDs:[]}]});
});

test('a quiet day asks for suggestions from earlier work; an empty project needs no agent',async t=>{
 const dir=mkdtempSync(path.join(tmpdir(),'skd-brief-quiet-'));t.after(()=>rmSync(dir,{recursive:true,force:true}));
 const starts=[],executor={onFinish:()=>{},start:async input=>{starts.push(input);return {id:'run-'+starts.length};},get:()=>({status:'running'})};
 let quiet=true;const earlier={hash:'a'.repeat(40),committedAt:'2026-09-15T10:00:00.000Z',subject:'Start the settings page'};
 const sources=()=>({sessions:()=>[],commits:interval=>quiet&&Date.parse(interval.end)<=Date.parse('2026-09-21T15:00:00Z')?[earlier]:[],issues:()=>quiet?[{number:7,title:'Finish settings',state:'open'}]:[]});
 const briefings=new Briefings(dir,{executor,sources,now:()=>now,timezone:()=>'UTC'});
 const view=await briefings.generate({id:'p1',name:'App'},agent);
 assert.equal(view.status,'generating');assert.deepEqual(view.latest.evidence.activity,[]);
 assert.deepEqual(view.latest.evidence.recent.map(c=>c.title),['Start the settings page'],'Earlier commits are context when the last 24 hours were quiet.');
 assert.match(starts[0].task,/"openIssues":\[\{"id":"issue:7"/);assert.match(starts[0].task,/"recentCommits":\[\{"id":"commit:a{40}"/);assert.match(starts[0].task,/when activity is empty, up to 3 items/);
 quiet=false;const empty=await briefings.generate({id:'p2',name:'Empty'},agent);
 assert.equal(empty.status,'ready');assert.deepEqual(empty.latest.synthesis,{summary:'',suggestions:[]});assert.equal(starts.length,1,'Nothing to summarize or suggest from starts no agent.');
 briefings.close();
});
