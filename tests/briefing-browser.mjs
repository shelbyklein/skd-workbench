import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,writeFileSync,rmSync,realpathSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {Store} from '../lib/store.js';
import {createServer} from '../server.js';

const root=realpathSync(mkdtempSync(path.join(tmpdir(),'skd-briefing-browser-'))),directory=path.join(root,'data'),folder=path.join(root,'project'),bin=path.join(root,'bin');
mkdirSync(folder);mkdirSync(bin);
const git=(env,...args)=>execFileSync('git',['-C',folder,...args],{encoding:'utf8',env:{...process.env,...env},stdio:['ignore','pipe','pipe']});
const yesterday=new Date();yesterday.setDate(yesterday.getDate()-1);yesterday.setHours(12,0,0,0);const at=yesterday.toISOString();
git({},'init','-q','-b','main');git({},'config','user.name','Fixture');git({},'config','user.email','fixture@example.invalid');
writeFileSync(path.join(folder,'a.txt'),'a');git({},'add','.');git({GIT_AUTHOR_DATE:at,GIT_COMMITTER_DATE:at},'commit','-q','-m','Add dashboard layout');
const store=new Store(directory),project=store.createProject({name:'Briefing fixture',folderPath:folder});
writeFileSync(path.join(directory,'codex-runs.json'),JSON.stringify([{id:'failed-session',agent:'codex',projectID:project.id,projectSnapshot:project,sourceContext:{folderPath:folder,git:null},task:'Migrate settings store',model:'fixture',effort:'low',mode:'read-only',status:'failed',createdAt:at,startedAt:at,finishedAt:at,output:'',activity:[],usage:null,cost:null,error:'Tests failed.',workflowID:null,purpose:null}]));
const respond=value=>writeFileSync(path.join(bin,'response.txt'),value);
respond(JSON.stringify({yesterday:[{text:'Added the dashboard layout.',sourceIDs:['COMMIT']}],openLoops:[{text:'Settings migration failed its tests.',sourceIDs:['session:failed-session']}],suggestions:[{title:'Fix the settings migration',reason:'The session failed with test errors yesterday.',sourceIDs:['session:failed-session']},{title:'Review the dashboard commit',reason:'It has no review yet.',sourceIDs:['COMMIT']}]}));
writeFileSync(path.join(bin,'codex'),`#!/usr/bin/env node
const fs=require('node:fs'),p=require('node:path');let input='';process.stdin.on('data',d=>input+=d);process.stdin.on('end',()=>{const id=(input.match(/"id":"(commit:[0-9a-f]+)"/)||[])[1];const text=fs.readFileSync(p.join(${JSON.stringify(bin)},'response.txt'),'utf8').replaceAll('COMMIT',id);setTimeout(()=>{console.log(JSON.stringify({type:'item.completed',item:{type:'agent_message',text}}));console.log(JSON.stringify({type:'turn.completed',usage:{input_tokens:10,cached_input_tokens:0,output_tokens:5}}));},300);});`,{mode:0o755});
const provider={available:true,version:'fixture',models:[{id:'fixture',name:'Fixture model',efforts:['low','high'],isDefault:true}]};
const server=createServer({directory,codexOptions:{binary:path.join(bin,'codex'),discover:async()=>provider},terminalOptions:{discover:async()=>provider},githubOptions:{binary:path.join(root,'missing-gh')}});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const url=`http://127.0.0.1:${server.address().port}`;
const browser=await chromium.launch({channel:process.env.PLAYWRIGHT_CHANNEL||'chrome',headless:true});
const noHorizontalScroll=page=>page.evaluate(()=>document.documentElement.scrollWidth<=document.documentElement.clientWidth);
try{
 const page=await browser.newPage({viewport:{width:1440,height:1100},serviceWorkers:'block'}),errors=[];page.on('pageerror',error=>errors.push(error.message));
 await page.goto(url+'/#project/'+project.id);
 const widget=page.locator('.briefing-widget');await widget.getByText('Not generated').waitFor();
 assert.match(await widget.textContent(),/No briefing for/);
 await widget.locator('#briefing-model option[value="fixture"]').waitFor({state:'attached'});
 // Keyboard: focus Generate and submit with Enter.
 await widget.locator('#briefing-generate').focus();await page.keyboard.press('Enter');
 await widget.locator('.briefing-state-ready').waitFor({timeout:15000});
 assert.deepEqual(await widget.locator('.briefing-suggestions strong').allTextContents(),['Fix the settings migration','Review the dashboard commit']);
 assert.match(await widget.locator('.briefing-grid').textContent(),/Added the dashboard layout\./);
 assert.match(await widget.locator('.briefing-coverage summary').textContent(),/incomplete/);
 await page.screenshot({path:'output/briefing-project-ready.png',fullPage:false});
 // Failed regenerate keeps the last successful revision visible.
 respond('{"suggestions":[{"title":"Invent","reason":"x","sourceIDs":["session:nope"]}]}');
 await widget.locator('#briefing-generate').click();
 await widget.locator('.briefing-state-failed').waitFor({timeout:15000});
 assert.match(await widget.locator('.briefing-notice').textContent(),/Revision 2 failed: .*unknown source.* Revision 1 is still available\./);
 assert.equal(await widget.locator('.briefing-suggestions strong').first().textContent(),'Fix the settings migration');
 await page.screenshot({path:'output/briefing-project-failed.png'});
 // Source links open the cited session.
 await widget.locator('.briefing-suggestions [data-source="session:failed-session"]').first().click();
 await page.waitForURL(/#sessions\/.*failed-session|failed-session/);
 // Inject an explicit workflow gate into saved-read responses; no execution is started.
 await page.route('**/api/briefings',async route=>{const response=await route.fetch(),rows=await response.json();for(const row of rows)for(const report of [row.briefing?.latest,row.briefing?.lastSuccessful].filter(Boolean)){report.evidence.openLoops.push({id:'workflow:review-gate',kind:'workflow',recordID:'review-gate',title:'Review results',status:'waiting'});if(report.synthesis)report.synthesis.suggestions.push({title:'Inspect workflow gate',reason:'The workflow awaits a human decision.',sourceIDs:['workflow:review-gate']});}await route.fulfill({response,json:rows});});
 // Home aggregates the last successful suggestions and reports status.
 await page.goto(url+'/#home');const home=page.locator('#home-briefings');await home.getByText('Fix the settings migration').waitFor();
 assert.match(await home.locator('.briefing-project-list').textContent(),/Briefing fixture.*Failed/);
 assert.equal(await home.locator('.briefing-action-attention .briefing-action-card').count(),1);
 assert.equal(await home.locator('.briefing-action-next .briefing-action-card').count(),1);
 assert.equal(await home.locator('.briefing-action-review .briefing-action-card').count(),1);
 assert.equal(await home.locator('.briefing-home-coverage').getAttribute('open'),null);
 await page.locator('[data-theme-picker]').selectOption('dark');
 await page.screenshot({path:'output/briefing-home.png'});
 // Schedule: off by default, saved explicitly, and shows the server-uptime limit.
 const schedule=home.locator('.briefing-schedule');assert.equal(await schedule.locator('summary').textContent(),'Schedule: off');
 await schedule.locator('summary').click();await schedule.locator('#schedule-model option[value="fixture"]').waitFor({state:'attached'});
 assert.match(await schedule.textContent(),/Runs only while SKD Workbench is running/);
 await schedule.locator('#schedule-enabled').check();await schedule.locator('#schedule-time').fill('23:59');await schedule.locator('#schedule-timezone').fill('UTC');
 await schedule.locator('#schedule-save').click();await schedule.getByText('Schedule: daily at 23:59 (UTC)').waitFor();
 await schedule.locator('#schedule-timezone').fill('Mars/Base');await schedule.locator('#schedule-save').click();
 await schedule.locator('#schedule-error:not(:empty)').waitFor();assert.match(await schedule.locator('#schedule-error').textContent(),/timezone/);
 await page.screenshot({path:'output/briefing-schedule.png',fullPage:true});
 await home.locator('.briefing-action-card [data-briefing-project]').first().click();await page.locator('.briefing-widget').waitFor();
 // Mobile layout.
 await page.setViewportSize({width:390,height:900});await page.goto(url+'/#project/'+project.id);await page.locator('.briefing-widget .briefing-state-failed').waitFor();
 assert.equal(await noHorizontalScroll(page),true,'project page scrolls horizontally at 390px');
 await page.locator('.briefing-widget').screenshot({path:'output/briefing-project-mobile.png'});
 await page.goto(url+'/#home');await page.locator('#home-briefings .briefing-action-board').waitFor();
 assert.equal(await noHorizontalScroll(page),true,'home scrolls horizontally at 390px');
 await page.screenshot({path:'output/briefing-home-mobile.png',fullPage:true});
 assert.deepEqual(errors,[]);
 console.log('Briefing browser checks passed.');
}finally{await browser.close();server.shutdownCodex();server.closeAllConnections();await new Promise(resolve=>server.close(resolve));rmSync(root,{recursive:true,force:true});}
