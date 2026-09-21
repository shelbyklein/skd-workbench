import {assert} from './domain.js';

// Metadata is shared within one Git repository. Execution source links retain project scope.
export function registrationSummary(record,project){
 return {id:record.id,revision:record.revision,state:record.state,purpose:record.purpose,notes:record.notes,workRef:record.workRef,classification:record.classification,destination:record.destination,createdAt:record.createdAt,error:record.error,
  sources:record.projectID===project.id?record.sources:[],sourceAccess:record.projectID===project.id?'project':'other-project'};
}
export async function withRegistrations(snapshot,project,notes){
 if(snapshot.status!=='connected')return snapshot;
 const records=notes.list().filter(r=>r.sourceContext.git.commonDirectory===snapshot.commonDirectory),matched=new Set();
 const worktrees=[];
 for(const row of snapshot.worktrees){
  let registration={status:row.available&&!row.stale?'unassigned':'unknown'};
  const candidates=records.filter(r=>r.destination===row.path);
  for(const record of candidates){
   try{if(!row.available||row.stale)break;await notes.verify(record.id,row.path,record.ownerKey);registration={...registrationSummary(notes.get(record.id),project),status:'managed'};matched.add(record.id);break;}catch{registration={status:'unknown',message:'Registration needs inspection; ownership was not reassigned.'};}
  }
  worktrees.push({...row,registration});
 }
 return {...snapshot,worktrees,registrations:records.filter(r=>!matched.has(r.id)).slice(0,200).map(r=>({...registrationSummary(r,project),observation:snapshot.partial?'unknown':'not-attached'})),registrationsTruncated:records.filter(r=>!matched.has(r.id)).length>200};
}
export async function changeRegistration({project,input,notes,gitStatus,recover=false,validateProject=()=>{}}){
 assert(input&&Object.keys(input).every(k=>['snapshotID','projectVersion','registrationID','expectedRevision',...(recover?[]:['purpose','notes'])].includes(k)),'Invalid registration request.');
 assert(project.version===input.projectVersion,'Project changed. Refresh local status.',409);
 gitStatus.prune();const saved=gitStatus.snapshots.get(input.snapshotID);
 assert(saved&&saved.project.id===project.id&&saved.project.version===project.version&&saved.project.folderPath===project.folderPath,'Status expired or belongs to another project. Refresh local status.',409);
 assert(!saved.snapshot.stale,'Repository changed during inspection. Refresh local status.',409);
 const record=notes.get(input.registrationID);
 assert(record.sourceContext.git.commonDirectory===saved.snapshot.commonDirectory,'Registration belongs to another repository.',403);
 assert(record.revision===input.expectedRevision,'Registration changed. Refresh local status.',409);
 const fresh=await gitStatus.inspect(project.folderPath,{targetRef:saved.snapshot.target?.ref||'',remoteName:saved.snapshot.selectedRemote||''});
 assert(fresh._identity===saved.snapshot._identity&&!fresh.stale,'Repository changed. Refresh local status.',409);
 validateProject();
 if(recover){
  assert(record.projectID===project.id,'Recover this registration from its original project.',403);
  assert(record.state!=='attached','Registration is already attached. Refresh local status.',409);
  assert(!fresh.partial,'Complete Git inspection is required for registration recovery.',409);
  assert(fresh.worktrees.some(w=>w.path===record.destination&&w.available&&!w.stale),'The retained workspace is unavailable. Inspect it manually; no workspace will be recreated.',409);
  return registrationSummary(await notes.attach(record.intentID,{expectedRevision:input.expectedRevision,validate:validateProject}),project);
 }
 assert(fresh.worktrees.some(w=>w.path===record.destination&&w.available&&!w.stale),'Workspace is not in the current inventory.',409);
 await notes.verify(record.id,record.destination,record.ownerKey);validateProject();
 return registrationSummary(notes.update(record.id,{expectedRevision:input.expectedRevision,...('purpose' in input?{purpose:input.purpose}:{}),...('notes' in input?{notes:input.notes}:{})}),project);
}
