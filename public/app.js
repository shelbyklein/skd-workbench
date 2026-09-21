import { mountIssues } from './issues-ui.js';
import { workflowForm, bindWorkflowForm, mountWorkflow } from './workflows-ui.js';
import { mountCodex } from './codex-ui.js';
import { installApp, isStandalone, setupPWA, serverAvailable } from './pwa.js';
const $ = s => document.querySelector(s);
const esc = value => String(value ?? '').replace(/[&<>"']/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const clone = v=>structuredClone(v);
const uid = ()=>crypto.randomUUID();
let issuesView=null,issueNumber=null,issueProposalID=null,issueEditMode=false;
let workflowView=null,workflowRunID=null;
let codexView=null,codexRunID=null,codexPrefill='';
let projectID='unassigned';
const connections=new Map();
let data={projects:[],flows:[],runs:[]}, draft=null, selected=null, view='projects', runID=null, dirty=false, busy=false, compareIDs=[];
const typeName={agent:'Agent',human:'My review',check:'Check'};
const symbol={agent:'✳',human:'◉',check:'✓'};
let toastTimer;
const reviewDrafts=new Map();
function toast(message) { $('#toast').textContent=message; $('#toast').classList.add('visible'); clearTimeout(toastTimer); toastTimer=setTimeout(()=>$('#toast').classList.remove('visible'),4200); }
async function api(route,method='GET',body) {
  let response;
  try{response=await fetch('/api/'+route,{method,headers:body?{'Content-Type':'application/json'}:{},body:body?JSON.stringify(body):undefined});}
  catch{serverAvailable(false);throw new Error('Local server unavailable. Start SKD Workbench and reconnect. Check the saved state before retrying this action.');}
  const result=await response.json(); serverAvailable(result.code!=='SERVER_UNAVAILABLE'); if(!response.ok) throw new Error(result.error||'Request failed.'); return result;
}
async function reload() { data=await api('state'); }
const scopedFlows=()=>data.flows.filter(f=>f.projectID===projectID);
const scopedRuns=()=>data.runs.filter(r=>r.projectID===projectID);
const currentProject=()=>data.projects.find(p=>p.id===projectID)||data.projects[0];
function markDirty() { dirty=true; const save=$('#save'); if(save) save.disabled=false; }
function confirmLeave(action) {
  if(issuesView?.isPending()||codexView?.isPending()||workflowView?.isPending()){toast('Wait for the current request to finish before leaving.');return;}
  if(!dirty&&!issuesView?.isDirty()&&!codexView?.isDirty()&&!workflowView?.isDirty()) return action();
  modal('Keep your changes?', '<p>You have unsaved changes. Save them or discard them before leaving.</p>', [{label:'Keep editing',close:true},{label:'Discard changes',run:()=>{dirty=false;action();}}]);
}
function openFlow(flowID) { confirmLeave(()=>{const flow=data.flows.find(f=>f.id===flowID); if(!flow)return; projectID=flow.projectID;draft=clone(flow);selected=null;view='flow';dirty=false;render();}); }
function modal(title,content,buttons=[],onSubmit=null) {
  const d=$('#dialog');
  d.innerHTML=`<form id="dialog-form"><div class="dialog-head"><h2>${esc(title)}</h2><button type="button" class="icon-button" data-close aria-label="Close dialog">×</button></div>${content}<p class="form-error" id="dialog-error" role="alert"></p><div class="dialog-actions">${buttons.map((b,i)=>`<button type="${b.submit?'submit':'button'}" data-modal="${i}" class="${b.primary?'primary':''}">${esc(b.label)}</button>`).join('')}</div></form>`;
  if(!d.open)d.showModal();
  d.onkeydown=e=>{
    if(e.key!=='Tab')return;
    const controls=[...d.querySelectorAll('button,input,textarea,select,a[href]')].filter(el=>!el.disabled&&el.getClientRects().length);
    const first=controls[0],last=controls.at(-1);
    if(e.shiftKey&&(document.activeElement===first||!d.contains(document.activeElement))){e.preventDefault();last?.focus();}
    else if(!e.shiftKey&&(document.activeElement===last||!d.contains(document.activeElement))){e.preventDefault();first?.focus();}
  };
  d.querySelector('[data-close]').onclick=()=>d.close();
  buttons.forEach((b,i)=>{if(!b.submit)d.querySelector(`[data-modal="${i}"]`).onclick=()=>{d.close();if(b.run)b.run();};});
  if(onSubmit)d.querySelector('form').onsubmit=async e=>{
    e.preventDefault(); const submit=d.querySelector('[type="submit"]');submit.disabled=true;
    try {await onSubmit(new FormData(e.target));d.close();}catch(err){$('#dialog-error').textContent=err.message;submit.disabled=false;}
  };
}
function breadcrumbs() {
  const items=[{name:'Home',view:'projects',href:'#home',id:'open-projects'}];
  if(view!=='projects')items.push({name:currentProject()?.name||'Unassigned',view:'project',href:'#project/'+projectID,id:'project-home'});
  if(!['projects','project'].includes(view)){
    if(view==='issues'){
      items.push({name:'Issues',view:'issues',href:'#issues/'+projectID});
      if(issueNumber)items.push({name:'Issue #'+issueNumber,view:'issue-detail',href:'#issues/'+projectID+'/'+issueNumber});
      if(issueProposalID)items.push({name:'Proposal diff'});else if(issueEditMode)items.push({name:'Edit issue'});
    }else if(view==='codex'){
      items.push({name:'Sessions',view:'codex',href:'#sessions/'+projectID});
      if(codexRunID)items.push({name:'Session'});
    }else{
      items.push({name:'Workflows',view:'overview',href:'#workflows/'+projectID});
      if(view==='flow')items.push({name:draft?.name||'Flow editor'});
      else if(view==='workflow'){
        items.push({name:'Workflow runs',view:'workflow',href:'#workflow/'+projectID});
        if(workflowRunID)items.push({name:'Run'});
      }else if(['history','run','compare'].includes(view)){
        items.push({name:'Run history',view:'history',href:'#history/'+projectID});
        if(view==='run')items.push({name:data.runs.find(r=>r.id===runID)?.flow.name||'Simulation'});
        if(view==='compare')items.push({name:'Comparison'});
      }
    }
  }
  return `<nav class="breadcrumbs" aria-label="Breadcrumb"><ol>${items.map((item,i)=>`<li>${i===items.length-1?`<span aria-current="page">${esc(item.name)}</span>`:`<a ${item.id?`id="${item.id}"`:''} href="${esc(item.href)}" data-crumb-view="${item.view}">${esc(item.name)}</a>`}</li>`).join('')}</ol></nav>`;
}
function shell(content) {
  const home=view==='projects';
  $('#app').innerHTML=`<aside class="sidebar"><a class="brand" href="/#home" aria-label="SKD Workbench home"><img src="/icon.svg" alt=""><span>SKD Workbench</span></a><div class="projects-sidebar-heading"><span class="side-label">PROJECTS</span></div><nav class="project-list" aria-label="Projects">${data.projects.filter(p=>p.id!=='unassigned').map(p=>`<button class="project-link ${!home&&p.id===projectID?'active':''}" data-sidebar-project="${esc(p.id)}" ${!home&&p.id===projectID?'aria-current="true"':''}><span class="project-list-icon" aria-hidden="true">▱</span><span>${esc(p.name)}</span></button>`).join('')||'<p class="side-hint">Add your first project.</p>'}</nav><button class="sidebar-add-project" data-add-project>+ Add project</button>${data.flows.some(f=>f.projectID==='unassigned')?`<a class="unassigned-link" href="#project/unassigned" data-sidebar-project="unassigned" ${!home&&projectID==='unassigned'?'aria-current="true"':''}>Unassigned workflows</a>`:''}<div class="side-bottom">${isStandalone()?'':'<button id="install-app" class="install-button">↓ Install app</button>'}<span class="local-dot"></span> Local on your Mac</div></aside><main class="${view==='flow'?'flow-editor-main':''}"><header class="topbar">${breadcrumbs()}</header>${content}</main>`;
  bindCommon();updateProjectSummary();
  if(!home&&currentProject()?.folderPath&&!connections.has(projectID+':'+currentProject().version))refreshConnection();
}
function bindCommon() {
  document.querySelectorAll('[data-sidebar-project]').forEach(b=>b.onclick=e=>{e.preventDefault();confirmLeave(()=>switchProject(b.dataset.sidebarProject));});
  document.querySelectorAll('[data-add-project]').forEach(b=>b.onclick=()=>confirmLeave(()=>projectDialog()));
  $('.brand').onclick=e=>{e.preventDefault();confirmLeave(()=>{view='projects';selected=null;render();});};
  document.querySelectorAll('[data-crumb-view]').forEach(link=>link.onclick=e=>{
    if(e.metaKey||e.ctrlKey||e.shiftKey||e.altKey)return;
    e.preventDefault();confirmLeave(()=>{const destination=link.dataset.crumbView;view=destination==='issue-detail'?'issues':destination;selected=null;if(destination!=='issue-detail')issueNumber=null;issueProposalID=null;codexRunID=null;codexPrefill='';workflowRunID=null;render();});
  });
  document.querySelectorAll('[data-view-link]').forEach(b=>b.onclick=()=>confirmLeave(()=>{view=b.dataset.viewLink;issueNumber=null;issueProposalID=null;codexRunID=null;codexPrefill='';selected=null;render();}));
  if($('#open-workflows'))$('#open-workflows').onclick=()=>confirmLeave(()=>{workflowRunID=null;view='workflow';render();});
  if($('#open-codex'))$('#open-codex').onclick=()=>confirmLeave(()=>{codexRunID=null;codexPrefill='';view='codex';render();});
  if($('#install-app'))$('#install-app').onclick=async()=>{try{if(!await installApp())installHelp();}catch(e){toast('Installation was not completed. Try your browser’s install menu.');}};
  if($('#project-picker'))$('#project-picker').onchange=e=>{const target=e.target.value;e.target.value=projectID;confirmLeave(()=>switchProject(target));};
  if($('#add-project'))$('#add-project').onclick=()=>confirmLeave(()=>projectDialog());
  if($('#project-details'))$('#project-details').onclick=()=>projectDialog(currentProject());
  document.querySelectorAll('[data-flow]').forEach(b=>b.onclick=()=>openFlow(b.dataset.flow));
  document.querySelectorAll('[data-action="new"]').forEach(b=>b.onclick=newFlow);
  if($('[data-action="history"]'))$('[data-action="history"]').onclick=()=>confirmLeave(()=>{view='history';selected=null;render();});
}
function render() {
  issuesView?.dispose();issuesView=null;codexView?.dispose();codexView=null;workflowView?.dispose();workflowView=null;
  history.replaceState(null,'','#'+(view==='projects'?'home':view==='issues'?'issues/'+projectID+(issueNumber?'/'+issueNumber:'')+(issueProposalID?'/proposals/'+issueProposalID:issueEditMode?'/edit':''):view==='overview'?'workflows/'+projectID:view==='workflow'?'workflow/'+projectID+(workflowRunID?'/'+workflowRunID:''):view==='codex'?'sessions/'+projectID+(codexRunID?'/'+codexRunID:''):view==='compare'?'compare/'+compareIDs.join(','):view==='run'?'run/'+runID:view==='flow'&&draft?'flow/'+draft.id:view==='history'?'history/'+projectID:'project/'+projectID));
  if(view==='projects')renderProjects();else if(view==='project')renderProjectOverview();else if(view==='issues')renderIssues();else if(view==='overview')renderOverview();else if(view==='workflow')renderWorkflow();else if(view==='codex')renderCodex();else if(view==='flow')renderFlow(); else if(view==='run')renderRun(); else if(view==='compare')renderCompare();else renderHistory();
}
function renderProjects(){
 shell(`<section class="page-heading"><div><h1>Home</h1></div><button class="primary" id="add-project">+ Add project</button></section><section class="workflow-overview"><div class="overview-section-heading"><h2>Projects</h2><span>${data.projects.filter(p=>p.folderPath).length} connected</span></div><div class="overview-grid">${data.projects.filter(p=>p.id!=='unassigned').map(p=>{const count=data.flows.filter(f=>f.projectID===p.id).length;return `<button class="overview-flow project-card" data-project="${p.id}"><span class="eyebrow">LOCAL PROJECT</span><strong>${esc(p.name)}</strong><span>${esc(p.folderPath||'Workflows not yet connected to a project folder.')}</span><span class="overview-flow-footer">${count} workflow${count===1?'':'s'} <span aria-hidden="true">↗</span></span></button>`;}).join('')}</div></section>`);
 document.querySelectorAll('[data-project]').forEach(b=>b.onclick=()=>confirmLeave(()=>switchProject(b.dataset.project)));
}
function renderProjectOverview(){
 const project=currentProject();
 shell(`<section class="page-heading" data-project-overview><div><div class="eyebrow">PROJECT OVERVIEW</div><h1>${esc(project.name)}</h1></div><button id="project-details">Project details</button></section><section class="workflow-overview"><div class="overview-section-heading"><h2>Project views</h2></div><div class="overview-grid project-views"><button class="overview-flow" data-view-link="overview"><span class="eyebrow">${scopedFlows().length} SAVED WORKFLOW${scopedFlows().length===1?'':'S'}</span><strong>Workflows</strong><span class="overview-flow-footer">Open Workflows <span aria-hidden="true">↗</span></span></button><button class="overview-flow" data-view-link="codex"><span class="eyebrow">SINGLE AGENT</span><strong>Sessions</strong><span class="overview-flow-footer">Open Sessions <span aria-hidden="true">↗</span></span></button><button class="overview-flow" data-view-link="issues"><span class="eyebrow">GITHUB</span><strong>Issues</strong><span>Read issues and review agent edit proposals.</span><span class="overview-flow-footer">Open Issues <span aria-hidden="true">↗</span></span></button>${[['Scratchpad','Keep notes and early ideas for this project.'],['Knowledge','Organize project reference material and development memory.']].map(([name,description])=>`<article class="overview-flow planned-view" aria-label="${name} — planned"><span class="eyebrow">PLANNED</span><h3>${name}</h3><p>${description}</p><span class="overview-flow-footer">Not available yet</span></article>`).join('')}</div></section>`);
}
function renderOverview(){
 const flows=scopedFlows(),scope=projectID;
 shell(`<section class="page-heading"><div><div class="eyebrow">${esc(currentProject().name)}</div><h1>Workflows</h1></div><button class="primary" data-action="new">Create a flow</button></section><section class="workflow-overview"><div class="overview-section-heading"><h2>Your workflows</h2><span>${flows.length} saved</span></div><div class="overview-grid">${flows.map(f=>`<button class="overview-flow" data-overview-flow="${f.id}"><span class="eyebrow">${f.steps.length} STEPS · V${f.version}</span><strong>${esc(f.name)}</strong><span>${f.steps.filter(s=>s.type==='agent').map(s=>esc(s.model)+' · '+esc(s.effort)).join(' → ')||'Add steps to get started'}</span><span class="overview-flow-footer">Open workflow <span aria-hidden="true">↗</span></span></button>`).join('')||'<p class="overview-empty">No workflows in this project yet. Create one to get started.</p>'}</div><section class="overview-runs"><div class="overview-section-heading"><h2>Recent workflow runs</h2><button class="text-button" id="open-workflows">All workflow runs →</button></div><div id="overview-recent"><p>Loading recent runs…</p></div></section><div class="overview-tools"><button data-action="history">Run history <small>Simulation walkthroughs</small></button><button id="open-codex">Sessions <small>Work with an agent</small></button></div></section>`);
 document.querySelectorAll('[data-overview-flow]').forEach(b=>b.onclick=()=>openFlow(b.dataset.overviewFlow));
 const host=$('#overview-recent');
 api('workflows?projectID='+encodeURIComponent(scope)).then(runs=>{
  if(!host.isConnected||view!=='overview'||scope!==projectID)return;
  host.innerHTML=runs.length?[...runs].reverse().slice(0,5).map(r=>`<button class="overview-run" data-recent-run="${r.id}"><span><strong>${esc(r.flowName)}</strong><small>${esc(r.task.slice(0,120))}</small></span><span>${esc(({waiting:'Needs review',checking:'Needs verification',completed:'Finished',cancelled:'Stopped',running:'Running',launching:'Starting',failed:'Failed',interrupted:'Interrupted',stopping:'Stopping'})[r.status]||r.status)}<small>${dateLabel(r.createdAt)}</small></span></button>`).join(''):'<p>No workflow runs yet. Open a workflow to get started.</p>';
  host.querySelectorAll('[data-recent-run]').forEach(b=>b.onclick=()=>confirmLeave(()=>{workflowRunID=b.dataset.recentRun;view='workflow';render();}));
 }).catch(e=>{if(host.isConnected)host.textContent=e.message;});
}
function renderFlow() {
  const canvasScroll=$('.editor-layout>.canvas')?.scrollTop||0;
  if(!draft) { shell('<section class="empty"><h1>No workflow selected</h1><p>Create a workflow to add steps.</p><button class="primary" id="first-flow">Create a flow</button></section>');$('#first-flow').onclick=newFlow;return; }
  const agents=draft.steps.filter(s=>s.type==='agent').length;
  shell(`<section class="page-heading"><div><h1 id="flow-title">${esc(draft.name)}</h1><p>${draft.steps.length} steps <span class="middot">·</span> ${agents} agent${agents===1?'':'s'} <span class="middot">·</span> v${draft.version}</p></div><div class="heading-actions"><button data-action="duplicate">Duplicate</button><button id="move-flow">Move</button><button class="danger" id="delete-flow">Delete flow</button><button id="save" ${dirty?'':'disabled'}>Save flow</button><button id="run-settings">Run settings</button><button class="primary" id="execute-flow" ${draft.steps.some(s=>s.type==='agent')?'':'disabled'}>Run</button><button id="run-flow" ${draft.steps.length?'':'disabled'}>▷ Try flow</button></div></section><p class="run-task-summary"><strong>${currentProject()?.benchmark?'Benchmark task':'Saved task'}:</strong> ${esc(runSettings().task?runSettings().task.slice(0,180)+(runSettings().task.length>180?'…':''):'Set a task once in Run settings.')}</p><div class="editor-layout ${selected?'has-inspector':''}"><section class="canvas" aria-label="Flow steps"><div class="canvas-top"><span>YOUR FLOW</span><button class="text-button" id="rename">Rename</button></div><p id="reorder-help" class="reorder-help">Drag steps to reorder · Keyboard: Alt + ↑ / ↓</p><div class="step-list">${draft.steps.map((s,i)=>`<div class="step-wrap"><span class="step-number">${String(i+1).padStart(2,'0')}</span><button class="step-card ${s.type} ${selected===s.id?'selected':''}" data-step="${s.id}" aria-describedby="reorder-help" aria-keyshortcuts="Alt+ArrowUp Alt+ArrowDown" aria-pressed="${selected===s.id}"><span class="step-icon">${symbol[s.type]}</span><span class="step-copy"><strong>${esc(s.name)}</strong><span>${s.type==='agent'?esc(s.model)+' <span class="middot">·</span> '+esc(s.effort)+' effort':s.type==='human'?'Review required':'Verification check'}</span></span><span class="step-drag" aria-hidden="true" title="Drag to reorder">⠿</span></button>${s.type==='human'&&s.maxRetries?`<span class="loop-note">↶ Up to ${s.maxRetries} change requests</span>`:''}</div>`).join('')||'<div class="empty-flow"><span>＋</span><h2>No steps</h2><p>Add an agent, your review, or a check.</p></div>'}<button id="add-step" class="add-step">+ Add a step</button></div></section>${selected?'<aside class="inspector" id="inspector" aria-label="Step settings"></aside>':`<aside class="quiet-note"><p>Select a step to choose its model and give it instructions.</p><div class="note-rule"></div><p>Try flow previews the handoffs. Run executes this flow with real models and review gates.</p></aside>`}</div>`);
  $('[data-action="duplicate"]').onclick=duplicateFlow;
  $('#move-flow').onclick=moveFlow;
  $('#save').onclick=()=>saveFlow().catch(e=>toast(e.message));
  $('#rename').onclick=()=>modal('Name your flow',`<label>Flow name<input name="name" value="${esc(draft.name)}" maxlength="100" required autofocus></label>`,[{label:'Cancel',close:true},{label:'Rename',submit:true,primary:true}],async f=>{draft.name=f.get('name').trim();if(!draft.name)throw Error('Give the flow a name.');markDirty();renderFlow();});
  $('#add-step').onclick=addStep;
  $('#execute-flow').onclick=()=>launchConfigured('codex');
  $('#run-settings').onclick=()=>workflowStartDialog(false);
  $('#run-flow').onclick=()=>launchConfigured('simulation');
  document.querySelectorAll('[data-step]').forEach(b=>b.onclick=()=>{selected=b.dataset.step;renderFlow();$('#step-name').focus({preventScroll:true});});
  bindStepReordering();
  if(selected)renderInspector();
  $('.editor-layout>.canvas').scrollTop=canvasScroll;
  $('#delete-flow').onclick=()=>{
    const target={id:draft.id,version:draft.version,name:draft.name};
    modal('Delete this flow?',`<p>Delete “${esc(target.name)}”?${dirty?' Unsaved edits will also be discarded.':''} Saved runs keep their original flow.</p>`,[{label:'Keep flow',close:true},{label:'Delete flow',submit:true,primary:true}],async()=>{
      await api('flows/'+target.id,'DELETE',{version:target.version});await reload();draft=null;selected=null;dirty=false;view='overview';render();
    });
  };
}
function renderInspector() {
  const s=draft.steps.find(s=>s.id===selected),index=draft.steps.indexOf(s);
  if(!s)return;
  const earlier=draft.steps.slice(0,index).filter(s=>s.type==='agent');
  $('#inspector').innerHTML=`<div class="inspector-head"><span class="eyebrow">STEP ${String(index+1).padStart(2,'0')} / ${typeName[s.type].toUpperCase()}</span><button class="icon-button" id="close-inspector" aria-label="Close step settings">×</button></div><label>Step name<input id="step-name" value="${esc(s.name)}" maxlength="100"></label>${s.type==='agent'?`<fieldset class="pill-field"><legend>Model</legend><div class="pill-options" id="step-models"></div></fieldset><label for="step-effort">Effort <output id="step-effort-value"></output></label><input type="range" id="step-effort" aria-label="Effort" min="0" max="0" step="1"><div class="effort-ticks" id="step-effort-ticks"></div><p id="step-provider-note" class="field-help"></p><details class="custom-step-model"><summary>Custom model label</summary><label>Custom model<input id="model" value="${esc(s.model)}" maxlength="150"></label></details>`:''}<label>${s.type==='human'?'What will you review?':s.type==='check'?'What should be checked?':'Instructions'}<textarea aria-label="Instructions" id="instructions" rows="7" maxlength="12000" placeholder="Describe what this step should do…">${esc(s.instructions)}</textarea></label>${s.type==='human'?`<div class="settings-divider"></div><label>Change requests allowed<select id="max-retries" aria-label="Change requests allowed">${[0,1,2,3,4,5].map(n=>`<option value="${n}" ${s.maxRetries===n?'selected':''}>${n===0?'None':n}</option>`).join('')}</select></label><label>On changes, return to<select id="retry-from" aria-label="On changes, return to" ${earlier.length?'':'disabled'}><option value="">Choose an earlier agent</option>${earlier.map(p=>`<option value="${p.id}" ${s.retryFrom===p.id?'selected':''}>${esc(p.name)}</option>`).join('')}</select></label><p class="field-help">The steps from that point run again. Earlier attempts stay in the run history.</p>`:''}<div class="settings-divider"></div><button class="danger remove-step-button" id="remove-step">Remove step</button>`;
  for(const [selector,key] of [['#step-name','name'],['#instructions','instructions'],['#max-retries','maxRetries'],['#retry-from','retryFrom']]) {
    const el=$(selector);if(!el)continue;el.addEventListener('input',()=>{s[key]=key==='maxRetries'?Number(el.value):el.value;markDirty();updateCard(s);});
  }
  if(s.type==='agent')bindStepModels(s);
  $('#close-inspector').onclick=()=>{selected=null;renderFlow();document.querySelector(`[data-step="${s.id}"]`)?.focus({preventScroll:true});};
  $('#remove-step').onclick=()=>modal('Remove this step?',`<p>Remove “${esc(s.name)}” from this flow? Saved runs keep their original steps.</p>`,[{label:'Keep step',close:true},{label:'Remove step',run:()=>{draft.steps.splice(index,1);fixRetries();selected=null;markDirty();renderFlow();}}]);
}
function updateCard(s) {
  const card=document.querySelector(`[data-step="${s.id}"]`);if(!card)return;
  card.querySelector('strong').textContent=s.name||'Untitled step';
  if(s.type==='agent')card.querySelector('.step-copy > span').textContent=`${s.model} · ${s.effort} effort`;
  const note=card.parentElement.querySelector('.loop-note');if(note)note.textContent=s.maxRetries?`↶ Up to ${s.maxRetries} change requests`:'';
}
function fixRetries() {
  let reset=false;
  draft.steps.forEach((s,i)=>{if(s.type==='human'&&s.maxRetries&&!draft.steps.slice(0,i).some(p=>p.id===s.retryFrom&&p.type==='agent')){s.maxRetries=0;s.retryFrom=null;reset=true;}});
  if(reset)toast('A review’s return step moved or was removed. Its change requests are now off.');
}
function moveStep(index,target) {
  if(target===index||target<0||target>=draft.steps.length)return;
  const [step]=draft.steps.splice(index,1);draft.steps.splice(target,0,step);
  fixRetries();markDirty();renderFlow();
  document.querySelector(`[data-step="${step.id}"]`)?.focus({preventScroll:true});
}
function bindStepReordering() {
  const canvas=$('.editor-layout>.canvas');
  const cards=[...canvas.querySelectorAll('[data-step]')];
  cards.forEach((card,index)=>{
    card.onkeydown=e=>{
      if(e.altKey&&['ArrowUp','ArrowDown'].includes(e.key)){
        e.preventDefault();moveStep(index,index+(e.key==='ArrowUp'?-1:1));
      }
    };
    card.onpointerdown=e=>{
      if(e.button!==0||(e.pointerType!=='mouse'&&!e.target.closest('.step-drag')))return;
      const startX=e.clientX,startY=e.clientY;
      let dragging=false,target=index,y=startY,x=startX,frame;
      const clear=()=>cards.forEach(c=>c.parentElement.classList.remove('drop-before','drop-after'));
      const update=()=>{
        clear();const bounds=canvas.getBoundingClientRect();
        if(x<bounds.left||x>bounds.right||y<bounds.top||y>bounds.bottom){target=index;return;}
        const others=cards.filter(c=>c!==card);
        target=others.filter(c=>{const r=c.getBoundingClientRect();return y>r.top+r.height/2;}).length;
        if(target!==index){const anchor=others[target]||others.at(-1);anchor?.parentElement.classList.add(target<others.length?'drop-before':'drop-after');}
      };
      const tick=()=>{
        const bounds=canvas.getBoundingClientRect();
        if(x>=bounds.left&&x<=bounds.right&&y>=bounds.top&&y<=bounds.bottom){
          if(y<bounds.top+48)canvas.scrollTop-=12;
          else if(y>bounds.bottom-48)canvas.scrollTop+=12;
        }
        update();frame=requestAnimationFrame(tick);
      };
      const move=ev=>{
        if(ev.pointerId!==e.pointerId)return;
        x=ev.clientX;y=ev.clientY;
        if(!dragging&&Math.hypot(x-startX,y-startY)>6){
          dragging=true;card.setPointerCapture(e.pointerId);card.classList.add('dragging');frame=requestAnimationFrame(tick);
        }
        if(dragging){ev.preventDefault();update();}
      };
      const stop=ev=>{
        if(ev.pointerId!==e.pointerId)return;
        cancelAnimationFrame(frame);clear();card.classList.remove('dragging');
        window.removeEventListener('pointermove',move);window.removeEventListener('pointerup',stop);window.removeEventListener('pointercancel',stop);window.removeEventListener('keydown',escape);
        if(card.hasPointerCapture(e.pointerId))card.releasePointerCapture(e.pointerId);
        if(dragging){
          const suppress=event=>{event.preventDefault();event.stopImmediatePropagation();};
          window.addEventListener('click',suppress,{capture:true,once:true});
          setTimeout(()=>window.removeEventListener('click',suppress,true),0);
          if(ev.type==='pointerup')moveStep(index,target);
        }
      };
      const escape=ev=>{if(ev.key==='Escape'){ev.preventDefault();stop({pointerId:e.pointerId,type:'cancel'});}};
      window.addEventListener('pointermove',move,{passive:false});window.addEventListener('pointerup',stop);window.addEventListener('pointercancel',stop);window.addEventListener('keydown',escape);
    };
  });
}
function addStep() {
  modal('Add a step',`<div class="step-choices">${Object.entries(typeName).map(([key,title])=>`<button type="button" data-type="${key}"><span>${symbol[key]}</span><strong>${title}</strong><small>${key==='agent'?'Give a model a job':key==='human'?'Pause for your decision':'Define a verification step'}</small></button>`).join('')}</div>`);
  document.querySelectorAll('[data-type]').forEach(b=>b.onclick=()=>{
    if(draft.steps.length>=30){toast('Keep this flow to 30 steps or fewer.');return;}
    const type=b.dataset.type;
    const step={id:uid(),type,name:type==='agent'?'New agent step':type==='human'?'My review':'Check the result',instructions:'',...(type==='agent'?{model:'Astra',effort:'low'}:type==='human'?{maxRetries:0,retryFrom:null}:{})};
    draft.steps.push(step);selected=step.id;markDirty();$('#dialog').close();renderFlow();$('#step-name').focus();
  });
}
function newFlow() {
  confirmLeave(()=>modal('Start a new flow',`<label>Flow name<input name="name" placeholder="e.g. Plan high, build low" maxlength="100" required autofocus></label><p class="field-help">Start with a clean canvas. Add only the steps you need.</p>`,[{label:'Cancel',close:true},{label:'Create flow',submit:true,primary:true}],async form=>{const f=await api('flows','POST',{name:form.get('name'),steps:[],projectID});await reload();dirty=false;openFlow(f.id);}));
}
async function saveFlow() {const saved=await api('flows/'+draft.id,'PUT',draft);await reload();draft=clone(saved);dirty=false;render();toast('Flow saved.');return saved;}
function duplicateFlow() {
  modal('Duplicate flow',`<label>New flow name<input name="name" maxlength="100" value="${esc(draft.name.slice(0,90)+' copy')}" required autofocus></label><p class="field-help">Creates an independent copy, including your current edits.</p>`,[{label:'Cancel',close:true},{label:'Duplicate',submit:true,primary:true}],async form=>{const f=await api('flows','POST',{...draft,name:form.get('name')});await reload();dirty=false;openFlow(f.id);});
}
function startDialog(task='',acceptance='') {
  modal('Try this flow',`<div class="simulation-note">Simulation only · no model calls or charges</div><label>Task<textarea name="task" aria-label="Task" rows="4" maxlength="12000" required autofocus placeholder="What do you want this flow to work on?">${esc(task)}</textarea></label><label>Acceptance checks<textarea name="acceptance" aria-label="Acceptance checks" rows="3" maxlength="12000" placeholder="How would you know the work is done?">${esc(acceptance)}</textarea></label><p class="field-help">Walk through the handoffs and review gates. Step outputs are placeholders; tokens and cost remain unknown.${dirty?' Your changes will be saved before starting.':''}</p>`,[{label:'Cancel',close:true},{label:'Start simulation',submit:true,primary:true}],async form=>{
    if(dirty)await saveFlow();
    await saveRunSettings({...runSettings(),task:form.get('task'),acceptance:form.get('acceptance')});
    const r=await api('runs','POST',{flowID:draft.id,flowVersion:draft.version,projectVersion:currentProject().version,task:form.get('task'),acceptance:form.get('acceptance')});
    await reload();openRun(r.id);
  });
}
function openRun(id) {confirmLeave(()=>{runID=id;projectID=data.runs.find(r=>r.id===id)?.projectID||'unassigned';selected=null;view='run';render();});}
const statusLabel={ready:'Ready for next step',waiting:'Waiting for you',completed:'Simulation complete',cancelled:'Stopped'};
const dateLabel=value=>new Date(value).toLocaleString(undefined,{month:'short',day:'numeric',hour:'numeric',minute:'2-digit'});
function runStats(r) {
  const duration=r.finishedAt?Math.max(0,Math.round((Date.parse(r.finishedAt)-Date.parse(r.createdAt))/1000)):null;
  return `<div class="metrics"><div><span>RESULT</span><strong>${esc(statusLabel[r.status])}</strong></div><div><span>TOKENS</span><strong>Not measured</strong></div><div><span>SIMULATION TIME</span><strong>${duration===null?'In progress':duration+'s'}</strong></div><div><span>MODEL COST</span><strong>Not measured</strong></div></div>`;
}
function renderRun() {
  const r=data.runs.find(r=>r.id===runID);if(!r){view='history';render();return;}
  const ended=['completed','cancelled'].includes(r.status);
  const current=r.flow.steps[r.cursor];
  if(!selected)selected=current?.id||r.flow.steps.at(-1)?.id;
  const chosen=r.flow.steps.find(s=>s.id===selected)||current;
  const attempts=r.attempts.filter(a=>a.stepID===chosen?.id);
  shell(`<section class="page-heading"><div><div class="eyebrow">SIMULATION / FLOW v${r.flow.version}</div><h1>${esc(r.flow.name)}</h1><p>${dateLabel(r.createdAt)} <span class="middot">·</span> ${esc(statusLabel[r.status])}</p></div><div class="heading-actions"><button id="back-history">All runs</button>${ended?'':`<button id="stop-run">Stop simulation</button>`}<button id="edit-original" ${data.flows.some(f=>f.id===r.flow.id)?'':'disabled'}>Open flow</button></div></section><section class="run-intro"><div class="simulation-note">A walkthrough, not model work. Outputs are simulated; checks have not been executed.</div>${runStats(r)}${runContext(r)}<details class="task-details"><summary>Task & acceptance checks</summary><h3>Task</h3><p class="preserve">${esc(r.task)}</p><h3>Acceptance checks</h3><p class="preserve">${esc(r.acceptance||'Not supplied')}</p></details></section><div class="run-layout"><section class="canvas" aria-label="Simulation steps"><div class="canvas-top"><span>YOUR FLOW / SNAPSHOT</span><span>${r.attempts.length} RECORDED EVENTS</span></div><div class="step-list">${r.flow.steps.map((s,i)=>{
    const state=i<r.cursor?'done':i===r.cursor&&!ended?'current':'pending';
    return `<div class="step-wrap"><span class="step-number">${String(i+1).padStart(2,'0')}</span><button class="step-card ${s.type} ${selected===s.id?'selected':''} ${state}" data-run-step="${s.id}"><span class="step-icon">${state==='done'?'✓':symbol[s.type]}</span><span class="step-copy"><strong>${esc(s.name)}</strong><span>${state==='current'?esc(statusLabel[r.status]):state==='done'?'Recorded in simulation':ended?'Not reached':'Up next'}${s.model?' · '+esc(s.model):''}</span></span></button></div>`;
  }).join('')}</div></section><aside class="run-panel">${ended?`<div class="review-panel"><span class="eyebrow">${r.status==='completed'?'WALKTHROUGH FINISHED':'SIMULATION STOPPED'}</span><h2>${r.status==='completed'?'How did the flow feel?':'You can start fresh.'}</h2><p>${r.status==='completed'?'All steps were visited. This does not indicate the task was completed by a model.':'Your recorded steps and review notes are saved.'}</p><button id="try-another">Try another flow with this task</button></div>`:r.status==='waiting'?`<div class="review-panel"><span class="eyebrow">YOUR TURN</span><h2>${esc(current.name)}</h2><p>${esc(current.instructions||'Review the preceding output and decide what happens next.')}</p><label>Review note<textarea id="review-note" aria-label="Review note" rows="3" maxlength="5000" placeholder="What should change, or what looks good?">${esc(reviewDrafts.get(r.id)||'')}</textarea></label><div class="review-actions"><button class="primary" id="approve-run">Continue</button><button id="request-changes" ${(r.retries[current.id]||0)>=current.maxRetries?'disabled':''}>Request changes</button></div><p class="field-help">${current.maxRetries?`${r.retries[current.id]||0} of ${current.maxRetries} change requests used. Returns to “${esc(r.flow.steps.find(s=>s.id===current.retryFrom)?.name)}”.`:'Change requests are off for this step.'}</p></div>`:`<div class="review-panel"><span class="eyebrow">NEXT STEP</span><h2>${esc(current.name)}</h2><p>Record a placeholder output and move to the next step. No model will be called.</p><button class="primary" id="advance-run">Simulate this step →</button></div>`}<section class="output-panel"><span class="eyebrow">STEP DETAILS</span><h2>${esc(chosen?.name)}</h2>${chosen?.model?`<p class="small">${esc(chosen.model)} · ${esc(chosen.effort)} effort · requested label</p>`:''}${attempts.length?attempts.map(a=>`<details class="attempt" ${a===attempts.at(-1)?'open':''}><summary>${a.kind==='human'?'Review':'Simulated attempt'} ${a.number} <span>${dateLabel(a.at)}</span></summary><pre>${esc(a.output)}</pre></details>`).join(''):'<p>No output yet. This step has not been visited.</p>'}<details class="task-details"><summary>Saved instructions</summary><p class="preserve">${esc(chosen?.instructions||'No instructions supplied.')}</p></details></section></aside></div>`);
  $('#back-history').onclick=()=>{view='history';render();};
  $('#edit-original').onclick=()=>openFlow(r.flow.id);
  if($('#stop-run'))$('#stop-run').onclick=()=>modal('Stop this simulation?','<p>The steps already recorded will stay in your run history.</p>',[{label:'Keep going',close:true},{label:'Stop simulation',run:()=>runAction('cancel')}]);
  if($('#advance-run'))$('#advance-run').onclick=()=>runAction('advance');
  if($('#review-note'))$('#review-note').oninput=()=>reviewDrafts.set(r.id,$('#review-note').value);
  if($('#approve-run'))$('#approve-run').onclick=()=>runAction('approve',$('#review-note').value);
  if($('#request-changes'))$('#request-changes').onclick=()=>runAction('changes',$('#review-note').value);
  document.querySelectorAll('[data-run-step]').forEach(b=>b.onclick=()=>{selected=b.dataset.runStep;renderRun();});
  if($('#try-another'))$('#try-another').onclick=()=>modal('Try the same task',`<p>Choose a flow. The task and acceptance checks will be copied exactly.</p><label>Flow<select name="flow" aria-label="Flow">${scopedFlows().map(f=>`<option value="${f.id}">${esc(f.name)}</option>`).join('')}</select></label>`,[{label:'Cancel',close:true},{label:'Start simulation',submit:true,primary:true}],async form=>{
    const f=data.flows.find(f=>f.id===form.get('flow'));if(!f)throw Error('Create a flow first.');
    const next=await api('runs','POST',{flowID:f.id,flowVersion:f.version,task:r.task,acceptance:r.acceptance});await reload();openRun(next.id);
  });
}
async function runAction(action,note='') {
  if(busy)return;busy=true;
  const r=data.runs.find(r=>r.id===runID);
  document.querySelectorAll('.review-actions button,#advance-run,#stop-run').forEach(b=>b.disabled=true);
  try{await api('runs/'+r.id+'/action','POST',{revision:r.revision,action,note});reviewDrafts.delete(r.id);await reload();selected=null;render();}
  catch(e){toast(e.message);try{await reload();}catch{}render();if($('#review-note'))$('#review-note').value=note;}
  finally{busy=false;}
}
function renderCompare(){
  const runs=compareIDs.map(id=>data.runs.find(r=>r.id===id)).filter(Boolean);
  if(runs.length!==2){view='history';render();return;}
  const same=runs[0].task===runs[1].task&&runs[0].acceptance===runs[1].acceptance;
  const codeWarning=comparisonWarning(runs[0],runs[1]);
  shell(`<section class="page-heading"><div><div class="eyebrow">TWO WAYS THROUGH THE SAME WORK</div><h1>Compare flows</h1><p>Inspect the structure before spending on a real run.</p></div><button id="back-history">All runs</button></section><section class="comparison"><div class="comparison-notice ${same?'':'mismatch'}"><strong>${same?'Same task & acceptance checks':'Different tasks — not a controlled comparison'}</strong><p>${same?'These simulations used identical task inputs. They do not measure model quality or real execution time.':'Task or acceptance inputs differ. You can inspect these runs, but their outcomes should not be treated as a fair comparison.'}</p></div>${codeWarning?`<div class="comparison-notice mismatch"><strong>Code context</strong><p>${esc(codeWarning)}</p></div>`:''}<div class="compare-grid">${runs.map((r,i)=>`<article class="compare-card"><span class="eyebrow">FLOW ${i+1} / v${r.flow.version} / SIMULATION</span><h2>${esc(r.flow.name)}</h2><p class="compare-task">${esc(r.task)}</p><dl><div><dt>Result</dt><dd>${esc(statusLabel[r.status])}</dd></div><div><dt>Model tokens</dt><dd>Not measured</dd></div><div><dt>Model cost</dt><dd>Not measured</dd></div><div><dt>Simulation time</dt><dd>${r.finishedAt?Math.max(0,Math.round((Date.parse(r.finishedAt)-Date.parse(r.createdAt))/1000))+'s':'In progress'}</dd></div><div><dt>Agent steps</dt><dd>${r.flow.steps.filter(s=>s.type==='agent').length}</dd></div><div><dt>Change requests</dt><dd>${Object.values(r.retries).reduce((a,b)=>a+b,0)}</dd></div><div><dt>Recorded events</dt><dd>${r.attempts.length}</dd></div></dl><div class="mini-flow">${r.flow.steps.map(s=>`<div><span class="mini-dot ${s.type}">${symbol[s.type]}</span><span>${esc(s.name)}<small>${s.model?esc(s.model)+' · '+esc(s.effort):typeName[s.type]}</small></span></div>`).join('')}</div><button data-open-run="${r.id}">Inspect run ↗</button></article>`).join('')}</div><p class="comparison-footnote">Simulation time includes your pauses and review time. No tokens, model charges, tests, or quality scores have been measured.</p></section>`);
  $('#back-history').onclick=()=>{view='history';render();};
  document.querySelectorAll('[data-open-run]').forEach(b=>b.onclick=()=>openRun(b.dataset.openRun));
}
function renderHistory(){
  compareIDs=compareIDs.filter(id=>scopedRuns().some(r=>r.id===id));
  shell(`<section class="page-heading"><div><div class="eyebrow">SIMULATIONS</div><h1>Run history</h1><p>Every simulation keeps its own flow and review notes.</p></div><button id="compare-runs" ${compareIDs.length===2?'':'disabled'}>Compare ${compareIDs.length}/2</button></section><section class="history-list">${scopedRuns().length?`<p class="history-help">Select two runs to compare. Open any run to inspect its steps.</p>`+[...scopedRuns()].reverse().map(r=>`<div class="history-item"><label class="run-select"><input type="checkbox" aria-label="Select ${esc(r.flow.name)} run ${r.id.slice(0,6)}" data-compare="${r.id}" ${compareIDs.includes(r.id)?'checked':''}></label><button class="history-row" data-open-run="${r.id}"><span><strong>${esc(r.flow.name)}</strong><small>${esc(r.task.slice(0,100))}</small></span><span class="history-meta">${esc(statusLabel[r.status])}<small>${dateLabel(r.createdAt)} · v${r.flow.version} · Simulation</small></span><span>↗</span></button></div>`).join(''):'<div class="empty"><h2>No simulation runs</h2><p>Choose a saved flow to get started.</p></div>'}</section>`);
  document.querySelectorAll('[data-open-run]').forEach(b=>b.onclick=()=>openRun(b.dataset.openRun));
  document.querySelectorAll('[data-compare]').forEach(input=>input.onchange=()=>{
    if(input.checked&&compareIDs.length>=2){input.checked=false;toast('Choose two runs. Uncheck one to select another.');return;}
    compareIDs=input.checked?[...compareIDs,input.dataset.compare]:compareIDs.filter(id=>id!==input.dataset.compare);
    const button=$('#compare-runs');button.textContent=`Compare ${compareIDs.length}/2`;button.disabled=compareIDs.length!==2;
  });
  $('#compare-runs').onclick=()=>{view='compare';render();};
}
const hasUnsaved=()=>dirty||issuesView?.isDirty()||issuesView?.isPending()||codexView?.isDirty()||workflowView?.isDirty()||[...reviewDrafts.values()].some(Boolean)||$('#dialog').open||busy;
let loaded=false;
window.addEventListener('beforeunload',e=>{if(hasUnsaved()){e.preventDefault();e.returnValue='';}});
async function boot(){try{
  await reload();const route=location.hash.slice(1).split('/');
  if(route[0]==='issues'){view='issues';projectID=route[1]||'unassigned';issueNumber=/^[1-9][0-9]*$/.test(route[2]||'')?Number(route[2]):null;issueProposalID=issueNumber&&route[3]==='proposals'&&/^[\w-]+$/.test(route[4]||'')?route[4]:null;issueEditMode=!!issueNumber&&route[3]==='edit';}
  else if(route[0]==='workflow'){view='workflow';projectID=route[1]||'unassigned';workflowRunID=route[2]||null;}
  else if(['sessions','codex'].includes(route[0])){view='codex';projectID=route[1]||'unassigned';codexRunID=route[2]||null;}
  else if(route[0]==='run'&&data.runs.some(r=>r.id===route[1])){runID=route[1];view='run';projectID=data.runs.find(r=>r.id===runID).projectID;}
  else if(route[0]==='history'){view='history';projectID=route[1]||'unassigned';}
  else if(route[0]==='compare'){compareIDs=(route[1]||'').split(',');view='compare';projectID=data.runs.find(r=>r.id===compareIDs[0])?.projectID||'unassigned';}
  else if(route[0]==='workflows'){view='overview';projectID=route[1]||'unassigned';}
  else if(route[0]==='project'){view='project';projectID=route[1]||'unassigned';}
  else if(route[0]==='flow'){view='flow';projectID=data.flows.find(f=>f.id===route[1])?.projectID||'unassigned';}
  if(!data.projects.some(p=>p.id===projectID))projectID='unassigned';
  draft=clone(data.flows.find(f=>f.id===route[1]&&f.projectID===projectID)||scopedFlows()[0]||null);loaded=true;render();
 }catch(e){$('#app').innerHTML=`<section class="empty offline-startup"><img src="/icon.svg" alt=""><h1>Server unavailable</h1><p>The interface is ready. Your projects and workflows need the local server.</p><p>Open <strong>Launch SKD Workbench.command</strong> in the SKD Workbench folder, then reconnect.</p><button id="retry-load" class="primary">Reconnect</button><p class="offline-note">${esc(e.message)}</p></section>`;$('#retry-load').onclick=boot;}}
setupPWA({hasUnsaved,notify:toast,onReconnect:async()=>{
 if(!loaded){await boot();return;}
 // Reconnection never replaces an editor or dialog that may contain unsaved text.
 if(hasUnsaved()){toast('Connected. Your edits are still here; save when ready.');return;}
 try{await reload();if(hasUnsaved())return;connections.clear();draft=clone(data.flows.find(f=>f.id===draft?.id)||scopedFlows()[0]||null);render();}catch(e){toast(e.message);}
}});
boot();

function switchProject(id){
  projectID=id;issueNumber=null;issueProposalID=null;compareIDs=[];selected=null;dirty=false;view='project';codexRunID=null;codexPrefill='';workflowRunID=null;draft=clone(scopedFlows()[0]||null);render();
  if(currentProject()?.folderPath)refreshConnection(true);
}
function updateProjectSummary(){
  const el=$('#project-summary'),p=currentProject();if(!el||!p)return;
  const ctx=connections.get(p.id+':'+p.version);
  el.textContent=!p.folderPath?'Workflows without a project folder.':!ctx?'Checking local folder…':!ctx.available?ctx.message:ctx.git?.status==='connected'?`${ctx.git.branch|| (ctx.git.detached?'Detached HEAD':'No branch')} · ${ctx.git.dirty===true?'Uncommitted changes':ctx.git.dirty===false?'Clean':'Status unknown'}`:ctx.git?.message||'Folder connected';
  el.classList.toggle('connection-warning',Boolean(ctx&&!ctx.available));
}
async function refreshConnection(force=false){
  const p=currentProject();if(!p?.folderPath)return;
  const key=p.id+':'+p.version;
  if(!force&&connections.has(key))return connections.get(key);
  try{const ctx=await api('projects/'+p.id+'/connection');connections.set(key,ctx);if(projectID===p.id)updateProjectSummary();return ctx;}
  catch(e){const ctx={available:false,message:e.message};connections.set(key,ctx);if(projectID===p.id)updateProjectSummary();return ctx;}
}
function connectionMarkup(ctx){
  if(!ctx)return '<p>Checking local folder…</p>';
  if(!ctx.available)return `<p class="connection-warning">${esc(ctx.message||'Folder unavailable. Reconnect it before running.')}</p>`;
  const g=ctx.git;
  if(g?.status!=='connected')return `<p>${esc(g?.message||'Folder connected.')}</p><p class="field-help">You can organize workflows here without Git.</p>`;
  return `<dl class="connection-list"><div><dt>Repository folder</dt><dd>${esc(g.root)}</dd></div><div><dt>Branch</dt><dd>${esc(g.branch||(g.detached?'Detached HEAD':'Unknown'))}</dd></div><div><dt>Commit</dt><dd>${esc(g.commit||'No commits yet')}</dd></div><div><dt>Working tree</dt><dd>${g.dirty===true?'Uncommitted changes':g.dirty===false?'Clean':'Unknown'}</dd></div><div><dt>Remote repositories</dt><dd>${g.remotes?.length?g.remotes.map(r=>`<div class="remote"><strong>${esc(r.name)}</strong> ${r.webURL?`<a href="${esc(r.webURL)}" target="_blank" rel="noopener noreferrer">${esc(r.url)} ↗</a>`:esc(r.url)}</div>`).join(''):'No remote configured'}</dd></div></dl><details class="task-details"><summary>Worktree details</summary><p>Common Git directory</p><p class="preserve">${esc(g.commonDirectory||'Unknown')}</p></details>${g.partial?'<p class="connection-warning">Some Git details could not be read.</p>':''}<p class="field-help">Checked ${esc(dateLabel(ctx.checkedAt))}. Git information is read-only.</p>`;
}
function benchmarkDialog(project){
 modal('Benchmark reset',`<p>Each real run starts from one pinned Git commit in a fresh worktree. Output, tokens, command evidence and files stay in history after the temporary worktree is removed.</p><p>Review pauses and retryable failures keep their worktree. Finish or stop the workflow to clear it. If archiving fails, the worktree is kept.</p>${project.benchmark?`<p>Current baseline: <code>${esc(project.benchmark.commit)}</code></p>`:''}<label>Reset after each run<select name="enabled"><option value="true">Enabled</option><option value="false">Disabled — retain worktrees</option></select></label><label>Baseline commit or tag<input name="ref" required value="${esc(project.benchmark?.commit||'HEAD')}" maxlength="200"></label><p class="field-help">Pinning reads Git only. It does not start Codex or run the benchmark. Applies to future runs.</p>`,[{label:'Cancel',close:true},{label:'Save benchmark settings',submit:true,primary:true}],async form=>{
  await api('projects/'+project.id+'/benchmark','PUT',{version:project.version,enabled:form.get('enabled')==='true',ref:form.get('ref')});await reload();render();toast('Benchmark settings saved.');
 });
}
function projectDialog(project=null){
  if(project?.id==='unassigned'){
    modal('Unassigned', '<p>These workflows do not have a project folder yet. Create a project, then use Move on a workflow to put it there. Earlier runs stay in Unassigned.</p>',[{label:'Close',close:true},{label:'Add project',primary:true,run:()=>projectDialog()}]);return;
  }
  const edit=Boolean(project);
  modal(edit?'Project details':'Add a project',`<label>Project name<input name="name" maxlength="100" required autofocus value="${esc(project?.name||'')}" placeholder="e.g. Newton"></label><label>Local folder<input name="folderPath" maxlength="4096" required value="${esc(project?.folderPath||'')}" placeholder="/Users/you/Projects/newton"></label><button type="button" id="choose-folder">Choose folder…</button><p class="field-help">Choose a folder or enter its path. Files will not be changed.</p>${edit?'<div class="settings-divider"></div><div class="connection-heading"><h3>Git connection</h3><button type="button" class="text-button" id="refresh-git">Refresh</button></div><p class="field-help">Information for the saved folder. Save to connect a different folder.</p><div id="connection-details"></div>':''}`, [...(edit?[{label:project.benchmark?'Benchmark settings':'Set up benchmark',run:()=>benchmarkDialog(project)}]:[]),{label:'Cancel',close:true},{label:edit?'Save project':'Add project',submit:true,primary:true}],async form=>{
    const saved=await api(edit?'projects/'+project.id:'projects',edit?'PUT':'POST',{name:form.get('name'),folderPath:form.get('folderPath'),...(edit?{version:project.version}:{})});
    await reload();
    if(edit){connections.delete(saved.id+':'+saved.version);render();refreshConnection(true);}else switchProject(saved.id);
    toast(edit?'Project saved.':'Project connected. Add a workflow or move one here.');
  });
  const folderButton=$('#choose-folder'),folderInput=$('#dialog [name="folderPath"]'),dialogError=$('#dialog-error');
  folderButton.onclick=async()=>{
    folderButton.disabled=true;folderButton.textContent='Choosing…';dialogError.textContent='';
    try{const result=await api('choose-folder','POST',{});if(!folderInput.isConnected||!$('#dialog').open)return;if(result.folderPath){folderInput.value=result.folderPath;folderInput.focus();}}
    catch(e){if(dialogError.isConnected)dialogError.textContent=e.message;}
    finally{if(folderButton.isConnected){folderButton.disabled=false;folderButton.textContent='Choose folder…';}}
  };
  if(edit){
    const container=$('#connection-details');container.innerHTML=connectionMarkup(connections.get(project.id+':'+project.version));
    const refresh=async()=>{
      const button=$('#refresh-git');if(button)button.disabled=true;
      try{const ctx=await api('projects/'+project.id+'/connection');connections.set(project.id+':'+project.version,ctx);if(container.isConnected)container.innerHTML=connectionMarkup(ctx);updateProjectSummary();}
      catch(e){if(container.isConnected)container.textContent=e.message;}
      finally{if(button?.isConnected)button.disabled=false;}
    };
    $('#refresh-git').onclick=refresh;refresh();
  }
}
function moveFlow(){
  modal('Move workflow',`<label>Destination project<select name="projectID" aria-label="Destination project">${data.projects.map(p=>`<option value="${p.id}" ${p.id===draft.projectID?'selected':''}>${esc(p.name)}</option>`).join('')}</select></label><p>Moves this workflow, including current edits. Earlier runs keep their original project.</p>`,[{label:'Cancel',close:true},{label:'Move workflow',submit:true,primary:true}],async form=>{
    const saved=await api('flows/'+draft.id,'PUT',{...draft,projectID:form.get('projectID')});await reload();dirty=false;openFlow(saved.id);toast('Workflow moved.');
  });
}
function runContext(r){
  const p=r.projectSnapshot,c=r.sourceContext;
  return `<details class="task-details run-context"><summary>Project & code at run start</summary><h3>${esc(p?.name||'Unassigned')}</h3>${p?.folderPath?`<p class="preserve">${esc(p.folderPath)}</p>${connectionMarkup(c)}`:'<p>No project folder or Git context was recorded for this run.</p>'}<p class="field-help">Saved with this run. Later project or branch changes do not update this snapshot.</p></details>`;
}
function comparisonWarning(a,b){
  if(a.projectID!==b.projectID)return 'These runs belong to different projects. Their code contexts are not comparable.';
  const x=a.sourceContext,y=b.sourceContext;
  if(!x||!y||x.git?.status!=='connected'||y.git?.status!=='connected'||!x.git.commit||!y.git.commit)return 'A repository commit was not recorded for both runs. Code equivalence is unknown.';
  if(x.folderPath!==y.folderPath||x.git.root!==y.git.root)return 'These runs used different local folders. Check their saved code context before comparing.';
  if(x.git.commit!==y.git.commit)return 'These runs started from different commits.';
  if(x.git.dirty!==false||y.git.dirty!==false)return 'At least one working tree had uncommitted changes or unknown status. Matching commits do not establish identical code.';
  return '';
}

function installHelp(){
  modal('Install SKD Workbench',`<p>Use SKD Workbench in its own app window, with an icon in your Dock.</p><p>If this browser does not offer installation, open <strong>${esc(location.origin)}</strong> in Chrome or Edge. Use its install icon in the address bar, or the browser menu’s app installation command.</p><p class="field-help">The local server must stay running for your projects and workflows. This address works on this Mac, not another device.</p>`,[{label:'Close',close:true},{label:'Copy app address',primary:true,run:async()=>{try{await navigator.clipboard.writeText(location.origin+'/');toast('App address copied.');}catch{toast('App address: '+location.origin+'/');}}}]);
}

function renderCodex(){
 shell(`<section class="page-heading"><div><div class="eyebrow">SINGLE AGENT</div><h1>Sessions</h1></div>${codexRunID?'<button id="codex-back">All sessions</button>':''}</section><section id="codex-view" class="codex-view"></section>`);
 const open=id=>confirmLeave(()=>{codexRunID=id;view='codex';render();});
 const newRun=task=>confirmLeave(()=>{codexRunID=null;codexPrefill=task;view='codex';render();});
 if($('#codex-back'))$('#codex-back').onclick=()=>newRun('');
 codexView=mountCodex({host:$('#codex-view'),project:currentProject(),runID:codexRunID,api,onOpen:open,onNew:newRun,notify:toast,prefill:codexPrefill});
}

function runSettings(){
 const saved=draft.runSettings||{},p=currentProject();
 return {task:'',acceptance:'',mode:'read-only',maxAttempts:20,...saved,...(p?.benchmark&&p.benchmarkTask?p.benchmarkTask:{}),...(p?.benchmark?{mode:'worktree'}:{})};
}
async function saveRunSettings(settings,config){
 const result=await api('flows/'+draft.id+'/settings','PUT',{version:draft.version,projectVersion:currentProject().version,settings,config});
 await reload();draft=clone(result.flow);dirty=false;
}
async function launchConfigured(kind){
 if(busy)return;busy=true;
 const button=$(kind==='codex'?'#execute-flow':'#run-flow');if(button){button.disabled=true;button.textContent='Starting…';}
 try{
  if(dirty)await saveFlow();
  const settings=runSettings();
  if(!settings.task.trim()){
   if(kind==='codex')await workflowStartDialog(true);else startDialog(settings.task,settings.acceptance);
   return;
  }
  if(kind==='codex'){
   if(!currentProject()?.folderPath){toast('Move this flow into a project with a connected folder first.');return;}
   const config=Object.fromEntries(draft.steps.filter(s=>s.type==='agent').map(s=>[s.id,{model:s.model,effort:s.effort}]));
   const run=await api('workflows','POST',{flowID:draft.id,flowVersion:draft.version,projectVersion:currentProject().version,...settings,config});workflowRunID=run.id;view='workflow';render();
  }else{
   const run=await api('runs','POST',{flowID:draft.id,flowVersion:draft.version,projectVersion:currentProject().version,task:settings.task,acceptance:settings.acceptance});await reload();runID=run.id;selected=null;view='run';render();
  }
 }catch(e){toast(e.message);if(kind==='codex'&&/supported Codex model/.test(e.message))await workflowStartDialog(true);}
 finally{busy=false;if(view==='flow'){const codex=$('#execute-flow'),sim=$('#run-flow');if(codex){codex.disabled=!draft.steps.some(s=>s.type==='agent');codex.textContent='Run';}if(sim){sim.disabled=!draft.steps.length;sim.textContent='▷ Try flow';}}}
}
async function workflowStartDialog(startAfterSave=false){
 try{
  if(dirty)await saveFlow();
  const flow=clone(draft),provider=await api('codex/provider').catch(()=>({models:[],unavailable:true})),settings=runSettings();let readConfig;
  modal(startAfterSave?'Run flow with Codex':'Run settings',(provider.unavailable?'<p class="form-error">Codex is unavailable. You can save task settings; existing model choices will be kept.</p>':'')+workflowForm(flow,provider,currentProject()),[{label:'Cancel',close:true},{label:startAfterSave?'Start real workflow':'Save run settings',primary:true,submit:true}],async form=>{
   await saveRunSettings({task:form.get('task'),acceptance:form.get('acceptance'),mode:form.get('mode'),maxAttempts:Number(form.get('maxAttempts'))},provider.unavailable?undefined:readConfig());
   if(startAfterSave){await launchConfigured('codex');}else{render();toast('Run settings saved. Run buttons now start directly.');}
  });
  const form=$('#dialog-form');form.elements.task.value=settings.task;form.elements.acceptance.value=settings.acceptance;form.elements.mode.value=settings.mode;form.elements.maxAttempts.value=settings.maxAttempts;
  readConfig=bindWorkflowForm($('#dialog'),flow,provider);
  if(provider.unavailable)$('#dialog').querySelectorAll('[data-workflow-model],[data-workflow-effort],#workflow-all-model').forEach(el=>{el.disabled=true;el.required=false;});
 }catch(e){toast(e.message);}
}
function renderWorkflow(){
 shell(`<section class="page-heading"><div><div class="eyebrow">CONNECTED STEPS · REAL EXECUTION</div><h1>Workflow runs</h1><p>Codex works between your review checkpoints.</p></div>${workflowRunID?'<button id="workflow-history">All workflow runs</button>':''}</section><section id="workflow-view" class="codex-view"></section>`);
 if($('#workflow-history'))$('#workflow-history').onclick=()=>confirmLeave(()=>{workflowRunID=null;render();});
 workflowView=mountWorkflow({host:$('#workflow-view'),runID:workflowRunID,projectID,api,notify:toast,onOpen:id=>confirmLeave(()=>{workflowRunID=id;view='workflow';render();})});
}

function renderIssues(){
 shell(`<section class="page-heading"><div><div class="eyebrow">${esc(currentProject().name)}</div><h1>${issueProposalID?'Proposal diff':issueNumber?'Issue #'+issueNumber:'Issues'}</h1></div>${issueNumber&&!issueProposalID?`<button id="issue-mode-toggle">${issueEditMode?'Done editing':'Edit issue'}</button>`:''}</section><div id="issues-view"></div>`);
 if($('#issue-mode-toggle'))$('#issue-mode-toggle').onclick=()=>confirmLeave(()=>{issueEditMode=!issueEditMode;render();});
 issuesView=mountIssues({host:$('#issues-view'),project:currentProject(),number:issueNumber,proposalID:issueProposalID,editMode:issueEditMode,api,confirmLeave,onOpen:number=>confirmLeave(()=>{issueNumber=number;issueProposalID=null;issueEditMode=false;render();}),onProposal:id=>confirmLeave(()=>{issueProposalID=id;issueEditMode=false;render();}),onWork:terminalID=>confirmLeave(()=>{codexRunID=terminalID;codexPrefill='';view='codex';render();})});
}

let stepCatalog=null;
function bindStepModels(step){
 const host=$('#inspector'),alive=()=>host.isConnected&&selected===step.id;
 let models=[{id:step.model,name:step.model,efforts:['low','medium','high','max'],defaultEffort:'medium'}];
 const renderEffort=()=>{
  const m=models.find(m=>m.id===step.model),available=m?.efforts?.length?m.efforts:['low','medium','high','max'];
  const choices=available.includes(step.effort)?available:[...available,step.effort];
  const slider=host.querySelector('#step-effort');slider.max=choices.length-1;slider.value=choices.indexOf(step.effort);slider.disabled=choices.length<2;
  host.querySelector('#step-effort-value').textContent=step.effort;slider.setAttribute('aria-valuetext',step.effort);
  host.querySelector('#step-effort-ticks').innerHTML=choices.map(e=>`<span>${esc(e)}</span>`).join('');
  slider.oninput=()=>{step.effort=choices[Number(slider.value)];host.querySelector('#step-effort-value').textContent=step.effort;slider.setAttribute('aria-valuetext',step.effort);markDirty();updateCard(step);};
 };
 const renderModels=()=>{
  const choices=models.some(m=>m.id===step.model)?models:[{id:step.model,name:step.model+' (saved label)'},...models];
  host.querySelector('#step-models').innerHTML=choices.map(m=>`<label class="choice-pill"><input type="radio" name="step-model" value="${esc(m.id)}" ${m.id===step.model?'checked':''}><span>${esc(m.name||m.id)}</span></label>`).join('');
  host.querySelectorAll('[name="step-model"]').forEach(input=>input.onchange=()=>{step.model=input.value;const m=models.find(m=>m.id===step.model);if(m?.efforts?.length&&!m.efforts.includes(step.effort))step.effort=m.defaultEffort||m.efforts[0];host.querySelector('#model').value=step.model;markDirty();updateCard(step);renderEffort();});renderEffort();
 };
 host.querySelector('#model').oninput=e=>{step.model=e.target.value;markDirty();updateCard(step);renderModels();};renderModels();
 host.querySelector('#step-provider-note').textContent='Loading installed Codex models…';
 stepCatalog??=api('agents/codex').catch(e=>{stepCatalog=null;throw e;});
 stepCatalog.then(provider=>{if(!alive())return;models=provider.models;renderModels();host.querySelector('#step-provider-note').textContent='Codex workflow models. Availability is confirmed when a run starts. Saved labels stay unchanged until you select a model.';}).catch(e=>{if(alive())host.querySelector('#step-provider-note').textContent=e.message+' Saved model labels remain editable.';});
}
