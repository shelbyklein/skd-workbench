import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createServer } from '../server.js';
test('PWA manifest, icon sizes and MIME types are served from explicit public routes',async t=>{
 const directory=mkdtempSync(path.join(tmpdir(),'skd-pwa-api-')),server=createServer({directory});await new Promise(r=>server.listen(0,'127.0.0.1',r));const url=`http://127.0.0.1:${server.address().port}`;
 t.after(async()=>{server.closeAllConnections();await new Promise(r=>server.close(r));rmSync(directory,{recursive:true,force:true});});
 const r=await fetch(url+'/manifest.webmanifest');assert.equal(r.headers.get('content-type'),'application/manifest+json');const m=await r.json();assert.equal(m.name,'SKD Workbench');assert.equal(m.id,'/');assert.equal(m.scope,'/');assert.equal(m.display,'standalone');
 for(const icon of m.icons){const response=await fetch(url+icon.src);assert.equal(response.status,200);assert.equal(response.headers.get('content-type'),'image/png');const b=Buffer.from(await response.arrayBuffer());const size=Number(icon.sizes.split('x')[0]);assert.equal(b.readUInt32BE(16),size);assert.equal(b.readUInt32BE(20),size);}
 const health=await(await fetch(url+'/api/health')).json();assert.equal(health.app,'skd-workbench');assert.equal(health.ok,true);
});
