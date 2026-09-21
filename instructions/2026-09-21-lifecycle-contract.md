# Lifecycle integration contract

Baseline: 5facac9, codex/workspace-registration. Continue issue #9 through remaining acceptance; no new task IDs. Reuse this isolated checkout with disjoint worker files to avoid needless lane/worktree proliferation. Coordinator owns all shared glue and serial commits. Native execution ownership, explicit actions and source scope remain authoritative.

## Foundation interfaces

Repository key: SHA-256 of JSON.stringify(registration.sourceRepositoryIdentity). Lifecycle ID equals canonical annotation UUID; no competing worktree identity. Current Git facts are inputs only.

LifecycleStore(directory) owns lib/lifecycle-store.js and tests/lifecycle-store.test.js. APIs synchronous: ensure(registration) idempotently returns record; get(id); list(repositoryKey); update(id,{expectedRevision,criteria?,blocker?,nextAction?,dependencies?,ownerRef?}); event(id,{expectedRevision,type,detail,at?}); snapshot(repositoryKey); importSnapshot(snapshot,{requestKey,expectedRevision}); migration(repositoryKey,{requestKey,expectedRevision,aliases,releaseConvention,sourceHash,sourceMetadata,rulesAcknowledged}). Methods may add scoped args if coordinated. Store revision getter. Records: id,registrationID,repositoryKey,projectID,revision,criteriaRevision,criteria [{id,label,required}],dependencies [lifecycleID],ownerRef,blocker,nextAction,aliases,events,lastActivityAt,createdAt,attachmentState. Imported records remain unattached until explicit verified rebind; never infer ownership from path. Normal ensure must not silently rebind imports. Source links/annotation purpose remain annotation authority. Bounded versioned backups before mutations. Migration preserves aliases and metadata with immutable context and idempotent request keys; no filesystem source reads or Git writes in store.

EvidenceStore(directory) owns lib/lifecycle-evidence.js and tests/lifecycle-evidence.test.js. APIs: record({repositoryKey,lifecycleID,commit,dirtyFingerprint?,criteriaRevision,criterionID,environment,outcome,summary,command?,exitCode?,expected?,actual?,reproduction?,artifacts?},{source='user',sourceID=null,observed=false}={}); review(id,{decision:'accepted'|'rejected'|'not-applicable',reason,reviewer:'user',expectedRevision}); list(repositoryKey,lifecycleID?); get(id); receipt(input) append immutable independently prepared reconciliation receipt; receipts(repositoryKey); snapshot(repositoryKey); importSnapshot(snapshot). Source provenance passed internally only; HTTP cannot claim observed. Immutable reports + append-only reviews; checks bound to commit/revision/environment. Outcomes passed/failed/not-run/unknown; N/A review reason mandatory. Artifact references bounded metadata, contents excluded/missing explicit; never arbitrary file serving. Cross-store restore via coordinator durable intent/idempotent imports. Strict schema/corrupt failure, atomic persistence and bounded backups required.

Policy/attention module interfaces will consume these DTOs after focused acceptance. Server resolves project, repository, annotation, Git facts and validates revision + ownership. UI consumes real API; no status dropdown bypasses policy. No provider inference in tests.

## Ownership this wave

Data worker WLC-02: lifecycle store, migration/backup/restore pure persistence and tests only.
Evidence worker WLC-04: immutable evidence/reviews/receipts persistence and tests only.
Coordinator WLC-03/07: lifecycle integration service, launch links, API guards, preview/current observation, source migration reads and shared glue.
UI worker dispatched once real DTO freeze ready. Full Node/browser and independent QA required before completing broad tasks.

## UI/API wave

Base `/api/projects/:projectID/lifecycle` (api helper omits /api/).
GET base -> LifecycleService.read DTO from lib/lifecycle-service.js: records with purpose,observation,state,reasons,checks,criteria,criteriaRevision,revision,aliases,blocker,nextAction,sourceAccess,sources; attention {settings,items,snoozed,unfinishedCount,countComplete}; unknown; reports with reviews/revision; receipts; migration; target; runtime.
PUT base/:id -> update {expectedRevision,criteria:[{id,label,required}],blocker,nextAction,dependencies:[UUID],ownerRef}. Only original project edit; imported metadata editable but can't claim owner before rebind.
POST base/:id/checks -> {expectedRevision,criterionID,commit,environment,outcome,summary,command?,exitCode?,expected?,actual?,reproduction?,artifacts?}. Source is always user; commit explicit observed from record only prefill, dirty evidence diagnostic only.
POST base/evidence/:evidenceID/review -> {expectedRevision,decision,reason}. No arbitrary execute.
PUT base/settings -> {expectedRevision,timezone,unfinishedLimit,inactivityDays,retentionDays}.
POST base/snooze -> {expectedRevision,key,reason,until}.
POST base/migration/preview {} -> id,sourceMetadata,sourceHash,inventory,records,expectedRevision.
POST base/migration/apply {previewID,requestKey,aliases:[{lifecycleID,alias,context}],releaseConvention,rulesAcknowledged:true}.
GET base/export -> metadata JSON bundle with checksum. POST base/import/preview {bundle}, then POST base/import/apply {previewID,requestKey,confirm:true}. No arbitrary paths. Imported attachments remain unattached.
POST base/:id/rebind {expectedRevision,confirm:true} verifies existing canonical notes before binding.
UI module `mountLifecycle(host,{project,api,onSession,onChanged})` returns isDirty/isPending/dispose. Coordinator mounts in project widgets. User sees compact health summary, Check project, Review work/metadata recovery. Details dialog keyboard/draft/error/route protections. Do not show enabled reconciliation or retirement before next backend wave.

