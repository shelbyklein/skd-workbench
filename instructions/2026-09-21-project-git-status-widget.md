# Project overview Git status widget

## Prompt for Claude

Status: first slice implemented and integrated with the current `main` line. Full Node and browser verification passed; live local-app verification is recorded in `VALIDATION.md`. Preserve unrelated uncommitted work.

### Outcome

Add a compact **Git status** widget above the project's overview navigation cards. It should answer: am I on the integration branch, is my checkout clean, does it match the remote, and are there other branches/worktrees with work to review? Make uncertainty visible. A clean checkout is not proof that all repository work has been integrated.

### Confirmed current system

- `lib/projects.js:17` has a bounded Git subprocess wrapper with argument arrays, stripped inherited Git variables, disabled optional locks/fsmonitor/untracked cache, timeout and output limits. `inspectFolder` at line 43 captures canonical folder, repository root, common directory, branch, commit, dirty state and sanitized remotes. It does not enumerate branches/worktrees or compare upstreams.
- `server.js:178` exposes project-scoped connection reads. Preserve its folder validation, Host/origin guards and bounded errors.
- `public/app.js:258` mounts Priority issues and Last session widgets. `refreshConnection` and `connectionMarkup` around lines 552–570 supply cached connection information and the details dialog. This cache has no freshness guarantee suitable for a current-status badge.
- `public/style.css` contains the responsive `.project-dashboard` and `.project-widget` patterns. `tests/project-widgets-browser.mjs`, `tests/git.test.js`, and connection tests in `tests/api.test.js` provide relevant entry points.
- `instructions/2026-09-21-worktree-visualization.md` already plans inventory, comparisons and a Worktrees page. Reuse that service/contract if implemented by delivery time; otherwise implement the shared inventory prerequisite once. Do not duplicate its worktree tasks, graph or diff viewer. Its GitHub/Tracker Trapper references are recorded context, not live-verified issue status in this investigation.
- At inspection on September 21, this checkout was on `codex/github-issues`, with unresolved index conflicts, three registered worktrees (one detached), four local branches, current branch two commits ahead of its locally recorded upstream, and local `main` one behind locally recorded `origin/main`. No remote was contacted. Shared application files contain merge conflict markers; reconcile ownership before implementation and recheck the current source.

### Ownership and data contract

Git owns current branch, index, worktree inventory, refs and ancestry. Keep derived snapshots ephemeral; no store migration or changes to historical source contexts. Provider execution records can supply verified source links, never current Git truth or inferred acceptance.

Use a project-scoped snapshot with project ID/version, canonical repository identity, local observation time, selected integration target and resolved object ID, current checkout state, local branch rows, worktree rows, coverage/truncation flags and summary. Represent failure/unknown separately from zero. Each branch carries its upstream relationship independently from its integration-target relationship.

Remote observation is separate: remote identity, observed default ref, requested branch tips, observation time and result/error. An in-memory result is valid only for the matching project version, repository, remote configuration and local object IDs. Preserve an older successful result as explicitly stale on failure; never silently reuse it as current.

### First slice and display rules

Render one widget with a short headline, current branch, worktree/change summary, upstream and integration-target comparisons, local and remote observation times, and an expandable branch/worktree list. Use the actual default branch name, not hard-coded `main`.

1. Give unresolved conflicts and merge/rebase/cherry-pick/revert operations prominence. Read operation markers through Git-resolved paths, including linked worktrees. Unmerged files and operation-in-progress are independent facts.
2. Show staged, unstaged and untracked counts independently; a file can belong to more than one category. Include submodule changes. Do not read file contents for this widget.
3. List all local branches, including ones not checked out; associate checked-out branches with registered worktree paths. Distinguish the connected checkout, detached worktrees, unavailable/locked/prunable entries and incomplete inspection. Never scan arbitrary folders.
4. Use the existing Worktrees plan's selectable local integration target and fallback rules. Separately identify the remote default branch. A user-selected comparison branch must not masquerade as the remote default. Ambiguous remote/target selection needs an explicit picker; unavailable discovery remains unknown.
5. Show ahead/behind relative to upstream and relative to integration target with clear labels. Pin resolved object IDs for comparisons. Detect changed refs/HEAD during collection and discard or mark the result stale. No upstream means “No upstream,” not synced.
6. Count distinct non-target local branches with commits absent from the target, checked-out branches separately, and detached work with unique commits separately. Label ancestry results “Commits absent from main” or “Contained in main,” never automatically “Ready to merge.” Squash/rebase integration cannot reliably be inferred from ancestry. Shallow/missing/unrelated history must not create false contained or equal results.
7. A checkout can say “On main · Clean · Matches remote at [time]” only when its branch is the confirmed integration/default branch, working state is known clean, no operation is pending, and its tip equals the observed remote tip. Still show any other branches with outstanding commits or dirty worktrees. A repository-wide “All up to date” requires complete applicable branch/worktree coverage and remote evidence; prefer the narrower checkout statement.
8. Git-only evidence does not prove tests, reviews, required checks or branch protection. Show “Merge readiness not checked.” Do not make a green readiness claim based on process completion, ahead/behind counts or absence of existing conflicts.

