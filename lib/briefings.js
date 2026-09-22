import {assert} from './domain.js';

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
