import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,writeFileSync,rmSync} from 'node:fs';
import path from 'node:path';import {tmpdir} from 'node:os';import {createServer} from '../server.js';
const root=mkdtempSync(path.join(tmpdir(),'skd-workflow-agents-ui-')),repo=path.join(root,'project'),home=path.join(root,'home');mkdirSync(repo);mkdirSync(path.join(home,'.codex'),{recursive:true});
writeFileSync(path.join(home,'.codex','config.toml'),'[mcp_servers.fixture]\ncommand="node"\nargs=["never-start.js"]\n');
const binary=path.join(root,'codex-fixture');writeFileSync(binary,`#!/usr/bin/env node
process.stdin.resume();process.stdin.on('end',()=>{console.log(JSON.stringify({type:'item.completed',item:{type:'agent_message',text:process.argv.find(a=>a.startsWith('developer_instructions='))||'none'}}));console.log(JSON.stringify({type:'turn.completed',usage:{input_tokens:1,output_tokens:1}}));});`,{mode:0o755});
const server=createServer({directory:path.join(root,'data'),connectionsOptions:{home},skillsOptions:{home},codexOptions:{binary,discover:async()=>({version:'fixture',models:[{id:'fixture',name:'Fixture',efforts:['low'],defaultEffort:'low',isDefault:true}]})}});await new Promise(r=>server.listen(0,'127.0.0.1',r));const url=`http://127.0.0.1:${server.address().port}`;
async function api(route,method='GET',body){const r=await fetch(url+'/api/'+route,{method,headers:{'Content-Type':'application/json'},body:body?JSON.stringify(body):undefined});assert(r.ok,await r.clone().text());return r.json();}
const project=await api('projects','POST',{name:'Workflow Agents fixture',folderPath:repo});
const inventory=await api('connections?scope=global'),profile=await api('agent-profiles','POST',{revision:0,name:'Reviewer',systemPrompt:'Review accessibility and edge cases.',scope:{kind:'global'},providers:['codex'],skillIDs:[],connectionIDs:[inventory.connections[0].id]});
const flow=await api('flows','POST',{projectID:project.id,name:'Specialized review',steps:[{id:'review',name:'Review code',type:'agent',model:'fixture',effort:'low',instructions:'Inspect the code.'},{id:'gate',name:'Accept',type:'human',instructions:'Review result',maxRetries:0,retryFrom:null}],runSettings:{task:'Review fixture only',acceptance:'Return findings',mode:'read-only',maxAttempts:2}});
const browser=await chromium.launch({channel:process.env.PLAYWRIGHT_CHANNEL||'chrome'});
try{
 const page=await browser.newPage({viewport:{width:1440,height:1000},serviceWorkers:'block'}),errors=[];page.on('pageerror',e=>errors.push(e.message));page.setDefaultTimeout(10000);
 await page.goto(url+'/#flow/'+flow.id);await page.locator('[data-step="review"]').click();const picker=page.getByLabel('Agent for this step');await picker.selectOption(profile.id);await page.getByRole('button',{name:'Save flow',exact:true}).click();
 await page.reload();await page.locator('[data-step="review"]').click();assert.equal(await picker.inputValue(),profile.id);
 await page.getByRole('button',{name:'Run settings',exact:true}).click();await page.getByRole('heading',{name:'Run settings',exact:true}).waitFor();assert.equal(await page.getByLabel('Agent for Review code',{exact:true}).inputValue(),profile.id);
 await page.getByLabel('Agent for Review code',{exact:true}).selectOption('legacy');await page.getByRole('button',{name:'Cancel',exact:true}).click();
 await page.getByRole('button',{name:'Run settings',exact:true}).click();await page.getByRole('heading',{name:'Run settings',exact:true}).waitFor();assert.equal(await page.getByLabel('Agent for Review code',{exact:true}).inputValue(),profile.id);
 mkdirSync('output',{recursive:true});await page.screenshot({path:'output/workflow-agents-settings-desktop.png',fullPage:true});
 await page.getByRole('button',{name:'Save run settings',exact:true}).click();await page.getByRole('button',{name:'Run',exact:true}).click();
 const review=page.getByRole('dialog').filter({has:page.getByRole('heading',{name:'Review workflow Agents'})});await review.waitFor();
 await review.getByText('Frozen configuration',{exact:true}).click();await review.getByText('Agent system prompt',{exact:true}).click();assert.match(await review.textContent(),/Review accessibility and edge cases/);
 assert.equal((await api('workflows')).length,0);await review.getByRole('button',{name:'Start workflow',exact:true}).click();assert.equal((await api('workflows')).length,0);
 assert((await review.getByRole('checkbox').boundingBox()).width<30);await page.screenshot({path:'output/workflow-agents-preview-desktop.png',fullPage:true});await page.setViewportSize({width:390,height:844});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);await page.screenshot({path:'output/workflow-agents-preview-mobile.png',fullPage:true});
 await review.getByRole('button',{name:'Cancel',exact:true}).click();assert.equal((await api('workflows')).length,0);await page.setViewportSize({width:1440,height:1000});
 await page.getByRole('button',{name:'Run',exact:true}).click();await review.waitFor();
 await api('agent-profiles/'+profile.id,'PUT',{...profile,scope:{kind:'global'},revision:1,version:1,systemPrompt:profile.systemPrompt+' Updated.'});
 await review.getByRole('checkbox').check();await review.getByRole('button',{name:'Start workflow',exact:true}).click();await page.getByText(/changed after preview/).waitFor();assert.equal((await api('workflows')).length,0);
 await page.getByRole('button',{name:'Run',exact:true}).click();await review.getByRole('checkbox').check();await review.getByRole('button',{name:'Start workflow',exact:true}).click();await page.getByRole('button',{name:'Continue workflow',exact:true}).waitFor();
 const runs=await api('workflows'),run=await api('workflows/'+runs[0].id);assert.equal(run.agentContexts.review.agentProfile.id,profile.id);assert.equal(run.attempts[0].execution.agentContext.agentProfile.systemPrompt,profile.systemPrompt+' Updated.');assert.match(run.attempts[0].execution.output,/Review accessibility and edge cases/);assert.equal(run.attempts[0].execution.agentContext.connections.status,'excluded');
 await page.locator('[data-live-step="review"]').click();await page.getByText('Frozen configuration',{exact:true}).click();assert.match(await page.locator('.attempt').textContent(),/Reviewer · v2/);await page.screenshot({path:'output/workflow-agents-frozen-desktop.png',fullPage:true});
 await page.getByRole('button',{name:'Continue workflow',exact:true}).click();await page.waitForFunction(()=>document.querySelector('.workflow-summary strong')?.textContent==='Flow finished');assert.deepEqual(errors,[]);
 console.log('Workflow Agent UI passed: inspector/settings persistence, cancelled edits, zero execution on preview/cancel, required MCP acknowledgement, frozen native instructions, desktop/mobile.');
}finally{await browser.close();server.closeAllConnections();await new Promise(r=>server.close(r));rmSync(root,{recursive:true,force:true});}
