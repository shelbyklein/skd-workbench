const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
// inline: {host,endpoint,stopPath,eyebrow,title,footer,endLabel} renders inside host instead of the side panel.
export function mountTerminal({session,api,onChange,workspace=false,inline=null}){
 let disposed=false,timer,cursor=0,latest=session,resizeTimer;
 function syncLayout(){if(inline)return;document.body.classList.toggle('terminal-open',!!document.querySelector('.terminal-panel:not([hidden])'));document.body.classList.toggle('workspace-terminal-open',!!document.querySelector('.workspace-terminal-panel:not([hidden])'));}
 const previousFocus=document.activeElement;
 const endpoint=inline?.endpoint||(workspace?'workspace-terminal/':'terminal-sessions/');
 if(!inline)document.dispatchEvent(new Event('terminal-panel-open'));
 const panel=document.createElement(inline?'section':'aside');panel.className=inline?'coordinator-terminal':'terminal-panel'+(workspace?' workspace-terminal-panel':'');panel.setAttribute('aria-label',inline?inline.title:workspace?'Workspace terminal':'Agent terminal');
 if(inline)panel.innerHTML=`<header class="terminal-header"><div><span class="eyebrow">${esc(inline.eyebrow)}</span><h2>${esc(inline.title)}</h2></div><div><button type="button" id="terminal-end">${esc(inline.endLabel||'Stop session')}</button></div></header><p class="terminal-status" role="status">Connecting…</p><div class="terminal-screen"></div><p class="terminal-error" role="alert"></p><footer>${esc(inline.footer||'')}</footer>`;
 else panel.innerHTML=`<header class="terminal-header"><div><span class="eyebrow">${workspace?esc(session.cwd):esc(session.agent)+' · '+esc(session.model)}</span><h2>${workspace?'Workspace terminal':'Session terminal'}</h2></div><div><button id="terminal-end">End session</button><button id="terminal-hide">Hide</button></div></header><p class="terminal-status" role="status">Connecting…</p><div class="terminal-screen"></div><p class="terminal-error" role="alert"></p><footer>${workspace?'Hiding this panel keeps the shell running. Commands run in the Workbench folder.':'Closing this panel keeps the session running. Changes are never merged automatically.'}</footer>`;

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
 (inline?.host||document.body).append(panel);syncLayout();
 const status=panel.querySelector('.terminal-status'),error=panel.querySelector('.terminal-error'),end=panel.querySelector('#terminal-end');
 const terminal=new window.Terminal({cursorBlink:true,fontFamily:'Menlo, Monaco, monospace',fontSize:13,scrollback:3000,allowProposedApi:false,theme:{background:'#101010',foreground:'#eeeeee',cursor:'#e9b77f'}}),fit=new window.FitAddon.FitAddon();terminal.loadAddon(fit);terminal.open(panel.querySelector('.terminal-screen'));
 const running=()=>latest.status==='running';
 let socket=null,connected=false,rendering=false,retryDelay=250;
 terminal.options.disableStdin=true;
 const send=(action,data)=>{
  if(!connected||socket?.readyState!==WebSocket.OPEN){if(action==='input')error.textContent='Terminal disconnected. Input was not sent.';return;}
  if(action==='input'&&data.data.length>65536){error.textContent='Paste is too large. Input was not sent; try a smaller paste.';return;}
  const messages=[];
  if(action==='input'){for(let offset=0;offset<data.data.length;){let end=Math.min(data.data.length,offset+4096);if(end<data.data.length&&/[\uD800-\uDBFF]/.test(data.data[end-1]))end--;messages.push(JSON.stringify({type:'input',data:data.data.slice(offset,end)}));offset=end;}}
  else messages.push(JSON.stringify({type:action,...data}));
  const bytes=messages.reduce((sum,message)=>sum+new TextEncoder().encode(message).length,0);
  if(bytes+socket.bufferedAmount>262144){error.textContent='Terminal input is busy or paste is too large. Input was not sent; try a smaller paste.';return;}
  try{for(const message of messages)socket.send(message);}catch{error.textContent='Terminal connection lost. Input may be incomplete and was not retried.';}
 };
 const dataSubscription=terminal.onData(data=>{if(running())send('input',{data});});
 function resize(){if(disposed||panel.hidden)return;fit.fit();if(running())send('resize',{cols:Math.max(20,Math.min(400,terminal.cols)),rows:Math.max(5,Math.min(200,terminal.rows))});}
 const observer=new ResizeObserver(()=>{clearTimeout(resizeTimer);resizeTimer=setTimeout(resize,80);});observer.observe(panel.querySelector('.terminal-screen'));
 const hide=()=>{panel.hidden=true;syncLayout();previousFocus?.isConnected&&previousFocus.focus();onChange?.(latest,false);};
 if(!inline){panel.querySelector('#terminal-hide').onclick=hide;document.addEventListener('terminal-panel-open',hide);}
 end.onclick=async()=>{end.disabled=true;try{latest=await api(inline?.stopPath?inline.stopPath(session.id):endpoint+session.id+'/stop','POST',{});onChange?.(latest,!panel.hidden);}catch(e){error.textContent=e.message;end.disabled=false;}};
 function connect(){
  if(disposed)return;
  if(rendering){timer=setTimeout(connect,50);return;}
  const ws=new WebSocket(`${location.protocol==='https:'?'wss:':'ws:'}//${location.host}/api/${endpoint}${session.id}/stream?cursor=${cursor}`);socket=ws;
  ws.onmessage=event=>{
   if(disposed||ws!==socket)return;
   let frame;try{frame=JSON.parse(event.data);if(frame.type!=='output'||typeof frame.data!=='string'||!Number.isSafeInteger(frame.cursor))throw Error();}catch{ws.close();return;}
   rendering=true;
   if(frame.reset){terminal.reset();terminal.writeln('[Earlier terminal output is no longer available]');}
   const rendered=()=>{
    rendering=false;if(disposed)return;cursor=frame.cursor;latest=frame.session||latest;
    status.textContent=latest.status+(latest.reset?' · workspace '+latest.reset.status:'');end.disabled=!running();if(inline)end.hidden=!running();
    if(frame.session)onChange?.(latest,!panel.hidden);
    if(ws.readyState===WebSocket.OPEN){const wasConnected=connected;connected=true;retryDelay=250;terminal.options.disableStdin=!running();error.textContent='';ws.send(JSON.stringify({type:'ack',cursor}));if(!wasConnected)resize();}
   };
   if(frame.data)terminal.write(frame.data,rendered);else rendered();
  };
  ws.onclose=()=>{if(disposed||ws!==socket)return;connected=false;terminal.options.disableStdin=true;status.textContent='Disconnected';error.textContent='Reconnecting to this session. Input is never replayed.';clearTimeout(timer);timer=setTimeout(connect,retryDelay);retryDelay=Math.min(5000,retryDelay*2);};
  ws.onerror=()=>{};
 }
 resize();terminal.focus();connect();
 return {show(){document.dispatchEvent(new Event('terminal-panel-open'));panel.hidden=false;syncLayout();resize();terminal.focus();onChange?.(latest,true);},dispose(){document.removeEventListener('terminal-panel-open',hide);disposed=true;socket?.close();removeResizer();clearTimeout(timer);clearTimeout(resizeTimer);observer.disconnect();dataSubscription.dispose();terminal.dispose();panel.remove();syncLayout();}};
}
