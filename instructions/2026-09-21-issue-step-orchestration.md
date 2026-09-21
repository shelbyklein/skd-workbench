# Issue step — Sol / Terra / Luna orchestration handoff

## Later product clarification

Read `instructions/2026-09-21-issue-work-modes.md` for the confirmed separation of
Work mode, Edit issue mode, inline execution settings, and solo/orchestrated run views.
That follow-on scope requires a real execution engine and verified plan records; this
Issue-step checklist alone does not deliver it. Starting-point details below are
historical; recheck the later UI changes and activation receipts before execution.

## Dispatch brief

Complete and locally activate the Issue workflow step in SKD Workbench. This file
prepares an orchestration; it does not dispatch agents. The user's latest request
supersedes solo implementation with preparation of this handoff. On an explicit
instruction to execute this plan, Sol leads, Terra implements the editor, and Luna
provides independent behavioral tests. Do not create user-owned Codex tasks unless
separately requested; use subagents with isolated worktrees.

“Deploy” here means updating the existing localhost application and its PWA shell.
No public hosting, production website deployment, new paid model runs, GitHub issue
edits by the application, or automatic merge into main is part of feature acceptance.
Prepare a reviewed branch for integration; follow the user's current publication
and merge authorization rather than assuming the old main-merge request applies.

## Verified starting point

- Repository: `/Users/shelbyklein/Vibes/skd-workbench`
- Branch: `codex/github-issues`
- HEAD: `f2695f7d11dd617491ca3d2a3d5b863055de15ce`
- GitHub issue: https://github.com/shelbyklein/skd-workbench/issues/3
- Scope plan: `instructions/2026-09-21-issue-step.md`
- Tracker Trapper plan: `5B228E3A-CC25-48A7-BE89-47D7C5AB9058`
- Previous run: `0DA76314-DCCE-4999-A2CD-63654EC84F0A`; do not reuse another session's run.
- Stable todos: `ISSUE-STEP-01` backend, `ISSUE-STEP-02` editor,
  `ISSUE-STEP-03` verification/activation. None accepted as complete.
- Local app: `http://127.0.0.1:4390`; launchctl job
  `com.shelbyklein.skd-workbench`. Recheck service state at execution time.
- Instructions: read `AGENTS.md`, `README.md`, `VALIDATION.md`, the scope plan,
  `instructions/2026-09-21-github-issues.md`, and real-workflows instructions.

The working tree is essential to this handoff. HEAD alone does not contain the
latest drag UI or the partial Issue backend. Do not reset, clean, overwrite, or
start lanes from HEAD before preserving and checkpointing these changes.

Completed prior UI edits, still uncommitted: `public/app.js`, `public/style.css`,
`public/sw.js`, `tests/editor.mjs`, `README.md`, `VALIDATION.md`. These provide
mouse/touch drag reorder, keyboard Alt+Up/Down, Escape cancellation, a bordered
Remove step button, and removal of the canvas footer. Editor/accessibility suites
passed before the Issue backend edits. Cache is currently `skd-shell-0.5.0-15`.
Those receipts do not validate the partial backend.

Partial, untested Issue implementation: `lib/domain.js`, `lib/store.js`,
`lib/workflows.js`, `server.js`, plus untracked `lib/issue-steps.js` and the scope
plan. Only `node --check lib/domain.js` and `node --check server.js` ran after these
edits. No Issue picker, new behavioral tests, backend activation or acceptance yet.

## Product contract

1. Add **Issue** to Add a step. Choose one issue from the current project's GitHub
   issue list, with open/closed/all state and pagination. Reuse existing read APIs;
   exclude PRs. Show number, title, repository, source link and description preview.
2. Saved step reference is `{id, type:'issue', name, instructions,
   issue:{repository,number,id,title}}`. The nested ID is GitHub's stable numeric
   issue ID. Preview text is not trusted run input. Selection may be unfinished in
   the draft, but save/run must clearly reject an unselected Issue step.
3. At run start, the server reads the latest title/body and verifies repository,
   issue number and identity. Store immutable `issueSnapshots[stepID]` containing
   source identity, title, body, URL, update time and capture time. No refresh on
   retry or resume. Fail before agent execution when a source cannot be read.
4. Issue steps automatically advance in real execution, consume no agent attempt,
   and add direction to every following agent. Several preceding issues accumulate
   in flow order. Individual agent instructions and the saved task still apply.
5. On a retry to an earlier agent, direct issue direction comes only from Issue
   steps preceding that agent. Retained later outputs are historical artifacts,
   not authority to activate a future Issue step. Do not claim complete information
   isolation: prior agent outputs may quote later issue content.
