<!-- skd-playbooks-session-activity-2026-09-21 -->
# Playbooks and session activity records

GitHub issue: https://github.com/shelbyklein/skd-workbench/issues/5

## Outcome
Make session-based development the primary path: choose a reusable playbook of skills and MCP connections, adjust it for one run, and retain an accurate record of the configuration and actual tool/connection usage. Users can create a playbook from scratch **or save one from any existing session**. Workflows remain available for explicit sequences; do not delete or automatically convert them.

Status: implementation plan only. No implementation, provider execution, restart or deployment is authorized by this planning task.

## Evidence
Inspected 2026-09-21 at `c7c946ccc625892e268b235016d26f570e98c74d` on `codex/github-issues`, including current uncommitted files. Existing unrelated UI/settings/issues edits must be preserved. Findings are source inspection, not new runtime verification.

- `lib/terminals.js` (`terminalArgs`, session start) persists exact managed skill context and redacted connection launch snapshots. Interactive output is a bounded 1 MiB terminal tail, not a complete structured transcript.
- `lib/skills.js` (`resolve`, `validateSnapshot`) supports inherit/replace selections, explicit empty sets, versioned managed text and revocation checks. Excluding managed text does not prove a native skill package is unavailable.
- `lib/connections.js` (`resolve`, `prepareLaunch`) supports managed MCP selection for interactive worktree sessions. Native mode can have incomplete inventory in the run snapshot. Read-only sessions, structured workflows and issue proposals remain MCP-free.
- `lib/codex.js` and `lib/claude.js` retain bounded activity summaries, not a durable normalized usage ledger. Current summaries cannot establish complete call/result correlation.
- `lib/workflows.js` preserves per-attempt contexts and retry ownership. `public/codex-ui.js`, `public/terminal-ui.js`, `public/workflows-ui.js`, resource UIs, `server.js` and `public/app.js` are integration points.
- Follow current `AGENTS.md`, `README.md`, `VALIDATION.md`, and the existing interactive-terminal, skills and MCP feature instructions. Earlier planning statements about missing implementations are historical.
- No duplicate among the current repository issues. Related: [development lanes #1](https://github.com/shelbyklein/skd-workbench/issues/1), [issue direction steps #3](https://github.com/shelbyklein/skd-workbench/issues/3). Their broader work remains separate.

## Behavior and scope

### Playbook library and launch
A playbook is a named, versioned selection of skills and MCP connections. Support global and project scope, provider compatibility, description, stable IDs, archive state and a project default reference. Model, effort, workspace and task remain separate session settings.

Use existing resource IDs and policies; do not duplicate credentials, provider configuration or the skills library. Provider-specific identities must not be matched by display name. Global playbooks cannot capture project-private resources. A global playbook is selectable only where its resources are eligible.

Precedence: explicit session selection/overrides → project playbook default → existing legacy defaults when no playbook is selected. Resolve a playbook to exact sets, including an empty set, rather than merging in future defaults. Denials, provider restrictions and scope checks always take precedence. Preview effective selections and exclusion reasons before launch. New resources never become enabled merely because they were discovered.

Freeze playbook ID/version, resolved resource IDs/revisions, exact delivered skill text, redacted connection fingerprints, exclusions and per-session overrides in each run. Resource changes after preview require revalidation; do not silently replace or drop a selected capability. Playbooks use current eligible resource versions for new runs, while old run snapshots remain immutable. Show version drift when recreating a historical configuration.

MCP off means excluded by managed launch configuration. Distinguish managed skill instructions from independently discoverable native skills. Do not label native skills disabled without proving enforcement. Unsupported provider/mode combinations need explicit reasons; no fallback to broader native configuration. Do not expand current MCP-free modes in this issue.

### Save session as playbook
Expose **Save as playbook** from active and ended session details, with name, scope, and an editable skills/connections selection. Begin from the source session's frozen launch configuration, not today's project defaults. Include any session-specific overrides.

Annotate configured capabilities with observed usage where evidence exists; default to the full configured selection. Offer an explicit selection of only observed capabilities only when evidence can support it. A tool call maps to its owning connection; reading a file does not by itself prove a skill was followed. Never infer unused from missing telemetry.

Before save, show missing, archived, revoked, incompatible and unresolved native resources. Require explicit correction/removal or mapping; never silently turn an incomplete historical record into an apparently exact reusable preset. A legacy session may provide an incomplete starting draft with a clear explanation. Provider ownership and current policy still apply.

Persist source session ID and source snapshot/version provenance, not its conversation, secrets, worktree, or execution state. Saving does not modify the session or original playbook and does not launch anything. Cancel has no effect. Saving twice intentionally creates separate versions/copies according to the explicit chosen action; retries of one save must not create duplicates.

### Record what happened in every run
Use a shared activity model for interactive sessions, standalone structured runs, issue-directed sessions and workflow attempts. Preserve special issue-proposal restrictions. A workflow rollup references child attempt activity without double counting.

Record provider/session/attempt identity, event and call IDs, tool name/type, owning connection identity where known, start/end timestamps, observed outcome (success/error/denied/cancelled/unknown), and evidence source. Aggregate per-tool/per-connection counts from correlated calls. Separate configuration, catalog availability and actual invocation; selection is not usage.

Track capture coverage per source and run: complete for a stated supported event scope, partial with gaps/reasons, or unavailable. Legacy missing data is unknown, never zero. Native/unmapped calls stay visible with unknown connection attribution. Reconnection and reload must deduplicate, and a run-ended event is not proof every tool succeeded.

Prefer structured provider events bound to the exact child session. Do not scrape ANSI terminal text as an authoritative ledger or attach whichever provider log is newest. Establish supported collection and isolation in PB-01 before choosing an adapter. The goal is reliable usage capture; a coverage label is an honest fallback, not fulfillment of complete recording. If supporting a provider requires replacing the PTY architecture, stop at that material design decision and document the gap.

Store allowlisted metadata by default, not raw arguments/results, prompts, credentials, endpoints or server configuration. Sanitize error summaries. Bound event storage and retain useful aggregates; expose truncation, collection failure and retention gaps. Activity collection is passive and cannot invoke tools, bypass approvals or start another agent.

## Ordered implementation todos
- [ ] **SKD-PB-01 — Validate provider isolation and activity sources.** Acceptance: Document and fixture-test Codex/Claude capability matrices for native skills, managed skills, MCP exclusion and session-bound structured events; identify unsupported combinations and any architecture decision before enabling controls.
- [ ] **SKD-PB-02 — Persist versioned playbooks and project defaults.** Acceptance: CRUD, archive, stale-write rejection, project/provider scope, explicit empty selections, backups and corrupt-store handling pass tests; edits preserve prior versions and run snapshots.
- [ ] **SKD-PB-03 — Resolve playbooks at every supported launch entry point.** Acceptance: Preview and actual launch agree; defaults and exact session overrides resolve deterministically; missing, revoked or incompatible selections block with reasons; retries retain frozen inputs and recheck eligibility.
- [ ] **SKD-PB-04 — Build the playbook library and session launch controls.** Acceptance: Create/edit/duplicate/archive and project default work through UI; provider-aware on/off controls show enforceability; selecting a playbook starts no process until Start session.
- [ ] **SKD-PB-05 — Create a playbook from an existing session.** Acceptance: Active and ended sessions open an editable draft from their captured configuration; observed use is annotated separately; save persists provenance without mutating the source session, starting execution or copying secrets.
- [ ] **SKD-PB-06 — Persist normalized tool and connection activity.** Acceptance: Correlated calls/results/denials carry source, timestamps and coverage; restart/reconnect do not duplicate events; interruption closes collection without inferred success; retention never masquerades as complete capture.
- [ ] **SKD-PB-07 — Show configuration and observed activity on run details.** Acceptance: Interactive, structured and workflow-attempt details show frozen selections, tool/server usage and complete/partial/unavailable coverage; legacy unknowns are distinct from no use.
- [ ] **SKD-PB-08 — Verify integrated behavior and document delivery.** Acceptance: Full Node/browser suites pass with temporary stores; desktop/mobile/keyboard renders inspected; cache/allowlist updates verified; actual CLI and authorized real-provider evidence are distinguished from fixtures in VALIDATION.md.

## Acceptance and delivery gates
- End-to-end fixture journey: create playbook → select at launch → override one resource → execute known allowed calls → inspect configured versus used → save session as a new playbook → launch with the reviewed selection.
- Cover both providers; managed/native modes; active/completed/failed/interrupted and legacy sessions; explicit none; global/project scope; duplicate names; missing/revoked resources; version drift; changed fingerprints; stale tabs; cancelled drafts; failed saves and idempotent retries.
- Exercise real HTTP and launch entry points with fake executables and disposable MCP servers. Prove excluded resources are absent, not simply hidden in the UI. Test correlation, concurrent call completion ordering, duplicate/replayed/malformed events, disconnect/restart, retention limits, redaction and no cross-session attribution.
- Preserve session ownership, prompt-free interactive startup, hide/reconnect behavior, manual worktree review, no auto-resume, existing workflow retries, permission prompts and MCP-free boundaries.
- Add migration/backup and corrupt-store tests; use atomic persistence and stale revision checks. Existing history remains readable without fabricated backfill.
- Run `npm test` and `npm run test:browser` for integrated delivery; inspect desktop/mobile, keyboard, light/dark, unsaved drafts and explicit PWA updates. Update asset allowlist and shell cache when needed.
- Record fixture checks, actual CLI startup/configuration evidence, actual tool events and live UI evidence separately in `VALIDATION.md`. Real-provider inference requires an authorized execution scope; do not perform it during planning or mark unsupported recording complete.
- Roll out library/configuration first, then verified collection by adapter. If collection is incomplete, label the milestone partial and keep the relevant acceptance tasks open.
- Before deployment/restart inspect active execution. Rollback restores backed-up stores with the server stopped and keeps generated run history/worktrees; never reset user checkouts.

## Working assumptions and open decisions
- First version uses launch-time selections; changing a playbook does not hot-toggle an active session. Live changes are deferred.
- Playbooks compose managed resources. Full native skill isolation and exact provider event availability are unverified implementation gates, not assumed capabilities.
- Proposed collection policy is metadata only with explicit coverage. PB-01 must specify supported provider versions, event sources and concrete retention limits before implementation.
- Preserve existing workflow navigation and routes. Add Playbooks near Sessions; a larger navigation redesign is outside this issue.
- Deferred: workflow conversion, automatic recommendations, skill/package installation, credential management, arbitrary per-tool permission editing, raw transcript analytics, cross-provider identity guessing and automatic execution.

Local counterpart: `instructions/2026-09-21-playbooks-and-session-activity.md` (not yet committed; the complete plan is included here).
