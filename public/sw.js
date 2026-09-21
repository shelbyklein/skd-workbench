const CACHE='skd-shell-0.5.0-72';
const ASSETS=['/delegations-ui.js','/quick-actions-ui.js','/session-import-ui.js','/git-status-ui.js','/agent-card.js','/planning-ui.js','/knowledge-ui.js','/skills-ui.js','/connections-ui.js','/playbooks-ui.js','/settings-ui.js','/markdown.js','/theme.js','/','/app.js','/issues-ui.js','/terminal-ui.js','/vendor/xterm.js','/vendor/xterm.css','/vendor/fit.js','/vendor/cytoscape.js','/vendor/marked.js','/vendor/dompurify.js','/codex-ui.js','/workflows-ui.js','/pwa.js','/style.css','/icon.svg','/manifest.webmanifest','/icons/icon-192.png','/icons/icon-512.png','/icons/maskable-512.png','/icons/apple-touch-icon.png'];
self.addEventListener('install',event=>event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(ASSETS.map(url=>new Request(url,{cache:'reload'}))))));
self.addEventListener('activate',event=>event.waitUntil((async()=>{
 for(const key of await caches.keys())if(key.startsWith('skd-shell-')&&key!==CACHE)await caches.delete(key);
 await self.clients.claim();
})()));
self.addEventListener('message',event=>{if(event.data?.type==='SKIP_WAITING')self.skipWaiting();});
self.addEventListener('fetch',event=>{
 const request=event.request,url=new URL(request.url);
 if(url.origin!==self.location.origin)return;
 // API data stays on disk. Never cache requests, responses, or pending writes.
 if(url.pathname.startsWith('/api/')){
  event.respondWith(fetch(request).catch(()=>new Response(JSON.stringify({error:'Local server unavailable. Start SKD Workbench and reconnect. Check the saved state before retrying this action.',code:'SERVER_UNAVAILABLE'}),{status:503,headers:{'Content-Type':'application/json','Cache-Control':'no-store'}})));return;
 }
 if(request.method!=='GET'||!ASSETS.includes(url.pathname))return;
 event.respondWith(caches.open(CACHE).then(async cache=>(await cache.match(url.pathname))||fetch(request)));
});
