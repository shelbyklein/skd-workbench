# Agents: global and project specialization library

## Prompt for Claude

### Outcome

Add global and project **Agents** views to SKD Workbench. An Agent is a reusable specialization: name, description, agent system prompt, managed skills, supported CLI providers, and connection references. It replaces the user-facing Playbook concept and evolves its existing implementation. The user chooses an Agent such as Reviewer, Frontend Engineer, or Release Engineer, then selects a provider, model, effort and workspace for an explicitly started session.

Implementation authorized by the user on 2026-09-22: “add to issue and make the changes.” Published as the Agents phase of GitHub issue #5. Target `/Users/shelbyklein/Vibes/skd-workbench`. Read AGENTS.md and CLAUDE.md; preserve unrelated uncommitted changes, running sessions, user data and worktrees. Do not edit provider configuration, create extra worktrees unnecessarily, publish, or start real inference as part of planning.

### Current system: confirmed evidence

Evidence inspected at `db0f644` on 2026-09-22. Recheck locations and contracts before implementing; historical instructions describe earlier states.

| Source | Confirmed reusable behavior or gap |
| --- | --- |
| `lib/playbooks.js:18` | Playbooks owns `playbooks.json`, schema 1, library revision, stable entry IDs, versions, history, backups, CRUD, archive and project/provider defaults. Entries select skills/connections but have no specialization prompt. |
| `lib/playbooks.js:27` | Resource eligibility enforces global/project scope and supported providers. Global entries cannot include project resources. |
| `lib/playbooks.js:49` | Selection distinguishes inherit, selected and legacy; exact empty resource overrides are supported. |
| `lib/playbooks.js:58` | Preview resolves resources; launch verifies an expected signature. The signature currently covers playbook identity/version, skill versions and connection fingerprints, not a complete instruction stack. |
| `lib/playbooks.js:68` | Save-from-session derives a draft from frozen managed configuration, separates observed activity, and retains provenance without copying conversations/secrets. |
| `public/playbooks-ui.js:5`, `public/app.js:300` | Existing global/project library, editor, archive, duplicate, defaults and draft guards can be evolved rather than duplicated. |
| `server.js:107`, `server.js:150`, `server.js:183` | Playbook CRUD/preview and session-save APIs exist. `/api/agents/:provider` and `/api/terminal-agents/:provider` already mean provider discovery; do not repurpose these routes. |
| `lib/terminals.js:14`, `lib/terminals.js:49` | Interactive adapters resolve playbooks and managed resources; Codex accepts developer instructions and Claude accepts appended system instructions. Run context freezes what was delivered. |
| `lib/issue-work.js:102`, `lib/issue-work.js:130` | Issue review loads bounded Workbench/project instruction files and adds a review boundary. It passes an inherited playbook without the preview signature that a selected default requires: cover this integration gap when defaults become populated. |
| `lib/quick-actions.js:45` | Quick actions resolve playbooks, with mode-specific exclusion of MCP for suggestions/reconciliation. |
| `lib/workspace-tasks.js:87` | Continuation starts another interactive session in a verified existing workspace; preserve its ownership contract when adding Agent selection. |
| `lib/codex.js:77`, `lib/workflows.js:38`, `lib/delegations.js:47` | Structured standalone sessions have a playbook path, but workflow/delegation attempts do not select specializations. Workflow steps and delegation roles have their own configuration. |
| `lib/skills.js:99`, `lib/skills.js:110` | Managed skill text, exact selections, exclusions, 32 KiB delivery bounds and frozen-snapshot revocation checks already exist. |
| `lib/connections.js:98`, `lib/connections.js:100` | Redacted inventory and provider/mode restrictions exist. Configured is not verified available. Read-only/workflow/issue-proposal paths remain MCP-free. |
| `lib/settings.js:42` | System pages preview bounded instruction files; they are not a complete provider system-prompt inspector or editable prompt store. |

Read-only live inventory during planning returned zero saved playbooks/defaults, zero managed skills, and 33 connection records across Codex/Claude, 24 configured. These are observations, not migration assumptions or tool availability guarantees. No MCP checks or tool invocations were performed. `node --test tests/playbooks.test.js` passed all five existing tests using temporary data.

### Vocabulary and product decisions

