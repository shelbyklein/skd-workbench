import test from 'node:test';
import assert from 'node:assert/strict';
import {terminalArgs} from '../lib/terminals.js';
import {codexArgs} from '../lib/codex.js';
import {claudeArgs} from '../lib/claude.js';

const run=(agent,connections)=>({
  agent,
  model:'fixture',
  effort:'low',
  mode:'worktree',
  workingDirectory:'/tmp/project',
  agentContext:{skills:{text:'managed instructions'},connections}
});

test('interactive provider capability matrix remains honest about isolation and event streams',()=>{
  const codex=terminalArgs(run('codex',{status:'managed'}),[
    '-c','mcp_servers.keep.command="fixture"',
    '-c','mcp_servers.drop.enabled=false'
  ]);
  assert(codex.includes('features.multi_agent=false'));
  assert(codex.some(value=>value.startsWith('developer_instructions=')));
  assert(codex.includes('mcp_servers.drop.enabled=false'));
  assert(!codex.includes('--ignore-user-config'));
  assert(!codex.includes('--json'));

  // Worktree Claude sessions run the person's normal CLI (#20): no managed or strict MCP, normal prompts.
  const claude=terminalArgs(run('claude',{status:'native'}));
  assert(claude.includes('--append-system-prompt'));
  for(const flag of ['--disable-slash-commands','--strict-mcp-config','--safe-mode','--restricted','--permission-mode','--print','--output-format'])assert(!claude.includes(flag),flag);

  const readOnly=terminalArgs({...run('claude',{status:'excluded'}),mode:'read-only'});
  assert(readOnly.includes('--safe-mode'));
  assert.equal(readOnly[readOnly.indexOf('--mcp-config')+1],'{"mcpServers":{}}');
});

test('structured providers emit exact-child JSONL while keeping MCP excluded',()=>{
  const codex=codexArgs({
    agent:'codex',model:'fixture',effort:'low',mode:'worktree',purpose:'workflow',
    workingDirectory:'/tmp/project',agentContext:{skills:{text:'managed'},connections:{status:'excluded'}}
  });
  assert(codex.includes('--json'));
  assert(codex.includes('--ignore-user-config'));
  assert(codex.includes('--ignore-rules'));

  const claude=claudeArgs({
    agent:'claude',model:'fixture',effort:'low',mode:'worktree',purpose:'workflow',
    agentContext:{skills:{text:'managed'},connections:{status:'excluded'}}
  });
  assert(claude.includes('--print'));
  assert(claude.includes('stream-json'));
  assert(claude.includes('--safe-mode'));
  assert(claude.includes('--strict-mcp-config'));
  assert.equal(claude[claude.indexOf('--mcp-config')+1],'{"mcpServers":{}}');
});
