import {existsSync,readFileSync,writeFileSync,renameSync,copyFileSync,chmodSync,mkdirSync} from 'node:fs';
import path from 'node:path';
import {createHash,randomUUID} from 'node:crypto';
import {assert,copy,now} from './domain.js';
// Project conversation between the user and the external coordinator acting as project owner.
// Messages are records, not instructions to Workbench: posting never starts execution or changes a mandate.
export const refKinds=['run','issue','workflow','session','operation'];
const MAX_MESSAGES=1000,damaged='Damaged project conversations. Restore project-threads.json from backup.';
const fingerprint=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
const validMessage=m=>m&&typeof m.id==='string'&&['user','agent'].includes(m.author)&&typeof m.text==='string'&&typeof m.createdAt==='string'&&Array.isArray(m.refs)&&m.refs.every(r=>r&&refKinds.includes(r.kind)&&typeof r.id==='string');
function validateStore(value){
 assert(value&&value.schema===1&&Array.isArray(value.threads)&&value.threads.every(t=>t&&typeof t.projectID==='string'&&Number.isSafeInteger(t.revision)&&Number.isSafeInteger(t.trimmed)&&Array.isArray(t.messages)&&t.messages.every(validMessage)),damaged);
 assert(new Set(value.threads.map(t=>t.projectID)).size===value.threads.length,damaged);
 return value;
}
export class ProjectThreads{
 constructor(directory,{runs=()=>[]}={}){
  mkdirSync(directory,{recursive:true});this.file=path.join(directory,'project-threads.json');this.runs=runs;
  if(existsSync(this.file)){let parsed;try{parsed=JSON.parse(readFileSync(this.file,'utf8'));}catch{assert(false,damaged);}this.data=validateStore(parsed);}
  else this.data={schema:1,threads:[]};
 }
 persist(next){const temporary=this.file+'.tmp';writeFileSync(temporary,JSON.stringify(next,null,2),{mode:0o600});chmodSync(temporary,0o600);if(existsSync(this.file))copyFileSync(this.file,this.file+'.bak');renameSync(temporary,this.file);}
 thread(projectID){return this.data.threads.find(t=>t.projectID===projectID)||{projectID,revision:0,trimmed:0,messages:[]};}
 list(projectID,{cursor=0,limit=50}={}){const t=this.thread(projectID),items=t.messages.slice(cursor,cursor+limit);return {revision:t.revision,trimmed:t.trimmed,total:t.messages.length,items:copy(items),nextCursor:cursor+limit<t.messages.length?cursor+limit:null};}
 recent(projectID,count=50){const t=this.thread(projectID);return {revision:t.revision,trimmed:t.trimmed,total:t.messages.length,items:copy(t.messages.slice(-count))};}
 refs(projectID,value){
  assert(value===undefined||Array.isArray(value)&&value.length<=10,'Attach at most 10 record links.');
  return (value||[]).map(r=>{
   assert(r&&typeof r==='object'&&Object.keys(r).every(k=>['kind','id'].includes(k))&&refKinds.includes(r.kind)&&typeof r.id==='string'&&/^[\w.#:/-]{1,120}$/.test(r.id),'Invalid record link.');
   // Run links must name a canonical run in this project; other kinds are opaque references.
   if(r.kind==='run')assert(this.runs().some(run=>run.id===r.id&&run.projectID===projectID),'Linked run is not in this project.',404);
   return {kind:r.kind,id:r.id};
  });
 }
 // requestKey makes a post idempotent for its author: the same key and text return the original message.
 post(project,{author,text,refs,requestKey,controller=null}){
  assert(project.id!=='unassigned'&&project.folderPath,'Connect a project folder before starting a conversation.');
  assert(typeof text==='string'&&text.trim()&&Buffer.byteLength(text)<=8192&&!text.includes('\0'),'Messages must contain 1–8 KiB of text.');
  assert(typeof requestKey==='string'&&requestKey.length>=1&&requestKey.length<=100&&!requestKey.includes('\0'),'A request key of 1–100 characters is required.');
  const links=this.refs(project.id,refs),body={author,text:text.trim(),refs:links},fp=fingerprint(body),owner=controller?.id||null;
  const prior=this.thread(project.id).messages.find(m=>m.requestKey===requestKey&&(m.controllerID||null)===owner);
  if(prior){assert(prior.fingerprint===fp,'Request key already used with a different message.',409);return copy(prior);}
  const message={id:randomUUID(),...body,createdAt:now(),requestKey,fingerprint:fp,...(controller?{controllerID:controller.id,controllerName:controller.name}:{})};
  const next=copy(this.data);let t=next.threads.find(t=>t.projectID===project.id);if(!t){t={projectID:project.id,revision:0,trimmed:0,messages:[]};next.threads.push(t);}
  t.messages.push(message);if(t.messages.length>MAX_MESSAGES){t.trimmed+=t.messages.length-MAX_MESSAGES;t.messages=t.messages.slice(-MAX_MESSAGES);}t.revision++;
  validateStore(next);this.persist(next);this.data=next;return copy(message);
 }
}
