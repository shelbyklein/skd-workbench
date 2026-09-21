# Automatic workspace registration: first delivery

Baseline: 7db039f on main. Current scope: automatic durable registration plus inventory visibility for every project. Later WLC readiness, evidence, reconciliation, retirement and continuation UI remain pending. #4 graph/route work remains separate. #8 QA tasks are complete. #7 WN-01..03 are pending prerequisites being implemented under their existing IDs as necessary to the user's automatic-registration request; WN-04..05 are not silently completed.

Coordinator owns execution adapters, server, existing inventory UI, docs/cache and integration. Store worker owns lib/worktree-notes.js and tests/worktree-notes.test.js only. No second lifecycle identity store is introduced for this slice. Existing Git inventory remains authoritative.

## Canonical helper contract

Export WorktreeNotes(directory). Store version 1 in worktree-notes.json with atomic writes, bounded values, visible corruption, immutable UUID/id and origin, revision, purpose (240 chars), notes (8192 bytes), workRef, ownerKey, source project and registration state. No release numbering. Creation intent ID is idempotent and persisted BEFORE Git creation.

prepare({intentID, projectID, sourceContext, destination, branch, purpose, origin:{kind,id}, workRef, ownerKey, classification}) synchronously returns record. classification is development or benchmark. Input paths are exclusively server-generated. Returns existing record only if immutable preparation input matches. WorkRef defaults to local:<intentID>; ownerKey identifies terminal/workflow/delegation and is stable across retries. Original task purpose is clipped by caller, never a generated workflow child prompt.

attach(intentID) asynchronously verifies registered Git membership, common directory, actual root and admin directory plus filesystem identity (device/inode/birth time). Persists attachment and state attached; idempotent exact matching only. A recreated path/admin directory must not inherit identity. Moves may conservatively remain unattached. Failed attachment keeps intent/folder, blocks inference, and provides visible recovery state. No auto creation/deletion/relaunch on recovery.

verify(id, destination, ownerKey) asynchronously checks current exact attachment and owner, returning record; refuses mismatch. link(id,{kind,id},ownerKey) appends unique source reference while retaining original origin. get(id) returns clone. list() returns clones. update(id,{expectedRevision,purpose,notes}) rejects stale/invalid edits and preserves origin. refresh/enrich is read-only and never invents an owner.

Coordinator feeds the same helper to all managed writers: interactive worktree sessions, structured standalone/workflow, delegation and quick-action collaboration via terminals. Reconciliation binds/inspects existing inventory separately; this slice must label its unmanaged-write limitation instead of claiming universal coverage. Read-only sessions create no new worktree record. Benchmark snapshots retain the annotation through existing archive metadata.

## Inventory/API

Existing GET project git-status adds registration to each row: managed with matching verified UUID/workRef/purpose/classification; unassigned for external/legacy rows; unknown on identity read failure. Retained records absent from verified inventory are separate historical entries. Source links only for the requesting project; shared repository purpose/notes are readable. Stale/partial inventory never implies missing/retired.

Guarded notes edits use server-resolved row ID + project version + snapshot ID + annotation revision, never client paths. Unassigned records remain unclaimed; explicit adoption/continuation/migration will be later guarded actions. Adding a project automatically gets discovery through existing connection/status reads; no manual registry setup.

## Acceptance

Real disposable Git fixtures prove persistence, path-reuse refusal, stale edits/corruption, no provider launch after failed registration, all creation adapters, workflow retries retaining identity and original purpose, scope-safe reads/edits, and benchmark provenance. Browser fixture/live reads verify managed/unassigned display; live workflows remain unrun. Full regression at integration. No auto merge, removal, release version edits or task completion from process exit.
