import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,writeFileSync,symlinkSync,readFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {Skills} from '../lib/skills.js';

function fixture(t){
 const root=mkdtempSync(path.join(tmpdir(),'skd-skills-')),home=path.join(root,'home'),projectRoot=path.join(root,'project'),data=path.join(root,'data');
 mkdirSync(home,{recursive:true});mkdirSync(projectRoot,{recursive:true});
 const project={id:'project-a',name:'A',folderPath:projectRoot};
 t.after(()=>rmSync(root,{recursive:true,force:true}));return {root,home,projectRoot,data,project,skills:new Skills(data,{home})};
}
const saveSkill=(root,area,name,body)=>{const dir=path.join(root,area,'skills',name);mkdirSync(dir,{recursive:true});writeFileSync(path.join(dir,'SKILL.md'),body);return dir;};

test('skill discovery is bounded, scoped, metadata-only, and rejects escaping links',async t=>{
 const {root,home,projectRoot,project,skills}=fixture(t);
 saveSkill(home,'.codex','same','---\nname: Global same\ndescription: Codex copy\n---\nUse me.');
 saveSkill(projectRoot,'.agents','same','---\nname: Project same\ndescription: Universal copy\n---\nSee [helper](helper.js).');
 const outside=path.join(root,'outside');mkdirSync(outside);writeFileSync(path.join(outside,'SKILL.md'),'# Outside');
 const claudeRoot=path.join(projectRoot,'.claude','skills');mkdirSync(claudeRoot,{recursive:true});symlinkSync(outside,path.join(claudeRoot,'escape'));
 const global=await skills.inventory([project],{kind:'global'});assert.equal(global.discovered.filter(x=>x.name.includes('same')).length,2);assert(global.discovered.every(x=>!('absolutePath' in x)));
 const scoped=await skills.inventory([project],{kind:'project',projectID:project.id});assert(scoped.discovered.some(x=>x.name==='Project same'&&x.projectID===project.id&&x.warning));assert.equal(scoped.discovered.find(x=>x.name==='escape').status,'unavailable');
 assert.equal(JSON.parse(readFileSync(path.join(skills.file),'utf8')).entries.length,0);
});

test('managed skills keep history, revisions, scopes and exact imports',async t=>{
 const {home,project,skills}=fixture(t);saveSkill(home,'.agents','import-me','---\nname: Imported\ndescription: source\n---\nExact body');
 const found=await skills.inventory([project],{kind:'project',projectID:project.id}),native=found.discovered.find(x=>x.name==='Imported');
 const imported=await skills.import({revision:0,scope:{kind:'project',projectID:project.id},discoveredID:native.id},[project]);assert.match(imported.instructions,/Exact body/);assert.equal(imported.scope,'project');
 await assert.rejects(()=>skills.import({revision:0,scope:{kind:'global'},discoveredID:native.id},[project]),/changed|available/);
 const edited=skills.update(imported.id,{revision:1,scope:{kind:'global'},name:'Renamed',description:'next',instructions:'New body'},[project]);assert.equal(edited.version,2);assert.equal(edited.history.length,1);assert.equal(edited.history[0].instructions,imported.instructions);
 assert.throws(()=>skills.update(imported.id,{revision:1,scope:{kind:'global'},name:'stale',description:'',instructions:'x'},[project]),/another tab/);
 const archived=skills.archive(imported.id,{revision:2,archived:true});assert.equal(archived.archived,true);
});

test('skill policies enforce project scope, explicit empty, exclusions and immutable snapshots',t=>{
 const {project,skills}=fixture(t),other={id:'project-b',name:'B',folderPath:'/tmp/b'};
 const global=skills.create({revision:0,scope:{kind:'global'},name:'Global',description:'',instructions:'Global instructions'},[project,other]);
 const local=skills.create({revision:1,scope:{kind:'project',projectID:project.id},name:'Local',description:'',instructions:'Local instructions'},[project,other]);
 const policy=skills.savePolicy({revision:2,policyRevision:0,projectID:project.id,provider:'codex',mode:'inherit',skillIDs:[global.id,local.id],excludedIDs:[global.id]},[project,other]);assert.equal(policy.revision,1);
 const inherited=skills.resolve(project,'codex',{mode:'inherit',skillIDs:[]});assert.deepEqual(inherited.entries.map(x=>x.id),[local.id]);const frozen=structuredClone(inherited);
 assert.deepEqual(skills.resolve(project,'codex',{mode:'replace',skillIDs:[]}).entries,[]);
 assert.throws(()=>skills.resolve(other,'codex',{mode:'replace',skillIDs:[local.id]}),/another project/);
 skills.update(local.id,{revision:3,scope:{kind:'project',projectID:project.id},name:'Local',description:'',instructions:'Changed later'},[project,other]);assert.match(frozen.text,/Local instructions/);assert.doesNotMatch(frozen.text,/Changed later/);assert.equal(skills.validateSnapshot(project,'codex',frozen).entries[0].instructions,'Local instructions');skills.archive(local.id,{revision:4,archived:true});assert.throws(()=>skills.validateSnapshot(project,'codex',frozen),/revoked/);
});

test('skill store rejects oversized text, corrupt data and archived launch selections',t=>{
 const {data,project,skills}=fixture(t);assert.throws(()=>skills.create({revision:0,scope:{kind:'global'},name:'Huge',description:'',instructions:'x'.repeat(16*1024+1)},[project]),/16,384 bytes/);
 const entry=skills.create({revision:0,scope:{kind:'global'},name:'Fine',description:'',instructions:'fine'},[project]);skills.archive(entry.id,{revision:1,archived:true});assert.throws(()=>skills.resolve(project,'claude',{mode:'replace',skillIDs:[entry.id]}),/unavailable/);
 const corrupt=path.join(data,'broken');mkdirSync(corrupt);writeFileSync(path.join(corrupt,'skills.json'),'{}');assert.throws(()=>new Skills(corrupt),/Damaged skills library/);
});
