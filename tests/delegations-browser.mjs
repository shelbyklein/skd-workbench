import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {createServer} from '../server.js';
const root=mkdtempSync(path.join(tmpdir(),'skd-delegation-browser-')),repo=path.join(root,'repo');
execFileSync('git',['init','-b','main',repo]);writeFileSync(path.join(repo,'README.md'),'Fixture');execFileSync('git',['-C',repo,'add','.']);execFileSync('git',['-C',repo,'-c','user.name=Test','-c','user.email=test@example.invalid','commit','-m','baseline']);
const binary=path.join(root,'agent');writeFileSync(binary,`#!/usr/bin/env node
let p='';process.stdin.on('data',c=>p+=c);process.stdin.on('end',()=>{setTimeout(()=>{
 const phase=p.match(/DELEGATION PHASE: (\\w+)/)[1],claude=process.argv.includes('--print');
 const text=phase==='implement'?'Worker finished fixture changes.':'<delegation>'+JSON.stringify({decision:phase==='plan'?'assign':'accept',note:'Fixture review',checks:phase==='review'?[0]:[]})+'</delegation>';
 if(claude){console.log(JSON.stringify({type:'result',subtype:'success',result:text}));return;}
 if(phase==='review')console.log(JSON.stringify({type:'item.completed',item:{id:'test',type:'command_execution',command:'npm test',exit_code:0,aggregated_output:'Fixture tests passed'}}));
 console.log(JSON.stringify({type:'item.completed',item:{type:'agent_message',text}}));console.log(JSON.stringify({type:'turn.completed'}));
},200);});`,{mode:0o755});
const discover=async()=>({version:'fixture',models:[{id:'fixture',name:'Fixture model',efforts:['low'],defaultEffort:'low',isDefault:true}]});
const server=createServer({directory:path.join(root,'data'),codexOptions:{binary,discover},claudeOptions:{binary,discover},terminalOptions:{binaries:{codex:binary,claude:binary},discover},githubOptions:{request:async()=>{throw Error('Fixture offline');}}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));const url=`http://127.0.0.1:${server.address().port}`;
const request=async(route,method='GET',body)=>fetch(url+'/api/'+route,{method,headers:body?{'content-type':'application/json'}:{},body:body?JSON.stringify(body):undefined});
const project=await(await request('projects','POST',{name:'Delegation fixture',folderPath:repo})).json();
const other=await(await request('projects','POST',{name:'Other project'})).json();
const base='projects/'+project.id+'/delegations',b=await chromium.launch({channel:'chrome'}),p=await b.newPage({viewport:{width:1440,height:1100},serviceWorkers:'block'});p.setDefaultTimeout(30000);const errors=[];p.on('pageerror',e=>errors.push(e.message));
try{
 await p.goto(url+'/#workflows/'+project.id);await p.getByRole('button',{name:'Delegate task',exact:true}).focus();await p.keyboard.press('Enter');await p.getByRole('button',{name:'Start delegation',exact:true}).waitFor();
 await p.getByLabel('Task reference',{exact:true}).fill('TT-fixture-01');await p.getByLabel('Task',{exact:true}).fill('Implement and review a fixture change');await p.getByLabel('Acceptance checks',{exact:true}).fill('Run npm test and inspect the change');
 await p.route('**/api/'+base,async route=>{if(route.request().method()==='POST'){await route.fetch();await route.abort();}else await route.continue();},{times:1});
 await p.getByRole('button',{name:'Start delegation',exact:true}).click();await p.waitForFunction(()=>document.querySelector('.delegation-status strong')?.textContent==='accepted');
 const id=p.url().split('/').at(-1),r=await(await request(base+'/'+id)).json();assert.equal(r.status,'accepted');assert.equal(r.taskRef,'TT-fixture-01');assert.equal(r.attempts.length,3);assert.equal((await(await request(base)).json()).length,1);assert.equal(r.attempts[1].execution.agent,'claude');
 await p.getByRole('heading',{name:'Observed command evidence'}).waitFor();assert.match(await p.locator('.delegation-detail').textContent(),/Fixture tests passed/);
 mkdirSync('output',{recursive:true});await p.waitForFunction(()=>!document.querySelector('#toast.visible'));await p.screenshot({path:'output/delegation-desktop.png',fullPage:true});await p.reload();await p.waitForFunction(()=>document.querySelector('.delegation-status strong')?.textContent==='accepted');assert.equal((await(await request(base)).json()).length,1);
 await p.setViewportSize({width:390,height:844});assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);await p.waitForFunction(()=>!document.querySelector('#toast.visible'));await p.screenshot({path:'output/delegation-mobile.png',fullPage:true});
 assert.equal((await request('projects/'+other.id+'/delegations/'+id)).status,404);assert.equal((await request(base+'/'+id+'/action','POST',{revision:0,action:'stop'})).status,409);
 const repeated=await request(base,'POST',{requestKey:r.requestKey,projectVersion:project.version,taskRef:r.taskRef,task:r.task,acceptance:r.acceptance,maxRevisions:r.maxRevisions,...r.roles});assert.equal((await repeated.json()).id,id);
 const cross=await fetch(url+'/api/'+base,{method:'POST',headers:{'content-type':'application/json',origin:'https://example.com'},body:'{}'});assert.equal(cross.status,403);
 await p.getByRole('button',{name:'New delegation and history'}).click();await p.getByRole('button',{name:'Start delegation',exact:true}).waitFor();await p.getByLabel('Task',{exact:true}).fill('Unsaved draft');await p.goto(url+'/#workflows/'+project.id);await p.getByRole('heading',{name:'Keep your changes?'}).waitFor();await p.getByRole('button',{name:'Keep editing',exact:true}).click();assert.equal(await p.getByLabel('Task',{exact:true}).inputValue(),'Unsaved draft');
 assert.deepEqual(errors,[]);console.log('Delegation browser passed: keyboard entry, mixed providers, response-loss recovery, evidence, reload, mobile, project/origin guards and unsaved draft.');
}catch(e){console.error('Delegation failure state:',JSON.stringify(await(await request(base)).json()));const runs=await(await request(base)).json();for(const r of runs){const detail=await(await request(base+'/'+r.id)).json();console.error(detail.status,detail.error);}throw e;}finally{await b.close();server.shutdownCodex();server.closeAllConnections();await new Promise(r=>server.close(r));rmSync(root,{recursive:true,force:true});}
