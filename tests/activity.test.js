import test from 'node:test';
import assert from 'node:assert/strict';
import {activityLimit,createToolActivity,finalizeToolActivity,finishToolCall,markActivityGap,startToolCall,unknownToolActivity} from '../lib/activity.js';
import {consumeClaude} from '../lib/claude.js';
import {activitySummary} from '../public/codex-ui.js';

test('correlated activity deduplicates replayed events and aggregates out-of-order completions',()=>{
 const activity=createToolActivity('codex'),connections=[{id:'connection-1',name:'fixture'}];
 startToolCall(activity,{callID:'a',toolName:'mcp__fixture__read',toolType:'mcp_tool_call',server:'fixture',at:'2026-01-01T00:00:00.000Z',connections});
 startToolCall(activity,{callID:'b',toolName:'shell',toolType:'command_execution',at:'2026-01-01T00:00:01.000Z'});
 startToolCall(activity,{callID:'a',toolName:'mcp__fixture__read',connections});
 finishToolCall(activity,{callID:'b',outcome:'error',at:'2026-01-01T00:00:02.000Z',error:'failed\nsecret details'});
 finishToolCall(activity,{callID:'a',outcome:'success',at:'2026-01-01T00:00:03.000Z'});
 assert.equal(activity.events.length,2);assert.equal(activity.events[0].connectionID,'connection-1');assert.equal(activity.aggregates.tools.find(item=>item.name==='shell').outcomes.error,1);assert.equal(activity.aggregates.connections[0].count,1);
});

test('disconnect and interruption close unfinished calls without inferred success',()=>{
 const activity=createToolActivity('codex');startToolCall(activity,{callID:'open',toolName:'shell'});finalizeToolActivity(activity,'unknown','2026-01-01T00:00:00.000Z');assert.equal(activity.events[0].outcome,'unknown');assert(activity.events[0].finishedAt);
 const cancelled=createToolActivity('claude');startToolCall(cancelled,{callID:'cancel',toolName:'Write'});finalizeToolActivity(cancelled,'cancelled');assert.equal(cancelled.events[0].outcome,'cancelled');
 assert.equal(unknownToolActivity().coverage.status,'unknown');
});

test('retention and collection gaps cannot masquerade as complete capture',()=>{
 const activity=createToolActivity('codex');for(let index=0;index<activityLimit+3;index++){startToolCall(activity,{callID:String(index),toolName:'shell'});finishToolCall(activity,{callID:String(index),outcome:'success'});}assert.equal(activity.events.length,activityLimit);assert.equal(activity.coverage.status,'partial');assert.equal(activity.coverage.truncated,true);
 markActivityGap(activity,'Malformed provider event');assert.match(activity.coverage.reason,/Malformed/);
});

test('run details distinguish legacy unknown coverage from complete zero use',()=>{
 const legacy=activitySummary({}),complete=activitySummary({toolActivity:createToolActivity('codex')});
 assert.match(legacy,/Observed tool activity · unknown/);assert.match(legacy,/predates structured activity capture/);assert.match(legacy,/Missing telemetry does not establish/);assert.doesNotMatch(legacy,/No tool calls were observed/);
 assert.match(complete,/Observed tool activity · complete/);assert.match(complete,/No tool calls were observed/);assert.doesNotMatch(complete,/Missing telemetry/);
});

test('Claude stream events correlate tool results and permission denials by exact child IDs',()=>{
 const x={output:'',activity:[],toolActivity:createToolActivity('claude'),agentContext:{connections:{connections:[]}}};
 consumeClaude(x,{type:'assistant',message:{content:[{type:'tool_use',id:'call-1',name:'Read',input:{file_path:'/tmp/example'}}]}});consumeClaude(x,{type:'user',message:{content:[{type:'tool_result',tool_use_id:'call-1',content:'ok'}]}});consumeClaude(x,{type:'assistant',message:{content:[{type:'tool_use',id:'call-2',name:'Write',input:{file_path:'/tmp/example'}}]}});consumeClaude(x,{type:'result',subtype:'error',is_error:true,result:'denied',permission_denials:[{tool_name:'Write',tool_use_id:'call-2'}]});
 assert.deepEqual(x.toolActivity.events.map(item=>item.outcome),['success','denied']);assert.equal(x.toolActivity.events[1].error,'Permission denied.');
});
