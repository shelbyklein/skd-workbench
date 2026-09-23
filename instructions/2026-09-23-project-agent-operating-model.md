# Project agents and portfolio coordination

GitHub issue: https://github.com/shelbyklein/skd-workbench/issues/14

Design references: `docs/design/project-agents/2026-09-23/` on the issue's reference branch. The original overview is superseded by the caption-free revision; the project view is the latest proposal. Publication is authorized; application implementation remains pending.

## Prompt for Claude

### Outcome and status

Proposed methodology, not an approved implementation request. Give each project a durable accountable agent role, with one external coordinator handling user intent, priorities and reporting across projects. Workbench dashboards display the same authoritative execution records the agents use. The user sets outcomes and standing authority rather than manually operating every workflow.

Begin with one coordinator and one pilot project. A project owner is a persistent responsibility and context record, not a permanently running model process. Start fresh bounded executions when work is authorized; retain continuity through recorded decisions, task references and evidence. Do not create multiple autonomous agents just to represent this hierarchy.

### Current system and precise gap

Source inspection on 2026-09-23, local main at 44816c8, with unrelated dirty branding/settings/server/test files. No runtime or inference verification was performed for this proposal.

- README.md:119 describes versioned Agent specializations; these are reusable configuration, not autonomous project owners. Later documentation at README.md:406 and lib/workflows.js:contexts confirms workflow-step Agent support, superseding the earlier deferred-support statement.
- lib/controller-catalog.js:controllerTools exposes scoped project/workflow/Agent reads, preview/start/stop, operation recovery and workspace status. There are no issue reads, lifecycle evidence writes, merge/push tools or human-gate approval tools in this catalog.
- lib/controller-commands.js:preview/execute reuses canonical workflow services, captures context and records caller identity; durable request keys prevent duplicate accepted launches.
- lib/workflows.js:start and lib/codex.js:start enforce a shared executor. Multiple project identities do not imply concurrent execution. Workflow waiting states retain ownership.
- lib/workflows.js constructor and lib/controller-commands.js:recover preserve interrupted or uncertain state without automatic replay.
- README.md:386 describes lifecycle ownership, acceptance evidence and exact-commit reconciliation; preserve those services rather than adding a second task system.
- instructions/2026-09-20-development-lanes.md gives the issue board ownership of executable work. Scratchpad, suggestions and dashboards do not confer authorization.
- instructions/2026-09-22-workbench-control-mcp.md documents the existing external-controller architecture. Workbench-managed workers cannot recursively launch another run while holding its executor.

The missing piece is a durable project mandate and accountable handoff/reporting contract. A separate always-on scheduler, additional runtime, or second issue queue is unnecessary for the first slice. No Workbench controller tools were exposed in the planning session's available tool catalog; repository implementation is not proof of current client connection.

### Roles and ownership

- User: sets outcomes, priorities, operating authority and acceptance decisions reserved to the user.
- Coordinator: routes requests, orders already-authorized work, resolves cross-project dependencies, tracks capacity, and presents one consolidated report. It does not rewrite project decisions or independently expand scope.
- Project owner: maintains project context, selects eligible work within its mandate, executes or delegates bounded assignments, gathers evidence and reports blockers/results.
- Optional worker/reviewer: short-lived roles for concrete assignments; use only when authorized and useful. Project owner remains accountable.
- Workbench: owns durable project/task/workspace/run/evidence records and execution admission. Views derive status from these records.

GitHub retains issue definition and discussion; Tracker Trapper retains the execution checklist/progress required by repository guidance; Workbench retains execution/workspace/evidence records. Link stable IDs. Do not infer agreement between them or copy their mutable status into an independent backlog.

### First useful slice

User-confirmed UI direction: integrate the agent operating model into the existing individual project views. The generated overview establishes visual treatment, not an additional dashboard or navigation layer. Each existing Project Overview brings together its project agent conversation, current work, decisions and results, with direct links to the existing Issues, Workflows, Sessions and lifecycle evidence. Rework overlapping overview widgets instead of stacking duplicate panels above them. Keep standing instructions within the project's existing configuration flow.

Home summarizes those same project records and supports cross-project coordinator direction; opening a project scopes the conversation and work to that project. Preserve conversation identity and unsent drafts when switching projects, and make the active scope clear before sending. Existing detail views remain the authoritative places to inspect and act on work. Do not introduce an independent portfolio dashboard, competing task list or duplicate execution controls. Omit the mockup caption "One execution at a time."; the executor constraint remains an implementation invariant and should appear only when it explains an actual waiting state.

Persist one versioned project mandate referencing an eligible existing Agent profile and the existing project ID. Include objective, explicitly eligible issue/task references, priority order, permitted action classes, escalation conditions, attempt/runtime limits, report preferences, and an enabled/paused control. Configuration is off by default and never dispatches work when saved.

Use a proposed additive mandate store with atomic writes, revision checks and corruption visibility; settle its name after inspecting current store conventions. Keep profile identity, mandate version, controller grant and execution snapshot distinct. Assigning an owner does not grant permissions. Effective actions must satisfy user authorization, project mandate, controller capabilities, provider permissions and existing gates. Capture the exact mandate revision on each pilot execution without rewriting history.

