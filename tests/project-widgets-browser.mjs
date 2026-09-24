import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {Store} from '../lib/store.js';
import {createServer} from '../server.js';

const root=mkdtempSync(path.join(tmpdir(),'skd-project-widgets-')),directory=path.join(root,'data'),folder=path.join(root,'project');
mkdirSync(folder);const store=new Store(directory),project=store.createProject({name:'Widget fixture',folderPath:folder});
const now='2026-09-21T12:00:00.000Z';
writeFileSync(path.join(directory,'codex-runs.json'),JSON.stringify([
 {id:'user-session',agent:'codex',projectID:project.id,projectSnapshot:project,sourceContext:{folderPath:folder,git:null},task:'Implement the project dashboard',model:'fixture',effort:'medium',mode:'read-only',status:'completed',createdAt:'2026-09-21T10:00:00.000Z',startedAt:'2026-09-21T10:00:01.000Z',finishedAt:'2026-09-21T10:05:00.000Z',output:'Dashboard finished. No blockers.',activity:[],usage:null,cost:null,error:null,workflowID:null,purpose:null},
 {id:'internal-proposal',agent:'codex',projectID:project.id,projectSnapshot:project,sourceContext:{folderPath:folder,git:null},task:'Internal proposal',model:'fixture',effort:'low',mode:'read-only',status:'completed',createdAt:'2026-09-21T11:00:00.000Z',finishedAt:'2026-09-21T11:01:00.000Z',output:'Internal',activity:[],usage:null,cost:null,error:null,workflowID:null,purpose:'issue-proposal'}
]));
const raw=(number,title,label)=>({id:100+number,number,title,body:'Fixture issue',state:'open',updated_at:now,user:{login:'fixture'},labels:label?[{name:label}]:[],assignees:[],comments:0});
const issues=[raw(1,'No priority issue'),raw(6,'Low issue','priority: low'),raw(4,'High issue','priority: high'),raw(3,'Urgent issue','priority: urgent'),raw(5,'Medium issue','priority: medium'),raw(2,'Second unprioritized issue')];
const server=createServer({directory,codexOptions:{discover:async()=>({version:'fixture',models:[]})},githubOptions:{inspect:async()=>({git:{remotes:[{name:'origin',webURL:'https://github.com/fixture/widgets'}]}}),request:async(endpoint,method='GET')=>{
 if(endpoint==='graphql')return {data:{repository:{issues:{totalCount:issues.length}}}};
 if(endpoint.includes('/comments?'))return [];
 const match=endpoint.match(/\/issues\/(\d+)$/);if(match)return issues.find(issue=>issue.number===Number(match[1]));
 return [...issues,{...raw(9,'Pull request'),pull_request:{}}];
}}});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const url=`http://127.0.0.1:${server.address().port}`;
const browser=await chromium.launch({channel:process.env.PLAYWRIGHT_CHANNEL||'chrome',headless:true});
try{
 const page=await browser.newPage({viewport:{width:1440,height:1100},colorScheme:'dark'}),errors=[];page.on('pageerror',error=>errors.push(error.message));
 await page.goto(url+'/#project/'+project.id);await page.getByRole('heading',{name:'Priority issues',exact:true}).waitFor();
 for(const gone of ['Last session','Recent result'])assert.equal(await page.getByRole('heading',{name:gone,exact:true}).count(),0,gone+' is not on the project page.');assert.equal(await page.locator('.project-quick-actions').count(),0);
 assert.deepEqual(await page.locator('.priority-pill').evaluateAll(p=>p.map(x=>[x.className.replace('priority-pill priority-',''),x.title])),[['urgent','Urgent'],['high','High'],['medium','Medium'],['low','Low'],['none','No priority'],['none','No priority']],'The pill color and title carry the priority; its text is the issue number.');
 assert.ok((await page.locator('.priority-pill').allTextContents()).every(t=>/^#\d+$/.test(t)));
 assert.deepEqual(await page.locator('.priority-issue-copy strong').allTextContents(),['Urgent issue','High issue','Medium issue','Low issue','No priority issue','Second unprioritized issue']);
 assert.equal(await page.locator('.priority-urgent').evaluate(element=>getComputedStyle(element).backgroundColor),'rgb(182, 2, 5)');
 assert.equal(await page.locator('#priority-issues-meta').textContent(),'6 open issues');
 // Reconcile warning replaces Work lifecycle: three limits, saved for this project.
 assert.equal(await page.getByRole('heading',{name:'Work lifecycle',exact:true}).count(),0);
 const limits=page.locator('.reconcile-widget');await limits.getByRole('heading',{name:'Reconcile warning',exact:true}).waitFor();
 assert.equal(await limits.getByLabel('Branches with unmerged commits').inputValue(),'3');
 await limits.getByLabel('Branches with unmerged commits').fill('1');await limits.getByRole('button',{name:'Save limits',exact:true}).click();await limits.getByText('Saved.').waitFor();
 assert.equal((await(await fetch(url+'/api/reconcile-limits')).json()).projects[project.id].unmerged,1);
 await limits.screenshot({path:'output/reconcile-widget.png'});
 mkdirSync('output',{recursive:true});await page.screenshot({path:'output/project-widgets-desktop.png',fullPage:true});
 await page.locator('[data-priority-issue="3"]').click();await page.waitForURL('**/#issues/'+project.id+'/3');await page.getByRole('heading',{name:'Urgent issue',exact:true}).waitFor();
 await page.locator('#project-home').click();await page.setViewportSize({width:390,height:844});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await page.screenshot({path:'output/project-widgets-mobile.png',fullPage:true});
 assert.deepEqual(errors,[]);console.log('Project widgets passed: priority sorting/pills, PR exclusion, issue links, no Last session / Recent result / quick actions / lifecycle, reconcile warning settings, and mobile.');
}finally{await browser.close();server.shutdownCodex();server.closeAllConnections();await new Promise(resolve=>server.close(resolve));rmSync(root,{recursive:true,force:true});}
