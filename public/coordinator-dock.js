// Side panel on every page, always open: the all-projects coordinator, or inside a project that project's agent.
// It lives on the body, so page navigation never rebuilds it; open state, tab and width are remembered.
import {mountCoordinatorConversation,mountProjectConversation} from './project-agent-ui.js';
const read=(key,fallback)=>{try{return localStorage.getItem(key)??fallback;}catch{return fallback;}};
const write=(key,value)=>{try{localStorage.setItem(key,value);}catch{}};
const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));


export function createCoordinatorDock({api,modal,notify}){
 let panel=null,conversation=null,projectView=null,currentProject=null,running=[],runningLoaded=false,poll=null,splitProject=read('skd-dock-split','')||null,tab=['chat','cli'].includes(read('skd-dock-tab','chat'))?read('skd-dock-tab','chat'):'chat';
 const q=s=>panel.querySelector(s);
 function layout(open){document.body.classList.toggle('coordinator-dock-open',open);document.querySelectorAll('[data-workspace-terminal]').forEach(b=>b.setAttribute('aria-expanded',String(open)));}
 function resizer(edge){
  let preferred=Number(read('workspace-terminal-width',''))||undefined,pointer=null;
  const maximum=()=>Math.max(320,innerWidth-280);
  const apply=(value,save=false)=>{const width=Math.round(Math.max(320,Math.min(maximum(),value)));document.body.style.setProperty('--workspace-terminal-width',width+'px');edge.setAttribute('aria-valuemin','320');edge.setAttribute('aria-valuemax',maximum());edge.setAttribute('aria-valuenow',width);if(save){preferred=width;write('workspace-terminal-width',String(width));}};
  const viewport=()=>apply(preferred||Math.min(640,Math.max(400,innerWidth*.4)));
  const finish=()=>{if(pointer===null)return;pointer=null;document.body.classList.remove('terminal-resizing');};
  edge.onpointerdown=e=>{if(e.button!==0)return;e.preventDefault();pointer=e.pointerId;edge.setPointerCapture(pointer);edge.focus();document.body.classList.add('terminal-resizing');};
  edge.onpointermove=e=>{if(e.pointerId===pointer)apply(innerWidth-e.clientX,true);};
  edge.onpointerup=finish;edge.onpointercancel=finish;edge.onlostpointercapture=finish;
  edge.onkeydown=e=>{const current=panel.getBoundingClientRect().width,values={ArrowLeft:current+32,ArrowRight:current-32,Home:320,End:maximum()};if(e.key in values){e.preventDefault();apply(values[e.key],true);}};
  addEventListener('resize',viewport);viewport();
 }
 function build(){
  panel=document.createElement('aside');panel.className='coordinator-dock';panel.setAttribute('aria-label','Coordinator panel');panel.hidden=true;
  panel.innerHTML=`<div class="terminal-resize-edge" tabindex="0" role="separator" aria-label="Resize panel" aria-orientation="vertical"></div>

   <div class="dock-conversation"></div>
   <div class="dock-project" hidden></div>
   <nav class="dock-agents" aria-label="Running project agents" hidden></nav>
`;
  document.body.append(panel);resizer(q('.terminal-resize-edge'));
  conversation=mountCoordinatorConversation(q('.dock-conversation'),{api,modal,notify});
  panel.addEventListener('click',e=>{
   if(e.target.closest('[data-coordinator-open-cli]')){show('cli');return;}
   const row=e.target.closest('[data-dock-agent]');if(row){splitProject=splitProject===row.dataset.dockAgent?null:row.dataset.dockAgent;write('skd-dock-split',splitProject||'');syncProject();return;}
  });
  // Often enough that Working shows while an agent is producing output.
  poll=setInterval(()=>{if(!panel.hidden&&document.visibilityState==='visible')loadRunning();},4000);
  // Always open, except that an agent session terminal (body.terminal-open) takes this side while it is shown;
  // the panel steps aside and comes back when that terminal is hidden or closed.
  const away=()=>{const covered=document.body.classList.contains('terminal-open');if(panel.hidden!==covered){panel.hidden=covered;layout(!covered);if(!covered)syncProject();}};
  new MutationObserver(away).observe(document.body,{attributes:true,attributeFilter:['class']});
 }
 async function show(next=tab,{start=false}={}){
  if(!panel)build();
  tab=['chat','cli'].includes(next)?next:'chat';write('skd-dock-tab',tab);write('skd-dock-open','1');
  if(panel.hidden){document.dispatchEvent(new Event('coordinator-dock-show'));panel.hidden=false;layout(true);}
  panel.querySelectorAll('[data-dock-tab]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.dockTab===tab)));
  syncProject();conversation.setMode(tab);conversation.refresh();loadRunning();
 }
 // Project agents (live, or ended in the last 12 hours); on Home and the global pages each is a pill that opens it in a split.
 async function loadRunning(){try{running=(await api('coordinator')).running||[];runningLoaded=true;}catch{return;}syncProject();}
 function renderAgents(){
  const nav=q('.dock-agents'),rows=currentProject?[]:running;nav.hidden=!rows.length;
  const labels={on:'Session on',working:'Working',waiting:'Needs you',off:'Off'};
  nav.innerHTML=rows.map(r=>{const open=r.projectID===splitProject,state=r.state||'on',label=labels[state]||state;return `<button type="button" class="dock-agent-pill" data-state="${esc(state)}" data-dock-agent="${esc(r.projectID)}" aria-pressed="${open}" title="${esc(r.name)} agent · ${esc(label)}${open?' · click to close':' · click to open'}"><span class="dock-agent-dot" aria-hidden="true"></span>${esc(r.name)}<span class="visually-hidden">, ${esc(label)}</span></button>`;}).join('');
 }
 // On a project page the panel splits: the coordinator on top, that project's agent below (Chat and CLI only).
 function syncProject(){
  if(!panel)return;const slot=q('.dock-project'),inside=!!currentProject;
  // A split closes when its agent's session ends.
  const target=inside?null:running.find(r=>r.projectID===splitProject);
  if(!inside&&splitProject&&!target&&runningLoaded){splitProject=null;write('skd-dock-split','');}
  const shown=currentProject||(target?{id:target.projectID,name:target.name,folderPath:target.folderPath}:null);
  if(projectView&&projectView.projectID!==shown?.id){projectView.destroy();projectView=null;slot.innerHTML='';}
  // Each view gets its own element: a replaced view's listeners and late refreshes then act on nothing.
  if(shown&&!projectView){const own=document.createElement('div');own.className='dock-project-view';slot.replaceChildren(own);projectView=mountProjectConversation(own,{project:shown,api,modal,notify});}
  // Inside a project the panel is that project's agent only; on Home and the global pages it is the coordinator,
  // with a running project agent below it when its row is open.
  slot.hidden=!shown;q('.dock-conversation').hidden=inside;panel.classList.toggle('dock-project-only',inside);panel.classList.toggle('dock-split',!inside&&!!shown);document.body.classList.toggle('dock-project-split',inside&&!panel.hidden);
  renderAgents();
 }
 function hide(){if(!panel)return;panel.hidden=true;layout(false);document.body.classList.remove('dock-project-split');write('skd-dock-open','0');}
 document.addEventListener('coordinator-dock-open',e=>show(e.detail?.tab||tab));
 return {
  show,hide,isOpen:()=>!!panel&&!panel.hidden,
  // The page tells the panel which project it shows (null elsewhere); nothing mounts until the panel is built.
  setProject(project){currentProject=project?.folderPath?project:null;syncProject();if(!currentProject)document.body.classList.remove('dock-project-split');},
  restore(){if(read('skd-dock-open','0')==='1')show(tab);}
 };
}
