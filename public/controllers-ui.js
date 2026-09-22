const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export async function controllerSettings(host,api,projects){
 let data;
 const render=()=>{
  if(!host.isConnected)return;
  host.innerHTML=`<h3>Agent control (MCP)</h3><p class="field-help">Connect an external agent to the running Workbench. Access applies to the selected projects. Running workflows is a separate permission.</p>
   <p class="field-help">Changes here apply immediately. These grants do not sandbox an agent that already has access to your local files and shell.</p>
   <div class="controller-create"><label>Controller name<input data-controller-name maxlength="80" placeholder="My coding agent"></label>
   <fieldset><legend>Projects</legend>${projects.filter(p=>p.folderPath).map(p=>`<label><input type="checkbox" data-controller-project value="${esc(p.id)}"> ${esc(p.name)}</label>`).join('')||'<p>No connected projects. Add a project first.</p>'}</fieldset>
   <fieldset><legend>Capabilities</legend><label><input type="checkbox" checked disabled> Read projects and runs</label><label><input type="checkbox" data-controller-manage checked> Create and edit workflows</label><label><input type="checkbox" data-controller-run> Run and stop owned workflows</label></fieldset>
   <button type="button" data-controller-create>Enable controller</button></div><p data-controller-error role="status"></p>
   <div class="controller-list">${data.controllers.map(c=>`<details class="instruction-file"><summary>${esc(c.name)} · ${c.revoked?'Revoked':'Enabled'}</summary><p>${esc(c.capabilities.join(', '))} · ${esc(c.projectIDs.map(id=>projects.find(p=>p.id===id)?.name||id).join(', '))}</p><p>Last used: ${esc(c.lastUsedAt||'Never')}</p>${c.lastError?`<p>${esc(c.lastError)}</p>`:''}${!c.revoked?`<p class="field-help">Add this server to your MCP client configuration, then reconnect the client. Workbench must be running. The private credential stays in the referenced file.</p><pre>${esc(JSON.stringify({mcpServers:{'skd-workbench':{command:data.nodePath,args:[data.bridgePath,c.credentialPath]}}},null,2))}</pre><button type="button" data-controller-revoke="${esc(c.id)}" data-version="${c.version}">Revoke ${esc(c.name)}</button>`:''}</details>`).join('')||'<p>No controllers enabled.</p>'}</div>
   <details><summary>Recent operations</summary>${data.operations.slice().reverse().slice(0,20).map(o=>`<p>${esc(data.controllers.find(c=>c.id===o.controllerID)?.name||o.controllerID)} · ${esc(o.status)} ${o.runID?`· <a target="_blank" rel="noopener" href="#workflow/${esc(o.projectID)}/${esc(o.runID)}">Open run</a>`:o.flowID?`· <a target="_blank" rel="noopener" href="#flow/${esc(o.flowID)}">Open workflow</a>`:''}${o.error?` · ${esc(o.error)}`:''}</p>`).join('')||'<p>No operations.</p>'}</details><details><summary>Recent controller activity</summary>${data.receipts.slice().reverse().slice(0,20).map(r=>`<p>${esc(data.controllers.find(c=>c.id===r.controllerID)?.name||r.controllerID)} · ${esc(r.tool)} · ${esc(r.status)} · ${esc(r.at)}</p>`).join('')||'<p>No activity.</p>'}</details><button type="button" class="text-button" data-controller-refresh>Refresh status</button>`;
  const error=host.querySelector('[data-controller-error]');
  host.querySelector('[data-controller-create]').onclick=async e=>{e.currentTarget.disabled=true;try{
   await api('controllers','POST',{name:host.querySelector('[data-controller-name]').value,projectIDs:[...host.querySelectorAll('[data-controller-project]:checked')].map(el=>el.value),capabilities:['read',...(host.querySelector('[data-controller-manage]').checked?['manage']:[]),...(host.querySelector('[data-controller-run]').checked?['run']:[])]});await refresh();host.querySelector('.controller-list details:last-child')?.setAttribute('open','');
  }catch(err){error.textContent=err.message;e.target.disabled=false;}};
  host.querySelectorAll('[data-controller-revoke]').forEach(button=>button.onclick=async()=>{button.disabled=true;try{await api('controllers/'+button.dataset.controllerRevoke+'/revoke','POST',{version:Number(button.dataset.version)});await refresh();}catch(err){error.textContent=err.message;button.disabled=false;}});
  host.querySelector('[data-controller-refresh]').onclick=refresh;
 };
 const refresh=async()=>{try{data=await api('controllers');render();}catch(e){host.textContent=e.message;}};
 await refresh();
}
