# Full-height 3:2 editor and session-style controls — 2026-09-21

- Editor fills the available viewport remainder. Flow and inspector share equal height
  in a 3:2 grid, each with independent overflow scrolling. Selection preserves the
  flow scroll position; mobile stacks bounded scrolling panels. Placeholder fills the
  same right panel before selection.
- Agent-step model selection uses session-style radio pills from the installed Codex
  catalog, and effort uses a discrete model-dependent slider. Saved/custom model labels
  stay intact; custom labels remain available under a disclosure. Catalog failures do
  not erase configuration. Added valid none/minimal/xhigh effort storage so session
  catalog selections persist without weakening provider validation at execution time.
- 65 Node tests pass. Editor, accessibility and workflow browser suites pass. Editor
  regression covers equal heights, 3:2 width, independent overflow, five screen widths,
  model pill selection, keyboard slider and xhigh save/reload, plus custom labels.
- Actual localhost inspection: width ratio 1.49998, both panels 686.21875px high.
  At 650px viewport height the columns scrolled separately to 90px and 60px while
  document scroll stayed zero; selecting another step retained the flow offset.
  Mobile had no overflow, live checks made no API writes, saved-state hashes unchanged.
  Captured/inspected output/editor-panels-desktop.png; evidence in
  output/editor-panels-receipt.json. Restarted only after confirming no active runs.
  PWA cache skd-shell-0.5.0-14; existing windows can choose Update app.

---

# Stable flow editor columns and Run label — 2026-09-21

- Removed selection-dependent desktop/tablet grid widths and gaps. The canvas retains
  its size and position while the adjacent placeholder becomes the step inspector;
  top alignment prevents inspector height from stretching the canvas. Mobile retains
  its stacked inspector. Renamed Run with Codex to Run in the button, post-launch reset,
  and supporting interface copy. Execution behavior is unchanged.
- Editor browser suite passes with geometry comparisons on opening/switching/closing
  settings at 1900, 1440, 1100, 900 and 390px. Workflow, benchmark and accessibility
  browser suites also pass; real execution actions in those suites use fixture providers.
- Inspected actual Tiny Tasks Plan high → build low at localhost: canvas x=359.5,
  y=291.78125, width=680, height=648 before and after selection, identical on switching
  and closing. Mobile has no horizontal overflow. No API mutations, no browser errors,
  and saved state unchanged. Inspected output/editor-stable-open.png; receipt:
  output/editor-stable-receipt.json. Shell cache skd-shell-0.5.0-13 is served locally.

---

# Home project cards — 2026-09-21

- Removed the Without a project / Unassigned Home card. Connected project cards remain.
  Preserved the two starter workflows and the legacy project-selector/history access;
  no project data migration or deletion. Shell cache: skd-shell-0.5.0-12.
- Existing overview browser suite passed. Actual localhost Home inspected at desktop
  and 390px mobile: exactly the two connected projects, no overflow or browser errors.
  Verified both unassigned workflows remain accessible and the entire saved state is
  identical before/after. Screenshot: output/home-connected-projects-desktop.png;
  receipt: output/home-connected-projects-receipt.json. Static assets active locally;
  existing PWA windows can choose Update app.

---

# Tiny Tasks GitHub sandbox and live Apply — 2026-09-21

- Created private https://github.com/shelbyklein/tiny-tasks with explicit user approval.
  Connected the existing /Users/shelbyklein/Vibes/skd-test-project checkout, pushed main
  and benchmark-start at 711d5bbec34d61a64b0d8dc274a42fec765d1e37, and created two
  disposable issue-editing fixtures. The benchmark source, tag, project settings and
  pinned commit remain unchanged; its working tree is clean.
- Verified through the actual localhost Workbench UI: Codex gpt-5.6-sol/low drafted
  issue #1 and Claude haiku/low drafted issue #2. Checked each remote issue stayed
  unchanged during drafting, inspected the proposal, explicitly clicked Apply, then
  independently verified exact saved title/body via gh issue view. Both remain open
  for repeat testing. The UI reported Applied and verified on GitHub.
- The initial test script switched only the hash between cases, leaving the previous
  view active; its target assertion prevented applying the extra Claude proposal to
  issue #1. That unapplied draft is retained as test history. The corrected check reloads
  and asserts the issue number before drafting; the correct Claude issue #2 passed.
- Inspected output/tiny-codex-applied.png and output/tiny-claude-applied.png. Full before,
  proposed-run metadata and independent remote read-back are retained in
  output/tiny-issues-live-receipt.json. No browser page errors. These checks used real
  provider inference and real GitHub writes only on the authorized disposable issues.
