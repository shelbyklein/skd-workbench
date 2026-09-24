import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,writeFileSync,rmSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import path from 'node:path';import {tmpdir} from 'node:os';
import {createServer} from '../server.js';
// Project page Current work: each branch not merged into main, with its commit subjects and worktree.
const root=mkdtempSync(path.join(tmpdir(),'skd-branch-work-')),repo=path.join(root,'repo');mkdirSync(repo);
const git=(...args)=>execFileSync('git',['-C',repo,'-c','user.name=Fixture','-c','user.email=fixture@example.com',...args],{stdio:'pipe'});
git('init','-q','-b','main');writeFileSync(path.join(repo,'a.txt'),'a');git('add','.');git('commit','-qm','Initial');
git('worktree','add','-q','-b','feature/login',path.join(root,'wt'));
const wt=(...args)=>execFileSync('git',['-C',path.join(root,'wt'),'-c','user.name=Fixture','-c','user.email=fixture@example.com',...args],{stdio:'pipe'});
writeFileSync(path.join(root,'wt','b.txt'),'b');wt('add','.');wt('commit','-qm','Add login form');
writeFileSync(path.join(root,'wt','c.txt'),'c');wt('add','.');wt('commit','-qm','Validate the password field');
writeFileSync(path.join(root,'wt','d.txt'),'uncommitted');
const server=createServer({directory:path.join(root,'data')});
await new Promise(r=>server.listen(0,'127.0.0.1',r));const url=`http://127.0.0.1:${server.address().port}`;
const browser=await chromium.launch({channel:process.env.PLAYWRIGHT_CHANNEL||'chrome'});
try{
 const project=await (await fetch(url+'/api/projects',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:'Repo',folderPath:repo})})).json();
 const page=await browser.newPage({viewport:{width:1440,height:1000}});page.setDefaultTimeout(15000);const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(url+'/#project/'+project.id);
 const row=page.locator('#agent-branches .branch-work-row');await row.first().waitFor();
 assert.equal(await row.count(),1,'main itself is not listed');
 const text=await row.first().innerText();
 assert.match(text,/feature\/login/);assert.match(text,/2 ahead · worktree · 1 uncommitted/);
 assert.match(text,/Validate the password field[\s\S]*Add login form/,'Newest commit first');
 assert.equal(await page.getByText('No active run.').count(),0);
 await page.locator('#agent-current').scrollIntoViewIfNeeded();await page.screenshot({path:'output/branch-work.png'}).catch(()=>{});
 assert.deepEqual(errors,[]);
 console.log('branch work browser ok');
}finally{await browser.close();server.shutdownCodex();server.closeAllConnections();await new Promise(r=>server.close(r));rmSync(root,{recursive:true,force:true});}
