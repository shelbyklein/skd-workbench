# Skills and Connections (MCP) — 2026-09-21

- Added available global and project Skills and Connections pages above and within
  projects. Skills provides bounded recognized-root discovery, managed text import,
  versioned CRUD/archive, project/provider defaults and session/workflow-step overrides.
  Connection inventory covers Codex TOML and Claude JSON with precedence, canonical
  boundaries and redacted API/history records. Provider files are read-only.
- Real launches retain exact skill text/version snapshots. Codex receives it as
  `developer_instructions`; installed `codex debug prompt-input` showed the marker once
  in a developer item and the task once in a separate user item. Claude interactive
  launches use `--append-system-prompt`; issue-edit proposals remain skill-free.
  Workflow retries reuse the frozen snapshot after eligibility revalidation.
- Native or managed MCP policy applies only to future sessions. Read-only, structured,
  workflow and issue-edit paths are MCP-free. Managed Codex startup enumerates effective
  configuration, disables every unselected server and reconstructs the selected server.
  An installed-CLI fixture check reported only `skd_fixture_keep` enabled and the other
  fixture disabled. Managed Claude uses restricted/strict config, disabled hooks and an
  exact tool allowlist from a successful explicit catalog check. A live Haiku fixture
  run reported one connected server and exactly
  `mcp__skd_fixture_keep__skd_fixture_tool`; no tool was called.
- Explicit stdio checks perform initialize and `tools/list` only, with timeout/output
  bounds. Fingerprints are stored with assignment and revalidated before launch. Inline
  credentials and unsafe names cannot use managed activation. Claude's temporary config
  is private and deleted after use/startup; secrets and raw provider definitions are not
  returned through APIs or persisted in run history.
- Focused Node coverage passed inventory, symlink/malformed/oversize/corrupt storage,
  versions, exclusions, explicit empty selections, cross-project scope, frozen snapshots,
  provider argv/instruction channels, fingerprint changes, adapter isolation and cleanup.
  Skills/Connections Chrome coverage passed global/project routes, CRUD/import/reload,
  assignment persistence, dirty navigation, redaction, explicit tool-list verification,
  invalid routes, dark desktop and mobile overflow. `npm test` passed 93/93 and the
  complete 18-script Chrome suite passed with fixture providers and temporary stores.
- After confirming 0 active sessions and 0 active workflows, restarted the existing
  `com.shelbyklein.skd-workbench` loopback service. Live read-only traversal found 81
  recognized skills and 33 redacted connections, exercised Home plus global/project
  Skills and Connections at desktop and 390px, produced no browser errors or write
  requests, and left all persisted-data hashes unchanged after startup initialization.
  Inspected `output/skills-connections-live-home.png` and
  `output/skills-connections-live-project-mobile.png`. Shell cache is
  `skd-shell-0.5.0-50`; an installed PWA window still needs its explicit Update app
  action and was not separately tested.

---

# Flow deletion — 2026-09-21

- Deleted the two live Unassigned flows through version-checked DELETE requests:
  Plan, review, build; One model, start to finish. Verified assigned flow records
  and simulation history exactly unchanged. Local recovery copy retained at
  output/deleted-unassigned-flows-backup.json. Empty Unassigned sidebar link disappears.
- Delete flow now stays in the editor toolbar with a step selected. Confirmation
  names the flow and explains saved-history retention and unsaved-edit removal.
  Success returns to Workflows; stale-version/server errors remain in the dialog.
- Editor browser suite passed cancellation, deletion with inspector open, reload
  persistence and unchanged saved-run snapshots. Live confirmation/cancel inspected
  in output/delete-flow-confirmation.png without deleting an assigned flow.
- Shell cache skd-shell-0.5.0-20; no server restart required.

---

# Native project folder selection — 2026-09-21

- Add/Edit project has Choose folder… backed by a loopback POST route and fixed
  macOS choose-folder script. No shell/user-script interpolation; one picker at a
  time, bounded timeout, cancellation preserves the path, errors retain manual entry.
  Selection fills the field only; existing save-time canonical-folder checks remain.
- 68 Node tests passed. Sidebar browser fixture checks passed selected path, cancel,
  failure/manual fallback and retained project name. Native chooser opened visibly
  and returned cancelled:true on cancellation. Live dialog screenshot captured;
  saved store/session/workflow hashes unchanged after restart and read-only inspection.
- Restarted the existing launchctl server only after checking no active execution.
  This loads current server sources, including unfinished Issue-step backend scaffolding;
  it does not complete or expose the pending Issue-step editor/orchestration feature.
- PWA cache skd-shell-0.5.0-19. Existing windows use Update app.

---

# Issues views and functional UI copy — 2026-09-21

- Split project Issues into full-width list, nested issue detail with 3:2 agent editor,
  and dedicated proposal diff route. Breadcrumb ancestors return to issue/list.
  Generate and proposal history open the diff; reload retains the selected proposal.
- Preserved explicit Apply, conflict and uncertain-write verification, pending/draft
  navigation guards, escaped source text, comments, state filter and pagination.
- Removed decorative taglines/headings across Home, project, editor, Issues and Sessions;
  retained functional instructions/status/errors. Added the UI copy rule to AGENTS.md.
- Issues browser fixture suite passed generation with both providers, apply, conflicts,
  verification, reload, 3:2 geometry, separate views, dirty guard, mobile and errors.
  Editor, accessibility and overview browser suites also passed. Inspected list/detail/
  diff screenshots. Live localhost view checks use existing issues/proposals only.
- Cache skd-shell-0.5.0-18. No live server restart or Issue-step backend activation.

---

# Persistent project sidebar — 2026-09-21

- Sidebar lists connected projects on every view, highlights the active project,
  offers Add project, and preserves access to legacy Unassigned workflows. Project
  details moved to project overview; workflows are selected from their overview.
- Project changes retain pending/unsaved guards. Desktop list scrolls; mobile list
  scrolls horizontally without document overflow.
- Sidebar, overview, editor, accessibility, project, simulation, Codex UI and PWA
  browser suites passed. Updated tests to navigate through the project list and
  breadcrumbs. Inspected fixture and actual localhost screenshots, including
  output/projects-sidebar-live.png. Live inspection made no data writes.
- PWA cache skd-shell-0.5.0-17. No restart; partial Issue backend remains unactivated.

