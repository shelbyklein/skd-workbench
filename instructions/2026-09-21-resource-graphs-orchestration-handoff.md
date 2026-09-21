# Global resources and live graphs: orchestration handoff

## Prompt for Claude

Work preparation: confirmed scope; orchestration handoff prepared; implementation and dispatch not started. The user asked to incorporate the investigation into a plan for orchestration. This document coordinates the implementation of the original global resource pages and the corrected graph functions. It does not authorize launching agents, model usage, publication, or live activation by itself. Named models are not assigned; roles below can be filled at dispatch without silently inheriting model choices from unrelated handoffs.

### 1. Product contract and precedence

Add **Knowledge Graph**, **Skills**, and **Connections (MCP)** cards above Projects on Home. Each has a global entry and a project-scoped page. Global Skills/MCP resources are available for explicit project assignment; availability alone grants nothing to an agent.

Knowledge Graph has exactly two functions:

1. **Graft explorer:** visualize a connected project's indexed files, symbols, code relationships and available context/architecture graph.
2. **Live orchestration:** visualize task/agent progress, dependencies, handoffs, reviews and retries; show how agents interact with project files, with Graft relationships as an optional overlay.

The orchestration tab has **Flow** and **Files** views sharing the selected run/task/attempt. Selecting a task highlights its observed file activity. Selecting a file shows agents/attempts, operation results and available change evidence. Pausing/replaying the view never pauses/restarts execution. Live tracking works without a Graft index.

Use these feature contracts, with this handoff controlling coordination and acceptance dependencies:

- [Revised global navigation](2026-09-21-global-resource-pages-2.md).
- [Graft and live orchestration graphs](2026-09-21-knowledge-graph-feature-2.md).
- [Global/project Skills](2026-09-21-skills-feature.md).
- [Global/project Connections](2026-09-21-connections-mcp-feature.md).
- [Existing issue orchestration engine contract](2026-09-21-issue-work-modes.md).

The graph revision supersedes the curated-knowledge plan and Track A's knowledge-record/retrieval scope in the earlier Graft handoff. Do not implement a reference/memory library, collections, proposed/accepted knowledge, automatic memory capture, embeddings or knowledge prompt injection. Ignore the older Skills plan's combined knowledge-plus-skills budget; only its actual skills budget and provider input bounds apply. MCP remains independent of graph visibility. Graft maintenance Track B stays separate from product delivery and is not permission to rebuild/enrich indexes during browsing.

### 2. Baseline, evidence and existing ownership

Repository: `/Users/shelbyklein/Vibes/skd-workbench`.
Remote verified: `https://github.com/shelbyklein/skd-workbench.git`.
Inspected branch: `codex/github-issues`.
Inspected HEAD: `d7edd1de5c0d69145218084669c4cdf5f13045f1`.

There are extensive pending changes in provider adapters, issue planning, shared agent cards, navigation, tests, README and validation. New feature plans are untracked. A detached settings-publication worktree also exists at `/private/tmp/skd-settings-push-8UxCut/checkout`; it belongs to another task. Do not use, clean, reset, stash or remove it. HEAD alone is not the implementation baseline: the integration owner must reconcile pending work and capture only the agreed prerequisite source into a reviewed baseline before creating task worktrees. Record its resulting hash; do not invent one now.

Confirmed source findings:

- `lib/issue-work.js:67` returns `canStartOrchestration:false`. A settings switch does not establish a running engine. Its current `graphIsExecutable` check at `:32` is not a full DAG scheduler validator; runtime acceptance must include indirect cycle detection.
- `lib/workflows.js` has a real sequential runner, immutable flow snapshots, attempts, gates and retries. Adapt its actual lifecycle for the first live graph without inventing concurrent agents.
- `lib/codex.js:101` stores an abbreviated 100-event tail. `lib/claude.js`'s `consumeClaude` loses tool-result correlation. `lib/terminals.js` stores PTY output and final diffs. None supplies complete live file attribution.
- Installed `@nanonets/graft` is 0.18.0; `dist/graph/types.d.ts` defines schema-1 nodes and typed/confidence-bearing edges. Its `dist/viz/serve.js` reads `.graph/wiring.json`, and upstream already offers Context/Code/Outline views. The graph investigation read 467 nodes / 1,900 edges; these are observed counts, not a freshness guarantee.
- `scripts/graft.mjs` fixes cwd to Workbench. It must not accidentally index/read Workbench when a different project is selected.
- Interactive Codex, structured Codex, interactive Claude and structured Claude have different inherited-settings/tool restrictions. Keep these differences visible; do not assume a saved skill or MCP selection is loaded.

