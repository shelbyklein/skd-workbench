# Agent control of SKD Workbench through MCP

## Prompt for Claude

### Outcome
Build a local MCP server that lets an external agent operate SKD Workbench through named, structured tools. An agent should inspect a project, create or update a saved workflow, preview its execution context, start an authorized run, inspect results and blockers, and stop its own run. Changes must appear in the same Workbench views and history as actions taken through the UI.

This plan was authorized for implementation and registered in Tracker Trapper on 2026-09-22; see the implementation record below. Preserve unrelated uncommitted changes and read AGENTS.md, README.md, VALIDATION.md and the relevant execution/resource instructions before implementation.

### Current system, confirmed at e797845 on 2026-09-22
- server.js:createServer owns one Store, CodexRuns, Workflows, Delegations, TerminalSessions and lifecycle services. Its HTTP handlers already connect these services to the UI. The existing application process is the authority for execution locks and live PTYs.
- server.js:158–167 exposes workflow listing, Agent preview, start and actions; lib/workflows.js:contexts verifies flow version and captures Agent context. lib/store.js:updateFlow rejects stale revisions.
- server.js:179–198 exposes interactive and structured sessions; lib/terminals.js:start respects the executor owner/active/starting/cleaning locks. Read-only and worktree modes have distinct permissions.
- lib/quick-actions.js:request/start and lib/delegations.js:start already demonstrate durable request-key/fingerprint recovery. Do not assume ordinary workflow/session start routes provide identical duplicate protection.
- server.js:255 onward exposes lifecycle criteria, evidence, reconciliation and retirement; these operations carry freshness and ownership checks that must remain canonical.
- Current Connections support is outbound: Workbench can assign other MCP servers to selected Agent launches. There is no corresponding inbound server for controlling Workbench.
- Existing structured workflow providers exclude MCP. Do not silently change that policy to install this controller inside every worker.
- Current loopback Host/Origin checks protect browser routes, but do not establish an agent's project/action grant. A declared client name is attribution, not authentication.

### Architecture and ownership
Use the official MCP SDK and start with stdio, allowing the host client to launch a lightweight bridge. Verify the current supported SDK version and Node/ESM imports before pinning the dependency. The bridge communicates with a dedicated authenticated loopback controller endpoint in the already-running Workbench process. It must not instantiate another Store or executor, directly edit .data, launch a second app server, use browser clicking, or offer a generic arbitrary HTTP proxy.

Extract only the relevant existing actions into a small shared application-command service where necessary. Both the existing HTTP UI and controller adapter must call the same validators and domain operations. Do not rewrite the whole server to introduce MCP.

Workbench owns: controller registrations, allowed project IDs and action groups, revocation/version state, immutable caller/action receipts, operation IDs and links to canonical domain records. MCP connection IDs and sessions do not own workflow or process lifetime. Source context, worktree registration, provider selection, Agent specialization, MCP exclusions and review gates remain owned by existing services.

A local Controller settings section should let the user enable access, select project scope and choose read/manage/run capabilities once. The agent then works within that grant without requiring a new approval prompt for every ordinary tool call. Provide revoke and clear last-used/error states. Credentials stay in protected local configuration, never tool outputs, URLs, UI logs or Git. Verify grants inside Workbench on every request, not just inside the bridge. Disclose that a same-account coding agent with unrestricted local filesystem/shell access is not sandboxed by this application-level grant.

### First end-to-end slice
Initial clients are external Codex/Claude sessions. Default setup grants inspection and workflow management for explicitly chosen projects; execution is a separate opt-in capability. Installation is explicit, not automatic alteration of native provider configuration.

