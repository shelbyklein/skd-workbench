const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const day=date=>new Date(date+'T12:00:00Z').toLocaleDateString(undefined,{weekday:'short',month:'short',day:'numeric',timeZone:'UTC'});
const time=value=>value?new Date(value).toLocaleTimeString(undefined,{hour:'numeric',minute:'2-digit'}):'';
const labels={absent:'Not generated','evidence-only':'Facts only',queued:'Waiting for agent',generating:'Generating',ready:'Ready',failed:'Failed',interrupted:'Interrupted',cancelled:'Cancelled',unavailable:'Agent unavailable'};
const kindLabels={session:'Session',terminal:'Session',imported:'Imported chat',workflow:'Workflow',delegation:'Delegation',commit:'Commit',issue:'Issue'};
const coverageLabels={session:'Sessions',terminal:'Terminal sessions',imported:'Imported chats',workflow:'Workflows',delegation:'Delegations',commits:'Commits',issues:'Open issues'},FACT_LIMIT=8;
const busy=status=>['queued','generating'].includes(status);
const pref=(key,value)=>{try{if(value===undefined)return localStorage.getItem('skd-briefing-'+key);localStorage.setItem('skd-briefing-'+key,value);}catch{}return null;};
export function localYesterday(now=new Date()){const d=new Date(now);d.setDate(d.getDate()-1);return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;}

function sourceIndex(report){const index=new Map();for(const item of [...(report?.evidence?.activity||[]),...(report?.evidence?.openLoops||[]),...(report?.evidence?.issues||[])])index.set(item.id,item);return index;}
function sourceLinks(ids,index){
 return ids.map(id=>{const item=index.get(id);if(!item)return '';const label=item.kind==='commit'?`Commit ${esc(item.recordID.slice(0,7))}`:item.kind==='issue'?`#${esc(item.recordID)}`:esc(kindLabels[item.kind]||item.kind);
  return ['session','terminal','imported','issue'].includes(item.kind)?`<button type="button" class="briefing-source" data-source="${esc(id)}">${label}</button>`:`<span class="briefing-source">${label}</span>`;}).join('');
}
function factList(items,empty){
 if(!items.length)return `<p class="widget-empty">${esc(empty)}</p>`;
 const row=item=>`<li><span class="briefing-kind">${esc(kindLabels[item.kind]||item.kind)}</span><span>${esc(item.title)}${item.partial?' <small>(spans the day boundary)</small>':''}</span>${item.kind==='commit'?'':`<small>${esc(item.status)}</small>`}</li>`;
 const rest=items.slice(FACT_LIMIT);
 return `<ul class="briefing-list">${items.slice(0,FACT_LIMIT).map(row).join('')}</ul>${rest.length?`<details class="briefing-more"><summary>Show ${rest.length} more</summary><ul class="briefing-list">${rest.map(row).join('')}</ul></details>`:''}`;
}
function synthesisList(items,index,empty){
 if(!items.length)return `<p class="widget-empty">${esc(empty)}</p>`;
 return `<ul class="briefing-list">${items.map(item=>`<li><span>${esc(item.text)}</span><span class="briefing-sources">${sourceLinks(item.sourceIDs,index)}</span></li>`).join('')}</ul>`;
}
function coverage(report){
 const rows=Object.entries(report.evidence.coverage||{}),gaps=rows.filter(([,c])=>c.status!=='complete');
 return `<details class="briefing-coverage"><summary>Sources${gaps.length?` · ${gaps.length} incomplete`:''}</summary><ul>${rows.map(([name,c])=>`<li><span>${esc(coverageLabels[name]||name)}</span><span class="coverage-${esc(c.status)}">${esc(c.status)}${c.reason?` — ${esc(c.reason)}`:''}</span></li>`).join('')}</ul></details>`;
}
function reportBody(report){
 const index=sourceIndex(report),s=report.synthesis;
 const suggestions=s?(s.suggestions.length?`<ol class="briefing-suggestions">${s.suggestions.map(item=>`<li><strong>${esc(item.title)}</strong><span>${esc(item.reason)}</span><span class="briefing-sources">${sourceLinks(item.sourceIDs,index)}</span></li>`).join('')}</ol>`:'<p class="widget-empty">No suggestions.</p>'):`<p class="widget-empty">${report.status==='evidence-only'&&report.error?esc(report.error):'Generate with an agent to get suggestions.'}</p>`;
 return `<div class="briefing-grid"><section><h3>Yesterday</h3>${s?synthesisList(s.yesterday,index,'No observed work.'):factList(report.evidence.activity,'No observed work.')}</section><section><h3>Open loops</h3>${s?synthesisList(s.openLoops,index,'No open loops.'):factList(report.evidence.openLoops,'No open loops.')}</section><section class="briefing-today"><h3>Suggested today</h3>${suggestions}</section></div>${coverage(report)}`;
}

