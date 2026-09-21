# Issue workflow step

Confirmed: Add Issue to the step picker; choose from the current project's GitHub
issues. At run start, fetch and freeze title, description, identity and source URL.
Each Issue step adds direction for all following agents alongside task and per-step
instructions. Multiple preceding issues accumulate; future issue steps do not affect
an earlier agent, including on retries. Issue steps perform no agent call or review.
GitHub remains read-only; comments and issue edits are excluded.

Evidence: domain validation accepts only agent/human/check; Workflows.prompt builds
agent input and advance treats all non-agent steps as manual gates. Existing GitHubIssues
provides project-scoped list and issue reads. Editor has stable IDs and reorder support.

Work preparation: scope confirmed by "do it". The later user request supersedes
solo execution with a prepared Sol/Terra/Luna orchestration handoff at
`instructions/2026-09-21-issue-step-orchestration.md`. Execution/dispatch has not
started. Partial backend edits are preserved, untested and not activated.
Issue: https://github.com/shelbyklein/skd-workbench/issues/3
Tracker plan: `5B228E3A-CC25-48A7-BE89-47D7C5AB9058`.

- [ ] ISSUE-STEP-01 Implement validated issue references and immutable run snapshots, sequential direction and simulation parity. Test scope, retries, missing/moved issues and failure before execution.
- [ ] ISSUE-STEP-02 Add paginated project issue selection, preview and step presentation. Test selection/save/reload, errors, desktop/mobile and keyboard.
- [ ] ISSUE-STEP-03 Run regression checks, inspect rendered UI, activate after checking active runs, and record evidence.

Activation: bump shell cache; restart local server only after confirming no active
execution. Preserve .data and historical runs. Rollback source only, retaining new
records and snapshots. Keep tracked issue open pending user acceptance.