Proposed tools (names can be consistently prefixed):
- get_workbench_status: availability, version, supported capabilities and current execution ownership, with actionable blocked state.
- list_projects / get_project: scoped project identity, versions and relevant configuration.
- list_workflows / get_workflow / create_workflow / update_workflow: canonical saved flow objects; writes require expected revisions and create request keys.
- list_agents: redacted eligible specialization summaries, provider compatibility and versions; fetching full prompt text must be deliberate and scoped.
- preview_run / start_run: preview captured sources/Agent configuration/exclusions and expected revisions; start returns a durable operation and run ID rather than waiting for completion.
- get_operation / get_run / list_runs: recover request outcomes and inspect bounded output, step state, blockers, known/unknown usage and evidence. Cursor pagination for large results.
- stop_run: stop a run started by the controller, subject to current canonical lifecycle checks and grant.
- get_workspace_status: read-only registered-worktree health and evidence. No new independent worktree inventory.

Expose workflow task, configuration and Agent selection through canonical schemas. An example user outcome is: “Create a review workflow for project X, assign the selected Agents, run it, and tell me which step needs me.” Resolving any actual human review gate remains with the human in the first version.

### Ordered implementation chunks
- [x] WB-MCP-01 — Define the tool catalog and shared command boundary. Map each tool to existing services, inputs, outputs, expected revisions and effects. Verify no duplicated state stores or changed UI execution semantics. Deliver catalog tests with unknown/invalid tool rejection.
- [x] WB-MCP-02 — Add controller identity, project/action grants and lifecycle. Implement explicit local setup/revoke, protected credentials and per-request checks. Test disabled, revoked, stale and cross-project access, redaction and controller impersonation. Restart restores configured grants but starts no execution.
- [x] WB-MCP-03 — Implement SDK stdio and inspection tools. Test initialize/tools-list/tool calls through a real subprocess against a temporary Workbench server. stdout carries protocol messages only; stderr diagnostics are bounded and redacted. A stopped Workbench returns an actionable unavailable error and is not auto-started.
- [x] WB-MCP-04 — Implement workflow management and durable execution requests. Reuse canonical revisioned mutations and previews. Persist operation intent and bind its ID to the canonical run before spawning; duplicates with identical request/fingerprint recover the same outcome, changed payload conflicts. Close the crash window between the command journal and run creation: reconcile by durable origin ID, never blindly retry launch. Test response loss, concurrent retries, restart, stale preview, changed Agent definition, lock contention and explicit stop.
- [x] WB-MCP-05 — Add setup/status/activity UI and end-to-end evidence. Supply client configuration examples, scoped setup, visible controller attribution and run links, revoke and errors. Use fixture providers to prove changes appear in existing views and worktree registration/history remains correct. Check desktop/mobile/keyboard and cache version. Run npm test and npm run test:browser. Document protocol, runtime, inference and deployment evidence separately in VALIDATION.md.

### Required behavior and edge cases
- Disconnecting an MCP client never means cancel, restart, merge or retire. Reconnection never replays a mutation automatically.
- Treat imported issue text, tool output and terminal tails as untrusted task data, not instructions that expand grants.
- Identity is server-authenticated. Model-supplied caller/session labels are descriptive only.
- Revisions and preview fingerprints are checked at the canonical action boundary. Return structured stale/conflict errors and the relevant IDs without silently overwriting newer changes.
- Preserve all current execution ownership restrictions. External controllers may launch only when the existing executor permits it. For a controller invoked from an existing Workbench-managed run, reject reentrant spawning with a clear explanation; do not release the parent's lock or recursively attach controller credentials to workers.
- Native CLI permissions and existing human review gates remain intact. An Agent specialization cannot enlarge the controller grant or silently drop required MCP resources.
- Async start returns accepted/preparing, not success/completion. Agent-reported success and process exit are not review or test acceptance.
- MCP protocol cancellation cancels a pending read/preview only when safe; once launch may have occurred, return operation state and use explicit stop. Retain uncertain outcomes for inspection.
- All response payloads, input lengths, pagination and pending requests have limits. Redact connection credentials and explicitly distinguish bounded terminal tails from complete transcripts.
- Controller-local logs are not a second task tracker. Link operation/run/issue IDs to existing Workbench records and use Tracker Trapper when implementing a filed issue.

