import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {Store} from '../lib/store.js';
import {createServer} from '../server.js';
const root=mkdtempSync(path.join(tmpdir(),'skd-home-overview-')),directory=path.join(root,'data'),store=new Store(directory);
const projects=['Workbench','Newton','Tracker Trapper','On Target'].map((name,i)=>{const folderPath=path.join(root,`project${i}`);mkdirSync(folderPath);return store.createProject({name,folderPath});});
const raw=(number,title,label)=>({id:number,number,title,body:'Fixture issue',state:'open',updated_at:'2026-09-24T12:00:00Z',user:{login:'fixture'},labels:[{name:label}],assignees:[],comments:0});
const issues=[raw(1,'Polish mobile navigation','priority: low'),raw(2,'Keep project context when navigating','priority: high'),raw(3,'Fix interrupted session recovery','priority: urgent'),raw(4,'Improve attachment previews','priority: medium')];
let mode='normal';
const server=createServer({directory,spawnProcess:()=>{throw Error('No execution allowed');},githubOptions:{inspect:async folder=>({git:{remotes:[{name:'origin',webURL:'https://github.com/fixture/'+path.basename(folder)}]}}),request:async(endpoint)=>{
 if(endpoint==='graphql')return {data:{repository:{issues:{totalCount:4}}}};
 if(endpoint.includes('/comments?'))return [];
 if(mode==='empty')return [];
 if(mode==='error')throw Error('Fixture unavailable');
 const match=endpoint.match(/\/issues\/(\d+)$/);if(match)return issues.find(i=>i.number===+match[1]);
 if(mode==='partial')return Array.from({length:50},(_,i)=>raw(i+1,`Issue ${i+1}`,'priority: medium'));
 return issues;
}}});await new Promise(r=>server.listen(0,'127.0.0.1',r));
const browser=await chromium.launch({channel:'chrome'});
try{
 const page=await browser.newPage({viewport:{width:1600,height:1000},colorScheme:'dark'});const errors=[];page.on('pageerror',e=>errors.push(e.message));
 const url=`http://127.0.0.1:${server.address().port}/#home`;
 await page.goto(url);await page.locator('.home-project-card .priority-issue-row').first().waitFor();
 await page.waitForFunction(()=>document.querySelectorAll('.home-project-card .priority-issue-row').length===12);
 assert.equal(await page.locator('.home-project-card').count(),4);
 assert.equal(await page.locator('.home-project-grid').evaluate(el=>getComputedStyle(el).gridTemplateColumns.split(' ').length),2);
 const boxes=await page.locator('.home-project-card').evaluateAll(es=>es.map(e=>({x:e.getBoundingClientRect().x,y:e.getBoundingClientRect().y})));
 assert.equal(boxes[0].y,boxes[1].y);assert.equal(boxes[2].y,boxes[3].y);assert(boxes[2].y>boxes[0].y);
 assert.deepEqual(await page.locator('.home-project-card').first().locator('.priority-pill').evaluateAll(p=>p.map(x=>x.title)),['Urgent','High','Medium']);assert.ok((await page.locator('.home-project-card').first().locator('.priority-pill').allTextContents()).every(t=>/^#\d+$/.test(t)),'Pills show the issue number.');
 assert.equal(await page.locator('.home-secondary, .global-pages, #home-briefings').count(),0,'Home is only the project cards (and alerts when needed).');assert.equal(await page.locator('.home-alerts').isHidden(),true,'No alert strip when nothing needs attention.');
 
 mkdirSync('instructions/assets/home-project-overview',{recursive:true});
 await page.screenshot({path:'instructions/assets/home-project-overview/desktop.png',fullPage:true});
 const link=page.locator('.home-project-card').nth(1).locator('.priority-issue-row').first();await link.focus();await page.keyboard.press('Enter');
 await page.waitForURL(`**/#issues/${projects[1].id}/3`);await page.getByRole('heading',{name:issues[2].title,exact:true}).waitFor();
 await page.goto(url);await page.locator('.sidebar nav a',{hasText:'Tools'}).waitFor();
 // List view: one row per project with name, Git and the open-issue count; remembered after a reload.
 await page.locator('[data-home-session][data-state=off]').first().waitFor();assert.equal(await page.locator('[data-home-session]:not([data-state=off])').count(),0,'Outlined circles without live sessions.');
 await page.getByRole('button',{name:'List',exact:true}).click();
 assert.equal(await page.locator('.home-project-grid').evaluate(el=>el.classList.contains('home-project-list')),true);
 assert.equal(await page.locator('.home-project-card .priority-issue-row:visible').count(),0,'Issue previews hide in the list.');
 const rows=await page.locator('.home-project-card').evaluateAll(es=>es.map(e=>e.getBoundingClientRect()));
 assert.ok(rows.every(r=>r.height<90)&&rows[1].y>rows[0].y,'Compact stacked rows.');
 // Without dev/live links, Git still gets the wide column instead of shifting into the links slot.
 const cells=await page.locator('.home-project-card').evaluateAll(es=>es.map(e=>[e.querySelector('.home-git').getBoundingClientRect().width,e.querySelector('.home-issue-heading').getBoundingClientRect().width]));
 assert.ok(cells.every(([git,issues])=>git>issues*2),`Git column keeps its width: ${JSON.stringify(cells)}`);
 await page.waitForFunction(()=>/4 open issues/.test(document.querySelector('.home-project-card [data-project-issues]')?.textContent||''));
 assert.deepEqual(await page.locator('[data-home-layout]').evaluateAll(b=>b.map(x=>x.getAttribute('aria-pressed'))),['false','true']);
 await page.mouse.move(0,0); await page.screenshot({path:'output/home-project-list.png'});
 await page.reload();await page.locator('.home-project-grid.home-project-list').waitFor();assert.equal(await page.getByRole('button',{name:'List',exact:true}).getAttribute('aria-pressed'),'true');
 await page.getByRole('button',{name:'Cards',exact:true}).click();assert.equal(await page.locator('.home-project-grid.home-project-list').count(),0);
 await page.setViewportSize({width:390,height:844});await page.reload();await page.waitForFunction(()=>document.querySelectorAll('.home-project-card .priority-issue-row').length===12);
 assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));assert.equal(await page.locator('.home-project-grid').evaluate(el=>getComputedStyle(el).gridTemplateColumns.split(' ').length),1);
 await page.screenshot({path:'instructions/assets/home-project-overview/mobile.png',fullPage:true});
 mode='partial';await page.reload();await page.getByText('Preview from recently updated issues',{exact:true}).first().waitFor();
 mode='empty';await page.reload();await page.getByText('No open issues.',{exact:true}).first().waitFor();
 mode='error';await page.reload();await page.getByText('Issues unavailable. Refresh to retry.',{exact:true}).first().waitFor();
 assert.deepEqual(errors,[]);console.log('Home overview passed: 2x2 grid, list view, three sorted issues, project-scoped keyboard navigation, collapsed More, mobile, empty and error states.');
}finally{await browser.close();server.closeAllConnections();await new Promise(r=>server.close(r));rmSync(root,{recursive:true,force:true});}
