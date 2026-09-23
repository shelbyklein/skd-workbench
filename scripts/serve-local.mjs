import {spawn} from 'node:child_process';
import {serverStatus,launcherRoot} from './launcher-service.mjs';
const status=await serverStatus();
if(status==='running')process.exit(0);
if(status!=='stopped'){console.error('Port 4390 is occupied or unavailable. Existing processes were left untouched.');process.exit(1);}
// Only one launchd job owns this wrapper; check for a manually started server first.
const env={...process.env,PORT:'4390'};delete env.FLOW_BENCH_DATA;
const child=spawn(process.execPath,['server.js'],{cwd:launcherRoot,env,stdio:'inherit'});
for(const signal of ['SIGTERM','SIGINT'])process.on(signal,()=>child.kill(signal));
child.on('error',error=>{console.error(error.message);process.exitCode=1;});
child.on('exit',(code)=>process.exit(code??1));