---

# Unified breadcrumbs — 2026-09-21

- Replaced duplicated header labels/actions with one left-aligned semantic breadcrumb
  navigation: Home, project, view, current item. Ancestors link to real routes and
  preserve pending/unsaved guards; current page uses aria-current. Narrow layouts wrap.
- Overview/navigation and editor Chrome suites passed, including dirty navigation,
  desktop/mobile layout and retained drag behavior. Inspected rendered desktop header.
- Live localhost verified Tiny Tasks hierarchy, project ancestor navigation and mobile
  overflow without data writes. Screenshot: output/breadcrumbs-live.png.
- Shell cache bumped to skd-shell-0.5.0-16; no server restart needed. Unfinished Issue
  backend work remains separate and has not been activated by this UI change.

---

# Drag-to-reorder flow steps — 2026-09-21

- Replaced inspector Move up/Down controls with pointer dragging on flow cards,
  visible grips, insertion indicators and edge auto-scroll. Touch dragging uses the
  grip; Alt + Up/Down reorders a focused card, and Escape cancels a pointer drag.
  Existing stable IDs, explicit save, dirty guards and retry-target repair remain.
- Remove step is now a bordered danger button with its existing confirmation.
  Removed the editor Saved on this Mac / Connected in order footer.
- Temporary-store Chrome editor suite passed mouse drag, touch drag, keyboard
  reorder, Escape cancellation, order persistence across save/reload, removal,
  five-width geometry and mobile overflow checks. Accessibility suite passed.
- Inspected output/editor-reorder.png. Live server asset reads confirm updated
  drag code and PWA cache skd-shell-0.5.0-15 without a restart or live data writes.

---

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
## Compact view headers — 2026-09-21

Combined each view title, breadcrumb trail and page actions into one shared top
header. Removed the duplicate Home breadcrumb and redundant project eyebrows.
Headers wrap on narrow screens; flow metadata and existing button handlers remain.
Verified overview navigation, flow editor and issues browser suites with fixture
providers. Inspected live Home/project screenshots in
`output/compact-header-home.png` and `output/compact-header-project.png`; checked
1100px, 800px and 390px layouts for horizontal overflow. Shell cache version is 22.
## Dark theme — 2026-09-21

Added persistent System/Light/Dark appearance selection, applied before paint and
synchronized across windows without rerendering drafts. Dark colors cover shared
surfaces, inputs, dialogs, flow states, warnings, issue/proposal content and output.
Terminal retains its existing dark palette. Browser checks passed system default,
explicit preference across reload, unsaved editor retention, dialog rendering and
390px overflow. Inspected `output/dark-editor.png`; captured Home and dialog too.
PWA suite passed with the theme bootstrap included in the offline cache (version 25).
Checked live sessions/workflows were inactive before restarting the local server.
## Issue loading — 2026-09-21

The initial detail request shares one fresh issue snapshot with local work-settings
resolution. It no longer waits for comments or provider discovery. Discussion loads
on expansion; proposal history and edit-model discovery load independently. Provider
validation remains on settings saves and execution starts. Fourteen focused Node
tests and the issues browser suite passed, including assertions of one issue fetch
and zero comment fetches before opening Discussion. Cache version 27.
## Editable CLI direction — 2026-09-21

Renamed Edit settings to Edit plan and added a local CLI prompt, saved with the
execution choices and displayed in the summary. Start freezes the prompt and passes
it as user direction alongside issue/approved-plan context. Cancel discards the draft;
reset clears the local override. Invalid saves preserve the previous prompt/settings.
Five issue-work tests and the issues browser suite passed, including saved-prompt
delivery to the launch adapter. No real inference or GitHub write was performed.

## Single worker orchestration settings — 2026-09-21
- Orchestration accordion now exposes exactly two assignments: Orchestrator and Worker, with independent provider/model/effort controls.
- Worker defaults use a common plan task assignment when present, otherwise the plan settings/current settings. One saved worker choice is validated and expanded across the approved graph's task IDs; dependencies and task count remain unchanged.
- Validation: npm test passed 76/76; tests/issues-browser.mjs passed with fixture providers, keyboard toggle checks, and two-assignment assertion. Inspected output/orchestration-worker.png.
- Orchestration runtime remains unavailable; no real inference was launched.

## Orchestration accordion header — 2026-09-21
- Moved the switch to the right of the accordion heading. Opening enables orchestration; closing disables it. The switch also opens/closes the accordion, preserving entered assignments while collapsed.
- Issues browser fixture suite passed, including opening-to-enable and keyboard switch-to-collapse assertions. Inspected output/orchestration-worker.png; git diff --check passed.

## Issue header icon actions — 2026-09-21
- Edit issue now uses a save icon; Refresh uses a refresh icon immediately to its right in the detail header. Accessible names/tooltips and existing actions remain intact.
- Issues browser fixture suite and git diff --check passed. Inspected output/compact-work-plan.png for placement.

## Consistent orchestration selectors — 2026-09-21
- Orchestrator and Worker now use agent/model radio pills and model-specific effort sliders, matching the main work controls. Each assignment loads its own provider catalog and preserves separate settings.
- Issues browser suite passed with Worker model selection and keyboard effort adjustment, verifying the Orchestrator selection stays unchanged. Inspected output/orchestration-worker.png. git diff --check passed.

## Global settings and project System pages — 2026-09-21
- Added cog buttons beside Add project, a global settings modal, persisted light/dark accent colors, and provider-specific model visibility pills. Preferences live in settings.json with validation, atomic writes and stale-version rejection. Hidden defaults apply to sessions, issue work/edit, orchestration assignments, flow editor and workflow selectors; saved selections remain available.
- Added project System navigation with project settings and escaped, read-only instruction previews. Global settings previews Workbench files. Discovery is project-bounded, excludes external symlinks, and limits previews to 64 files / 128 KB each. It does not claim to expose the provider's entire effective prompt.
- npm test: 78/78 passed. All browser suites passed across the full-suite attempt and targeted continuations. Updated the PWA cache assertion for the new module and removed a competing reload in the project-browser helper sequence. New settings suite checks persistence, both theme accents, hiding a default model, instruction escaping, System route and mobile overflow.
- Inspected output/global-settings.png and output/project-system.png. git diff --check passed. No active sessions/workflows before local service restart; live settings/instructions endpoints returned 200. No real agent inference launched.