Use **Agent** for specialization, **Provider** for Codex/Claude, **Model** and **Effort** for execution configuration, **Session** for a running conversation, and **Workflow** for ordered steps/gates. Relabel the provider pill in the shared selector and its accessible name without changing stored legacy `agent: 'codex'|'claude'` fields. Use `agentProfileID` in new references to avoid collision. Workflow `type: 'agent'` remains a step kind.

First-release assumptions:

- Agents replace Playbooks in navigation and launch controls. No separate mutable Agent-to-Playbook relationship or two competing libraries.
- Global Agents are reusable in all eligible projects; project Agents belong to one project. Global availability does not automatically assign defaults or launch anything.
- Models/effort remain session choices, as with existing playbooks. Provider support is part of Agent compatibility. Optional preferred models are a later feature.
- Existing project/provider defaults become Agent defaults. New projects have no automatically assigned specialization. “Project default” and explicit “No specialization” are distinct choices.
- There is no live inheritance between Agent profiles. “Copy to project” creates an independent profile with source ID/version provenance. Editing it does not change the global original.

### Ownership, schema and compatibility

Evolve the existing Playbooks store/service into the canonical Agent profile implementation. Retain the physical `playbooks.json` file for the first migration to avoid a cross-file rename transaction. Internally rename or wrap the service as AgentProfiles; all old/new routes call that same owner. Do not introduce a second authoritative `agents.json`.

Schema 2 adds `systemPrompt` to each profile and its historical version records. Retain stable IDs, entry versions, scope/projectID, name/description, providers, skillIDs, connectionIDs, archive state, timestamps and provenance. Proposed bounds: name 100 bytes, description 1,000 bytes, prompt 16 KiB UTF-8, existing resource-count limits. A new profile requires at least a prompt or a selected managed capability. Migrated empty playbooks remain valid and clearly editable. Empty prompt is a valid migrated value, not an invented specialization.

Before migration, write a byte-exact uniquely named schema-1 backup. Validate the entire candidate, atomically replace the single file, and publish new in-memory state only after successful persistence. Migration must be idempotent, tolerate restart between backup and replacement, and fail visibly on corrupt/unsupported data. Preserve IDs, defaults and existing references; migration alone must not grant permissions, bump profile versions as though the user edited them, or rewrite run/history files. Old binaries must not open the migrated store; document stopped-server backup restoration with reconciliation of later edits.

Existing playbook URLs become aliases to Agents. Preserve legacy API request/response field shapes through adapters; an old update must preserve the new prompt when that field is absent, not clear it. Reject requests that supply conflicting old/new selections. New APIs use `/api/agent-profiles`, not the occupied `/api/agents/:provider`. Saved legacy quick-action references resolve to the same profile ID. Historical `agentContext.playbook` remains readable without rewriting it; new runs record `agentContext.agentProfile` and exact delivered context. Do not store two independently mutable snapshots of the same profile.

Skills remain owned by skills.json. Connections remain provider-owned configuration plus existing redacted Workbench policies/checks. Agent profiles reference resource IDs and never copy credential/configuration blobs. Project defaults belong to the canonical profile store, not duplicate fields in project records. Form drafts and expanded cards are view state, not execution state.

### First useful slice and user journey

Deliver the library plus real specialization delivery through existing session/playbook surfaces. A renamed page alone is incomplete.

Home gets an Agents card; each project gets Agents in its sidebar and overview, replacing Playbooks. Global Agents supports scope/project filters; project Agents shows local profiles and applicable global profiles with visible scope labels. Global profiles edited from a project identify their shared impact; offer Copy to project for local customization. Prevent scope moves that invalidate defaults/resources; require explicit repair or copying instead of silently dropping references.

Create/edit includes name, description, Agent system prompt, supported providers, managed Skills and eligible Connections. Reuse existing resource inventory and shared controls. Scope/provider changes refresh eligible choices while retaining incompatible selections visibly until resolved. Show empty, loading, unavailable/retry, archived and stale-save states. Cancel and failed saves preserve the original and the user's draft. Archive blocks future selection and clears relevant defaults in the same transaction; never stops an active session.

Launch surfaces show Agent selector separately from Provider/Model/Effort, followed by effective configuration preview. Changing an Agent must not silently change workspace permissions, provider or model. Unsupported provider selections require a deliberate change. Selecting, previewing, saving or expanding anything never starts inference.

