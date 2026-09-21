# Playbooks and session activity records

Issue: https://github.com/shelbyklein/skd-workbench/issues/5

## Outcome

Make Sessions the primary development path through reusable, versioned playbooks of managed skills and MCP connections. A session can select and override a playbook, retain its frozen launch configuration, show honest activity coverage, and save that frozen configuration as a new playbook. Workflows remain available and unchanged.

## Boundaries

- A playbook selects managed skill and MCP resource IDs. It never copies credentials, provider configuration, models, effort, workspace, task, conversation, worktree, or execution state.
- Configuration, catalog availability, and observed invocation are separate facts.
- Explicit launch overrides take precedence over a project playbook default, which takes precedence over legacy project defaults when no playbook is selected.
- Exact empty selections stay empty. Policy, provider, scope, archive, revocation, and compatibility restrictions always win.
- MCP-free modes stay MCP-free. Native skills are never described as disabled unless the provider adapter proves that exclusion.
- Historical session snapshots stay immutable. New playbook launches re-resolve current eligible resource revisions and display drift from historical provenance.
- Activity storage is allowlisted metadata only. It excludes arguments, results, prompts, credentials, endpoints, and server configuration.
- Terminal text is not an authoritative activity source. If complete structured capture needs a PTY architecture replacement, record the decision and stop that adapter work rather than silently expanding scope.

## Ordered implementation todos

- [ ] **SKD-PB-01 — Validate provider isolation and activity sources.** Document and fixture-test Codex/Claude capability matrices for native skills, managed skills, MCP exclusion, and session-bound structured events; identify unsupported combinations and any architecture decision before enabling controls.
- [ ] **SKD-PB-02 — Persist versioned playbooks and project defaults.** CRUD, archive, stale-write rejection, project/provider scope, explicit empty selections, backups, and corrupt-store handling pass tests; edits preserve prior versions and run snapshots.
- [ ] **SKD-PB-03 — Resolve playbooks at every supported launch entry point.** Preview and actual launch agree; defaults and exact session overrides resolve deterministically; missing, revoked, or incompatible selections block with reasons; retries retain frozen inputs and recheck eligibility.
- [ ] **SKD-PB-04 — Build the playbook library and session launch controls.** Create/edit/duplicate/archive and project default work through UI; provider-aware controls show enforceability; selecting a playbook starts no process until Start session.
- [ ] **SKD-PB-05 — Create a playbook from an existing session.** Active and ended sessions open an editable draft from captured configuration; observed use is separate; save persists provenance without mutating the source session, starting execution, or copying secrets.
- [ ] **SKD-PB-06 — Persist normalized tool and connection activity.** Correlated calls/results/denials carry source, timestamps, and coverage; reconnect/restart do not duplicate; interruption does not infer success; retention never appears complete.
- [ ] **SKD-PB-07 — Show configuration and observed activity on run details.** Interactive, structured, and workflow-attempt details show frozen configuration, observed usage, and complete/partial/unavailable coverage; legacy unknown differs from no use.
- [ ] **SKD-PB-08 — Verify integrated behavior and document delivery.** Full Node/browser suites pass with temporary stores; desktop/mobile/keyboard/light/dark UI is inspected; cache and allowlist changes are verified; fixture, CLI startup, structured activity, and real-provider evidence are distinguished in `VALIDATION.md`.

## Integrated acceptance

Fixture journey: create a playbook, select it at session launch, override one resource, run known fixture calls, inspect configured versus observed capabilities, save the session as a new playbook, and launch with the reviewed selection. Cover both providers, supported managed/native modes, active/ended/failed/interrupted/legacy sessions, exact none, global/project scope, duplicate names, missing/revoked resources, drift, stale tabs, cancel, failed save, and idempotent retry behavior.

Use disposable data, ports, fake provider executables, and fixture MCP servers. Preserve session ownership, permission prompts, reconnect behavior, manual worktree review, workflow retries, no auto-resume, and MCP-free boundaries. Update `public/sw.js` when cached shell assets change and record delivery evidence and remaining limits in `VALIDATION.md`.

## PB-01 capability matrix (2026-09-21)

Verified against installed Codex CLI 0.155.1 and Claude Code 2.1.278 help, plus the Workbench fixture adapters. “Structured” means events are emitted by the exact child process and parsed without terminal scraping.

| Provider / entry point | Managed skill text | Native skill isolation | Managed MCP exact set | Session-bound structured tool events |
| --- | --- | --- | --- | --- |
| Codex interactive PTY | Supported through `developer_instructions` | Unsupported: interactive Codex still loads provider configuration and native packages | Supported for worktree sessions; the adapter enumerates effective MCP names, explicitly disables every unselected server, and enables selected identities | Unavailable in the PTY stream. `--json` exists only on `codex exec`; the TUI can connect to app-server, but Workbench does not own that protocol session |
| Claude interactive PTY | Supported through `--append-system-prompt` | Provider skills are disabled with `--disable-slash-commands`; selected managed MCP requires leaving safe mode, while hooks, agents, task delegation, and the tool list remain explicitly restricted | Supported for checked stdio servers in worktree sessions through `--strict-mcp-config`, a private exact config, and an explicit tool allowlist | Unavailable in interactive mode. `--output-format stream-json` and hook events require `--print` |
| Codex structured run / workflow / issue proposal | Supported through `developer_instructions` | Supported for user configuration and rules through `--ignore-user-config` and `--ignore-rules` | Intentionally MCP-free | Supported through the exact child’s `codex exec --json` stream |
| Claude structured run / issue proposal | Supported through `--append-system-prompt` | Supported by safe/restricted mode, disabled slash commands, hooks, and explicit tools | Intentionally MCP-free | Supported through the exact child’s `--print --output-format stream-json` stream |

Read-only interactive sessions remain MCP-free. Empty managed selections are enforced rather than represented only in the UI. Codex native skill packages in interactive mode remain independently discoverable, so the interface must say that managed instructions are excluded without claiming all native skills are disabled.

### Architecture decision exposed by PB-01

Complete tool activity for an interactive session cannot be added to the current PTY transport from either installed CLI. ANSI terminal output is bounded, replayable presentation text without stable call/result IDs. Provider log discovery would require guessing or a new verified binding and is therefore rejected.

Reliable complete capture requires replacing or pairing the PTY child with a protocol-owned session: Codex app-server/TUI remote control and a corresponding Claude streaming-input session, or another broker that preserves interactive input, approvals, terminal UX, and exact child identity. That is an execution architecture change beyond a passive ledger adapter. Until explicitly chosen, interactive activity coverage must be `unavailable` with this reason; structured runs can use their existing exact-child JSONL streams. Playbook configuration and save-from-session can still use frozen launch snapshots, but “only observed capabilities” must remain unavailable for PTY sessions.
