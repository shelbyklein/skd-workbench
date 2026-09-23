// Apply before styles paint; theme changes never rerender drafts or terminals.
(() => {
 const key='skd-theme',system=matchMedia('(prefers-color-scheme: dark)');
 let preference='system',accents=null,primary='#315b74';
 try{primary=localStorage.getItem('skd-primary')||primary;}catch{}
 try{accents=JSON.parse(localStorage.getItem('skd-accents'));}catch{}
 try{preference=localStorage.getItem(key)||'system';}catch{}
 function apply(){
  if(!['system','light','dark'].includes(preference))preference='system';
  const dark=preference==='dark'||preference==='system'&&system.matches;
  document.documentElement.dataset.theme=dark?'dark':'light';
  const style=document.documentElement.style;
  if(!/^#[0-9a-f]{6}$/i.test(primary))primary='#315b74';
  style.setProperty('--primary',primary);
  const mix=(amount,base)=>`color-mix(in srgb, ${primary} ${amount}%, ${base})`;
  const palette=dark?{paper:mix(12,'#080808'),white:mix(18,'#181818'),surface:mix(23,'#222222'),sidebar:mix(38,'#101010'),line:mix(28,'#454545'),ink:mix(4,'#ffffff'),muted:mix(8,'#c4c4c4')}:{paper:mix(5,'#ffffff'),white:mix(2,'#ffffff'),surface:mix(10,'#ffffff'),sidebar:mix(16,'#ffffff'),line:mix(22,'#c4c4c4'),ink:mix(12,'#161616'),muted:mix(12,'#505050')};
  for(const [key,value] of Object.entries(palette))style.setProperty('--'+key,value);
  style.setProperty('--surface-hover',mix(dark?28:17,dark?'#303030':'#ffffff'));
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
 window.addEventListener('storage',event=>{if([key,'skd-primary','skd-accents',null].includes(event.key)){try{preference=localStorage.getItem(key)||'system';primary=localStorage.getItem('skd-primary')||'#315b74';accents=JSON.parse(localStorage.getItem('skd-accents'));}catch{}apply();}});
 system.addEventListener('change',apply);
 window.workbenchTheme={sync:apply,setPrimary(value){primary=value||'#315b74';try{localStorage.setItem('skd-primary',primary);}catch{}apply();},setAccents(value){accents=value;try{localStorage.setItem('skd-accents',JSON.stringify(value));}catch{}apply();}};apply();
})();
