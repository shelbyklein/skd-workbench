const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

export function openWorkspaceTask({project,worktree,snapshot,api,onChanged=()=>{},onSession=()=>{}}){
 const opener=document.activeElement,route='projects/'+encodeURIComponent(project.id)+'/workspace-tasks',dialog=document.createElement('dialog'),titleID='workspace-task-'+crypto.randomUUID();
 const capturedProject={id:project.id,version:project.version,folderPath:project.folderPath};
 let disposed=false,dirty=false,pending=false,preview=null,request=null;
 dialog.className='workspace-task-dialog';dialog.setAttribute('aria-labelledby',titleID);dialog.style.overflowWrap='anywhere';
 dialog.innerHTML=`<h2 id="${titleID}">Workspace task</h2><div data-body><p role="status">Checking workspace…</p></div><p data-error class="form-error" role="alert"></p><div class="dialog-actions"><button type="button" data-close>Close</button></div>`;
 document.body.append(dialog);dialog.showModal();
 const current=()=>!disposed&&dialog.isConnected&&project.id===capturedProject.id&&project.version===capturedProject.version&&project.folderPath===capturedProject.folderPath;
 const error=e=>{if(current())dialog.querySelector('[data-error]').textContent=e.message||String(e);};
 function close(force=false){if(pending&&!force)return;if(dirty&&!force&&!window.confirm('Discard the workspace task changes?'))return;disposed=true;dialog.close();dialog.remove();if(opener?.isConnected)opener.focus();}
 dialog.querySelector('[data-close]').onclick=()=>close();dialog.addEventListener('cancel',event=>{event.preventDefault();close();});
 const beforeUnload=event=>{if(dirty||pending){event.preventDefault();event.returnValue='';}};window.addEventListener('beforeunload',beforeUnload);dialog.addEventListener('close',()=>window.removeEventListener('beforeunload',beforeUnload),{once:true});
 function render(){
  const continuation=Boolean(preview.taskID),original=Boolean(preview.originalTask),registered=Boolean(preview.registrationID),recovery=!continuation&&preview.recoveryRequestKey&&preview.recoveryRequest,fixedPurpose=continuation||original||(registered&&Boolean(preview.purpose))||Boolean(recovery),fixedAcceptance=continuation||original||Boolean(preview.acceptance)||Boolean(recovery);
  dialog.querySelector('[data-body]').innerHTML=`<dl><dt>Workspace</dt><dd>${esc(preview.path)}</dd><dt>Branch</dt><dd>${esc(preview.branch)}</dd><dt>Changes</dt><dd>${preview.dirty?'Uncommitted changes will be retained':'Clean'}</dd></dl><form><label>${continuation||original?'Original task':'Task purpose'}<textarea name="purpose" aria-label="${continuation||original?'Original task':'Task purpose'}" rows="3" maxlength="240" ${fixedPurpose?'readonly':'required'}>${esc(preview.originalTask||recovery?.purpose||preview.purpose)}</textarea></label><label>Work reference<input name="workRef" maxlength="500" value="${esc(recovery?.workRef??preview.workRef)}" ${registered||continuation||recovery?'readonly':''} placeholder="Optional issue URL or task reference"></label><label>${fixedAcceptance?'Original acceptance checks':'Acceptance checks'}<textarea name="acceptance" aria-label="${fixedAcceptance?'Original acceptance checks':'Acceptance checks'}" rows="3" maxlength="12000" ${fixedAcceptance?'readonly':'required'}>${esc(preview.acceptance||recovery?.acceptance)}</textarea></label>${continuation?'<label>Provider<select name="agent" aria-label="Provider" disabled><option>Loading providers…</option></select></label><label>Model<select name="model" aria-label="Model" required disabled></select></label><label>Effort<select name="effort" aria-label="Effort" required disabled></select></label><label>Next instruction<textarea name="task" rows="3" maxlength="12000" required></textarea></label>':''}<label><input type="checkbox" name="confirmOwnership" required style="display:inline-block;width:auto;margin-right:8px">I confirm no other agent or person is writing here, and I accept the current workspace changes.</label><p>${continuation?'Continue task starts an agent in this existing workspace. Original acceptance checks stay unchanged.':'Adopt workspace saves task ownership and acceptance checks. It does not start an agent or change Git files.'}</p><button class="primary" type="submit" ${continuation?'disabled':''}>${continuation?'Continue task':'Adopt workspace'}</button></form>`;
  const form=dialog.querySelector('form'),field=name=>form.elements.namedItem(name),submit=form.querySelector('[type="submit"]');
  form.addEventListener('input',()=>{dirty=true;request=null;});form.addEventListener('change',()=>{dirty=true;request=null;});
  if(continuation)providers(form).catch(error);
  form.onsubmit=async event=>{
   event.preventDefault();if(pending||!current()||!form.reportValidity())return;
   pending=true;submit.disabled=true;dialog.querySelector('[data-close]').disabled=true;dialog.querySelector('[data-error]').textContent='';
   request??={previewID:preview.id,requestKey:recovery?preview.recoveryRequestKey:crypto.randomUUID(),confirmOwnership:field('confirmOwnership').checked,...(continuation?{agent:field('agent').value,model:field('model').value,effort:field('effort').value,task:field('task').value}:recovery?{purpose:recovery.purpose,workRef:recovery.workRef,acceptance:recovery.acceptance}:{purpose:preview.purpose&&registered?preview.purpose:field('purpose').value,workRef:field('workRef').value,acceptance:field('acceptance').value})};
   const enabled=[...form.elements].filter(element=>!element.disabled);enabled.forEach(element=>element.disabled=true);
   try{
    const result=await api(route+(continuation?'/continue':'/adopt'),'POST',request);
    if(!current())return;
    dirty=false;pending=false;close(true);onChanged();if(continuation)onSession(result.sessionID);
   }catch(e){error(e);}finally{pending=false;if(current()){enabled.forEach(element=>element.disabled=false);submit.disabled=false;dialog.querySelector('[data-close]').disabled=false;}}
  };
  field(continuation?'task':fixedPurpose?'confirmOwnership':'purpose').focus();
 }
 async function providers(form){
  const responses=await Promise.allSettled([api('agents/codex'),api('agents/claude')]);if(!current())return;
  const catalogs=Object.fromEntries(['codex','claude'].map((agent,i)=>[agent,responses[i].status==='fulfilled'?responses[i].value:null]));
  const agent=form.elements.namedItem('agent'),model=form.elements.namedItem('model'),effort=form.elements.namedItem('effort'),submit=form.querySelector('[type="submit"]');
  const available=Object.keys(catalogs).filter(key=>catalogs[key]?.models?.length);
  if(!available.length){agent.innerHTML='<option>No providers available</option>';throw Error('No provider models are available. Check provider setup, then close and reopen this workspace.');}
  agent.innerHTML=available.map(key=>`<option value="${key}">${key==='codex'?'Codex':'Claude'}</option>`).join('');
  function efforts(){const selected=catalogs[agent.value].models.find(row=>row.id===model.value);effort.innerHTML=(selected?.efforts||[]).map(value=>`<option value="${esc(value)}" ${value===selected.defaultEffort?'selected':''}>${esc(value)}</option>`).join('');submit.disabled=!model.value||!effort.value;}
  function models(){const rows=catalogs[agent.value].models,preferred=rows.find(row=>row.isDefault)||rows[0];model.innerHTML=rows.map(row=>`<option value="${esc(row.id)}" ${row===preferred?'selected':''}>${esc(row.name||row.id)}</option>`).join('');efforts();}
  agent.disabled=model.disabled=effort.disabled=false;agent.onchange=models;model.onchange=efforts;models();
 }
 (async()=>{try{preview=await api(route+'/preview','POST',{snapshotID:snapshot.snapshotID,projectVersion:project.version,worktreeID:worktree.id});if(current())render();}catch(e){if(current())dialog.querySelector('[data-body]').innerHTML='<p>Workspace could not be verified. Close this dialog, refresh local Git status, and inspect the reported condition before trying again.</p>';error(e);}})();
 return {isDirty:()=>dirty,isPending:()=>pending,dispose(){close(true);}};
}
