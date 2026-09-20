# Flow Bench

A small, standalone local workbench for composing agent flows. Saved flows on the left, connected steps in the middle, settings when you select a step.

## Open it

Requires Node.js 22 or newer. No runtime packages, account, or API key required.

Double-click **Launch Flow Bench.command**, or run:

```sh
cd /Users/shelbyklein/Vibes/flow-bench
npm start
```

Open **http://127.0.0.1:4390**. Keep the terminal/server running; Ctrl-C stops it. If the port is busy, use `PORT=4391 npm start`. Use one server process per data directory.

## First experiment

1. Select **Plan, review, build**, or make a new flow.
2. Select a step to edit its name, model label, effort and instructions. Use **Add a step** for an Agent, My review, or Check. Move steps with the up/down controls.
3. Configure a review's change-request limit and earlier agent to return to. Moving/removing that target turns off the invalid return and tells you.
4. **Save flow**. Duplicate it to try a different arrangement.
5. **Try flow** opens the task and acceptance checks. **Start simulation** freezes this version of the flow.
6. **Simulate this step** records a placeholder handoff. A review waits for **Continue** or a change request with a note. Previous attempts remain available. Stop at any point; reloading does not advance the run.
7. After finishing or stopping, **Try another flow with this task** reuses exactly the same task and checks. Select two runs in **Run history** to compare their structure and review loops.

## What this version measures

This is the **flow-authoring and simulation slice**. It calls no models, edits no task repositories, runs no task checks, and incurs no provider charges. Model names are editable requested labels, not a verified provider catalog. Agent/Check outputs are clearly labeled placeholders. Human review continues a simulation, not acceptance of completed model work.

Tokens and model cost are **Not measured**, never fabricated or reported as zero. Simulation time is elapsed wall time, including time you spend reviewing. It is not model latency. Matching task inputs permit comparing structure; they do not establish a quality or efficiency winner. Real CLI/API adapters and provider usage capture are a future increment.

## Your data

Flows and run snapshots are stored in `.data/store.json` on this Mac. Flows have stable IDs and versions; runs keep immutable copies. Saves use atomic file replacement and revisions reject stale edits from another tab. Failed JSON parsing stops startup rather than replacing data. Stop the server before copying this file to back it up. `.data/` is ignored by Git.

The server binds only to `127.0.0.1`, rejects cross-origin writes and unrecognized Host headers, and serves an explicit list of UI assets. This is a local single-user app, not a hosted service. No telemetry, external fonts, or runtime network calls.

## Development and verification

```sh
npm install
npm test
npm run test:browser
```

Browser tests use Playwright with installed Google Chrome by default (`PLAYWRIGHT_CHANNEL=chrome`). They create temporary stores, leaving your own flows untouched. Screenshots go to `output/`. Runtime has no dependency on Playwright; it is a development dependency only.

- `lib/domain.js`: validation, immutable run creation, bounded simulation transitions.
- `lib/store.js`: local persistence, revisions, durable attempts.
- `server.js`: loopback HTTP app and JSON endpoints.
- `public/`: browser interface; no build step.
- `instructions/2026-09-20-simple-flow-workbench.md`: TT implementation plan.
- `VALIDATION.md`: delivery evidence and limitations.

Existing Testbench, Orchestration Bench and Tracker Trapper code/data are separate and unchanged.
