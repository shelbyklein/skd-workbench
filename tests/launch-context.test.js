import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,writeFileSync,readFileSync,existsSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {Skills} from '../lib/skills.js';
import {Connections} from '../lib/connections.js';
import {Playbooks} from '../lib/playbooks.js';
import {CodexRuns} from '../lib/codex.js';
import {terminalArgs} from '../lib/terminals.js';
import {claudeArgs} from '../lib/claude.js';

const wait=async(fn)=>{for(let i=0;i<100;i++){const value=fn();if(value)return value;await new Promise(resolve=>setTimeout(resolve,20));}throw new Error('timed out');};
function fixture(t){const root=mkdtempSync(path.join(tmpdir(),'skd-launch-context-')),home=path.join(root,'home'),projectFolder=path.join(root,'project'),directory=path.join(root,'data');mkdirSync(path.join(home,'.codex'),{recursive:true});mkdirSync(projectFolder);mkdirSync(directory);const project={id:'project',name:'Fixture',folderPath:projectFolder};t.after(()=>rmSync(root,{recursive:true,force:true}));return {root,home,projectFolder,directory,project};}

test('sessions launch each CLI natively: no managed skills block, no managed MCP; read-only and structured runs stay MCP-free (#20)',async t=>{
 const f=fixture(t),skills=new Skills(f.directory,{home:f.home}),entry=skills.create({revision:0,scope:{kind:'global'},name:'Stored skill',description:'',instructions:'STORED SKILL BODY'},[f.project]);skills.savePolicy({revision:1,policyRevision:0,projectID:f.project.id,provider:'codex',mode:'inherit',skillIDs:[entry.id],excludedIDs:[]},[f.project]);
 const context=skills.resolve(f.project,'codex',{mode:'inherit',skillIDs:[]});assert.equal(context.status,'native');
 const base={model:'fixture',effort:'low',workingDirectory:f.projectFolder,agentContext:{skills:context,connections:{status:'native'}}};
 const codex=terminalArgs({...base,agent:'codex',mode:'worktree'}),claude=terminalArgs({...base,agent:'claude',mode:'worktree',initialPrompt:'Go'});
 assert(!JSON.stringify(codex).includes('STORED SKILL BODY'));assert(!codex.some(a=>/mcp_servers\..*enabled=false/.test(a)),'Codex keeps its own MCP servers.');
 for(const flag of ['--safe-mode','--strict-mcp-config','--restricted','--tools','--allowedTools','--permission-mode','--disable-slash-commands','--settings'])assert(!claude.includes(flag),flag+' is gone from a worktree Claude session.');
 assert.deepEqual(claude.slice(0,2),['--model','fixture']);assert.equal(claude.at(-1),'Go');
 const readOnly=terminalArgs({...base,agent:'claude',mode:'read-only'});assert(readOnly.includes('--strict-mcp-config')&&readOnly.includes('--restricted'),'Read-only Claude stays locked down and MCP-free.');
 const structured=claudeArgs({purpose:'workflow',mode:'worktree',model:'fixture',effort:'low',agentContext:{skills:{text:''},connections:{status:'excluded'}}});assert(structured.includes('--safe-mode'));assert.equal(structured[structured.indexOf('--mcp-config')+1],'{"mcpServers":{}}');
 // A stored managed MCP policy no longer changes a session; read-only Codex still disables every server.
 writeFileSync(path.join(f.home,'.codex','config.toml'),'[mcp_servers.keep]\ncommand="node"\nargs=["keep.js"]\n');
 const connections=new Connections(f.directory,{home:f.home,enumerateCodex:async()=>[{name:'keep',transport:'stdio'}]}),inventory=await connections.inventory([f.project],{kind:'project',projectID:f.project.id}),keep=inventory.connections.find(item=>item.name==='keep');
 await connections.savePolicy({revision:0,policyRevision:0,projectID:f.project.id,provider:'codex',mode:'managed',connectionIDs:[keep.id]},[f.project]);
 const session=await connections.prepareLaunch(f.project,'codex',{mode:'inherit',connectionIDs:[]},{mode:'worktree'});assert.deepEqual([session.snapshot.status,session.args],['native',[]]);
 const ro=await connections.prepareLaunch(f.project,'codex',{mode:'inherit',connectionIDs:[]},{mode:'read-only'});assert.equal(ro.snapshot.status,'excluded');assert(ro.args.includes('mcp_servers.keep.enabled=false'));
});

test('playbook preview and actual structured launch agree while later edits preserve the frozen run',async t=>{
 const f=fixture(t),skills=new Skills(f.directory,{home:f.home}),connections=new Connections(f.directory,{home:f.home,enumerateCodex:async()=>[]}),playbooks=new Playbooks(f.directory,{skills,connections}),entry=skills.create({revision:0,scope:{kind:'global'},name:'Playbook skill',description:'',instructions:'PLAYBOOK BODY'},[f.project]),playbook=await playbooks.create({revision:0,name:'Launch preset',scope:{kind:'project',projectID:f.project.id},providers:['codex'],skillIDs:[entry.id],connectionIDs:[]},[f.project]),preview=await playbooks.preview(f.project,'codex',{mode:'selected',playbookID:playbook.id},{mode:'read-only'});
 const binary=path.join(f.root,'playbook-agent');writeFileSync(binary,'#!/usr/bin/env node\nlet p="";process.stdin.on("data",c=>p+=c);process.stdin.on("end",()=>{console.log(JSON.stringify({type:"item.completed",item:{type:"agent_message",text:"done"}}));console.log(JSON.stringify({type:"turn.completed",usage:{input_tokens:1,output_tokens:1}}));});',{mode:0o755});
 const runs=new CodexRuns(f.directory,{binary,skills,connections,playbooks,discover:async()=>({version:'fixture',models:[{id:'fixture',efforts:['low']}]}),timeoutMs:2000}),started=await runs.start({task:'Run preset',agent:'codex',model:'fixture',effort:'low',mode:'read-only',playbook:{mode:'selected',playbookID:playbook.id,version:playbook.version,expectedSignature:preview.signature}},f.project),done=await wait(()=>{const value=runs.get(started.id);return value.status==='completed'?value:null;});
 assert.equal(done.agentContext.agentProfile.id,playbook.id);assert.equal(done.agentContext.agentProfile.signature,preview.signature);assert.equal(done.agentContext.skills.status,'native','Agent skill picks are no longer injected (#20).');
 await playbooks.update(playbook.id,{revision:1,version:1,name:'Launch preset changed',description:'',scope:{kind:'project',projectID:f.project.id},providers:['codex'],skillIDs:[],connectionIDs:[]},[f.project]);assert.equal(runs.get(done.id).agentContext.agentProfile.version,1);assert.equal(runs.get(done.id).agentContext.skills.status,'native');
 await assert.rejects(runs.start({task:'Stale preview',agent:'codex',model:'fixture',effort:'low',mode:'read-only',playbook:{mode:'selected',playbookID:playbook.id,version:1,expectedSignature:preview.signature}},f.project),/changed after preview/);
});
