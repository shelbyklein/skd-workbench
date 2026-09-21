# Global resource navigation — individual orchestration plan

## Prompt for Claude

### Orchestration preparation and integration rules

This is an individual, standalone plan split from the combined resource/graph handoff. It is the active execution entry for this feature; the combined handoff remains historical coordination context. Planning is complete, but no implementation, dispatch, provider usage, issue publication or server activation is authorized by saving this document. No specific model has been selected for its roles.

Before execution, read AGENTS.md, README.md and VALIDATION.md; inspect current Git status, branches/worktrees, active runs and source drift. The previous inspected baseline was `codex/github-issues` at `d7edd1de5c0d69145218084669c4cdf5f13045f1` with substantial pending work. Establish a reviewed prerequisite baseline before creating isolated codex/ task worktrees; preserve unrelated dirty work and the other task's detached publication checkout. Never reset, stash, overwrite or take over another task's unfinished work.

Assign one integration owner. Freeze server payloads, mount lifecycle (`dispose`, `isDirty`, `isPending`), scope/identity and test fixtures before parallel edits. Workers own only assigned files. Shared server.js, app.js, style.css, package/lockfiles, public/index.html, public/sw.js, existing provider adapters and shared tests require explicit exclusive ownership and serial integration. Other feature plans may be active: coordinate rather than independently claiming those files. At most three child lanes may run alongside the integration owner across the whole implementation; a validation lane can replace a completed worker.

On authorized tracked execution, retrieve/register this feature's exact checklist and stable IDs without duplicating prior plans. Follow repository Tracker Trapper rules: each session's own run and verified JSONL watcher, task start before work, completion immediately after acceptance, periodic activity and honest finish status. This preparation created no tracker records or GitHub issues. Existing runtime dependency IDs are references, not grants to take over their owners.

Run focused temporary-store/fixture checks before the relevant full suites. Inspect actual rendered UI for visual changes. Keep APIs network-only and updates explicit; cache changes preserve unsaved drafts. A later authorized local activation must inspect active execution and protect data before restart. Rollback preserves new records and requires schema compatibility. No implicit merge to main, push, deployment, real inference or automatic issue closure.

Each worker returns its baseline/worktree, scoped commits/files, exact test evidence, inspected screenshots where relevant, limitations and dependencies. The integration owner reports implemented/tested/activated and fixture/actual-provider evidence separately. Do not mark dependent todos complete from placeholders or old test receipts.

### Feature-specific orchestration

Own Home cards, global/project routes, breadcrumbs, lifecycle guards and final shell integration. Feature modules belong to their individual plans; this plan does not implement their services.

| Role | Owned work |
| --- | --- |
| Integration owner | Shared server/public allowlists, package/lock changes, PWA cache, README/VALIDATION and serial integration |
| Navigation worker | `public/app.js` routing/cards/breadcrumbs and scoped `public/style.css` changes, by explicit exclusive assignment |
| Validation worker | Navigation-specific tests and independent browser acceptance; report source failures to their owner |

Sequence: reconcile baseline → freeze scope/routes/mount contract → navigation worker implements while validation worker prepares fixtures → integrate real feature mounts as each becomes available → verify all routes and shell updates. Integration owner must not concurrently edit app.js/style.css while assigned to Navigation. Other feature owners submit required wiring changes through this owner.

Dependencies: route foundations can proceed first. Final RES2-02/03/04 acceptance depends on the actual graph, Skills and MCP mounts; a placeholder does not complete a feature. Track separate service completion in the other plans. Preserve `SKD-RES2-01` through `SKD-RES2-04`.

Run affected overview/project/sidebar/PWA browser suites, then both full suites after final cross-feature integration. Inspect desktop/mobile navigation and dirty-draft update behavior.

### Full feature contract and acceptance checklist

Status: scope correction, 2026-09-21; instructions only. Read this before the original `2026-09-21-global-resource-pages.md`. Preserve earlier plans as history and all unrelated working changes. This file supersedes the original's knowledge ownership, retrieval and launch-context requirements; its ordinary routing/accessibility/PWA safeguards still apply where compatible.

### Outcome

Home has three cards above Projects: **Knowledge Graph**, **Skills**, and **Connections (MCP)**. Each has a global entry and project-scoped pages. Knowledge Graph has the two functions specified by the user:

1. Show Graft's graph for a project if connected.
2. Show orchestration live, including execution progress and how agents work with project files.

