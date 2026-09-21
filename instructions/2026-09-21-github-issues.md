# GitHub issues with agent edit proposals

<!-- skd-github-issues-2026-09-21 -->

## Confirmed outcome and preparation

User confirmed implementation now: project Issues reads GitHub issues; explicitly
engage Codex or Claude with model and effort selection to propose title/body edits,
preview them, then explicitly apply. Solo execution; no orchestration requested.
Issue: https://github.com/shelbyklein/skd-workbench/issues/2
Tracker Trapper plan: 6C6A86F1-5A2F-4FEF-AE6E-A701DC147D2D.
Baseline: b7dfca6, branch codex/github-issues. Existing AGENTS.md/CLAUDE.md are
preserved from the preceding documentation task.

## Design

Use installed authenticated `gh` for explicit github.com repository reads and writes.
Resolve the current project Git remotes, preferring origin; reject ambiguous targets.
Offer open/closed/all filters, pagination, details and comments. No background sync
or execution. Missing CLI/auth/repository and provider failures remain visible.

Reuse the headless executor lifecycle, provider discovery, model/effort validation,
usage and cancellation. Draft agents run without tools in a dedicated local folder;
issue text is untrusted source material. Store proposal provenance and original issue
snapshot separately from project data. Only title/body are writable. Apply uses the
persisted proposal, refreshes the remote target, refuses changed originals, serializes
writes, and reads back GitHub. Never blindly retry an uncertain write.

## Checklist

- [x] SKD-GH-01: Implement repository-bound reads and durable agent proposals/apply.
  Acceptance: tests cover filters/pages, PR exclusion, provider choice/effort, no-write
  proposal generation, malformed output, stale targets, cancellation/restart, duplicate
  apply, remote drift, failure/uncertainty and verified title/body-only writes.
- [x] SKD-GH-02: Implement the Issues view and proposal review UI.
  Acceptance: browser exercise enters from Project Overview, reads/filter/pages issues,
  selects both providers/models/levels, previews and applies fixture edits, reconnects
  after reload, protects drafts, and passes mobile/keyboard/error checks with screenshots.
- [ ] SKD-GH-03: Validate and activate the integrated feature.
  Acceptance: full Node/browser suites pass, actual GitHub reads work, local runtime UI
  inspected without editing unrelated issues, documentation updated and delivery committed.
  Live paid inference and live issue mutation are reported separately from fixture proof.

## Boundaries and recovery

No issue creation/closure, label/assignee editing, task dispatch from imported issues,
or repository changes by the proposal agent. GitHub remains authoritative. Existing
sessions, workflows, PWA behavior and local records remain intact. New proposal history
uses its own JSON file; no existing schema migration. Preserve that file on rollback.
Restart only after confirming no active execution. Bump PWA shell version; no external
deployment. Keep implementation issue open for user acceptance.

References: https://cli.github.com/manual/gh_api and
https://docs.github.com/en/rest/issues/issues#update-an-issue.
