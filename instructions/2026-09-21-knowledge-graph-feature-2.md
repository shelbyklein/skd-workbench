# Knowledge Graph: Graft explorer and live orchestration

## Prompt for Claude

Status: revised feature plan following the user's explicit clarification, 2026-09-21. Planning only; no application implementation or dispatch authorized by this file.

This supersedes `2026-09-21-knowledge-graph-feature.md` in full and the curated-knowledge portions of `2026-09-21-global-resource-pages.md` and Track A of `2026-09-21-knowledge-graph-and-graft-handoff.md`. The older documents are retained as history. Do not implement their reference/memory library, collections, proposal acceptance, retrieval gates or knowledge injection. Skills and MCP remain separate features. Graft maintenance Track B remains applicable after verifying current installed behavior.

### Outcome: two connected functions

1. **Graft:** visualize what Graft has indexed for a project when that project has a connected, readable Graft index: architecture/context where present, code dependencies, files and symbols.
2. **Orchestration:** visualize a selected execution as it runs: how tasks, agents, dependencies, handoffs and reviews are progressing, and how those agents are interacting with project files.

Keep the Home card label **Knowledge Graph**. Its global page is a project/run chooser and overview, not a new global knowledge database. Each project opens the same feature scoped to its actual checkout, with **Graft** and **Orchestration** tabs. Inside Orchestration offer **Flow** and **Files** views of the same run and selection. A selected agent/task can highlight its observed file activity against Graft's code structure where available. Orchestration works without Graft; Graft enriches the file/dependency view.

Example: a coordinator assigns a task to a worker; the task becomes running; the worker reads a file and changes another; the Files view displays those observed actions and the relevant code dependencies; a human review pauses the task; a retry creates a distinct attempt. Clicking any state or edge opens its evidence. The screen never infers actions from animation or elapsed time.

### Confirmed current system

Inspection baseline: `/Users/shelbyklein/Vibes/skd-workbench`, `codex/github-issues`, HEAD `d7edd1d` with substantial pending unrelated work and an additional detached settings worktree. Recheck status/worktrees before implementing; preserve all changes. Read `AGENTS.md`, `README.md`, `VALIDATION.md`, `2026-09-21-issue-work-modes.md` and `2026-09-21-global-resource-pages-2.md`. Earlier receipts describe their time, not current acceptance.

**Graft data is already available locally.** Installed package is `@nanonets/graft@0.18.0`. The inspected `graft/.graph/wiring.json` is schema 1 and contains 467 nodes and 1,900 edges. These counts establish readable data only, not freshness. Node fields include `id`, `name`, `kind`, `path`, `span`, `signature`, `body_hash`, summary state and optional summary/crux. Edges expose `source`, `target`, `relation`, and confidence (`extracted`, `inferred`, or LSP variants).

Authoritative installed reference files:

- `node_modules/@nanonets/graft/dist/graph/types.d.ts:1`: code-graph schema and provenance.
- `node_modules/@nanonets/graft/dist/viz/serve.js:50`: existing viewer serves assembled context and `.graph/wiring.json`; its leading comments still mention older filenames, so use actual read paths.
- `node_modules/@nanonets/graft/dist/viz/assemble.d.ts`: context graph projection.
- `node_modules/@nanonets/graft/dist/cli.js:607`: `graft viz`, including export support.
- `node_modules/@nanonets/graft/README.md:491`: existing Context, Code and Outline views.
- `scripts/graft.mjs:6–13`: local wrapper fixes its working directory to Workbench and disables telemetry. It cannot be reused unchanged to select arbitrary project roots.

Graft's viewer provides useful behavior and data-model references. Its private viewer/assembler modules are not public package exports. Prefer a bounded, versioned adapter to existing index artifacts behind Workbench's server over blindly importing private modules or starting a viewer server per page. A separate upstream viewer link may be optional, but does not deliver integrated orchestration/file selection.

**Live execution data is partial.** `lib/workflows.js:43` freezes flow/run state; `advance`, `finished`, and `action` own sequential attempts, handoffs and review gates. `public/workflows-ui.js:20` already polls once per second. These can drive an honest sequential run graph.

`lib/issue-work.js:67` still returns `canStartOrchestration:false`; the multi-agent engine described in `2026-09-21-issue-work-modes.md` is not delivered. Keep that engine as the authoritative dependency. This visualization plan does not dispatch or independently reimplement it.

