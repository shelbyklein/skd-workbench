// Project owner view: mandate, decisions, current work, next tasks, recent result and the project conversation.
// Everything shown is derived from canonical records; sending a message or saving a mandate starts nothing.
// With the coordinator on, messages are typed into a live Claude Code or Codex session shown in the CLI view.
import {mountTerminal} from './terminal-ui.js';
const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const drafts=new Map();
try{for(const [id,value] of Object.entries(JSON.parse(sessionStorage.getItem('skd-agent-drafts')||'{}')))if(value&&typeof value.text==='string')drafts.set(id,{text:value.text,key:typeof value.key==='string'?value.key:null});}catch{}
function saveDrafts(){try{sessionStorage.setItem('skd-agent-drafts',JSON.stringify(Object.fromEntries([...drafts].filter(([,d])=>d.text))));}catch{}}
export const agentDraft=projectID=>drafts.get(projectID)?.text||'';
const statusLabels={launching:'Starting',running:'Running',stopping:'Stopping',waiting:'Needs your review',checking:'Needs verification',failed:'Failed',interrupted:'Interrupted',completed:'Process completed',cancelled:'Stopped'};
const time=value=>{try{return new Date(value).toLocaleTimeString([],{hour:'numeric',minute:'2-digit'});}catch{return '';}};
const when=value=>{try{return new Date(value).toLocaleString([],{month:'short',day:'numeric',hour:'numeric',minute:'2-digit'});}catch{return '';}};
const issueNumber=ref=>Number(/#(\d+)$/.exec(ref)?.[1])||null;
function refButton(ref){const label=ref.kind==='project'?'Project':ref.kind==='issue'?'Issue #'+ref.id.replace(/^.*#/,''):ref.kind==='run'?'Run '+ref.id.slice(0,8):ref.kind[0].toUpperCase()+ref.kind.slice(1)+' '+ref.id.slice(0,8);return ['run','issue','project'].includes(ref.kind)?`<button type="button" class="agent-ref" data-agent-ref="${esc(ref.kind)}" data-ref-id="${esc(ref.id)}">${esc(label)}</button>`:`<span class="agent-ref">${esc(label)}</span>`;}
function progress(steps){return `<ol class="agent-steps" aria-label="Workflow steps">${steps.map(s=>`<li class="agent-step-${s.state}"><span class="agent-step-dot" aria-hidden="true"></span><span>${esc(s.name)}</span><span class="visually-hidden">${s.state==='done'?'done':s.state==='current'?'current step':'pending'}</span></li>`).join('')}</ol>`;}

// Shared conversation panel: one draft and request key per scope (project ID or coordinator).
// One compact header row: the title on the left; the Chat / CLI switch and a refresh icon on the right.
function threadAside(label,eyebrow,card,p='agent'){return `<aside class="agent-thread" aria-label="${label}"><header class="agent-thread-head"><div class="agent-thread-heading"><h2 id="${p}-thread-title"></h2><div class="agent-coordinator" id="${p}-coordinator"></div></div><div class="agent-thread-tools"><div id="${p}-view-switch" class="agent-view-switch-slot"></div><button type="button" class="icon-button thread-history" id="${p}-history" data-coordinator-history-open hidden><svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5M12 7v5l3 2"/></svg></button><button type="button" class="icon-button thread-refresh" id="${p}-refresh" aria-label="Refresh" title="Refresh"><svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M20 7v5h-5M4 17v-5h5"/><path d="M6.1 6.1A8 8 0 0 1 19.5 10M4.5 14a8 8 0 0 0 13.4 3.9"/></svg></button><span class="agent-settings-slot" id="${p}-settings"></span></div></header>
 <p class="agent-thread-status" id="${p}-thread-status"></p><ol class="agent-messages" id="${p}-messages" aria-live="polite"></ol><div class="agent-cli" id="${p}-cli" hidden><div id="${p}-cli-screen" class="agent-cli-screen"></div><p class="field-help agent-cli-empty" id="${p}-cli-empty"></p><div class="agent-cli-history" id="${p}-cli-history"></div></div>${card?'<button type="button" class="agent-mandate-card" id="'+p+'-mandate-card"></button>':''}<div class="agent-waiting-slot" id="${p}-waiting"></div>
 <form class="agent-composer" id="${p}-composer"><label for="${p}-message" id="${p}-message-label" class="visually-hidden">Message</label><div class="agent-composer-box" id="${p}-composer-box"><ul class="agent-attachments" id="${p}-attachments" aria-label="Attachments"></ul><textarea id="${p}-message" rows="2" maxlength="8000"></textarea><div class="agent-composer-bar"><button type="button" class="agent-attach" id="${p}-attach" aria-label="Attach files" title="Attach files (or paste / drop them)"><svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="m21 11-8.6 8.6a5.5 5.5 0 0 1-7.8-7.8l8.9-8.9a3.7 3.7 0 0 1 5.2 5.2l-8.9 8.9a1.8 1.8 0 0 1-2.6-2.6L15 6.6"/></svg></button><input type="file" id="${p}-attach-input" multiple hidden><span class="agent-composer-agent" id="${p}-composer-agent"></span><button type="submit" class="agent-send" id="${p}-send" aria-label="Send" title="Send (⌘↵)"><svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 19V5M6 11l6-6 6 6"/></svg></button></div></div><p class="field-help agent-composer-help" id="${p}-message-help"></p><p class="form-error" id="${p}-send-error" role="alert"></p></form></aside>`;}
// Attached files per conversation, kept with the draft until the message is sent.
const attachedFiles=new Map();
const fileSize=n=>n<1024?n+' B':n<1048576?Math.round(n/1024)+' KB':(n/1048576).toFixed(1)+' MB';
async function uploadAttachment(file){
 const name=file.name&&file.name!=='image.png'?file.name:`pasted-${new Date().toISOString().replace(/[:.]/g,'-')}.${(file.type.split('/')[1]||'bin').replace(/[^a-z0-9]/g,'')}`;
 const response=await fetch('/api/attachments',{method:'POST',headers:{'Content-Type':'application/octet-stream','X-File-Name':encodeURIComponent(name)},body:file});
 const result=await response.json().catch(()=>({error:'Upload failed.'}));if(!response.ok)throw new Error(result.error||'Upload failed.');return result;
}
function bindComposer(host,{key,send,sent,p='agent'}){
 const q=s=>host.querySelector(s),input=q('#'+p+'-message');let sending=false,uploading=0;
 input.value=drafts.get(key)?.text||'';
 const files=()=>attachedFiles.get(key)||[];
 const renderFiles=()=>{q('#'+p+'-attachments').innerHTML=files().map((f,i)=>`<li class="agent-attachment"><span title="${esc(f.path)}">${esc(f.name)}</span><small>${esc(fileSize(f.size))}</small><button type="button" class="icon-button" data-remove-attachment="${i}" aria-label="Remove ${esc(f.name)}">×</button></li>`).join('')+(uploading?`<li class="agent-attachment agent-attachment-pending">Uploading ${uploading} file${uploading>1?'s':''}…</li>`:'');};
 async function attach(list){
  const picked=[...list];if(!picked.length)return;uploading+=picked.length;renderFiles();q('#'+p+'-send-error').textContent='';
  for(const file of picked){try{const saved=await uploadAttachment(file);attachedFiles.set(key,[...files(),saved]);}catch(error){q('#'+p+'-send-error').textContent=`${file.name||'File'}: ${error.message}`;}finally{uploading--;if(host.isConnected)renderFiles();}}
 }
 renderFiles();
 q('#'+p+'-attach').onclick=()=>q('#'+p+'-attach-input').click();
 q('#'+p+'-attach-input').onchange=e=>{attach(e.target.files);e.target.value='';};
 q('#'+p+'-attachments').onclick=e=>{const b=e.target.closest('[data-remove-attachment]');if(!b)return;const next=files().slice();next.splice(Number(b.dataset.removeAttachment),1);attachedFiles.set(key,next);renderFiles();input.focus();};
 // Pasted files (screenshots included) attach; pasted text goes into the box as usual.
 input.addEventListener('paste',e=>{const list=[...(e.clipboardData?.files||[])];if(!list.length)return;if(!e.clipboardData.getData('text/plain'))e.preventDefault();attach(list);});
 const box=q('#'+p+'-composer-box');
 box.addEventListener('dragover',e=>{if([...(e.dataTransfer?.types||[])].includes('Files')){e.preventDefault();box.classList.add('agent-drop');}});
 box.addEventListener('dragleave',e=>{if(!box.contains(e.relatedTarget))box.classList.remove('agent-drop');});
 box.addEventListener('drop',e=>{box.classList.remove('agent-drop');if(!e.dataTransfer?.files?.length)return;e.preventDefault();attach(e.dataTransfer.files);});
 // The label stays for screen readers; its text is the placeholder, and the box grows with the draft.
 const label=q('#'+p+'-message-label'),grow=()=>{input.style.height='auto';input.style.height=Math.min(input.scrollHeight,220)+'px';};
 new MutationObserver(()=>{input.placeholder=label.textContent;}).observe(label,{childList:true,characterData:true,subtree:true});input.placeholder=label.textContent;
 input.oninput=()=>{drafts.set(key,{text:input.value,key:null});saveDrafts();grow();};requestAnimationFrame(grow);
 input.onkeydown=e=>{if(e.key==='Enter'&&(e.metaKey||e.ctrlKey)){e.preventDefault();q('#'+p+'-composer').requestSubmit();}};
 q('#'+p+'-composer').onsubmit=async e=>{
  e.preventDefault();if(sending)return;
  if(uploading){q('#'+p+'-send-error').textContent='Wait for the attachments to finish uploading.';return;}
  const typed=input.value.trim(),list=files();if(!typed&&!list.length){q('#'+p+'-send-error').textContent='Write a message first.';return;}
  const text=list.length?`${typed}${typed?'\n\n':''}Attached file${list.length>1?'s':''}:\n${list.map(f=>f.path).join('\n')}`:typed;
  // Keep one request key per unsent draft so an ambiguous failure can be retried without a duplicate.
  const draft=drafts.get(key)||{text:input.value,key:null};draft.key??=crypto.randomUUID();drafts.set(key,draft);saveDrafts();
  sending=true;q('#'+p+'-send').disabled=true;q('#'+p+'-send-error').textContent='';
  try{await send({text,requestKey:draft.key});attachedFiles.delete(key);if(!host.isConnected)return;drafts.delete(key);saveDrafts();input.value='';grow();renderFiles();await sent();}
  catch(error){if(host.isConnected)q('#'+p+'-send-error').textContent=error.message+' Your draft is kept.';}
  finally{sending=false;if(host.isConnected)q('#'+p+'-send').disabled=false;}
 };
 return {sending:()=>sending};
}
function renderMessages(host,t,name,p='agent'){
 const list=host.querySelector('#'+p+'-messages');
 list.innerHTML=(t.trimmed?`<li class="field-help">${t.trimmed} older message${t.trimmed===1?'':'s'} not shown.</li>`:'')+(t.items.length?t.items.map(msg=>`<li class="agent-message agent-message-${esc(msg.author)}"><div class="agent-message-meta"><strong>${msg.author==='user'?(msg.source==='cli'?'You · in CLI':'You'):esc(msg.controllerName==='Workbench coordinator'?'Orchestrator':msg.controllerName||name)}</strong><time datetime="${esc(msg.createdAt)}">${esc(time(msg.createdAt))}</time></div><p>${esc(msg.text)}</p>${msg.refs.length?`<div class="agent-refs">${msg.refs.map(refButton).join('')}</div>`:''}</li>`).join(''):'<li class="widget-empty">No messages.</li>');
 list.scrollTop=list.scrollHeight;
}

const effortLabel=e=>e?e[0].toUpperCase()+e.slice(1):'';
// Timeline entries (newest first) as a compact list: time, who, kind and text; open questions are marked.
const timelineKinds={update:'Update',question:'Question',action:'Action needed',you:'',request:'Request',agent:'Message'};
export function timelineMarkup(entries,empty='No activity yet.'){
 if(!entries.length)return `<li class="widget-empty">${esc(empty)}</li>`;
 return entries.map(e=>`<li class="timeline-entry timeline-${esc(e.kind)}"><div class="timeline-meta"><time datetime="${esc(e.at)}">${esc(when(e.at))}</time><strong>${esc(e.who)}</strong>${timelineKinds[e.kind]===''?'':`<span class="timeline-kind">${esc(timelineKinds[e.kind]||e.kind)}${e.answered===false?' · waiting for you':e.answered?' · answered':''}</span>`}</div><p>${esc(e.text.length>600?e.text.slice(0,600)+'…':e.text)}</p></li>`).join('');
}
const providerLabels={claude:'Claude Code',codex:'Codex'},endReasons={stopped:'stopped',idle:'ended after 30 minutes idle',settings:'ended by a settings change',server:'ended when the server stopped',exited:'exited'};
// Chat or CLI view per conversation, kept while navigating.
const cliModes=new Map();
export const openCoordinatorCLI=key=>cliModes.set(key,'cli');
// Coordinator state for one conversation: settings, the live session, the Chat / CLI switch and history.
// The terminal is remounted only when the shown session changes, so refreshes never reset it.
function coordinatorPanel(host,{key,api,modal,notify,refresh,p='agent'}){
 const q=s=>host.querySelector(s);let c=null,term=null,termID=null,termLive=false,viewing=null;
 const mode=()=>cliModes.get(key)||'chat';
 const effortMenu=effortPopover(host,{key,api,notify,p,state:()=>c,refresh});
 const clear=()=>{term?.dispose();term=null;termID=null;};
 function mount(session,live){
  if(termID===session.id&&termLive===live)return;clear();termID=session.id;termLive=live;
  term=mountTerminal({session,api,onChange:s=>{if(s.status!=='running')refresh();},inline:{host:q('#'+p+'-cli-screen'),endpoint:'coordinator-terminal/',stopPath:id=>'coordinator/sessions/'+encodeURIComponent(id)+'/stop',
   eyebrow:`${providerLabels[session.provider]} · ${session.model}`,title:live?(key==='coordinator'?'Orchestrator session':'Project agent session'):'Previous session',endLabel:'Stop session',
   footer:live?'Type here to talk to the session; lines you type are copied to Chat. Answer permission prompts in this terminal.':`Read-only transcript. This session ${endReasons[session.endReason]||'ended'}.`}});
 }
 function apply(){
  const cli=mode()==='cli'&&!!c;
  // CLI is the terminal alone: you type into the session itself, so the message box is only in Chat.
  q('#'+p+'-messages').hidden=cli;q('#'+p+'-composer').hidden=cli;q('#'+p+'-cli').hidden=!cli;q('.agent-thread').classList.toggle('agent-cli-mode',cli);
  host.querySelectorAll('[data-coordinator-mode]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.coordinatorMode===mode())));
  if(!cli){clear();return;}
  if(!c.enabled){clear();q('#'+p+'-history').hidden=true;q('#'+p+'-cli-empty').innerHTML='<span>The coordinator agent is off</span><button type="button" class="agent-start" data-coordinator-settings>Set up</button>';q('#'+p+'-cli-history').innerHTML='';q('#'+p+'-cli').classList.add('agent-cli-idle');return;}
  const saved=viewing&&c.history.find(h=>h.id===viewing),target=saved||c.session||null;
  if(target)mount(target,!saved&&target===c.session);else clear();
  q('#'+p+'-cli-empty').innerHTML=c.session?'':`${target?'':'<span>No session running</span>'}<button type="button" class="agent-start" data-coordinator-start>Start session</button>`;
  // With no terminal on screen, the start controls and history sit centered on one line.
  q('#'+p+'-cli').classList.toggle('agent-cli-idle',!target);
  // Previous sessions sit behind a history icon in the header; the pane keeps the way back while viewing one.
  const history=q('#'+p+'-history'),label=`Previous sessions (${c.history.length})`;history.hidden=!c.history.length;history.setAttribute('aria-label',label);history.title=label;
  q('#'+p+'-cli-history').innerHTML=c.history.length&&saved&&c.session?'<button type="button" class="text-button" data-coordinator-history="">Back to current session</button>':'';
 }
 host.addEventListener('click',e=>{
  if(e.target.closest('[data-effort-menu]')){effortMenu.toggle(e.target.closest('[data-effort-menu]'));return;}
  if(e.target.closest('[data-coordinator-settings]'))effortMenu.close();
  const m=e.target.closest('[data-coordinator-mode]');if(m){cliModes.set(key,m.dataset.coordinatorMode);viewing=null;apply();if(mode()==='cli')q('#'+p+'-cli .xterm-helper-textarea')?.focus();return;}
  const h=e.target.closest('[data-coordinator-history]');if(h){viewing=h.dataset.coordinatorHistory||null;apply();return;}
  if(e.target.closest('[data-coordinator-history-open]')){
   modal('Previous sessions',`<ul class="session-history-list">${c.history.map(h=>`<li><button type="button" class="text-button" data-history-pick="${esc(h.id)}" aria-pressed="${h.id===termID}">${esc(when(h.startedAt))} · ${esc(providerLabels[h.provider])} · ${esc(endReasons[h.endReason]||'ended')}</button></li>`).join('')}</ul><p class="field-help">Opens the read-only transcript in the CLI view.</p>`,[{label:'Close',close:true}]);
   document.querySelectorAll('#dialog [data-history-pick]').forEach(b=>b.onclick=()=>{viewing=b.dataset.historyPick;document.querySelector('#dialog').close();cliModes.set(key,'cli');apply();});
   return;
  }
  if(e.target.closest('[data-coordinator-open-cli]')){cliModes.set(key,'cli');viewing=null;apply();}
  const start=e.target.closest('[data-coordinator-start]');
  if(start){start.disabled=true;viewing=null;api('coordinator/sessions','POST',{threadKey:key}).then(()=>refresh(),error=>{start.disabled=false;notify(error.message);});return;}
  if(e.target.closest('[data-coordinator-settings]')){if(key!=='coordinator'&&c?.enabled)openProjectAgentSettings({api,modal,notify,projectID:key,onSaved:()=>refresh()});else openCoordinatorSettings({api,modal,notify,onSaved:()=>refresh()});}
 });
 return {
  openCLI(){cliModes.set(key,'cli');viewing=null;apply();},
  setMode(next){cliModes.set(key,next);viewing=null;apply();},
  mode,
  update(next){
   c=next;const s=c?.session,slot=q('#'+p+'-coordinator');
   const status=s?(s.waiting?'Waiting for you in CLI':s.status==='running'?'Session running':'Session ending'):'No session';
   q('#'+p+'-view-switch').innerHTML=c?.enabled?'<span class="agent-view-switch" role="group" aria-label="Conversation view"><button type="button" data-coordinator-mode="chat" aria-pressed="false">Chat</button><button type="button" data-coordinator-mode="cli" aria-pressed="false">CLI</button></span>':'';
   const who=c?.agent?`${providerLabels[c.agent.provider]} · ${c.agent.model} · ${c.agent.workspace==='worktree'?'dedicated worktree':'project folder'}`:`${providerLabels[c?.provider]} · ${c?.model}`;
   // Agent and session status sit beside the title; Settings sits right of the refresh icon.
   slot.innerHTML=c?.enabled?`<span class="agent-coordinator-state agent-owner-${s?.waiting?'waiting':s?'active':'none'}">${esc(who)} · ${esc(status)}</span>`
    :'<span class="agent-coordinator-state agent-owner-none">Coordinator agent off</span>';
   q('#'+p+'-settings').innerHTML=`<button type="button" class="text-button" data-coordinator-settings>${c?.enabled?'Settings':'Set up'}</button>`;
   q('#'+p+'-waiting').innerHTML='';
   if(s?.waiting)q('#'+p+'-waiting').insertAdjacentHTML('beforeend',`<p class="agent-waiting" role="status"><strong>Waiting for you in the CLI.</strong> Answer the permission prompt to continue.${mode()==='cli'?'':' <button type="button" class="primary" data-coordinator-open-cli>Open CLI</button>'}</p>`);
   // Model and effort sit in the message box, like a model menu; choosing them opens the agent's settings.
   const pick=c?.agent||c;q('#'+p+'-composer-agent').innerHTML=c?.enabled&&pick?.model?`<button type="button" class="agent-model-button" data-effort-menu aria-haspopup="dialog" aria-expanded="false" title="Effort">${esc(pick.model)} <span>${esc(effortLabel(pick.effort))}</span><svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m7 10 5 5 5-5"/></svg></button>`:'';
   q('#'+p+'-message-help').textContent=!c?.enabled?'Messages are saved. Turn on the coordinator agent to get replies.':c.agent?`Messages go to this project's agent. It works with the project's own instructions and tools, reports to the orchestrator, and asks in its CLI before edits and commands.`:'Messages go to the orchestrator. It hands work to project agents and relays their questions here.';
   if(viewing&&!c.history.some(h=>h.id===viewing))viewing=null;
   // A session that just ended stays on screen as its read-only transcript.
   if(termID&&!s&&c.history.some(h=>h.id===termID))viewing=termID;
   apply();
   return !!s;
  },
  destroy:clear
 };
}
// Effort popover for the message box: a slider with one stop per effort the model supports.
// Saving uses the same settings endpoints as the dialogs, so a running session ends when effort changes.
const effortCatalog={};
function effortPopover(host,{key,api,notify,p,state,refresh}){
 let panel=null,anchor=null,saving=false,pending=null,timer=0;
 const settingsPath=key==='coordinator'?'coordinator':'projects/'+encodeURIComponent(key)+'/agent-settings';
 const models=async provider=>effortCatalog[provider]??=(await api('agents/'+provider)).models||[];
 function close(){if(!panel)return;panel.remove();panel=null;anchor?.setAttribute('aria-expanded','false');removeEventListener('pointerdown',outside,true);removeEventListener('keydown',escape,true);}
 const outside=e=>{if(panel&&!panel.contains(e.target)&&!anchor?.contains(e.target))close();};
 const escape=e=>{if(e.key==='Escape'&&panel){e.preventDefault();close();anchor?.focus();}};
 async function save(effort){
  if(saving){pending=effort;return;}saving=true;panel?.querySelector('.effort-slider')?.setAttribute('aria-busy','true');
  try{const change=typeof effort==='string'?{effort}:effort,current=await api(settingsPath),base=key==='coordinator'?current:current.agent;
   const body={version:current.version,provider:change.provider||base.provider,model:change.model||base.model,effort:change.effort,...(key==='coordinator'?{enabled:current.enabled}:{workspace:base.workspace})};
   await api(settingsPath,'PUT',body);notify(change.model?`Next session uses ${providerLabels[body.provider]} · ${change.name||body.model}.`:`Effort set to ${effortLabel(change.effort)}.`);refresh();}
  catch(error){notify(error.message);}
  finally{saving=false;panel?.querySelector('.effort-slider')?.removeAttribute('aria-busy');if(pending!==null){const next=pending;pending=null;save(next);}}
 }
 async function open(button){
  const c=state(),pick=c?.agent||c;if(!pick?.model)return;anchor=button;
  let efforts=[],name=pick.model;try{const m=(await models(pick.provider)).find(m=>m.id===pick.model);efforts=m?.efforts||[];name=m?.name||pick.model;}catch(error){notify(error.message);return;}
  if(!efforts.length){notify('No effort levels are listed for this model.');return;}
  const index=Math.max(0,efforts.indexOf(pick.effort)),reset=efforts.includes('default')?'default':null;
  panel=document.createElement('div');panel.className='effort-popover';panel.setAttribute('role','dialog');panel.tabIndex=-1;panel.setAttribute('aria-label','Effort');
  panel.innerHTML=`<div class="effort-head"><span></span><div class="effort-title"><button type="button" class="effort-name" data-effort-models aria-expanded="false" title="Choose agent and model"><span id="${p}-effort-value">${esc(effortLabel(efforts[index]))}</span><svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m9 6 6 6-6 6"/></svg></button><small>${esc(name)}</small></div>${reset?'<button type="button" class="effort-reset" aria-label="Reset effort to default" title="Reset to default"><svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5"/></svg></button>':'<span></span>'}</div>
   <div class="effort-slider" style="--stops:${efforts.length}"><div class="effort-dots" aria-hidden="true">${efforts.map(()=>'<i></i>').join('')}</div><input type="range" min="0" max="${efforts.length-1}" step="1" value="${index}" aria-label="Effort" aria-valuetext="${esc(effortLabel(efforts[index]))}"></div>
   <div class="effort-models" hidden></div>
   ${c.session?'<p class="effort-note">Changing the agent, model or effort ends the running session.</p>':''}`;
  button.closest('.agent-composer-box').append(panel);button.setAttribute('aria-expanded','true');
  const range=panel.querySelector('input'),value=panel.querySelector('#'+p+'-effort-value');
  range.oninput=()=>{const e=efforts[range.value];value.textContent=effortLabel(e);range.setAttribute('aria-valuetext',effortLabel(e));};
  // Keyboard steps commit on every key; save once the slider settles so a running session ends only once.
  let saved=pick.effort;const commit=e=>{clearTimeout(timer);timer=setTimeout(()=>{if(e!==saved){saved=e;save(e);}},400);};
  range.onchange=()=>commit(efforts[range.value]);
  panel.querySelector('.effort-reset')?.addEventListener('click',()=>{range.value=efforts.indexOf(reset);range.oninput();commit(reset);});
  // Agent and model list: Codex and Claude Code models from each CLI's catalog.
  const list=panel.querySelector('.effort-models'),toggle=panel.querySelector('[data-effort-models]');
  toggle.onclick=async()=>{
   const show=list.hidden;list.hidden=!show;toggle.setAttribute('aria-expanded',String(show));panel.querySelector('.effort-slider').hidden=show;if(!show)return;
   list.innerHTML='<p class="effort-note">Loading models…</p>';
   const groups=await Promise.all(['codex','claude'].map(async provider=>{try{return {provider,models:await models(provider)};}catch(error){return {provider,error:error.message};}}));
   if(!panel)return;
   list.innerHTML=groups.map(g=>`<section><h4>${esc(providerLabels[g.provider])}</h4>${g.error?`<p class="effort-note">${esc(g.error)}</p>`:g.models.length?g.models.map(m=>`<button type="button" class="effort-model" data-provider="${esc(g.provider)}" data-model="${esc(m.id)}" aria-pressed="${g.provider===pick.provider&&m.id===pick.model}">${esc(m.name||m.id)}</button>`).join(''):'<p class="effort-note">No models available.</p>'}</section>`).join('')+'<button type="button" class="text-button effort-all" data-coordinator-settings>All settings…</button>';
   list.querySelector('[aria-pressed="true"]')?.focus();
  };
  list.addEventListener('click',e=>{
   const b=e.target.closest('.effort-model');if(!b||b.getAttribute('aria-pressed')==='true')return;
   const g=effortCatalog[b.dataset.provider]||[],m=g.find(x=>x.id===b.dataset.model),options=m?.efforts||[];
   // Keep the current effort when the new model has it; otherwise its default, then its first level.
   const effort=options.includes(pick.effort)?pick.effort:options.includes('default')?'default':options[0];
   save({provider:b.dataset.provider,model:b.dataset.model,name:m?.name,effort});close();
  });
  addEventListener('pointerdown',outside,true);addEventListener('keydown',escape,true);panel.focus();
 }
 return {toggle(button){if(panel)close();else open(button);},close};
}
// Per-project agent: provider, model, effort and where it works. Saving ends a running session for that project.
export async function openProjectAgentSettings({api,modal,notify,projectID,onSaved}){
 let current,catalogs={};try{current=await api('projects/'+encodeURIComponent(projectID)+'/agent-settings');}catch(error){notify(error.message);return;}
 const a=current.agent,load=async provider=>{if(!catalogs[provider]){try{catalogs[provider]=(await api('agents/'+provider)).models||[];}catch(error){catalogs[provider]={error:error.message};}}return catalogs[provider];};
 const options=list=>Array.isArray(list)&&list.length?list.map(m=>`<option value="${esc(m.id)}"${m.id===a.model?' selected':''}>${esc(m.name||m.id)}</option>`).join(''):'<option value="">No models available</option>';
 const models=await load(a.provider);
 modal('Project agent',`<p class="field-help">This project's live agent runs Claude Code or Codex with your normal configuration, the project's CLAUDE.md / AGENTS.md and its own tools, and asks in its CLI before edits and commands. Changing these settings ends a running session.</p>
  <label>Agent<select name="provider"><option value="claude"${a.provider==='claude'?' selected':''}>Claude Code</option><option value="codex"${a.provider==='codex'?' selected':''}>Codex</option></select></label>
  <label>Model<select name="model">${options(models)}</select></label>
  <label>Effort<select name="effort"></select></label>
  <div class="agent-mandate-form"><fieldset><legend>Where it works</legend><label class="agent-check"><input type="radio" name="workspace" value="folder"${a.workspace!=='worktree'?' checked':''}> Project folder</label><label class="agent-check"><input type="radio" name="workspace" value="worktree"${a.workspace==='worktree'?' checked':''}> Dedicated worktree (agent branch, kept for review)</label></fieldset></div>`,[{label:'Cancel',close:true},{label:'Save',primary:true,submit:true}],
  async form=>{await api('projects/'+encodeURIComponent(projectID)+'/agent-settings','PUT',{version:current.version,provider:form.get('provider'),model:form.get('model'),effort:form.get('effort'),workspace:form.get('workspace')});notify('Project agent saved.');onSaved?.();});
 const d=document.querySelector('#dialog'),provider=d.querySelector('[name=provider]'),model=d.querySelector('[name=model]'),effort=d.querySelector('[name=effort]');
 const efforts=()=>{const m=(catalogs[provider.value]||[]).find?.(x=>x.id===model.value);effort.innerHTML=(m?.efforts||[]).map(e=>`<option value="${esc(e)}"${e===a.effort?' selected':''}>${esc(e)}</option>`).join('');};
 provider.onchange=async()=>{const list=await load(provider.value);model.innerHTML=list.error?`<option value="">${esc(list.error)}</option>`:options(list);efforts();};
 model.onchange=efforts;efforts();
}
export async function openCoordinatorSettings({api,modal,notify,onSaved}){
 let current,catalogs={};try{current=await api('coordinator');}catch(error){notify(error.message);return;}
 const load=async provider=>{if(!catalogs[provider]){try{catalogs[provider]=(await api('agents/'+provider)).models||[];}catch(error){catalogs[provider]={error:error.message};}}return catalogs[provider];};
 const models=await load(current.provider);
 const options=list=>Array.isArray(list)&&list.length?list.map(m=>`<option value="${esc(m.id)}"${m.id===current.model?' selected':''}>${esc(m.name||m.id)}</option>`).join(''):'<option value="">No models available</option>';
 modal('Coordinator agent',`<p class="field-help">Claude Code or Codex answers the Home and project conversations in a live session you can watch in the CLI view. It has no file or shell tools and asks in the CLI before it starts or changes work, which it can do only within each project mandate. Codex uses its own sign-in for the coordinator: the first Codex session asks you to sign in there. Changing these settings ends running sessions. Enabling creates the “Workbench coordinator” controller grant, which you can revoke in Controllers.</p>
  <label class="agent-check"><input type="checkbox" name="enabled"${current.enabled?' checked':''}> Reply to conversation messages</label>
  <label>Agent<select name="provider"><option value="claude"${current.provider==='claude'?' selected':''}>Claude Code</option><option value="codex"${current.provider==='codex'?' selected':''}>Codex</option></select></label>
  <label>Model<select name="model">${options(models)}</select></label>
  <label>Effort<select name="effort"></select></label>`,[{label:'Cancel',close:true},{label:'Save',primary:true,submit:true}],
  async form=>{const saved=await api('coordinator','PUT',{version:current.version,enabled:form.get('enabled')==='on',provider:form.get('provider'),model:form.get('model'),effort:form.get('effort')});notify(saved.enabled?'Coordinator agent on.':'Coordinator agent off.');onSaved?.(saved);});
 const d=document.querySelector('#dialog'),provider=d.querySelector('[name=provider]'),model=d.querySelector('[name=model]'),effort=d.querySelector('[name=effort]');
 const efforts=()=>{const m=(catalogs[provider.value]||[]).find?.(x=>x.id===model.value);effort.innerHTML=(m?.efforts||[]).map(e=>`<option value="${esc(e)}"${e===current.effort?' selected':''}>${esc(e)}</option>`).join('');};
 provider.onchange=async()=>{const list=await load(provider.value);model.innerHTML=list.error?`<option value="">${esc(list.error)}</option>`:options(list);efforts();};
 model.onchange=efforts;efforts();
}

// Current work: each branch not yet merged, summarized by its own commits (newest first).
function branchWorkMarkup(w){
 if(w.status!=='connected')return `<li class="widget-empty">${esc(w.message)}</li>`;
 if(!w.branches.length)return `<li class="widget-empty">No branches ahead of ${esc(w.target)}.</li>`;
 const ago=value=>{if(!value)return '';const m=Math.round((Date.now()-Date.parse(value))/60000);return m<60?`${Math.max(m,1)} min ago`:m<1440?`${Math.round(m/60)} h ago`:`${Math.round(m/1440)} d ago`;};
 return w.branches.map(b=>{const [first,...rest]=b.subjects,more=b.ahead-b.subjects.length;
  const where=b.worktree?(b.worktree.current?'project folder':'worktree')+(b.worktree.changes?` · ${b.worktree.changes} uncommitted`:''):'no worktree';
  return `<li class="branch-work-row"><div class="branch-work-head"><code>${esc(b.name)}</code><small>${b.ahead} ahead${b.behind?` · ${b.behind} behind`:''} · ${esc(where)}${b.lastCommitAt?` · ${esc(ago(b.lastCommitAt))}`:''}</small></div>
   ${first?`<p>${esc(first)}</p>`:''}${rest.length?`<ul>${rest.map(t=>`<li>${esc(t)}</li>`).join('')}${more>0?`<li class="branch-work-more">${more} more commit${more>1?'s':''}</li>`:''}</ul>`:''}</li>`;}).join('')+(w.total>w.branches.length?`<li class="widget-empty">${w.total-w.branches.length} more branches</li>`:'');
}
export function mountProjectAgent(host,{project,api,modal,notify,flows,owner,onRun,onIssue,onIssues}){
 let state=null,timer=null,fast=null;
 // Check often only while a reply is pending.
 const pace=pending=>{if(pending&&!fast)fast=setTimeout(()=>{fast=null;if(host.isConnected)refresh();},1500);};
 host.className='project-agent';host.setAttribute('aria-label','Project agent');
 host.innerHTML=`<div class="agent-main" id="agent-main"><section aria-labelledby="agent-decisions"><h2 id="agent-decisions">Needs your decision</h2><div id="agent-decisions-body" aria-live="polite"><p class="widget-empty">Loading…</p></div></section>
 <section aria-labelledby="agent-current"><h2 id="agent-current">Current work</h2><div id="agent-current-body" aria-live="polite"><div id="agent-current-run"></div><ul class="branch-work" id="agent-branches"><li class="widget-empty">Loading branches…</li></ul></div></section>
 <section aria-labelledby="agent-next"><div class="agent-section-head"><h2 id="agent-next">Issues</h2><button type="button" class="text-button" data-agent-issues>All issues</button></div><div id="agent-next-body" hidden></div>
  <div class="agent-subsection"><div class="agent-subhead"><h3>Priority issues</h3><span id="priority-issues-meta">Loading…</span></div><ol id="priority-issues-list" class="priority-issue-list" aria-live="polite"><li class="widget-empty">Loading issues…</li></ol><p class="field-help" id="priority-issues-note"></p></div></section>
 <section aria-labelledby="agent-timeline"><h2 id="agent-timeline">Timeline</h2><ol class="project-timeline" id="agent-timeline-list" aria-live="polite"><li class="widget-empty">Loading…</li></ol></section>
</div>
 ${threadAside('Project agent','PROJECT AGENT',false)}`;
 const q=s=>host.querySelector(s);
 const composer=bindComposer(host,{key:project.id,send:body=>api('projects/'+encodeURIComponent(project.id)+'/messages','POST',body).then(r=>{if(r.deliveryError)notify(r.deliveryError);return r;}),sent:()=>refresh()});
 const coordinator=coordinatorPanel(host,{key:project.id,api,modal,notify,refresh:()=>refresh()});
 q('#agent-refresh').onclick=()=>refresh(true);
 host.addEventListener('click',e=>{
  const ref=e.target.closest('[data-agent-ref]');if(ref){if(ref.dataset.agentRef==='run')onRun(ref.dataset.refId);else if(ref.dataset.agentRef==='issue'){const n=issueNumber(ref.dataset.refId)||Number(ref.dataset.refId);if(n)onIssue(n);}return;}
  const run=e.target.closest('[data-agent-run]');if(run){onRun(run.dataset.agentRun);return;}
  const issue=e.target.closest('[data-agent-issue]');if(issue){onIssue(Number(issue.dataset.agentIssue));return;}
  if(e.target.closest('[data-agent-open-cli]')){coordinator.openCLI();document.dispatchEvent(new CustomEvent('project-agent-open-cli',{detail:{projectID:project.id}}));return;}
  // Reply goes to this project's agent: the side panel's lower pane, or the page card when the panel is away.
  if(e.target.closest('[data-agent-reply]')){const box=[document.querySelector('#dockp-message'),q('#agent-message')].find(el=>el?.offsetParent);box?.focus();return;}
  if(e.target.closest('[data-agent-mandate]'))openMandate();
  if(e.target.closest('[data-agent-issues]'))onIssues();
 });
 function ownerName(){return state?.profile?.name||'Project owner';}
 function renderOwner(){
  if(!owner?.isConnected)return;const m=state.mandate;
  const a=state.coordinator?.agent,live=state.coordinator?.session;
  owner.innerHTML=a?.model?`<span>Agent: ${esc(providerLabels[a.provider])} · ${esc(a.model)}</span><span class="agent-owner-state agent-owner-${live?.waiting?'waiting':live?'working':'none'}">${live?.waiting?'Waiting for you':live?'Running':'Idle'}</span>`:'';
 }
 function renderMain(){
  const m=state.mandate;
  const decisions=state.decisions.length?`<ul class="agent-list">${state.decisions.map(d=>`<li class="agent-decision"><span class="agent-dot agent-dot-${esc(d.kind)}" aria-hidden="true"></span><span class="agent-copy"><strong>${esc(d.title)}</strong><small>${esc(d.detail)}</small></span>${d.runID?`<button type="button" class="primary" data-agent-run="${esc(d.runID)}">${d.kind==='review'?'Review':'Inspect'}</button>`:d.kind==='question'?'<button type="button" class="primary" data-agent-reply>Reply</button>':d.kind==='coordinator'?'<button type="button" class="primary" data-agent-open-cli>Open CLI</button>':'<button type="button" data-agent-mandate>Review mandate</button>'}</li>`).join('')}</ul>`:'<p class="widget-empty">No decisions waiting.</p>';
  const c=state.current;
  const current=c?`<article class="agent-card"><div class="agent-card-head"><span class="eyebrow">${esc(c.taskRef||'WORKFLOW RUN')}</span><span class="agent-status agent-status-${esc(c.status)}">${esc(statusLabels[c.status]||c.status)}</span></div><h3>${esc(c.flowName)}</h3><p>${esc(c.task)}</p>${progress(c.steps)}
   <dl class="agent-facts"><div><dt>Attempts</dt><dd>${c.agentAttempts} of ${c.maxAttempts}</dd></div>${c.workspace?.branch?`<div><dt>Workspace</dt><dd>${esc(c.workspace.branch)}</dd></div>`:''}${c.deadlineAt?`<div><dt>Runtime limit</dt><dd>${esc(when(c.deadlineAt))}</dd></div>`:''}${c.controllerName?`<div><dt>Started by</dt><dd>${esc(c.controllerName)}${c.mandateVersion?` · mandate v${c.mandateVersion}`:''}</dd></div>`:''}</dl>
   ${c.error?`<p class="agent-error">${esc(c.error)}</p>`:''}<div class="agent-card-actions"><button type="button" class="text-button" data-agent-run="${esc(c.id)}">View run</button></div></article>`:'';
  const next=m?(state.next.length?`<ul class="agent-list">${state.next.map(t=>{const n=t.ref.startsWith('github:')?issueNumber(t.ref):null;return `<li class="agent-next"><span class="agent-copy"><strong>${esc(t.title||t.ref)}</strong><small>${esc(t.ref)}</small></span>${n?`<button type="button" class="text-button" data-agent-issue="${n}">Open issue</button>`:''}</li>`;}).join('')}</ul>${state.nextTotal>state.next.length?`<p class="field-help">${state.nextTotal-state.next.length} more eligible task${state.nextTotal-state.next.length===1?'':'s'} in the mandate.</p>`:''}`:'<p class="widget-empty">All eligible tasks are claimed by a run.</p>'):'<p class="widget-empty">No owner mandate. <button type="button" class="text-button" data-agent-mandate>Set mandate</button></p>';
  q('#agent-decisions-body').innerHTML=decisions;q('#agent-current-run').innerHTML=current;q('#agent-next-body').innerHTML=next;
 }
 function renderThread(){
  const name=`${project.name} agent`;
  q('#agent-thread-title').textContent=name;
  q('#agent-thread-status').textContent=state.current?`${statusLabels[state.current.status]||state.current.status}: ${state.current.taskRef||state.current.flowName}`:'';
  q('#agent-message-label').textContent=`Message ${name} · ${project.name}`;
  renderMessages(host,state.thread,name);
  pace(coordinator.update(state.coordinator));
  // Mandates are off the main path (#18); the conversation card is the project's live agent.
 }
 async function refresh(announce=false){
  api('projects/'+encodeURIComponent(project.id)+'/branch-work').then(w=>{if(host.isConnected)q('#agent-branches').innerHTML=branchWorkMarkup(w);},error=>{if(host.isConnected)q('#agent-branches').innerHTML=`<li class="widget-empty">${esc(error.message)}</li>`;});
  api('projects/'+encodeURIComponent(project.id)+'/timeline').then(t=>{if(host.isConnected)q('#agent-timeline-list').innerHTML=timelineMarkup(t.entries,'No agent activity yet. Reports from this project\'s agent appear here.');},error=>{if(host.isConnected)q('#agent-timeline-list').innerHTML=`<li class="widget-empty">${esc(error.message)}</li>`;});
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
 // Keep the message box in the window: the pinned card is sized to the space below its top, so
 // the messages scroll inside it while the page scrolls around it.
 const thread=q('.agent-thread');let frame=0;
 const fit=()=>{frame=0;if(!host.isConnected){stop();return;}if(getComputedStyle(thread).position!=='sticky'||thread.classList.contains('agent-cli-mode')){thread.style.maxHeight='';return;}const list=q('#agent-messages'),end=list.scrollHeight-list.scrollTop-list.clientHeight<24;thread.style.maxHeight=Math.max(320,innerHeight-Math.max(18,thread.getBoundingClientRect().top)-18)+'px';if(end)list.scrollTop=list.scrollHeight;};
 const queue=()=>{if(!frame)frame=requestAnimationFrame(fit);};
 const stop=()=>{cancelAnimationFrame(frame);layout.disconnect();removeEventListener('scroll',queue,{capture:true});removeEventListener('resize',queue);};
 // Widgets above the card load later and move it, so layout changes refit it too.
 const layout=new ResizeObserver(queue);layout.observe(document.body);
 addEventListener('scroll',queue,{passive:true,capture:true});addEventListener('resize',queue);queue();
 refresh();
 timer=setInterval(()=>{if(!host.isConnected){clearInterval(timer);return;}if(document.visibilityState==='visible'&&!composer.sending())refresh();},15000);
 return {refresh,openMandate,destroy(){clearInterval(timer);stop();coordinator.destroy();}};
}

const ownerStates={working:'Running',waiting:'Waiting for you',attention:'Needs attention',active:'Active',paused:'Paused',none:'No mandate'};
// Home summarizes the same project records and hosts the cross-project coordinator conversation.
export function mountHomeAgents(host,{api,modal,notify,onProject,onRun}){
 let state=null,timer=null,fast=null;
 const pace=pending=>{if(pending&&!fast)fast=setTimeout(()=>{fast=null;if(host.isConnected)refresh();},1500);};
 // Home alert strip: shown only while a review, failed run, waiting agent or mandate needs the person.
 host.className='home-alerts';host.setAttribute('aria-label','Needs your attention');host.hidden=true;
 host.innerHTML=`<h2 id="home-decisions" class="home-alerts-title"></h2><div id="home-decisions-body" aria-live="polite"></div><p class="home-alerts-error" id="home-agent-summary" role="status"></p>`;
 const q=s=>host.querySelector(s);
 host.addEventListener('click',e=>{
  const ref=e.target.closest('[data-agent-ref]');if(ref){if(ref.dataset.agentRef==='project')onProject(ref.dataset.refId);else if(ref.dataset.agentRef==='run'){const owner=state?.projects.find(p=>p.current?.id===ref.dataset.refId||p.recent?.id===ref.dataset.refId)||state?.recent.find(r=>r.id===ref.dataset.refId);if(owner)onRun(owner.projectID,ref.dataset.refId);}return;}
  const run=e.target.closest('[data-home-run]');if(run){onRun(run.dataset.runProject,run.dataset.homeRun);return;}
  const cli=e.target.closest('[data-home-open-cli]');if(cli){if(cli.dataset.homeOpenCli){openCoordinatorCLI(cli.dataset.homeOpenCli);onProject(cli.dataset.homeOpenCli);}else document.dispatchEvent(new CustomEvent('coordinator-dock-open',{detail:{tab:'cli'}}));return;}
  const project=e.target.closest('[data-home-project]');if(project)onProject(project.dataset.homeProject);
 });
 function render(){
  const n=state.decisions.length;host.hidden=!n;q('#home-agent-summary').textContent='';
  q('#home-decisions').textContent=`${n} ${n===1?'thing needs':'things need'} your attention`;
  q('#home-decisions-body').innerHTML=state.decisions.length?`<ul class="agent-list">${state.decisions.map(d=>`<li class="agent-decision"><span class="agent-dot agent-dot-${esc(d.kind)}" aria-hidden="true"></span><span class="agent-copy"><strong>${esc(d.projectName)} · ${esc(d.title)}</strong><small>${esc(d.detail)}</small></span>${d.runID?`<button type="button" class="primary" data-run-project="${esc(d.projectID)}" data-home-run="${esc(d.runID)}">${d.kind==='review'?'Review':'Inspect'}</button>`:d.kind==='question'?`<button type="button" class="primary" data-home-project="${esc(d.projectID)}">Reply</button>`:d.kind==='coordinator'?`<button type="button" class="primary" data-home-open-cli="${esc(d.projectID||'')}">Open CLI</button>`:`<button type="button" data-home-project="${esc(d.projectID)}">Open project</button>`}</li>`).join('')}</ul>`:'<p class="widget-empty">No decisions waiting.</p>';
  pace(state.decisions.some(d=>d.kind==='coordinator'));
 }
 async function refresh(announce=false){
  try{const next=await api('agents/overview');if(!host.isConnected)return;state=next;render();if(announce)notify('Project owners refreshed.');}
  catch(error){if(host.isConnected){host.hidden=false;q('#home-decisions').textContent='Attention items unavailable';q('#home-agent-summary').textContent=error.message;}}
 }
 refresh();
 timer=setInterval(()=>{if(!host.isConnected){clearInterval(timer);return;}if(document.visibilityState==='visible')refresh();},15000);
 return {refresh,destroy(){clearInterval(timer);}};
}

// The all-projects coordinator conversation for the side panel: thread, composer and the live CLI.
// It uses the "dock" ID prefix so it can sit beside a project conversation card on the same page.
export function mountCoordinatorConversation(host,{api,modal,notify}){
 let state=null,timer=null,fast=null;const p='dock';
 const pace=pending=>{if(pending&&!fast)fast=setTimeout(()=>{fast=null;if(host.isConnected)refresh();},1500);};
 host.innerHTML=threadAside('Coordinator conversation','ALL PROJECTS',false,p);
 const q=s=>host.querySelector(s);
 const composer=bindComposer(host,{key:'coordinator',p,send:body=>api('coordinator/messages','POST',body).then(r=>{if(r.deliveryError)notify(r.deliveryError);return r;}),sent:()=>refresh()});
 const coordinator=coordinatorPanel(host,{key:'coordinator',api,modal,notify,refresh:()=>refresh(),p});
 q('#dock-refresh').onclick=()=>refresh(true);
 async function refresh(announce=false){
  try{
   const next=await api('agents/overview');if(!host.isConnected)return;state=next;const c=state.counts;
   q('#dock-thread-title').textContent='Coordinator';
   q('#dock-thread-status').textContent='';
   q('#dock-message-label').textContent='Message coordinator · all projects';
   renderMessages(host,state.thread,'Coordinator',p);pace(coordinator.update(state.coordinator));
   if(announce)notify('Coordinator refreshed.');
  }catch(error){if(host.isConnected)q('#dock-thread-status').textContent=error.message;}
 }
 refresh();
 timer=setInterval(()=>{if(!host.isConnected){clearInterval(timer);return;}if(document.visibilityState==='visible'&&!composer.sending())refresh();},15000);
 return {refresh,setMode:m=>coordinator.setMode(m),mode:()=>coordinator.mode(),destroy(){clearInterval(timer);clearTimeout(fast);coordinator.destroy();}};
}

// The current project's agent conversation for the side panel's lower half (project pages only). It uses the
// "dockp" ID prefix so it can sit under the coordinator conversation and beside the project page.
export function mountProjectConversation(host,{project,api,modal,notify}){
 let timer=null,fast=null;const p='dockp',name=`${project.name} agent`,title=project.name;
 const pace=pending=>{if(pending&&!fast)fast=setTimeout(()=>{fast=null;if(host.isConnected)refresh();},1500);};
 host.innerHTML=threadAside('Project agent conversation','PROJECT AGENT',false,p);
 const q=s=>host.querySelector(s);
 const composer=bindComposer(host,{key:project.id,p,send:body=>api('projects/'+encodeURIComponent(project.id)+'/messages','POST',body).then(r=>{if(r.deliveryError)notify(r.deliveryError);return r;}),sent:()=>refresh()});
 const coordinator=coordinatorPanel(host,{key:project.id,api,modal,notify,refresh:()=>refresh(),p});
 q('#dockp-refresh').onclick=()=>refresh(true);
 // The project page's Open CLI (decisions list) switches this pane to the agent's CLI.
 const openCLI=e=>{if(e.detail?.projectID===project.id&&host.isConnected)coordinator.setMode('cli');};document.addEventListener('project-agent-open-cli',openCLI);
 async function refresh(announce=false){
  try{
   const state=await api('projects/'+encodeURIComponent(project.id)+'/agent');if(!host.isConnected)return;
   q('#dockp-thread-title').textContent=title;q('#dockp-thread-status').textContent=state.current?`${statusLabels[state.current.status]||state.current.status}: ${state.current.taskRef||state.current.flowName}`:'';
   q('#dockp-message-label').textContent=`Message ${name}`;
   renderMessages(host,state.thread,name,p);pace(coordinator.update(state.coordinator));
   if(announce)notify('Project agent refreshed.');
  }catch(error){if(host.isConnected)q('#dockp-thread-status').textContent=error.message;}
 }
 refresh();
 timer=setInterval(()=>{if(!host.isConnected){clearInterval(timer);return;}if(document.visibilityState==='visible'&&!composer.sending())refresh();},15000);
 return {projectID:project.id,refresh,destroy(){clearInterval(timer);clearTimeout(fast);document.removeEventListener('project-agent-open-cli',openCLI);coordinator.destroy();}};
}
