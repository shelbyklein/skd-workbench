const logos={"claude": "<svg aria-hidden=\"true\" fill=\"currentColor\"  viewBox=\"0 0 24 24\" xmlns=\"http://www.w3.org/2000/svg\"><path d=\"m4.7144 15.9555 4.7174-2.6471.079-.2307-.079-.1275h-.2307l-.7893-.0486-2.6956-.0729-2.3375-.0971-2.2646-.1214-.5707-.1215-.5343-.7042.0546-.3522.4797-.3218.686.0608 1.5179.1032 2.2767.1578 1.6514.0972 2.4468.255h.3886l.0546-.1579-.1336-.0971-.1032-.0972L6.973 9.8356l-2.55-1.6879-1.3356-.9714-.7225-.4918-.3643-.4614-.1578-1.0078.6557-.7225.8803.0607.2246.0607.8925.686 1.9064 1.4754 2.4893 1.8336.3643.3035.1457-.1032.0182-.0728-.164-.2733-1.3539-2.4467-1.445-2.4893-.6435-1.032-.17-.6194c-.0607-.255-.1032-.4674-.1032-.7285L6.287.1335 6.6997 0l.9957.1336.419.3642.6192 1.4147 1.0018 2.2282 1.5543 3.0296.4553.8985.2429.8318.091.255h.1579v-.1457l.1275-1.706.2368-2.0947.2307-2.6957.0789-.7589.3764-.9107.7468-.4918.5828.2793.4797.686-.0668.4433-.2853 1.8517-.5586 2.9021-.3643 1.9429h.2125l.2429-.2429.9835-1.3053 1.6514-2.0643.7286-.8196.85-.9046.5464-.4311h1.0321l.759 1.1293-.34 1.1657-1.0625 1.3478-.8804 1.1414-1.2628 1.7-.7893 1.36.0729.1093.1882-.0183 2.8535-.607 1.5421-.2794 1.8396-.3157.8318.3886.091.3946-.3278.8075-1.967.4857-2.3072.4614-3.4364.8136-.0425.0304.0486.0607 1.5482.1457.6618.0364h1.621l3.0175.2247.7892.522.4736.6376-.079.4857-1.2142.6193-1.6393-.3886-3.825-.9107-1.3113-.3279h-.1822v.1093l1.0929 1.0686 2.0035 1.8092 2.5075 2.3314.1275.5768-.3218.4554-.34-.0486-2.2039-1.6575-.85-.7468-1.9246-1.621h-.1275v.17l.4432.6496 2.3436 3.5214.1214 1.0807-.17.3521-.6071.2125-.6679-.1214-1.3721-1.9246L14.38 17.959l-1.1414-1.9428-.1397.079-.674 7.2552-.3156.3703-.7286.2793-.6071-.4614-.3218-.7468.3218-1.4753.3886-1.9246.3157-1.53.2853-1.9004.17-.6314-.0121-.0425-.1397.0182-1.4328 1.9672-2.1796 2.9446-1.7243 1.8456-.4128.164-.7164-.3704.0667-.6618.4008-.5889 2.386-3.0357 1.4389-1.882.929-1.0868-.0062-.1579h-.0546l-6.3385 4.1164-1.1293.1457-.4857-.4554.0608-.7467.2307-.2429 1.9064-1.3114Z\"/></svg>", "codex": "<svg aria-hidden=\"true\" fill=\"currentColor\" fill-rule=\"evenodd\" height=\"1em\" style=\"flex:none;line-height:1\" viewBox=\"0 0 24 24\" width=\"1em\" xmlns=\"http://www.w3.org/2000/svg\"><path d=\"M9.205 8.658v-2.26c0-.19.072-.333.238-.428l4.543-2.616c.619-.357 1.356-.523 2.117-.523 2.854 0 4.662 2.212 4.662 4.566 0 .167 0 .357-.024.547l-4.71-2.759a.797.797 0 00-.856 0l-5.97 3.473zm10.609 8.8V12.06c0-.333-.143-.57-.429-.737l-5.97-3.473 1.95-1.118a.433.433 0 01.476 0l4.543 2.617c1.309.76 2.189 2.378 2.189 3.948 0 1.808-1.07 3.473-2.76 4.163zM7.802 12.703l-1.95-1.142c-.167-.095-.239-.238-.239-.428V5.899c0-2.545 1.95-4.472 4.591-4.472 1 0 1.927.333 2.712.928L8.23 5.067c-.285.166-.428.404-.428.737v6.898zM12 15.128l-2.795-1.57v-3.33L12 8.658l2.795 1.57v3.33L12 15.128zm1.796 7.23c-1 0-1.927-.332-2.712-.927l4.686-2.712c.285-.166.428-.404.428-.737v-6.898l1.974 1.142c.167.095.238.238.238.428v5.233c0 2.545-1.974 4.472-4.614 4.472zm-5.637-5.303l-4.544-2.617c-1.308-.761-2.188-2.378-2.188-3.948A4.482 4.482 0 014.21 6.327v5.423c0 .333.143.571.428.738l5.947 3.449-1.95 1.118a.432.432 0 01-.476 0zm-.262 3.9c-2.688 0-4.662-2.021-4.662-4.519 0-.19.024-.38.047-.57l4.686 2.71c.286.167.571.167.856 0l5.97-3.448v2.26c0 .19-.07.333-.237.428l-4.543 2.616c-.619.357-1.356.523-2.117.523zm5.899 2.83a5.947 5.947 0 005.827-4.756C22.287 18.339 24 15.84 24 13.296c0-1.665-.713-3.282-1.998-4.448.119-.5.19-.999.19-1.498 0-3.401-2.759-5.947-5.946-5.947-.642 0-1.26.095-1.88.31A5.962 5.962 0 0010.205 0a5.947 5.947 0 00-5.827 4.757C1.713 5.447 0 7.945 0 10.49c0 1.666.713 3.283 1.998 4.448-.119.5-.19 1-.19 1.499 0 3.401 2.759 5.946 5.946 5.946.642 0 1.26-.095 1.88-.309a5.96 5.96 0 004.162 1.713z\"></path></svg>"};
// Shared presentation for existing provider-backed controls; controls stay in their owning form.
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const instances=new WeakMap();
const keys=['agent','model','effort'];
export function requireAgentCards(host){
 for(const card of host.querySelectorAll('.agent-selection-card')){
  if(card.closest('details:not([open])'))continue;
  const api=instances.get(card);if(api&&!api.ready()){api.openMissing();return false;}
 }
 return true;
}
export function agentCard({agentNodes=[],modelNodes,effortNodes,seed=null,cacheKey='main',fixedAgent=null}){
 const nodes={agent:agentNodes.filter(Boolean),model:modelNodes.filter(Boolean),effort:effortNodes.filter(Boolean)};
 const anchor=nodes.agent[0]||nodes.model[0];if(!anchor||anchor.closest('.agent-selection-card'))return;
 let remembered=null;try{remembered=JSON.parse(localStorage.getItem('skd-agent-choice-'+cacheKey));}catch{}
 const desired=structuredClone(seed||remembered||{});
 const accepted={agent:!!(desired.agent||fixedAgent),model:!!desired.model,effort:!!desired.effort};
 const card=document.createElement('div');card.className='agent-selection-card';card.setAttribute('role','group');card.setAttribute('aria-label','Provider, model and effort');anchor.before(card);
 const buttons={},panels={},applied={},previous={};
 let restoring=false;
 const read=k=>{
  const p=panels[k];
  if(k==='agent'&&fixedAgent)return {value:fixedAgent,label:fixedAgent==='claude'?'Claude':'Codex'};
  const radio=p.querySelector('input[type=radio]:checked'),select=p.querySelector('select');
  if(radio)return {value:radio.value,label:radio.parentElement.textContent.trim()};
  if(select&&!select.hidden)return {value:select.value,label:select.selectedOptions[0]?.textContent||select.value};
  if(k==='effort'){const slider=p.querySelector('input[type=range]');return {value:slider?.dataset.value||slider?.getAttribute('aria-valuetext')||p.querySelector('output')?.textContent||'',label:slider?.dataset.value||slider?.getAttribute('aria-valuetext')||p.querySelector('output')?.textContent||''};}
  return {value:'',label:''};
 };
 function remember(){
  // A pending restore keeps its cached value; everything else mirrors the live control.
  const value=Object.fromEntries(keys.map(k=>[k,!accepted[k]?null:desired[k]&&!applied[k]?desired[k]:(v=>v&&v!=='—'?v:null)(read(k).value)]));
  try{localStorage.setItem('skd-agent-choice-'+cacheKey,JSON.stringify(value));}catch{}
 }
 function refresh(){
  for(const k of keys){
   const p=panels[k],want=desired[k];
   if(want&&!applied[k]){
    const input=[...p.querySelectorAll('input[type=radio]')].find(el=>el.value===want);
    const slider=p.querySelector('input[type=range]');
    if(input){applied[k]=true;if(!input.checked){input.checked=true;restoring=true;input.dispatchEvent(new Event('change',{bubbles:true}));restoring=false;}}
    else if(k==='agent'&&fixedAgent)applied[k]=true;
    else if(slider&&(!desired.model||applied.model)){
     const ticks=[...p.querySelectorAll('.effort-ticks span')].map(el=>el.textContent);
     const index=ticks.indexOf(want);
     if(index>=0){applied[k]=true;if(read(k).value!==want){slider.value=index;restoring=true;slider.dispatchEvent(new Event('input',{bubbles:true}));restoring=false;}}
    }
   }
   const value=read(k);if(previous[k]===undefined&&value.value)previous[k]=value.value;const present=accepted[k]&&(!desired[k]||applied[k])&&value.value&&value.value!=='—';
   const label=present?value.label:(k==='agent'?'Provider':k[0].toUpperCase()+k.slice(1));
   const html=(k==='agent'&&present?(logos[value.value]||''):'')+'<span>'+esc(label)+'</span><span class="agent-pill-chevron" aria-hidden="true">⌄</span>';
   if(buttons[k].innerHTML!==html)buttons[k].innerHTML=html;
   buttons[k].setAttribute('aria-label',((k==='agent'?'Provider':k[0].toUpperCase()+k.slice(1)))+': '+label);
   buttons[k].dataset.placeholder=String(!present);
  }
 }
 function close(k){if(panels[k].matches(':popover-open'))panels[k].hidePopover();}
 // The overlay takes the card's own footprint, so options replace the pills in place.
 function place(k){
  const p=panels[k],rect=card.getBoundingClientRect(),pill=buttons[k].getBoundingClientRect();
  p.style.left=rect.left+'px';p.style.top=rect.top+'px';p.style.width=rect.width+'px';p.style.minHeight=rect.height+'px';
  // Options grow out of the pill that was pressed, so they read as its second state.
  p.style.setProperty('--origin-x',(pill.left+pill.width/2-rect.left)+'px');
  p.style.setProperty('--origin-y',(pill.top+pill.height/2-rect.top)+'px');
 }
 const replace=()=>{if(!card.isConnected){removeEventListener('scroll',replace,true);removeEventListener('resize',replace);return;}keys.forEach(k=>{if(panels[k]?.matches(':popover-open'))place(k);});};
 addEventListener('scroll',replace,true);addEventListener('resize',replace);
 function open(k){
  keys.forEach(other=>{if(other!==k)close(other);});
  refresh();const p=panels[k];place(k);
  p.showPopover();buttons[k].setAttribute('aria-expanded','true');
  (p.querySelector('input:checked')||p.querySelector('input:not(:disabled),button'))?.focus();
 }
 for(const k of keys){
  const button=document.createElement('button');button.type='button';button.className='agent-selection-pill';button.dataset.agentParameter=k;button.setAttribute('aria-haspopup','dialog');button.setAttribute('aria-expanded','false');buttons[k]=button;card.append(button);
  const panel=document.createElement('div');panel.className='agent-options-overlay';panel.dataset.overlayFor=k;panel.popover='auto';panel.inert=true;panel.setAttribute('role','dialog');panel.setAttribute('aria-label','Choose '+(k==='agent'?'provider':k));panels[k]=panel;card.append(panel);
  nodes[k].forEach(node=>panel.append(node));
  if(k==='agent')panel.querySelectorAll('input[type=radio]').forEach(input=>{const span=input.nextElementSibling;if(span&&logos[input.value])span.insertAdjacentHTML('afterbegin',logos[input.value]);});
  if(k==='agent'&&fixedAgent)panel.innerHTML='<p>'+logos[fixedAgent]+' '+(fixedAgent==='claude'?'Claude':'Codex')+'</p><p class="field-help">This workflow uses '+fixedAgent+'.</p>';
  const done=document.createElement('button');done.type='button';done.className='agent-options-done';done.textContent='Done';panel.append(done);
  done.onclick=()=>{if(read(k).value){accepted[k]=true;remember();refresh();}close(k);button.focus();};
  const commitChoice=input=>{
   if(!input||input.type!=='radio')return;
   const changed=previous[k]!==input.value;previous[k]=input.value;
   accepted[k]=true;applied[k]=true;delete desired[k];
   // Dependents follow the owning form's new defaults instead of reverting to placeholders or a stale restore.
   if(k==='agent'&&changed){delete desired.model;delete desired.effort;}
   if(k==='model'&&changed)delete desired.effort;
   remember();refresh();
  };
  panel.addEventListener('change',event=>{if(!restoring)commitChoice(event.target);});
  panel.addEventListener('click',event=>{
   // Handle the input's activation once, after label forwarding and native selection.
   const input=event.target.closest('input[type=radio]');if(!input)return;
   commitChoice(input);if(event.detail>0)queueMicrotask(()=>{close(k);button.focus();}); // arrow-key clicks keep the overlay open
  });
  panel.addEventListener('input',()=>{if(restoring)return;if(k==='effort'){accepted.effort=true;applied.effort=true;delete desired.effort;}queueMicrotask(()=>{refresh();remember();});});
  panel.addEventListener('keydown',event=>{if(event.key==='Enter'&&event.target.matches('input')){event.preventDefault();done.click();}});
  panel.addEventListener('beforetoggle',event=>{card.dataset.open=String(event.newState==='open'||keys.some(o=>o!==k&&panels[o].matches(':popover-open')));panel.inert=event.newState!=='open';panel.setAttribute('aria-hidden',String(panel.inert));});
  panel.addEventListener('toggle',()=>{button.setAttribute('aria-expanded',String(panel.matches(':popover-open')));});
  let pointerWasOpen=false;
  button.onpointerdown=()=>{pointerWasOpen=panel.matches(':popover-open');};
  button.onclick=event=>{if(panel.matches(':popover-open')||(event.detail>0&&pointerWasOpen))close(k);else open(k);pointerWasOpen=false;};
 }
 const observer=new MutationObserver(()=>{if(!card.isConnected){observer.disconnect();return;}refresh();if(keys.some(k=>accepted[k]))remember();});
 keys.forEach(k=>observer.observe(panels[k],{subtree:true,childList:true,characterData:true,attributes:true,attributeFilter:['aria-valuetext','max','disabled']}));
 refresh();
 const api={acceptCurrent:()=>{keys.forEach(k=>{accepted[k]=!!read(k).value;delete desired[k];});refresh();remember();},ready:()=>keys.every(k=>accepted[k]&&(!desired[k]||applied[k])&&read(k).value&&read(k).value!=='—'),openMissing:()=>open(keys.find(k=>!accepted[k]||(desired[k]&&!applied[k])||!read(k).value)||'agent')};
 instances.set(card,api);return api;
}
export function workflowAgentCard(row,model,effort,provider=null){
 const modelLabel=model.closest('label'),effortLabel=effort.closest('label'),group=document.createElement('div'),slider=document.createElement('input'),ticks=document.createElement('div'),output=document.createElement('output');
 group.className='pill-options';model.hidden=true;modelLabel.append(group);
 const name='workflow-card-'+crypto.randomUUID();
 function choices(){
  group.replaceChildren();
  for(const option of model.options){
   if(!option.value)continue;
   const label=document.createElement('label');label.className='choice-pill';
   label.innerHTML='<input type="radio" name="'+name+'" value="'+esc(option.value)+'" '+(option.selected?'checked':'')+'><span>'+esc(option.textContent)+'</span>';
   label.querySelector('input').onchange=()=>{model.value=option.value;model.dispatchEvent(new Event('change',{bubbles:true}));sync();};group.append(label);
  }
 }
 effort.hidden=true;slider.type='range';slider.min=0;slider.step=1;slider.setAttribute('aria-label','Effort');effortLabel.append(output,slider);ticks.className='effort-ticks';effortLabel.append(ticks);
 function sync(){
  const options=[...effort.options].filter(o=>o.value);
  slider.max=Math.max(0,options.length-1);slider.disabled=options.length<2;slider.value=Math.max(0,options.findIndex(o=>o.selected));slider.setAttribute('aria-valuetext',effort.value);output.textContent=effort.value;
  ticks.innerHTML=options.map(o=>'<span>'+esc(o.value)+'</span>').join('');group.querySelectorAll('input').forEach(r=>r.checked=r.value===model.value);
 }
 slider.oninput=()=>{effort.selectedIndex=Number(slider.value);effort.dispatchEvent(new Event('change',{bubbles:true}));sync();};
 model.addEventListener('change',sync);choices();sync();
 const agentNodes=[];
 if(provider){
  const label=provider.closest('label'),radios=document.createElement('div');radios.className='pill-options';provider.hidden=true;label.append(radios);
  for(const option of provider.options){const item=document.createElement('label');item.className='choice-pill';item.innerHTML='<input type="radio" name="'+name+'-provider" value="'+esc(option.value)+'" '+(option.selected?'checked':'')+'><span>'+esc(option.textContent)+'</span>';item.querySelector('input').onchange=()=>{provider.value=option.value;provider.dispatchEvent(new Event('change',{bubbles:true}));};radios.append(item);}
  agentNodes.push(label);
 }
 const card=agentCard({agentNodes,modelNodes:[modelLabel],effortNodes:[effortLabel],fixedAgent:provider?null:'codex',seed:{agent:provider?.value||'codex',model:model.value,effort:effort.value},cacheKey:'workflow'});
 model.addEventListener('change',()=>card?.acceptCurrent());
 return {refresh(){choices();sync();card?.acceptCurrent();}};
}

export function primeAgentCache(runs){
 try{
  if(localStorage.getItem('skd-agent-choice-main'))return;
  const latest=[...runs].sort((a,b)=>String(b.createdAt).localeCompare(String(a.createdAt))).find(r=>r.agent&&r.model&&r.effort);
  if(latest)localStorage.setItem('skd-agent-choice-main',JSON.stringify({agent:latest.agent,model:latest.model,effort:latest.effort}));
 }catch{}
}