6. Try flow exposes the same captured direction in its simulated handoffs, clearly
   marked simulation. Manual simulation advancement remains acceptable; it must not
   turn an Issue step into a human review/check gate or display undefined model text.
7. Additional task text can be optional for a flow with a selected Issue step.
   Make editor launch checks, forms and backend agree. Existing task requirements
   remain for flows without issues. Preserve benchmark task precedence.
8. Editing/moving/duplicating a flow preserves its selected references. Running it
   in another repository rejects mismatched issue references and asks for selection
   from that project's repository. Do not silently retarget the same issue number.
9. This feature reads title/body only. No comments, automatic issue updates/closure,
   agent issue editing, or new workflow provider support.

## Lanes and file ownership

| Agent | Model / effort | Owned files | Deliverable |
|---|---|---|---|
| Sol, coordinator | `gpt-5.6-sol` / high | `lib/domain.js`, `lib/store.js`, `lib/workflows.js`, `lib/issue-steps.js`, `server.js`, backend unit tests; integration docs, manifest/scripts and final cache bump | Finish/review runtime, enforce contract, integrate lanes, run acceptance and activate |
| Terra, editor | `gpt-5.6-terra` / high | `public/app.js`, `public/workflows-ui.js`, `public/style.css` | Issue picker, saved reference/preview, task form parity, simulation/live step display |
| Luna, verification | `gpt-5.6-luna` / high | New `tests/issue-steps.test.js`, `tests/issue-steps-browser.mjs` | Independent fixture tests for the public contract and browser workflow |

Use exact available model IDs above if the runtime exposes them; if not, report the
missing model rather than silently substituting. Sol is the parent/integration owner;
only Terra and Luna need concurrent child slots. No nested delegation is needed.
Luna must not modify files owned by Sol/Terra to make tests pass; report failures.
Terra must request backend changes through Sol, not edit backend files. Sol alone
edits shared `tests/editor.mjs`, `public/sw.js`, package scripts and final receipts.

## Execution order

### 0 — Sol checkpoints and freezes the contract

- Recheck status, worktrees, current HEAD, issue body, tracker revisions and active
  execution. Preserve any work added since this handoff.
- Inspect and checkpoint the completed drag UI separately from the partial Issue
  backend, then checkpoint the partial backend explicitly as WIP. Include untracked
  source and plans. Keep `.data/`, output, local account data and session files out.
- Create isolated `codex/issue-step-terra` and `codex/issue-step-luna` worktrees from
  that shared checkpoint. Record actual baseline hashes in dispatch messages.
  Do not let either lane operate the live server or use the live data directory.
- Send Terra and Luna the full contract, ownership, scope/issue/TT IDs, baseline,
  relevant API payload examples and tests below. Freeze selectors together before
  browser tests: `[data-type="issue"]`, `#step-issue-picker`, `#step-issue-preview`,
  list rows `[data-select-issue]`, state select `#step-issue-state`, pagination
  `#step-issue-previous`/`#step-issue-next`. Equivalent changes require coordination.

### 1 — Concurrent bounded work

Sol finishes backend while Terra implements UI and Luna writes fixture acceptance.
Luna can build API/domain fixtures immediately and run UI tests after integration.
Subagents commit only owned files and return hashes, test results and open findings.

Review these known unfinished areas before accepting the existing backend:

- Current comparison key includes the full snapshot, including `capturedAt`, and
  inserts an empty object for legacy flows. Identical inputs would compare unequal
  across captures and legacy keys would drift. Hash canonical issue identity/content
  only, excluding capture timestamps, and retain the old key for non-Issue flows.
- Current task fallback uses truthiness, not trimmed emptiness. Reject wrong types;
  handle whitespace consistently and ensure the frontend does not force a redundant task.
- Current issue attempt note repeats all preceding issues. Record that step's own
  snapshot/reference without duplicating cumulative descriptions in history.
- `captureIssues` checks revisions before further asynchronous workspace inspection.
  Recheck current flow/project at the final launch boundary. Verify shutdown during
  GitHub reads cannot persist/launch a new run after shutdown. Ownership must release
  on all preflight errors without releasing another run's ownership.
- Validate snapshot completeness/identity in internal entry points; ignore any
  client-supplied snapshot or description. Keep safe, bounded content and explicit
  failure for oversized combined prompts; no silent truncation.
- Preserve old run readability. Consider source-aware comparison, immutable copies,
  and serial reads vs duplicate issue caching. Verify the source repository again
  when project identity changes; never use an issue from a mismatched repository.
- Define issue display in both real and simulated histories; no undefined model,
  missing icon, false check gate or inaccurate agent count.

