import {mkdirSync,existsSync,readFileSync,writeFileSync,renameSync,unlinkSync,openSync,closeSync,fsyncSync,statSync,readdirSync} from 'node:fs';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
import {assert,copy} from './domain.js';
const MAX_BYTES=4*1024*1024,MAX_ROWS=10000,MAX_BATCH=500;
const only=(v,allowed)=>assert(v&&typeof v==='object'&&!Array.isArray(v)&&Object.keys(v).every(k=>allowed.includes(k)),'Invalid source activity fields.');
const key=v=>assert(typeof v==='string'&&/^[a-f0-9]{64}$/i.test(v),'Invalid activity repository identity.');
const uuid=v=>assert(typeof v==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(v),'Invalid activity lifecycle ID.');
const commit=v=>assert(v===null||typeof v==='string'&&/^(?:[a-f0-9]{40}|[a-f0-9]{64})$/i.test(v),'Invalid activity commit.');
const fingerprint=v=>assert(v===null||typeof v==='string'&&/^[a-f0-9]{64}$/i.test(v),'Invalid source fingerprint.');
function timestamp(value){const ms=typeof value==='number'?value:typeof value==='string'?Date.parse(value):NaN;assert(Number.isFinite(ms)&&ms>=0,'Invalid observation time.');return new Date(ms).toISOString();}
function atomic(file,data){const tmp=file+'.'+randomUUID()+'.tmp';try{writeFileSync(tmp,JSON.stringify(data,null,2),{flag:'wx',mode:0o600});const fd=openSync(tmp,'r');try{fsyncSync(fd);}finally{closeSync(fd);}renameSync(tmp,file);const dir=openSync(path.dirname(file),'r');try{fsyncSync(dir);}finally{closeSync(dir);}}finally{try{unlinkSync(tmp);}catch{}}}
// Receives bounded Git observations from explicit Check project only. No file or
// Git inspection occurs here. changedAt means "change observed at", not edit time.
export class LifecycleActivity{
 constructor(directory){mkdirSync(directory,{recursive:true});this.file=path.join(directory,'lifecycle-activity.json');this.backupDirectory=path.join(directory,'lifecycle-activity-backups');
  if(existsSync(this.file)){try{assert(statSync(this.file).size<=MAX_BYTES,'Source activity exceeds 4 MiB.');this.data=JSON.parse(readFileSync(this.file,'utf8'));this.validate(this.data);}catch(e){throw Error(`Source activity store is damaged or unsupported; restore a backup. ${e.message}`);}}
  else{this.data={version:1,revision:0,rows:[]};atomic(this.file,this.data);}
 }
 get revision(){return this.data.revision;}
 validate(data){only(data,['version','revision','rows']);assert(data.version===1&&Number.isSafeInteger(data.revision)&&data.revision>=0&&Array.isArray(data.rows)&&data.rows.length<=MAX_ROWS,'Invalid source activity store.');const seen=new Set();for(const row of data.rows){only(row,['id','repositoryKey','baseline','changedAt','observedAt','complete']);uuid(row.id);key(row.repositoryKey);const identity=row.repositoryKey+':'+row.id;assert(!seen.has(identity),'Duplicate source activity identity.');seen.add(identity);assert(typeof row.complete==='boolean','Invalid activity completeness.');assert(timestamp(row.observedAt)===row.observedAt,'Invalid activity observation time.');if(row.changedAt!==null)assert(timestamp(row.changedAt)===row.changedAt&&Date.parse(row.changedAt)<=Date.parse(row.observedAt),'Invalid change observation time.');if(row.baseline!==null){only(row.baseline,['commit','fingerprint','at']);commit(row.baseline.commit);fingerprint(row.baseline.fingerprint);assert(row.baseline.commit&&row.baseline.fingerprint&&timestamp(row.baseline.at)===row.baseline.at&&Date.parse(row.baseline.at)<=Date.parse(row.observedAt),'Invalid source baseline.');if(row.changedAt)assert(Date.parse(row.changedAt)>=Date.parse(row.baseline.at),'Change predates source baseline.');}else assert(row.changedAt===null&&!row.complete,'Unknown first sight cannot imply activity.');}}
 get(repositoryKey,id){key(repositoryKey);uuid(id);return copy(this.data.rows.find(r=>r.repositoryKey===repositoryKey&&r.id===id)||null);}
 project(record){const row=this.get(record.repositoryKey,record.id),authored=record.lastActivityAt??record.createdAt??null;let lastActivityAt=authored;if(row?.changedAt&&(!authored||Date.parse(row.changedAt)>Date.parse(authored)))lastActivityAt=row.changedAt;return {lastActivityAt,sourceActivity:{state:row?(row.complete?'known':'unknown'):'unobserved',changedAt:row?.changedAt||null,observedAt:row?.observedAt||null,baselineAt:row?.baseline?.at||null}};}
 observe(input,at=Date.now()){only(input,['repositoryKey','entries']);key(input.repositoryKey);assert(Array.isArray(input.entries)&&input.entries.length<=MAX_BATCH,'Observe at most 500 source workspaces at once.');const seen=new Set(),observedAt=timestamp(at);for(const item of input.entries){only(item,['id','commit','fingerprint','complete']);uuid(item.id);commit(item.commit);fingerprint(item.fingerprint);assert(typeof item.complete==='boolean'&&!seen.has(item.id),'Invalid or duplicate source observation.');seen.add(item.id);}
  const draft=copy(this.data),changedIDs=[],unknownIDs=[];let wrote=false;
  for(const item of input.entries){let row=draft.rows.find(r=>r.repositoryKey===input.repositoryKey&&r.id===item.id);const complete=item.complete&&item.commit!==null&&item.fingerprint!==null;if(!complete)unknownIDs.push(item.id);if(row)assert(Date.parse(observedAt)>=Date.parse(row.observedAt),'Observation is older than recorded source activity.',409);
   if(!row){row={id:item.id,repositoryKey:input.repositoryKey,baseline:complete?{commit:item.commit,fingerprint:item.fingerprint,at:observedAt}:null,changedAt:null,observedAt,complete};draft.rows.push(row);wrote=true;continue;}
   if(!complete){if(row.complete){row.complete=false;row.observedAt=observedAt;wrote=true;}continue;}
   if(!row.baseline){row.baseline={commit:item.commit,fingerprint:item.fingerprint,at:observedAt};row.complete=true;row.observedAt=observedAt;wrote=true;continue;}
   const changed=row.baseline.commit!==item.commit||row.baseline.fingerprint!==item.fingerprint;
   if(changed){row.baseline.commit=item.commit;row.baseline.fingerprint=item.fingerprint;row.changedAt=observedAt;changedIDs.push(item.id);}
   if(changed||!row.complete){row.complete=true;row.observedAt=observedAt;wrote=true;}
  }
  if(wrote){draft.revision++;this.validate(draft);assert(Buffer.byteLength(JSON.stringify(draft,null,2))<=MAX_BYTES,'Source activity exceeds 4 MiB.');assert(JSON.stringify(JSON.parse(readFileSync(this.file,'utf8')))===JSON.stringify(this.data),'Source activity changed on disk. Reload before observing.',409);mkdirSync(this.backupDirectory,{recursive:true});atomic(path.join(this.backupDirectory,String(this.data.revision).padStart(12,'0')+'-'+randomUUID()+'.json'),this.data);const backups=readdirSync(this.backupDirectory).filter(n=>/^\d{12}-[a-f0-9-]+\.json$/.test(n)).sort();for(const name of backups.slice(0,Math.max(0,backups.length-5)))unlinkSync(path.join(this.backupDirectory,name));atomic(this.file,draft);this.data=draft;}
  return {revision:this.revision,wrote,changedIDs,unknownIDs};
 }
}
