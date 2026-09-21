# SKD Workbench

A standalone local workbench for development projects. Choose a project, compose its workflows, and inspect its runs. Connected steps stay in the middle; settings appear when you select a step.

## Open it

Requires Node.js 22 or newer. Runtime dependencies provide the embedded terminal (node-pty and xterm.js). Flow previews need no account; real Codex runs require an installed, signed-in Codex CLI.

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

## Navigation

**Home** lists connected project cards. The internal Unassigned group is available in the project selector for older workflows, but has no Home card. Opening a project shows its **Project Overview**, with links to Workflows and Sessions. Issues reads the project’s GitHub repository and offers agent edit proposals. Scratchpad and Knowledge are labeled planned and are not available yet.

**Workflows** has its own overview of saved workflows and recent runs. Its sidebar contains Overview, the project's saved workflows, and New flow. The **Project overview** button returns to the project's views; **Home** or the app logo returns to project cards. Navigation preserves unsaved-change protection.

Routes are `/#home`, `/#project/<project-id>` and `/#workflows/<project-id>`. The old `/#projects` alias and existing flow, run and history URLs still work.

Sessions are provider-neutral: choose Codex or Claude when starting one. Start session opens the interactive CLI in a right-side terminal column for back-and-forth conversation. Session URLs use `/#sessions/<project-id>`, with old `/#codex/…` links preserved.

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

## Execute a saved workflow

Move the flow into a connected project and use **Run settings** to save its task, acceptance checks, workspace mode, agent model/effort and attempt limit. **Run** then starts immediately; **Try flow** starts the no-model walkthrough with the same saved task. Missing task or unsupported model settings open a setup form. Tiny Tasks is preconfigured, with task/acceptance shared across its benchmark workflows. Use the optional all-agents model selector to deliberately assign one model to every agent. Labels such as Fable or Opus are not silently mapped to another provider. Saving an explicit Codex model updates the corresponding agent step; previous run snapshots stay unchanged.

Agents run sequentially. Each receives the task, acceptance checks, current step instructions, prior outputs and review notes. Inspect **Exact step input** to see the handoff. Coding agents all use one isolated worktree, including after requested revisions. All agents in coding mode have workspace-write permission; choose read-only for planning-only experiments. No automatic merge occurs.

**My review** pauses until you continue or request changes. A change request requires a note and reruns from the earlier agent configured in the flow; the per-review retry limit remains enforced. Older attempts and notes remain visible. **Check** is a manual verification gate: enter evidence of the check before continuing. It does not invent a test command or claim tests passed. Actual automatic checks must be included in an agent's instructions and their output inspected.

**Workflow runs** shows the live connected steps, saved outputs, per-attempt usage, and cumulative known input/output tokens across all attempts. Missing usage makes the aggregate explicitly partial; it is never replaced with zero usage. A workflow reserves the executor even while waiting for review or after a failure; finish or stop it before starting another workflow or single task. The attempt cap includes failed starts; it is not a dollar/token cap. A handoff exceeding 128,000 characters stops with an error rather than silently dropping prior output.

Failures pause the sequence. Inspect the last attempt and workspace before **Retry this step**, especially after an interruption: it may already have modified files or completed a turn before the server stopped. Restarting the server preserves review gates but never automatically relaunches interrupted paid work. **Stop workflow** terminates an active child or stops at the current gate and releases the executor.

**Try flow** remains a no-model simulation; historical simulations are not relabeled as real runs. Other providers, real-run comparison UI, dollar estimates and automatic merging remain future increments.

