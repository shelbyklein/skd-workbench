import test from 'node:test';import assert from 'node:assert/strict';
import {mkdtempSync,writeFileSync,rmSync,readFileSync} from 'node:fs';import {tmpdir} from 'node:os';import path from 'node:path';import http from 'node:http';
import {serverStatus} from '../scripts/launcher-service.mjs';import {launcherStatus,saveLauncher} from '../lib/launcher.js';
test('launcher distinguishes healthy Workbench from occupied and stopped ports',async()=>{
 const server=http.createServer((req,res)=>{res.setHeader('Content-Type','application/json');res.setHeader('Connection','close');res.end(JSON.stringify(req.url==='/health'?{app:'skd-workbench',ok:true}:{app:'other'}));});await new Promise(r=>server.listen(0,'127.0.0.1',r));const url='http://127.0.0.1:'+server.address().port;
 try{assert.equal(await serverStatus(url+'/health'),'running');assert.equal(await serverStatus(url+'/other'),'occupied');}finally{await new Promise(r=>server.close(r));}
 assert.equal(await serverStatus(url+'/health'),'stopped');
});
test('login preference changes only RunAtLoad without starting or replacing a service',{skip:process.platform!=='darwin'},()=>{
 const root=mkdtempSync(path.join(tmpdir(),'skd-launcher-')),file=path.join(root,'test.plist');
 try{assert.equal(launcherStatus(file).installed,false);writeFileSync(file,'<?xml version="1.0"?><plist version="1.0"><dict><key>Label</key><string>com.shelbyklein.skd-workbench</string><key>ProgramArguments</key><array><string>/node</string><string>/fixture/scripts/serve-local.mjs</string></array><key>RunAtLoad</key><false/></dict></plist>');assert.deepEqual(launcherStatus(file),{installed:true,startAtLogin:false});assert.equal(saveLauncher({startAtLogin:true},file).startAtLogin,true);assert.equal(saveLauncher({startAtLogin:false},file).startAtLogin,false);assert.match(readFileSync(file,'utf8'),/fixture\/scripts\/serve-local.mjs/);assert.throws(()=>saveLauncher({startAtLogin:true,command:'evil'},file),/Choose/);}finally{rmSync(root,{recursive:true,force:true});}
});
import {waitUntilRunning,workbenchWindow} from '../scripts/launcher-service.mjs';
test('the Launcher waits for the server, then opens the web app or the browser',async()=>{
 const states=['stopped','stopped','running'];let calls=0;
 assert.equal(await waitUntilRunning({status:async()=>states[Math.min(calls++,2)],intervalMs:5}),true);assert.equal(calls,3);
 await assert.rejects(waitUntilRunning({status:async()=>'stopped',timeoutMs:30,intervalMs:5}),/did not start within 15 seconds/);
 assert.deepEqual(workbenchWindow({home:'/Users/x',exists:()=>true}),['-a','/Users/x/Applications/SKD Workbench.app']);
 assert.deepEqual(workbenchWindow({home:'/Users/x',exists:()=>false}),['http://127.0.0.1:4390']);
});
