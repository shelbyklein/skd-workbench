import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync,readFileSync,writeFileSync,readdirSync,mkdirSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
import {EvidenceStore} from '../lib/lifecycle-evidence.js';
const repositoryKey='a'.repeat(64),otherRepository='b'.repeat(64),lifecycleID=randomUUID(),commit='c'.repeat(40);
const input={repositoryKey,lifecycleID,commit,criteriaRevision:1,criterionID:'tests',environment:'Node fixture; temporary store',outcome:'passed',summary:'Fixture assertion passed',command:'node --test',exitCode:0};
function fixture(t){const directory=mkdtempSync(path.join(tmpdir(),'skd-evidence-'));t.after(()=>rmSync(directory,{recursive:true,force:true}));return {directory,store:new EvidenceStore(directory)};}
const review=(store,r,decision='accepted',reason='Inspected fixture evidence')=>store.review(r.id,{expectedRevision:r.revision,decision,reason,reviewer:'user'});
function receipt(r,overrides={}){return {repositoryKey,targetCommit:commit,criteriaRevision:1,selected:[{lifecycleID,commit}],exclusions:[],evidenceIDs:[r.id],environment:'Temporary Git fixture',status:'verified',summary:'Combined validation observed',...overrides};}
test('reports preserve immutable claims, exact bindings and append-only review history through restart',t=>{
 const {directory,store}=fixture(t),r=store.record({...input,dirtyFingerprint:'dirty-content-hash',expected:'No overflow',actual:'Overflow',reproduction:'Open at 390px',outcome:'failed'}, {source:'agent',sourceID:'session-1'});
 let current=review(store,r);current=review(store,current,'rejected','Needs observed exit result');current=review(store,current,'not-applicable','Criterion excluded for this documented scope');
 assert.equal(current.source,'agent');assert.equal(current.observed,false);assert.equal(current.outcome,'failed');assert.equal(current.commit,commit);assert.equal(current.criteriaRevision,1);assert.equal(current.dirtyFingerprint,'dirty-content-hash');assert.equal(current.revision,4);assert.deepEqual(current.reviews.map(v=>v.decision),['accepted','rejected','not-applicable']);
 assert.throws(()=>review(store,r),/changed/);assert.throws(()=>review(store,current,'not-applicable',''),/reason/);
 current.summary='mutated';current.reviews.length=0;assert.equal(store.get(r.id).summary,input.summary);assert.equal(new EvidenceStore(directory).get(r.id).reviews.length,3);
 assert.throws(()=>store.review(r.id,{expectedRevision:4,decision:'accepted',reason:'Pretend observed',reviewer:'user',observed:true}),/fields/);
});
test('provenance cannot be supplied through report payload or promoted by accepting an agent claim',t=>{
 const {store}=fixture(t);assert.throws(()=>store.record({...input,observed:true}),/fields/);assert.throws(()=>store.record(input,{source:'agent',observed:true}),/observed/);assert.throws(()=>store.record(input,{source:'user',observed:true}),/observed/);
 const r=store.record(input,{source:'fixture',observed:true,sourceID:'fixture-run'});assert.equal(review(store,r).observed,true);
 for(const outcome of ['failed','unknown','not-run']){const claim=store.record({...input,outcome,commit:null,exitCode:null});assert.equal(review(store,claim).outcome,outcome);assert.equal(store.get(claim.id).exitCode,null);}
});
test('invalid, excessive and executable-looking input never executes commands or accepts unsafe artifacts',t=>{
 const {store}=fixture(t);assert.throws(()=>store.record({...input,commit:'main'}),/Commit/);assert.throws(()=>store.record({...input,criteriaRevision:0}),/revision/);assert.throws(()=>store.record({...input,summary:'x'.repeat(12001)}),/summary/);assert.throws(()=>store.record({...input,artifacts:[{id:'a',label:'secret',path:'/etc/passwd'}]}),/artifact/);
 const r=store.record({...input,command:'$(touch /never-executed); exit 0',artifacts:[{id:'screenshot',label:'Screenshot',mimeType:'image/png',required:true}]});assert.equal(r.command,'$(touch /never-executed); exit 0');assert.equal(r.artifacts[0].contentStatus,'missing');assert.equal(r.artifacts[0].required,true);
});
test('receipts retain selected scope, exclusions, synchronization and interrupted attempts immutably',t=>{
 const {directory,store}=fixture(t),r=store.record(input),excluded=randomUUID();
 const saved=store.receipt(receipt(r,{scope:'selected',targetBefore:'d'.repeat(40),operationID:'reconciliation-1',exclusions:[{lifecycleID:excluded,reason:'Not ready',ownerRef:'task:owner',nextAction:'Fix failing check'}],synchronization:{status:'observed',remoteName:'origin',commit,observedAt:new Date().toISOString()},attempts:[{lifecycleID,status:'integrated',commit}],errors:[]}));
 saved.exclusions[0].reason='changed';assert.equal(store.receipts(repositoryKey)[0].exclusions[0].reason,'Not ready');assert.equal(new EvidenceStore(directory).receipts(repositoryKey)[0].scope,'selected');
 const interrupted=store.receipt(receipt(r,{targetCommit:null,status:'interrupted',summary:'Stopped during integration',attempts:[{lifecycleID,status:'failed',error:'Conflict'}],errors:['Conflict']}));assert.equal(interrupted.status,'interrupted');assert.equal(interrupted.targetCommit,null);
 assert.throws(()=>store.receipt(receipt(r,{repositoryKey:otherRepository})),/another repository/);assert.throws(()=>store.receipt(receipt(r,{evidenceIDs:[randomUUID()]})),/missing/);assert.throws(()=>store.receipt(receipt(r,{exclusions:[{lifecycleID,reason:'duplicate'}]})),/both selected/);
});
test('portable metadata import preserves IDs and provenance, requires fresh review, and replays idempotently',t=>{
 const {directory,store}=fixture(t);let r=store.record({...input,artifacts:[{id:'log',label:'Output log',size:200,sha256:'e'.repeat(64)}]},{source:'fixture',observed:true});r=review(store,r);const receiptRecord=store.receipt(receipt(r));const snapshot=store.snapshot(repositoryKey);assert.equal(snapshot.artifactContentsIncluded,false);assert.deepEqual(snapshot.missingArtifactIDs,['log']);
 const restored=new EvidenceStore(path.join(directory,'restore'));restored.importSnapshot(snapshot,{repositoryKey:otherRepository});const imported=restored.get(r.id);assert.equal(imported.repositoryKey,otherRepository);assert.equal(imported.originalRepositoryKey,repositoryKey);assert.equal(imported.source,'fixture');assert.equal(imported.observed,true);assert.equal(imported.imported,true);assert.equal(imported.reviews[0].imported,true);assert.equal(imported.artifacts[0].contentStatus,'missing');assert.equal(restored.receipts(otherRepository)[0].id,receiptRecord.id);
 const revision=restored.revision;restored.importSnapshot(snapshot,{repositoryKey:otherRepository});assert.equal(restored.revision,revision);const accepted=review(restored,imported);assert.equal(accepted.reviews.at(-1).imported,false);restored.importSnapshot(snapshot,{repositoryKey:otherRepository});assert.equal(restored.get(r.id).reviews.length,2);
 const collision=structuredClone(snapshot);collision.reports[0].summary='rewritten';assert.throws(()=>restored.importSnapshot(collision,{repositoryKey:otherRepository}),/different contents/);assert.equal(restored.get(r.id).summary,input.summary);
});
test('import is all-or-nothing for conflicts and rejects altered review histories',t=>{
 const {directory,store}=fixture(t);let r=review(store,store.record(input));const restored=new EvidenceStore(path.join(directory,'restore'));restored.importSnapshot(store.snapshot(repositoryKey));r=review(store,r,'rejected','Changed assessment');restored.importSnapshot(store.snapshot(repositoryKey));assert.equal(restored.get(r.id).reviews.length,2);
 const snapshot=store.snapshot(repositoryKey);snapshot.reports[0].reviews[0].reason='rewritten';snapshot.reports.push({...structuredClone(snapshot.reports[0]),id:randomUUID()});const before=restored.revision;assert.throws(()=>restored.importSnapshot(snapshot),/histories conflict/);assert.equal(restored.revision,before);assert.equal(restored.list(repositoryKey).length,1);
});
test('bounded backups retain pre-mutation stores; corrupt data and competing writers fail visibly',t=>{
 const {directory,store}=fixture(t),stale=new EvidenceStore(directory);for(let i=0;i<8;i++)store.record({...input,summary:'Report '+i});assert.equal(readdirSync(store.backupDirectory).length,5);const backup=JSON.parse(readFileSync(path.join(store.backupDirectory,readdirSync(store.backupDirectory).sort().at(-1)),'utf8'));assert.equal(backup.reports.length,7);assert.throws(()=>stale.record(input),/changed on disk/);
 const before=readFileSync(store.file,'utf8');writeFileSync(store.file,'{broken');assert.throws(()=>new EvidenceStore(directory),/damaged/);assert.equal(readFileSync(store.file,'utf8'),'{broken');writeFileSync(store.file,before);const corrupt=JSON.parse(before);corrupt.reports[0].observed=true;writeFileSync(store.file,JSON.stringify(corrupt));assert.throws(()=>new EvidenceStore(directory),/damaged/);
});
test('failed backup persistence leaves in-memory and durable evidence unchanged',t=>{
 const {store}=fixture(t),before=readFileSync(store.file,'utf8');writeFileSync(store.backupDirectory,'not a directory');assert.throws(()=>store.record(input));assert.equal(store.revision,0);assert.equal(store.list(repositoryKey).length,0);assert.equal(readFileSync(store.file,'utf8'),before);
});
