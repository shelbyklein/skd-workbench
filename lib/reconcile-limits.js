// When Home warns that a project needs reconciling: per-project limits for branches with unmerged commits,
// branches behind the integration target, and commits the checkout is ahead of or behind its remote.
// Workbench only warns; the person asks an agent to reconcile.
import {existsSync,readFileSync,writeFileSync,renameSync} from 'node:fs';
import path from 'node:path';
import {assert} from './domain.js';

export const defaultLimits={unmerged:3,behind:10,remote:5};
const keys=Object.keys(defaultLimits);
export class ReconcileLimits{
 constructor(directory){
  this.file=path.join(directory,'reconcile-limits.json');this.data={schema:1,projects:{}};
  if(existsSync(this.file)){let parsed;try{parsed=JSON.parse(readFileSync(this.file,'utf8'));}catch{}
   assert(parsed?.schema===1&&parsed.projects&&typeof parsed.projects==='object','Reconcile warning settings are damaged. Restore reconcile-limits.json from a backup.',500);this.data=parsed;}
 }
 get(projectID){return {...defaultLimits,...this.data.projects[projectID]};}
 all(){return {defaults:{...defaultLimits},projects:Object.fromEntries(Object.keys(this.data.projects).map(id=>[id,this.get(id)]))};}
 save(projectID,input){
  assert(input&&typeof input==='object'&&Object.keys(input).every(k=>keys.includes(k)),'Unknown reconcile warning setting.');
  const next={};for(const k of keys){const v=input[k]??this.get(projectID)[k];assert(Number.isInteger(v)&&v>=1&&v<=999,'Each limit must be a whole number from 1 to 999.');next[k]=v;}
  this.data.projects[projectID]=next;
  writeFileSync(this.file+'.tmp',JSON.stringify(this.data,null,2),{mode:0o600});renameSync(this.file+'.tmp',this.file);
  return this.get(projectID);
 }
}