Runtime tracking was read from the shared Tracker Trapper store during this preparation:

| Existing plan | Current recorded state |
| --- | --- |
| `local:11A36CE8-68E3-4E7A-856B-DF530C16ACBA`, revision 16 | Issue work/edit modes and plan-directed execution; local, no linked GitHub issue |
| `WORK-MODE-00` | Preparation completed |
| `WORK-MODE-01` | Provenance/settings completed with prior fixture evidence |
| `WORK-MODE-02` | Directed solo launch completed with prior fixture evidence |
| `WORK-MODE-03` | Bounded orchestration runtime pending |
| `WORK-MODE-04` | UI pending; partial solo/settings evidence exists |
| `WORK-MODE-05` | Integrated verification/activation pending |

These are persisted task states, not newly rerun test results. Reconcile fresh state before execution. Preserve the established runtime owner and stable IDs; do not register another task claiming to implement that same engine. Graph-specific telemetry and presentation have their own IDs below. No new GitHub issue or Tracker Trapper plan was created by this handoff. Do not claim these new todos are already registered.

### 3. Worktree and lane ownership

One integration owner controls shared files and serial integration. Use isolated `codex/` task worktrees from the reviewed prerequisite baseline. At most three child lanes run alongside the integration owner; reuse a freed slot for independent validation. No nested delegation is needed.

| Role | Exclusive implementation ownership | Responsibility |
| --- | --- | --- |
| **Integration / runtime liaison** | `server.js`, `public/app.js`, `public/index.html`, `public/style.css`, `public/sw.js`, package/lock files, README/VALIDATION; `lib/agent-context.js`, `lib/run-events.js`, provider/terminal/workflow/domain/issue-work integration; existing shared tests | Freeze contracts, wire routing/APIs, persist runtime evidence, integrate launch selections, coordinate with the existing runtime owner, review/merge/test |
| **Graph lane** | New `lib/graft-view.js`, `lib/run-graph.js`, `public/knowledge-ui.js`, `public/graphs.css`; `tests/graft-view.test.js`, `tests/run-graph.test.js`, `tests/graphs-browser.mjs` | Index adapter, pure run projection, Graft explorer, Flow/Files graph UI |
| **Skills lane** | New `lib/skills.js`, `public/skills-ui.js`, `public/skills.css`; `tests/skills.test.js`, `tests/skills-browser.mjs` | Bounded discovery, managed library, assignments and UI; resolver output for integration owner |
| **MCP lane** | New `lib/connections.js`, `public/connections-ui.js`, `public/connections.css`; `tests/connections.test.js`, `tests/connections-browser.mjs`, isolated MCP fixtures | Redacted inventory, project policy, explicit checks and provider-isolation spike recommendations |
| **Validation lane**, after a slot frees | New `tests/resource-graphs-integration.test.js`, `tests/resource-graphs-integration-browser.mjs` and uniquely named fixtures/evidence | Independent cross-feature acceptance; reports failures to implementation owners rather than editing their source |

The existing runtime owner retains `WORK-MODE-03`. Before anyone edits overlapping `lib/issue-work.js`, provider adapters or lease code, agree a serial ownership transfer or integrate the engine owner's commits first. No two lanes edit the same file concurrently. If a module already exists at dispatch, reconcile its owner before assigning it.

Graph/Skills/MCP lanes can use their own temporary harness to exercise public contracts; integration owner alone changes the shared server and application shell. Dependency requests return to that owner for a single package/lock update. Never hand-edit lockfiles in competing branches. One final owner bumps the current PWA cache after each accepted activation batch.

### 4. Contract freeze before parallel work

Record agreed schemas and fixture examples in a small source contract module or fixture document owned by integration. Keep validators authoritative on the server.

**Scope and identity:** global scope is explicit; `unassigned` is not global. Every run lookup verifies project ownership. Every file node carries workspace identity and normalized relative path. Each attempt and actual agent instance has a stable identity separate from its task. Graph UI IDs namespace these identities and the source index snapshot; names are labels, never identity.

**Mount contract:** each new page receives `host`, scoped route context, `api`, `notify`, guarded navigation and selection callbacks; returns `dispose`, `isDirty`, `isPending`. Selection updates must not remount the whole app. Global resource pages work with zero projects. Global graph is a project/run chooser; it is not a merged global code graph.

**Graph payload:** server returns `projectID`, captured workspace/index identity, snapshot fingerprint, freshness/coverage state, bounded nodes/edges, omitted counts, query cursor and diagnostics. Preserve Graft node IDs, relation and confidence. Context absence is independent of code-index absence. Fields containing source bodies are fetched only for an explicitly selected bounded detail.

