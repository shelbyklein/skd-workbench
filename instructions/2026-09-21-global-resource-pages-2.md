# Global resource navigation: revised graph scope

## Prompt for Claude

Status: scope correction, 2026-09-21; instructions only. Read this before the original `2026-09-21-global-resource-pages.md`. Preserve earlier plans as history and all unrelated working changes. This file supersedes the original's knowledge ownership, retrieval and launch-context requirements; its ordinary routing/accessibility/PWA safeguards still apply where compatible.

### Outcome

Home has three cards above Projects: **Knowledge Graph**, **Skills**, and **Connections (MCP)**. Each has a global entry and project-scoped pages. Knowledge Graph has the two functions specified by the user:

1. Show Graft's graph for a project if connected.
2. Show orchestration live, including execution progress and how agents work with project files.

The global graph page selects projects and active/historical runs, with explicit index availability and runtime observation status. It does not own a global reference/memory library. Project graphs have Graft and Orchestration tabs; an orchestration's Flow and Files views share run/attempt selection. Live execution graphs remain usable without a Graft index.

### Authoritative plans

- Graph feature: [2026-09-21-knowledge-graph-feature-2.md](2026-09-21-knowledge-graph-feature-2.md). This fully replaces the earlier curated-knowledge feature.
- Skills: [2026-09-21-skills-feature.md](2026-09-21-skills-feature.md), retaining global/project scope and explicit assignments. Remove its dependency on a knowledge retrieval budget/context section: this graph feature injects no knowledge. A shared launch resolver may still serve skills/MCP if justified by their implementation.
- Connections: [2026-09-21-connections-mcp-feature.md](2026-09-21-connections-mcp-feature.md), retaining global/project inventory and supported opt-in activation. Product MCP availability and readable Graft index availability are independent.
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

No application code, provider configuration, live state or dependency was changed by this scope correction. It authorizes no issue publication, implementation, dispatch or server restart. The original 22-item combined checklist is superseded for navigation and Knowledge; use the RES2/GRAPH IDs above and preserve any separately registered Skills/MCP IDs when execution is later authorized.
