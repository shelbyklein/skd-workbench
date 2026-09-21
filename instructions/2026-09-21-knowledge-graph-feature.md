# Knowledge Graph: global and project knowledge

## Prompt for Claude

Status: implementation-ready proposal, not implementation authorization. Target `/Users/shelbyklein/Vibes/skd-workbench`. Read `AGENTS.md`, `README.md`, `VALIDATION.md`, the development-lanes document, the existing Knowledge/Graft handoff, and `2026-09-21-global-resource-pages.md`. Preserve unrelated uncommitted changes; recheck current source before editing.

### Outcome and first slice

Open Knowledge Graph from Home or a project, create reference knowledge or a proposed development memory, connect it to relevant records, search it, and inspect it through a graph or keyboard-accessible list. Global and project knowledge share one model. The first useful release is durable authoring/review plus graph/list browsing; a fixture graph alone is an intermediate review artifact. Agent retrieval has a separate acceptance gate below.

### Confirmed foundation and gaps

Workbench's project Knowledge card is still planned (`public/app.js:142`); no Knowledge service or Cytoscape dependency exists in the inspected package. `lib/store.js:21–32` supplies an atomic replacement pattern. Current project/run snapshots support provenance, but do not supply knowledge storage or retrieval.

Newton reference: `/Users/shelbyklein/.newton-dev/development/workspace/src/KnowledgeGraph.tsx:342–419` initializes Cytoscape with circle layout, rounded nodes, directed edge labels, zoom bounds, resize observation and cleanup. Reuse behavior with vanilla JavaScript, not React or Newton storage. The handoff's model distinguishes references and development memories, and accepted knowledge from source indexes.

