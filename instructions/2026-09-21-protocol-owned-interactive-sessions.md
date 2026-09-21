<!-- skd-protocol-owned-interactive-sessions-2026-09-21 -->
# Protocol-owned interactive sessions and complete activity capture

GitHub issue: https://github.com/shelbyklein/skd-workbench/issues/6

## Outcome

Replace or pair the current PTY-only interactive session transport with provider protocol sessions that preserve back-and-forth conversation, approvals, reconnect, cancellation, and isolated worktrees while producing session-bound structured tool events. Workbench can then record which tools and MCP connections an interactive Codex or Claude session actually used, with correlated outcomes and explicit capture coverage.

This issue is the larger architecture path separated from [playbooks issue #5](https://github.com/shelbyklein/skd-workbench/issues/5). Issue #5 may deliver playbook configuration and honest `unavailable` interactive activity coverage first. This issue must not block that incremental delivery or rewrite its saved snapshots.

Status: implementation plan only. Filing this issue does not authorize implementation, provider inference, a live-server restart, deployment, or migration of active sessions.

## Evidence

Inspected 2026-09-21 at `c7c946ccc625892e268b235016d26f570e98c74d` in the isolated `codex/playbooks` worktree. The finding is based on installed CLI help for Codex 0.155.1 and Claude Code 2.1.278, current launch adapters, and passing fixture tests. Provider behavior can change and must be reverified at implementation time.

- `lib/terminals.js` launches both interactive providers through `node-pty`, retains a bounded terminal tail, and owns input, resize, stop, reconnect, worktree and cleanup lifecycle.
- `public/terminal-ui.js` renders xterm.js and sends raw terminal input. It does not receive structured messages, approval requests, tool calls or provider usage.
- `lib/codex.js` receives structured events from the exact child only for `codex exec --json`. That adapter is non-interactive and uses a different execution contract.
- `lib/claude.js` receives structured events only through `--print --input-format stream-json --output-format stream-json`. Installed Claude help does not expose the same event stream through its interactive PTY.
- Codex interactive help does not accept `--json`. Codex can expose app-server/remote-TUI protocols, but Workbench does not currently own such a session or its event identity.
- ANSI terminal output is presentation text without durable call/result IDs. Provider-log discovery cannot be attached to the correct child safely by choosing a recent file.
- `tests/provider-capabilities.test.js` records this capability boundary; its focused set passed 15/15 with the related connection, launch-context and terminal tests.

## Scope and architecture gates

First prove one provider at a time with disposable protocol fixtures and the installed CLI. Do not choose an adapter merely because a command exists. The gate requires a persistent multi-turn session, exact child/session identity, tool-call and result correlation, explicit approval behavior, cancellation, reconnect without a second process, and bounded recovery after a Workbench restart.

Codex should investigate its supported app-server and remote-TUI surface. Claude should investigate a persistent streaming-input protocol or another supported broker that retains interactive permissions. A provider without a supported protocol remains on the legacy PTY path with `unavailable` activity coverage. Do not weaken hooks, plugins, MCP allowlists, safe/restricted behavior or approval controls to obtain events.

Introduce a provider-neutral session adapter with explicit states such as preparing, running, waiting for approval, stopping, completed, failed and interrupted. It owns provider session identity, transport lifecycle, ordered input, structured events, reconnect cursors, cancellation and cleanup. Terminal presentation becomes one client of that adapter where supported; it is not the activity source of record.

Preserve the existing execution lock and one-worktree-per-session ownership. Hiding/reopening the UI cannot spawn another provider session. Server restart never silently resumes paid work. Interrupted protocol sessions retain their worktree and history for inspection. Normal sessions never merge or delete their worktree automatically; benchmark archive/reset retains its current guarded behavior.

Normalize allowlisted activity metadata: provider session and attempt identity, event/call ID, tool type/name, owning MCP connection when proven, start/end timestamps, outcome, evidence source and coverage. Do not store raw prompts, arguments, results, credentials, endpoints or provider configuration in the activity ledger. Approval payloads and errors must be bounded and sanitized.

Existing PTY histories remain readable and labeled legacy/unavailable. New protocol records use a versioned schema with atomic persistence, corrupt-data failure, bounded retention and migration backups. Do not fabricate activity for old sessions or infer no-use from missing events.

## Ordered implementation todos

- [ ] **SKD-PS-01 — Prove supported provider protocols.** Build disposable Codex and Claude protocol fixtures and verify installed CLI behavior for multi-turn input, exact session identity, structured tool lifecycle, approvals, cancellation, reconnect and shutdown. Acceptance: the capability matrix names the supported versions and evidence; unsupported providers remain explicitly on PTY without weakened permissions.
- [ ] **SKD-PS-02 — Define the session adapter and persisted schema.** Specify provider-neutral states, input ordering, approval transitions, event correlation, coverage, retention, restart/interruption behavior and schema migration. Acceptance: state-machine and corrupt/migration tests prove no duplicate process, input or activity event and no silent resume.
- [ ] **SKD-PS-03 — Implement the Codex protocol adapter.** Launch only validated server-selected binaries/arguments, bind the exact provider session, translate input/events/approvals and retain current sandbox, worktree and MCP isolation. Acceptance: fixture and actual CLI-startup tests cover two turns, allowed/denied tools, reconnect, cancellation and a killed server without terminal scraping.
- [ ] **SKD-PS-04 — Implement the Claude protocol adapter where supported.** Preserve restricted tools, hooks/delegation controls, checked MCP allowlists and explicit permissions while translating the supported persistent protocol. Acceptance: the same lifecycle suite passes or the adapter stays disabled with a versioned reason and legacy PTY fallback.
- [ ] **SKD-PS-05 — Add correlated activity and connection attribution.** Persist deduplicated start/result/denial/cancel events and map MCP calls only through launch-owned tool catalogs. Acceptance: concurrent/out-of-order/replayed events, unknown native tools, truncation and disconnects produce correct outcomes and coverage without cross-session attribution.
- [ ] **SKD-PS-06 — Preserve the interactive session experience.** Adapt Sessions and the terminal panel to protocol-backed output, follow-up input and provider approval requests while keeping hide/reopen, keyboard/mobile behavior and unsaved-change protection. Acceptance: reopening reconnects to one process, approvals are actionable and explicit, no input is queued or retried automatically, and legacy sessions remain inspectable.
- [ ] **SKD-PS-07 — Roll out with provider/version fallback and rollback.** Gate protocol adapters by verified capability, retain the PTY adapter as a fallback, and make coverage/source visible in session details. Acceptance: disabling the gate returns new sessions to PTY without damaging protocol history or worktrees; active sessions are never migrated in place.
- [ ] **SKD-PS-08 — Verify real-provider behavior and document delivery.** Run focused fixtures, full Node/browser suites, and separately authorized real-provider acceptance for both supported adapters. Acceptance: desktop/mobile/keyboard/light/dark UI is inspected; exact provider versions and event evidence are recorded in `VALIDATION.md`; installed/live verification is reported separately from fixtures.

## Acceptance and delivery gates

- Reproduce the current limitation through real launch entry points before changing transport: interactive PTY has no stable structured tool ledger while structured execution does.
- Use fake protocol providers for routine tests and temporary `FLOW_BENCH_DATA` plus separate ports. No test may contact a real account accidentally.
- Exercise two or more user turns, simultaneous tool calls, MCP and native tools, approval/denial, provider error, malformed/replayed events, reconnect, cancellation, server interruption, source checkout changes and benchmark cleanup.
- Prove one execution owner across Sessions, workflows and issue work. Process completion is not acceptance evidence; correlated terminal states and retained workspace state must agree.
- Keep loopback binding, Host/origin checks, server-selected executable/argv, bounded input/output and explicit public asset allowlists. No shell interpolation or browser-supplied command paths.
- Inspect active work before any live restart. Rollback must retain new history/worktrees, restore backed-up stores with the server stopped, and return future launches to the PTY adapter.
- Real-provider inference and approval exercise consume account access and require an implementation task that authorizes them. Fixture results remain labeled fixtures.

## Open decisions

- Whether protocol-backed sessions retain a literal terminal surface or use a structured conversation view with a terminal-compatible presentation layer. Preserve the familiar session behavior either way; decide after the provider spikes.
- Whether one provider can ship before the other. Working assumption: yes, behind explicit capability labels, because pretending parity would make coverage unreliable.
- Concrete retention limits for events and reconnect cursors. Choose them from measured provider traffic before schema freeze; expose truncation rather than dropping it silently.
- Whether approvals can be rendered safely in Workbench for each protocol. If a provider requires a native terminal prompt with no structured approval contract, keep that provider on PTY.

Local counterpart: `instructions/2026-09-21-protocol-owned-interactive-sessions.md` (not yet committed; the complete plan is included here).
