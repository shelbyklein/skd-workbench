import test from 'node:test';
import assert from 'node:assert/strict';
import {realpathSync} from 'node:fs';
import {createWorkspaceTerminal} from '../lib/workspace-terminal.js';

test('workspace terminal opens a server-owned directory without a shell or agent',async()=>{
 const open=createWorkspaceTerminal('.', {platform:'darwin',execute:(file,args,options,done)=>{assert.equal(file,'/usr/bin/open');assert.deepEqual(args,['-a','Terminal',realpathSync('.')]);assert.equal(options.timeout,10000);assert.equal(options.shell,undefined);done(null);}});assert.deepEqual(await open(),{opened:true});
});
test('workspace terminal prevents concurrent opens and recovers after errors',async()=>{
 let callback;const open=createWorkspaceTerminal('.',{platform:'darwin',execute:(f,a,o,done)=>{callback=done;}});const pending=open();await assert.rejects(open(),/already opening/);callback(Error('private path'));await assert.rejects(pending,/Could not open Terminal/);const retry=open();callback(null);assert.deepEqual(await retry,{opened:true});
});
test('workspace terminal reports unsupported platforms without executing',async()=>{await assert.rejects(createWorkspaceTerminal('.',{platform:'linux',execute:()=>assert.fail()})(),/macOS/);});
