import test from 'node:test';
import http from 'node:http';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createServer } from '../server.js';
async function fixture(t){
 const directory=mkdtempSync(path.join(tmpdir(),'flow-api-'));const server=createServer({directory});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 t.after(async()=>{server.closeAllConnections();await new Promise(r=>server.close(r));rmSync(directory,{recursive:true,force:true});});
 const url=`http://127.0.0.1:${server.address().port}`;
 return {url,request:(route,method='GET',body,headers={})=>fetch(url+route,{method,headers:{...(body?{'Content-Type':'application/json'}:{}),...headers},body:body?JSON.stringify(body):undefined})};
}
test('HTTP entry point persists flow and run actions with revision conflicts',async t=>{
 const {request}=await fixture(t);let response=await request('/api/state');assert.equal(response.status,200);
 const state=await response.json();const flow=state.flows[0];
 response=await request('/api/runs','POST',{flowID:flow.id,flowVersion:flow.version,task:'Inspect the flow'});assert.equal(response.status,201);
 const run=await response.json();assert.equal(run.mode,'simulation');
 response=await request(`/api/runs/${run.id}/action`,'POST',{revision:0,action:'advance'});assert.equal(response.status,200);assert.equal((await response.json()).status,'waiting');
 response=await request(`/api/runs/${run.id}/action`,'POST',{revision:0,action:'advance'});assert.equal(response.status,409);
 response=await request('/api/flows/'+flow.id,'PUT',{...flow,name:'Changed'});assert.equal(response.status,200);
 const after=await(await request('/api/state')).json();assert.equal(after.runs[0].flow.name,flow.name);assert.equal(after.flows[0].name,'Changed');
});
test('local server rejects cross-origin writes and does not expose store files',async t=>{
 const {request,url}=await fixture(t);
 assert.equal((await request('/api/flows','POST',{name:'Unwanted',steps:[]},{Origin:'https://example.com'})).status,403);
 const hostStatus=await new Promise((resolve,reject)=>{const req=http.get(url+'/api/state',{headers:{Host:'attacker.example:4390'}},res=>{res.resume();resolve(res.statusCode);});req.on('error',reject);});
 assert.equal(hostStatus,403);
 assert.equal((await request('/.data/store.json')).status,404);
 assert.equal((await request('/api/flows','POST',{name:' ',steps:[]})).status,400);
 const response=await request('/');assert.equal(response.status,200);assert.match(response.headers.get('content-security-policy'),/frame-ancestors 'none'/);
});
