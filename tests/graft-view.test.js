import test from 'node:test';
import {execFileSync} from 'node:child_process';
import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,writeFileSync,rmSync,symlinkSync,existsSync} from 'node:fs';
import path from 'node:path';
import {tmpdir} from 'node:os';
import {projectGraft} from '../lib/graft-view.js';
import {createServer} from '../server.js';

const graph=(name='app.js')=>({
 meta:{version:1,nodeCount:3,edgeCount:3,languages:['javascript'],scopes:[]},
 nodes:[
  {id:`src/${name}`,name,kind:'file',path:`src/${name}`,span:'L1-L20',signature:null,exported:true,origin:'ast',body_hash:'not-for-the-client'},
  {id:`src/${name}#start`,name:'start',kind:'function',path:`src/${name}`,span:'L4-L8',signature:'function start()',exported:true,origin:'ast'},
  {id:'src/lib.js#read',name:'read',kind:'function',path:'src/lib.js',span:'L1-L3',signature:'function read()',exported:true,origin:'ast'}
 ],
 edges:[
  {source:`src/${name}`,target:`src/${name}#start`,relation:'contains',confidence:'extracted'},
  {source:`src/${name}#start`,target:'src/lib.js#read',relation:'calls',confidence:'extracted'},
  {source:`src/${name}#start`,target:'missing',relation:'calls',confidence:'extracted'}
 ]
});

function writeGraft(folder,name='app.js'){
 mkdirSync(path.join(folder,'graft','.graph'),{recursive:true});
 writeFileSync(path.join(folder,'graft','.graph','wiring.json'),JSON.stringify(graph(name)));
 writeFileSync(path.join(folder,'graft','INDEX.md'),'# Repository map\n\nLocal structural index.');
}

test('project Graft adapter validates, bounds, filters, and sanitizes a local index',async t=>{
 const root=mkdtempSync(path.join(tmpdir(),'skd-graft-adapter-'));t.after(()=>rmSync(root,{recursive:true,force:true}));writeGraft(root);
 const project={id:'fixture',folderPath:root};
 const summary=await projectGraft(project,{view:'summary'});
 assert.equal(summary.available,true);assert.deepEqual(summary.totals,{codeNodes:3,codeEdges:2,contextNodes:1,contextEdges:0});assert.equal(summary.diagnostics.codeDroppedEdges,1);assert.equal(summary.defaultTab,'code');
 const focused=await projectGraft(project,{tab:'code',focus:'src/app.js#start'});
 assert.equal(focused.focus,'src/app.js#start');assert.deepEqual(new Set(focused.nodes.map(node=>node.id)),new Set(['src/app.js#start','src/app.js','src/lib.js#read']));assert.equal(focused.edges.length,2);assert.equal('body_hash' in focused.nodes[0],false);
 const searched=await projectGraft(project,{tab:'code',query:'read'});assert.ok(searched.nodes.some(node=>node.name==='read'));
 const outline=await projectGraft(project,{tab:'outline'});assert.equal(outline.nodes.length,3);assert.ok(outline.edges.some(edge=>edge.relation==='contains'));
 const context=await projectGraft(project,{tab:'context'});assert.equal(context.nodes[0].id,'INDEX');assert.match(context.nodes[0].summary,/Repository map/);
 writeFileSync(path.join(root,'graft','runtime.md'),'---\nslug: runtime\nname: Runtime\ntype: system\nsources:\n  - path: src/app.js\nlinks:\n  - to: storage\n    relation: influences\n---\n## Summary\nStarts the application.');writeFileSync(path.join(root,'graft','storage.md'),'---\nslug: storage\nname: Storage\ntype: concept\nsources:\n  - path: src/store.js\n---\n## Summary\nReads saved state.');
 const deep=await projectGraft(project,{tab:'context'});assert.equal(deep.nodes.length,3);assert.ok(deep.edges.some(edge=>edge.source==='runtime'&&edge.target==='storage'&&edge.relation==='configures'));
});

test('project Graft adapter reports missing and malformed indexes without creating or rebuilding them',async t=>{
 const root=mkdtempSync(path.join(tmpdir(),'skd-graft-errors-'));t.after(()=>rmSync(root,{recursive:true,force:true}));
 const missing=await projectGraft({id:'missing',folderPath:root},{view:'summary'});assert.equal(missing.available,false);assert.match(missing.message,/No Graft index/);assert.equal(existsSync(path.join(root,'graft')),false);
 writeGraft(root);const file=path.join(root,'graft','.graph','wiring.json');const value=graph();value.meta.version=2;writeFileSync(file,JSON.stringify(value));
 await assert.rejects(()=>projectGraft({id:'bad',folderPath:root},{view:'summary'}),/version is not supported/);
});

test('project Graft adapter rejects an index symlink that escapes the project boundary',async t=>{
 const root=mkdtempSync(path.join(tmpdir(),'skd-graft-boundary-')),nested=mkdtempSync(path.join(tmpdir(),'skd-graft-nested-boundary-')),outside=mkdtempSync(path.join(tmpdir(),'skd-graft-outside-'));t.after(()=>{rmSync(root,{recursive:true,force:true});rmSync(nested,{recursive:true,force:true});rmSync(outside,{recursive:true,force:true});});writeGraft(outside);symlinkSync(path.join(outside,'graft'),path.join(root,'graft'));
 await assert.rejects(()=>projectGraft({id:'escape',folderPath:root},{view:'summary'}),/outside the project repository/);
 mkdirSync(path.join(nested,'graft'));writeFileSync(path.join(nested,'graft','INDEX.md'),'# Local index');symlinkSync(path.join(outside,'graft','.graph'),path.join(nested,'graft','.graph'));
 await assert.rejects(()=>projectGraft({id:'nested-escape',folderPath:nested},{view:'summary'}),/outside the project index/);
});

