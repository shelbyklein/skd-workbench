import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,rmSync,existsSync} from 'node:fs';
import path from 'node:path';import {tmpdir} from 'node:os';
import {createServer} from '../server.js';
// Remove project through Project details, the removed-project route, restore from Add project and from System.
// Fixture store only; nothing runs.
const root=mkdtempSync(path.join(tmpdir(),'skd-remove-project-browser-'));for(const f of ['keep','gone'])mkdirSync(path.join(root,f));
const server=createServer({directory:path.join(root,'data')});
await new Promise(r=>server.listen(0,'127.0.0.1',r));const url=`http://127.0.0.1:${server.address().port}`;
const api=async(route,input,method)=>{const res=await fetch(url+'/api/'+route,{method:method||(input?'POST':'GET'),headers:{'Content-Type':'application/json'},...(input?{body:JSON.stringify(input)}:{})});return res.json();};
const browser=await chromium.launch({channel:process.env.PLAYWRIGHT_CHANNEL||'chrome'});
try{
 const keep=await api('projects',{name:'Keep',folderPath:path.join(root,'keep')}),gone=await api('projects',{name:'Gone',folderPath:path.join(root,'gone')});
 const page=await browser.newPage({viewport:{width:1280,height:900}});page.setDefaultTimeout(15000);const errors=[];page.on('pageerror',e=>errors.push(e.message));
 const dialog=page.locator('#dialog');
 await page.goto(url+'#project/'+gone.id);await page.locator('#project-details').click();await dialog.getByRole('heading',{name:'Project details'}).waitFor();
 assert.match(await dialog.locator('.remove-project').textContent(),/folder, Git data, workflows, runs and conversation stay/);
 await page.screenshot({path:'output/remove-project-details.png'});
 await dialog.getByRole('button',{name:'Remove project…',exact:true}).click();await dialog.getByRole('heading',{name:'Remove Gone?'}).waitFor();
 assert.match(await dialog.textContent(),/Restore it any time from System › Removed projects/);
 await page.screenshot({path:'output/remove-project-confirm.png'});
 await dialog.getByRole('button',{name:'Remove project',exact:true}).click();await page.getByText('Gone removed. Restore it from System › Removed projects.').waitFor();
 assert.equal(await page.locator('.sidebar').getByText('Gone',{exact:true}).count(),0,'Gone leaves the sidebar.');
 assert.equal(await page.locator(`.project-card[data-project="${gone.id}"]`).count(),0,'Gone leaves Home.');
 assert.equal(existsSync(path.join(root,'gone')),true,'The folder is untouched.');
 // A link to the removed project explains itself.
 await page.goto(url+'#project/'+gone.id);await page.getByText('This project was removed. Restore it from System › Removed projects to open it again.').waitFor();
 // System lists it; adding the same folder offers restore instead of a duplicate.
 await page.goto(url+'#system/'+keep.id);const list=page.locator('.removed-projects');await list.getByText('Gone',{exact:true}).waitFor();
 assert.match(await list.textContent(),/removed/);await page.screenshot({path:'output/remove-project-system.png'});
 await page.goto(url+'#home');await page.locator('#add-project').click();await dialog.getByRole('heading',{name:'Add a project'}).waitFor();
 await dialog.locator('[name=name]').fill('Gone again');await dialog.locator('[name=folderPath]').fill(path.join(root,'gone'));await dialog.getByRole('button',{name:/Connect|Add project|Save/}).last().click();
 await dialog.getByRole('heading',{name:'Restore project?'}).waitFor();assert.match(await dialog.textContent(),/removed project “Gone”/);
 await dialog.getByRole('button',{name:'Restore project',exact:true}).click();await page.getByText('Gone restored.').waitFor();
 assert.equal((await api('state')).projects.filter(p=>p.id===gone.id).length,1,'Same project ID, no duplicate.');
 // Remove again and restore from the System list; then the empty state.
 await page.goto(url+'#project/'+gone.id);await page.locator('#project-details').click();await dialog.getByRole('button',{name:'Remove project…',exact:true}).click();
 await dialog.getByRole('button',{name:'Remove project',exact:true}).click();await page.getByText('Gone removed.',{exact:false}).waitFor();
 await page.goto(url+'#system/'+keep.id);await list.getByRole('button',{name:'Restore',exact:true}).click();await page.getByText('Gone restored.').waitFor();
 await list.getByText('No removed projects.').waitFor();assert.equal((await api('state')).projects.some(p=>p.id===gone.id),true);
 await page.screenshot({path:'output/remove-project-empty.png'});
 // Dark theme and phone width for the confirm step.
 await page.emulateMedia({colorScheme:'dark'});await page.setViewportSize({width:390,height:844});
 await page.goto(url+'#project/'+gone.id);await page.locator('#project-details').click();await dialog.getByRole('button',{name:'Remove project…',exact:true}).click();await dialog.getByRole('heading',{name:'Remove Gone?'}).waitFor();
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);await page.screenshot({path:'output/remove-project-confirm-dark-390.png'});
 assert.deepEqual(errors,[]);
 console.log('Remove project browser passed: Project details › Remove with confirmation, hidden from sidebar and Home, folder untouched, removed-project route, System list, Add project restore offer without duplicate, System Restore, empty state, dark and 390 px.');
}finally{await browser.close();server.closeAllConnections();await new Promise(r=>server.close(r));rmSync(root,{recursive:true,force:true});}
