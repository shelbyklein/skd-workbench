import {WorkspaceTasks} from './lib/workspace-tasks.js';
import {randomUUID} from 'node:crypto';
import {ImportedSessions} from './lib/imported-sessions.js';
import {QuickActions} from './lib/quick-actions.js';
import {Settings,instructionFiles} from './lib/settings.js';
import {createFolderPicker} from './lib/folder-picker.js';
import {captureIssueSteps} from './lib/issue-steps.js';
import {GitHubIssues,IssueProposals} from './lib/issues.js';
import {IssueWork} from './lib/issue-work.js';
import {TerminalSessions} from './lib/terminals.js';
import http from 'node:http';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { execFile } from 'node:child_process';
import {pinBenchmark} from './lib/benchmarks.js';
import { Delegations } from './lib/delegations.js';
import { Workflows } from './lib/workflows.js';
import { CodexRuns } from './lib/codex.js';
import { Store } from './lib/store.js';
import { Problem, assert } from './lib/domain.js';
import { canonicalFolder, inspectFolder } from './lib/projects.js';
import {projectGraft} from './lib/graft-view.js';
import {Skills} from './lib/skills.js';
import {Connections} from './lib/connections.js';
import {withRegistrations,changeRegistration} from './lib/workspace-registration.js';
import {GitStatus} from './lib/git-status.js';
import {Playbooks} from './lib/playbooks.js';
const root = path.dirname(fileURLToPath(import.meta.url));
const files = {'/workspace-tasks-ui.js':'workspace-tasks-ui.js','/delegations-ui.js':'delegations-ui.js','/quick-actions-ui.js':'quick-actions-ui.js','/session-import-ui.js':'session-import-ui.js','/git-status-ui.js':'git-status-ui.js','/agent-card.js':'agent-card.js','/planning-ui.js':'planning-ui.js','/knowledge-ui.js':'knowledge-ui.js','/skills-ui.js':'skills-ui.js','/connections-ui.js':'connections-ui.js','/playbooks-ui.js':'playbooks-ui.js','/settings-ui.js':'settings-ui.js','/markdown.js':'markdown.js','/theme.js':'theme.js','/':'index.html','/app.js':'app.js','/pwa.js':'pwa.js','/issues-ui.js':'issues-ui.js','/terminal-ui.js':'terminal-ui.js','/codex-ui.js':'codex-ui.js','/workflows-ui.js':'workflows-ui.js','/sw.js':'sw.js','/style.css':'style.css','/icon.svg':'icon.svg','/manifest.webmanifest':'manifest.webmanifest',
  '/icons/icon-192.png':'icons/icon-192.png','/icons/icon-512.png':'icons/icon-512.png','/icons/maskable-512.png':'icons/maskable-512.png','/icons/apple-touch-icon.png':'icons/apple-touch-icon.png'};
