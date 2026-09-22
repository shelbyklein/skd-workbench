# Workflow Agent assignment

Continuation of GitHub issue #5, authorized 2026-09-22: “continue with agent assignment within workflows”.

Use the existing Agent library and structured Codex workflow executor. Save a per-step `agentProfile` selection (selected ID, project default, or no specialization). Existing flows retain no-specialization behavior until explicitly changed. Models/effort remain separate; no new provider support or delegation-role assignment in this phase.

Run settings and the step inspector expose eligible global/project Agents. Missing or incompatible saved references remain visible and block launch; moving a flow never silently remaps its Agent. Skills default to the Agent set when selected; explicit step replacement overrides that set (including empty). Project denials still win. Workflow connections stay excluded, with explicit confirmation at reviewed launch.

Resolve every step before starting any model. Freeze exact Agent versions, prompt/instruction sections and managed skill text for all steps at run start. Signatures bind reviewed project/mode/purpose/resource context; changed previews block. Edits affect future runs only. Retries/review loops use the same frozen context, including after restart, while current archive/scope/provider/skill revocation blocks before process spawn. Retain old histories and existing worktree ownership, limits and manual gates. No saved workflow or real-provider execution during validation.

TT plan: `local:0D533F04-AC51-465A-B450-6B327B4F90E1` (separate continuation; original completed todos preserved).

- [x] **AGW-01 — Persist and resolve per-step Agent assignments with frozen run context.** Domain/API tests prove selected/default/none, scope and drift guards, frozen retries and MCP exclusions without widening execution permissions.
- [x] **AGW-02 — Add workflow Agent selection and reviewed launch context.** Browser fixtures prove saved selections, preview, cancellation, explicit exclusion confirmation and frozen details on desktop/mobile.
- [x] **AGW-03 — Validate, integrate and document workflow Agent delivery.** Full Node/browser suites pass; rendered UI inspected; issue and local validation evidence updated without real inference.

## Delivery

Implemented at `5ae89e4`, integrated into local main and activated in the idle local app on 2026-09-22. All 326 Node tests and 32 browser suites passed. Actual fixture CLI delivery and live read-only UI verified; 22 live JSON stores kept identical hashes. No real inference, user workflow execution, remote code push or issue closure. See VALIDATION.md for evidence. Use Update app for cached clients.
