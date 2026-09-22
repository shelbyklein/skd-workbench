import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {mkdtempSync,cpSync,readFileSync,writeFileSync,rmSync,mkdirSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {createServer} from '../server.js';
const root=mkdtempSync(path.join(tmpdir(),'skd-pwa-browser-')),directory=path.join(root,'data'),publicDirectory=path.join(root,'public');
cpSync('public',publicDirectory,{recursive:true});
let server=createServer({directory,publicDirectory});await new Promise(r=>server.listen(0,'127.0.0.1',r));const port=server.address().port,url=`http://127.0.0.1:${port}`;
const stop=async()=>{server.closeAllConnections();await new Promise(r=>server.close(r));};
const browser=await chromium.launchPersistentContext(path.join(root,'profile'),{channel:process.env.PLAYWRIGHT_CHANNEL||'chrome',viewport:{width:1440,height:1000}});
try{
 const context=browser;
 // Deliberately exercise help when the browser does not expose a native prompt.
 await context.addInitScript(()=>window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();e.stopImmediatePropagation();}));
 const page=await context.newPage();page.setDefaultTimeout(10000);const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(url+'/#workflows/unassigned');await page.locator('[data-overview-flow]').first().click();await page.locator('.project-list').waitFor();
 await page.locator('#install-app').click();await page.getByRole('heading',{name:'Install SKD Workbench'}).waitFor();await page.keyboard.press('Escape');
 await page.evaluate(()=>navigator.serviceWorker.ready);await page.waitForFunction(()=>Boolean(navigator.serviceWorker.controller));
 const cdp=await context.newCDPSession(page),manifest=await cdp.send('Page.getAppManifest');assert.equal(manifest.errors.length,0);assert.equal(JSON.parse(manifest.data).display,'standalone');
 const installability=await cdp.send('Page.getInstallabilityErrors');assert.deepEqual(installability.installabilityErrors,[]);
 console.log('Chrome manifest and installability checks passed');
 const before=await(await fetch(url+'/api/state')).json();
 await context.setOffline(true);await page.reload();await page.getByRole('heading',{name:'Server unavailable'}).waitFor();
 const failed=await page.evaluate(async()=>{const r=await fetch('/api/flows',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:'Must not be queued'})});return {status:r.status,body:await r.json()};});assert.equal(failed.status,503);assert.equal(failed.body.code,'SERVER_UNAVAILABLE');
 const keys=await page.evaluate(async()=>{const keys=[];for(const name of await caches.keys())for(const r of await(await caches.open(name)).keys())keys.push(new URL(r.url).pathname);return keys;});assert(!keys.some(k=>k.startsWith('/api/')));assert.equal(keys.length,38);for(const asset of ['/lifecycle-operations-ui.js','/lifecycle-ui.js','/workspace-tasks-ui.js','/delegations-ui.js','/quick-actions-ui.js','/session-import-ui.js','/git-status-ui.js','/agent-card.js','/planning-ui.js','/knowledge-ui.js','/skills-ui.js','/connections-ui.js','/playbooks-ui.js','/settings-ui.js','/markdown.js','/issues-ui.js','/terminal-ui.js','/vendor/xterm.js','/vendor/xterm.css','/vendor/fit.js','/vendor/cytoscape.js','/vendor/marked.js','/vendor/dompurify.js'])assert(keys.includes(asset));
 mkdirSync('output',{recursive:true});await page.screenshot({path:'output/skd-pwa-offline.png',fullPage:true});
 await context.setOffline(false);await page.locator('#retry-load').click();await page.locator('.project-list').waitFor();
 assert.deepEqual(await(await fetch(url+'/api/state')).json(),before);
 // Actual localhost shutdown, not only the browser's network emulation.
 await page.locator('[data-step]').first().click();await page.getByLabel('Step name',{exact:true}).fill('Preserved offline edit');
 await stop();await page.getByRole('button',{name:'Save flow',exact:true}).click();await page.locator('#pwa-reconnect').waitFor();assert.equal(await page.getByLabel('Step name',{exact:true}).inputValue(),'Preserved offline edit');
 server=createServer({directory,publicDirectory});await new Promise(r=>server.listen(port,'127.0.0.1',r));await page.locator('#pwa-reconnect').click();await page.waitForFunction(()=>!document.querySelector('#pwa-reconnect'));
 assert.equal(await page.getByLabel('Step name',{exact:true}).inputValue(),'Preserved offline edit');await page.getByRole('button',{name:'Save flow',exact:true}).click();await page.waitForFunction(()=>document.querySelector('#save').disabled);
 const other=await context.newPage();await other.goto(url+'/#workflows/unassigned');await other.locator('[data-overview-flow]').first().click();await other.locator('[data-step]').first().click();await other.getByLabel('Step name',{exact:true}).fill('Other window draft');
 const sw=path.join(publicDirectory,'sw.js');writeFileSync(sw,readFileSync(sw,'utf8').replace(/skd-shell-0\.5\.0[^']*/, 'skd-shell-test-update'));
 await page.getByLabel('Step name',{exact:true}).fill('Draft during update');
 await page.evaluate(async()=>{const reg=await navigator.serviceWorker.getRegistration();await reg.update();});await page.locator('#pwa-update').waitFor();
 await page.locator('#pwa-update').click();assert.equal(await page.getByLabel('Step name',{exact:true}).inputValue(),'Draft during update');assert.match(await page.locator('#toast').textContent(),/Save your edits/);
 await page.getByRole('button',{name:'Save flow',exact:true}).click();await page.waitForFunction(()=>document.querySelector('#save').disabled);
 await page.locator('#pwa-update').click();await page.waitForFunction(async()=>!(document.querySelector('#pwa-update'))&&(await caches.keys()).includes('skd-shell-test-update'));
 await page.locator('.project-list').waitFor();await page.waitForFunction(async()=>(await caches.keys()).length===1);
 await other.locator('#pwa-update').waitFor();assert.equal(await other.getByLabel('Step name',{exact:true}).inputValue(),'Other window draft');
 assert.equal((await(await fetch(url+'/api/state')).json()).flows[0].steps[0].name,'Draft during update');assert.deepEqual(errors,[]);
 // Standalone CSS and UI are checked separately from actual OS installation.
 const standalone=browser;await standalone.addInitScript(()=>{const original=window.matchMedia;window.matchMedia=q=>q==='(display-mode: standalone)'?{matches:true}:original(q);});const sp=await standalone.newPage();await sp.goto(url);await sp.getByRole('heading',{name:'Home',exact:true}).waitFor();assert.equal(await sp.locator('#install-app').count(),0);
 console.log('PWA Chrome checks passed: offline shell, uncached/unqueued APIs, server restart, retained drafts, explicit update, standalone UI.');
}finally{await browser.close();await stop();rmSync(root,{recursive:true,force:true});}
