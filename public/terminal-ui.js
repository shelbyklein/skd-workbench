const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function mountTerminal({session,api,onChange}){
 let disposed=false,timer,cursor=0,queue=Promise.resolve(),latest=session,resizeTimer;
 const previousFocus=document.activeElement;
 const panel=document.createElement('aside');panel.className='terminal-panel';panel.setAttribute('aria-label','Agent terminal');
 panel.innerHTML=`<header class="terminal-header"><div><span class="eyebrow">${esc(session.agent)} · ${esc(session.model)}</span><h2>Session terminal</h2></div><div><button id="terminal-end">End session</button><button id="terminal-hide">Hide</button></div></header><p class="terminal-status" role="status">Connecting…</p><div class="terminal-screen"></div><p class="terminal-error" role="alert"></p><footer>Closing this panel keeps the session running. Changes are never merged automatically.</footer>`;
 document.body.append(panel);document.body.classList.add('terminal-open');
 const status=panel.querySelector('.terminal-status'),error=panel.querySelector('.terminal-error'),end=panel.querySelector('#terminal-end');
 const terminal=new window.Terminal({cursorBlink:true,fontFamily:'Menlo, Monaco, monospace',fontSize:13,scrollback:3000,allowProposedApi:false,theme:{background:'#202520',foreground:'#edf0e7',cursor:'#e9b77f'}}),fit=new window.FitAddon.FitAddon();terminal.loadAddon(fit);terminal.open(panel.querySelector('.terminal-screen'));
 const running=()=>latest.status==='running';
 const send=(action,data)=>{queue=queue.then(async()=>{if(disposed)return;try{await api('terminal-sessions/'+session.id+'/'+action,'POST',data);error.textContent='';}catch(e){error.textContent=e.message+' Input was not retried.';}});};
 const dataSubscription=terminal.onData(data=>{if(running())send('input',{data});});
 function resize(){if(disposed||panel.hidden)return;fit.fit();if(running())send('resize',{cols:Math.max(20,Math.min(400,terminal.cols)),rows:Math.max(5,Math.min(200,terminal.rows))});}
 const observer=new ResizeObserver(()=>{clearTimeout(resizeTimer);resizeTimer=setTimeout(resize,80);});observer.observe(panel.querySelector('.terminal-screen'));
 panel.querySelector('#terminal-hide').onclick=()=>{panel.hidden=true;document.body.classList.remove('terminal-open');previousFocus?.isConnected&&previousFocus.focus();onChange?.(latest,false);};
 end.onclick=async()=>{end.disabled=true;try{latest=await api('terminal-sessions/'+session.id+'/stop','POST',{});await poll();}catch(e){error.textContent=e.message;end.disabled=false;}};
 let polling=false;
 async function poll(){if(disposed||polling)return;polling=true;clearTimeout(timer);try{const r=await api('terminal-sessions/'+session.id+'/output?cursor='+cursor);if(disposed)return;if(r.reset){terminal.reset();terminal.writeln('[Earlier terminal output is no longer available]');}if(r.data)await new Promise(resolve=>terminal.write(r.data,resolve));cursor=r.cursor;latest=r.session;status.textContent=latest.status+(latest.reset?' · workspace '+latest.reset.status:'');end.disabled=!running();terminal.options.disableStdin=!running();onChange?.(latest,!panel.hidden);error.textContent='';}catch(e){if(!disposed)error.textContent=e.message+' Reconnecting…';}finally{polling=false;if(!disposed)timer=setTimeout(poll,400);}}
 resize();terminal.focus();poll();
 return {show(){panel.hidden=false;document.body.classList.add('terminal-open');resize();terminal.focus();onChange?.(latest,true);},dispose(){disposed=true;clearTimeout(timer);clearTimeout(resizeTimer);observer.disconnect();dataSubscription.dispose();terminal.dispose();panel.remove();document.body.classList.remove('terminal-open');}};
}
