import test from 'node:test';
import assert from 'node:assert/strict';
import {sessionArgs,projectSessionArgs,promptTools} from '../lib/coordinator-sessions.js';

// Full permissions is the person's choice in the coordinator settings; off keeps every native prompt.
const server={command:'node',args:['bridge.mjs','cred.json']},base={model:'m',effort:'default',system:'S',prompt:'P',server};
test('project agents start without prompts or sandbox only with full permissions',()=>{
 const off={claude:projectSessionArgs('claude',{...base,cwd:'/p'}),codex:projectSessionArgs('codex',{...base,cwd:'/p'})};
 assert(!off.claude.includes('--dangerously-skip-permissions'));assert(!off.codex.includes('--dangerously-bypass-approvals-and-sandbox'));
 assert(projectSessionArgs('claude',{...base,cwd:'/p',full:true}).includes('--dangerously-skip-permissions'));
 assert(projectSessionArgs('codex',{...base,cwd:'/p',full:true}).includes('--dangerously-bypass-approvals-and-sandbox'));
});
test('with full permissions the orchestrator stops prompting but still has no file, shell or web tools',()=>{
 const claude=sessionArgs('claude',{...base,workspace:'/w',full:true});
 assert(claude.includes('--dangerously-skip-permissions'));assert(!claude.includes('manual'));assert.equal(claude[claude.indexOf('--tools')+1],'Skill');
 assert(sessionArgs('claude',{...base,workspace:'/w'}).includes('manual'));
 const codex=sessionArgs('codex',{...base,workspace:'/w',full:true}),prompts=promptTools.map(t=>`mcp_servers.workbench.tools.${t}.approval_mode="prompt"`);
 assert.equal(codex[codex.indexOf('--ask-for-approval')+1],'never');assert(prompts.every(p=>!codex.includes(p)));
 for(const kept of ['read-only','shell_tool','unified_exec','web_search="disabled"'])assert(codex.includes(kept),kept);
 const normal=sessionArgs('codex',{...base,workspace:'/w'});assert.equal(normal[normal.indexOf('--ask-for-approval')+1],'on-request');assert(prompts.every(p=>normal.includes(p)));
});
