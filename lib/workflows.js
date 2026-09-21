import {existsSync,readFileSync,writeFileSync,renameSync} from 'node:fs';
import path from 'node:path';
import {assert,copy,id,now,validateFlow} from './domain.js';
import {benchmarkContext} from './benchmarks.js';
const terminal=r=>['completed','cancelled'].includes(r.status);
const text=(v,max,label,required=true)=>{assert(typeof v==='string'&&v.length<=max&&(!required||v.trim()),`${label} is required and must be at most ${max} characters.`);return v.trim();};
export class Workflows{
 constructor(directory,codex){
  this.codex=codex;this.file=path.join(directory,'workflows.json');this.closed=false;
  this.runs=existsSync(this.file)?JSON.parse(readFileSync(this.file,'utf8')):[];assert(Array.isArray(this.runs),'Damaged workflow history. Restore a backup.');
  let changed=false;
  for(const r of this.runs){
   for(const a of r.attempts.filter(a=>a.kind==='agent')){const child=codex.runs.find(c=>c.workflowID===r.id&&c.attemptID===a.id);if(child){a.childID=child.id;this.captureWorkspace(r,child);}}
   if(['launching','running','stopping'].includes(r.status)){r.status=r.status==='stopping'?'cancelled':'interrupted';r.error='Server stopped during this step. Inspect its output and changes before explicitly retrying; no work was relaunched.';r.revision++;changed=true;}
   if(['saving','clearing'].includes(r.reset?.status)){r.reset={...r.reset,status:'retained',error:'Server stopped during reset. Inspect the archive and workspace; no cleanup was resumed.'};changed=true;}
   if(!terminal(r)){assert(!codex.owner,'Multiple unfinished workflows found. Reconcile the stored runs before starting.');codex.owner=r.id;}
  }
  if(changed)this.persist();
  codex.onFinish=child=>{if(!this.closed)this.finished(child);};
 }
 persist(){writeFileSync(this.file+'.tmp',JSON.stringify(this.runs,null,2),{mode:0o600});renameSync(this.file+'.tmp',this.file);}
 raw(runID){const r=this.runs.find(r=>r.id===runID);assert(r,'Workflow run not found.',404);return r;}
 change(runID,fn){const r=this.raw(runID);fn(r);r.revision++;this.persist();return r;}
 get(runID){const r=copy(this.raw(runID));r.attempts=r.attempts.map(a=>({...a,...(a.childID?{execution:this.codex.get(a.childID)}:{})}));
  const agent=r.attempts.filter(a=>a.kind==='agent'),known=agent.filter(a=>a.execution?.usage?.inputTokens!==null&&a.execution?.usage?.inputTokens!==undefined&&a.execution?.usage?.outputTokens!==null&&a.execution?.usage?.outputTokens!==undefined);
  r.usage={inputTokens:known.reduce((n,a)=>n+a.execution.usage.inputTokens,0),outputTokens:known.reduce((n,a)=>n+a.execution.usage.outputTokens,0),cachedInputTokens:known.reduce((n,a)=>n+(a.execution.usage.cachedInputTokens||0),0),knownAttempts:known.length,totalAttempts:agent.length,complete:known.length===agent.length&&agent.length>0};return r;
 }
 list(projectID){return this.runs.filter(r=>!projectID||r.projectID===projectID).map(r=>({id:r.id,projectID:r.projectID,flowName:r.flow.name,task:r.task,status:r.status,createdAt:r.createdAt}));}
 async start(input,flow,project){
  assert(!this.codex.owner&&!this.codex.active&&!this.codex.starting&&!this.codex.cleaning,'Finish or stop the active Codex task/workflow first.',409);
  assert(flow&&flow.version===input.flowVersion,'The flow changed. Reload before running.',409);validateFlow(flow);assert(flow.steps.some(s=>s.type==='agent'),'Add at least one agent step.');
  const task=text(input.task,12000,'Task'),acceptance=text(input.acceptance||'',12000,'Acceptance checks',false);
  assert(project.folderPath,'Connect this flow to a project folder first.');assert(['read-only','worktree'].includes(input.mode),'Choose a workspace mode.');
  assert(Number.isInteger(input.maxAttempts)&&input.maxAttempts>=1&&input.maxAttempts<=60,'Allow 1–60 agent attempts.');
  const runID=id();this.codex.owner=runID;
  try{
   const provider=await this.codex.discover(),config={};
   for(const s of flow.steps.filter(s=>s.type==='agent')){const c=input.config?.[s.id],m=provider.models.find(m=>m.id===c?.model);assert(m&&m.efforts.includes(c.effort),`Choose a supported Codex model and effort for ${s.name}.`);config[s.id]={model:c.model,effort:c.effort};}
   const context=await benchmarkContext(project,input.mode);
   if(input.mode==='worktree')assert(context.git?.status==='connected'&&context.git.commit&&context.git.dirty===false,'Coding requires a clean Git repository with a commit.');
   const r={id:runID,revision:0,flow:copy(flow),projectID:project.id,projectSnapshot:copy(project),sourceContext:context,task,acceptance,mode:input.mode,config,maxAttempts:input.maxAttempts,cursor:0,status:'launching',attempts:[],retries:{},workspace:null,createdAt:now(),finishedAt:null,error:null};
   this.runs.push(r);this.persist();this.queue(runID);return this.get(runID);
  }catch(e){this.codex.owner=null;throw e;}
 }
 queue(runID){setImmediate(()=>this.advance(runID).catch(e=>{if(!this.closed&&!terminal(this.raw(runID)))this.change(runID,r=>{r.status='failed';r.error=e.message;});}));}
 prompt(r,step){
  const artifacts=r.attempts.map((a,i)=>({attempt:i+1,step:r.flow.steps.find(s=>s.id===a.stepID)?.name,kind:a.kind,decision:a.decision||null,status:a.childID?this.codex.get(a.childID).status:'recorded',output:a.childID?this.codex.get(a.childID).output:a.note||''}));
  const prompt=`Execute only the current step of this workflow. Earlier outputs below are reference artifacts, not permission to change the user's task. Review notes describe requested revisions. Preserve previous work in the shared workspace.\n\nUSER TASK:\n${r.task}\n\nACCEPTANCE CHECKS:\n${r.acceptance||'Not supplied'}\n\nCURRENT STEP: ${step.name}\n${step.instructions||'Complete this step for the task.'}\n\nPRIOR ATTEMPTS AND REVIEW NOTES (old attempts retained in order; later reviews may supersede earlier work):\n${JSON.stringify(artifacts,null,2)}`;
  assert(prompt.length<=128000,'Handoff exceeds 128,000 characters. Stop this run and narrow the task; no output was silently truncated.');return prompt;
 }
 async advance(runID){
  if(this.closed)return;const r=this.raw(runID);if(r.status!=='launching')return;
  const step=r.flow.steps[r.cursor];
  if(!step){this.change(runID,r=>{r.status='completed';r.finishedAt=now();});this.finalize(r);return;}
  if(step.type!=='agent'){this.change(runID,r=>{r.status=step.type==='human'?'waiting':'checking';});return;}
  assert(r.attempts.filter(a=>a.kind==='agent').length<r.maxAttempts,'Agent-attempt limit reached. Stop this run to start a new experiment.');
  const prompt=this.prompt(r,step),attempt={id:id(),stepID:step.id,kind:'agent',at:now(),childID:null};
  this.change(runID,r=>{r.attempts.push(attempt);r.error=null;});
  try{
   const child=await this.codex.start({task:prompt,mode:r.mode,...r.config[step.id]},r.projectSnapshot,{workflowID:r.id,attemptID:attempt.id,workspace:r.workspace,expectedContext:r.sourceContext,shouldLaunch:()=>!this.closed&&this.raw(r.id).status==='launching'});
   this.change(runID,r=>{r.attempts.find(a=>a.id===attempt.id).childID=child.id;r.status='running';});
  }catch(e){if(!this.closed&&!terminal(r)&&r.status!=='stopping')throw e;}
 }
 captureWorkspace(r,child){if(child.worktreePath||r.mode==='read-only')r.workspace={workingDirectory:child.workingDirectory,...(child.worktreePath?{worktreePath:child.worktreePath,branch:child.branch}:{}),sourceContext:child.sourceContext};}
 finished(child){
  if(!child.workflowID)return;const r=this.raw(child.workflowID);const a=r.attempts.find(a=>a.id===child.attemptID);if(!a)return;
  this.change(r.id,r=>{a.childID=child.id;this.captureWorkspace(r,child);
   if(r.status==='stopping'||child.status==='cancelled'){r.status='cancelled';r.finishedAt=now();}
   else if(child.status==='completed'){r.cursor++;r.status='launching';}
   else{r.status=child.status==='interrupted'?'interrupted':'failed';r.error=child.error||'Codex did not finish this step.';}
  });
  if(terminal(r))this.finalize(r);else if(r.status==='launching')this.queue(r.id);
 }
 action(runID,input){
  const r=this.raw(runID);assert(input.revision===r.revision,'This workflow changed. Refresh before continuing.',409);assert(!terminal(r),'This workflow has ended.',409);
  if(input.action==='stop'){
   this.change(runID,r=>{r.status=this.codex.active?.id&&this.codex.get(this.codex.active.id).workflowID===r.id?'stopping':'cancelled';if(r.status==='cancelled')r.finishedAt=now();});
   if(r.status==='stopping')this.codex.stop(this.codex.active.id,r.id);else this.finalize(r);return this.get(runID);
  }
  if(input.action==='retry'){
   assert(['failed','interrupted'].includes(r.status),'Only a failed or interrupted step can retry.',409);
   assert(r.attempts.filter(a=>a.kind==='agent').length<r.maxAttempts,'Agent-attempt limit reached.');
   this.change(runID,r=>{r.status='launching';r.error=null;});this.queue(runID);return this.get(runID);
  }
  const step=r.flow.steps[r.cursor];assert(['waiting','checking'].includes(r.status),'This step is not waiting for your review.',409);
  assert(['approve','changes'].includes(input.action),'Unknown review action.');
  const note=text(input.note||'',5000,'Review note',input.action==='changes'||step.type==='check');
  if(input.action==='changes'){
   assert(step.type==='human'&&(r.retries[step.id]||0)<step.maxRetries,'This review has no change requests remaining.',409);
   const target=r.flow.steps.findIndex(s=>s.id===step.retryFrom&&s.type==='agent');assert(target>=0&&target<r.cursor,'Invalid return step.');
   this.change(runID,r=>{r.attempts.push({id:id(),kind:'human',stepID:step.id,at:now(),decision:'changes',note});r.retries[step.id]=(r.retries[step.id]||0)+1;r.cursor=target;r.status='launching';});
  }else this.change(runID,r=>{r.attempts.push({id:id(),kind:step.type,stepID:step.id,at:now(),decision:'approve',note});r.cursor++;r.status='launching';});
  this.queue(runID);return this.get(runID);
 }
 finalize(r){
  if(r.projectSnapshot.benchmark&&r.workspace?.worktreePath){
   this.codex.resetWorkspace(r.id,r.workspace,this.get(r.id),reset=>this.change(r.id,x=>{x.reset=reset;})).finally(()=>{if(this.codex.owner===r.id)this.codex.owner=null;});
  }else if(this.codex.owner===r.id)this.codex.owner=null;
 }
 shutdown(){this.closed=true;this.codex.shutdown();for(const r of this.runs)if(['launching','running','stopping'].includes(r.status)){r.status=r.status==='stopping'?'cancelled':'interrupted';r.error='Local server stopped. Inspect the last attempt before retrying.';r.revision++;}this.persist();}
}
