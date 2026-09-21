# Worktree lifecycle, readiness, review thresholds and evidence

<!-- skd-worktree-lifecycle-2026-09-21 -->

Status: implementation handoff prepared; implementation and subagent dispatch have not started.
GitHub issue: https://github.com/shelbyklein/skd-workbench/issues/9
Tracker Trapper plan: `local:8B1A3EB7-2154-4FF9-879A-944DE43320E8`.
Local plan: `instructions/2026-09-21-worktree-lifecycle.md` (uncommitted at publication; the complete instructions are reproduced in this issue).

## Outcome and user journey

Make Project Overview answer what is working, blocked, ready to integrate, verified and safe to retire without reconstructing multiple chats. A task/worktree record survives sessions. Git facts, agent claims, accepted check evidence and running-version observations remain separate.

The normal loop is: Check project -> start/continue a task -> record current acceptance evidence -> Reconcile ready work -> inspect the combined-result receipt -> separately update the running application where authorized -> Retire completed worktrees.

Deliver three deliberate actions:
- **Check project** refreshes local status and attention reasons without model execution or Git writes. Remote observation remains explicit and separately timestamped.
- **Reconcile ready work** previews a bounded ready batch, integrates only that scope through the existing executor, and preserves visible exclusions.
- **Retire completed worktrees** previews eligible linked folders and removes only explicitly selected, freshly verified candidates. History remains.

This issue is planning/publication authorization only. Future implementation needs an execution instruction. No agents are dispatched by filing the issue.

## Approved operating rules: Workbench, work identity and releases

User decision, 2026-09-21: use SKD Workbench exclusively as the development entry point. Adopt separate identities for work, worktrees, verified checkpoints and releases. This replaces the proposed enforcement of the earlier major/checkpoint/tangent numbering scheme for the new workflow. Preserve legacy history; do not silently reinterpret existing versions. These are implementation requirements, not already-delivered behavior.

### Four separate identities

| Record | Identity and authority | Required behavior |
| --- | --- | --- |
| Work item | Existing repository-qualified GitHub issue and stable task ID where available, such as issue #9 / WLC-05; otherwise a durable project-local work reference | The user-facing unit is the work and its purpose. Reuse the existing issue/TT checklist; local references provide identity without another competing task inbox. A later GitHub/TT connection preserves the original identity and records the mapping. |
| Worktree | Internal immutable UUID with verified Git attachment identity, linked to one or more work items over its lifetime | A folder, branch name, session ID or release number is not its identity. Record one current write owner/task at a time. Preserve prior associations when ownership changes explicitly. |
| Verified checkpoint | Immutable repository identity + exact integrated commit + acceptance-policy revision and receipt | The receipt identifies included work, explicit exclusions, combined validation and evidence. An attempted or failed validation is an attempt, not a verified checkpoint. Checkpoint creation does not increment a product version. |
| Release | Product version plus built artifact identity and environment observations | Keep each project's declared release convention. Versions identify shipped software; build/source identity disambiguates development builds. Do not consume a release number for a worktree, chat, subagent, commit, retry or checkpoint audit. |

The lifecycle registry owns work-to-worktree/session relationships; Git owns actual commits, refs and registered worktrees; GitHub/TT retain ownership of their work definitions/progress; the project's existing release manifest owns its product version. The old tangent register is a migration source and historical reference, not a second live numbering authority. Do not require a central version.json edit or main commit simply to start a new task. Do not silently switch all projects to strict semantic versioning; establish the chosen product release convention during migration.

### Workbench as the execution entry point

- Start, continue, inspect and reconcile development through Workbench. Provider CLIs may run underneath its existing executor; they retain native permission boundaries. This decision does not require a new execution engine, protocol migration or automatic subagent orchestration.
- Reuse a known work item on continuation. A new chat alone does not create a new task/worktree. Fresh collaboration remains available for a genuinely new work item, with an explicit purpose or clearly labeled unfinished setup.
- All Workbench-managed coding launches, including quick actions, interactive/structured sessions, workflow attempts and any future managed subagent path, use one registration contract. Persist an idempotent intent before creation, attach the verified Git identity, and link the task/owner before allowing edits or provider inference. Failed registration must retain any created folder with a visible recovery path and prevent launch.
- Read-only inspection may start without a development worktree. A permission-mode change that allows writing must run the managed registration checks before execution. Benchmark workspaces retain their existing archive/removal policy and are visibly classified as benchmark work, not release candidates; registration must not bypass that policy.
- Separate subagent worktrees can share a parent issue while retaining distinct child work IDs and owners. Existing executor concurrency limits remain in force. A provider that can create unreported nested worktrees cannot be treated as fully managed: expose the limit, keep delegation disabled where currently disabled, and detect unexpected creations.
- Reconnect reuses the existing process; Continue task may start a deliberately new session in the verified existing workspace. Both preserve work identity. Do not infer permission to change an unrelated dirty checkout from a shared repository.
- Discover registered external/legacy worktrees and branch-only work on project connection, Check project, known execution completion and reconciliation preflight. Show unassigned work explicitly without inventing ownership. Workbench cannot prevent an external tool from bypassing it, so observed scope and unknown state remain visible; do not claim coverage of unrelated clones or disconnected repositories.
- Once migration is complete, external coding sessions are an exception to the user's intended workflow. Detection prompts association/review; it does not kill processes, rename branches, delete files or silently claim an owner.

### Integration, checkpoints and release policy

Merge ready work in dependency order and retain its work-item associations through integration and retirement. IDs do not imply merge order or completion.

A selected batch may become a verified checkpoint while explicitly identified unfinished work remains outside it. Included work must be committed, integrated and accepted at the final combined commit; dependencies must be satisfied; exclusions must have an owner/status/next action. Unregistered or unaccounted-for work must be resolved into a known record or explained observation before certifying a checkpoint. Unknown inventory, unexpected dirty state in the included/target checkout, or ambiguous ownership blocks certification.

An excluded branch may remain dirty if its task, ownership and scope are known, the excluded files are untouched, and no included work depends on those unfinished changes. A long-running experiment can stay excluded without preventing a verified integrated batch. Never include unready prerequisite commits indirectly by merging a selected descendant.

