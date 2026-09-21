# Global resource pages and project navigation

## Prompt for Claude

Status: investigated plan, 2026-09-21. This document does not authorize implementation, dispatch, dependency changes, provider usage, or publication.

### Outcome

Add three cards above Projects on Home, in this order: **Knowledge Graph**, **Skills**, **Connections (MCP)**. Each opens a global page that works even with no connected project. Provide corresponding project-scoped pages without creating synthetic projects or duplicating libraries. Replace the existing project's planned Knowledge card rather than adding a second knowledge destination. Keep Scratchpad planned.

Working assumption: the request's phrase “if not already a project” means these capabilities should also be available within a project. Clarification was requested during planning; absent a correction, this is the proposed scope. Global pages own global records and can explicitly browse project records; project pages show the project's resources plus applicable global resources.

### Current system and evidence

Inspected checkout: `/Users/shelbyklein/Vibes/skd-workbench`, branch `codex/github-issues`, HEAD `091b0ef`. There is substantial unrelated pending work, including settings, issue planning, shared agent controls, and Graft. Line references describe the inspected working files and may move.

- `public/app.js:56` (`breadcrumbs`), `:87` (`shell`), `:129` (`render`), `:135` (`renderProjects`), and `:140` (`renderProjectOverview`) own navigation. Home currently goes straight to Projects. Project Knowledge is a planned card; Skills and MCP pages are absent.
- `public/app.js:18` already calls its Git-inspection cache `connections`. Rename it narrowly to `gitConnections` when necessary to distinguish it from MCP connections; do not change the Git API.
- `public/app.js:34` (`confirmLeave`), `:345` (`hasUnsaved`), and `:348` (`boot`) require explicit new-page handling. Global pages must not inherit `currentProject()`'s fallback to Unassigned.
- `lib/settings.js:6` owns appearance/model preferences, not resource libraries. `instructionFiles` at `:23` is a bounded, read-only preview; it neither discovers full skill packages nor injects instructions.
- `lib/store.js:6` shows existing schema backups; `:21` and `:26` provide atomic replace and clone-before-persist patterns. `server.js:19` and `:163` are explicit public/vendor allowlists; `public/sw.js:1` owns the shell cache.
- `README.md`, all relevant sections of `VALIDATION.md`, `instructions/2026-09-20-development-lanes.md`, and the existing `2026-09-21-knowledge-graph-and-graft-handoff.md` were read. Historical receipts are not current runtime proof.

### Feature plans and dependency order

1. This navigation contract and shared scope/lifecycle rules.
2. [Knowledge records, graph and retrieval](2026-09-21-knowledge-graph-feature.md): durable knowledge and useful graph; retrieval is a separately accepted milestone.
3. [Skills inventory and assignment](2026-09-21-skills-feature.md): discovered files, managed instructions, then verified delivery.
4. [Connections inventory and activation](2026-09-21-connections-mcp-feature.md): truthful inventory, then explicit supported activation.
5. Graft maintenance follows Track B of the existing [handoff](2026-09-21-knowledge-graph-and-graft-handoff.md). It does not block the three product pages.

The list establishes dependencies, not parallel-agent authorization. Each feature file owns its checklist. Do not count a navigation shell as completion of the linked feature or copy these tasks into competing checklists. If future implementation is attached to a GitHub issue, reconcile its existing Tracker Trapper plan and IDs before registering new work; this planning task does not create issues or runs.

### Ownership and shared contracts

- Global is an explicit scope, never `unassigned` or an invented project. Use `{kind:'global'}` and `{kind:'project', projectID}` at service boundaries. Persist `projectID:null` only where a resource schema explicitly defines it as global.
- Resource records belong to Workbench's selected data directory. Provider files remain provider-owned. Newton is a reference implementation, not a shared database or daemon dependency.
- Use one versioned store per feature (`knowledge.json`, `skills.json`, `connections.json`) with a single owner for its records, policies and revisions. Preserve the existing main store and preferences. Validate existing feature files strictly; only a missing file means a new empty library. Future schema migrations need a byte-exact backup and migration tests.
- Common launch integration belongs in a narrow proposed `lib/agent-context.js` service. Each feature supplies its own resolver; do not build a new generic permission engine. It resolves server-side using authoritative project, execution purpose, mode and provider; clients send IDs/choices, never pre-resolved permission claims.
- A launch snapshot records selected knowledge and skill versions/content, connection identities/config fingerprints, policy revisions, exclusions/reasons, and delivery status. Secret values never appear. Freeze ordinary content for the whole workflow; each new attempt rechecks revocations and fails visibly if its frozen selection is no longer permitted. Do not silently substitute newer content or automatically retry work.
- Existing processes retain previously delivered instructions/tools. Saves affect future launches; the UI states this. No automatic interruption, reconnect, resume, or model turn. Old histories with no snapshot display “Not recorded.”
- Resource selection does not authorize external writes or bypass native CLI approval. Issue-edit proposals retain their separate restricted execution contract.

