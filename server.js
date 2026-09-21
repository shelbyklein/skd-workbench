import http from 'node:http';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { execFile } from 'node:child_process';
import {pinBenchmark} from './lib/benchmarks.js';
import { Workflows } from './lib/workflows.js';
import { CodexRuns } from './lib/codex.js';
import { Store } from './lib/store.js';
import { Problem, assert } from './lib/domain.js';
import { canonicalFolder, inspectFolder } from './lib/projects.js';
const root = path.dirname(fileURLToPath(import.meta.url));
const files = {'/':'index.html','/app.js':'app.js','/pwa.js':'pwa.js','/codex-ui.js':'codex-ui.js','/workflows-ui.js':'workflows-ui.js','/sw.js':'sw.js','/style.css':'style.css','/icon.svg':'icon.svg','/manifest.webmanifest':'manifest.webmanifest',
  '/icons/icon-192.png':'icons/icon-192.png','/icons/icon-512.png':'icons/icon-512.png','/icons/maskable-512.png':'icons/maskable-512.png','/icons/apple-touch-icon.png':'icons/apple-touch-icon.png'};
const mime={'.html':'text/html','.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml','.png':'image/png','.webmanifest':'application/manifest+json'};
async function body(req) {
  assert(req.headers['content-type']?.split(';')[0] === 'application/json','Expected JSON.',415);
  let result='';
  for await (const chunk of req) { result+=chunk; assert(Buffer.byteLength(result)<=1024*1024,'Request is too large.',413); }
  try { const parsed=JSON.parse(result); assert(parsed && typeof parsed==='object' && !Array.isArray(parsed),'Expected a JSON object.'); return parsed; }
  catch(e) { if(e instanceof Problem) throw e; throw new Problem('Invalid JSON.'); }
}
export function createServer({directory = process.env.FLOW_BENCH_DATA || path.join(root,'.data'), publicDirectory=path.join(root,'public'), codexOptions={}} = {}) {
  const store = new Store(directory);
  const codex = new CodexRuns(directory,codexOptions);
  const workflows = new Workflows(directory,codex);
  const server = http.createServer(async (req,res)=>{
    const json=(value,status=200)=>{res.writeHead(status,{'Content-Type':'application/json'});res.end(JSON.stringify(value));};
    res.setHeader('Cache-Control','no-store');
    res.setHeader('X-Content-Type-Options','nosniff');
    res.setHeader('Content-Security-Policy',"default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self'; connect-src 'self'; worker-src 'self'; manifest-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'");
    try {
      const host=req.headers.host || '';
      assert(/^(127\.0\.0\.1|localhost):\d+$/.test(host),'Local access only.',403);
      const origin=req.headers.origin;
      assert(!origin || origin===`http://${host}`,'Cross-origin requests are not allowed.',403);
      const url=new URL(req.url,`http://${host}`), pathname=url.pathname;
      if(req.method==='GET'&&pathname==='/api/health')return json({app:'skd-workbench',ok:true,version:'0.5.0'});
      const artifact=pathname.match(/^\/api\/artifacts\/([a-f0-9-]{36})$/);
      if(artifact&&req.method==='GET'){
        const records=[...codex.runs,...workflows.runs];assert(records.some(r=>r.artifact?.id===artifact[1]||r.reset?.artifact?.id===artifact[1]),'Archive not found.',404);
        res.setHeader('Content-Type','application/json');res.setHeader('Content-Disposition',`attachment; filename="skd-${artifact[1]}.json"`);
        return res.end(readFileSync(path.join(directory,'artifacts',artifact[1]+'.json')));
      }
      const benchmark=pathname.match(/^\/api\/projects\/([\w-]+)\/benchmark$/);
      if(benchmark&&req.method==='PUT'){
        const input=await body(req),p=store.project(benchmark[1]);
        assert(typeof input.enabled==='boolean','Choose whether benchmark reset is enabled.');
        const pinned=input.enabled?await pinBenchmark(p.folderPath,input.ref||'HEAD'):null;
        return json(store.setBenchmark(p.id,input.version,pinned));
      }
      if(req.method==='GET'&&pathname==='/api/workflows')return json(workflows.list(url.searchParams.get('projectID')));
      if(req.method==='POST'&&pathname==='/api/workflows'){
        const input=await body(req),flow=store.snapshot().flows.find(f=>f.id===input.flowID);assert(flow,'Flow not found.',404);
        return json(await workflows.start(input,flow,store.project(flow.projectID)),202);
      }
      const workflow=pathname.match(/^\/api\/workflows\/([\w-]+)(\/action)?$/);
      if(workflow&&req.method==='GET'&&!workflow[2])return json(workflows.get(workflow[1]));
      if(workflow&&req.method==='POST'&&workflow[2])return json(workflows.action(workflow[1],await body(req)));
      if(req.method==='GET'&&pathname==='/api/codex/provider'){
        try{return json(await codex.discover());}catch(e){return json({available:false,error:e.code==='ENOENT'?'Codex CLI not found. Install it and sign in with codex login.':e.message},503);}
      }
      if(req.method==='GET'&&pathname==='/api/codex/runs')return json(codex.list(url.searchParams.get('projectID')).filter(r=>!r.workflowID));
      if(req.method==='POST'&&pathname==='/api/codex/runs'){
        const input=await body(req),project=store.project(input.projectID);
        return json(await codex.start(input,project),202);
      }
      const codexRun=pathname.match(/^\/api\/codex\/runs\/([\w-]+)(\/stop)?$/);
      if(codexRun&&req.method==='GET'&&!codexRun[2])return json(codex.get(codexRun[1]));
      if(codexRun&&req.method==='POST'&&codexRun[2]){await body(req);return json(codex.stop(codexRun[1]));}
      if(req.method==='GET' && pathname==='/api/state') return json(store.snapshot());
      if(req.method==='POST' && pathname==='/api/projects'){
        const input=await body(req);input.folderPath=await canonicalFolder(input.folderPath);
        return json(store.createProject(input),201);
      }
      const project=pathname.match(/^\/api\/projects\/([\w-]+)$/);
      if(project&&req.method==='PUT'){
        const input=await body(req);input.folderPath=await canonicalFolder(input.folderPath);
        return json(store.updateProject(project[1],input));
      }
      const connection=pathname.match(/^\/api\/projects\/([\w-]+)\/connection$/);
      if(connection&&req.method==='GET'){
        const project=store.project(connection[1]);
        if(!project.folderPath)return json({projectID:project.id,projectVersion:project.version,available:false,folderPath:null,git:null,message:'Choose a project folder to connect Git.'});
        try {return json({projectID:project.id,projectVersion:project.version,...await inspectFolder(project.folderPath)});}
        catch(e){if(!(e instanceof Problem))throw e;return json({projectID:project.id,projectVersion:project.version,available:false,folderPath:project.folderPath,git:null,message:e.message});}
      }
      if(req.method==='POST' && pathname==='/api/flows') return json(store.createFlow(await body(req)),201);
      const flow=pathname.match(/^\/api\/flows\/([\w-]+)$/);
      if(flow && req.method==='PUT') return json(store.updateFlow(flow[1],await body(req)));
      if(flow && req.method==='DELETE') return json(store.deleteFlow(flow[1],(await body(req)).version));
      if(req.method==='POST' && pathname==='/api/runs'){
        const input=await body(req),flow=store.snapshot().flows.find(f=>f.id===input.flowID);
        assert(flow,'Flow not found.',404);
        const project=store.project(flow.projectID);
        const context=project.folderPath?await inspectFolder(project.folderPath):null;
        return json(store.createRun(input,context,project.version),201);
      }
      const run=pathname.match(/^\/api\/runs\/([\w-]+)\/action$/);
      if(run && req.method==='POST') return json(store.transition(run[1],await body(req)));
      if(req.method==='GET' && files[pathname]) {
        const name=files[pathname];
        res.setHeader('Content-Type',mime[path.extname(name)]);
        return res.end(readFileSync(path.join(publicDirectory,name)));
      }
      throw new Problem('Not found.',404);
    } catch(e) { json({error:e instanceof Problem?e.message:'Could not save or load data. Your previous saved state is intact.'},e.status||500); if(!(e instanceof Problem)) console.error(e); }
  });
  server.on('close',()=>workflows.shutdown());
  server.shutdownCodex=()=>workflows.shutdown();
  return server;
}
if(process.argv[1] && path.resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
  const port=Number(process.env.PORT||4390);
  const server=createServer();
  for(const signal of ['SIGTERM','SIGINT'])process.once(signal,()=>{server.shutdownCodex();server.closeAllConnections();server.close(()=>process.exit(0));});
  server.on('error',e=>{console.error(e.code==='EADDRINUSE'?`Port ${port} is busy. Choose another with PORT=4391 npm start.`:e.message);process.exitCode=1;});
  server.listen(port,'127.0.0.1',()=>{
    const url=`http://127.0.0.1:${port}`;
    console.log(`SKD Workbench → ${url}`);
    if(process.argv.includes('--open')) execFile(process.platform==='darwin'?'open':'xdg-open',[url],err=>{if(err)console.log('Open the URL above in your browser.');});
  });
}