Terra's picker must have loading, empty, error/retry, unconnected-project and
selection states; retain valid selection on failed refresh and guard stale async
responses when the user changes step/project. Escape HTML, render issue body as text,
retain keyboard focus, and preserve 3:2 panels, independent scroll and drag behavior.
Use existing GH APIs; reuse compatible styles without taking ownership of issues-ui.js.

### 2 — Sol integrates serially

- Review Terra's diff and integrate UI commit(s), then Luna's tests. Cherry-pick or
  merge one lane at a time; stop on semantic conflicts, preserve existing edits.
- Route failures to the owning agent with a bounded follow-up. Do not take over a
  live agent's worktree or count fixture scaffolding as accepted behavior.
- Bump PWA cache once after final shell changes. Register the new browser suite in
  package scripts. Keep README, VALIDATION and scope checklist accurate.

### 3 — Acceptance gates

Backend tests must prove:

- Validation and saved reference round trip; malformed IDs and PRs rejected.
- Current repository and stable identity checked; missing/private/offline issues fail
  before any child process/agent call; no writes to GitHub.
- Snapshot taken at each new run, reused unchanged across retries/restarts and immune
  to subsequent remote edits or flow edits. Duplicate references fetch once per run.
- Two issue steps at different positions affect exactly the expected agents; backward
  review retry rebuilds appropriate direct direction; automatic Issue advancement
  does not consume agent budget or pause for check/review.
- Stale flow/project, shutdown and failure during pending reads cause no launch;
  ownership and later starts remain correct.
- Simulation parity, old history readability, deterministic comparison key with
  unchanged legacy keys, and clear oversized-input failure without truncation.

Browser tests must exercise Add a step → Issue → select → preview → save → reload,
change selection, error/retry, empty state, pagination, project mismatch, reorder,
removal, task optionality, Run/Try flow source capture and real-run history rendering
using fixtures. Verify 1440px desktop and 390px mobile, keyboard navigation, overflow,
no page errors, no issue mutation requests, and retained prior drag behavior.

Commands from each applicable checkout:

```sh
node --test tests/issue-steps.test.js
node tests/issue-steps-browser.mjs
npm test
npm run test:browser
```

Only final integrated code gets the full regression gate. Test with temporary stores
and fixture providers; no real CLI inference is required. Inspect actual captured
screenshots, including selected Issue inspector and run snapshot/history. Record
failures accurately; an old passing run cannot validate changed code.

### 4 — Sol activates the local app

- Inspect `/api/sessions` and `/api/workflows`, including retained gates, terminal
  sessions, preparing/running/launching/stopping states and pending reset. Do not
  interrupt an active run; report activation pending and finish TT run accordingly.
- Record protected store hashes and take a private local backup of `.data` before
  activation; do not publish it. Stop/start only the identified local launch job.
- The established service uses `/opt/homebrew/bin/node` and the canonical repo's
  `server.js`. Reconfirm launchctl configuration before reuse. Removal and submit
  must be separate completed actions; do not race asynchronous launchctl removal.
- Verify the served backend and PWA cache. Existing windows use **Update app** after
  saving drafts. The new backend must be running before claiming the feature live.
- Inspect the actual Tiny Tasks project's Issue picker with read-only GitHub reads.
  If checking an unsaved draft, discard it explicitly afterward. Do not save or launch
  edits to the user's flow just to obtain a screenshot; test persistent writes in the
  fixture store. Report live read-only UI evidence separately from fixture execution.
- Confirm no unrelated user-state changes, inspect screenshot, record receipts,
  commit final source and report branch/hash. Push/merge only within current explicit
  authorization. No automatic issue closure.

Rollback: preserve all snapshots/new records. Stop the service and restore a tested
source revision only after checking that it can read new Issue records; old code may
reject new step types. Do not blindly restore an old store over new user changes.
Prefer forward repair or keep the app stopped with a clear recovery explanation.

## Tracking and completion protocol

Every executing session starts its own TT run under the plan above, links its own
verified session JSONL once, checks watch status, and follows AGENTS.md reporting.
Assign `ISSUE-STEP-01` to Sol and `ISSUE-STEP-02` to Terra; Luna reports test evidence
under its own run without competing to complete another lane's todo. Sol owns
`ISSUE-STEP-03` and reconciles evidence. Reuse stable IDs and fresh returned revisions.
Start before implementation; complete immediately after acceptance, update GitHub
and local checkboxes, report milestones and at least every five minutes, and finish
all runs before leaving. A handoff is not task completion.

Each lane returns: baseline/worktree, commits, changed files, behavior, exact passing
checks, failures/limits, and integration dependencies. Sol's final report distinguishes
implemented/tested/committed/pushed/local-server-active/PWA-updated; shows inspected
UI evidence inline; links issue and plan. Leave issue #3 open until user acceptance.
If all activation/acceptance gates pass, ask “Can I close this issue?”