## Selected reconciliation execution interface

ReconciliationService(directory,{lifecycle,store,evidence,notes,terminals,project,inspect?,advertise?}) owns lib/lifecycle-reconciliation.js and tests/lifecycle-reconciliation.test.js. lifecycle.read(project) gives current DTO and observations; store/evidence are synchronous foundation stores. Reuse native terminals.start mode reconcile with internal reconciliation {workingDirectory:main path,writeDirectories:[common directory,main path],snapshot} and quickAction:{action:'reconcile',requestKey}; initialPrompt is bounded selected manifest, target/exclusions/dependencies, no arbitrary client command; shouldLaunch revalidates fresh manifest. Never modify excluded folders. Native CLI prompts retained.

Methods preview(project,{selected:[UUID],scope:'selected'|'full',synchronize:boolean,remoteName?}); start(project,{previewID,requestKey,agent,model,effort,confirmOwnership:true}); list(project); get(project,id); verify(project,id,{expectedRevision,environment}). Persist bounded atomic request intent before launch; idempotent request replay no respawn; startup pending becomes interrupted, no rerun. Preview uses actual Git main independent of widget target, existing clean main checkout, complete registry+branch inventory; account all unknown work, exclude known dirty tasks only with owner/status/nextAction and unchanged content fingerprints. Validate selected ready and dependency order, reject indirect inclusion of unready ancestor task tips. Capture exact selected/excluded refs+full bounded dirty-content hashes, target before, criteria revisions, registry revision, remote config identity. Recheck immediately before launch and after session exit. One global executor owner. Local-only explicit accepted; sync true requires unambiguous supported remote, no arbitrary URL.

Verify is explicit read-only Git/evidence check after session stopped: derive containment of each captured tip and excluded unchanged; inspect final combined target clean commit, accepted current final-commit evidence; receipt status verified only if all required evidence and source policy revisions agree and inventory known. Preserve integrated-but-unverified and sync pending/failed separately. Remote observation via existing advertise + networkRemote (inject local fixture adapter rather than weaken production). Receipt immutable via EvidenceStore; repeated verify with new evidence appends receipt, never edits old. List/get report source project only. Target/runtime are separate. A provider exit never certifies. No merge/push done by server, no auto retry/rollback/cleanup. Real Git + fixture terminal test may simulate selected merge in disposable repo only.


## Final integrated additions

- `LifecycleActivity` stores bounded content/commit observation baselines separately from authored lifecycle policy. POST `base/check` captures at most20 workspaces with the existing bounded double dirty-content check; GET remains read-only. Baseline/unchanged checks do not advance activity, and incomplete observations stay unknown. No model or Git writes.
- Check/review requests accept durable request keys. A stored report retains an internal submitted-request fingerprint so the original lost-response retry succeeds after later Git/criteria changes without rewriting evidence. Conflicting payloads reject.
- Import operations bind project as well as repository; full preview validation precedes writes, apply revalidates current repository identity, and empty-store annotation rebind verifies original root/common/admin filesystem identities explicitly.
- Post-reconciliation verification ignores evidence-bookkeeping event revisions while retaining authored policy identity. It additionally requires original target ancestry and refuses newly contained excluded tips. Exact selected/excluded content and branch guards remain.
- `mountLifecycle` exposes `openRecord`, accepts `onContinue`; `mountGitStatus` exposes guarded `openTask`, accepts `onLifecycle`. Existing inventory rows and lifecycle details reuse one task setup dialog.
- WLC-09 dedicated-route and notes-editor integration remains blocked on issue4 SKD-WT-04 and issue7 WN-04. Current-inventory acceptance does not claim those independent interfaces exist.
