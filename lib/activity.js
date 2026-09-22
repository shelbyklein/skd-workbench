import {createHash} from 'node:crypto';

const LIMIT=500,clone=value=>structuredClone(value),now=()=>new Date().toISOString();
const clean=(value,max=200)=>typeof value==='string'?value.replace(/[\r\n\t]+/g,' ').trim().slice(0,max):'';
export function createToolActivity(provider,{interactive=false}={}){
 if(interactive)return {schema:1,coverage:{status:'unavailable',source:'interactive-pty',scope:'Structured provider tool-call events',reason:provider==='claude'?'Claude interactive mode does not emit stream-json events; stream-json requires --print.':'Codex interactive TUI does not emit JSONL tool events; --json is limited to codex exec.',truncated:false},events:[],aggregates:{tools:[],connections:[]}};
 return {schema:1,coverage:{status:'complete',source:provider==='claude'?'claude-stream-json':'codex-exec-jsonl',scope:'Tool-call events emitted by this exact structured child process',reason:null,truncated:false},events:[],aggregates:{tools:[],connections:[]}};
}
export function unknownToolActivity(){return {schema:1,coverage:{status:'unknown',source:'legacy',scope:'Tool-call events',reason:'This record predates structured activity capture.',truncated:false},events:[],aggregates:{tools:[],connections:[]}};}
function owner(activity,toolName,server,connections=[]){
 const explicit=connections.find(item=>server&&(item.name===server||item.runtimeName===server||item.id===server));if(explicit)return {connectionID:explicit.id,connectionName:explicit.name};
 const match=/^mcp__([^_]+(?:_[^_]+)*)__(.+)$/.exec(toolName||''),mapped=match&&connections.find(item=>item.name===match[1]||item.runtimeName===match[1]);return mapped?{connectionID:mapped.id,connectionName:mapped.name}:{connectionID:null,connectionName:server||null};
}
function aggregate(activity){
 const tools=new Map(),connections=new Map();for(const event of activity.events){const tool=tools.get(event.toolName)||{name:event.toolName,count:0,outcomes:{success:0,error:0,denied:0,cancelled:0,unknown:0}};tool.count++;tool.outcomes[event.outcome]=(tool.outcomes[event.outcome]||0)+1;tools.set(event.toolName,tool);if(event.connectionID||event.connectionName){const key=event.connectionID||`unknown:${event.connectionName}`,entry=connections.get(key)||{id:event.connectionID,name:event.connectionName||'Unknown connection',count:0,outcomes:{success:0,error:0,denied:0,cancelled:0,unknown:0}};entry.count++;entry.outcomes[event.outcome]=(entry.outcomes[event.outcome]||0)+1;connections.set(key,entry);}}
 activity.aggregates={tools:[...tools.values()],connections:[...connections.values()]};
}
function limit(activity){if(activity.events.length<=LIMIT)return;activity.events=activity.events.slice(-LIMIT);activity.coverage.status='partial';activity.coverage.reason='Older tool activity was removed after the 500-event retention limit.';activity.coverage.truncated=true;}
function key(callID,toolName){return callID||createHash('sha256').update(`${toolName}:${now()}`).digest('hex').slice(0,24);}
export function startToolCall(activity,{callID,toolName,toolType='tool',server=null,at=now(),sourceEventID=null,connections=[]}){
 if(!activity||!toolName)return null;const id=key(clean(callID,300),clean(toolName));if(activity.events.some(event=>event.callID===id))return id;const mapped=owner(activity,clean(toolName),clean(server),connections);activity.events.push({id,callID:id,eventID:clean(sourceEventID,300)||null,toolName:clean(toolName),toolType:clean(toolType),connectionID:mapped.connectionID,connectionName:mapped.connectionName,startedAt:at,finishedAt:null,outcome:'unknown',evidenceSource:activity.coverage.source});limit(activity);aggregate(activity);return id;
}
export function finishToolCall(activity,{callID,outcome='success',at=now(),error=null,toolName=null,connections=[]}){
 if(!activity)return;let event=activity.events.find(item=>item.callID===callID);if(!event&&toolName){const id=startToolCall(activity,{callID,toolName,at,connections});event=activity.events.find(item=>item.callID===id);activity.coverage.status='partial';activity.coverage.reason='A tool result was observed without its matching start event.';}if(!event||event.finishedAt)return;event.finishedAt=at;event.outcome=['success','error','denied','cancelled','unknown'].includes(outcome)?outcome:'unknown';if(error)event.error=clean(error,300);aggregate(activity);
}
export function markActivityGap(activity,reason){if(!activity||activity.coverage.status==='unavailable')return;activity.coverage.status='partial';activity.coverage.reason=clean(reason,500)||'Structured activity capture was incomplete.';}
export function finalizeToolActivity(activity,outcome='unknown',at=now()){if(!activity)return;for(const event of activity.events.filter(item=>!item.finishedAt)){event.finishedAt=at;event.outcome=['cancelled','unknown'].includes(outcome)?outcome:'unknown';}aggregate(activity);}
export function publicToolActivity(activity){return clone(activity||unknownToolActivity());}
export const activityLimit=LIMIT;
