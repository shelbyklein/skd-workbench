// What each CLI can use in its normal setup (#20): skills from user, system, plugin and project roots, and MCP
// servers from the existing redacted configuration readers. Reading starts no process and changes no file.
import {readdir,readFile,realpath,stat} from 'node:fs/promises';
import {homedir} from 'node:os';
import path from 'node:path';
import matter from 'gray-matter';
import {parse as parseToml} from 'smol-toml';
import {Problem} from './domain.js';

const SKILL_LIMIT=600,FILE_LIMIT=64*1024;
const providers=['codex','claude'];

async function readJSON(file){try{return JSON.parse(await readFile(file,'utf8'));}catch{return null;}}
async function readTOML(file){try{return parseToml(await readFile(file,'utf8'));}catch{return null;}}
const newest=async dir=>{try{const items=(await readdir(dir,{withFileTypes:true})).filter(i=>i.isDirectory()).map(i=>i.name).sort((a,b)=>b.localeCompare(a,undefined,{numeric:true}));return items[0]?path.join(dir,items[0]):null;}catch{return null;}};

// One skill directory per entry: <root>/<name>/SKILL.md. Only the front matter is kept.
async function skillsIn(root,{source,plugin=null,projectID=null},out,diagnostics){
 let items;try{items=await readdir(root,{withFileTypes:true});}catch(error){if(error.code!=='ENOENT')diagnostics.push(`Could not list ${root}.`);return;}
 for(const item of items.sort((a,b)=>a.name.localeCompare(b.name))){
  if(out.length>=SKILL_LIMIT)return;
  if(item.name.startsWith('.')||!(item.isDirectory()||item.isSymbolicLink()))continue;
  const file=path.join(root,item.name,'SKILL.md');
  try{const info=await stat(file);if(!info.isFile())continue;if(info.size>FILE_LIMIT){out.push({name:item.name,description:'',source,plugin,projectID,status:'unreadable'});continue;}
   const data=matter(await readFile(file,'utf8')).data||{},name=(typeof data.name==='string'&&data.name.trim())||item.name;
   out.push({name:(plugin?`${plugin}:`:'')+name.slice(0,100),description:typeof data.description==='string'?data.description.trim().slice(0,400):'',source,plugin,projectID,status:'available',location:path.join(root,item.name)});}
  catch(error){if(error.code!=='ENOENT')out.push({name:item.name,description:'',source,plugin,projectID,status:'unreadable'});}
 }
}

async function codexPlugins(home,diagnostics){
 const config=await readTOML(path.join(home,'.codex','config.toml')),enabled=Object.entries(config?.plugins||{}).filter(([,v])=>v?.enabled!==false).map(([k])=>k),roots=[];
 for(const key of enabled){const [name,market]=key.split('@');if(!name||!market||/[/\\]|\.\./.test(key))continue;const dir=await newest(path.join(home,'.codex','plugins','cache',market,name));if(dir)roots.push({plugin:name,root:path.join(dir,'skills')});}
 return roots;
}
async function claudePlugins(home,project){
 const installed=await readJSON(path.join(home,'.claude','plugins','installed_plugins.json')),settings=await readJSON(path.join(home,'.claude','settings.json')),enabled=settings?.enabledPlugins||{},roots=[];
 for(const [key,installs] of Object.entries(installed?.plugins||installed||{})){
  if(enabled[key]===false||!Array.isArray(installs))continue;
  const install=installs.find(i=>i.scope==='user'||(project?.folderPath&&i.projectPath===project.folderPath));
  if(install?.installPath)roots.push({plugin:key.split('@')[0],root:path.join(install.installPath,'skills')});
 }
 return roots;
}

export async function toolsInventory({connections,projects,project=null,home=homedir()}){
 const diagnostics=[],result={};
 const projectRoot=project?.folderPath?await realpath(project.folderPath).catch(()=>null):null;
 for(const provider of providers){
  const skills=[],dot=provider==='codex'?'.codex':'.claude';
  await skillsIn(path.join(home,'.agents','skills'),{source:'user'},skills,diagnostics);
  await skillsIn(path.join(home,dot,'skills'),{source:'user'},skills,diagnostics);
  if(provider==='codex')await skillsIn(path.join(home,'.codex','skills','.system'),{source:'system'},skills,diagnostics);
  for(const {plugin,root} of provider==='codex'?await codexPlugins(home,diagnostics):await claudePlugins(home,project))await skillsIn(root,{source:'plugin',plugin},skills,diagnostics);
  if(projectRoot)for(const relative of ['.agents/skills',`${dot}/skills`])await skillsIn(path.join(projectRoot,relative),{source:'project',projectID:project.id},skills,diagnostics);
  // The same skill can sit in several roots; keep the first (user before plugin before project) and note the rest.
  const seen=new Map();for(const s of skills){const prior=seen.get(s.name);if(prior)(prior.alsoIn??=[]).push(s.source);else seen.set(s.name,s);}
  result[provider]={skills:[...seen.values()].map(({location,...s})=>s),mcp:[]};
 }
 const inventory=await connections.inventory(projects,project?{kind:'project',projectID:project.id}:{kind:'global'});
 for(const row of inventory.connections){
  if(row.managedID||!result[row.provider])continue; // Workbench-owned definitions are not part of the native setup.
  result[row.provider].mcp.push({name:row.name,source:row.source,sourcePath:row.sourcePath,transport:row.transport,enabled:row.configured!==false,shadowed:!!row.shadowed,inlineCredentials:!!row.inlineCredentials,environmentNames:row.environmentNames||[]});
 }
 for(const d of inventory.diagnostics||[])diagnostics.push(d.message||String(d));
 for(const provider of providers)for(const other of providers)if(other!==provider)for(const s of result[provider].skills)if(result[other].skills.some(o=>o.name===s.name))s.both=true;
 return {projectID:project?.id||null,...result,diagnostics:diagnostics.slice(0,50)};
}

