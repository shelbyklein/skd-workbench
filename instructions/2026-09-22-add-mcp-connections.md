# Add and manage MCP connections

## Prompt for Claude

### Outcome

Add MCP servers directly from SKD Workbench's global and project Connections views, then select them in existing Agents and future supported sessions. Support Codex and Claude. Follow Newton's add/import/assign interaction while retaining Workbench's own storage, session lifecycle and execution policies. Implementation authorized 2026-09-22 and tracked in https://github.com/shelbyklein/skd-workbench/issues/11. TT plan: `45C94156-BB20-4AEC-A2D2-B3863978927A`.

Read AGENTS.md, README.md, VALIDATION.md and the relevant Connections and Agents instructions. Preserve unrelated changes. Newton is a read-only reference, not a runtime dependency.

### Confirmed current system

At planning time main is 4b87934. `public/connections-ui.js:10` renders inventory, filters and project policies but no creation action; its empty state tells users to configure a provider elsewhere. `server.js:105–117` exposes inventory/policy/check routes, not server CRUD. `lib/connections.js:24` validates schema 1 containing only policies/checks; `:52` collects provider-owned configuration; `:90` starts the Connections service. Its public rows redact executable arguments, URLs and credentials. `:100–125` resolves selections and compiles provider-specific launch configuration, and `:127–143` checks only stdio initialize/tools-list. Workflow/read-only/issue-proposal purposes are explicitly excluded at `:103`.

Newton reference: `/Users/shelbyklein/.newton-dev/development/workspace/src/ProjectMcpConnections.tsx:37–53` implements add/edit/remove, provider snapshot import and assignment; `:66–80` defines the editor for stdio/HTTP and secret references. Its `crates/newton-core/src/project_mcp.rs` validates grants against its vault and imports snapshots with source provenance. Workbench does not have Newton's vault or persistent bot reconnection architecture. Do not imply it does.

### Ownership and design

Extend Connections as the canonical service, with a schema migration adding Workbench-owned definitions to its revisioned store. Preserve existing policies, check history and provider-derived IDs verbatim. Definitions own stable identity, version, scope (global or one project), display name, transport, provider compatibility, validated nonsecret configuration, enabled/archive state and optional import provenance. Use a distinct stable ID namespace; audit the current 64-hex route constraint before choosing its representation.

Keep discovered provider configuration read-only. Import explicitly creates a managed snapshot; it is never a live synchronized copy. Preserve source identity, source fingerprint and canonical base directory. Report source drift and require explicit refresh with a preview; source disappearance does not erase the imported definition.

Global scope means eligible for selection across projects, not enabled everywhere. Project definitions remain confined to that project. Existing Agent profiles own their connection selections; do not add an independent access list to definitions that can diverge from those selections. Project policies remain defaults for the existing legacy/no-specialization path. A global Agent cannot embed a project-only connection. An Add-to-Agent shortcut, if included, must call the canonical revisioned Agent mutation.

### First useful slice

Connections → Add MCP server opens one editor with name, scope, compatible providers, and transport. Local stdio accepts executable, structured argument list, explicit working directory and environment variable references. Remote HTTP accepts endpoint and supported authentication references. Supply Import from provider for existing discovered entries. Save persists only; Check is a separate explicit action. Users then assign the connection through Agents and review its effective configuration before a new session.

Show Saved/not checked, Checking, Tools available with timestamp, Failed, Disabled and Unsupported for this provider/mode as distinct states. Do not label a saved definition Connected. Existing sessions retain frozen configuration; editing/removal applies to future launches. Archive with an affected-Agent summary preserves history and leaves unresolved references visible rather than silently removing them.

Credential support must be truthful. First slice supports references to environment variables actually available to the Workbench server and reports missing variable names without values. Do not pretend a desktop launch service inherits a user's terminal environment. No raw credentials in arguments, URLs, headers, history or API responses. A protected credential entry/store and OAuth onboarding are a separate dependency, not a text field that saves secrets in JSON. Display an actionable unsupported-auth state for servers requiring them. Do not reuse Newton's vault or modify the user's shell/provider configuration automatically.

### Ordered implementation chunks