The global graph page selects projects and active/historical runs, with explicit index availability and runtime observation status. It does not own a global reference/memory library. Project graphs have Graft and Orchestration tabs; an orchestration's Flow and Files views share run/attempt selection. Live execution graphs remain usable without a Graft index.

### Authoritative plans

- Graph feature: [2026-09-21-knowledge-graph-orchestration-plan.md](2026-09-21-knowledge-graph-orchestration-plan.md). This fully replaces the earlier curated-knowledge feature.
- Skills: [2026-09-21-skills-orchestration-plan.md](2026-09-21-skills-orchestration-plan.md), retaining global/project scope and explicit assignments. This graph feature injects no knowledge; Skills uses only its own instruction budget. A shared launch resolver may still serve skills/MCP if justified by their implementation.
- Connections: [2026-09-21-connections-mcp-orchestration-plan.md](2026-09-21-connections-mcp-orchestration-plan.md), retaining global/project inventory and supported opt-in activation. Product MCP availability and readable Graft index availability are independent.
- Runtime dependency: [2026-09-21-issue-work-modes.md](2026-09-21-issue-work-modes.md). Do not build a second scheduler or claim the unavailable multi-agent engine has been delivered by drawing its planned topology.

### Navigation and ownership

Retain `/#knowledge`, `/#skills`, `/#connections`, plus their project-scoped routes. Add a validated run-specific graph route such as `/#knowledge/<project-id>/runs/<run-id>`, and link directly from execution views. A run ID must belong to the requested project. Tabs and selected run survive reload; invalid/missing records show recovery links rather than another project's data.

Use `public/app.js`'s existing Home/project shells and navigation guards. Global breadcrumbs omit a project; project/run breadcrumbs preserve it. Global pages show no accidentally selected project or stale Git refresh. Project Knowledge's planned card is replaced, not duplicated. Do not create synthetic projects.

Graft structures are read-only projections of project index artifacts. Runtime graph states are projections of authoritative run/task/attempt/event records. Only bindings and UI preferences need separate settings; avoid a new knowledge content store. Existing settings and run history remain readable, with absent telemetry labeled not recorded. Prefer versioned additive fields/stores with atomic persistence and backups for actual migrations.

Opening, refreshing, following or replaying a graph never starts/stops execution or rebuilds the source index. Existing explicit execution controls retain their authorization and version checks. Skills/MCP settings remain independent. Do not retain old curated-knowledge toggles, accept/discard actions or reference/memory forms in this UI.

### Implementation checklist

- [ ] **SKD-RES2-01 — Reconcile scope and routing.** Inspect current status, branch/worktrees and active work; preserve unrelated changes. Add global cards and scoped routes with correct breadcrumbs. Acceptance: global entry works with zero projects; all routes reload and preserve scope; legacy links remain valid.
- [ ] **SKD-RES2-02 — Integrate graph mounts.** Mount the Graft/run explorers from the revised graph plan and add run-to-graph links. Acceptance: disconnected Graft and missing runtime telemetry have distinct real states; no synthetic live data or duplicate Knowledge card.
- [ ] **SKD-RES2-03 — Integrate Skills/MCP pages.** Follow the existing feature checklists while removing their obsolete dependency on curated knowledge. Acceptance: global/project resource ownership and explicit activation remain unchanged; graphs cause no skill/tool assignments.
- [ ] **SKD-RES2-04 — Navigation and final verification.** Integrate module disposal, pending/dirty safeguards, asset allowlists and current cache version. Acceptance: temporary-store browser tests cover cards, route/back/forward/deep links, disconnected states, stale responses, keyboard, mobile and PWA updates; final broad integration passes both full suites and rendered screenshots are inspected.

### Verification and delivery boundaries

Extend the existing overview/project/sidebar/PWA browser suites and the revised graph suite; fixture servers enforce no real provider execution. APIs remain network-only, and graph observations are never queued mutations. Poll/event subscriptions clean up on navigation without stopping runs. Record actual evidence in `VALIDATION.md` during implementation and distinguish fixture events from real-provider tracking.

No application code, provider configuration, live state or dependency was changed by preparing this plan. It authorizes no issue publication, implementation, dispatch or server restart. The original 22-item combined checklist is superseded for navigation and Knowledge; use the RES2/GRAPH IDs above and preserve any separately registered Skills/MCP IDs when execution is later authorized.
