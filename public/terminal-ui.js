const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function mountTerminal({session,api,onChange,workspace=false}){
 let disposed=false,timer,cursor=0,queue=Promise.resolve(),latest=session,resizeTimer;
 function syncLayout(){document.body.classList.toggle('terminal-open',!!document.querySelector('.terminal-panel:not([hidden])'));document.body.classList.toggle('workspace-terminal-open',!!document.querySelector('.workspace-terminal-panel:not([hidden])'));}
 const previousFocus=document.activeElement;
 const endpoint=workspace?'workspace-terminal/':'terminal-sessions/';
 document.dispatchEvent(new Event('terminal-panel-open'));
 const panel=document.createElement('aside');panel.className='terminal-panel'+(workspace?' workspace-terminal-panel':'');panel.setAttribute('aria-label',workspace?'Workspace terminal':'Agent terminal');
 panel.innerHTML=`<header class="terminal-header"><div><span class="eyebrow">${workspace?esc(session.cwd):esc(session.agent)+' · '+esc(session.model)}</span><h2>${workspace?'Workspace terminal':'Session terminal'}</h2></div><div><button id="terminal-end">End session</button><button id="terminal-hide">Hide</button></div></header><p class="terminal-status" role="status">Connecting…</p><div class="terminal-screen"></div><p class="terminal-error" role="alert"></p><footer>${workspace?'Hiding this panel keeps the shell running. Commands run in the Workbench folder.':'Closing this panel keeps the session running. Changes are never merged automatically.'}</footer>`;

 let removeResizer=()=>{};
 if(workspace){
  const edge=document.createElement('div');edge.className='terminal-resize-edge';edge.tabIndex=0;edge.setAttribute('role','separator');edge.setAttribute('aria-label','Resize terminal');edge.setAttribute('aria-orientation','vertical');panel.prepend(edge);
  let preferred;try{preferred=Number(localStorage.getItem('workspace-terminal-width'))||undefined;}catch{}
  const maximum=()=>Math.max(320,innerWidth-280);
  function apply(value,save=false){const width=Math.round(Math.max(320,Math.min(maximum(),value)));document.body.style.setProperty('--workspace-terminal-width',width+'px');edge.setAttribute('aria-valuemin','320');edge.setAttribute('aria-valuemax',maximum());edge.setAttribute('aria-valuenow',width);if(save){preferred=width;try{localStorage.setItem('workspace-terminal-width',String(width));}catch{}}}
  const viewport=()=>apply(preferred||Math.min(640,Math.max(400,innerWidth*.4)));
  let pointer=null;
  const finish=()=>{if(pointer===null)return;pointer=null;document.body.classList.remove('terminal-resizing');};
  edge.onpointerdown=e=>{if(e.button!==0)return;e.preventDefault();pointer=e.pointerId;edge.setPointerCapture(pointer);edge.focus();document.body.classList.add('terminal-resizing');};
  edge.onpointermove=e=>{if(e.pointerId===pointer)apply(innerWidth-e.clientX,true);};
  edge.onpointerup=finish;edge.onpointercancel=finish;edge.onlostpointercapture=finish;
  edge.onkeydown=e=>{const current=panel.getBoundingClientRect().width;const values={ArrowLeft:current+32,ArrowRight:current-32,Home:320,End:maximum()};if(e.key in values){e.preventDefault();apply(values[e.key],true);}};
  window.addEventListener('resize',viewport);viewport();removeResizer=()=>{finish();window.removeEventListener('resize',viewport);};
 }
 document.body.append(panel);syncLayout();
 const status=panel.querySelector('.terminal-status'),error=panel.querySelector('.terminal-error'),end=panel.querySelector('#terminal-end');
 const terminal=new window.Terminal({cursorBlink:true,fontFamily:'Menlo, Monaco, monospace',fontSize:13,scrollback:3000,allowProposedApi:false,theme:{background:'#101010',foreground:'#eeeeee',cursor:'#e9b77f'}}),fit=new window.FitAddon.FitAddon();terminal.loadAddon(fit);terminal.open(panel.querySelector('.terminal-screen'));
 const running=()=>latest.status==='running';
 const send=(action,data)=>{queue=queue.then(async()=>{if(disposed)return;try{await api(endpoint+session.id+'/'+action,'POST',data);error.textContent='';}catch(e){error.textContent=e.message+' Input was not retried.';}});};
 const dataSubscription=terminal.onData(data=>{if(running())send('input',{data});});
 function resize(){if(disposed||panel.hidden)return;fit.fit();if(running())send('resize',{cols:Math.max(20,Math.min(400,terminal.cols)),rows:Math.max(5,Math.min(200,terminal.rows))});}
 const observer=new ResizeObserver(()=>{clearTimeout(resizeTimer);resizeTimer=setTimeout(resize,80);});observer.observe(panel.querySelector('.terminal-screen'));
 const hide=()=>{panel.hidden=true;syncLayout();previousFocus?.isConnected&&previousFocus.focus();onChange?.(latest,false);};
 panel.querySelector('#terminal-hide').onclick=hide;document.addEventListener('terminal-panel-open',hide);
 end.onclick=async()=>{end.disabled=true;try{latest=await api(endpoint+session.id+'/stop','POST',{});await poll();}catch(e){error.textContent=e.message;end.disabled=false;}};
 let polling=false;
 async function poll(){if(disposed||polling)return;polling=true;clearTimeout(timer);try{const r=await api(endpoint+session.id+'/output?cursor='+cursor);if(disposed)return;if(r.reset){terminal.reset();terminal.writeln('[Earlier terminal output is no longer available]');}if(r.data)await new Promise(resolve=>terminal.write(r.data,resolve));cursor=r.cursor;latest=r.session;status.textContent=latest.status+(latest.reset?' · workspace '+latest.reset.status:'');end.disabled=!running();terminal.options.disableStdin=!running();onChange?.(latest,!panel.hidden);error.textContent='';}catch(e){if(!disposed)error.textContent=e.message+' Reconnecting…';}finally{polling=false;if(!disposed)timer=setTimeout(poll,400);}}
 resize();terminal.focus();poll();
 return {show(){document.dispatchEvent(new Event('terminal-panel-open'));panel.hidden=false;syncLayout();resize();terminal.focus();onChange?.(latest,true);},dispose(){document.removeEventListener('terminal-panel-open',hide);disposed=true;removeResizer();clearTimeout(timer);clearTimeout(resizeTimer);observer.disconnect();dataSubscription.dispose();terminal.dispose();panel.remove();syncLayout();}};
}
