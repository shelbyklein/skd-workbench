import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {homedir} from 'node:os';
import {execFileSync} from 'node:child_process';
import {existsSync} from 'node:fs';
export const launcherRoot=path.dirname(path.dirname(fileURLToPath(import.meta.url)));
export const launcherLabel='com.shelbyklein.skd-workbench';
export const launcherPlist=path.join(homedir(),'Library/LaunchAgents',launcherLabel+'.plist');
export async function serverStatus(url='http://127.0.0.1:4390/api/health'){
 try{const r=await fetch(url,{signal:AbortSignal.timeout(1500)});const body=await r.json();return r.ok&&body.app==='skd-workbench'&&body.ok===true?'running':'occupied';}
 catch(e){return e.cause?.code==='ECONNREFUSED'?'stopped':'unknown';}
}
export async function startLocalServer(){
 if(process.platform!=='darwin')throw Error('The launcher requires macOS.');
 const status=await serverStatus();if(status==='running')return;
 if(status!=='stopped')throw Error('Port 4390 is occupied or not responding. Inspect the existing server before starting another.');
 const domain='gui/'+process.getuid(),service=domain+'/'+launcherLabel;
 try{execFileSync('/bin/launchctl',['print',service],{stdio:'ignore'});}catch{execFileSync('/bin/launchctl',['bootstrap',domain,launcherPlist],{stdio:'pipe'});}
 // No -k: never terminate a running job, shell, or agent session.
 execFileSync('/bin/launchctl',['kickstart',service],{stdio:'pipe'});
 await waitUntilRunning();
}
// The server takes a moment to listen after launchd starts it; opening the window before that shows it offline.
export async function waitUntilRunning({status=serverStatus,timeoutMs=15000,intervalMs=300}={}){
 const deadline=Date.now()+timeoutMs;
 while(Date.now()<deadline){if(await status()==='running')return true;await new Promise(r=>setTimeout(r,intervalMs));}
 throw Error('Workbench did not start within 15 seconds. See ~/Library/Logs/SKD Workbench/server-error.log.');
}
// The Workbench window: the installed web app when there is one, otherwise the default browser.
export function workbenchWindow({home=homedir(),exists=existsSync}={}){
 const app=path.join(home,'Applications','SKD Workbench.app');
 return exists(app)?['-a',app]:['http://127.0.0.1:4390'];
}
export function openWorkbench(){execFileSync('/usr/bin/open',workbenchWindow(),{stdio:'pipe'});}
