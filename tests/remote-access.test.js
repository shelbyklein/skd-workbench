import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync,writeFileSync,statSync,existsSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {RemoteAccess,writeRemoteAccess,removeRemoteAccess,validateRemoteAccess,REMOTE_ACCESS_FILE} from '../lib/remote-access.js';
import {accessFixture,remoteConfig} from './remote-access-fixture.mjs';

const temp=t=>{const dir=mkdtempSync(path.join(tmpdir(),'skd-remote-'));t.after(()=>rmSync(dir,{recursive:true,force:true}));return dir;};
const rejects=(promise,pattern)=>assert.rejects(promise,e=>e.status===403&&pattern.test(e.message));

test('remote access stays disabled without settings and validates settings strictly',t=>{
 const dir=temp(t),access=new RemoteAccess(dir);
 assert.equal(access.current(),null);
 assert.throws(()=>validateRemoteAccess({...remoteConfig,host:'Workbench.Example.com'}),/lowercase domain/);
 assert.throws(()=>validateRemoteAccess({...remoteConfig,teamDomain:'evil.example.com'}),/cloudflareaccess/);
 assert.throws(()=>validateRemoteAccess({...remoteConfig,audience:'short'}),/AUD/);
 assert.throws(()=>validateRemoteAccess({...remoteConfig,allowedEmails:[]}),/emails/);
 assert.throws(()=>validateRemoteAccess({...remoteConfig,extra:true}),/Invalid remote/);
 writeRemoteAccess(dir,remoteConfig);
 assert.equal(statSync(path.join(dir,REMOTE_ACCESS_FILE)).mode&0o777,0o600);
 assert.deepEqual(access.current(),remoteConfig);
 removeRemoteAccess(dir);assert.equal(existsSync(path.join(dir,REMOTE_ACCESS_FILE)),false);assert.equal(access.current(),null);
});

test('corrupt remote access settings fail visibly instead of disabling checks',t=>{
 const dir=temp(t),access=new RemoteAccess(dir);t.mock.method(console,'error',()=>{});
 writeFileSync(path.join(dir,REMOTE_ACCESS_FILE),'{not json');
 assert.throws(()=>access.current(),e=>e.status===503&&/invalid/.test(e.message));
});

test('Cloudflare Access tokens are verified for signature, audience, issuer, time and email',async t=>{
 const dir=temp(t),fixture=accessFixture();writeRemoteAccess(dir,remoteConfig);
 const access=new RemoteAccess(dir,{fetchKeys:fixture.fetchKeys}),now=Math.floor(Date.now()/1000);
 assert.deepEqual(await access.verify(fixture.token()),{email:'owner@example.com'});
 assert.deepEqual(await access.verify(fixture.token({email:'Owner@Example.com',aud:remoteConfig.audience})),{email:'owner@example.com'});
 await rejects(access.verify(undefined),/requires Cloudflare Access/);
 await rejects(access.verify('a.b'),/Invalid/);
 await rejects(access.verify(fixture.token({exp:now-1})),/expired/);
 await rejects(access.verify(fixture.token({nbf:now+3600})),/not valid yet/);
 await rejects(access.verify(fixture.token({aud:['b'.repeat(64)]})),/another application/);
 await rejects(access.verify(fixture.token({iss:'https://other.cloudflareaccess.com'})),/issuer/);
 await rejects(access.verify(fixture.token({email:'intruder@example.com'})),/not allowed/);
 await rejects(access.verify(fixture.token({},{alg:'HS256'})),/Invalid/);
 await rejects(access.verify(fixture.token({},{alg:'none'})),/Invalid/);
 const [h,p,s]=fixture.token().split('.'),forged=Buffer.from(JSON.stringify({...JSON.parse(Buffer.from(p,'base64url')),email:'intruder@example.com'})).toString('base64url');
 await rejects(access.verify(`${h}.${forged}.${s}`),/Invalid/);
 await rejects(access.verify(accessFixture().token()),/Invalid/);// same kid, other key
 assert.equal(fixture.fetches.length,1);
});

test('unknown key IDs refetch at most once per interval and fetch failures return 503',async t=>{
 const dir=temp(t),fixture=accessFixture(),other=accessFixture({kid:'rotated'});writeRemoteAccess(dir,remoteConfig);t.mock.method(console,'error',()=>{});
 const long=f=>f.token({exp:Math.floor(Date.now()/1000)+86400});let clock=Date.now(),keys=fixture.jwks,fail=false,calls=0;
 const access=new RemoteAccess(dir,{now:()=>clock,fetchKeys:async team=>{calls++;assert.equal(team,remoteConfig.teamDomain);if(fail)throw Error('offline');return keys;}});
 await access.verify(long(fixture));assert.equal(calls,1);
 await rejects(access.verify(long(other)),/Invalid/);await rejects(access.verify(long(other)),/Invalid/);assert.equal(calls,1);
 clock+=61000;keys={keys:[...fixture.jwks.keys,...other.jwks.keys]};
 await access.verify(long(other));assert.equal(calls,2);
 clock+=3600001;fail=true;
 await assert.rejects(access.verify(long(fixture)),e=>e.status===503);
 await access.verify(long(fixture));// stale keys are still used within the refetch interval
 assert.equal(calls,3);
});

test('admit requires the configured host, https origin and a valid token',async t=>{
 const dir=temp(t),fixture=accessFixture(),access=new RemoteAccess(dir,{fetchKeys:fixture.fetchKeys});
 const req=(headers)=>({headers:{host:remoteConfig.host,'cf-access-jwt-assertion':fixture.token(),...headers}});
 assert.equal(access.isRemote({headers:{host:'127.0.0.1:4390'}}),false);
 assert.equal(access.isRemote({headers:{host:'127.0.0.1:4390','cf-ray':'x'}}),true);
 assert.equal(access.isRemote(req()),true);
 await rejects(access.admit(req()),/Local access only/);
 writeRemoteAccess(dir,remoteConfig);
 assert.deepEqual(await access.admit(req()),{email:'owner@example.com'});
 assert.deepEqual(await access.admit(req({origin:`https://${remoteConfig.host}`})),{email:'owner@example.com'});
 await rejects(access.admit(req({host:'other.example.com'})),/Local access only/);
 await rejects(access.admit(req({origin:`http://${remoteConfig.host}`})),/Cross-origin/);
 await rejects(access.admit(req(),{upgrade:true}),/Remote origin required/);
 assert.deepEqual(await access.admit(req({origin:`https://${remoteConfig.host}`}),{upgrade:true}),{email:'owner@example.com'});
 await rejects(access.admit(req({'cf-access-jwt-assertion':undefined})),/requires Cloudflare Access/);
});
