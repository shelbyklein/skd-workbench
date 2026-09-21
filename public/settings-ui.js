const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let settings={version:1,accents:{light:'#bf502f',dark:'#ed9777'},hiddenModels:[]};
export function visibleModels(models,agent,selected){
 return models.filter(m=>m.id===selected||!m.legacyAlias&&!settings.hiddenModels.includes(agent+':'+m.id));
}
export async function loadSettings(api){
 settings=await api('settings');window.workbenchTheme?.setAccents(settings.accents);return settings;
}
export const settingsButton='<button type="button" class="refresh-button" data-global-settings aria-label="Global settings" title="Global settings"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round" aria-hidden="true"><path d="m9 3 1-2h4l1 2 1 2 3 1 2 3-1 3 1 3-2 3-3 1-1 2h-5l-1-2-3-1-2-3 1-3-1-3 2-3 3-1Z" transform="translate(1 1) scale(.9)"/><circle cx="12" cy="12" r="3.5"/></svg></button>';
export async function showInstructions(host,api,route){
 host.textContent='Loading instructions…';
 try{
  const result=await api(route);if(!host.isConnected)return;
  host.innerHTML='<p class="field-help">'+esc(result.note)+'</p>'+ (result.files.map(file=>'<details class="instruction-file"><summary>'+esc(file.name)+'</summary><pre>'+esc(file.content??file.error)+'</pre></details>').join('')||'<p>No instruction files found.</p>');
 }catch(e){if(host.isConnected)host.textContent=e.message;}
}
export async function openSettings({api,modal,onSaved}){
 let draft;
 try{draft=structuredClone(await loadSettings(api));}catch(e){modal('Global settings','<p>'+esc(e.message)+'</p>',[{label:'Close',close:true}]);return;}
 const groups=[['Preferences',[['appearance','Appearance']]],['Models',[['codex','Codex'],['claude','Claude']]],['Repository guidance',[['rules','Repository rules'],['references','Reference documents']]]];
 const guidance=(id,title,help)=>`<section data-settings-panel="${id}" hidden><div class="settings-section-heading"><h3>${title}</h3><span class="settings-readonly">Read only</span></div><p class="field-help">${help}</p><div id="settings-${id}" class="settings-documents">Loading documents…</div></section>`;
 modal('Global settings',`<section class="global-settings">
  <nav class="settings-menu" aria-label="Settings sections">${groups.map(([label,items])=>`<div class="settings-menu-group"><p>${label}</p>${items.map(([id,name])=>`<button type="button" data-settings-section="${id}" aria-controls="settings-panel-${id}" ${id==='appearance'?'aria-current="page"':''}>${name}</button>`).join('')}</div>`).join('')}</nav>
  <label class="settings-mobile-menu">Settings section<select id="settings-section" aria-label="Settings section">${groups.map(([label,items])=>`<optgroup label="${label}">${items.map(([id,name])=>`<option value="${id}">${name}</option>`).join('')}</optgroup>`).join('')}</select></label>
  <div class="settings-content" tabindex="0" role="region" aria-label="Settings content">
   <section data-settings-panel="appearance"><h3>Appearance</h3><p class="field-help">Accent colors apply across all projects.</p><h4>Accent colors</h4><div class="accent-settings"><label>Light mode<input type="color" name="light" value="${draft.accents.light}"></label><label>Dark mode<input type="color" name="dark" value="${draft.accents.dark}"></label></div></section>
   ${['codex','claude'].map(agent=>`<section data-settings-panel="${agent}" hidden><h3>${agent==='codex'?'Codex':'Claude'} models</h3><p class="field-help">Choose which models appear in selectors. Saved model selections remain available.</p><div id="settings-models-${agent}" class="settings-models">Loading models…</div></section>`).join('')}
   ${guidance('rules','Repository rules',"Guidance for developing Workbench. Each project's own files are available in its System page. Agent loading rules determine which files apply; viewing them here does not activate them.")}
   ${guidance('references','Reference documents','Feature plans and historical notes for Workbench. Repository rules may direct agents to consult relevant documents; a plan alone does not authorize new work.')}
  </div>
 </section>`,[{label:'Cancel',close:true},{label:'Save settings',submit:true,primary:true}],async form=>{
  draft.accents={light:form.get('light'),dark:form.get('dark')};
  settings=await api('settings','PUT',draft);window.workbenchTheme?.setAccents(settings.accents);onSaved();
 });
 const root=document.querySelector('.global-settings'),content=root.querySelector('.settings-content'),select=root.querySelector('#settings-section');
 root.querySelectorAll('[data-settings-panel]').forEach(panel=>panel.id='settings-panel-'+panel.dataset.settingsPanel);
 const activate=id=>{
  root.querySelectorAll('[data-settings-panel]').forEach(panel=>panel.hidden=panel.dataset.settingsPanel!==id);
  root.querySelectorAll('[data-settings-section]').forEach(button=>{if(button.dataset.settingsSection===id)button.setAttribute('aria-current','page');else button.removeAttribute('aria-current');});
  select.value=id;content.scrollTop=0;
 };
 root.querySelectorAll('[data-settings-section]').forEach(button=>button.onclick=()=>activate(button.dataset.settingsSection));
 select.onchange=()=>activate(select.value);
 loadGuidance(root,api);
 const results=await Promise.allSettled(['codex','claude'].map(agent=>api('terminal-agents/'+agent)));
 if(!root.isConnected)return;
 results.forEach((result,i)=>{
  const agent=['codex','claude'][i],section=root.querySelector('#settings-models-'+agent);section.replaceChildren();
  if(result.status==='rejected'){const p=document.createElement('p');p.textContent=result.reason.message;section.append(p);return;}
  const pills=document.createElement('div');pills.className='settings-model-list';section.append(pills);
  for(const model of result.value.models.filter(m=>!m.legacyAlias)){
   const key=agent+':'+model.id,b=document.createElement('button'),name=model.name||model.id;b.type='button';b.className='model-visibility';b.setAttribute('aria-label',name);b.innerHTML='<span>'+esc(name)+'</span><span class="model-visibility-state" aria-hidden="true"></span>';
   const update=()=>{const shown=!draft.hiddenModels.includes(key);b.setAttribute('aria-pressed',String(shown));b.title=(shown?'Hide ':'Show ')+name;b.lastElementChild.textContent=shown?'Shown':'Hidden';};update();
   b.onclick=()=>{draft.hiddenModels=draft.hiddenModels.includes(key)?draft.hiddenModels.filter(k=>k!==key):[...draft.hiddenModels,key];update();};pills.append(b);
  }
 });
}