**Run event:** versioned envelope with `eventID`, per-run sequence, `projectID`, `runID`, task/attempt/agent/workspace IDs, source event/tool-call ID, server observed time, optional source time, event kind, phase/outcome, normalized file references and bounded evidence references. Sources distinguish scheduler, provider tool, workspace observation and agent report. Persist before publishing; deduplicate repeated delivery. Scheduler state remains the authority; use an outbox/revision projection so status and event publication cannot disagree after a crash.

**Evidence semantics:** read requested is different from read completed; search match is different from file read; edit requested or denied is different from a successful write. A filesystem watcher proves a change, not its author or a read. A path in terminal output/command text is insufficient. Missing telemetry remains unknown. Do not collect hidden reasoning, raw secrets or unrestricted file bodies.

**Observation API:** bounded snapshot plus cursor-based events, initially polled about once per second. Fixture target: persisted events visible within two seconds. Duplicates, late events, reconnect and expired cursors cannot relaunch work or silently erase history. Live/Pause/Replay affect the display only. Snapshot/event APIs are network-only.

**Skills/MCP launch contract:** resolve server-side from project, purpose, provider and mode; persist selected versions/IDs and exclusion reasons. Skills are instructions, not permissions. Skill selection supports explicit empty override. MCP has native inherited mode versus verified Workbench selection; a toggle cannot claim isolation until actual provider behavior is proven. No graph context is injected. Issue proposals retain their restricted launch contract, and prompt-free sessions remain prompt-free.

### 5. Dependency-ordered implementation waves

#### Wave 0 — Integration owner reconciles and freezes

Read current repository guidance, linked plans, tracker revisions and active runs. Identify shared-file owners. Preserve pending work and establish the reviewed baseline. Freeze contracts/selectors with minimal fixture payloads; specify planned endpoint families in `server.js` without weakening Host/origin, path and size guards. Retain original feature todo IDs.

Coordinate the runtime dependency immediately. Confirm whether its owner is active and which commit/contract will satisfy the graph integration. Do not wait until graph UI completion to discover event channels cannot observe workers. If structured provider telemetry needs a new session transport, document that architecture fork before implementing it; terminal parsing is not an acceptable substitute.

#### Wave 1 — Independent feature foundations

- Graph: `SKD-GRAPH-01`, then `SKD-GRAPH-02` against real index fixtures and bounded projection APIs.
- Skills: `SKD-SKL-01`, `SKD-SKL-02`, then policy/resolver portions of `SKD-SKL-03`.
- MCP: `SKD-MCP-01`, `SKD-MCP-02`, `SKD-MCP-03`; investigate `SKD-MCP-04` in disposable config only.
- Integration owner: `SKD-RES2-01`, shared route/API composition and `SKD-GRAPH-03` event persistence with sequential workflow adapters.

Each lane returns a reviewed commit containing only its owned files, public contract assumptions and focused test evidence. UI harness/demo state must be explicitly fixture-only. Do not mount fake counts or simulated live execution in the product.

#### Wave 2 — Serial shared integration and supported delivery

Integrate Graft adapter/UI, Skills, then MCP foundations one commit set at a time. Run their focused API/browser tests after each integration; resolve semantic conflicts with the source owner. Rebase remaining task branches onto the accepted contracts only after coordinating their working state.

Complete `SKD-RES2-02/03` routing/mounts. Integration owner wires `SKD-SKL-04` into supported provider launch paths, with Skills lane evidence. Wire `SKD-MCP-05` only for provider/mode combinations that passed the `SKD-MCP-04` isolation gate. Do not broaden permissions to make a switch work. Unsupported modes retain actionable explanations and uncompleted delivery acceptance.

Graph lane builds `SKD-GRAPH-04` from actual sequential workflow events and retained history. Complete independent file-event normalization and `SKD-GRAPH-05` overlay behavior with structured fixture events and workspace observers. Reserve one freed child slot for the Validation lane. Simulation proves UI/event behavior only; it does not complete multi-agent runtime acceptance.

#### Wave 3 — Existing orchestration engine and live graphs meet

The engine owner completes `WORK-MODE-03` under its existing plan, preserving parent execution lease, isolated worker worktrees, dependency scheduling, bounded attempts/concurrency, serial integration and explicit stop/retry. Its validation must reject indirect dependency cycles and preserve immutable approved plan/source context. `WORK-MODE-04` owns its remaining native issue-work interface; graph views consume its run identity and link from it without duplicating ownership.