Implementation reference: [official Codex non-interactive documentation](https://learn.chatgpt.com/docs/non-interactive-mode). Installed CLI help and model discovery were verified against 0.155.1.

## Resettable benchmarks

In **Project details → Set up benchmark**, enable reset and pin a Git commit or tag. Each real run then starts from that exact commit in a fresh worktree. Reviews and retryable workflow failures keep the shared worktree open. Completing or stopping the workflow saves its results and clears the worktree; standalone completed, failed or cancelled tasks do the same. Interrupted work stays available for inspection.

Run details show **Workspace cleared · results saved** and a download for files and evidence. History retains reported tokens, timing, output, all attempts and review notes. JSON archives include file contents in base64 (including new, ignored and binary files), modes, symlink targets, a binary diff and reported command outputs/exit codes. They live in `.data/artifacts/`. This is a real execution benchmark: costs/usage occur only when you start Codex. **Try flow** remains the separate no-model simulation.

An archive must succeed before deletion. Above 32 MiB / 10,000 entries, or if files/ownership change, the workspace is retained with an explanation. Restart never resumes interrupted cleanup automatically. Normal projects continue retaining worktrees. The baseline source checkout is never reset or cleaned. Pinning settings itself does not execute a model or test.

## Your data

Projects, flows and simulation snapshots are stored in `.data/store.json` on this Mac. Real Codex attempts are separately stored in `.data/codex-runs.json`; workflow snapshots, gates and attempt links are in `.data/workflows.json`; active and retained worktrees live under `.data/worktrees/`; completed benchmark workspaces are archived under `.data/artifacts/` before removal. Back up the entire `.data/` directory while the server is stopped; do not delete worktrees containing changes you need. Flows have stable IDs and versions; runs keep immutable copies. Saves use atomic file replacement and revisions reject stale edits from another tab. Failed JSON parsing stops startup rather than replacing data. Stop the server before copying this file to back it up. `.data/` is ignored by Git.

The server binds only to `127.0.0.1`, rejects cross-origin writes and unrecognized Host headers, and serves an explicit list of UI assets. This is a local single-user app, not a hosted service. The workbench adds no telemetry or external fonts. Real Codex execution communicates with its provider and may use network capabilities permitted by Codex.

## Development and verification

```sh
npm install
npm test
npm run test:browser
```

Browser tests use Playwright with installed Google Chrome by default (`PLAYWRIGHT_CHANNEL=chrome`). They create temporary stores, leaving your own flows untouched. Screenshots go to `output/`. Runtime has no dependency on Playwright; it is a development dependency only.

- `lib/workflows.js`: persistent sequence, review transitions, shared workspace, limits and usage aggregation.
- `public/workflows-ui.js`: explicit launch mapping and live workflow graph.
- `lib/codex.js`: installed CLI discovery, persistent single-task execution, usage and process lifecycle.
- `public/codex-ui.js`: Sessions entry and results (Codex and Claude).
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

Manual real multi-step check (consumes account usage): `node scripts/smoke-workflow.mjs`. Uses a fixture Git project, verifies no second call before review, output handoff and shared-worktree code creation, records real usage and preserves the source checkout.

## Legacy Claude executions

The legacy non-interactive Claude executor remains available through the API and earlier results remain readable. It requires Claude Code and `claude auth login`. Workbench checks the installed CLI and login, then offers Sonnet, Opus, Fable and Haiku aliases with low/medium/high effort. Alias access is confirmed only by execution; the resolved model is retained when reported. `SKD_CLAUDE_BIN` can override the executable path.

Claude shares the Sessions history, execution lock, cancellation, timeout, isolated worktrees and benchmark reset with Codex. Existing histories and Codex URLs remain valid. The session API is `/api/sessions`, with discovery under `/api/agents/codex` and `/api/agents/claude`; old Codex API aliases remain compatible.

The legacy non-interactive Claude adapter supports file inspection and isolated file edits. It requires a CLI supporting restricted and safe modes, disables customization/MCP/delegation, and does not expose shell tools. Automated commands/tests are unavailable in that legacy execution mode. Permission denials are shown with the result. Claude workflows are not implemented; interactive conversation is provided by the new terminal Sessions view.

Input usage includes uncached input plus cache reads and cache creation; cache reads are shown separately without adding them twice. Missing usage stays unknown. Claude's reported cost is labeled as an estimate, not the actual charge. See the [official programmatic CLI documentation](https://code.claude.com/docs/en/headless).

## Interactive session terminal

Select the agent and model pills, set the discrete effort slider, and choose the workspace. **Start session** opens the real CLI in a column sliding in from the right. There is no required message and no prompt is sent automatically. Respond directly to the CLI, including its sign-in, trust and permission prompts. Claude can open while signed out. Codex model discovery currently requires a signed-in Codex CLI.

**Hide** closes the panel while leaving the process running. **Show terminal** or reopening the same session reconnects to that process; page reload does not start another CLI. **End session** terminates it. On phones the panel uses the full viewport. A server restart interrupts sessions without relaunching them; you can inspect the retained output and worktree afterward. Only one session or workflow owns the executor at a time.

A worktree is a separate working copy: one per entire session, including all messages. The normal worktree and branch remain after exit for you to review and merge manually. Read-only mode inspects the original folder; Codex uses its read-only sandbox, while Claude exposes only reading/search tools. Worktree mode keeps the native CLI permission prompts, and does not bypass permissions. Claude starts in safe mode without customizations; Codex uses its native trust flow.

For benchmark projects, the warning appears at the top. **Reset after each run** means after the whole terminal session ends: archive files, then clear the worktree. Hiding the panel and individual messages do not reset it. Interrupted sessions retain their worktree. Failed archive/identity checks retain files visibly. Normal sessions never merge or delete their worktree automatically.

The terminal retains the most recent 1 MiB of terminal characters locally for reconnection, not a complete structured agent transcript. Native CLI usage/cost is not imported into Workbench totals yet; previous structured execution records remain available. API endpoints are `/api/terminal-agents/:agent` and `/api/terminal-sessions/:id` with output/input/resize/stop operations. The API only launches server-selected agent binaries and validates input/size. Transport stays localhost-only with existing origin protection; input is never queued offline or retried automatically.

Run `npm install` after updating: xterm.js renders the terminal and node-pty provides its PTY. The postinstall script sets the executable bit on node-pty's packaged Unix helper. Dependencies are served locally and cached in the PWA; no CDN is used. Terminal rendering requires inline styles; script policy remains self-only. See [node-pty](https://github.com/microsoft/node-pty), [xterm.js](https://xtermjs.org/docs/api/terminal/classes/terminal/), and [Codex CLI reference](https://developers.openai.com/codex/cli/reference).


## GitHub issues

Open a project and choose **Issues**. SKD reads the current checkout's GitHub origin
remote using your installed, signed-in GitHub CLI (`gh auth login`). Without origin,
a single unambiguous GitHub remote is accepted. This first version supports
`github.com`; other hosts and ambiguous repositories show an explanation. Set
`SKD_GH_BIN` if gh is outside the usual local/Homebrew locations. Credentials remain
with gh and are not copied into Workbench records.

Browse open, closed, or all issues, page through results, read descriptions and
comments, and open the original on GitHub. Issue text is shown as literal Markdown,
including code and checklists. Pull requests are excluded; pages correspond to 50
GitHub issue/PR records, so a page can be sparse or empty while Next remains available.
Refresh is explicit. Browsing never edits GitHub or starts an agent.

To edit an issue, choose **Codex** or **Claude**, a **model**, and an **effort** level.
Describe the requested title/description change and choose **Generate proposal**.
The headless CLI uses your agent account and the shared single-executor lock. Drafting
runs in a dedicated folder with Codex shell/web execution disabled or Claude tools
removed; it does not receive GitHub token environment variables. It receives the
issue title/body and your instruction. Discussion and project file contents are not
assembled into the draft prompt; installed CLI instruction loading still applies. It cannot
apply through the app: only your **Apply changes to GitHub** action submits the saved
proposal. Preview is read-only; to revise a proposal, generate another one.

The app rechecks the repository, original issue identity, title, description and update
time before writing, sends only title/body, and reads back the result. If the issue
changed, refresh and generate a new proposal. GitHub's issue update endpoint does not
provide this app an atomic compare-and-swap: another editor could still write between
the final check and update. Avoid simultaneous editing when applying. An interrupted
or ambiguous write is never automatically retried; **Check GitHub** performs a read-only
comparison, then either verifies the saved result or requires a new proposal.

Proposals persist in `.data/issue-proposals.json`, linked to headless run history in
`.data/codex-runs.json`; `.data/issue-drafts/` is their working directory. You can return
to a generating proposal after navigating away or reloading. Restart interrupts active
agents without relaunching them. Unsaved edit instructions are protected while navigating
but are not persisted. Existing benchmark projects do not reset their code for issue drafts.
Routes are `/#issues/<project-id>` and `/#issues/<project-id>/<issue-number>`.

Validation: `node tests/issues-browser.mjs` uses fixture GitHub and agent processes.
`node scripts/smoke-issues.mjs` checks actual GitHub reads in an isolated local store;
adding `--agent codex` or `--agent claude` makes one real draft-only inference call and
consumes account usage. That smoke server rejects every GitHub write. Full regression
commands remain `npm test` and `npm run test:browser`.
