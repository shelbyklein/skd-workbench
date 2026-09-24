import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {createWorkspaceTerminal} from '../lib/workspace-terminal.js';
import {createServer} from '../server.js';
// The header icon toggles one side panel on every page: coordinator Chat / CLI and the workspace Shell.
// The shell starts only when Shell is chosen; navigation, hide and reload reattach without a new shell.
const root=mkdtempSync(path.join(tmpdir(),'skd-coordinator-dock-')),folder=path.join(root,'project');mkdirSync(folder);let opens=0;
const shell=createWorkspaceTerminal(folder);const open=shell.open.bind(shell);shell.open=()=>{opens++;return open();};
const server=createServer({directory:path.join(root,'data'),workspaceTerminal:shell});await new Promise(r=>server.listen(0,'127.0.0.1',r));
const base=`http://127.0.0.1:${server.address().port}`,post=(route,input,headers={})=>fetch(base+'/api/'+route,{method:'POST',headers:{'content-type':'application/json',...headers},body:JSON.stringify(input)});
const project=await (await post('projects',{name:'Fixture',folderPath:folder})).json();
const browser=await chromium.launch({channel:process.env.PLAYWRIGHT_CHANNEL||'chrome'});
try{
 const page=await browser.newPage({viewport:{width:1440,height:1000},serviceWorkers:'block',reducedMotion:'reduce'}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 const toggle=page.getByRole('button',{name:'Toggle coordinator panel',exact:true}),dock=page.getByRole('complementary',{name:'Coordinator panel',exact:true});
 // Shell and Hide are edge tabs; leaving Shell returns to the conversations (Chat / CLI live in each pane header).
 const tab=name=>dock.locator('.dock-edge-tabs').getByRole('button',{name,exact:true});
 const conversations=async()=>{if(await tab('Shell').getAttribute('aria-pressed')==='true')await tab('Shell').click();};
 await page.goto(base+'/#home');await toggle.waitFor();
 assert.equal(await page.locator('.view-actions > :last-child').getAttribute('data-workspace-terminal'),'');
 assert.equal(await page.locator('#agent-composer').count(),0,'Home no longer has a coordinator card.');
 // Open from Home with the keyboard: Chat is the default and no shell starts.
 await toggle.focus();await page.keyboard.press('Enter');await dock.waitFor();
 assert.equal(await toggle.getAttribute('aria-expanded'),'true');assert.equal(await tab('Shell').getAttribute('aria-pressed'),'false');
 await dock.locator('#dock-thread-title').filter({hasText:'Coordinator'}).waitFor();await dock.getByText('Coordinator agent off').waitFor();
 assert.equal(opens,0,'Opening the panel does not start a shell.');
 // Shell starts only when chosen, then the panel resizes.
 await tab('Shell').click();await dock.getByRole('region',{name:'Workspace terminal'}).waitFor();assert.equal(opens,1);
 const first=shell.current().id;await page.waitForTimeout(250);
 const before=await dock.boundingBox();await page.mouse.move(before.x,300);await page.mouse.down();await page.mouse.move(before.x-120,300,{steps:4});await page.mouse.up();
 const resized=(await dock.boundingBox()).width;assert(resized>before.width+100,`panel resized from ${before.width} to ${resized}`);
 // Navigation keeps the panel, tab and shell.
 await page.evaluate(id=>location.hash='#project/'+id,project.id);await toggle.waitFor();await page.waitForTimeout(300);
 assert.equal(await dock.isVisible(),true);assert.equal(await tab('Shell').getAttribute('aria-pressed'),'true');assert.equal(shell.current().id,first);assert.equal(opens,1);
 assert.equal(await page.locator('#agent-composer').count(),1,'Project overview keeps its conversation card.');
 // On a project page the panel splits: coordinator on top, this project's agent below; the page's card steps aside.
 await conversations();await dock.locator('.dock-project #dockp-composer').waitFor();assert.equal(await dock.locator('#dockp-thread-title').textContent(),project.name,'The lower pane is titled with the project name.');
 assert.equal(await page.locator('.project-agent>.agent-thread').isVisible(),false);assert.equal(await dock.locator('.dock-conversation #dock-composer').isVisible(),true);
 await page.screenshot({path:'output/coordinator-dock-split.png'});
 await page.evaluate(()=>location.hash='#workflows');await toggle.waitFor();assert.equal(await dock.isVisible(),true);
 // With the coordinator off there is no Chat / CLI switch; the pane offers Set up. The refresh control is an icon.
 assert.equal(await dock.locator('.dock-conversation [data-coordinator-mode]').count(),0);assert.equal(await dock.locator('#dock-refresh').getAttribute('aria-label'),'Refresh');
 // Hide and reopen: back on the last tab, same shell.
 await tab('Shell').click();await tab('Hide').click();await dock.waitFor({state:'hidden'});assert.equal(await toggle.getAttribute('aria-expanded'),'false');
 await toggle.click();await dock.getByRole('region',{name:'Workspace terminal'}).waitFor();assert.equal(shell.current().id,first);assert.equal(opens,1);
 // Reload restores the open panel, tab and width and reattaches without starting a shell.
 await page.reload();await dock.getByRole('region',{name:'Workspace terminal'}).waitFor();assert.equal(opens,1,'A restored panel never starts a shell.');assert.equal(shell.current().id,first);
 await page.waitForTimeout(250);assert(Math.abs((await dock.boundingBox()).width-resized)<3);
 mkdirSync('output',{recursive:true});await page.screenshot({path:'output/coordinator-dock-shell.png',animations:'disabled'});
 // Ending the shell offers Start shell; nothing restarts on its own.
 await dock.getByRole('button',{name:'End session',exact:true}).click();await dock.getByRole('button',{name:'Start shell',exact:true}).waitFor();assert.equal(opens,1);
 await dock.getByRole('button',{name:'Start shell',exact:true}).click();await page.waitForFunction(()=>/running/.test(document.querySelector('.dock-shell .terminal-status')?.textContent||''));assert.equal(opens,2);
 await conversations();await page.emulateMedia({colorScheme:'dark'});await page.waitForTimeout(300);await page.screenshot({path:'output/coordinator-dock-chat-dark.png',animations:'disabled'});
 await page.setViewportSize({width:390,height:844});await page.waitForTimeout(200);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
 assert.equal(Math.round((await dock.boundingBox()).width),390);await page.screenshot({path:'output/coordinator-dock-mobile.png',animations:'disabled'});
 // The shell API still opens only the Workbench folder and refuses other origins.
 assert.equal((await post('workspace-terminal',{folder:'/tmp',command:'arbitrary'})).status,400);assert.equal((await post('workspace-terminal',{},{origin:'https://example.com'})).status,403);
 assert.deepEqual(errors,[]);
 console.log('Coordinator dock browser passed: header toggle (keyboard), Chat default without a shell, Shell starts only when chosen, resize, navigation keeps panel/tab/shell, project card kept, Chat/CLI tabs, hide/reopen and reload reattach without a new shell, width restored, end and explicit restart, dark, 390 px, shell API guards.');
}finally{await browser.close();server.shutdownCodex();server.closeAllConnections();await new Promise(r=>server.close(r));rmSync(root,{recursive:true,force:true});}
