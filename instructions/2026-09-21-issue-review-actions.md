# Issue review actions

Issue detail offers two primary actions without requiring an approved work plan:

1. **Review with an agent** uses the shared agent/model/effort selector and optional
   review direction. Start review explicitly launches a read-only Codex or Claude
   terminal beside the issue. Hide keeps the session alive; Open review reconnects
   to its existing terminal, including after page reload. Existing plan creation
   and work execution remain separate controls.
2. **Add to a workflow** lists workflows from the current project with at least one
   agent step, fewer than 30 steps, and no duplicate input for this issue. It opens
   the chosen flow with an unsaved issue step prepended. It does not launch a run,
   save the flow, change its saved task, or change provider settings. Normal stale
   version checks apply on Save. Issue source is captured by the existing workflow
   input machinery when the user explicitly runs the workflow.

Review launches persist a request identity, issue snapshot, selected settings,
project version, and system instructions in issue-work.json. Concurrent retries of
one request share the same record. A failed/interrupted request is not replayed on
restart. Review source and project version are rechecked immediately before launch.

Trusted server context includes the current Workbench and project root SYSTEM.md,
system.md, system-prompt.md and provider-relevant AGENTS/CLAUDE files. Instruction
previews under instructions/ are historical/reference material and are not all
injected as system instructions. Files must be readable and the combined context
must fit 64,000 characters; failures are explicit, without silent truncation.
Project playbook and skills use the existing resolver. Combined skills and review
instructions use native Codex developer_instructions or Claude append-system-prompt.
Issue source is separate untrusted JSON input. Issue discussion is not included and
this limitation is visible before launch. Read-only sessions remain MCP-free.

The existing benchmark policy still requires isolated execution: this read-only
review path cannot launch from a benchmark project. It must not weaken that policy,
create an implicit worktree, or run saved benchmark workflows.

Verification uses temporary stores, fixture GitHub and fixture CLI processes.
No real model inference or user workflow execution is part of routine checks.
