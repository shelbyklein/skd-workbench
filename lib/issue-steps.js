import {assert,copy,now} from './domain.js';

// Read once at launch; never fetch again during retries or while a run is active.
export async function captureIssueSteps(flow,project,github){
 const steps=flow.steps.filter(s=>s.type==='issue'),snapshots={};
 if(!steps.length)return snapshots;
 const repository=await github.repository(project),cache=new Map();
 for(const step of steps){
  const ref=step.issue;
  assert(ref&&ref.repository===repository,`Choose an issue from this project's current repository for ${step.name}.`);
  if(!cache.has(ref.number))cache.set(ref.number,await github.issue(repository,ref.number));
  const issue=cache.get(ref.number);
  assert(issue.id===ref.id,`Issue identity changed for ${step.name}. Select it again.`);
  assert(typeof issue.body==='string'&&issue.body.length<=65536,'Issue description exceeds 65,536 characters.');
  snapshots[step.id]={...copy(issue),repository,capturedAt:now()};
 }
 return snapshots;
}
