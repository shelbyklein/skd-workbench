import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,writeFileSync,rmSync,realpathSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {Store} from '../lib/store.js';
import {createServer} from '../server.js';

// Briefing: a written summary of each project's last 24 hours, or what to work on next when nothing happened.
const root=realpathSync(mkdtempSync(path.join(tmpdir(),'skd-briefing-browser-'))),directory=path.join(root,'data'),bin=path.join(root,'bin');mkdirSync(bin);
const hoursAgo=h=>new Date(Date.now()-h*3600000).toISOString();
function repo(name,commits){
 const folder=path.join(root,name);mkdirSync(folder);const git=(env,...args)=>execFileSync('git',['-C',folder,...args],{encoding:'utf8',env:{...process.env,...env},stdio:['ignore','pipe','pipe']});
 git({},'init','-q','-b','main');git({},'config','user.name','Fixture');git({},'config','user.email','fixture@example.invalid');
 commits.forEach(([subject,at],i)=>{writeFileSync(path.join(folder,`f${i}.txt`),subject);git({},'add','.');git({GIT_AUTHOR_DATE:at,GIT_COMMITTER_DATE:at},'commit','-q','-m',subject);});
 return folder;
}
const store=new Store(directory);
const busy=store.createProject({name:'Busy app',folderPath:repo('busy',[['Add dashboard layout',hoursAgo(3)]])});
const quiet=store.createProject({name:'Quiet app',folderPath:repo('quiet',[['Start the settings page',hoursAgo(24*5)]])});
writeFileSync(path.join(directory,'codex-runs.json'),JSON.stringify([{id:'failed-session',agent:'codex',projectID:busy.id,projectSnapshot:busy,sourceContext:{folderPath:busy.folderPath,git:null},task:'Migrate settings store',model:'fixture',effort:'low',mode:'read-only',status:'failed',createdAt:hoursAgo(2),startedAt:hoursAgo(2),finishedAt:hoursAgo(2),output:'',activity:[],usage:null,cost:null,error:'Tests failed.',workflowID:null,purpose:null}]));
const respond=(which,value)=>writeFileSync(path.join(bin,which+'.txt'),typeof value==='string'?value:JSON.stringify(value));
respond('busy',{summary:'Added the dashboard layout. A settings migration session failed its tests and still needs a fix.',suggestions:[]});
respond('quiet',{summary:'',suggestions:[{title:'Finish the settings page',reason:'It was started five days ago and has not moved since.',sourceIDs:['COMMIT']}]});
// Quiet packets have no activity; the fixture answers each kind from its own file and fills in the real commit ID.
writeFileSync(path.join(bin,'codex'),`#!/usr/bin/env node
const fs=require('node:fs'),p=require('node:path');let input='';process.stdin.on('data',d=>input+=d);process.stdin.on('end',()=>{const id=(input.match(/"id":"(commit:[0-9a-f]+)"/)||[])[1];const which=input.includes('"activity":[]')?'quiet':'busy';const text=fs.readFileSync(p.join(${JSON.stringify(bin)},which+'.txt'),'utf8').replaceAll('COMMIT',id);setTimeout(()=>{console.log(JSON.stringify({type:'item.completed',item:{type:'agent_message',text}}));console.log(JSON.stringify({type:'turn.completed',usage:{input_tokens:10,cached_input_tokens:0,output_tokens:5}}));},200);});`,{mode:0o755});
const provider={available:true,version:'fixture',models:[{id:'fixture',name:'Fixture model',efforts:['low','high'],isDefault:true}]};
const server=createServer({directory,codexOptions:{binary:path.join(bin,'codex'),discover:async()=>provider},terminalOptions:{discover:async()=>provider},githubOptions:{binary:path.join(root,'missing-gh')}});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const url=`http://127.0.0.1:${server.address().port}`;
const browser=await chromium.launch({channel:process.env.PLAYWRIGHT_CHANNEL||'chrome',headless:true});
const noHorizontalScroll=page=>page.evaluate(()=>document.documentElement.scrollWidth<=document.documentElement.clientWidth);
try{
 const page=await browser.newPage({viewport:{width:1440,height:1100},serviceWorkers:'block'}),errors=[];page.on('pageerror',error=>errors.push(error.message));
 // Project page: nothing yet, then Update writes the summary.
 await page.goto(url+'/#project/'+busy.id);
 const widget=page.locator('.briefing-widget');await widget.getByText('No summary yet').waitFor();
 await widget.getByRole('button',{name:'Update'}).click();
 await widget.locator('.briefing-summary').waitFor({timeout:15000});
 assert.match(await widget.locator('.briefing-summary').textContent(),/Added the dashboard layout\./);
 assert.equal(await widget.locator('.briefing-counts').textContent(),'1 commit · 1 session · 1 unfinished');
 assert.match(await widget.locator('.briefing-meta').textContent(),/^Updated /);
 await widget.screenshot({path:'output/briefing-project.png'});
 // Briefing page: one card per project; Update all fills the quiet one with suggestions.
 await page.goto(url+'/#briefing');const cards=page.locator('#briefing-cards');
 const busyCard=cards.locator(`[data-briefing-card="${busy.id}"]`),quietCard=cards.locator(`[data-briefing-card="${quiet.id}"]`);
 await busyCard.locator('.briefing-summary').waitFor();await quietCard.getByText('No summary yet').waitFor();
 await page.getByRole('button',{name:'Update all'}).click();
 await quietCard.locator('.briefing-next li').first().waitFor({timeout:15000});
 assert.equal(await quietCard.locator('.briefing-quiet').textContent(),'Nothing happened in the last 24 hours.');
 assert.deepEqual(await quietCard.locator('.briefing-next strong').allTextContents(),['Finish the settings page']);
 await page.waitForFunction(()=>!document.querySelector('.briefing-working'),null,{timeout:15000});
 assert.match(await busyCard.locator('.briefing-summary').textContent(),/settings migration session failed/);
 await page.screenshot({path:'output/briefing-page.png'});
 // A failed update keeps the last summary and says so.
 respond('busy','{"summary":"x","suggestions":[{"title":"Invent","reason":"x","sourceIDs":["session:nope"]}]}');
 await busyCard.getByRole('button',{name:'Update'}).click();
 await busyCard.locator('.briefing-problem').waitFor({timeout:15000});
 assert.match(await busyCard.locator('.briefing-problem').textContent(),/last update failed/);
 assert.match(await busyCard.locator('.briefing-summary').textContent(),/Added the dashboard layout\./);
 // Settings: agent and model for Update, and the daily update (off by default).
 const settings=page.locator('.briefing-schedule');assert.equal(await settings.locator('summary').textContent(),'Settings · daily update off');
 await settings.locator('summary').click();await settings.locator('#schedule-model option[value="fixture"]').waitFor({state:'attached'});
 await settings.locator('#schedule-enabled').check();await settings.locator('#schedule-time').fill('23:59');await settings.locator('#schedule-timezone').fill('UTC');
 await settings.locator('#schedule-save').click();await settings.getByText('Settings · updates daily at 23:59 (UTC)').waitFor();
 await settings.locator('#schedule-timezone').fill('Mars/Base');await settings.locator('#schedule-save').click();
 await settings.locator('#schedule-error:not(:empty)').waitFor();assert.match(await settings.locator('#schedule-error').textContent(),/timezone/);
 await page.locator('[data-theme-picker]').selectOption('dark');
 await page.screenshot({path:'output/briefing-page-dark.png',fullPage:true});
 // The project name opens the project.
 await quietCard.locator('.briefing-card-name').click();await page.waitForURL(new RegExp('#project/'+quiet.id));
 await page.locator('.briefing-widget .briefing-quiet').waitFor();
 // Mobile layout.
 await page.setViewportSize({width:390,height:900});await page.goto(url+'/#briefing');await quietCard.locator('.briefing-next').waitFor();
 assert.equal(await noHorizontalScroll(page),true,'Briefing scrolls horizontally at 390px');
 await page.screenshot({path:'output/briefing-page-mobile.png',fullPage:true});
 assert.deepEqual(errors,[]);
 console.log('Briefing browser checks passed: project Update writes a summary with counts, Briefing page cards, Update all gives a quiet project suggestions, failed update keeps the last summary, settings and daily update, project link, dark and 390 px.');
}finally{await browser.close();server.shutdownCodex();server.closeAllConnections();await new Promise(resolve=>server.close(resolve));rmSync(root,{recursive:true,force:true});}
