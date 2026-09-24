import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {createServer} from '../server.js';
// The coordinator side panel is always open on every page, with no toggle, Shell or Hide; it never starts a
// shell. On project pages it splits into the coordinator and that project's agent.
const root=mkdtempSync(path.join(tmpdir(),'skd-coordinator-dock-')),folder=path.join(root,'project');mkdirSync(folder);
const server=createServer({directory:path.join(root,'data')});await new Promise(r=>server.listen(0,'127.0.0.1',r));
const base=`http://127.0.0.1:${server.address().port}`,post=(route,input,headers={})=>fetch(base+'/api/'+route,{method:'POST',headers:{'content-type':'application/json',...headers},body:JSON.stringify(input)});
const project=await (await post('projects',{name:'Fixture',folderPath:folder})).json();
const browser=await chromium.launch({channel:process.env.PLAYWRIGHT_CHANNEL||'chrome'});
try{
 const page=await browser.newPage({viewport:{width:1440,height:1000},serviceWorkers:'block',reducedMotion:'reduce'}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 const dock=page.getByRole('complementary',{name:'Coordinator panel',exact:true});
 await page.goto(base+'/#home');await dock.waitFor();
 assert.equal(await page.getByRole('button',{name:'Toggle coordinator panel'}).count(),0,'No toggle button.');
 assert.equal(await dock.locator('.dock-edge-tabs, [data-dock-hide], [data-dock-tab]').count(),0,'No Shell or Hide tabs.');
 assert.equal(await page.locator('#agent-composer').count(),0,'Home has no coordinator card; the panel replaces it.');
 await dock.locator('#dock-thread-title').filter({hasText:'Coordinator'}).waitFor();await dock.getByText('Coordinator agent off').waitFor();
 assert.equal(await dock.locator('.dock-conversation [data-coordinator-mode]').count(),0,'No Chat / CLI switch until the coordinator is on.');assert.equal(await dock.locator('#dock-refresh').getAttribute('aria-label'),'Refresh');
 // Resize by dragging the edge; the width is remembered.
 const before=await dock.boundingBox();await page.mouse.move(before.x,300);await page.mouse.down();await page.mouse.move(before.x-120,300,{steps:4});await page.mouse.up();
 const resized=(await dock.boundingBox()).width;assert(resized>before.width+100,`panel resized from ${before.width} to ${resized}`);
 // Project page: the panel splits and the page's own card steps aside.
 await page.evaluate(id=>location.hash='#project/'+id,project.id);await dock.locator('.dock-project #dockp-composer').waitFor();
 await page.waitForFunction(name=>document.querySelector('#dockp-thread-title')?.textContent===name,project.name);assert.equal(await page.locator('.project-agent>.agent-thread').isVisible(),false);assert.equal(await dock.locator('.dock-conversation #dock-composer').isVisible(),true);
 await page.screenshot({path:'output/coordinator-dock-split.png'});
 // Other pages keep one coordinator pane; reload keeps the panel open at the same width.
 await page.evaluate(()=>location.hash='#workflows');await page.waitForFunction(()=>document.querySelector('.dock-project')?.hidden===true);
 await page.reload();await dock.waitFor();await page.waitForTimeout(250);assert(Math.abs((await dock.boundingBox()).width-resized)<3);
 await page.emulateMedia({colorScheme:'dark'});await page.waitForTimeout(300);await page.screenshot({path:'output/coordinator-dock-chat-dark.png',animations:'disabled'});
 await page.setViewportSize({width:390,height:844});await page.waitForTimeout(200);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
 assert.equal(Math.round((await dock.boundingBox()).width),390);await page.screenshot({path:'output/coordinator-dock-mobile.png',animations:'disabled'});
 assert.equal((await post('workspace-terminal',{})).status,404,'The Workbench shell is gone.');
 assert.deepEqual(errors,[]);
 console.log('Coordinator dock browser passed: always open with no toggle or Shell/Hide, resize and remembered width, project split with the page card stepping aside, single pane elsewhere, reload, dark, 390 px, shell route removed.');//art, dark, 390 px, shell route removed.');
}finally{await browser.close();server.shutdownCodex();server.closeAllConnections();await new Promise(r=>server.close(r));rmSync(root,{recursive:true,force:true});}
