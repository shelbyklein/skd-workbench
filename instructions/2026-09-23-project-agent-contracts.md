# Project agents — verified contracts and additive schema (PA-01)

Issue: https://github.com/shelbyklein/skd-workbench/issues/14 · Plan: `instructions/2026-09-23-project-agent-operating-model.md`

Source inspection on 2026-09-23 at `main` 375d6f8 (worktree `codex/project-agents`). Symbols are cited rather than line numbers.

## Canonical sources

| Concern | Canonical owner | Notes |
| --- | --- | --- |
| Project identity and version | `lib/store.js` `Store` (`store.json`, `projects[]`) | `{id,name,folderPath,version}`; every edit bumps `version`; stale edits return 409. |
| Workflow definitions | `Store.flows[]` | `version` per flow; controller-created flows carry `controllerOrigin` and a `controllerReceipts` entry. |
| Agent profiles | `lib/playbooks.js` `Playbooks` (`playbooks.json`, schema 2) | Store-wide `revision`, per-entry `version`, `archived`, `scope` (`global`/`project` + `projectID`), 50-entry `history`. Reusable configuration, not an owner. |
| Controller grants | `lib/controllers.js` `Controllers` (`controllers.json`) | Hashed bearer token, `projectIDs`, capabilities `read`/`manage`/`run`, `revoked`, `version`. `check()` is re-run before and after each command. |
| Controller operations | `Controllers.data.operations` | Durable `requestKey` + input fingerprint; `recover()` resolves `preparing` operations to `accepted`/`completed`/`uncertain` without replay. |
| Workflow runs | `lib/workflows.js` `Workflows` (`workflows.json`) | Immutable `flow`, `projectSnapshot`, `sourceContext`, `agentContexts`, `controllerOrigin`; `revision` per change; restart marks `interrupted`/`cancelled`. |
| Execution ownership | `lib/codex.js` `CodexRuns` `owner`/`active`/`starting`/`cleaning` | One executor across sessions, workflows and delegations. `Workflows.start` rejects with 409 when any is set. |
| Lifecycle, evidence | `lib/lifecycle-*.js` | Workspace records keyed by repository; evidence reports distinguish `observed` from agent-reported; receipts per repository. |
| Issue definitions | GitHub (`lib/issues.js`, read-only) | Browsing never publishes. |
| Execution checklist | Tracker Trapper (external) | Not mirrored in Workbench. |

## Overlapping fields

- **Owner vs Agent profile.** `playbooks.json` already stores a named, versioned, scoped specialization. The mandate references it by `{id, version}` rather than copying prompt, skills or connections. Assigning an owner grants nothing.
- **Task references.** Runs use `workRef` (`local:<runID>`), delegations use `taskRef`, lifecycle records carry `taskID` and `sourceRefs`. Mandate task references are opaque strings (`github:owner/repo#N` or `local:<id>`), compared exactly, and copied into the run origin; they are not a second backlog.
- **Limits.** Runs already carry `maxAttempts` (1–60). The mandate adds an upper bound and a runtime cap; it does not replace the run field.
- **Origin.** `controllerOrigin {operationID, controllerID, controllerName}` is the immutable caller record. Mandate binding extends it with `mandate {id, version, taskRef, agentProfile}` rather than adding a parallel field.
- **Revisions.** Store-wide `revision` (Playbooks) plus per-record `version` (projects, flows, profiles, grants). Mandates follow the same pattern.

## Execution constraints to preserve

1. One executor. Mandates never bypass `Workflows.start`'s ownership check; a busy executor returns 409 to the controller, which is its waiting state.
2. Preview/start fingerprint. `ControllerCommands.preview` hashes input, context, source, project and flow; `start_run` re-previews before persisting (`beforePersist`). Mandate state joins the fingerprint so an edit between preview and start is rejected.
3. Idempotency. `Controllers.operation` reuses the same request key; a key reused with different input returns 409. Recovery inspects operation and run IDs; nothing is replayed.
4. Grant checks run before preview, before persist and after the command; revocation therefore blocks launches already in flight.
5. Human and check gates remain HTTP/UI-only (`Workflows.action`); the controller catalog exposes no approve tool.
6. Structured workflow agents remain MCP-free (`contexts()` records connections as excluded).
7. Restart: `Workflows` constructor marks active runs `interrupted`; `ControllerCommands.recover` marks unknown outcomes `uncertain`.

