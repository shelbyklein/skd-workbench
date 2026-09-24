import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,writeFileSync,rmSync,realpathSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {CoordinatorSessions} from '../lib/coordinator-sessions.js';
import {SessionHost} from '../lib/session-host.js';

// The session host owns agent CLI terminals so they outlive a Workbench restart; a new Workbench picks them up.
const alive=pid=>{try{process.kill(pid,0);return true;}catch{return false;}};
const until=async(check,label,ms=8000)=>{const end=Date.now()+ms;while(Date.now()<end){if(await check())return;await new Promise(r=>setTimeout(r,25));}throw new Error('Timed out: '+label);};
function fixture(t){
 const dir=realpathSync(mkdtempSync(path.join(tmpdir(),'skd-host-'))),cli=path.join(dir,'cli');
 writeFileSync(cli,`#!/usr/bin/env node
process.stdout.write('READY\\n');process.stdin.setEncoding('utf8');
process.stdin.on('data',d=>{for(const line of d.split(/\\r|\\n/).filter(Boolean)){if(line==='quit')process.exit(0);process.stdout.write('got:'+line+'\\n');}});`,{mode:0o755});
 const opened=[];
 const make=()=>{const s=new CoordinatorSessions(dir,{sessionHost:true,idleMs:600000,killDelay:200});opened.push(s);return s;};
 t.after(async()=>{for(const s of opened)s.shutdown();const host=new SessionHost(dir,{startHost:false});try{const {pid}=await host.request('hello');process.kill(pid,'SIGTERM');}catch{}host.close();rmSync(dir,{recursive:true,force:true});});
 const start=s=>s.start('thread-1',{provider:'claude',model:'m',effort:'default',binary:cli,credentialPath:path.join(dir,'cred.json'),system:'s',prompt:'p'});
 return {dir,make,start};
}
const text=(s,id)=>s.output(id,0).data;

test('agent CLIs keep running while Workbench restarts and are picked up again',async t=>{
 const f=fixture(t),first=f.make();await first.restoring;
 const session=f.start(first);await until(()=>text(first,session.id).includes('READY'),'CLI started');
 first.input(session.id,'hello\r');await until(()=>text(first,session.id).includes('got:hello'),'input reached the CLI');
 const pid=[...first.live.values()][0].child.pid;assert.ok(pid&&alive(pid));
 // Workbench stops: the CLI does not.
 first.shutdown();await new Promise(r=>setTimeout(r,300));assert.ok(alive(pid),'The CLI survives the Workbench stop.');
 const second=f.make();await second.restoring;
 const again=second.current('thread-1');assert.equal(again.id,session.id);assert.equal(again.status,'running');
 assert.match(text(second,session.id),/got:hello/,'Earlier output is still there.');
 second.input(session.id,'after restart\r');await until(()=>text(second,session.id).includes('got:after restart'),'input after the restart');
 // Stop still ends it, and it is recorded once.
 second.stop(session.id);await until(()=>!second.current('thread-1'),'session ended');assert.equal(alive(pid),false);
 assert.equal(second.history('thread-1').filter(s=>s.id===session.id).length,1);
});

test('a CLI that exits while Workbench is down is recorded on the next start',async t=>{
 const f=fixture(t),first=f.make();await first.restoring;
 const session=f.start(first);await until(()=>text(first,session.id).includes('READY'),'CLI started');
 first.shutdown();
 // Type quit through a bare client while no Workbench is attached.
 const client=new SessionHost(f.dir,{startHost:false});await client.connect();client.send('write',{id:session.id,data:'quit\r'},{reply:false});
 await until(async()=>(await client.list()).find(v=>v.id===session.id)?.exited,'CLI exited in the host');client.close();
 const second=f.make();await second.restoring;
 assert.equal(second.current('thread-1'),null);
 const [ended]=second.history('thread-1');assert.equal(ended.id,session.id);assert.equal(ended.endReason,'exited');
 const check=new SessionHost(f.dir,{startHost:false});await until(async()=>!(await check.list()).some(v=>v.id===session.id),'host let it go');check.close();
});
