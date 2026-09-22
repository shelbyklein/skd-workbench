import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,writeFileSync,rmSync} from 'node:fs';
import path from 'node:path';
import {tmpdir} from 'node:os';
import {Store} from '../lib/store.js';
import {createServer} from '../server.js';

const root=mkdtempSync(path.join(tmpdir(),'skd-graft-browser-')),directory=path.join(root,'data'),projectFolder=path.join(root,'project'),missingFolder=path.join(root,'missing');mkdirSync(path.join(projectFolder,'graft','.graph'),{recursive:true});mkdirSync(missingFolder,{recursive:true});
const nodes=[
 {id:'src/app.js',name:'app.js',kind:'file',path:'src/app.js',span:'L1-L80',signature:null,exported:true,origin:'ast'},
 {id:'src/app.js#loadProject',name:'loadProject',kind:'function',path:'src/app.js',span:'L10-L24',signature:'async function loadProject(id)',exported:true,origin:'ast'},
 {id:'src/app.js#renderGraph',name:'renderGraph',kind:'function',path:'src/app.js',span:'L30-L48',signature:'function renderGraph(graph)',exported:false,origin:'ast'},
 {id:'src/store.js',name:'store.js',kind:'file',path:'src/store.js',span:'L1-L42',signature:null,exported:true,origin:'ast'},
 {id:'src/store.js#readIndex',name:'readIndex',kind:'function',path:'src/store.js',span:'L5-L16',signature:'function readIndex(folder)',exported:true,origin:'ast'},
 {id:'src/graph.js',name:'graph.js',kind:'file',path:'src/graph.js',span:'L1-L55',signature:null,exported:true,origin:'ast'},
 {id:'src/graph.js#layout',name:'layout',kind:'function',path:'src/graph.js',span:'L18-L39',signature:'function layout(nodes, edges)',exported:true,origin:'ast'}
];
const edges=[
 {source:'src/app.js',target:'src/app.js#loadProject',relation:'contains',confidence:'extracted'},
 {source:'src/app.js',target:'src/app.js#renderGraph',relation:'contains',confidence:'extracted'},
 {source:'src/store.js',target:'src/store.js#readIndex',relation:'contains',confidence:'extracted'},
 {source:'src/graph.js',target:'src/graph.js#layout',relation:'contains',confidence:'extracted'},
 {source:'src/app.js#loadProject',target:'src/store.js#readIndex',relation:'calls',confidence:'extracted'},
 {source:'src/app.js#renderGraph',target:'src/graph.js#layout',relation:'calls',confidence:'extracted'},
 {source:'src/app.js',target:'src/store.js',relation:'imports',confidence:'extracted'},
 {source:'src/app.js',target:'missing.js',relation:'imports',confidence:'extracted'}
];
writeFileSync(path.join(projectFolder,'graft','.graph','wiring.json'),JSON.stringify({meta:{version:1,nodeCount:nodes.length,edgeCount:edges.length,languages:['javascript'],scopes:[]},nodes,edges}));
writeFileSync(path.join(projectFolder,'graft','INDEX.md'),'# Fixture repository map\n\nStructural project index.');
const devFolder=path.join(root,'dev-project'),devGraph=path.join(devFolder,'.graft-dev','index-current');mkdirSync(path.join(devGraph,'.graph'),{recursive:true});writeFileSync(path.join(devGraph,'.graph','wiring.json'),JSON.stringify({meta:{version:1},nodes,edges}));writeFileSync(path.join(devFolder,'.graft-dev','config.json'),JSON.stringify({root:devFolder,graph:devGraph}));
const store=new Store(directory),project=store.createProject({name:'Graph fixture',folderPath:projectFolder}),missing=store.createProject({name:'No Graft',folderPath:missingFolder});
const devProject=store.createProject({name:'Development graph',folderPath:devFolder});
const server=createServer({directory,codexOptions:{discover:async()=>({version:'fixture',models:[]}),spawnProcess:()=>{throw Error('No execution allowed in Graft browser test');}}});await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const url=`http://127.0.0.1:${server.address().port}`;
const browser=await chromium.launch({channel:process.env.PLAYWRIGHT_CHANNEL||'chrome'});
try{
 const page=await browser.newPage({viewport:{width:1440,height:1100}});page.setDefaultTimeout(12000);const errors=[];let executions=0;page.on('pageerror',error=>errors.push(error.message));page.on('request',request=>{if(request.method()==='POST'&&/\/api\/(workflows|sessions|terminal-sessions|codex\/runs)/.test(request.url()))executions++;});
 await page.goto(url+'/#knowledge');await page.getByRole('heading',{name:'Knowledge Graph',exact:true}).waitFor();await page.waitForFunction(id=>document.querySelector(`[data-knowledge-project="${id}"] [data-graft-status]`)?.textContent==='CONNECTED',project.id);await page.waitForFunction(id=>document.querySelector(`[data-knowledge-project="${id}"] [data-graft-status]`)?.textContent==='NOT CONNECTED',missing.id);
 await page.locator(`[data-knowledge-project="${project.id}"]`).click();await page.getByRole('heading',{name:'Knowledge Graph',exact:true}).waitFor();await page.waitForFunction(()=>document.querySelector('#graft-index-summary')?.textContent.includes('7 code nodes'));await page.locator('#graft-canvas canvas').first().waitFor();assert.equal(await page.locator('[data-graft-tab="code"]').getAttribute('aria-selected'),'true');assert.equal(await page.locator('.graft-list-node').count(),7);assert.match(await page.locator('#graft-diagnostics').textContent(),/1 dangling code relation omitted/);await page.locator('[data-graft-tab="code"]').focus();await page.keyboard.press('ArrowRight');await page.waitForFunction(()=>document.querySelector('[data-graft-tab="context"]')?.getAttribute('aria-selected')==='true');await page.keyboard.press('ArrowLeft');await page.waitForFunction(()=>document.querySelector('[data-graft-tab="code"]')?.getAttribute('aria-selected')==='true');await page.locator('[data-graft-node="src/app.js#renderGraph"]').focus();await page.keyboard.press('Enter');assert.equal(await page.locator('#graft-details h3').textContent(),'renderGraph');
 await page.locator('[data-graft-node="src/app.js#loadProject"]').click();assert.equal(await page.locator('#graft-details h3').textContent(),'loadProject');await page.getByRole('button',{name:'Expand neighborhood'}).click();await page.waitForFunction(()=>document.querySelector('#graft-visible-count')?.textContent==='3 visible');assert.match(await page.locator('.graft-relations').textContent(),/Calls readIndex/);assert.match(await page.locator('.graft-relations').textContent(),/extracted/);await page.getByRole('button',{name:'Zoom in'}).click();await page.getByRole('button',{name:'Fit',exact:true}).click();
 await page.locator('[data-graft-tab="context"]').click();await page.waitForFunction(()=>document.querySelector('#graft-visible-count')?.textContent==='1 visible');assert.match(await page.locator('#graft-details').textContent(),/Fixture repository map/);
 await page.locator('[data-graft-tab="outline"]').click();await page.locator('[data-outline-node]').first().waitFor();assert.equal(await page.locator('[data-outline-node]').count(),7);await page.locator('[data-outline-node="src/graph.js#layout"]').click();assert.equal(await page.locator('#graft-details h3').textContent(),'layout');
 await page.locator('[data-graft-tab="code"]').click();await page.locator('#graft-search').fill('readIndex');await page.waitForFunction(()=>document.querySelector('#graft-details h3')?.textContent==='readIndex');assert.ok(await page.locator('.graft-list-node').count()>=1);await page.locator('#graft-kind').selectOption('function');assert.ok(await page.locator('.graft-list-node').count()>=1);
 mkdirSync('output',{recursive:true});await page.screenshot({path:'output/graft-explorer-desktop.png',fullPage:true});await page.reload();await page.waitForFunction(()=>document.querySelector('#graft-index-summary')?.textContent.includes('7 code nodes'));
 await page.setViewportSize({width:390,height:844});await page.locator('[data-graft-tab="outline"]').click();await page.locator('[data-outline-node]').first().waitFor();assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);await page.screenshot({path:'output/graft-explorer-mobile.png',fullPage:true});await page.goto(url+'/#knowledge/'+devProject.id);await page.waitForFunction(()=>document.querySelector('#graft-index-summary')?.textContent.includes('7 code nodes'));await page.locator('#graft-canvas canvas').first().waitFor();assert.deepEqual(errors,[]);assert.equal(executions,0);console.log('Graft explorer: global status, project route, keyboard tabs/list, code/context/outline, search, filters, details, neighborhood, zoom, reload, mobile and zero execution requests passed.');
}finally{await browser.close();server.closeAllConnections();await new Promise(resolve=>server.close(resolve));rmSync(root,{recursive:true,force:true});}
