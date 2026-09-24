import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,writeFileSync,rmSync} from 'node:fs';
import path from 'node:path';import {tmpdir} from 'node:os';
import {Connections} from '../lib/connections.js';
import {toolsInventory} from '../lib/tools.js';

const skill=(dir,name,description)=>{mkdirSync(path.join(dir,name),{recursive:true});writeFileSync(path.join(dir,name,'SKILL.md'),`---\nname: ${name}\ndescription: ${description}\n---\nBody of ${name}`);};
function fixture(t){
 const root=mkdtempSync(path.join(tmpdir(),'skd-tools-')),home=path.join(root,'home'),folder=path.join(root,'app');t.after(()=>rmSync(root,{recursive:true,force:true}));
 skill(path.join(home,'.codex','skills'),'dev-plan','Plan work');skill(path.join(home,'.codex','skills','.system'),'openai-docs','Docs');
 skill(path.join(home,'.claude','skills'),'dev-plan','Plan work');skill(path.join(home,'.claude','skills'),'handoff','Hand off');skill(path.join(home,'.agents','skills'),'shared','Both CLIs');
 writeFileSync(path.join(home,'.codex','config.toml'),'[mcp_servers.local]\ncommand="node"\nargs=["server.js","--token=supersecret123"]\n[mcp_servers.remote]\nurl="https://example.test/mcp"\nenabled=false\n[plugins."pdf@market"]\nenabled=true\n[plugins."off@market"]\nenabled=false\n');
 skill(path.join(home,'.codex','plugins','cache','market','pdf','1.2.0','skills'),'pdf','PDF tools');skill(path.join(home,'.codex','plugins','cache','market','pdf','1.10.0','skills'),'pdf-new','Newest version');skill(path.join(home,'.codex','plugins','cache','market','off','1.0.0','skills'),'hidden','Disabled plugin');
 const install=path.join(home,'.claude','plugins','cache','m','stripe','1');skill(path.join(install,'skills'),'docs','Stripe docs');const off=path.join(home,'.claude','plugins','cache','m','bricks','1');skill(path.join(off,'skills'),'bricks','Off');
 writeFileSync(path.join(home,'.claude','plugins','installed_plugins.json'),JSON.stringify({version:2,plugins:{'stripe@m':[{scope:'user',installPath:install}],'bricks@m':[{scope:'user',installPath:off}]}}));
 writeFileSync(path.join(home,'.claude','settings.json'),JSON.stringify({enabledPlugins:{'stripe@m':true,'bricks@m':false}}));
 writeFileSync(path.join(home,'.claude.json'),JSON.stringify({mcpServers:{tracker:{command:'tt',args:['mcp'],env:{API_KEY:'hidden-value'}}}}));
 mkdirSync(folder);skill(path.join(folder,'.agents','skills'),'release','Project release');skill(path.join(folder,'.claude','skills'),'claude-only','Project Claude skill');
 const project={id:'p1',name:'App',folderPath:folder},connections=new Connections(path.join(root,'data'),{home,enumerateCodex:async()=>{throw Error('Inventory must not start the Codex CLI.');}});
 return {home,project,connections};
}

test('the Tools inventory lists each CLI\'s skills and MCP servers from its own setup, redacted, without starting anything',async t=>{
 const {home,project,connections}=fixture(t),r=await toolsInventory({connections,projects:[project],project,home}),names=p=>r[p].skills.map(s=>s.name).sort();
 assert.deepEqual(names('codex'),['dev-plan','openai-docs','pdf:pdf-new','release','shared']);
 assert.deepEqual(names('claude'),['claude-only','dev-plan','handoff','release','shared','stripe:docs']);
 assert.equal(r.codex.skills.find(s=>s.name==='openai-docs').source,'system');assert.equal(r.claude.skills.find(s=>s.name==='stripe:docs').source,'plugin');assert.equal(r.codex.skills.find(s=>s.name==='release').source,'project');
 assert.equal(r.codex.skills.find(s=>s.name==='dev-plan').both,true);assert.equal(r.claude.skills.find(s=>s.name==='handoff').both,undefined);
 assert.deepEqual(r.codex.mcp.map(m=>[m.name,m.transport,m.enabled]).sort(),[['local','stdio',true],['remote','http',false]]);
 assert.deepEqual(r.claude.mcp.map(m=>m.name),['tracker']);assert.deepEqual(r.claude.mcp[0].environmentNames,['API_KEY']);
 const serialized=JSON.stringify(r);for(const secret of ['supersecret123','hidden-value','Body of',home])assert(!serialized.includes(secret),secret);
 const global=await toolsInventory({connections,projects:[project],home});assert(!global.codex.skills.some(s=>s.source==='project'),'Without a project only user, system and plugin skills are listed.');
});