Integration owner joins the event adapter to actual parent/worker/gate/tool/workspace transitions. Provider adapters preserve tool IDs and results necessary for read/write attribution. If a provider has only PTY output, display the verified coverage and keep full file-action acceptance pending for that provider.

Complete `SKD-GRAPH-06`: actual fixture orchestration of coordinator and two workers, separate workspaces, accepted predecessor output, review/retry and integration; graph tracks actual states and observed file interactions. Do not enable `canStartOrchestration` based on graph readiness alone. That gate belongs to the engine's complete launch contract.

#### Wave 4 — Independent acceptance and delivery report

Complete `SKD-GRAPH-07`, `SKD-SKL-05`, `SKD-MCP-06`, `SKD-RES2-04` and the existing runtime plan's `WORK-MODE-05` only for their respective verified scopes. The same integrated test receipt may support multiple distinct acceptance checks, but each todo's evidence must say exactly what passed.

Run both full suites once final integration is stable. Inspect desktop/mobile screenshots and actual rendered interaction. Report source/test completion separately from local activation and real-provider telemetry. No automatic publication, GitHub closure or model usage follows test success.

### 6. Task mapping: retain original stable IDs

This is a coordination map, not a second competing completion checklist. Register/retrieve the existing feature IDs if/when execution is authorized and tracking is required. Do not create substitute IDs for the same acceptance.

| Todo | Completion owner | Depends on / acceptance |
| --- | --- | --- |
| `SKD-RES2-01` | Integration | Reconciled baseline; six global/project routes preserve scope and legacy behavior |
| `SKD-GRAPH-01` | Graph | Frozen schema; correct project index, bounded reads, schema/freshness/absent-context states |
| `SKD-GRAPH-02` | Graph | GRAPH-01; usable Graft graph/outline/search/details, original relations/confidence, inspected responsive UI |
| `SKD-SKL-01/02/03` | Skills | Frozen scope/assignment contract; safe inventory, persistent CRUD and explicit scoped selections |
| `SKD-MCP-01/02/03/04` | MCP | Safe inventory/policy/UI; actual selective-provider capability proven or explicit incompatibility reported |
| `SKD-GRAPH-03` | Integration | Durable normalized events; fixture transition/tool correlation and recovery tests |
| `SKD-GRAPH-04` | Graph | GRAPH-03; actual run topology/state, attempts, gates and replay, no invented concurrency |
| `SKD-GRAPH-05` | Graph | GRAPH-01/03; workspace-qualified file actions/overlay; integration owner supplies provider/observer adapters |
| `SKD-SKL-04` | Integration | SKL-03 and supported delivery mechanism; exact versioned instructions, no hidden initial user turn |
| `SKD-MCP-05` | Integration | MCP-04 supported modes; validated explicit launch/check, no secret leakage or permission expansion |
| `WORK-MODE-03/04` | Existing runtime owner | Existing tracker tasks; scheduler and its remaining native UI, no duplicated ownership |
| `SKD-GRAPH-06` | Integration | GRAPH-03/04/05 + WORK-MODE-03; real fixture workers and attributable lifecycle/file events |
| `SKD-RES2-02/03` | Integration | Completed mounts and services; resource/run navigation and independent global/project scopes |
| `SKD-GRAPH-07`, `SKD-RES2-04` | Integration | Independent evidence and full integrated Node/browser gates |
| `SKD-SKL-05` | Skills | SKL-04 plus independent assignment/delivery/removal browser evidence |
| `SKD-MCP-06` | MCP | MCP-05 plus exact supported-mode runtime/check/removal evidence |
| `WORK-MODE-05` | Existing runtime integration owner | Existing engine's own full acceptance/activation, not satisfied by graph tests alone |

### 7. Acceptance scenarios and commands

