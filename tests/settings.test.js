import test from 'node:test';
import assert from 'node:assert/strict';
import {readdirSync,readFileSync,mkdtempSync,writeFileSync,mkdirSync,symlinkSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {Settings,instructionFiles} from '../lib/settings.js';
test('settings persist, reject stale edits and invalid colors',t=>{
 const dir=mkdtempSync(path.join(tmpdir(),'skd-settings-'));t.after(()=>rmSync(dir,{recursive:true,force:true}));
 const settings=new Settings(dir),initial=structuredClone(settings.data);
 settings.save({...initial,accents:{light:'#123456',dark:'#abcdef'},hiddenModels:['codex:one']});
 assert.equal(new Settings(dir).data.accents.dark,'#abcdef');
 assert.deepEqual(new Settings(dir).data.hiddenModels,['codex:one']);
 assert.throws(()=>settings.save(initial),/changed/);
 assert.throws(()=>settings.save({...settings.data,accents:{light:'red',dark:'#abcdef'}}),/valid accent/);
});
test('instruction previews read bounded project files without following outside symlinks',async t=>{
 const dir=mkdtempSync(path.join(tmpdir(),'skd-instructions-'));t.after(()=>rmSync(dir,{recursive:true,force:true}));
 const project=path.join(dir,'project');mkdirSync(project);mkdirSync(path.join(project,'instructions'));
 writeFileSync(path.join(project,'AGENTS.md'),'Project rules');
 writeFileSync(path.join(project,'instructions','work.md'),'Work rules');
 writeFileSync(path.join(dir,'private.md'),'Do not expose');symlinkSync(path.join(dir,'private.md'),path.join(project,'CLAUDE.md'));
 writeFileSync(path.join(project,'system.md'),'x'.repeat(128*1024+1));
 const result=await instructionFiles(project);
 assert.equal(result.files.find(f=>f.name==='AGENTS.md').content,'Project rules');
 assert.equal(result.files.find(f=>f.name==='instructions/work.md').content,'Work rules');
 assert(!result.files.some(f=>f.name==='CLAUDE.md'));
 assert.match(result.files.find(f=>f.name==='system.md').error,/limit/);
});
test('project tags migrate with an exact backup and retain assignments across rename and legacy saves',t=>{
 const dir=mkdtempSync(path.join(tmpdir(),'skd-tags-'));t.after(()=>rmSync(dir,{recursive:true,force:true}));
 const legacy=JSON.stringify({version:3,accents:{light:'#123456',dark:'#abcdef'},hiddenModels:['codex:one']});writeFileSync(path.join(dir,'settings.json'),legacy);
 const settings=new Settings(dir);assert.deepEqual(settings.data.projectTags,[]);
 const backups=readdirSync(dir).filter(x=>x.includes('.backup.'));assert.equal(backups.length,1);assert.equal(readFileSync(path.join(dir,backups[0]),'utf8'),legacy);
 const tags=[{id:'a',name:' Work ',projectIDs:['one','two']},{id:'b',name:'Personal',projectIDs:['one']}];
 settings.save({...settings.data,projectTags:tags},[{id:'one'},{id:'two'}]);assert.equal(new Settings(dir).data.projectTags[0].name,'Work');
 const stale=structuredClone(settings.data);settings.save({...settings.data,projectTags:[{...tags[0],name:'Client'},tags[1]]});assert.throws(()=>settings.save(stale),/changed/);
 const {projectTags,...oldClient}=settings.data;settings.save(oldClient);assert.deepEqual(settings.data.projectTags,projectTags);
 settings.save({...settings.data,projectTags:[settings.data.projectTags[1]]});assert.deepEqual(settings.data.projectTags[0].projectIDs,['one']);
 new Settings(dir);assert.equal(readdirSync(dir).filter(x=>x.includes('.backup.')).length,1);
});
test('project tags reject duplicates, invalid names, IDs and missing project assignments',t=>{
 const dir=mkdtempSync(path.join(tmpdir(),'skd-tags-invalid-'));t.after(()=>rmSync(dir,{recursive:true,force:true}));const settings=new Settings(dir),tag={id:'a',name:'Work',projectIDs:['one']};
 for(const tags of [null,[{...tag,name:' '}],[{...tag,name:'x'.repeat(51)}],[tag,{...tag,id:'b',name:'work'}],[tag,{...tag,name:'Other'}],[{...tag,projectIDs:['unassigned']}],[{...tag,projectIDs:'one'}]])assert.throws(()=>settings.save({...settings.data,projectTags:tags}));
 assert.throws(()=>settings.save({...settings.data,projectTags:[tag]},[]),/no longer exists/);
 assert.deepEqual(settings.data.projectTags,[]);
});
test('damaged settings never become empty defaults during tag migration',t=>{
 const dir=mkdtempSync(path.join(tmpdir(),'skd-tags-damaged-'));t.after(()=>rmSync(dir,{recursive:true,force:true}));
 for(const content of ['', '{', JSON.stringify({version:1,accents:{light:'#123456',dark:'#abcdef'},hiddenModels:[],projectTags:null})]){writeFileSync(path.join(dir,'settings.json'),content);assert.throws(()=>new Settings(dir));assert.equal(readFileSync(path.join(dir,'settings.json'),'utf8'),content);}
});
test('tag colors persist, validate and survive clients that omit color',t=>{
 const dir=mkdtempSync(path.join(tmpdir(),'skd-tag-colors-'));t.after(()=>rmSync(dir,{recursive:true,force:true}));const settings=new Settings(dir);
 const tag={id:'a',name:'Work',projectIDs:[]};settings.save({...settings.data,projectTags:[tag]});assert.equal(settings.data.projectTags[0].color,'#bf502f');
 settings.save({...settings.data,projectTags:[{...tag,color:'#ffe066'}]});assert.equal(new Settings(dir).data.projectTags[0].color,'#ffe066');
 settings.save({...settings.data,projectTags:[tag]});assert.equal(settings.data.projectTags[0].color,'#ffe066');
 for(const color of ['red','#fff','#ffffff;display:none',null,42])assert.throws(()=>settings.save({...settings.data,projectTags:[{...tag,color}]}),/tag color/);
});
