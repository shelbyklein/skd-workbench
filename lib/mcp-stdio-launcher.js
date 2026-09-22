// Private Claude MCP adapter: preserve the saved working directory without a shell.
import {spawn} from 'node:child_process';
const [cwd,command,...args]=process.argv.slice(2);
if(!cwd||!command)process.exit(2);
const child=spawn(command,args,{cwd,env:process.env,stdio:'inherit'});
child.on('error',()=>{process.stderr.write('MCP executable could not start.\n');process.exitCode=1;});
child.on('exit',(code,signal)=>{process.exitCode=code??(signal?1:0);});
for(const signal of ['SIGTERM','SIGINT','SIGHUP'])process.on(signal,()=>{child.kill(signal);});
