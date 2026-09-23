import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,rmSync} from 'node:fs';
import path from 'node:path';import {tmpdir} from 'node:os';
import {createServer} from '../server.js';
// Chat with the coordinator agent from Home and a project, using the fixture CLI over the real MCP bridge.
const root=mkdtempSync(path.join(tmpdir(),'skd-coordinator-browser-'));mkdirSync(path.join(root,'newton'));
const fixture=path.resolve('tests/fixtures/coordinator-cli.mjs'),catalog=async()=>({version:'fixture',models:[{id:'fixture',name:'Fixture',efforts:['low','default']}]});
const server=createServer({directory:path.join(root,'data'),codexOptions:{binary:fixture,discover:catalog},claudeOptions:{binary:fixture,discover:catalog}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));const url=`http://127.0.0.1:${server.address().port}`;
const api=async(route,input)=>{const res=await fetch(url+'/api/'+route,{method:input?'POST':'GET',headers:{'Content-Type':'application/json'},...(input?{body:JSON.stringify(input)}:{})});return res.json();};
const browser=await chromium.launch({channel:'chrome'});
try{
 const project=await api('projects',{name:'Newton',folderPath:path.join(root,'newton')});
 const page=await browser.newPage({viewport:{width:1440,height:1000}});page.setDefaultTimeout(15000);const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(url);await page.locator('#home-decisions').waitFor();
 await page.waitForFunction(()=>/Coordinator agent off/.test(document.querySelector('#agent-coordinator')?.textContent));assert.match(await page.locator('#agent-message-help').textContent(),/Turn on the coordinator agent/);
 await page.locator('[data-coordinator-settings]').click();await page.getByRole('heading',{name:'Coordinator agent'}).waitFor();
 await page.locator('#dialog [name=enabled]').check();await page.locator('#dialog [name=provider]').selectOption('claude');await page.locator('#dialog [name=model]').selectOption('fixture');await page.locator('#dialog [name=effort]').selectOption('low');
 await page.screenshot({path:'output/coordinator-settings.png'});await page.getByRole('button',{name:'Save',exact:true}).click();
 await page.waitForFunction(()=>/Claude Code · fixture/.test(document.querySelector('#agent-coordinator')?.textContent));
 // A normal chat turn: send and see the reply arrive without reloading.
 await page.locator('#agent-message').fill('hi from browser');await page.locator('#agent-send').click();
 await page.getByText('Echo: hi from browser (1 granted project)').waitFor();
 assert.match(await page.locator('.agent-message-agent').last().textContent(),/Coordinator · Claude Code/);assert.equal(await page.locator('#agent-message').inputValue(),'');
 // A pending reply shows its state and can be stopped.
 await page.locator('#agent-message').fill('slow please');await page.keyboard.press('Control+Enter');
 await page.locator('.agent-pending').waitFor();assert.match(await page.locator('.agent-pending').textContent(),/Replying|Waiting to reply/);
 await page.screenshot({path:'output/coordinator-home-replying.png',fullPage:true});
 await page.locator('[data-stop-turn]').click();await page.getByText('Reply stopped.').waitFor();
 await page.screenshot({path:'output/coordinator-home.png',fullPage:true});
 // The same agent answers in a project thread, scoped to that project.
 await page.locator(`.project-card[data-project="${project.id}"]`).click();await page.locator('#agent-decisions').waitFor();
 await page.waitForFunction(()=>/Claude Code · fixture/.test(document.querySelector('#agent-coordinator')?.textContent));
 await page.locator('#agent-message').fill('status please');await page.locator('#agent-send').click();
 await page.getByText('Echo: status please (1 granted project)').waitFor();
 await page.screenshot({path:'output/coordinator-project.png',fullPage:true});
 const threads=[await api('coordinator/messages'),await api('projects/'+project.id+'/messages')];
 assert.deepEqual(threads.map(t=>t.items.map(m=>m.author).join(',')),['user,agent,user','user,agent']);
 await page.setViewportSize({width:390,height:844});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);await page.screenshot({path:'output/coordinator-project-mobile.png',fullPage:true});
 assert.equal((await api('workflows?projectID='+project.id)).length,0);assert.deepEqual(errors,[]);
 console.log('Coordinator chat: setup dialog, live Claude Code reply on Home, pending state and stop, project-scoped reply, mobile. No workflow started.');
}finally{await browser.close();server.shutdownCodex();server.closeAllConnections();await new Promise(r=>server.close(r));rmSync(root,{recursive:true,force:true});}