## Save orchestration drafts without approval — 2026-09-21
- Removed the executable-plan requirement from saving work instructions and orchestration assignments. Unapproved drafts retain prompt and role settings with a null plan hash and no derived tasks. Saving does not grant approval or start execution.
- Start orchestration remains disabled because its runtime is unavailable; the saved-plan panel explains this without presenting a save error.
- 78 Node tests passed. Issues browser suite passed, including saving with orchestration enabled and no approved graph, reopening retained Worker/prompt selections, and disabled Start work. Local server restarted after confirming no active sessions/workflows.

## Repository placement and live issue planning — 2026-09-21
- Removed standalone repository text from issue details and proposals; project cards and System pages now show sanitized Git remote information directly beneath the folder path, from the project connection API. Existing project settings retain detailed Git context.
- Create plan now saves inputs and launches a planning-only CLI task in an isolated worktree, using the selected planning model/effort and frozen issue context. A dedicated page polls the generated Markdown file while displaying the interactive CLI; Save draft remains non-executing. Latest planning runs can be reopened from the issue.
- Plan file previews are scoped to the terminal workspace, reject escaping symlinks, and are capped at 256 KB. Plans remain unapproved drafts; orchestration execution remains unavailable.
- 79 backend tests passed. Planning browser test used a fixture executable through a real PTY to verify initial instructions, incremental file updates, reload without relaunch, stop, mobile overflow, and repository placement. Issues, settings and PWA browser suites passed. Inspected output/issue-planning-live.png. No live-model inference was used.

## Claude Code model/effort catalog parity — 2026-09-21
- Replaced the hard-coded Claude aliases/three-level effort list with the installed CLI's initialize control response. Discovery sends no user prompt, disables hooks/MCP, caches concurrent discovery for 30 seconds, and returns model-specific supportedEffortLevels. Models without effort support use a disabled default selector and omit --effort at launch. Saved opus/fable aliases remain compatible but are not duplicated in default pickers.
- All Claude selectors consume the same provider catalog. Fixed square selected-pill backgrounds and stale orange text under custom accents. Ultracode is not presented as an API effort: it is Claude Code's separate dynamic-workflow mode, which this integration does not enable.
- Official reference: https://code.claude.com/docs/en/model-config#adjust-effort-level . Installed CLI 2.1.278 returned low/medium/high/xhigh/max for Sonnet, Opus and Fable; Haiku returned no effort capability.
- 79 backend tests passed, plus issues, terminal and settings browser suites. Live installed-CLI discovery and live Workbench selection of Sonnet/max verified without inference; inspected output/claude-parity.png. Restarted after confirming no active sessions/workflows.

## 2026-09-21 — Shared agent selection cards

- Sessions, issue editing/planning, orchestration roles, flow steps and workflow run settings use a shared three-pill Agent / Model / Effort card. Agent choices carry platform marks; model choices and the effort slider open in native popover overlays.
- Saved settings take precedence over locally remembered selections. Empty selections show placeholders and block session/planning submission until confirmed. Orchestrator and worker choices have separate caches. Catalog loading preserves remembered effort; restoring an unchanged flow does not mark it dirty.
- `npm test`: 79 passed. Full `npm run test:browser` passed, including the new agent-card browser suite. A subsequent focused workflow check passed after the bulk-model synchronization adjustment; agent-card checks also verify no execution starts from placeholders.
- Inspected desktop dark screenshots (`output/agent-cards.png`, `output/agent-card-overlay.png`); browser checks cover mobile overflow, equal pill widths, Escape dismissal and reload persistence. Provider execution tests use fixtures, not paid inference.
- Restarted the local launch service after checking for active execution; `/agent-card.js` returns HTTP 200. Shell cache is `0.5.0-41`; existing installed clients use the normal explicit update flow.

## 2026-09-21 — Graft installation and settings landscape layout

- Installed exact development dependency `@nanonets/graft@0.18.0`, with lockfile.
  Added a repository-relative CLI wrapper and build/check/map/setup scripts. The
  wrapper disables telemetry. Graph caches and machine-specific MCP config are
  ignored; setup preserves other entries and rejects conflicting registrations.
- Structural build parsed all 64 source files (462 nodes, 1,889 edges at the first
  build). `graft:check` passed; a subsequent `ask 'global settings'` refreshed edited
  files and returned `public/settings-ui.js#openSettings` first. No deep/model
  enrichment was run. MCP initialize and tools/list advertised version 0.18.0 and
  all six tools; a real graft_file_api call found openSettings. Launching the MCP
  command from `/tmp` still resolved this repository. `codex mcp get
  graft_development` confirmed the project registration. The current desktop
  session has not reloaded its tool list; Workbench execution restrictions remain
  unchanged. Existing global settings and Claude permissions were preserved.
- Global settings now uses a 1,200px landscape dialog, a 220px hierarchical menu,
  and independently scrolling content. Appearance, Codex, Claude, repository
  rules, and reference documents have separate views. Documents use escaped
  read-only previews and display source status only when explicitly supplied.
  A native section selector replaces the menu on mobile. Preferences retain their
  drafts across sections and save from any view; header/footer remain visible.
- `npm test`: 79/79 passed after dependency installation. Settings Chrome suite
  passed: keyboard selection, provider isolation, draft retention, save from a
  document view, Cancel/Escape, reload persistence, model filtering, document
  categories/status, project System previews, footer position, and overflow at
  1,440px, 1,100px and 390px. PWA Chrome suite passed including explicit updates,
  retained drafts, network-only APIs and offline shell. Browser execution uses
  fixture providers and temporary stores.
- Visually inspected desktop live settings and mobile fixture screenshots in
  `output/settings-live-models.png`, `output/settings-live-guidance.png`, and
  `output/settings-mobile-guidance.png`. The existing loopback server serves the
  updated assets and shell `skd-shell-0.5.0-48`; measured live dialog 1,200 × 740,
  with no browser errors. No live preferences were saved or agent executions
  started, and no server restart was needed. Installed PWA windows must use their
  existing explicit Update app action; the installed window itself was not tested.
- Changes remain local in the existing dirty checkout; unrelated work is retained.

## 2026-09-21 — Selection interaction follow-up