test('HTTP Graft route is project-bound and ignores arbitrary path input',async t=>{
 const data=mkdtempSync(path.join(tmpdir(),'skd-graft-api-')),projectFolder=mkdtempSync(path.join(tmpdir(),'skd-graft-project-')),outside=mkdtempSync(path.join(tmpdir(),'skd-graft-other-'));writeGraft(projectFolder,'project.js');writeGraft(outside,'outside.js');
 const server=createServer({directory:data});await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const url=`http://127.0.0.1:${server.address().port}`;
 try{
  const created=await fetch(url+'/api/projects',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({name:'Fixture',folderPath:projectFolder})});const project=await created.json();
  const response=await fetch(`${url}/api/projects/${project.id}/graft?tab=code&path=${encodeURIComponent(outside)}`);assert.equal(response.status,200);const result=await response.json();assert.ok(result.nodes.some(node=>node.name==='project.js'));assert.equal(result.nodes.some(node=>node.name==='outside.js'),false);
 }finally{server.closeAllConnections();await new Promise(resolve=>server.close(resolve));rmSync(data,{recursive:true,force:true});rmSync(projectFolder,{recursive:true,force:true});rmSync(outside,{recursive:true,force:true});}
});

function writeDevIndex(root,name='dev.js',generation='index-current'){
 const dir=path.join(root,'.graft-dev',generation);
 mkdirSync(path.join(dir,'.graph'),{recursive:true});
 writeFileSync(path.join(dir,'.graph','wiring.json'),JSON.stringify(graph(name)));
 writeFileSync(path.join(root,'.graft-dev','config.json'),JSON.stringify({root,graph:dir}));
 return dir;
}

test('development index uses the current generation and retains graph validation',async t=>{
 const root=mkdtempSync(path.join(tmpdir(),'skd-graft-dev-'));t.after(()=>rmSync(root,{recursive:true,force:true}));
 const project={id:'dev',folderPath:root};writeDevIndex(root);
 assert.equal((await projectGraft(project)).nodes[0].name,'dev.js');
 const next=writeDevIndex(root,'new.js','index-next');
 assert.equal((await projectGraft(project)).nodes[0].name,'new.js');
 const invalid=graph();invalid.meta.version=2;writeFileSync(path.join(next,'.graph','wiring.json'),JSON.stringify(invalid));
 await assert.rejects(()=>projectGraft(project),/version is not supported/);
 writeFileSync(path.join(root,'.graft-dev','config.json'),'{broken');
 await assert.rejects(()=>projectGraft(project),/configuration is unreadable/);
});

test('development index follows only an explicit same-repository checkout and its current pointer',async t=>{
 const base=mkdtempSync(path.join(tmpdir(),'skd-graft-worktree-')),root=path.join(base,'source'),worktree=path.join(base,'dev');
 t.after(()=>rmSync(base,{recursive:true,force:true}));mkdirSync(root);
 const git=(...args)=>execFileSync('git',['-C',root,...args],{stdio:'pipe'});
 git('init');git('-c','user.name=Fixture','-c','user.email=fixture@example.test','commit','--allow-empty','-m','fixture');git('worktree','add','-b','dev',worktree);
 const old=writeDevIndex(worktree,'old.js','index-old');writeDevIndex(worktree,'current.js','index-new');
 mkdirSync(path.join(root,'.graft-dev'));const config=path.join(root,'.graft-dev','config.json');
 writeFileSync(config,JSON.stringify({root:worktree,graph:old}));
 const result=await projectGraft({id:'source',folderPath:root});assert.equal(result.indexScope,'worktree');assert.equal(result.indexRoot,await import('node:fs/promises').then(fs=>fs.realpath(worktree)));assert.equal(result.nodes[0].name,'current.js');
 const outside=path.join(base,'unrelated');mkdirSync(outside);writeDevIndex(outside);
 writeFileSync(config,JSON.stringify({root:outside,graph:path.join(outside,'.graft-dev','index-current')}));
 await assert.rejects(()=>projectGraft({id:'source',folderPath:root}),/outside the project Git repository/);
});

test('development config and generation symlinks cannot escape their boundaries',async t=>{
 const base=mkdtempSync(path.join(tmpdir(),'skd-graft-dev-escape-')),root=path.join(base,'project'),outside=path.join(base,'outside');
 t.after(()=>rmSync(base,{recursive:true,force:true}));mkdirSync(root);mkdirSync(outside);const generation=writeDevIndex(outside);
 const project={id:'escape',folderPath:root};mkdirSync(path.join(root,'.graft-dev'));
 const config=path.join(root,'.graft-dev','config.json');symlinkSync(path.join(outside,'.graft-dev','config.json'),config);
 await assert.rejects(()=>projectGraft(project),/configuration resolves outside/);
 rmSync(config);const escaped=path.join(root,'.graft-dev','index-escape');symlinkSync(generation,escaped);
 writeFileSync(config,JSON.stringify({root,graph:escaped}));
 await assert.rejects(()=>projectGraft(project),/generation resolves outside/);
});
