import {createHash,randomUUID} from 'node:crypto';
import {chmodSync,existsSync,mkdirSync,readFileSync,readdirSync,renameSync,rmSync,writeFileSync} from 'node:fs';
import {readFile,realpath,stat} from 'node:fs/promises';
import {spawn} from 'node:child_process';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {homedir} from 'node:os';
import path from 'node:path';
import {parse as parseToml} from 'smol-toml';
import {assert,Problem} from './domain.js';

const FILE_LIMIT=1024*1024,ENTRY_LIMIT=200,CHECK_LIMIT=1024*1024,CHECK_TIMEOUT=8000;
const exec=promisify(execFile);
const providers=['codex','claude'],clone=value=>structuredClone(value),stamp=()=>new Date().toISOString();
const hash=value=>createHash('sha256').update(value).digest('hex');
const safePath=(value,home)=>value===home?'~':value.startsWith(home+path.sep)?'~'+value.slice(home.length):value;
const record=value=>value&&typeof value==='object'&&!Array.isArray(value)?value:{};
const names=value=>Object.keys(record(value)).filter(name=>name.length&&name.length<=150).slice(0,ENTRY_LIMIT);
const inlineSecretKeys=/token|secret|password|authorization|cookie|api[-_]?key/i;
const credentialish=value=>typeof value==='string'&&(/(?:bearer\s+|token=|key=|secret=|password=)/i.test(value)||/^[A-Za-z0-9_-]{24,}$/.test(value));
const validateScope=(scope,projects)=>{assert(scope&&['global','project'].includes(scope.kind),'Choose global or project scope.');if(scope.kind==='project')assert(projects.some(project=>project.id===scope.projectID&&project.id!=='unassigned'),'Project not found.',404);return scope.kind==='global'?{kind:'global'}:{kind:'project',projectID:scope.projectID};};
const connectionID=(provider,identity,key)=>hash(`${provider}\0${identity}\0${key}`);

function validateStore(value){
 assert(value&&value.schema===1&&Number.isInteger(value.revision)&&value.revision>=0&&Array.isArray(value.policies)&&Array.isArray(value.checks),'Damaged connections library. Restore connections.json from backup.');
 for(const policy of value.policies)assert(policy&&typeof policy.projectID==='string'&&providers.includes(policy.provider)&&['native','managed'].includes(policy.mode)&&Array.isArray(policy.connectionIDs)&&(!policy.fingerprints||typeof policy.fingerprints==='object')&&Number.isInteger(policy.revision),'Damaged connection policy.');
 for(const check of value.checks)assert(check&&typeof check.id==='string'&&typeof check.connectionID==='string'&&typeof check.projectID==='string','Damaged connection check history.');
 return value;
}

async function readBounded(file,parser){
 const info=await stat(file);if(!info.isFile())throw new Error('Source is not a file.');if(info.size>FILE_LIMIT)throw new Error('Source exceeds the 1 MB inventory limit.');const raw=await readFile(file,'utf8');try{return parser(raw);}catch(error){error.configurationParse=true;throw error;}
}

function redact(provider,source,key,spec,home){
 const transport=typeof spec.url==='string'||['http','sse'].includes(spec.type)?'http':'stdio';
 const env=record(spec.env),headers={...record(spec.headers),...record(spec.http_headers),...record(spec.httpHeaders),...record(spec.env_http_headers)},args=Array.isArray(spec.args)?spec.args:[];
 const envNames=[...new Set([...Object.keys(env),...(Array.isArray(spec.env_vars)?spec.env_vars:[]),...(Array.isArray(spec.envVars)?spec.envVars:[]),...(typeof spec.bearer_token_env_var==='string'?[spec.bearer_token_env_var]:[])])].filter(name=>/^[A-Za-z_][A-Za-z0-9_]*$/.test(name)).slice(0,100);
 const inlineCredentials=Object.entries(headers).some(([name,value])=>inlineSecretKeys.test(name)||credentialish(value))||Object.entries(env).some(([name,value])=>typeof value==='string'&&!/^\$\{?[A-Za-z_][A-Za-z0-9_]*\}?$/.test(value)&&(inlineSecretKeys.test(name)||credentialish(value)))||(typeof spec.url==='string'&&(/[?&](?:token|key|secret|password)=/i.test(spec.url)||/@/.test(spec.url.split('://').at(-1).split('/')[0])))||args.some((value,index)=>credentialish(value)||(inlineSecretKeys.test(String(value))&&index<args.length-1));
 const fingerprint=hash(JSON.stringify(spec)),safeManagedName=/^[A-Za-z0-9_-]+$/.test(key),unsupportedHeaders=Object.keys(headers).length>0,eligible=!inlineCredentials&&!unsupportedHeaders&&safeManagedName;
 return {id:connectionID(provider,source.identity,key),name:key,provider,source:source.scope,projectID:source.projectID||null,sourcePath:safePath(source.displayPath,home),transport,configured:spec.enabled!==false&&!source.disabled?.has(key),inlineCredentials,environmentNames:envNames,fingerprint,shadowed:false,activation:{interactiveWorktree:eligible,interactiveReadOnly:false,structured:false,reason:inlineCredentials?'Inline credentials cannot use managed activation.':unsupportedHeaders?'Inline HTTP headers cannot use managed activation.':!safeManagedName?'This connection name is not safe for selective launch overrides.':'Available for isolated interactive worktree sessions.'}};
}

