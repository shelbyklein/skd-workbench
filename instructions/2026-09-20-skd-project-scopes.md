# SKD Workbench — project scopes and Git

Confirmed scope: user approved rename to SKD Workbench and Project → Workflows → Runs, connected local folders and read-only Git detection. Solo implementation now. Local delivery; existing repo directory remains `flow-bench` so saved paths and running app references stay stable. No GitHub publication. No model execution or Git mutation.

Tracker Trapper: `local:E14EF694-2752-4ACC-8578-5A600CBDE79B`.
Baseline: `e31a6f3` on `codex/simple-flow-workbench`, clean working tree.

## Current behavior

`lib/store.js` stores schema 1, global flows/runs. `lib/domain.js:createRun` freezes a workflow, but knows no project or code context. `public/app.js` has global sidebar/history; `server.js` serves explicit loopback-only routes. Existing simulation and usage behavior must remain honest and intact.

## Tracked steps

- [x] **TT-SKD-01** Add project storage and preserve existing flows/runs. Acceptance: back up schema 1 before migration; put existing records under stable Unassigned scope; versioned project records and workflow moves preserve historical run snapshots.
- [x] **TT-SKD-02** Connect folders and record read-only Git provenance. Acceptance: real directory validation; inspect root/common Git directory, remotes, branch, commit and dirty state; support non-Git directories, detached/unborn repos and worktrees; new runs capture current context; missing folders stop new runs with a useful message. No Git/network mutations.
- [x] **TT-SKD-03** Build renamed project UI. Acceptance: SKD Workbench title/branding/launcher; project picker filters workflows/history; add/edit/refresh project, move workflow; inspect frozen context of historical runs; preserve unsaved changes and mobile access.
- [x] **TT-SKD-04** Verify and launch. Acceptance: migration/domain/API and Chrome checks pass; visual desktop/mobile inspection; migrated real data preserved; update docs and live screenshot; local commit and TT finish.

## Design and ownership

Projects are durable `{id,name,folderPath,version}` records. Unassigned is a protected scope with no folder. Folder is canonicalized on add/edit, not guessed from project name. A project's configured folder can be a Git worktree or subdirectory; detect root separately and record common Git dir so related worktrees are recognizable. Git remote data is detected, not editable remote configuration. Support local projects without Git and repos with no remote.

Git inspection uses fixed `execFile` argument arrays, a bounded timeout/output, and read-only commands with optional index writes disabled. No shell interpolation, hooks, fetch, checkout, push, commit, or credential capture. Remote URLs must be sanitized before returning/persisting; arbitrary helper/ext remote strings are not exposed. Folder names never authorize side effects. Do not automatically attach Newton to a guessed checkout.

Storage migrates atomically after creating a schema-1 backup. Existing run objects get project ID Unassigned and explicit unknown provenance, never fabricated historical branch data. Workflow reassignment increments its version; earlier runs stay in the original scope. Projects can edit folder/name with optimistic concurrency; earlier runs retain their original project snapshot. New run comparison considers project and code provenance in addition to task/acceptance; dirty or unknown trees cannot claim exact code equivalence. No project deletion in this slice.

UI: project picker above scoped saved workflows, two small Add/Details actions, detail dialog with validated path and detected Git facts. Main workflow editor stays the same. New workflows belong to current project; a Move action assigns existing ones. Run details disclose frozen project/folder/Git context. Missing folders are visible on refresh and actionable before a new run.

## Verification and rollout

Use temporary Git fixtures for regular, non-Git, worktree, dirty, detached, no-commit and credential-bearing remote cases. Test migration preservation/idempotence, stale project changes, moving flows/history ownership, immutable run context and project comparison. API tests exercise real routes. Chrome tests exercise picker filtering, add/edit/move, dirty navigation, run snapshot display and reload; run existing regression scripts. No changes to connected project files. Stop the old server before touching the real store; inspect the backup and record pre/post object counts. Launch on port 4390 and capture live UI. Keep user data out of Git. Rollback: stop server, restore schema-1 backup only if no new records need preserving, restore old source; never silently discard new data.


## Completion evidence

18 Node/API tests and four Chrome scripts pass. Live schema-2 migration preserved both workflows and created a byte-exact backup. Desktop/mobile/details screenshots inspected; app relaunched at port 4390 via a transient macOS job. See VALIDATION.md for evidence and rollback details. Projects are connected by the user through Add project; simulation-only execution remains unchanged.