`lib/codex.js:101` retains only a 100-entry activity tail with abbreviated events. `lib/claude.js`'s `consumeClaude` records tool starts but currently loses correlation/result detail. `lib/terminals.js` retains PTY text and collects a final diff; this does not establish live file reads or trustworthy per-agent activity. Full real-time attribution needs structured runtime/tool events and workspace observations.

### Ownership and project connection

Graft owns indexed source structure and confidence. Workbench owns project-to-index bindings, validated display projections, runtime event evidence and UI state. The scheduler owns execution states and transitions. Do not create a separate mutable graph that claims to control execution.

A project Graft binding contains project ID/version, canonical source root, explicit index-directory location, adapter/schema version and optional observed index fingerprint. Discover standard locations read-only; connect only a validated candidate. An MCP configuration entry, installed package or another project's index is not proof this project is indexed. Allow a custom index directory through explicit selection and validate its relationship to the selected repository; do not follow arbitrary paths supplied to read endpoints.

Index availability and MCP availability are independent. A valid on-disk index can be visualized without launching MCP; a connected MCP with no readable index shows that limitation. Model-backed context may be absent while the deterministic code graph is valid. Display these states separately: not connected, index missing, readable/unchecked, current, stale, updating, unsupported and unreadable. Claim current only when actual freshness evidence matches the selected checkout/worktree.

The user can explicitly Refresh the displayed index. Page loading/refresh does not build an index, call a model, install packages, change provider settings or enable MCP. A future Rebuild index action is an explicit bounded tooling operation, independent from reads and using the correct project root. Do not run `--deep` automatically.

### Graft view requirements

- Code dependencies, file/symbol outline, and Graft context/architecture when available. Preserve original relationship names, direction and confidence rather than inventing semantic knowledge.
- Search file/symbol/name, filter relation/kind, inspect callers/dependencies, expand a bounded neighborhood, Fit, and a detail panel showing path/span, signature, index identity/freshness and supplied summaries. Source excerpts load separately through bounded, validated routes; never dump full `body_text` to populate the canvas.
- Start at folders/files and expand symbols on demand. Show counts and explicit subset/pagination information. The inspected graph already has 1,900 edges; do not apply the older plan's 1,000-edge assumption or draw everything as a circle.
- Use Cytoscape with Workbench's theme if retaining the handoff's renderer choice. Confirm the exact `3.34.3` artifact before installing; the version is a proposed pin, not a verified dependency in this planning pass. Reuse upstream Graft's interaction ideas and data, without copying private viewer code unnecessarily. Outline/list remains functional if canvas initialization fails.
- Namespace UI IDs by project, workspace/index snapshot, and original Graft ID. An edge lacking an upstream ID receives a deterministic source/target/relation/confidence identity. Keep original IDs for evidence/navigation. Never merge similarly named symbols across files or worktrees.
- Read each snapshot consistently with size bounds, schema validation and index-generation/fingerprint checks. A partial file during rebuild retains the last good graph with an updating/error marker; it must not become an empty successful result. Conflicting endpoints/dangling edges are reported with explicit omission counts.
- A single parent repository index may cover a project subfolder, but display that relationship and scope filters explicitly. Switching branches or roots invalidates cached projections; do not label old line spans current.

### Orchestration Flow view

Render the frozen task graph, actual coordinator/worker assignments, dependency edges and scheduler states. Each attempt has a distinct identity; the task view may summarize its latest attempt while details preserve previous attempts. Show queued, dependency-blocked, preparing, running, waiting for user/review, succeeded, failed, cancelled and interrupted only when supported by authoritative records. Process exit and accepted verification are separate facts.

Show actual handoff artifacts and review decisions; planned dependencies are visually distinct from a handoff that happened. Clicking a node opens task instructions, actual assigned provider/model if known, attempt status, available output and evidence. Reuse existing stop/retry/review APIs with their version checks; a graph click never launches work. A static plan preview is labeled **Plan**, fixture execution **Simulation**, and an observed running graph **Live** only while fresh events are received.

For current sequential workflows, show their real sequential topology without fabricating a coordinator or concurrent workers. Full coordinator/worker behavior depends on the existing orchestration-engine work; attach this feature's event contract to that implementation. Never remove its unavailable gate merely to demo the graph.

