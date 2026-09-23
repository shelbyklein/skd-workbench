import {assert,copy} from './domain.js';
import {fingerprint} from './controllers.js';
import {benchmarkContext} from './benchmarks.js';
import {COORDINATOR} from './project-threads.js';
const page=(items,a)=>{const start=a.cursor||0,end=start+(a.limit||20);return {items:items.slice(start,end),nextCursor:end<items.length?end:null,total:items.length};};
const summary=p=>({id:p.id,name:p.name,version:p.version,folderPath:p.folderPath});
export class ControllerCommands{
 constructor({controllers,store,workflows,playbooks,workspaceTasks,codex,lifecycle,mandates,threads}){Object.assign(this,{controllers,store,workflows,playbooks,workspaceTasks,codex,lifecycle,mandates,threads});this.pending=new Set();this.closed=false;this.recover();}
 recover(){for(const o of this.controllers.data.operations.filter(o=>o.status==='preparing')){
  const run=this.workflows.runs.find(r=>r.controllerOrigin?.operationID===o.id),saved=this.store.controllerReceipt(o.id),stopped=this.workflows.runs.find(r=>r.controllerStopOperationID===o.id);
  this.controllers.finish(o,run?{status:'accepted',runID:run.id}:saved?{status:'completed',flowID:saved.id,flowVersion:saved.version}:stopped?{status:'completed',runID:stopped.id}:{status:'uncertain',error:'Server stopped during this request. Inspect records; it was not replayed.'});
 }}
 flow(a){const f=this.store.snapshot().flows.find(f=>f.id===a.flowID&&f.projectID===a.projectID);assert(f,'Workflow not found in this project.',404);return f;}
 run(a){const r=this.workflows.raw(a.runID);assert(r.projectID===a.projectID,'Run not found in this project.',404);return r;}
 async preview(a){const f=this.flow(a),p=this.store.project(a.projectID);assert(p.version===a.projectVersion&&f.version===a.flowVersion,'Project or workflow changed. Refresh before previewing.',409);
  const input={...a.input,flowVersion:a.flowVersion},mandate=a.mandate?this.mandates.authorize(p,a.mandate,{flowID:f.id,mode:input.mode,maxAttempts:input.maxAttempts},this.workflows.runs):null;
  const context=await this.workflows.preview(input,f,p),source=await benchmarkContext(p,input.mode);
  assert(this.store.project(p.id).version===p.version&&this.flow(a).version===f.version,'Project or workflow changed during preview.',409);
  const {checkedAt,...sourceProof}=source;
  const previewToken=fingerprint({input,context,source:sourceProof,project:p,flow:f,mandate});
  const launchInput=copy(input);launchInput.config??={};
  for(const [stepID,selection] of Object.entries(context.selections))launchInput.config[stepID]={...launchInput.config[stepID],agentProfile:selection};
  return {previewToken,context,source,input:launchInput,mandate};
 }
 async execute(c,name,a){
  const {store,workflows,controllers}=this;
  if(name==='get_workbench_status')return {app:'skd-workbench',version:'0.5.0',controller:{id:c.id,name:c.name,capabilities:c.capabilities,projectIDs:c.projectIDs},executionBusy:!!(this.codex.owner||this.codex.active||this.codex.starting||this.codex.cleaning)};
  if(name==='list_projects')return page(store.snapshot().projects.filter(p=>c.projectIDs.includes(p.id)).map(summary),a);
  if(name==='get_project')return summary(store.project(a.projectID));
  if(name==='list_workflows')return page(store.snapshot().flows.filter(f=>f.projectID===a.projectID).map(f=>({id:f.id,name:f.name,version:f.version,projectID:f.projectID})),a);
  if(name==='get_workflow')return this.flow(a);
  if(name==='get_project_mandate'){const view=this.mandates.view(store.project(a.projectID));if(!view.mandate)return {mandate:null,profile:null};const {history,...mandate}=view.mandate;return {mandate,profile:view.profile};}
  if(['list_coordinator_messages','post_coordinator_message'].includes(name))assert(store.snapshot().projects.filter(p=>p.folderPath).every(p=>c.projectIDs.includes(p.id)),'The coordinator conversation requires a grant for every connected project.',403);
  if(name==='list_coordinator_messages'){const result=this.threads.list(COORDINATOR,{cursor:a.cursor||0,limit:a.limit||20});return {...result,items:result.items.map(({fingerprint,requestKey,...m})=>m)};}
  if(name==='post_coordinator_message'){const {fingerprint,requestKey,...m}=this.threads.post({id:COORDINATOR},{author:'agent',text:a.text,refs:a.refs,requestKey:a.requestKey,controller:c});return m;}
  if(name==='list_messages'){const project=store.project(a.projectID),result=this.threads.list(project.id,{cursor:a.cursor||0,limit:a.limit||20});return {...result,items:result.items.map(({fingerprint,requestKey,...m})=>m)};}
  if(name==='post_message'){const {fingerprint,requestKey,...m}=this.threads.post(store.project(a.projectID),{author:'agent',text:a.text,refs:a.refs,requestKey:a.requestKey,controller:c});return m;}
  if(name==='list_agents')return page(this.playbooks.inventory(store.snapshot().projects,{kind:'project',projectID:a.projectID}).entries.map(e=>({id:e.id,name:e.name,description:e.description,version:e.version,providers:e.providers,archived:e.archived})),a);
  if(name==='preview_run'){const p=await this.preview(a);return {previewToken:p.previewToken,context:p.context,source:p.source,mandate:p.mandate};}
  if(name==='list_runs')return page(workflows.list(a.projectID),a);
  if(name==='get_run'){
   this.run(a);const r=workflows.get(a.runID),attempts=page(r.attempts,a);
   return {id:r.id,projectID:r.projectID,revision:r.revision,status:r.status,error:r.error,cursor:r.cursor,createdAt:r.createdAt,finishedAt:r.finishedAt,controllerOrigin:r.controllerOrigin||null,usage:{...r.usage,inputTokens:r.usage.complete?r.usage.inputTokens:null,outputTokens:r.usage.complete?r.usage.outputTokens:null,cachedInputTokens:r.usage.complete?r.usage.cachedInputTokens:null,knownTotals:{inputTokens:r.usage.inputTokens,outputTokens:r.usage.outputTokens}},workspace:r.workspace,attempts:{...attempts,items:attempts.items.map(t=>({id:t.id,stepID:t.stepID,kind:t.kind,decision:t.decision,note:t.note,execution:t.execution?{id:t.execution.id,status:t.execution.status,output:t.execution.output?.slice(-16000),outputTruncated:(t.execution.output?.length||0)>16000,usage:t.execution.usage,error:t.execution.error}:null}))}};
  }
  if(name==='get_operation')return controllers.getOperation(c,a.operationID,a.projectID);
  if(name==='get_workspace_status'){const state=await this.lifecycle.read(store.project(a.projectID));return {...page(state.records.filter(r=>r.projectID===a.projectID).map(r=>({id:r.id,purpose:r.purpose,state:r.effectiveState,observation:r.observation,taskID:r.taskID,sourceRefs:r.sourceRefs})),a),checkedAt:state.checkedAt,complete:state.complete};}
  assert(['create_workflow','update_workflow','start_run','stop_run'].includes(name),'Unknown controller command.');
  const {operation:o,existing}=controllers.operation(c,a,name);if(existing)return copy(o);
  const origin={operationID:o.id,controllerID:c.id,controllerName:c.name};
  if(name==='start_run'){
   if(this.pending.size>=8){controllers.finish(o,{status:'failed',error:'Too many pending controller operations.'});assert(false,'Too many pending controller operations.',429);}this.pending.add(o.id);
   setImmediate(async()=>{try{
    assert(!this.closed,'Workbench is stopping.',409);controllers.check(c,'run',a.projectID);
    const preview=await this.preview(a);assert(preview.previewToken===a.previewToken,'Preview changed. Review and preview again.',409);
    controllers.check(c,'run',a.projectID);
    const r=await workflows.start(preview.input,this.flow(a),store.project(a.projectID),{controllerOrigin:preview.mandate?{...origin,mandate:preview.mandate}:origin,runtimeLimitMinutes:preview.mandate?.limits.maxRuntimeMinutes,beforePersist:async()=>{
     assert(!this.closed,'Workbench is stopping.',409);controllers.check(c,'run',a.projectID);
     assert((await this.preview(a)).previewToken===a.previewToken,'Preview changed during launch. Review again.',409);controllers.check(c,'run',a.projectID);
    }});
    controllers.finish(o,{status:'accepted',runID:r.id});
   }catch(e){const run=workflows.runs.find(r=>r.controllerOrigin?.operationID===o.id);controllers.finish(o,run?{status:'accepted',runID:run.id}:{status:'failed',error:e.status?e.message:'Launch failed. Inspect Workbench and retry with a new request key.'});}finally{this.pending.delete(o.id);}});
   return copy(o);
  }
  try{
   let result;
   if(name==='create_workflow')result=store.createFlow({...a.input,projectID:a.projectID},{controllerOrigin:origin});
   if(name==='update_workflow'){this.flow(a);result=store.updateFlow(a.flowID,{...a.input,projectID:a.projectID,version:a.version},{controllerOrigin:origin});}
   if(name==='stop_run'){const r=this.run(a);assert(r.controllerOrigin?.controllerID===c.id,'Only this controller’s runs may be stopped.',403);result=workflows.action(r.id,{action:'stop',revision:a.revision},{controllerOperationID:o.id});}
   return controllers.finish(o,{status:'completed',...(name==='stop_run'?{runID:result.id}:{flowID:result.id,flowVersion:result.version})});
  }catch(e){controllers.finish(o,{status:'failed',error:e.status?e.message:'Mutation failed. Inspect Workbench.'});throw e;}
 }
 shutdown(){this.closed=true;}
}