Integrate Sessions (including imported-chat startup), issue Review, issue planning/solo work, quick actions, and verified workspace continuation. Preserve their current prompts, confirmation boundaries, request deduplication and workspace behavior. Where a new Agent selector is added, default selection must be explicit and previewed. Confined issue-edit proposals remain specialization-free. Standalone structured session APIs must either deliver supported Agent context correctly or reject explicitly selected profiles with a clear error; never accept and ignore them.

### Canonical context preview and delivery

Introduce one server-owned context composer/resolver, shared by supported entry points. Reuse skill/connection validation and existing launch methods; do not create another execution engine.

Resolve explicit profile or project/provider default, then exact per-launch resource overrides, then existing provider/project/mode restrictions. “No specialization” bypasses the profile default while retaining explicitly documented legacy project policy; it does not mean all native configuration is disabled. Empty managed overrides remain empty.

Keep sections separate and attributed: Workbench instructions, project instruction files, Agent specialization, managed skills, and entry-point constraints. The Agent prompt describes expertise and working behavior; it cannot expand permissions or override the user's task. Review/planning/reconciliation boundaries remain enforced independently of profile text. Issue bodies, imported chats, workflow outputs and task text stay separate reference/user inputs, never promoted to system instructions. Native provider instructions may additionally apply; do not claim a universally complete effective prompt or guaranteed priority merely from concatenation order.

Centralize the existing bounded review instruction loader where applicable. Do not automatically inject every historical file in instructions/. Reuse source-boundary checks, identify each included file and deduplicate identical canonical files. Apply an explicit combined serialized instruction budget (proposed 96 KiB UTF-8, further bounded by provider argument/input limits); preserve the existing skill bound. Reject oversize content with the offending section named, without truncation.

Preview must bind profile ID/version/prompt digest, ordered skill IDs/versions, connection fingerprints, project identity/version, relevant policy revisions, provider, mode, purpose and instruction-section digests. Include exclusions and reasons. Recheck before spawn; changed state invalidates preview rather than silently substituting newer context. Request fingerprints include specialization and preview identity. Repair the current issue-review inherited-default/signature mismatch by using this contract, not by bypassing validation.

For MCP-free modes, show configured versus excluded connections. Require an explicit reviewed launch without those connections, preserving the saved Agent unchanged; do not silently enable tools or claim the whole profile was delivered. Checked Claude tools and managed Codex isolation continue through existing adapters. No refresh/preview auto-checks MCP or starts servers.

Persist exact profile version/prompt, included instruction sections, effective skills, redacted connection identities and exclusions in the launch record. Normal interactive startup remains prompt-free: use provider system/developer arguments, never synthesize a user turn or type invisible PTY input. Issue Review retains its explicit initial request. Editing profiles affects future starts only. Reconnect uses the existing process and snapshot. Retry retains frozen inputs while rechecking revocation/eligibility; it must not silently upgrade to the current profile version. Stop/restart behavior remains unchanged.

### Save as Agent

Evolve Save as playbook into Save as Agent for active and ended sessions. Seed only the frozen specialization prompt and reusable managed selections. Never copy composed Workbench/project instructions, issue text, task, conversation, output, secrets or worktree into the Agent prompt. Legacy sessions without a specialization snapshot get a blank prompt and an explicit missing-context notice, not a guessed prompt. Preserve configured-versus-observed distinctions; observed-only remains unavailable with incomplete PTY activity coverage. Saving creates a new versioned profile with provenance, does not mutate/restart the source session, and deduplicates a retried request using its payload identity.

### Ordered implementation tasks

- [x] **AG-01 — Contract and consumer audit.** Recheck evidence, enumerate every `playbook` read/write and terminal/structured launch call, and record a supported-entry-point matrix. Acceptance: each consumer is assigned migration, integration or explicit exclusion; provider/profile names are unambiguous.
- [x] **AG-02 — Canonical schema and compatibility.** Migrate the single store, extend prompt validation/history/duplicate/archive/defaults, add new API adapters and old-route aliases. Acceptance: populated legacy fixtures retain IDs, references and immutable history; stale writes and interrupted/corrupt migration fail safely.
- [x] **AG-03 — Shared preview, composition and adapters.** Implement attributed context, byte bounds, comprehensive signatures, frozen snapshots and native instruction delivery. Acceptance: both providers receive exactly the reviewed specialization through real fixture entry points; changed/revoked inputs block before spawn; MCP/permission constraints remain intact. Depends on AG-02.
- [x] **AG-04 — Global/project Agents UI.** Replace Playbooks navigation, implement prompt editor, scoped library/defaults and Copy to project; relabel Provider controls. Acceptance: create/edit/cancel/archive/default/legacy routes work with keyboard/mobile and draft guards. Depends on AG-02.
- [x] **AG-05 — Session consumers and Save as Agent.** Integrate all first-slice launch surfaces with preview and deduplication; update frozen-context display and safe session-derived drafts. Acceptance: each supported path delivers a profile or clearly rejects incompatibility; no silent omission or automatic launch. Depends on AG-03 and AG-04.
- [x] **AG-06 — Regression and delivery evidence.** Complete migration, API, fixture adapter and browser coverage; update docs/allowlist/cache. Acceptance: relevant/full suites pass and UI is inspected; evidence distinguishes fixtures, actual provider startup and real inference. Depends on all earlier tasks.

