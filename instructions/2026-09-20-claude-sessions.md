# Claude in Sessions

Confirmed request: implement Claude as another agent in Sessions. Solo, now. Add a Claude CLI adapter to the shared executor, preserving Codex and its existing workflow integration, execution lock, histories, worktrees, cancellation and benchmark reset. Use neutral session APIs with legacy Codex aliases. Add agent selection, provider-specific models and usage. Do not implement multi-turn continuation or Claude workflows in this slice.

SKD-CLAUDE-01: implement adapter and UI, validate stream result/error/cache/cost semantics, isolation and stop behavior with fake CLI tests; run existing regressions. Inspect installed CLI/login and actual browser UI without starting a paid run. Restart only with no active runs; preserve data/history. Commit after verification.

Claude is installed (2.1.278), but auth status reports loggedIn false. Require --restricted and --safe-mode support, disable customization/MCP/subagents; permit only Read/Glob/Grep and isolated Edit/Write tools, with no shell tool. Display limitations. Use CLI model aliases with access confirmed only on execution. Cost is the CLI estimate, not a bill. Sources: https://code.claude.com/docs/en/headless and https://code.claude.com/docs/en/cli-reference plus installed --help.

TT: local:355EEBAA-8EFF-4AB2-8567-E93AE3C8D322. Live inference validation remains unavailable until login; do not claim it passed. Session history persists in existing store without migration; old records default to Codex.

Completed: existing 44 Node tests, six Claude tests and all ten browser suites passed. Local activation preserved state/history with no executions. Live screenshot confirms Claude login required; real inference remains unverified. See VALIDATION.md and output/claude-activation-receipt.json.
