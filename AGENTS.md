# SKD Workbench agent guidance

## Project and scope

SKD Workbench is a local, single-user development workbench: projects, saved
workflows, review/check gates, isolated Git workspaces, benchmarks, and interactive
Codex/Claude sessions. It is a standalone Node.js application, not WordPress or
the Newton application. Keep changes scoped to this repository.

Read `README.md` for behavior and setup, `VALIDATION.md` for recorded evidence and
limitations, and the relevant file in `instructions/` before changing a feature.
Historical receipts describe their delivery time; verify current state rather
than treating old paths, authentication status, or test counts as current facts.
`instructions/2026-09-20-development-lanes.md` records future product direction,
not authorization to implement every lane. Scratchpad and Knowledge are currently planned UI entries. Issues provides
read-only GitHub browsing with explicit agent proposal and apply actions.

## Setup and commands

- Node.js 22 or newer; ES modules, plain browser JavaScript/CSS, no build step.
- `npm install` installs dependencies and repairs node-pty helper permissions via
  `scripts/prepare-terminal.mjs`.
- `npm start` serves `http://127.0.0.1:4390`; `PORT` selects another port.
- `FLOW_BENCH_DATA` selects the server data directory. Use a temporary directory
  for experiments and tests, never a second server against the live data store.
- `npm test` runs Node tests; `npm run test:browser` runs the Chrome browser suites.
  Browser tests use installed Chrome by default (`PLAYWRIGHT_CHANNEL=chrome`).
- `npm run icons` regenerates PNG icons from the existing mark.

## Source map

- `server.js`: loopback HTTP server, explicit asset allowlist, API routes and guards.
- `lib/domain.js`, `lib/store.js`: validation, simulations, revisions and persistence.
- `lib/projects.js`: canonical folders and bounded, read-only Git inspection.
- `lib/codex.js`, `lib/claude.js`: structured execution and provider adapters.
- `lib/workflows.js`: execution sequence, handoffs, gates, retries and usage totals.
- `lib/terminals.js`: interactive PTY sessions, reconnect and process lifecycle.
- `lib/benchmarks.js`: pinned baselines, workspace archives and guarded cleanup.
- `lib/issues.js`, `public/issues-ui.js`: GitHub reads and persisted title/body edit
  proposals. Browsing and drafting must never publish; only explicit Apply may write.
- `public/app.js`: project navigation, flow editor and simulation interface.
- `public/codex-ui.js`, `public/workflows-ui.js`, `public/terminal-ui.js`: execution UI.
- `public/pwa.js`, `public/sw.js`: installation, offline shell and explicit updates.
- `tests/`: Node tests and browser scripts; `scripts/smoke-*.mjs`: real-provider checks.

## Data and execution invariants

- `.data/` contains user records, retained worktrees and archives. `output/` contains
  generated evidence. Both are ignored by Git; preserve them and never commit them.
- Preserve stable IDs, immutable historical snapshots, atomic persistence and
  stale-revision rejection. Schema changes need tested migrations and backups.
  Corrupt data must fail visibly rather than being replaced with empty records.
- Preserve project scope and captured source context. A folder, repository root,
  and common Git directory are different facts; distinct worktrees can be projects.
- Sessions and workflows share execution ownership. Hiding/reopening a terminal
  must not spawn another process; restarting the server must not resume execution.
- Normal execution worktrees remain for review. Do not add automatic merge or
  deletion. Benchmark cleanup requires a successful archive and ownership checks;
  failures retain files. Never reset or clean a source checkout as benchmark cleanup.
- Keep native CLI permission prompts and explicit sandbox boundaries. Launch only
  validated server-selected executables/arguments; do not interpolate shell commands.
- Preserve loopback binding, Host/origin validation, bounded input/output, and the
  explicit public asset allowlist. Do not expose local records through static serving.
- Usage not reported by a provider is unknown, not zero. Interactive terminal tails
  are not complete structured transcripts. Process completion is not acceptance proof.

## UI and verification

- Preserve unsaved-change protection, project-scoped navigation, legacy routes and
  readable legacy execution records. Check desktop/mobile and keyboard behavior.
- Bump the cache version in `public/sw.js` whenever cached shell assets change.
  Keep APIs network-only: no cached project data, queued writes or automatic retries
  of execution/input. Updates must respect drafts and require the existing explicit action.
- Run checks appropriate to the changed behavior. Use `npm test` for backend/domain
  changes and affected browser suites for UI changes; run both full suites for broad
  integration or merge verification. Inspect rendered UI for visual changes.
- Use temporary stores and fixture providers for routine validation. Real-provider
  smoke scripts consume account usage; run them only within an authorized task scope.
  Browser interception alone is not a safe barrier against live execution through a PWA.
- Before restarting a live server, inspect active execution and preserve user state.
  Installing the PWA does not start its server or install a background login service.
- Report fixture tests, actual CLI startup, inference, and live UI verification
  separately. Record material delivery evidence and remaining limits in `VALIDATION.md`.

## Git and issue work

- Inspect `git status`, branches and `git worktree list` before changes or integration.
  Preserve unrelated work. Use `codex/` for new development branches by default.
  Do not infer permission to publish or deploy from historical delivery instructions.
- For GitHub issue execution, use Tracker Trapper: retrieve the existing plan and
  stable todo IDs, start/reuse this session's own run, and link only its verified JSONL
  with `watch_session`; confirm with `watch_status`. Never take another agent's run.
- Start each todo before work; complete it immediately after acceptance with evidence.
  Report milestones and at least every five minutes of active work. Mark actual
  blockers and finish the run before pausing or ending, without completing unfinished todos.
- If MCP fails, inspect persisted state before retrying. The fallback CLI is
  `/Users/shelbyklein/Vibes/tracker-trapper/.build/release/tracker-trapper`, using its
  default shared store and kebab-case flags. State reporting failures honestly.
