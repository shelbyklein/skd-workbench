import {stat,realpath} from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {canonicalFolder,safeRemote} from './projects.js';
import {readGit} from './git-read.js';
import {assert} from './domain.js';

const oid=value=>/^[a-f0-9]{40,64}$/.test(value||'')&&!/^0+$/.test(value);
export const fingerprint=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
const label=ref=>ref?.replace(/^refs\/(heads|remotes)\//,'')||null;
const unknown=reason=>({state:'unknown',ahead:null,behind:null,reason});
async function mapLimit(values,fn){
  const out=new Array(values.length);let next=0;
  await Promise.all(Array.from({length:Math.min(4,values.length)},async()=>{while(next<values.length){const i=next++;out[i]=await fn(values[i]);}}));
  return out;
}
export async function compareCommits(run,folder,head,target,shallow=false){
  if(!oid(head)||!oid(target))return unknown('Commit unavailable');
  if(head===target)return {state:'equal',ahead:0,behind:0};
  if(shallow)return unknown('History is shallow or unavailable');
  const base=await run(folder,['merge-base',head,target]);
  if(!base.ok)return base.exitCode===1?{state:'unrelated',ahead:null,behind:null}:unknown('History unavailable');
  const counts=await run(folder,['rev-list','--left-right','--count',`${head}...${target}`]);
  if(!counts.ok||!/^\d+\s+\d+$/.test(counts.value))return unknown('Comparison unavailable');
  const [ahead,behind]=counts.value.split(/\s+/).map(Number);
  return {state:ahead?(behind?'diverged':'ahead'):'contained',ahead,behind};
}
function parseStatus(raw){
  const changes={staged:0,unstaged:0,untracked:0,conflicts:0};let branch=null,commit=null;
  const records=raw.split('\0');
  for(let i=0;i<records.length;i++){
    const line=records[i];
    if(line.startsWith('# branch.head '))branch=line.slice(14)==='(detached)'?null:line.slice(14);
    else if(line.startsWith('# branch.oid '))commit=oid(line.slice(13))?line.slice(13):null;
    else if(line.startsWith('? '))changes.untracked++;
    else if(line.startsWith('u '))changes.conflicts++;
    else if(/^[12] /.test(line)){
      const xy=line.split(' ')[1];if(xy[0]!=='.')changes.staged++;if(xy[1]!=='.')changes.unstaged++;
      if(line[0]==='2')i++; // rename's original path is a separate NUL record
    }
  }
  return {branch,commit,detached:!branch&&Boolean(commit),changes,dirty:Object.values(changes).some(Boolean)};
}
function parseWorktrees(raw){
  const rows=[];let row=null;
  for(const field of raw.split('\0')){
    if(field.startsWith('worktree ')){row={path:field.slice(9),branch:null,commit:null,detached:false,bare:false,locked:false,prunable:false};rows.push(row);}
    else if(row){
      if(field.startsWith('HEAD '))row.commit=oid(field.slice(5))?field.slice(5):null;
      if(field.startsWith('branch '))row.branch=label(field.slice(7));
      if(field==='detached')row.detached=true;
      if(field==='bare')row.bare=true;
      if(field==='locked'||field.startsWith('locked '))row.locked=true;
      if(field==='prunable'||field.startsWith('prunable '))row.prunable=true;
    }
  }
  return rows;
}
const statusArgs=['status','--porcelain=v2','--branch','-z','--untracked-files=all','--ignore-submodules=none'];
const refsArgs=['for-each-ref','--count=401','--format=%(refname)%00%(objectname)%00%(upstream)%00%(symref)','refs/heads','refs/remotes'];

// Shared read-only inventory foundation for the overview and future Worktrees page.
export async function inspectRepository(folder,{targetRef='',remoteName='',run=readGit,limit=100,worktreeLimit=30}={}){
  const started=Date.now(),deadline=started+20000;
  const git=(cwd,args,options={})=>Date.now()>=deadline?Promise.resolve({ok:false}):run(cwd,args,{...options,timeout:Math.max(1,Math.min(3500,deadline-Date.now()))});
  let canonical;
  try{canonical=await canonicalFolder(folder);}catch{return {status:'unavailable',message:'Folder missing or inaccessible. Reconnect it in Project details.',checkedAt:new Date().toISOString()};}
  const root=await git(canonical,['rev-parse','--show-toplevel']);
  if(!root.ok)return {status:root.notRepo?'not-repository':'unavailable',message:root.notRepo?'This folder is not in a Git repository.':'Git could not inspect this folder.',checkedAt:new Date().toISOString()};
  const [common,refs,trees,names,shallowRead]=await Promise.all([
    git(canonical,['rev-parse','--path-format=absolute','--git-common-dir']),git(canonical,refsArgs,{raw:true}),
    git(canonical,['worktree','list','--porcelain','-z'],{raw:true}),git(canonical,['remote']),git(canonical,['rev-parse','--is-shallow-repository'])
  ]);
  if(!common.ok)return {status:'unavailable',message:'Repository identity could not be read.',checkedAt:new Date().toISOString()};
  const commonDirectory=await realpath(common.value).catch(()=>common.value);
  const allRefs=refs.ok?refs.value.trimEnd().split('\n').filter(Boolean).map(line=>{const [ref,commit,upstream,symref]=line.split('\0');return {ref,name:label(ref),commit,upstream:upstream||null,symref:symref||null};}):[];
  const allBranches=allRefs.filter(r=>r.ref.startsWith('refs/heads/'));
  const remoteNames=names.ok?names.value.split('\n').filter(Boolean):[];
  const remoteConfigs=await mapLimit(remoteNames.slice(0,20),async name=>{
    const config=await git(canonical,['config','--get',`remote.${name}.url`]);
    return {name,rawURL:config.ok?config.value:null,...safeRemote(config.ok?config.value:'')};
  });
  assert(!remoteName||remoteConfigs.some(r=>r.name===remoteName),'Remote is no longer available. Refresh local status.',409);
  const selectedRemote=remoteName|| (remoteConfigs.some(r=>r.name==='origin')?'origin':remoteConfigs.length===1?remoteConfigs[0].name:null);
  const defaultTracking=selectedRemote?allRefs.find(r=>r.ref===`refs/remotes/${selectedRemote}/HEAD`)?.symref:null;
  const defaultBranch=defaultTracking?.startsWith(`refs/remotes/${selectedRemote}/`)?defaultTracking.slice(`refs/remotes/${selectedRemote}/`.length):null;
  const choices=allRefs.filter(r=>!r.symref&&oid(r.commit));
  assert(!targetRef||choices.some(r=>r.ref===targetRef),'Comparison target is no longer available. Choose another target.',409);
  const conventional=allBranches.filter(r=>['main','master'].includes(r.name));
  const selected=targetRef?choices.find(r=>r.ref===targetRef):
    (defaultBranch&&(choices.find(r=>r.ref===`refs/heads/${defaultBranch}`)||choices.find(r=>r.ref===defaultTracking)))||(conventional.length===1?conventional[0]:null);
  const shallow=!shallowRead.ok||shallowRead.value==='true';
  const target=selected?{ref:selected.ref,name:selected.name,commit:selected.commit,kind:selected.ref.startsWith('refs/heads/')?'local':'remote-tracking'}:null;
  const compare=(head,base)=>compareCommits(git,canonical,head,base,shallow);
  const rawTrees=trees.ok?parseWorktrees(trees.value):[];
  // Always inspect the connected checkout even when the inventory is capped.
  const ordered=[...rawTrees.filter(w=>w.path===root.value),...rawTrees.filter(w=>w.path!==root.value)];
  const worktrees=await mapLimit(ordered.slice(0,worktreeLimit),async row=>{
    const result={...row,id:fingerprint([commonDirectory,row.path]),current:row.path===root.value,available:false,changes:null,dirty:null,operations:null,stale:false};
    if(row.bare)return {...result,message:'Bare repository'};
    const member=await git(row.path,['rev-parse','--path-format=absolute','--git-common-dir']);
    if(!member.ok||await realpath(member.value).catch(()=>null)!==commonDirectory)return {...result,message:'Worktree missing or inaccessible'};
    const [status,dir]=await Promise.all([git(row.path,statusArgs,{raw:true}),git(row.path,['rev-parse','--absolute-git-dir'])]);
    if(!status.ok||!dir.ok)return {...result,message:'Worktree status unavailable'};
    const operations=[];let operationsKnown=true;
    for(const [file,name] of [['MERGE_HEAD','Merge'],['rebase-merge','Rebase'],['rebase-apply','Rebase / apply'],['CHERRY_PICK_HEAD','Cherry-pick'],['REVERT_HEAD','Revert'],['sequencer','Sequence']]){
      try{await stat(path.join(dir.value,file));operations.push(name);}catch(e){if(e.code!=='ENOENT')operationsKnown=false;}
    }
    const state=parseStatus(status.value);
    const comparison=await compare(state.commit,target?.commit);
    const after=await git(row.path,statusArgs,{raw:true});
    return {...result,...state,available:true,operations:operationsKnown?operations:null,comparison,stale:!after.ok||after.value!==status.value||state.commit!==row.commit||state.branch!==row.branch};
  });
  const branches=await mapLimit(allBranches.slice(0,limit),async branch=>({
    ...branch,worktreeIDs:worktrees.filter(w=>w.branch===branch.name).map(w=>w.id),
    comparison:await compare(branch.commit,target?.commit),
    upstreamComparison:branch.upstream?await compare(branch.commit,allRefs.find(r=>r.ref===branch.upstream)?.commit):null
  }));
  const [refsAfter,treesAfter,namesAfter]=await Promise.all([git(canonical,refsArgs,{raw:true}),git(canonical,['worktree','list','--porcelain','-z'],{raw:true}),git(canonical,['remote'])]);
  const configAfter=await mapLimit(remoteConfigs,async remote=>{const r=await git(canonical,['config','--get',`remote.${remote.name}.url`]);return r.ok?r.value:null;});
  const stale=!refsAfter.ok||refsAfter.value!==refs.value||!treesAfter.ok||treesAfter.value!==trees.value||!namesAfter.ok||namesAfter.value!==names.value||remoteConfigs.some((r,i)=>r.rawURL!==configAfter[i])||worktrees.some(w=>w.stale);
  const truncated=allRefs.length>=401||allBranches.length>limit||rawTrees.length>worktreeLimit||remoteNames.length>20;
  const partial=stale||truncated||!refs.ok||!trees.ok||!names.ok||remoteConfigs.some(r=>!r.rawURL)||worktrees.some(w=>!w.available||w.operations===null)||branches.some(b=>b.comparison.state==='unknown'||b.comparison.state==='unrelated'||b.upstreamComparison?.state==='unknown');
  const current=worktrees.find(w=>w.current)||null;
  const summary={branches:allBranches.length,worktrees:rawTrees.length,checkedOutBranches:new Set(worktrees.filter(w=>w.branch).map(w=>w.branch)).size,
    branchesWithCommits:target?branches.filter(b=>b.comparison.ahead>0).length:null,
    dirtyWorktrees:worktrees.filter(w=>w.dirty===true).length,detachedWithCommits:target?worktrees.filter(w=>w.detached&&w.comparison?.ahead>0).length:null};
  const snapshot={status:'connected',folderPath:canonical,root:root.value,commonDirectory,checkedAt:new Date().toISOString(),target,defaultBranch,selectedRemote,
    remotes:remoteConfigs.map(({rawURL,...r})=>r),targets:choices.slice(0,400).map(({ref,name})=>({ref,name})),current,branches,worktrees,summary,shallow,partial,truncated,stale};
  // Private server-side identity. Raw remote configuration is never serialized by the API.
  const identity=fingerprint([commonDirectory,refs.value,trees.value,remoteConfigs,worktrees.map(w=>[w.id,w.branch,w.commit,w.changes,w.operations,w.available]),target?.ref]);
  return {...snapshot,_identity:identity,_remotes:remoteConfigs};
}
