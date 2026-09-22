import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,readFileSync,statSync,rmSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {Controllers} from '../lib/controllers.js';
test('controller grants authenticate secrets and persist revocation without leaking credentials',async t=>{
 const dir=mkdtempSync(path.join(tmpdir(),'skd-controllers-'));t.after(()=>rmSync(dir,{recursive:true,force:true}));
 const options={projects:()=>[{id:'p',folderPath:dir}]},c=new Controllers(dir,options);
 const setup=c.create({name:'Agent',projectIDs:['p'],capabilities:['read','manage']},'http://127.0.0.1:4390/api/controller/call');
 const {token}=JSON.parse(readFileSync(setup.credentialPath));assert.equal(statSync(setup.credentialPath).mode&0o777,0o600);
 assert(!JSON.stringify(c.list()).includes(token));assert(!readFileSync(c.file,'utf8').includes(token));
 assert.throws(()=>c.authenticate(),/required/);assert.throws(()=>c.authenticate('Bearer '+'a'.repeat(64)),/revoked/);
 const caller=c.authenticate('Bearer '+token);c.check(caller,'read','p');assert.throws(()=>c.check(caller,'run','p'),/capability/);assert.throws(()=>c.check(caller,'read','other'),/Project/);
 assert.throws(()=>c.check({...caller},'read','p'),/revoked/);
 assert.throws(()=>c.revoke(setup.id,0),/changed/);
 c.revoke(setup.id,1);assert.throws(()=>new Controllers(dir,options).authenticate('Bearer '+token),/revoked/);
 writeFileSync(c.file,'{}');assert.throws(()=>new Controllers(dir,options),/Damaged/);
});
