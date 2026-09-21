# Worktree purpose notes in the execution pipeline

<!-- skd-worktree-purpose-notes-2026-09-21 -->

Status: planned; implementation has not started.
GitHub issue: https://github.com/shelbyklein/skd-workbench/issues/7
Tracker Trapper plan: `76EB7584-21A4-4F00-AFC1-E69E4C436E0A`; WN-01 through WN-05 remain pending.
Related: https://github.com/shelbyklein/skd-workbench/issues/4 (worktree visualization; separate scope).
Local plan: `instructions/2026-09-21-worktree-purpose-notes.md` (full plan reproduced in the issue).

## Prompt for Claude

### Outcome

Give each worktree a readable purpose and editable notes, visible in the existing project Git inventory. Capture purpose during session/workflow launch and retain links to its origin so a user can understand an accumulated checkout without reconstructing terminal history. This is an implementation-ready proposal, not an instruction to dispatch or implement now.

### Current system

Source inspected on 2026-09-21, branch `codex/github-issues`, HEAD `9c06364`, initially clean checkout:

- `lib/terminals.js:47` saves task, optional initialPrompt, project and source snapshots. Lines 49–51 create interactive worktrees.
- `lib/codex.js:81` saves structured task and workflow/attempt IDs. Lines 91–95 create structured worktrees. Its existing `purpose` field classifies issue proposals; do not repurpose it as human text.
- `lib/workflows.js:49` saves the original task, acceptance and issue snapshots. `advance` passes a generated step prompt to the executor; `captureWorkspace` retains the shared workspace across attempts.
- `lib/worktrees.js:98` inventories registered worktrees. Current IDs fingerprint common Git directory and path; this is not durable identity across moves or removal/recreation.
- `public/git-status-ui.js:68` renders worktree Git state and Copy path, without purpose or editable notes. `lib/git-status.js:read` and the project Git-status route in `server.js` provide the existing read boundary.
- The earlier worktree visualization plan is broader and remains separate. Reuse the implemented inventory; do not implement its graph/diff scope here.

### Ownership rules

Git remains authoritative for inventory, branch, commit, dirty state and ancestry. Add a separate local annotation store under the configured `FLOW_BENCH_DATA` directory, proposed `worktree-notes.json`. This is authored metadata, not a second persistent Git inventory. Do not put notes in tracked files, AGENTS.md, Git commit notes or provider configuration.

Each annotation has a UUID, revision, bounded purpose (240 characters), notes (8 KiB), timestamps, origin kind and verified source IDs. Retain an immutable creation-context reference and explicit attachment identity: canonical common directory plus per-worktree administrative directory and registered path. An unchanged path alone must never transfer notes to a replacement checkout. Inspect available Git identity evidence and define conservative attachment checks; ambiguous matches appear unattached and require explicit reassociation. Branch changes alone do not transfer or delete notes. Multiple project scopes viewing the same repository can view its shared annotation, but do not gain cross-project access to source session contents.

Use atomic persistence, version validation, backups before migrations and visible corrupt-store errors. Freeze launch purpose in execution history; later annotation edits do not mutate run snapshots. Store no copied terminal transcripts, generated handoff prompts, secrets or duplicated acceptance records. Origin links point to existing records.

### First slice and user journey

1. Add a Purpose field to isolated-worktree launch forms. Prefill deterministically from the original user task or captured issue title, with a visible editable preview. For an interactive session without a meaningful task, keep the field optional and show “No purpose recorded.” Never claim a generic “Codex session” is a meaningful inferred purpose.
2. After successful Git creation and before provider launch, persist the annotation and frozen execution reference. Use one canonical registration helper across interactive, structured and workflow execution paths.
3. Workflow retries and later steps reuse the original annotation. Seed from the workflow's original task/issue, never its generated child prompt. Explicit edits survive retries.
4. Render purpose and an Edit notes text-button in existing worktree details. Show recorded origin links where project scope permits. A dialog edits purpose and notes with Save/Cancel, revision conflict handling, accessible labels, keyboard focus and existing unsaved-change guards.
5. Existing external worktrees can receive manual notes. Legacy executions may supply a labeled suggested purpose only when their recorded repository/worktree context matches unambiguously; confirm before persisting. Never derive authoritative purpose from a branch name.

