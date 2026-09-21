import {randomUUID} from 'node:crypto';
import {assert} from './domain.js';
import {inspectRepository,compareCommits,fingerprint} from './worktrees.js';
import {readGit} from './git-read.js';

// Deliberately exclude file/ext/git/http transports, embedded secrets and shell-like URLs.
export function networkRemote(raw){
  if(typeof raw!=='string'||raw.length>4096||/[\s\x00-\x1f]/.test(raw)||raw.includes('::'))return null;
  let value=raw;
  const scp=raw.match(/^(?:([a-zA-Z0-9_.-]+)@)?([a-zA-Z0-9.-]+):([a-zA-Z0-9_./~-]+)$/);
  if(scp&&!raw.includes('://'))value=`ssh://${scp[1]?scp[1]+'@':''}${scp[2]}/${scp[3]}`;
  try{
    const url=new URL(value);
    if(!['https:','ssh:'].includes(url.protocol)||!url.hostname||url.hostname.startsWith('-')||url.password||url.search||url.hash)return null;
    if(url.protocol==='https:'&&url.username)return null;
    if(url.username&&!/^[a-zA-Z0-9_.-]+$/.test(url.username))return null;
    if(!/^\/[a-zA-Z0-9_./~%-]+$/.test(url.pathname)||/%(?:00|0a|0d)/i.test(url.pathname))return null;
    return url.href;
  }catch{return null;}
}
export async function advertiseRemote(url){
  const result=await readGit('/',['ls-remote','--symref',url,'HEAD','refs/heads/*'],{raw:true,network:true,timeout:12000});
  assert(result.ok,'Remote check failed. Check network access and saved credentials. No refs were fetched.',503);
  const tips={};let defaultBranch=null,count=0;
  for(const line of result.value.split('\n').filter(Boolean)){
    if(++count>10000)throw new Error('Remote output limit');
    const symbolic=line.match(/^ref: (refs\/heads\/[^\s]+)\tHEAD$/);
    if(symbolic){defaultBranch=symbolic[1].slice(11);continue;}
    const match=line.match(/^([a-f0-9]{40,64})\t(refs\/heads\/[^\s]+|HEAD)$/);
    if(!match)throw new Error('Invalid remote advertisement');
    tips[match[2]]=match[1];
  }
  return {defaultBranch,tips};
}
const publicSnapshot=({_identity,_remotes,...snapshot})=>snapshot;
const remoteRef=(s,ref)=>{
  if(!ref)return null;
  if(ref.startsWith('refs/heads/'))return ref;
  const prefix=`refs/remotes/${s.selectedRemote}/`;
  return ref.startsWith(prefix)?'refs/heads/'+ref.slice(prefix.length):null;
};

