// Eligibility uses current independently collected Git facts and explicit reviews.
// Accepting a submitted claim never changes that claim's source or outcome.
const fullCommit=value=>typeof value==='string'&&/^(?:[a-f0-9]{40}|[a-f0-9]{64})$/i.test(value);
const nonempty=value=>typeof value==='string'&&Boolean(value.trim());
const time=value=>Number.isFinite(Date.parse(value))?Date.parse(value):null;
function latest(items){return items.reduce((previous,item)=>!previous||(time(item.createdAt)??-1)>=(time(previous.createdAt)??-1)?item:previous,null);}
function ownerChangedAt(record){return Math.max(0,...(record.events||[]).filter(e=>e.type==='updated'&&e.detail?.fields?.includes('ownerRef')).map(e=>time(e.at)??Infinity));}
export function acceptedChecks(record,reports=[],commit){
 const criteria=record.criteria||[],required=criteria.filter(c=>c.required!==false),missing=[],evidenceIDs=[];
 if(!required.length)return {accepted:false,missing:['Define at least one required acceptance check'],evidenceIDs};
 if(!fullCommit(commit))return {accepted:false,missing:['Check commit is unknown'],evidenceIDs};
 const ownershipChanged=ownerChangedAt(record);
 for(const criterion of required){
  const matches=reports.filter(r=>r.repositoryKey===record.repositoryKey&&r.lifecycleID===record.id&&r.criterionID===criterion.id&&r.criteriaRevision===record.criteriaRevision&&r.commit===commit&&!r.dirtyFingerprint);
  const report=latest(matches),review=report?.reviews?.at(-1);let valid=Boolean(report&&review&&nonempty(report.environment)&&time(report.createdAt)!==null&&(time(report.createdAt)>=ownershipChanged)&&review.reviewer==='user'&&nonempty(review.reason)&&(!report.imported||review.imported===false));
  if(valid&&review.decision==='accepted')valid=report.outcome==='passed'&&(report.exitCode===null||report.exitCode===undefined||report.exitCode===0)&&!(report.artifacts||[]).some(a=>a.required===true&&a.contentStatus!=='retained');
  else if(valid)valid=review.decision==='not-applicable';
  if(!valid)missing.push(criterion.label||criterion.id);else evidenceIDs.push(report.id);
 }
 return {accepted:missing.length===0,missing,evidenceIDs};
}
export function deriveLifecycle(record,observation,reports=[],receipts=[]){
 const reasons=[],o=observation||{};
 if(record.attachmentState==='attached'&&record.events?.some(e=>e.type==='retired'&&e.imported!==true&&(!record.importContext||Date.parse(e.at)>=Date.parse(record.importContext.importedAt)))&&o.exists===false&&o.complete===true)return {state:'retired',ready:false,verified:false,retirementEligible:false,reasons:[],checks:{accepted:false,missing:[],evidenceIDs:[]}};
 if(o.complete!==true)reasons.push('Git inventory is incomplete');
 if(o.attached!==true||record.attachmentState!=='attached')reasons.push('Workspace identity needs verification');
 if(o.exists!==true)reasons.push('Workspace is missing or unavailable');
 if(!fullCommit(o.commit)||!fullCommit(o.targetCommit))reasons.push('Source or target commit is unknown');
 if(o.dirty!==false)reasons.push('Workspace has changes or its clean state is unknown');
 if(o.active!==false)reasons.push('Execution ownership is active or unknown');
 if(!Array.isArray(o.operations)||o.operations.length)reasons.push('Git operation state needs inspection');
 if(o.locked!==false||o.detached!==false||o.isTarget!==false||o.benchmark!==false)reasons.push('Workspace is not a verified eligible development branch');
 if(!nonempty(record.ownerRef))reasons.push('Task ownership is unknown');
 if(record.blocker)reasons.push(record.blocker);
 if(o.dependenciesResolved!==true)reasons.push('Task dependencies need review');
 const checks=acceptedChecks(record,reports,o.commit);if(!checks.accepted)reasons.push(...checks.missing.map(x=>'Check required: '+x));
 const ready=reasons.length===0,combined=acceptedChecks(record,reports,o.targetCommit);
 const receipt=latest(receipts.filter(r=>r.repositoryKey===record.repositoryKey&&!r.imported&&r.status==='verified'&&r.targetCommit===o.targetCommit&&r.selected?.some(s=>s.lifecycleID===record.id&&s.commit===o.commit&&s.criteriaRevision===record.criteriaRevision)&&combined.accepted&&combined.evidenceIDs.every(id=>r.evidenceIDs?.includes(id)&&reports.some(report=>report.id===id&&report.environment===r.environment&&time(report.createdAt)!==null&&time(r.createdAt)!==null&&time(report.createdAt)<=time(r.createdAt)))));
 const verified=ready&&o.contained===true&&Boolean(receipt),retirementEligible=verified&&o.assetsClear===true&&o.connectedRoot===false&&o.submodules===false;
 const unknown=o.complete!==true||o.attached!==true||o.exists!==true||record.attachmentState!=='attached'||!fullCommit(o.commit)||!fullCommit(o.targetCommit)||typeof o.dirty!=='boolean'||typeof o.active!=='boolean'||!Array.isArray(o.operations)||['locked','detached','isTarget','benchmark'].some(k=>typeof o[k]!=='boolean');
 const state=record.blocker?'blocked':unknown?'unknown':verified?'verified':o.contained===true?'integrated':ready?'ready':'working';
 return {state,ready,verified,retirementEligible,reasons,checks,combinedChecks:combined,receiptID:receipt?.id||null,verifiedAt:verified?receipt.createdAt:null};
}
export function batchEligibility({scope='selected',selected=[],records=[],observations={},reports=[],receipts=[],unknown=[]}){
 const reasons=[],selectedIDs=new Set(selected),byID=new Map(records.map(r=>[r.id,r]));
 if(!['selected','full'].includes(scope))reasons.push('Choose selected or full reconciliation scope');
 if(!selected.length)reasons.push('Select at least one ready task');if(selectedIDs.size!==selected.length)reasons.push('Selected tasks must be unique');
 if(unknown.length)reasons.push('Account for unassigned or unknown work before certification');
 const integrated=id=>Boolean(byID.has(id)&&observations[id]?.complete===true&&observations[id]?.contained===true&&fullCommit(observations[id]?.commit)&&observations[id]?.active===false&&observations[id]?.locked===false&&Array.isArray(observations[id]?.operations)&&observations[id].operations.length===0);
 const visiting=new Set(),visited=new Set();function visit(id){if(visiting.has(id)){reasons.push('Task dependencies contain a cycle');return;}if(visited.has(id))return;visiting.add(id);for(const dep of byID.get(id)?.dependencies||[])if(selectedIDs.has(dep))visit(dep);visiting.delete(id);visited.add(id);}selected.forEach(visit);
 const repositoryKeys=new Set(),targets=new Set();
 for(const id of selected){const r=byID.get(id);if(!r){reasons.push('Unknown selected task');continue;}repositoryKeys.add(r.repositoryKey);targets.add(observations[id]?.targetCommit);const dependenciesResolved=(r.dependencies||[]).every(dep=>selectedIDs.has(dep)||integrated(dep));const state=deriveLifecycle(r,{...observations[id],dependenciesResolved},reports,receipts);if(!state.ready)reasons.push(...state.reasons.map(x=>id+': '+x));for(const dep of r.dependencies||[])if(!selectedIDs.has(dep)&&!integrated(dep))reasons.push(id+': prerequisite is not selected or independently integrated');}
 if(repositoryKeys.size>1||targets.size>1)reasons.push('Selected tasks must share one repository and target commit');
 const exclusions=records.filter(r=>!selectedIDs.has(r.id)&&observations[r.id]?.isTarget!==true&&observations[r.id]?.benchmark!==true).map(r=>{const state=deriveLifecycle(r,observations[r.id],reports,receipts);return {lifecycleID:r.id,reason:r.blocker||state.state,ownerRef:r.ownerRef,nextAction:r.nextAction,state:state.state};});
 for(const x of exclusions){if(x.state!=='retired'&&(!nonempty(x.ownerRef)||!nonempty(x.nextAction)))reasons.push(x.lifecycleID+': excluded work needs an owner and next action');if(x.state==='unknown')reasons.push(x.lifecycleID+': excluded work has unknown identity or Git state');}
 if(scope==='full'&&exclusions.some(x=>!['verified','retired'].includes(x.state)))reasons.push('Full reconciliation cannot exclude unfinished work');
 return {allowed:reasons.length===0,reasons:[...new Set(reasons)],exclusions:exclusions.map(({state,...x})=>state==='retired'?{...x,ownerRef:x.ownerRef||'retained-history',nextAction:x.nextAction||'Retain history'}:x)};
}
