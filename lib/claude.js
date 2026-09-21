import {execFile,spawn} from 'node:child_process';
import {promisify} from 'node:util';
import {existsSync} from 'node:fs';
import {homedir} from 'node:os';
import path from 'node:path';
import {Problem} from './domain.js';
const exec=promisify(execFile);
export const claudeBinary=()=>process.env.SKD_CLAUDE_BIN||[path.join(homedir(),'.local/bin/claude'),'/opt/homebrew/bin/claude','/usr/local/bin/claude'].find(existsSync)||'claude';
const catalogs=new Map();
export function claudeModels(binary){
 const cached=catalogs.get(binary);if(cached&&Date.now()-cached.time<30000)return cached.promise;
 const promise=new Promise((resolve,reject)=>{
  const child=spawn(binary,['--print','--input-format','stream-json','--output-format','stream-json','--verbose','--no-session-persistence','--strict-mcp-config','--mcp-config','{"mcpServers":{}}','--settings','{"disableAllHooks":true}'],{stdio:['pipe','pipe','pipe']});
  let buffer='',size=0,settled=false;
  const finish=(error,models)=>{if(settled)return;settled=true;clearTimeout(timer);child.kill();error?reject(error):resolve(models);};
  const timer=setTimeout(()=>finish(new Problem('Claude model discovery timed out. Retry.',503)),15000);
  child.on('error',e=>finish(e));child.stdin.on('error',()=>{});child.stderr.resume();
  child.stdout.on('data',chunk=>{
   size+=chunk.length;if(size>2*1024*1024)return finish(new Problem('Claude model catalog is too large.',503));
   buffer+=chunk;
   let index;
   while((index=buffer.indexOf('\n'))!==-1){
    const line=buffer.slice(0,index);buffer=buffer.slice(index+1);
    try{
     const event=JSON.parse(line);
     if(event.type!=='control_response'||event.response?.request_id!=='workbench-models')continue;
     const rows=event.response?.response?.models;
     if(!Array.isArray(rows)||!rows.length)return finish(new Problem('Claude did not return its model catalog. Update Claude Code.',503));
     const models=rows.filter(m=>typeof m.value==='string'&&typeof m.displayName==='string').map(m=>{
      const efforts=m.supportsEffort?m.supportedEffortLevels?.filter(e=>['low','medium','high','xhigh','max'].includes(e)):[];
      return {id:m.value,name:m.displayName,resolvedModel:m.resolvedModel,efforts:efforts?.length?efforts:['default'],defaultEffort:efforts?.includes('high')?'high':efforts?.[0]||'default',isDefault:m.value==='default'};
     });
     for(const alias of ['opus','fable']){
      if(models.some(m=>m.id===alias))continue;
      const model=models.find(m=>m.resolvedModel?.includes('-'+alias+'-'));
      if(model)models.push({...model,id:alias,name:alias[0].toUpperCase()+alias.slice(1),isDefault:false,legacyAlias:true});
     }
     finish(null,models);
    }catch(e){if(e instanceof Problem)finish(e);}
   }
  });
  child.on('close',()=>{if(!settled)finish(new Problem('Claude model discovery ended without a catalog.',503));});
  child.stdin.end(JSON.stringify({type:'control_request',request_id:'workbench-models',request:{subtype:'initialize'}})+'\n');
 });
 catalogs.set(binary,{time:Date.now(),promise});promise.catch(()=>catalogs.delete(binary));return promise;
}
export async function discoverClaude(binary=claudeBinary(),{allowSignedOut=false}={}){
 const [{stdout:version},{stdout:help},auth]=await Promise.all([exec(binary,['--version'],{timeout:10000}),exec(binary,['--help'],{timeout:10000}),exec(binary,['auth','status','--json'],{timeout:15000}).catch(e=>({stdout:e.stdout||'{}'}))]);
 if(!help.includes('--restricted')||!help.includes('--safe-mode'))throw new Problem('Update Claude Code to a version supporting --restricted and --safe-mode.',503);
 let status;try{status=JSON.parse(auth.stdout);}catch{throw new Problem('Could not read Claude authentication status. Run claude auth status in Terminal.',503);}
 if(!status.loggedIn&&!allowSignedOut)throw new Problem('Claude is not signed in. Run claude auth login in Terminal, then retry.',503);
 return {available:true,version:version.trim(),auth:status.loggedIn?'Signed in':'Sign in inside the terminal',modelNote:'Models and effort levels reported by the installed Claude Code. Access is confirmed when execution succeeds.',models:await claudeModels(binary),checkedAt:new Date().toISOString()};
}
export function claudeArgs(r){
 const tools=r.purpose==='issue-proposal'?'':r.mode==='worktree'?'Read,Glob,Grep,Edit,Write':'Read,Glob,Grep';
 return ['--print','--output-format','stream-json','--verbose','--safe-mode','--restricted','--strict-mcp-config','--mcp-config','{"mcpServers":{}}',...(r.agentContext?.skills?.text?['--append-system-prompt',r.agentContext.skills.text]:[]),'--settings','{"disableAllHooks":true}','--disable-slash-commands','--no-chrome','--no-session-persistence','--permission-mode','dontAsk','--tools',tools,'--allowedTools',tools,'--model',r.model,...(r.effort==='default'?[]:['--effort',r.effort])];
}
const number=n=>Number.isSafeInteger(n)&&n>=0?n:null;
import {finishToolCall,startToolCall} from './activity.js';
export function claudeUsage(u){
 if(!u||typeof u!=='object')return null;
 const input=number(u.input_tokens),read=number(u.cache_read_input_tokens),write=number(u.cache_creation_input_tokens);
 return {inputTokens:input!==null&&read!==null&&write!==null?input+read+write:null,cachedInputTokens:read,cacheCreationInputTokens:write,uncachedInputTokens:input,outputTokens:number(u.output_tokens),reasoningOutputTokens:null};
}
export function consumeClaude(x,e){
 if(e.session_id)x.threadID=e.session_id;
 if(e.type==='system'&&e.subtype==='init'&&typeof e.model==='string')x.resolvedModel=e.model;
 if(e.type==='assistant'&&!e.parent_tool_use_id){
  for(const c of e.message?.content||[]){
   if(c.type==='text')x.output+=(x.output?'\n\n':'')+String(c.text||'');
   if(c.type==='tool_use'){x.activity.push({at:new Date().toISOString(),type:c.name||'tool',status:'started',text:String(c.input?.file_path||c.input?.pattern||c.name||'').slice(0,1000)});startToolCall(x.toolActivity,{callID:c.id,toolName:c.name||'tool',toolType:'tool_use',connections:x.agentContext?.connections?.connections});}
  }
 }
 if(e.type==='user')for(const c of e.message?.content||[])if(c.type==='tool_result')finishToolCall(x.toolActivity,{callID:c.tool_use_id,outcome:c.is_error?'error':'success',error:c.is_error?'Provider reported a tool error.':null});
 x.activity=x.activity.slice(-100);
 if(e.type!=='result')return {};
 if(!x.output&&typeof e.result==='string')x.output=e.result;
 x.usage=claudeUsage(e.usage);x.cost=typeof e.total_cost_usd==='number'&&Number.isFinite(e.total_cost_usd)&&e.total_cost_usd>=0?e.total_cost_usd:null;
 x.permissionDenials=Array.isArray(e.permission_denials)?e.permission_denials.map(p=>({tool:p.tool_name||'tool'})):[];for(const denial of e.permission_denials||[]){const open=[...x.toolActivity.events].reverse().find(item=>!item.finishedAt&&item.toolName===(denial.tool_name||'tool'));if(open)finishToolCall(x.toolActivity,{callID:open.callID,outcome:'denied',error:'Permission denied.'});else{const id=startToolCall(x.toolActivity,{callID:denial.tool_use_id,toolName:denial.tool_name||'tool'});finishToolCall(x.toolActivity,{callID:id,outcome:'denied',error:'Permission denied.'});}}
 const failed=e.is_error||e.subtype!=='success';
 return {completed:!failed,error:failed?String(e.errors?.join('; ')||e.result||e.subtype||'Claude failed.'):null};
}
