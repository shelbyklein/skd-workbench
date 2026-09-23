import {WebSocketServer,WebSocket} from 'ws';
import {assert} from './domain.js';

// One acknowledged output frame per client. Slow consumers never grow a queue
// or stop an unrelated shell; the bounded transcript supports explicit replay.
export function attachTerminalStreams(server,{workspace,agents,coordinator,remoteAccess,ackTimeout=15000}){
 const wss=new WebSocketServer({noServer:true,maxPayload:70000,perMessageDeflate:false});
 async function upgrade(req,socket,head){
  let manager,id,cursor;
  try{
   const host=req.headers.host||'';
   // Remote shells need the same Cloudflare Access token as HTTP requests.
   if(remoteAccess?.isRemote(req))await remoteAccess.admit(req,{upgrade:true});
   else assert(/^(127\.0\.0\.1|localhost):\d+$/.test(host)&&req.headers.origin===`http://${host}`,'Local origin required.',403);
   assert(wss.clients.size<32,'Too many terminal connections.',429);
   const url=new URL(req.url,`http://${host}`),match=url.pathname.match(/^\/api\/(workspace-terminal|terminal-sessions|coordinator-terminal)\/([\w-]+)\/stream$/);
   assert(match,'Unknown terminal stream.',404);[, ,id]=match;manager=match[1]==='workspace-terminal'?workspace:match[1]==='coordinator-terminal'?coordinator:agents;assert(manager,'Unknown terminal stream.',404);
   cursor=Number(url.searchParams.get('cursor')||0);manager.output(id,cursor);
  }catch(e){socket.end(`HTTP/1.1 ${e.status||400} Rejected\r\nConnection: close\r\nContent-Length: 0\r\n\r\n`);return;}
  if(socket.destroyed)return;
  wss.handleUpgrade(req,socket,head,ws=>{
   let pending=null,timeout,scheduled,lastMeta='',first=true,disposed=false;
   const cleanup=()=>{if(disposed)return;disposed=true;clearTimeout(timeout);clearImmediate(scheduled);unsubscribe();};
   const fail=()=>{cleanup();ws.close(1008,'Invalid or stalled terminal stream');};
   function pump(){
    scheduled=null;if(disposed||pending!==null||ws.readyState!==WebSocket.OPEN)return;
    try{
     const result=manager.output(id,cursor),meta=JSON.stringify(result.session);
     if(!first&&!result.data&&!result.reset&&meta===lastMeta)return;
     const start=result.cursor-result.data.length;let data=result.data.slice(0,32768);
     // Do not split a UTF-16 surrogate pair between independent xterm writes.
     if(data.length<result.data.length&&/[\uD800-\uDBFF]/.test(data.at(-1)))data=data.slice(0,-1);
     const frame={type:'output',data,cursor:start+data.length,reset:result.reset,...(first||meta!==lastMeta?{session:result.session}:{})};
     pending=frame.cursor;lastMeta=meta;first=false;
     ws.send(JSON.stringify(frame));timeout=setTimeout(fail,ackTimeout);timeout.unref?.();
    }catch{fail();}
   }
   function schedule(){if(!scheduled&&!disposed)scheduled=setImmediate(pump);}
   const unsubscribe=manager.subscribe(id,schedule);
   ws.on('message',(raw,binary)=>{
    try{
     assert(!binary,'Text messages required.');const message=JSON.parse(raw.toString());assert(message&&typeof message==='object','Invalid message.');
     if(message.type==='ack'){assert(pending!==null&&message.cursor===pending,'Invalid acknowledgement.');cursor=pending;pending=null;clearTimeout(timeout);schedule();}
     else if(message.type==='input'){assert(typeof message.data==='string'&&Buffer.byteLength(message.data)<=16384,'Input too large.');manager.input(id,message.data);}
     else if(message.type==='resize')manager.resize(id,message.cols,message.rows);
     else throw Error('Unknown message');
    }catch{fail();}
   });
   ws.on('close',cleanup);ws.on('error',cleanup);pump();
  });
 }
 server.on('upgrade',upgrade);
 return {shutdown(){server.off('upgrade',upgrade);for(const ws of wss.clients)ws.terminate();wss.close();}};
}
