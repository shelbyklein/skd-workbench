# SKD Workbench

A standalone local workbench for development projects. Choose a project, compose its workflows, and inspect its runs. Connected steps stay in the middle; settings appear when you select a step.

## Open it

Requires Node.js 22 or newer. No runtime packages, account, or API key required.

Double-click **Launch SKD Workbench.command**, or run:

```sh
cd /Users/shelbyklein/Vibes/flow-bench
npm start
```

Open **http://127.0.0.1:4390**. Keep the terminal/server running; Ctrl-C stops it. If the port is busy, use `PORT=4391 npm start`. Use one server process per data directory.

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

## What this version measures

This is the **flow-authoring and simulation slice**. It calls no models, edits no task repositories, runs no task checks, and incurs no provider charges. Model names are editable requested labels, not a verified provider catalog. Agent/Check outputs are clearly labeled placeholders. Human review continues a simulation, not acceptance of completed model work.

Tokens and model cost are **Not measured**, never fabricated or reported as zero. Simulation time is elapsed wall time, including time you spend reviewing. It is not model latency. Matching task inputs permit comparing structure; they do not establish a quality or efficiency winner. Real CLI/API adapters and provider usage capture are a future increment.

## Your data

Projects, flows and run snapshots are stored in `.data/store.json` on this Mac. Flows have stable IDs and versions; runs keep immutable copies. Saves use atomic file replacement and revisions reject stale edits from another tab. Failed JSON parsing stops startup rather than replacing data. Stop the server before copying this file to back it up. `.data/` is ignored by Git.

The server binds only to `127.0.0.1`, rejects cross-origin writes and unrecognized Host headers, and serves an explicit list of UI assets. This is a local single-user app, not a hosted service. No telemetry, external fonts, or runtime network calls.

## Development and verification

```sh
npm install
npm test
npm run test:browser
```

Browser tests use Playwright with installed Google Chrome by default (`PLAYWRIGHT_CHANNEL=chrome`). They create temporary stores, leaving your own flows untouched. Screenshots go to `output/`. Runtime has no dependency on Playwright; it is a development dependency only.

- `lib/projects.js`: folder validation and bounded, read-only Git inspection.
- `lib/domain.js`: validation, immutable run creation, bounded simulation transitions.
- `lib/store.js`: local persistence, revisions, durable attempts.
- `server.js`: loopback HTTP app and JSON endpoints.
- `public/`: browser interface; no build step.
- `instructions/2026-09-20-simple-flow-workbench.md`: original TT implementation plan.
- `instructions/2026-09-20-skd-project-scopes.md`: project/Git TT implementation plan.
- `VALIDATION.md`: delivery evidence and limitations.

Existing Testbench, Orchestration Bench and Tracker Trapper code/data are separate and unchanged.

The project directory remains `flow-bench` to preserve existing paths. `Launch Flow Bench.command` remains a compatible launch alias. To roll back schema 2, stop the server and preserve the current store first; restore its schema-1 backup only after reconciling any projects/runs added since migration.


For this delivery the server is running as a transient macOS job (`com.shelbyklein.skd-workbench`), independent of the Codex terminal. No login-item plist was installed. Stop that background instance with `launchctl remove com.shelbyklein.skd-workbench`; then use the launcher or `npm start` to run it again. Current logs are `output/server.log` and `output/server-error.log`.
