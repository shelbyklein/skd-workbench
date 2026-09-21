# Issue work mode and edit mode

## Confirmed interaction

The normal issue page is for working on the issue. **Edit issue** switches to the
existing title/description proposal workflow. Editing execution settings is a separate
inline action and does not put the issue into Edit issue mode. No launch modal.

Use the current 3:2 issue/right-panel layout and breadcrumb hierarchy.

| State | Right panel | Primary action | Result |
|---|---|---|---|
| Work mode, default | Resolved agent/model/effort, orchestration state, plan source/readiness; Edit settings | Start work | Orchestration tracker or single-agent directed CLI |
| Work mode, settings editable | Agent/model/effort and Orchestration checkbox; Reset to plan; workspace/limits where applicable | Use settings, Cancel | Locally configured work mode; no execution |
| Edit issue mode | Requested edit and proposal agent/model/effort controls | Generate proposal | Dedicated proposal diff page; explicit Apply publishes title/body |

- The page-level toggle says **Edit issue** / **Done editing**. Preserve edit drafts
  with existing leave guards. Navigating away from a running session does not stop it.
- Editing work settings does not edit issue text or publish to GitHub. Overrides
  apply to the next run and are recorded separately from the original plan.
- Start work explicitly launches execution; changing mode or settings never does.
- Orchestration ON opens the orchestration screen following actual coordinator and
  worker activity. OFF opens a single-agent view containing the directed CLI.
- The single-agent CLI must receive the frozen issue/approved plan at launch; merely
  opening an empty terminal does not satisfy this feature.

## Settings and provenance

Resolve an exact linked plan version, then display its recommended agent/model/effort
and orchestration state. Show **From approved plan**, **Unverified**, **Needs review**,
or **No plan settings** accurately. Let the user edit settings inline and reset them.
Never treat an issue body's self-reported model name/signature as verified provenance.
Workbench attaches provenance from the planning run, records model/effort requested
(and reported actual model if available), hashes canonical plan content and issue
source revision, and binds human approval to that version. A configured planning
model/effort policy is separate from execution defaults and overrides.

If metadata is missing, display that state and offer manual configuration or planning;
do not invent model/orchestration recommendations. An imported, unverified plan must
be reviewed/validated before describing it as approved. Changing source plan or issue
content invalidates its current approval; changing execution overrides preserves the
original plan and identifies the differences. Do not silently launch stale settings.

Orchestration requires a structured, reviewed task graph with ownership, dependencies,
acceptance checks and resource limits. Turning the checkbox on without a usable graph
must lead to plan preparation, not a fake running screen. Explicit overrides may choose
solo execution; do not quietly discard acceptance checks or source instructions.

## Resolved launch contract

Keep plan provenance, plan approval and run authorization as separate records:

- `PlanRecord`: schema version, stable plan ID/version, source repository + issue ID/
  number, canonical title/body hash, plan-content hash, planning run ID, provider,
  requested model/effort, reported model if available, created time and task graph.
- `PlanApproval`: exact plan/content/source hashes, explicit user decision and time.
  A model's output cannot create approval. Hashes detect changes; they are not a
  cryptographic proof of model identity. Local server records establish provenance.
- `ResolvedSettings`: original defaults, effective settings, explicit overrides and
  origin/readiness state. Use settings changes only the local draft; Start work
  freezes the effective settings. Cancel restores the pre-edit values.
- `IssueWorkRun`: immutable source/plan/approval/settings snapshots, project/version,
  source commit, request key, execution kind, child IDs, workspace records and status.
  Later issue edits do not rewrite a running job or completed evidence.

The default planner policy must be explicit: a user-configured allowlist of provider,
model and minimum supported effort. Never infer “high-level thinking” from model-name
strings or treat effort labels across providers as interchangeable. Expose missing
policy/model support as setup needed. Verification attests configuration/provenance,
not plan quality; human review is separate.

Solo work without an approved plan may proceed only after explicit manual settings
selection, with **No approved plan** displayed; its input is the issue snapshot and
user instruction, not a fabricated plan. Stale or unverified plans cannot be silently
used as approved: offer validation/review or an explicit issue-only solo choice.
Orchestration needs an approved executable graph. A model/effort-only override stays
visible and is frozen at Start; changes to task graph, ownership or dependencies create
a new plan version requiring review. Turning orchestration off is an explicit solo
execution override; turning it on cannot synthesize missing assignments implicitly.

