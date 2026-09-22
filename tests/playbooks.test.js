import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,readFileSync,writeFileSync,existsSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {Playbooks} from '../lib/playbooks.js';

const project={id:'project-a',name:'Project A',folderPath:'/tmp/project-a'};
function resources(){
 const skillRows=[{id:'global-skill',scope:'global',archived:false},{id:'project-skill',scope:'project',projectID:'project-a',archived:false},{id:'archived-skill',scope:'global',archived:true}];
 const connectionRows=[{id:'global-codex',provider:'codex',configured:true,shadowed:false,projectID:null},{id:'project-claude',provider:'claude',configured:true,shadowed:false,projectID:'project-a'}];
 return {skills:{inventory:async(_projects,scope)=>({managed:skillRows.filter(row=>scope.kind==='global'?row.scope==='global':row.scope==='global'||row.projectID===scope.projectID)})},connections:{inventory:async(_projects,scope)=>({connections:connectionRows.filter(row=>scope.kind==='global'?!row.projectID:!row.projectID||row.projectID===scope.projectID)})}};
}

test('versioned playbook CRUD preserves exact empty selections, history, backups and idempotent creates',async()=>{
 const directory=mkdtempSync(path.join(tmpdir(),'skd-playbooks-')),library=new Playbooks(directory,resources());
 const created=await library.create({revision:0,name:'Empty',description:'Exact none',scope:{kind:'global'},providers:['codex'],skillIDs:[],connectionIDs:[],creationRequestKey:'request-1'},[project]);
 assert.deepEqual(created.skillIDs,[]);assert.deepEqual(created.connectionIDs,[]);assert.equal(created.version,1);
 const retried=await library.create({revision:999,name:'Empty',description:'Exact none',scope:{kind:'global'},providers:['codex'],creationRequestKey:'request-1'},[project]);assert.equal(retried.id,created.id);assert.equal(library.data.revision,1);
 const updated=await library.update(created.id,{revision:1,version:1,name:'Empty renamed',description:'Still exact',scope:{kind:'global'},providers:['codex','claude'],skillIDs:['global-skill'],connectionIDs:['global-codex']},[project]);
 assert.equal(updated.version,2);assert.equal(updated.history[0].version,1);assert.deepEqual(updated.history[0].skillIDs,[]);assert(existsSync(path.join(directory,'playbooks.json.bak')));
 const archived=library.archive(created.id,{revision:2,version:2,archived:true});assert.equal(archived.version,3);assert.equal(archived.archived,true);
 assert.throws(()=>library.archive(created.id,{revision:2,version:3,archived:false}),/another tab/);
 assert.doesNotThrow(()=>JSON.parse(readFileSync(path.join(directory,'playbooks.json.bak'),'utf8')));
});

test('scope, provider resources, duplicate copies and revisioned project defaults are enforced',async()=>{
 const directory=mkdtempSync(path.join(tmpdir(),'skd-playbooks-scope-')),library=new Playbooks(directory,resources());
 await assert.rejects(()=>library.create({revision:0,name:'Bad',scope:{kind:'global'},providers:['claude'],skillIDs:['project-skill'],connectionIDs:[]},[project]),/outside this playbook scope/);
 const source=await library.create({revision:0,name:'Project tools',description:'',scope:{kind:'project',projectID:'project-a'},providers:['claude'],skillIDs:['project-skill'],connectionIDs:['project-claude']},[project]);
 const copy=await library.duplicate(source.id,{revision:1,name:'Project tools',creationRequestKey:'copy-1'},[project]);assert.notEqual(copy.id,source.id);assert.equal(copy.name,source.name);assert.equal(copy.source.playbookID,source.id);
 const saved=await library.saveDefault({revision:2,defaultRevision:0,projectID:'project-a',provider:'claude',playbookID:copy.id},[project]);assert.equal(saved.revision,1);
 await assert.rejects(()=>library.saveDefault({revision:3,defaultRevision:0,projectID:'project-a',provider:'claude',playbookID:source.id},[project]),/another tab/);
 const cleared=library.clearDefault({revision:3,defaultRevision:1,projectID:'project-a',provider:'claude'},[project]);assert.equal(cleared.playbookID,copy.id);
});

test('corrupt playbook stores fail visibly without replacement',()=>{
 const directory=mkdtempSync(path.join(tmpdir(),'skd-playbooks-corrupt-')),file=path.join(directory,'playbooks.json');writeFileSync(file,'{"schema":1,"revision":0,"entries":"broken","defaults":[]}');
 assert.throws(()=>new Playbooks(directory,resources()),/Damaged playbooks library/);assert.equal(readFileSync(file,'utf8'),'{"schema":1,"revision":0,"entries":"broken","defaults":[]}');
});

