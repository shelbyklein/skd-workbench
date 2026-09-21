import {mkdirSync, existsSync, readFileSync, writeFileSync, renameSync, unlinkSync, openSync, closeSync, fsyncSync, statSync, realpathSync} from 'node:fs';
import {realpath, stat} from 'node:fs/promises';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
import {assert, copy, now} from './domain.js';
import {readGit} from './git-read.js';

const MAX_BYTES=32*1024*1024, MAX_RECORDS=10000;
const text=(v,label,max,empty=false)=>{assert(typeof v==='string'&&v.length<=max&&!v.includes('\0')&&(empty||v.trim()),`Invalid ${label}.`);return v;};
const absolute=v=>{text(v,'workspace path',4096);assert(path.isAbsolute(v),'Workspace path must be absolute.');return path.normalize(v);};
const reference=v=>{assert(v&&typeof v==='object','Source reference required.');return {kind:text(v.kind,'source kind',80),id:text(v.id,'source ID',240)};};
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const fields=v=>{const result={};if('purpose' in v)result.purpose=text(v.purpose,'purpose',240,true);if('notes' in v){text(v.notes,'notes',8192,true);assert(Buffer.byteLength(v.notes,'utf8')<=8192,'Notes exceed 8192 bytes.');result.notes=v.notes;}return result;};
function identitySync(folder){const resolved=realpathSync(folder),s=statSync(resolved,{bigint:true});assert(s.isDirectory(),'Repository identity is not a directory.');return {path:resolved,device:String(s.dev),inode:String(s.ino),birthTime:String(s.birthtimeNs)};}
async function identity(folder){const resolved=await realpath(folder),s=await stat(resolved,{bigint:true});assert(s.isDirectory(),'Workspace identity is not a directory.');return {path:resolved,device:String(s.dev),inode:String(s.ino),birthTime:String(s.birthtimeNs)};}
async function git(folder,args){const r=await readGit(folder,args,{raw:true});assert(r.ok,'Cannot verify workspace Git identity.',409);return r.value.replace(/\n$/,'');}
async function inspect(record){
  const destination=await realpath(record.destination);
  assert(destination===record.destination,'Workspace path identity changed.',409);
  const root=await realpath(await git(destination,['rev-parse','--show-toplevel']));
  assert(root===destination,'Workspace root does not match registration.',409);
  const commonDirectory=await realpath(await git(destination,['rev-parse','--path-format=absolute','--git-common-dir']));
  const expected=await realpath(record.sourceContext.git.commonDirectory);
  assert(commonDirectory===expected,'Workspace repository does not match registration.',409);
  assert(same(await identity(commonDirectory),record.sourceRepositoryIdentity),'Source repository filesystem identity changed.',409);
  const administrativeDirectory=await realpath(await git(destination,['rev-parse','--absolute-git-dir']));
  const inventory=await git(destination,['worktree','list','--porcelain','-z']);
  assert(inventory.split('\0').includes(`worktree ${destination}`),'Workspace is not registered with Git.',409);
  if(!record.attachment)assert(await git(destination,['symbolic-ref','--quiet','--short','HEAD'])===record.branch,'Workspace branch does not match creation intent.',409);
  return {root:await identity(root),commonDirectory:await identity(commonDirectory),administrativeDirectory:await identity(administrativeDirectory)};
}