export class GitStatus{
  constructor({inspect=inspectRepository,advertise=advertiseRemote,clock=Date.now}={}){
    this.inspect=inspect;this.advertise=advertise;this.clock=clock;this.snapshots=new Map();this.observations=new Map();this.pendingReads=new Map();this.pendingChecks=new Map();
  }
  prune(){
    const cutoff=this.clock()-5*60*1000;
    for(const [id,row] of this.snapshots)if(row.at<cutoff)this.snapshots.delete(id);
    while(this.snapshots.size>=100)this.snapshots.delete(this.snapshots.keys().next().value);
    while(this.observations.size>100)this.observations.delete(this.observations.keys().next().value);
  }
  key(project,s){return fingerprint([project.id,project.version,s._identity,s.selectedRemote]);}
  async read(project,{targetRef='',remoteName=''}={}){
    assert(typeof targetRef==='string'&&targetRef.length<=1024&&typeof remoteName==='string'&&remoteName.length<=200,'Invalid Git selection.');
    if(!project.folderPath)return {status:'unavailable',message:'Choose a project folder in Project details.',projectID:project.id,projectVersion:project.version};
    const key=fingerprint([project.id,project.version,project.folderPath,targetRef,remoteName]);
    if(this.pendingReads.has(key))return this.pendingReads.get(key);
    assert(this.pendingReads.size<4,'Git inspection is busy. Try Refresh local shortly.',429);
    const task=(async()=>{
      const s=await this.inspect(project.folderPath,{targetRef,remoteName});this.prune();
      const snapshotID=randomUUID(),result={...publicSnapshot(s),projectID:project.id,projectVersion:project.version,snapshotID};
      if(s.status==='connected'){
        this.snapshots.set(snapshotID,{project:structuredClone(project),snapshot:s,at:this.clock()});
        result.remote=this.observations.get(this.key(project,s))||null;
      }
      return result;
    })();
    this.pendingReads.set(key,task);
    try{return await task;}finally{this.pendingReads.delete(key);}
  }
  async check(project,input){
    assert(input&&Object.keys(input).every(k=>['snapshotID','projectVersion'].includes(k)),'Refresh local status before checking the remote.');
    assert(input.projectVersion===project.version,'Project changed. Refresh local status.',409);
    this.prune();const row=this.snapshots.get(input.snapshotID);
    assert(row&&row.project.id===project.id&&row.project.version===project.version&&row.project.folderPath===project.folderPath,'Status expired or belongs to another project. Refresh local status.',409);
    const s=row.snapshot;assert(!s.stale,'Repository changed during inspection. Refresh local status.',409);
    assert(s.selectedRemote,'Choose a remote before checking it.');
    const key=this.key(project,s);
    if(this.pendingChecks.has(key))return this.pendingChecks.get(key);
    assert(this.pendingChecks.size<2,'A remote check is already running. Try again shortly.',429);
    const task=this.performCheck(project,row,key);this.pendingChecks.set(key,task);
    try{return await task;}finally{this.pendingChecks.delete(key);}
  }
  async performCheck(project,row,key){
    const s=row.snapshot,options={targetRef:s.target?.ref||'',remoteName:s.selectedRemote};
    const before=await this.inspect(project.folderPath,options);
    assert(before._identity===s._identity&&!before.stale,'Repository or remote changed. Refresh local status.',409);
    const url=networkRemote(s._remotes.find(r=>r.name===s.selectedRemote)?.rawURL);
    const previous=this.observations.get(key);
    let result;
    try{
      assert(url,'Remote check supports HTTPS or SSH without embedded credentials. Local paths and other transports are unavailable.');
      const advertised=await this.advertise(url);
      assert(advertised&&advertised.tips&&typeof advertised.tips==='object','Remote response unavailable.');
      const branch=s.branches.find(b=>b.name===s.current?.branch);
      const currentRef=remoteRef(s,branch?.upstream)|| (s.current?.branch?'refs/heads/'+s.current.branch:null);
      const targetRef=remoteRef(s,s.target?.ref);
      const comparison=async(ref,commit)=>{
        if(!ref||!commit)return {state:'unknown',ahead:null,behind:null,ref,message:'No named commit to compare'};
        const tip=advertised.tips[ref];
        if(!tip)return {state:'missing',ahead:null,behind:null,ref,message:'Branch not advertised by remote'};
        assert(/^[a-f0-9]{40,64}$/.test(tip),'Invalid remote commit.');
        const counts=await compareCommits(readGit,s.root,commit,tip,s.shallow);
        return {...counts,ref,commit:tip,...(counts.state==='unknown'?{message:'Remote changed; exact comparison unavailable without fetch'}:{})};
      };
      result={status:'observed',remoteName:s.selectedRemote,checkedAt:new Date(this.clock()).toISOString(),defaultBranch:advertised.defaultBranch||null,
        current:await comparison(currentRef,s.current?.commit),target:await comparison(targetRef,s.target?.commit)};
    }catch{
      // Never expose transport stderr or credential-bearing configuration.
      result={status:'error',remoteName:s.selectedRemote,attemptedAt:new Date(this.clock()).toISOString(),message:url?'Remote check failed. Check network access and saved credentials. No refs were fetched.':'Remote check supports HTTPS or SSH without embedded credentials; this remote is unsupported.',previous:previous?.status==='observed'?previous:previous?.previous||null};
    }
    const after=await this.inspect(project.folderPath,options);
    assert(after._identity===s._identity&&!after.stale,'Repository changed during the remote check. Refresh local status.',409);
    this.observations.set(key,result);this.prune();return result;
  }
}
