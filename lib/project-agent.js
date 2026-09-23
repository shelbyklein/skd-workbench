// Read-only project agent summary derived from canonical records: mandate, workflow runs and the conversation.
// Nothing here is stored separately, so the overview cannot drift from the records it links.
const terminal=['completed','cancelled'],unfinished=r=>!terminal.includes(r.status);
function steps(r){
 return r.flow.steps.map((s,i)=>({id:s.id,name:s.name,type:s.type,state:r.status==='completed'||i<r.cursor?'done':i===r.cursor&&unfinished(r)?'current':'pending'}));
}
function summary(r){
 const approvals=r.attempts.filter(a=>['human','check'].includes(a.kind)&&a.decision==='approve').length,agentAttempts=r.attempts.filter(a=>a.kind==='agent').length;
 return {id:r.id,flowName:r.flow.name,task:r.task.slice(0,300),status:r.status,error:r.error||null,createdAt:r.createdAt,finishedAt:r.finishedAt||null,
  step:r.flow.steps[r.cursor]?.name||null,steps:steps(r),agentAttempts,maxAttempts:r.maxAttempts,approvals,
  taskRef:r.controllerOrigin?.mandate?.taskRef||null,mandateVersion:r.controllerOrigin?.mandate?.version??null,controllerName:r.controllerOrigin?.controllerName||null,
  deadlineAt:r.deadlineAt||null,workspace:r.workspace?{branch:r.workspace.branch||null,worktreePath:r.workspace.worktreePath||null}:null};
}
export function projectAgentOverview({project,mandates,threads,runs,executorOwner}){
 const view=mandates.view(project),mine=runs.filter(r=>r.projectID===project.id).sort((a,b)=>b.createdAt.localeCompare(a.createdAt));
 const open=mine.filter(unfinished),current=open.find(r=>r.id===executorOwner)||open[0]||null,recent=mine.find(r=>!unfinished(r))||null;
 const decisions=[];
 for(const r of open){
  if(['waiting','checking'].includes(r.status))decisions.push({kind:'review',runID:r.id,title:r.flow.steps[r.cursor]?.name||'Review',detail:r.task.slice(0,200),status:r.status});
  else if(['failed','interrupted'].includes(r.status))decisions.push({kind:'inspect',runID:r.id,title:r.status==='failed'?'Run failed':'Run interrupted',detail:(r.error||r.task).slice(0,200),status:r.status});
 }
 if(view.mandate&&view.profile?.status!=='ready')decisions.push({kind:'mandate',title:'Owner Agent needs attention',detail:view.profile.reason,status:view.profile.status});
 const claimed=new Set(open.map(r=>r.controllerOrigin?.mandate?.taskRef).filter(Boolean));
 const next=(view.mandate?.tasks||[]).filter(t=>!claimed.has(t.ref));
 const {history,...mandate}=view.mandate||{};
 return {mandate:view.mandate?mandate:null,profile:view.profile,working:!!current&&['launching','running','stopping'].includes(current.status),
  decisions,current:current?summary(current):null,next:next.slice(0,3),nextTotal:next.length,recent:recent?summary(recent):null,thread:threads.recent(project.id)};
}
