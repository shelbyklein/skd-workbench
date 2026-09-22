import {assert} from './domain.js';
// Explicit catalog check only. Redirects are rejected, including same-origin redirects.
export async function checkHttp(spec,{signal,limit=1024*1024}={}){
 let session=null,version='2025-06-18',bytes=0;
 const headers={'content-type':'application/json',accept:'application/json, text/event-stream',...(spec.headers||{}),...(spec.bearer_token_env_var?{Authorization:`Bearer ${process.env[spec.bearer_token_env_var]||''}`}:{})};
 async function send(message){
  const response=await fetch(spec.url,{method:'POST',redirect:'error',signal,headers:{...headers,...(session?{'Mcp-Session-Id':session,'MCP-Protocol-Version':version}:{})},body:JSON.stringify(message)});
  assert(response.ok,response.status===401||response.status===403?'Authentication failed. Check the service environment reference.':'HTTP catalog request failed.');
  if(response.headers.has('mcp-session-id')){const value=response.headers.get('mcp-session-id');assert(value.length<=1024&&!/[\r\n]/.test(value),'Invalid MCP session header.');session=value;}
  if(message.id===undefined){await response.body?.cancel();return;}
  const reader=response.body?.getReader();assert(reader,'Empty MCP response.');const decoder=new TextDecoder();let buffer='';const sse=(response.headers.get('content-type')||'').includes('text/event-stream');
  try{while(true){const {done,value}=await reader.read();if(done)break;bytes+=value.byteLength;assert(bytes<=limit,'Connection check output exceeded 1 MB.');buffer+=decoder.decode(value,{stream:true});if(sse){buffer=buffer.replace(/\r\n/g,'\n');let index;while((index=buffer.indexOf('\n\n'))>=0){const event=buffer.slice(0,index);buffer=buffer.slice(index+2);const data=event.split('\n').filter(l=>l.startsWith('data:')).map(l=>l.slice(5).trimStart()).join('\n');if(data){const parsed=JSON.parse(data);if(parsed.id===message.id)return parsed;}}}}
   assert(!sse,'MCP stream ended before its response.');const parsed=JSON.parse(buffer);assert(parsed.id===message.id,'MCP response ID did not match.');return parsed;
  }finally{await reader.cancel().catch(()=>{});}
 }
 try{const initialized=await send({jsonrpc:'2.0',id:1,method:'initialize',params:{protocolVersion:version,capabilities:{},clientInfo:{name:'skd-workbench',version:'0.5.0'}}});assert(!initialized.error&&initialized.result?.protocolVersion&&initialized.result?.serverInfo,'MCP initialization failed.');version=initialized.result.protocolVersion;await send({jsonrpc:'2.0',method:'notifications/initialized'});const tools=[];let cursor;
  for(let page=0;page<10;page++){const result=await send({jsonrpc:'2.0',id:page+2,method:'tools/list',params:cursor?{cursor}:{}});assert(!result.error&&Array.isArray(result.result?.tools),'Tool listing failed.');for(const tool of result.result.tools){assert(typeof tool.name==='string'&&tool.name.length<=150,'Invalid tool name.');tools.push(tool.name);}assert(tools.length<=100,'Tool catalog exceeds 100 tools.');cursor=result.result.nextCursor;if(!cursor)return tools;assert(typeof cursor==='string'&&cursor.length<=2048,'Invalid catalog cursor.');}throw Error('Tool catalog pagination exceeded limit.');
 }finally{if(session)await fetch(spec.url,{method:'DELETE',redirect:'error',headers:{...headers,'Mcp-Session-Id':session,'MCP-Protocol-Version':version},signal:AbortSignal.timeout(1000)}).then(r=>r.body?.cancel()).catch(()=>{});}
}
