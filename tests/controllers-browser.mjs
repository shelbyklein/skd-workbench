import {chromium} from 'playwright';import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,rmSync,readFileSync} from 'node:fs';import {tmpdir} from 'node:os';import path from 'node:path';import {createServer} from '../server.js';
const root=mkdtempSync(path.join(tmpdir(),'skd-controller-browser-')),repo=path.join(root,'repo');mkdirSync(repo);mkdirSync('output',{recursive:true});
const server=createServer({directory:path.join(root,'data'),codexOptions:{discover:async()=>({version:'fixture',models:[{id:'fixture',efforts:['low']}]})},terminalOptions:{discover:async()=>({models:[]})}});await new Promise(r=>server.listen(0,'127.0.0.1',r));const url='http://127.0.0.1:'+server.address().port;
const browser=await chromium.launch({channel:process.env.PLAYWRIGHT_CHANNEL||'chrome',headless:true});
try{
 await fetch(url+'/api/projects',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:'MCP fixture',folderPath:repo})});
 const page=await browser.newPage({viewport:{width:1440,height:1000},serviceWorkers:'block'}),errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto(url+'/#home');
 await page.getByRole('button',{name:'Global settings',exact:true}).first().click();await page.getByRole('button',{name:'Agent control (MCP)',exact:true}).click();
 await page.getByLabel('Controller name').fill('External reviewer');await page.getByLabel('MCP fixture',{exact:true}).check();
 assert.equal(await page.getByLabel('Run and stop owned workflows').isChecked(),false);
 await page.getByRole('button',{name:'Enable controller',exact:true}).click();await page.getByRole('button',{name:'Revoke External reviewer'}).waitFor();
 assert.match(await page.locator('.controller-list pre').innerText(),/workbench-mcp.mjs/);
 const settings=await(await fetch(url+'/api/controllers')).json();assert.equal(settings.controllers.length,1);assert.deepEqual(settings.controllers[0].capabilities,['read','manage']);assert(!JSON.stringify(settings).includes('tokenHash'));
 const controller=settings.controllers[0],token=JSON.parse(readFileSync(controller.credentialPath)).token,projectID=controller.projectIDs[0];
 const call=async(name,args)=>{const r=await fetch(url+'/api/controller/call',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+token},body:JSON.stringify({name,arguments:args})});assert.equal(r.status,200);return r.json();};
 const flow=await call('create_workflow',{projectID,requestKey:'browser-create',input:{name:'Controller workflow',steps:[]}});
 await page.getByRole('button',{name:'Refresh status',exact:true}).click();await page.getByText('Recent operations',{exact:true}).click();await page.getByRole('link',{name:'Open workflow',exact:true}).waitFor();
 assert.equal(await page.getByRole('link',{name:'Open workflow',exact:true}).getAttribute('href'),'#flow/'+flow.flowID);
 await page.locator('.settings-content').evaluate(el=>el.scrollTop=0);await page.screenshot({path:'output/controllers-desktop.png'});
 await page.setViewportSize({width:390,height:844});await page.getByLabel('Settings section',{exact:true}).selectOption('controllers');await page.screenshot({path:'output/controllers-mobile.png'});
 assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 await page.locator('.controller-list details').evaluate(el=>el.open=true);await page.getByRole('button',{name:'Revoke External reviewer'}).focus();await page.keyboard.press('Enter');await page.getByText('External reviewer · Revoked',{exact:true}).waitFor();
 assert.equal(errors.length,0,errors.join('\n'));console.log('Controller setup, default grants, configuration, keyboard revoke and mobile layout passed.');
}finally{await browser.close();server.shutdownCodex();await new Promise(r=>server.close(r));rmSync(root,{recursive:true,force:true});}
