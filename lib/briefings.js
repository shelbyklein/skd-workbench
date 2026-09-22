import {existsSync,readFileSync,writeFileSync,renameSync,mkdirSync} from 'node:fs';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
import {assert} from './domain.js';
import {readGit} from './git-read.js';

export const SOURCE_LIMIT=50,TITLE_LIMIT=200,OPEN_LOOP_DAYS=14;
const DAY=86400000;
const clip=(value,max=TITLE_LIMIT)=>typeof value==='string'?value.replace(/\s+/g,' ').trim().slice(0,max):'';
const ms=value=>{const n=Date.parse(value);return Number.isFinite(n)?n:null;};
const iso=n=>new Date(n).toISOString();

export function validTimezone(timezone){
 try{new Intl.DateTimeFormat('en-US',{timeZone:timezone});return typeof timezone==='string'&&timezone.length<=100;}catch{return false;}
}
export function serverTimezone(){return Intl.DateTimeFormat().resolvedOptions().timeZone||'UTC';}
function offset(at,timezone){
 const parts=Object.fromEntries(new Intl.DateTimeFormat('en-US',{timeZone:timezone,hourCycle:'h23',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit'}).formatToParts(at).map(p=>[p.type,p.value]));
 return Date.UTC(+parts.year,+parts.month-1,+parts.day,+parts.hour,+parts.minute,+parts.second)-Math.floor(at/1000)*1000;
}
function midnight(y,m,d,timezone){
 const guess=Date.UTC(y,m-1,d);let start=guess-offset(guess,timezone);start=guess-offset(start,timezone);return start;
}
// Local calendar date (YYYY-MM-DD) of an instant in a timezone.
export function localDate(at,timezone){
 const parts=Object.fromEntries(new Intl.DateTimeFormat('en-US',{timeZone:timezone,year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(at).map(p=>[p.type,p.value]));
 return `${parts.year}-${parts.month}-${parts.day}`;
}
export function previousDate(date){const [y,m,d]=date.split('-').map(Number);return new Date(Date.UTC(y,m-1,d)-DAY).toISOString().slice(0,10);}
// Exact UTC interval of a calendar day in a timezone; 23 or 25 hours on DST transitions.
export function dayInterval(date,timezone){
 assert(typeof date==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(date)&&new Date(date+'T00:00:00Z').toISOString().startsWith(date),'Choose a valid date (YYYY-MM-DD).');
 assert(validTimezone(timezone),'Choose a valid IANA timezone.');
 const [y,m,d]=date.split('-').map(Number),next=new Date(Date.UTC(y,m-1,d)+DAY);
 return {date,timezone,start:iso(midnight(y,m,d,timezone)),end:iso(midnight(next.getUTCFullYear(),next.getUTCMonth()+1,next.getUTCDate(),timezone))};
}

const activeSession=['preparing','running','stopping'];
const loopSession=[...activeSession,'failed','interrupted'];
const doneWorkflow=['completed','cancelled'];
const doneDelegation=['accepted','cancelled'];
const kinds={
 session:{records:'sessions',title:r=>r.task,loop:r=>loopSession.includes(r.status),include:r=>!r.workflowID&&!r.delegationID&&!r.purpose},
 terminal:{records:'terminals',title:r=>r.task,loop:r=>loopSession.includes(r.status),include:()=>true},
 imported:{records:'imports',title:r=>r.title||r.task,loop:()=>false,include:()=>true},
 workflow:{records:'workflows',title:r=>r.flow?.name?`${r.flow.name}: ${r.task||''}`:r.task,loop:r=>!doneWorkflow.includes(r.status),include:()=>true},
 delegation:{records:'delegations',title:r=>r.task,loop:r=>!doneDelegation.includes(r.status),include:()=>true}
};
function entry(kind,r,interval){
 const started=ms(r.startedAt)??ms(r.createdAt),finished=ms(r.finishedAt),start=ms(interval.start),end=ms(interval.end);
 return {id:`${kind}:${r.id}`,kind,recordID:r.id,title:clip(kinds[kind].title(r))||`Untitled ${kind}`,status:clip(r.status,40)||'unknown',startedAt:started===null?null:iso(started),finishedAt:finished===null?null:iso(finished),
  // Records spanning the interval boundary did not necessarily do all their work inside it.
  partial:started!==null&&(started<start||finished===null||finished>=end)};
}
async function read(source,label){
 if(typeof source!=='function')return {coverage:{status:'unavailable',count:0,reason:`${label} are not available.`},records:[]};
 try{const records=await source();assert(Array.isArray(records),`${label} returned an invalid list.`);return {records};}
 catch(e){return {coverage:{status:'unavailable',count:0,reason:clip(e.message,300)||`${label} could not be read.`},records:[]};}
}
function bounded(items){const truncated=items.length>SOURCE_LIMIT;return {items:items.slice(0,SOURCE_LIMIT),truncated};}

// Collects a bounded, project-scoped evidence packet. Source functions return raw records;
// a missing or failing source is reported as unavailable rather than empty.
export async function collectEvidence({project,date,timezone,sources={},now=Date.now()}){
 assert(project?.id,'Project not found.',404);
 const interval=dayInterval(date,timezone),start=ms(interval.start),end=ms(interval.end),loopSince=now-OPEN_LOOP_DAYS*DAY;
 const coverage={},activity=[],openLoops=[];
 for(const [kind,spec] of Object.entries(kinds)){
  const label=`${kind[0].toUpperCase()}${kind.slice(1)} records`,result=await read(sources[spec.records],label);
  if(result.coverage){coverage[kind]=result.coverage;continue;}
  const records=result.records.filter(r=>r&&typeof r.id==='string'&&r.projectID===project.id&&spec.include(r));
  const overlapping=records.filter(r=>{const s=ms(r.startedAt)??ms(r.createdAt),f=ms(r.finishedAt);return s!==null&&s<end&&(f===null?now:f)>=start;}).sort((a,b)=>(ms(a.startedAt)??ms(a.createdAt))-(ms(b.startedAt)??ms(b.createdAt)));
  const loops=records.filter(r=>spec.loop(r)&&(ms(r.createdAt)??0)>=loopSince).sort((a,b)=>ms(b.createdAt)-ms(a.createdAt));
  const day=bounded(overlapping.map(r=>entry(kind,r,interval))),open=bounded(loops.map(r=>entry(kind,r,interval)));
  activity.push(...day.items);openLoops.push(...open.items);
  coverage[kind]={status:day.truncated||open.truncated?'partial':'complete',count:overlapping.length,reason:day.truncated||open.truncated?`Only the first ${SOURCE_LIMIT} records are included.`:null};
 }
 if(sources.commits){
  const result=await read(()=>sources.commits(interval),'Commits');
  if(result.coverage)coverage.commits=result.coverage;
  else{const commits=result.records.slice(0,SOURCE_LIMIT).map(c=>({id:`commit:${c.hash}`,kind:'commit',recordID:c.hash,title:clip(c.subject)||'(no subject)',status:'committed',startedAt:c.committedAt,finishedAt:c.committedAt,partial:false}));
   activity.push(...commits);coverage.commits={status:result.records.truncated||result.records.length>SOURCE_LIMIT?'partial':'complete',count:commits.length,reason:result.records.truncated||result.records.length>SOURCE_LIMIT?`Only the latest ${SOURCE_LIMIT} commits are included.`:null};}
 }else coverage.commits={status:'unavailable',count:0,reason:'Commit history is not available.'};
 const issues=await read(sources.issues,'Open issues');
 let context=[];
 if(issues.coverage)coverage.issues=issues.coverage;
 else{const list=bounded(issues.records);context=list.items.map(i=>({id:`issue:${i.number}`,kind:'issue',recordID:String(i.number),title:clip(i.title)||`Issue #${i.number}`,status:clip(i.state,20)||'open',updatedAt:i.updatedAt||null,url:typeof i.url==='string'?i.url:null}));
  coverage.issues={status:list.truncated||issues.records.truncated?'partial':'complete',count:context.length,reason:list.truncated||issues.records.truncated?'Only the first page of open issues is included.':null};}
 return {schema:1,projectID:project.id,interval,collectedAt:iso(now),activity,openLoops,issues:context,coverage};
}

// Commits on the project's checked-out HEAD, limited to the project folder and interval.
export async function readCommits(folder,interval,{limit=SOURCE_LIMIT}={}){
 const head=await readGit(folder,['rev-parse','--verify','--quiet','HEAD']);
 if(!head.ok){if(head.notRepo||head.unavailable)throw new Error(head.unavailable?'Git is not installed.':'This folder is not a Git repository.');return [];}
 const log=await readGit(folder,['log','HEAD','--no-color','--no-show-signature',`--since=${interval.start}`,`--until=${interval.end}`,`--max-count=${limit+1}`,'--format=%H%x1f%cI%x1f%s','--','.']);
 if(!log.ok)throw new Error('Commit history could not be read.');
 const commits=log.value?log.value.split('\n').map(line=>{const [hash,committedAt,subject]=line.split('\x1f');return {hash,committedAt:iso(Date.parse(committedAt)),subject:clip(subject)};}).filter(c=>/^[0-9a-f]{40,64}$/.test(c.hash)&&Date.parse(c.committedAt)>=Date.parse(interval.start)&&Date.parse(c.committedAt)<Date.parse(interval.end)):[];
 const result=commits.slice(0,limit);result.truncated=commits.length>limit;return result;
}

const REPORT_LIMIT=2000,settled=['ready','evidence-only'];
function validReport(r){
 return r&&typeof r.id==='string'&&typeof r.projectID==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(r.date)&&typeof r.timezone==='string'&&Number.isSafeInteger(r.revision)&&r.revision>0&&typeof r.status==='string'&&r.evidence&&typeof r.evidence==='object'&&Number.isFinite(Date.parse(r.createdAt));
}
// Versioned, generated briefing reports. Source records stay authoritative; a report is a
// snapshot of what was collected and synthesized at generation time.
export class Briefings{
 constructor(directory,{sources,now=()=>Date.now(),timezone=serverTimezone}={}){
  this.file=path.join(directory,'briefings.json');this.sources=sources;this.now=now;this.timezone=timezone;this.pending=new Map();this.loadError=null;this.reports=[];
  mkdirSync(directory,{recursive:true});
  if(existsSync(this.file)){
   // A damaged store disables briefings visibly instead of being replaced with empty data.
   try{const data=JSON.parse(readFileSync(this.file,'utf8'));assert(data?.schema===1&&Array.isArray(data.reports)&&data.reports.every(validReport),'invalid');this.reports=data.reports;}
   catch{this.loadError='Briefing history is damaged. Restore briefings.json from a backup; it was not replaced.';}
  }
 }
 ready(){assert(!this.loadError,this.loadError,500);}
 persist(){const data=JSON.stringify({schema:1,reports:this.reports.slice(-REPORT_LIMIT)},null,2);writeFileSync(this.file+'.tmp',data,{mode:0o600});renameSync(this.file+'.tmp',this.file);}
 scope(project,input={}){
  const timezone=input.timezone??this.timezone();assert(validTimezone(timezone),'Choose a valid IANA timezone.');
  const date=input.date??previousDate(localDate(this.now(),timezone));dayInterval(date,timezone);
  return {date,timezone,key:`${project.id}|${date}|${timezone}`};
 }
 history(projectID,date,timezone){return this.reports.filter(r=>r.projectID===projectID&&r.date===date&&r.timezone===timezone).sort((a,b)=>a.revision-b.revision);}
 view(project,input={}){
  this.ready();const {date,timezone}=this.scope(project,input),list=this.history(project.id,date,timezone),latest=list.at(-1)||null;
  const lastGood=[...list].reverse().find(r=>settled.includes(r.status))||null;
  return {projectID:project.id,date,timezone,status:latest?latest.status:'absent',latest:latest&&structuredClone(latest),lastSuccessful:lastGood&&lastGood!==latest?structuredClone(lastGood):null};
 }
 latestFor(projectID){
  this.ready();const list=this.reports.filter(r=>r.projectID===projectID);if(!list.length)return null;
  return structuredClone(list.reduce((a,b)=>b.date>a.date||(b.date===a.date&&b.revision>a.revision)?b:a));
 }
 update(id,fn){const r=this.reports.find(r=>r.id===id);assert(r,'Briefing not found.',404);fn(r);r.updatedAt=new Date(this.now()).toISOString();this.persist();return structuredClone(r);}
 // Concurrent requests for one project, date and timezone share a single job.
 generate(project,input={}){
  this.ready();const scope=this.scope(project,input);
  if(this.pending.has(scope.key))return this.pending.get(scope.key);
  const job=this.run(project,scope,input).finally(()=>this.pending.delete(scope.key));
  this.pending.set(scope.key,job);return job;
 }
 async run(project,{date,timezone},input){
  const evidence=await collectEvidence({project,date,timezone,now:this.now(),sources:this.sources(project)});
  const at=new Date(this.now()).toISOString(),revision=(this.history(project.id,date,timezone).at(-1)?.revision||0)+1;
  const report={id:randomUUID(),projectID:project.id,date,timezone,revision,status:'evidence-only',evidence,synthesis:null,generation:null,error:null,createdAt:at,updatedAt:at};
  this.reports.push(report);this.persist();
  if(input.synthesize&&this.synthesize)await this.synthesize(report.id,project,input);
  return this.view(project,{date,timezone});
 }
}
