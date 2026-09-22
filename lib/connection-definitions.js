import path from 'node:path';
import {assert} from './domain.js';
const variable=/^[A-Za-z_][A-Za-z0-9_]*$/;
const text=(v,label,max=2048)=>{assert(typeof v==='string'&&v.length<=max&&!/[\0\r\n]/.test(v),`Invalid ${label}.`);return v;};
const secret=v=>/(?:bearer\s+|(?:token|password|secret|api[-_]?key)\s*[=:]\s*\S|\b(?:sk-|ghp_)[\w-]+)/i.test(v);
export function validateDefinition(input,projects=null){
 const name=text(input.name,'server name',64);assert(/^[A-Za-z0-9][A-Za-z0-9_-]*$/.test(name),'Use letters, numbers, hyphens or underscores for the server name.');
 const scope=input.scope;assert(scope&&['global','project'].includes(scope.kind),'Choose global or project scope.');if(scope.kind==='project')assert(typeof scope.projectID==='string'&&scope.projectID!=='unassigned'&&(!projects||projects.some(p=>p.id===scope.projectID)),'Project not found.',404);
 assert(Array.isArray(input.providers)&&input.providers.length>0&&input.providers.every(p=>['codex','claude'].includes(p)),'Choose Codex or Claude.');
 const transport=input.transport;assert(['stdio','http'].includes(transport),'Choose local stdio or remote HTTP.');
 const config=input.config;assert(config&&typeof config==='object'&&!Array.isArray(config),'Enter server configuration.');
 const allowed=transport==='stdio'?['command','args','cwd','environmentNames']:['url','bearerTokenEnv'];assert(Object.keys(config).every(k=>allowed.includes(k)),'Unsupported configuration field.');
 let normalized;
 if(transport==='stdio'){
  const command=text(config.command,'executable');assert(command.trim()&&!secret(command),'Enter an executable without credentials.');assert(!/[\s]/.test(command)||path.isAbsolute(command),'Use an executable, not a shell command.');
  const args=config.args??[];assert(Array.isArray(args)&&args.length<=100,'Use at most 100 arguments.');args.forEach(v=>{text(v,'argument');assert(!secret(v)&&!/^[A-Za-z0-9_]{24,}$/.test(v),'Use environment references instead of inline credentials.');});assert(!args.some((v,i)=>/^(?:--?)?(?:token|password|secret|api[-_]?key)$/i.test(v)&&i<args.length-1),'Use environment references instead of credential arguments.');
  const cwd=text(config.cwd||'','working directory');assert(!cwd||path.isAbsolute(cwd),'Working directory must be absolute.');
  const environmentNames=config.environmentNames??[];assert(Array.isArray(environmentNames)&&environmentNames.length<=100&&environmentNames.every(v=>typeof v==='string'&&variable.test(v)),'Use environment variable names, not values.');
  normalized={command,args:[...args],cwd,environmentNames:[...new Set(environmentNames)]};
 }else{
  const url=text(config.url,'HTTP endpoint');let parsed;try{parsed=new URL(url);}catch{}assert(parsed&&['https:','http:'].includes(parsed.protocol)&&!parsed.username&&!parsed.password&&!parsed.hash&&!secret(url)&&![...parsed.searchParams.keys()].some(k=>/^(?:key|token|secret|password|api[-_]?key|access_token)$/i.test(k)),'Use an HTTP(S) endpoint without credentials.');
  const bearerTokenEnv=text(config.bearerTokenEnv||'','token environment variable',100);assert(!bearerTokenEnv||variable.test(bearerTokenEnv),'Use a token environment variable name, not its value.');normalized={url,bearerTokenEnv};
 }
 return {name,scope:scope.kind==='global'?{kind:'global'}:{kind:'project',projectID:scope.projectID},providers:[...new Set(input.providers)],transport,config:normalized};
}
export function definitionSpec(entry,provider,env=null){
 const c=entry.config;if(env){const refs=entry.transport==='stdio'?c.environmentNames:c.bearerTokenEnv?[c.bearerTokenEnv]:[];for(const key of refs)assert(typeof env[key]==='string'&&env[key].length>0,`Environment variable ${key} is unavailable to the Workbench service.`,409);}
 if(entry.transport==='stdio')return {command:c.command,args:c.args,...(c.cwd?{cwd:c.cwd}:{}),...(provider==='codex'?{env_vars:c.environmentNames}:{env:Object.fromEntries(c.environmentNames.map(key=>[key,env?env[key]:`\${${key}}`]))})};
 return {type:'http',url:c.url,...(c.bearerTokenEnv?(provider==='codex'?{bearer_token_env_var:c.bearerTokenEnv}:{headers:{Authorization:env?`Bearer ${env[c.bearerTokenEnv]}`:`Bearer \${${c.bearerTokenEnv}}`}}):{})};
}
