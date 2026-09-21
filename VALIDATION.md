# SKD Workbench 0.5.0 — real Codex workflows, 2026-09-20

## Delivered

Saved workflows now execute sequentially through Codex with explicit per-step model/effort mapping, immutable launch snapshots, full prior-output/review-note handoffs, a shared isolated coding worktree, human review pauses, bounded change requests, manual verification gates, retained attempts and aggregate usage. Existing simulations and single-task runs remain separate. Flow design now offers Run with Codex as its primary action; Try flow stays a preview.

Failed/interrupted steps require an explicit retry. A workflow owns the executor until it finishes or is stopped, including while waiting for human review. Stale review revisions are rejected. Overall agent-attempt cap and existing runtime/output caps are enforced; none is represented as a token/dollar limit. Oversized handoffs fail visibly without truncation. Startup retains review gates and marks active steps interrupted without relaunching paid work. Prior attempt output remains inspectable if the server stopped between child completion and workflow advancement; retry may repeat that step, so the UI directs inspection first.

## Evidence

- Full Node suite passed **33 tests**. Final focused workflow suite passed **8 tests**, including two subsequently added checks for active-child cancellation and oversized handoff (35 combined tests). Other workflow checks cover actual subprocess handoffs, shared-worktree edits/source preservation, bounded revisions, evidence-required Check steps, usage aggregation, immutable mapping, invalid model rejection, stale revisions, attempt caps, provider failure, review recovery and stopping during discovery before a paid launch.
- All **seven Chrome browser suites** passed: six established suites passed in the regression run; the new workflow suite passed after correcting its asynchronous history assertion and passed again against final UI changes. Covers explicit mapping, launch, escaped output, review-note preservation, retries/retained attempts, reload at a gate, verification evidence, aggregate usage, scoped history and 390px layout. No page errors.
- Manual **real Codex** workflow (`scripts/smoke-workflow.mjs`) executed through the browser form using installed CLI/ChatGPT auth, gpt-5.6-sol low. First agent read a code; the flow paused before any second call/file creation. After an explicit test review action, the second agent used the prior output to create `handoff.txt` in the **same worktree**. Exact bytes checked; original checkout unchanged. Final review completed the workflow.
- Real reported usage across two attempts: **78,108 input**, **455 output**, **46,080 cached input**. Total **78,563** = input + output; cached input is already included. Both attempts reported usage. This is a smoke-test observation, not a price quote or controlled model-efficiency comparison.
- Receipt: ignored `output/workflow-live-receipt.json`. Inspected screenshots: `output/workflow-live-review.png`, `output/workflow-live-result.png`, `output/workflow-fixture-desktop.png`, `output/workflow-fixture-mobile.png`, and deployed `output/workflow-live-entry.png`.
- Local app activated at `http://127.0.0.1:4390`, reporting v0.5.0 with no page errors. Checked no active Codex tasks before restarting. Existing `.data/store.json` SHA-256 before/after activation: `f39bdfcf4967285e187ddbb8a42858e75e67eff2248a31df956cd32b2f421f67`. No user flow migration/replacement. New workflow history is in `.data/workflows.json`; child executions remain in `.data/codex-runs.json`.

TT plan: `local:A8F03069-7FC7-46B1-9A4D-ABF7578081F5`; run `2FBADA5A-FAA6-4A99-A393-E22BD045E8BD`; TT-WORKFLOW-01 through 03. Session watcher linked to verified current session; explicit progress maintained.

## Remaining increments

Other providers, real-run comparison UI, dollar estimates, automatic merge and independent automated test verdicts remain unimplemented. Check steps record human-provided evidence. Codex-only model review is possible by choosing different Codex models per agent; no Opus/Fable provider support is implied. Every worktree is retained for review; no automatic cleanup removes unfinished changes. Existing PWA windows use Update app after saving drafts.

---

# SKD Workbench 0.4.0 — real Codex execution, 2026-09-20

## Implemented and activated

