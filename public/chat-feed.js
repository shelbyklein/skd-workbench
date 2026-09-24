// Chat as a live view of the agent session (#48): the conversation thread (your messages, orchestrator hand-offs,
// agent reports) merged with events from the CLI's own transcript: the agent's replies, its tool calls grouped
// into one expandable line per run of steps, and questions or permission prompts answered from here.
import {renderMarkdown} from './markdown.js';
const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const time=value=>value?new Date(value).toLocaleTimeString(undefined,{hour:'numeric',minute:'2-digit'}):'';
const norm=text=>String(text||'').replace(/\s+/g,' ').trim();
const refLabel={run:'Run',issue:'Issue',workflow:'Workflow',session:'Session',operation:'Operation',project:'Project'};

function threadItem(msg,name){
 const who=msg.author==='user'?(msg.source==='cli'?'You · in CLI':'You'):msg.controllerName==='Workbench coordinator'?'Orchestrator':msg.controllerName||name;
 return `<li class="agent-message agent-message-${esc(msg.author)}"><div class="agent-message-meta"><strong>${esc(who)}</strong><time datetime="${esc(msg.createdAt)}">${esc(time(msg.createdAt))}</time></div><p>${esc(msg.text)}</p>${msg.refs?.length?`<div class="agent-refs">${msg.refs.map(r=>`<button type="button" class="agent-ref" data-ref-kind="${esc(r.kind)}" data-ref-id="${esc(r.id)}">${esc(refLabel[r.kind]||r.kind)}</button>`).join('')}</div>`:''}</li>`;
}
const toolIcon=s=>s==='error'?'<span class="chat-tool-status is-error" aria-label="failed">✕</span>':s==='running'?'<span class="chat-tool-status is-running" aria-label="running"></span>':'<span class="chat-tool-status is-done" aria-label="done">✓</span>';
const toolBody=t=>`${t.detail&&t.detail!=='{}'?`<pre class="chat-tool-detail">${esc(t.detail)}</pre>`:''}${t.output?`<pre class="chat-tool-output">${esc(t.output)}</pre>`:''}`;
function toolsItem(tools){
 if(tools.length===1){const t=tools[0];return `<li class="chat-tools${t.status==='running'?' is-running':''}"><details><summary>${toolIcon(t.status)}<span class="chat-tools-label">${esc(t.label)}</span></summary>${toolBody(t)}</details></li>`;}
 const last=tools.at(-1),running=tools.some(t=>t.status==='running'),failed=tools.filter(t=>t.status==='error').length;
 const summary=tools.length===1?esc(last.label):`${esc(last.label)} <span class="chat-tools-count">· ${tools.length} steps${failed?` · ${failed} failed`:''}</span>`;
 return `<li class="chat-tools${running?' is-running':''}"><details><summary>${toolIcon(running?'running':failed?'error':'done')}<span class="chat-tools-label">${summary}</span></summary><ol>${tools.map(t=>`<li><details><summary>${toolIcon(t.status)}<span>${esc(t.label)}</span></summary>${toolBody(t)}</details></li>`).join('')}</ol></details></li>`;
}
function textItem(e,name){return `<li class="agent-message agent-message-agent chat-reply"><div class="agent-message-meta"><strong>${esc(name)}</strong><time datetime="${esc(e.at)}">${esc(time(e.at))}</time></div><div class="chat-markdown">${renderMarkdown(e.text,esc(e.text))}</div></li>`;}
function questionItem(e,live,provider){
 const open=e.status==='waiting'&&live;
 if(!open)return `<li class="chat-question is-answered"><div class="chat-question-head">${e.status==='answered'?'Answered':'Question'}</div>${e.questions.map((q,i)=>`<p>${esc(q.question)}${e.answers?.[i]?` <strong class="chat-question-answer">→ ${esc(e.answers[i])}</strong>`:''}</p>`).join('')}${e.answer?`<p class="chat-question-answer">${esc(e.answer)}</p>`:''}</li>`;
 const multi=e.questions.some(q=>q.multiSelect),many=e.questions.length>1,direct=provider==='claude'&&!multi;
 return `<li class="chat-question" data-question="${esc(e.id)}"><div class="chat-question-head">Waiting for your answer</div>${e.questions.map((q,qi)=>`<fieldset data-question-index="${qi}"><legend>${q.header?`<span class="chat-question-tag">${esc(q.header)}</span>`:''}${esc(q.question)}</legend>${q.options.map((o,oi)=>`<button type="button" class="chat-option" data-option="${oi}" aria-pressed="false"${direct?'':' disabled'}><strong>${esc(o.label)}</strong>${o.description?`<span>${esc(o.description)}</span>`:''}</button>`).join('')}</fieldset>`).join('')}
  <div class="chat-question-actions">${direct&&many?'<button type="button" class="primary" data-send-answers disabled>Send answers</button>':''}<button type="button" class="text-button" data-coordinator-open-cli>${direct?'Answer in the CLI':'Answer in the CLI (this question needs it)'}</button></div></li>`;
}
function permissionItem(tool,provider){
 return `<li class="chat-question chat-permission"><div class="chat-question-head">Needs your permission</div><p>${esc(tool?.label||'The agent wants to use a tool.')}</p>${tool?.detail?`<pre class="chat-tool-detail">${esc(tool.detail)}</pre>`:''}<div class="chat-question-actions">${provider==='claude'?'<button type="button" class="primary" data-permission="allow">Allow once</button><button type="button" data-permission="deny">Deny</button>':''}<button type="button" class="text-button" data-coordinator-open-cli>Answer in the CLI</button></div></li>`;
}