### Ordered implementation checklist

- [ ] WN-01: Implement the annotation store, validators, atomic writes, revision conflicts and conservative attachment resolver. Acceptance: temporary-store tests cover restart, corruption, invalid/oversized input, path reuse and shared-repository project scopes.
- [ ] WN-02: Integrate canonical registration into all three launch paths. Acceptance: fixture starts capture original purpose exactly once; workflow retries preserve edits; read-only execution creates no annotation. Creation/registration failure never launches a provider silently without its required record.
- [ ] WN-03: Add guarded project-scoped annotation reads/edits through server-resolved worktree identities. Acceptance: real HTTP tests reject stale project/snapshot identities, arbitrary paths, cross-repository writes and stale revisions, while leaving Git files/refs/index unchanged.
- [ ] WN-04: Add launch previews and existing-inventory notes/dialog UI. Acceptance: empty, loading, failed-save, conflict, cancellation and successful-save states work; origin links respect scope; drafts survive recoverable failures and are protected during navigation.
- [ ] WN-05: Validate integration and record evidence in VALIDATION.md. Acceptance: full Node and browser suites pass with temporary stores and fixture providers; inspect desktop/mobile screenshots and keyboard flows; bump public/sw.js when shell assets change.

### Failure and lifecycle requirements

Git worktree creation and JSON persistence cannot be one transaction. Record a durable preparation intent before creation, then attach and finalize the annotation after verified creation. On crash/restart, reconcile only recorded creation intents against Git; never auto-launch, delete or recreate a worktree. If annotation persistence fails after creation, retain the checkout, expose the error and recovery path, and do not start inference. Retrying registration is idempotent by creation intent/owner ID.

Worktree removal, benchmark cleanup and archives must preserve note provenance. Include the annotation snapshot in a benchmark archive before existing verified cleanup. Removed/missing worktrees retain historical notes without claiming the checkout is live. Do not infer merged, reviewed, safe-to-delete or completed from purpose text or provider exit status. Notes are reference data and confer no permissions.

### Regression and verification

Use real temporary Git repositories and `FLOW_BENCH_DATA`, fixture execution providers and no account usage. Exercise interactive Codex/Claude, standalone structured runs, a multi-step workflow with retry, failed creation, failed metadata persistence, restart interruption, manual external-worktree notes, removed/recreated paths, renamed branches, moved/inaccessible worktrees, detached HEAD, two project scopes of one repository, stale concurrent edits and HTML-like note text. Verify note edits do not mutate source files, index, refs or historical execution snapshots. Unknown and ambiguous origins remain unknown.

Run focused store/API/executor and affected browser suites during implementation, then `npm test` and `npm run test:browser` for integration. Inspect desktop and 390px layouts, keyboard Save/Cancel/Escape, focus return, navigation draft guards and PWA explicit-update behavior. Distinguish fixture evidence from any separately authorized live verification. Inspect active execution before restarting a live server.

### Follow-ons and exclusions

Portable Markdown export, AI-written summaries, richer progress journals, intended merge targets, graph views and explicit reassociation tools are follow-ons. First-slice ambiguous notes may stay retained/unattached. No automatic merge, cleanup, branch rename, remote writes or provider summarization call. No new pipeline node is needed: creation-time metadata is shared infrastructure. Preserve unrelated uncommitted work, user data and active sessions. Follow current AGENTS.md, including Tracker Trapper if this becomes GitHub issue execution.

Planning validation: source inspection only; no application code changed, tests run, provider execution or live restart.
