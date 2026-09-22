import {execFile} from 'node:child_process';
import {realpathSync} from 'node:fs';
import {assert,Problem} from './domain.js';

export function createWorkspaceTerminal(folder,{platform=process.platform,execute=execFile}={}){
 const workspace=realpathSync(folder);let active=false;
 return async()=>{
  assert(platform==='darwin','Opening Terminal is available on macOS.',501);
  assert(!active,'Terminal is already opening.',409);active=true;
  try{
   await new Promise((resolve,reject)=>execute('/usr/bin/open',['-a','Terminal',workspace],{timeout:10000,maxBuffer:16384},error=>error?reject(new Problem('Could not open Terminal. Try again.',503)):resolve()));
   return {opened:true};
  }finally{active=false;}
 };
}