export function chatFeed(host,{key,p='agent',api,name,notify,threadItem:renderThreadItem=threadItem,onChange}){
 let thread=null,transcript=null,timer=null,signature='',stopped=false,seen=0;
 const list=()=>host.querySelector('#'+p+'-messages');
 function render(){
  const el=list();if(!el||!thread)return;
  const events=transcript?.events||[],live=!!transcript?.running;
  // Replies the agent also posted to the conversation appear once, as the posted message.
  const posted=new Set(thread.items.filter(m=>m.author!=='user').map(m=>norm(m.text)));
  const items=[...thread.items.map(m=>({at:m.createdAt,type:'thread',m})),...events.filter(e=>!(e.kind==='text'&&posted.has(norm(e.text)))).map(e=>({at:e.at,type:e.kind,e}))].sort((a,b)=>String(a.at).localeCompare(String(b.at)));
  const out=[];let tools=[];
  const flush=()=>{if(tools.length){out.push(toolsItem(tools));tools=[];}};
  for(const item of items){
   if(item.type==='tool'){tools.push(item.e);continue;}
   flush();
   if(item.type==='thread')out.push(renderThreadItem(item.m,name));
   else if(item.type==='text')out.push(textItem(item.e,name));
   else if(item.type==='question')out.push(questionItem(item.e,live,transcript.provider));
  }
  flush();
  const pendingTool=[...events].reverse().find(e=>e.kind==='tool'),asking=events.some(e=>e.kind==='question'&&e.status==='waiting');
  if(live&&transcript.waiting&&!asking)out.push(permissionItem(pendingTool?.status==='running'?pendingTool:null,transcript.provider));
  else if(live&&transcript.busy)out.push('<li class="chat-working" aria-label="Working"><span></span><span></span><span></span></li>');
  const next=(thread.trimmed?`<li class="field-help">${thread.trimmed} older message${thread.trimmed===1?'':'s'} not shown.</li>`:'')+(out.join('')||'<li class="widget-empty">No messages.</li>');
  if(next===signature)return;signature=next;
  const atBottom=el.scrollHeight-el.scrollTop-el.clientHeight<80;
  // Keep open disclosures and chosen options across re-renders.
  const open=new Set([...el.querySelectorAll('details[open]')].map(d=>d.querySelector('summary')?.textContent));
  el.innerHTML=next;
  el.querySelectorAll('details').forEach(d=>{if(open.has(d.querySelector('summary')?.textContent))d.open=true;});
  if(atBottom||!el.dataset.rendered)el.scrollTop=el.scrollHeight;el.dataset.rendered='1';
 }
 async function poll(){
  clearTimeout(timer);if(stopped||!host.isConnected)return;
  try{const next=await api('coordinator/transcript?threadKey='+encodeURIComponent(key));if(!host.isConnected)return;transcript=next;render();
   // New transcript activity may come with a posted message or report; reload the conversation too.
   if(next.events.length!==seen){if(seen)onChange?.();seen=next.events.length;}}catch{}
  // Fast while a session runs, so replies and tool steps show as they are written.
  timer=setTimeout(poll,transcript?.running?1500:10000);
 }
 const answer=async body=>{try{await api('coordinator/sessions/'+encodeURIComponent(transcript.sessionID)+'/answer','POST',body);setTimeout(poll,600);}catch(error){notify?.(error.message);}};
 host.addEventListener('click',e=>{
  const option=e.target.closest('.chat-question [data-option]');
  if(option){
   const card=option.closest('[data-question]'),set=option.closest('fieldset');
   set.querySelectorAll('[data-option]').forEach(b=>b.setAttribute('aria-pressed',String(b===option)));
   const sets=[...card.querySelectorAll('fieldset')],chosen=sets.map(s=>[...s.querySelectorAll('[data-option]')].findIndex(b=>b.getAttribute('aria-pressed')==='true'));
   const send=card.querySelector('[data-send-answers]');
   if(!send){card.querySelectorAll('button').forEach(b=>b.disabled=true);answer({options:chosen});}
   else send.disabled=chosen.some(i=>i<0);
   return;
  }
  const send=e.target.closest('[data-send-answers]');
  if(send){const card=send.closest('[data-question]'),chosen=[...card.querySelectorAll('fieldset')].map(s=>[...s.querySelectorAll('[data-option]')].findIndex(b=>b.getAttribute('aria-pressed')==='true'));card.querySelectorAll('button').forEach(b=>b.disabled=true);answer({options:chosen});return;}
  const permission=e.target.closest('[data-permission]');
  if(permission){permission.closest('.chat-permission').querySelectorAll('button').forEach(b=>b.disabled=true);answer({permission:permission.dataset.permission});}
 });
 poll();
 return {thread(next){thread=next;render();},refresh:poll,destroy(){stopped=true;clearTimeout(timer);}};
}