- Radio changes now update card confirmation state through change events as well as activation; selecting the current option no longer clears its dependent selections. Programmatic cache restoration is isolated from user changes.
- Repeated clicks dismiss an open pill overlay. Closing overlays become inert and aria-hidden during their fade. Focus rings are bounded 2px treatments; invisible radio inputs no longer receive a separate outline.
- Agent-card, terminal, issues, editor and planning browser suites passed with fixture providers. Added immediate replacement of a restored model, cache-value assertions, keyboard selection, same-pill dismissal and reduced-motion checks. Terminal checks assert the launched record contains the selected agent/model/effort. Shell version: 0.5.0-43.

## 2026-09-21 — Agent card dependent-selection fix

- Reproduced with distinct Claude/Codex fixture model lists and delayed discovery: changing a restored model or agent reset the dependent pills to placeholders, wrote `null` model/effort to the cache, and blocked Start until each pill was re-confirmed. Fixtures that shared model IDs across providers had hidden this.
- Dependents now follow the owning form's new defaults; the cache is rewritten after asynchronous model loads, while a pending restore keeps its cached value. Arrow-key radio changes no longer close the overlay.
- Fixture suites passed: agent-card (new dependent/cache assertions), terminal, issues, planning, workflows, PWA, editor. Shell version: 0.5.0-44.
- Live UI (running server, browser pane, no session started): with a cached model that no longer exists, Model/Effort show placeholders; choosing Sonnet gave card/controls/cache `claude · sonnet · high`; arrow-key switch to Codex gave `codex · gpt-5.6-sol · medium` in all three without reload. Focus ring inspected and compact. Not verified inside the installed PWA window, which must take the explicit update to 0.5.0-44.
- Follow-up: overlays now open in place over the card's footprint (options replace the pills; effort shows label, slider and Done in one row); outside click, Escape, Enter or Done dismiss. Removed the `display:none` override that cancelled the closing fade; live check measured mid-transition opacity on both open and close. Agent-card suite asserts overlay/card bounds match; terminal, issues, planning, workflows, editor and PWA suites passed. Shell version: 0.5.0-45.
- Follow-up: option pills now share the selection pills' size and style in an equal-width grid; the three pills fade out while an overlay is open (`data-open`). Inspected live Agent state (Codex | Claude, same footprint). Agent-card, terminal and issues suites passed. Shell version: 0.5.0-46.
- Follow-up: agent-card motion built to the animate skill's bar. Overlay scales from the pressed pill (`--origin-x/y` set in `place()`), `scale(.96)`→`scale(1)` with `cubic-bezier(.23,1,.32,1)`; open 200ms, close 150ms (deliberate act slower than the system response). Pills recede at 120ms so they never ghost through the incoming options; `:active` press feedback at 160ms on selection pills, option pills and Done. Card hover gated behind `(hover:hover) and (pointer:fine)`. Reduced motion continues to use the project-wide `transition:none!important` rule. Live measurement on the running server: origins 61/168/276px on a 337px card, open 0.2s, close 0.15s, settling at scale(1). Agent-card, terminal, issues, planning, workflows, editor and settings suites passed. Shell version: 0.5.0-47.

## 2026-09-21 — Settings and Graft publication verification

- Prepared the settings and Graft dependency, API, theme, model-filter, System
  page, and PWA changes as an isolated snapshot from `091b0ef`. Other pending
  agent-card, planning/execution, skills, and knowledge-handoff work remains local.
- The publication snapshot passed 76 Node tests and all 14 browser suites. Counts
  differ from the 79-test working checkout above because unrelated pending tests
  are excluded. Reused the existing project-browser synchronization fix to avoid
  two competing reloads; its original failing attempt and subsequent passing
  continuation were inspected. All execution/GitHub coverage used fixtures.
- Inspected the snapshot's desktop settings screenshot. The approved settings UI
  and Graft wrapper match the working checkout; no installed-app update or server
  restart was performed by the publication step.

## 2026-09-21 — Knowledge navigation and Graft explorer

- Home now places global Knowledge Graph, Skills, and Connections (MCP) cards
  above Projects. Knowledge Graph is active at `/#knowledge`; Skills and
  Connections are visibly planned and have no action. Project overviews link to
  `/#knowledge/<project-id>` and keep project Skills/Connections planned.
- The project Graft API discovers only `graft/` under the connected project or
  its inspected Git root. It bounds file, node, relation, context-file and result
  sizes; rejects escaping index/wiring symlinks and unsupported schemas; drops
  dangling relations with a diagnostic; and exposes no path override, build,
  enrichment or model action.
- The project page provides Code, Context and Outline views with search, node and
  relation filters, node/relation details, supplied confidence labels,
  neighborhood expansion, pan/zoom/fit, keyboard tab navigation and a
  synchronized accessible node list. Orchestration remains visibly planned.
- `npm test` passed 83/83. The full Chrome suite passed all 17 scripts, including
  offline/update behavior with network-only APIs. A final focused Graft browser
  pass covered the keyboard follow-up, global connected/missing status, route
  reload, Code/Context/Outline, filters, details, neighborhood, zoom, 390px
  overflow and zero execution requests. Fixture providers and temporary stores
  were used; no model or Graft build ran.
- Inspected `output/projects-overview-desktop.png`,
  `output/graft-explorer-desktop.png`, `output/graft-explorer-mobile.png` and
  `output/knowledge-live.png`.
  The existing Workbench index was also read directly through the final adapter:
  467 code nodes, 1,662 valid relations and 238 dangling relations omitted. Shell
  cache is `skd-shell-0.5.0-49`; Knowledge and Cytoscape assets are explicit.
- After confirming all live sessions were completed and all workflows cancelled,
  restarted the transient `com.shelbyklein.skd-workbench` service. The live
  project route rendered the 467-node index as a bounded 180-node view with no
  page errors. At verification time, the work remained in the local checkout;
  no installed-PWA update, GitHub write, commit, push or deployment had occurred.

## 2026-09-21 — Home project issue counts

