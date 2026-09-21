# Global and project Connections (MCP) — individual orchestration plan

## Prompt for Claude

### Orchestration preparation and integration rules

This is an individual, standalone plan split from the combined resource/graph handoff. It is the active execution entry for this feature; the combined handoff remains historical coordination context. Planning is complete, but no implementation, dispatch, provider usage, issue publication or server activation is authorized by saving this document. No specific model has been selected for its roles.

Before execution, read AGENTS.md, README.md and VALIDATION.md; inspect current Git status, branches/worktrees, active runs and source drift. The previous inspected baseline was `codex/github-issues` at `d7edd1de5c0d69145218084669c4cdf5f13045f1` with substantial pending work. Establish a reviewed prerequisite baseline before creating isolated codex/ task worktrees; preserve unrelated dirty work and the other task's detached publication checkout. Never reset, stash, overwrite or take over another task's unfinished work.

Assign one integration owner. Freeze server payloads, mount lifecycle (`dispose`, `isDirty`, `isPending`), scope/identity and test fixtures before parallel edits. Workers own only assigned files. Shared server.js, app.js, style.css, package/lockfiles, public/index.html, public/sw.js, existing provider adapters and shared tests require explicit exclusive ownership and serial integration. Other feature plans may be active: coordinate rather than independently claiming those files. At most three child lanes may run alongside the integration owner across the whole implementation; a validation lane can replace a completed worker.

On authorized tracked execution, retrieve/register this feature's exact checklist and stable IDs without duplicating prior plans. Follow repository Tracker Trapper rules: each session's own run and verified JSONL watcher, task start before work, completion immediately after acceptance, periodic activity and honest finish status. This preparation created no tracker records or GitHub issues. Existing runtime dependency IDs are references, not grants to take over their owners.

Run focused temporary-store/fixture checks before the relevant full suites. Inspect actual rendered UI for visual changes. Keep APIs network-only and updates explicit; cache changes preserve unsaved drafts. A later authorized local activation must inspect active execution and protect data before restart. Rollback preserves new records and requires schema compatibility. No implicit merge to main, push, deployment, real inference or automatic issue closure.

Each worker returns its baseline/worktree, scoped commits/files, exact test evidence, inspected screenshots where relevant, limitations and dependencies. The integration owner reports implemented/tested/activated and fixture/actual-provider evidence separately. Do not mark dependent todos complete from placeholders or old test receipts.

### Feature-specific orchestration

Own redacted global/project MCP inventory, assignment policies, explicit checks and supported activation. Graft index visualization does not depend on enabling its MCP server in product agent sessions.

| Role | Owned work |
| --- | --- |
| Integration/provider owner | Shared launch resolver, provider/terminal adapters, private config lifecycle and shared-file integration |
| MCP worker | `lib/connections.js`, `public/connections-ui.js`, `public/connections.css`, feature tests and harmless MCP fixtures |
| Validation worker | Independent isolation/secret-redaction/provider-check tests; reports source failures to owners |

Sequence: freeze inventory identities and policy contract → inventory/policy/UI plus independent fixtures → selective-provider adapter spike → only supported modes receive activation/check controls → launch integration and regression. All provider adapter changes integrate serially with the Skills/graph owners; no competing safe-mode or permission changes.

Preserve `SKD-MCP-01` through `SKD-MCP-06`. MCP-04 is a hard capability gate for MCP-05, not an optional test after implementation. If safe selective activation requires a new app-server/broker/credential architecture, report the fork and keep that activation pending; inventory can still ship. Never label argv fixtures alone as proof of actual tool availability.

Navigation owner supplies shared routes/allowlists/cache wiring. Test native versus managed mode, project isolation, stale source/fingerprint, correct worktree resolution, explicit bounded initialize/list-tools, cancellation/cleanup and secret omission from API/log/history/archive. No tool invocation on checks; no processes/account contact on inventory. Structured/read-only/issue-proposal restrictions remain as specified below.

