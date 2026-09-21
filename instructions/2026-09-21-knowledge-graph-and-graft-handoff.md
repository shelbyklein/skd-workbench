# Knowledge graph integration and Graft maintenance handoff

Date: 2026-09-21
Status: Instructions only; implementation and dependency upgrades have not been performed.
Target: `/Users/shelbyklein/Vibes/skd-workbench`.

## Scope and starting state

Integrate Cytoscape.js into the Knowledge lane and maintain Graft as local source-development tooling. These serve different purposes: Cytoscape renders user-facing knowledge relationships; Graft indexes source code for development agents. Do not automatically import Graft's generated index into accepted knowledge or agent memory.

Workbench uses Node.js 22+, plain browser JavaScript/CSS, and no build step. Use its existing architecture; no React conversion is needed. Knowledge's intended model is recorded in `instructions/2026-09-20-development-lanes.md`. Recheck current implementation before starting because the repository has substantial pending work, including local Graft setup changes.

Read `AGENTS.md`, `README.md`, and `VALIDATION.md`. Inspect Git status, branch, worktrees, and active work. Preserve unrelated edits and coordinate ownership of shared files. This handoff does not dispatch work, authorize a server restart, or authorize implementing all future development lanes.

## Track A: User-facing knowledge graph

### A1. Add the browser dependency

- [ ] Install `cytoscape@3.34.3` with an exact pin using `npm install --save-exact cytoscape@3.34.3`; review package and lockfile changes.
- [ ] Add `/vendor/cytoscape.js` to the explicit vendor map in `server.js`, mapped to `cytoscape/dist/cytoscape.min.js`, following xterm's existing pattern. Do not expose all of `node_modules`.
- [ ] Load the local script before `/app.js` in `public/index.html`.

Acceptance: the browser loads the pinned library from the local server; unrelated filesystem paths remain inaccessible.

### A2. Implement a graph-view module

- [ ] Add `public/knowledge-ui.js` with a mount function accepting a container, nodes, edges, and selection callback. Return fit and destroy methods.
- [ ] Convert nodes into `{ data: { id, label } }`; convert relationships into `{ data: { id, source, target, label } }`. Use unique IDs across nodes and relationships and reject missing endpoints before rendering.
- [ ] Start with the built-in `circle` layout, `animate: false`, `padding: 45`, and `nodeDimensionsIncludeLabels: true`. Newton uses zoom bounds 0.2–2.5 and wheel sensitivity 0.2; tune these after testing Workbench.
- [ ] Style rounded node cards and labeled directional edges using Workbench's theme. Give the empty graph container an explicit responsive height.
- [ ] Wire node/edge selection to the details panel. Observe container resizing with `ResizeObserver` and call `cy.resize()`.
- [ ] Disconnect observers and call `cy.destroy()` on unmount or project changes. Preserve pan/zoom and node positions during ordinary selection/detail updates. Prevent stale asynchronous results from mounting into another project's view.

Reference: `/Users/shelbyklein/.newton-dev/development/workspace/src/KnowledgeGraph.tsx`, especially Cytoscape initialization and cleanup. Reuse behavior, not Newton-specific React, storage, or provider code.

Acceptance: fixture nodes and edges render; selection and fit work; sidebar resizing and repeated navigation do not leave duplicate graphs, listeners, or obsolete project data.

### A3. Integrate navigation and accessible interaction

- [ ] Connect the module to Knowledge navigation in `public/app.js`, following existing view lifecycle conventions.
- [ ] Provide Fit graph, search, project/global visibility filters, selection details, and actionable empty/error states.
- [ ] Provide a keyboard-accessible list of the same entries with controls to inspect their details. Do not make canvas interaction the only way to use Knowledge.
- [ ] Preserve unsaved-edit protection and verify desktop/mobile sizing, focus, theme contrast, and reduced-motion behavior.

Acceptance: the actual interface supports graph exploration and keyboard-only entry access, including empty and disconnected states.

### A4. Add durable records only within the agreed Knowledge scope

The viewer can be reviewed with fixtures first. Persisted knowledge and agent retrieval are a separate phase, not functionality supplied by Cytoscape.

Proposed records, to reconcile with current domain conventions before implementation:

```js
// Entry
{
  id: 'knowledge:example',
  projectID: 'project-id', // null for global scope
  kind: 'reference',      // reference | memory
  title: 'API conventions',
  body: '...',
  status: 'accepted',     // proposed | accepted | superseded
  source: { type: 'manual' },
  version: 1
}

// Relationship
{
  id: 'relationship:example',
  from: 'knowledge:example',
  to: 'component:api',
  relation: 'describes'
}
```

