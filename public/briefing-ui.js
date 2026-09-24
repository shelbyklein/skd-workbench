// Briefing: for each project, a written account of the last 24 hours, or what to work on next when nothing happened.
// Reading never starts inference; Update (or the daily schedule) does.
const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const DAY=86400000;
const busy=status=>['queued','generating'].includes(status);
const failed=['failed','interrupted','cancelled','unavailable'];
const kindNames={commit:['commit','commits'],session:['session','sessions'],terminal:['terminal session','terminal sessions'],imported:['imported chat','imported chats'],workflow:['workflow','workflows'],delegation:['delegation','delegations']};

// The report to show: the newest one with a written summary, unless nothing newer has one.
const shownReport=view=>!view?.latest?null:view.latest.synthesis||!view.lastSuccessful?.synthesis?view.latest:view.lastSuccessful;
const when=value=>{const d=new Date(value),today=new Date().toDateString()===d.toDateString();return today?d.toLocaleTimeString(undefined,{hour:'numeric',minute:'2-digit'}):d.toLocaleDateString(undefined,{month:'short',day:'numeric'})+', '+d.toLocaleTimeString(undefined,{hour:'numeric',minute:'2-digit'});};
function counts(activity){const n={};for(const a of activity)n[a.kind]=(n[a.kind]||0)+1;const order=Object.keys(kindNames);return Object.entries(n).sort(([a],[b])=>order.indexOf(a)-order.indexOf(b)).map(([k,c])=>`${c} ${(kindNames[k]||[k,k+'s'])[c===1?0:1]}`).join(' · ');}
// Older reports stored a list of updates instead of a summary.
const summaryText=s=>typeof s?.summary==='string'?s.summary:(s?.yesterday||[]).map(i=>i.text).join(' ');

function issueFor(report,ids){const index=new Map([...(report.evidence.issues||[])].map(i=>[i.id,i]));return ids.map(id=>index.get(id)).find(Boolean);}
function bodyMarkup(view){
 const report=shownReport(view);
 if(!report)return `<p class="briefing-empty">No summary yet. Update to write one.</p>`;
 const e=report.evidence,quiet=!e.activity.length,s=report.synthesis,parts=[];
 if(!quiet){
  const text=summaryText(s);
  if(text)parts.push(`<p class="briefing-summary">${esc(text)}</p>`);
  parts.push(`<p class="briefing-counts">${esc(counts(e.activity))}${e.openLoops.length?` · ${e.openLoops.length} unfinished`:''}</p>`);
  if(!text)parts.push(`<p class="briefing-empty">Update to write a summary.</p>`);
 }else{
  parts.push(`<p class="briefing-quiet">Nothing happened in the last 24 hours.</p>`);
  if(s?.suggestions?.length)parts.push(`<h3 class="briefing-next-heading">Work on next</h3><ol class="briefing-next">${s.suggestions.map(item=>{const issue=issueFor(report,item.sourceIDs||[]);return `<li><strong>${esc(item.title)}</strong><span>${esc(item.reason)}</span>${issue?`<button type="button" class="briefing-source" data-issue="${esc(issue.recordID)}">#${esc(issue.recordID)}</button>`:''}</li>`;}).join('')}</ol>`);
  else if(s)parts.push(`<p class="briefing-empty">No open issues or unfinished work to suggest from.</p>`);
  else parts.push(`<p class="briefing-empty">Update to get suggestions for what to work on next.</p>`);
 }
 return parts.join('');
}
function metaMarkup(view){
 if(busy(view?.status))return `<span class="briefing-meta briefing-working" role="status">Writing summary…</span>`;
 const report=shownReport(view);if(!report)return '';
 const end=Date.parse(report.evidence.interval?.end||report.updatedAt),stale=Date.now()-end>DAY;
 const problem=failed.includes(view.status)?` · <span class="briefing-problem" title="${esc(view.latest.error||'')}">last update ${esc(view.status)}</span>`:'';
 return `<span class="briefing-meta${stale?' briefing-stale':''}">Updated ${esc(when(report.updatedAt))}${stale?' · out of date':''}${problem}</span>`;
}
function cardMarkup(project,view,{link=true}={}){
 return `<article class="briefing-card" data-briefing-card="${esc(project.id)}"><header>${link?`<button type="button" class="briefing-card-name" data-briefing-project="${esc(project.id)}">${esc(project.name)}</button>`:`<h2 class="briefing-card-name">Last 24 hours</h2>`}${metaMarkup(view)}<button type="button" class="text-button briefing-update" data-briefing-update="${esc(project.id)}" ${busy(view?.status)?'disabled':''}>Update</button></header>${bodyMarkup(view)}</article>`;
}

