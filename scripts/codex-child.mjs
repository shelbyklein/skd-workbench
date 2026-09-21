// The CLI shares this process group. If the server disappears, stop the whole group.
import {spawn} from 'node:child_process';
const parent=process.ppid;
const child=spawn(process.argv[2],process.argv.slice(3),{stdio:'inherit'});
const timer=setInterval(()=>{
 if(process.ppid!==parent){try{process.kill(-process.pid,'SIGKILL');}catch{child.kill('SIGKILL');process.exit(1);}}
},1000);
child.on('error',e=>{console.error(e.message);clearInterval(timer);process.exit(127);});
child.on('exit',(code,signal)=>{clearInterval(timer);process.exit(code??(signal?1:0));});