- [x] MCP-ADD-01 — Canonical managed definitions and migration. Add schema backup/migration, atomic writes, optimistic revision checks, bounded validation, scoped CRUD/archive and duplicate-create request keys. Preserve old IDs and malformed-store failure. Acceptance: restart retains definitions; stale writes and cross-project access fail; provider files remain byte-identical.
- [x] MCP-ADD-02 — Inventory and explicit snapshot import. Merge managed definitions with discovered rows using stable IDs and explicit origins. Import uses server-resolved source IDs and expected fingerprints, never arbitrary client file paths. Preserve canonical cwd and reject unsupported configuration rather than dropping fields. Duplicate imports recover the existing record; refresh previews changes. Resolve name collisions explicitly instead of overwriting another server.
- [x] MCP-ADD-03 — Provider adapters and bounded catalog checks. Extend the existing Connections resolution/preparation path for managed definitions, both Codex and Claude. Resolve environment references immediately before use; never include values in snapshots. Add HTTP initialize/tools-list checking with bounded responses/timeouts/cancellation and correct transport handling. Verify installed provider compatibility before offering remote activation; existing Claude activation requires a matching successful tool catalog check. Checks must not call business tools. Saving, refreshing and opening a view start no processes and make no remote contact.
- [x] MCP-ADD-04 — Global/project editor and Agent assignment. Add Add server and Import actions, keyboard-accessible dialogs, draft protection, inline validation, loading/error/recovery, edit/archive and usage summaries. Global definition is visible in eligible projects without automatic assignment. Keep existing resource pickers and launch preview authoritative. Bump the shell cache when UI assets change.
- [x] MCP-ADD-05 — End-to-end evidence and delivery. Test real HTTP API entry points and fixture subprocess/HTTP MCP servers with temporary stores. Inspect desktop/mobile screenshots. Record migration, privacy, isolation, adapter and UI evidence in VALIDATION.md. Distinguish fixture transport success, actual installed CLI startup and real inference; no account actions or user workflow runs for routine validation.

### Required invariants and edge cases

Extend existing launch fingerprints/signatures to include definition version, provider binding and validated nonsecret config. Editing, disabling, scope removal or archiving invalidates stale previews and prevents a new launch, while existing history remains immutable. Retries follow the established frozen-context and current-eligibility policy; never silently broaden access.

Spawn executable plus argument array, never interpolate a shell command. Imported relative paths resolve against their original source directory, not the session worktree by accident. Handle missing executables, unavailable directories, duplicate names, malicious keys, malformed imports, revoked environment references and source changes between preview and launch. Keep errors/logs redacted, credentials out of browser persistence and APIs network-only. HTTP redirects must not forward credentials across origins; reject unsupported schemes and embedded URL credentials. Only explicit check/launch may contact the supplied endpoint. Stop checks cleanly on timeout/cancel/server shutdown, including child processes.

Read-only sessions, issue proposals and structured workflows currently exclude MCP. Preserve that boundary in this slice and show it clearly in Agent/run previews. Adding a connection must not silently enable it in those execution modes.

### Tests and verification

Extend `tests/connections.test.js`, the resource browser suite and existing Agent/terminal launch tests. Required cases: empty/schema-1 migration and backup; damaged store; global versus project isolation; stale update; duplicate create/import after lost response; source drift; archived references; provider compatibility; secret redaction in every public response and error; environment resolution with a missing service variable; cwd preservation; no subprocess/network on save; explicit check protocol errors and cleanup; exact selected-server isolation for both providers; no mutation of provider files or historical runs. Test HTTP authentication references and redirect behavior with local fixture endpoints, not external accounts.

Browser acceptance: Add → save → reload → explicit check → assign to Agent → launch preview works globally and per project; cancel is write-free; unsupported auth gives an actionable state; mobile has no overflow; keyboard focus returns to the initiating control; stale editor retains draft and offers reload without silently overwriting.

Run focused tests followed by `npm test` and `npm run test:browser`. Use temporary FLOW_BENCH_DATA. Actual provider smoke checks, live service activation and remote publication are separate delivery actions; inspect current execution and authorization before doing them. If executed as a GitHub issue, register/retrieve stable TT todos, report progress continuously, and finish the session run honestly.

### Follow-ons

1. Protected credential management and OAuth account onboarding, including explicit revocation and scope ownership.
2. MCP-enabled workflow steps: select through the assigned Agent, freeze capabilities per attempt, compile both provider adapters, capture structured tool evidence, and preserve gating/retry rules. Track this independently so the workflow exclusion cannot be mistaken for completed support.
3. Catalog browsing, package installation helpers, and live reconnect. No automatic installation, background checks, implicit enabling or silent restart is included here.

### Delivery receipt

Implementation `2a440ab` integrated into local main. 337 Node tests and all 34 browser suites passed (browser run resumed after correcting its PWA assertion and a test navigation wait). Live dialog inspected with zero API writes/page errors/390px overflow. Schema-2 migration preserved all policies/checks and its schema-1 byte backup; all 21 other live JSON files unchanged. No model inference, user workflow runs, remote code push or issue closure. OAuth, credential vault and workflow MCP remain follow-ons.
