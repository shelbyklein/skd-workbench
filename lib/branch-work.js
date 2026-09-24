// Current work on the project page: local branches with commits not yet in the default branch, newest first.
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
 const rows=await Promise.all(open.slice(0,40).map(async b=>{
  const log=await run(snapshot.root,['log','--no-merges','--format=%ct%x00%s',`-n${subjects}`,`${target.commit}..${b.commit}`,'--'],{raw:true});
  const lines=log.ok?log.value.split('\n').filter(Boolean).map(l=>l.split('\0')):[];
  const tree=b.worktreeIDs?.map(id=>worktrees.get(id)).find(Boolean)||null;
  return {name:b.name,ahead:b.comparison.ahead,behind:b.comparison.behind,lastCommitAt:lines[0]?new Date(Number(lines[0][0])*1000).toISOString():null,
   subjects:lines.map(l=>l.slice(1).join('\0')),
   worktree:tree?{path:tree.path,current:tree.current,dirty:tree.dirty,changes:tree.changes?Object.values(tree.changes).reduce((a,n)=>a+n,0):null}:null};
 }));
 rows.sort((a,b)=>String(b.lastCommitAt).localeCompare(String(a.lastCommitAt)));
 return {status:'connected',target:target.name,branches:rows.slice(0,limit),total:rows.length};
}
