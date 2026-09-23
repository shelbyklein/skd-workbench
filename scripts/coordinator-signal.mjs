#!/usr/bin/env node
// Hook run by a coordinator CLI session (Claude Code Notification/permission_prompt, Codex PermissionRequest).
// Tells the local Workbench that the session is waiting for the user. Never blocks or fails the CLI.
const url=process.env.WORKBENCH_COORDINATOR_SIGNAL,secret=process.env.WORKBENCH_COORDINATOR_SECRET,kind=process.argv[2]||'waiting';
process.stdin.resume();process.stdin.on('error',()=>{});
if(url&&secret&&/^http:\/\/127\.0\.0\.1:\d+\//.test(url)){
 try{await fetch(url,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({secret,kind}),signal:AbortSignal.timeout(2000)});}catch{}
}
process.exit(0);
