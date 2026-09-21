import {createHash,randomUUID} from 'node:crypto';
import {existsSync,mkdirSync,readFileSync,renameSync,writeFileSync} from 'node:fs';
import {readdir,readFile,realpath,stat} from 'node:fs/promises';
import {homedir} from 'node:os';
import path from 'node:path';
import matter from 'gray-matter';
import {assert,Problem} from './domain.js';

const ENTRY_LIMIT=500,BODY_LIMIT=16*1024,DELIVERY_LIMIT=32*1024;
const providers=['codex','claude'];
const stamp=()=>new Date().toISOString();
const clone=value=>structuredClone(value);
const bytes=value=>Buffer.byteLength(value,'utf8');
const inside=(root,target)=>target===root||target.startsWith(root+path.sep);
const opaque=(provider,source,location)=>createHash('sha256').update(`${provider}\0${source}\0${location}`).digest('hex');
const text=(value,label,max,required=true)=>{assert(typeof value==='string'&&bytes(value)<=max&&(!required||value.trim()),`${label} is required and must be at most ${max.toLocaleString()} bytes.`);return value.trim();};
const scopeKey=scope=>scope.kind==='global'?'global':`project:${scope.projectID}`;

function validateScope(scope,projects){
 assert(scope&&['global','project'].includes(scope.kind),'Choose global or project scope.');
 if(scope.kind==='project')assert(projects.some(project=>project.id===scope.projectID&&project.id!=='unassigned'),'Project not found.',404);
 return scope.kind==='global'?{kind:'global'}:{kind:'project',projectID:scope.projectID};
}