// Project overview widget. Reading never starts inference; Generate is explicit.
export function mountProjectBriefing(host,{project,api,onSession,onIssue}){
 let view=null,timer=null,catalog=null,agent=pref('agent')||'codex';
 host.classList.add('briefing-widget');
 const alive=()=>host.isConnected;
 async function load(){
  clearTimeout(timer);
  try{view=await api(`projects/${project.id}/briefing`);if(!alive())return;render();if(busy(view.status))timer=setTimeout(load,2000);}
  catch(error){if(alive())host.innerHTML=`<header><div><span class="eyebrow">DAILY BRIEFING</span><h2>Daily briefing</h2></div></header><p class="widget-empty" role="alert">${esc(error.message)}</p>`;}
 }
 async function models(){
  const select=host.querySelector('#briefing-model'),effort=host.querySelector('#briefing-effort');if(!select)return;
  select.innerHTML='<option>Loading…</option>';select.disabled=true;effort.disabled=true;
  try{catalog=await api('terminal-agents/'+agent);if(!alive())return;const saved=pref('model:'+agent),chosen=catalog.models.find(m=>m.id===saved)||catalog.models.find(m=>m.isDefault)||catalog.models[0];
   select.innerHTML=catalog.models.map(m=>`<option value="${esc(m.id)}" ${m.id===chosen?.id?'selected':''}>${esc(m.name||m.id)}</option>`).join('');select.disabled=false;efforts();}
  catch(error){if(alive()){select.innerHTML='<option value="">Unavailable</option>';host.querySelector('#briefing-error').textContent=error.message;}}
 }
 function efforts(){
  const select=host.querySelector('#briefing-effort'),model=catalog?.models.find(m=>m.id===host.querySelector('#briefing-model').value);if(!model)return;
  const saved=pref('effort'),chosen=model.efforts.includes(saved)?saved:model.defaultEffort&&model.efforts.includes(model.defaultEffort)?model.defaultEffort:model.efforts[0];
  select.innerHTML=model.efforts.map(e=>`<option value="${esc(e)}" ${e===chosen?'selected':''}>${esc(e)}</option>`).join('');select.disabled=false;
 }
 async function generate(synthesize){
  const button=host.querySelector(synthesize?'#briefing-generate':'#briefing-facts'),error=host.querySelector('#briefing-error');error.textContent='';button.disabled=true;
  const input=synthesize?{synthesize:true,agent,model:host.querySelector('#briefing-model').value,effort:host.querySelector('#briefing-effort').value}:{};
  if(synthesize){pref('agent',agent);pref('model:'+agent,input.model);pref('effort',input.effort);}
  try{view=await api(`projects/${project.id}/briefing`,'POST',input);if(!alive())return;render();if(busy(view.status))timer=setTimeout(load,2000);host.querySelector('#briefing-status')?.focus();}
  catch(e){if(alive()){button.disabled=false;error.textContent=e.message;}}
 }
 function render(){
  const report=view.latest,shown=!report?null:report.synthesis||!view.lastSuccessful?.synthesis?report:view.lastSuccessful;
  const notice=view.lastSuccessful&&['failed','interrupted','cancelled','unavailable'].includes(view.status)?`<p class="briefing-notice" role="status">Revision ${view.latest.revision} ${esc(labels[view.status].toLowerCase())}: ${esc(view.latest.error||'')} Revision ${view.lastSuccessful.revision} is still available.</p>`:report?.error&&!report.synthesis&&report.status!=='evidence-only'?`<p class="briefing-notice" role="status">${esc(report.error)}</p>`:'';
  host.innerHTML=`<header><div><span class="eyebrow">DAILY BRIEFING</span><h2>${esc(day(view.date))}</h2></div><span id="briefing-status" tabindex="-1" class="briefing-state briefing-state-${esc(view.status)}">${esc(labels[view.status]||view.status)}${report?` · rev ${report.revision} · ${esc(time(report.updatedAt))}`:''}</span></header>
   ${notice}${shown?reportBody(shown):`<p class="widget-empty">No briefing for ${esc(day(view.date))}.</p>`}
   <form class="briefing-controls" id="briefing-form"><label>Agent<select id="briefing-agent">${['codex','claude'].map(a=>`<option value="${a}" ${a===agent?'selected':''}>${a==='codex'?'Codex':'Claude'}</option>`).join('')}</select></label><label>Model<select id="briefing-model"></select></label><label>Effort<select id="briefing-effort"></select></label>
   <div class="briefing-actions"><button type="button" class="text-button" id="briefing-facts" ${busy(view.status)?'disabled':''}>Collect facts</button><button type="submit" class="primary" id="briefing-generate" ${busy(view.status)?'disabled':''}>${report?'Regenerate':'Generate'}</button></div><p class="field-error" id="briefing-error" role="alert"></p></form>
   <p class="field-help">Generate runs one tool-free agent task and uses provider usage. It waits while another agent task is running.</p>`;
  host.querySelector('#briefing-agent').onchange=e=>{agent=e.target.value;models();};
  host.querySelector('#briefing-model').onchange=efforts;
  host.querySelector('#briefing-form').onsubmit=e=>{e.preventDefault();generate(true);};
  host.querySelector('#briefing-facts').onclick=()=>generate(false);
  const index=sourceIndex(shown);
  host.querySelectorAll('[data-source]').forEach(button=>button.onclick=()=>{const item=index.get(button.dataset.source);if(item.kind==='issue')onIssue(Number(item.recordID));else onSession(item.recordID);});
  models();
 }
 load();
 return {dispose(){clearTimeout(timer);},reload:load};
}

