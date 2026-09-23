let installPrompt=null;
export const isStandalone=()=>matchMedia('(display-mode: standalone)').matches||navigator.standalone===true;
window.addEventListener('beforeinstallprompt',event=>{event.preventDefault();installPrompt=event;});
window.addEventListener('appinstalled',()=>{installPrompt=null;document.querySelector('#install-app')?.remove();});
export async function installApp(){
  if(!installPrompt)return false;
  const prompt=installPrompt;installPrompt=null;
  await prompt.prompt();await prompt.userChoice;return true;
}

let reachable=true,renderStatus=()=>{},probeServer=async()=>{},starting=false;
export async function startWorkbench({launch=()=>{window.location.href='skd-workbench://start';}}={}){
 if(starting)return;starting=true;
 const buttons=[...document.querySelectorAll('[data-start-workbench]')];
 for(const button of buttons){button.disabled=true;button.textContent='Starting…';}
 const note=document.querySelector('.offline-note');if(note)note.textContent='Allow your browser to open SKD Workbench Launcher. Waiting for the server…';
 try{
  launch();
  for(let attempt=0;attempt<30;attempt++){await probeServer();if(reachable)return;await new Promise(resolve=>setTimeout(resolve,1000));}
  if(note)note.textContent='Still unavailable. If the launcher is missing, open Launch SKD Workbench.command in the Workbench folder. You can try again without losing saved work.';
 }finally{starting=false;for(const button of buttons){button.disabled=false;button.textContent='Start Workbench';}renderStatus();}
}
export function serverAvailable(value){reachable=value;renderStatus();}
export function setupPWA({hasUnsaved,notify,onReconnect}){
 let registration,waiting=null,applying=false,changed=false,checking=false;
 const host=document.querySelector('#pwa-status');
 renderStatus=()=>{
  host.replaceChildren();
  if(reachable&&!waiting&&!changed)return;
  const banner=document.createElement('div');banner.className='pwa-banner';
  const copy=document.createElement('div');copy.className='status-copy';
  const title=document.createElement('strong'),detail=document.createElement('p'),button=document.createElement('button');
  title.textContent=!reachable?'Local server is unavailable':'An update is ready';
  detail.textContent=!reachable?'Start SKD Workbench, then reconnect. Unsaved edits stay in this window.':'Save your edits before reloading the app.';
  button.textContent=!reachable?'Reconnect':'Update app';button.id=!reachable?'pwa-reconnect':'pwa-update';
  button.onclick=async()=>{
   if(!reachable){await probe();if(!reachable)notify('Start the local server with Launch SKD Workbench.command, then reconnect.');return;}
   if(hasUnsaved()){notify('Save your edits and close any open dialog before updating.');return;}
   if(waiting){applying=true;waiting.postMessage({type:'SKIP_WAITING'});}else location.reload();
  };
  copy.append(title,detail);banner.append(copy);if(!reachable){const start=document.createElement('button');start.textContent=starting?'Starting…':'Start Workbench';start.disabled=starting;start.dataset.startWorkbench='';start.onclick=startWorkbench;banner.append(start);}banner.append(button);host.append(banner);
 };
 async function probe(){
  if(checking)return;checking=true;const was=reachable;
  try{const r=await fetch('/api/health',{cache:'no-store',signal:AbortSignal.timeout(1800)});const h=await r.json();serverAvailable(r.ok&&h.app==='skd-workbench'&&h.ok===true);}catch{serverAvailable(false);}finally{checking=false;}
  if(!was&&reachable)await onReconnect();
 }
 probeServer=probe;
 window.addEventListener('online',probe);window.addEventListener('offline',probe);window.addEventListener('focus',()=>{probe();registration?.update().catch(()=>{});});
 setInterval(()=>{if(document.visibilityState==='visible')probe();},10000);
 if('serviceWorker' in navigator){
  let controlled=Boolean(navigator.serviceWorker.controller);
  navigator.serviceWorker.addEventListener('controllerchange',()=>{
   if(applying){location.reload();return;}
   if(controlled){changed=true;waiting=null;renderStatus();}controlled=true;
  });
  navigator.serviceWorker.register('/sw.js',{updateViaCache:'none'}).then(reg=>{
   registration=reg;
   const check=()=>{if(reg.waiting&&navigator.serviceWorker.controller){waiting=reg.waiting;renderStatus();}};
   const observe=()=>reg.installing?.addEventListener('statechange',check);
   check();observe();reg.addEventListener('updatefound',observe);
  }).catch(()=>notify('Offline startup is unavailable in this browser. You can still use the workbench while the server is running.'));
 }
 renderStatus();
}
