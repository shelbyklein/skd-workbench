import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {Store} from '../lib/store.js';
import {createServer} from '../server.js';
const root=mkdtempSync(path.join(tmpdir(),'skd-tags-browser-')),directory=path.join(root,'data'),store=new Store(directory);
const projects=['Alpha','Beta'].map(name=>{const folderPath=path.join(root,name);mkdirSync(folderPath);return store.createProject({name,folderPath});});
const provider={models:[]};const server=createServer({directory,terminalOptions:{discover:async()=>provider},githubOptions:{inspect:async()=>({git:{remotes:[{name:'origin',webURL:'https://github.com/fixture/repo'}]}}),request:async()=>({data:{repository:{issues:{totalCount:2}}}})}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));const url=`http://127.0.0.1:${server.address().port}`;
const browser=await chromium.launch({channel:process.env.PLAYWRIGHT_CHANNEL||'chrome',headless:true});
try{
 const page=await browser.newPage({viewport:{width:1440,height:1000},serviceWorkers:'block'}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 const open=async()=>{await page.getByRole('button',{name:'Global settings',exact:true}).first().click();await page.locator('[data-settings-section=tags]').click();};
 const save=async()=>{await page.getByRole('button',{name:'Save settings',exact:true}).click();await page.getByRole('dialog').waitFor({state:'hidden'});};
 const add=async(name,assigned)=>{await page.getByRole('button',{name:'Add tag',exact:true}).click();const row=page.locator('.tag-editor').last();await row.locator('[data-tag-name]').fill(name);await row.locator('summary').click();for(const project of assigned)await row.getByLabel(project,{exact:true}).check();};
 await page.goto(url+'/#home');await open();await add('Work',['Alpha','Beta']);await add('Personal',['Alpha']);await page.getByLabel('Tag 2 color',{exact:true}).fill('#ffe066');
 await page.locator('[data-settings-section=appearance]').click();await page.locator('[data-settings-section=tags]').click();assert.equal(await page.getByLabel('Tag 1 name',{exact:true}).inputValue(),'Work');
 mkdirSync('output',{recursive:true});await page.screenshot({path:'output/project-tags-settings-desktop.png'});await save();
 assert.equal(await page.locator(`[data-project="${projects[0].id}"] .project-tag`).count(),2);assert.equal(await page.locator(`[data-project="${projects[1].id}"] .project-tag`).count(),1);
 await page.locator('#project-tag-filter').selectOption({label:'Personal'});assert.equal(await page.locator('[data-project]').count(),1);
 await page.reload();assert.equal(await page.locator('.project-tag').count(),3);assert.equal(await page.locator('.project-tag').filter({hasText:'Personal'}).evaluate(el=>getComputedStyle(el).backgroundColor),'rgb(255, 224, 102)');
 assert.equal(await page.locator('.projects-section>.overview-grid').evaluate(el=>getComputedStyle(el).gridTemplateColumns.split(' ').length),4);
 await page.getByRole('button',{name:'Edit tags for Beta',exact:true}).focus();await page.keyboard.press('Enter');await page.getByRole('dialog').getByLabel('Personal',{exact:true}).check();await page.getByRole('button',{name:'Save tags',exact:true}).click();await page.getByRole('dialog').waitFor({state:'hidden'});assert(page.url().endsWith('#home'));assert.equal(await page.locator(`[data-project="${projects[1].id}"] .project-tag`).count(),2);
 await page.getByRole('button',{name:'Edit tags for Beta',exact:true}).click();await page.getByRole('dialog').getByLabel('Personal',{exact:true}).uncheck();await page.getByRole('button',{name:'Cancel',exact:true}).click();assert.equal(await page.locator(`[data-project="${projects[1].id}"] .project-tag`).count(),2);
 await page.getByRole('button',{name:'Edit tags for Beta',exact:true}).click();await page.getByRole('dialog').getByLabel('Personal',{exact:true}).uncheck();await page.getByRole('button',{name:'Save tags',exact:true}).click();await page.getByRole('dialog').waitFor({state:'hidden'});
 await open();await page.getByLabel('Tag 1 name',{exact:true}).fill('Client');await save();assert.equal(await page.locator('.project-tag').filter({hasText:'Client'}).count(),2);
 await open();await page.getByLabel('Tag 1 name',{exact:true}).fill('personal');await page.getByRole('button',{name:'Save settings',exact:true}).click();await page.getByText('Tag names must be unique.',{exact:true}).waitFor();await page.getByRole('button',{name:'Cancel',exact:true}).click();assert.equal(await page.locator('.project-tag').filter({hasText:'Client'}).count(),2);
 await open();await page.getByRole('button',{name:'Delete tag 1',exact:true}).click();await page.getByRole('button',{name:'Cancel',exact:true}).click();assert.equal(await page.locator('.project-tag').filter({hasText:'Client'}).count(),2);
 // Concurrent settings changes must not overwrite newer assignments.
 await open();const current=await(await fetch(url+'/api/settings')).json();await fetch(url+'/api/settings',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify(current)});await page.getByRole('button',{name:'Save settings',exact:true}).click();await page.getByText('Settings changed. Reopen settings before saving.',{exact:true}).waitFor();await page.getByRole('button',{name:'Cancel',exact:true}).click();
 await page.locator(`[data-project="${projects[0].id}"]`).click();await page.getByRole('button',{name:'Edit tags',exact:true}).click();await page.getByLabel('Tag 1 name',{exact:true}).waitFor();
 await page.setViewportSize({width:390,height:844});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await page.screenshot({path:'output/project-tags-settings-mobile.png'});
 await page.getByRole('button',{name:'Delete tag 1',exact:true}).click();await save();await page.goto(url+'/#home');await page.reload();await page.locator('#project-tag-filter').waitFor();assert.equal(await page.locator('.project-tag').count(),1);assert.equal(await page.locator('#project-tag-filter option').count(),2);
 await page.screenshot({path:'output/project-tags-home-mobile.png',fullPage:true});await page.setViewportSize({width:1440,height:1000});await page.screenshot({path:'output/project-tags-home-desktop.png',fullPage:true});
 const saved=await(await fetch(url+'/api/settings')).json();assert.deepEqual(saved.projectTags.map(t=>({name:t.name,projectIDs:t.projectIDs})),[{name:'Personal',projectIDs:[projects[0].id]}]);assert.deepEqual(errors,[]);
 console.log('Project tags browser passed: many-to-many assignment, create/rename/delete, cancel, duplicate/stale rejection, filtering, reload, project entry point and mobile.');
}finally{await browser.close();server.closeAllConnections();await new Promise(r=>server.close(r));rmSync(root,{recursive:true,force:true});}
