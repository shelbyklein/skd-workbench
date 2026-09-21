# Connections (MCP): inventory and controlled activation

## Prompt for Claude

Status: investigated plan, not implementation authorization. Target `/Users/shelbyklein/Vibes/skd-workbench`. Read `AGENTS.md`, `README.md`, `VALIDATION.md`, and `2026-09-21-global-resource-pages.md`; preserve all unrelated edits. Newton is a read-only reference, never an operational dependency.

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

Proposed effective managed set: explicitly selected servers intersect project allow policy, current source/provider policy and mode support. Knowledge/skill assignment cannot expand that set. Session-only overrides are frozen in the launch snapshot. Workflow-step selection remains deferred while structured MCP is blocked.

Keep read-only executions and issue-edit proposals MCP-free in the first activation milestone. A read-only filesystem sandbox does not make remote MCP tools read-only. Initial managed activation targets interactive worktree sessions with their existing native approval flow. Structured runs with approval policy never require a separate tool-level policy review and are not enabled by this plan's initial activation milestone.

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
