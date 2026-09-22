# Mixed-provider workflows

Issue #5 follow-on authorized 2026-09-22: “it needs to support claude as well”. Continue the existing Agent assignment feature; reuse the shared provider selector and structured Codex/Claude adapters.

Persist `agent: codex|claude` per step and resolved run config, defaulting omitted legacy values to Codex. Discover and validate only providers required by a run before any step executes; never map an unsupported model or provider to another silently. Resolve Agents, defaults, skills and previews against each step's provider. Claude `default` effort is valid only for Claude. Freeze all provider/configuration snapshots for later steps/retries/restart; edits cannot switch a running step's provider.

Expose provider choice in both the inspector and Run settings using the shared three-pill selector. Switching provider refreshes its model/effort catalog and eligible Agents; incompatible saved Agent references stay visible and block launch. Bulk Codex model assignment affects Codex steps only. Show provider identity on live/recorded attempts. Preserve draft guards, missing-provider recovery, mobile and keyboard controls.

Mixed Codex → Claude → Codex steps share the existing isolated workspace and ownership; handoffs remain user/reference context. Keep gates, limits, cancellation, archives and no-auto-resume. Claude uses the current restricted adapter: read/search in read-only, plus edit/write in worktree; no shell or nested delegation. Both structured providers remain MCP-free. Do not execute user workflows or real inference for validation.

TT plan: `local:0C50D8BE-A29C-4190-B110-ECCBCB8DD76A`.

- [x] **WCP-01 — Persist per-step providers and execute mixed workflows.** Fixture tests prove Codex-Claude-Codex handoffs, one workspace, provider-bound profile snapshots, retries/restart/cancellation and invalid mappings fail before launch.
- [x] **WCP-02 — Enable provider choice in shared workflow selectors.** Browser tests prove provider/model/effort and eligible Agent switching in inspector/settings, saved choices, readable attempt provider identity and mobile layout.
- [ ] **WCP-03 — Validate and activate mixed-provider workflows.** Full regression suites pass, UI inspected, local state preserved, issue and validation evidence recorded; no real inference or remote push.
