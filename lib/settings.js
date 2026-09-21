import {existsSync,readFileSync,writeFileSync,renameSync} from 'node:fs';
import {readdir,realpath,stat,readFile} from 'node:fs/promises';
import path from 'node:path';
import {assert} from './domain.js';

export class Settings {
 constructor(directory){
  this.file=path.join(directory,'settings.json');
  this.data=existsSync(this.file)?this.validate(JSON.parse(readFileSync(this.file,'utf8'))):{version:1,accents:{light:'#bf502f',dark:'#ed9777'},hiddenModels:[]};
 }
 validate(value){
  assert(value&&Number.isInteger(value.version),'Invalid settings.');
  for(const mode of ['light','dark'])assert(/^#[0-9a-f]{6}$/i.test(value.accents?.[mode]),'Choose valid accent colors.');
  assert(Array.isArray(value.hiddenModels)&&value.hiddenModels.length<=500&&value.hiddenModels.every(x=>typeof x==='string'&&x.length<200),'Invalid hidden models.');
  return {version:value.version,accents:{...value.accents},hiddenModels:[...new Set(value.hiddenModels)]};
 }
 save(value){
  const next=this.validate(value);assert(next.version===this.data.version,'Settings changed. Reopen settings before saving.',409);next.version++;
  writeFileSync(this.file+'.tmp',JSON.stringify(next,null,2),{mode:0o600});renameSync(this.file+'.tmp',this.file);this.data=next;return next;
 }
}

export async function instructionFiles(folder){
 if(!folder)return {files:[],note:'Connect a local folder to view instructions.'};
 const root=await realpath(folder),files=[];
 const candidates=['AGENTS.md','AGENTS.override.md','CLAUDE.md','SYSTEM.md','system.md','system-prompt.md','.claude/CLAUDE.md','.codex/AGENTS.md'];
 for(const dir of ['instructions','.claude/rules','.codex/rules']){
  try{const resolved=await realpath(path.join(root,dir));if(!resolved.startsWith(root+path.sep))continue;for(const item of await readdir(resolved,{withFileTypes:true}))if(item.isFile()&&item.name.endsWith('.md'))candidates.push(dir+'/'+item.name);}catch(e){if(e.code!=='ENOENT')throw e;}
 }
 for(const name of [...new Set(candidates)].slice(0,64)){
  try{
   const location=await realpath(path.join(root,name));
   if(!location.startsWith(root+path.sep))continue;
   const info=await stat(location);if(!info.isFile())continue;
   if(info.size>128*1024){files.push({name,error:'File exceeds the 128 KB preview limit.'});continue;}
   files.push({name,content:await readFile(location,'utf8')});
  }catch(e){if(e.code!=='ENOENT')files.push({name,error:'Could not read this file.'});}
 }
 return {files,note:'Project instruction files. CLI-specific and user-level instructions may also apply; listed files are not automatically injected by Workbench.'};
}
