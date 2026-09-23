import test from 'node:test';
import assert from 'node:assert/strict';
import {controllerTools,validateCommand} from '../lib/controller-catalog.js';
test('controller catalog is explicit and rejects unknown or invalid commands',()=>{
 assert.equal(controllerTools.length,20);assert.deepEqual(controllerTools.filter(t=>/message/.test(t.name)).map(t=>[t.name,t.capability]),[["list_messages","read"],["post_message","manage"],["list_coordinator_messages","read"],["post_coordinator_message","manage"]]);assert.deepEqual(controllerTools.filter(t=>/mandate/.test(t.name)).map(t=>[t.name,t.capability]),[['get_project_mandate','read']]);
 assert.throws(()=>validateCommand('shell',{command:'rm'}),/Unknown/);
 assert.throws(()=>validateCommand('get_project',{projectID:'p',caller:'admin'}),/Invalid/);
 assert.throws(()=>validateCommand('list_projects',{limit:1000}),/Invalid/);
 assert.throws(()=>validateCommand('start_run',{projectID:'p'}),/Invalid/);
 assert.equal(validateCommand('get_project',{projectID:'p'}).tool.capability,'read');
 assert.equal(validateCommand('create_workflow',{projectID:'p',requestKey:'create-1',input:{name:'Review',steps:[]}}).tool.capability,'manage');
});