- This closes the live-Apply validation gap documented in the earlier feature receipt
  below. No application code changes or additional full regression run were needed.
  Setup/test progress: TT local:A85CCBE1-818D-474A-8C35-957A5983B5DB.

---

# GitHub Issues and headless edit proposals — 2026-09-21

- Added project Issues navigation, current GitHub origin detection, open/closed/all
  filters, pagination, literal Markdown description/discussion reading and GitHub links.
  Reads use the installed authenticated gh CLI. Missing CLI/auth/remote and unavailable
  repositories are reported explicitly; no browsing action publishes or launches an agent.
- Codex/Claude, model and effort controls launch draft-only headless runs under the
  shared executor lock. Codex shell/unified-exec/web search are disabled for this purpose;
  Claude tools are removed. Proposal records persist original target/content and selected
  agent settings. Only explicit Apply submits saved title/body, checks for stale originals,
  serializes local writes and verifies remote read-back. Uncertain results require read-only
  verification, never automatic retry. Navigation and PWA updates respect unsaved input.
- `npm test`: **65/65 passed**. Ten issue tests cover repository selection, GET-only reads,
  PR exclusion, pagination/filter validation, both providers and exact model/effort argv,
  malformed output, stale identity/content/repository, duplicate applies, read-back,
  uncertain writes, cancellation/restart, and literal JSON via gh stdin. The adapter test
  exposed an error-classification bug (callback stderr versus error.stderr), now fixed.
- All **12 Chrome suites passed**. Issues covers real PTY-independent headless subprocess
  fixtures, both providers/models/effort levels, preview/apply, conflict/uncertain recovery,
  persisted history/reload, draft guard, literal HTML escaping, keyboard slider, errors,
  and 390px layout. PWA caches 17 public assets; API data and writes remain uncached.
  Final Issues rerun covers the compact controls and disabled inputs while requests run.
- Actual GitHub reads succeeded for shelbyklein/skd-workbench and the live connected
  Tracker Trapper project. Draft-only real invocations succeeded: Codex gpt-5.6-sol/low
  (13,897 input / 719 output tokens) and Claude haiku/low (4,951 input / 1,046 output,
  including 4,941 cache-creation input tokens). Both produced validated proposals.
  Claude omitted the final newline in a requested no-op body; the smoke comparison
  allows trailing whitespace differences, and the original/proposal remain separately
  inspectable. No second inference was needed to inspect the retained result.
- Real-agent smoke uses isolated stores under output/issues-smoke-* and rejects all
  GitHub writes. Receipts: output/issues-codex-real-receipt.json and
  output/issues-claude-real-receipt.json. Screenshots of actual issue/agent results and
  fixture before/after proposals were captured and visually inspected.
- Activated the existing transient localhost service after confirming no active sessions
  or workflow gates. Resubmitted the launchctl job after its asynchronous removal initially
  left the service absent; health and subsequent live UI checks passed. Live navigation,
  issue reads, actual model controls and mobile inspection made zero API mutations.
  Existing store.json/codex-runs.json/workflows.json SHA-256 hashes stayed identical.
  Evidence: output/issues-activation-receipt.json, issues-live-desktop.png,
  issues-live-agent-controls.png and issues-live-mobile.png. Shell cache: skd-shell-0.5.0-11.

## Boundaries

Only github.com repositories and issue title/body editing are supported. No issue
creation/closure, labels, assignees, or issue-to-code execution was added. Proposal agents
receive title/body plus the requested edit, not assembled code or discussion context.
GitHub's update endpoint is not an atomic compare-and-swap; the final preflight/read-back
checks cannot eliminate an external editor's race during the write. Apply is verified
with fixture GitHub, not a live remote mutation. Real CLI model entitlement is established
only for the two recorded invocations. Existing PWA windows may need **Update app**.

Tracking: GitHub issue #2; TT plan 6C6A86F1-5A2F-4FEF-AE6E-A701DC147D2D;
run 50BA5AA8-2ECD-40AA-9902-1B0B0AC4F95F. Local server activation is not external
hosting or a login-item installation. Issue remains open for user acceptance.

---

# Interactive terminal Sessions — 2026-09-20