### Verification and rollout
Use temporary stores, real MCP stdio subprocesses, local fixture providers and actual HTTP service entry points. Tests must demonstrate both granted success and denial outside the grant, no second server/store, duplicate-safe launch, surviving client disconnect, unchanged human gates and no recursive execution. Add a browser test for setup, revoke and visible controller attribution. No paid inference is needed for routine tests.

Before local activation inspect active execution and preserve sessions. Back up any new schema before migration; corrupt records fail visibly. Document how to disable controller access without affecting existing records. Keep remote code publication and issue closure separate from implementation validation.

### Follow-ons and exclusions
Later slices may add delegation authoring, lifecycle evidence submission, a scoped send_session_input tool for controller-owned sessions, remote Streamable HTTP access, notifications, or tightly bounded child-agent orchestration. First version excludes arbitrary shell execution through MCP, raw filesystem access, credential editing, automatic merge/push/retirement, approving human gates, global unlimited grants and remotely exposed endpoints.

### Open product decisions
The recommended first slice uses external local controllers and explicit project/action grants. If the intended primary user is an agent already executing inside Workbench, revisit parent/child execution ownership before enabling nested launches. Remote clients and direct terminal control require separate scoped decisions; do not treat tool discovery as permission to add them.

### Protocol sources
- https://modelcontextprotocol.io/specification/2025-06-18/basic/transports — stdio and Streamable HTTP transport contracts; verify supported revision at implementation time.
- https://github.com/modelcontextprotocol/typescript-sdk — official SDK; verify stable release/import paths at implementation time.

### Authorized implementation — 2026-09-22

User authorized implementation and TT tracking after the planning pass.
TT local plan: `local:4D08A9B0-6388-4E4B-9EC8-F26D566EF603`.
Run: `690305A4-4A38-4461-9492-D3428D875107`.

Implementation uses `lib/controller-catalog.js` for strict tool contracts,
`lib/controllers.js` for grants/receipts, `lib/controller-commands.js` for the
canonical service adapter, and `scripts/workbench-mcp.mjs` for official SDK
1.30.0 stdio transport. The server checks credentials and grants per request.
The bridge contains no Store or executor. Saved flows and workflow runs receive
trusted operation origin metadata through separate internal options; caller
arguments cannot supply that identity. The Settings panel exposes enable/revoke,
scopes, private-file client configuration, activity and operation/run links.

| Tools | Canonical service | Effect and freshness |
| --- | --- | --- |
| status/projects | Store project snapshots; executor state | Scoped read |
| list/get workflows | Store flow snapshots | Scoped read; returns version |
| create/update workflow | Store createFlow/updateFlow | Request key, update version; atomic origin receipt |
| list_agents | AgentProfiles inventory | Redacted project/global summaries |
| preview/start | Workflows preview/start | Project/flow versions; stable context/source fingerprint; durable origin before queue |
| get/list run | Workflows get/list | Paginated attempt output; unknown usage explicit |
| stop_run | Workflows action(stop) | Own controller origin, revision and request key |
| get_operation | Controller journal | Own controller/project only; never replays intent |
| workspace status | LifecycleService read | Current registered project records; bounded pagination |

On restart, an unfinished operation is reconciled against canonical Store
receipts and workflow origins. A request without a proven outcome becomes
`uncertain`, including an intent that might not yet have mutated anything; it is
never automatically retried. This conservative outcome closes the duplicate
launch window without pretending an interrupted request certainly failed.
Activity is capped at 1,000 receipts; operations are retained up to 10,000 and
then further writes fail explicitly. Client/server concurrency and byte/page
limits bound requests. Credentials are not installed in worker configurations.

Implementation validation: 351 Node tests and all 37 Chrome suites passed (the new controller suite passed its targeted rerun after a test-only collapsed-card fix). See VALIDATION.md for exact evidence and limits.