### Full feature contract and acceptance checklist

Status: investigated plan, not implementation authorization. Target `/Users/shelbyklein/Vibes/skd-workbench`. Read `AGENTS.md`, `README.md`, `VALIDATION.md`, and `2026-09-21-navigation-orchestration-plan.md`; preserve all unrelated edits. Newton is a read-only reference, never an operational dependency.

### Outcome and phased delivery

Home → Connections (MCP) shows configured global MCP resources and which projects can use them. Project Connections shows inherited and project-local servers, provider/mode compatibility, explicit assignments and last verified status. The page must distinguish discovery, selection, configuration and actual runtime availability.

First useful slice: a read-only, redacted inventory with current launch restrictions and links/instructions for provider-owned setup. Next milestone: explicit opt-in selection of already configured servers for supported future interactive sessions. A later milestone may add server creation/OAuth and structured-run MCP access. Do not represent the first inventory slice as completed activation.

### Confirmed source findings

- Workbench has no MCP inventory/store/page. The `connections` variable in `public/app.js:18` caches Git inspection; do not reuse it for MCP.
- `lib/terminals.js:13–17`: interactive Codex does not pass the headless ignore-config flags and therefore can inherit native configuration. Interactive Claude explicitly uses safe mode, empty strict MCP config and disabled slash commands; read-only mode restricts tools further.
- `lib/codex.js:86–92`: structured Codex ignores user config/rules; issue proposals additionally disable shell/unified-exec/web search. `lib/claude.js:56` uses empty strict MCP config and explicit tools. Provider discovery at `lib/claude.js:13` also deliberately excludes MCP and hooks. Do not enable tools during model discovery.
- Newton reference root is `/Users/shelbyklein/.newton-dev/development/workspace`. `crates/newton-core/src/connections.rs:13–40` models per-provider bindings; `:43–120` bounds reads, redacts errors and separates configured from available. `src/ConnectionsView.tsx:350–363` derives switches/status from provider support and effective state. `docs/connections.md` documents scoped overrides, optimistic revisions, account versus MCP distinctions and limitations.
- Newton has persistent bots, an account broker and live Codex app-server control. Workbench currently uses CLI/PTY sessions; do not copy Newton's hot-reload or account-management claims into this UI.
- Actual development-session catalog contains six Graft tools; calling freshness succeeded but reported missing/stale index state. Tools callable by this Codex task are not proof they are callable inside Workbench's child agents.