At Start, re-read issue identity/content and project state, check exact plan/version,
validate provider capabilities and resource limits, then acquire shared execution
ownership. Revalidate after asynchronous preflight and before spawning. Use a durable
client request key bound to the normalized launch payload: repeat identical requests
return the existing run; the same key with changed settings is rejected. Persist intent
before process launch. A crash during launch becomes interrupted/needs inspection,
never an automatic second launch. Source changes between display and Start require
refresh/review; a GitHub updated timestamp alone is not a content-change proof.

Directed CLI input must use a provider-supported initial-task mechanism verified
against the installed CLI. If that provider cannot safely accept initial context,
disable directed start with an actionable explanation. No timer-based PTY injection
and no automatic acceptance of CLI permission prompts.

## Orchestration scheduling and workspace rules

Workbench owns the graph and worker lifecycle. A coordinator may propose graph changes,
but cannot bypass approval, resource limits or file ownership by spawning untracked
agents. Keep ordinary solo-session delegation disabled. First orchestration version
uses a reviewed static DAG; graph mutations pause for a revised approved plan.

- A single parent orchestration holds the global execution lease. Internal child
  workers use a dedicated pool scoped to that parent; do not weaken the existing
  single-session ownership check to achieve concurrency.
- Each coding worker has an isolated worktree from the pinned base. Read-only tasks
  may share immutable source. No concurrent writes into one checkout. Dependencies
  consume explicitly accepted predecessor artifacts/integration commits, not arbitrary
  uncommitted sibling worktrees.
- The integration owner applies accepted child commits serially in a separate
  integration worktree and handles conflicts explicitly. Nothing merges into the
  user's original checkout or main, and nothing pushes automatically.
- Cap concurrency and total attempts before launch. Count retries toward limits.
  Unknown usage stays unknown; do not present estimates as provider-reported spend.
- Stop cancels queued tasks, signals every running child, waits for termination, and
  then releases ownership. Save logs and retain recoverable worktrees on failure.
- Restart reconciles each child as interrupted/completed from persisted evidence;
  no automatic replay. Retry is an explicit new attempt, never a rewrite of history.
- Benchmark cleanup happens only after the entire parent finishes and all child and
  integration workspaces/evidence are archived. A failure retains those workspaces.

## Routes and local draft behavior

Proposed nested URLs: `#issues/<project>/<number>` (work), `/edit` (issue editing),
`/proposals/<id>` (existing diff), `/work/<runID>` (solo or orchestration record).
Resolve run kind from the server record, never from an editable URL flag. Validate
project and issue identity on every run lookup. Breadcrumbs return to the source issue.

Work-setting drafts and unsent issue-edit instructions are separate. Switching modes
must preserve each draft in memory or invoke the existing discard guard; no implicit
save/publish. Reload may discard unsaved drafts after the existing unload protection;
persisted runs and proposals must reconnect. Starting work does not discard a pending
issue-edit draft without the user resolving it. Normal navigation never starts/stops work.

## Current code evidence and gaps

- `public/issues-ui.js` implements issue-text drafts and explicit apply only. Reuse
  it for Edit issue; default work mode is new and must not call its proposal endpoint.
- `public/codex-ui.js` and `public/terminal-ui.js` provide sessions and CLI views.
- `lib/terminals.js` currently creates a generic prompt-free session. `terminalArgs`
  disables delegation for both providers. Add server-owned directed launch context;
  do not send the task with a timed keystroke that might hit a permission dialog.
- `lib/codex.js` also explicitly prohibits delegation. Its workflow runner is sequential,
  not a subagent orchestration engine. A checkbox is insufficient to change that.
- `lib/workflows.js` contains unfinished Issue-step scaffolding, not the provenance,
  orchestration or directed-issue-session contracts described here.

## Sol / Terra / Luna implementation sequence

1. Sol checkpoints the current dirty UI work and WIP backend separately. Re-read
   AGENTS.md, current source, tests and receipts before branching. The original
   Issue-step handoff's HEAD/cache/activation notes are historical: cache reached
   skd-shell-0.5.0-20, server restarted for native folder picker, unassigned live flows
   were explicitly deleted, and several later UI fixes remain uncommitted.
2. Sol defines server-owned plan/approval, settings resolution, override and issue-run
   contracts. Freeze these before UI/test lanes. Keep issue-text proposal APIs intact.
3. Terra owns issue mode switching, inline settings, breadcrumb routing and the
   directed-run/orchestration views. Do not display controls as functional before
   their backend exists. Preserve full-width list and standalone diff page.
4. Sol owns directed CLI launch and orchestration scheduling/runtime, workspace
   ownership, provider validation, cancellation, evidence and persisted recovery.
   Persist immutable source plus effective settings and approval reference per run.
   Orchestration screen shows graph/tasks, assigned agents, dependencies, actual
   status/output, review gates, errors and stop/retry controls; refresh must reconnect.
