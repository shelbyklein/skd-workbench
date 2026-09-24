#!/usr/bin/env node
// Session host: owns the coordinator and project agent CLI terminals so they outlive Workbench restarts.
// Workbench starts it detached on first use and talks to it over a private Unix socket (newline-delimited JSON).
// It knows nothing about Workbench: it spawns PTYs, keeps each one's recent output, and relays input, resizes,
// signals and exits. It exits on its own only after ten minutes with no sessions and no client.
import net from 'node:net';
import {existsSync,unlinkSync,chmodSync} from 'node:fs';
import * as pty from 'node-pty';

const HOST_VERSION=1;
const socketPath=process.argv[2],TAIL=262144,IDLE_MS=Number(process.env.SKD_SESSION_HOST_IDLE_MS||600000);
if(!socketPath){process.stderr.write('Usage: session-host.mjs <socket>\n');process.exit(2);}

const sessions=new Map(),clients=new Set();
let idleTimer=null;
const idle=()=>{clearTimeout(idleTimer);if(sessions.size||clients.size)return;idleTimer=setTimeout(()=>{if(!sessions.size&&!clients.size)shutdown();},IDLE_MS);};
const broadcast=message=>{const line=JSON.stringify(message)+'\n';for(const c of clients)if(!c.destroyed)c.write(line);};
const view=s=>({id:s.id,pid:s.pid,meta:s.meta,output:s.output,offset:s.offset,exited:s.exited,exitCode:s.exitCode,error:s.error||null});

function spawnSession({id,file,args,options,meta}){
 if(sessions.has(id))throw new Error('Session already exists.');
 const s={id,meta:meta??null,output:'',offset:0,exited:false,exitCode:null,pid:null};sessions.set(id,s);
 try{s.pty=pty.spawn(file,args,options);s.pid=s.pty.pid;}
 catch(error){s.exited=true;s.error=error.message;broadcast({event:'exit',id,exitCode:null,error:error.message});return view(s);}
 s.pty.onData(data=>{s.output+=data;if(s.output.length>TAIL){const trim=s.output.length-TAIL;s.output=s.output.slice(trim);s.offset+=trim;}broadcast({event:'data',id,data});});
 s.pty.onExit(({exitCode})=>{s.exited=true;s.exitCode=exitCode;s.pty=null;broadcast({event:'exit',id,exitCode});});
 return view(s);
}
function session(id){const s=sessions.get(id);if(!s)throw new Error('Session not found.');return s;}
const commands={
 hello:()=>({version:HOST_VERSION,pid:process.pid}),
 spawn:a=>spawnSession(a),
 write:({id,data})=>{const s=session(id);if(s.pty)s.pty.write(data);return true;},
 resize:({id,cols,rows})=>{const s=session(id);if(s.pty)s.pty.resize(cols,rows);return true;},
 kill:({id,signal})=>{const s=session(id);if(s.pty){try{s.pty.kill(signal);}catch{}}return true;},
 list:()=>[...sessions.values()].map(view),
 // Workbench recorded the exit; the host lets the session go.
 forget:({id})=>{const s=sessions.get(id);if(s&&!s.exited)throw new Error('Session is still running.');sessions.delete(id);idle();return true;},
};

const server=net.createServer(socket=>{
 clients.add(socket);clearTimeout(idleTimer);socket.setEncoding('utf8');let buffer='';
 socket.on('data',chunk=>{
  buffer+=chunk;let index;
  while((index=buffer.indexOf('\n'))>=0){
   const line=buffer.slice(0,index);buffer=buffer.slice(index+1);if(!line)continue;
   let request;try{request=JSON.parse(line);}catch{continue;}
   let reply;try{const handler=commands[request.cmd];if(!handler)throw new Error('Unknown command.');reply={seq:request.seq,ok:true,result:handler(request.args||{})};}
   catch(error){reply={seq:request.seq,ok:false,error:error.message};}
   if(request.seq!==undefined&&!socket.destroyed)socket.write(JSON.stringify(reply)+'\n');
  }
 });
 const drop=()=>{clients.delete(socket);idle();};
 socket.on('close',drop);socket.on('error',drop);
});
function shutdown(){for(const s of sessions.values())try{s.pty?.kill('SIGKILL');}catch{}server.close();try{unlinkSync(socketPath);}catch{}process.exit(0);}
for(const signal of ['SIGTERM','SIGINT'])process.on(signal,shutdown);
process.on('SIGHUP',()=>{}); // Detached from any terminal; a hangup is not a reason to drop the sessions.

// A leftover socket from a host that died is replaced; a live one means another host already serves it.
if(existsSync(socketPath)){
 const live=await new Promise(resolve=>{const probe=net.connect(socketPath,()=>{probe.destroy();resolve(true);});probe.on('error',()=>resolve(false));});
 if(live)process.exit(0);
 unlinkSync(socketPath);
}
server.listen(socketPath,()=>{chmodSync(socketPath,0o600);idle();});
