// Project owner view: mandate, decisions, current work, next tasks, recent result and the project conversation.
// Everything shown is derived from canonical records; sending a message or saving a mandate starts nothing.
const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const drafts=new Map();
try{for(const [id,value] of Object.entries(JSON.parse(sessionStorage.getItem('skd-agent-drafts')||'{}')))if(value&&typeof value.text==='string')drafts.set(id,{text:value.text,key:typeof value.key==='string'?value.key:null});}catch{}
function saveDrafts(){try{sessionStorage.setItem('skd-agent-drafts',JSON.stringify(Object.fromEntries([...drafts].filter(([,d])=>d.text))));}catch{}}
export const agentDraft=projectID=>drafts.get(projectID)?.text||'';
const statusLabels={launching:'Starting',running:'Running',stopping:'Stopping',waiting:'Needs your review',checking:'Needs verification',failed:'Failed',interrupted:'Interrupted',completed:'Process completed',cancelled:'Stopped'};
const time=value=>{try{return new Date(value).toLocaleTimeString([],{hour:'numeric',minute:'2-digit'});}catch{return '';}};
const when=value=>{try{return new Date(value).toLocaleString([],{month:'short',day:'numeric',hour:'numeric',minute:'2-digit'});}catch{return '';}};
const issueNumber=ref=>Number(/#(\d+)$/.exec(ref)?.[1])||null;
function refButton(ref){const label=ref.kind==='issue'?'Issue #'+ref.id.replace(/^.*#/,''):ref.kind==='run'?'Run '+ref.id.slice(0,8):ref.kind[0].toUpperCase()+ref.kind.slice(1)+' '+ref.id.slice(0,8);return ['run','issue'].includes(ref.kind)?`<button type="button" class="agent-ref" data-agent-ref="${esc(ref.kind)}" data-ref-id="${esc(ref.id)}">${esc(label)}</button>`:`<span class="agent-ref">${esc(label)}</span>`;}
function progress(steps){return `<ol class="agent-steps" aria-label="Workflow steps">${steps.map(s=>`<li class="agent-step-${s.state}"><span class="agent-step-dot" aria-hidden="true"></span><span>${esc(s.name)}</span><span class="visually-hidden">${s.state==='done'?'done':s.state==='current'?'current step':'pending'}</span></li>`).join('')}</ol>`;}

export function mountProjectAgent(host,{project,api,modal,notify,flows,owner,onRun,onIssue,onIssues}){
 let state=null,sending=false,timer=null;
 host.className='project-agent';host.setAttribute('aria-label','Project agent');
 host.innerHTML=`<div class="agent-main" id="agent-main"><section aria-labelledby="agent-decisions"><h2 id="agent-decisions">Needs your decision</h2><div id="agent-decisions-body" aria-live="polite"><p class="widget-empty">Loading…</p></div></section>
 <section aria-labelledby="agent-current"><h2 id="agent-current">Current work</h2><div id="agent-current-body" aria-live="polite"></div></section>
 <section aria-labelledby="agent-next"><div class="agent-section-head"><h2 id="agent-next">Up next</h2><button type="button" class="text-button" data-agent-issues>All issues</button></div><div id="agent-next-body"></div>
  <div class="agent-subsection"><div class="agent-subhead"><h3>Priority issues</h3><span id="priority-issues-meta">Loading…</span></div><ol id="priority-issues-list" class="priority-issue-list" aria-live="polite"><li class="widget-empty">Loading issues…</li></ol><p class="field-help" id="priority-issues-note"></p></div></section>
 <section aria-labelledby="agent-recent"><h2 id="agent-recent">Recent result</h2><div id="agent-recent-body"></div>
  <div class="agent-subsection session-report-widget"><div class="agent-subhead"><h3>Last session</h3><button type="button" class="text-button" id="import-project-chat">Import</button></div><div id="last-session-report" aria-live="polite"><p class="widget-empty">Loading session…</p></div></div></section></div>
 <aside class="agent-thread" aria-label="Project conversation"><header><div><span class="eyebrow">PROJECT CONVERSATION</span><h2 id="agent-thread-title">Project owner</h2></div><button type="button" class="text-button" id="agent-refresh">Refresh</button></header>
 <p class="agent-thread-status" id="agent-thread-status"></p><ol class="agent-messages" id="agent-messages" aria-live="polite"></ol>
 <button type="button" class="agent-mandate-card" id="agent-mandate-card"></button>
 <form class="agent-composer" id="agent-composer"><label for="agent-message" id="agent-message-label">Message</label><textarea id="agent-message" rows="3" maxlength="8000"></textarea><div class="agent-composer-actions"><span class="field-help" id="agent-message-help"></span><button type="submit" class="primary" id="agent-send">Send</button></div><p class="form-error" id="agent-send-error" role="alert"></p></form></aside>`;
 const q=s=>host.querySelector(s),input=q('#agent-message');
 input.value=drafts.get(project.id)?.text||'';
 input.oninput=()=>{drafts.set(project.id,{text:input.value,key:null});saveDrafts();};
 input.onkeydown=e=>{if(e.key==='Enter'&&(e.metaKey||e.ctrlKey)){e.preventDefault();q('#agent-composer').requestSubmit();}};
 q('#agent-refresh').onclick=()=>refresh(true);
 q('#agent-mandate-card').onclick=()=>openMandate();
 q('#agent-composer').onsubmit=async e=>{
  e.preventDefault();if(sending)return;const text=input.value.trim();if(!text){q('#agent-send-error').textContent='Write a message first.';return;}
  // Keep one request key per unsent draft so an ambiguous failure can be retried without a duplicate.
  const draft=drafts.get(project.id)||{text:input.value,key:null};draft.key??=crypto.randomUUID();drafts.set(project.id,draft);saveDrafts();
  sending=true;q('#agent-send').disabled=true;q('#agent-send-error').textContent='';
  try{await api('projects/'+encodeURIComponent(project.id)+'/messages','POST',{text,requestKey:draft.key});if(!host.isConnected)return;drafts.delete(project.id);saveDrafts();input.value='';await refresh();}
  catch(error){if(host.isConnected)q('#agent-send-error').textContent=error.message+' Your draft is kept.';}
  finally{sending=false;if(host.isConnected)q('#agent-send').disabled=false;}
 };
 host.addEventListener('click',e=>{
  const ref=e.target.closest('[data-agent-ref]');if(ref){if(ref.dataset.agentRef==='run')onRun(ref.dataset.refId);else{const n=issueNumber(ref.dataset.refId)||Number(ref.dataset.refId);if(n)onIssue(n);}return;}
  const run=e.target.closest('[data-agent-run]');if(run){onRun(run.dataset.agentRun);return;}
  const issue=e.target.closest('[data-agent-issue]');if(issue){onIssue(Number(issue.dataset.agentIssue));return;}
  if(e.target.closest('[data-agent-mandate]'))openMandate();
  if(e.target.closest('[data-agent-issues]'))onIssues();
 });
 function ownerName(){return state?.profile?.name||'Project owner';}
 function renderOwner(){
  if(!owner?.isConnected)return;const m=state.mandate;
  owner.innerHTML=m?`<span>Owner: ${esc(ownerName())}</span><span class="agent-owner-state agent-owner-${state.working?'working':m.enabled?'active':'paused'}">${state.working?'Working':m.enabled?'Active':'Paused'}</span>`:'<span>No owner mandate</span>';
 }
 function renderMain(){
  const m=state.mandate;
  const decisions=state.decisions.length?`<ul class="agent-list">${state.decisions.map(d=>`<li class="agent-decision"><span class="agent-dot agent-dot-${esc(d.kind)}" aria-hidden="true"></span><span class="agent-copy"><strong>${esc(d.title)}</strong><small>${esc(d.detail)}</small></span>${d.runID?`<button type="button" class="primary" data-agent-run="${esc(d.runID)}">${d.kind==='review'?'Review':'Inspect'}</button>`:'<button type="button" data-agent-mandate>Review mandate</button>'}</li>`).join('')}</ul>`:'<p class="widget-empty">No decisions waiting.</p>';
  const c=state.current;
  const current=c?`<article class="agent-card"><div class="agent-card-head"><span class="eyebrow">${esc(c.taskRef||'WORKFLOW RUN')}</span><span class="agent-status agent-status-${esc(c.status)}">${esc(statusLabels[c.status]||c.status)}</span></div><h3>${esc(c.flowName)}</h3><p>${esc(c.task)}</p>${progress(c.steps)}
   <dl class="agent-facts"><div><dt>Attempts</dt><dd>${c.agentAttempts} of ${c.maxAttempts}</dd></div>${c.workspace?.branch?`<div><dt>Workspace</dt><dd>${esc(c.workspace.branch)}</dd></div>`:''}${c.deadlineAt?`<div><dt>Runtime limit</dt><dd>${esc(when(c.deadlineAt))}</dd></div>`:''}${c.controllerName?`<div><dt>Started by</dt><dd>${esc(c.controllerName)}${c.mandateVersion?` · mandate v${c.mandateVersion}`:''}</dd></div>`:''}</dl>
   ${c.error?`<p class="agent-error">${esc(c.error)}</p>`:''}<div class="agent-card-actions"><button type="button" class="text-button" data-agent-run="${esc(c.id)}">View run</button></div></article>`:'<p class="widget-empty">No active run.</p>';
  const next=m?(state.next.length?`<ul class="agent-list">${state.next.map(t=>{const n=t.ref.startsWith('github:')?issueNumber(t.ref):null;return `<li class="agent-next"><span class="agent-copy"><strong>${esc(t.title||t.ref)}</strong><small>${esc(t.ref)}</small></span>${n?`<button type="button" class="text-button" data-agent-issue="${n}">Open issue</button>`:''}</li>`;}).join('')}</ul>${state.nextTotal>state.next.length?`<p class="field-help">${state.nextTotal-state.next.length} more eligible task${state.nextTotal-state.next.length===1?'':'s'} in the mandate.</p>`:''}`:'<p class="widget-empty">All eligible tasks are claimed by a run.</p>'):'<p class="widget-empty">No owner mandate. <button type="button" class="text-button" data-agent-mandate>Set mandate</button></p>';
  const r=state.recent;
  const recent=r?`<article class="agent-card agent-result"><span class="agent-copy"><strong>${esc(r.flowName)}</strong><small>${esc(r.task)}</small></span><span class="agent-status agent-status-${esc(r.status)}">${esc(statusLabels[r.status]||r.status)}</span><span class="agent-result-facts">${r.approvals?`${r.approvals} review${r.approvals===1?'':'s'} approved`:'No review approval recorded'}${r.workspace?.branch?` · ${esc(r.workspace.branch)} not integrated`:''}</span><button type="button" class="text-button" data-agent-run="${esc(r.id)}">View evidence</button></article>`:'<p class="widget-empty">No finished workflow runs.</p>';
  q('#agent-decisions-body').innerHTML=decisions;q('#agent-current-body').innerHTML=current;q('#agent-next-body').innerHTML=next;q('#agent-recent-body').innerHTML=recent;
 }
 function renderThread(){
  const name=ownerName(),m=state.mandate;
  q('#agent-thread-title').textContent=name;
  q('#agent-thread-status').textContent=state.current?`${statusLabels[state.current.status]||state.current.status}: ${state.current.taskRef||state.current.flowName}`:'';
  q('#agent-message-label').textContent=`Message ${name} · ${project.name}`;
  q('#agent-message-help').textContent='Replies arrive when your coordinator reads this project. Sending starts no work.';
  const t=state.thread;
  q('#agent-messages').innerHTML=(t.trimmed?`<li class="field-help">${t.trimmed} older message${t.trimmed===1?'':'s'} not shown.</li>`:'')+(t.items.length?t.items.map(msg=>`<li class="agent-message agent-message-${esc(msg.author)}"><div class="agent-message-meta"><strong>${msg.author==='user'?'You':esc(msg.controllerName||name)}</strong><time datetime="${esc(msg.createdAt)}">${esc(time(msg.createdAt))}</time></div><p>${esc(msg.text)}</p>${msg.refs.length?`<div class="agent-refs">${msg.refs.map(refButton).join('')}</div>`:''}</li>`).join(''):'<li class="widget-empty">No messages.</li>');
  const list=q('#agent-messages');list.scrollTop=list.scrollHeight;
  q('#agent-mandate-card').innerHTML=m?`<span class="eyebrow">OWNER MANDATE · V${m.version}</span><strong>${m.enabled?'Active':'Paused'} · ${esc(m.modes.join(', ')||'no modes')} · ${m.tasks.length} task${m.tasks.length===1?'':'s'}</strong><small>${esc((m.instructions||m.objective).slice(0,160))}</small>`:'<span class="eyebrow">OWNER MANDATE</span><strong>Not set</strong><small>Choose an owner Agent, eligible tasks and limits.</small>';
 }
 async function refresh(announce=false){
  try{const next=await api('projects/'+encodeURIComponent(project.id)+'/agent');if(!host.isConnected)return;state=next;renderOwner();renderMain();renderThread();if(announce)notify('Project agent refreshed.');}
  catch(error){if(host.isConnected)q('#agent-decisions-body').innerHTML=`<p class="widget-empty">${esc(error.message)}</p>`;}
 }
 async function openMandate(){
  let profiles;try{profiles=(await api('agent-profiles?scope=project&projectID='+encodeURIComponent(project.id))).entries.filter(e=>!e.archived);}catch(error){notify(error.message);return;}
  const m=state?.mandate,projectFlows=flows();
  if(!profiles.length){modal('Owner mandate','<p>Create an Agent for this project or a global Agent first. The mandate references it as the project owner.</p>',[{label:'Close',close:true}]);return;}
  const checked=(on)=>on?' checked':'';
  modal('Owner mandate',`<div class="agent-mandate-form"><p class="field-help">Standing authority for this project’s owner. Saving does not start any work. Pausing blocks new launches; stop a running workflow from its run page.</p>
   <label class="agent-check"><input type="checkbox" name="enabled"${checked(m?.enabled)}> Active</label>
   <label>Owner Agent<select name="agentProfile" required>${profiles.map(p=>`<option value="${esc(p.id)}"${m?.agentProfile.id===p.id?' selected':''}>${esc(p.name)}${p.scope==='global'?' (global)':''}</option>`).join('')}</select></label>
   <label>Objective<textarea name="objective" rows="2" maxlength="4000" required>${esc(m?.objective||'')}</textarea></label>
   <label>Eligible tasks, highest priority first<textarea name="tasks" rows="3" placeholder="github:owner/repo#14 | Title">${esc((m?.tasks||[]).map(t=>t.ref+(t.title?' | '+t.title:'')).join('\n'))}</textarea><span class="field-help">One per line: github:owner/repo#number or local:id, optionally followed by | title.</span></label>
   <fieldset><legend>Eligible workflows</legend>${projectFlows.length?projectFlows.map(f=>`<label class="agent-check"><input type="checkbox" name="workflowIDs" value="${esc(f.id)}"${checked(m?.workflowIDs.includes(f.id))}> ${esc(f.name)}</label>`).join(''):'<p class="field-help">No saved workflows in this project.</p>'}</fieldset>
   <fieldset><legend>Permitted workspace modes</legend><label class="agent-check"><input type="checkbox" name="modes" value="read-only"${checked(!m||m.modes.includes('read-only'))}> Read-only</label><label class="agent-check"><input type="checkbox" name="modes" value="worktree"${checked(m?.modes.includes('worktree'))}> Isolated worktree (changes)</label></fieldset>
   <div class="agent-limit-fields"><label>Attempt limit<input type="number" name="maxAttempts" min="1" max="60" value="${m?.limits.maxAttempts||3}" required></label><label>Runtime limit (minutes)<input type="number" name="maxRuntimeMinutes" min="1" max="1440" value="${m?.limits.maxRuntimeMinutes||60}" required></label><label>Report detail<select name="report"><option value="summary">Summary</option><option value="full"${m?.report.detail==='full'?' selected':''}>Full</option></select></label></div>
   <label>Escalate when<textarea name="escalation" rows="2" maxlength="4000">${esc(m?.escalation||'')}</textarea></label>
   <label>Standing instructions<textarea name="instructions" rows="3" maxlength="8000">${esc(m?.instructions||'')}</textarea></label></div>`,
   [{label:'Cancel',close:true},{label:'Save mandate',primary:true,submit:true}],
   async form=>{
    const tasks=String(form.get('tasks')||'').split('\n').map(line=>line.trim()).filter(Boolean).map(line=>{const [ref,...title]=line.split('|');return {ref:ref.trim(),title:title.join('|').trim()};});
    await api('projects/'+encodeURIComponent(project.id)+'/mandate','PUT',{version:m?.version||0,enabled:form.get('enabled')==='on',agentProfile:{id:form.get('agentProfile')},objective:form.get('objective'),tasks,workflowIDs:form.getAll('workflowIDs'),modes:form.getAll('modes'),limits:{maxAttempts:Number(form.get('maxAttempts')),maxRuntimeMinutes:Number(form.get('maxRuntimeMinutes'))},report:{detail:form.get('report')},escalation:form.get('escalation'),instructions:form.get('instructions')});
    notify('Mandate saved. No work was started.');refresh();
   });
 }
 refresh();
 timer=setInterval(()=>{if(!host.isConnected){clearInterval(timer);return;}if(document.visibilityState==='visible'&&!sending)refresh();},15000);
 return {refresh,openMandate,destroy(){clearInterval(timer);}};
}
