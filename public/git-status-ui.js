const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const shortRef=ref=>ref?.replace(/^refs\/(heads|remotes)\//,'')||'Unknown';
const time=value=>value?new Date(value).toLocaleString(): 'Not checked';
const plural=(n,s)=>`${n} ${s}${n===1?'':s.endsWith('branch')?'es':'s'}`;
function comparison(value){
  if(!value)return 'No upstream';
  if(value.state==='equal')return 'Same commit';
  if(value.state==='missing')return 'Branch not advertised';
  if(value.state==='unrelated')return 'No shared history';
  if(value.state==='unknown')return value.message||value.reason||'Unknown';
  return `${value.ahead} ahead · ${value.behind} behind`;
}
function changes(row){
  if(!row?.available||!row.changes)return 'Working state unknown';
  const c=row.changes;
  return row.dirty?[c.conflicts?plural(c.conflicts,'conflict'):null,c.staged?`${c.staged} staged`:null,c.unstaged?`${c.unstaged} unstaged`:null,c.untracked?`${c.untracked} untracked`:null].filter(Boolean).join(' · '):'Clean';
}
function headline(s){
  const c=s.current;
  if(s.stale)return 'Repository changed during inspection';
  if(!c?.available)return 'Checkout status unavailable';
  if(c.changes?.conflicts)return 'Conflicts need attention';
  if(c.operations?.length)return `${c.operations.join(' / ')} in progress`;
  if(!c.commit)return 'No commits yet';
  if(c.detached)return 'Detached HEAD';
  return `On ${c.branch}`;
}
function remoteMarkup(remote){
  if(!remote)return '<p class="git-muted">Remote not checked. Local comparisons use locally recorded refs.</p>';
  if(remote.status==='error')return `<p class="git-warning">${esc(remote.message)}</p>${remote.previous?`<p class="git-muted">Previous observation — stale</p>${remoteMarkup(remote.previous)}`:''}`;
  return `<dl class="git-remote-facts"><div><dt>Checkout → ${esc(shortRef(remote.current?.ref))}</dt><dd>${esc(comparison(remote.current))}</dd></div><div><dt>Target → ${esc(shortRef(remote.target?.ref))}</dt><dd>${esc(comparison(remote.target))}</dd></div></dl><p class="git-muted">${esc(remote.remoteName)} checked ${esc(time(remote.checkedAt))}${remote.defaultBranch?` · Default branch: ${esc(remote.defaultBranch)}`:''}. No fetch.</p>`;
}

function branchSummary(s){
  if(!s.target)return 'Choose a comparison branch in Details';
  const branches=s.branches.filter(b=>b.ref!==s.target.ref);
  const behind=branches.filter(b=>Number.isFinite(b.comparison?.behind)&&b.comparison.behind>0).length;
  const unknown=branches.filter(b=>!Number.isFinite(b.comparison?.behind)).length+Math.max(0,s.summary.branches-s.branches.length);
  if(s.stale)return 'Branch comparison stale';
  return `${unknown?'At least ':''}${plural(behind,'branch')} behind ${s.target.name}${unknown?' · '+unknown+' unknown':''}`;
}

export function mountGitStatus(host,project,api){
  let snapshot=null,error='',busy=false,checking=false,serial=0,targetRef='',remoteName='',expanded=false,detailsOpen=false;
  const preferenceKey=`skd-git-selection:${project.id}:${project.folderPath||''}`;
  try{const saved=JSON.parse(localStorage.getItem(preferenceKey)||'{}');targetRef=typeof saved.targetRef==='string'?saved.targetRef:'';remoteName=typeof saved.remoteName==='string'?saved.remoteName:'';}catch{}
  const save=()=>{try{localStorage.setItem(preferenceKey,JSON.stringify({targetRef,remoteName}));}catch{}};
  const endpoint='projects/'+encodeURIComponent(project.id)+'/git-status';
  function render(){
    if(!host.isConnected)return;
    const focus=host.contains(document.activeElement)?document.activeElement.dataset.gitAction:null;
    const s=snapshot,c=s?.current,currentBranch=s?.branches?.find(b=>b.name===c?.branch);
    const connected=s?.status==='connected',disabled=busy||checking;
    host.innerHTML=`<header class="git-row"><h2>Git</h2>
      ${connected?`<div class="git-branch-summary"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><circle cx="6" cy="18" r="3"/><circle cx="18" cy="6" r="3"/><path d="M6 15V3m0 12c0-6 9-3 9-9"/></svg><strong>${esc(c?.detached?'Detached HEAD':c?.branch||headline(s))}</strong></div>
      <span class="git-behind-count" aria-live="polite">${esc(branchSummary(s))}</span>
      ${s.summary.conflictedWorktrees||s.summary.operationWorktrees?`<button class="git-row-warning" type="button" data-git-action="review">${s.summary.conflictedWorktrees?esc(plural(s.summary.conflictedWorktrees,'worktree'))+' with conflicts':'Git operation in progress'}</button>`:''}`:''}
      <div class="git-header-actions">${connected?'<button type="button" class="git-text-action" data-git-action="details" aria-expanded="'+detailsOpen+'">Details</button>':''}<button type="button" data-git-action="refresh" ${disabled?'disabled':''}>${busy?'Reading…':'Refresh local'}</button></div></header>
      <div class="git-feedback" role="status" aria-live="polite">${error?`<p class="git-warning">${esc(error)}${snapshot?' Showing previous local observation — stale.':''}</p><button type="button" data-git-action="reset">Reset selections and retry</button>`:''}</div>
      ${connected?`<section class="git-detail-panel" ${detailsOpen?'':'hidden'} aria-label="Git details"><div class="git-overview-facts"><div><strong class="git-headline ${c?.changes?.conflicts||c?.operations?.length?'git-warning':''}">${esc(headline(s))}</strong><p>${esc(changes(c))}</p><small>${esc(c?.commit?.slice(0,10)||'No commit')}</small></div>
      <div><span class="git-fact-label">Against ${esc(s.target?.name||'no comparison target')}</span><strong>${esc(s.target?comparison(c?.comparison):'Choose a target below')}</strong><small>${s.target?.kind==='remote-tracking'?'Locally recorded remote-tracking ref':'Local integration target'}</small></div>
      <div><span class="git-fact-label">Upstream${currentBranch?.upstream?' · '+esc(shortRef(currentBranch.upstream)):''}</span><strong>${esc(comparison(currentBranch?.upstreamComparison))}</strong><small>Locally recorded remote state</small></div></div>
      <div class="git-totals"><span>${esc(plural(s.summary.worktrees,'worktree'))}</span><span>${esc(plural(s.summary.checkedOutBranches,'checked-out branch'))}</span><span>${s.summary.branchesWithCommits===null?'Integration unknown':`${s.partial?'At least ':''}${esc(plural(s.summary.branchesWithCommits,'branch'))} with commits absent from ${esc(s.target.name)}`}</span><span>${s.partial?'At least ':''}${esc(plural(s.summary.dirtyWorktrees,'dirty worktree'))}</span>${s.summary.detachedWithCommits?`<span>${esc(s.summary.detachedWithCommits)} detached with commits to review</span>`:''}</div>
      ${s.summary.conflictedWorktrees||s.summary.operationWorktrees?`<p class="git-warning">${s.summary.conflictedWorktrees?`${esc(plural(s.summary.conflictedWorktrees,'worktree'))} with conflicts. `:''}${s.summary.operationWorktrees?`${esc(plural(s.summary.operationWorktrees,'worktree'))} with a Git operation in progress. `:''}See Branches and worktrees.</p>`:''}
      ${s.partial?'<p class="git-warning">Partial inspection. Counts may be incomplete; unknown is not zero.</p>':''}${s.truncated?'<p class="git-muted">Inventory limit reached.</p>':''}${s.shallow?'<p class="git-muted">Shallow history limits commit comparisons.</p>':''}
      <div class="git-controls"><label>Compare with<select data-git-action="target" ${disabled?'disabled':''}><option value="">Automatic target</option>${s.targets.map(t=>`<option value="${esc(t.ref)}" ${targetRef===t.ref?'selected':''}>${esc(t.name)}${t.ref.startsWith('refs/remotes/')?' (recorded remote)':' (local)'}</option>`).join('')}</select></label><label>Remote<select data-git-action="remote" ${disabled?'disabled':''}><option value="">${s.selectedRemote?'Automatic · '+esc(s.selectedRemote):s.remotes.length?'Choose a remote':'No remote configured'}</option>${s.remotes.map(r=>`<option value="${esc(r.name)}" ${remoteName===r.name?'selected':''}>${esc(r.name)}</option>`).join('')}</select></label></div>
      <button type="button" data-git-action="check" ${disabled||!s.selectedRemote||s.stale||error?'disabled':''}>${checking?'Checking…':'Check remote'}</button><div class="git-remote-report" aria-live="polite">${remoteMarkup(s.remote)}</div>
      <details class="git-inventory" ${expanded?'open':''}><summary>Branches and worktrees</summary><p class="git-muted">Commit ancestry against ${esc(s.target?.name||'the selected target')}. Squash or rebase merges may retain distinct commits. Merge readiness not checked.</p><ul>${s.branches.map(branch=>`<li class="git-branch-row"><div><strong>${esc(branch.name)}</strong><span>${esc(s.target?comparison(branch.comparison):'Choose a target')}</span></div><small>${branch.worktreeIDs.length?`${branch.worktreeIDs.length} checked-out location${branch.worktreeIDs.length===1?'':'s'}`:'Not checked out'} · ${branch.upstream?`${esc(shortRef(branch.upstream))}: ${esc(comparison(branch.upstreamComparison))}`:'No upstream'}</small></li>`).join('')||'<li>No local branches with commits.</li>'}</ul><ul class="git-worktree-list">${s.worktrees.map(w=>`<li><div><strong>${esc(w.branch||(w.detached?'Detached HEAD':w.bare?'Bare repository':'No branch'))}</strong><span>${w.current?'This checkout':''}${w.locked?' · Locked':''}${w.prunable?' · Prunable':''}</span></div><code>${esc(w.path)}</code><p class="${w.changes?.conflicts||w.operations?.length?'git-warning':''}">${esc(w.message||changes(w))}${w.operations?.length?' · '+esc(w.operations.join(' / '))+' in progress':''}${w.stale?' · Changed during inspection':''}${w.operations===null?' · Operation state unknown':''}</p>${w.detached?`<p>${esc(comparison(w.comparison))} against ${esc(s.target?.name||'unknown target')}</p>`:''}<button type="button" data-git-action="copy" data-worktree-id="${esc(w.id)}">Copy path</button></li>`).join('')}</ul></details>
      <footer class="widget-footer"><span>Local checked ${esc(time(s.checkedAt))} · Merge readiness not checked</span>${s.remotes.find(r=>r.name===s.selectedRemote)?.webURL?`<a href="${esc(s.remotes.find(r=>r.name===s.selectedRemote).webURL)}" target="_blank" rel="noopener noreferrer">Open repository ↗</a>`:''}</footer></section>`:
      `<p class="widget-empty">${esc(s?.message||(busy?'Reading Git status…':'Git status unavailable.'))}</p>`}`;
    host.querySelector('[data-git-action="refresh"]').onclick=refresh;
    const detailButton=host.querySelector('[data-git-action="details"]');if(detailButton)detailButton.onclick=()=>{detailsOpen=!detailsOpen;render();};
    const review=host.querySelector('[data-git-action="review"]');if(review)review.onclick=()=>{detailsOpen=true;expanded=true;render();host.querySelector('.git-inventory summary')?.focus();};
    const reset=host.querySelector('[data-git-action="reset"]');if(reset)reset.onclick=()=>{targetRef='';remoteName='';save();refresh();};
    const target=host.querySelector('[data-git-action="target"]');if(target)target.onchange=()=>{targetRef=target.value;save();refresh();};
    const remote=host.querySelector('[data-git-action="remote"]');if(remote)remote.onchange=()=>{remoteName=remote.value;save();refresh();};
    const check=host.querySelector('[data-git-action="check"]');if(check)check.onclick=checkRemote;
    const details=host.querySelector('details');if(details)details.ontoggle=()=>{expanded=details.open;};
    host.querySelectorAll('[data-git-action="copy"]').forEach(button=>button.onclick=async()=>{try{await navigator.clipboard.writeText(s.worktrees.find(w=>w.id===button.dataset.worktreeId).path);button.textContent='Copied';}catch{button.textContent='Select the path above to copy';}});
    if(focus)host.querySelector(`[data-git-action="${focus}"]`)?.focus({preventScroll:true});
  }
  async function refresh(){
    const request=++serial;busy=true;error='';render();
    try{
      const params=new URLSearchParams();if(targetRef)params.set('target',targetRef);if(remoteName)params.set('remote',remoteName);
      const result=await api(endpoint+'?'+params);
      if(request!==serial||!host.isConnected)return;snapshot=result;
    }catch(e){if(request!==serial||!host.isConnected)return;error=e.message;}
    finally{if(request===serial&&host.isConnected){busy=false;render();}}
  }
  async function checkRemote(){
    if(!snapshot||busy||checking)return;
    const request=++serial;checking=true;error='';render();
    try{
      const remote=await api(endpoint+'/remote-check','POST',{snapshotID:snapshot.snapshotID,projectVersion:snapshot.projectVersion});
      if(request!==serial||!host.isConnected)return;snapshot={...snapshot,remote};
    }catch(e){if(request!==serial||!host.isConnected)return;error=e.message;}
    finally{if(request===serial&&host.isConnected){checking=false;render();}}
  }
  refresh();
}
