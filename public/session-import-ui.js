const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function openSessionImport({project,api,onSaved}){
 const dialog=document.querySelector('#dialog');let dirty=false,pending=false;const requestKey=crypto.randomUUID();
 dialog.dataset.sessionImport='true';
 dialog.innerHTML=`<form id="session-import-form"><div class="dialog-head"><h2>Import chat</h2><button type="button" class="icon-button" data-import-close aria-label="Close dialog">×</button></div><p class="field-help">Save a chat transcript in ${esc(project.name)}. Importing does not start an agent.</p><label>Title<input name="title" required maxlength="160" placeholder="e.g. Website planning" autofocus></label><label>Import from<select name="source"><option value="paste">Paste transcript</option><option value="file">Local file path</option></select></label><div data-import-paste><label>Transcript<textarea name="transcript" rows="10" placeholder="Paste your chat here (Ctrl+V or ⌘V)" spellcheck="false"></textarea></label></div><div data-import-file hidden><label>File path<input name="path" placeholder="/Users/you/Downloads/chat.md" spellcheck="false"></label></div><p class="field-help">UTF-8 text, Markdown, JSON or JSONL · up to 1 MiB. Saved as supplied, including any instructions and tool output.</p><p class="form-error" data-import-error role="alert"></p><div data-import-discard hidden><p>Discard this import draft?</p><button type="button" data-import-keep>Keep editing</button><button type="button" data-import-discard-confirm>Discard draft</button></div><div class="dialog-actions"><button type="button" data-import-close>Cancel</button><button type="submit" class="primary">Import chat</button></div></form>`;
 const form=dialog.querySelector('form'),error=dialog.querySelector('[data-import-error]');
 const close=()=>{if(pending){error.textContent='Wait for the import to finish.';return;}if(dirty){dialog.querySelector('[data-import-discard]').hidden=false;dialog.querySelector('[data-import-keep]').focus();}else dialog.close();};
 dialog.oncancel=e=>{e.preventDefault();close();};
 dialog.onclose=()=>{if(dialog.open)return;delete dialog.dataset.sessionImport;dialog.oncancel=null;dialog.onclose=null;};
 dialog.querySelectorAll('[data-import-close]').forEach(b=>b.onclick=close);
 dialog.querySelector('[data-import-keep]').onclick=()=>{dialog.querySelector('[data-import-discard]').hidden=true;form.elements.title.focus();};
 dialog.querySelector('[data-import-discard-confirm]').onclick=()=>{if(!pending)dialog.close();};
 form.oninput=()=>{dirty=true;};
 form.elements.source.onchange=()=>{dialog.querySelector('[data-import-paste]').hidden=form.elements.source.value!=='paste';dialog.querySelector('[data-import-file]').hidden=form.elements.source.value!=='file';};
 form.onsubmit=async event=>{
  event.preventDefault();if(pending)return;error.textContent='';const source=form.elements.source.value;
  const input={projectID:project.id,projectVersion:project.version,requestKey,title:form.elements.title.value,source,...(source==='paste'?{transcript:form.elements.transcript.value}:{path:form.elements.path.value})};
  if(source==='paste'&&new TextEncoder().encode(input.transcript).length>1024*1024){error.textContent='Transcript exceeds 1 MiB. Import a smaller text export.';return;}
  pending=true;form.querySelectorAll('button,input,textarea,select').forEach(el=>el.disabled=true);
  try{const saved=await api('session-imports','POST',input);dirty=false;delete dialog.dataset.sessionImport;dialog.close();onSaved(saved);}
  catch(e){error.textContent=e.message;}
  finally{pending=false;form.querySelectorAll('button,input,textarea,select').forEach(el=>el.disabled=false);}
 };
 dialog.showModal();form.elements.title.focus();
}

export function renderImportedSession({host,record,onContinue,notify}){
 host.innerHTML=`<section class="codex-card imported-session"><div class="codex-heading"><div><span class="eyebrow">IMPORTED CHAT</span><h2>${esc(record.task)}</h2></div><div class="resource-actions"><button type="button" data-import-copy>Copy transcript</button><button type="button" data-import-continue>Use as context</button></div></div><p class="field-help">Imported ${esc(new Date(record.createdAt).toLocaleString())} · ${record.source.kind==='file'?esc(record.source.name):'Pasted transcript'}. Execution, completion and usage are unknown.</p><p class="field-help">Use as context opens a new session setup. You choose what to do next before starting the agent.</p><p data-import-detail-error class="form-error" role="alert"></p><h3>Transcript</h3><pre class="codex-output imported-transcript" tabindex="0"></pre></section>`;
 host.querySelector('pre').textContent=record.transcript;
 host.querySelector('[data-import-copy]').onclick=async()=>{try{await navigator.clipboard.writeText(record.transcript);notify?.('Transcript copied.');}catch{host.querySelector('[data-import-detail-error]').textContent='Clipboard unavailable. Select and copy the transcript below.';}};
 host.querySelector('[data-import-continue]').onclick=()=>onContinue({importedSessionID:record.id,importedTitle:record.task});
}