- Session creation now uses accessible agent/model radio pills and a model-dependent discrete effort slider. Reset warning is at the top; plain-language worktree help explains one copy for the whole conversation and manual review/merge. Start session launches the selected interactive CLI without requiring or automatically sending a prompt.
- Added node-pty-backed sessions and a locally bundled xterm.js right column. Hide keeps the process alive; Show/reload reconnects without respawning; End terminates it. Normal worktrees persist. Benchmarks archive and clear only after the CLI exits; restart marks interrupted and retains files. Shared executor ownership prevents workflows/sessions overlapping. Output is a bounded local terminal tail; structured token/cost import remains unavailable for interactive sessions.
- `npm test`: 55/55 passed. Five new PTY/HTTP tests cover input/output/resize, repeated reads, shared locks, retained normal worktree/source isolation, benchmark files archived before deletion, stop/restart, validation and cross-origin rejection. A shutdown callback race found in the full suite was fixed; all 55 then passed.
- All eleven Chrome browser suites passed across the validation run and necessary reruns. Legacy Codex/Claude structured results remain inspectable. New terminal coverage exercises matching model pills, keyboard effort slider, top warning, prompt-free launch, actual PTY keyboard input across messages, hide/reopen/reload, provider errors, stop and mobile. PWA test checks all 16 cached assets. Added a terminal CSP-console assertion after fixing blocked generated styles.
- Inspected desktop/mobile controls and terminal screenshots. Both installed Codex and Claude CLIs reached their native startup/trust screen in an isolated temporary project using the actual app UI. No user prompt was submitted, no trust prompt accepted, and both processes were stopped. This verifies CLI startup/terminal rendering, not inference. Screenshots: `output/codex-terminal-installed.png`, `output/claude-terminal-installed.png`; receipt `output/installed-terminal-receipt.json`.
- Restarted the live localhost service only after verifying no unfinished executions. Actual desktop/mobile controls and provider switching verified; `output/terminal-live-receipt.json` records zero live mutations, zero terminal sessions created, and exact preservation of prior state/history. Screenshots: `output/session-controls-live.png`, `output/session-controls-mobile-live.png`. PWA cache is skd-shell-0.5.0-9.
- Fixed the existing archive identity check to recognize the owned Claude branch prefix as well as Codex. Normal terminal worktrees use the established owned branch convention. No automatic merge or history migration.
- Dependencies served locally; postinstall repairs node-pty helper executable mode on Unix. xterm generated styles require inline styles; scripts remain self-only. No external deployment or push.
- TT local:EB00F1FC-6E68-4892-A7F5-3358C4F3DB3B / SKD-TERM-01 and SKD-TERM-02.

---

# Claude Sessions — 2026-09-20

- Added Claude to the shared Sessions agent selector and executor. Native CLI stream output, session/resolved-model identity, usage including cache creation/read, estimated cost, errors and permission denials are retained. Existing Codex records default to Codex; shared lock, worktrees, cancellation, archive/reset and history storage remain in use. Neutral session APIs coexist with legacy aliases.
- Existing 44 Node tests passed. Six Claude tests passed for subprocess output/usage/cost, isolated writes/diff/source preservation, failure results, cancellation/timeouts, restricted tool arguments, discovery/login and sanitized metadata. All ten Chrome browser suites passed, including Claude fixture execution, provider switching, history/reload, rerun agent preservation, authentication failure recovery and mobile.
- Restarted localhost only after confirming no active runs. Actual UI inspection verified Claude sign-in error, disabled launch, mobile fit, and successful switch back to Codex discovery. `output/claude-activation-receipt.json` records zero API writes and unchanged saved state/history. Screenshot: `output/claude-sessions-live.png`.
- Installed Claude Code 2.1.278 reports signed out. No real Claude/model execution was started; live inference and entitlement remain unverified. Run `claude auth login` in Terminal, then reload Sessions. Fixture tests do not establish live-provider success.
- Claude currently supports file inspection and isolated edits only; shell commands, Claude workflows and multi-turn continuation are not implemented. CLI restricted/safe modes and explicit tool lists enforce the available tools. Cost is an estimate, not a bill.
- Activated PWA cache skd-shell-0.5.0-8. TT local:355EEBAA-8EFF-4AB2-8567-E93AE3C8D322 / SKD-CLAUDE-01.

---

# Sessions naming — 2026-09-20

- Renamed the single-agent view, project links, history and entry actions to Sessions; Agent identifies Codex. Canonical URLs use sessions; old codex links still load. APIs and records remain unchanged. Multi-turn continuation and Claude are not implemented in this naming slice, and the form states that follow-up messages are unavailable.
- Codex fixture and overview browser suites passed. Live read-only desktop/mobile navigation, reload and legacy-route checks passed with zero API writes and unchanged state/history (`output/sessions-live-receipt.json`). Inspected `output/sessions-live.png`.
- PWA cache bumped to skd-shell-0.5.0-7. Static assets activated locally; no backend restart needed.
- TT local:2CB54B3D-ABCB-431C-A744-4068624B2499 / SKD-SESSION-01.

---

# Separate Home and Project Overview — 2026-09-20