For the pilot, the external coordinator also performs the logical project-owner role and starts a selected existing workflow through the established controller path. No new internal agent-spawning hierarchy. One explicitly authorized task runs to an evidence-backed report, then stops. The next task is selected deliberately; an unattended queue is a follow-on.

Report: task/outcome; changes and retained workspace; checks and their evidence; integration/deployment state; blocker or decision needed; recommended next action. Distinguish process completion, model assessment, verified checks, user acceptance and release. Recommendations are not automatically executable work.

### Ordered implementation todos

- [ ] PA-01: Verify current mandate-like records, Agent/profile semantics, controller catalog, lifecycle services and execution ownership; reconcile overlapping fields before choosing the additive schema. Preserve unrelated uncommitted changes and inspect worktrees. If implemented as an issue, register/retrieve Tracker Trapper state and use this session's own run.
- [ ] PA-02: Implement versioned project mandate persistence and validation with explicit project/profile references, disabled default and bounded inputs. Add scoped read/update commands through the existing application boundary; controller manage access alone must not authorize enlarging execution authority. Use an explicit user-controlled authority edit path.
- [ ] PA-03: Bind mandate revision and selected task reference to canonical preview/start and immutable run origin. Reject stale mandates, incompatible/archived profiles, tasks outside scope, disabled mandates and revoked grants before execution. Preserve durable request-key recovery and the shared lock. Keep user-started legacy workflows compatible.
- [ ] PA-04: Integrate project agent conversation, owner/mandate controls, current work, decisions and results into the existing Project Overview and configuration flow. Consolidate overlapping widgets; reuse existing run/evidence links and detail actions. Home summarizes the same records. No additional dashboard/navigation layer. Verify project switching preserves conversation identity, unsent drafts and correct send scope. Saving, opening a dashboard or reconnecting must start nothing. Preserve keyboard/mobile behavior and explicit PWA updates. Prototype the project view before finalizing the Home adaptation.
- [ ] PA-05: Exercise one end-to-end pilot with fixture execution and a connected real stdio controller against a temporary store. Verify successful authorized launch, bounded execution, observed checks/report links, and restart recovery without replay. Real-provider inference is a separate authorized pilot, not a fixture-test claim.

### Required behavior and edge cases

- Two claims for the same task cannot create competing pilot launches. Bind the claim to canonical operation/run IDs; on uncertainty inspect those IDs rather than acquiring a new claim and retrying.
- Dirty sources and external writers remain visible; retain canonical clean-source and workspace ownership checks. Different connected worktrees may share a repository.
- Editing/revoking a mandate blocks future launches. It does not silently terminate a running process; expose the existing explicit stop action and explain its scope.
- Restart leaves interrupted work inspectable; no automatic continuation, retry, merge, push, deployment, issue closure or cleanup.
- A busy executor or human/check gate produces an actionable waiting state, not a recursive child launch or lock bypass.
- Missing context or an unavailable source remains unknown. Task/issue text and retrieved content cannot enlarge authority.
- Reports cite canonical records and identify agent-reported assertions separately from observed checks. Unknown usage remains unknown; enforce attempt/runtime caps without invented dollar accounting.
- Existing human gates still require the human. The pilot does not expose control tools for gates or release actions.

### Regression tests and verification

Use real HTTP/controller entry points and temporary stores. Cover cross-project denial, stale mandate revision, default-off behavior, unsupported Agent, request response loss, duplicate requests, concurrent task claims, busy executor, restart, revocation, preserved historical snapshots and visibly corrupt stores. Confirm old workflows remain usable. Browser tests cover save without execution, pause, evidence links, draft preservation, keyboard and narrow viewport rendering.

Run affected suites while developing, then npm test and npm run test:browser for integration verification. Inspect rendered UI and bump public/sw.js for cached shell changes. Record evidence and limitations in VALIDATION.md. Do not restart a live server without inspecting active execution and preserving user state.

### Introduction and follow-ons

1. Pilot one project and one bounded task with one external coordinator. Establish the mandate and report format before adding unattended execution.
2. Give every active project an independent mandate and accountable owner role; schedule their runs sequentially through the existing executor.
3. Adapt existing Home to summarize project priorities and consolidated reports from those same records. Escalate meaningful completion, failure or decisions; avoid unchanged periodic noise or an additional portfolio view.
4. Only after successful pilots, separately design unattended eligible-work selection, event wakeups, enforceable budgets, independent review and recovery.
5. Introduce concurrent project execution only with a deliberate executor redesign covering repository identity, ownership, external writers and resource limits. Do not weaken the current lock incidentally.

Not in the first slice: always-on model processes, autonomous new-task creation, competing inboxes, nested spawning, broad administrative credentials, automatic human approval, release automation or replacing existing provider runtimes. The user may later grant standing authority for specific integration/release operations; each needs an explicit supported operation and evidence contract rather than a broad prompt promise.
