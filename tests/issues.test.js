import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,writeFileSync,readFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {GitHubIssues,IssueProposals,repositoryFrom,parseProposal} from '../lib/issues.js';
import {CodexRuns} from '../lib/codex.js';
import {claudeArgs} from '../lib/claude.js';
const initial={id:101,number:7,title:'Original title',body:'Keep this checklist\n- [ ] Test',state:'open',updated_at:'2026-09-20T00:00:00Z',user:{login:'author'},labels:[],comments:0};
const candidate={title:'Clearer title',body:'Keep this checklist\n- [ ] Test\n\nAcceptance criteria.'};
const provider={version:'fixture',models:[{id:'fixture',efforts:['low','high']}]};
const pause=ms=>new Promise(r=>setTimeout(r,ms));
function setup(t,{output=JSON.stringify(candidate),hang=false}={}){
 const root=mkdtempSync(path.join(tmpdir(),'skd-issues-')),binary=path.join(root,'agent');
 writeFileSync(binary,`#!/usr/bin/env node\nconst fs=require('node:fs');fs.writeFileSync(${JSON.stringify(path.join(root,'argv.json'))},JSON.stringify(process.argv.slice(2)));let input='';process.stdin.on('data',c=>input+=c);process.stdin.on('end',()=>{fs.writeFileSync(${JSON.stringify(path.join(root,'prompt.txt'))},input);${hang?'setInterval(()=>{},1000);':`if(process.argv.includes('--print'))console.log(JSON.stringify({type:'result',subtype:'success',result:${JSON.stringify(output)}}));else{console.log(JSON.stringify({type:'item.completed',item:{type:'agent_message',text:${JSON.stringify(output)}}}));console.log(JSON.stringify({type:'turn.completed',usage:{input_tokens:12,output_tokens:8,cached_input_tokens:0}}));}`}});`,{mode:0o755});
 const executor=new CodexRuns(root,{binary,discover:async()=>provider,claudeOptions:{binary,discover:async()=>provider}});
 const state={issue:structuredClone(initial),repo:'owner/repo',writes:[],requests:[],failWrite:false,failRead:false};
 const github=new GitHubIssues({inspect:async()=>({git:{remotes:[{name:'origin',webURL:'https://github.com/'+state.repo}]}}),request:async(endpoint,method='GET',payload)=>{
  state.requests.push({endpoint,method});if(method==='PATCH'){state.writes.push(payload);if(state.failWrite)throw Error('timeout');state.issue={...state.issue,...payload,updated_at:'2026-09-21T00:00:00Z'};return structuredClone(state.issue);}
  if(state.failRead)throw Error('offline');if(endpoint.includes('/comments?'))return [];
  if(endpoint.includes('/issues?'))return [state.issue,{...state.issue,id:102,number:8,pull_request:{}}];return structuredClone(state.issue);
 }});
 const project={id:'project',name:'Fixture',folderPath:root},proposals=new IssueProposals(root,executor,github);
 t.after(()=>{executor.shutdown();rmSync(root,{recursive:true,force:true});});
 return {root,state,executor,github,proposals,project};
}
const input={agent:'codex',model:'fixture',effort:'high',instruction:'Clarify acceptance criteria.'};
async function ready(f,options=input){const p=await f.proposals.start(f.project,7,options);for(let i=0;i<200;i++){const r=f.proposals.get(p.id,f.project);if(r.status!=='generating')return r;await pause(20);}throw Error('Timed out');}
test('repository binding prefers origin and refuses ambiguous or non-GitHub targets',()=>{
 const c=remotes=>({git:{remotes}});assert.equal(repositoryFrom(c([{name:'origin',webURL:'https://github.com/a/b'},{name:'upstream',webURL:'https://github.com/c/d'}])),'a/b');
 assert.throws(()=>repositoryFrom(c([{name:'origin',webURL:'https://other.example/a/b'},{name:'upstream',webURL:'https://github.com/a/b'}])),/origin/);
 assert.throws(()=>repositoryFrom(c([{name:'one',webURL:'https://github.com/a/b'},{name:'two',webURL:'https://github.com/c/d'}])),/Multiple/);
 assert.throws(()=>repositoryFrom(c([])),/No GitHub/);
});
test('issue reads are GET-only, exclude pull requests, validate filter/page and fetch comments',async t=>{
 const f=setup(t),list=await f.github.list(f.project,{state:'closed',page:2});assert.equal(list.issues.length,1);assert.equal(list.repository,'owner/repo');assert.match(f.state.requests[0].endpoint,/state=closed.*page=2/);assert.equal((await f.github.detail(f.project,7)).issue.title,initial.title);assert(f.state.requests.every(r=>r.method==='GET'));
 await assert.rejects(f.github.list(f.project,{state:'bad'}));await assert.rejects(f.github.list(f.project,{page:-1}));f.state.issue.pull_request={};await assert.rejects(f.github.detail(f.project,7),/pull request/);
});
test('both headless providers honor model/effort and generate a persisted proposal without GitHub writes',async t=>{
 for(const agent of ['codex','claude']){const f=setup(t),p=await ready(f,{...input,agent});assert.equal(p.status,'ready',p.error);assert.deepEqual(p.proposed,candidate);assert.equal(p.run.agent,agent);assert.equal(p.run.model,'fixture');assert.equal(p.run.effort,'high');assert.equal(f.state.writes.length,0);
 const args=JSON.parse(readFileSync(path.join(f.root,'argv.json')));if(agent==='codex'){assert(args.includes('shell_tool'));assert(args.includes('unified_exec'));assert(args.includes('web_search="disabled"'));assert(args.includes('read-only'));}else assert.equal(args[args.indexOf('--tools')+1],'');
 assert.match(readFileSync(path.join(f.root,'prompt.txt'),'utf8'),/untrusted source data/);assert.equal(new IssueProposals(f.root,f.executor,f.github).get(p.id,f.project).status,'ready');
 await assert.rejects(f.proposals.start(f.project,7,{...input,effort:'invalid'}),/supported/);
 }
 assert.equal(claudeArgs({...input,purpose:'issue-proposal'})[claudeArgs({...input,purpose:'issue-proposal'}).indexOf('--tools')+1],'');
});
test('proposal parser rejects malformed, oversized and extra fields',()=>{for(const output of ['no json','{}',JSON.stringify({...candidate,state:'closed'}),JSON.stringify({title:' ',body:''}),JSON.stringify({title:'a',body:'x'.repeat(65537)})])assert.throws(()=>parseProposal(output));assert.deepEqual(parseProposal('```json\n'+JSON.stringify(candidate)+'\n```'),candidate);});
test('malformed agent output cannot be applied',async t=>{const f=setup(t,{output:'done!'}),p=await ready(f);assert.equal(p.status,'failed');await assert.rejects(f.proposals.apply(p.id,f.project),/Only a ready/);assert.equal(f.state.writes.length,0);});
test('explicit apply only sends title/body, reads back, and repeated apply is idempotent',async t=>{
 const f=setup(t),p=await ready(f);const results=await Promise.allSettled([f.proposals.apply(p.id,f.project),f.proposals.apply(p.id,f.project)]);assert.equal(results.filter(r=>r.status==='fulfilled').length,1);assert.deepEqual(f.state.writes,[candidate]);assert.equal(f.proposals.get(p.id,f.project).status,'applied');await f.proposals.apply(p.id,f.project);assert.equal(f.state.writes.length,1);assert.deepEqual(f.state.requests.slice(-2).map(r=>r.method),['PATCH','GET']);
});
test('stale issue, wrong project, moved issue, and changed repository cannot be overwritten',async t=>{
 for(const mutate of [f=>f.state.issue.title='Changed elsewhere',f=>f.state.issue.id=999,f=>f.state.repo='other/repo']){const f=setup(t),p=await ready(f);mutate(f);await assert.rejects(f.proposals.apply(p.id,f.project));assert.equal(f.state.writes.length,0);}
 const f=setup(t),p=await ready(f);assert.throws(()=>f.proposals.get(p.id,{...f.project,id:'other'}),/not found/);await assert.rejects(f.proposals.apply(p.id,{...f.project,folderPath:'/elsewhere'}),/repository changed/);
});
test('uncertain writes are not retried; verification is read-only and restart preserves uncertainty',async t=>{
 const f=setup(t),p=await ready(f);f.state.failWrite=true;await assert.rejects(f.proposals.apply(p.id,f.project),/uncertain/);await assert.rejects(f.proposals.apply(p.id,f.project),/Only a ready/);assert.equal(f.state.writes.length,1);
 f.state.issue={...f.state.issue,...candidate};assert.equal((await f.proposals.verify(p.id,f.project)).status,'applied');assert.equal(f.state.writes.length,1);
 f.proposals.records[0].status='applying';f.proposals.persist();const restored=new IssueProposals(f.root,f.executor,f.github);assert.equal(restored.get(p.id,f.project).status,'uncertain');
});
test('cancellation and server interruption never publish or relaunch drafts; shared executor lock holds',async t=>{
 const f=setup(t,{hang:true}),p=await f.proposals.start(f.project,7,input);await assert.rejects(f.executor.start({...input,task:'another',mode:'read-only'},f.project),/already running/);f.proposals.stop(p.id,f.project);for(let i=0;i<100&&f.proposals.get(p.id,f.project).status==='generating';i++)await pause(20);assert.equal(f.proposals.get(p.id,f.project).status,'cancelled');
 const q=await f.proposals.start(f.project,7,input);f.executor.shutdown();assert.equal(f.proposals.get(q.id,f.project).status,'interrupted');assert.equal(f.state.writes.length,0);
});
test('gh adapter uses explicit HTTP methods and stdin JSON, preserving literal issue text',async t=>{
 const root=mkdtempSync(path.join(tmpdir(),'skd-gh-cli-')),binary=path.join(root,'gh'),receipt=path.join(root,'receipt.json');t.after(()=>rmSync(root,{recursive:true,force:true}));
 writeFileSync(binary,`#!/usr/bin/env node\nlet input='';process.stdin.on('data',c=>input+=c);process.stdin.on('end',()=>{require('node:fs').writeFileSync(${JSON.stringify(receipt)},JSON.stringify({args:process.argv.slice(2),input}));console.log('{}');});`,{mode:0o755});
 const gh=new GitHubIssues({binary});const payload={title:'$(do not execute)',body:'@/private/file\n`literal` ${secret}'};await gh.request('repos/owner/repo/issues/7','PATCH',payload);const r=JSON.parse(readFileSync(receipt));assert.deepEqual(JSON.parse(r.input),payload);assert(r.args.includes('PATCH'));assert(r.args.includes('github.com'));assert(!r.args.includes(payload.body));
 await gh.request('repos/owner/repo/issues?state=open');assert(JSON.parse(readFileSync(receipt)).args.includes('GET'));
 await assert.rejects(new GitHubIssues({binary:path.join(root,'missing')}).request('repos/owner/repo/issues'),/CLI is missing/);
 writeFileSync(binary,'#!/usr/bin/env node\nconsole.error("HTTP 401 authentication required");process.exit(1);',{mode:0o755});await assert.rejects(gh.request('repos/owner/repo/issues'),/sign-in/);
});