- Added the missing Project Overview between Home project cards and the Workflows overview. Each level has its own route and contextual navigation. Workflows and standalone Codex tasks are available; Issues, Scratchpad and Knowledge remain visibly planned.
- All nine Chrome browser suites passed. The hierarchy fixture covers distinct pages, reload, project scope, planned-view labels, contextual sidebar, dirty navigation, history/Codex links and mobile layout. No execution requests occurred in that fixture.
- Inspected desktop/mobile fixture screenshots and actual localhost `output/project-hub-live.png`. Live read-only traversal checked Home → Project Overview → Workflows, reload and return navigation, and mobile overflow. Receipt `output/project-hub-live-receipt.json` records zero execution requests and exact before/after equality of saved state and run histories.
- Activated static assets with PWA cache `skd-shell-0.5.0-6`; installed windows can choose Update app. No backend changes, data migration or server restart. No real runs started during this change. Browser validation covers this UI-only change; no new unit-test result is claimed.
- TT plan `local:E1AD8C8F-AE2D-46D2-A8A1-D7B5F4413A84`, todo `SKD-HUB-01`. Solo implementation.

---

# Projects and Workflows overviews — 2026-09-20

- Added Projects as the root/home view, project cards with folder/workflow counts, and a project-scoped Workflows overview with saved workflow cards and recent real runs. Sidebar navigation follows Projects, Workflows or standalone Codex. Run-history/Codex entry points moved into overview content; All projects and the logo return home through the dirty-edit guard.
- All nine Chrome browser suites passed on the final UI. Existing fixtures now explicitly enter the workflow area; standalone PWA checks expect Projects at launch. The new overview fixture covers root/reload, project scopes, empty project, workflow/editor selection, unsaved changes, recent-run/history/Codex navigation, creation entry and 390px layout. No execution requests occurred in that fixture.
- Inspected fixture Projects desktop and Workflows mobile screenshots and actual localhost `output/projects-overview-live.png` / `output/workflows-overview-live.png`. Live read-only traversal verified both pages, two Tiny Tasks workflows, recent history, and no mobile overflow. No launch buttons were clicked.
- Live verification receipt: `output/overview-live-receipt.json`; zero execution requests and exact before/after equality for saved project/flow state, workflow history and standalone Codex history. Existing stopped runs were preserved. This delivery made no project-data migration or backend change and required no server restart.
- Activated static UI with PWA cache `skd-shell-0.5.0-5`. Existing installed windows can choose Update app. No new unit suite was needed for this UI-only change; browser behavior was exercised directly.
- TT plan `local:0168CB72-0BD8-465C-B6D7-B6034B02D7E6`, todo `SKD-NAV-01`; added Projects overview per user steering during implementation. Solo delivery, no delegated agents.

---

# Direct-launch fix — 2026-09-20

- Configured Run with Codex / Try flow start directly. Separate Run settings persists task/acceptance/workspace/limits and agent model/effort; missing settings retain a setup fallback. Tiny Tasks task and acceptance are shared across workflows and populated from its pinned README. No agent steps were altered during activation.
- `npm test`: 44/44 passed. All eight browser suites passed. Added direct real/simulation launch, shared task, saved settings after reload, double-click guard and atomic/stale settings coverage. Browser execution fixtures use a fake provider.
- Activated the local service and PWA cache `skd-shell-0.5.0-4`. Visually inspected desktop/mobile fixture screens and installed `output/direct-launch-live-final.png`. Installed settings are prefilled. Earlier histories and unrelated projects/flows preserved.
- **Verification exception:** a live browser interception attempt was bypassed by the PWA service worker, starting actual Codex run `e60e0eb2-82bd-4f90-8d7c-17ff7b86783b` at 01:00:18 UTC. It was stopped at 01:00:42 UTC as soon as detected. The earlier progress statement that no real run started was corrected to the user. Usage was not reported; zero cost is not claimed. This is an interrupted verification attempt, not a valid comparison result.
- Confirmed that run is cancelled, files/evidence archived, temporary worktree and branch removed, and original Tiny Tasks checkout clean at `711d5bb`. The stopped run remains in history. Receipt: `output/direct-launch-accidental-run.json`. Final installed inspection blocked service workers and did not click either launch button.
- Local TT plan `local:B59B121D-BEBD-4481-AAB2-7F3B2830C807`, todo `SKD-LAUNCH-01`. Functional checks passed; the planned no-real-run verification boundary was breached and is explicitly recorded above.

---

# Resettable benchmark delivery — 2026-09-20

