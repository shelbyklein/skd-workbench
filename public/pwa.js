let installPrompt=null;
export const isStandalone=()=>matchMedia('(display-mode: standalone)').matches||navigator.standalone===true;
window.addEventListener('beforeinstallprompt',event=>{event.preventDefault();installPrompt=event;});
window.addEventListener('appinstalled',()=>{installPrompt=null;document.querySelector('#install-app')?.remove();});
export async function installApp(){
  if(!installPrompt)return false;
  const prompt=installPrompt;installPrompt=null;
  await prompt.prompt();await prompt.userChoice;return true;
}

let reachable=true,renderStatus=()=>{};
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
  copy.append(title,detail);banner.append(copy,button);host.append(banner);
 };
 async function probe(){
  if(checking)return;checking=true;const was=reachable;
  try{const r=await fetch('/api/health',{cache:'no-store',signal:AbortSignal.timeout(1800)});const h=await r.json();serverAvailable(r.ok&&h.app==='skd-workbench'&&h.ok===true);}catch{serverAvailable(false);}finally{checking=false;}
  if(!was&&reachable)await onReconnect();
 }
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
