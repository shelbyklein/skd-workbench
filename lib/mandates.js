import {existsSync,readFileSync,writeFileSync,renameSync,copyFileSync,chmodSync,mkdirSync} from 'node:fs';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
import {assert,copy,now} from './domain.js';
// Project mandates record standing authority for one accountable project owner.
// Saving a mandate never dispatches work; execution binding happens only at an explicit launch.
export const mandateModes=['read-only','worktree'];
const reportDetails=['summary','full'],fields=['version','enabled','agentProfile','objective','tasks','workflowIDs','modes','escalation','instructions','limits','report'];
const taskRef=/^(?:github:[\w.-]{1,100}\/[\w.-]{1,100}#\d{1,9}|local:[\w-]{1,100})$/;
const text=(value,label,max,required)=>{assert(typeof value==='string'&&Buffer.byteLength(value)<=max&&!value.includes('\0'),`${label} must be text of at most ${max/1024} KiB.`);assert(!required||value.trim(),`${label} is required.`);return value.trim();};
const integer=(value,label,min,max)=>{assert(Number.isSafeInteger(value)&&value>=min&&value<=max,`${label} must be a whole number from ${min} to ${max}.`);return value;};
function validRecord(m,nested=false){
 return m&&typeof m.id==='string'&&typeof m.projectID==='string'&&Number.isSafeInteger(m.version)&&m.version>0&&typeof m.enabled==='boolean'
  &&m.agentProfile&&typeof m.agentProfile.id==='string'&&Number.isSafeInteger(m.agentProfile.version)&&typeof m.objective==='string'
  &&Array.isArray(m.tasks)&&m.tasks.every(t=>t&&typeof t.ref==='string'&&taskRef.test(t.ref)&&typeof t.title==='string')
  &&Array.isArray(m.workflowIDs)&&m.workflowIDs.every(id=>typeof id==='string')&&Array.isArray(m.modes)&&m.modes.every(v=>mandateModes.includes(v))
  &&typeof m.escalation==='string'&&typeof m.instructions==='string'&&m.limits&&Number.isSafeInteger(m.limits.maxAttempts)&&Number.isSafeInteger(m.limits.maxRuntimeMinutes)
  &&m.report&&reportDetails.includes(m.report.detail)&&(nested||Array.isArray(m.history));
}
function validateStore(value){
 assert(value&&value.schema===1&&Number.isSafeInteger(value.revision)&&value.revision>=0&&Array.isArray(value.mandates)&&value.mandates.every(m=>validRecord(m)&&m.history.every(h=>validRecord(h,true))),'Damaged project mandates. Restore project-mandates.json from backup.');
 assert(new Set(value.mandates.map(m=>m.projectID)).size===value.mandates.length,'Damaged project mandates. Restore project-mandates.json from backup.');
 return value;
}
export class Mandates{
 constructor(directory,{playbooks,projects,flows}){
  mkdirSync(directory,{recursive:true});this.file=path.join(directory,'project-mandates.json');Object.assign(this,{playbooks,projects,flows});
  if(existsSync(this.file)){let parsed;try{parsed=JSON.parse(readFileSync(this.file,'utf8'));}catch{assert(false,'Damaged project mandates. Restore project-mandates.json from backup.');}this.data=validateStore(parsed);}
  else this.data={schema:1,revision:0,mandates:[]};
 }
 persist(next){const temporary=this.file+'.tmp';writeFileSync(temporary,JSON.stringify(next,null,2),{mode:0o600});chmodSync(temporary,0o600);if(existsSync(this.file))copyFileSync(this.file,this.file+'.bak');renameSync(temporary,this.file);}
 get(projectID){const m=this.data.mandates.find(m=>m.projectID===projectID);return m?copy(m):null;}
 // Resolve the owner profile without copying its prompt, skills or connections into the mandate.
 profile(projectID,reference){
  const entry=this.playbooks.data.entries.find(e=>e.id===reference?.id);
  if(!entry||(entry.scope==='project'&&entry.projectID!==projectID))return {status:'missing',reason:'The owner Agent is missing or outside this project.'};
  if(entry.archived)return {status:'archived',reason:'The owner Agent is archived.',name:entry.name,version:entry.version};
  if(Number.isSafeInteger(reference.version)&&reference.version!==entry.version)return {status:'changed',reason:'The owner Agent changed after this mandate was saved. Review and save the mandate again.',name:entry.name,version:entry.version};
  return {status:'ready',name:entry.name,version:entry.version};
 }
 view(project){const mandate=this.get(project.id);return {mandate,profile:mandate?this.profile(project.id,mandate.agentProfile):null};}
 normalize(project,input,previous){
  assert(input&&typeof input==='object'&&Object.keys(input).every(k=>fields.includes(k)),'Unknown mandate setting.');
  assert(typeof input.enabled==='boolean','Choose whether the mandate is active.');
  const reference=input.agentProfile;assert(reference&&typeof reference.id==='string'&&reference.id.length<=100,'Choose an owner Agent.');
  const profile=this.profile(project.id,{id:reference.id,version:reference.version});
  assert(profile.status==='ready',profile.reason,profile.status==='changed'?409:400);
  assert(Array.isArray(input.tasks)&&input.tasks.length<=50,'List at most 50 eligible tasks.');
  const tasks=input.tasks.map(t=>{assert(t&&typeof t==='object'&&Object.keys(t).every(k=>['ref','title'].includes(k)),'Invalid eligible task.');assert(typeof t.ref==='string'&&taskRef.test(t.ref.trim()),'Task references use github:owner/repo#number or local:id.');return {ref:t.ref.trim(),title:text(t.title??'','Task title',200,false)};});
  assert(new Set(tasks.map(t=>t.ref)).size===tasks.length,'Each eligible task may be listed once.');
  assert(Array.isArray(input.workflowIDs)&&input.workflowIDs.length<=50&&input.workflowIDs.every(id=>typeof id==='string'),'Choose eligible workflows.');
  const workflowIDs=[...new Set(input.workflowIDs)],flows=this.flows();
  assert(workflowIDs.every(id=>flows.some(f=>f.id===id&&f.projectID===project.id)),'An eligible workflow is missing or belongs to another project.',409);
  assert(Array.isArray(input.modes)&&input.modes.every(v=>mandateModes.includes(v)),'Choose permitted workspace modes.');
  const modes=mandateModes.filter(v=>input.modes.includes(v));
  const limits=input.limits;assert(limits&&typeof limits==='object'&&Object.keys(limits).every(k=>['maxAttempts','maxRuntimeMinutes'].includes(k)),'Set attempt and runtime limits.');
  const report=input.report??{detail:'summary'};assert(report&&reportDetails.includes(report.detail)&&Object.keys(report).length===1,'Choose a report detail.');
  const next={id:previous?.id||randomUUID(),projectID:project.id,version:(previous?.version||0)+1,enabled:input.enabled,agentProfile:{id:reference.id,version:profile.version},
   objective:text(input.objective,'Objective',4096,true),tasks,workflowIDs,modes,escalation:text(input.escalation??'','Escalation conditions',4096,false),instructions:text(input.instructions??'','Standing instructions',8192,false),
   limits:{maxAttempts:integer(limits.maxAttempts,'Attempt limit',1,60),maxRuntimeMinutes:integer(limits.maxRuntimeMinutes,'Runtime limit',1,1440)},report:{detail:report.detail}};
  if(next.enabled)assert(tasks.length&&workflowIDs.length&&modes.length,'An active mandate needs at least one eligible task, workflow and workspace mode.');
  return next;
 }
 // Check a launch against the current mandate. Called at preview, before persist and on every retry of the check.
 authorize(project,request,{flowID,mode,maxAttempts},runs=[]){
  const m=this.data.mandates.find(m=>m.projectID===project.id);
  assert(m,'This project has no mandate. The user must set one in Workbench.',409);
  assert(m.version===request.version,'The project mandate changed. Read it again before previewing.',409);
  assert(m.enabled,'The project mandate is paused. New launches are blocked until the user resumes it.',409);
  assert(m.tasks.some(t=>t.ref===request.taskRef),'This task is outside the project mandate.',403);
  assert(m.workflowIDs.includes(flowID),'This workflow is outside the project mandate.',403);
  assert(m.modes.includes(mode),'This workspace mode is outside the project mandate.',403);
  assert(Number.isInteger(maxAttempts)&&maxAttempts<=m.limits.maxAttempts,`The project mandate allows at most ${m.limits.maxAttempts} agent attempts.`,403);
  const profile=this.profile(project.id,m.agentProfile);assert(profile.status==='ready',profile.reason,409);
  const claim=runs.find(r=>r.projectID===project.id&&r.controllerOrigin?.mandate?.id===m.id&&r.controllerOrigin.mandate.taskRef===request.taskRef&&!['completed','cancelled'].includes(r.status));
  assert(!claim,`Run ${claim?.id} already claims this task. Inspect or stop it before launching again.`,409);
  return {id:m.id,version:m.version,taskRef:request.taskRef,agentProfile:copy(m.agentProfile),limits:copy(m.limits)};
 }
 // Only the local UI route calls save. Controller grants have no mandate write path.
 save(project,input){
  assert(project.id!=='unassigned'&&project.folderPath,'Connect a project folder before setting a mandate.');
  const previous=this.data.mandates.find(m=>m.projectID===project.id)||null;
  assert(input?.version===(previous?.version||0),'This mandate changed in another tab. Reload before saving.',409);
  const normalized=this.normalize(project,input,previous),at=now();
  const {history=[],createdAt=at,...prior}=previous||{};
  const mandate={...normalized,history:previous?[...history,prior].slice(-50):[],createdAt,updatedAt:at,updatedBy:'user'};
  const next=copy(this.data);next.mandates=next.mandates.filter(m=>m.projectID!==project.id).concat(mandate);next.revision++;validateStore(next);
  this.persist(next);this.data=next;return copy(mandate);
 }
}
