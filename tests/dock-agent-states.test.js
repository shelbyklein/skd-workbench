import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {CoordinatorAgent} from '../lib/coordinator-agent.js';
import {COORDINATOR} from '../lib/project-threads.js';

// The side panel's pills: on (green), working (output in the last few seconds), needs you, and off for a session
// that ended in the last 12 hours. Older sessions and the orchestrator itself are not pills.
test('project agent pills report on, working, waiting and recently off',t=>{
 const dir=mkdtempSync(path.join(tmpdir(),'skd-pills-'));t.after(()=>rmSync(dir,{recursive:true,force:true}));
 const projects=['on','working','waiting','off','old','none'].map(k=>({id:k,name:k[0].toUpperCase()+k.slice(1),folderPath:'/tmp/'+k}));
 const live=new Map(),now=Date.now(),ago=ms=>new Date(now-ms).toISOString();
 const add=(id,extra)=>live.set(id,{threadKey:id,status:'running',waiting:false,provider:'claude',model:'m',...extra});
 add('on',{lastOutputAt:now-60000});add('working',{lastOutputAt:now-500});add('waiting',{waiting:true,lastOutputAt:now});add(COORDINATOR,{lastOutputAt:now});
 const sessions={live,waiting:()=>[],data:{sessions:[{threadKey:'off',endedAt:ago(3600000),endReason:'idle'},{threadKey:'old',endedAt:ago(13*3600000)},{threadKey:'on',endedAt:ago(1000)}]}};
 const agent=new CoordinatorAgent(dir,{threads:{},controllers:{internal:()=>null},projects:()=>projects,executor:{},sessions});
 assert.deepEqual(agent.view().running.map(r=>[r.name,r.state]),[['Off','off'],['On','on'],['Waiting','waiting'],['Working','working']]);
 assert.equal(agent.view().running.find(r=>r.state==='off').endReason,'idle');
});
