import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,writeFileSync,appendFileSync,rmSync,utimesSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {parseClaude,parseCodex,TranscriptReader,findClaudeTranscript,findClaudeTranscriptByFolder,findCodexTranscript,toolLabel} from '../lib/transcripts.js';
import {CoordinatorSessions} from '../lib/coordinator-sessions.js';
import {instructions} from '../lib/coordinator-agent.js';

// Chat is built from each CLI's own session transcript (#48); these shapes follow real Claude Code and Codex files.
const line=v=>JSON.stringify(v);
const claude=(type,content,extra={})=>line({type,uuid:extra.uuid||Math.random().toString(36).slice(2),timestamp:extra.at||'2026-09-24T20:00:00.000Z',message:{role:type,content},...extra});
const ask={questions:[{question:'Which colour?',header:'Colour',multiSelect:false,options:[{label:'Red',description:'Warm'},{label:'Blue',description:'Cool'}]}]};

test('Claude transcripts become replies, tool steps with outcomes and questions; posts and user lines are left out',()=>{
 const lines=[claude('user',[{type:'text',text:'hi'}]),claude('assistant',[{type:'thinking',thinking:'x'},{type:'text',text:'Looking now.'},{type:'tool_use',id:'t1',name:'Bash',input:{command:'npm test'}}],{uuid:'a1'}),
  claude('user',[{type:'tool_result',tool_use_id:'t1',content:'fail',is_error:true}]),claude('assistant',[{type:'tool_use',id:'t2',name:'mcp__workbench__post_message',input:{text:'x'}}]),
  claude('assistant',[{type:'tool_use',id:'t3',name:'Read',input:{file_path:'/a/b/c.js'}},{type:'tool_use',id:'q1',name:'AskUserQuestion',input:ask}]),
  claude('user',[{type:'tool_result',tool_use_id:'t3',content:[{type:'text',text:'file'}]}]),'not json',line({type:'continued-in',continuedInSessionId:'next'})];
 const s=parseClaude(lines);
 assert.deepEqual(s.events.map(e=>[e.kind,e.label||e.text||e.questions?.[0].question,e.status||null]),[['text','Looking now.',null],['tool','Ran npm test','error'],['tool','Read b/c.js','done'],['question','Which colour?','waiting']]);
 assert.equal(s.events[1].output,'fail');assert.equal(s.continuedIn,'next');
 parseClaude([claude('user',[{type:'tool_result',tool_use_id:'q1',content:'Your questions have been answered: "Which colour?"="Blue". You can now continue.'}])],s);
 assert.deepEqual([s.events[3].status,s.events[3].answers],['answered',['Blue']]);
 assert.equal(toolLabel('mcp__tracker-trapper__start_task',{}),'tracker-trapper · start task');
});

test('Codex transcripts become replies and tool steps; open turns count as working',()=>{
 const ev=(payload,at='2026-09-24T20:00:00Z')=>line({timestamp:at,type:'event_msg',payload});
 const s=parseCodex([ev({type:'task_started'}),ev({type:'item_completed',item:{type:'UserMessage',id:'u',content:[{type:'text',text:'hi'}]}}),ev({type:'item_completed',item:{type:'AgentMessage',id:'m1',content:[{type:'Text',text:'On it.'}]}}),
  ev({type:'item_completed',item:{type:'CommandExecution',id:'c1',command:['/bin/zsh','-lc','npm test'],status:'completed',exit_code:1,stdout:'1 failing'}}),ev({type:'item_completed',item:{type:'McpToolCall',id:'x',server:'workbench',tool:'post_coordinator_message'}}),
  ev({type:'item_completed',item:{type:'FileChange',id:'f',changes:{'/p/a.js':{},'/p/b.js':{}}}}),ev({type:'item_completed',item:{type:'McpToolCall',id:'m2',server:'workbench',tool:'list_projects',status:'completed',result:{content:[{type:'text',text:'ok'}]}}})]);
 assert.deepEqual(s.events.map(e=>[e.kind,e.label||e.text,e.status||null]),[['text','On it.',null],['tool','Ran npm test','error'],['tool','Edited p/a.js, p/b.js','done'],['tool','workbench · list projects','done']]);
 assert.equal(s.working,true);parseCodex([ev({type:'task_complete'})],s);assert.equal(s.working,false);
});