- Home project cards show open GitHub issue totals instead of saved workflow counts. Repository-scoped GraphQL issue totals exclude pull requests and are not limited to a list page. Reads load asynchronously with at most three concurrent requests; unavailable reads remain distinct from zero.
- `npm test`: 94 passed. Focused issue adapter tests passed again after tightening the failure assertion. Project-count browser coverage passed for 125/1/0 counts, unavailable GitHub, project navigation and 390px overflow; PWA browser suite passed. Desktop/mobile fixture screenshots inspected.
- Confirmed no active local sessions or workflows before restarting the existing launch service. Live Home rendered all eight GitHub counts successfully (11, 2, 34, 0, 26, 2, 0, 2 at verification); inspected `output/project-issue-counts-live.png`. No GitHub writes or model execution. Shell cache is `skd-shell-0.5.0-51`; installed PWA clients still require their explicit Update app action. Changes remain local and uncommitted.

## 2026-09-21 — Project tags

- Added Global settings → Project tags: create, rename and delete shared tags, and choose project assignments with checkboxes. Projects accept multiple tags. All edits remain drafts until Save settings; Cancel discards them. Home cards and project overviews display tags, Home supports filtering, and the overview has an Edit tags shortcut.
- Definitions and assignments share one atomic, revision-checked settings write. Stable tag/project IDs preserve assignments when renamed. Old settings receive an exact pre-migration backup; old clients omitting tags preserve existing assignments. Invalid/duplicate names, missing projects, malformed data and stale writes are rejected. Projects, workflows and historical execution snapshots are unchanged.
- Full backend suite passed 96 tests; final focused settings suite passed all 5 tests including an added corrupt/empty-file regression. Project-tags browser suite passed twice, covering many-to-many assignments, rename/delete, Cancel, duplicate/stale errors, reload, filtering, project entry point and mobile. Existing settings, projects and PWA browser suites passed. Desktop/mobile Settings and Home screenshots inspected under `output/project-tags-*.png`.
- Confirmed all local sessions completed and workflows cancelled, then restarted the existing launch service. Live Project tags settings rendered correctly without adding fixture tags or changing user preferences; inspected `output/project-tags-live.png`. No model execution or GitHub writes. Shell version `skd-shell-0.5.0-52`; installed clients use explicit Update app. Changes remain local and uncommitted, alongside the preceding issue-count change.

## 2026-09-21 — Tag colors and Home card assignment

- Global Project tags now includes a color picker. Validated hex colors persist with stable tags; older tags default to terracotta and receive a settings backup on migration. Older clients omitting colors preserve existing choices. Tag labels choose black/white text by relative luminance.
- Each Home card has a separate, keyboard-accessible ⋯ button opening that project's multi-tag picker. Save updates assignments atomically with the existing settings revision check; Cancel leaves them unchanged. Card navigation remains separate. Desktop project grids use four columns, dropping to two below 1,150px and one below 650px.
- 98 backend tests passed; all 6 focused settings tests passed after the migration follow-up. Project-tags, issue-counts, settings and PWA Chrome suites passed. Added coverage for persisted colors, invalid colors, old-client preservation, four-column layout, keyboard picker activation, assignment/removal and Cancel. Inspected desktop Home and mobile color settings screenshots.
- Restarted the existing local service after confirming no active sessions/workflows. Live Home measured four columns at 1,920px; opened and inspected the card tag picker without saving assignments. Evidence: `output/project-tags-colors-live-home.png` and `output/project-tags-colors-live-picker.png`. Shell cache is `skd-shell-0.5.0-53`; installed PWA clients require explicit Update app. Changes remain local and uncommitted.

## 2026-09-21 — Project header icons

- Replaced Edit tags and Project details text buttons with tag and sliders SVG icons, retaining accessible names, tooltips and existing actions.
- Project-tags, projects and PWA browser suites passed. Live dark desktop/mobile rendering and both dialog actions verified, including keyboard activation. Inspected `output/project-header-icons.png`. Static assets served without restarting; shell cache `skd-shell-0.5.0-54` uses the normal explicit PWA update.

## 2026-09-21 — Project overview order and tag placement

- Project tags sit immediately left of the tag icon in the header. Project views now follow Scratchpad, Issues, Sessions, Workflows, Knowledge Graph, Skills, Connections, System in DOM/reading order, with four desktop columns and responsive two/one-column layouts.
- Project-tags, projects and PWA browser suites passed. Live checks verified exact card order, two rows/four columns at 1,920px, tag placement, and no overflow at 390px. Inspected `output/project-views-ordered-desktop.png`; mobile receipt also captured. Static change needs no restart; shell cache `skd-shell-0.5.0-55`.

## 2026-09-21 — Project view icons and contextual sidebar

- Added eight consistent SVG icons to project overview cards and the project sidebar: Scratchpad, Issues, Sessions, Workflows, Knowledge Graph, Skills, Connections and System. Inside a project, view links replace the project list; All projects returns Home, and the project name opens its overview. Home/global pages retain the project list. Scratchpad remains visibly planned and disabled.
- Links preserve project scope, native URL behavior, unsaved-change protection and active-view highlighting (including workflow editor/history and issue planning). Mobile uses a two-column view menu. Icons are decorative alongside accessible text labels.
- All 98 backend tests passed. All browser scripts passed across the full run and resumed remainder. Updated obsolete project-list navigation assertions and GitHub fixtures to recognize the preceding read-only GraphQL count query (POST transport); initial Issues assertion failure was a fixture assumption, not a GitHub write. Planning fixture was similarly updated and rerun.
- Live desktop/mobile checks verified eight sidebar/card icons, project navigation, active System, reload and no overflow; inspected `output/project-view-sidebar-live.png` and `output/project-view-sidebar-mobile.png`. No user data writes or provider inference. Static assets are active without restart; shell cache `skd-shell-0.5.0-56` requires the normal explicit PWA update. Work remains local and uncommitted.

## 2026-09-21 — Project overview widgets

