# Simple flow workbench

## Outcome and authorization

Build a standalone local app with a web interface for composing model workflows, with simplicity taking priority over the existing Orchestration Bench dashboard. User authorized this plan, TT tracking, and solo implementation now. No handoff or agent delegation. Local delivery; no GitHub publication or deployment requested. TT local plan: `local:506F97BB-F6B9-43DB-B710-2C44F69D1B1E`.

## Current system and boundaries

New project: `/Users/shelbyklein/Vibes/flow-bench`. Inspected the existing `/Users/shelbyklein/Vibes/testbench-orchestration/orchestration-bench-v2/README.md`, `bench/dashboard.html`, `bench/assets/dashboard.js`, and `bench_core/registry.py`. Those provide experiment and trace views, with method configuration as JSON, not the simple flow-authoring experience requested. Preserve both existing bench projects and Tracker Trapper source/data. TT is the implementation progress tracker, not the app's execution engine.

First slice: local file-backed saved flows; connected sequential cards; Agent, My review, Check steps; model/effort/instructions in a selected-step inspector; versioned simulation runs; bounded review retries; run history and comparison. Clearly label simulation throughout. Do not invent usage: tokens/cost are unknown, not zero. No provider calls, subprocess execution, real code changes, public hosting, scheduler, arbitrary graph branching, or credentials in this slice. Real provider adapters and token import are follow-ons.

## Ordered implementation checklist

- [x] **TT-FLOW-01** Record the simple workbench plan and local project foundation. Acceptance: this standalone plan exists; Node server serves on loopback; existing benches remain unchanged.
- [x] **TT-FLOW-02** Build the saved flow editor. Acceptance: browser creates, duplicates, renames, saves, reorders, removes, and configures steps; definitions survive reload.
- [x] **TT-FLOW-03** Implement versioned simulation runs and human review. Acceptance: run snapshots remain immutable after flow edits; human gates pause; change requests create retained attempts with bounded retries; cancellation/reload preserve state; no provider is invoked.
- [x] **TT-FLOW-04** Add run history and honest comparison. Acceptance: inspect saved step outputs; compare matching task/acceptance inputs; flag mismatches; unknown token/cost displays; simulated elapsed time labeled and no quality winner invented.
- [x] **TT-FLOW-05** Verify and launch the workbench. Acceptance: state/API tests and real-browser checks pass; desktop/mobile, keyboard and reduced-motion states verified; screenshot captured and inspected; launch guide and validation receipt saved.

## Ownership and invariants

`lib/domain.js`: canonical input validation and run transitions. `lib/store.js`: durable JSON persistence and revision conflict checks, atomic replace; no blind overwrite of corrupted files. `server.js`: loopback-only HTTP routes, request bounds and origin/Host checks. `public/`: UI, no parallel persisted state. Flows have stable IDs and incrementing versions; each run freezes its complete definition. A run has a revision to reject stale/repeated transition requests. Successful transitions persist before response. Attempts are append-only; a retry targets an earlier agent and invalidates later execution by returning the cursor, without deleting old evidence. No background execution: the user advances simulation one step at a time. Refresh safely reloads state. Human decisions are explicit; simulation completion is never actual task acceptance.

## UX and edge cases

Saved flows on left, connected cards in center, settings only when selected. Save explicitly; warn before abandoning dirty changes. New/Duplicate/Run are discoverable. Native dialogs trap focus and support Escape. Focus rings, labeled controls, mobile layout, reduced-motion styles. Empty flow cannot run; invalid instructions/model or retry target cannot save. A failed API request leaves drafts intact. Concurrent edits return actionable conflict without losing the editor. Unknown usage never becomes zero. User strings render through escaping. Runs can be inspected after deleting a flow. Server restarts do not restart or advance runs.

## Verification and delivery

Use Node's test runner for durable store/API and transition tests; installed Chrome through Playwright for editor, run, retry, cancellation, reload, comparison, keyboard, and narrow-screen checks. Browser tests use a temporary store and never change operator flows. Capture live desktop/mobile screenshots under `output/`. Launch production local instance on a free loopback port; record URL and `npm start` instructions. Commit project source locally after checks. Rollback is stop server and remove the standalone project; existing apps are untouched. Keep user-created `.data/` out of Git.

## Completion evidence

2026-09-20: All five implementation tasks passed their checks. See `VALIDATION.md` for commands and limits. Nine Node tests plus three Chrome browser scripts pass; live app served on port 4390 and screenshot inspected. Local source delivery only; provider execution and measured token accounting remain follow-ons.
