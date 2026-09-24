import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {mkdtempSync,readFileSync,rmSync} from 'node:fs';
import path from 'node:path';import {tmpdir} from 'node:os';
import {createServer} from '../server.js';
// Message box attachments: the paperclip and a pasted screenshot upload files, chips show them,
// and the sent message carries their saved paths. The coordinator stays off, so nothing starts.
const root=mkdtempSync(path.join(tmpdir(),'skd-composer-attachments-'));
const server=createServer({directory:path.join(root,'data')});
await new Promise(r=>server.listen(0,'127.0.0.1',r));const url=`http://127.0.0.1:${server.address().port}`;
const browser=await chromium.launch({channel:process.env.PLAYWRIGHT_CHANNEL||'chrome'});
try{
 // The upload endpoint takes raw bytes and keeps only a safe base name.
 const direct=await fetch(url+'/api/attachments',{method:'POST',headers:{'Content-Type':'application/octet-stream','X-File-Name':encodeURIComponent('../../evil name?.txt')},body:'hello'});
 assert.equal(direct.status,201);const saved=await direct.json();
 assert.equal(saved.name,'evil name_.txt');assert.ok(saved.path.startsWith(path.join(root,'data','attachments')));assert.equal(readFileSync(saved.path,'utf8'),'hello');
 assert.equal((await fetch(url+'/api/attachments',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'})).status,415);
 const page=await browser.newPage({viewport:{width:1440,height:1000}});page.setDefaultTimeout(15000);const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(url);const box=page.locator('#dock-message');await box.waitFor();
 await page.locator('#dock-attach-input').setInputFiles({name:'notes.txt',mimeType:'text/plain',buffer:Buffer.from('file body')});
 await page.locator('#dock-attachments .agent-attachment',{hasText:'notes.txt'}).waitFor();
 // Pasting an image attaches it without typing anything into the box.
 await box.focus();
 await page.evaluate(()=>{const data=new DataTransfer();data.items.add(new File([new Uint8Array([137,80,78,71])],'image.png',{type:'image/png'}));document.querySelector('#dock-message').dispatchEvent(new ClipboardEvent('paste',{clipboardData:data,bubbles:true,cancelable:true}));});
 await page.locator('#dock-attachments .agent-attachment',{hasText:/^pasted-.*\.png/}).waitFor();
 assert.equal(await box.inputValue(),'');
 await page.locator('#dock-attachments [data-remove-attachment="0"]').click();
 assert.equal(await page.locator('#dock-attachments .agent-attachment').count(),1);
 await box.fill('Look at this');await page.locator('#dock-send').click();
 await page.waitForFunction(()=>!document.querySelector('#dock-attachments .agent-attachment'));
 const messages=await (await fetch(url+'/api/coordinator/messages')).json(),text=(messages.messages||messages.items||[]).at(-1)?.text||'';
 assert.match(text,/^Look at this\n\nAttached file:\n.*attachments\/.*\/pasted-.*\.png$/);
 await page.screenshot({path:'output/composer-attachments.png'}).catch(()=>{});
 assert.deepEqual(errors,[]);
 console.log('composer attachments browser ok');
}finally{await browser.close();server.shutdownCodex();server.closeAllConnections();await new Promise(r=>server.close(r));rmSync(root,{recursive:true,force:true});}