## Additive schema: `project-mandates.json`

```json
{
  "schema": 1,
  "revision": 0,
  "mandates": [{
    "id": "uuid",
    "projectID": "project id (one mandate per project)",
    "version": 1,
    "enabled": false,
    "agentProfile": {"id": "profile id", "version": 3},
    "objective": "≤ 4 KiB",
    "tasks": [{"ref": "github:owner/repo#14", "title": "≤ 200 chars"}],
    "workflowIDs": ["flow id"],
    "modes": ["read-only"],
    "escalation": "≤ 4 KiB",
    "limits": {"maxAttempts": 3, "maxRuntimeMinutes": 60},
    "report": {"detail": "summary|full"},
    "instructions": "standing instructions ≤ 8 KiB",
    "history": ["previous versions, newest last, ≤ 50"],
    "createdAt": "ISO", "updatedAt": "ISO", "updatedBy": "user"
  }]
}
```

- `tasks` order is priority order; at most 50 entries.
- `modes` ⊆ `read-only`, `worktree` (the existing workspace modes, the only execution action classes Workbench grants today). Merge, push, deploy, cleanup and gate approval are not representable.
- Default is disabled. Saving never calls the executor.
- Writes are atomic (`.tmp` + rename, mode 600) with a `.bak` copy of the previous file; unknown schema or malformed records fail startup visibly.
- Edits happen only through the loopback UI API (`/api/projects/:id/mandate`). The controller catalog gains a read-only `get_project_mandate`; `manage` does not allow changing authority.

## Binding to execution (PA-03)

`preview_run` / `start_run` accept an optional `mandate: {version, taskRef}`. When present, before preview, before persist and at start:

- mandate exists for the project, `enabled`, and `version` matches (stale → 409);
- `taskRef` is listed; `flowID` is listed; `mode` is permitted; `maxAttempts` ≤ limit;
- profile exists, is visible to the project, is not archived, and its version still matches;
- no unfinished run already claims the same mandate task (duplicate claim → 409; inspect the existing run).

The accepted run stores `controllerOrigin.mandate` and `deadlineAt`. After the deadline, no further agent attempt launches and the run fails with a runtime-limit error; a running attempt is not killed (stopping remains explicit). Controller calls without `mandate` keep today's behavior, and user-started workflows are unchanged.

## Project conversation (PA-04)

User decision 2026-09-23: the project agent conversation is a saved thread, answered by the external coordinator; Workbench runs no inference for it.

- `project-threads.json` (schema 1): one thread per project, append-only messages `{id, author: user|agent, text ≤ 8 KiB, refs[], createdAt, requestKey, controllerID?}`, newest 1000 kept with a `trimmed` count. Atomic 0600 writes with `.bak`; a damaged file fails startup.
- Posts are idempotent per author and request key; a reused key with different content returns 409. Run links must name a run in the same project; other links (`issue`, `workflow`, `session`, `operation`) are opaque references.
- Controller tools: `list_messages` (read) and `post_message` (manage). Messages are context, not authority: they cannot change a mandate or start work.
- `GET /api/projects/:id/agent` derives the owner line, decisions (runs waiting for review, failed or interrupted runs, owner Agent drift), current work, unclaimed mandate tasks and the latest finished run from canonical records. Nothing is stored separately.
- The UI keeps one unsent draft per project in memory and `sessionStorage`, with a stable request key until it is sent.

## Home and coordinator (PA-04, after visual acceptance)

- `GET /api/agents/overview` applies the project derivation to every connected project and returns counts, cross-project decisions, project owner rows (projects with a mandate, active work or decisions) and the five most recent finished runs.
- The coordinator thread uses the reserved thread key `coordinator`. `list_coordinator_messages` (read) and `post_coordinator_message` (manage) require a controller grant for every connected project, because the thread can mention any of them. Its record links may name runs in any project and `project` references.
- Project Overview folding (user direction 2026-09-23): priority issues sit under Up next, the last session and Import under Recent result, and the Git widget is the strip under the heading. The Project views grid was removed because the sidebar has every view link.