**Fully reconcile this project** is a distinct requested scope: every outstanding development item must be integrated and verified, with conflicts resolved. Parking or deleting a worktree does not count as integration. Unfinished/excluded work prevents the full-reconciliation claim even when a selected batch is verified. Explicit abandonment of work requires a separate recorded user decision and preserves its history; it is never silently inferred to clear a gate.

A checkpoint is not a release or deployment permission. Releases require the project's required review, artifact/build identity, installation and runtime acceptance for the declared release lane. Report source, verified checkpoint, release version, remote synchronization and actually running version independently. A release can select a verified checkpoint with explicit known exclusions; the old rule that every tangent must finish before advancing a production cycle no longer governs that selected-release model after migration is accepted.

### Durability and recovery from the old numbering system

Provide a project-scoped migration preview before enabling the new policy for an existing project:
1. Inventory Git's registered worktrees, branches, current main, known sessions and existing work/issue/TT records. Read existing version.json or equivalent release/tangent records where present. Snapshot legacy metadata and produce a repeatable dry-run report.
2. Match established task/worktree associations only with verified identity/provenance. Retain existing x.y.z tangent identifiers as immutable legacy aliases with original cycle/repository context. Preserve all released versions, tags, commit IDs and historical receipts.
3. Present unmatched/ambiguous work as Unassigned or Needs review. Import or associate it explicitly; do not invent old numbers, rewrite old commit messages, renumber completed history, rename branches or move worktree paths. Missing historical numbers remain unknown.
4. Preview the change of authority and the affected project rules/scripts. After explicit migration acceptance, stop assigning release-shaped tangent numbers and use stable work IDs for new work. Keep released-version manifests intact; obsolete checks that demand tangent numbering must be deliberately adapted, not silently bypassed. This issue supplies the migration capability, not permission to rewrite every connected repository automatically.
5. Preserve a versioned backup of the registry and metadata before migration and on meaningful mutations with bounded retention. Provide an explicit portable export/import of relationships, legacy aliases and receipts, with stable IDs, hashes and schema versions. Repository-stored receipts/manifests are written only through a previewed authorized action; never silently dirty another agent's checkout.
6. Exercise restoration into an empty temporary data store. Rebind verified Git attachments conservatively; lost folders/artifacts/ownership remain unknown. No restore/import may launch a provider or mutate Git. Export a manifest of artifact references and checksums, and clearly report artifacts that were not included; never imply a metadata-only export preserved their contents.

Acceptance must include concurrent/idempotent registration, registration failure before inference, multi-chat continuation without new identity, external discovery, branch-only work, preserved legacy aliases, migration replay, registry restoration, unchanged release versions during ordinary work, excluded known work at a checkpoint, and unknown work blocking certification.

### Binding task coverage

The existing WLC IDs remain stable. Supplemental acceptance requirements below are mandatory in addition to each task's original acceptance sentence and are recorded on the corresponding TT task as planning requirements, not completion evidence.

- **WLC-01:** Freeze these four identities, authority boundaries, release convention/migration policy and the managed-launch coverage map before delegation.
- **WLC-02:** Implement legacy-alias storage, versioned backup/export/import and idempotent migration preview/apply. Demonstrate a restore into an empty store without false ownership or lost IDs.
- **WLC-03:** Enforce pre-launch registration across every managed write path; verify Continue task, workflow retry and linked child work retain identity. No new release/tangent number may be allocated by ordinary execution.
- **WLC-04:** Preserve portable checkpoint receipts and task/commit provenance; distinguish metadata export from retained artifact contents.
- **WLC-05:** Allow known explicit exclusions at a selected checkpoint and reject unknown/unaccounted-for work; full-project reconciliation requires all outstanding items resolved under the explicit scope.
- **WLC-07:** Expose guarded migration preview/apply and export/import APIs with revision/request-key checks, bounded input, no arbitrary paths and no implicit Git writes.
- **WLC-08 / WLC-09:** Lead with task purpose/ID, show legacy aliases secondarily, distinguish unknown/unassigned work and provide migration/restore previews and actionable failures.
- **WLC-10 / WLC-11 / WLC-12:** Capture selected versus full-project scope; show exclusions and exact commit-based checkpoint evidence; keep product version, synchronization and running-version observations separate.
- **WLC-15:** Independently exercise the migration, restore and managed-launch coverage matrix; prove history/releases unchanged and that unknown work blocks certification.
- **WLC-16:** Document Workbench as the user's development entry point, the migration's actual scope, legacy-rule changes, backup/restore limits and the distinction between checkpoint and release. Do not present the new policy as active in unmigrated projects.

## Current evidence and related ownership

Inspected 2026-09-21 at `28f66f26880a8f9b2a240929ab4e7192d3808de4`, branch `main`, with an existing uncommitted change to the inventory-limit error in `lib/quick-actions.js`. Preserve it. Local inventory has the main checkout and `codex/project-quick-actions`; that branch tip is contained in main. These are local source/Git observations, not a live UI or remote-alignment acceptance check.

- `lib/worktrees.js:inspectRepository` already reads registered worktrees, branches, dirty/operation states, bounded ancestry comparisons and stale/partial observations. Its row ID fingerprints common directory plus path and is insufficient as a durable lifecycle ID.
- `lib/git-status.js` and `public/git-status-ui.js` implement the current Git widget. Remote advertisement is read-only; it is not fetch, integration or verification of tests.
- `lib/quick-actions.js:QuickActions.launch/verify` implements persisted launch requests and a reconciliation prompt. Current verification expects every inventoried tip to be contained, all worktrees clean and remote main equal; this cannot represent a successfully verified subset while other work remains.
- `lib/terminals.js`, `lib/codex.js` and `lib/workflows.js` own creation, captured context, workflow workspace reuse, process lifecycle and shared execution ownership. Preserve their conservative single-owner behavior; external processes are not controlled by that ownership.
- `lib/benchmarks.js` owns benchmark archives/cleanup. Normal worktree retirement must remain a distinct explicit action and must not weaken benchmark ownership/archive checks.
- `server.js` owns guarded routes/static allowlists; `public/app.js` owns navigation/overview; `public/quick-actions-ui.js` owns existing action cards; `public/sw.js` owns explicit shell updates.
- No durable lifecycle/readiness/evidence store or lifecycle UI was found in the inspected source. Historical test counts in VALIDATION.md are not new evidence for this issue.

