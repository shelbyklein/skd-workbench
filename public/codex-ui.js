const escape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const active=r=>['preparing','running','stopping'].includes(r.status);
const count=v=>Number.isFinite(v)?v.toLocaleString():'Unknown';
const label={preparing:'Preparing workspace',running:'Codex is working',stopping:'Stopping',completed:'Finished · review the result',failed:'Failed',cancelled:'Stopped',interrupted:'Interrupted'};
export function mountCodex({host,project,runID,api,onOpen,onNew,notify,prefill=''}){
 let disposed=false,timer,dirty=false,pending=false,last='';
 const $=s=>host.querySelector(s);
 const guard=()=>!disposed&&host.isConnected;
 const fail=e=>{if(guard()){$('#codex-error').textContent=e.message;}};
 const start=async()=>{
  if(runID){await poll();return;}
  host.innerHTML=`<div class="codex-grid"><section class="codex-card"><span class="eyebrow">ONE TASK · REAL EXECUTION</span><h2>Work with Codex</h2><p>Run a task in ${escape(project.name)}. Output and reported tokens are saved on this Mac.</p><p id="codex-provider" class="field-help">Checking your installed Codex…</p><form id="codex-form"><label>Model<select id="codex-model" aria-label="Model" name="model" required disabled></select></label><label>Effort<select id="codex-effort" aria-label="Effort" name="effort" required disabled></select></label><label>Workspace<select name="mode" id="codex-mode"><option value="read-only">Read only — inspect and plan</option><option value="worktree">Separate Git worktree — make changes</option></select></label><p class="field-help">Coding starts from a clean committed version. Changes stay in a separate worktree for your review; nothing is merged automatically.</p><label>Task<textarea name="task" id="codex-task" aria-label="Task" rows="6" maxlength="16000" required placeholder="What should Codex do? Include your acceptance checks.">${escape(prefill)}</textarea></label><p class="field-help">Uses your Codex account allowance. Maximum runtime: 10 minutes. Token usage is reported after execution; there is no hard token or dollar cap.</p><p id="codex-error" class="form-error" role="alert"></p><button id="codex-start" class="primary" disabled>Run Codex</button></form>${!project.folderPath?'<p class="connection-warning">Choose or add a project with a local folder first.</p>':''}</section><section class="codex-card"><span class="eyebrow">THIS PROJECT</span><h2>Codex runs</h2><div id="codex-history">Loading…</div></section></div>`;
  $('#codex-form').oninput=()=>{dirty=true;};
  $('#codex-form').onsubmit=async e=>{e.preventDefault();if(pending)return;pending=true;$('#codex-start').disabled=true;$('#codex-error').textContent='';
   try{const form=new FormData(e.target);const run=await api('codex/runs','POST',{projectID:project.id,task:form.get('task'),mode:form.get('mode'),model:form.get('model'),effort:form.get('effort')});dirty=false;pending=false;onOpen(run.id);}catch(e){fail(e);if(guard())$('#codex-start').disabled=false;}finally{pending=false;}
  };
  api('codex/runs?projectID='+encodeURIComponent(project.id)).then(runs=>{
   if(!guard())return;$('#codex-history').innerHTML=runs.length?[...runs].reverse().map(r=>`<button class="codex-history-row" data-codex-run="${r.id}"><strong>${escape(r.task.slice(0,100))}</strong><span>${escape(r.model)} · ${escape(r.effort)} · ${escape(label[r.status])}</span><small>${new Date(r.createdAt).toLocaleString()}</small></button>`).join(''):'<p>No real runs yet. Start with a small task.</p>';
   host.querySelectorAll('[data-codex-run]').forEach(b=>b.onclick=()=>onOpen(b.dataset.codexRun));
  }).catch(fail);
  try{const provider=await api('codex/provider');if(!guard())return;
   $('#codex-provider').textContent=`${provider.version} · ${provider.auth}. Models advertised by your installed Codex; access is confirmed when a run succeeds.`;
   $('#codex-model').innerHTML=provider.models.map(m=>`<option value="${escape(m.id)}" ${m.isDefault?'selected':''}>${escape(m.name)}</option>`).join('');
   const efforts=()=>{const m=provider.models.find(m=>m.id===$('#codex-model').value);$('#codex-effort').innerHTML=m.efforts.map(e=>`<option ${e===m.defaultEffort?'selected':''}>${escape(e)}</option>`).join('');};efforts();$('#codex-model').onchange=efforts;
   $('#codex-model').disabled=false;$('#codex-effort').disabled=false;$('#codex-start').disabled=!project.folderPath||!provider.models.length;
  }catch(e){if(guard())$('#codex-provider').textContent='Codex is unavailable.';fail(e);}
 };
 async function poll(){
  try{
   const r=await api('codex/runs/'+runID);if(!guard())return;
   const serialized=JSON.stringify(r);if(last!==serialized){last=serialized;const focus=document.activeElement?.id;renderRun(r);if(focus)$('#'+focus)?.focus({preventScroll:true});}
   if(active(r))timer=setTimeout(poll,1000);
  }catch(e){if(guard()){host.innerHTML='<p id="codex-error" class="form-error" role="alert"></p><button id="codex-retry">Reconnect</button>';fail(e);$('#codex-retry').onclick=poll;last='';}}
 }
 function renderRun(r){
  const u=r.usage,total=u&&u.inputTokens!==null&&u.outputTokens!==null?u.inputTokens+u.outputTokens:null;
  const duration=Math.max(0,Math.round((Date.parse(r.finishedAt||new Date().toISOString())-Date.parse(r.startedAt||r.createdAt))/1000));
  host.innerHTML=`<section class="codex-card codex-result"><div class="codex-heading"><div><span class="eyebrow">${escape(r.model)} · ${escape(r.effort)}</span><h2>${escape(label[r.status])}</h2></div>${active(r)?`<button id="codex-stop" ${r.status==='stopping'?'disabled':''}>Stop run</button>`:'<button id="codex-again">Run this task again</button>'}</div><p class="preserve">${escape(r.task)}</p><div class="metrics"><div><span>TOTAL TOKENS</span><strong>${count(total)}</strong></div><div><span>INPUT / OUTPUT</span><strong>${count(u?.inputTokens)} / ${count(u?.outputTokens)}</strong></div><div><span>CACHED INPUT</span><strong>${count(u?.cachedInputTokens)}</strong></div><div><span>ELAPSED</span><strong>${duration}s</strong></div><div><span>COST</span><strong>Not reported</strong></div></div><p class="field-help">Cached input is included in input tokens, not added again. ${u?'Usage reported by Codex.':'Usage is unknown until Codex reports it.'} A finished run is not proof that acceptance checks passed.</p>${r.error?`<p class="form-error">${escape(r.error)}</p>`:''}<p id="codex-error" class="form-error" role="alert"></p><h3>Output</h3><pre class="codex-output">${escape(r.output||(active(r)?'Waiting for Codex output…':'No output was reported.'))}</pre><details ${active(r)?'open':''}><summary>Activity (${r.activity.length})</summary><div class="codex-activity">${r.activity.map(a=>`<p><strong>${escape(a.type)} · ${escape(a.status)}</strong><br>${escape(a.text)}</p>`).join('')||'<p>No events yet.</p>'}</div></details><details><summary>Project & execution context</summary><dl class="connection-list"><div><dt>Project</dt><dd>${escape(r.projectSnapshot.name)}</dd></div><div><dt>Mode</dt><dd>${escape(r.mode)}</dd></div><div><dt>Working folder</dt><dd>${escape(r.workingDirectory)}</dd></div><div><dt>Starting commit</dt><dd>${escape(r.sourceContext.git?.commit||'Not available')}</dd></div><div><dt>Source working tree</dt><dd>${r.sourceContext.git?.dirty===false?'Clean':r.sourceContext.git?.dirty===true?'Had uncommitted changes':'Unknown'}</dd></div><div><dt>Branch</dt><dd>${escape(r.branch||r.sourceContext.git?.branch||'Not available')}</dd></div><div><dt>Codex session</dt><dd>${escape(r.threadID||'Not reported')}</dd></div><div><dt>CLI</dt><dd>${escape(r.cliVersion)}</dd></div></dl></details>${r.worktreePath?`<details open><summary>Changes for review</summary><p class="field-help">${escape(r.diffNote||'Changes will be collected when Codex stops.')} Worktree retained at ${escape(r.worktreePath)}. No automatic merge.</p><pre class="codex-output">${escape((r.changes||'')+'\n'+(r.diff||'No tracked diff recorded.'))}</pre></details>`:''}</section>`;
  if($('#codex-stop'))$('#codex-stop').onclick=async()=>{try{$('#codex-stop').disabled=true;await api('codex/runs/'+r.id+'/stop','POST',{});clearTimeout(timer);await poll();}catch(e){fail(e);if($('#codex-stop'))$('#codex-stop').disabled=false;}};
  if($('#codex-again'))$('#codex-again').onclick=()=>onNew(r.task);
 }
 start().catch(fail);
 return {dispose(){disposed=true;clearTimeout(timer);},isDirty:()=>dirty||pending,isPending:()=>pending};
}