// Agent, model and effort come from the briefing settings; a model left unset uses the CLI's default.
async function generation(api){
 const schedule=await api('briefings/schedule');let {agent,model,effort}=schedule;
 if(!model||!effort){const catalog=await api('terminal-agents/'+agent),m=catalog.models.find(x=>x.id===model)||catalog.models.find(x=>x.isDefault)||catalog.models[0];if(!m)throw new Error('No model is available for the briefing.');model=m.id;effort=m.efforts.includes(effort)?effort:m.defaultEffort&&m.efforts.includes(m.defaultEffort)?m.defaultEffort:m.efforts[0];}
 return {synthesize:true,agent,model,effort};
}

// Project page: this project's card.
export function mountProjectBriefing(host,{project,api,onIssue}){
 let view=null,timer=null;host.classList.add('briefing-widget');
 const alive=()=>host.isConnected;
 async function load(){clearTimeout(timer);try{view=await api(`projects/${project.id}/briefing`);if(!alive())return;render();if(busy(view.status))timer=setTimeout(load,2000);}catch(error){if(alive())host.innerHTML=`<p class="widget-empty" role="alert">${esc(error.message)}</p>`;}}
 function render(){
  host.innerHTML=cardMarkup(project,view,{link:false})+'<p class="field-error" role="alert"></p>';
  host.querySelector('[data-briefing-update]').onclick=async e=>{const error=host.querySelector('.field-error');e.target.disabled=true;error.textContent='';try{view=await api(`projects/${project.id}/briefing`,'POST',await generation(api));if(!alive())return;render();if(busy(view.status))timer=setTimeout(load,2000);}catch(err){if(alive()){e.target.disabled=false;error.textContent=err.message;}}};
  host.querySelectorAll('[data-issue]').forEach(b=>b.onclick=()=>onIssue(Number(b.dataset.issue)));
 }
 load();
 return {dispose(){clearTimeout(timer);},reload:load};
}

