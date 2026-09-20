import { realpath, stat } from 'node:fs/promises';
import path from 'node:path';
import { homedir } from 'node:os';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { assert, Problem, now } from './domain.js';

const exec=promisify(execFile);
export async function canonicalFolder(value){
  assert(typeof value==='string'&&value.trim()&&value.length<=4096&&!value.includes('\0'),'Enter a local folder path.');
  const expanded=value.startsWith('~/')?path.join(homedir(),value.slice(2)):value;
  assert(path.isAbsolute(expanded),'Use an absolute folder path, or start with ~/.');
  try {const folder=await realpath(expanded);assert((await stat(folder)).isDirectory(),'The selected path is a file. Choose a folder.');return folder;}
  catch(e){if(e instanceof Problem)throw e;throw new Problem('Folder is missing or inaccessible. Check the path and reconnect it.');}
}

async function git(folder,args){
  const env={...process.env};
  for(const name of Object.keys(env))if(name.startsWith('GIT_'))delete env[name];
  env.LC_ALL='C';env.GIT_OPTIONAL_LOCKS='0';env.GIT_TERMINAL_PROMPT='0';
  try {
    const {stdout}=await exec('git',['--no-optional-locks','-c','core.fsmonitor=false','-c','core.untrackedCache=false','-C',folder,...args],{env,timeout:6000,maxBuffer:2*1024*1024,encoding:'utf8'});
    return {ok:true,value:stdout.trim()};
  } catch(e) {return {ok:false,unavailable:e.code==='ENOENT',notRepo:typeof e.stderr==='string'&&e.stderr.includes('not a git repository')};}
}

// Never return credentials, URL queries, or arbitrary remote helper commands.
export function safeRemote(value){
  if(typeof value!=='string'||!value||value.includes('::'))return {url:'Unsupported remote format',webURL:null};
  try {
    const u=new URL(value);
    if(!['https:','http:','ssh:','git:'].includes(u.protocol))return {url:'Local or unsupported remote',webURL:null};
    u.username='';u.password='';u.search='';u.hash='';
    const url=u.toString();
    const webURL=['http:','https:'].includes(u.protocol)?url.replace(/\.git\/?$/,''):`https://${u.hostname}${u.pathname.replace(/\.git\/?$/,'')}`;
    return {url,webURL};
  }catch{}
  const match=value.match(/^(?:[^@\s]+@)?([a-zA-Z0-9.-]+):([^\s?#]+)(?:[?#].*)?$/);
  if(match){const remotePath=match[2].replace(/^\/+/, '');return {url:`${match[1]}:${remotePath}`,webURL:`https://${match[1]}/${remotePath.replace(/\.git$/,'')}`};}
  return {url:'Local or unsupported remote',webURL:null};
}

export async function inspectFolder(value){
  const folder=await canonicalFolder(value);
  const context={folderPath:folder,available:true,checkedAt:now(),git:null};
  const root=await git(folder,['rev-parse','--show-toplevel']);
  if(!root.ok){
    context.git={status:root.notRepo?'not-repository':root.unavailable?'unavailable':'error',message:root.notRepo?'This folder is not in a Git repository.':root.unavailable?'Git is not installed or available to the server.':'Git could not inspect this folder. Check repository access and trust settings.'};
    return context;
  }
  const results=await Promise.allSettled([
    git(folder,['rev-parse','--path-format=absolute','--git-common-dir']),
    git(folder,['symbolic-ref','--quiet','--short','HEAD']),
    git(folder,['rev-parse','--verify','HEAD']),
    git(folder,['status','--porcelain=v1','--untracked-files=normal','--ignore-submodules=none']),
    git(folder,['remote'])
  ]);
  const [common,branch,commit,status,remoteNames]=results.map(r=>r.status==='fulfilled'?r.value:{ok:false});
  const names=remoteNames.ok?remoteNames.value.split('\n').filter(Boolean).slice(0,20):[];
  const remoteResults=await Promise.allSettled(names.map(async name=>{
    const url=await git(folder,['config','--get',`remote.${name}.url`]);
    return {name,...(url.ok?safeRemote(url.value):{url:'URL unavailable',webURL:null})};
  }));
  context.git={status:'connected',root:root.value,commonDirectory:common.ok?common.value:null,
    branch:branch.ok?branch.value:null,detached:!branch.ok&&commit.ok,commit:commit.ok?commit.value:null,
    dirty:status.ok?Boolean(status.value):null,
    remotes:remoteResults.filter(r=>r.status==='fulfilled').map(r=>r.value),
    partial:!common.ok||!status.ok||!remoteNames.ok||remoteResults.some(r=>r.status==='rejected')};
  return context;
}
