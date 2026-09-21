import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,rmSync} from 'node:fs';
import path from 'node:path';import {tmpdir} from 'node:os';
import {createServer} from '../server.js';
const root=mkdtempSync(path.join(tmpdir(),'skd-card-'));mkdirSync(path.join(root,'project'));
const provider={version:'fixture',auth:'Fixture',models:[{id:'one',name:'Model One',efforts:['low','medium','high','xhigh','max'],defaultEffort:'high',isDefault:true},{id:'two',name:'Model Two',efforts:['low','high'],defaultEffort:'low'}]};
const server=createServer({directory:path.join(root,'data'),codexOptions:{discover:async()=>provider},claudeOptions:{discover:async()=>provider},terminalOptions:{discover:async()=>provider},githubOptions:{inspect:async()=>({git:{remotes:[{name:'origin',webURL:'https://github.com/fixture/cards'}]}}),request:async()=>({id:1,number:1,title:'Fixture',body:'Work',state:'open',labels:[],assignees:[],comments:0,user:{login:'fixture'},updated_at:'2026-09-21T00:00:00Z'})}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));const url='http://127.0.0.1:'+server.address().port;
const project=await(await fetch(url+'/api/projects',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({name:'Cards',folderPath:path.join(root,'project')})})).json();
const browser=await chromium.launch({channel:'chrome'});
try{
 const page=await browser.newPage({viewport:{width:1440,height:1100}});page.setDefaultTimeout(10000);const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(url+'/#sessions/'+project.id);
 const card=page.locator('.agent-selection-card').first();await card.waitFor();
 // The overlay scales in from its pill; measure it only once the transform has settled.
 const settled=()=>page.waitForFunction(()=>{const el=document.querySelector(':popover-open');if(!el)return false;const t=getComputedStyle(el).transform;return t==='none'||/^matrix\(1, 0, 0, 1,/.test(t);});
 assert.equal(await card.locator('[data-placeholder="true"]').count(),3);
 await page.getByRole('button',{name:'Start session',exact:true}).click();
 assert.equal(await page.locator(':popover-open').getAttribute('aria-label'),'Choose agent');
 assert.equal((await(await fetch(url+'/api/sessions')).json()).length,0);
 await page.keyboard.press('Escape');
 const bounds=await card.locator('.agent-selection-pill').evaluateAll(els=>els.map(e=>e.getBoundingClientRect().width));assert(Math.max(...bounds)-Math.min(...bounds)<1);
 await card.locator('[data-agent-parameter="agent"]').click();await page.locator(':popover-open .choice-pill').filter({hasText:'Claude'}).locator('span').click();
 await card.locator('[data-agent-parameter="model"]').click();await page.locator(':popover-open .choice-pill').filter({hasText:'Model Two'}).locator('span').click();
 await card.locator('[data-agent-parameter="effort"]').click();await page.getByRole('slider',{name:'Effort',exact:true}).focus();await page.keyboard.press('End');await page.locator(':popover-open').getByRole('button',{name:'Done',exact:true}).click();
 assert.match(await card.innerText(),/Claude/);assert.match(await card.innerText(),/Model Two/);assert.match(await card.innerText(),/high/);
 await page.reload();await page.waitForFunction(()=>document.querySelector('.agent-selection-card')?.textContent.includes('Model Two'));
 assert.equal(await page.locator('.agent-selection-card [data-placeholder="true"]').count(),0);
 assert.match(await card.locator('[data-agent-parameter="effort"]').innerText(),/high/);
 await card.locator('[data-agent-parameter="effort"]').click();await page.keyboard.press('Escape');assert.equal(await page.locator(':popover-open').count(),0);
 // Change a restored selection immediately, without a reload to make it take effect.
 await card.locator('[data-agent-parameter="model"]').click();await page.locator(':popover-open .choice-pill').filter({hasText:'Model One'}).locator('span').click();
 assert.match(await card.locator('[data-agent-parameter="model"]').innerText(),/Model One/);
 // Dependent pills follow the form's new defaults: no placeholders, and the cache matches the controls.
 await page.waitForFunction(()=>JSON.parse(localStorage.getItem('skd-agent-choice-main')).effort==='high');
 assert.equal(await card.locator('[data-placeholder="true"]').count(),0);
 assert.deepEqual(await page.evaluate(()=>({model:document.querySelector('[name="model"]:checked').value,effort:document.querySelector('#session-effort').getAttribute('aria-valuetext')})),{model:'one',effort:'high'});
 await card.locator('[data-agent-parameter="effort"]').click();await page.getByRole('slider',{name:'Effort',exact:true}).focus();await page.keyboard.press('End');await page.locator(':popover-open').getByRole('button',{name:'Done',exact:true}).click();
 assert.deepEqual(await page.evaluate(()=>JSON.parse(localStorage.getItem('skd-agent-choice-main'))),{agent:'claude',model:'one',effort:'max'});

 // The overlay replaces the pills in the card's footprint; clicking outside dismisses it. Arrow-key radio changes are committed.
 await card.locator('[data-agent-parameter="agent"]').click();
 await settled();
 const [cardBox,overlayBox]=[await card.boundingBox(),await page.locator(':popover-open').boundingBox()];
 assert(Math.abs(cardBox.x-overlayBox.x)<1&&Math.abs(cardBox.y-overlayBox.y)<1&&Math.abs(cardBox.width-overlayBox.width)<1&&overlayBox.height>=cardBox.height-1);
 await page.mouse.click(5,5);
 assert.equal(await page.locator(':popover-open').count(),0);
 await card.locator('[data-agent-parameter="agent"]').click();await page.keyboard.press('ArrowLeft');
 await page.keyboard.press('Escape');
 assert.match(await card.locator('[data-agent-parameter="agent"]').innerText(),/Codex/);
 await card.locator('[data-agent-parameter="model"]').click();await page.getByRole('radio',{name:'Model One',exact:true}).focus();await page.keyboard.press('ArrowRight');
 await page.keyboard.press('Escape');
 assert.match(await card.locator('[data-agent-parameter="model"]').innerText(),/Model Two/);
 await card.locator('[data-agent-parameter="effort"]').click();await page.getByRole('slider',{name:'Effort',exact:true}).focus();await page.keyboard.press('End');
 await page.locator(':popover-open').getByRole('button',{name:'Done',exact:true}).click();
 assert.deepEqual(await page.evaluate(()=>JSON.parse(localStorage.getItem('skd-agent-choice-main'))),{agent:'codex',model:'two',effort:'high'});
 await page.emulateMedia({reducedMotion:'reduce'});await card.locator('[data-agent-parameter="model"]').click();
 assert.equal(await page.locator(':popover-open').evaluate(el=>getComputedStyle(el).transitionDuration),'0s');await page.keyboard.press('Escape');await page.emulateMedia({reducedMotion:'no-preference'});
 await page.goto(url+'/#issues/'+project.id+'/1');await page.reload();await page.getByRole('button',{name:'Edit plan',exact:true}).click();await page.locator('.agent-selection-card').waitFor();await page.locator('#orchestration-card>summary').click();await page.waitForFunction(()=>document.querySelectorAll('.agent-selection-card').length===3);
 await page.getByLabel('Appearance',{exact:true}).selectOption('dark');
 await page.waitForTimeout(250);
 await page.screenshot({path:'output/agent-cards.png',fullPage:true,animations:'disabled'});
 const worker=page.locator('[data-assignment="worker"] .agent-selection-card');
 await worker.locator('[data-agent-parameter="model"]').click();await page.waitForTimeout(200);await page.screenshot({path:'output/agent-card-overlay.png',fullPage:true});await page.keyboard.press('Escape');
 await page.setViewportSize({width:390,height:844});await worker.locator('[data-agent-parameter="effort"]').click();assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));const overlay=await page.locator(':popover-open').boundingBox();assert(overlay.x>=0&&overlay.x+overlay.width<=391);await page.keyboard.press('Escape');
 assert.deepEqual(errors,[]);console.log('Agent cards passed: placeholders, equal pills, overlays, keyboard, cache, role cards, mobile.');
}finally{await browser.close();server.shutdownCodex();server.closeAllConnections();await new Promise(r=>server.close(r));rmSync(root,{recursive:true,force:true});}