async function sourceFile(file,meta,parser,diagnostics){
 try{const canonical=await realpath(file),allowedRoot=meta.allowedRoot?await realpath(meta.allowedRoot):null;if(allowedRoot&&!((canonical===allowedRoot)||canonical.startsWith(allowedRoot+path.sep))){diagnostics.push({provider:meta.provider,source:meta.scope,projectID:meta.projectID||null,path:meta.displayPath||file,message:'Configuration link resolves outside its allowed root.'});return null;}const value=await readBounded(canonical,parser);return {...meta,identity:canonical,displayPath:file,value};}
 catch(error){if(error.code!=='ENOENT')diagnostics.push({provider:meta.provider,source:meta.scope,projectID:meta.projectID||null,path:meta.displayPath||file,message:error.configurationParse?'Configuration is malformed.':'Could not read this configuration source.'});return null;}
}

function ancestors(folder,home){
 const result=[];let current=path.resolve(folder);for(let i=0;i<12;i++){result.unshift(current);if(current===home)break;const parent=path.dirname(current);if(parent===current||!current.startsWith(home+path.sep))break;current=parent;}return result;
}

async function collectSources(projects,scope,home){
 const diagnostics=[],sources=[];
 const codexUser=await sourceFile(path.join(home,'.codex','config.toml'),{provider:'codex',scope:'user',projectID:null,displayPath:path.join(home,'.codex','config.toml'),allowedRoot:home},parseToml,diagnostics);if(codexUser)sources.push(codexUser);
 const claudeUser=await sourceFile(path.join(home,'.claude.json'),{provider:'claude',scope:'user',projectID:null,displayPath:path.join(home,'.claude.json'),allowedRoot:home},JSON.parse,diagnostics);
 if(claudeUser)sources.push({...claudeUser,value:{mcpServers:record(claudeUser.value.mcpServers)},disabled:new Set()});
 const managed='/Library/Application Support/ClaudeCode/managed-mcp.json',managedSource=await sourceFile(managed,{provider:'claude',scope:'managed',projectID:null,displayPath:managed,allowedRoot:path.dirname(managed)},JSON.parse,diagnostics);if(managedSource)sources.push(managedSource);
 const selected=scope.kind==='project'?projects.filter(project=>project.id===scope.projectID):projects.filter(project=>project.id!=='unassigned');
 for(const project of selected){
  if(!project.folderPath)continue;let folder;try{folder=await realpath(project.folderPath);}catch{diagnostics.push({projectID:project.id,message:'Project folder is unavailable.'});continue;}
  for(const dir of ancestors(folder,home).filter(dir=>dir!==home)){
   const config=await sourceFile(path.join(dir,'.codex','config.toml'),{provider:'codex',scope:'project',projectID:project.id,displayPath:path.join(dir,'.codex','config.toml'),allowedRoot:dir},parseToml,diagnostics);if(config&&!sources.some(source=>source.identity===config.identity&&source.projectID===project.id))sources.push(config);
  }
  for(const [relative,scopeName] of [['.mcp.json','project'],['.claude/settings.json','project'],['.claude/settings.local.json','local']]){
   const file=path.join(folder,relative),config=await sourceFile(file,{provider:'claude',scope:scopeName,projectID:project.id,displayPath:file,allowedRoot:folder},JSON.parse,diagnostics);if(config)sources.push({...config,disabled:new Set(config.value.disabledMcpjsonServers||config.value.disabledMcpServers||[])});
  }
  if(claudeUser){const projectValue=record(claudeUser.value?.projects?.[folder]);if(Object.keys(record(projectValue.mcpServers)).length)sources.push({provider:'claude',scope:'local',projectID:project.id,identity:claudeUser.identity+`#projects:${folder}`,displayPath:path.join(home,'.claude.json')+' (project settings)',value:{mcpServers:projectValue.mcpServers},disabled:new Set(projectValue.disabledMcpjsonServers||projectValue.disabledMcpServers||[])});}
 }
 return {sources,diagnostics};
}

