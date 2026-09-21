import test from 'node:test';import assert from 'node:assert/strict';
import {createFolderPicker} from '../lib/folder-picker.js';
test('native chooser preserves spaces and uses a fixed script without shell input',async()=>{
 const pick=createFolderPicker({platform:'darwin',execute:(file,args,options,done)=>{assert.equal(file,'/usr/bin/osascript');assert.match(args[1],/choose folder/);assert.equal(options.timeout,120000);done(null,'/Users/Test/My Project/\n');}});
 assert.deepEqual(await pick(),{folderPath:'/Users/Test/My Project/'});
});
test('cancel is harmless and a pending picker rejects duplicates',async()=>{
 let done;const pick=createFolderPicker({platform:'darwin',execute:(f,a,o,cb)=>{done=cb;}});const pending=pick();await assert.rejects(pick(),/already open/);done(null,'\n');assert.deepEqual(await pending,{cancelled:true});
 const again=pick();done(null,'/tmp/\n');assert.deepEqual(await again,{folderPath:'/tmp/'});
});
test('unsupported platform and failure permit manual fallback',async()=>{
 await assert.rejects(createFolderPicker({platform:'linux'})(),/manually/);
 const pick=createFolderPicker({platform:'darwin',execute:(f,a,o,done)=>done(Error('denied'))});await assert.rejects(pick(),/manually/);await assert.rejects(pick(),/manually/);
});
