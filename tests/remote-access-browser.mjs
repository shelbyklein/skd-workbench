import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {createServer} from '../server.js';

// An expired Cloudflare Access session answers API calls with a cross-origin redirect.
// The app reloads once to reach the sign-in page instead of reporting the server as down.
const root=mkdtempSync(path.join(tmpdir(),'skd-remote-browser-')),directory=path.join(root,'data');
const server=createServer({directory});await new Promise(r=>server.listen(0,'127.0.0.1',r));const local=`http://127.0.0.1:${server.address().port}`;
const browser=await chromium.launch({channel:process.env.PLAYWRIGHT_CHANNEL||'chrome'});
const login='https://fixture-team.cloudflareaccess.com/cdn-cgi/access/login/workbench.example.com';
try{
 mkdirSync('output',{recursive:true});
 for(const [origin,heading] of [[local,'Server unavailable'],['https://workbench.example.com','Workbench unavailable']]){
  const context=await browser.newContext({serviceWorkers:'block',viewport:{width:1280,height:900}}),page=await context.newPage();page.setDefaultTimeout(15000);
  const errors=[],loads=[],redirected=[];page.on('pageerror',e=>errors.push(e.message));page.on('load',()=>loads.push(Date.now()));
  // The remote origin is served by the loopback fixture server (the tunnel and Access checks are covered in remote-access-server.test.js).
  if(origin!==local)await page.route(`${origin}/**`,async route=>{const u=new URL(route.request().url());const {origin:_,...headers}=route.request().headers();return route.fulfill({response:await route.fetch({url:local+u.pathname+u.search,headers})});});
  await page.route(`${origin}/api/state`,route=>{redirected.push(route.request().url());return route.fulfill({status:302,headers:{location:login}});});
  await page.goto(origin+'/');
  await page.getByRole('heading',{name:heading}).waitFor();
  assert.equal(loads.length,2,'reloads exactly once to reach the sign-in redirect');assert.equal(redirected.length,2);
  const text=await page.locator('#app').innerText();
  assert.match(text,/Remote sign-in expired/);assert.doesNotMatch(text,/Local server unavailable/);
  if(origin!==local){
   assert.doesNotMatch(text,/launcher/i);
   await page.screenshot({path:'output/remote-access-expired.png'});
   await page.unroute(`${origin}/api/state`);await page.getByRole('button',{name:'Reload',exact:true}).click();
   await page.locator('#home-decisions, [data-view-link], .page-heading h1').first().waitFor();assert.equal(loads.length,3);
  }
  assert.deepEqual(errors,[]);await page.unrouteAll({behavior:'ignoreErrors'});await context.close();
 }
 console.log('Remote access browser passed: expired Access sign-in reloads once (local and remote host), remote startup copy without launcher steps, Reload recovers. Fixture only; no Cloudflare traffic.');
}finally{await browser.close();server.closeAllConnections();await new Promise(r=>server.close(r));rmSync(root,{recursive:true,force:true});}