The [Cytoscape API](https://js.cytoscape.org/) documents local browser integration, layouts and lifecycle methods. The handoff specifies `cytoscape@3.34.3`; verify that exact package artifact during implementation and pin it rather than silently choosing latest. This planning pass did not install or verify that artifact.

### Ownership and proposed data model

Add `lib/knowledge.js` owning `.data/knowledge.json`, initially schema 1. Use a library revision for compare-and-swap mutations and per-record stable IDs/versions. Missing storage initializes empty; malformed/unsupported storage fails visibly without overwriting bytes. Keep mutations atomic across entries, relationships, collections and policies.

An entry includes `id`, `version`, `projectID` (null = global), `kind` (`reference|memory`), title/body, status (`proposed|accepted|superseded|discarded`), optional collection ID, provenance, created/updated/source-observed dates, creator attribution, evidence references, and history. Proposed bounds: title 200 characters, body 64 KiB UTF-8, 32 evidence references, 100-character relationship labels. Validate actual serialized sizes and document limits. Do not silently truncate.

Provenance records manual input, source file/link, or actual run/session/issue references without copying credentials. A source URL is not fetched automatically. Agent-origin memories are always proposed; only an explicit user action accepts them. Preserve revisions when editing or superseding. A superseding operation atomically records the replacement relationship and retains the prior entry/history. Discarded proposals remain outside normal views/retrieval. Do not introduce irreversible deletion in the first slice.

Collections have their own stable ID and scope, title, version and retrieval-enabled flag; entries inherit the collection gate. Entry eligibility is also independently controllable. A project policy has `useGlobalKnowledge`, `useProjectKnowledge`, `captureMemories`, and per-entry/collection exclusions. Defaults for existing and new projects are false for both automatic-use switches and capture, preserving current prompts. UI browsing remains available regardless of those switches. Global entry exclusions affect all future consumers; project exclusions affect only that project.

Relationships have IDs, source/target typed references, relation, scope, version and provenance. Graph IDs use namespaces across entry/relationship/project/run/issue/component/asset types. Reference actual project/run/issue IDs; projected nodes are not duplicate knowledge entries. First release projects existing project/run/known-issue identities; component/asset entities wait for authoritative ownership or must be explicitly user-authored typed references, never invented executable entities.

Permit global-to-global relationships and project-owned relationships linking the same project's nodes and global nodes. Reject edges between unrelated projects or global edges that leak a project's records. A removed/unavailable source stays a labeled historical reference. Hidden endpoints hide their edges; retrieval must not follow edges into excluded scopes. Graph layout, selection and visibility filters are ephemeral view state, not accepted knowledge.

### Service/API and retrieval contract

Proposed read endpoints: `GET /api/knowledge?scope=global|project&projectID=...`, entry/detail/history and bounded search routes. A global “All projects” browsing filter must be explicit and validated. Proposed mutations: create/edit entry, accept/discard/supersede, create/edit relationship, collection management, and project policy update. Every write validates scope, endpoints and expected revision server-side; return conflicts with retained drafts. Shared loopback/origin and request-size guards remain.

Phase two adds a server-side context resolver through `lib/agent-context.js`. It is not an unauthenticated global retrieval endpoint. Resolve against the actual launch project/purpose and current policy, then freeze selected entry versions and content into the run snapshot. Start with explicit user selection and deterministic title/body search, not embeddings or a new model dependency. Proposed cap: 16 entries / 24 KiB serialized knowledge context; oversized explicit selections require correction and are never silently truncated. Record excluded IDs and concise reasons in the launch preview.

Eligibility requires accepted status, allowed scope, enabled project/global switch, enabled collection/entry and no project exclusion. A UI scope filter cannot override eligibility. Issue-edit proposal agents receive no automatic knowledge; preserve their restricted input contract. For workflows, snapshot at start and recheck revocation before each subsequent launch/retry; report a conflict requiring explicit restart with updated context. Already-delivered content cannot be removed from an active conversation.

Memory capture is independent: first implement explicit user “Propose memory from run” with actual source IDs and a review form. An agent-facing proposal endpoint, if included later, derives caller/project/run identity server-side and enforces capture policy; it cannot accept its own proposal or nominate another project's source. No polling transcript scraper or automatic extraction at this milestone.

### Ordered checklist

- [ ] **SKD-KG-01 — Durable records and policy.** Implement validators/store/API with revisions, provenance, collections, proposal state and scope. Acceptance: save/reopen, stale edit, corruption retention, proposal acceptance/discard, superseding history and two-project isolation pass against temporary stores.
- [ ] **SKD-KG-02 — Authoring and accessible browsing.** Add global/project list/search/details/edit/review UI. Acceptance: empty state offers Add entry; global versus project creation is clear; dirty/error/conflict states preserve text; all entries and relationships are inspectable without canvas interaction.
- [ ] **SKD-KG-03 — Graph rendering.** Install exact Cytoscape pin; allowlist `/vendor/cytoscape.js` to `cytoscape/dist/cytoscape.min.js`; load before app bootstrap. Add `public/knowledge-ui.js` plus a small graph mount if separating rendering helps. Acceptance: IDs/endpoints validated, node/edge selection and Fit work, same data appears in list and graph, and graph remains usable when the renderer fails.
- [ ] **SKD-KG-04 — Graph lifecycle and scale.** Use circle, `animate:false`, padding 45 and label-aware dimensions; start from Newton's 0.2–2.5 zoom / 0.2 wheel sensitivity. Observe resize, destroy on unmount, retain viewport/positions during selection and ordinary detail updates. Acceptance: repeated scope/navigation changes leave no obsolete instances or stale data; fixtures of 500 nodes / 1,000 edges remain interactable, otherwise cap the graph with an explicit filtered-subset message and keep paginated list access.
- [ ] **SKD-KG-05 — Retrieval integration.** Implement scope policy, launch preview/resolver, immutable snapshots, revocation checks and exact input delivery to supported adapters. Acceptance: fixture provider receives exactly eligible material with provenance; disabled, proposed, discarded, superseded and other-project entries are absent; historical inputs remain unchanged after edits.
- [ ] **SKD-KG-06 — Memory proposal and final validation.** Add explicit source-linked proposal action without automatic inference. Complete PWA/route integration, register tests, and record evidence. Acceptance: capture-off rejects agent proposals; capture-on still requires acceptance before retrieval; plain Scratchpad saves remain ineligible.

### Edge cases and regression tests

Add `tests/knowledge.test.js` and `tests/knowledge-browser.mjs` through real service/HTTP/UI entry points. Cover stale revisions, invalid scope, cross-project edges, ID collisions, invalid/missing endpoints, removed provenance source, disabled collections with explicitly selected entries, changes during workflow review, corrupted schema, Unicode byte limits, safe literal text, empty graph, disconnected nodes, search pagination, and renderer load failure. Test that selecting a detail does not reset the viewport or recreate the graph.

Use temporary stores and fake executables. Focused commands: `node --test tests/knowledge.test.js`, `node tests/knowledge-browser.mjs`, `node tests/pwa-browser.mjs`. Then both full suites for this broad integration. Inspect desktop/mobile graph and list screenshots, keyboard-only use, theme contrast and reduced motion. Add module/vendor assets to explicit allowlists and PWA shell, bump the current cache version, and retain network-only APIs/update draft guards. Report fixture rendering, durable storage, fixture delivery and actual agent retrieval separately; live inference requires its own authorized verification.

### Graft boundary and follow-ons

Keep Graft source indexing outside this store. Current local `@nanonets/graft` is 0.18.0; `scripts/graft.mjs:1–13` is development-only and disables telemetry. This task's actual `graft_check_freshness` response was callable but reported both “NO GRAPH” (missing `graft/manifest.json`) and stale `public/settings-ui.js` symbols. Do not interpret that as a fresh usable index. Track B of the existing handoff owns wrapper/path inspection, structural rebuild, known-change query and MCP recheck; do not follow the tool response's unsolicited `--deep` or commit-generated-index suggestion. Generated indexes remain ignored.

Upstream's [Graft repository](https://github.com/trailhq/Graft) is the redirect target of the handoff's NanoNets URL as observed during this investigation. Verify upstream identity/release history before a later upgrade; no package upgrade or maintenance automation was performed here.

Later scope: embeddings, document ingestion, automatic memory proposals, custom graph layouts, cross-project semantic relationships and new component/asset registries. None is required to ship the durable graph/list slice.
