import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,rmSync,writeFileSync,readFileSync,existsSync} from 'node:fs';
import path from 'node:path';import {tmpdir} from 'node:os';
import {createServer} from '../server.js';
// Tools page (#20): both CLIs' skills and MCP servers from a fixture home, Install MCP server through review,
// old Skills/Connections routes, the project sidebar entry and Agents without resource pickers. Fixture CLIs only.
const root=mkdtempSync(path.join(tmpdir(),'skd-tools-browser-')),home=path.join(root,'home'),folder=path.join(root,'app'),log=path.join(root,'calls.jsonl');
const skill=(dir,name,description)=>{mkdirSync(path.join(dir,name),{recursive:true});writeFileSync(path.join(dir,name,'SKILL.md'),`---\nname: ${name}\ndescription: ${description}\n---\nBody`);};
skill(path.join(home,'.codex','skills'),'dev-plan','Turn a request into a tracked plan');skill(path.join(home,'.claude','skills'),'dev-plan','Turn a request into a tracked plan');skill(path.join(home,'.claude','skills'),'handoff','Write handoff notes');
mkdirSync(path.join(home,'.codex'),{recursive:true});writeFileSync(path.join(home,'.codex','config.toml'),'[mcp_servers.node_repl]\ncommand="node"\nargs=["repl.js"]\n[mcp_servers.vispix]\nurl="https://vispix.test/mcp"\nenabled=false\n');
writeFileSync(path.join(home,'.claude.json'),JSON.stringify({mcpServers:{'tracker-trapper':{command:'tt',args:['mcp'],env:{TT_TOKEN:'tt-secret-value-9'}}},claudeAiMcpEverConnected:['claude.ai Mobbin']}));
mkdirSync(folder);skill(path.join(folder,'.agents','skills'),'release','Cut a release for this app');
const cli=name=>{const file=path.join(root,name);writeFileSync(file,`#!/usr/bin/env node\nrequire('node:fs').appendFileSync(${JSON.stringify(log)},JSON.stringify({cli:${JSON.stringify(name)},args:process.argv.slice(2)})+'\\n');console.log('Added');`,{mode:0o755});return file;};
const server=createServer({directory:path.join(root,'data'),connectionsOptions:{home,enumerateCodex:async()=>[]},toolsOptions:{home,codexBinary:cli('codex'),claudeBinary:cli('claude')}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));const url=`http://127.0.0.1:${server.address().port}`;
const api=async(route,input)=>(await fetch(url+'/api/'+route,{method:input?'POST':'GET',headers:{'Content-Type':'application/json'},...(input?{body:JSON.stringify(input)}:{})})).json();
const browser=await chromium.launch({channel:process.env.PLAYWRIGHT_CHANNEL||'chrome'});
try{
 const project=await api('projects',{name:'App',folderPath:folder});
 const page=await browser.newPage({viewport:{width:1280,height:900}});page.setDefaultTimeout(15000);const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(url);await page.locator('.home-secondary>summary').click();await page.locator('[data-global-tools]').click();await page.getByRole('heading',{name:'Tools',exact:true}).waitFor();
 const codex=page.locator('.tools-column').filter({has:page.getByRole('heading',{name:'Codex',exact:true})}),claude=page.locator('.tools-column').filter({has:page.getByRole('heading',{name:'Claude Code',exact:true})});
 await codex.getByText('node_repl').waitFor();assert.match(await codex.textContent(),/vispix.*http · off/s);assert.match(await claude.textContent(),/tracker-trapper/);assert.match(await claude.textContent(),/handoff/);assert.match(await claude.locator('li',{hasText:'Mobbin'}).textContent(),/claude\.ai connector/);
 assert.match(await codex.locator('li',{hasText:'dev-plan'}).textContent(),/both/);assert(!(await page.locator('#tools-view').textContent()).includes('tt-secret-value-9'),'Secret values never shown.');
 assert.equal(await page.getByText('release',{exact:true}).count(),0,'No project skills until a project is chosen.');
 await page.locator('#tools-project').selectOption(project.id);await codex.getByText('release',{exact:true}).waitFor();assert.equal(new URL(page.url()).hash,'#tools/'+project.id);
 await page.locator('#tools-search').fill('handoff');assert.equal(await codex.locator('.tools-list li:not(.widget-empty)').count(),0);assert.equal(await claude.getByText('handoff',{exact:true}).count(),1);await page.locator('#tools-search').fill('');
 await page.screenshot({path:'output/tools-page.png'});
 // Install: review shows the exact commands, nothing runs until Install.
 await page.getByRole('button',{name:'Install MCP server…'}).click();const dialog=page.locator('#dialog');await dialog.getByRole('heading',{name:'Install MCP server'}).waitFor();
 await dialog.locator('[name=name]').fill('figma');await dialog.locator('[name=command]').fill('npx');await dialog.locator('[name=args]').fill('-y figma-mcp');await dialog.locator('[name=env]').fill('FIGMA_TOKEN=secret-token-1');
 await dialog.getByRole('button',{name:'Review commands'}).click();await dialog.getByText('These commands will run').waitFor();
 assert.match(await dialog.textContent(),/codex mcp add figma --env FIGMA_TOKEN=••• -- npx -y figma-mcp/);assert.match(await dialog.textContent(),/claude mcp add -s user figma -e FIGMA_TOKEN=••• -- npx -y figma-mcp/);
 assert(!(await dialog.textContent()).includes('secret-token-1'));assert.equal(existsSync(log),false,'Review runs nothing.');
 await page.screenshot({path:'output/tools-install-review.png'});
 await dialog.getByRole('button',{name:'Install',exact:true}).click();await page.getByText('figma installed in Codex and Claude Code.').waitFor();
 assert.deepEqual(readFileSync(log,'utf8').trim().split('\n').map(l=>JSON.parse(l).args[2]==='figma'||JSON.parse(l).args[4]==='figma'),[true,true]);
 // Old routes land on Tools; the project sidebar has Tools and no Skills/Connections.
 for(const route of ['#skills','#connections/'+project.id]){await page.goto(url+'/'+route);await page.getByRole('heading',{name:'Tools',exact:true}).waitFor();}
 await page.goto(url+'/#project/'+project.id);const nav=page.getByRole('navigation',{name:'Project views'});await nav.getByText('Tools',{exact:true}).waitFor();
 assert.equal(await nav.getByText('Skills',{exact:true}).count(),0);assert.equal(await nav.getByText('Connections',{exact:true}).count(),0);
 await nav.getByText('Tools',{exact:true}).click();await codex.getByText('release',{exact:true}).waitFor();
 // Agents: no skill or MCP pickers.
 await page.goto(url+'/#agents');await page.getByRole('button',{name:/New Agent|Create Agent/}).first().click();await page.locator('[data-editor]').waitFor();
 assert.equal(await page.locator('[data-editor]').getByText('Managed skills').count(),0);assert.equal(await page.locator('[data-editor]').getByText('MCP connections').count(),0);assert.match(await page.locator('[data-editor]').textContent(),/each CLI's own skills and MCP servers/);
 // Dark and 390 px.
 await page.emulateMedia({colorScheme:'dark'});await page.goto(url+'/#tools');await codex.getByText('node_repl').waitFor();await page.screenshot({path:'output/tools-page-dark.png'});
 await page.setViewportSize({width:390,height:844});await page.waitForTimeout(300);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);await page.screenshot({path:'output/tools-page-390.png'});
 assert.deepEqual(errors,[]);
 console.log('Tools browser passed: Home card, both columns with MCP and skills, both marker, project skills and route, search, Install MCP review (masked, nothing run) then install into both fixture CLIs, old routes redirect, project sidebar Tools, Agents without pickers, dark and 390 px.');
}finally{await browser.close();server.closeAllConnections();await new Promise(r=>server.close(r));rmSync(root,{recursive:true,force:true});}
