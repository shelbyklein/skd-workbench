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
 await page.goto(url);await page.locator('#home-decisions').waitFor({state:'attached'});
 assert.equal(await page.locator('#agent-composer').count(),0,'Home has no coordinator card; the side panel replaces it.');
 const dock=page.getByRole('complementary',{name:'Coordinator panel',exact:true}),tab=name=>['Shell','Hide'].includes(name)?dock.locator('.dock-edge-tabs').getByRole('button',{name,exact:true}):dock.locator('.dock-conversation').getByRole('button',{name,exact:true});
 await dock.waitFor();
 await page.waitForFunction(()=>/Coordinator agent off/.test(document.querySelector('#dock-coordinator')?.textContent));
 assert.equal(await dock.locator('.dock-conversation [data-coordinator-mode]').count(),0,'No Chat / CLI switch until the coordinator is on.');
 await dock.locator('#dock-coordinator [data-coordinator-settings]').click();await page.getByRole('heading',{name:'Coordinator agent'}).waitFor();
 assert.match(await page.locator('#dialog').textContent(),/asks in the CLI before it starts or changes work/);
 await page.locator('#dialog [name=enabled]').check();await page.locator('#dialog [name=provider]').selectOption('claude');await page.locator('#dialog [name=model]').selectOption('fixture');await page.locator('#dialog [name=effort]').selectOption('low');
 await page.getByRole('button',{name:'Save',exact:true}).click();
 await page.waitForFunction(()=>/Claude Code · fixture · No session/.test(document.querySelector('#dock-coordinator')?.textContent));
 // The message box's model button opens the effort slider; reset returns to the model default and saves once.
 await dock.locator('#dock-composer [data-effort-menu]').click();const effort=dock.locator('.effort-popover');await effort.waitFor();
 assert.match(await effort.textContent(),/Low/);await effort.getByRole('button',{name:'Reset effort to default'}).click();
 await page.waitForFunction(()=>/fixture Default/.test(document.querySelector('#dock-composer [data-effort-menu]')?.textContent||''));
 assert.equal((await api('coordinator')).effort,'default');await page.keyboard.press('Escape');await effort.waitFor({state:'detached'});
 // The heading opens the agent and model list: switch to Codex, then back to Claude Code for the rest of the test.
 const pickModel=async(group,provider)=>{await dock.locator('#dock-composer [data-effort-menu]').click();await effort.waitFor();await effort.locator('[data-effort-models]').click();
  await effort.locator('section',{hasText:group}).getByRole('button',{name:'Fixture'}).waitFor();await page.screenshot({path:'output/coordinator-model-list.png'});
  await effort.locator(`.effort-model[data-provider="${provider}"]`).click();await effort.waitFor({state:'detached'});
  for(let i=0;i<80&&(await api('coordinator')).provider!==provider;i++)await page.waitForTimeout(50);assert.equal((await api('coordinator')).provider,provider);};
 await pickModel('Codex','codex');await page.waitForFunction(()=>/Codex · fixture/.test(document.querySelector('#dock-coordinator')?.textContent||''));
 await pickModel('Claude Code','claude');await page.waitForFunction(()=>/Claude Code · fixture · No session/.test(document.querySelector('#dock-coordinator')?.textContent||''));
 // Chat: the message goes into a new live session and the agent posts its reply.
 await page.locator('#dock-message').fill('hi from browser');await page.locator('#dock-send').click();
 await page.getByText('Echo: hi from browser (1 granted project)').waitFor();
 assert.match(await dock.locator('.agent-message-agent').last().textContent(),/Orchestrator/);
 await page.waitForFunction(()=>/Session running/.test(document.querySelector('#dock-coordinator')?.textContent));
 // CLI: the same session, with the tool calls, live.
 await tab('CLI').click();await page.locator('.coordinator-terminal').waitFor();
 assert.equal(await page.locator('#dock-messages').isHidden(),true);assert.equal(await page.locator('#dock-composer').isHidden(),true,'CLI is the terminal alone, with no message box.');
 assert.equal(await tab('CLI').getAttribute('aria-pressed'),'true');
 await waitScreen(/> hi from browser/);assert.match(await screen(),/workbench - list_projects \(MCP\)/);
 await page.screenshot({path:'output/coordinator-cli-live.png'});
 // Typing in the CLI reaches the session; the reply still lands in the chat.
 await page.locator('.coordinator-terminal .terminal-screen').click();await page.keyboard.type('typed in cli');await page.keyboard.press('Enter');
 await waitScreen(/> typed in cli/);
 await tab('Chat').click();await page.getByText('Echo: typed in cli (1 granted project)').waitFor();
 assert.match(await dock.locator('.agent-message-user').filter({hasText:'typed in cli'}).last().textContent(),/You · in CLI/,'Lines typed in the CLI are copied to the conversation.');assert.equal(await page.locator('#dock-composer').isVisible(),true);
 assert.equal(await page.locator('.coordinator-terminal').count(),0);
 await page.locator('#dock-message').fill('from chat again');await page.keyboard.press('Control+Enter');await page.getByText('Echo: from chat again (1 granted project)').waitFor();
 // Keyboard: the switch is reachable and reopening shows the same session without a respawn.
 await tab('CLI').focus();await page.keyboard.press('Enter');await waitScreen(/> from chat again/);
 assert.equal(sessions(),1,'Switching views never starts another CLI.');
 // Stop: the session becomes a read-only transcript in the history.
 await page.getByRole('button',{name:'Stop session',exact:true}).click();
 await page.waitForFunction(()=>/No session/.test(document.querySelector('#dock-coordinator')?.textContent));
 await page.locator('[data-coordinator-history-open]').waitFor();assert.match(await page.locator('[data-coordinator-history-open]').textContent(),/Previous sessions \(1\)/);
 // Previous sessions open in a dialog; choosing one shows its read-only transcript.
 await page.locator('[data-coordinator-history-open]').click();await page.getByRole('heading',{name:'Previous sessions'}).waitFor();await page.locator('#dialog [data-history-pick]').first().click();assert.match(await page.locator('.coordinator-terminal footer').textContent(),/Read-only transcript\. This session stopped\./);
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
 await page.goto(url+'#home');
 await page.getByText('Coordinator · Waiting for you in the coordinator CLI').waitFor();
 await page.locator('[data-home-open-cli=""]').click();await dock.waitFor();assert.equal(await tab('CLI').getAttribute('aria-pressed'),'true');
 await waitScreen(/Do you want to allow workbench - start_run\?/);await page.screenshot({path:'output/coordinator-dock-prompt.png'});
 await page.locator('.coordinator-terminal .terminal-screen').click();await page.keyboard.type('n');
 await tab('Chat').click();await dock.getByText('Tool error: declined by the user').waitFor();assert.equal((await api('workflows?projectID='+project.id)).length,0);
  // The project conversation card is the project's live agent, working in the project folder.
 await page.locator(`.project-card[data-project="${project.id}"]`).click();await page.locator('#agent-decisions').waitFor();
 await page.waitForFunction(()=>/Newton/.test(document.querySelector('#dockp-thread-title')?.textContent||''));
 assert.equal(await page.locator('#agent-mandate-card').count(),0,'Mandates are off the main path.');
 await page.locator('#dockp-message').fill('update the footer');await page.locator('#dockp-send').click();
 await page.waitForFunction(()=>/Session running/.test(document.querySelector('#dockp-coordinator')?.textContent||''));
 await page.locator('.dock-project').getByRole('button',{name:'CLI',exact:true}).click();await page.locator('.dock-project .coordinator-terminal').waitFor();
 await waitScreen(/> update the footer/);await waitScreen(/workbench - report_to_orchestrator/);
 assert.match(await page.locator('#dockp-coordinator').textContent(),/Claude Code · fixture · project folder/);
 await page.screenshot({path:'output/coordinator-project-agent.png'});
 assert.match((await api('coordinator/messages')).items.map(m=>m.text).join('\n'),/Update: Done: update the footer/);
 // Home: a row for the running project agent opens it below the coordinator, and closes it again.
 await page.evaluate(()=>location.hash='#home');const row=dock.locator('[data-dock-agent]');await row.waitFor();
 assert.match(await row.textContent(),/Newton agent.*Running.*Open/);assert.equal(await dock.locator('.dock-project').isHidden(),true);
 await row.click();await page.waitForFunction(()=>/Newton/.test(document.querySelector('#dockp-thread-title')?.textContent||''));
 assert.equal(await dock.locator('.dock-conversation').isVisible(),true,'The coordinator stays on top.');assert.equal(await dock.locator('.dock-project').isVisible(),true);
 assert.equal(await row.getAttribute('aria-pressed'),'true');assert.match(await row.textContent(),/Close/);await page.screenshot({path:'output/coordinator-dock-split.png'});
 await row.click();await page.waitForFunction(()=>document.querySelector('.dock-project')?.hidden);assert.equal(await row.getAttribute('aria-pressed'),'false');
 await page.evaluate(id=>location.hash='#project/'+id,project.id);await page.locator('#agent-decisions').waitFor();assert.equal(await dock.locator('[data-dock-agent]').count(),0,'Inside a project the panel is that agent; no rows.');
 // Dark theme and a phone-width CLI view.
 await page.locator('.dock-project').getByRole('button',{name:'CLI',exact:true}).click();await page.locator('.dock-project .coordinator-terminal').waitFor();
 await page.emulateMedia({colorScheme:'dark'});await page.waitForFunction(()=>document.documentElement.dataset.theme==='dark');await page.screenshot({path:'output/coordinator-cli-dark.png'});
 await page.setViewportSize({width:390,height:844});await page.locator('.dock-project .coordinator-terminal').scrollIntoViewIfNeeded();await page.waitForTimeout(400);
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);await page.screenshot({path:'output/coordinator-cli-mobile.png'});
 assert.deepEqual(errors,[]);
 console.log('Coordinator CLI browser passed: orchestrator setup and chat in the side panel, Chat/CLI, typing in the CLI, no respawn, stop, history, Start session, all-projects permission prompt via Home Open CLI (declined), project card as live project agent reporting to the orchestrator, Home row opens/closes it in a split, keyboard, dark and 390 px. Fixture CLI only.');
}finally{await browser.close();server.shutdownCodex();server.closeAllConnections();await new Promise(r=>server.close(r));rmSync(root,{recursive:true,force:true});}
