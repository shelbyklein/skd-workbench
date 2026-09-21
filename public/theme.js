// Apply before styles paint; theme changes never rerender drafts or terminals.
(() => {
 const key='skd-theme',system=matchMedia('(prefers-color-scheme: dark)');
 let preference='system',accents=null;
 try{accents=JSON.parse(localStorage.getItem('skd-accents'));}catch{}
 try{preference=localStorage.getItem(key)||'system';}catch{}
 function apply(){
  if(!['system','light','dark'].includes(preference))preference='system';
  const dark=preference==='dark'||preference==='system'&&system.matches;
  document.documentElement.dataset.theme=dark?'dark':'light';
  const accent=accents?.[dark?'dark':'light'];
  if(/^#[0-9a-f]{6}$/i.test(accent||'')){
   const style=document.documentElement.style;style.setProperty('--accent',accent);
   const channels=accent.slice(1).match(/../g).map(h=>parseInt(h,16)/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4);
   const luminance=channels[0]*.2126+channels[1]*.7152+channels[2]*.0722;
   style.setProperty('--accent-contrast',luminance>.179?'#080808':'#ffffff');
   style.setProperty('--accent-light',`color-mix(in srgb, ${accent} 18%, ${dark?'#181818':'#ffffff'})`);
  }
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content',dark?'#080808':'#f7f5ef');
  document.querySelectorAll('[data-theme-picker]').forEach(el=>{el.value=preference;});
 }
 document.addEventListener('change',event=>{
  if(!event.target.matches('[data-theme-picker]'))return;
  preference=event.target.value;try{localStorage.setItem(key,preference);}catch{}apply();
 });
 window.addEventListener('storage',event=>{if(event.key===key||event.key===null){preference=event.newValue||'system';apply();}});
 system.addEventListener('change',apply);
 window.workbenchTheme={sync:apply,setAccents(value){accents=value;try{localStorage.setItem('skd-accents',JSON.stringify(value));}catch{}apply();}};apply();
})();