function supportWarning(body){
 const matches=[...body.matchAll(/(?:\]\(|(?:^|\s)@)(?!https?:|#|\/)([^)\s]+\.[A-Za-z0-9]{1,8})/gm)].map(match=>match[1]);
 return matches.length?`This text references supporting files that are not copied: ${[...new Set(matches)].slice(0,5).join(', ')}`:null;
}

function validateStore(value){
 assert(value&&value.schema===1&&Number.isInteger(value.revision)&&value.revision>=0&&Array.isArray(value.entries)&&Array.isArray(value.policies),'Damaged skills library. Restore skills.json from backup.');
 const ids=new Set();
 for(const entry of value.entries){
  assert(entry&&typeof entry.id==='string'&&!ids.has(entry.id)&&Number.isInteger(entry.version)&&entry.version>0,'Damaged skills library entry.');ids.add(entry.id);
  assert(['global','project'].includes(entry.scope)&&typeof entry.name==='string'&&typeof entry.instructions==='string'&&bytes(entry.instructions)<=BODY_LIMIT,'Damaged skills library entry.');
  if(entry.scope==='project')assert(typeof entry.projectID==='string'&&entry.projectID,'Damaged project skill scope.');
  assert(Array.isArray(entry.history),'Damaged skill history.');
 }
 for(const policy of value.policies){
  assert(policy&&typeof policy.projectID==='string'&&providers.includes(policy.provider)&&['inherit','replace'].includes(policy.mode)&&Array.isArray(policy.skillIDs)&&Array.isArray(policy.excludedIDs)&&Number.isInteger(policy.revision),'Damaged skill assignment policy.');
 }
 return value;
}

async function recognizedRoots(projects,scope,home){
 const roots=[];
 for(const [provider,relative] of [['universal','.agents/skills'],['codex','.codex/skills'],['claude','.claude/skills']])roots.push({provider,source:'user',projectID:null,path:path.join(home,relative)});
 const selected=scope.kind==='project'?projects.filter(project=>project.id===scope.projectID):projects.filter(project=>project.id!=='unassigned');
 for(const project of selected){
  if(!project.folderPath)continue;
  let root;try{root=await realpath(project.folderPath);}catch{continue;}
  for(const [provider,relative] of [['universal','.agents/skills'],['codex','.codex/skills'],['claude','.claude/skills']])roots.push({provider,source:'project',projectID:project.id,path:path.join(root,relative),projectRoot:root});
 }
 return roots;
}

async function discover(projects,scope,home){
 const roots=await recognizedRoots(projects,scope,home),allowed=[],canonicalHome=await realpath(home).catch(()=>home);
 for(const root of roots){try{allowed.push({...root,canonical:await realpath(root.path)});}catch(error){if(error.code!=='ENOENT')allowed.push({...root,error:'Could not read this skill root.'});}}
 const rows=[],diagnostics=[];
 for(const root of allowed){
  if(rows.length>=ENTRY_LIMIT)break;
  if(root.error){diagnostics.push({source:root.source,provider:root.provider,projectID:root.projectID,message:root.error});continue;}
  let items;try{items=await readdir(root.canonical,{withFileTypes:true});}catch{diagnostics.push({source:root.source,provider:root.provider,projectID:root.projectID,message:'Could not list this skill root.'});continue;}
  for(const item of items.sort((a,b)=>a.name.localeCompare(b.name)).slice(0,ENTRY_LIMIT-rows.length)){
   if(!item.isDirectory()&&!item.isSymbolicLink())continue;
   const candidate=path.join(root.canonical,item.name,'SKILL.md');let location;
   try{location=await realpath(candidate);}catch(error){if(error.code!=='ENOENT')diagnostics.push({source:root.source,provider:root.provider,projectID:root.projectID,message:`Could not inspect ${item.name}.`});continue;}
   const allowedTarget=allowed.some(other=>other.canonical&&inside(other.canonical,location))||(root.projectRoot&&inside(root.projectRoot,location));
   if(!allowedTarget){rows.push({id:opaque(root.provider,root.source,location),name:item.name,provider:root.provider,source:root.source,projectID:root.projectID,status:'unavailable',message:'The skill link resolves outside recognized skill roots.'});continue;}
   try{
    const info=await stat(location);if(!info.isFile())continue;
    if(info.size>BODY_LIMIT){rows.push({id:opaque(root.provider,root.source,location),name:item.name,provider:root.provider,source:root.source,projectID:root.projectID,status:'unavailable',message:'SKILL.md exceeds the 16 KB preview limit.'});continue;}
    const raw=await readFile(location,'utf8'),parsed=matter(raw),name=typeof parsed.data.name==='string'?parsed.data.name.trim():item.name,description=typeof parsed.data.description==='string'?parsed.data.description.trim():'';
    rows.push({id:opaque(root.provider,root.source,location),name:name.slice(0,100),description:description.slice(0,1000),provider:root.provider,source:root.source,projectID:root.projectID,status:'available',relativePath:path.relative(root.source==='project'?root.projectRoot:canonicalHome,location),body:raw,warning:supportWarning(raw)});
   }catch{rows.push({id:opaque(root.provider,root.source,location),name:item.name,provider:root.provider,source:root.source,projectID:root.projectID,status:'unavailable',message:'Could not read or parse SKILL.md.'});}
  }
 }
 if(rows.length>=ENTRY_LIMIT)diagnostics.push({message:`Inventory stopped at ${ENTRY_LIMIT} entries.`});
 return {entries:rows,diagnostics};
}

export class Skills {
 constructor(directory,{home=homedir()}={}){
  mkdirSync(directory,{recursive:true});this.file=path.join(directory,'skills.json');this.home=home;
  this.data=existsSync(this.file)?validateStore(JSON.parse(readFileSync(this.file,'utf8'))):{schema:1,revision:0,entries:[],policies:[]};
  if(!existsSync(this.file))this.persist();
 }
 persist(){writeFileSync(this.file+'.tmp',JSON.stringify(this.data,null,2),{mode:0o600});renameSync(this.file+'.tmp',this.file);}
 change(expectedRevision,fn){assert(expectedRevision===this.data.revision,'Skills changed in another tab. Reload before saving.',409);const draft=clone(this.data),result=fn(draft);draft.revision++;validateStore(draft);writeFileSync(this.file+'.tmp',JSON.stringify(draft,null,2),{mode:0o600});renameSync(this.file+'.tmp',this.file);this.data=draft;return clone(result);}
 async inventory(projects,requestedScope){const scope=validateScope(requestedScope,projects),native=await discover(projects,scope,this.home);return {scope,revision:this.data.revision,managed:this.visibleManaged(scope),policies:this.visiblePolicies(scope),discovered:native.entries,diagnostics:native.diagnostics,limits:{entryBytes:BODY_LIMIT,deliveryBytes:DELIVERY_LIMIT}};}
 visibleManaged(scope){return clone(this.data.entries.filter(entry=>scope.kind==='global'||entry.scope==='global'||entry.projectID===scope.projectID));}
 visiblePolicies(scope){return clone(this.data.policies.filter(policy=>scope.kind==='global'||policy.projectID===scope.projectID));}
 create(input,projects){const scope=validateScope(input.scope,projects),name=text(input.name,'Skill name',100),description=text(input.description||'','Description',1000,false),instructions=text(input.instructions,'Instructions',BODY_LIMIT);return this.change(input.revision,draft=>{const at=stamp(),entry={id:randomUUID(),version:1,scope:scope.kind,...(scope.kind==='project'?{projectID:scope.projectID}:{}),name,description,instructions,source:{kind:input.source?.kind==='import'?'import':'managed',label:text(input.source?.label||'Created in Workbench','Source label',300)},warning:supportWarning(instructions),archived:false,createdAt:at,updatedAt:at,history:[]};draft.entries.push(entry);return entry;});}
 async import(input,projects){const scope=validateScope(input.scope,projects),inventory=await discover(projects,scope,this.home),source=inventory.entries.find(entry=>entry.id===input.discoveredID&&entry.status==='available');assert(source,'Discovered skill changed or is no longer available. Refresh and try again.',409);return this.create({revision:input.revision,scope,name:source.name,description:source.description,instructions:source.body,source:{kind:'import',label:`Copied from ${source.relativePath}`}},projects);}
 update(id,input,projects){const scope=validateScope(input.scope,projects),name=text(input.name,'Skill name',100),description=text(input.description||'','Description',1000,false),instructions=text(input.instructions,'Instructions',BODY_LIMIT);return this.change(input.revision,draft=>{const entry=draft.entries.find(entry=>entry.id===id);assert(entry,'Skill not found.',404);entry.history.push({version:entry.version,name:entry.name,description:entry.description,instructions:entry.instructions,scope:entry.scope,projectID:entry.projectID||null,updatedAt:entry.updatedAt});entry.history=entry.history.slice(-50);entry.version++;entry.scope=scope.kind;if(scope.kind==='project')entry.projectID=scope.projectID;else delete entry.projectID;entry.name=name;entry.description=description;entry.instructions=instructions;entry.warning=supportWarning(instructions);entry.updatedAt=stamp();return entry;});}
 archive(id,input){return this.change(input.revision,draft=>{const entry=draft.entries.find(entry=>entry.id===id);assert(entry,'Skill not found.',404);entry.archived=Boolean(input.archived);entry.version++;entry.updatedAt=stamp();return entry;});}
 savePolicy(input,projects){assert(projects.some(project=>project.id===input.projectID&&project.id!=='unassigned'),'Project not found.',404);assert(providers.includes(input.provider),'Choose Codex or Claude.');assert(['inherit','replace'].includes(input.mode),'Choose inherit or replace.');assert(Array.isArray(input.skillIDs)&&Array.isArray(input.excludedIDs)&&input.skillIDs.length<=100&&input.excludedIDs.length<=100,'Choose up to 100 skills.');const skillIDs=[...new Set(input.skillIDs)],excludedIDs=[...new Set(input.excludedIDs)];return this.change(input.revision,draft=>{const usable=id=>{const entry=draft.entries.find(entry=>entry.id===id);return entry&&!entry.archived&&(entry.scope==='global'||entry.projectID===input.projectID);};assert(skillIDs.every(usable)&&excludedIDs.every(usable),'A selected skill is missing, archived, or belongs to another project.',409);let policy=draft.policies.find(policy=>policy.projectID===input.projectID&&policy.provider===input.provider);if(!policy){policy={projectID:input.projectID,provider:input.provider,mode:'inherit',skillIDs:[],excludedIDs:[],revision:0};draft.policies.push(policy);}assert(input.policyRevision===policy.revision,'Skill assignments changed in another tab. Reload before saving.',409);Object.assign(policy,{mode:input.mode,skillIDs,excludedIDs,revision:policy.revision+1,updatedAt:stamp()});return policy;});}
 resolve(project,provider,selection={mode:'inherit',skillIDs:[]},{purpose='session'}={}){
  assert(project&&project.id&&providers.includes(provider),'Invalid skill launch context.');
  if(purpose==='issue-proposal')return {status:'excluded',reason:'Issue edit proposals do not receive managed skills.',policyRevision:this.data.revision,entries:[],text:''};
  assert(selection&&['inherit','replace'].includes(selection.mode)&&Array.isArray(selection.skillIDs),'Invalid skill selection.');
  const policy=this.data.policies.find(item=>item.projectID===project.id&&item.provider===provider)||{mode:'inherit',skillIDs:[],excludedIDs:[],revision:0};
  const ids=selection.mode==='replace'?selection.skillIDs:policy.skillIDs,excluded=new Set(policy.excludedIDs),entries=[];
  for(const id of [...new Set(ids)]){const entry=this.data.entries.find(item=>item.id===id);assert(entry&&!entry.archived,`Selected skill ${id} is unavailable. Refresh assignments before launching.`,409);assert(entry.scope==='global'||entry.projectID===project.id,'A selected skill belongs to another project.',403);if(!excluded.has(id))entries.push(entry);}
  const body=entries.map(entry=>`### ${entry.name} (v${entry.version})\n${entry.instructions}`).join('\n\n'),section=body?`SKD WORKBENCH MANAGED SKILLS\nThese instructions do not grant tools, accounts, or permission to exceed the user's task.\n\n${body}`:'';
  assert(bytes(section)<=DELIVERY_LIMIT,'Assigned skills exceed the 32 KB launch limit. Remove one or more skills before starting.',413);
  return {status:section?'included':'empty',policyRevision:this.data.revision,assignmentRevision:policy.revision,selection:{mode:selection.mode,skillIDs:[...new Set(ids)],excludedIDs:[...excluded]},entries:entries.map(entry=>({id:entry.id,version:entry.version,name:entry.name,scope:entry.scope,projectID:entry.projectID||null,instructions:entry.instructions})),text:section};
 }
 validateSnapshot(project,provider,snapshot){
  assert(snapshot&&Array.isArray(snapshot.entries)&&typeof snapshot.text==='string','Saved skill snapshot is damaged. Stop and start a new run.');
  const policy=this.data.policies.find(item=>item.projectID===project.id&&item.provider===provider),excluded=new Set(policy?.excludedIDs||[]);
  for(const frozen of snapshot.entries){const current=this.data.entries.find(entry=>entry.id===frozen.id);assert(current&&!current.archived&&(current.scope==='global'||current.projectID===project.id)&&!excluded.has(frozen.id),`Skill ${frozen.name||frozen.id} was revoked after this workflow started. Restore its eligibility or start a new workflow.`,409);}
  assert(bytes(snapshot.text)<=DELIVERY_LIMIT,'Saved skill snapshot exceeds the 32 KB launch limit.');return clone(snapshot);
 }
}

export const skillLimits={ENTRY_LIMIT,BODY_LIMIT,DELIVERY_LIMIT};
