import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {Store} from '../lib/store.js';
import {createServer} from '../server.js';
const root=mkdtempSync(path.join(tmpdir(),'skd-counts-')),directory=path.join(root,'data');
const store=new Store(directory);
for(const name of ['Many','One','Zero','Unavailable']){const folderPath=path.join(root,name);mkdirSync(folderPath);store.createProject({name,folderPath});}
const server=createServer({directory,githubOptions:{inspect:async folder=>({git:{remotes:[{name:'origin',webURL:'https://github.com/fixture/'+path.basename(folder)}]}}),request:async(endpoint,method,payload)=>{
 if(endpoint!=='graphql')return [];
 assert.equal(endpoint,'graphql');await new Promise(r=>setTimeout(r,150));
 if(payload.variables.name==='Unavailable')throw Error('GitHub sign-in unavailable');
 return {data:{repository:{issues:{totalCount:{Many:125,One:1,Zero:0}[payload.variables.name]}}}};
}}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const browser=await chromium.launch({channel:process.env.PLAYWRIGHT_CHANNEL||'chrome',headless:true});
try{
 const page=await browser.newPage({viewport:{width:1440,height:1000}});
 await page.goto(`http://127.0.0.1:${server.address().port}/#home`);
 await page.getByText('125 open issues',{exact:true}).waitFor();
 await page.getByText('1 open issue',{exact:true}).waitFor();
 await page.getByText('0 open issues',{exact:true}).waitFor();
 await page.getByText('Issues unavailable',{exact:true}).waitFor();
 assert.equal(await page.locator('[data-project-issues]').count(),4);
 assert.doesNotMatch(await page.locator('.projects-section').textContent(),/workflows/);
 mkdirSync('output',{recursive:true});await page.screenshot({path:'output/project-issue-counts-desktop.png',fullPage:true});
 await page.setViewportSize({width:390,height:844});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 await page.screenshot({path:'output/project-issue-counts-mobile.png',fullPage:true});
 await page.locator('.home-project-card').getByRole('button',{name:'One',exact:true}).click();await page.locator('[data-project-overview]').waitFor();
 console.log('Project issue counts passed: totals, singular, zero, unavailable, navigation and mobile.');
}finally{await browser.close();server.closeAllConnections();await new Promise(r=>server.close(r));rmSync(root,{recursive:true,force:true});}