const mime={'.html':'text/html','.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml','.png':'image/png','.webmanifest':'application/manifest+json'};
async function body(req,limit=1024*1024) {
  assert(req.headers['content-type']?.split(';')[0] === 'application/json','Expected JSON.',415);
  const chunks=[];let length=0;
  for await (const chunk of req) { length+=chunk.length;assert(length<=limit,'Request is too large.',413);chunks.push(chunk); }
  try { const parsed=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(Buffer.concat(chunks))); assert(parsed && typeof parsed==='object' && !Array.isArray(parsed),'Expected a JSON object.'); return parsed; }
  catch(e) { if(e instanceof Problem) throw e; throw new Problem('Invalid JSON.'); }
}
export function createServer({directory = process.env.FLOW_BENCH_DATA || path.join(root,'.data'), publicDirectory=path.join(root,'public'), codexOptions={},claudeOptions={},terminalOptions={},githubOptions={},skillsOptions={},connectionsOptions={},gitStatusOptions={},quickActionOptions={},folderPicker=createFolderPicker()} = {}) {
  const store = new Store(directory);
  const imports=new ImportedSessions(directory);
  const gitStatus=new GitStatus(gitStatusOptions);
  const globalSettings=new Settings(directory);
  const skills=new Skills(directory,skillsOptions);
  const mcpConnections=new Connections(directory,{...connectionsOptions,...(codexOptions.binary?{codexBinary:codexOptions.binary}:{})});
  const playbooks=new Playbooks(directory,{skills,connections:mcpConnections});
  const codex = new CodexRuns(directory,{...codexOptions,claudeOptions,skills,connections:mcpConnections,playbooks});
  const github=new GitHubIssues(githubOptions);
  const captureIssues=async(flow,project)=>{const snapshots=await captureIssueSteps(flow,project,github);assert(store.snapshot().flows.some(f=>f.id===flow.id&&f.version===flow.version&&f.projectID===project.id)&&store.project(project.id).version===project.version,'Flow or project changed while reading issues. Reload before running.',409);return snapshots;};
  const workflows = new Workflows(directory,codex,{captureIssues});
  const delegations = new Delegations(directory,codex);
  const terminals = new TerminalSessions(directory,codex,{...terminalOptions,skills,connections:mcpConnections,playbooks});
  const workspaceTasks=new WorkspaceTasks(directory,{notes:codex.workspaceNotes,gitStatus,executor:codex,terminals,project:id=>store.project(id),projects:()=>store.snapshot().projects,originContext:registration=>{
    const origin=registration.origin;
    const records=origin.kind==='workflow'?workflows.runs:origin.kind==='delegation'?delegations.runs:origin.kind==='terminal'?terminals.runs:origin.kind==='session'?codex.runs:[];
    const record=records.find(r=>r.id===origin.id&&r.projectID===registration.projectID);
    // Terminal labels can be generic (for example, Issue work); retain the frozen launch instructions.
    const task=origin.kind==='terminal'&&record?.initialPrompt?record.initialPrompt:record?.task;
    return task&&!['Codex session','Claude session'].includes(task)?{task,acceptance:record.acceptance||''}:null;
  }});
  const quickActions=new QuickActions(directory,{terminals,github,project:id=>store.project(id),...quickActionOptions});
  const proposals=new IssueProposals(directory,codex,github);
  const issueWork=new IssueWork(directory,{github,terminals,providers:agent=>agent==='claude'?codex.discoverClaude():codex.discover()});
  const server = http.createServer(async (req,res)=>{
    const json=(value,status=200)=>{res.writeHead(status,{'Content-Type':'application/json'});res.end(JSON.stringify(value));};
    res.setHeader('Cache-Control','no-store');
    res.setHeader('X-Content-Type-Options','nosniff');
    res.setHeader('Content-Security-Policy',"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self'; connect-src 'self'; worker-src 'self'; manifest-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'");
    try {
      const host=req.headers.host || '';
      assert(/^(127\.0\.0\.1|localhost):\d+$/.test(host),'Local access only.',403);
      const origin=req.headers.origin;
      assert(!origin || origin===`http://${host}`,'Cross-origin requests are not allowed.',403);
      const url=new URL(req.url,`http://${host}`), pathname=url.pathname;
      if(pathname==='/api/settings'&&req.method==='GET')return json(globalSettings.data);
      if(pathname==='/api/settings'&&req.method==='PUT')return json(globalSettings.save(await body(req),store.snapshot().projects));
      if(pathname==='/api/instructions'&&req.method==='GET')return json(await instructionFiles(root));
      const projectInstructions=pathname.match(/^\/api\/projects\/([\w-]+)\/instructions$/);
      if(projectInstructions&&req.method==='GET')return json(await instructionFiles(store.project(projectInstructions[1]).folderPath));
      if(req.method==='POST'&&pathname==='/api/choose-folder'){await body(req);return json(await folderPicker());}
      if(req.method==='GET'&&pathname==='/api/health')return json({app:'skd-workbench',ok:true,version:'0.5.0'});
      if(pathname==='/api/skills'&&req.method==='GET')return json(await skills.inventory(store.snapshot().projects,url.searchParams.get('scope')==='project'?{kind:'project',projectID:url.searchParams.get('projectID')}:{kind:'global'}));
      if(pathname==='/api/skills'&&req.method==='POST'){const input=await body(req);return json(input.discoveredID?await skills.import(input,store.snapshot().projects):skills.create(input,store.snapshot().projects),201);}
      if(pathname==='/api/skills/policies'&&req.method==='PUT')return json(skills.savePolicy(await body(req),store.snapshot().projects));
      const skill=pathname.match(/^\/api\/skills\/([\w-]+)(?:\/(archive))?$/);
      if(skill&&req.method==='PUT'&&!skill[2])return json(skills.update(skill[1],await body(req),store.snapshot().projects));
      if(skill&&req.method==='POST'&&skill[2])return json(skills.archive(skill[1],await body(req)));
      if(pathname==='/api/connections'&&req.method==='GET')return json(await mcpConnections.inventory(store.snapshot().projects,url.searchParams.get('scope')==='project'?{kind:'project',projectID:url.searchParams.get('projectID')}:{kind:'global'}));
      if(pathname==='/api/connections/policies'&&req.method==='PUT')return json(await mcpConnections.savePolicy(await body(req),store.snapshot().projects));
      if(pathname==='/api/playbooks'&&req.method==='GET')return json(playbooks.inventory(store.snapshot().projects,url.searchParams.get('scope')==='project'?{kind:'project',projectID:url.searchParams.get('projectID')}:{kind:'global'}));
      if(pathname==='/api/playbooks'&&req.method==='POST')return json(await playbooks.create(await body(req),store.snapshot().projects),201);
      if(pathname==='/api/playbooks/defaults'&&req.method==='PUT'){const input=await body(req);return json(input.playbookID?await playbooks.saveDefault(input,store.snapshot().projects):playbooks.clearDefault(input,store.snapshot().projects));}
      const playbook=pathname.match(/^\/api\/playbooks\/([\w-]+)(?:\/(archive|duplicate))?$/);
      if(playbook&&req.method==='PUT'&&!playbook[2])return json(await playbooks.update(playbook[1],await body(req),store.snapshot().projects));
      if(playbook&&req.method==='POST'&&playbook[2]==='archive')return json(playbooks.archive(playbook[1],await body(req)));
      if(playbook&&req.method==='POST'&&playbook[2]==='duplicate')return json(await playbooks.duplicate(playbook[1],await body(req),store.snapshot().projects),201);
      const playbookPreview=pathname.match(/^\/api\/projects\/([\w-]+)\/playbook-preview$/);
      if(playbookPreview&&req.method==='POST'){const input=await body(req);return json(await playbooks.preview(store.project(playbookPreview[1]),input.agent,input.playbook||{mode:'inherit'},{purpose:'session',mode:input.mode||'worktree'}));}
      const connectionCheck=pathname.match(/^\/api\/projects\/([\w-]+)\/connections\/([a-f0-9]{64})\/checks$/);
      if(connectionCheck&&req.method==='POST'){await body(req);return json(await mcpConnections.startCheck(store.project(connectionCheck[1]),connectionCheck[2]),202);}
      const checkStatus=pathname.match(/^\/api\/projects\/([\w-]+)\/connection-checks\/([\w-]+)$/);
      if(checkStatus&&req.method==='GET')return json(mcpConnections.check(checkStatus[2],checkStatus[1]));
      const artifact=pathname.match(/^\/api\/artifacts\/([a-f0-9-]{36})$/);
      if(artifact&&req.method==='GET'){
        const records=[...codex.runs,...workflows.runs,...terminals.runs];assert(records.some(r=>r.artifact?.id===artifact[1]||r.reset?.artifact?.id===artifact[1]),'Archive not found.',404);
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
      const delegationRoute=pathname.match(/^\/api\/projects\/([\w-]+)\/delegations(?:\/(requests)\/([\w-]+)|\/([\w-]+)(\/action)?)?$/);
      if(delegationRoute){
        const [,projectID,request,key,runID,action]=delegationRoute,project=store.project(projectID);
        if(request&&req.method==='GET')return json(delegations.request(projectID,key));
        if(runID){const run=delegations.get(runID);assert(run.projectID===projectID,'Delegation not found.',404);if(req.method==='GET'&&!action)return json(run);if(req.method==='POST'&&action)return json(delegations.action(runID,await body(req)));}
        else if(!request){if(req.method==='GET')return json(delegations.list(projectID));if(req.method==='POST'){const input=await body(req);assert(input.projectVersion===project.version,'Project changed. Reload before running.',409);return json(await delegations.start(input,project,()=>assert(store.project(project.id).version===project.version,'Project changed while preparing delegation. Reload before running.',409)),202);}}
      }
      if(req.method==='GET'&&pathname==='/api/workflows')return json(workflows.list(url.searchParams.get('projectID')));
      if(req.method==='POST'&&pathname==='/api/workflows'){
        const input=await body(req),flow=store.snapshot().flows.find(f=>f.id===input.flowID);assert(flow,'Flow not found.',404);
        const project=store.project(flow.projectID);if(input.projectVersion!==undefined)assert(project.version===input.projectVersion,'Project changed. Reload before running.',409);
        return json(await workflows.start(input,flow,project),202);
      }
      const workflow=pathname.match(/^\/api\/workflows\/([\w-]+)(\/action)?$/);
      if(workflow&&req.method==='GET'&&!workflow[2])return json(workflows.get(workflow[1]));
      if(workflow&&req.method==='POST'&&workflow[2])return json(workflows.action(workflow[1],await body(req)));
      const terminalProvider=pathname.match(/^\/api\/terminal-agents\/(codex|claude)$/);
      if(req.method==='GET'&&terminalProvider){try{return json(await terminals.provider(terminalProvider[1]));}catch(e){return json({error:e.code==='ENOENT'?'Agent CLI not installed.':e.message},503);}}
      if(req.method==='POST'&&pathname==='/api/session-imports'){
        const input=await body(req,6*1024*1024),project=store.project(input.projectID);
        assert(input.projectVersion===project.version,'Project changed. Reload before importing.',409);
        return json(await imports.create(input,project,()=>assert(store.project(project.id).version===project.version,'Project changed while importing. Reload before retrying.',409)),201);
      }
      const quickRequest=pathname.match(/^\/api\/projects\/([\w-]+)\/quick-actions\/requests\/([\w-]{8,100})$/);
      if(quickRequest&&req.method==='GET')return json(quickActions.request(store.project(quickRequest[1]),quickRequest[2]));
      const quickAction=pathname.match(/^\/api\/projects\/([\w-]+)\/quick-actions$/);
      if(quickAction){const project=store.project(quickAction[1]);if(req.method==='GET')return json(quickActions.settings(project));if(req.method==='PUT')return json(await quickActions.save(project,await body(req)));if(req.method==='POST')return json(await quickActions.start(project,await body(req)),202);}
      if(req.method==='POST'&&pathname==='/api/terminal-sessions'){const raw=await body(req),input=Object.fromEntries(['projectID','agent','model','effort','mode','playbook','skills','connections','importedSessionID'].filter(key=>Object.hasOwn(raw,key)).map(key=>[key,raw[key]]));assert(['read-only','worktree'].includes(input.mode),'Choose a workspace.');const project=store.project(input.projectID);if(input.importedSessionID)Object.assign(input,imports.context(input.importedSessionID,project.id,raw.task));const session=await terminals.start(input,project);quickActions.remember(project,input);return json(session,202);}
      const terminal=pathname.match(/^\/api\/terminal-sessions\/([\w-]+)(?:\/(output|input|resize|stop))?$/);
      if(terminal){const [,id,action]=terminal;
        if(req.method==='GET'&&action==='output')return json(terminals.output(id,Number(url.searchParams.get('cursor')||0)));
        if(req.method==='GET'&&!action)return json(terminals.get(id));
        if(req.method==='POST'){const input=await body(req);if(action==='input')return json(terminals.input(id,input.data));if(action==='resize')return json(terminals.resize(id,input.cols,input.rows));if(action==='stop')return json(terminals.stop(id));}
      }
      if(req.method==='GET'&&pathname==='/api/agents/claude'){
        try{return json(await codex.discoverClaude());}catch(e){return json({available:false,error:e.code==='ENOENT'?'Claude CLI not found. Install Claude Code, then run claude auth login.':e.message},503);}
      }
      if(req.method==='GET'&&['/api/codex/provider','/api/agents/codex'].includes(pathname)){
        try{return json(await codex.discover());}catch(e){return json({available:false,error:e.code==='ENOENT'?'Codex CLI not found. Install it and sign in with codex login.':e.message},503);}
      }
      if(req.method==='GET'&&['/api/codex/runs','/api/sessions'].includes(pathname))return json([...codex.list(url.searchParams.get('projectID')).filter(r=>!r.workflowID&&!r.purpose),...(pathname==='/api/sessions'?[...terminals.list(url.searchParams.get('projectID')),...imports.list(url.searchParams.get('projectID'))]:[])]);
      if(req.method==='POST'&&['/api/codex/runs','/api/sessions'].includes(pathname)){
        const input=await body(req),project=store.project(input.projectID);
        return json(await codex.start(input,project),202);
      }
      const codexRun=pathname.match(/^\/api\/(?:codex\/runs|sessions)\/([\w-]+)(\/stop)?$/);
      if(codexRun&&req.method==='GET'&&!codexRun[2])return json(imports.has(codexRun[1])?imports.get(codexRun[1]):terminals.has(codexRun[1])?terminals.get(codexRun[1]):codex.get(codexRun[1]));
      if(codexRun&&req.method==='POST'&&codexRun[2]){await body(req);return json(codex.stop(codexRun[1]));}
      const issueCount=pathname.match(/^\/api\/projects\/([\w-]+)\/issue-count$/);
      if(issueCount&&req.method==='GET')return json(await github.count(store.project(issueCount[1])));
      const sessionPlaybook=pathname.match(/^\/api\/sessions\/([\w-]+)\/playbooks(?:\/(draft))?$/);
      if(sessionPlaybook){const session=terminals.has(sessionPlaybook[1])?terminals.get(sessionPlaybook[1]):codex.get(sessionPlaybook[1]);if(req.method==='GET'&&sessionPlaybook[2])return json(await playbooks.sessionDraft(session,store.snapshot().projects));if(req.method==='POST'&&!sessionPlaybook[2])return json(await playbooks.createFromSession(await body(req),session,store.snapshot().projects),201);}
      const issues=pathname.match(/^\/api\/projects\/([\w-]+)\/issues(?:\/(\d+))?(\/proposals)?$/);
      if(issues){const project=store.project(issues[1]);
        if(req.method==='GET'&&issues[3])return json(proposals.list(project,issues[2]));
        if(req.method==='POST'&&issues[3])return json(await proposals.start(project,issues[2],await body(req)),202);
        if(req.method==='GET'&&issues[2]&&url.searchParams.get('view')==='initial'){
          const settings=await issueWork.resolve(project,issues[2]);
          return json({repository:settings.source.repository,issue:settings.source,settings,comments:[],commentsPage:0,hasMoreComments:settings.source.commentCount>0});
        }
        if(req.method==='GET'&&issues[2])return json(await github.detail(project,issues[2],url.searchParams.get('page')||1));
        if(req.method==='GET')return json(await github.list(project,{state:url.searchParams.get('state')||'open',page:url.searchParams.get('page')||1}));
      }
      const workSettings=pathname.match(/^\/api\/projects\/([\w-]+)\/issues\/(\d+)\/work-settings$/);
      if(workSettings){const project=store.project(workSettings[1]);
        if(req.method==='GET')return json(await issueWork.resolve(project,workSettings[2],{validate:true}));
        if(req.method==='PUT')return json(await issueWork.saveSettings(project,workSettings[2],await body(req)));
      }
      const issuePlanRuns=pathname.match(/^\/api\/projects\/([\w-]+)\/issues\/(\d+)\/plan-runs$/);
      if(issuePlanRuns&&req.method==='POST')return json(await issueWork.startPlanning(store.project(issuePlanRuns[1]),issuePlanRuns[2],await body(req)),202);
      const issueWorkRuns=pathname.match(/^\/api\/projects\/([\w-]+)\/issues\/(\d+)\/work-runs$/);
      if(issueWorkRuns&&req.method==='POST'){const project=store.project(issueWorkRuns[1]);return json(await issueWork.startSolo(project,issueWorkRuns[2],await body(req)),202);}
      const issueWorkRun=pathname.match(/^\/api\/projects\/([\w-]+)\/issue-work-runs\/([\w-]+)$/);
      if(issueWorkRun&&req.method==='GET')return json(issueWork.getRun(issueWorkRun[2],store.project(issueWorkRun[1])));
      const proposal=pathname.match(/^\/api\/projects\/([\w-]+)\/issue-proposals\/([\w-]+)(?:\/(apply|stop|verify))?$/);
      if(proposal){const project=store.project(proposal[1]);
        if(req.method==='GET'&&!proposal[3])return json(proposals.get(proposal[2],project));
        if(req.method==='POST'&&proposal[3]){await body(req);return json(await proposals[proposal[3]](proposal[2],project));}
      }
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
      const gitStatusRoute=pathname.match(/^\/api\/projects\/([\w-]+)\/git-status(?:\/(remote-check))?$/);
      if(gitStatusRoute){
        const project=store.project(gitStatusRoute[1]);let result;
        if(req.method==='GET'&&!gitStatusRoute[2])result=await gitStatus.read(project,{targetRef:url.searchParams.get('target')||'',remoteName:url.searchParams.get('remote')||''});
        else if(req.method==='POST'&&gitStatusRoute[2])result=await gitStatus.check(project,await body(req));
        else throw new Problem('Not found.',404);
        assert(store.project(project.id).version===project.version,'Project changed. Refresh local status.',409);
        const enriched=req.method==='GET'?await withRegistrations(result,project,codex.workspaceNotes):result;
        assert(store.project(project.id).version===project.version,'Project changed. Refresh local status.',409);
        if(req.method==='GET'&&enriched.worktrees){const {tasks}=workspaceTasks.list(project);for(const row of enriched.worktrees){const task=tasks.find(t=>t.registrationID===row.registration?.id&&t.state==='attached');if(task)row.taskID=task.id;}}
        return json(enriched);
      }
      const workspaceTaskRoute=pathname.match(/^\/api\/projects\/([\w-]+)\/workspace-tasks(?:\/(preview|adopt|continue))?$/);
      if(workspaceTaskRoute){
        const project=store.project(workspaceTaskRoute[1]),action=workspaceTaskRoute[2];
        if(req.method==='GET'&&!action)return json(workspaceTasks.list(project));
        assert(req.method==='POST'&&action,'Not found.',404);
        return json(await workspaceTasks[action](project,await body(req)),action==='continue'?202:200);
      }
      const registrationRoute=pathname.match(/^\/api\/projects\/([\w-]+)\/workspace-registration(?:\/(recover))?$/);
      if(registrationRoute){
        assert((registrationRoute[2]&&req.method==='POST')||(!registrationRoute[2]&&req.method==='PUT'),'Not found.',404);
        const project=store.project(registrationRoute[1]),input=await body(req);
        const recoveryOwner=registrationRoute[2]?'registration:'+randomUUID():null;
        if(recoveryOwner){assert(!codex.owner&&!codex.active&&!codex.starting&&!codex.cleaning&&!terminals.active,'Finish active execution before recovering registration.',409);codex.owner=recoveryOwner;}
        try{return json(await changeRegistration({project,input,notes:codex.workspaceNotes,gitStatus,recover:Boolean(recoveryOwner),validateProject:()=>assert(store.project(project.id).version===project.version,'Project changed. Refresh local status.',409)}));}
        finally{if(recoveryOwner&&codex.owner===recoveryOwner)codex.owner=null;}
      }
      const connection=pathname.match(/^\/api\/projects\/([\w-]+)\/connection$/);
      if(connection&&req.method==='GET'){
        const project=store.project(connection[1]);
        if(!project.folderPath)return json({projectID:project.id,projectVersion:project.version,available:false,folderPath:null,git:null,message:'Choose a project folder to connect Git.'});
        try {return json({projectID:project.id,projectVersion:project.version,...await inspectFolder(project.folderPath)});}
        catch(e){if(!(e instanceof Problem))throw e;return json({projectID:project.id,projectVersion:project.version,available:false,folderPath:project.folderPath,git:null,message:e.message});}
      }
      const graft=pathname.match(/^\/api\/projects\/([\w-]+)\/graft$/);
      if(graft&&req.method==='GET')return json(await projectGraft(store.project(graft[1]),{view:url.searchParams.get('view')||'',tab:url.searchParams.get('tab')||'',query:url.searchParams.get('query')||'',focus:url.searchParams.get('focus')||'',kind:url.searchParams.get('kind')||'',relation:url.searchParams.get('relation')||'',limit:url.searchParams.get('limit')||''}));
      if(req.method==='POST' && pathname==='/api/flows') return json(store.createFlow(await body(req)),201);
      const settings=pathname.match(/^\/api\/flows\/([\w-]+)\/settings$/);
      if(settings&&req.method==='PUT')return json(store.saveRunSettings(settings[1],await body(req)));
      const flow=pathname.match(/^\/api\/flows\/([\w-]+)$/);
      if(flow && req.method==='PUT') return json(store.updateFlow(flow[1],await body(req)));
      if(flow && req.method==='DELETE') return json(store.deleteFlow(flow[1],(await body(req)).version));
      if(req.method==='POST' && pathname==='/api/runs'){
        const input=await body(req),flow=store.snapshot().flows.find(f=>f.id===input.flowID);
        assert(flow,'Flow not found.',404);
        const project=store.project(flow.projectID);
        if(input.projectVersion!==undefined)assert(project.version===input.projectVersion,'Project changed. Reload before running.',409);
        const context=project.folderPath?await inspectFolder(project.folderPath):null;
        const snapshots=await captureIssues(flow,project);
        return json(store.createRun(input,context,project.version,snapshots),201);
      }
      const run=pathname.match(/^\/api\/runs\/([\w-]+)\/action$/);
      if(run && req.method==='POST') return json(store.transition(run[1],await body(req)));
      const vendor={'/vendor/xterm.js':'@xterm/xterm/lib/xterm.js','/vendor/xterm.css':'@xterm/xterm/css/xterm.css','/vendor/fit.js':'@xterm/addon-fit/lib/addon-fit.js','/vendor/cytoscape.js':'cytoscape/dist/cytoscape.min.js','/vendor/marked.js':'marked/lib/marked.esm.js','/vendor/dompurify.js':'dompurify/dist/purify.es.mjs'};
      if(req.method==='GET'&&vendor[pathname]){res.setHeader('Content-Type',mime[path.extname(pathname)]);return res.end(readFileSync(path.join(root,'node_modules',vendor[pathname])));}
      if(req.method==='GET' && files[pathname]) {
        const name=files[pathname];
        res.setHeader('Content-Type',mime[path.extname(name)]);
        return res.end(readFileSync(path.join(publicDirectory,name)));
      }
      throw new Problem('Not found.',404);
    } catch(e) { json({error:e instanceof Problem?e.message:'Could not save or load data. Your previous saved state is intact.'},e.status||500); if(!(e instanceof Problem)) console.error(e); }
  });
  server.on('close',()=>{mcpConnections.shutdown();terminals.shutdown();delegations.shutdown();workflows.shutdown();});
  server.shutdownCodex=()=>{mcpConnections.shutdown();terminals.shutdown();delegations.shutdown();workflows.shutdown();};
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