Installed Claude help confirms safe mode disables customizations including MCP, so replacing its empty MCP JSON alone may not enable anything. The [official Claude MCP documentation](https://code.claude.com/docs/en/mcp#scope-hierarchy-and-precedence) describes scoped settings and strict configuration. Treat local adapter tests and policy behavior as authoritative for this integration; a config file is not a health check.

### Data ownership and inventory

Create `lib/connections.js` and `.data/connections.json` for Workbench-owned references, explicit assignment policies and revisions. Existing provider configuration/authentication remains provider-owned. Store canonical source identity, provider, server key, source scope, nonsecret fingerprints, timestamps and policy only. Refresh derives display metadata; do not persist a second authoritative copy of every provider config.

Inventory explicit supported sources: Codex home and trusted workspace/ancestor config; Claude user/workspace/local MCP and policy declarations. Distinguish ordinary MCP servers from app connectors and plugin-contributed tools. Initial UI primarily manages MCP; show unsupported connector/plugin types with setup location/reason, not fake enable switches. Bound file sizes, candidate counts and ancestor traversal; use parsers that match the documented format with no evaluation. Add direct TOML dependencies if needed instead of regex rewriting or relying on transitive packages.

IDs must include provider, source identity and server key. Same-name servers in different providers/projects are not one identity. Show configuration precedence and shadowed entries; when policy cannot be resolved, label effective status unknown. Canonical source checkout and execution worktree are distinct: inspect both relevant paths at launch, never assume untracked config follows a Git worktree.

Inventory responses include name, provider, scope/source path, transport, environment variable names, inline-credential presence, configured status and sanitized diagnostics. Never expose raw commands/arguments, endpoint secrets, headers, values, tokens or parser excerpts through list APIs, error responses, logs or run snapshots. Do not auto-run a command, install a package, or contact a remote server to populate the page.

### Selection, policy and security boundary

For new Workbench-managed activation, a server starts unassigned. Project assignments and launch overrides cannot override provider/admin denial, incompatible mode, or an invalid/stale source. Enabling global availability permits selection; it does not grant every project access. Persist intent independently from live observations.

Preserve existing interactive Codex behavior during the inventory milestone: label it **Native provider configuration**. Its observed inheritance is not controlled by new Workbench toggles. Offer **Workbench selection** only after the adapter can prove both included and excluded sets; moving an existing project/session default to that mode is an explicit user choice. Avoid a silent migration that either removes current tools or grants new ones.

Proposed effective managed set: explicitly selected servers intersect project allow policy, current source/provider policy and mode support. Skill assignment cannot expand that set. Session-only overrides are frozen in the launch snapshot. Workflow-step selection remains deferred while structured MCP is blocked.

Keep read-only executions and issue-edit proposals MCP-free in the first activation milestone. A read-only filesystem sandbox does not make remote MCP tools read-only. Initial managed activation targets interactive worktree sessions with their existing native approval flow. Structured runs whose approval policy is `never` require a separate tool-level policy review and are not enabled by this plan's initial activation milestone.

Use validated provider-specific serializers and server-selected argv, never a shell command or browser-supplied executable. Do not write global provider settings, copy OAuth stores or change `HOME`/`CODEX_HOME` as an isolation shortcut. A private, temporary per-session configuration may reference approved provider-owned settings after validation; any secret-bearing material needed by the provider must remain server-side, mode 0600, outside archives/snapshots and be cleaned after process exit. Prefer provider references/environment names. If an existing server cannot be launched safely without migrating credentials, show provider setup required and leave it unsupported in this milestone.

Respect original command working-directory semantics and environment forwarding. Rebinding a repository-relative command to a temporary worktree may run different code; validate source/fingerprint and resolved executable before launch. Failure to preserve source identity or restrictive policy blocks activation rather than broadening inherited settings.

### Adapter spike: explicit acceptance gate

Before enabling UI switches, implement disposable fixture servers that advertise uniquely named harmless tools and capture received initialization. Verify actual CLI configuration parsing/startup without submitting inference where feasible.

For Codex, establish a supported mechanism that preserves provider sign-in while excluding unselected global/project/plugin/app tools. Current CLI help exposes TOML `-c` overrides but does not prove an exclusive allowlist. Test effective discovery against colliding scopes and installed policies. For Claude, establish selective MCP configuration without safe mode suppressing selected servers and without re-enabling hooks/plugins/slash commands or bypassing permissions. Do not remove safe mode wholesale as a shortcut. Unsupported combinations stay visibly unavailable.

The spike is a material implementation gate: if selective isolation needs a new app-server session architecture, broker or credential manager, document that decision and stop that activation subtask. Inventory remains shippable. Do not quietly replace the PTY/session architecture or claim selective activation based solely on argv fixtures.

### UI, APIs and runtime state

Global/project pages use `/#connections` and `/#connections/<project-id>`. Group by provider or server, with project usage shown; use Workbench sessions/steps rather than Newton's bot cards. Offer search, scope/provider/status filters, explicit Refresh, details and setup guidance. Empty state: “No MCP servers found” plus supported setup instructions. Malformed config has a path-only error and retry; it does not erase existing assignments.

Display states separately: discovered; configured off; selected for next session; excluded by mode/policy; launch configured / live status unknown; checking; tools available (with timestamp and exact session); failed; disconnected. “Tools available” means handshake/tool catalog success, not correct account identity or successful business operations.

Proposed API: redacted GET inventory/detail, revisioned PUT project policy, launch preview, explicit POST check, and GET check status. The check uses only validated known configuration IDs, bounded initialize/list-tools, timeout/cancellation/output limits and process cleanup; no tool invocation or account-content reads. Because a check may start external code/contact a service, it is an explicit user action, never refresh/page-load behavior. No automatic auth flow or retries. Checks cannot steal the execution owner's process or be mistaken for the agent's live connection.

Saving selection never restarts a session. Existing sessions report configuration changed / next session required; no Newton-style hot reload is promised. Turning off a connection prevents future managed launches but cannot revoke calls already running or erase delivered tools. Expose the existing End session action when immediate termination is desired; do not activate it automatically.

### Ordered checklist

- [ ] **SKD-MCP-01 — Inventory and source precedence.** Implement bounded parsers, stable IDs, diagnostics and redacted metadata. Acceptance: two-project/provider collisions, inheritance/shadowing, malformed files, symlinks, inline secrets and unavailable sources are covered; inventory launches nothing.
- [ ] **SKD-MCP-02 — Global/project UI.** Add real empty/loading/error/details states and provider/mode exclusions. Acceptance: interactive Codex inheritance, strict Claude exclusion and structured restrictions are represented accurately; discovered does not render as connected.
- [ ] **SKD-MCP-03 — Assignment policy.** Persist reference-based explicit selections and revisions, with native versus managed mode distinguished. Acceptance: project overrides cannot expand denied scope; edits do not alter open sessions, provider files or historical snapshots.
- [ ] **SKD-MCP-04 — Prove selective adapters.** Run the bounded spike above. Acceptance: exactly selected fixture tools become available in supported actual CLI startup, unselected tools/hooks stay unavailable, and normal permissions/auth remain. Record unsupported combinations and stop their dependent work.
- [ ] **SKD-MCP-05 — Launch integration and explicit checks.** Integrate compatible interactive worktree adapters via `lib/agent-context.js`, snapshots, source revalidation, private config cleanup and bounded health checks. Acceptance: changed config blocks stale launches; checks never call tools; no secret appears in API/log/history/archive; issue drafts/read-only/structured modes remain excluded.
- [ ] **SKD-MCP-06 — Regression and evidence.** Complete route/PWA integration and tests; inspect rendered UI; record supported modes and evidence. Acceptance: saved selection → actual fixture handshake → timestamped status → next-session removal works without automatic execution/reconnect.

### Tests and verification

Add `tests/connections.test.js`, `tests/connections-browser.mjs`, a fixture stdio MCP server and provider-specific adapter tests. Cover parse bounds, URL/command/header redaction, error redaction, source replacement during launch, environment names, duplicate sources, worktree path differences, configuration conflicts, native/managed migration, unavailable executable/auth, cancellation/timeouts, check process cleanup, server shutdown, and no secret leakage into benchmark archives.

Exercise real HTTP and launch entry points; mocked argv alone cannot prove tool availability. Use temporary data/provider config and fixture servers; do not touch actual accounts. Run focused tests, affected terminal/issue suites, then both `npm test` and `npm run test:browser`. Inspect mobile/desktop, keyboard switches/details, unknown/error styling, accents and draft guards. Bump the current service-worker cache and keep all API results network-only.

No runtime check or provider activation was performed by this planning pass. Report parser fixtures, actual CLI startup/catalog discovery, inference tool use and real account identity separately. Real-account tests require an explicitly authorized target; tool availability alone is not external-action authorization.

### Later scope

Adding/editing arbitrary MCP servers, OAuth onboarding, Newton-style app account controls, secret-vault UI, hot reload, per-tool remote-action enforcement, structured workflows with MCP, and automatic maintenance are follow-ons. Retain Track B of the existing Knowledge/Graft handoff for development tooling; never silently enable `graft_development` in product agent runs.
