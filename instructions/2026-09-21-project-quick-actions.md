# Project quick actions above the Git worktree readout

<!-- skd-project-quick-actions-2026-09-21 -->

Issue: https://github.com/shelbyklein/skd-workbench/issues/8
Local plan is uncommitted; the issue contains the complete standalone plan.

## Outcome

Add three vertically stacked action cards immediately above the project overview's Git/worktree readout. Each action spans the full content-column width and contains a leading icon, a clear title, and a short description beneath the title. Make the entire card one accessible click/keyboard target, with visible focus and disabled states; decorative icons are hidden from assistive technology. Preserve this full-width stacked layout on desktop and mobile, allowing descriptions to wrap without overflow. Use this order:

1. **Reconcile to main** — start an interactive CLI reconciliation process whose objective is to integrate pending project work into local `main`, then synchronize remote `main` and verify both tips match.
2. **New collaboration session** — open a fresh interactive CLI using preset or cached selections, without repeatedly configuring the same agent, model, effort and applicable playbook settings.
3. **Suggest what to do next** — open a fresh interactive CLI with those selections and a distinct project-aware recommendation prompt.

### Action card copy

| Icon | Title | Description |
| --- | --- | --- |
| Git merge | Reconcile to main | Start a CLI session to merge pending work into local main and sync it with remote main. |
| Terminal with plus | New collaboration session | Open a new CLI session using your saved agent, model, and settings. |
| Lightbulb | Suggest what to do next | Open a CLI session to review this project and recommend the next steps. |

Use icons consistent with the existing interface. Descriptions explain the action; they do not imply reconciliation has already succeeded.

This issue authorizes planning only. Do not start reconciliation or a CLI as part of filing it.

## Current evidence and integration points

Source inspected 2026-09-21 at `9c063642d67bc54731f04daad548253d8c9e8aa9`, branch `codex/github-issues`, including current working files. There is unrelated pending session/import/UI work; reconcile ownership before implementation.

- `public/app.js:renderProjectOverview` calls `mountProjectWidgets`; reuse the existing overview and `public/git-status-ui.js` readout placement.
- Git inventory in `lib/worktrees.js` and current Git widget are read-only. README explicitly excludes merge/pull/push actions today.
- `public/codex-ui.js`, `public/terminal-ui.js`, `lib/terminals.js` and terminal session routes in `server.js` own interactive launch/configuration, reconnect and execution lifecycle. Reuse these rather than spawning a parallel executor.
- Playbooks select managed skills/MCP; they do not currently save provider/model/effort/workspace/task. Cached launch preferences need a separate, explicit contract.
- Existing terminal worktree mode requires clean Git and retains worktrees for review. Reconciliation needs an explicit execution design capable of inspecting dirty linked worktrees and integrating into the actual main checkout; an ordinary new worktree is not sufficient by itself.
- Source inspection only; no runtime validation or provider execution was performed for this issue.

Related: #4 (worktree visualization), #5 (playbooks), #6 (session transport/activity), #7 (worktree purpose and notes). Reuse their delivered interfaces; do not absorb their remaining work or require protocol replacement for this feature.

## Behavior and boundaries

**Reconciliation:** Capture a fresh repository-wide inventory of registered worktrees and local branches, including dirty files, detached work, pending Git operations, current execution ownership, and remote main state. Present the integration scope and unresolved work clearly. Include committed pending work and explicitly resolve ownership/intent for uncommitted work; never silently discard it, invent commits for another active session, or call the repository reconciled while known work is excluded. Refresh remote history as part of the explicitly launched process where needed. Integrate in a deliberate order, resolve unambiguous conflicts, run relevant checks, then update local and remote main. Stop for ambiguous conflicts, unclear ownership, active writers, authentication failure or protected-branch requirements. Follow a required PR flow if direct push is disallowed, and show reconciliation as pending until merged. No force-push, destructive reset, automatic branch deletion or worktree cleanup. Completion requires fresh local/remote tip equality, successful relevant checks, and an explicit accounting of every inventoried work item; skipped work must remain visible. A CLI exit alone is not success.