- Implemented and locally activated opt-in pinned baselines, archive-before-reset, per-attempt files/evidence, command output capture, review retention, download links and PWA cache update `skd-shell-0.5.0-3`.
- Existing 35 Node tests passed, plus 8 new benchmark tests. Final benchmark suite passed after archive-checksum and binary-diff preservation changes. Covers repeated baseline runs after HEAD advances, file/binary/link/ignored contents, usage/evidence, review/completion/stop, failed workflow retention, oversized/changed/missing archives, source and symlink rejection, settings preservation and interrupted cleanup.
- All eight Chrome browser suites passed, including the new benchmark suite: pin settings, stale revision protection, required worktree mode, review pause, final reset, archive download, reload and 390px layout. Tests use a fake Codex executable and temporary repositories.
- Inspected `output/benchmark-cleared-desktop.png`, `output/benchmark-cleared-mobile.png` and the actual local app screenshot `output/benchmark-live-ready.png`.
- Live server restarted at `http://127.0.0.1:4390` after confirming zero active runs. Tiny Tasks project `437a6a1e-1d0c-430b-be2d-44b87fa7f671` now pins `711d5bbec34d61a64b0d8dc274a42fec765d1e37` (`benchmark-start`). UI displays reset mode and enforces a worktree. Opened then cancelled launch dialog; no model execution was requested.
- Verified Tiny Tasks source is clean, HEAD/tag unchanged, and its only worktree is its original source. All saved workflows, other projects and run histories survived activation unchanged. Receipt: `output/reset-activation-receipt.json`.
- **No real Tiny Tasks benchmark or paid Codex run was started.** Installed-provider discovery populated the live launch form only. End-to-end reset validation used fixtures; first real benchmark remains for the user to start.
- Archives retain complete final file contents up to 32 MiB / 10,000 entries; exceeding limits or failing verification retains the worktree visibly. Restart does not resume cleanup automatically. Benchmark mode is enabled only for Tiny Tasks. No automatic model-quality scoring, cost estimate or new comparison dashboard is claimed.
- TT plan `local:E02FA78C-9138-42F3-BAC6-9CEA3D87544C`; todos `SKD-RESET-01`, `SKD-RESET-02`. Implementation solo; no agents delegated.

---

# SKD Workbench 0.5.0 — real Codex workflows, 2026-09-20

## Delivered

Saved workflows now execute sequentially through Codex with explicit per-step model/effort mapping, immutable launch snapshots, full prior-output/review-note handoffs, a shared isolated coding worktree, human review pauses, bounded change requests, manual verification gates, retained attempts and aggregate usage. Existing simulations and single-task runs remain separate. Flow design now offers Run with Codex as its primary action; Try flow stays a preview.

Failed/interrupted steps require an explicit retry. A workflow owns the executor until it finishes or is stopped, including while waiting for human review. Stale review revisions are rejected. Overall agent-attempt cap and existing runtime/output caps are enforced; none is represented as a token/dollar limit. Oversized handoffs fail visibly without truncation. Startup retains review gates and marks active steps interrupted without relaunching paid work. Prior attempt output remains inspectable if the server stopped between child completion and workflow advancement; retry may repeat that step, so the UI directs inspection first.

## Evidence

- Full Node suite passed **33 tests**. Final focused workflow suite passed **8 tests**, including two subsequently added checks for active-child cancellation and oversized handoff (35 combined tests). Other workflow checks cover actual subprocess handoffs, shared-worktree edits/source preservation, bounded revisions, evidence-required Check steps, usage aggregation, immutable mapping, invalid model rejection, stale revisions, attempt caps, provider failure, review recovery and stopping during discovery before a paid launch.
- All **seven Chrome browser suites** passed: six established suites passed in the regression run; the new workflow suite passed after correcting its asynchronous history assertion and passed again against final UI changes. Covers explicit mapping, launch, escaped output, review-note preservation, retries/retained attempts, reload at a gate, verification evidence, aggregate usage, scoped history and 390px layout. No page errors.
- Manual **real Codex** workflow (`scripts/smoke-workflow.mjs`) executed through the browser form using installed CLI/ChatGPT auth, gpt-5.6-sol low. First agent read a code; the flow paused before any second call/file creation. After an explicit test review action, the second agent used the prior output to create `handoff.txt` in the **same worktree**. Exact bytes checked; original checkout unchanged. Final review completed the workflow.
- Real reported usage across two attempts: **78,108 input**, **455 output**, **46,080 cached input**. Total **78,563** = input + output; cached input is already included. Both attempts reported usage. This is a smoke-test observation, not a price quote or controlled model-efficiency comparison.
- Receipt: ignored `output/workflow-live-receipt.json`. Inspected screenshots: `output/workflow-live-review.png`, `output/workflow-live-result.png`, `output/workflow-fixture-desktop.png`, `output/workflow-fixture-mobile.png`, and deployed `output/workflow-live-entry.png`.
- Local app activated at `http://127.0.0.1:4390`, reporting v0.5.0 with no page errors. Checked no active Codex tasks before restarting. Existing `.data/store.json` SHA-256 before/after activation: `f39bdfcf4967285e187ddbb8a42858e75e67eff2248a31df956cd32b2f421f67`. No user flow migration/replacement. New workflow history is in `.data/workflows.json`; child executions remain in `.data/codex-runs.json`.

