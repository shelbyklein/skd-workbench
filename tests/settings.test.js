import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,writeFileSync,mkdirSync,symlinkSync,rmSync} from 'node:fs';
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
