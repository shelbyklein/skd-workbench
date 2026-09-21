# Visualize project worktrees and unmerged branches

<!-- skd-worktrees-visualization-2026-09-21 -->

Status: planned; implementation is not authorized by this planning request.
GitHub issue: https://github.com/shelbyklein/skd-workbench/issues/4
Tracker Trapper plan: `local:FEFF6730-A169-49D7-88ED-C11B412546C9`.
Local plan: `instructions/2026-09-21-worktree-visualization.md` (uncommitted; the issue contains the full plan).

## Outcome

Opening a project should immediately answer: how many worktrees have accumulated, which checked-out branches contain commits absent from the comparison target, and where there are uncommitted files.

Place a compact **Worktrees** summary above the Project Overview cards, linking to a dedicated **Worktrees** page. Mirror the unmerged-branch count on Home project cards. The detail page combines a compact ancestry diagram, an accessible list, and inspection details.

Example summary: “6 worktrees · 4 with unmerged commits · 1 contained in main · 1 target checkout.” Show the selected comparison target and last checked time. Dirty-file counts are independent of these categories.

## Evidence and boundaries

Inspected 2026-09-21 in `/Users/shelbyklein/Vibes/skd-workbench`, branch `codex/github-issues`, HEAD `d7edd1de5c0d69145218084669c4cdf5f13045f1`, plus the current working files. Many unrelated changes and active navigation/Graft work are present; reconcile shared-file ownership before implementing. This is source inspection, not runtime acceptance.

- `public/app.js`: `renderProjects`, `renderProjectOverview`, `connectionMarkup`, routing, and `refreshConnection` are the current integration points. Project details shows the connected checkout's branch/status; it does not enumerate the repository's worktrees.
- `lib/projects.js:inspectFolder` already separates selected folder, repository root and common Git directory, and uses bounded read-only Git subprocesses.
- `server.js` exposes project connection reads and guards local HTTP access; extend these patterns.
- `lib/terminals.js` records source context, branch and worktree path and normally retains worktrees. Workflow/session records can supply provenance, but Git owns current inventory and commit relationships.
- `README.md` and `VALIDATION.md` describe retained worktrees and the existing verification rules. Historical receipts do not establish current behavior.
- Related roadmap: https://github.com/shelbyklein/skd-workbench/issues/1, Build → Changes. This issue implements only the worktree inspection slice; it does not require reorganizing the entire navigation.

## Scope and comparison semantics

1. Discover every registered worktree of the connected repository, including folders outside Workbench and outside the project folder. Use canonical common Git directory identity; never scan arbitrary disk folders. Mark the connected checkout and target checkout explicitly. Two project scopes may view the same repository inventory without sharing sessions or changing project ownership.
2. Show branch or detached HEAD, folder, abbreviated commit, ahead/behind counts against the selected target, working-file state, and known source session/workflow/issue links. Missing, locked, prunable, bare, inaccessible and partially inspected entries remain visible with accurate states.
3. Default to a locally resolvable branch matching the configured remote default when available, then unambiguous local `main`/`master`; otherwise ask for a target. Prefer an existing local branch over its remote-tracking counterpart. Label local versus remote-tracking refs explicitly. Do not fetch or guess that the connected feature branch is the integration target.
4. Count **unmerged checked-out branches** as distinct non-target named branches with commits absent from the selected target. Count all worktrees separately. Detached worktrees with unique commits get a separate “detached work to review” category. Dirty-only work still needs attention but must not inflate the unmerged count. Unknown inspection results stay unknown, not zero.
5. Ancestry proves “contained in target,” not review readiness. A branch equal to or an ancestor of the target is contained; ahead/behind indicates divergence. Squash/rebase merges may retain distinct commit identities: explain that ancestry cannot prove their integration and do not label them safely disposable. Merge conflicts, tests and approval are not inferred.
6. Show only verified commit-ancestry relationships in the diagram. Label them as ancestry, not intended merge order or declared branch parentage. Independent branches fan out; shared tips may share a commit node; ambiguous histories remain explicit. No invented stack edges or counts based on branch names.
7. Open a branch detail with bounded committed diff against the selected target's merge base and separately labeled staged/unstaged changes and untracked filenames. For no merge base, display that state rather than a misleading empty diff. Offer path copying and existing supported folder opening; do not expose an arbitrary filesystem opener. Link historical sources only through recorded identity, never branch-name guessing.

## Architecture and lifecycle