- Added a Priority issues widget above Project views. It reads open GitHub issues, excludes pull requests, recognizes Urgent/High/Medium/Low plus P0–P3 aliases, sorts prioritized issues before unprioritized issues, and shows the six highest results with fixed accessible-color pills. Rows open the issue detail; All issues opens the project list. Loading, empty, unavailable and narrow-screen states remain explicit.
- Added a Last session widget beside it. It identifies the newest user session, reports completion state, shows recorded errors or blocker language, and links to the full session. “None reported” is deliberately evidence-bounded. Internal issue-edit proposal runs are excluded from session lists and this widget.
- Added a dedicated browser suite covering sort order, pill colors, pull-request exclusion, issue/session links, internal-run exclusion, completion/blocker reporting and 390px overflow. All 98 Node tests and the full 21-script Chrome suite passed; the expected fixture-unavailable errors exercise recovery paths. Inspected `output/project-widgets-desktop.png` and `output/project-widgets-mobile.png`.
- Restarted the local service after confirming all sessions finished and workflows cancelled. Live Tiny Tasks rendered Urgent → High → Medium → Low → unprioritized using GitHub data; no user session exists, so the session widget correctly shows “No sessions yet.” Inspected `output/project-widgets-live-tiny-tasks.png`. Shell cache is `skd-shell-0.5.0-57`; installed clients require explicit Update app.
- Seeded `shelbyklein/tiny-tasks` with priority labels and open issues #3–#6 for safe live testing. The issues cover task selection, filter controls, storage recovery, and mobile/keyboard verification at Urgent, High, Medium, and Low respectively. Existing sandbox issues #1–#2 remain unprioritized. No model execution occurred.

## 2026-09-21 — Home project filters and layouts

- Replaced the single tag dropdown with toggleable filter pills. No selected pill shows all projects; selected pills use OR matching so projects assigned to any active tag remain visible. The connected-project count now sits beside the Projects heading.
- Added an accessible grid/list segmented control in the former count position. List mode uses the existing project cards, issue totals, navigation and tag menus in a compact row layout; the browser remembers the layout choice. Narrow screens retain the stacked card layout.
- `npm test`: 98/98 passed. Project-tags browser coverage passed for multi-tag toggling, pressed states, list layout, reload persistence, tag mutations and 390px overflow. Project-counts, Home/project hierarchy and PWA Chrome suites passed. Inspected rendered light and dark desktop list views and the mobile Home screenshot. Fixture providers and temporary stores were used; no model execution or external writes occurred. Shell cache is `skd-shell-0.5.0-58`; installed clients require the existing explicit Update app action.

## 2026-09-21 — Rendered issue Markdown

- Issue descriptions, comments, and proposal comparisons render GitHub-style Markdown rather than displaying source syntax. Headings, ordered/unordered/task lists, emphasis, links, inline/fenced code, blockquotes and tables have responsive light/dark styles. Edit inputs continue to use the original Markdown source.
- Marked 18.0.13 parses the document and DOMPurify 3.4.15 sanitizes the result with an explicit HTML/attribute allowlist. Rendered links open separately with `noopener noreferrer`; task inputs are forced to disabled checkboxes. Raw script content was fixture-tested and did not execute.
- `npm test`: 98/98 passed. The Issues browser suite passed Markdown structure, sanitization, read-only browsing/proposals, 390px overflow and light/dark visual checks. The PWA Chrome suite passed with the new renderer modules cached and all APIs remaining network-only. Inspected `output/issues-detail-desktop.png` and `output/issues-detail-dark.png`. Fixture providers and GitHub data were used; no model account usage or external writes occurred. Shell cache is `skd-shell-0.5.0-59`; installed clients require the existing explicit Update app action.
- After confirming there were no active sessions and all retained workflows were cancelled, restarted the existing transient service. A read-only live check of Newton issue #121 rendered two headings, two lists and 23 code spans without raw heading syntax or browser errors. Inspected `output/issues-markdown-live.png`. No GitHub writes, settings changes or model execution occurred.

## 2026-09-21 — Playbooks and session activity records

- Added versioned global/project Playbooks with provider compatibility, exact managed Skill/MCP selections, archive/restore/duplicate/history, revisioned per-provider project defaults, atomic replacement, prior-file backup, stale-write rejection and visible corrupt-store failure. Launch preview re-resolves current resources and fingerprints; the actual launch requires the preview signature, so archive, revocation, drift or incompatibility cannot silently change the frozen session configuration. Models, effort, workspace and task remain separate.
- Sessions can use a project default, explicit Playbook, legacy policy or exact session-only override, including empty selections. Active and ended session details can save their frozen managed configuration as a Playbook without changing or restarting the source session. The saved provenance excludes prompts, output, worktrees, provider configuration, instruction text, arguments, results and secrets. Observed MCP use is annotated separately and observed-only selection is disabled unless coverage is complete.
- Structured Codex JSONL and Claude stream-json records now persist bounded, normalized tool metadata with exact child source, call/event IDs, timestamps, outcomes, connection attribution and complete/partial coverage. Replay is deduplicated; out-of-order results remain partial; denial/error/cancellation are explicit; interruption never infers success; the 500-event retention limit marks coverage partial. Workflow rollups reference child attempts and sum their aggregates without copying event ledgers. Legacy records render `unknown`, which differs from a complete stream with zero calls.
- Interactive Codex and Claude PTY sessions persist `unavailable` coverage with the verified provider-specific reason. Installed CLI help was checked for Codex 0.155.1 and Claude Code 2.1.278: Codex exposes JSON only through `codex exec`, while Claude stream-json/hook lifecycle events require `--print`. Terminal text is not treated as an activity ledger. The protocol-owned interactive replacement is separately planned in issue #6 and was not implemented here.
- `npm test` passed 107/107. `npm run test:browser` passed all 19 Chrome scripts after updating the offline-shell assertion to require all 26 cached assets, including `/playbooks-ui.js`; APIs remained network-only. Focused structured/interactive/workflow activity checks and Save-as-Playbook checks also passed. Browser execution used temporary stores, separate ports and fixture providers; no authorized real-provider inference or real tool call was run.
- Inspected dark desktop and light mobile Playbook renders plus light desktop structured-session and light mobile workflow-attempt renders: `output/playbooks-project-desktop.png`, `output/playbooks-project-mobile.png`, `output/codex-fixture-desktop.png`, and `output/workflow-fixture-mobile.png`. The pages retained readable hierarchy, controls and detail panels with no horizontal overflow at 390px. The resource suite also passed keyboard Enter activation for New playbook; the full accessibility suite covered focus, dialogs, Escape, retained drafts and reduced motion.
- Shell cache is `skd-shell-0.5.0-51`; `/playbooks-ui.js` is in both the server public allowlist and service-worker shell list. No live service was restarted, no installed PWA was updated, and no commit, push, deployment, production/user-data write or issue closure occurred.

## 2026-09-21 — Integrated Home, Markdown and Playbooks delivery

