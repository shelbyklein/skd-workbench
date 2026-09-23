import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,rmSync,readFileSync,existsSync} from 'node:fs';
import path from 'node:path';import {tmpdir} from 'node:os';
import {createServer} from '../server.js';
// Coordinator chat and live CLI view on Home and a project, using the interactive fixture CLI in a real PTY
// over the real Workbench MCP bridge. No provider inference.
const root=mkdtempSync(path.join(tmpdir(),'skd-coordinator-cli-browser-'));mkdirSync(path.join(root,'newton'));
const log=path.join(root,'fixture.log');process.env.COORDINATOR_FIXTURE_LOG=log;
const sessions=()=>existsSync(log)?readFileSync(log,'utf8').trim().split('\n').filter(l=>l.includes('"mode":"session"')).length:0;
const fixture=path.resolve('tests/fixtures/coordinator-cli.mjs'),catalog=async()=>({version:'fixture',models:[{id:'fixture',name:'Fixture',efforts:['low','default']}]});
const server=createServer({directory:path.join(root,'data'),codexOptions:{binary:fixture,discover:catalog},claudeOptions:{binary:fixture,discover:catalog}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));const url=`http://127.0.0.1:${server.address().port}`;
const api=async(route,input,method)=>{const res=await fetch(url+'/api/'+route,{method:method||(input?'POST':'GET'),headers:{'Content-Type':'application/json'},...(input?{body:JSON.stringify(input)}:{})});return res.json();};
const browser=await chromium.launch({channel:process.env.PLAYWRIGHT_CHANNEL||'chrome'});
try{
 const project=await api('projects',{name:'Newton',folderPath:path.join(root,'newton')});
 const page=await browser.newPage({viewport:{width:1440,height:1000}});page.setDefaultTimeout(15000);const errors=[];page.on('pageerror',e=>errors.push(e.message));
 // Terminal rows wrap at the panel width; join them before matching.
 const screen=async()=>(await page.locator('.coordinator-terminal .xterm-rows').innerText()).replace(/\n/g,'');
 const waitScreen=re=>page.waitForFunction(source=>new RegExp(source).test((document.querySelector('.coordinator-terminal .xterm-rows')?.innerText||'').replace(/\n/g,'')),re.source);
 await page.goto(url);await page.locator('#home-decisions').waitFor();
 assert.equal(await page.locator('#agent-composer').count(),0,'Home has no coordinator card; the side panel replaces it.');
 const dock=page.getByRole('complementary',{name:'Coordinator panel',exact:true}),tab=name=>dock.getByRole('button',{name,exact:true});
 await page.getByRole('button',{name:'Toggle coordinator panel',exact:true}).click();await dock.waitFor();
 await page.waitForFunction(()=>/Coordinator agent off/.test(document.querySelector('#dock-coordinator')?.textContent));
 await tab('CLI').click();await dock.getByText('The coordinator agent is off.').waitFor();await tab('Chat').click();
 await dock.locator('#dock-coordinator [data-coordinator-settings]').click();await page.getByRole('heading',{name:'Coordinator agent'}).waitFor();
 assert.match(await page.locator('#dialog').textContent(),/asks in the CLI before it starts or changes work/);
 await page.locator('#dialog [name=enabled]').check();await page.locator('#dialog [name=provider]').selectOption('claude');await page.locator('#dialog [name=model]').selectOption('fixture');await page.locator('#dialog [name=effort]').selectOption('low');
 await page.getByRole('button',{name:'Save',exact:true}).click();
 await page.waitForFunction(()=>/Claude Code · fixture · No session/.test(document.querySelector('#dock-coordinator')?.textContent));
 // Chat: the message goes into a new live session and the agent posts its reply.
 await page.locator('#dock-message').fill('hi from browser');await page.locator('#dock-send').click();
 await page.getByText('Echo: hi from browser (1 granted project)').waitFor();
 assert.match(await dock.locator('.agent-message-agent').last().textContent(),/Workbench coordinator/);
 await page.waitForFunction(()=>/Session running/.test(document.querySelector('#dock-coordinator')?.textContent));
 // CLI: the same session, with the tool calls, live.
 await tab('CLI').click();await page.locator('.coordinator-terminal').waitFor();
 assert.equal(await page.locator('#dock-messages').isHidden(),true);assert.equal(await page.locator('#dock-composer').isHidden(),true,'CLI mode hides the message box.');
 assert.equal(await tab('CLI').getAttribute('aria-pressed'),'true');
 await waitScreen(/> hi from browser/);assert.match(await screen(),/workbench - list_projects \(MCP\)/);
 await page.screenshot({path:'output/coordinator-cli-live.png'});
 // Typing in the CLI reaches the session; the reply still lands in the chat.
 await page.locator('.coordinator-terminal .terminal-screen').click();await page.keyboard.type('typed in cli');await page.keyboard.press('Enter');
 await waitScreen(/> typed in cli/);
 await tab('Chat').click();await page.getByText('Echo: typed in cli (1 granted project)').waitFor();assert.equal(await page.locator('#dock-composer').isVisible(),true);
 assert.equal(await page.locator('.coordinator-terminal').count(),0);
 await page.locator('#dock-message').fill('from chat again');await page.keyboard.press('Control+Enter');await page.getByText('Echo: from chat again (1 granted project)').waitFor();
 // Keyboard: the switch is reachable and reopening shows the same session without a respawn.
 await tab('CLI').focus();await page.keyboard.press('Enter');await waitScreen(/> from chat again/);
 assert.equal(sessions(),1,'Switching views never starts another CLI.');
 // Stop: the session becomes a read-only transcript in the history.
 await page.getByRole('button',{name:'Stop session',exact:true}).click();
 await page.waitForFunction(()=>/No session/.test(document.querySelector('#dock-coordinator')?.textContent));
 await page.locator('[data-coordinator-history]').first().waitFor();assert.match(await page.locator('.coordinator-terminal footer').textContent(),/Read-only transcript\. This session stopped\./);
 await waitScreen(/> from chat again/);
 assert.equal(await page.getByRole('button',{name:'Stop session',exact:true}).count(),0,'No Stop on a read-only transcript.');assert.equal(await page.getByText('Back to current session').count(),0);
 await page.screenshot({path:'output/coordinator-cli-history.png'});
 // Start session from the CLI view without sending a message.
 const agentReplies=async()=>(await api('coordinator/messages')).items.filter(m=>m.author==='agent').length,before=await agentReplies();
 await page.getByRole('button',{name:'Start session',exact:true}).click();
 await page.waitForFunction(()=>/Session running/.test(document.querySelector('#dock-coordinator')?.textContent));await waitScreen(/Fixture Claude Code session/);
 assert.equal(await page.getByRole('button',{name:'Start session',exact:true}).count(),0);assert.equal(sessions(),2);
 await page.waitForTimeout(300);assert.equal(await agentReplies(),before,'Starting a session posts nothing.');
 await page.screenshot({path:'output/coordinator-cli-started.png'});
 await page.getByRole('button',{name:'Stop session',exact:true}).click();await page.waitForFunction(()=>/No session/.test(document.querySelector('#dock-coordinator')?.textContent));
 // A project session asks before starting work: waiting banner, Needs your decision, then approval in the CLI.
 const flow=await api('flows',{projectID:project.id,name:'Review',steps:[{id:'review',type:'agent',name:'Review',model:'fixture',effort:'low',instructions:'Review'},{id:'accept',type:'human',name:'Accept',instructions:'Check',maxRetries:1,retryFrom:'review'}]});
 const owner=await api('agent-profiles',{revision:0,name:'Newton owner',scope:{kind:'project',projectID:project.id},providers:['codex'],systemPrompt:'Own it.',skillIDs:[],connectionIDs:[]});
 await api('projects/'+project.id+'/mandate',{version:0,enabled:true,agentProfile:{id:owner.id},objective:'Pilot',tasks:[{ref:'local:pilot'}],workflowIDs:[flow.id],modes:['read-only'],limits:{maxAttempts:1,maxRuntimeMinutes:30}},'PUT');
 // An all-projects prompt: Home's Open CLI opens the side panel on CLI; declining starts nothing.
 await api('coordinator/messages',{text:'please launch the pilot',requestKey:'c1'});
 await dock.getByRole('button',{name:'Hide',exact:true}).click();await page.goto(url+'#home');
 await page.getByText('Coordinator · Waiting for you in the coordinator CLI').waitFor();
 await page.locator('[data-home-open-cli=""]').click();await dock.waitFor();assert.equal(await tab('CLI').getAttribute('aria-pressed'),'true');
 await waitScreen(/Do you want to allow workbench - start_run\?/);await page.screenshot({path:'output/coordinator-dock-prompt.png'});
 await page.locator('.coordinator-terminal .terminal-screen').click();await page.keyboard.type('n');
 await tab('Chat').click();await dock.getByText('Tool error: declined by the user').waitFor();assert.equal((await api('workflows?projectID='+project.id)).length,0);
 await dock.getByRole('button',{name:'Hide',exact:true}).click();
 await api('projects/'+project.id+'/messages',{text:'please launch the pilot',requestKey:'b1'});
 await page.goto(url+'#home');
 await page.getByText('Newton · Waiting for you in the coordinator CLI').waitFor();await page.getByText('Coordinator · Waiting for you in the coordinator CLI').waitFor({state:'detached'});
 assert.match(await page.locator('#home-agent-summary').textContent(),/1 needs a decision/);
 await page.screenshot({path:'output/coordinator-home-waiting.png',fullPage:true});
 await page.locator('[data-home-open-cli]').click();await page.locator('#agent-decisions').waitFor();
 await page.locator('.coordinator-terminal').waitFor();await waitScreen(/Do you want to allow workbench - start_run\?/);
 assert.match(await page.locator('#agent-coordinator').textContent(),/Waiting for you in CLI/);assert.equal(await page.locator('[data-coordinator-open-cli]').count(),0,'No Open CLI button inside the CLI view.');
 assert.equal((await api('workflows?projectID='+project.id)).length,0,'Nothing starts before approval.');
 await page.screenshot({path:'output/coordinator-cli-prompt.png'});
 await page.locator('.coordinator-terminal .terminal-screen').click();await page.keyboard.type('y');
 await page.getByRole('button',{name:'Chat',exact:true}).click();await page.getByText(/Started local:pilot under mandate v1/).waitFor();
 await page.waitForFunction(()=>!/Waiting for you/.test(document.querySelector('#agent-coordinator')?.textContent));
 assert.equal((await api('workflows?projectID='+project.id)).length,1);
 await page.screenshot({path:'output/coordinator-project-chat.png',fullPage:true});
 // Dark theme and a phone-width CLI view.
 await page.getByRole('button',{name:'CLI',exact:true}).click();await page.locator('.coordinator-terminal').waitFor();
 await page.emulateMedia({colorScheme:'dark'});await page.waitForFunction(()=>document.documentElement.dataset.theme==='dark');await page.screenshot({path:'output/coordinator-cli-dark.png'});
 await page.setViewportSize({width:390,height:844});await page.locator('.coordinator-terminal').scrollIntoViewIfNeeded();await page.waitForTimeout(400);
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);await page.screenshot({path:'output/coordinator-cli-mobile.png'});
 assert.deepEqual(errors,[]);
 console.log('Coordinator CLI browser passed: setup, chat into a live session, Chat/CLI switch, typing in the CLI, no respawn, stop and read-only history, permission prompt as a Home and project decision approved in the CLI, keyboard, dark and 390 px. Fixture CLI only.');
}finally{await browser.close();server.shutdownCodex();server.closeAllConnections();await new Promise(r=>server.close(r));rmSync(root,{recursive:true,force:true});}
