// Side panel on every page: the all-projects coordinator (Chat, CLI) and the workspace shell (Shell).
// It lives on the body, so page navigation never rebuilds it; open state, tab and width are remembered.
// The shell starts only when Shell is chosen; a restored panel reattaches to a running shell and never starts one.
import {mountTerminal} from './terminal-ui.js';
import {mountCoordinatorConversation,mountProjectConversation} from './project-agent-ui.js';
const read=(key,fallback)=>{try{return localStorage.getItem(key)??fallback;}catch{return fallback;}};
const write=(key,value)=>{try{localStorage.setItem(key,value);}catch{}};
const tabs=['chat','cli','shell'];

export function createCoordinatorDock({api,modal,notify}){
 let panel=null,conversation=null,projectView=null,currentProject=null,shell=null,shellID=null,tab=tabs.includes(read('skd-dock-tab','chat'))?read('skd-dock-tab','chat'):'chat';
 const q=s=>panel.querySelector(s);
 function layout(open){document.body.classList.toggle('workspace-terminal-open',open);document.body.classList.toggle('coordinator-dock-open',open);document.querySelectorAll('[data-workspace-terminal]').forEach(b=>b.setAttribute('aria-expanded',String(open)));}
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
   <div class="dock-edge-tabs" role="group" aria-label="Panel"><button type="button" data-dock-tab="shell" aria-pressed="false" aria-label="Shell" title="Workspace shell"><svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="16" rx="2"/><path d="m7 9 3 3-3 3M12 15h5"/></svg></button><button type="button" data-dock-hide aria-label="Hide" title="Hide panel"><svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M15 4v16M8 10l2 2-2 2"/></svg></button></div>
   <div class="dock-conversation"></div>
   <div class="dock-project" hidden></div>
   <div class="dock-shell" hidden><div class="dock-shell-screen"></div><p class="field-help dock-shell-empty"></p></div>`;
  document.body.append(panel);resizer(q('.terminal-resize-edge'));
  conversation=mountCoordinatorConversation(q('.dock-conversation'),{api,modal,notify});
  panel.addEventListener('click',e=>{
   // Shell toggles between the workspace shell and the conversations; Chat / CLI live in each pane's header.
   const t=e.target.closest('[data-dock-tab]');if(t){show(tab==='shell'?conversation.mode():'shell',{start:true});return;}
   if(e.target.closest('[data-dock-hide]')){hide();return;}
   if(e.target.closest('[data-coordinator-open-cli]')){show('cli');return;}
   if(e.target.closest('[data-dock-start-shell]'))startShell();
  });
  // Agent session terminals use the same side of the screen; opening one hides this panel.
  document.addEventListener('terminal-panel-open',()=>{if(!panel.hidden)hide();});
 }
 function mountShell(session){
  if(shell&&shellID===session.id)return;shell?.dispose();shellID=session.id;q('.dock-shell-empty').innerHTML='';
  shell=mountTerminal({session,api,onChange:s=>{if(s.status!=='running')q('.dock-shell-empty').innerHTML='<button type="button" class="primary" data-dock-start-shell>Start shell</button>';},inline:{host:q('.dock-shell-screen'),endpoint:'workspace-terminal/',stopPath:id=>'workspace-terminal/'+encodeURIComponent(id)+'/stop',eyebrow:session.cwd,title:'Workspace terminal',endLabel:'End session',footer:'Hiding this panel keeps the shell running. Commands run in the Workbench folder.'}});
 }
 async function startShell(){try{mountShell(await api('workspace-terminal','POST',{}));}catch(error){notify(error.message);}}
 async function attachShell(start){
  try{const {session}=await api('workspace-terminal');
   if(session?.status==='running')mountShell(session);
   else if(start)await startShell();
   else if(!shell)q('.dock-shell-empty').innerHTML='No shell is running. <button type="button" class="primary" data-dock-start-shell>Start shell</button>';
  }catch(error){notify(error.message);}
 }
 async function show(next=tab,{start=false}={}){
  if(!panel)build();
  tab=tabs.includes(next)?next:'chat';write('skd-dock-tab',tab);write('skd-dock-open','1');
  if(panel.hidden){document.dispatchEvent(new Event('coordinator-dock-show'));panel.hidden=false;layout(true);}
  panel.querySelectorAll('[data-dock-tab]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.dockTab===tab)));
  const isShell=tab==='shell';q('.dock-conversation').hidden=isShell;q('.dock-shell').hidden=!isShell;syncProject();
  if(isShell)await attachShell(start);else{conversation.setMode(tab);conversation.refresh();}
 }
 // On a project page the panel splits: the coordinator on top, that project's agent below (Chat and CLI only).
 function syncProject(){
  if(!panel)return;const slot=q('.dock-project'),split=!!currentProject&&tab!=='shell';
  if(projectView&&projectView.projectID!==currentProject?.id){projectView.destroy();projectView=null;slot.innerHTML='';}
  if(currentProject&&!projectView)projectView=mountProjectConversation(slot,{project:currentProject,api,modal,notify});
  slot.hidden=!split;panel.classList.toggle('dock-split',split);document.body.classList.toggle('dock-project-split',split&&!panel.hidden);
 }
 function hide(){if(!panel)return;panel.hidden=true;layout(false);document.body.classList.remove('dock-project-split');write('skd-dock-open','0');}
 document.addEventListener('coordinator-dock-open',e=>show(e.detail?.tab||tab,{start:e.detail?.tab==='shell'}));
 return {
  toggle(){if(panel&&!panel.hidden)hide();else show(tab,{start:tab==='shell'});},
  show,hide,isOpen:()=>!!panel&&!panel.hidden,
  // The page tells the panel which project it shows (null elsewhere); nothing mounts until the panel is built.
  setProject(project){currentProject=project?.folderPath?project:null;syncProject();if(!currentProject)document.body.classList.remove('dock-project-split');},
  restore(){if(read('skd-dock-open','0')==='1')show(tab);}
 };
}