test('transcripts are found by session ID, by folder, and for Codex by folder and start time; reading is incremental',async t=>{
 const home=mkdtempSync(path.join(tmpdir(),'skd-tx-'));t.after(()=>rmSync(home,{recursive:true,force:true}));
 const dir=path.join(home,'.claude','projects','-work-app');mkdirSync(dir,{recursive:true});const file=path.join(dir,'s1.jsonl');writeFileSync(file,claude('assistant',[{type:'text',text:'one'}])+'\n');
 assert.equal(await findClaudeTranscript('s1',{home}),file);assert.equal(await findClaudeTranscript('missing',{home}),null);
 assert.equal(await findClaudeTranscriptByFolder({cwd:'/work/app',startedAt:new Date(Date.now()-60000).toISOString(),home}),file);
 assert.equal(await findClaudeTranscriptByFolder({cwd:'/work/app',startedAt:new Date(Date.now()-60000).toISOString(),claimed:new Set([file]),home}),null);
 const now=new Date(),day=path.join(home,'.codex','sessions',String(now.getFullYear()),String(now.getMonth()+1).padStart(2,'0'),String(now.getDate()).padStart(2,'0'));mkdirSync(day,{recursive:true});
 const meta=cwd=>line({type:'session_meta',payload:{id:'x',cwd}})+'\n';
 writeFileSync(path.join(day,'rollout-a.jsonl'),meta('/other'));writeFileSync(path.join(day,'rollout-b.jsonl'),meta('/work/app'));
 assert.equal(await findCodexTranscript({cwd:'/work/app',startedAt:new Date(Date.now()-60000).toISOString(),home}),path.join(day,'rollout-b.jsonl'));
 const reader=new TranscriptReader(file,'claude');assert.equal((await reader.read()).events.length,1);
 appendFileSync(file,claude('assistant',[{type:'text',text:'two'}]));assert.equal((await reader.read()).events.length,1,'A line still being written waits.');
 appendFileSync(file,'\n');assert.deepEqual((await reader.read()).events.map(e=>e.text),['one','two']);
});

test('a session serves its transcript to Chat and takes answers as the keys the CLI expects',async t=>{
 const root=mkdtempSync(path.join(tmpdir(),'skd-tx-session-'));t.after(()=>rmSync(root,{recursive:true,force:true}));
 const home=path.join(root,'home'),writes=[];let args=null;
 const spawn=(file,a)=>{args=a;return {pid:1,write:d=>writes.push(d),resize(){},kill(){},onData(){},onExit(){}};};
 const sessions=new CoordinatorSessions(path.join(root,'data'),{spawn,transcriptHome:home});
 const s=sessions.start('p1',{provider:'claude',model:'m',effort:'default',binary:'claude',credentialPath:'c',system:'S',prompt:'P',cwd:'/work/app'});
 assert.equal(args[args.indexOf('--session-id')+1],s.id,'Claude records the session under its Workbench ID.');
 const dir=path.join(home,'.claude','projects','-work-app');mkdirSync(dir,{recursive:true});
 writeFileSync(path.join(dir,s.id+'.jsonl'),[claude('assistant',[{type:'text',text:'Hello'}]),claude('assistant',[{type:'tool_use',id:'q1',name:'AskUserQuestion',input:ask}])].join('\n')+'\n');
 const view=await sessions.transcript('p1');
 assert.deepEqual([view.running,view.provider,view.events.map(e=>e.kind)],[true,'claude',['text','question']]);
 sessions.answer(s.id,{options:[1]});await new Promise(r=>setTimeout(r,1000));assert.deepEqual(writes,['2','\r']);
 sessions.answer(s.id,{permission:'deny'});await new Promise(r=>setTimeout(r,500));assert.equal(writes.at(-1),'\x1b');
 assert.throws(()=>sessions.answer(s.id,{options:[9]}),/one option/);assert.throws(()=>sessions.answer(s.id,{keys:'rm -rf'}),/Choose an answer/);
 sessions.shutdown();
});

test('agents answer in their reply; they are no longer told to post it',()=>{
 for(const scope of [{},{projectID:'p1',projectName:'App'}]){const text=instructions(scope);assert.doesNotMatch(text,/post your answer/i);assert.match(text,/shows your replies/);}
});
