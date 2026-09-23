import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

// Runs public/sw.js with stub browser globals to check how navigations reach Cloudflare Access.
const source=readFileSync(new URL('../public/sw.js',import.meta.url),'utf8');
function worker(hostname,network){
 const handlers={},fetches=[],shell={type:'basic',status:200,body:'cached shell'};
 const context={
  self:{location:{hostname,origin:`https://${hostname}`},addEventListener:(type,fn)=>handlers[type]=fn,clients:{claim(){}},skipWaiting(){}},
  caches:{open:async()=>({match:async pathname=>pathname==='/'?shell:undefined,addAll:async()=>{}}),keys:async()=>[],delete:async()=>{}},
  fetch:async(request,init)=>{fetches.push({request,init});return network(request,init);},
  Request:class{constructor(url,init){Object.assign(this,{url,...init});}},
  Response:class{constructor(body,init){Object.assign(this,{body,...init});}static error(){return {type:'error'};}},
  URL,JSON
 };
 vm.runInNewContext(source,context);
 const navigate=async()=>{let responded;handlers.fetch({request:{url:`https://${hostname}/`,method:'GET',mode:'navigate'},respondWith:p=>responded=p});return {response:await responded,fetches};};
 return {navigate,shell};
}

test('remote navigations pass an Access redirect through and otherwise keep the cached shell',async()=>{
 const redirect={type:'opaqueredirect'};
 let w=worker('workbench.example.com',async(request,init)=>{assert.equal(init.redirect,'manual');return redirect;});
 assert.equal((await w.navigate()).response,redirect);
 w=worker('workbench.example.com',async()=>({type:'basic',status:200,body:'newer shell'}));
 assert.equal((await w.navigate()).response,w.shell);
 w=worker('workbench.example.com',async()=>{throw TypeError('offline');});
 assert.equal((await w.navigate()).response,w.shell);
});

test('local navigations stay cache-first without a network request',async()=>{
 const w=worker('127.0.0.1',async()=>{throw Error('unexpected network');}),{response,fetches}=await w.navigate();
 assert.equal(response,w.shell);assert.equal(fetches.length,0);
});