- [ ] Preserve provenance, source date/evidence, stable IDs, and superseded history. Distinguish projected project/component/issue/run/asset nodes from knowledge records.
- [ ] Follow `lib/store.js` atomic persistence and stale-version rejection patterns. Add tested migrations and backups if changing the schema; never silently replace corrupt data with empty records.
- [ ] Validate project scope, relationship endpoints, input bounds, and revisions server-side. Render user text safely.
- [ ] Implement visibility, agent retrieval eligibility, and memory capture as independent controls. Enforce retrieval exclusions server-side, including global/project and finer entry/collection settings.
- [ ] Keep agent-created memories proposed until explicitly accepted. Saving Scratchpad content must not automatically make it retrievable knowledge.

Acceptance: reload recovery, stale edits, migration preservation, project isolation, proposal acceptance, superseded history, and retrieval exclusions pass with temporary stores.

### A5. PWA integration and verification

- [ ] Add new public module/style routes to the server's explicit allowlist.
- [ ] Add graph shell assets to `public/sw.js` and bump its cache version. Keep APIs network-only and preserve the explicit update flow and unsaved drafts.
- [ ] Test with a temporary `FLOW_BENCH_DATA` directory and fixtures. Never start a second server against the live store.
- [ ] Run affected browser suites; run Node tests for domain/backend changes. For broad integration, run both full suites and inspect the rendered UI.
- [ ] Record actual evidence and remaining limits in `VALIDATION.md`. Distinguish fixture visualization, persisted behavior, and real agent retrieval verification.

## Track B: Graft maintenance

### What needs updating

1. **Source index:** refresh as source changes. Check before relying on it and rebuild when stale, especially after branch switches, large edits, or merges.
2. **Graft package:** review new releases periodically, for example monthly or during dependency maintenance, and sooner for relevant fixes. This cadence is a recommendation, not an installed automation.
3. **Local agent wiring:** revisit after moving the checkout, changing the Node installation, or upgrading Graft in a way that changes its CLI/MCP interface.

Current inspected configuration pins `@nanonets/graft` to `0.18.0` as a development dependency. `scripts/graft.mjs` invokes the repository-local package, disables telemetry, and configures `graft_development` for external Codex/Claude development sessions. It is not imported by the Workbench server. The pin does not automatically advance to newer releases.

### B1. Check and refresh the source index

Run from the Workbench repository:

```sh
npm run graft:check
```

If stale, run:

```sh
npm run graft:build
npm run graft:check
npm run graft:map
npm run graft -- ask "global settings"
```

- [ ] Confirm these scripts and their installed CLI behavior before use.
- [ ] Verify a query against a known recent source change, not merely command exit status.
- [ ] Keep generated index files ignored by Git. Do not use `--deep` unless model-backed enrichment is explicitly wanted.
- [ ] Do not assume auto-refresh hooks are installed: this repository uses a custom local wrapper/setup. Inspect actual wiring before relying on upstream automatic behavior.

Acceptance: freshness check succeeds and a representative query/map reflects current source without a model call.

### B2. Upgrade the package deliberately

Inspect installed and published versions without changing the dependency:

```sh
npm ls @nanonets/graft --depth=0
npm view @nanonets/graft version
```

Review upstream release changes, select a version, then replace the placeholder below with that reviewed version:

```sh
npm install --save-dev --save-exact @nanonets/graft@<reviewed-version>
npm run graft:build
npm run graft:check
npm run graft:map
npm run graft -- ask "global settings"
```

- [ ] Inspect package/lockfile changes and verify compatibility with `scripts/graft.mjs`, including its referenced CLI path and environment controls.
- [ ] Verify the actual `graft_development` MCP connection and a representative tool call after reopening the development session if needed.
- [ ] Preserve existing MCP settings. Review setup output and parse/validate generated TOML/JSON before claiming setup succeeded; a successful file write alone is insufficient.
- [ ] Commit only the intended dependency/tooling changes and evidence, preserving other tasks' pending edits.

Do not use the upstream global `graft upgrade` command for this repository-local dependency. A global upgrade does not update Workbench's pinned package. A tooling-only upgrade does not require restarting the Workbench server.

Acceptance: reviewed version is pinned, lockfile agrees, structural build/query works, local MCP works, and existing agent restrictions remain intact. Report unverified MCP behavior explicitly.

### B3. Repair wiring when needed

Inspect existing `.codex/config.toml` and `.mcp.json` first. Use `npm run graft:setup` only when registering or repairing the local integration; validate its output, then reopen the development session. Do not replace repository-local setup with upstream `graft init` without reviewing the additional files and user-level settings it would write.

## Delivery report

State which track and checklist items were completed, changed files, exact package versions, validation evidence, and remaining work. Do not describe a rendered graph as completed knowledge retrieval, or a generated Graft index as proof that MCP is connected.

## References

- Cytoscape API and layouts: https://js.cytoscape.org/
- Graft upstream: https://github.com/NanoNets/context-graph-engine
- Published Graft package and CLI documentation: https://www.npmjs.com/package/@nanonets/graft
- Graft security maintenance policy: https://github.com/NanoNets/Graft/blob/main/SECURITY.md
- Local source-of-truth guidance: `AGENTS.md`, `README.md`, and `instructions/2026-09-20-development-lanes.md`.