- Merged the Playbooks/session-activity worktree with the project dashboard, Home filter/layout and issue Markdown changes. The integrated navigation exposes Playbooks globally and as the fourth project entry while retaining the contextual project sidebar, nine view icons, project widgets, tag controls and issue totals. The public allowlist and offline shell contain both Playbooks and sanitized Markdown assets; shell cache is `skd-shell-0.5.0-60` with 29 cached assets.
- `npm test` passed 112/112. The complete 22-script Chrome suite passed after updating the contextual navigation assertion from eight to nine icons. It covered Home counts/tags/widgets/layouts, offline/update behavior, Markdown issues, Playbook CRUD/defaults/session saves, provider/session/workflow activity, desktop/mobile layout, keyboard behavior and dirty-state guards. Expected fixture-unavailable logs exercised failure paths.
- Inspected the integrated fixture renders for Home, Playbooks and issue Markdown. After confirming zero active sessions and three retained workflows all cancelled, restarted `com.shelbyklein.skd-workbench`. The live Home showed one Playbooks card, three tag pills, `8 connected`, and a working selected list view; the global Playbooks route loaded without page errors. Live Newton issue #121 rendered two headings and two lists without raw `## Found` syntax or page errors. Inspected `output/integrated-live-home.png`. No provider execution, GitHub write or user-data mutation was performed.

## 2026-09-21 — Integrated project Git status delivery

- Added a project-overview Git status widget that reports the connected checkout, staged/unstaged/untracked/conflicted changes, in-progress operations, local branch/worktree inventory, upstream comparison and an integration-target comparison. Unknown, incomplete and stale observations remain visible rather than being treated as clean or current.
- Local status reads do not contact remotes or change the index. **Check remote** is a separate read-only action with bounded HTTPS/SSH transports; it reads advertised branch tips without fetching or changing refs. Unsupported transports, expired snapshots, authentication failures and refs moving during a check fail visibly while retaining labeled local evidence.
- Merged the widget with the Home filters/list view, rendered issue Markdown and Playbooks/session-activity work. The server allowlist and offline shell include both `/git-status-ui.js` and `/playbooks-ui.js`; shell cache is `skd-shell-0.5.0-62` with 30 cached assets.
- `npm test` passed 123/123. The complete 23-script Chrome suite passed, covering Git inventory and remote boundaries, stale recovery, project switching, target persistence, keyboard behavior, offline/update behavior and the 390px layout alongside all existing feature suites. Expected fixture-unavailable logs exercised failure paths.
- Inspected `output/git-status-desktop.png` and `output/git-status-mobile.png`. The widget remains legible above Priority issues and Last session, its expanded inventory fits the desktop layout, and the narrow layout stacks controls without horizontal overflow. Browser tests used temporary repositories, stores and fixture providers; no model execution, GitHub write or user-data mutation occurred.
- Confirmed zero active sessions and three retained workflows, all cancelled, before restarting `com.shelbyklein.skd-workbench`. The live SKD Workbench overview rendered the current `codex/github-issues` checkout and all three clean registered worktrees; the remote remained explicitly unchecked. Global Playbooks loaded, Newton issue #121 rendered two Markdown headings, and Home retained `8 connected` plus the list-view control without page errors. Inspected `output/git-status-live.png`. No remote check, provider execution, GitHub write or user-data mutation was performed.
- Shared bounded inventory in `lib/worktrees.js` includes all local branches plus linked, detached, missing, locked and prunable worktrees. The extracted `lib/git-read.js` preserves the existing subprocess limits and now terminates a remote-check process group after completion or timeout. The separately planned Worktrees graph/diff feature and issue #4 were not taken over.
- A separate temporary-store UI verification performed a real remote advertisement check: the observed local main tip matched the advertised main tip, the unpublished verification branch was correctly absent, and before/after Git refs and index hashes matched. No page errors or 390px overflow were found. Evidence: `output/git-status-live-widget.png`, `output/git-status-live-expanded.png`, `output/git-status-live-mobile.png`, and `output/git-status-live-receipt.json`. Tracker Trapper plan `local:D8F3D8B2-CB19-4228-9878-F762E72F3DD6`, tasks GS-01 through GS-05, records that isolated verification.

## 2026-09-21 — Compact Git widget design

- Matched the supplied compact Git card: branch icon/name and target comparison, checkout state, conflict Review banner, remote observation footer, Details and Refresh local. Details retains the complete inventory, selectors, upstream relationships, timestamps and repository link; Review opens and focuses the inventory.
- Backend snapshots, APIs and data collection remain unchanged for reuse. Unknown, stale, partial and remote-failure states remain explicit. Remote equality is only stated from a successful advertisement result.
- Git-status Chrome suite passed with collapsed Details, keyboard expansion, conflict Review, preserved target selection, stale recovery and 390px overflow checks. PWA suite passed; shell cache is 0.5.0-63. Inspected compact desktop/mobile screenshots in output/git-compact-*.png. No provider execution or user-data writes.

## 2026-09-21 — Git summary row

- Reduced the collapsed Git widget to a desktop row with current branch, number of local branches behind the comparison target, Details and Refresh local. Conflict/operation alerts remain actionable in the row. Remote checks, checkout changes, complete inventory and selectors remain in Details; APIs and collected data are unchanged.
- The count includes branches with at least one missing target commit, including diverged branches, and excludes the target itself. Unknown or omitted branch comparisons qualify the count; missing upstream references alone do not. The label follows the selected target (normally main).
- Git-status browser checks passed for zero and multiple behind branches, unknown comparisons, upstream gaps, Details, conflict navigation, target persistence, stale recovery, keyboard and 390px overflow. PWA browser checks passed. Inspected desktop/mobile fixtures and the running app's 76px row (output/git-row-live.png). Static assets are served by the existing server without a restart; shell cache 0.5.0-64 requires the normal explicit PWA update.

## 2026-09-21 — Shared text-button interaction tokens

- Details now uses the existing shared text-button class alongside Rename and All workflow runs. Shared button-text tokens define 8px/12px padding, 7px radius, and theme-relative hover/pressed fills. Pointer hover cannot override disabled state or stick on touch; feature styles retain only typography.
- Added the text-button usage rule to AGENTS.md. The live light/dark hover renders were inspected in output/text-button-hover-*.png. Browser checks verified padded stable bounds, distinct pressed feedback, keyboard focus, disabled transparency, touch behavior and mobile overflow. Git-status, editor and PWA browser suites passed. Static assets require no server restart; shell cache 0.5.0-65.

