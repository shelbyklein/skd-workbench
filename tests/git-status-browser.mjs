import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {Store} from '../lib/store.js';
import {createServer} from '../server.js';

const git=(cwd,...args)=>execFileSync('git',['-C',cwd,...args],{encoding:'utf8',stdio:['ignore','pipe','pipe']}).trim();
const base=mkdtempSync(path.join(tmpdir(),'skd-git-widget-')),directory=path.join(base,'data'),folder=path.join(base,'repo'),empty=path.join(base,'empty');
mkdirSync(folder);mkdirSync(empty);git(folder,'init','-b','main');git(folder,'config','user.name','Fixture');git(folder,'config','user.email','fixture@example.invalid');writeFileSync(path.join(folder,'file'),'initial');git(folder,'add','.');git(folder,'commit','-m','Initial');git(folder,'remote','add','origin','https://example.invalid/team/repo');
git(folder,'update-ref','refs/remotes/origin/main','HEAD');git(folder,'symbolic-ref','refs/remotes/origin/HEAD','refs/remotes/origin/main');git(folder,'branch','--set-upstream-to=origin/main');
const work=path.join(base,'feature worktree');git(folder,'worktree','add','-b','feature/review',work);writeFileSync(path.join(work,'file'),'feature');git(work,'add','.');git(work,'commit','-m','Feature');writeFileSync(path.join(work,'draft'),'dirty work');
git(folder,'branch','not-checked-out');
const store=new Store(directory),project=store.createProject({name:'Repository fixture',folderPath:folder}),nonGit=store.createProject({name:'Notes fixture',folderPath:empty});
const commit=git(folder,'rev-parse','HEAD');let checks=0,fail=false;
const server=createServer({directory,codexOptions:{binary:'/usr/bin/false',discover:async()=>({version:'fixture',models:[]})},githubOptions:{inspect:async()=>({git:{remotes:[]}})},gitStatusOptions:{advertise:async()=>{checks++;if(fail)throw new Error('offline fixture');return {defaultBranch:'main',tips:{'refs/heads/main':commit}};}}});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const url=`http://127.0.0.1:${server.address().port}`;
const browser=await chromium.launch({channel:process.env.PLAYWRIGHT_CHANNEL||'chrome',headless:true});
try{
 const page=await browser.newPage({viewport:{width:1440,height:1100},colorScheme:'dark',serviceWorkers:'block'}),errors=[];page.on('pageerror',e=>errors.push(e.message));page.setDefaultTimeout(10000);
 await page.goto(url+'/#project/'+project.id);const widget=page.locator('.git-status-widget');
 await widget.locator('.git-branch-summary strong').getByText('main',{exact:true}).waitFor();assert.equal(await widget.locator('.git-detail-panel').isVisible(),false);await widget.getByRole('button',{name:'Details',exact:true}).click();assert.match(await widget.textContent(),/Clean/);assert.match(await widget.textContent(),/1 branch with commits absent from main/);assert.match(await widget.textContent(),/1 dirty worktree/);assert.equal(checks,0);
 await widget.getByRole('button',{name:'Check remote',exact:true}).click();await widget.getByText(/Default branch: main/).waitFor();assert.match(await widget.locator('.git-compact-footer').textContent(),/main matches origin/);assert.equal(checks,1);assert.match(await widget.locator('.git-remote-report').textContent(),/Same commit/);
 assert(!/All up to date|Ready to merge/.test(await widget.textContent()));
 const summary=widget.locator('summary');await summary.focus();await page.keyboard.press('Enter');await widget.getByText('not-checked-out',{exact:true}).waitFor();assert.match(await widget.textContent(),/Not checked out/);assert.match(await widget.locator('.git-worktree-list').textContent(),/feature\/review.*1 untracked/s);
 mkdirSync('output',{recursive:true});await page.screenshot({path:'output/git-status-desktop.png',fullPage:true});
 await widget.locator('[data-git-action="target"]').selectOption('refs/heads/feature/review');await widget.getByText('Against feature/review',{exact:true}).waitFor();await widget.getByRole('button',{name:'Refresh local',exact:true}).waitFor({state:'visible'});
 await page.reload();await widget.getByRole('button',{name:'Details',exact:true}).click();await widget.getByText('Against feature/review',{exact:true}).waitFor();assert.equal(await widget.locator('[data-git-action="target"]').inputValue(),'refs/heads/feature/review');
 await widget.locator('[data-git-action="target"]').selectOption('');await widget.getByText('Against main',{exact:true}).waitFor();
 fail=true;await widget.getByRole('button',{name:'Check remote',exact:true}).click();await widget.locator('.git-remote-report').getByText(/Remote check failed/).waitFor();assert.match(await widget.textContent(),/Previous observation — stale/);assert.match(await widget.textContent(),/On main/);
 await page.setViewportSize({width:390,height:844});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await page.screenshot({path:'output/git-status-mobile.png',fullPage:true});
 // Failed local refresh retains visibly stale data, and offers a real recovery action.
 await page.route('**/api/projects/'+project.id+'/git-status*',route=>route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({error:'Inspection unavailable fixture'})}));
 await widget.getByRole('button',{name:'Refresh local',exact:true}).click();await widget.getByText(/Showing previous local observation — stale/).waitFor();assert.equal(await widget.getByRole('button',{name:'Check remote',exact:true}).isDisabled(),true);
 await page.unroute('**/api/projects/'+project.id+'/git-status*');await widget.getByRole('button',{name:'Reset selections and retry'}).click();await page.waitForFunction(()=>!document.querySelector('.git-feedback')?.textContent&&!document.querySelector('[data-git-action="refresh"]')?.disabled);
 // Conflicts in another checkout are visible even while this checkout is clean.
 writeFileSync(path.join(folder,'file'),'main diverges');git(folder,'add','.');git(folder,'commit','-m','Main diverges');assert.throws(()=>git(work,'merge','main'));
 await widget.getByRole('button',{name:'Refresh local',exact:true}).click();await widget.getByRole('button',{name:'Details',exact:true}).click();await widget.getByText(/1 worktree has conflicts/).waitFor();assert.equal(await widget.locator('.git-detail-panel').isVisible(),false);await page.evaluate(()=>{document.querySelector('#toast')?.remove();});await page.setViewportSize({width:1440,height:1100});await page.screenshot({path:'output/git-compact-desktop.png',fullPage:true});await page.setViewportSize({width:390,height:844});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await page.screenshot({path:'output/git-compact-mobile.png',fullPage:true});await widget.getByRole('button',{name:/Review →/}).click();assert.equal(await widget.locator('.git-inventory').getAttribute('open'),'');assert.match(await widget.locator('.git-overview-facts').textContent(),/On main.*Clean/s);
 // Late responses must not repaint another project's widget.
 await page.route('**/api/projects/'+project.id+'/git-status*',async route=>{const response=await route.fetch();await new Promise(r=>setTimeout(r,1200));await route.fulfill({response}).catch(()=>{});});
 await widget.getByRole('button',{name:'Refresh local',exact:true}).click();await page.evaluate(id=>{location.hash='#project/'+id;},nonGit.id);await widget.getByText('This folder is not in a Git repository.').waitFor();await page.waitForTimeout(1500);assert.doesNotMatch(await widget.textContent(),/On main/);
 assert.deepEqual(errors,[]);console.log('Git status browser passed: real inventory, remote action/failure, target persistence, stale recovery, project switching, keyboard and mobile.');
}finally{await browser.close();server.shutdownCodex();server.closeAllConnections();await new Promise(resolve=>server.close(resolve));rmSync(base,{recursive:true,force:true});}