// Briefing page: one card per project, Update all, and the settings with the daily schedule.
export async function mountHomeBriefings(host,{projects,api,onProject,onIssue}){
 let rows=[],timer=null;const views=new Map(),names=new Map(projects.map(p=>[p.id,p]));
 host.innerHTML=`<div class="briefing-toolbar"><button type="button" class="primary" id="briefing-update-all">Update all</button><p class="field-error" id="briefing-error" role="alert"></p></div><div class="briefing-cards" id="briefing-cards"><p class="widget-empty">Loading…</p></div>`;
 const cards=host.querySelector('#briefing-cards'),error=host.querySelector('#briefing-error');
 const alive=()=>host.isConnected;
 function render(){
  const list=projects.filter(p=>names.has(p.id));
  cards.innerHTML=list.map(p=>cardMarkup(p,views.get(p.id))).join('')||'<p class="widget-empty">No projects.</p>';
  cards.querySelectorAll('[data-briefing-project]').forEach(b=>b.onclick=()=>onProject(b.dataset.briefingProject));
  cards.querySelectorAll('[data-briefing-update]').forEach(b=>b.onclick=()=>update([b.dataset.briefingUpdate]));
  cards.querySelectorAll('[data-issue]').forEach(b=>b.onclick=()=>onIssue?.(b.closest('[data-briefing-card]').dataset.briefingCard,Number(b.dataset.issue)));
  host.querySelector('#briefing-update-all').disabled=[...views.values()].some(v=>busy(v?.status));
 }
 async function load(){
  clearTimeout(timer);
  try{rows=await api('briefings');if(!alive())return;for(const r of rows)views.set(r.projectID,r.briefing);render();if(rows.some(r=>busy(r.briefing?.status)))timer=setTimeout(load,2000);}
  catch(e){if(alive())cards.innerHTML=`<p class="widget-empty" role="alert">${esc(e.message)}</p>`;}
 }
 async function update(ids){
  error.textContent='';host.querySelectorAll('[data-briefing-update],#briefing-update-all').forEach(b=>b.disabled=true);
  try{const input=await generation(api);for(const id of ids){const view=await api(`projects/${id}/briefing`,'POST',input);if(!alive())return;views.set(id,view);render();}}
  catch(e){if(alive())error.textContent=e.message;}
  if(alive())load();
 }
 host.querySelector('#briefing-update-all').onclick=()=>update(projects.filter(p=>p.folderPath).map(p=>p.id));
 await load();
 if(!alive())return;
 try{const schedule=await api('briefings/schedule');if(!alive())return;const settings=document.createElement('details');settings.className='briefing-schedule';host.append(settings);mountSchedule(settings,{api,schedule});}
 catch(e){if(alive())error.textContent=e.message;}
 return {dispose(){clearTimeout(timer);}};
}
const scheduleSummary=s=>`Settings · ${s.enabled?`updates daily at ${s.time} (${s.timezone||s.serverTimezone})`:'daily update off'}`;
function mountSchedule(host,{api,schedule}){
 let catalog=null;
 const render=()=>{host.innerHTML=`<summary>${esc(scheduleSummary(schedule))}</summary><form class="briefing-controls" id="schedule-form"><label>Agent<select id="schedule-agent">${['codex','claude'].map(a=>`<option value="${a}" ${a===schedule.agent?'selected':''}>${a==='codex'?'Codex':'Claude'}</option>`).join('')}</select></label><label>Model<select id="schedule-model"></select></label><label>Effort<select id="schedule-effort"></select></label><label class="briefing-check"><input type="checkbox" id="schedule-enabled" ${schedule.enabled?'checked':''}> Update daily</label><label>Time<input type="time" id="schedule-time" value="${esc(schedule.time)}" required></label><label>Timezone<input id="schedule-timezone" value="${esc(schedule.timezone||'')}" placeholder="${esc(schedule.serverTimezone)}" autocomplete="off" spellcheck="false"></label><div class="briefing-actions"><button type="submit" class="primary" id="schedule-save">Save settings</button></div><p class="field-error" id="schedule-error" role="alert"></p></form><p class="field-help">Update and the daily update use this agent and model. Each project uses one agent task, one at a time, after your own agent work. The daily update runs only while SKD Workbench is running; missed days are skipped.</p>`;
  const agent=host.querySelector('#schedule-agent'),model=host.querySelector('#schedule-model'),effort=host.querySelector('#schedule-effort');
  const efforts=()=>{const m=catalog?.models.find(x=>x.id===model.value);if(!m)return;const chosen=m.efforts.includes(schedule.effort)?schedule.effort:m.defaultEffort&&m.efforts.includes(m.defaultEffort)?m.defaultEffort:m.efforts[0];effort.innerHTML=m.efforts.map(e=>`<option value="${esc(e)}" ${e===chosen?'selected':''}>${esc(e)}</option>`).join('');};
  const models=async()=>{model.innerHTML='<option value="">Loading…</option>';effort.innerHTML='';try{catalog=await api('terminal-agents/'+agent.value);if(!host.isConnected)return;const chosen=catalog.models.find(m=>m.id===schedule.model)||catalog.models.find(m=>m.isDefault)||catalog.models[0];model.innerHTML=catalog.models.map(m=>`<option value="${esc(m.id)}" ${m.id===chosen?.id?'selected':''}>${esc(m.name||m.id)}</option>`).join('');efforts();}catch(e){if(host.isConnected){model.innerHTML='<option value="">Unavailable</option>';host.querySelector('#schedule-error').textContent=e.message;}}};
  agent.onchange=models;model.onchange=efforts;models();
  host.querySelector('#schedule-form').onsubmit=async e=>{e.preventDefault();const error=host.querySelector('#schedule-error'),button=host.querySelector('#schedule-save');error.textContent='';button.disabled=true;
   try{schedule=await api('briefings/schedule','PUT',{version:schedule.version,enabled:host.querySelector('#schedule-enabled').checked,time:host.querySelector('#schedule-time').value,timezone:host.querySelector('#schedule-timezone').value.trim()||null,agent:agent.value,model:model.value||null,effort:effort.value||null});if(!host.isConnected)return;render();host.open=true;host.querySelector('summary').focus();}
   catch(err){if(host.isConnected){error.textContent=err.message;button.disabled=false;}}};
 };
 render();
}

// Home card line: the briefing's headline, at most two sentences. Briefings written before headlines existed
// fall back to the start of the summary, or to the first suggestion on a quiet day. Nothing older than two days.
const twoSentences=text=>(String(text).match(/[^.!?]+[.!?]+(\s|$)/g)||[text]).slice(0,2).join('').trim();
export function homeLine(view){
 const report=shownReport(view),s=report?.synthesis;if(!s)return null;
 if(Date.now()-Date.parse(report.evidence.interval?.end||report.updatedAt)>2*DAY)return null;
 if(s.headline)return twoSentences(s.headline);
 if(report.evidence.activity.length)return summaryText(s)?twoSentences(summaryText(s)):null;
 return s.suggestions?.[0]?`Quiet day. Next up: ${s.suggestions[0].title}.`:null;
}