- Add a focused read-only service, proposed `lib/worktrees.js`, using the established Git environment protections. Inventory through machine-readable, NUL-safe output; validate refs and use argument arrays. Disable external diff/textconv helpers. Bound subprocess time, output, inspected history and concurrency; display truncation and partial failures.
- Proposed APIs: `GET /api/projects/:id/worktrees` and an associated worktree-detail/diff read. Resolve project, repository and worktree paths server-side. Clients select server-issued identities and validated refs, never arbitrary paths or shell arguments. Revalidate repository membership before each detail read.
- A snapshot includes project/version, repository identity, target ref and resolved commit, observation time, row states, summary counts and partial/error flags. Resolve commits once for coherent comparisons; if a checkout or ref moves during inspection, mark stale and refresh rather than silently mixing states.
- Git owns derived data. Do not add a persistent worktree database, mutate historical run snapshots, or migrate project records. Keep the selected comparison ref in project-scoped browser preference shared by Home and detail; revalidate it on load. Clear/refuse invalid selections visibly. In-memory caches must include repository identity and target and have bounded lifetimes.
- Refresh on view entry and explicit Refresh. Home reads are bounded/deduplicated per repository/target. Cancel or ignore superseded requests after project/target changes and disposal. Retain last successful data with a stale/error label after failed refresh; offline data is not current. No automatic execution or retry of writes.
- Proposed route: `/#worktrees/<project-id>`; breadcrumbs Home → project → Worktrees. Preserve legacy routes, unsaved draft guards and explicit PWA updates. The list is the full keyboard-accessible alternative to the diagram, including relationship text. Use existing styles, a compact SVG graph, and mobile stacking; a graph dependency is not required.
- Shared navigation, server allowlists, stylesheet and service-worker files must be reconciled with active work. Add new shell assets explicitly and bump `public/sw.js`; API data remains network-only.

## Ordered todos

- [ ] **SKD-WT-01 — Implement repository-wide worktree inventory and comparison snapshots.** Acceptance: Real temporary Git fixtures verify all registered worktrees, external paths, target selection, ahead/behind, ancestry, dirty and unknown states without modifying Git or working files.

- [ ] **SKD-WT-02 — Expose bounded project-scoped worktree and diff APIs.** Acceptance: HTTP tests reject arbitrary paths and cross-repository identifiers, bound output and concurrency, show partial failures and stale snapshots, and perform no Git writes or provider execution.

- [ ] **SKD-WT-03 — Add Project Overview summary and Home backlog counts.** Acceptance: Browser tests prove counts match inventory and the selected target, main/target checkout is excluded from backlog, and loading/error/partial states never display a false zero.

- [ ] **SKD-WT-04 — Build the Worktrees graph, accessible list and inspection details.** Acceptance: Deep-link, refresh, target switching, ancestry graph, diff, path and known-source links work; desktop/mobile and keyboard screenshots are inspected; unrelated branches are not shown as a stack.

- [ ] **SKD-WT-05 — Verify integration and document delivery evidence.** Acceptance: Full Node and browser suites pass on temporary stores, shell cache is bumped, read-only actual-repository UI is inspected, and VALIDATION.md separates fixture and live evidence and records remaining limitations.

Execution order: inventory → APIs → overview counts → detail/diagram → integrated acceptance. At implementation start, retrieve this existing Tracker Trapper plan and stable IDs, start this agent's own run, link its verified session and report progress under current AGENTS.md. The planning receipt SKD-WT-00 is separate from the implementation checklist.

## Acceptance and test matrix

Use real temporary Git repositories and isolated `FLOW_BENCH_DATA`, with fixture execution providers only.

- Independent branches and a genuine ancestry chain; ahead-only, behind-only, diverged, same-tip and contained branches; branch updated after the snapshot; squash merge that cannot be classified as contained by ancestry.
- Main checkout plus linked worktrees created outside Workbench, paths with spaces/unusual characters, project folder inside a repository, and distinct connected projects sharing the same common directory.
- Staged, unstaged, untracked and dirty-only changes; detached HEAD with unique commits; locked/prunable/missing folders; no commits, missing target, unrelated histories, shallow/incomplete history, non-Git folder, and Git timeout/partial failure.
- HTTP scope/path/ref validation, stale identity rejection, bounded/truncated diffs, escaped branch/file names, no disk/index/ref mutations, and no provider launch.
- Home → Project Overview → Worktrees, direct reload, navigation back, target change, refresh, empty/loading/error states, stale responses after project switching, source links, keyboard-only operation, desktop and 390px mobile without page overflow.
- Run `npm test` and `npm run test:browser` for final integration. Inspect rendered screenshots. Separately inspect an actual repository through the UI read-only, recording timestamp/target and any live limits. Record evidence in `VALIDATION.md`; do not equate fixture tests with live acceptance.

## Assumptions, delivery and deferred work

Working assumptions: the initial scope is registered worktrees rather than every local or remote branch; the target is explicitly selectable; graph connections represent verified ancestry. These keep the feature focused on accumulated checked-out work. A complete branch explorer, GitHub PR state, reliable squash-merge equivalence detection and conflict prediction are deferred.

No merge, rebase, checkout, fetch, push, branch/worktree creation or deletion, pruning, agent dispatch, or automatic cleanup is included. A contained branch with dirty files must never be presented as safe to delete.

This request authorizes the plan and issue only. Future implementation should preserve existing data and active executions, use current repository delivery rules, and check active sessions before any local activation/restart. Rollback removes the feature's code/assets and browser preference while retaining all worktrees, Git refs and execution history. Keep this issue open until implementation acceptance is satisfied.

Planning validation: repository/source and related issues inspected; no application tests, runtime UI verification, provider calls or server restarts performed for this plan.
