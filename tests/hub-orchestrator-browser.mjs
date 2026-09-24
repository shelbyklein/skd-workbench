import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,rmSync,writeFileSync,readFileSync,existsSync} from 'node:fs';
import path from 'node:path';import {tmpdir} from 'node:os';
import {createServer} from '../server.js';
// The hub: the orchestrator in the side panel routes pasted text to live project agents and relays their
// questions; project pages show the project agent; workflows, delegation and mandates are off the main path.
// Fixture CLIs in real PTYs over the real Workbench MCP bridge; no provider inference.
const root=mkdtempSync(path.join(tmpdir(),'skd-hub-browser-')),log=path.join(root,'fixture.log');process.env.COORDINATOR_FIXTURE_LOG=log;
const fixture=path.resolve('tests/fixtures/coordinator-cli.mjs'),catalog=async()=>({version:'fixture',models:[{id:'fixture',name:'Fixture',efforts:['low','default']},{id:'other',name:'Other',efforts:['low']}]});
const server=createServer({directory:path.join(root,'data'),codexOptions:{binary:fixture,discover:catalog},claudeOptions:{binary:fixture,discover:catalog}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));const url=`http://127.0.0.1:${server.address().port}`;
const api=async(route,input,method)=>{const res=await fetch(url+'/api/'+route,{method:method||(input?'POST':'GET'),headers:{'Content-Type':'application/json'},...(input?{body:JSON.stringify(input)}:{})});return res.json();};
const projects={};for(const name of ['Austin','Newton']){const folder=path.join(root,name.toLowerCase());mkdirSync(folder);writeFileSync(path.join(folder,'CLAUDE.md'),`# ${name}`);projects[name]=await api('projects',{name,folderPath:folder});}
const flow=await api('flows',{projectID:projects.Austin.id,name:'Legacy flow',steps:[{id:'review',type:'agent',name:'Review',model:'fixture',effort:'low',instructions:'Review'}]});
const v=await api('coordinator');await api('coordinator',{version:v.version,enabled:true,provider:'claude',model:'fixture',effort:'low'},'PUT');
const browser=await chromium.launch({channel:process.env.PLAYWRIGHT_CHANNEL||'chrome'});
try{
 const page=await browser.newPage({viewport:{width:1440,height:1000},serviceWorkers:'block'});page.setDefaultTimeout(15000);const errors=[];page.on('pageerror',e=>errors.push(e.message));
 const dock=page.getByRole('complementary',{name:'Coordinator panel',exact:true}),tab=name=>dock.getByRole('button',{name,exact:true});
 await page.goto(url);await page.locator('#home-decisions').waitFor();
 // Main path: no Workflows card, no Project owners, no owner counts.
 assert.equal(await page.locator('[data-global-workflows]').count(),0);assert.equal(await page.getByRole('heading',{name:'Project owners'}).count(),0);
 await page.waitForFunction(()=>/need/.test(document.querySelector('#home-agent-summary')?.textContent||''));assert.doesNotMatch(await page.locator('#home-agent-summary').textContent(),/owner/);
 // Orchestrator: paste an email, it routes to the Austin agent and relays its update.
 await dock.waitFor();assert.equal(await page.getByRole('button',{name:'Toggle coordinator panel'}).count(),0,'The panel is always open.');
 await page.waitForFunction(()=>/hands work to project agents/.test(document.querySelector('#dock-message-help')?.textContent||''));
 await page.locator('#dock-message').fill('I got an email about Austin: change the hours banner to 9–5.');await page.locator('#dock-send').click();
 await dock.getByText('Passed to Austin.').waitFor();await dock.getByText(/Update: Done: I got an email about Austin/).waitFor();
 assert.equal(await dock.getByText(/Done: I got an email about Austin/).count(),1,'Reports appear once, not repeated by the orchestrator.');
 // A question comes back through the orchestrator; the answer is forwarded.
 await page.locator('#dock-message').fill('email about Newton: ask me which colours');await page.keyboard.press('Control+Enter');
 await dock.getByText(/Question: Which option for: email about Newton/).waitFor();
 await page.screenshot({path:'output/hub-orchestrator-relay.png'});
 await page.locator('#dock-message').fill('reply to Newton: blue and gold');await page.locator('#dock-send').click();
 await dock.getByText(/Update: Done: blue and gold/).waitFor();
 const agents=async()=>Promise.all(['Austin','Newton'].map(async n=>(await api(`projects/${projects[n].id}/agent`)).coordinator.session?.status));
 assert.deepEqual(await agents(),['running','running'],'Both project agents run at the same time.');
 
 // Project page: the conversation card is the project agent; mandates and workflows are off the page.
 await page.locator(`.project-card[data-project="${projects.Austin.id}"]`).click();await page.locator('#agent-decisions').waitFor();
 await page.waitForFunction(()=>/Austin/.test(document.querySelector('#dockp-thread-title')?.textContent||''));
 assert.equal(await page.locator('#agent-mandate-card').count(),0);assert.equal(await page.locator('.sidebar [data-sidebar-view=overview]').count(),0);
 assert.match(await page.locator('#project-owner').textContent(),/Agent: Claude Code · fixture[\s\S]*Running/);
 assert.match(await page.locator('#dockp-messages').textContent(),/From the orchestrator: I got an email about Austin/);
 await page.locator('.dock-project').getByRole('button',{name:'CLI',exact:true}).click();await page.waitForFunction(()=>/\[from orchestrator\] I got an email/.test((document.querySelector('.dock-project .coordinator-terminal .xterm-rows')?.innerText||'').replace(/\n/g,'')));
 await page.screenshot({path:'output/hub-project-agent.png'});
 // Project agent settings: model and workspace; saving ends the running session.
 await page.locator('.dock-project').getByRole('button',{name:'Chat',exact:true}).click();await page.locator('#dockp-coordinator [data-coordinator-settings]').click();
 await page.getByRole('heading',{name:'Project agent'}).waitFor();await page.locator('#dialog [name=model]').selectOption('other');await page.locator('#dialog [name=effort]').selectOption('low');
 await page.getByLabel('Project folder').check();await page.screenshot({path:'output/hub-project-agent-settings.png'});
 await page.getByRole('button',{name:'Save',exact:true}).click();
 await page.waitForFunction(()=>/Claude Code · other · project folder · No session/.test(document.querySelector('#dockp-coordinator')?.textContent||''));
 assert.equal((await api(`projects/${projects.Austin.id}/agent`)).coordinator.history[0].endReason,'settings');
 // The Workflows routes still render for existing data.
 await page.evaluate(id=>location.hash='#workflows/'+id,projects.Austin.id);await page.getByRole('heading',{name:'Workflows',exact:true}).waitFor();await page.getByText('Legacy flow').first().waitFor();
 await page.evaluate(()=>location.hash='#workflows');await page.getByRole('heading',{name:'Workflows',exact:true}).waitFor();
 // Dark and phone widths.
 await page.goto(url+'#project/'+projects.Newton.id);await page.locator('#agent-decisions').waitFor();await page.emulateMedia({colorScheme:'dark'});await page.waitForTimeout(300);await page.screenshot({path:'output/hub-project-dark.png',fullPage:true});
 await page.setViewportSize({width:390,height:844});await page.waitForTimeout(300);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);await page.screenshot({path:'output/hub-project-mobile.png',fullPage:true});
 const sessions=readFileSync(log,'utf8').trim().split('\n').map(l=>JSON.parse(l)).filter(e=>e.mode==='session'&&e.role==='project');
 assert.deepEqual([...new Set(sessions.map(s=>path.basename(s.cwd)))].sort(),['austin','newton'],'Project agents ran in their own folders.');
 assert.deepEqual(errors,[]);
 console.log('Hub orchestrator browser passed: pasted email routed to the Austin agent, update relayed, Newton question relayed and answered, two agents in parallel, project card as project agent (owner line, CLI), project agent settings end the session, workflows/mandates/owners off the main path with routes intact, dark and 390 px. Fixture CLIs only.');
}finally{await browser.close();server.shutdownCodex();server.closeAllConnections();await new Promise(r=>server.close(r));rmSync(root,{recursive:true,force:true});}