### Orchestration Files view

Show agents/attempts connected to actual workspace-qualified files, with a time filter and selectable activity such as read requested/read completed, search matched, edit requested/edit completed, created, deleted, renamed, or filesystem change observed. Search matches do not establish a full file read. Permission-denied/failed operations do not become successful file changes. A command merely containing a path is not sufficient attribution.

Use three evidence categories:

1. **Structured tool event:** provider/runner reports an operation, correlated tool-call identity and its result. This can support a specific agent action, with its actual result status.
2. **Workspace observation:** a watcher or Git comparison detects a changed path/content. It proves a workspace change; actor stays unknown unless independently attributable. It cannot prove reads.
3. **Agent report:** an agent says it worked on a file. Keep as reported activity and never silently promote it to observed evidence.

Display declared task file ownership separately from observed activity. Multiple workers touching the same logical path in isolated worktrees are not automatically a filesystem conflict. The UI can flag overlap with both workspaces visible; only verified collisions/integration failures receive a conflict status. Source checkout, worker worktrees and integration worktree stay distinct.

Overlay observed files on matching Graft nodes only when root/index snapshot and relative path agree. Unindexed/new files remain visible as file nodes with no inferred dependencies. Graft may be stale during edits: preserve the indexed structure, mark its age and show observed activity over it without inventing live dependency changes. No automatic full rebuild for every write.

Selecting a flow task filters/highlights its files; selecting a file shows touching attempts, ordered events, read/write result and bounded diff evidence. Provide Live follow, Pause view, and a scrub/replay control over retained history. Pausing/replaying changes only the display, never execution.

### Durable observation contract

Proposed `lib/run-events.js` receives server-owned scheduler/provider/workspace events; `lib/run-graph.js` derives projections. Adapt naming to the actual orchestration engine rather than creating parallel stores or ownership.

Event envelope: `schema`, `eventID`, per-run monotonic `sequence`, `projectID`, `runID`, `taskID`, `attemptID`, `agentInstanceID`, `workspaceID`, `source`, `kind`, source tool/event ID, optional occurred time, server observed time, operation phase/outcome, normalized relative file references and bounded evidence references. Optional/unknown fields remain absent; callers cannot invent agent/project identities. Never store raw secrets, environment dumps, unrestricted file contents or model hidden reasoning.

Normalize paths from structured data against the captured workspace, including worktree roots, Unicode/spaces, rename pairs and symlink boundaries. Known operations outside the project display an outside-scope diagnostic without exposing unrelated content. Reject unsafe file preview/diff traversal. Record the content/index version to which a symbol span refers.

Persist events before publishing them to viewers, with idempotent ingestion and bounded segmented storage. Integrate scheduler transitions with a durable event/outbox or reconstructable revision cursor so a crash cannot publish a completion absent from authoritative state. Do not dual-write two independent truths. Mark malformed/truncated history and observation gaps; never silently reset corrupt data. Retain available events for completed-run replay and archive them before benchmark cleanup. Define retention limits and explicit truncation markers; no unlimited raw-output log.

Use cursor-based read endpoints (proposed `GET /api/run-graphs/:runID` and `/events?after=<sequence>`) and bounded polling initially. Reuse Workbench's one-second polling pattern, with a fixture target of visible updates within two seconds of persisted events. SSE can be added if needed; replay/cursor semantics remain the same. Handle duplicate/out-of-order source events, reconnect, expired cursors and run restart without restarting execution. Browser navigation unsubscribes only its own viewer.

Expose coverage per run/provider: scheduler events, structured file operations, filesystem changes and gaps. Unsupported PTY sessions say file-action tracking unavailable; no animation or terminal-text parser may substitute. For orchestration workers, choose a structured provider channel or supported runner instrumentation that preserves native permission boundaries. Its working implementation is a prerequisite for claiming agent reads/writes live. Do not enable arbitrary hooks or weaken safe mode simply to obtain telemetry.

### Delivery sequence and acceptance

