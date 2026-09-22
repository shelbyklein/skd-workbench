import {readdir,realpath,stat,readFile} from 'node:fs/promises';
import path from 'node:path';
import matter from 'gray-matter';
import {assert,Problem} from './domain.js';
import {canonicalFolder,inspectFolder} from './projects.js';
import {readGit} from './git-read.js';

const MAX_GRAPH_BYTES=32*1024*1024;
const MAX_CONTEXT_BYTES=8*1024*1024;
const MAX_CONTEXT_FILE_BYTES=256*1024;
const MAX_CONTEXT_FILES=500;
const MAX_NODES=50_000;
const MAX_EDGES=250_000;
const MAX_RESULT_NODES=1_000;
const MAX_TEXT=4_096;
const CONTEXT_SUMMARY_MAX=500;
const NORMALIZE_RELATION={influences:'configures',supports:'validates',defines:'validates',measures:'validates'};

const within=(root,target)=>{const relative=path.relative(root,target);return relative===''||(!relative.startsWith('..'+path.sep)&&!path.isAbsolute(relative));};
const text=(value,label,{nullable=false,max=MAX_TEXT}={})=>{
 if(nullable&&(value===null||value===undefined))return null;
 assert(typeof value==='string'&&value.length>0&&value.length<=max,`Graft ${label} is invalid. Rebuild the index.`,422);
 return value;
};
const optionalText=(value,label,max=MAX_TEXT)=>value===null||value===undefined||value===''?'':text(value,label,{max});
const stringList=(value,max=100)=>Array.isArray(value)?value.slice(0,max).filter(item=>typeof item==='string').map(item=>item.slice(0,MAX_TEXT)):[];
const contextSummary=body=>{
 let value=body,start=value.indexOf('<!-- context:generated:start -->'),end=value.indexOf('<!-- context:generated:end -->');
 if(start>=0&&end>start)value=value.slice(start+'<!-- context:generated:start -->'.length,end);
 const related=value.indexOf('## Related');if(related>=0)value=value.slice(0,related);
 value=value.replace(/^##\s+Summary\s*$/m,'').trim();return value.length>CONTEXT_SUMMARY_MAX?value.slice(0,CONTEXT_SUMMARY_MAX).trimEnd()+'…':value;
};

async function discoverIndex(project){
 if(!project.folderPath)return {available:false,message:'Connect a local project folder to browse its Graft index.'};
 const folder=await canonicalFolder(project.folderPath);
 const connection=await inspectFolder(folder);
 const repository=connection.git?.status==='connected'&&connection.git.root?await realpath(connection.git.root):folder;
 assert(within(repository,folder),'The project folder is outside its reported repository root.',422);
 const roots=[folder,...(repository!==folder?[repository]:[])];
 for(const candidateRoot of roots){
  const candidate=path.join(candidateRoot,'graft');
  let graftDir;
  try{graftDir=await realpath(candidate);}catch(error){if(error.code!=='ENOENT')throw error;}
  if(graftDir){
   assert(within(repository,graftDir),'The Graft index resolves outside the project repository.',422);
   const entries=await readdir(graftDir,{withFileTypes:true});
   const hasGraph=entries.some(entry=>entry.name==='.graph'&&entry.isDirectory());
   const hasContext=entries.some(entry=>entry.isFile()&&entry.name.endsWith('.md'));
   if(hasGraph||hasContext)return {available:true,folder,repository,graftDir,indexRoot:candidateRoot,indexScope:candidateRoot===folder?'project':'repository'};
  }
  const configured=await configuredIndex(candidateRoot,repository);
  if(configured)return {available:true,folder,repository,...configured};
 }
 return {available:false,message:'No Graft index found. Run Graft for this project, then return here.'};
}

// A development checkout can select a generation through a bounded config file.
// Follow at most one explicit same-repository worktree reference, then reread that
// checkout's own pointer so an old source-checkout config cannot pin an old index.
async function readIndexConfig(root){
 const file=path.join(root,'.graft-dev','config.json');
 let resolved;
 try{resolved=await realpath(file);}catch(error){if(error.code==='ENOENT')return null;throw error;}
 assert(within(root,resolved),'The Graft configuration resolves outside its checkout.',422);
 const info=await stat(resolved);
 assert(info.isFile()&&info.size<=64*1024,'The Graft configuration is too large to read safely.',422);
 let config;
 try{config=JSON.parse(await readFile(resolved,'utf8'));}catch{throw new Problem('The Graft configuration is unreadable.',422);}
 assert(config&&typeof config.root==='string'&&path.isAbsolute(config.root)&&typeof config.graph==='string'&&path.isAbsolute(config.graph),'The Graft configuration needs absolute root and graph paths.',422);
 return config;
}

async function configuredIndex(candidateRoot,repository){
 let config=await readIndexConfig(candidateRoot);
 if(!config)return null;
 const indexRoot=await canonicalFolder(config.root);
 if(indexRoot!==candidateRoot){
  // Do not redirect a subfolder project or accept an unrelated repository.
  assert(candidateRoot===repository,'The Graft configuration root does not match the project checkout.',422);
  const [sourceCommon,targetCommon,targetRoot]=await Promise.all([
   readGit(repository,['rev-parse','--path-format=absolute','--git-common-dir']),
   readGit(indexRoot,['rev-parse','--path-format=absolute','--git-common-dir']),
   readGit(indexRoot,['rev-parse','--show-toplevel'])
  ]);
  assert(sourceCommon.ok&&targetCommon.ok&&targetRoot.ok&&await realpath(sourceCommon.value)===await realpath(targetCommon.value)&&await realpath(targetRoot.value)===indexRoot,'The Graft configuration points outside the project Git repository.',422);
  config=await readIndexConfig(indexRoot);
  assert(config&&await canonicalFolder(config.root)===indexRoot,'The Graft worktree configuration is missing or has a mismatched root.',422);
 }
 const graftDir=await realpath(config.graph);
 const cacheRoot=path.join(indexRoot,'.graft-dev');
 assert(within(cacheRoot,graftDir)&&graftDir!==cacheRoot,'The Graft generation resolves outside its checkout cache.',422);
 assert((await stat(graftDir)).isDirectory(),'The Graft generation is not a directory.',422);
 return {graftDir,indexRoot,indexScope:indexRoot===candidateRoot?'project':'worktree'};
}

async function readCodeGraph(index){
 const file=path.join(index.graftDir,'.graph','wiring.json');
 let info,resolved;
 try{resolved=await realpath(file);info=await stat(resolved);}catch{return {meta:{nodeCount:0,edgeCount:0,droppedEdges:0},nodes:[],edges:[],present:false};}
 assert(within(index.graftDir,resolved),'The Graft wiring graph resolves outside the project index.',422);
 assert(info.isFile()&&info.size<=MAX_GRAPH_BYTES,'The Graft wiring graph is too large to open safely.',422);
 let parsed;
 try{parsed=JSON.parse(await readFile(resolved,'utf8'));}catch{throw new Problem('The Graft wiring graph is unreadable. Rebuild the index.',422);}
 assert(parsed?.meta?.version===1,'This Graft wiring graph version is not supported. Rebuild the index.',422);
 assert(Array.isArray(parsed.nodes)&&parsed.nodes.length<=MAX_NODES,'The Graft wiring graph has too many nodes.',422);
 assert(Array.isArray(parsed.edges)&&parsed.edges.length<=MAX_EDGES,'The Graft wiring graph has too many relations.',422);
 const ids=new Set();
 const nodes=parsed.nodes.map(node=>{
  assert(node&&typeof node==='object'&&!Array.isArray(node),'The Graft wiring graph contains an invalid node.',422);
  const id=text(node.id,'node id');assert(!ids.has(id),'The Graft wiring graph contains duplicate node ids.',422);ids.add(id);
  const pathValue=text(node.path,'node path');
  return {id,name:text(node.name,'node name'),type:text(node.kind,'node kind',{max:100}),summary:optionalText(node.summary,'node summary'),sources:[`${pathValue} · ${text(node.span,'node span',{max:100})}`],path:pathValue,span:node.span,signature:optionalText(node.signature,'node signature'),exported:Boolean(node.exported),origin:optionalText(node.origin,'node origin',100)};
 });
 let droppedEdges=0;
 const edges=[];
 for(const edge of parsed.edges){
  assert(edge&&typeof edge==='object'&&!Array.isArray(edge),'The Graft wiring graph contains an invalid relation.',422);
  const source=text(edge.source,'relation source'),target=text(edge.target,'relation target');
  if(!ids.has(source)||!ids.has(target)){droppedEdges++;continue;}
  edges.push({source,target,relation:text(edge.relation,'relation type',{max:100}),confidence:optionalText(edge.confidence,'relation confidence',100)});
 }
 return {present:true,nodes,edges,meta:{version:1,nodeCount:nodes.length,edgeCount:edges.length,droppedEdges,languages:stringList(parsed.meta.languages,50),scopes:Array.isArray(parsed.meta.scopes)?parsed.meta.scopes.slice(0,100):[],updatedAt:info.mtime.toISOString()}};
}

async function readContextGraph(index){
 const entries=(await readdir(index.graftDir,{withFileTypes:true})).filter(entry=>entry.isFile()&&entry.name.endsWith('.md')).sort((a,b)=>a.name.localeCompare(b.name));
 assert(entries.length<=MAX_CONTEXT_FILES,'The Graft context graph has too many node files.',422);
 let bytes=0;
 for(const entry of entries){const info=await stat(path.join(index.graftDir,entry.name));assert(info.size<=MAX_CONTEXT_FILE_BYTES,'A Graft context node is too large to open safely.',422);bytes+=info.size;}
 assert(bytes<=MAX_CONTEXT_BYTES,'The Graft context graph is too large to open safely.',422);
 const nodes=[],rawEdges=[];let skippedFiles=0;
 for(const entry of entries){
  let parsed;try{parsed=matter(await readFile(path.join(index.graftDir,entry.name),'utf8'));}catch{skippedFiles++;continue;}
  const frontmatter=parsed.data||{},id=text(String(frontmatter.slug??entry.name.replace(/\.md$/,'')),'context node id');
  nodes.push({id,name:text(String(frontmatter.name??id),'context node name'),type:text(String(frontmatter.type??'concept'),'context node type',{max:100}),summary:contextSummary(parsed.content),sources:Array.isArray(frontmatter.sources)?stringList(frontmatter.sources.map(source=>source?.path),100):[],path:'',span:'',signature:'',exported:false,origin:'context'});
  for(const link of Array.isArray(frontmatter.links)?frontmatter.links:[]){if(!link||typeof link.to!=='string')continue;const raw=String(link.relation??'uses');rawEdges.push({source:id,target:link.to,relation:NORMALIZE_RELATION[raw]??raw,confidence:'',description:typeof link.description==='string'?link.description:''});}
 }
 const ids=new Set();for(const node of nodes){assert(!ids.has(node.id),'The Graft context graph contains duplicate node ids.',422);ids.add(node.id);}
 const edges=[];let droppedEdges=0;
 for(const edge of rawEdges){const source=text(edge.source,'context relation source'),target=text(edge.target,'context relation target');if(!ids.has(source)||!ids.has(target)){droppedEdges++;continue;}edges.push({source,target,relation:text(edge.relation,'context relation type',{max:100}),confidence:'',description:optionalText(edge.description,'context relation description')});}
 return {nodes,edges,meta:{nodeCount:nodes.length,edgeCount:edges.length,skippedFiles,droppedEdges}};
}

const values=value=>new Set(String(value||'').split(',').map(item=>item.trim().toLowerCase()).filter(Boolean).slice(0,30));
const includes=(node,query)=>!query||[node.name,node.id,node.path,node.signature,node.summary,...node.sources].some(value=>String(value||'').toLowerCase().includes(query));

function selectGraph(graph,{tab='code',query='',focus='',kind='',relation='',limit}={}){
 query=String(query||'').trim().toLowerCase().slice(0,200);focus=String(focus||'').slice(0,MAX_TEXT);
 const kinds=values(kind),relations=values(relation);
 const max=Math.min(MAX_RESULT_NODES,Math.max(1,Number(limit)|| (tab==='outline'?MAX_RESULT_NODES:180)));
 const nodeByID=new Map(graph.nodes.map(node=>[node.id,node]));
 const allowedEdges=graph.edges.filter(edge=>!relations.size||relations.has(edge.relation.toLowerCase()));
 const degree=new Map(graph.nodes.map(node=>[node.id,0]));
 for(const edge of allowedEdges){degree.set(edge.source,(degree.get(edge.source)||0)+1);degree.set(edge.target,(degree.get(edge.target)||0)+1);}
 const candidates=graph.nodes.filter(node=>(!kinds.size||kinds.has(node.type.toLowerCase()))&&includes(node,query));
 const selected=new Set();
 const add=id=>{if(selected.size<max&&nodeByID.has(id))selected.add(id);};
 if(focus&&nodeByID.has(focus)){
  add(focus);
  const neighborhood=allowedEdges.filter(edge=>edge.source===focus||edge.target===focus).sort((a,b)=>(degree.get((b.source===focus?b.target:b.source))||0)-(degree.get((a.source===focus?a.target:a.source))||0));
  for(const edge of neighborhood){const id=edge.source===focus?edge.target:edge.source,node=nodeByID.get(id);if(node&&(!kinds.size||kinds.has(node.type.toLowerCase()))&&includes(node,query))add(id);}
 }else if(tab==='outline'){
  for(const node of candidates.sort((a,b)=>a.path.localeCompare(b.path)||a.span.localeCompare(b.span)||a.name.localeCompare(b.name)))add(node.id);
 }else if(query||kinds.size){
  for(const node of candidates.sort((a,b)=>(degree.get(b.id)||0)-(degree.get(a.id)||0)||a.name.localeCompare(b.name)))add(node.id);
  if(selected.size<max)for(const edge of allowedEdges){if(selected.has(edge.source))add(edge.target);if(selected.has(edge.target))add(edge.source);}
 }else if(tab==='code'){
  const ranked=graph.nodes.filter(node=>node.type==='file').sort((a,b)=>(degree.get(b.id)||0)-(degree.get(a.id)||0)||a.name.localeCompare(b.name));
  for(const node of ranked)add(node.id);
  if(selected.size<max)for(const node of graph.nodes.filter(node=>node.type!=='file').sort((a,b)=>(degree.get(b.id)||0)-(degree.get(a.id)||0)) )add(node.id);
 }else{
  for(const node of graph.nodes.sort((a,b)=>(degree.get(b.id)||0)-(degree.get(a.id)||0)||a.name.localeCompare(b.name)))add(node.id);
 }
 const nodes=[...selected].map(id=>nodeByID.get(id));
 const edges=allowedEdges.filter(edge=>selected.has(edge.source)&&selected.has(edge.target));
 return {nodes,edges,focus:selected.has(focus)?focus:null,truncated:candidates.length>nodes.length||graph.nodes.length>nodes.length,facets:{kinds:[...new Set(graph.nodes.map(node=>node.type))].sort(),relations:[...new Set(graph.edges.map(edge=>edge.relation))].sort()}};
}

export async function projectGraft(project,options={}){
 const index=await discoverIndex(project);
 if(!index.available)return {projectID:project.id,available:false,message:index.message,totals:{codeNodes:0,codeEdges:0,contextNodes:0,contextEdges:0}};
 const [code,context]=await Promise.all([readCodeGraph(index),readContextGraph(index)]);
 const totals={codeNodes:code.nodes.length,codeEdges:code.edges.length,contextNodes:context.nodes.length,contextEdges:context.edges.length};
 const hasDeepContext=context.edges.length>0||context.nodes.some(node=>node.type!=='concept'||node.sources.length>0);
 const common={projectID:project.id,available:code.present||context.nodes.length>0,indexScope:index.indexScope,indexRoot:index.indexRoot,indexName:'graft',totals,diagnostics:{codeDroppedEdges:code.meta.droppedEdges||0,contextDroppedEdges:context.meta.droppedEdges||0,contextSkippedFiles:context.meta.skippedFiles||0},defaultTab:hasDeepContext||code.nodes.length===0?'context':'code'};
 if(options.view==='summary')return {...common,message:common.available?'Graft index connected.':'The Graft folder does not contain a readable graph.'};
 const tab=['context','code','outline'].includes(options.tab)?options.tab:common.defaultTab;
 const source=tab==='context'?context:code;
 return {...common,tab,...selectGraph(source,{...options,tab}),meta:source.meta};
}

export const GRAFT_LIMITS={MAX_GRAPH_BYTES,MAX_CONTEXT_BYTES,MAX_CONTEXT_FILE_BYTES,MAX_CONTEXT_FILES,MAX_NODES,MAX_EDGES,MAX_RESULT_NODES};
