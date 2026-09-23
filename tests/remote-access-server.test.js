import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import {once} from 'node:events';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {WebSocket} from 'ws';
import {createServer} from '../server.js';
import {attachTerminalStreams} from '../lib/terminal-stream.js';
import {createWorkspaceTerminal} from '../lib/workspace-terminal.js';
import {RemoteAccess,writeRemoteAccess,removeRemoteAccess} from '../lib/remote-access.js';
import {accessFixture,remoteConfig} from './remote-access-fixture.mjs';

const request=(port,pathname,headers={},method='GET')=>new Promise((resolve,reject)=>{
 headers=Object.fromEntries(Object.entries(headers).filter(([,v])=>v!==undefined));
 const req=http.request({host:'127.0.0.1',port,path:pathname,method,headers},res=>{let body='';res.on('data',c=>body+=c);res.on('end',()=>resolve({status:res.statusCode,body,type:res.headers['content-type']}));});
 req.on('error',reject);req.end();
});

test('remote HTTP requests need configured remote access and a valid Access token',async t=>{
 const directory=mkdtempSync(path.join(tmpdir(),'skd-remote-server-')),fixture=accessFixture();
 const server=createServer({directory,remoteAccessOptions:{fetchKeys:fixture.fetchKeys}});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const port=server.address().port;
 t.after(async()=>{server.shutdownCodex();server.closeAllConnections();await new Promise(r=>server.close(r));rmSync(directory,{recursive:true,force:true});});
 const remote=(pathname,headers={})=>request(port,pathname,{host:remoteConfig.host,'cf-access-jwt-assertion':fixture.token(),...headers});

 // Unconfigured: a valid-looking token through the public host is still refused.
 let response=await remote('/api/health');assert.equal(response.status,403);assert.match(response.body,/Local access only/);
 assert.equal((await request(port,'/api/health',{host:`127.0.0.1:${port}`,'cf-ray':'fixture'})).status,403);

 writeRemoteAccess(directory,remoteConfig);
 assert.equal((await remote('/api/health',{'cf-access-jwt-assertion':undefined})).status,403);
 assert.equal((await remote('/api/health',{'cf-access-jwt-assertion':accessFixture().token()})).status,403);
 assert.equal((await remote('/api/health',{'cf-access-jwt-assertion':fixture.token({email:'intruder@example.com'})})).status,403);
 assert.equal((await remote('/api/health',{origin:`http://${remoteConfig.host}`})).status,403);
 assert.equal((await remote('/api/state',{host:'evil.example.com'})).status,403);
 response=await remote('/api/health');assert.equal(response.status,200);assert.equal(JSON.parse(response.body).ok,true);
 response=await remote('/api/state',{origin:`https://${remoteConfig.host}`});assert.equal(response.status,200);assert.ok(Array.isArray(JSON.parse(response.body).projects));
 response=await remote('/');assert.equal(response.status,200);assert.match(response.type,/text\/html/);
 // Loopback use is unchanged and needs no token.
 assert.equal((await request(port,'/api/health',{host:`127.0.0.1:${port}`})).status,200);
 assert.equal((await request(port,'/api/health',{host:`127.0.0.1:${port}`,origin:`http://127.0.0.1:${port}`})).status,200);
 assert.equal((await request(port,'/api/health',{host:`127.0.0.1:${port}`,origin:`https://${remoteConfig.host}`})).status,403);

 // The real server hands the same gate to terminal streams: refused without a token,
 // admitted with one (then 404 for the unknown session, proving the gate let it through).
 const upgrade=async headers=>{const ws=new WebSocket(`ws://127.0.0.1:${port}/api/workspace-terminal/none/stream`,{origin:`https://${remoteConfig.host}`,headers:{Host:remoteConfig.host,...headers}});ws.on('error',()=>{});const [,res]=await once(ws,'unexpected-response');res.resume();ws.terminate();return res.statusCode;};
 assert.equal(await upgrade({}),403);assert.equal(await upgrade({'cf-access-jwt-assertion':fixture.token()}),404);
 // Disabling takes effect without a restart.
 removeRemoteAccess(directory);assert.equal((await remote('/api/health')).status,403);
});

test('remote terminal WebSockets need the Access token and the https origin',async t=>{
 const directory=mkdtempSync(path.join(tmpdir(),'skd-remote-ws-')),fixture=accessFixture();writeRemoteAccess(directory,remoteConfig);
 let spawned=0;const manager=createWorkspaceTerminal('.',{spawn:()=>{spawned++;let exit;return {onData(){},onExit:fn=>exit=fn,write(){},resize(){},kill(){exit?.();}};}});
 const session=manager.open(),server=http.createServer(),remoteAccess=new RemoteAccess(directory,{fetchKeys:fixture.fetchKeys});
 const streams=attachTerminalStreams(server,{workspace:manager,agents:manager,remoteAccess});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const port=server.address().port;
 t.after(async()=>{streams.shutdown();manager.shutdown();await new Promise(r=>server.close(r));rmSync(directory,{recursive:true,force:true});});
 const url=`ws://127.0.0.1:${port}/api/workspace-terminal/${session.id}/stream`;
 const refused=async options=>{const ws=new WebSocket(url,options);ws.on('error',()=>{});const [,res]=await once(ws,'unexpected-response');res.resume();ws.terminate();return res.statusCode;};
 const secure={origin:`https://${remoteConfig.host}`,headers:{Host:remoteConfig.host,'cf-access-jwt-assertion':fixture.token()}};
 assert.equal(await refused({...secure,headers:{Host:remoteConfig.host}}),403);
 assert.equal(await refused({...secure,headers:{...secure.headers,'cf-access-jwt-assertion':fixture.token({exp:Math.floor(Date.now()/1000)-5})}}),403);
 assert.equal(await refused({...secure,origin:`http://${remoteConfig.host}`}),403);
 assert.equal(await refused({origin:`http://127.0.0.1:${port}`,headers:{'cf-ray':'fixture'}}),403);
 for(const options of [secure,{origin:`http://127.0.0.1:${port}`}]){
  const ws=new WebSocket(url,options),[message]=await once(ws,'message');
  assert.equal(JSON.parse(message).type,'output');ws.close();await once(ws,'close');
 }
 assert.equal(spawned,1);
});