- [ ] **SKD-GRAPH-01 — Bind and read Graft.** Implement read-only project binding, artifact adapter, schema/freshness states and bounded APIs. Acceptance: the installed schema-1 fixture and actual selected index project correctly; context absence does not hide valid code data; unrelated roots and traversal are rejected; reads launch nothing.
- [ ] **SKD-GRAPH-02 — Graft explorer.** Add Code/Context/Outline browsing with search, neighborhood expansion, selection and details. Acceptance: original IDs/relations/confidence survive projection; keyboard/list access matches graph results; desktop/mobile renders inspected; a fixture at least as large as 467 nodes/1,900 edges works through bounded exploration without losing access to omitted data.
- [ ] **SKD-GRAPH-03 — Define and capture runtime evidence.** Add the canonical event adapter and persistence/recovery contract to existing workflow/provider paths and the orchestration-engine boundary. Acceptance: fixture tasks, handoffs, approvals, attempts and structured tool success/failure retain correct IDs; duplicate delivery creates no duplicate event; interrupted observation is explicit.
- [ ] **SKD-GRAPH-04 — Live Flow.** Build live task/agent/dependency views, current sequential-run compatibility and completed replay. Acceptance: states track actual persisted events; retry adds an attempt; pause/reconnect/reload do not submit execution; missing orchestration runtime stays unavailable.
- [ ] **SKD-GRAPH-05 — Live Files and Graft overlay.** Integrate structured read/edit events, bounded workspace observation and workspace-qualified file mapping. Acceptance: requested/failed/completed actions differ, external modifications remain unattributed, worktree overlaps are explained, unindexed files remain visible, and stale Graft spans are marked.
- [ ] **SKD-GRAPH-06 — Multi-agent integration acceptance.** Once the existing engine is available, exercise coordinator → two tracked workers → dependency/handoff → review/retry → integration using fixture providers and isolated worktrees. Acceptance: actual concurrency and attribution appear correctly; cancellation/restart retains evidence without resuming work. No full live-orchestration completion claim before this passes.
- [ ] **SKD-GRAPH-07 — Navigation, PWA and regressions.** Wire Home/project/run entry points, explicit asset allowlists and cache bump; verify no cached graph/event APIs or queued writes. Acceptance: full Node/browser suites pass with temporary stores, visual/keyboard/mobile/reduced-motion checks are inspected, and delivery evidence separates Graft reads, fixture telemetry and actual provider telemetry.

The first useful slice is GRAPH-01/02, followed by GRAPH-03/04 on the existing workflow runner. GRAPH-05/06 complete the user's live orchestration/file goal; do not mark them complete from a static graph, terminal tail, or final diff.

### Verification and edge cases

Add focused `tests/graft-view.test.js`, `tests/run-events.test.js`, `tests/run-graph.test.js` and `tests/graphs-browser.mjs`, registering the browser suite. Test real HTTP and adapter boundaries with temporary indexes/stores, fake providers, controlled file operations and disposable worktrees. Cover unknown schema, root mismatch, symlink escapes, partial rebuild, absent context graph, stale branch, duplicate symbol names, empty graphs, cross-project events, retry identities, output limits, delayed/duplicate events, disconnect/reconnect, replay, watcher changes without known actor, read denial, cancelled writes and integration conflicts.

Focused checks precede `npm test` and `npm run test:browser`. Preserve selected node/pan/zoom across event batches, provide graph/list equivalence and text status beyond color, disable decorative motion for reduced-motion preferences, cap visible nodes and virtualize long timelines. Destroy Cytoscape/ResizeObserver/watchers/subscriptions on scope disposal. No native provider inference during routine fixtures. Actual provider event capability and live-model file activity require separately authorized verification and honest coverage reporting.

Record material evidence in `VALIDATION.md` when implemented. This planning pass inspected installed Graft schemas/viewer code and existing runtime source, and parsed the current graph's metadata/counts. It did not launch the Graft viewer, rebuild indexes, start agents, run application tests, restart the server or inspect a new rendered UI.

### Exclusions and remaining integration decisions

No manually curated knowledge library, memory extraction, accepted/proposed knowledge workflow, retrieval injection, embeddings or document ingestion. No global merged cross-project code graph. No automatic source modifications, Graft enrichment, dispatch, merge, push or credential changes. Event views expose observable actions/status, not internal agent reasoning.

Before implementing telemetry, establish the actual supported structured event channels for each provider and freeze that contract with the orchestration engine owner. Before implementing context-graph parsing, choose a maintained public export or narrowly pinned local parser with fixture compatibility; private package APIs and arbitrary Markdown imports must not become unreviewed runtime code execution.
