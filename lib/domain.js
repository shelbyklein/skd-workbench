import { randomUUID, createHash } from 'node:crypto';
export class Problem extends Error {
  constructor(message, status = 400) { super(message); this.status = status; }
}
export const id = () => randomUUID();
export const copy = value => structuredClone(value);
export const now = () => new Date().toISOString();
export function assert(ok, message, status) { if (!ok) throw new Problem(message, status); }
function text(value, label, max = 12000, required = true) {
  assert(typeof value === 'string' && value.length <= max, `${label} must be text, at most ${max} characters.`);
  assert(!required || value.trim(), `${label} is required.`);
  return value.trim();
}
// Persist identity/mode only. Preview signatures belong to a single launch.
export function workflowAgentSelection(value={mode:'legacy'}) {
  assert(value && ['legacy','inherit','selected'].includes(value.mode),'Choose a valid workflow Agent assignment.');
  assert(!value.playbookID && !value.overrides && !value.skills && !value.connections,'Workflow Agent assignments use an Agent ID; configure skill overrides separately.');
  if(value.mode==='selected')return {mode:'selected',agentProfileID:text(value.agentProfileID,'Agent ID',100)};
  assert(!value.agentProfileID,'Only selected Agent assignments may contain an Agent ID.');
  return {mode:value.mode};
}
export function validateFlow(input) {
  const name = text(input.name, 'Flow name', 100);
  assert(Array.isArray(input.steps) && input.steps.length <= 30, 'A flow can have up to 30 steps.');
  const seen = new Set();
  const steps = input.steps.map((s, index) => {
    assert(s && ['agent', 'human', 'check', 'issue'].includes(s.type), 'Choose a valid step type.');
    const stepID = text(s.id, 'Step ID', 100);
    assert(!seen.has(stepID), 'Step IDs must be unique.'); seen.add(stepID);
    const result = {id: stepID, type:s.type, name:text(s.name, 'Step name', 100), instructions:text(s.instructions, 'Instructions', 12000, false)};
    if (s.type === 'agent') {
      result.model = text(s.model, 'Model', 150);
      assert(['none','minimal','low','medium','high','xhigh','max'].includes(s.effort), 'Choose a valid effort.');
      result.effort = s.effort;
      if(s.agentProfile!==undefined)result.agentProfile=workflowAgentSelection(s.agentProfile);
      assert(!s.agentProfileID&&!s.playbook,'Use agentProfile for workflow Agent assignments.');
      const skills=s.skills||{mode:'inherit',skillIDs:[]};assert(['inherit','replace'].includes(skills.mode)&&Array.isArray(skills.skillIDs)&&skills.skillIDs.length<=100&&skills.skillIDs.every(value=>typeof value==='string'&&value.length<=100),'Choose valid skill assignments for this step.');result.skills={mode:skills.mode,skillIDs:[...new Set(skills.skillIDs)]};
    }
    if(s.type==='issue'){
      const ref=s.issue;
      assert(ref&&typeof ref.repository==='string'&&/^[\w.-]+\/[\w.-]+$/.test(ref.repository)&&!ref.repository.split('/').some(p=>p==='.'||p==='..'),'Select a project GitHub issue.');
      assert(Number.isSafeInteger(ref.number)&&ref.number>0&&Number.isSafeInteger(ref.id)&&ref.id>0,'Select a valid GitHub issue.');
      result.issue={repository:ref.repository,number:ref.number,id:ref.id,title:text(ref.title,'Issue title',256)};
    }
    if (s.type === 'human') {
      assert(Number.isInteger(s.maxRetries) && s.maxRetries >= 0 && s.maxRetries <= 5, 'Allow zero to five change requests.');
      result.maxRetries = s.maxRetries;
      result.retryFrom = s.retryFrom || null;
      if (result.maxRetries > 0) assert(input.steps.slice(0,index).some(p=>p.id===s.retryFrom && p.type==='agent'), 'A review with retries needs an earlier agent step to return to.');
    }
    return result;
  });
  let runSettings;
  if(input.runSettings){const r=input.runSettings;assert(['read-only','worktree'].includes(r.mode),'Choose a workspace mode.');assert(Number.isInteger(r.maxAttempts)&&r.maxAttempts>=1&&r.maxAttempts<=60,'Allow 1–60 agent attempts.');runSettings={task:text(r.task,'Task',12000,false),acceptance:text(r.acceptance||'','Acceptance checks',12000,false),mode:r.mode,maxAttempts:r.maxAttempts};}
  return {name, steps,...(runSettings?{runSettings}:{})};
}
export function newStep(type, name, model = '') {
  return {id:id(), type, name, instructions:'', ...(type === 'agent' ? {model, effort:'high',skills:{mode:'inherit',skillIDs:[]}} : type === 'human' ? {maxRetries:0, retryFrom:null} : {})};
}
export function seedFlows() {
  const plan = {...newStep('agent','Make a plan','Fable'),instructions:'Inspect the task and relevant code. Write a small implementation plan with acceptance checks.'};
  const human = {...newStep('human','My review'),instructions:'Review scope and acceptance checks before continuing.',maxRetries:2,retryFrom:plan.id};
  const review = {...newStep('agent','Review the plan','Astra'),instructions:'Review the plan against the task and existing code. Return concrete findings and missing checks.'};
  const revise = {...newStep('agent','Update the plan','Fable'),instructions:'Address the review findings and produce self-contained execution instructions.'};
  const execute = {...newStep('agent','Execute the plan','Opus'),instructions:'Follow the approved plan. Implement and test each step, preserving unrelated work.'};
  const final = {...newStep('human','Review & repeat'),instructions:'Inspect the result and acceptance evidence. Request changes if needed.',maxRetries:2,retryFrom:execute.id};
  return [
    {id:id(),version:1,name:'Plan, review, build',steps:[plan,human,review,revise,execute,final],updatedAt:now()},
    {id:id(),version:1,name:'One model, start to finish',steps:[{...newStep('agent','Plan & build','Astra'),effort:'low',instructions:'Plan, implement, and verify the task against its acceptance checks.'},{...newStep('human','My review'),instructions:'Inspect the result and acceptance evidence.'}],updatedAt:now()}
  ];
}