| Existing issue | Ownership retained there | Contract for this issue |
| --- | --- | --- |
| [#7 Purpose and notes](https://github.com/shelbyklein/skd-workbench/issues/7) | Annotation identity/store, purpose/notes, canonical creation registration, original source links; WN-01..WN-05 are currently pending in TT | Reuse its UUID and registration helper. WN-01..03 are prerequisites for production lifecycle/launch integration; WN-04 supplies notes UI. Do not create a second purpose store or reassign its todos. |
| [#4 Worktree visualization](https://github.com/shelbyklein/skd-workbench/issues/4) | Git inventory/diff, ancestry graph, Worktrees route/list and Git backlog counts; SKD-WT-01..05 remain pending in TT despite inventory code now existing | Verify delivered portions rather than implementing twice. This issue adds lifecycle/evidence panels to that surface. It may initially mount those panels in the existing inventory; final dedicated-route acceptance depends on SKD-WT-04. Graph/diff delivery stays in #4. |
| [#8 Quick actions](https://github.com/shelbyklein/skd-workbench/issues/8) | Provider preferences, fresh collaboration/suggestions, basic reconciliation launch; QA-01..05 are completed in TT, issue still open | Extend its reconciler with selected-batch semantics and guarded preview. Preserve old execution records and settings; do not reopen its completed tasks merely to track this extension. |
| [#6 Session activity](https://github.com/shelbyklein/skd-workbench/issues/6) | Future protocol-owned activity capture | Not a dependency. PTY text is not complete telemetry; support explicit evidence reports now without pretending to parse authoritative check results from terminal prose. |
| [#1 Development lanes](https://github.com/shelbyklein/skd-workbench/issues/1) | Larger Build/Inspector/Ship roadmap | This is the bounded worktree lifecycle slice; no navigation-wide rewrite, deployment service or competing issue inbox. |

Related TT plans: #7 `76EB7584-21A4-4F00-AFC1-E69E4C436E0A`; #4 `local:FEFF6730-A169-49D7-88ED-C11B412546C9`; #8 `56ACFE7E-D82D-4B10-A09F-A0D564E493A5`. Re-read before execution; recorded statuses can change. If prerequisites remain pending, coordinate their existing owners or mark dependent WLC items blocked. This plan does not silently authorize implementing those issues.

## Data ownership and bounded contracts

Freeze names and exact limits in WLC-01. Suggested modules below are implementation boundaries, not permission for competing stores.

1. **Live Git observation:** remains derived from Git. Include repository identity, source and target commits, dirty state, worktree administrative identity, availability, observation time and partial/stale flags. Do not persist a second authoritative branch/worktree inventory.
2. **Lifecycle record:** UUID linked to the canonical #7 annotation UUID; repository identity; creation intent and attachment generation; linked issue/TT references and sessions/workflows; owner reference; intended target; versioned acceptance criteria; blocker/next action; event history and last meaningful activity. Proposed storage: `worktree-lifecycle.json` under FLOW_BENCH_DATA. Purpose/notes remain owned by #7.
3. **Evidence record:** immutable ID, lifecycle/check ID, source session or user, provenance type, commit or explicit dirty-tree fingerprint, criteria revision, environment, start/end/observed timestamps, outcome (passed/failed/not-run/unknown), command description/exit information where supplied, summary, bounded artifact references and acceptance/review event. Proposed `worktree-evidence.json`; append superseding records instead of editing history.
4. **Reconciliation receipt:** immutable batch manifest, selected captured tips and records, exclusions with reasons, target before/after, ordered attempts, merge/validation/remote statuses, evidence IDs, interruption/errors, verification timestamp and next action. An interrupted attempt is retained even with no successful integration.
5. **Attention settings/events:** repository-scoped defaults with policy revision, explicit IANA timezone, thresholds, dedupe keys and snooze expiry. Two project folders in one common repository share lifecycle/attention facts; project-scoped source details remain access-controlled.
6. **Runtime observation:** environment identity, actually observed version/build/commit or artifact hash, source/method and timestamp; separate from desired source HEAD and latest verified checkpoint. Missing adapters or observations are unknown.

Use atomic persistence, schema validation, backup before migration, stale-revision rejection, bounded text/arrays/files and visible corrupt-store errors. Cross-store work must use durable intents and idempotent IDs rather than assume multi-file atomicity. No transcript copies, tokens or credential-bearing URLs in lifecycle records. Initial proposed limits: summaries/blockers/next actions 2 KiB each, at most 50 criteria per task, 32 artifact references per evidence record; use pagination and explicit truncation for histories. Align stricter existing limits in WLC-01.

A branch name or path is not durable identity. Match canonical repository plus worktree administration/creation evidence; moving a checkout may preserve a verified attachment, but path reuse or ambiguity must retain the old record as unattached and require explicit reassociation. External discovery can present an unclaimed candidate without inventing purpose, ownership or acceptance. Removal outside Workbench is recorded as missing/external removal, not successful retirement.

## Lifecycle and readiness rules

Persist events and derive effective state using current facts. Historical Verified events remain readable if later changes make current work ineligible. Missing/stale/unknown is an observation condition and must not be collapsed into Working or a zero count.

| State | Entry/exit rules |
| --- | --- |
| Working | Registered task has unfinished work. A meaningful source, criteria or ownership change invalidates prior readiness. Multiple linked chats do not create new task identity. |
| Blocked | Explicit blocker and next action, or an operation failure requiring intervention. Clearing it returns to a freshly evaluated state; never assumes checks passed. |
| Ready to reconcile | Current membership/identity and target known; selected source clean and committed; no active writer or pending Git operation; criteria defined; required evidence and review accepted for the current source/criteria revision; prerequisites resolved. An agent exit or ancestry alone never qualifies. |
| Integrated | Captured task tip is independently contained in the target; combined-result acceptance still pending. Squash/cherry-pick equivalence is not inferred in v1; ambiguous ancestry remains needs review. |
| Verified | Required checks/review accepted for the final combined target commit, with independently observed Git integration. Remote synchronization and runtime installation remain separate statuses. |
| Retired | Explicit removal succeeded and was rechecked; retain purpose, evidence, receipts and origin links. No new execution can bind to the removed attachment. |

No status dropdown may bypass prerequisites. Ready is an evaluated result plus a review decision, not a free-form claim. A reviewed agent-reported check remains labeled agent-reported; accepting it never relabels it independently measured. Required criteria may be marked not-applicable only by an explicit recorded reviewer reason, bound to criteria revision. No blanket skip-tests success.

For target movement, preserve source-check evidence but invalidate the preflight and reevaluate compatibility/dependencies. Combined validation must be rerun for the final integrated commit. Receipt observations are dated facts; do not erase a previous checkpoint because main later advances.

The task/issue remains the work source. This feature stores lifecycle references and acceptance snapshots, not a second editable copy of the GitHub/TT checklist. Remote issue closure alone never marks the worktree Verified or Retired.

## Evidence capture and diagnostics

The first release supports a structured **Record check** form/API and explicit **Accept evidence / review** action. Fixture adapters can submit independently observed results; human/agent submissions retain provenance. Text that resembles a test command in terminal output is only a claim.

Store enough for diagnosis: expected/actual behavior, reproduction steps for failures, commit/environment/time, command description and exit result where available, evidence links, blocker and next action. Missing output/exit information stays unknown. A dirty-tree result can be retained for diagnosis but cannot establish readiness for a later commit without an explicit verified match; default to rerunning.

Artifact references must be scoped server-side to approved evidence storage/source records with bounded reads and safe MIME/download handling. No arbitrary absolute-path file-serving endpoint, directory traversal or symlink escape. Missing artifacts remain labeled missing. Screenshots/logs needed after retirement must be retained outside the candidate worktree or block retirement.

No arbitrary shell command runner is introduced by Record check. Agents run authorized checks in the existing execution environment and submit structured evidence. A future trusted runner can implement the same contract.

For Workbench itself, report an identity captured at process start (plus dirty/unknown qualifier); reading current checkout HEAD from a running server is not proof that its in-memory code matches. PWA shell version is a separate observation. For other projects, v1 permits explicitly attributed manual observations and unknown status; no general deployment or health-monitoring platform.

## Review thresholds and attention behavior

Proposed initial defaults, exposed in settings rather than hard-coded product rules:
- **3 unfinished task worktrees**: suggest reviewing ready work before creating another. Exclude main/target checkouts and retired records; include blocked/unclaimed non-target candidates; incomplete inventory qualifies the count rather than reporting zero.
- **2 working days without meaningful activity**: flag review. Compute 48 hours falling within Monday-Friday local calendar days in the saved timezone; no holiday calendar in v1. Activity means recorded source changes, session work, evidence or explicit task updates, not opening/refreshing the page. A running session with no fresh telemetry is unknown activity, not confidently idle.
- **1 working day after verification**: offer retirement review if eligibility remains current.
- **Overlapping changed paths**: informational warning between unfinished tasks using bounded comparisons to their merge bases. Include known staged/unstaged changes where available. This indicates potential overlap, never a predicted merge conflict. Missing history/output bounds show incomplete analysis.
- **Source/criteria changed after evidence**: show which checks need repeating.
- **Unknown ownership, dirty integration target, incomplete Git state or interrupted operation**: immediate actionable attention.

Thresholds are soft prompts, not launch quotas. Settings changes recompute deterministically. Snooze records the reason and expiry; a material new condition reappears. Deduplicate by repository + record + reason + triggering revision. Refresh on view entry, explicit Check project, known session/operation completion and a modest foreground refresh while visible; label freshness. No background daemon, external notifications, scheduled provider calls, repeated unchanged toasts or automatic cleanup in this issue.

## Reconciliation and recovery

The new selected-batch mode intentionally refines #8's whole-repository contract. Success must say **Selected batch integrated and verified; N unfinished items remain**, never imply the whole repository is reconciled when exclusions exist. Keep historical whole-repository receipts readable and labeled with their original scope.

1. Preview uses current membership, source tips, target main, chosen unambiguous remote if synchronization is requested, readiness/evidence revisions, owner state and dependencies. Local comparison-target selection must not silently change the integration target.
2. Select ready work; list every excluded known work item and reason. Capture explicit dependencies and verified commit ancestry. Do not assume branch names/creation order define integration order. If a selected branch includes unready prerequisite commits, block it rather than indirectly merge the excluded work.
3. Persist a revisioned manifest/request key before launching. Revalidate it immediately before mutation. Changing selection, source, criteria, repository identity or remote invalidates the preview and requires a new review; never silently widen scope.
4. Retain current shared session/workflow execution ownership across preparation/execution/verification. Do not relax global single-writer behavior as part of this issue. External CLI writers cannot be locked by Workbench: make that limit visible, recheck refs/files at mutation boundaries, stop on detected drift, and require clear ownership when unknown.
5. Run through the existing native-permission CLI adapter, giving it only selected scope and explicit exclusions. Stop for material conflicts, active/unclear writers, incomplete inventory, missing main or target checkout, authentication failure or required PR workflow. No force push, destructive reset, automatic checkout switching, commits of another session's work or cleanup.
6. The batch can verify local integration independently of remote synchronization. Default sync intent should preserve #8's current main-sync behavior when one remote is configured; no remote or ambiguous remotes requires an explicit local-only choice or target selection. A local-only receipt never says pushed/synchronized. Protected branches stay pending until actual merge and post-merge validation.
7. On successful process exit, independently reread Git and verify selected captured tips, target state and accepted final-commit checks. A selected tip already contained is accounted for without needless merge. Unselected work must remain unchanged; compare its captured tips and working-state evidence before/after. Exclusions stay visible.
8. Cancellation/network loss/server restart produces an interrupted/partial receipt. Never automatically retry a merge, push or provider launch. A new explicit attempt first inspects actual state and carries forward only confirmed completed steps. A failed second merge must preserve the first merge and report it accurately; do not automatically roll back history.
9. A result can be integrated but unverified, verified locally but unsynchronized, awaiting PR merge, or fully verified/synchronized with runtime still unknown. Preserve these distinctions in APIs and UI.

## Explicit retirement

Retirement is separate from reconciliation. Viewing eligibility never deletes anything.

Only selected verified, inactive linked worktrees with current unambiguous identity and fresh containment qualify. Refuse the repository's primary worktree, main/target checkout, dirty/staged/untracked work, unpreserved ignored files, submodule uncertainty, locked/missing/inaccessible worktrees, unknown ownership, pending operations, stale evidence or unique commits. Refuse retirement of a folder that remains another connected project's live root until that project is explicitly disconnected/repointed.

For v1, report ignored/untracked assets and block removal until preserved/removed outside this action. Do not implement a new archive engine or silently discard node_modules, .env, local databases or screenshots. Reuse approved evidence storage for retained artifacts. This conservative first slice can gain a separately scoped archive workflow later.

Persist an operation intent, reacquire existing execution ownership, recheck all eligibility, run `git worktree remove` without force, then verify both registration and path state. Keep branch refs and durable metadata. Process selected items sequentially with per-item receipts. On ambiguous result/restart, inspect actual state; no blind retry, recursive deletion, prune, git clean, branch deletion or automatic garbage collection. Existing benchmark cleanup remains governed by its separate archive checks.

## Trackable implementation checklist

WLC-00 records planning only. WLC-01 through WLC-16 are implementation tasks; all remain unchecked until their own acceptance passes.
### WLC-00

- [x] **Prepare and publish the implementation handoff.**

Acceptance: The standalone plan and open GitHub issue contain identical stable implementation IDs, dependencies, ownership and acceptance checks; Tracker Trapper is linked and read back.

Owner: planning coordinator. No application implementation belongs to this item.

### WLC-01

- [ ] **Freeze lifecycle contracts and resolve prerequisite ownership.**

Acceptance: Record the exact integration baseline, #4/#7/#8 delivered interfaces and remaining prerequisite IDs; publish DTOs, state rules and file ownership before parallel implementation.

Owner: Coordinator. Dependencies: Planning complete.

Owned surface: Contract document; shared-file ownership manifest.

Instructions: Refresh Git, source, the canonical issues and all three related TT plans. Separate already-delivered inventory code from still-pending acceptance. Freeze record/DTO/error shapes, limits, transition predicates, policy defaults and integration fixtures. Confirm #7 prerequisites before lifecycle mutations and #4 route ownership before dedicated-view wiring. Record any blocked prerequisite by its existing ID; do not silently absorb or complete it here.

### WLC-02

- [ ] **Implement durable lifecycle records and recovery.**

Acceptance: Temporary-store tests verify stable identity through restart, conservative moves/path reuse, atomic writes, stale revisions, visible corruption, idempotent intents and retained history after removal.

Owner: Data agent. Dependencies: 01; #7 WN-01.

Owned surface: New lifecycle store/domain module and focused tests.

Instructions: Extend the canonical annotation identity by reference; implement lifecycle events, linked source IDs, revision checks, operation intents and restart recovery. Persist only authored state and immutable observations/evidence, never a second authoritative live Git inventory. Account for unattached, missing and externally removed worktrees separately from deliberate retirement.

### WLC-03

- [ ] **Link worktrees to sessions, workflows and task references.**

Acceptance: Interactive and structured fixture launches plus workflow retries attach once to the same lifecycle record; legacy/external work stays explicitly unclaimed and failed registration never starts a provider.

Owner: Coordinator. Dependencies: 02; #7 WN-02 and WN-03.

Owned surface: lib/terminals.js, lib/codex.js, lib/workflows.js; narrow launch adapters.

Instructions: Extend the existing canonical registration helper rather than adding another creation pipeline. Link multiple sessions to a task/worktree without rewriting origin snapshots. Add explicit Continue task against a server-resolved existing worktree with current membership/ownership checks; reconnecting an active terminal still starts no process. New session on an existing task must preserve original task acceptance and current purpose, permit owned dirty work only with explicit continuation intent, and never use the ordinary fresh-worktree path. Keep generic collaboration as a distinct fresh-worktree action. Validate cancellation before launch, workflow workspace reuse and retained worktree after preparation failure.

### WLC-04

- [ ] **Implement evidence records and checkpoint receipts.**

Acceptance: Evidence is immutable, bounded, scoped and bound to commit/environment/time/source; failure, unknown, stale and agent-reported results remain distinct; receipts retain exclusions and references without copying transcripts.

Owner: Evidence agent. Dependencies: 01; reference 02 DTO contract.

Owned surface: New evidence/receipt module and focused tests.

Instructions: Implement append-only check reports, review decisions, artifact metadata and immutable reconciliation receipt schemas. Separate submitted claims from independently observed facts and explicit review acceptance. Add a bounded record-check input path; it records evidence and never executes an arbitrary command. Bind results to commits, criteria revisions and environment. Persist interrupted/unverified receipts after restart.

### WLC-05

- [ ] **Derive readiness and guarded lifecycle transitions.**

Acceptance: A fixture matrix proves dirty/active/stale/unknown/failed states cannot become ready or verified; accepted current evidence permits readiness; code or criteria changes invalidate it without erasing history.

Owner: Data agent. Dependencies: 02, 03, 04.

Owned surface: Lifecycle policy module and transition tests.

Instructions: Implement pure readiness predicates with explanation codes and guarded transitions. Separate historical events from effective current eligibility. Test invalidation by source commit, target changes requiring recheck, dirty files, acceptance edits, stale/incomplete observations, active ownership and failed required checks. Review acceptance cannot override missing Git facts or active writers.

### WLC-06

- [ ] **Implement review thresholds and attention state.**

Acceptance: Deterministic clock tests cover unfinished-count, weekday inactivity, verified-retention and overlap warnings, deduplication, snooze/reappearance, timezone changes and no execution or automatic cleanup.

Owner: Evidence agent. Dependencies: 02, 04; frozen policy contract.

Owned surface: Attention policy/settings module and deterministic tests.

Instructions: Compute deduplicated attention items from authoritative events and observations. Implement timezone-aware weekday inactivity and verified-retention settings, explicit snooze with expiry, and conservative bounded overlap detection. Show unavailable overlap analysis explicitly. Refresh must not count as task activity. Do not install a scheduler, send notifications or invoke a model.

### WLC-07

- [ ] **Expose project-scoped lifecycle APIs.**

Acceptance: HTTP tests reject arbitrary paths, cross-repository IDs, stale revisions and invalid transitions; shared-repository views retain source privacy; bounded reads and idempotent writes recover lost responses.

Owner: Coordinator. Dependencies: 02 through 06.

Owned surface: server.js and focused lifecycle API tests.

Instructions: Wire read/write endpoints to shared services, preserving host/origin guards and asset allowlists. Resolve all paths and identities server-side. Use expectedRevision and operation request keys. Expose check reports/reviews, blockers/next action/settings and read-only operation recovery. Do not expose a general shell or arbitrary filesystem artifact reader.

### WLC-08

- [ ] **Add project health summary and threshold settings.**

Acceptance: Browser checks verify accurate lifecycle counts, unknown/stale states, actionable attention reasons, persisted settings, keyboard/mobile behavior and no writes or launches from viewing status.

Owner: UI agent. Dependencies: 07; may build against frozen DTOs after 01.

Owned surface: New lifecycle overview module and browser suite; coordinator wires app.js/styles.

Instructions: Add health counts, last verified checkpoint, separately observed running version, attention list, Check project, Review work and threshold settings. Check project refreshes local facts; remote check is an explicit separate action with its own timestamp. Avoid duplicating #4 Git counts and preserve existing compact Git row and quick-action placement.

### WLC-09

- [ ] **Add worktree lifecycle details and evidence review.**

Acceptance: Browser checks verify task/session links, blockers, next action, provenance, review/record-check actions, stale evidence, retained history and draft/error recovery within the canonical worktree surface.

Owner: UI agent. Dependencies: 07, 08; #7 WN-04; #4 SKD-WT-04 for dedicated-route integration.

Owned surface: Lifecycle detail/evidence UI module and browser suite.

Instructions: Render status, purpose reference, origins, owner, blockers, next action, criteria, check provenance and historical events. Add Record check, Accept evidence/review and Continue task entry points using existing launch setup. Reuse #7 notes editing and #4 list/route/diff; do not build a competing graph or purpose store. The lifecycle detail module can mount in current inventory while #4 is pending; dedicated-route acceptance remains explicitly blocked until that dependency is delivered.

### WLC-10

- [ ] **Implement selected-batch reconciliation and ownership guards.**

Acceptance: Disposable Git/bare-remote fixtures prove fresh preflight, dependency ordering, one execution per request, coordinated ownership, external drift detection, partial-failure recovery and explicit exclusion of unfinished work.

Owner: Execution agent. Dependencies: 03, 05, 07.

Owned surface: New reconciliation service; lib/quick-actions.js adapter and fixture tests.

Instructions: Create durable preflight/batch manifests with selected IDs and commit tips, criteria/evidence revisions, dependency order, target/remote, exclusions and snapshot fingerprint. Reuse the current PTY/native-permission executor and idempotent launch request mechanism. Hold existing shared execution ownership; do not introduce concurrent app writers. Revalidate before each mutation boundary, record partial progress, and never auto-restart an interrupted merge or push. Enforce selected scope and block ambiguous dependencies, target ownership or dirty selected/target checkouts.

### WLC-11

- [ ] **Verify integrated batches and running-version observations.**

Acceptance: Receipts independently verify selected-commit containment, combined checks and optional remote equality; pending PR/auth/offline/unknown runtime remain distinct and no process exit implies acceptance.

Owner: Evidence agent. Dependencies: 04, 10.

Owned surface: Batch verifier, receipt assembly and runtime-observation adapter tests.

Instructions: Replace whole-inventory success predicates only for the new selected-batch mode. Independently verify captured selected tips in the resulting target and distinguish merged, accepted checks, remote-synchronized and runtime-observed states. Verify checks against the final combined commit, reject stale reports, append receipts with exclusions and per-item results. Add manual bounded running-version observations and an adapter for Workbench's own reported startup build/commit identity; unknown remains unknown for other projects. Do not infer runtime version from a live checkout's HEAD.

### WLC-12

- [ ] **Add reconciliation preview and result UI.**

Acceptance: Fixture UI exercises ready selection, exclusions, overlap notices, validation requirements, stale preview rejection, cancellation/reload recovery and receipt links without duplicate execution.

Owner: UI agent. Dependencies: 09, 10, 11.

Owned surface: Reconciliation preview/result UI; coordinator owns quick-actions glue.

Instructions: Turn Reconcile ready work into preview -> explicit start -> reconnectable session -> receipt. Show captured target, selected items, missing dependencies, excluded work, potential overlaps, required checks and whether synchronization is requested. Reject stale previews without silently refreshing into a larger scope. Display merged-but-unverified, PR pending and cancelled/interrupted outcomes distinctly.

### WLC-13

- [ ] **Implement explicit guarded worktree retirement.**

Acceptance: Real Git fixtures allow only selected verified inactive linked worktrees with fresh identity and reviewed asset retention; refuse dirty/untracked/ignored/unintegrated/main/locked/unknown cases; retain history and recover uncertain removal without force.

Owner: Execution agent. Dependencies: 02, 05, 07, 11.

Owned surface: New retirement service and real-Git fixture tests.

Instructions: Implement preview and explicit removal for selected verified linked worktrees. Recheck identity, containment, session ownership and all file categories under the common execution gate. Inventory ignored and untracked files with bounded output; first release blocks removal when any such assets remain until the user preserves/removes them outside this action. Use git worktree remove without force, retain branches/history, and recover an uncertain result by re-inspecting registration/path instead of retrying blindly. No bulk prune, git clean or recursive folder deletion.

### WLC-14

- [ ] **Add retirement review and retained-history UI.**

Acceptance: Browser tests show exact selected paths, eligibility and asset blockers; explicit retirement requires fresh preview, displays per-item outcomes and preserves readable evidence after removal.

Owner: UI agent. Dependencies: 09, 13.

Owned surface: Retirement preview/results and retained-history UI tests.

Instructions: Show candidate paths, branch/tip, verification receipt, last activity, exact blockers and what remains after removal. Require explicit selected-item removal, disable outdated previews, and render partial per-item outcomes. Historical cards and attached evidence remain readable even when the original folder is gone.

### WLC-15

- [ ] **Exercise integrated lifecycle and failure recovery.**

Acceptance: Full Node and browser suites pass using temporary stores and fixture providers; independently inspect desktop/mobile/keyboard flows and reproduce restart, concurrent edit, stale evidence, partial merge and failed cleanup cases.

Owner: Independent QA agent, then Coordinator. Dependencies: 08, 09, 12, 14.

Owned surface: Independent end-to-end fixture suite and evidence under ignored output/.

Instructions: Exercise the complete user journey and the failure matrix below through real APIs and UI. QA must inspect the integrated commit rather than merely accept implementation-agent summaries. Coordinator runs full Node/browser regression after integration and resolves any failures with targeted retests. Use actual temporary Git repositories, isolated data, fixture providers and local bare remotes; never run reconciliation/retirement on user worktrees as a test.

### WLC-16

- [ ] **Document delivery and perform authorized local activation checks.**

Acceptance: README and VALIDATION identify delivered commits, checks, screenshots, runtime observations and remaining limits; shell cache is updated, live state preserved and any activation authorization or deferral is recorded honestly.

Owner: Coordinator. Dependencies: 15.

Owned surface: README.md, VALIDATION.md, public/sw.js, delivery receipt.

Instructions: Document behavior, criteria defaults, shared-repository policy, limitations, rollback and exact evidence. Register new browser suites and shell assets. Record source, pushed/installed/running identity separately. Under future implementation authorization, inspect active execution and unsaved state before any local restart; if activation is outside scope, explicitly record it as pending. Filing this plan is not activation or permission to consume provider usage.

## Subagent orchestration handoff

This is a dispatch plan, not a dispatch instruction. Start only after the user authorizes implementation. Use at most three worker subagents plus one coordinator at a time. Choose available model/provider settings at execution time; this plan does not prescribe model overrides.

The coordinator owns the canonical integration branch/worktree, source baseline, API/DTO contract, shared-file edits, TT reconciliation, final validation and delivery. Workers use isolated task branches/worktrees named `codex/wlc-<role>`; reuse each worker lane across its dependent tasks instead of creating one worktree per checkbox. No worker merges to main, pushes, restarts the live service or deletes another lane.

### Waves and gates

| Wave | Concurrent work | Gate before advancing |
| --- | --- | --- |
| 0 | Coordinator: WLC-01; verify #7 foundation and #4 route prerequisites with their owners | Frozen DTO/state contract, fixture builders, exact baseline and explicit file ownership. Missing prerequisites remain tracked under existing IDs. |
| 1 | Data agent: WLC-02; Evidence agent: WLC-04; UI agent: WLC-08 shell against agreed fixtures. Coordinator prepares shared integration | Store/evidence contracts pass focused tests. UI fixture work does not count as API acceptance. |
| 2 | Coordinator: WLC-03; Data agent: WLC-05 after 03/04; Evidence agent: WLC-06; UI agent continues 08 then 09 | Real integration through WLC-07; readiness and attention fixture matrix pass. WLC-08/09 cannot complete until real API checks pass. |
| 3 | Execution agent: WLC-10; Evidence agent: WLC-11 after 10; UI agent: WLC-12 against frozen preview/receipt DTOs | Selected batch integration, ownership, stale-preflight, cancellation and lost-response checks pass. |
| 4 | Execution agent: WLC-13; UI agent: WLC-14; independent QA agent begins WLC-15 on available integrated paths | Retirement guards and all end-to-end failure paths pass. |
| 5 | Independent QA + Coordinator: finish WLC-15; Coordinator: WLC-16 | Full integrated checks and visual evidence; delivery state recorded without conflating fixture, runtime or publication. |

Integrate each passed wave into the integration branch before workers base the next wave on it. Refresh existing lanes by the agreed normal merge process; never reset away local worker changes. Hold at most the active role lanes, and account for completed lanes after each wave. Removal of implementation worktrees is still explicit and outside worker authority.

### Shared-file ownership

- Coordinator alone edits `server.js`, launch plumbing in `lib/terminals.js`, `lib/codex.js`, `lib/workflows.js`, `public/app.js`, shared stylesheet, static allowlist, `public/sw.js`, package test scripts, README and VALIDATION. Workers provide small requested glue patches or clearly described integration requirements.
- Data worker owns new lifecycle store/policy modules and focused tests.
- Evidence worker owns new evidence/attention/receipt modules and tests. WLC-01 must settle the import direction between evidence and lifecycle services; do not introduce circular persistence dependencies.
- Execution worker owns new reconciliation/retirement services and tests. It proposes the `lib/quick-actions.js` adapter patch for coordinator integration, preserving pre-existing changes.
- UI worker owns new view/dialog modules and their browser tests. Coordinate the `public/quick-actions-ui.js` adapter change with the coordinator and #8's delivered behavior.
- QA worker owns independent acceptance fixtures/scripts; it reports defects without concurrently rewriting implementation-agent files.
- Every worker receives an exact list of assigned task IDs and files. Reassignment requires a recorded coordinator handoff, not opportunistic edits to another lane.

### Copy-ready worker assignment

> Implement only the assigned WLC IDs from instructions/2026-09-21-worktree-lifecycle.md on the supplied baseline and isolated worktree. Read current AGENTS.md, README.md, VALIDATION.md and related issue contracts. Re-read the linked TT plan; use the existing stable IDs. Verify each prerequisite before starting. Do not edit coordinator/other-worker files; send the minimal requested integration change instead. Preserve existing user data, identity, history and native permission boundaries. Use temporary stores, actual disposable Git repositories and fixture providers. Record commands/results against your commit, and distinguish claims from independently observed evidence. Report blockers immediately. Return changed files, commit(s), exact checks/evidence paths, contract changes and remaining limitations. Do not dispatch more agents, push/merge main, restart services, publish issues or remove worktrees.

### Tracker Trapper protocol for execution

- Plan ID is `local:8B1A3EB7-2154-4FF9-879A-944DE43320E8`; never substitute the issue URL or invent new todo IDs.
- Each worker starts its own run with verified session identity, agentID and parentRunID, and links only its own verified JSONL via watch_session; confirm watch_status. If its environment cannot expose its own session, report that gap rather than link the coordinator's file.
- Start each assigned WLC task before working; complete immediately after its acceptance passes with specific evidence and current expectedTodoRevision. An implementation awaiting integration acceptance stays in progress. Do not mark UI/API tasks complete from mocked DTOs alone.
- Report meaningful milestones and at least every five minutes while active. Record blocked dependencies explicitly and finish each run with its actual status before pausing/ending.
- Only the coordinator reconciles issue checkbox updates with verified TT results. Source of work stays GitHub/TT; lifecycle UI is not a competing checklist.
- Follow AGENTS.md fallback CLI rules if MCP fails: inspect persisted state before retrying. Never take over another agent's active run or change unrelated plan IDs.

## Acceptance and regression matrix

Use isolated FLOW_BENCH_DATA stores and real disposable Git repositories. Bare-local-remote fixtures must use dependency-injected test adapters where production network transport policy disallows local remotes; do not weaken production URL validation to make tests pass.

1. **Identity/persistence:** external and Workbench-created worktrees; moved/reused paths; renamed branches; detached HEAD; missing/locked worktrees; corrupt/unsupported schemas; backup migration failure; interrupted registration; repeat request; two projects sharing a common repository; stale concurrent edits; no historical snapshot rewrites. Also test legacy x.y.z import as aliases, unchanged historical versions/tags, migration dry-run and replay, concurrent work registration without release-number allocation, portable export/import and restoration into an empty store with missing artifacts and ambiguous attachment.
2. **Execution linkage:** new interactive Codex/Claude fixture session; fresh collaboration; reconnect; explicit new session continuing an existing task; owned dirty continuation; workflow retry/next step sharing one record; cancel before provider launch; source folder inside a repo; external writer/unknown ownership; no duplicate processes.
3. **Evidence/readiness:** accepted current checks; failed/not-run/unknown results; no criteria; explicit not-applicable reason; agent reports mislabeled as observed; changed source/criteria; target advance; screenshots/logs missing; malicious artifact path/symlink; unavailable activity; an exit-0 provider with no acceptance report. Verify no false Ready/Verified.
4. **Attention:** exact threshold boundaries, disabled settings, weekends/DST/timezone changes, no holiday assumptions, snooze expiry/new revision, refresh not activity, overlap/incomplete diff, partial inventory not false zero, multiple project views deduplicated.
5. **Reconciliation:** independent and dependent ready branches; branch containing unready prerequisite; ready batch with dirty excluded work; already contained tip; changed ref after preview; changed remote; no/ambiguous remote; dirty target; detached unintegrated work; partial inventory; concurrent writer; first merge succeeds/second conflicts; failed combined test; push/network failure; required PR pending; squash ancestry unknown; restart/cancel/lost HTTP response; one start per request. Prove known exclusions permit a selected checkpoint, unknown/unassigned work blocks certification, full-project scope cannot pass with unfinished items, and none of these operations implicitly increments a product version or claims deployment.
6. **Retirement:** valid verified clean linked candidate; untracked/ignored files including hidden data; externally moved/replaced folder; target/main/primary checkout; another project's connected root; active session; submodules; lock; stale validation; unique commit; missing archive/evidence; removal returns error or response is lost; path remains/registration gone; reload after success; no branch deletion or force cleanup.
7. **UI/PWA:** Project Overview -> detail -> continue task -> record/review evidence -> preview reconciliation -> receipt -> retirement -> retained history. Exercise empty/loading/error/unknown/stale states, cross-project switch with in-flight requests, desktop and 390px layouts, keyboard focus/Escape/return, screen-reader labels, draft protection and explicit PWA update. Viewing pages never launches execution.
8. **Delivery:** focused Node/API/browser suites per changed behavior, followed by `npm test` and `npm run test:browser` on the integrated commit. If an existing fixture flakes, record the original failure and targeted/rerun evidence; do not silently replace required commands with a passing subset. Inspect actual screenshots. Read-only actual-repository UI verification is separate from fixture mutation tests. No real provider inference is required by this plan.

## Working assumptions, delivery gates and exclusions

The Approved operating rules section records the user's accepted product policy. WLC-01 specifies its implementation; it must not silently reinstate release-shaped tangent numbers or require every known excluded task to finish before a selected checkpoint. Working defaults for other details remain: local main integration target; existing configured main-sync behavior when unambiguous; optional deliberate local-only operation; soft thresholds 3/2/1; repository-shared lifecycle settings; first-release retirement blocks unpreserved ignored/untracked assets; manual evidence and runtime observations with visible provenance. Changes to those defaults require documented consequences.

First useful delivery is lifecycle/evidence/attention visibility with mutation actions unavailable until their backend guards and acceptance pass. Then enable selected reconciliation, then retirement. Do not expose a half-wired destructive action behind apparently working controls. Checkpoints must identify the shipped slice and pending tasks.

Before a live restart, inspect active sessions/workflows and preserve drafts/data. A changed shell requires a cache-version bump and the normal explicit PWA Update app action. Implementation, commit/push, installed activation and runtime acceptance are separate receipt fields. Publish only within the future execution instruction's scope; keep the issue open until acceptance is satisfied.

Rollback disables/removes feature entry points and new routes while retaining lifecycle/evidence files, backups, Git refs/worktrees and historical execution records. Never automatically undo merges/pushes or recreate retired folders. Restore code/data schemas only with a compatible tested backup path and explicit review.

Deferred: graph/diff work owned by #4; purpose editing owned by #7; protocol migration #6; external CI integrations; general deployment automation; background monitors/notifications; model-written summaries; automatic test execution from arbitrary submitted commands; archive management for ignored files; branch deletion; automatic prune/cleanup; squash-equivalence inference; general concurrent execution support.

Planning evidence: repository/source and related GitHub/TT plans inspected; session identity and TT watcher verified. This handoff changes documentation/tracking only. No application tests, live UI acceptance, provider calls, implementation dispatch, merge, cleanup, server restart or deployment were performed.