export class WorktreeNotes {
  constructor(directory){
    mkdirSync(directory,{recursive:true});this.file=path.join(directory,'worktree-notes.json');
    if(existsSync(this.file)){
      try{assert(statSync(this.file).size<=MAX_BYTES,'Registration store exceeds 32 MiB.');const raw=readFileSync(this.file,'utf8');assert(Buffer.byteLength(raw)<=MAX_BYTES,'Registration store exceeds 32 MiB.');this.data=JSON.parse(raw);this.validate(this.data);}catch(e){throw new Error(`Worktree registration store is damaged or unsupported; restore a backup. ${e.message}`);}
    }else{this.data={version:1,records:[]};this.persist(this.data);}
  }
  validate(data){
    assert(data?.version===1&&Array.isArray(data.records),'Invalid store version.');assert(data.records.length<=MAX_RECORDS,'Registration store exceeds 10000 records.');const ids=new Set(),intents=new Set();
    for(const r of data.records){assert(/^[0-9a-f-]{36}$/i.test(r.id)&&!ids.has(r.id)&&!intents.has(r.intentID),'Duplicate or invalid identity.');ids.add(r.id);intents.add(r.intentID);text(r.intentID,'intent ID',240);text(r.projectID,'project ID',240);text(r.ownerKey,'owner',500);text(r.workRef,'work reference',500);absolute(r.destination);reference(r.origin);text(r.branch,'branch',1024);text(r.purpose,'purpose',240,true);text(r.notes,'notes',8192,true);fields(r);text(r.createdAt,'created time',80);text(r.updatedAt,'updated time',80);assert(Number.isInteger(r.revision)&&r.revision>=1&&['prepared','attached','attachment_failed'].includes(r.state)&&['development','benchmark'].includes(r.classification),'Invalid registration.');assert(r.preparation&&Array.isArray(r.sources)&&r.sources.length<=1000,'Missing creation context.');assert(r.sources.some(ref=>same(ref,r.origin)),'Missing origin source.');for(const ref of r.sources)reference(ref);const p=r.preparation;for(const key of ['intentID','projectID','destination','branch','ownerKey','workRef','classification'])assert(p[key]===r[key],'Changed immutable preparation.');assert(same(p.origin,r.origin)&&same(p.sourceContext,r.sourceContext)&&same(p.sourceRepositoryIdentity,r.sourceRepositoryIdentity),'Changed creation context.');absolute(r.sourceRepositoryIdentity?.path);for(const key of ['device','inode','birthTime'])text(r.sourceRepositoryIdentity[key],'repository filesystem identity',100);text(p.purpose,'original purpose',240,true);assert(r.sourceContext?.git?.commonDirectory,'Missing repository identity.');absolute(r.sourceContext.git.commonDirectory);if(r.attachment){for(const k of ['root','commonDirectory','administrativeDirectory']){const value=r.attachment[k];absolute(value?.path);for(const key of ['device','inode','birthTime'])text(value[key],'filesystem identity',100);}}else assert(r.state!=='attached','Missing attachment.');}
  }
  persist(data){const serialized=JSON.stringify(data,null,2);assert(Buffer.byteLength(serialized)<=MAX_BYTES,'Registration store exceeds 32 MiB.');const temporary=this.file+'.'+randomUUID()+'.tmp';try{writeFileSync(temporary,serialized,{flag:'wx',mode:0o600});const descriptor=openSync(temporary,'r');try{fsyncSync(descriptor);}finally{closeSync(descriptor);}renameSync(temporary,this.file);const directoryDescriptor=openSync(path.dirname(this.file),'r');try{fsyncSync(directoryDescriptor);}finally{closeSync(directoryDescriptor);}}finally{try{unlinkSync(temporary);}catch{}}}
  change(fn){const draft=copy(this.data),result=fn(draft);this.validate(draft);this.persist(draft);this.data=draft;return copy(result);}
  get(id){const r=this.data.records.find(r=>r.id===id||r.intentID===id);assert(r,'Workspace registration not found.',404);return copy(r);}
  list(){return copy(this.data.records);}
  prepare(input){
    const sourceContext={folderPath:absolute(input.sourceContext?.folderPath),git:{root:absolute(input.sourceContext?.git?.root),commonDirectory:absolute(input.sourceContext?.git?.commonDirectory)}};
    const preparation={intentID:text(input.intentID,'intent ID',240),projectID:text(input.projectID,'project ID',240),sourceContext,sourceRepositoryIdentity:identitySync(sourceContext.git.commonDirectory),destination:absolute(input.destination),branch:text(input.branch,'branch',1024),purpose:fields({purpose:input.purpose??''}).purpose,origin:reference(input.origin),workRef:text(input.workRef??`local:${input.intentID}`,'work reference',500),ownerKey:text(input.ownerKey,'owner',500),classification:input.classification??'development'};
    assert(['development','benchmark'].includes(preparation.classification),'Invalid workspace classification.');
    const existing=this.data.records.find(r=>r.intentID===preparation.intentID);
    if(existing){assert(same(existing.preparation,preparation),'Registration intent already belongs to different creation input.',409);return copy(existing);}
    return this.change(d=>{const r={...preparation,id:randomUUID(),preparation:copy(preparation),notes:'',sources:[copy(preparation.origin)],revision:1,state:'prepared',attachment:null,createdAt:now(),updatedAt:now(),error:null};d.records.push(r);return r;});
  }
  async attach(intentID,{expectedRevision,validate=()=>{}}={}){
    const record=this.get(intentID);
    const guard=()=>{validate();const current=this.get(record.id);if(expectedRevision!==undefined)assert(Number.isInteger(expectedRevision)&&current.revision===expectedRevision,'Workspace registration changed. Reload before recovery.',409);return current;};
    let attachment;
    try{attachment=await inspect(record);if(record.attachment)assert(same(record.attachment,attachment),'Workspace filesystem identity changed; registration retained for recovery.',409);}
    catch(e){
      guard();
      // A failed concurrent inspection must never overwrite a newer attachment.
      if(this.get(record.id).revision!==record.revision)throw e;
      this.change(d=>{const r=d.records.find(r=>r.id===record.id);r.state='attachment_failed';r.error=String(e.message).slice(0,1000);r.revision++;r.updatedAt=now();return r;});throw e;
    }
    const current=guard();
    if(current.attachment){assert(same(current.attachment,attachment),'Concurrent attachment mismatch.',409);if(current.state==='attached')return current;}
    return this.change(d=>{const r=d.records.find(r=>r.id===record.id);r.attachment=attachment;r.state='attached';r.error=null;r.revision++;r.updatedAt=now();return r;});
  }
  async verify(id,destination,ownerKey){const r=this.get(id);assert(r.ownerKey===ownerKey,'Workspace owner mismatch.',409);assert(r.destination===absolute(destination)&&r.state==='attached'&&r.attachment,'Workspace is not attached.',409);assert(same(r.attachment,await inspect(r)),'Workspace filesystem identity changed.',409);return this.get(r.id);}
  link(id,source,ownerKey){const ref=reference(source),record=this.get(id);assert(record.ownerKey===ownerKey,'Workspace owner mismatch.',409);if(record.sources.some(v=>same(v,ref)))return record;return this.change(d=>{const r=d.records.find(r=>r.id===record.id);assert(r.sources.length<1000,'Too many workspace source references.');r.sources.push(ref);r.revision++;r.updatedAt=now();return r;});}
  update(id,input){assert(input&&Object.keys(input).every(k=>['expectedRevision','purpose','notes'].includes(k)),'Only purpose and notes may be edited.');const changes=fields(input),record=this.get(id);assert(Number.isInteger(input.expectedRevision)&&record.revision===input.expectedRevision,'Workspace notes changed. Reload before saving.',409);return this.change(d=>{const r=d.records.find(r=>r.id===record.id);Object.assign(r,changes);r.revision++;r.updatedAt=now();return r;});}
}