**Collaboration:** A new session is a new CLI process, not resume/reconnect and not an automatic multi-agent workflow. Reuse the last valid project-scoped agent/model/effort and applicable context selections, falling back to project defaults for first use. Expose a lightweight way to inspect/change/reset selections. Validate availability and policy at launch; visibly explain invalid settings instead of silently substituting a provider/model. Preserve native trust/permission prompts. Never cache credentials, transcript contents, execution identity or approval decisions as launch preferences.

**Suggestions:** Use a distinct initial prompt: inspect the connected project's instructions, current Git/worktree status, available open issues and recent session outcomes; recommend a short prioritized list of concrete next actions with reasons, relevant issue references and blockers. Treat unavailable context as unavailable. Suggestions are read-only: do not implement, merge, publish issues or dispatch other work. Keep the CLI interactive for follow-up.

Use explicit launch intent and bounded prompt construction rather than simulated typing into an arbitrary terminal. Submit each quick-action prompt at most once after readiness/trust permits. Reconnect, reload, double-clicks, retries and server restart must never repeat a launch or prompt. Preserve shared session/workflow execution ownership, draft guards, cancellation and visible failure states. Refresh Git observations after reconciliation while retaining explicit unknown/stale states.

## Ordered implementation todos

- [x] **QA-01 — Define and persist validated project launch preferences.** Acceptance: first use, project isolation, reload persistence, reset, unavailable provider/model and changed playbook/policy are tested; credentials and session state are never copied.
- [x] **QA-02 — Add the three quick actions above the readout.** Acceptance: three vertically stacked cards each span the full content-column width above the readout and each show an icon, title and description; desktop/mobile visual checks confirm alignment, wrapping and no overflow; whole-card keyboard activation, visible focus, draft/execution guards and actionable launch errors work.
- [x] **QA-03 — Implement fresh collaboration and suggestion CLI launches.** Acceptance: fixture tests verify cached selections, different prompt intent, read-only suggestion scope, correct project context and exactly one new session/prompt per deliberate action across duplicate requests and reconnects.
- [x] **QA-04 — Implement the reconciliation session and integration contract.** Acceptance: disposable Git repositories and a local bare remote demonstrate pending work integrated into local/remote main; dirty/active work, divergence, conflicts, stale refs, protected-branch/auth failure, cancellation and missing main produce explicit safe outcomes without destructive cleanup or false success.
- [x] **QA-05 — Verify delivery and document the result.** Acceptance: appropriate Node and browser suites pass using temporary stores/fixture providers; desktop/mobile/keyboard UI is visually inspected; README and VALIDATION record actual evidence and remaining limitations; cached shell changes bump the service-worker version. Real provider inference or live repository reconciliation requires its own authorized validation scope.

## Implementation decisions

Working assumptions: the target is literally local and remote `main`; do not silently use the widget's comparison target. If main or the remote is absent/ambiguous, request a target choice before mutation. A configured preset can override cached defaults, with effective selections visible. “Collaboration” means the existing interactive agent session experience.

Before implementing QA-04, settle the dedicated reconciliation execution mode and repository ownership lock, and whether a launch preview is necessary for ambiguous scope. The user's goal is a process that carries integration through to local/remote main, not merely a report of suggested Git commands. Preserve native permission boundaries and surface only material decisions.

Rollback removes the actions/preferences support without deleting Git refs, worktrees, session history or project data. Implementation, activation, commit/push and runtime acceptance remain unperformed.

## Implementation authorization and delivery

User authorized implementation in this task on 2026-09-21. Isolated development branch: `codex/project-quick-actions`, checkout `/Users/shelbyklein/Vibes/skd-workbench-quick-actions`. Tracker Trapper plan `56ACFE7E-D82D-4B10-A09F-A0D564E493A5` retains QA-01 through QA-05. QA-01 through QA-04 passed focused fixture/browser acceptance; delivery validation is in VALIDATION.md. No live project reconciliation or model inference is part of activation.

Delivery: integrated Node tests 134/134 and all 25 browser scripts passed. Focused response-loss and pending-navigation regression passed with fixture service workers disabled. Live desktop/mobile UI and Settings open/cancel verified without provider execution. Existing installed PWA clients require explicit Update app; issue remains open for user acceptance.
