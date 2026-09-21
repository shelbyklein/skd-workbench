import {execFile} from 'node:child_process';
import {promisify} from 'node:util';

const exec=promisify(execFile);

// Internal read commands only. Never pass arguments or environment from HTTP callers.
export async function readGit(folder,args,{raw=false,timeout=6000,network=false}={}){
  const env={...process.env};
  for(const name of Object.keys(env))if(name.startsWith('GIT_'))delete env[name];
  Object.assign(env,{LC_ALL:'C',GIT_OPTIONAL_LOCKS:'0',GIT_TERMINAL_PROMPT:'0',GIT_NO_REPLACE_OBJECTS:'1',GIT_NO_LAZY_FETCH:'1'});
  const config=['--no-optional-locks','-c','core.fsmonitor=false','-c','core.untrackedCache=false'];
  if(network){
    // Run outside the checkout, ignoring URL rewrites, arbitrary helpers and local config.
    Object.assign(env,{GIT_CONFIG_NOSYSTEM:'1',GIT_CONFIG_GLOBAL:'/dev/null',GIT_ASKPASS:'/usr/bin/false',SSH_ASKPASS:'/usr/bin/false',GIT_ALLOW_PROTOCOL:'https:ssh',GIT_SSH_COMMAND:'/usr/bin/ssh -F /dev/null -o BatchMode=yes -o StrictHostKeyChecking=yes -o ConnectTimeout=8'});
    config.push('-c','protocol.allow=never','-c','protocol.https.allow=always','-c','protocol.ssh.allow=always','-c','credential.helper=','-c','http.followRedirects=false');
    if(process.platform==='darwin')config.push('-c','credential.helper=osxkeychain');
  }
  let timer;
  try{
    const pending=exec('git',[...config,'-C',network?'/':folder,...args],{env,timeout:network?0:timeout,detached:network,maxBuffer:2*1024*1024,encoding:'utf8',killSignal:'SIGKILL'});
    // SSH/credential helpers must not outlive a timed-out advertisement check.
    if(network)timer=setTimeout(()=>{try{process.kill(-pending.child.pid,'SIGKILL');}catch{}},timeout);
    const {stdout}=await pending;
    return {ok:true,value:raw?stdout:stdout.trim()};
  }catch(e){return {ok:false,unavailable:e.code==='ENOENT',notRepo:typeof e.stderr==='string'&&e.stderr.includes('not a git repository'),exitCode:typeof e.code==='number'?e.code:null};}
  finally{clearTimeout(timer);}
}
