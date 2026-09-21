import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {Store} from '../lib/store.js';
import {createServer} from '../server.js';

const root=mkdtempSync(path.join(tmpdir(),'skd-import-browser-')),directory=path.join(root,'data'),folder=path.join(root,'project');mkdirSync(folder);
const store=new Store(directory),project=store.createProject({name:'Website project',folderPath:folder});
const transcript='User: Bring the website project into Workbench.\nAssistant: Keep the existing design and review the navigation first.\n<script>window.importExecuted=true</script>';
const file=path.join(root,'planning chat.md');writeFileSync(file,'# Earlier chat\n\nUser: Preserve the mobile layout.\nAssistant: Check keyboard navigation.');
const server=createServer({directory,terminalOptions:{discover:async()=>({version:'fixture',auth:'Fixture',models:[{id:'fixture',name:'Fixture',efforts:['low'],defaultEffort:'low',isDefault:true}]})},githubOptions:{inspect:async()=>({git:{remotes:[]}})}});await new Promise(r=>server.listen(0,'127.0.0.1',r));const url=`http://127.0.0.1:${server.address().port}`;
const browser=await chromium.launch({channel:process.env.PLAYWRIGHT_CHANNEL||'chrome',headless:true});
try{
 const context=await browser.newContext({viewport:{width:1440,height:1050},colorScheme:'dark',permissions:['clipboard-read','clipboard-write']}),page=await context.newPage();page.setDefaultTimeout(10000);const errors=[];let starts=0;
 page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(r.method()==='POST'&&r.url().endsWith('/api/terminal-sessions'))starts++;});
 await page.goto(url+'/#project/'+project.id);await page.getByText('No sessions yet.',{exact:true}).waitFor();
 await page.locator('#import-project-chat').focus();await page.keyboard.press('Enter');await page.getByRole('heading',{name:'Import chat',exact:true}).waitFor();
 await page.getByLabel('Title',{exact:true}).fill('Website planning');await page.getByLabel('Transcript',{exact:true}).focus();
 await page.evaluate(text=>navigator.clipboard.writeText(text),transcript);await page.keyboard.press(process.platform==='darwin'?'Meta+V':'Control+V');assert.equal(await page.getByLabel('Transcript',{exact:true}).inputValue(),transcript);
 await page.keyboard.press('Escape');await page.getByText('Discard this import draft?',{exact:true}).waitFor();await page.getByRole('button',{name:'Keep editing',exact:true}).click();assert.equal(await page.getByLabel('Transcript',{exact:true}).inputValue(),transcript);
 mkdirSync('output',{recursive:true});await page.screenshot({path:'output/session-import-dialog-desktop.png',fullPage:true});
 await page.getByRole('button',{name:'Import chat',exact:true}).click();await page.getByText('Imported chat',{exact:true}).waitFor();assert.equal(starts,0);assert.doesNotMatch(await page.locator('#last-session-report').innerText(),/Finished|None reported/);
 await page.locator('#open-last-session').click();await page.locator('.imported-transcript').waitFor();assert.equal(await page.locator('.imported-transcript').textContent(),transcript);assert.equal(await page.evaluate(()=>window.importExecuted),undefined);
 await page.getByRole('button',{name:'Copy transcript',exact:true}).click();assert.equal(await page.evaluate(()=>navigator.clipboard.readText()),transcript);
 await page.reload();await page.locator('.imported-transcript').waitFor();await page.getByRole('button',{name:'Use as context',exact:true}).click();await page.getByLabel('What should this session do?').waitFor();assert.equal(starts,0);assert.match(await page.locator('#codex-form').innerText(),/Website planning/);
 await page.locator('#project-home').click();await page.locator('#import-project-chat').click();await page.getByLabel('Title',{exact:true}).fill('Mobile handoff');await page.getByLabel('Import from').selectOption('file');await page.getByLabel('File path',{exact:true}).fill(path.join(root,'missing.txt'));await page.getByRole('button',{name:'Import chat',exact:true}).click();await page.getByText('Cannot read that local file. Check the path and permissions.',{exact:true}).waitFor();assert.equal(await page.getByLabel('Title',{exact:true}).inputValue(),'Mobile handoff');
 await page.getByLabel('File path',{exact:true}).fill(file);await page.setViewportSize({width:390,height:844});await page.emulateMedia({colorScheme:'light'});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await page.screenshot({path:'output/session-import-dialog-mobile.png',fullPage:true});
 await page.getByRole('button',{name:'Import chat',exact:true}).click();await page.getByText('Mobile handoff',{exact:true}).waitFor();await page.locator('#open-last-session').click();await page.locator('.imported-transcript').waitFor();assert.match(await page.locator('.imported-transcript').textContent(),/Preserve the mobile layout/);assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await page.waitForFunction(()=>!document.querySelector('#toast').classList.contains('visible'));await page.screenshot({path:'output/session-import-detail-mobile.png',fullPage:true});
 await page.getByRole('button',{name:'All sessions',exact:true}).click();await page.locator('.codex-history-row').first().waitFor();assert.equal(await page.locator('.codex-history-row').count(),2);assert.match(await page.locator('#codex-history').innerText(),/Imported chat/);
 await page.locator('#project-home').click();await page.setViewportSize({width:1440,height:1050});await page.emulateMedia({colorScheme:'dark'});await page.getByText('Mobile handoff',{exact:true}).waitFor();await page.screenshot({path:'output/session-import-card-desktop.png',fullPage:true});
 assert.equal(starts,0);assert.deepEqual(errors,[]);console.log('Session import browser passed: keyboard paste, draft protection, persistence/reload, escaped transcript, clipboard copy, context setup without launch, path error/recovery, history, desktop/mobile.');
}finally{await browser.close();server.shutdownCodex();server.closeAllConnections();await new Promise(r=>server.close(r));rmSync(root,{recursive:true,force:true});}
