import test from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {mkdtempSync,rmSync,readFileSync,statSync,existsSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {remoteConfig} from './remote-access-fixture.mjs';

const script=new URL('../scripts/remote-access.mjs',import.meta.url).pathname;
const run=(directory,...args)=>{try{return {code:0,out:execFileSync(process.execPath,[script,...args],{env:{...process.env,FLOW_BENCH_DATA:directory},encoding:'utf8',stdio:['ignore','pipe','pipe']})};}catch(e){return {code:e.status,out:e.stderr};}};

test('remote-access script enables, reports and disables the opt-in settings',t=>{
 const directory=mkdtempSync(path.join(tmpdir(),'skd-remote-script-'));t.after(()=>rmSync(directory,{recursive:true,force:true}));
 const file=path.join(directory,'remote-access.json');
 assert.match(run(directory,'--status').out,/disabled/);
 let result=run(directory,'--host',remoteConfig.host,'--team',remoteConfig.teamDomain,'--aud','bad','--email','owner@example.com');
 assert.equal(result.code,1);assert.match(result.out,/AUD/);assert.equal(existsSync(file),false);
 assert.equal(run(directory,'--host',remoteConfig.host).code,1);
 result=run(directory,'--host',remoteConfig.host,'--team',remoteConfig.teamDomain,'--aud',remoteConfig.audience,'--email','Owner@Example.com');
 assert.equal(result.code,0);assert.match(result.out,/enabled for https:\/\/workbench\.example\.com/);
 assert.deepEqual(JSON.parse(readFileSync(file,'utf8')),remoteConfig);assert.equal(statSync(file).mode&0o777,0o600);
 assert.match(run(directory,'--status').out,/enabled for https:\/\/workbench\.example\.com.*owner@example\.com/);
 assert.match(run(directory,'--disable').out,/disabled/);assert.equal(existsSync(file),false);
});
