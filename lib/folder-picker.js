import {execFile} from 'node:child_process';
import {assert,Problem} from './domain.js';

export function createFolderPicker({platform=process.platform,execute=execFile}={}){
 let active=false;
 return async()=>{
  assert(platform==='darwin','Folder selection is available on macOS. Enter the folder path manually.',501);
  assert(!active,'A folder picker is already open.',409);active=true;
  try{return await new Promise((resolve,reject)=>execute('/usr/bin/osascript',['-e',
   'tell application "System Events"\nactivate\ntry\nset selectedFolder to choose folder with prompt "Choose a project folder"\nreturn POSIX path of selectedFolder\non error number -128\nreturn ""\nend try\nend tell'],
   {timeout:120000,maxBuffer:16384},(error,stdout)=>{
    if(error){reject(new Problem('Could not open the folder picker. Try again or enter the folder path manually.',503));return;}
    // osascript appends one newline; preserve any whitespace in the actual path.
    const folderPath=stdout.replace(/\r?\n$/,'');resolve(folderPath?{folderPath}:{cancelled:true});
   }));}finally{active=false;}
 };
}
