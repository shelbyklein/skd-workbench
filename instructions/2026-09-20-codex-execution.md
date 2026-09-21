# Codex execution — first real provider

Authorized solo implementation now, following the user's choice to start with Codex. Repository: /Users/shelbyklein/Vibes/skd-workbench; baseline 0ae9b69. Local tracking (no remote configured): local:746CE59D-A26D-4718-8364-1F4CAFF0A9BE.

Deliver one real task per run using the signed-in installed Codex CLI. Discover models/efforts using app-server model/list. Choose a connected project and read-only or isolated-worktree coding mode. Capture actual output, reported token categories, wall duration, final status and code provenance; unknown usage/cost remain unknown. Preserve simulation flows and existing data. No automatic multi-step execution, additional provider, merge, push or pricing estimate in this increment.

- [x] TT-CODEX-01: Persistent execution adapter. Acceptance: discovery, input validation, safe argv/stdin invocation, bounded stream, cancellation, failure/restart interruption, isolated Git changes and durable records tested.
- [x] TT-CODEX-02: UI. Acceptance: project-scoped Run Codex entry, model/effort/task/mode controls, live status/output/usage, cancellation, rerun and historical records exercised in Chrome. Existing flow previews remain explicit.
- [x] TT-CODEX-03: Validate and activate. Acceptance: a small real installed-CLI run via the HTTP integration, existing regressions, inspected running screenshot, source commit, refreshed PWA and local server.

Runtime: codex-cli 0.155.1, ChatGPT login verified. Non-interactive exec --json emits thread.started, item.completed, turn.completed usage, and errors. Use explicit sandbox, never bypass approvals/sandbox. Ignore user config/rules for execution to avoid inheriting unrelated MCP integrations; reuse CLI auth without exposing credentials. Model catalog is provider-advertised, not proof of entitlement until execution succeeds. Runtime limit 10 minutes, output cap; only one active task at a time. No hard token budget claimed because completion usage arrives after spend. Recovery marks interrupted runs and never silently relaunches them. Worktrees retained for review; no automatic deletion or merging. Dirty source rejected for coding so starting commit is reproducible; read-only records dirty status.

Official reference: https://learn.chatgpt.com/docs/non-interactive-mode (JSONL usage, saved login, sandbox flags). Installed CLI help/model-list are authoritative for this installed version. Tests use temporary stores, repos and fake processes; real smoke test is a small task in a fixture repository.

Delivery evidence: VALIDATION.md. Real read-only and worktree coding checks succeeded through the app with reported usage and original checkout preservation. Live server activated at port 4390; existing store preserved. Multi-step flow execution remains the next increment.
