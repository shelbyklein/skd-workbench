# SKD Workbench

A standalone local workbench for development projects. Choose a project, compose its workflows, and inspect its runs. Connected steps stay in the middle; settings appear when you select a step.

## Open it

Requires Node.js 22 or newer. No runtime npm packages required. Flow previews need no account; real Codex runs require an installed, signed-in Codex CLI.

Double-click **Launch SKD Workbench.command**, or run:

```sh
cd /Users/shelbyklein/Vibes/skd-workbench
npm start
```

Open **http://127.0.0.1:4390**. Keep the terminal/server running; Ctrl-C stops it. If the port is busy, use `PORT=4391 npm start`. Use one server process per data directory.

## Install as an app

Open **http://127.0.0.1:4390** in Chrome or Edge on this Mac, then choose **Install app** in the sidebar or the browser's install menu. The installed app opens in its own window. If the Codex browser does not offer installation, the sidebar action provides the address to open in a supported browser. Installation itself uses the browser's confirmation dialog.

Keep the local server running. Installing the PWA does not install or start a background server, add a login item, or make this address accessible from another device. Use the same host and port each time; another port is a different app origin. The first online visit prepares the interface for offline startup.

If the server stops, the app shows **Reconnect** and keeps unsaved edits in the open window. When opened offline, it shows instructions to start **Launch SKD Workbench.command**. Only public interface assets are cached: projects, workflows, Git details, run data and pending writes are never stored in the browser cache or queued for later. Reconnection does not silently submit failed actions. Before retrying an interrupted save, check the saved state; an interrupted connection can leave its result uncertain.

When a new version is available, **Update app** reloads it after you save edits and close dialogs. Other open windows are not force-reloaded. Developers must bump the cache version in `public/sw.js` whenever shell assets change; test updates against temporary assets with `npm run test:browser`. Regenerate PNGs from the existing mark with `npm run icons`.

## Projects, folders and Git

Use **Add project** above the workflow list. Give it a name and paste its absolute local folder path (`~/…` also works). The folder must exist; a file or inaccessible path is rejected. The server resolves symlinks and prevents connecting the same canonical folder twice.

The project picker scopes workflows and run history. **Details** edits the project name/folder and shows detected Git information; **Refresh** reads its latest state. Git repositories and remotes are detected from the local checkout. No GitHub account or token is required. Remote configuration is read-only; repositories without remotes and folders without Git are supported. No fetch, checkout, push, commit, clone, or project-file mutation occurs.

The selected folder, repository root, and common Git directory are separate facts. You can connect distinct worktrees of one repository as separate project scopes, with their own workflows and run history. Branch, commit, clean/dirty/unknown status and sanitized remote URLs appear in Details. URL credentials and query strings are not retained. Refresh data is observed at that time, not a live subscription.

**Move** assigns a workflow to another project and increments its version. Old runs stay in their original project. New runs capture the project name, folder and Git state at start; **Project & code at run start** shows that immutable snapshot. Editing the project or switching branches later does not rewrite previous runs. This records observed context; it does not freeze or copy the files on disk. Comparisons warn about different projects/folders/commits, dirty working trees, or missing Git context.

Existing workflows and runs migrate to **Unassigned**. A byte-exact schema-1 backup is created in `.data/` before the migration. Historic Git information is left unknown. Connect the correct working folder yourself; the app does not guess which Newton or TT checkout to use. A missing folder blocks new project runs until reconnected; existing runs remain inspectable.

## First experiment

1. Choose a project. Existing **Plan, review, build** and other flows are in **Unassigned**; use **Move** to assign them, or create a workflow inside your project.
2. Select a step to edit its name, model label, effort and instructions. Use **Add a step** for an Agent, My review, or Check. Move steps with the up/down controls.
3. Configure a review's change-request limit and earlier agent to return to. Moving/removing that target turns off the invalid return and tells you.
4. **Save flow**. Duplicate it to try a different arrangement.
5. **Try flow** opens the task and acceptance checks. **Start simulation** freezes this version of the flow.
6. **Simulate this step** records a placeholder handoff. A review waits for **Continue** or a change request with a note. Previous attempts remain available. Stop at any point; reloading does not advance the run.
7. After finishing or stopping, **Try another flow with this task** reuses exactly the same task and checks. Select two runs in **Run history** to compare their structure and review loops.

## Run a real task with Codex

Choose a connected project, then **Codex runs** in the sidebar. Select a model and effort from the installed CLI's advertised catalog, choose a workspace mode, enter a task and its acceptance checks, and click **Run Codex**. This uses your signed-in Codex account allowance. Model access is confirmed by execution, not assumed from catalog presence.

