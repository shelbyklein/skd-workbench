import {existsSync,readFileSync,writeFileSync,renameSync} from 'node:fs';
import {readdir,realpath,stat,readFile} from 'node:fs/promises';
import path from 'node:path';
import {assert} from './domain.js';
import {randomUUID} from 'node:crypto';

export class Settings {
 constructor(directory){
  this.file=path.join(directory,'settings.json');
  const original=existsSync(this.file)?readFileSync(this.file,'utf8'):null;
  this.data=original!==null?this.validate(JSON.parse(original)):{version:1,primaryColor:'#315b74',accents:{light:'#bf502f',dark:'#ed9777'},hiddenModels:[],projectTags:[]};
  if(original!==null&&(!Object.hasOwn(JSON.parse(original),'projectTags')||JSON.parse(original).projectTags.some(tag=>tag.color===undefined))){
   writeFileSync(this.file+'.before-project-tags.'+randomUUID()+'.backup.json',original,{flag:'wx',mode:0o600});
   this.persist(this.data);
  }
 }
 validate(value){
  assert(value&&Number.isInteger(value.version),'Invalid settings.');
  for(const mode of ['light','dark'])assert(/^#[0-9a-f]{6}$/i.test(value.accents?.[mode]),'Choose valid accent colors.');
  assert(Array.isArray(value.hiddenModels)&&value.hiddenModels.length<=500&&value.hiddenModels.every(x=>typeof x==='string'&&x.length<200),'Invalid hidden models.');
  const primaryColor=value.primaryColor===undefined?'#315b74':value.primaryColor;
  assert(typeof primaryColor==='string'&&/^#[0-9a-f]{6}$/i.test(primaryColor),'Choose a valid primary color.');
  const tags=value.projectTags===undefined?[]:value.projectTags;
  assert(Array.isArray(tags)&&tags.length<=100,'Use at most 100 project tags.');
  const ids=new Set(),names=new Set();
  const projectTags=tags.map(tag=>{
   assert(tag&&typeof tag.id==='string'&&/^[\w-]{1,100}$/.test(tag.id)&&!ids.has(tag.id),'Invalid or duplicate tag ID.');
   assert(typeof tag.name==='string'&&tag.name.trim().length>0&&tag.name.trim().length<=50,'Tag names must contain 1–50 characters.');
   const name=tag.name.trim(),key=name.toLowerCase();assert(!names.has(key),'Tag names must be unique.');ids.add(tag.id);names.add(key);
   assert(Array.isArray(tag.projectIDs)&&tag.projectIDs.length<=10000&&tag.projectIDs.every(id=>typeof id==='string'&&/^[\w-]{1,100}$/.test(id)&&id!=='unassigned'),'Invalid tagged projects.');
   const color=tag.color===undefined?'#bf502f':tag.color;assert(typeof color==='string'&&/^#[0-9a-f]{6}$/i.test(color),'Choose a valid tag color.');
   return {id:tag.id,name,color,projectIDs:[...new Set(tag.projectIDs)]};
  });
  return {projectTags,primaryColor,version:value.version,accents:{...value.accents},hiddenModels:[...new Set(value.hiddenModels)]};
 }
 save(value,projects){
  const next=this.validate({...value,primaryColor:value.primaryColor===undefined?this.data.primaryColor:value.primaryColor,projectTags:value.projectTags===undefined?this.data.projectTags:Array.isArray(value.projectTags)?value.projectTags.map(tag=>tag&&tag.color===undefined?{...tag,color:this.data.projectTags.find(t=>t.id===tag.id)?.color}:tag):value.projectTags});
  if(projects)assert(next.projectTags.every(tag=>tag.projectIDs.every(id=>projects.some(p=>p.id===id))),'A tagged project no longer exists. Reopen settings.');assert(next.version===this.data.version,'Settings changed. Reopen settings before saving.',409);next.version++;
  this.persist(next);this.data=next;return next;
 }
 persist(value){writeFileSync(this.file+'.tmp',JSON.stringify(value,null,2),{mode:0o600});renameSync(this.file+'.tmp',this.file);}
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