async function loadGuidance(root,api){
 try{
  const result=await api('instructions');if(!root.isConnected)return;
  for(const group of ['rules','references']){
   const host=root.querySelector('#settings-'+group),files=result.files.filter(file=>file.name.startsWith('instructions/')===(group==='references')).sort((a,b)=>a.name.localeCompare(b.name));
   if(!files.length){host.textContent=group==='rules'?'No repository rule files found.':'No reference documents found.';continue;}
   host.innerHTML=`<label>${group==='rules'?'Rule file':'Reference document'}<select aria-label="${group==='rules'?'Rule file':'Reference document'}">${files.map((file,i)=>`<option value="${i}">${esc(file.name)}</option>`).join('')}</select></label><div class="settings-document-meta"><span class="settings-document-kind">${group==='rules'?'Repository rule':'Feature reference'}</span><span class="settings-document-status"></span></div><pre class="settings-document-preview"></pre>`;
   const show=()=>{
    const file=files[Number(host.querySelector('select').value)];
    host.querySelector('pre').textContent=file.content??file.error;
    const status=file.content?.match(/^Status:\s*(.+)$/mi)?.[1];
    const label=host.querySelector('.settings-document-status');label.textContent=status?'Status: '+status:'';label.hidden=!status;
    root.querySelector('.settings-content').scrollTop=0;
   };
   host.querySelector('select').onchange=show;show();
  }
 }catch(e){if(root.isConnected)for(const group of ['rules','references'])root.querySelector('#settings-'+group).textContent=e.message;}
}