One real task at a time, scoped to a connected project. Installed CLI model/effort discovery; read-only or isolated Git worktree mode; durable task/output/activity/provenance; reported input/cached/output/reasoning token categories; cancellation, runtime/output limits and interrupted recovery. Codex child supervisor stops the process group if the server parent disappears. Existing multi-step flows remain explicit simulations. No automatic merge, push, multi-provider review, real-run comparison UI or dollar estimate.

## Verified evidence

- Full Node run: 26 tests passed. After adding the server-parent-loss test, all 8 focused Codex tests passed (27 tests in the combined suite). Covers subprocess output/usage persistence, model/concurrency guards, clean worktree isolation and source preservation, cancellation, failure, restart interruption, timeout and orphan-process prevention.
- All six Chrome suites passed: editor, simulation runs, accessibility, projects, PWA, Codex. Codex fixture tests exercise project requirement, model/effort controls, HTTP submission, escaped output, measured usage, reload/history, repeat task, cancellation, narrow viewport and no page errors.
- Two manual **real installed Codex CLI 0.155.1 / ChatGPT-authenticated** tests used the browser form and HTTP runner with isolated fixture repositories. Both used provider-advertised default `gpt-5.6-sol`, low effort. No Newton or TT project work was executed.
  - Read-only task: read fixture text; completed in about 7 seconds. Reported input 29,809; cached input 25,344; output 106; reasoning output 0. Exact file remained unchanged.
  - Coding task: replace one line in an isolated worktree; completed in about 20 seconds. Reported input 77,936; cached input 71,936; output 467; reasoning output 8. Verified exact new bytes, captured diff, original checkout unchanged. Provider output records a failed patch attempt followed by successful correction; usage includes the whole turn.
- Cached input is included in input; reasoning output is reported separately but is not added to the input-plus-output total. These are smoke-test observations, not a model-efficiency comparison or billed dollar amounts.
- Real receipts remain in ignored `output/codex-live-receipt.json` and `output/codex-worktree-receipt.json`. Fixture stores/worktrees are retained under the receipt paths. Screenshots inspected: `output/codex-real-worktree.png`, `output/codex-fixture-mobile.png`, and deployed `output/codex-live-entry.png`.
- Live port 4390 reports v0.4.0; CLI/login/model discovery also succeeds from the launchctl-started server. Live UI has no page errors. Existing store SHA-256 immediately before and after activation: `f39bdfcf4967285e187ddbb8a42858e75e67eff2248a31df956cd32b2f421f67`. No user-data migration or replacement.
- PWA cache bumped to `skd-shell-0.4.0`, including the new UI module. Existing installed windows use the explicit Update app action.

## Tracking and limitations

TT local plan `local:746CE59D-A26D-4718-8364-1F4CAFF0A9BE`; run `199324FC-2B07-4D67-A6D7-C91F26326D0B`; todos `TT-CODEX-01`–`TT-CODEX-03`. Own session verified; watcher reports Watching session output. Explicit milestones and completion evidence recorded.

Model catalog is advertised availability, not guaranteed entitlement. Only the two recorded Sol/low invocations are live-provider verified. Codex credentials remain in the CLI, not the app store. Partial/failed runs without a completion usage event display unknown tokens. Runtime/output limits are not spending caps. Worktrees and modifications are retained for human review; dependencies, network access and task-specific tests depend on the project and CLI sandbox. Old source/data are preserved; reverting the PWA requires a newer cache version/cleanup worker, not merely deleting its assets.

---

# SKD Workbench 0.3.0 — installable PWA, 2026-09-20

## Delivered and verified

- Standalone manifest with stable origin identity, normal/maskable PNG icons, Apple touch icon, run-history shortcut and install action. Browser installation prompt when exposed; external-browser help otherwise. Installed-mode UI hides install action.
- Versioned service worker caches only ten public shell assets. All API methods remain network-only; no project data cache, background sync or queued writes. Offline startup offers launch/reconnect instructions. Failed saves and reconnection preserve drafts in the open window.
- Updates wait for explicit Update app. Drafts, review notes, open dialogs and active actions block reload. Another open window keeps its draft and receives its own reload action.

## Acceptance evidence