Tracked as AG-01 through AG-06 in TT plan `local:3C3AC2DB-B25E-4C64-B8DA-39AE9611FAB8`, associated with issue #5 by this delivery record. The original completed Playbooks plan remains unchanged: TT register_plan rejects appending IDs. Implementation is solo; no subagents were dispatched.

### Regression tests and verification

Use temporary stores/provider configurations and fixture executables. Cover nonempty legacy migration, backups/restarts, old/new mixed clients, old PUT preserving prompts, conflicts, duplicate request keys with changed payloads, archive/default transactions, project scope changes, same-name resources, Unicode byte bounds and missing/corrupt context.

Exercise actual HTTP launch entry points for both providers and every supported consumer. Assert system/developer argv contains the exact prompt once; normal sessions send no user turn. Cover selected/default/none, explicit empty skills/connections, policy exclusions, read-only review with an MCP-bearing Agent, stale preview/source files, revoked resources, and no prompt leakage into activity metadata. Verify request retry/reconnect never spawns twice, session edits do not rewrite snapshots, and existing workspace registration/cleanup/benchmark boundaries hold.

Browser journeys: Home → global Agents → create → project default → preview → fixture session → frozen context → Save as Agent. Also test issue Review, planning, quick actions and continuation; global-copy isolation; accessible labels distinguishing Agent from Provider; failed save/cancel; old routes; desktop/mobile/light/dark; PWA draft protection. Assert no execution on browsing or saving. Preserve existing workflow/delegation behavior and reject unsupported profile inputs explicitly.

Run focused profile/context tests and existing `tests/playbooks.test.js`, skills/connections, terminals, issue-work, quick-actions, workspace-tasks, workflows and delegation tests. Run affected browser suites (`resources-browser`, `playbooks-browser`, `agent-card-browser`, `terminal-browser`, `issue-actions-browser`, `planning-browser`, `quick-actions-browser`, `workspace-tasks-browser`, `pwa-browser`). Then run `npm test` and `npm run test:browser`. Update explicit server asset allowlist and bump the current shell cache when needed. Record evidence and remaining limits in VALIDATION.md. Real-provider smoke tests require separate authorization; fixture tests do not prove current external model access or tool invocation.

### Follow-ons and exclusions

Later: Agent references per workflow step and delegation role, optional model preferences, cross-project sharing/export, profile inheritance, Agent suggestions, and protocol-owned complete activity capture. Workflow/delegation adoption must freeze the selected profile at run start, preserve retry snapshots, and retain current provider restrictions; it is not a reason to broaden this first slice.

Excluded: a second playbook layer, persistent autonomous personalities/memory, background scheduling, automatic delegation, permissions stored in prompts, credential management, native skill installation, MCP access in prohibited modes, automatic model substitution, hot reload of active sessions, TT synchronization, and automatic worktree merge/deletion. No prepopulated Agent library or inferred default specialization without a deliberate product choice.

### Delivery receipt

Implemented and activated locally on 2026-09-22. Main includes the concurrent Graft work. All 319 Node tests and 31 Chrome suites passed; subsequent resource/PWA checks passed. Live migration and global/project Agents UI verified with no model inference, saved-workflow execution or UI API writes. See VALIDATION.md for backup and screenshots. Feature commits have not been pushed. Issue remains open for user acceptance.

Workflow assignment continuation authorized 2026-09-22; see `instructions/2026-09-22-workflow-agent-assignment.md`. The workflow exclusion above records the original library slice, not the subsequent implementation. Delegation-role assignment remains deferred.
