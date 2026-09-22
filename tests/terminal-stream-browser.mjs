import {chromium} from 'playwright';
import * as pty from 'node-pty';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync,mkdirSync,writeFileSync} from 'node:fs';import {tmpdir} from 'node:os';import path from 'node:path';
import {createServer} from '../server.js';import {createWorkspaceTerminal} from '../lib/workspace-terminal.js';
const root=mkdtempSync(path.join(tmpdir(),'skd-stream-browser-'));let spawns=0;const input=[];
const shell=createWorkspaceTerminal(root,{spawn:(file,args,options)=>{spawns++;const child=pty.spawn(process.execPath,['-e',"process.stdin.setRawMode(true);process.stdin.on('data',d=>process.stdout.write(d));process.stdout.write('READY\\r\\n');"],options);const write=child.write.bind(child);child.write=data=>{input.push(data);write(data);};return child;}});
const server=createServer({directory:path.join(root,'data'),workspaceTerminal:shell});await new Promise(r=>server.listen(0,'127.0.0.1',r));const base=`http://127.0.0.1:${server.address().port}`;const browser=await chromium.launch({channel:'chrome'});
try{
 const page=await browser.newPage({viewport:{width:1440,height:1000},serviceWorkers:'block',reducedMotion:'reduce'}),polls=[],errors=[];
 await page.addInitScript(()=>{const Native=window.WebSocket;window.terminalSockets=[];window.WebSocket=class extends Native{constructor(...args){super(...args);window.terminalSockets.push(this);}};});
 page.on('request',r=>{if(/\/(output|input|resize)(\?|$)/.test(r.url()))polls.push(r.url());});page.on('pageerror',e=>errors.push(e.message));
 await page.goto(base);await page.getByRole('button',{name:'Open workspace terminal'}).click();await page.waitForFunction(()=>document.querySelector('.terminal-screen')?.textContent.includes('READY'));
 const latencies=[];
 for(let i=0;i<30;i++)latencies.push(await page.evaluate(i=>new Promise((resolve,reject)=>{
  const text=`:${i}:`,screen=document.querySelector('.terminal-screen'),start=performance.now();
  const observer=new MutationObserver(()=>{if(screen.textContent.includes(text)){observer.disconnect();clearTimeout(timer);resolve(performance.now()-start);}});observer.observe(screen,{subtree:true,childList:true,characterData:true});
  const timer=setTimeout(()=>{observer.disconnect();reject(Error('Echo timed out'));},3000);
  const data=new DataTransfer();data.setData('text/plain',text);screen.querySelector('textarea').dispatchEvent(new ClipboardEvent('paste',{clipboardData:data,bubbles:true,cancelable:true}));
 }),i));
 // Break the connection and ensure reconnection does not start a process or replay input.
 const sent=input.join('');await page.evaluate(()=>window.terminalSockets.at(-1).close());await page.waitForFunction(()=>document.querySelector('.terminal-status').textContent==='Disconnected');await page.waitForFunction(()=>document.querySelector('.terminal-status').textContent==='running');assert.equal(input.join(''),sent);assert.equal(spawns,1);
 // Reject a paste before sending any part of it.
 await page.evaluate(()=>{const data=new DataTransfer();data.setData('text/plain','x'.repeat(70000));document.querySelector('.terminal-screen textarea').dispatchEvent(new ClipboardEvent('paste',{clipboardData:data,bubbles:true,cancelable:true}));});await page.getByRole('alert').filter({hasText:'Paste is too large'}).waitFor();assert.equal(input.join(''),sent);
 await page.reload();await page.getByRole('button',{name:'Open workspace terminal'}).click();await page.waitForFunction(()=>document.querySelector('.terminal-status').textContent==='running');assert.equal(spawns,1);assert.equal(input.join(''),sent);
 assert.deepEqual(polls,[]);assert.deepEqual(errors,[]);
 const sorted=[...latencies].sort((a,b)=>a-b),p95=sorted[Math.ceil(sorted.length*.95)-1];mkdirSync('output',{recursive:true});writeFileSync('output/terminal-stream-latency.json',JSON.stringify({samples:latencies,median:sorted[15],p95,max:sorted.at(-1),measurement:'DOM paste input through real raw-mode PTY echo to xterm DOM mutation; fixture, not provider inference'},null,2));
 await page.screenshot({path:'output/terminal-stream-desktop.png',animations:'disabled'});await page.setViewportSize({width:390,height:844});await page.waitForTimeout(200);await page.screenshot({path:'output/terminal-stream-mobile.png',animations:'disabled'});
 await page.getByRole('button',{name:'End session'}).click();await page.waitForFunction(()=>document.querySelector('.terminal-status').textContent==='stopped');
 console.log(`Terminal streaming browser passed: 30 real-PTY input-to-display samples, median ${sorted[15].toFixed(1)} ms, p95 ${p95.toFixed(1)} ms; reconnect/reload without spawn or replay, paste bound, no HTTP polling/input.`);assert(p95<50,`Local input-to-display p95 ${p95} ms exceeds 50 ms target`);
}finally{await browser.close();server.shutdownCodex();server.closeAllConnections();await new Promise(r=>server.close(r));rmSync(root,{recursive:true,force:true});}