### Routes and user experience

| Page | Global route | Project route |
| --- | --- | --- |
| Knowledge Graph | `/#knowledge` | `/#knowledge/<project-id>` |
| Skills | `/#skills` | `/#skills/<project-id>` |
| Connections (MCP) | `/#connections` | `/#connections/<project-id>` |

Global breadcrumbs are Home → page; project breadcrumbs are Home → project → page. Keep the project sidebar, but show no active project on global pages and do not trigger a stale project's Git refresh. Global cross-project browsing requires an explicit scope filter; new records default to global on the global page and the current project on a project page. Scope filters never change execution policy.

Use real links with guarded ordinary-click navigation and working modified clicks/deep links. Preserve legacy routes. Decide explicitly whether to add browser history entries for the new routes; the existing `replaceState` implementation does not provide a general back/forward router. Implement and test coherent back/forward behavior rather than assuming hash changes already mount views.

Three cards use existing theme tokens and card geometry, three columns where space permits and one on narrow screens. Keep labels functional. Counts, if added, must come from real feature services; no sample counts or connected status inferred from files. No extra settings dashboard is required.

New mounts expose `dispose`, `isDirty`, and `isPending`. Wire them into navigation, beforeunload, and the PWA update guard. Cancel/ignore stale requests on route or scope changes. Graph selection/detail updates must not call full-app render and lose graph state.

### Ordered implementation checklist

- [ ] **SKD-RES-01 — Reconcile active work.** Read repository guidance; inspect status, branch and worktrees again. Preserve all unrelated edits and agree ownership of shared navigation/server/cache files. Acceptance: baseline and affected files are recorded; no cleanup/reset/stash of another task's work.
- [ ] **SKD-RES-02 — Add explicit global routing.** Extend route serialization/boot, breadcrumb logic, sidebar selection, and guarded navigation. Acceptance: all six routes reload correctly, global routes work with zero projects, invalid project IDs fail visibly instead of showing another project, and legacy routes work.
- [ ] **SKD-RES-03 — Add cards and mount contracts.** Put global cards above Projects; add project links when their pages are available. A separately reviewed shell may state a feature is planned, but final integration must use real mounts with real empty/loading/error states. Acceptance: no fake projects, duplicate Knowledge card, or misleading active controls.
- [ ] **SKD-RES-04 — Integrate feature delivery.** Wire completed feature mounts and shared launch snapshot contract. Acceptance: scopes, drafts, launch selection, and historical records agree across pages; changing a visibility filter never changes an agent grant.
- [ ] **SKD-RES-05 — Verify and document.** Update explicit asset lists/cache version, run focused navigation/PWA suites, then both full suites after feature integration. Acceptance: desktop/mobile screenshots inspected, keyboard navigation and interrupted requests checked, and `VALIDATION.md` records actual evidence and gaps.

### Regression tests and verification

Extend `tests/overview-browser.mjs`, `tests/projects-browser.mjs`, `tests/sidebar-browser.mjs`, and `tests/pwa-browser.mjs`; add `tests/resources-browser.mjs` and register it in `test:browser`. Cover card order; empty projects; scope persistence; direct-link/new-tab behavior; back/forward; unknown project; dirty and pending transitions; stale async responses; mobile overflow; light/dark/custom accents; focus return; reduced motion; and explicit update with an unsaved resource draft.

Run focused browser files using temporary data and fixture providers. Backend feature work runs `npm test`. Final integration runs `npm test` and `npm run test:browser`. Public shell assets may cache; resource APIs, credentials and queued writes must not. Use a separate temporary `FLOW_BENCH_DATA`; never start a second server on live data. Inspect active execution before any separately authorized live restart.

### Planning evidence and exclusions

This investigation inspected source, Newton source/docs, local CLI help, installed dependencies and the actual Graft freshness MCP response. It did not run application tests, inspect rendered feature UI, launch inference, change provider settings, upgrade dependencies or restart the server. No new feature is implemented by these files.

Do not implement Scratchpad, a plugin marketplace, a secret vault, orchestration runtime, automatic memory extraction, or all development lanes under this task. Resolve any later product fork in its owning feature plan.
