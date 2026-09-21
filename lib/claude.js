import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {existsSync} from 'node:fs';
import {homedir} from 'node:os';
import path from 'node:path';
import {Problem} from './domain.js';
const exec=promisify(execFile);
export const claudeBinary=()=>process.env.SKD_CLAUDE_BIN||[path.join(homedir(),'.local/bin/claude'),'/opt/homebrew/bin/claude','/usr/local/bin/claude'].find(existsSync)||'claude';
export async function discoverClaude(binary=claudeBinary(),{allowSignedOut=false}={}){
 const [{stdout:version},{stdout:help},auth]=await Promise.all([exec(binary,['--version'],{timeout:10000}),exec(binary,['--help'],{timeout:10000}),exec(binary,['auth','status','--json'],{timeout:15000}).catch(e=>({stdout:e.stdout||'{}'}))]);
 if(!help.includes('--restricted')||!help.includes('--safe-mode'))throw new Problem('Update Claude Code to a version supporting --restricted and --safe-mode.',503);
 let status;try{status=JSON.parse(auth.stdout);}catch{throw new Problem('Could not read Claude authentication status. Run claude auth status in Terminal.',503);}
 if(!status.loggedIn&&!allowSignedOut)throw new Problem('Claude is not signed in. Run claude auth login in Terminal, then retry.',503);
 return {available:true,version:version.trim(),auth:status.loggedIn?'Signed in':'Sign in inside the terminal',modelNote:'Claude CLI aliases; availability is confirmed when execution succeeds.',models:['sonnet','opus','fable','haiku'].map(id=>({id,name:id[0].toUpperCase()+id.slice(1),efforts:['low','medium','high'],defaultEffort:'medium',isDefault:id==='sonnet'})),checkedAt:new Date().toISOString()};
}
export function claudeArgs(r){
 const tools=r.purpose==='issue-proposal'?'':r.mode==='worktree'?'Read,Glob,Grep,Edit,Write':'Read,Glob,Grep';
 return ['--print','--output-format','stream-json','--verbose','--safe-mode','--restricted','--strict-mcp-config','--mcp-config','{"mcpServers":{}}','--disable-slash-commands','--no-chrome','--no-session-persistence','--permission-mode','dontAsk','--tools',tools,'--allowedTools',tools,'--model',r.model,'--effort',r.effort];
}
const number=n=>Number.isSafeInteger(n)&&n>=0?n:null;
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
   if(c.type==='tool_use')x.activity.push({at:new Date().toISOString(),type:c.name||'tool',status:'started',text:String(c.input?.file_path||c.input?.pattern||c.name||'').slice(0,1000)});
  }
 }
 x.activity=x.activity.slice(-100);
 if(e.type!=='result')return {};
 if(!x.output&&typeof e.result==='string')x.output=e.result;
 x.usage=claudeUsage(e.usage);x.cost=typeof e.total_cost_usd==='number'&&Number.isFinite(e.total_cost_usd)&&e.total_cost_usd>=0?e.total_cost_usd:null;
 x.permissionDenials=Array.isArray(e.permission_denials)?e.permission_denials.map(p=>({tool:p.tool_name||'tool'})):[];
 const failed=e.is_error||e.subtype!=='success';
 return {completed:!failed,error:failed?String(e.errors?.join('; ')||e.result||e.subtype||'Claude failed.'):null};
}