## 2026-09-21 — Import project chat transcripts

- Added Import to the Last session card and Sessions header. Users can paste a transcript with the normal clipboard shortcut or supply an absolute/`~/` local file path. Imports are project-scoped immutable snapshots with distinct imported status, source metadata, unknown usage/completion, full-text viewing and clipboard copy. Text/Markdown/JSON/JSONL are retained as text, not interpreted as activity or instructions. The import limit is 1 MiB; this transfers chat context rather than project files or native provider session identity.
- Added a separate versioned, atomic imported-session store with content hashes, visible corrupt-store failure, idempotent request keys and conflict detection. File reads use bounded UTF-8 decoding, regular-file checks and change detection. Imports preserve source files and create no agent process. HTTP text decoding now preserves multibyte characters split across network chunks.
- Use as context opens session setup with an explicit next-task field. Only Start sends the server-resolved, same-project transcript as historical reference plus that task to the existing interactive provider path. The new run retains the imported record ID. Oversized starting messages (64 KB) fail without truncation. Existing ordinary sessions still start without a message. Imports do not supply tool telemetry, completion or acceptance evidence.
- Full Node coverage passed 127/127 with `node --test --test-concurrency=2 tests/*.test.js`. A preceding default-concurrency run hit the existing 500ms malformed-stream fixture timing assertion in tests/codex.test.js; that suite passed 8/8 alone and the complete lower-concurrency rerun passed. The first default-concurrency run before the Unicode decoding addition also passed 127/127. No unrelated runtime or timing-test behavior was changed.
- `npm run test:browser` passed all 24 Chrome scripts, including the new import suite. The import suite was rerun successfully after the dialog close-event guard adjustment. Coverage includes actual keyboard paste/copy, saved history/reload, escaped transcript text, draft cancellation, failed path/recovery, context setup without launch, desktop/mobile layout and zero automatic execution requests. API tests separately launched a fixture PTY to verify the historical-context/current-task message. No real provider inference was used.
- Inspected desktop import and mobile transcript screenshots. Added spacing between imported-session actions and provenance after the first visual inspection. Captures: output/session-import-dialog-desktop.png, output/session-import-dialog-mobile.png, output/session-import-detail-mobile.png and output/session-import-card-desktop.png. PWA shell 0.5.0-66 includes /session-import-ui.js; all API data remains network-only.
- Rechecked live sessions, workflows and persisted execution records: no active work, with the three retained workflows cancelled. Restarted the existing com.shelbyklein.skd-workbench service. Verified the live Import entry point, paste/path controls and draft cancellation; inspected output/session-import-live-card.png and output/session-import-live-dialog.png. The live check saved no transcript and launched no agent. Installed PWA clients require their normal explicit Update app action. No GitHub writes, commit or push were performed for this feature.

## 2026-09-21 — Project quick actions (issue #8)

- Added three stacked full-column cards above Git status, each with an icon, title and description, whole-card keyboard activation, shared text-button Settings, mobile wrapping and visible failure states. Desktop/mobile fixture renders inspected: `output/quick-actions-desktop.png` and `output/quick-actions-mobile.png`.
- Added project-scoped preferences with provider/playbook revalidation, reset, normal-session seeding, request persistence, deduplication and read-only recovery after a lost response. Collaboration creates a fresh retained worktree; suggestions pass a bounded read-only context prompt; reconciliation has an explicit native-permission repository mode and separate post-exit Git verification.
- Focused tests exercise real temporary Git repositories and a bare remote, preference persistence/isolation, model/policy/playbook drift, concurrent duplicate requests, retained collaboration worktrees, dirty/unintegrated work, remote divergence/auth failure, pending operations, missing main, stale launch state and cancellation. Seven quick-action Node tests pass; the full Node suite passed 130 tests. The first full run hit an existing 500ms Codex fixture startup timing assertion; its isolated rerun and subsequent full run passed.
- The quick-action Chrome suite passes with actual fixture PTYs for all three actions, a deliberately lost HTTP launch response recovered without another process, reload, settings/reset, keyboard, desktop/mobile layout and origin/mode guards. Existing Git widget browser coverage passes after making toast expiry use its captured element rather than a possibly removed DOM lookup.
- CLI help confirms Codex workspace-write/add-dir/on-request and Claude manual permission flags. No model inference or live project reconciliation was performed; fixture Git integration does not establish model conflict-resolution quality or test acceptance. Integrated validation and local activation are recorded below.

- Integrated validation passed: `node --test --test-concurrency=2 tests/*.test.js` 134/134, including pending session-import coverage; `npm run test:browser` all 25 Chrome scripts. Updated the PWA assertion for 32 shell assets. The focused quick-action suite additionally passed a controlled response-loss/navigation-guard scenario with service workers disabled so Playwright actually intercepts the fixture request; this exercises real fixture PTYs, not live providers.
- Preserved all pre-existing import code/docs/tests through reviewed three-way integration. Original files and merge inputs are retained under ignored `output/quick-actions-integration/`. Feature commit `0a299a0` is on isolated branch `codex/project-quick-actions`; the shared checkout retains the combined uncommitted work. No GitHub push or issue closure was performed.
- Confirmed zero active sessions and three cancelled retained workflows before restarting the existing `com.shelbyklein.skd-workbench` service. Live desktop/mobile cards and Settings open/cancel were verified with no browser writes or launches. Inspected `output/quick-actions-live-cards.png` and the mobile render; receipt: `output/quick-actions-live-receipt.json`. No live reconciliation or model inference was performed. Shell cache is `skd-shell-0.5.0-68`; installed PWA clients need the existing explicit Update app action.

## 2026-09-21 — Quick actions in three columns

- Corrected the layout per user feedback: three equal-width cards in a single desktop row, each with an icon above its title and description. The row fills the content column; cards stack at widths of 900px and below. Settings and errors span the row.
- Quick-action Chrome suite passed updated equal-width/same-row assertions, keyboard, session flow, lost-response recovery and mobile coverage. PWA Chrome suite passed. Live desktop/mobile and settings open/cancel verified without launches or writes; inspected output/quick-actions-live-cards.png. Cache is 0.5.0-69; installed clients require explicit Update app. Issue #8 and its local plan reflect the correction.