5. Luna owns independent fixture API/browser acceptance for both modes and launch
   branches. No provider usage or GitHub writes for routine tests. Do not assert
   correctness merely from route changes or static UI.
6. Sol integrates serially, verifies full regression, checks live execution before
   local restart, verifies installed UI, and reports source/runtime evidence separately.

## Acceptance

- Edit issue → generate → diff → explicit apply remains functional, isolated from work.
- Work view resolves exact plan settings and source; Edit settings, Cancel and Reset
  preserve expected state. Switching edit/work modes guards unsent issue-edit drafts.
- Single-agent Start launches exactly once with immutable issue/plan instructions and
  selected model/effort; CLI is usable and reconnects after navigation/reload.
- Orchestration Start validates the graph and launches real tracked workers, respects
  dependencies/concurrency, supports human gates/cancel, and retains evidence/retries.
- Missing/unverified/stale plan, unavailable model and incompatible effort are visible
  before execution. A pasted signature cannot pass the verified-provenance check.
- No GitHub writes from settings, planning previews or Start work. Actual issue edits
  still require Apply; code merge/push remain separate authorized actions.
- No duplicate launch after retries, double clicks, polling or reload. No automatic
  relaunch on server restart. Preserve session/worktree ownership and historical data.
- Desktop/mobile and keyboard checks cover mode switching, inline settings, dirty
  navigation, both runtime views and issue/diff breadcrumbs. Capture actual UI evidence.

## Preparation status

This is the clarified product contract and a follow-on orchestration handoff. It expands
beyond GitHub issue #3's Issue-step scope; do not check off #3 as delivering this engine.
No agents dispatched or mode/runtime implementation performed in this clarification.
This extension is tracked locally in Tracker Trapper as described below. Retain the
previous handoff for the underlying Issue-step work and integrate dependencies explicitly.

## Tracker Trapper checklist and lane ownership

Plan ID: `local:11A36CE8-68E3-4E7A-856B-DF530C16ACBA`.
This is independent of Issue-step GitHub #3; no new GitHub issue was published for
this edit. Preparation run: `3B921F56-3169-4E7B-B922-3A9C84DF4E8D`.

- [x] WORK-MODE-00 — Revise and verify the handoff: contracts, launch gates, ownership
  and concrete acceptance are recorded. Documentation review only; no runtime proof.
- [ ] WORK-MODE-01 — Sol: implement plan provenance/settings resolution. Test forged
  imports, missing planner policy, stale approval, content hashes and override/reset.
- [ ] WORK-MODE-02 — Sol: implement directed solo launch. Test exact initial context,
  idempotency, pending preflight shutdown, CLI permission handling and reconnect.
- [ ] WORK-MODE-03 — Sol: implement bounded orchestration. Test DAG ordering, isolated
  writes, parent/child leases, serial integration, conflicts, stop and crash recovery.
- [ ] WORK-MODE-04 — Terra: implement issue modes/inline settings and run views.
  Browser checks prove no modal, correct destination and guard behavior on all routes.
- [ ] WORK-MODE-05 — Sol with Luna evidence: integrated regression and safe local
  activation. Inspect screenshots and demonstrate actual lifecycle with fixtures.

Sol/high owns backend files, new plan/run stores, server routes, global lease changes,
cache/version/scripts and integration docs. Terra/high owns `public/issues-ui.js`,
new issue-work UI module(s), `public/app.js`, `public/style.css` and related presentation
changes; discuss session UI contracts with Sol before editing shared adapters.
Luna/high owns new `tests/issue-work*.test.js` and `tests/issue-work*-browser.mjs`, using
public contracts and fixtures. Luna reports failures; implementation owners fix them.
Sol alone edits existing shared tests during integration. No overlapping live edits.

Dependency order: Sol freezes WORK-MODE-01 contracts; Terra/Luna can then work in
isolated worktrees alongside Sol's runtime work. Integrate settings/solo first, then
orchestration and UI acceptance, then activation. Do not advertise orchestration as
available during a solo-only intermediate milestone. Subagents start their own TT
runs/session watchers; only the assigned owner completes a todo after acceptance.
Luna reports evidence under its own run without claiming another owner's todo.

Before dispatch, re-read this local plan, retrieve TT revisions, checkpoint the dirty
workspace and record actual baseline commits/worktree paths. Finish each run before
handoff/wait. At milestones update explicit task status in addition to watcher output.
Full integration gate: `npm test` and `npm run test:browser`, with new suites added to
the package scripts. Actual provider startup/inference is a separate authorized smoke
test; fixture success does not establish real-provider orchestration compatibility.
