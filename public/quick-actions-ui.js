import {agentCard} from './agent-card.js';
import {visibleModels} from './settings-ui.js';
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const actions=[
 ['reconcile','Reconcile to main','Start a CLI session to merge pending work into local main and sync it with remote main.','<circle cx="6" cy="5" r="2"/><circle cx="6" cy="19" r="2"/><circle cx="18" cy="5" r="2"/><path d="M6 7v10M18 7v2a6 6 0 0 1-6 6H6"/>'],
 ['collaborate','New collaboration session','Open a new CLI session using your saved agent, model, and settings.','<path d="m4 7 4 4-4 4m8 0h4M17 4v6m-3-3h6"/><path d="M20 14v5H2V3h9"/>'],
 ['suggest','Suggest what to do next','Open a CLI session to review this project and recommend the next steps.','<path d="M9 18h6m-5 3h4M8 14a7 7 0 1 1 8 0c-1 1-1 2-1 2H9s0-1-1-2Z"/>']
];
export function mountQuickActions(host,{project,api,confirmLeave,onOpen}){
 let state=null,busy=false;
 host.className='project-quick-actions';host.setAttribute('aria-label','Quick actions');
 host.innerHTML=actions.map(([id,title,description,icon])=>`<button type="button" class="project-quick-action" data-quick-action="${id}" disabled><span class="quick-action-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icon}</svg></span><span class="quick-action-copy"><strong>${title}</strong><span>${description}</span></span><span class="quick-action-arrow" aria-hidden="true">↗</span></button>`).join('')+'<div class="quick-action-footer"><span data-quick-settings-summary>Loading settings…</span><button type="button" class="text-button" data-quick-settings disabled>Settings</button></div><p class="form-error" role="alert" data-quick-error></p>';
 const error=message=>{if(host.isConnected)host.querySelector('[data-quick-error]').textContent=message;};
 function render(){if(!host.isConnected)return;host.querySelector('[data-quick-settings-summary]').textContent=state?.settings?`${state.settings.agent==='claude'?'Claude':'Codex'} · ${state.settings.model} · ${state.settings.effort}`:'Choose settings on first launch';host.querySelectorAll('button').forEach(b=>b.disabled=busy||!state||!project.folderPath);if(project.benchmark)host.querySelectorAll('[data-quick-action="suggest"],[data-quick-action="reconcile"]').forEach(b=>{b.disabled=true;b.title='Unavailable for reset-after-run benchmarks';});}
 async function refresh(){state=await api(`projects/${project.id}/quick-actions`);render();}
 async function launch(action){
  if(busy||!host.isConnected)return;if(!state.settings){await settings(action);return;}
  busy=true;render();error('');const key=`skd-quick-launch:${project.id}:${action}`;let request;
  try{try{request=JSON.parse(sessionStorage.getItem(key));}catch{}if(!request){request={action,revision:state.revision,requestKey:crypto.randomUUID()};try{sessionStorage.setItem(key,JSON.stringify(request));}catch{}}
   const result=await api(`projects/${project.id}/quick-actions`,'POST',request);
   if(result.terminalID){try{sessionStorage.removeItem(key);}catch{}if(host.isConnected)onOpen(result.terminalID);}
   else{try{sessionStorage.removeItem(key);}catch{}throw Error(result.error||'Launch interrupted. Inspect Sessions before starting a new action.');}
  }catch(e){
   try{const recovered=await api(`projects/${project.id}/quick-actions/requests/${request.requestKey}`);
    if(recovered?.terminalID){try{sessionStorage.removeItem(key);}catch{}if(host.isConnected)onOpen(recovered.terminalID);return;}
    if(!recovered||['failed','interrupted'].includes(recovered.status)){try{sessionStorage.removeItem(key);}catch{}}
    error(recovered?.error||e.message);
   }catch{error(e.message+' Check Sessions before retrying. This action will recover the same launch.');}
  }
  finally{busy=false;render();}
 }
 async function settings(action=null){
  if(busy)return;busy=true;render();error('');
  const dialog=document.querySelector('#dialog');let providers=[],library,request=0,selected=state.settings;
  dialog.innerHTML=`<form><div class="dialog-head"><h2>Quick action settings</h2><button type="button" class="icon-button" data-close aria-label="Close dialog">×</button></div><p>Saved for ${esc(project.name)}. Suggestions and reconciliation use no MCP connections. Native CLI permission prompts still apply.</p><label for="quick-agent">Agent</label><select id="quick-agent" name="agent"><option value="codex">Codex</option><option value="claude">Claude</option></select><label for="quick-model">Model</label><select id="quick-model" name="model"></select><label for="quick-effort">Effort</label><select id="quick-effort" name="effort"></select><label for="quick-playbook">Playbook</label><select id="quick-playbook" name="playbook"></select><p class="form-error" role="alert" data-settings-error></p><div class="dialog-actions"><button type="button" class="text-button" data-reset>Reset settings</button><button type="button" data-close>Cancel</button><button type="submit" class="primary" disabled>${action?'Save and start':'Save settings'}</button></div></form>`;
  const form=dialog.querySelector('form'),agent=form.elements.agent,model=form.elements.model,effort=form.elements.effort,playbook=form.elements.playbook,submit=form.querySelector('[type="submit"]'),err=form.querySelector('[data-settings-error]');agent.value=selected?.agent||'codex';
  // Keep provider validation and form values in this form; reuse the shared selector presentation.
  const groups={};
  for(const [key,select] of Object.entries({agent,model,effort})){
   const label=form.querySelector('label[for="'+select.id+'"]'),wrapper=document.createElement('fieldset');wrapper.className='pill-field';label.before(wrapper);
   const legend=document.createElement('legend');legend.textContent=label.textContent;wrapper.append(legend,select);label.remove();select.hidden=true;select.style.display='none';
   const options=document.createElement('div');options.className='pill-options';wrapper.append(options);groups[key]={wrapper,options,select};
  }
  const selector=agentCard({agentNodes:[groups.agent.wrapper],modelNodes:[groups.model.wrapper],effortNodes:[groups.effort.wrapper],seed:{},cacheKey:'quick-actions-'+project.id});
  function syncSelector(){
   for(const [key,{options,select}] of Object.entries(groups)){
    const signature=JSON.stringify([...select.options].filter(o=>o.value).map(o=>[o.value,o.textContent]));
    if(options.dataset.signature!==signature){options.dataset.signature=signature;options.innerHTML=[...select.options].filter(o=>o.value).map(o=>'<label class="choice-pill"><input type="radio" name="quick-choice-'+key+'" value="'+esc(o.value)+'"><span>'+esc(o.textContent)+'</span></label>').join('');}
    options.querySelectorAll('input').forEach(input=>input.checked=input.value===select.value);
    options.querySelectorAll('input').forEach(input=>input.onchange=()=>{select.value=input.value;select.dispatchEvent(new Event('change',{bubbles:true}));syncSelector();});
   }
   selector.acceptCurrent();
  }
  const close=()=>{dialog.close();busy=false;render();};dialog.querySelectorAll('[data-close]').forEach(b=>b.onclick=close);dialog.addEventListener('close',()=>{busy=false;render();},{once:true});
  function effortOptions(){const row=providers.find(m=>m.id===model.value);effort.innerHTML=(row?.efforts||[]).map(v=>`<option>${esc(v)}</option>`).join('');effort.value=row?.efforts.includes(selected?.effort)?selected.effort:row?.defaultEffort||row?.efforts[0]||'';submit.disabled=!model.value||!effort.value;syncSelector();}
  async function load(){const id=++request;submit.disabled=true;model.innerHTML='';effort.innerHTML='';syncSelector();err.textContent='';try{const [provider,books]=await Promise.all([api('terminal-agents/'+agent.value),api(`playbooks?scope=project&projectID=${encodeURIComponent(project.id)}`)]);if(id!==request||!dialog.open)return;library=books;providers=visibleModels(provider.models,agent.value,selected?.model);model.innerHTML=providers.map(m=>`<option value="${esc(m.id)}">${esc(m.name||m.id)}</option>`).join('');if(selected?.agent===agent.value&&selected.model){if(!providers.some(m=>m.id===selected.model)){model.insertAdjacentHTML('afterbegin',`<option value="" selected>Saved model unavailable — choose a model</option>`);err.textContent='Saved model is unavailable. Choose another model explicitly.';}else model.value=selected.model;}else model.value=(providers.find(m=>m.isDefault)||providers[0])?.id||'';playbook.innerHTML='<option value="inherit">Project default</option><option value="legacy">Legacy project defaults</option>'+(library.entries||[]).filter(p=>!p.archived&&p.providers.includes(agent.value)).map(p=>`<option value="${esc(p.id)}">${esc(p.name)}</option>`).join('');const old=selected?.playbook?.mode==='selected'?selected.playbook.playbookID:selected?.playbook?.mode||'inherit';if([...playbook.options].some(o=>o.value===old))playbook.value=old;else{playbook.insertAdjacentHTML('afterbegin','<option value="" selected>Saved playbook unavailable — choose a playbook</option>');err.textContent='Saved playbook is unavailable. Choose another playbook explicitly.';}effortOptions();if(selected?.agent===agent.value&&model.value===selected.model&&!providers.find(m=>m.id===model.value)?.efforts.includes(selected.effort)){effort.insertAdjacentHTML('afterbegin','<option value="" selected>Saved effort unavailable — choose an effort</option>');submit.disabled=true;syncSelector();}}catch(e){if(id===request)err.textContent=e.message;}}
  agent.onchange=()=>{selected=null;load();};model.onchange=()=>{selected=null;effortOptions();};effort.onchange=()=>{submit.disabled=!model.value||!effort.value;};
  form.querySelector('[data-reset]').onclick=async()=>{submit.disabled=true;try{state=await api(`projects/${project.id}/quick-actions`,'PUT',{revision:state.revision,reset:true});selected=null;agent.value='codex';await load();render();}catch(e){err.textContent=e.message;}};
  form.onsubmit=async e=>{e.preventDefault();if(submit.disabled)return;submit.disabled=true;try{if(!playbook.value)throw Error('Choose an available playbook.');state=await api(`projects/${project.id}/quick-actions`,'PUT',{revision:state.revision,settings:{agent:agent.value,model:model.value,effort:effort.value,playbook:['inherit','legacy'].includes(playbook.value)?{mode:playbook.value}:{mode:'selected',playbookID:playbook.value}}});close();if(action)await launch(action);}catch(e){err.textContent=e.message;submit.disabled=false;}};
  dialog.showModal();await load();
 }
 host.querySelectorAll('[data-quick-action]').forEach(b=>b.onclick=()=>confirmLeave(()=>launch(b.dataset.quickAction)));
 host.querySelector('[data-quick-settings]').onclick=()=>confirmLeave(()=>settings());refresh().catch(e=>error(e.message));
 return {isPending:()=>busy};
}