- **Read only:** inspect and plan in the connected folder, including its current uncommitted files. No write permission is granted by SKD.
- **Separate Git worktree:** requires a clean repository with a commit. Starts a new `codex/skd-…` branch at that exact commit under `.data/worktrees/`. Codex can edit and run commands there with the workspace-write sandbox. Dependencies/build setup are task-specific and may need preparation. The resulting tracked diff and changed-file list are shown for review. New/untracked files are listed; inspect their content in the retained worktree. No automatic merge, push or cleanup occurs.

Runs retain task, model, effort, CLI version, starting code context, output, recent activity and reported token usage. Cached input is a subset of input; total tokens are input plus output. Missing usage remains **Unknown**, including cancelled/failed runs that never reported it. Token totals can include repeated model requests and large instruction context even for a tiny task. Codex account dollar cost is **Not reported**; there is no invented pricing estimate.

One task runs at a time. **Stop run** stops its process group; a 10-minute runtime limit and 2 MiB event-stream limit also stop execution. These are not token or dollar budgets. Closing the browser does not stop a run while the server stays running. Normal server shutdown terminates active Codex; a supervisor also terminates the child process group if its server parent disappears. On startup, unfinished records are marked interrupted and never automatically relaunched. Use **Run this task again** to prefill the same task for another explicitly started run.

Execution uses `codex exec --json`, explicit sandbox/approval settings, `--ephemeral`, `--ignore-user-config` and `--ignore-rules`. It reuses saved CLI authentication without copying credentials into the app. Personal global config integrations are not inherited; project instructions and installed Codex behavior still apply. This is a separate task runner, not a Codex desktop task. Set `SKD_CODEX_BIN` in the server environment only if the executable is outside the usual local/Homebrew locations.

**Scope:** real single-task Codex runs now work. Multi-step flow handoffs, opposing-provider reviews, automatic retry loops, merging, and real-run comparison UI are future increments. **Try flow** remains a simulation: its outputs are placeholders, its model labels are not provider selections, and its tokens/cost remain not measured. Simulation time is not model latency.

Implementation reference: [official Codex non-interactive documentation](https://learn.chatgpt.com/docs/non-interactive-mode). Installed CLI help and model discovery were verified against 0.155.1.

## Your data

Projects, flows and simulation snapshots are stored in `.data/store.json` on this Mac. Real Codex runs are separately stored in `.data/codex-runs.json`; worktrees are retained under `.data/worktrees/`. Back up the entire `.data/` directory while the server is stopped; do not delete worktrees containing changes you need. Flows have stable IDs and versions; runs keep immutable copies. Saves use atomic file replacement and revisions reject stale edits from another tab. Failed JSON parsing stops startup rather than replacing data. Stop the server before copying this file to back it up. `.data/` is ignored by Git.

The server binds only to `127.0.0.1`, rejects cross-origin writes and unrecognized Host headers, and serves an explicit list of UI assets. This is a local single-user app, not a hosted service. The workbench adds no telemetry or external fonts. Real Codex execution communicates with its provider and may use network capabilities permitted by Codex.

## Development and verification

```sh
npm install
npm test
npm run test:browser
```

Browser tests use Playwright with installed Google Chrome by default (`PLAYWRIGHT_CHANNEL=chrome`). They create temporary stores, leaving your own flows untouched. Screenshots go to `output/`. Runtime has no dependency on Playwright; it is a development dependency only.

- `lib/codex.js`: installed CLI discovery, persistent single-task execution, usage and process lifecycle.
- `public/codex-ui.js`: real Codex task entry and results.
- `lib/projects.js`: folder validation and bounded, read-only Git inspection.
- `lib/domain.js`: validation, immutable run creation, bounded simulation transitions.
- `lib/store.js`: local persistence, revisions, durable attempts.
- `server.js`: loopback HTTP app and JSON endpoints.
- `public/`: browser interface; no build step.
- `instructions/2026-09-20-simple-flow-workbench.md`: original TT implementation plan.
- `instructions/2026-09-20-skd-project-scopes.md`: project/Git TT implementation plan.
- `instructions/2026-09-20-skd-pwa.md`: PWA TT implementation plan.
- `VALIDATION.md`: delivery evidence and limitations.

Existing Testbench, Orchestration Bench and Tracker Trapper code/data are separate and unchanged.

The project lives independently at `/Users/shelbyklein/Vibes/skd-workbench`. `Launch Flow Bench.command` remains a compatible launch alias. To roll back schema 2, stop the server and preserve the current store first; restore its schema-1 backup only after reconciling any projects/runs added since migration.


For this delivery the server is running as a transient macOS job (`com.shelbyklein.skd-workbench`), independent of the Codex terminal. No login-item plist was installed. Stop that background instance with `launchctl remove com.shelbyklein.skd-workbench`; then use the launcher or `npm start` to run it again. Current logs are `output/server.log` and `output/server-error.log`.

Manual real-provider checks (consume account usage): `node scripts/smoke-codex.mjs` and `node scripts/smoke-codex.mjs --worktree`. They use isolated fixture projects under ignored `output/`, retain receipts and screenshots, and never run against your development projects.