TT plan: `local:A8F03069-7FC7-46B1-9A4D-ABF7578081F5`; run `2FBADA5A-FAA6-4A99-A393-E22BD045E8BD`; TT-WORKFLOW-01 through 03. Session watcher linked to verified current session; explicit progress maintained.

## Remaining increments

Other providers, real-run comparison UI, dollar estimates, automatic merge and independent automated test verdicts remain unimplemented. Check steps record human-provided evidence. Codex-only model review is possible by choosing different Codex models per agent; no Opus/Fable provider support is implied. Every worktree is retained for review; no automatic cleanup removes unfinished changes. Existing PWA windows use Update app after saving drafts.

---

# SKD Workbench 0.4.0 — real Codex execution, 2026-09-20

## Implemented and activated

One real task at a time, scoped to a connected project. Installed CLI model/effort discovery; read-only or isolated Git worktree mode; durable task/output/activity/provenance; reported input/cached/output/reasoning token categories; cancellation, runtime/output limits and interrupted recovery. Codex child supervisor stops the process group if the server parent disappears. Existing multi-step flows remain explicit simulations. No automatic merge, push, multi-provider review, real-run comparison UI or dollar estimate.

## Verified evidence

- Full Node run: 26 tests passed. After adding the server-parent-loss test, all 8 focused Codex tests passed (27 tests in the combined suite). Covers subprocess output/usage persistence, model/concurrency guards, clean worktree isolation and source preservation, cancellation, failure, restart interruption, timeout and orphan-process prevention.
- All six Chrome suites passed: editor, simulation runs, accessibility, projects, PWA, Codex. Codex fixture tests exercise project requirement, model/effort controls, HTTP submission, escaped output, measured usage, reload/history, repeat task, cancellation, narrow viewport and no page errors.
- Two manual **real installed Codex CLI 0.155.1 / ChatGPT-authenticated** tests used the browser form and HTTP runner with isolated fixture repositories. Both used provider-advertised default `gpt-5.6-sol`, low effort. No Newton or TT project work was executed.
  - Read-only task: read fixture text; completed in about 7 seconds. Reported input 29,809; cached input 25,344; output 106; reasoning output 0. Exact file remained unchanged.
  - Coding task: replace one line in an isolated worktree; completed in about 20 seconds. Reported input 77,936; cached input 71,936; output 467; reasoning output 8. Verified exact new bytes, captured diff, original checkout unchanged. Provider output records a failed patch attempt followed by successful correction; usage includes the whole turn.
- Cached input is included in input; reasoning output is reported separately but is not added to the input-plus-output total. These are smoke-test observations, not a model-efficiency comparison or billed dollar amounts.
- Real receipts remain in ignored `output/codex-live-receipt.json` and `output/codex-worktree-receipt.json`. Fixture stores/worktrees are retained under the receipt paths. Screenshots inspected: `output/codex-real-worktree.png`, `output/codex-fixture-mobile.png`, and deployed `output/codex-live-entry.png`.
- Live port 4390 reports v0.4.0; CLI/login/model discovery also succeeds from the launchctl-started server. Live UI has no page errors. Existing store SHA-256 immediately before and after activation: `f39bdfcf4967285e187ddbb8a42858e75e67eff2248a31df956cd32b2f421f67`. No user-data migration or replacement.
- PWA cache bumped to `skd-shell-0.4.0`, including the new UI module. Existing installed windows use the explicit Update app action.

## Tracking and limitations

TT local plan `local:746CE59D-A26D-4718-8364-1F4CAFF0A9BE`; run `199324FC-2B07-4D67-A6D7-C91F26326D0B`; todos `TT-CODEX-01`–`TT-CODEX-03`. Own session verified; watcher reports Watching session output. Explicit milestones and completion evidence recorded.

Model catalog is advertised availability, not guaranteed entitlement. Only the two recorded Sol/low invocations are live-provider verified. Codex credentials remain in the CLI, not the app store. Partial/failed runs without a completion usage event display unknown tokens. Runtime/output limits are not spending caps. Worktrees and modifications are retained for human review; dependencies, network access and task-specific tests depend on the project and CLI sandbox. Old source/data are preserved; reverting the PWA requires a newer cache version/cleanup worker, not merely deleting its assets.