// Install an MCP server into each chosen CLI's own user configuration with its own `mcp add` command (#20).
// The argv is built from validated fields and run without a shell; values of environment variables are only passed
// to the CLI, masked in the preview and output, and never stored by Workbench.
const NAME=/^[A-Za-z0-9_-]{1,64}$/,ENV=/^[A-Za-z_][A-Za-z0-9_]{0,127}$/;
const text=(value,label,max=2048)=>{if(typeof value!=='string'||!value.trim()||value.length>max||value.includes('\0'))throw new Problem(`${label} is required (up to ${max} characters).`,400);return value.trim();};
export function mcpInstallPlan(input){
 const fail=m=>{throw new Problem(m,400);};
 if(!input||typeof input!=='object')fail('Describe the MCP server.');
 const allowed=['providers','name','transport','command','args','env','url','bearerTokenEnv','confirm'];for(const k of Object.keys(input))if(!allowed.includes(k))fail(`Unknown field: ${k}.`);
 const chosen=[...new Set(input.providers||[])];if(!chosen.length||chosen.some(p=>!providers.includes(p)))fail('Choose Codex, Claude Code or both.');
 const name=text(input.name,'Server name',64);if(!NAME.test(name))fail('Use letters, numbers, - or _ for the server name.');
 const transport=input.transport;if(!['stdio','http'].includes(transport))fail('Choose a local command (stdio) or a URL (HTTP).');
 const env=Object.entries(input.env||{});if(env.length>30||env.some(([k,v])=>!ENV.test(k)||typeof v!=='string'||v.length>4096||v.includes('\0')))fail('Environment variables need NAME=value pairs (up to 30).');
 let command,args=[],url,bearer=null;
 if(transport==='stdio'){command=text(input.command,'Command');args=input.args??[];if(!Array.isArray(args)||args.length>50||args.some(a=>typeof a!=='string'||a.length>2048||a.includes('\0')))fail('Arguments must be up to 50 strings.');if(input.url||input.bearerTokenEnv)fail('A local command server has no URL or bearer token.');}
 else{url=text(input.url,'URL');let parsed;try{parsed=new URL(url);}catch{fail('Enter a full http(s) URL.');}if(!['https:','http:'].includes(parsed.protocol)||parsed.username||parsed.password)fail('Enter an http(s) URL without credentials in it.');if(input.bearerTokenEnv){bearer=text(input.bearerTokenEnv,'Bearer token variable',128);if(!ENV.test(bearer))fail('The bearer token variable must be an environment variable name.');}if(input.command||(input.args||[]).length||env.length)fail('An HTTP server has no command or environment values; use a bearer token variable.');}
 const envArgs=flag=>env.flatMap(([k,v])=>[flag,`${k}=${v}`]);
 const argv={codex:transport==='stdio'?['mcp','add',name,...envArgs('--env'),'--',command,...args]:['mcp','add',name,'--url',url,...(bearer?['--bearer-token-env-var',bearer]:[])],
  claude:transport==='stdio'?['mcp','add','-s','user',name,...envArgs('-e'),'--',command,...args]:['mcp','add','-s','user','-t','http',name,url,...(bearer?['-H',`Authorization: Bearer \${${bearer}}`]:[])]};
 const remove={codex:['mcp','remove',name],claude:['mcp','remove','-s','user',name]};
 const secrets=env.map(([,v])=>v).filter(v=>v.length>=3);
 const mask=value=>secrets.reduce((s,v)=>s.split(v).join('•••'),value);
 const shown=(cli,list)=>[cli,...list].map(a=>{const m=mask(a);return /^[\w@%+=:,./•-]+$/.test(m)?m:`'${m.replace(/'/g,`'\\''`)}'`;}).join(' ');
 return {name,providers:chosen,argv,mask,commands:chosen.map(p=>({provider:p,command:shown(p,argv[p]),file:p==='codex'?'~/.codex/config.toml':'~/.claude.json',remove:shown(p,remove[p])}))};
}
export async function installMcp(input,{binaries,run}){
 const plan=mcpInstallPlan(input);
 if(input.confirm!==true)throw new Problem('Confirm the commands before installing.',400);
 const results=[];
 for(const provider of plan.providers){
  try{const {stdout,stderr}=await run(binaries[provider],plan.argv[provider]);results.push({provider,ok:true,output:plan.mask(`${stdout||''}${stderr||''}`).slice(0,4000)});}
  catch(error){results.push({provider,ok:false,output:plan.mask(`${error.stdout||''}${error.stderr||''}`||error.message).slice(0,4000)});}
 }
 return {name:plan.name,results,commands:plan.commands};
}
