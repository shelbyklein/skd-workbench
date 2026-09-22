import test from 'node:test';import assert from 'node:assert/strict';
import {mkdtempSync,rmSync,readFileSync} from 'node:fs';import {tmpdir} from 'node:os';import path from 'node:path';
import {Controllers} from '../lib/controllers.js';import {ControllerCommands} from '../lib/controller-commands.js';import {Store} from '../lib/store.js';
test('restart recovers durable flow and run origins but never replays uncertain intent',t=>{
 const dir=mkdtempSync(path.join(tmpdir(),'skd-controller-recovery-'));t.after(()=>rmSync(dir,{recursive:true,force:true}));const store=new Store(dir),p=store.createProject({name:'Fixture',folderPath:dir}),options={projects:()=>store.snapshot().projects};
 let controllers=new Controllers(dir,options);const setup=controllers.create({name:'Agent',projectIDs:[p.id],capabilities:['read','manage','run']},'http://127.0.0.1:4390/api/controller/call');const c=controllers.authenticate('Bearer '+JSON.parse(readFileSync(setup.credentialPath)).token);
 const flowOp=controllers.operation(c,{projectID:p.id,requestKey:'flow'},'create_workflow').operation;
 const flow=store.createFlow({projectID:p.id,name:'Review',steps:[]},{controllerOrigin:{operationID:flowOp.id,controllerID:c.id}});
 const runOp=controllers.operation(c,{projectID:p.id,requestKey:'run'},'start_run').operation;
 const uncertain=controllers.operation(c,{projectID:p.id,requestKey:'uncertain'},'start_run').operation;
 controllers=new Controllers(dir,options);let starts=0;
 new ControllerCommands({controllers,store:new Store(dir),workflows:{runs:[{id:'run',controllerOrigin:{operationID:runOp.id}}],start:()=>starts++}});
 assert.equal(controllers.data.operations.find(o=>o.id===flowOp.id).flowID,flow.id);
 assert.equal(controllers.data.operations.find(o=>o.id===runOp.id).runID,'run');assert.equal(controllers.data.operations.find(o=>o.id===uncertain.id).status,'uncertain');assert.equal(starts,0);
});
