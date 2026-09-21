# Sequential lead/worker delegation

Issue: https://github.com/shelbyklein/skd-workbench/issues/10

Workbench should carry one task through planning, implementation and review without manual chat handoffs. Begin with a Codex lead (select the discovered Astra model) and a Claude worker (select the discovered Fable model); also support a Codex worker. Model aliases are choices from live discovery, not hardcoded guarantees.

## Work preparation
Confirmed scope; solo sequential implementation now, authorized in the current task. Baseline: `28f66f26880a8f9b2a240929ab4e7192d3808de4`. Branch: `codex/sequential-delegation`. Plan: `instructions/2026-09-21-sequential-delegation.md`. TT plan: `local:C0E3799F-6F72-49E5-A5D0-4D3EF81EAD73`.

## Execution contract
- Persist immutable run/task identity, captured project/source, selected roles, attempt IDs and workspace association before inference. Reuse one retained isolated workspace for the task; never derive identity from version numbering.
- Lead plans; worker implements; lead reviews observed changes and executes checks. Review returns a validated accept/revise/ask decision. Revision and total-attempt budgets bound execution.
- Lead review and measured command results are separate evidence. Review identifies zero-based acceptance-command indices; referenced commands must exist and exit successfully. All other commands and failures remain visible. Process exit is never acceptance. Unknown provider usage remains unknown.
- Shared execution lock covers terminals, existing workflows and delegation. Duplicate launch requests recover the original run; stale actions fail.
- Cancellation prevents subsequent turns. Restart marks interrupted work and never resumes inference automatically. Explicit retry preserves history and workspace.
- Claude worker retains existing restricted file-tool permissions. Codex review may execute checks in its workspace sandbox; no host execution of generated shell text.
- No automatic merge, push, cleanup or release. No nested provider agents or parallel teams. Existing generic workflows remain compatible.
- Related #9 owns full worktree inventory/readiness/checkpoint lifecycle; this issue supplies only registration needed for managed delegation. #6 protocol-owned interactive sessions is separate.

## Implementation checklist
- [x] **DEL-01** Implement durable sequential delegation and task/workspace registration
  Acceptance: Fixture tests prove plan, worker, review, bounded revisions, retained workspace and restart interruption.
- [x] **DEL-02** Add mixed-provider dispatch and evidence-backed review decisions
  Acceptance: Codex and Claude fixture turns share one workspace; malformed decisions and unsupported selections fail visibly; command evidence remains distinct from model claims.
- [x] **DEL-03** Expose guarded delegation APIs and launch recovery
  Acceptance: API tests cover project scope, stale revisions, duplicate launch, cancellation and explicit retry.
- [x] **DEL-04** Add delegation setup, progress, review and evidence UI
  Acceptance: Browser checks exercise creation and results, keyboard access and mobile layout; screenshots inspected.
- [x] **DEL-05** Validate provider execution and full integration
  Acceptance: Full Node/browser suites pass; a bounded real-provider smoke records actual availability and execution separately from fixtures.
- [ ] **DEL-06** Document delivery and activate the verified development version
  Acceptance: README and VALIDATION reflect behavior and limitations; isolated changes integrated safely and running UI inspected, with issue left open for closure approval.

## Validation and activation
Use disposable Git repositories, temporary data stores and fixture providers for routine tests. Cover malformed decisions, failed commands, exhausted budgets, source changes, launch races, cancellation and restart. Exercise actual UI entry points on desktop/mobile and inspect screenshots. Run full Node and browser suites. Run one bounded real-provider smoke in a disposable repository if discovered provider availability permits; record blockers honestly. Inspect live execution before any server restart. Retain all workspaces and historical records; activation can roll back the code without deleting records.

<!-- skd-sequential-delegation-2026-09-21 -->