test('preview, project defaults, exact overrides and launch revalidation resolve deterministically',async()=>{
 const directory=mkdtempSync(path.join(tmpdir(),'skd-playbooks-preview-'));let skillVersion=1,connectionFingerprint='fingerprint-1';
 const skills={
  inventory:async()=>({managed:[{id:'skill',scope:'global',archived:false}]}),
  resolve:(_project,_provider,selection)=>({status:selection.skillIDs.length?'included':'empty',entries:selection.skillIDs.map(id=>({id,version:skillVersion,name:'Skill',scope:'global',instructions:'body'})),text:selection.skillIDs.length?'body':''})
 },connections={
  inventory:async()=>({connections:[{id:'connection',provider:'codex',configured:true,shadowed:false,projectID:null}]}),
  resolve:async(_project,_provider,selection)=>({status:selection.connectionIDs.length?'managed':'empty',connections:selection.connectionIDs.map(id=>({id,name:'fixture',provider:'codex',fingerprint:connectionFingerprint}))})
 },library=new Playbooks(directory,{skills,connections});
 const entry=await library.create({revision:0,name:'Default',scope:{kind:'global'},providers:['codex'],skillIDs:['skill'],connectionIDs:['connection']},[project]);await library.saveDefault({revision:1,defaultRevision:0,projectID:project.id,provider:'codex',playbookID:entry.id},[project]);
 const preview=await library.preview(project,'codex',{mode:'inherit'},{mode:'worktree'});assert.equal(preview.source,'project-default');assert.equal(preview.skills.entries[0].version,1);assert.equal(preview.connections.connections[0].fingerprint,'fingerprint-1');
 const launch=await library.resolveLaunch(project,'codex',{mode:'inherit',expectedSignature:preview.signature},{mode:'worktree'});assert.equal(launch.signature,preview.signature);
 const empty=await library.preview(project,'codex',{mode:'selected',playbookID:entry.id,version:1,overrides:{skillIDs:[],connectionIDs:[]}},{mode:'worktree'});assert.equal(empty.skills.status,'empty');assert.equal(empty.connections.status,'empty');
 skillVersion=2;await assert.rejects(()=>library.resolveLaunch(project,'codex',{mode:'inherit',expectedSignature:preview.signature},{mode:'worktree'}),/changed after preview/);
 skillVersion=1;connectionFingerprint='fingerprint-2';await assert.rejects(()=>library.resolveLaunch(project,'codex',{mode:'inherit',expectedSignature:preview.signature},{mode:'worktree'}),/changed after preview/);
});

test('session drafts use frozen configuration, annotate observed MCP separately and save safe provenance idempotently',async()=>{
 const directory=mkdtempSync(path.join(tmpdir(),'skd-playbooks-session-')),base=resources(),library=new Playbooks(directory,base),session={id:'session-1',projectID:project.id,agent:'claude',task:'Investigate',status:'running',initialPrompt:'secret prompt',workingDirectory:'/secret/worktree',agentContext:{playbook:{status:'selected',id:'source-playbook',version:4},skills:{entries:[{id:'project-skill',name:'Project skill',version:2,instructions:'frozen secret text'}]},connections:{status:'managed',connections:[{id:'project-claude',name:'Claude fixture',provider:'claude',fingerprint:'old-fingerprint'}]}},toolActivity:{coverage:{status:'complete',source:'claude-stream-json'},aggregates:{connections:[{id:'project-claude',name:'Claude fixture',count:1}],tools:[]}}};
 const draft=await library.sessionDraft(session,[project]);assert.deepEqual(draft.skillIDs,['project-skill']);assert.equal(draft.connections[0].observed,true);assert.equal(draft.skills[0].observed,'unknown');assert.equal(draft.sourcePlaybook.version,4);assert(!JSON.stringify(draft).includes('secret prompt'));assert(!JSON.stringify(draft).includes('/secret/worktree'));assert(!JSON.stringify(draft).includes('frozen secret text'));
 const saved=await library.createFromSession({revision:0,sourceSessionID:session.id,creationRequestKey:'session-save-1',name:'From session',description:'',scope:{kind:'project',projectID:project.id},providers:['claude'],skillIDs:draft.skillIDs,connectionIDs:draft.connectionIDs},session,[project]);assert.equal(saved.source.kind,'session');assert.equal(saved.source.sessionID,session.id);assert.equal(saved.source.playbookVersion,4);assert(!JSON.stringify(saved).includes('old-fingerprint'));
 const retried=await library.createFromSession({revision:999,sourceSessionID:session.id,creationRequestKey:'session-save-1',name:'From session',description:'',scope:{kind:'project',projectID:project.id},providers:['claude'],skillIDs:draft.skillIDs,connectionIDs:draft.connectionIDs},session,[project]);assert.equal(retried.id,saved.id);
 session.toolActivity.coverage.status='unavailable';assert.equal((await library.sessionDraft(session,[project])).observedOnlyAvailable,false);
});
