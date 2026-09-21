# SKD Workbench

A standalone local workbench for development projects. Choose a project, compose its workflows, and inspect its runs. Connected steps stay in the middle; settings appear when you select a step. Drag cards to reorder them (use the grip on touch screens), or focus a card and press Alt + Up/Down. Save flow keeps the new order.

Home’s **Workflows** card lists saved workflows across projects, with a project filter. Opening a workflow restores its project context; browsing does not start a run.

## Open it

Requires Node.js 22 or newer. Runtime dependencies provide the embedded terminal (node-pty and xterm.js) and the local graph renderer (Cytoscape). Flow previews and Graft browsing need no account; real Codex runs require an installed, signed-in Codex CLI.

Double-click **Launch SKD Workbench.command**, or run:

```sh
cd /Users/shelbyklein/Vibes/skd-workbench
npm start
```

Open **http://127.0.0.1:4390**. Keep the terminal/server running; Ctrl-C stops it. If the port is busy, use `PORT=4391 npm start`. Use one server process per data directory.

## Graft for source development

[Graft](https://github.com/NanoNets/context-graph-engine) is pinned as a local
development dependency. Run `npm run graft:build` to build its structural source
index, `npm run graft:map` to inspect it, or
`npm run graft -- ask "global settings"` to query it. These commands do not use
a model; enrichment with `--deep` is a separate, explicit operation.
Run `npm run graft:setup` to register `graft_development` in this checkout's
Codex and Claude MCP configuration, then reopen the development session.
Generated indexes and machine-specific MCP configurations are ignored by Git;
rerun setup after moving the checkout or changing Node installations. Telemetry
is disabled by the wrapper. This configures external development agents;
Workbench's restricted execution adapters retain their existing MCP rules.

The **Knowledge Graph** page reads an existing Graft index from a connected
project folder or its Git repository root. Code, Context and Outline views are
read-only: opening the page does not run `graft`, rebuild an index, enrich it
with a model or change project files. Graph reads are size-bounded and scoped to
the selected project. A missing or unsupported index is reported in the page.

## Install as an app

Open **http://127.0.0.1:4390** in Chrome or Edge on this Mac, then choose **Install app** in the sidebar or the browser's install menu. The installed app opens in its own window. If the Codex browser does not offer installation, the sidebar action provides the address to open in a supported browser. Installation itself uses the browser's confirmation dialog.

Keep the local server running. Installing the PWA does not install or start a background server, add a login item, or make this address accessible from another device. Use the same host and port each time; another port is a different app origin. The first online visit prepares the interface for offline startup.

If the server stops, the app shows **Reconnect** and keeps unsaved edits in the open window. When opened offline, it shows instructions to start **Launch SKD Workbench.command**. Only public interface assets are cached: projects, workflows, Git details, run data and pending writes are never stored in the browser cache or queued for later. Reconnection does not silently submit failed actions. Before retrying an interrupted save, check the saved state; an interrupted connection can leave its result uncertain.

When a new version is available, **Update app** reloads it after you save edits and close dialogs. Other open windows are not force-reloaded. Developers must bump the cache version in `public/sw.js` whenever shell assets change; test updates against temporary assets with `npm run test:browser`. Regenerate PNGs from the existing mark with `npm run icons`.

## Sequential delegation

Open a project's **Workflows → Delegate task**. Enter the task, acceptance checks,
and an optional existing issue URL or TT task ID. Choose a Codex lead and a Claude
or Codex worker from the installed providers' model catalogs. For Astra → Fable →
Astra, select Astra for the lead and Fable for the worker. Starting consumes the
selected providers' account usage.

Workbench registers a durable task/run and a single isolated worktree before
inference. The lead plans, the worker implements, and the lead reviews and runs
checks. Review can accept, request a bounded revision, or ask for clarification.
Claude workers retain restricted file tools; the Codex lead executes checks.
Normal workflows and interactive sessions share the same execution lock.

The run page retains every turn, model/effort, output, available usage, review
decision and observed command results. **Accepted** means the lead accepted and
its selected acceptance commands exited successfully; it does not certify check relevance,
full coverage, integration or release. Inspect the evidence and retained files.
Missing or failed selected command evidence requires attention even if the lead accepts. Other command failures remain visible in the same evidence list.
Unknown usage remains unknown. No merge, push or worktree deletion is automatic.

Stop cancels execution; restart marks active work interrupted without relaunching.
Retry is explicit and consumes the remaining attempt budget. Clarifications retain
earlier evidence. A launch request is recoverable after a lost response. Interrupted
workspace creation requires inspection and stopping the run before starting again.
The optional task reference links context; this first version does not synchronize
delegated task status back to TT or implement the full lifecycle registry in #9.

`npm test` and `npm run test:browser` use fixtures. The explicitly invoked
`node scripts/smoke-delegation.mjs` consumes real Astra/Fable usage against a
disposable repository and retains its workspace and evidence in `output/`.

## Navigation

**Home** places global page cards above the project list. **Knowledge Graph** summarizes the Graft status of every project. **Playbooks** saves reusable selections of managed Skills and Connections (MCP). **Skills** manages reusable instruction text, while **Connections (MCP)** inventories provider configuration without revealing commands, arguments, URLs, headers or values. The internal Unassigned group is available through the Unassigned workflows link for older workflows, but has no Home card. Opening a project shows its **Project Overview**, with links to Workflows, Sessions, Issues, System, Knowledge Graph, Playbooks, Skills and Connections. Scratchpad remains planned.

**Global settings → Project tags** manages shared tags and their project assignments. Create, rename, color, or delete tags, expand Projects to choose any number of projects, then save. Each project can have multiple tags. Home shows colored filter pills: with none selected every project is visible, while selected pills show projects matching any selected tag. Projects can be viewed as a four-column desktop grid or a compact list; the layout choice is remembered in this browser. Each card’s ⋯ button opens its tag assignment picker; the project overview also has an Edit tags shortcut. Changes are drafts until saved. Deleting a tag removes its assignments, without changing projects or execution history.

**Workflows** has its own overview of saved workflows and recent runs. On Home and global pages, the sidebar lists projects. Inside a project, it shows icons and links for the nine project entries in the same order as the overview cards, highlights the active view, and provides All projects to return Home. Scratchpad is marked Planned and remains unavailable. The project name returns to its overview; Add project remains available. Project details are available on the project overview. The left header breadcrumb links Home → project → view → current item; choose the project name to return to its views, or Home to return to project cards. Navigation preserves unsaved-change protection.

The project overview starts with three live widgets. **Git status** shows the connected checkout, uncommitted files, in-progress Git operations, upstream/target comparisons, and an expandable inventory of local branches and registered worktrees. Refresh local reads the disk; Check remote explicitly reads advertised HTTPS/SSH branch tips without fetching or changing refs. Both observations have separate timestamps. Unknown, partial and failed checks stay visible; commit ancestry does not establish merge readiness. **Priority issues** reads the first page of open GitHub issues, recognizes `priority: urgent`, `priority: high`, `priority: medium`, and `priority: low` (plus common P0–P3 aliases), sorts them ahead of unprioritized issues, and shows the six highest-priority results. **Last session** reports the newest user session, whether it completed, and any blocker language or recorded error. “None reported” means the saved result contains no blocker report; it is not an independent verification that no blocker exists. Internal issue-edit proposal runs do not appear as project sessions.

Routes include `/#home`, `/#project/<project-id>`, `/#knowledge`, `/#knowledge/<project-id>`, `/#playbooks`, `/#playbooks/<project-id>`, `/#skills`, `/#skills/<project-id>`, `/#connections`, `/#connections/<project-id>` and `/#workflows/<project-id>`. Browser back and forward restore these views. The old `/#projects` alias and existing flow, run and history URLs still work.

Sessions are provider-neutral: choose Codex or Claude when starting one. Start session opens the interactive CLI in a right-side terminal column for back-and-forth conversation. Session URLs use `/#sessions/<project-id>`, with old `/#codex/…` links preserved.

**Import** on the Last session card or Sessions page brings an existing chat into the selected project. Paste with Ctrl+V/⌘V or enter an absolute local file path (`~/…` is supported). UTF-8 text, Markdown, JSON and JSONL are saved as supplied, up to 1 MiB; structured exports are not parsed into verified activity records. The saved copy remains available if the original file changes. Imported chats appear in history with unknown execution/completion/usage, and importing never starts an agent. Open the transcript to copy it or choose **Use as context**, enter the next task, and explicitly start a new session. The starting message labels the transcript as historical reference and retains a link to the imported record. Messages over 64 KB are rejected without truncation; copy the relevant context into the terminal instead. Import transfers chat context, not repository files or a provider's native session identity.

## Playbooks, Skills and Connections

Playbooks are versioned global or project-scoped selections of managed Skills and Connections. A project can choose a default per provider. A session can use that default, choose another playbook, or apply an exact session-only override, including an empty selection. Preview resolves current eligibility and fingerprints before Start; a changed, archived, incompatible or revoked resource blocks the stale launch instead of silently substituting it. Playbooks do not include the model, effort, workspace, task, provider configuration or credentials. Editing a playbook creates a new version and never rewrites frozen session history.

Session details expose **Save as playbook** for active and ended sessions. The draft begins with that session's frozen managed configuration, labels current availability and drift, and keeps observed activity separate. Saving is idempotent, does not start or change the source session, and copies no prompt, output, worktree, instruction text, arguments, results or secrets. Observed-only MCP selection is available only when the source activity coverage is complete.

Skills can be global or project-scoped. Workbench discovers bounded `SKILL.md` files from recognized `.agents/skills`, `.codex/skills` and `.claude/skills` roots without running them. Import copies instruction text into `.data/skills.json`; it does not copy or execute referenced scripts or support files. Managed entries have revisions, version history, archive state and a 16 KiB entry limit. A launch can inherit project defaults or replace them with an exact set, including an explicit empty set. Saved workflows keep the per-step selection, and every real attempt records the exact skill versions and text it received. Later edits affect future launches; archiving or excluding a skill blocks a pending retry instead of silently substituting another version. Issue-edit proposals remain skill-free.

Connections reads bounded Codex TOML and Claude JSON sources and stores only redacted identity, provenance, transport, environment-variable names, fingerprints and verification status. Inventory and refresh do not start a server. Project policy can retain native provider behavior or choose a managed set for the next interactive worktree session. Read-only sessions, structured runs, workflows and issue-edit proposals are MCP-free. A tool-catalog check explicitly starts one selected stdio server, initializes it and requests `tools/list`; it never invokes a tool. Claude managed activation requires a current successful check so Workbench can restrict the model-visible MCP tools to that exact catalog.

Managed Codex launches enumerate the effective CLI configuration, replace every unselected server with a disabled harmless transport and reconstruct only the selected source definition while persisting only its redacted identity. Managed Claude launches use restricted mode, strict MCP configuration, disabled hooks/delegation and a private one-session JSON file removed when the process ends. Inline credentials and unsafe connection names cannot use managed activation. Configuration fingerprints are rechecked immediately before launch. Provider files are never edited, and open or historical sessions are never rewritten when policy changes.

## Projects, folders and Git

Use **Add project** in the sidebar. Give it a name and use **Choose folder…** to open the macOS folder picker, or enter its absolute local folder path (`~/…` also works). The folder must exist; a file or inaccessible path is rejected. The server resolves symlinks and prevents connecting the same canonical folder twice.

The project list switches between project workspaces. **Project details** edits the project name/folder and shows detected Git information; **Refresh** reads its latest state. Git repositories and remotes are detected from the local checkout. No GitHub account or token is required. Remote configuration is read-only; repositories without remotes and folders without Git are supported. No fetch, checkout, push, commit, clone, or project-file mutation occurs. The overview’s explicit Check remote action is a network read; opening the overview and Refresh local do not contact the remote.

The selected folder, repository root, and common Git directory are separate facts. You can connect distinct worktrees of one repository as separate project scopes, with their own workflows and run history. Branch, commit, clean/dirty/unknown status and sanitized remote URLs appear in Details. URL credentials and query strings are not retained. Refresh data is observed at that time, not a live subscription. The Git status widget defaults to the recorded remote default branch when available, then an unambiguous main/master branch; its comparison target and remote can be selected. Remote checks support HTTPS (including the macOS Git keychain helper) and SSH with existing agent/default-key credentials and a known host. Custom SSH configuration, URL rewrites, arbitrary credential/transport helpers and embedded URL credentials are not used. Authentication failures retain local results. Remote commits absent from local history have unknown ahead/behind counts until fetched outside Workbench. No merge, pull, push, cleanup or review-readiness action is provided.

**Move** assigns a workflow to another project and increments its version. Old runs stay in their original project. New runs capture the project name, folder and Git state at start; **Project & code at run start** shows that immutable snapshot. Editing the project or switching branches later does not rewrite previous runs. This records observed context; it does not freeze or copy the files on disk. Comparisons warn about different projects/folders/commits, dirty working trees, or missing Git context.

Existing workflows and runs migrate to **Unassigned**. A byte-exact schema-1 backup is created in `.data/` before the migration. Historic Git information is left unknown. Connect the correct working folder yourself; the app does not guess which Newton or TT checkout to use. A missing folder blocks new project runs until reconnected; existing runs remain inspectable.

## First experiment

1. Choose a project. Existing **Plan, review, build** and other flows are in **Unassigned**; use **Move** to assign them, or create a workflow inside your project.
2. Select a step to edit its name and instructions, choose a model pill, and set effort with the slider. Custom model labels remain available in the disclosure. The desktop editor uses equal-height, independently scrolling columns in a 3:2 ratio. Use **Add a step** for an Agent, My review, or Check. Move steps with the up/down controls.
3. Configure a review's change-request limit and earlier agent to return to. Moving/removing that target turns off the invalid return and tells you.
4. **Save flow**. Duplicate it to try a different arrangement.
5. **Try flow** opens the task and acceptance checks. **Start simulation** freezes this version of the flow.
6. **Simulate this step** records a placeholder handoff. A review waits for **Continue** or a change request with a note. Previous attempts remain available. Stop at any point; reloading does not advance the run.
7. After finishing or stopping, **Try another flow with this task** reuses exactly the same task and checks. Select two runs in **Run history** to compare their structure and review loops.

## Run a real task with Codex

Choose a connected project, then **Codex runs** in the sidebar. Select a model and effort from the installed CLI's advertised catalog, choose a workspace mode, enter a task and its acceptance checks, and click **Run Codex**. This uses your signed-in Codex account allowance. Model access is confirmed by execution, not assumed from catalog presence.

- **Read only:** inspect and plan in the connected folder, including its current uncommitted files. No write permission is granted by SKD.
- **Separate Git worktree:** requires a clean repository with a commit. Starts a new `codex/skd-…` branch at that exact commit under `.data/worktrees/`. Codex can edit and run commands there with the workspace-write sandbox. Dependencies/build setup are task-specific and may need preparation. The resulting tracked diff and changed-file list are shown for review. New/untracked files are listed; inspect their content in the retained worktree. No automatic merge, push or cleanup occurs.

Runs retain task, model, effort, CLI version, starting code context, frozen managed configuration, output, recent activity and reported token usage. Structured Codex and Claude execution records normalize provider-emitted tool call/result/denial events into bounded metadata: tool or MCP server identity, timestamps, outcome, source and coverage. They do not retain raw arguments or results in the activity ledger. Workflow summaries reference their attempt records and aggregate counts without copying event ledgers. Interactive PTY sessions show activity coverage as **Unavailable** because the installed interactive providers do not emit session-bound structured tool events; terminal text is not treated as evidence. Older records without capture metadata show **Unknown**, which is distinct from a complete stream that observed zero calls. Cached input is a subset of input; total tokens are input plus output. Missing usage remains **Unknown**, including cancelled/failed runs that never reported it. Token totals can include repeated model requests and large instruction context even for a tiny task. Codex account dollar cost is **Not reported**; there is no invented pricing estimate.

One task runs at a time. **Stop run** stops its process group; a 10-minute runtime limit and 2 MiB event-stream limit also stop execution. These are not token or dollar budgets. Closing the browser does not stop a run while the server stays running. Normal server shutdown terminates active Codex; a supervisor also terminates the child process group if its server parent disappears. On startup, unfinished records are marked interrupted and never automatically relaunched. Use **Run this task again** to prefill the same task for another explicitly started run.

Execution uses `codex exec --json`, explicit sandbox/approval settings, `--ephemeral`, `--ignore-user-config` and `--ignore-rules`. It reuses saved CLI authentication without copying credentials into the app. Personal global config integrations are not inherited; project instructions and installed Codex behavior still apply. This is a separate task runner, not a Codex desktop task. Set `SKD_CODEX_BIN` in the server environment only if the executable is outside the usual local/Homebrew locations.

## Execute a saved workflow

Move the flow into a connected project and use **Run settings** to save its task, acceptance checks, workspace mode, agent model/effort, per-step skill selection and attempt limit. **Run** then starts immediately; **Try flow** starts the no-model walkthrough with the same saved task. Missing task or unsupported model settings open a setup form. Tiny Tasks is preconfigured, with task/acceptance shared across its benchmark workflows. Use the optional all-agents model selector to deliberately assign one model to every agent. Labels such as Fable or Opus are not silently mapped to another provider. Saving an explicit Codex model or skill override updates the corresponding agent step; previous run snapshots stay unchanged. Every retry for a step reuses its frozen skill snapshot after rechecking that those skills remain eligible.

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

Projects, flows and simulation snapshots are stored in `.data/store.json` on this Mac. Managed skills and policies are stored in `.data/skills.json`; redacted connection policies and check results are stored in `.data/connections.json`. Real Codex attempts are separately stored in `.data/codex-runs.json`; workflow snapshots, gates and attempt links are in `.data/workflows.json`; active and retained worktrees live under `.data/worktrees/`; completed benchmark workspaces are archived under `.data/artifacts/` before removal. Private Claude launch configurations exist only under `.data/connection-launches/` for the process lifetime and are removed on normal completion or the next startup. Back up the entire `.data/` directory while the server is stopped; do not delete worktrees containing changes you need. Flows have stable IDs and versions; runs keep immutable copies. Saves use atomic file replacement and revisions reject stale edits from another tab. Failed JSON parsing stops startup rather than replacing data. Stop the server before copying this file to back it up. `.data/` is ignored by Git.

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
- `public/playbooks-ui.js`: global and project Playbook libraries, versions and defaults.
- `lib/projects.js`: folder validation and bounded, read-only Git inspection.
- `lib/graft-view.js`: project-bound Graft discovery, validation, filtering and bounded graph reads.
- `lib/skills.js`: discovered and managed skills, version history, policies and launch snapshots.
- `lib/connections.js`: redacted MCP inventory, assignment policy, checks and selective launch adapters.
- `lib/playbooks.js`, `lib/activity.js`: versioned launch selections and normalized structured-run activity records.
- `lib/domain.js`: validation, immutable run creation, bounded simulation transitions.
- `lib/store.js`: local persistence, revisions, durable attempts.
- `server.js`: loopback HTTP app and JSON endpoints.
- `public/knowledge-ui.js`: global Graft status and the accessible Code, Context and Outline explorer.
- `public/skills-ui.js`, `public/connections-ui.js`: global/project resource pages and next-launch policy controls.
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

A worktree is a separate working copy: one per entire session, including all messages. The normal worktree and branch remain after exit for you to review and merge manually. Read-only mode inspects the original folder, exposes only reading/search tools and is MCP-free. Worktree mode keeps the native CLI permission prompts and does not bypass permissions. Claude uses safe mode unless a verified managed MCP selection is active; that mode remains restricted, disables hooks/delegation and exposes only the selected checked tool names. Codex uses its native trust flow in native mode and isolated overrides in managed mode.

For benchmark projects, the warning appears at the top. **Reset after each run** means after the whole terminal session ends: archive files, then clear the worktree. Hiding the panel and individual messages do not reset it. Interrupted sessions retain their worktree. Failed archive/identity checks retain files visibly. Normal sessions never merge or delete their worktree automatically.

The terminal retains the most recent 1 MiB of terminal characters locally for reconnection, not a complete structured agent transcript. Its durable record includes the exact skill snapshot and redacted connection identities fixed at launch. Native CLI usage/cost is not imported into Workbench totals yet; previous structured execution records remain available. API endpoints are `/api/terminal-agents/:agent` and `/api/terminal-sessions/:id` with output/input/resize/stop operations. The API only launches server-selected agent binaries and validates input/size. Transport stays localhost-only with existing origin protection; input is never queued offline or retried automatically.

Run `npm install` after updating: xterm.js renders the terminal and node-pty provides its PTY. The postinstall script sets the executable bit on node-pty's packaged Unix helper. Dependencies are served locally and cached in the PWA; no CDN is used. Terminal rendering requires inline styles; script policy remains self-only. See [node-pty](https://github.com/microsoft/node-pty), [xterm.js](https://xtermjs.org/docs/api/terminal/classes/terminal/), and [Codex CLI reference](https://developers.openai.com/codex/cli/reference).


## GitHub issues

Open a project and choose **Issues**. SKD reads the current checkout's GitHub origin
remote using your installed, signed-in GitHub CLI (`gh auth login`). Without origin,
a single unambiguous GitHub remote is accepted. This first version supports
`github.com`; other hosts and ambiguous repositories show an explanation. Set
`SKD_GH_BIN` if gh is outside the usual local/Homebrew locations. Credentials remain
with gh and are not copied into Workbench records.

Browse open, closed, or all issues, page through results, read descriptions and
comments, and open the original on GitHub. Issue descriptions, comments, and proposal
comparisons render sanitized GitHub-style Markdown, including headings, lists, task
lists, tables, links, emphasis, and code. Editing retains the original Markdown source.
Pull requests are excluded; pages correspond to 50
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

Issues opens a full-width list. Selecting an issue opens its own page with the
issue on the left and **Edit with an agent** on the right in a 3:2 layout.
Generating or opening a proposal navigates to its dedicated diff page, where Apply
remains explicit. Breadcrumbs return to the issue or list; proposal URLs survive reload.

Use **Delete flow** in the editor toolbar to remove a saved flow. Confirm the named flow; saved runs retain their original snapshots.

## Global settings and project System pages

The cog beside Add project opens a landscape settings dialog with a section menu
and a separate content column. On phones, a section selector replaces the menu.
Light and dark mode have separate accent colors. Each provider has its own model
view; model buttons show explicit Shown/Hidden states and toggle default visibility.
Existing saved selections remain visible. Preferences are persisted in the local
server's `.data/settings.json` and apply across projects; they do not change provider
access or rewrite saved plans.

Repository guidance separates Workbench's repository rule files from feature
reference documents, with a file selector, read-only preview, and an explicit
document status when the source provides one. Viewing documents preserves pending
preference edits; the title and Save/Cancel actions remain visible while content
scrolls. Each project's overview also has a
System page with project settings and read-only previews of `AGENTS.md`,
`AGENTS.override.md`, `CLAUDE.md`, system Markdown files, and Markdown files directly
inside `instructions/`, `.claude/rules/`, and `.codex/rules/`. Previews stay within the
project folder and are bounded to 64 files and 128 KB per file. This is a file viewer,
not a guarantee of a CLI's full effective system prompt: provider/user-level rules
and launch-specific prompts can also apply. Viewing files does not inject or edit them.

### Create an issue plan

In Edit plan, **Create plan** saves the instructions and launches the selected CLI
with the issue context in an isolated worktree. The planner is directed to edit only
its generated Markdown plan file, which the planning page refreshes while the CLI
runs. The terminal accepts follow-up instructions. **Open plan** returns to the latest
planning session; reloading does not launch it again. **Save draft** only stores inputs.
Planning uses the existing clean-Git/worktree and CLI permission requirements. A
created Markdown plan is a draft, not automatic approval or orchestration execution.

### Project quick actions

Three equal-width cards in one row above the Git readout (stacked on narrow screens) start interactive CLI sessions: **Reconcile to main**, **New collaboration session**, and **Suggest what to do next**. Each has an icon, title and description. Settings saves project-scoped agent/model/effort and playbook selections; successful ordinary sessions seed the defaults until an explicit quick-action preset is saved. Reset clears the preset. Provider availability and playbook resources are checked again before launch; changed saved playbooks require review in Settings.

Collaboration opens a fresh retained worktree with no submitted prompt. Suggestions start a read-only CLI with project Git inventory, available open issue summaries and recent session outcomes. Suggestions and reconciliation exclude MCP connections while retaining eligible skills. A launch key is persisted before execution; duplicate requests or a lost response recover the original session, never another process. Reopening a session only reconnects. Interrupted preparation is never restarted automatically.

Reconcile is an explicit repository-writing mode, separate from ordinary worktree sessions. It runs in the existing main checkout when available, otherwise the connected repository, with access to registered worktree folders and the common Git directory. It retains Codex on-request or Claude manual permission prompts. Its prompt directs the CLI to inspect ownership and dirty work, integrate pending commits, resolve unambiguous conflicts, run relevant checks and synchronize local/remote main. It excludes force pushes, destructive resets and automatic cleanup. Existing Git operations, incomplete history/inventory, missing main and ambiguous remotes block launch. Benchmarks expose collaboration only.

After a reconciliation CLI exits successfully, Workbench independently checks local/remote main equality, containment of inventoried commits and clean worktrees. This is Git evidence, not test acceptance: review the CLI check results. Dirty work present at launch, unknown state, failed checks, cancellation, remote failure or interruption remain explicitly unverified. Protected branches and external writers must be handled in the CLI. Quick-action preferences and request records live in `quick-actions.json` in the server data directory; APIs remain network-only.

## Automatic workspace registration

Every new isolated workspace created through Workbench is registered before agent inference: structured Codex/Claude sessions, interactive sessions, collaboration quick actions, workflow attempts and delegation. This applies to existing and newly connected projects automatically. Read-only sessions do not create workspace records. A project folder remains the source context; connecting a project does not create another checkout.

Project **Git → Details → Branches and worktrees** shows managed workspace purpose and durable ID/work reference, existing unassigned workspaces, and retained registrations needing inspection. The registration UUID survives workflow steps/retries and process restarts. Git remains authoritative for files and branches; registration is not acceptance or merge readiness. Legacy workspaces are not silently adopted, and pre-registration workflows cannot launch another writer in an unregistered workspace.

Creation intents are saved in `.data/worktree-notes.json` before Git creation. Registration failures block inference and retain any created folder. **Retry registration** explicitly verifies a retained folder without recreating it or launching a process. If the folder/repository has been replaced or cannot be verified, it stays unassigned or needs inspection. There is no automatic cleanup. Benchmark workspaces keep their separate archive/removal policy and carry their registration snapshot in evidence.

The existing whole-project reconciliation command operates on existing checkouts; this release does not add selected-batch ownership/readiness certification to it. Explicit adoption/continuation of external or legacy work, notes editing UI, legacy aliases/import/export, readiness/evidence review, thresholds, checkpoint receipts and normal worktree retirement remain later work in issues #7 and #9. Registration creates no release number and does not change project version conventions.
