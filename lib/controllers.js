import {existsSync,readFileSync,writeFileSync,renameSync,mkdirSync,chmodSync} from 'node:fs';
import path from 'node:path';
import {createHash,randomBytes,randomUUID,timingSafeEqual} from 'node:crypto';
import {assert,copy} from './domain.js';
import {validateCommand} from './controller-catalog.js';
const hash=value=>createHash('sha256').update(value).digest('hex');
export const fingerprint=value=>hash(JSON.stringify(canonical(value)));
function canonical(value){return Array.isArray(value)?value.map(canonical):value&&typeof value==='object'?Object.fromEntries(Object.keys(value).sort().map(k=>[k,canonical(value[k])])):value;}
const stamp=()=>new Date().toISOString();
export class Controllers{
 constructor(directory,{projects}){
  this.file=path.join(directory,'controllers.json');this.credentials=path.join(directory,'controller-credentials');this.projects=projects;this.inFlight=0;
  this.data=existsSync(this.file)?JSON.parse(readFileSync(this.file,'utf8')):{schema:1,controllers:[],operations:[],receipts:[]};
  assert(this.data.schema===1&&['controllers','operations','receipts'].every(k=>Array.isArray(this.data[k])),'Damaged controller store. Restore a backup.');
  assert(this.data.controllers.every(c=>typeof c.id==='string'&&/^[a-f0-9]{64}$/.test(c.tokenHash)&&Array.isArray(c.projectIDs)&&c.projectIDs.length&&Array.isArray(c.capabilities)&&c.capabilities.every(v=>['read','manage','run'].includes(v))&&typeof c.revoked==='boolean'),'Damaged controller grants. Restore a backup.');
  assert(this.data.operations.every(o=>typeof o.id==='string'&&typeof o.controllerID==='string'&&typeof o.fingerprint==='string'),'Damaged controller operations. Restore a backup.');
 }
 persist(){writeFileSync(this.file+'.tmp',JSON.stringify(this.data,null,2),{mode:0o600});chmodSync(this.file+'.tmp',0o600);renameSync(this.file+'.tmp',this.file);}
 list(){return this.data.controllers.map(({tokenHash,...c})=>copy({...c,credentialPath:path.join(this.credentials,c.id+'.json')}));}
 create(input,endpoint){
  assert(Object.keys(input).every(k=>['name','projectIDs','capabilities'].includes(k)),'Unknown controller setting.');
  assert(typeof input.name==='string'&&input.name.trim()&&input.name.length<=80,'Name must contain 1–80 characters.');
  assert(Array.isArray(input.projectIDs)&&input.projectIDs.length>0&&input.projectIDs.length<=100&&input.projectIDs.every(id=>this.projects().some(p=>p.id===id&&p.folderPath)),'Choose connected projects.');
  assert(Array.isArray(input.capabilities)&&input.capabilities.includes('read')&&input.capabilities.every(c=>['read','manage','run'].includes(c)),'Choose valid controller capabilities.');
  assert(this.data.controllers.length<100,'Controller limit reached.');
  const token=randomBytes(32).toString('hex'),id=randomUUID();
  mkdirSync(this.credentials,{recursive:true,mode:0o700});chmodSync(this.credentials,0o700);
  writeFileSync(path.join(this.credentials,id+'.json'),JSON.stringify({endpoint,token}),{mode:0o600,flag:'wx'});
  this.data.controllers.push({id,name:input.name.trim(),projectIDs:[...new Set(input.projectIDs)],capabilities:[...new Set(input.capabilities)],tokenHash:hash(token),version:1,revoked:false,createdAt:stamp(),lastUsedAt:null,lastError:null});this.persist();
  return this.list().find(c=>c.id===id);
 }
 revoke(id,version){const c=this.data.controllers.find(c=>c.id===id);assert(c,'Controller not found.',404);assert(c.version===version,'Controller changed. Refresh settings.',409);c.revoked=true;c.version++;this.persist();return {id,revoked:true};}
 authenticate(header){
  const token=typeof header==='string'&&header.match(/^Bearer ([a-f0-9]{64})$/)?.[1];assert(token,'Controller credential required.',401);
  const digest=Buffer.from(hash(token),'hex'),c=this.data.controllers.find(c=>timingSafeEqual(Buffer.from(c.tokenHash,'hex'),digest));
  assert(c&&!c.revoked,'Controller disabled or credential revoked.',403);return c;
 }
 check(c,capability,projectID){assert(this.data.controllers.includes(c)&&!c.revoked,'Controller access revoked.',403);assert(c.capabilities.includes(capability),'Controller capability not granted.',403);if(projectID)assert(c.projectIDs.includes(projectID),'Project access not granted.',403);}
 async call(c,name,args,commands){
  const {tool,input}=validateCommand(name,args);this.check(c,tool.capability,input.projectID);
  assert(this.inFlight<16,'Too many pending controller requests.',429);this.inFlight++;
  c.lastUsedAt=stamp();c.lastError=null;this.persist();
  try {const value=await commands.execute(c,name,input);this.check(c,tool.capability,input.projectID);this.receipt(c,name,input.projectID,'returned');return value;}
  catch(e){c.lastError=e.status===409?'Conflict. Refresh the project, workflow or preview.':'Request failed. Inspect the operation or retry a read.';this.receipt(c,name,input.projectID,'failed');throw e;}
  finally{this.inFlight--;}
 }
 receipt(c,tool,projectID,status){this.data.receipts.push({id:randomUUID(),controllerID:c.id,tool,projectID:projectID||null,status,at:stamp()});this.data.receipts=this.data.receipts.slice(-1000);this.persist();}
 operation(c,input,name){
  const fp=fingerprint({name,input}),existing=this.data.operations.find(o=>o.controllerID===c.id&&o.requestKey===input.requestKey);
  if(existing){assert(existing.fingerprint===fp,'Request key already used with different input.',409);return {operation:existing,existing:true};}
  assert(this.data.operations.length<10000,'Controller operation history is full. Export and reconcile before continuing.',409);
  const operation={id:randomUUID(),controllerID:c.id,controllerName:c.name,projectID:input.projectID,requestKey:input.requestKey,fingerprint:fp,tool:name,status:'preparing',createdAt:stamp()};this.data.operations.push(operation);this.persist();return {operation,existing:false};
 }
 finish(operation,fields){Object.assign(operation,fields,{updatedAt:stamp()});this.persist();return copy(operation);}
 getOperation(c,id,projectID){const o=this.data.operations.find(o=>o.id===id&&o.controllerID===c.id&&o.projectID===projectID);assert(o,'Operation not found.',404);return copy(o);}
}