- `npm test`: **19 tests passed**, including manifest MIME/identity/standalone display, PNG dimensions and health route, plus existing data/Git/API coverage.
- `npm run test:browser`: **all five Chrome suites passed** (editor, run, accessibility, projects, PWA). Final follow-up PWA suite also passed after strengthening asynchronous reconnect protection and adding a second-window update assertion.
- PWA suite uses an isolated persistent Chrome profile, temporary data and copied shell assets. Chrome DevTools reports **no manifest or installability errors**. Tested offline reload, API 503 responses, shell-only cache entries, no delayed write after reconnection, actual local-server stop/restart preserving editor text, waiting worker, draft-blocked update, explicit activation, old-cache cleanup, retained draft in another window, install fallback and simulated standalone visibility.
- Live server reports v0.3.0 at `http://127.0.0.1:4390`. No browser runtime errors. Desktop/mobile screenshots captured and visually inspected; 390px layout has no horizontal overflow. Offline-startup screenshot also inspected.
- `.data/store.json` SHA-256 before/after restart: `7f89735c273e5cf74becc1b7c9a83c89000e83cf16ec5798d9687a643efb9543`. No migration or user-data edits.
- Screenshots: `output/skd-pwa-live.png`, `output/skd-pwa-mobile.png`, `output/skd-pwa-offline.png`.

## Boundaries and tracking

Installability is verified; no actual installation into the user's browser profile or Dock was performed. Use Chrome/Edge's installation confirmation. The local server remains necessary for project/workflow/Git operations. No automatic login service, remote hosting or model execution was added. Existing simulation limits remain unchanged. The background server uses the existing transient launchctl job.

TT plan `local:30E87383-7820-4597-823B-CA2324060469`; run `89DC941A-F139-4CD8-A4F2-E843B7E8C9DB`; stable todos `TT-PWA-01` through `TT-PWA-03`. Explicit task reporting succeeded. Session identity was verified and linked; the automatic watcher rejected a JSONL record exceeding 2 MiB even after relinking, so automatic activity collection is unavailable for that record. Explicit completion evidence remains recorded.

---

# SKD Workbench 0.2.0 — project scopes, 2026-09-20

## Delivered and verified

- Renamed browser title, sidebar branding, package and launch entry to SKD Workbench. Source directory stays `/Users/shelbyklein/Vibes/flow-bench`; older launcher remains compatible.
- Project picker scopes workflows/history; add/edit validated canonical local folder, inspect/refresh Git, move workflows while keeping historical runs in their original scope.
- Read-only Git detection records repository root, common Git directory, branch/detached state, commit, clean/dirty/unknown status and sanitized remotes. Supports worktrees and folders without Git. Missing folders block new runs until reconnected. No provider or Git network/write operations.
- New runs preserve original project/folder/Git snapshots. Comparisons disclose different projects, folders, commits and unknown/dirty code context.

## Acceptance evidence

`npm test`: **18 tests pass**. Includes migration backup/preservation/idempotence; optimistic project revisions; moves and frozen project identity; code comparison keys; real Git fixtures for ordinary/worktree/non-Git/dirty/detached/unborn states; index byte preservation; remote credential/query sanitization; actual HTTP project and run endpoints.

All four Chrome scripts pass: `tests/editor.mjs`, `tests/browser.mjs`, `tests/accessibility.mjs`, `tests/projects-browser.mjs`. Existing flow/run functionality, keyboard/mobile/reduced motion, and new project add/edit/refresh/move/scope/reconnect/provenance behavior exercised in temporary stores. New project fixtures are test repositories, not the real Newton or TT checkouts.

Inspected screenshots: `output/skd-project-desktop.png`, `skd-project-mobile.png`, `skd-project-details.png`. Live runtime captured and inspected at `output/skd-live-desktop.png` and `skd-live-mobile.png`: correct title, Unassigned selected, two preserved flows, no browser errors, no 390px horizontal overflow.

## Real store migration and activation

Schema 1 → 2 verified in the real `.data/store.json`: **2 flows → 2 flows; 0 runs → 0 runs**. All pre-existing record fields preserved, workflows assigned to Unassigned. The migration backup SHA-256 matches the original bytes: `509726bd34ed41661149715f4261d489a70cf77d8cdb711d07e5d0563879da8c`. Backup: `.data/store.json.schema-1.ba250292-ed2b-46c3-a59b-b66901d0a478.backup.json`. Receipt: `output/projects-migration.json`. Data/backup/screenshots remain ignored by Git.