### Remote freshness and permitted controls

Opening the widget and **Refresh local** perform bounded local reads only. Local remote-tracking refs are explicitly labeled “Locally recorded remote state”; their equality is not proof of current server state. FETCH_HEAD timestamps are not a per-remote freshness guarantee.

Provide **Check remote**, an explicit bounded read of the selected configured remote's advertised default and relevant branch tips. It must not fetch, update refs/index/FETCH_HEAD, checkout, pull, push or merge. A remote tip matching a known local object permits exact comparisons; if the advertised object is absent locally, show “Remote changed; exact comparison unavailable without fetch.” Do not invent ahead/behind numbers from hashes alone. No remote/auth/network failure may prevent local results from displaying.

Implementation must verify the installed Git read-only advertisement interface before choosing commands. Resolve remote configuration server-side, permit only deliberately supported network transports, disable arbitrary external helpers/protocol overrides, prevent interactive credential prompts, bound time/output and redact errors/URLs. Never accept client-supplied executable arguments, remote URLs or filesystem paths. Do not start a network check merely because a service worker or GET replays a read; use a guarded explicit action endpoint, no automatic retries. Keep the remote result in memory, not the browser offline cache.

Other first-slice actions: expand details, copy a worktree path, open the sanitized repository link, and open the existing Worktrees page when available. A missing Worktrees route must not create a dead link; inline inventory remains useful by itself.

### Ordered implementation checklist

- [ ] **GS-01 — Reconcile the shared inventory contract.** Inspect current branches/worktrees, source conflicts and existing Worktrees implementation/plan. Reuse one bounded read service and canonical Git wrapper, keeping expensive inventory out of every execution source-context capture. Acceptance: clear ownership with no parallel inventory or duplicate tracked tasks.
- [ ] **GS-02 — Implement local status snapshots.** Add branch/upstream/target relationships, index counts and operation state using machine-readable output, NUL-safe paths, full validated refs and pinned object IDs. Bound inventory and concurrency; mark incomplete coverage. Acceptance: temporary real Git fixtures verify the rules above without modifying refs, index or working files.
- [ ] **GS-03 — Expose project-scoped reads and remote check.** Suggested interfaces: `GET /api/projects/:id/git-status` and `POST /api/projects/:id/git-status/remote-check`. Validate project version, repository membership, remote selection and targets server-side; reject stale actions and deduplicate concurrent checks. Acceptance: HTTP tests prove scope, redaction, limits, read-only behavior and remote failure isolation.
- [ ] **GS-04 — Render the overview widget.** Reuse dashboard styling, functional copy, expand/collapse semantics and project navigation guards. Refresh on entry and explicit action, ignore superseded project/target responses, and retain stale data visibly after failure. Acceptance: browser tests cover actionable status, loading/empty/error/stale states, keyboard access, desktop and 390px layout without overflow.
- [ ] **GS-05 — Validate and record evidence.** Update shell allowlist if assets are added and bump `public/sw.js`. APIs remain network-only. Record fixture and actual read-only UI evidence separately in `VALIDATION.md`; update README to distinguish local inspection from explicit network reads. Acceptance: full relevant suites pass and rendered screenshots are inspected. Do not restart the live service without inspecting active execution and preserving drafts.

### Required regression coverage

Use temporary repositories and `FLOW_BENCH_DATA`, fixture providers, and a fixture remote/advertisement adapter. Test clean default branch with equal remote tip; stale local tracking refs despite remote changes; ahead, behind and diverged upstream; no upstream, no remote, multiple remotes/default ambiguity; a local branch never checked out; another dirty worktree while current main is clean; detached, missing, locked and prunable worktrees; staged/unstaged/untracked files, unusual paths and hostile ref text; merge conflicts and operation states; unborn repository, non-Git folder, unavailable Git, shallow and unrelated histories, squash merge, truncation and timeout. Test remote deletion, absent local remote objects, auth/network failure, invalid protocols and redaction. Assert snapshots do not change Git metadata or tracked/untracked content. A remote check must not launch an agent or alter refs.

Exercise real HTTP and rendering entry points rather than copied classification logic. Test out-of-order responses after project switches, simultaneous refreshes, configuration changes, offline/reconnection, preserved unsaved forms, legacy navigation and explicit PWA updates. Run focused Git/API/widget suites first, then `npm test` and `npm run test:browser` after shared integration is coherent. Do not claim runtime acceptance while the checkout has unresolved merge markers.

### Follow-ons and exclusions

Later add GitHub PR metadata for the exact repository/head/base and commit SHA: draft, checks, reviews and provider-reported mergeability, each with timestamp and unknown states. This may support “Ready for review” or evidence-qualified readiness; it is a separate adapter and scope.

Fetch is a possible later explicit action because it writes remote-tracking state. Pull, push, checkout, merge, rebase, branch deletion and worktree cleanup need concrete previews, active-execution ownership checks and stale-state revalidation. They are excluded from this slice, as are a new graph/diff viewer, provider inference, background monitoring and automatic cleanup. This planning task changes no application behavior and does not file or modify an issue.