---

# SKD Workbench 0.3.0 — installable PWA, 2026-09-20

## Delivered and verified

- Standalone manifest with stable origin identity, normal/maskable PNG icons, Apple touch icon, run-history shortcut and install action. Browser installation prompt when exposed; external-browser help otherwise. Installed-mode UI hides install action.
- Versioned service worker caches only ten public shell assets. All API methods remain network-only; no project data cache, background sync or queued writes. Offline startup offers launch/reconnect instructions. Failed saves and reconnection preserve drafts in the open window.
- Updates wait for explicit Update app. Drafts, review notes, open dialogs and active actions block reload. Another open window keeps its draft and receives its own reload action.

## Acceptance evidence

- `npm test`: **19 tests passed**, including manifest MIME/identity/standalone display, PNG dimensions and health route, plus existing data/Git/API coverage.
- `npm run test:browser`: **all five Chrome suites passed** (editor, run, accessibility, projects, PWA). Final follow-up PWA suite also passed after strengthening asynchronous reconnect protection and adding a second-window update assertion.
- PWA suite uses an isolated persistent Chrome profile, temporary data and copied shell assets. Chrome DevTools reports **no manifest or installability errors**. Tested offline reload, API 503 responses, shell-only cache entries, no delayed write after reconnection, actual local-server stop/restart preserving editor text, waiting worker, draft-blocked update, explicit activation, old-cache cleanup, retained draft in another window, install fallback and simulated standalone visibility.
- Live server reports v0.3.0 at `http://127.0.0.1:4390`. No browser runtime errors. Desktop/mobile screenshots captured and visually inspected; 390px layout has no horizontal overflow. Offline-startup screenshot also inspected.
- `.data/store.json` SHA-256 before/after restart: `7f89735c273e5cf74becc1b7c9a83c89000e83cf16ec5798d9687a643efb9543`. No migration or user-data edits.
- Screenshots: `output/skd-pwa-live.png`, `output/skd-pwa-mobile.png`, `output/skd-pwa-offline.png`.

## Boundaries and tracking

Installability is verified; no actual installation into the user's browser profile or Dock was performed. Use Chrome/Edge's installation confirmation. The local server remains necessary for project/workflow/Git operations. No automatic login service, remote hosting or model execution was added. Existing simulation limits remain unchanged. The background server uses the existing transient launchctl job.

TT plan `local:30E87383-7820-4597-823B-CA2324060469`; run `89DC941A-F139-4CD8-A4F2-E843B7E8C9DB`; stable todos `TT-PWA-01` through `TT-PWA-03`. Explicit task reporting succeeded. Session identity was verified and linked; the automatic watcher rejected a JSONL record exceeding 2 MiB even after relinking, so automatic activity collection is unavailable for that record. Explicit completion evidence remains recorded.

---

# SKD Workbench 0.2.0 — project scopes, 2026-09-20

## Delivered and verified

- Renamed browser title, sidebar branding, package and launch entry to SKD Workbench. Source directory stays `/Users/shelbyklein/Vibes/flow-bench`; older launcher remains compatible.
- Project picker scopes workflows/history; add/edit validated canonical local folder, inspect/refresh Git, move workflows while keeping historical runs in their original scope.
- Read-only Git detection records repository root, common Git directory, branch/detached state, commit, clean/dirty/unknown status and sanitized remotes. Supports worktrees and folders without Git. Missing folders block new runs until reconnected. No provider or Git network/write operations.
- New runs preserve original project/folder/Git snapshots. Comparisons disclose different projects, folders, commits and unknown/dirty code context.

## Acceptance evidence

`npm test`: **18 tests pass**. Includes migration backup/preservation/idempotence; optimistic project revisions; moves and frozen project identity; code comparison keys; real Git fixtures for ordinary/worktree/non-Git/dirty/detached/unborn states; index byte preservation; remote credential/query sanitization; actual HTTP project and run endpoints.

All four Chrome scripts pass: `tests/editor.mjs`, `tests/browser.mjs`, `tests/accessibility.mjs`, `tests/projects-browser.mjs`. Existing flow/run functionality, keyboard/mobile/reduced motion, and new project add/edit/refresh/move/scope/reconnect/provenance behavior exercised in temporary stores. New project fixtures are test repositories, not the real Newton or TT checkouts.

