import {existsSync,readFileSync,writeFileSync,renameSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {assert} from './domain.js';
import {launcherLabel,launcherPlist} from '../scripts/launcher-service.mjs';
export function launcherStatus(file=launcherPlist){
 if(process.platform!=='darwin'||!existsSync(file))return {installed:false,startAtLogin:false};
 const config=JSON.parse(execFileSync('/usr/bin/plutil',['-convert','json','-o','-',file],{encoding:'utf8'}));
 return {installed:config.Label===launcherLabel&&config.ProgramArguments?.[1]?.endsWith('/scripts/serve-local.mjs'),startAtLogin:config.RunAtLoad===true};
}
export function saveLauncher(input,file=launcherPlist){
 assert(Object.keys(input).length===1&&typeof input.startAtLogin==='boolean','Choose whether to start at login.');assert(launcherStatus(file).installed,'Install the Mac launcher first.',409);
 const original=readFileSync(file,'utf8');
 assert(/<key>RunAtLoad<\/key>\s*<(?:true|false)\s*\/>/.test(original),'Launcher configuration needs reinstalling.',409);
 const next=original.replace(/(<key>RunAtLoad<\/key>\s*)<(?:true|false)\s*\/>/,`$1<${input.startAtLogin?'true':'false'}/>`);
 writeFileSync(file+'.tmp',next,{mode:0o600});renameSync(file+'.tmp',file);
 return launcherStatus(file);
}
