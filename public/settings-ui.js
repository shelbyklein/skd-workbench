import {controllerSettings} from './controllers-ui.js';
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let settings={version:1,accents:{light:'#bf502f',dark:'#ed9777'},hiddenModels:[]};
export const projectTags=()=>settings.projectTags||[];
export function tagMarkup(tag){
 const color=/^#[0-9a-f]{6}$/i.test(tag.color||'')?tag.color:'#bf502f';
 const rgb=[1,3,5].map(i=>parseInt(color.slice(i,i+2),16)/255).map(c=>c<=.04045?c/12.92:((c+.055)/1.055)**2.4);
 const luminance=.2126*rgb[0]+.7152*rgb[1]+.0722*rgb[2];
 return `<span class="project-tag" style="background:${color};color:${luminance>.179?'#000000':'#ffffff'}">${esc(tag.name)}</span>`;
}
export async function openProjectTags({api,modal,project,onSaved}){
 let draft;try{draft=structuredClone(await loadSettings(api));}catch(e){modal('Project tags','<p>'+esc(e.message)+'</p>',[{label:'Close',close:true}]);return;}
 modal('Tags · '+project.name,`<div class="tag-project-list">${draft.projectTags.map(tag=>`<label><input type="checkbox" name="tag" value="${esc(tag.id)}" ${tag.projectIDs.includes(project.id)?'checked':''}>${tagMarkup(tag)}</label>`).join('')||'<p>No tags. Create tags in Global settings → Project tags.</p>'}</div>`,[{label:'Cancel',close:true},{label:'Save tags',submit:true,primary:true}],async form=>{
  const selected=new Set(form.getAll('tag'));
  draft.projectTags=draft.projectTags.map(tag=>({...tag,projectIDs:[...tag.projectIDs.filter(id=>id!==project.id),...(selected.has(tag.id)?[project.id]:[])]}));
  settings=await api('settings','PUT',draft);onSaved();
 });
}
export function visibleModels(models,agent,selected){
 return models.filter(m=>m.id===selected||!m.legacyAlias&&!settings.hiddenModels.includes(agent+':'+m.id));
}
export async function loadSettings(api){
 settings=await api('settings');window.workbenchTheme?.setAccents(settings.accents);window.workbenchTheme?.setPrimary(settings.primaryColor);return settings;
}
export const settingsButton='<button type="button" class="refresh-button" data-global-settings aria-label="Global settings" title="Global settings"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round" aria-hidden="true"><path d="m9 3 1-2h4l1 2 1 2 3 1 2 3-1 3 1 3-2 3-3 1-1 2h-5l-1-2-3-1-2-3 1-3-1-3 2-3 3-1Z" transform="translate(1 1) scale(.9)"/><circle cx="12" cy="12" r="3.5"/></svg></button>';
export async function showInstructions(host,api,route){
 host.textContent='Loading instructions…';
 try{
  const result=await api(route);if(!host.isConnected)return;
  host.innerHTML='<p class="field-help">'+esc(result.note)+'</p>'+ (result.files.map(file=>'<details class="instruction-file"><summary>'+esc(file.name)+'</summary><pre>'+esc(file.content??file.error)+'</pre></details>').join('')||'<p>No instruction files found.</p>');
 }catch(e){if(host.isConnected)host.textContent=e.message;}
}
export async function openSettings({api,modal,onSaved,projects=[],section='appearance'}){
 let draft;
 try{draft=structuredClone(await loadSettings(api));}catch(e){modal('Global settings','<p>'+esc(e.message)+'</p>',[{label:'Close',close:true}]);return;}
 const groups=[['Preferences',[['appearance','Appearance'],['startup','Startup'],['tags','Project tags'],['controllers','Agent control (MCP)']]],['Models',[['codex','Codex'],['claude','Claude']]],['Repository guidance',[['rules','Repository rules'],['references','Reference documents']]]];
 const guidance=(id,title,help)=>`<section data-settings-panel="${id}" hidden><div class="settings-section-heading"><h3>${title}</h3><span class="settings-readonly">Read only</span></div><p class="field-help">${help}</p><div id="settings-${id}" class="settings-documents">Loading documents…</div></section>`;
 modal('Global settings',`<section class="global-settings">
  <nav class="settings-menu" aria-label="Settings sections">${groups.map(([label,items])=>`<div class="settings-menu-group"><p>${label}</p>${items.map(([id,name])=>`<button type="button" data-settings-section="${id}" aria-controls="settings-panel-${id}" ${id==='appearance'?'aria-current="page"':''}>${name}</button>`).join('')}</div>`).join('')}</nav>
  <label class="settings-mobile-menu">Settings section<select id="settings-section" aria-label="Settings section">${groups.map(([label,items])=>`<optgroup label="${label}">${items.map(([id,name])=>`<option value="${id}">${name}</option>`).join('')}</optgroup>`).join('')}</select></label>
  <div class="settings-content" tabindex="0" role="region" aria-label="Settings content">
   <section data-settings-panel="appearance"><h3>Appearance</h3><p class="field-help">Colors apply across all projects.</p><label>Primary color<input type="color" name="primaryColor" value="${draft.primaryColor||'#315b74'}"></label><p class="field-help">Tints surfaces, borders, and the sidebar. Light and dark shades keep text readable.</p><h4>Accent colors</h4><div class="accent-settings"><label>Light mode<input type="color" name="light" value="${draft.accents.light}"></label><label>Dark mode<input type="color" name="dark" value="${draft.accents.dark}"></label></div></section>
   <section data-settings-panel="startup" hidden><h3>Startup</h3><div id="settings-startup">Loading…</div></section>
   <section data-settings-panel="controllers" hidden><div id="settings-controllers">Loading controllers…</div></section>
   <section data-settings-panel="tags" hidden><h3>Project tags</h3><p class="field-help">Projects can have multiple tags. Deleting a tag removes it from all projects when you save.</p><div id="settings-tags"></div><button type="button" id="add-project-tag">Add tag</button></section>
   ${['codex','claude'].map(agent=>`<section data-settings-panel="${agent}" hidden><h3>${agent==='codex'?'Codex':'Claude'} models</h3><p class="field-help">Choose which models appear in selectors. Saved model selections remain available.</p><div id="settings-models-${agent}" class="settings-models">Loading models…</div></section>`).join('')}
   ${guidance('rules','Repository rules',"Guidance for developing Workbench. Each project's own files are available in its System page. Agent loading rules determine which files apply; viewing them here does not activate them.")}
   ${guidance('references','Reference documents','Feature plans and historical notes for Workbench. Repository rules may direct agents to consult relevant documents; a plan alone does not authorize new work.')}
  </div>
 </section>`,[{label:'Cancel',close:true},{label:'Save settings',submit:true,primary:true}],async form=>{
  draft.primaryColor=form.get('primaryColor');
  draft.accents={light:form.get('light'),dark:form.get('dark')};
  settings=await api('settings','PUT',draft);window.workbenchTheme?.setAccents(settings.accents);window.workbenchTheme?.setPrimary(settings.primaryColor);onSaved();
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
 activate(section);
 draft.projectTags??=[];
 const tagHost=root.querySelector('#settings-tags');
 const renderTags=()=>{
  tagHost.innerHTML=draft.projectTags.map((tag,index)=>`<fieldset class="tag-editor" data-tag-id="${esc(tag.id)}"><legend>Tag ${index+1}</legend><div class="tag-editor-heading"><label>Tag name<input data-tag-name maxlength="50" value="${esc(tag.name)}" aria-label="Tag ${index+1} name"></label><label class="tag-color-label">Color<input type="color" data-tag-color aria-label="Tag ${index+1} color" value="${esc(tag.color||'#bf502f')}"></label><button type="button" data-delete-tag aria-label="Delete tag ${index+1}">Delete</button></div><details><summary>Projects (${tag.projectIDs.length})</summary><div class="tag-project-list">${projects.filter(p=>p.id!=='unassigned').map(p=>`<label><input type="checkbox" data-tag-project="${esc(p.id)}" ${tag.projectIDs.includes(p.id)?'checked':''}>${esc(p.name)}</label>`).join('')||'<p>No projects. Add a project from Home.</p>'}</div></details></fieldset>`).join('')||'<p class="field-help">No tags. Add a tag to categorize projects.</p>';
  tagHost.querySelectorAll('[data-tag-id]').forEach(row=>{
   const tag=draft.projectTags.find(t=>t.id===row.dataset.tagId);
   row.querySelector('[data-tag-name]').oninput=e=>tag.name=e.target.value;
   row.querySelector('[data-tag-color]').oninput=e=>tag.color=e.target.value;
   row.querySelector('[data-delete-tag]').onclick=()=>{const index=draft.projectTags.indexOf(tag);draft.projectTags.splice(index,1);renderTags();(tagHost.querySelectorAll('[data-tag-name]')[Math.min(index,draft.projectTags.length-1)]||root.querySelector('#add-project-tag')).focus();};
   row.querySelectorAll('[data-tag-project]').forEach(input=>input.onchange=()=>{tag.projectIDs=[...row.querySelectorAll('[data-tag-project]:checked')].map(el=>el.dataset.tagProject);row.querySelector('summary').textContent=`Projects (${tag.projectIDs.length})`;});
  });
  root.querySelector('#add-project-tag').disabled=draft.projectTags.length>=100;
 };
 root.querySelector('#add-project-tag').onclick=()=>{draft.projectTags.push({id:crypto.randomUUID(),name:'',color:'#bf502f',projectIDs:[]});renderTags();tagHost.querySelectorAll('[data-tag-name]')[draft.projectTags.length-1].focus();};
 renderTags();
 api('launcher').then(status=>{const host=root.querySelector('#settings-startup');if(!host?.isConnected)return;host.innerHTML=status.installed?'<label class="briefing-check"><input type="checkbox" id="start-at-login" '+(status.startAtLogin?'checked':'')+'> Start Workbench at login</label><p class="field-help">Applies immediately to the next login. Does not restart the running server.</p><p role="status" id="startup-status"></p>':'<p>Install the Mac launcher with <code>npm run launcher:install</code> in the Workbench folder.</p>';const toggle=host.querySelector('input');if(toggle)toggle.onchange=async()=>{toggle.disabled=true;try{await api('launcher','PUT',{startAtLogin:toggle.checked});host.querySelector('#startup-status').textContent='Startup preference saved.';}catch(e){toggle.checked=!toggle.checked;host.querySelector('#startup-status').textContent=e.message;}finally{toggle.disabled=false;}};}).catch(e=>{const host=root.querySelector('#settings-startup');if(host)host.textContent=e.message;});
 controllerSettings(root.querySelector('#settings-controllers'),api,projects);
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