Inspected screenshots: `output/skd-project-desktop.png`, `skd-project-mobile.png`, `skd-project-details.png`. Live runtime captured and inspected at `output/skd-live-desktop.png` and `skd-live-mobile.png`: correct title, Unassigned selected, two preserved flows, no browser errors, no 390px horizontal overflow.

## Real store migration and activation

Schema 1 → 2 verified in the real `.data/store.json`: **2 flows → 2 flows; 0 runs → 0 runs**. All pre-existing record fields preserved, workflows assigned to Unassigned. The migration backup SHA-256 matches the original bytes: `509726bd34ed41661149715f4261d489a70cf77d8cdb711d07e5d0563879da8c`. Backup: `.data/store.json.schema-1.ba250292-ed2b-46c3-a59b-b66901d0a478.backup.json`. Receipt: `output/projects-migration.json`. Data/backup/screenshots remain ignored by Git.

Running at **http://127.0.0.1:4390**, verified via HTTP and Chrome. A transient macOS launchctl job (`com.shelbyklein.skd-workbench`) keeps this local process independent of the Codex terminal. No login-item plist installed. Stop using `launchctl remove com.shelbyklein.skd-workbench`; relaunch with the new command or npm start. Logs in `output/server.log` and `output/server-error.log`.

TT plan: `local:E14EF694-2752-4ACC-8578-5A600CBDE79B`; run: `B56E9CD2-2550-4E33-9D66-930CC9DDD6E6`; todos `TT-SKD-01`–`TT-SKD-04`. Existing Orchestration Bench source remains clean and untouched.

## Limits

User chooses the actual Newton/TT folder; none was auto-connected to a guessed checkout. Git connection is detection, not remote configuration or provider authentication. Inspection samples current state; it does not freeze/copy project files. Workflows remain simulation-only with unknown usage/cost. No public deployment or GitHub publication.

---

## Historical 0.1.0 delivery

# Validation receipt — 2026-09-20

## Delivered

Standalone Flow Bench 0.1.0, local only. Source lives in `/Users/shelbyklein/Vibes/flow-bench`. Local server launched on `http://127.0.0.1:4390` and opened in the browser. Node reports v26.5.0 in the final verification shell. Runtime has no third-party dependencies. Chrome browser tests use Playwright 1.63.0.

## Passing evidence

- `npm test`: 9 passing Node tests. HTTP flow/run persistence; stale revisions; Host/origin restrictions; immutable snapshots; review pause and bounded retries retaining attempts; cancellation; empty-flow rejection; historical runs surviving flow deletion; corrupted store preservation.
- `node tests/editor.mjs`: Chrome verified create, duplicate, rename, model/effort/instructions editing, save/reload, reorder/remove, empty-flow run guard and 390px overflow.
- `node tests/browser.mjs`: Chrome verified task creation, paused human review, required change note, retry and previous attempt visibility, reload, completion, cancellation, exact same-task rerun, history, matching/mismatched comparison and mobile rendering.
- `node tests/accessibility.mjs`: Chrome verified keyboard focus ring, Enter activation, dialog focus containment, Escape and focus return, dirty-navigation protection, review-note preservation while inspecting output, mobile creation/editor, reduced-motion behavior, no console errors.
- Final local runtime smoke check: page title `Flow Bench`, six starter-flow cards, same app served at port 4390. Captured `output/live-desktop.png` from that running instance and visually inspected it.
- Inspected desktop editor, review state, comparison, mobile editor and mobile inspector screenshots under `output/`.
- Existing Orchestration Bench Git checkout remains clean. No existing bench or Tracker Trapper application source was edited.

## Boundaries

This delivers the first slice agreed in the conversation: flow authoring and simulation. No paid benchmark, CLI/API model execution, actual model-output review, real task test execution, provider availability verification, or token-cost measurement occurred. Simulation outputs are placeholders, human review decisions apply to the walkthrough, and usage is unknown. Simulation time includes human delays. No automatic quality winner is calculated.

No public deployment, remote repository, GitHub issue, or automatic login service was created. A local source commit records this delivery. User flows/runs in `.data/` and generated screenshots in `output/` remain uncommitted. The source/test receipt is reproducible; tests use temporary stores.

## Tracker Trapper

Plan: `local:506F97BB-F6B9-43DB-B710-2C44F69D1B1E`.
Session run: `A02EBCD0-ED67-4929-8A86-9416935A9503`.
Stable todos: `TT-FLOW-01` through `TT-FLOW-05`.
Implementation mode: solo, authorized now. No subagents dispatched.

## Launch again

Double-click `Launch Flow Bench.command` or run `npm start` here. Stop with Ctrl-C in the server terminal. One server per data directory. Backup `.data/store.json` while stopped. Alternate port: `PORT=4391 npm start`.
