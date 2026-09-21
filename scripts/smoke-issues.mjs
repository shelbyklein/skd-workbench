// Real GitHub reads; --agent codex|claude additionally consumes agent account usage.
// GitHub mutations are rejected by this fixture server, including Apply actions.
import {chromium} from 'playwright';
import {mkdirSync,mkdtempSync,writeFileSync} from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {Store} from '../lib/store.js';
import {GitHubIssues} from '../lib/issues.js';
import {createServer} from '../server.js';
const resumeIndex=process.argv.indexOf('--resume'),resume=resumeIndex<0?null:process.argv[resumeIndex+1];
const agentIndex=process.argv.indexOf('--agent'),agent=agentIndex<0?null:process.argv[agentIndex+1];
assert(!agent||['codex','claude'].includes(agent),'Use --agent codex or --agent claude.');
mkdirSync('output',{recursive:true});const directory=resume?path.resolve(resume):mkdtempSync(path.resolve('output/issues-smoke-')),store=new Store(directory),project=resume?store.snapshot().projects.find(p=>p.name==='SKD Workbench'):store.createProject({name:'SKD Workbench',folderPath:process.cwd()}),github=new GitHubIssues(),requests=[];
const server=createServer({directory,githubOptions:{request:async(endpoint,method='GET',payload)=>{assert.equal(method,'GET','Live smoke prohibits GitHub writes');requests.push(endpoint);return github.request(endpoint,method,payload);}}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));const url=`http://127.0.0.1:${server.address().port}`,browser=await chromium.launch({channel:process.env.PLAYWRIGHT_CHANNEL||'chrome'});
try{
 const page=await browser.newPage({viewport:{width:1512,height:1100}}),errors=[];page.on('pageerror',e=>errors.push(e.message));page.setDefaultTimeout(30000);
 await page.goto(url);await page.locator(`[data-project="${project.id}"]`).click();await page.locator('main [data-view-link="issues"]').click();await page.locator('[data-issue="2"]').click();await page.locator('#issue-instruction').waitFor();
 let result=null;
 if(agent&&!resume){await page.locator(`[name="issue-agent"][value="${agent}"]`).check();await page.locator('[name="issue-model"]').first().waitFor();const available=await page.locator('[name="issue-model"]').evaluateAll(inputs=>inputs.map(i=>i.value));const preferred=agent==='codex'?available.find(v=>v==='gpt-5.6-sol')||available.find(v=>/mini|sol/.test(v))||available[0]:available.find(v=>v==='haiku')||available[0];await page.locator(`[name="issue-model"][value="${preferred}"]`).check();await page.locator('#issue-effort').focus();await page.keyboard.press('Home');await page.getByLabel('Requested edit',{exact:true}).fill('Return the current title and description unchanged. This is a draft-only connectivity check; do not edit anything.');await page.locator('#issue-generate').click();await page.getByRole('heading',{name:/Ready for your review|Proposal failed/}).waitFor({timeout:180000});result=await(await fetch(`${url}/api/projects/${project.id}/issues/2/proposals`)).json();assert.equal(result[0].status,'ready',result[0].error);assert.equal(result[0].proposed.title,result[0].original.title);assert.equal(result[0].proposed.body.trimEnd(),result[0].original.body.trimEnd());}
 if(resume){await page.getByRole('heading',{name:'Ready for your review'}).waitFor();result=await(await fetch(`${url}/api/projects/${project.id}/issues/2/proposals`)).json();assert.equal(result[0].status,'ready');assert.equal(result[0].proposed.title,result[0].original.title);assert.equal(result[0].proposed.body.trimEnd(),result[0].original.body.trimEnd());}
 await page.locator('.issue-edit').screenshot({path:'output/issues-agent-review.png'});
 await page.screenshot({path:'output/issues-real-desktop.png',fullPage:true});await page.setViewportSize({width:390,height:844});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);await page.screenshot({path:'output/issues-real-mobile.png',fullPage:true});assert.deepEqual(errors,[]);
 const receipt={checkedAt:new Date().toISOString(),repository:'shelbyklein/skd-workbench',directory,githubReads:requests.length,githubWrites:0,agent,proposal:result?.[0]||null,errors};writeFileSync('output/issues-real-receipt.json',JSON.stringify(receipt,null,2));console.log(JSON.stringify({directory,githubReads:requests.length,githubWrites:0,agent,status:result?.[0]?.status,model:result?.[0]?.run.model,usage:result?.[0]?.run.usage,errors},null,2));
}finally{await browser.close();server.shutdownCodex();server.closeAllConnections();await new Promise(r=>server.close(r));}
