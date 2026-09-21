import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {mkdirSync,lstatSync,readdirSync,readFileSync,readlinkSync,realpathSync,openSync,writeFileSync,fsyncSync,closeSync,renameSync} from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {assert} from './domain.js';
import {inspectFolder} from './projects.js';
const exec=promisify(execFile);
async function git(folder,args){
 const env={...process.env,GIT_TERMINAL_PROMPT:'0'};for(const k of Object.keys(env))if(k.startsWith('GIT_')&&k!=='GIT_TERMINAL_PROMPT')delete env[k];
 return (await exec('git',['-c','core.hooksPath=/dev/null','-c','core.fsmonitor=false','-C',folder,...args],{env,timeout:15000,maxBuffer:32*1024*1024})).stdout;
}
export async function pinBenchmark(folder,ref='HEAD'){
 assert(typeof ref==='string'&&ref.length<=200&&!ref.startsWith('-'),'Choose a Git commit or tag.');
 const c=await inspectFolder(folder);assert(c.git?.status==='connected'&&c.git.commit&&c.git.dirty===false,'Pin a baseline from a clean Git repository.');
 const commit=(await git(folder,['rev-parse','--verify','--end-of-options',`${ref}^{commit}`])).trim();
 return {commit,root:c.git.root,commonDirectory:c.git.commonDirectory,folderPath:c.folderPath};
}
export async function benchmarkContext(project,mode){
 const c=await inspectFolder(project.folderPath),b=project.benchmark;
 if(!b)return c;
 assert(mode==='worktree','Benchmarks require an isolated worktree.');
 assert(c.git?.root===b.root&&c.git?.commonDirectory===b.commonDirectory&&c.folderPath===b.folderPath,'Benchmark repository changed. Pin its baseline again.');
 assert(/^[a-f0-9]{40,64}$/.test(b.commit),'Invalid benchmark commit.');
 await git(b.root,['cat-file','-e',`${b.commit}^{commit}`]);
 return {...c,git:{...c.git,observedCommit:c.git.commit,commit:b.commit}};
}
// Full final file contents (including ignored/untracked files) are preserved.
// Links are recorded, never followed. If a complete bounded snapshot cannot be
// made, cleanup must retain the workspace instead of discarding evidence.
export function snapshotFiles(folder){
 const files=[];let bytes=0;
 const walk=relative=>{for(const name of readdirSync(path.join(folder,relative)).sort()){
  if(!relative&&name==='.git')continue;
  const rel=path.join(relative,name),file=path.join(folder,rel),stat=lstatSync(file);
  assert(files.length<10000,'Archive exceeds 10,000 entries; workspace retained.');
  if(stat.isSymbolicLink()){files.push({path:rel,type:'symlink',target:readlinkSync(file)});continue;}
  if(stat.isDirectory()){files.push({path:rel,type:'directory',mode:stat.mode&0o777});walk(rel);continue;}
  assert(stat.isFile(),'Archive contains a special file; workspace retained.');
  bytes+=stat.size;assert(bytes<=32*1024*1024,'Archive exceeds 32 MiB; workspace retained.');
  files.push({path:rel,type:'file',mode:stat.mode&0o777,data:readFileSync(file).toString('base64')});
 }};walk('');return files;
}
async function verifyWorkspace(directory,workspace){
 const root=workspace.worktreePath,base=path.join(realpathSync(directory),'worktrees'),name=path.basename(root||'');
 assert(/^[a-f0-9-]{36}$/.test(name)&&path.dirname(root)===base,'Refusing reset outside an owned worktree.');
 assert(realpathSync(root)===root&&realpathSync(base)===base,'Refusing reset through a symlink.');
 const c=await inspectFolder(root),source=workspace.sourceContext.git;
 assert(c.git?.root===root&&c.git.commonDirectory===source.commonDirectory&&root!==source.root,'Worktree repository identity changed.');
 assert(workspace.branch===`codex/skd-${name}`&&c.git.branch===workspace.branch,'Worktree branch changed; workspace retained.');
 const registered=await git(source.root,['worktree','list','--porcelain']);
 assert(registered.split('\n\n').some(block=>block.split('\n').includes(`worktree ${root}`)&&block.split('\n').includes(`branch refs/heads/${workspace.branch}`)),'Worktree is no longer registered as expected.');
}
export async function archiveWorkspace(directory,id,workspace,evidence){
 await verifyWorkspace(directory,workspace);
 const archive={schema:1,id,createdAt:new Date().toISOString(),baseline:workspace.sourceContext.git.commit,evidence,
  diff:await git(workspace.worktreePath,['diff','--binary','--no-ext-diff','--no-textconv',workspace.sourceContext.git.commit,'--']),files:snapshotFiles(workspace.worktreePath)};
 const dir=path.join(directory,'artifacts');mkdirSync(dir,{recursive:true,mode:0o700});
 const file=path.join(dir,id+'.json'),data=JSON.stringify(archive),sha256=createHash('sha256').update(data).digest('hex');
 const fd=openSync(file+'.tmp','w',0o600);try{writeFileSync(fd,data);fsyncSync(fd);}finally{closeSync(fd);}renameSync(file+'.tmp',file);
 const dirFD=openSync(dir,'r');try{fsyncSync(dirFD);}finally{closeSync(dirFD);}
 assert(createHash('sha256').update(readFileSync(file)).digest('hex')===sha256,'Archive verification failed; workspace retained.');
 return {id,sha256,snapshotHash:createHash('sha256').update(JSON.stringify(archive.files)).digest('hex'),bytes:Buffer.byteLength(data),createdAt:archive.createdAt};
}
export async function removeWorkspace(directory,workspace,artifact){
 await verifyWorkspace(directory,workspace);
 assert(artifact?.id&&artifact.sha256,'Verified archive required before reset.');
 let archived;try{archived=readFileSync(path.join(directory,'artifacts',artifact.id+'.json'));}catch{assert(false,'Archive is unavailable; workspace retained.');}
 assert(createHash('sha256').update(archived).digest('hex')===artifact.sha256,'Archive changed; workspace retained.');
 assert(artifact?.snapshotHash&&createHash('sha256').update(JSON.stringify(snapshotFiles(workspace.worktreePath))).digest('hex')===artifact.snapshotHash,'Workspace changed after archiving; workspace retained.');
 await git(workspace.sourceContext.git.root,['worktree','remove','--force',workspace.worktreePath]);
 // Keep the branch if Git refuses its removal; file cleanup has already succeeded.
 let branchNote=null;try{await git(workspace.sourceContext.git.root,['branch','-D',workspace.branch]);}catch{branchNote='Temporary branch retained.';}
 return {status:'cleared',finishedAt:new Date().toISOString(),branchNote};
}
