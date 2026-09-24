// Chat from the CLI's own session record (#48). Claude Code and Codex each write a live JSONL transcript of the
// session; Workbench reads it (never writes it) and turns it into chat events: the agent's replies, tool calls
// with their outcome, and questions waiting for an answer. The person's own lines come from the conversation
// thread, so user entries here are skipped.
import {readdir,stat,open} from 'node:fs/promises';
import {homedir} from 'node:os';
import path from 'node:path';

const OUTPUT=1500,TEXT=12000,EVENTS=400,READ=8*1024*1024;
const clip=(value,max)=>{const s=typeof value==='string'?value:value==null?'':JSON.stringify(value);return s.length>max?s.slice(0,max)+'…':s;};
const short=p=>typeof p==='string'?p.replace(/^file:\/\//,'').split('/').filter(Boolean).slice(-2).join('/'):'';
const hidden=name=>/(^|__)(post_message|post_coordinator_message)$/.test(name||'');

// A readable one-line label for a tool call.
export function toolLabel(name,input={}){
 const i=input||{};
 const mcp=/^mcp__([^_].*?)__(.+)$/.exec(name||'');
 if(mcp)return `${mcp[1]} · ${mcp[2].replace(/_/g,' ')}`;
 switch(name){
  case 'Bash':return i.description||`Ran ${clip(i.command,120)}`;
  case 'Read':return `Read ${short(i.file_path)}`;
  case 'Edit':case 'MultiEdit':return `Edited ${short(i.file_path)}`;
  case 'Write':return `Wrote ${short(i.file_path)}`;
  case 'NotebookEdit':return `Edited ${short(i.notebook_path)}`;
  case 'Grep':return `Searched for ${clip(i.pattern,80)}`;
  case 'Glob':return `Listed ${clip(i.pattern,80)}`;
  case 'WebFetch':return `Fetched ${clip(i.url,100)}`;
  case 'WebSearch':return `Searched the web: ${clip(i.query,100)}`;
  case 'Task':case 'Agent':return `Agent: ${clip(i.description||i.prompt,100)}`;
  case 'TodoWrite':return 'Updated the task list';
  case 'Skill':return `Skill: ${clip(i.skill||i.name,80)}`;
  default:return name||'Tool';
 }
}
const resultText=content=>Array.isArray(content)?content.map(c=>c?.type==='text'?c.text:c?.type==='image'?'[image]':'').join('\n'):typeof content==='string'?content:'';

// Claude Code: assistant text and tool_use blocks, tool_result blocks in user entries.
export function parseClaude(lines,state={events:[],byTool:new Map()}){
 for(const line of lines){
  let e;try{e=JSON.parse(line);}catch{continue;}
  if(e.type==='continued-in'&&e.continuedInSessionId){state.continuedIn=e.continuedInSessionId;continue;}
  const content=e.message?.content,at=e.timestamp||null;
  if(!Array.isArray(content)||e.isSidechain)continue;
  if(e.type==='assistant'){
   content.forEach((b,index)=>{
    if(b.type==='text'&&b.text?.trim())state.events.push({id:`${e.uuid}:${index}`,at,kind:'text',text:clip(b.text.trim(),TEXT)});
    if(b.type==='tool_use'){
     if(hidden(b.name))return;
     const event=b.name==='AskUserQuestion'
      ?{id:b.id,at,kind:'question',questions:(b.input?.questions||[]).slice(0,4).map(q=>({question:clip(q.question,500),header:clip(q.header,40),multiSelect:!!q.multiSelect,options:(q.options||[]).slice(0,6).map(o=>({label:clip(o.label,120),description:clip(o.description,300)}))})),status:'waiting'}
      :{id:b.id,at,kind:'tool',name:b.name,label:toolLabel(b.name,b.input),detail:clip(b.name==='Bash'?b.input?.command:b.input,OUTPUT),status:'running'};
     state.byTool.set(b.id,event);state.events.push(event);
    }
   });
  }else if(e.type==='user'){
   for(const b of content){
    if(b.type!=='tool_result')continue;
    const event=state.byTool.get(b.tool_use_id);if(!event)continue;
    const text=resultText(b.content);
    // Claude reports answers as "question"="answer" pairs; keep each chosen answer with its question.
    if(event.kind==='question'){event.status='answered';const pairs=[...text.matchAll(/"([^"]*)"="([^"]*)"/g)];event.answers=event.questions.map(q=>pairs.find(p=>p[1]===q.question)?.[2]||null);if(!pairs.length)event.answer=clip(text,600);}
    else{event.status=b.is_error?'error':'done';event.output=clip(text,OUTPUT);}
   }
  }
 }
 return state;
}

// Codex: one item_completed event per finished item; task_started / task_complete bracket each turn.
export function parseCodex(lines,state={events:[],byTool:new Map()}){
 for(const line of lines){
  let e;try{e=JSON.parse(line);}catch{continue;}
  if(e.type!=='event_msg')continue;
  const p=e.payload||{},at=e.timestamp||null;
  if(p.type==='task_started'){state.working=true;continue;}
  if(p.type==='task_complete'||p.type==='turn_aborted'){state.working=false;continue;}
  if(p.type!=='item_completed'||!p.item)continue;
  const it=p.item,id=it.id||`${at}:${state.events.length}`,failed=it.status==='failed'||it.status==='declined';
  const tool=(label,extra={})=>state.events.push({id,at,kind:'tool',name:it.type,label,status:failed?'error':'done',...extra});
  switch(it.type){
   case 'AgentMessage':{const text=(it.content||[]).map(c=>c?.text||'').join('').trim();if(text)state.events.push({id,at,kind:'text',text:clip(text,TEXT)});break;}
   case 'McpToolCall':if(!hidden(it.tool))tool(`${it.server} · ${String(it.tool||'').replace(/_/g,' ')}`,{detail:clip(it.arguments,OUTPUT),output:clip(resultText(it.result?.content),OUTPUT)});break;
   case 'CommandExecution':{const cmd=Array.isArray(it.command)?it.command.at(-1):it.command;tool(`Ran ${clip(cmd,120)}`,{detail:clip(cmd,OUTPUT),output:clip(`${it.stdout||''}${it.stderr||''}`,OUTPUT),status:failed||(Number.isInteger(it.exit_code)&&it.exit_code!==0)?'error':'done'});break;}
   case 'FileChange':{const files=Object.keys(it.changes||{});tool(`Edited ${files.slice(0,3).map(short).join(', ')}${files.length>3?` and ${files.length-3} more`:''}`,{output:clip(it.stdout,OUTPUT)});break;}
   case 'Extension':tool(it.kind==='web.search'?`Searched the web: ${clip(it.query,100)}`:`${it.kind||'Extension'}`);break;
   case 'ImageView':tool(`Viewed ${short(it.path)}`);break;
   case 'DynamicToolCall':case 'CollabAgentToolCall':tool(`${it.tool||it.type}`.replace(/_/g,' '));break;
   default:break;
  }
 }
 return state;
}

// Reads a transcript incrementally: only bytes appended since the last read are parsed.
export class TranscriptReader{
 constructor(file,provider){this.file=file;this.provider=provider;this.offset=0;this.rest='';this.state={events:[],byTool:new Map()};}
 async read(){
  let handle;try{handle=await open(this.file,'r');}catch{return this.view();}
  try{
   const {size}=await handle.stat();if(size<this.offset){this.offset=0;this.rest='';this.state={events:[],byTool:new Map()};}
   if(size>this.offset){
    const start=Math.max(this.offset,size-READ),length=size-start,buffer=Buffer.alloc(length);await handle.read(buffer,0,length,start);
    let text=(start>this.offset?'':this.rest)+buffer.toString('utf8');this.offset=size;
    const lines=text.split('\n');this.rest=lines.pop();
    (this.provider==='claude'?parseClaude:parseCodex)(lines,this.state);
    if(this.state.events.length>EVENTS*2){const keep=this.state.events.slice(-EVENTS);this.state.events=keep;}
   }
  }finally{await handle.close();}
  return this.view();
 }
 view(){return {events:this.state.events.slice(-EVENTS),working:!!this.state.working,continuedIn:this.state.continuedIn||null};}
}

// Where each CLI keeps its session record.
export async function findClaudeTranscript(sessionID,{home=homedir()}={}){
 const root=path.join(home,'.claude','projects');let dirs;try{dirs=await readdir(root);}catch{return null;}
 for(const dir of dirs){const file=path.join(root,dir,sessionID+'.jsonl');try{if((await stat(file)).isFile())return file;}catch{}}
 return null;
}
// Sessions started without a known ID: the first Claude transcript in the folder's project directory created
// after the session started that no other session has claimed.
export async function findClaudeTranscriptByFolder({cwd,startedAt,claimed=new Set(),home=homedir()}){
 const dir=path.join(home,'.claude','projects',path.resolve(cwd).replace(/[^a-zA-Z0-9]/g,'-')),started=Date.parse(startedAt)-5000;
 let names;try{names=await readdir(dir);}catch{return null;}
 const candidates=[];
 for(const name of names){if(!name.endsWith('.jsonl'))continue;const file=path.join(dir,name);if(claimed.has(file))continue;try{const info=await stat(file);if((info.birthtimeMs||info.mtimeMs)>=started)candidates.push({file,born:info.birthtimeMs||info.mtimeMs});}catch{}}
 candidates.sort((a,b)=>a.born-b.born);return candidates[0]?.file||null;
}
// Codex names its own session; the right file is the first one created after the session started in its folder
// that no other session has claimed.
export async function findCodexTranscript({cwd,startedAt,claimed=new Set(),home=homedir()}){
 const started=Date.parse(startedAt)-5000,root=path.join(home,'.codex','sessions'),candidates=[];
 for(const offset of [0,-1]){
  const d=new Date(Date.parse(startedAt)+offset*86400000),dir=path.join(root,String(d.getFullYear()),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0'));
  let names;try{names=await readdir(dir);}catch{continue;}
  for(const name of names){if(!/^rollout-.*\.jsonl$/.test(name))continue;const file=path.join(dir,name);if(claimed.has(file))continue;
   try{const info=await stat(file);if(info.birthtimeMs<started&&info.mtimeMs<started)continue;candidates.push({file,born:info.birthtimeMs||info.mtimeMs});}catch{}}
 }
 candidates.sort((a,b)=>a.born-b.born);
 for(const c of candidates){
  let handle;try{handle=await open(c.file,'r');const buffer=Buffer.alloc(65536);const {bytesRead}=await handle.read(buffer,0,65536,0);const first=buffer.toString('utf8',0,bytesRead).split('\n')[0];
   const meta=JSON.parse(first);if(meta.type==='session_meta'&&path.resolve(meta.payload?.cwd||'')===path.resolve(cwd))return c.file;}catch{}finally{await handle?.close();}
 }
 return null;
}