async function inventoryRaw(projects,scope,home){
 const {sources,diagnostics}=await collectSources(projects,scope,home),rows=[];
 for(const source of sources){
  const table=source.provider==='codex'?record(source.value.mcp_servers):record(source.value.mcpServers);
  for(const key of names(table).slice(0,ENTRY_LIMIT-rows.length))rows.push({...redact(source.provider,source,key,record(table[key]),home),_spec:record(table[key]),_identity:source.identity});
  if(rows.length>=ENTRY_LIMIT){diagnostics.push({message:`Inventory stopped at ${ENTRY_LIMIT} connections.`});break;}
 }
 const rank={user:1,managed:2,project:3,local:4};
 for(const row of rows){
  const peers=rows.filter(other=>other!==row&&other.provider===row.provider&&other.name===row.name&&(other.projectID===row.projectID||(!other.projectID&&row.projectID)||(!row.projectID&&other.projectID)));
  row.shadowed=peers.some(other=>(rank[other.source]||0)>(rank[row.source]||0));
 }
 return {rows,diagnostics};
}

function publicRow(row){const {_spec,_identity,_tools,...safe}=row;return safe;}

export class Connections {
 constructor(directory,{home=homedir(),spawnProcess=spawn,timeoutMs=CHECK_TIMEOUT,codexBinary=process.env.SKD_CODEX_BIN||'codex',enumerateCodex=null}={}){
  mkdirSync(directory,{recursive:true});this.file=path.join(directory,'connections.json');this.home=home;this.spawnProcess=spawnProcess;this.timeoutMs=timeoutMs;this.activeChecks=new Map();this.enumerateCodex=enumerateCodex||(async folder=>{const {stdout}=await exec(codexBinary,['-C',folder,'mcp','list','--json'],{timeout:10000,maxBuffer:2*1024*1024});const rows=JSON.parse(stdout);assert(Array.isArray(rows),'Codex returned an invalid MCP inventory.',503);return rows.slice(0,ENTRY_LIMIT).map(row=>({name:String(row.name||''),transport:row.transport?.type==='stdio'?'stdio':'http'})).filter(row=>/^[A-Za-z0-9_-]+$/.test(row.name));});this.launchDirectory=path.join(directory,'connection-launches');mkdirSync(this.launchDirectory,{recursive:true,mode:0o700});chmodSync(this.launchDirectory,0o700);
  for(const name of readdirSync(this.launchDirectory))rmSync(path.join(this.launchDirectory,name),{recursive:true,force:true});
  this.data=existsSync(this.file)?validateStore(JSON.parse(readFileSync(this.file,'utf8'))):{schema:1,revision:0,policies:[],checks:[]};if(!existsSync(this.file))this.persist();
 }
 persist(){writeFileSync(this.file+'.tmp',JSON.stringify(this.data,null,2),{mode:0o600});renameSync(this.file+'.tmp',this.file);}
 change(expectedRevision,fn){assert(expectedRevision===this.data.revision,'Connections changed in another tab. Reload before saving.',409);const draft=clone(this.data),result=fn(draft);draft.revision++;validateStore(draft);writeFileSync(this.file+'.tmp',JSON.stringify(draft,null,2),{mode:0o600});renameSync(this.file+'.tmp',this.file);this.data=draft;return clone(result);}
 async inventory(projects,requestedScope){const scope=validateScope(requestedScope,projects),raw=await inventoryRaw(projects,scope,this.home),checks=new Map(this.data.checks.map(check=>[`${check.projectID}:${check.connectionID}`,check]));return {scope,revision:this.data.revision,connections:raw.rows.map(row=>({...publicRow(row),lastCheck:checks.get(`${row.projectID||scope.projectID||'global'}:${row.id}`)||null,selectedBy:this.data.policies.filter(policy=>policy.connectionIDs.includes(row.id)).map(policy=>policy.projectID)})),policies:clone(this.data.policies.filter(policy=>scope.kind==='global'||policy.projectID===scope.projectID)),diagnostics:raw.diagnostics};}
 async savePolicy(input,projects){const project=projects.find(project=>project.id===input.projectID&&project.id!=='unassigned');assert(project,'Project not found.',404);assert(providers.includes(input.provider),'Choose Codex or Claude.');assert(['native','managed'].includes(input.mode),'Choose native provider configuration or Workbench selection.');assert(Array.isArray(input.connectionIDs)&&input.connectionIDs.length<=100,'Choose up to 100 connections.');const connectionIDs=[...new Set(input.connectionIDs)],raw=await inventoryRaw([project],{kind:'project',projectID:project.id},this.home),selected=connectionIDs.map(id=>raw.rows.find(row=>row.id===id&&row.provider===input.provider&&!row.shadowed&&row.configured));assert(selected.every(Boolean),'A selected connection changed or is unavailable. Refresh before saving.',409);if(input.mode==='managed')assert(selected.every(row=>row.activation.interactiveWorktree),'One or more selected connections cannot use managed activation.',409);const fingerprints=Object.fromEntries(selected.map(row=>[row.id,row.fingerprint]));return this.change(input.revision,draft=>{let policy=draft.policies.find(policy=>policy.projectID===input.projectID&&policy.provider===input.provider);if(!policy){policy={projectID:input.projectID,provider:input.provider,mode:'native',connectionIDs:[],fingerprints:{},revision:0};draft.policies.push(policy);}assert(policy.revision===input.policyRevision,'Connection assignments changed in another tab. Reload before saving.',409);Object.assign(policy,{mode:input.mode,connectionIDs,fingerprints,revision:policy.revision+1,updatedAt:stamp()});return policy;});}
 async resolve(project,provider,selection={mode:'inherit',connectionIDs:[]},{purpose='session',mode='worktree'}={}){
  assert(project&&project.id&&providers.includes(provider),'Invalid connection launch context.');
  const policy=this.data.policies.find(item=>item.projectID===project.id&&item.provider===provider)||{mode:'native',connectionIDs:[],revision:0};
  if(purpose==='issue-proposal'||purpose==='workflow'||mode!=='worktree')return {status:'excluded',reason:purpose==='issue-proposal'?'Issue edit proposals are MCP-free.':purpose==='workflow'?'Structured workflows do not enable MCP connections.':'Managed MCP is limited to interactive worktree sessions.',policyRevision:this.data.revision,connections:[]};
  assert(selection&&['inherit','replace'].includes(selection.mode)&&Array.isArray(selection.connectionIDs),'Invalid connection selection.');
  if(policy.mode==='native'&&selection.mode!=='replace')return {status:'native',reason:provider==='codex'?'Codex uses its native provider configuration.':'Claude remains MCP-free in the current safe terminal mode.',policyRevision:this.data.revision,assignmentRevision:policy.revision,connections:[]};
  const ids=selection.mode==='replace'?selection.connectionIDs:policy.connectionIDs,expected=selection.mode==='replace'?(selection.fingerprints||{}):(policy.fingerprints||{}),raw=await inventoryRaw([project],{kind:'project',projectID:project.id},this.home),chosen=[];
  for(const id of [...new Set(ids)]){const row=raw.rows.find(row=>row.id===id&&row.provider===provider&&!row.shadowed);assert(row&&row.configured,'A selected MCP connection changed or is unavailable. Refresh Connections before launching.',409);assert(!expected[id]||expected[id]===row.fingerprint,'A selected MCP connection changed after it was assigned. Refresh and save the selection again.',409);assert(row.activation.interactiveWorktree,row?.activation?.reason||'This connection cannot use managed activation.',409);if(provider==='claude'){const check=this.data.checks.find(item=>item.projectID===project.id&&item.connectionID===row.id&&item.fingerprint===row.fingerprint&&item.status==='available');assert(check,'Check this Claude connection successfully before using managed activation.',409);row._tools=check.tools.filter(name=>/^[A-Za-z0-9_-]+$/.test(name));assert(row._tools.length,'The checked Claude connection did not advertise a safe tool name.',409);}chosen.push(row);}
  return {status:chosen.length?'managed':'empty',policyRevision:this.data.revision,assignmentRevision:policy.revision,selection:{mode:selection.mode,connectionIDs:[...new Set(ids)]},connections:chosen.map(row=>({...publicRow(row),...(row._tools?{tools:row._tools}:{})})),_connections:chosen};
 }
 async prepareLaunch(project,provider,selection,{purpose='session',mode='worktree'}={}){
  const resolved=await this.resolve(project,provider,selection,{purpose,mode}),internal=resolved._connections||[],snapshot=clone(resolved);delete snapshot._connections;
  if(resolved.status==='excluded'&&provider==='codex'&&purpose==='session'){
   let effective;try{effective=await this.enumerateCodex(project.folderPath);}catch{throw new Problem('Codex effective MCP configuration could not be enumerated safely. The MCP-free read-only session cannot start.',503);}const args=[];for(const row of effective)args.push('-c',row.transport==='http'?`mcp_servers.${row.name}.url="http://127.0.0.1/"`:`mcp_servers.${row.name}.command="/usr/bin/false"`,'-c',`mcp_servers.${row.name}.enabled=false`);return {snapshot,args,env:{},tools:[],cleanup:null};
  }
  if(!['managed','empty'].includes(resolved.status)||!resolved.selection)return {snapshot,args:[],env:{},tools:[],cleanup:null};
  if(provider==='codex'){
   const raw=await inventoryRaw([project],{kind:'project',projectID:project.id},this.home);let effective;try{effective=await this.enumerateCodex(project.folderPath);}catch{throw new Problem('Codex effective MCP configuration could not be enumerated safely. Managed activation is unavailable; use native mode or retry.',503);}const sourceRows=raw.rows.filter(row=>row.provider==='codex'),all=[...sourceRows.map(row=>({name:row.name,transport:row.transport})),...effective],names=[...new Set(all.map(row=>row.name))];
   const args=[],env={},selectedNames=new Set(internal.map(row=>row.name));for(const name of names.filter(name=>/^[A-Za-z0-9_-]+$/.test(name)&&!selectedNames.has(name))){const row=all.find(item=>item.name===name);args.push('-c',row?.transport==='http'?`mcp_servers.${name}.url="http://127.0.0.1/"`:`mcp_servers.${name}.command="/usr/bin/false"`,'-c',`mcp_servers.${name}.enabled=false`);}
   for(const row of internal){const spec=row._spec,prefix=`mcp_servers.${row.name}`;if(row.transport==='stdio'){assert(typeof spec.command==='string'&&spec.command,'Selected stdio connection has no command.',409);args.push('-c',`${prefix}.command=${JSON.stringify(spec.command)}`);if(Array.isArray(spec.args))args.push('-c',`${prefix}.args=${JSON.stringify(spec.args)}`);const literal=record(spec.env),forward=[...new Set([...(Array.isArray(spec.env_vars)?spec.env_vars:[]),...Object.keys(literal)])];Object.assign(env,literal);if(forward.length)args.push('-c',`${prefix}.env_vars=${JSON.stringify(forward)}`);if(typeof spec.cwd==='string')args.push('-c',`${prefix}.cwd=${JSON.stringify(spec.cwd)}`);}else{assert(typeof spec.url==='string'&&spec.url,'Selected HTTP connection has no URL.',409);args.push('-c',`${prefix}.url=${JSON.stringify(spec.url)}`);if(typeof spec.bearer_token_env_var==='string')args.push('-c',`${prefix}.bearer_token_env_var=${JSON.stringify(spec.bearer_token_env_var)}`);}for(const field of ['startup_timeout_sec','tool_timeout_sec'])if(typeof spec[field]==='number')args.push('-c',`${prefix}.${field}=${spec[field]}`);args.push('-c',`${prefix}.enabled=true`);}
   return {snapshot,args,env,tools:[],cleanup:null};
  }
  if(!internal.length)return {snapshot,args:[],env:{},tools:[],cleanup:null};
  const file=path.join(this.launchDirectory,randomUUID()+'.json'),mcpServers=Object.fromEntries(internal.map(row=>[row.name,row._spec]));writeFileSync(file,JSON.stringify({mcpServers}),{mode:0o600,flag:'wx'});
  return {snapshot,args:['--restricted','--strict-mcp-config','--mcp-config',file],env:{},tools:internal.flatMap(row=>row._tools.map(tool=>`mcp__${row.name}__${tool}`)),cleanup:file};
 }
 cleanupLaunch(file){if(file&&path.dirname(file)===this.launchDirectory)rmSync(file,{force:true});}
 async startCheck(project,connectionID){
  assert(project?.id&&project.id!=='unassigned','Choose a project.',404);const raw=await inventoryRaw([project],{kind:'project',projectID:project.id},this.home),row=raw.rows.find(item=>item.id===connectionID&&!item.shadowed);assert(row&&row.configured,'Connection changed or is unavailable. Refresh and try again.',409);assert(row.transport==='stdio','This release can check stdio MCP servers only.');assert(!this.activeChecks.has(project.id),'A connection check is already running for this project.',409);
  const id=randomUUID(),check={id,projectID:project.id,connectionID:row.id,provider:row.provider,name:row.name,fingerprint:row.fingerprint,status:'checking',startedAt:stamp(),finishedAt:null,tools:[],error:null};this.data.checks=this.data.checks.filter(item=>!(item.projectID===project.id&&item.connectionID===row.id));this.data.checks.push(check);this.persist();
  this.runCheck(check,row,project).catch(()=>{const saved=this.data.checks.find(item=>item.id===check.id);if(saved&&saved.status==='checking'){Object.assign(saved,{status:'failed',error:'Connection check could not start.',finishedAt:stamp()});this.persist();}});return clone(check);
 }
 async runCheck(check,row,project){
  const spec=row._spec,command=spec.command,args=Array.isArray(spec.args)?spec.args:[];if(typeof command!=='string'||!command)throw new Problem('This stdio connection has no executable command.');
  const sourceFolder=path.dirname(row._identity.split('#')[0]),cwd=typeof spec.cwd==='string'&&spec.cwd?path.resolve(sourceFolder,spec.cwd):project.folderPath,env={...process.env,...record(spec.env)},child=this.spawnProcess(command,args,{cwd,env,stdio:['pipe','pipe','pipe'],detached:true});this.activeChecks.set(check.projectID,child);let buffer='',bytes=0,settled=false,initialized=false;
  const finish=(status,error=null,tools=[])=>{if(settled)return;settled=true;clearTimeout(timer);this.activeChecks.delete(check.projectID);try{child.kill('SIGTERM');}catch{}const saved=this.data.checks.find(item=>item.id===check.id);if(saved){Object.assign(saved,{status,error:error?String(error).slice(0,500):null,tools:tools.slice(0,100),finishedAt:stamp()});this.persist();}};
  const timer=setTimeout(()=>finish('failed','Connection check timed out.'),this.timeoutMs),send=(id,method,params={})=>child.stdin.write(JSON.stringify({jsonrpc:'2.0',id,method,params})+'\n');
  child.on('error',()=>finish('failed','Connection process could not be started.'));child.stderr.on('data',chunk=>{bytes+=chunk.length;if(bytes>CHECK_LIMIT)finish('failed','Connection check output exceeded 1 MB.');});
  child.stdout.on('data',chunk=>{bytes+=chunk.length;if(bytes>CHECK_LIMIT)return finish('failed','Connection check output exceeded 1 MB.');buffer+=chunk;let index;while((index=buffer.indexOf('\n'))>=0){const line=buffer.slice(0,index);buffer=buffer.slice(index+1);let message;try{message=JSON.parse(line);}catch{continue;}if(message.id===1&&!initialized){initialized=true;child.stdin.write(JSON.stringify({jsonrpc:'2.0',method:'notifications/initialized',params:{}})+'\n');send(2,'tools/list');}else if(message.id===2){if(message.error)return finish('failed','Tool listing failed.');const tools=Array.isArray(message.result?.tools)?message.result.tools.map(tool=>String(tool.name||'').slice(0,150)).filter(Boolean):[];finish('available',null,tools);}}});
  child.on('close',code=>{if(!settled)finish('failed',`Connection check exited with code ${code}.`);});send(1,'initialize',{protocolVersion:'2025-06-18',capabilities:{},clientInfo:{name:'skd-workbench',version:'0.5.0'}});
 }
 check(id,projectID){const check=this.data.checks.find(item=>item.id===id&&item.projectID===projectID);assert(check,'Connection check not found.',404);return clone(check);}
 shutdown(){for(const child of this.activeChecks.values())try{child.kill('SIGKILL');}catch{}this.activeChecks.clear();for(const check of this.data.checks.filter(check=>check.status==='checking')){check.status='failed';check.error='Local server stopped during the check.';check.finishedAt=stamp();}this.persist();}
}

export const connectionLimits={FILE_LIMIT,ENTRY_LIMIT,CHECK_LIMIT,CHECK_TIMEOUT};