export function createRun(flow, input, project=null, sourceContext=null,issueSnapshots={}) {
  assert(flow, 'Choose an existing flow.',404);
  assert(input.flowVersion===flow.version,'The flow changed. Reload before starting a run.',409);
  validateFlow(flow);
  assert(flow.steps.length,'Add at least one step before trying this flow.');
  const task=text(input.task|| (flow.steps.some(s=>s.type==='issue')?'Follow the issue direction in this flow.':''),'Task',12000),acceptance=text(input.acceptance||'','Acceptance checks',12000,false);
  for(const s of flow.steps.filter(s=>s.type==='issue'))assert(issueSnapshots[s.id]?.id===s.issue.id,'Issue snapshot missing. Start this run again.');
  return {id:id(),revision:0,mode:'simulation',flow:copy(flow),issueSnapshots:copy(issueSnapshots),task,acceptance,
    projectID:project?.id||'unassigned',projectSnapshot:copy(project),sourceContext:copy(sourceContext),
    comparisonKey:createHash('sha256').update(JSON.stringify([task,acceptance,issueSnapshots,project?.id||'unassigned',sourceContext?.folderPath||null,sourceContext?.git?.root||null,sourceContext?.git?.commit||null,sourceContext?.git?.dirty??null])).digest('hex'),
    createdAt:now(),finishedAt:null,cursor:0,status:flow.steps[0].type==='human'?'waiting':'ready',
    attempts:[],retries:{},usage:{inputTokens:null,outputTokens:null,costUSD:null,source:'unavailable — simulation makes no model calls'}};
}
function position(run) {
  if(run.cursor>=run.flow.steps.length) {run.status='completed';run.finishedAt=now();}
  else run.status=run.flow.steps[run.cursor].type==='human'?'waiting':'ready';
}
export function transition(run,input) {
  assert(input.revision===run.revision,'This run changed in another tab. Reload before continuing.',409);
  assert(!['completed','cancelled'].includes(run.status),'This simulation has ended.',409);
  const step=run.flow.steps[run.cursor];
  const at=now();
  if(input.action==='cancel') {
    run.status='cancelled';run.finishedAt=at;
  } else if(input.action==='advance') {
    assert(step.type!=='human','This step needs your review before continuing.',409);
    const previous=run.attempts.at(-1);
    run.attempts.push({id:id(),stepID:step.id,number:run.attempts.filter(a=>a.stepID===step.id).length+1,
      kind:'simulation',at,model:step.model||null,effort:step.effort||null,
      inputAttemptID:previous?.id||null,
      output:`SIMULATED STEP — no model was called and no work was executed.\n\n${step.type==='issue'?'Issue direction':step.type==='check'?'Check to perform':'Instructions for '+step.model}:\n${step.instructions||'(No instructions supplied)'}\n\n${issueDirection(run,step.type==='issue'?run.cursor+1:run.cursor)}\n\nTask:\n${run.task}\n\nAcceptance checks:\n${run.acceptance||'(Not supplied)'}\n\n${previous?.decision==='changes'?'Requested changes:\n'+previous.note:'Handoff: '+(previous?'receives the preceding recorded attempt.':'receives the task as its starting input.')}`,
      usage:{inputTokens:null,outputTokens:null,costUSD:null}});
    run.cursor++;position(run);
  } else if(input.action==='approve'||input.action==='changes') {
    assert(step.type==='human' && run.status==='waiting','Only the current review can record a decision.',409);
    const note=text(input.note||'','Review note',5000,input.action==='changes');
    if(input.action==='changes') {
      assert((run.retries[step.id]||0)<step.maxRetries,'This review has used its change requests. Continue or stop the simulation.',409);
      const target=run.flow.steps.findIndex(s=>s.id===step.retryFrom&&s.type==='agent');
      assert(target>=0&&target<run.cursor,'No earlier agent is configured for changes.');
      run.retries[step.id]=(run.retries[step.id]||0)+1;
      run.attempts.push({id:id(),stepID:step.id,number:run.attempts.filter(a=>a.stepID===step.id).length+1,kind:'human',at,decision:'changes',note,output:'Changes requested in simulation: '+note});
      run.cursor=target;position(run);
    } else {
      run.attempts.push({id:id(),stepID:step.id,number:run.attempts.filter(a=>a.stepID===step.id).length+1,kind:'human',at,decision:'continue',note,output:'Continued the simulation. This is not acceptance of real model work.'+(note?'\n\n'+note:'')});
      run.cursor++;position(run);
    }
  } else throw new Problem('Unknown run action.');
  run.revision++;
  return run;
}

export function issueDirection(run,before=run.cursor){
 return run.flow.steps.slice(0,before).filter(s=>s.type==='issue').map(s=>{
  const issue=run.issueSnapshots?.[s.id];assert(issue,'Issue snapshot missing. Stop and start a new run.');
  return `ISSUE DIRECTION: ${issue.repository}#${issue.number}\n${issue.url}\n${issue.title}\n\n${issue.body}\n${s.instructions||''}`;
 }).join('\n\n');
}