Running at **http://127.0.0.1:4390**, verified via HTTP and Chrome. A transient macOS launchctl job (`com.shelbyklein.skd-workbench`) keeps this local process independent of the Codex terminal. No login-item plist installed. Stop using `launchctl remove com.shelbyklein.skd-workbench`; relaunch with the new command or npm start. Logs in `output/server.log` and `output/server-error.log`.

TT plan: `local:E14EF694-2752-4ACC-8578-5A600CBDE79B`; run: `B56E9CD2-2550-4E33-9D66-930CC9DDD6E6`; todos `TT-SKD-01`–`TT-SKD-04`. Existing Orchestration Bench source remains clean and untouched.

## Limits

User chooses the actual Newton/TT folder; none was auto-connected to a guessed checkout. Git connection is detection, not remote configuration or provider authentication. Inspection samples current state; it does not freeze/copy project files. Workflows remain simulation-only with unknown usage/cost. No public deployment or GitHub publication.

---

## Historical 0.1.0 delivery

# Validation receipt — 2026-09-20

## Delivered

Standalone Flow Bench 0.1.0, local only. Source lives in `/Users/shelbyklein/Vibes/flow-bench`. Local server launched on `http://127.0.0.1:4390` and opened in the browser. Node reports v26.5.0 in the final verification shell. Runtime has no third-party dependencies. Chrome browser tests use Playwright 1.63.0.

## Passing evidence

- `npm test`: 9 passing Node tests. HTTP flow/run persistence; stale revisions; Host/origin restrictions; immutable snapshots; review pause and bounded retries retaining attempts; cancellation; empty-flow rejection; historical runs surviving flow deletion; corrupted store preservation.
- `node tests/editor.mjs`: Chrome verified create, duplicate, rename, model/effort/instructions editing, save/reload, reorder/remove, empty-flow run guard and 390px overflow.
- `node tests/browser.mjs`: Chrome verified task creation, paused human review, required change note, retry and previous attempt visibility, reload, completion, cancellation, exact same-task rerun, history, matching/mismatched comparison and mobile rendering.
- `node tests/accessibility.mjs`: Chrome verified keyboard focus ring, Enter activation, dialog focus containment, Escape and focus return, dirty-navigation protection, review-note preservation while inspecting output, mobile creation/editor, reduced-motion behavior, no console errors.
- Final local runtime smoke check: page title `Flow Bench`, six starter-flow cards, same app served at port 4390. Captured `output/live-desktop.png` from that running instance and visually inspected it.
- Inspected desktop editor, review state, comparison, mobile editor and mobile inspector screenshots under `output/`.
- Existing Orchestration Bench Git checkout remains clean. No existing bench or Tracker Trapper application source was edited.

## Boundaries

This delivers the first slice agreed in the conversation: flow authoring and simulation. No paid benchmark, CLI/API model execution, actual model-output review, real task test execution, provider availability verification, or token-cost measurement occurred. Simulation outputs are placeholders, human review decisions apply to the walkthrough, and usage is unknown. Simulation time includes human delays. No automatic quality winner is calculated.

No public deployment, remote repository, GitHub issue, or automatic login service was created. A local source commit records this delivery. User flows/runs in `.data/` and generated screenshots in `output/` remain uncommitted. The source/test receipt is reproducible; tests use temporary stores.

## Tracker Trapper

Plan: `local:506F97BB-F6B9-43DB-B710-2C44F69D1B1E`.
Session run: `A02EBCD0-ED67-4929-8A86-9416935A9503`.
Stable todos: `TT-FLOW-01` through `TT-FLOW-05`.
Implementation mode: solo, authorized now. No subagents dispatched.

## Launch again

Double-click `Launch Flow Bench.command` or run `npm start` here. Stop with Ctrl-C in the server terminal. One server per data directory. Backup `.data/store.json` while stopped. Alternate port: `PORT=4391 npm start`.