// Home panel: aggregates each project's latest report without starting inference.
export async function mountHomeBriefings(host,{projects,api,onProject}){
 host.innerHTML='<div class="overview-section-heading"><h2>Daily briefing</h2></div><p class="widget-empty">Loading briefings…</p>';
 let rows,schedule;
 try{[rows,schedule]=await Promise.all([api('briefings'),api('briefings/schedule')]);}catch(error){if(host.isConnected)host.innerHTML=`<div class="overview-section-heading"><h2>Daily briefing</h2></div><p class="widget-empty" role="alert">${esc(error.message)}</p>`;return;}
 if(!host.isConnected)return;
 const names=new Map(projects.map(p=>[p.id,p.name])),yesterday=localYesterday(),present=rows.filter(r=>names.has(r.projectID));
 const summary=r=>{const b=r.briefing;if(!b)return null;const report=b.latest.synthesis||!b.lastSuccessful?.synthesis?b.latest:b.lastSuccessful;return {...b,report};};
 // Rank across projects by each project's own order: every first suggestion before any second.
 const seen=new Set(),suggestions=[];
 for(let rank=0;rank<3;rank++)for(const row of present){
  const b=summary(row),s=b?.report.synthesis?.suggestions?.[rank];if(!s||b.date<yesterday)continue;
  const index=sourceIndex(b.report),issue=s.sourceIDs.map(id=>index.get(id)).find(item=>item?.kind==='issue'&&item.url);
  if(issue){if(seen.has(issue.url))continue;seen.add(issue.url);}
  const sources=s.sourceIDs.map(id=>index.get(id)).filter(Boolean);
  const group=sources.some(item=>(['failed','interrupted','blocked','unavailable'].includes(item.status)||(item.kind==='delegation'&&item.status==='waiting')))?'attention':sources.some(item=>item.kind==='workflow'&&['waiting','checking'].includes(item.status))?'review':'next';
  suggestions.push({...s,projectID:row.projectID,group,sources,report:b.report,fallback:b.report.id!==b.latest.id});
 }
 const status=b=>!b?'absent':b.date<yesterday?'stale':b.status;
 const statusLabel=b=>!b?'Not generated':b.date<yesterday?`Stale · ${day(b.date)}`:labels[b.status]||b.status;
 const groups=[['attention','Needs attention'],['review','Ready for review'],['next','Suggested next']];
 const card=s=>`<article class="briefing-action-card"><span class="briefing-card-project">${esc(names.get(s.projectID))}</span><h4>${esc(s.title)}</h4><p>${esc(s.reason)}</p><div class="briefing-card-evidence">${esc([...new Set(s.sources.map(item=>kindLabels[item.kind]||item.kind))].join(' · ')||'Briefing sources')} · ${esc(time(s.report.evidence.collectedAt||s.report.updatedAt))}${s.fallback?' · Previous summary':''}${Object.values(s.report.evidence.coverage||{}).some(c=>c.status!=='complete')?' · Sources incomplete':''}</div><button type="button" class="text-button" data-briefing-project="${esc(s.projectID)}" aria-label="View evidence for ${esc(s.title)}">View evidence <span aria-hidden="true">›</span></button></article>`;
 host.innerHTML=`<div class="overview-section-heading"><h2>Daily briefing</h2><span class="briefing-home-date">Based on ${esc(day(yesterday))}</span></div><div class="briefing-action-board">
 ${groups.map(([key,label])=>{const items=suggestions.filter(s=>s.group===key);return `<section class="briefing-action-column briefing-action-${key}" aria-label="${label}"><header><h3>${label}</h3><span class="briefing-column-count">${items.length}</span></header><div class="briefing-action-items">${items.slice(0,3).map(card).join('')||`<p class="widget-empty">${key==='review'?'No suggestions cite a pending review gate.':key==='attention'?'No suggestions cite a failure or blocker.':'No suggestions yet. Open a project to generate its briefing.'}</p>`}</div>${items.length>3?`<details class="briefing-action-more"><summary>Show ${items.length-3} more</summary><div class="briefing-action-items">${items.slice(3).map(card).join('')}</div></details>`:''}</section>`;}).join('')}
 </div><details class="briefing-home-coverage"><summary>View coverage · ${present.length} ${present.length===1?'project':'projects'}</summary><p class="field-help">Groups reflect cited records in saved briefings, not a live readiness assessment.</p><ul class="briefing-project-list">${present.map(r=>{const b=r.briefing,e=b?.latest.evidence;return `<li><button type="button" class="briefing-home-link" data-briefing-project="${esc(r.projectID)}"><strong>${esc(names.get(r.projectID))}</strong><span class="briefing-state briefing-state-${esc(status(b))}">${esc(status(b)==='ready'?'Summary available':status(b)==='evidence-only'?'No summary generated':statusLabel(b))}</span>${e?`<small>${e.activity.length} activity records · ${e.openLoops.length} unresolved runs · ${e.issues?.length||0} issues${Object.values(e.coverage).some(c=>c.status!=='complete')?' · Sources incomplete':''}</small>`:''}</button></li>`;}).join('')||'<li class="widget-empty">No projects.</li>'}</ul></details>`;
 host.querySelectorAll("[data-briefing-project]").forEach(button=>button.onclick=()=>onProject(button.dataset.briefingProject));
 const scheduleHost=document.createElement('details');scheduleHost.className='briefing-schedule';host.append(scheduleHost);mountSchedule(scheduleHost,{api,schedule});
}
const scheduleSummary=s=>s.enabled?`Schedule: daily at ${s.time} (${s.timezone||s.serverTimezone})`:'Schedule: off';
function mountSchedule(host,{api,schedule}){
 let catalog=null;
 const render=()=>{host.innerHTML=`<summary>${esc(scheduleSummary(schedule))}</summary><form class="briefing-controls" id="schedule-form"><label class="briefing-check"><input type="checkbox" id="schedule-enabled" ${schedule.enabled?'checked':''}> Generate daily</label><label>Time<input type="time" id="schedule-time" value="${esc(schedule.time)}" required></label><label>Timezone<input id="schedule-timezone" value="${esc(schedule.timezone||'')}" placeholder="${esc(schedule.serverTimezone)}" autocomplete="off" spellcheck="false"></label><label>Agent<select id="schedule-agent">${['codex','claude'].map(a=>`<option value="${a}" ${a===schedule.agent?'selected':''}>${a==='codex'?'Codex':'Claude'}</option>`).join('')}</select></label><label>Model<select id="schedule-model"></select></label><label>Effort<select id="schedule-effort"></select></label><div class="briefing-actions"><button type="submit" class="primary" id="schedule-save">Save schedule</button></div><p class="field-error" id="schedule-error" role="alert"></p></form><p class="field-help">Runs only while SKD Workbench is running. Missed days are not generated later. Each project with activity uses one agent task, one at a time, after your own agent work.</p>`;
  const agent=host.querySelector('#schedule-agent'),model=host.querySelector('#schedule-model'),effort=host.querySelector('#schedule-effort');
  const efforts=()=>{const m=catalog?.models.find(x=>x.id===model.value);if(!m)return;const chosen=m.efforts.includes(schedule.effort)?schedule.effort:m.efforts[0];effort.innerHTML=m.efforts.map(e=>`<option value="${esc(e)}" ${e===chosen?'selected':''}>${esc(e)}</option>`).join('');};
  const models=async()=>{model.innerHTML='<option value="">Loading…</option>';effort.innerHTML='';try{catalog=await api('terminal-agents/'+agent.value);if(!host.isConnected)return;const chosen=catalog.models.find(m=>m.id===schedule.model)||catalog.models.find(m=>m.isDefault)||catalog.models[0];model.innerHTML=catalog.models.map(m=>`<option value="${esc(m.id)}" ${m.id===chosen?.id?'selected':''}>${esc(m.name||m.id)}</option>`).join('');efforts();}catch(e){if(host.isConnected){model.innerHTML='<option value="">Unavailable</option>';host.querySelector('#schedule-error').textContent=e.message;}}};
  agent.onchange=models;model.onchange=efforts;models();
  host.querySelector('#schedule-form').onsubmit=async e=>{e.preventDefault();const error=host.querySelector('#schedule-error'),button=host.querySelector('#schedule-save');error.textContent='';button.disabled=true;
   try{schedule=await api('briefings/schedule','PUT',{version:schedule.version,enabled:host.querySelector('#schedule-enabled').checked,time:host.querySelector('#schedule-time').value,timezone:host.querySelector('#schedule-timezone').value.trim()||null,agent:agent.value,model:model.value||null,effort:effort.value||null});if(!host.isConnected)return;render();host.open=true;host.querySelector('summary').focus();}
   catch(err){if(host.isConnected){error.textContent=err.message;button.disabled=false;}}};
 };
 render();
}
