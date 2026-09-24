// Current work on the project page: local branches whose changes are not yet in the default branch, newest first.
// Each branch is summarized by its own commit subjects, last activity and the worktree that holds it.
// Read-only: built from the Git status snapshot plus bounded `git log` reads.
import {readGit} from './git-read.js';

const oid=value=>/^[a-f0-9]{40,64}$/.test(value||'');
export async function branchWork(snapshot,{run=readGit,limit=20,subjects=5}={}){
 if(snapshot?.status!=='connected')return {status:snapshot?.status||'unavailable',message:snapshot?.message||'Git status unavailable.',branches:[]};
 const target=snapshot.target;
 if(!target)return {status:'no-target',message:'No default branch to compare with.',branches:[]};
 const worktrees=new Map((snapshot.worktrees||[]).map(w=>[w.id,w]));
 const open=(snapshot.branches||[]).filter(b=>b.ref!==target.ref&&oid(b.commit)&&b.comparison?.ahead>0);
 // A squash- or rebase-merged branch keeps commits main never received. It is skipped when merging it would change
 // nothing, or when main has a commit with the branch tip's subject (a squash merge titled "<subject> (#N)").
 const bare=subject=>subject.replace(/\s+\(#\d+\)$/,'').trim();
 const [targetTree,history]=await Promise.all([run(snapshot.root,['rev-parse',`${target.commit}^{tree}`]),run(snapshot.root,['log','-n1000','--format=%s',target.commit,'--'],{raw:true})]);
 const landed=new Set(history.ok?history.value.split('\n').filter(Boolean).map(bare):[]);
 const merged=async b=>{if(!targetTree.ok)return false;const result=await run(snapshot.root,['merge-tree','--write-tree',target.commit,b.commit]);return result.ok&&result.value.split('\n')[0]===targetTree.value;};
 const rows=(await Promise.all(open.slice(0,40).map(async b=>{
  if(await merged(b))return null;
  const log=await run(snapshot.root,['log','--no-merges','--format=%ct%x00%s',`-n${subjects}`,`${target.commit}..${b.commit}`,'--'],{raw:true});
  const lines=log.ok?log.value.split('\n').filter(Boolean).map(l=>l.split('\0')):[];
  if(lines[0]&&landed.has(bare(lines[0].slice(1).join('\0'))))return null;
  const tree=b.worktreeIDs?.map(id=>worktrees.get(id)).find(Boolean)||null;
  return {name:b.name,ahead:b.comparison.ahead,behind:b.comparison.behind,lastCommitAt:lines[0]?new Date(Number(lines[0][0])*1000).toISOString():null,
   subjects:lines.map(l=>l.slice(1).join('\0')),
   worktree:tree?{path:tree.path,current:tree.current,dirty:tree.dirty,changes:tree.changes?Object.values(tree.changes).reduce((a,n)=>a+n,0):null}:null};
 }))).filter(Boolean);
 rows.sort((a,b)=>String(b.lastCommitAt).localeCompare(String(a.lastCommitAt)));
 return {status:'connected',target:target.name,branches:rows.slice(0,limit),total:rows.length};
}