1. **Home and scopes:** all three cards precede Projects; global pages work with no projects; each project view and run link reloads correctly. Global Skills/MCP entries can be selected for project A without granting project B. Invalid run/project IDs never display another project's data.
2. **Graft:** connect a selected project's existing index; explore file/symbol dependencies; absent context graph does not hide valid code; stale/partial/unsupported indexes show accurate state. Refresh performs no build, provider launch or model call. At least the observed 467-node/1,900-edge scale is navigable through bounded expansion.
3. **Live flow:** fake executable workers actually run under the orchestrator's lease. Dependencies/gates hold execution. Two runnable tasks can run within the configured limit; a retry has a new attempt ID. Stop cancels children, releases the lease only after termination, and retains evidence. Reload/reconnect starts nothing.
4. **Files:** one completed read, one denied edit, one completed write, a new file, rename and an external workspace change. Show operation results correctly; leave the external actor unknown. Same path in two worktrees stays distinct; unindexed files remain visible; stale Graft structure is labeled.
5. **Recovery and replay:** duplicate source events deduplicate; late events retain source/observed times; missing history is explicit. A crash does not publish uncommitted completion, drop accepted records or resume workers. Completed graph replay uses retained events even after safe benchmark archival.
6. **Skills:** import text → select for project/step → exact fixture launch receives bounded frozen content → edit/remove affects the next launch only. Native/discovered packages are labeled independently; no scripts/assets or global provider files are changed.
7. **MCP:** no processes/contact on inventory; explicit supported selection yields only the chosen fixture tool catalog, preserves native approvals, and omits secrets from API/log/history/archive. Check discovers tools without invoking them. Unsupported combinations stay unavailable; read-only and issue-proposal restrictions remain.
8. **Actual interface:** desktop/mobile, keyboard-only list access, focus, dark/light/custom accents, reduced motion, preserved viewport during updates, disconnected server and explicit PWA update with a dirty skill/resource draft.

Focused commands after the corresponding files exist:

```sh
node --test tests/graft-view.test.js tests/run-events.test.js tests/run-graph.test.js
node --test tests/skills.test.js tests/connections.test.js
node --test tests/resource-graphs-integration.test.js
node tests/graphs-browser.mjs
node tests/skills-browser.mjs
node tests/connections-browser.mjs
node tests/resource-graphs-integration-browser.mjs
npm test
npm run test:browser
```

Integration owner supplies `tests/run-events.test.js`; runtime owner supplies the engine's public-entry-point tests under its established suite. Register all new browser suites in package scripts. Use temporary `FLOW_BENCH_DATA`, fixture provider binaries, disposable repositories/worktrees and controlled provider config. Never start a second server against the live store. Browser request interception alone is not protection against live execution through a service worker.

Source inspection and fixture subprocess tests do not prove real-provider file telemetry. Where actual CLI startup/catalog checks can run without inference, record them separately; live-model acceptance requires authorized scope and must report provider/version and actual actions observed. No benchmark/model-quality claim follows graph rendering.

### 8. Tracking, integration and activation

On authorized issue execution, use Tracker Trapper exactly as `AGENTS.md` requires: retrieve plan/stable IDs; start each session's own run; link only its verified JSONL and confirm watch status; start before work, complete immediately after acceptance, report milestones/at least five-minute activity, and finish with actual status. Never take over another active run. If MCP fails, inspect shared persisted state before CLI fallback. This handoff only read the existing local runtime plan.

Do not assume the broad work belongs to GitHub issue #3. That issue's original Issue-step scope is narrower. Before later registration, search/reconcile feature issues and existing local tracking; keep runtime ownership in its current plan. Record actual issue/plan IDs in an execution receipt when established, without implying this preparation created them.

Integrate lane commits serially in the integration worktree. Stop on semantic conflicts; ask the owner to resolve affected logic rather than overwriting pending source. Inspect migrations/backups and backward compatibility before activation. Keep normal worker worktrees for review; no automatic source checkout cleanup or merge into main.

Local activation, when authorized, belongs to the integration owner. Inspect all active terminal/workflow/orchestration states and retained gates first; preserve user drafts and data, take a private backup, and restart only the verified existing localhost service when safe. Verify backend/API and current cache version; installed PWA windows use explicit Update app. Inspect the running UI without launching new live work for screenshots. There is no implicit push, external hosting, production deployment or issue closure.

Rollback retains new observations/history. Do not restore an old store over new work or run an old reader against an unsupported new schema. Prefer disabling the new UI route/forward repair while preserving records; any source rollback needs tested data compatibility.

### 9. Required handoff and final report

Each lane returns baseline/worktree, commits and owned files, implemented behavior, exact focused commands/results, inspected screenshots where relevant, contract changes, limitations and dependencies. Test owners report failures rather than changing another lane's implementation.

Integration report distinguishes:

- Prepared versus implemented; committed/pushed versus local; activated versus awaiting update.
- Graft artifact reads/freshness versus actual MCP availability.
- Static plan, sequential workflow and multi-agent runtime verification.
- Scheduler state, structured tool evidence, unattributed workspace changes and agent reports.
- Fixture behavior, installed CLI startup and actual live-provider activity.
- Skills/MCP inventory, saved selection and verified delivery/availability.

Do not claim the user's orchestration goal complete until GRAPH-06 and the corresponding runtime acceptance pass. Partial milestones may be delivered truthfully while remaining todos stay pending.

This preparation added only this orchestration handoff. No application code, dependencies, trackers, runtime state or provider settings were modified; no agents were dispatched or application tests run.
