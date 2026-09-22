# Daily briefing

Status: confirmed for solo implementation on 2026-09-22. Supersedes the proposed task list in
`instructions/2026-09-21-daily-briefing-widgets.md`; that document's semantics and test
requirements still apply unless changed here.

Issue: https://github.com/shelbyklein/skd-workbench/issues/13
Tracker Trapper: plan `local:F5660300-649C-4650-8AC3-2C96C0328BB9`, todos DB-01–DB-07

## Outcome

Each project page and Home show a Daily briefing: yesterday's observed work, open loops, and at
most three suggested next steps. Each suggestion has a reason and a link to its source record. An
agent writes the synthesis from a bounded evidence packet; the collected facts remain useful
without the agent. Suggestions link to existing work; they do not create tasks or launch sessions.

## Current behavior (evidence)

- No briefing code exists. Home (`renderProjects`, `public/app.js:191`) shows global pages and
  project cards; project pages mount widgets via `mountProjectWidgets` (`public/app.js:267`).
- User sessions are listed at `server.js:206`: structured runs excluding workflow children and any
  run with a `purpose`, plus terminal and imported sessions. Workflows (`lib/workflows.js`) and
  delegations (`lib/delegations.js`) keep their own run records.
- `IssueProposals` (`lib/issues.js:66`) is the template for an internal agent run: it starts the
  shared executor in read-only mode against a private scratch folder, marks the run with
  `purpose:'issue-proposal'` (disables shell/web for Codex, empty tool list for Claude:
  `lib/codex.js:44`, `lib/claude.js:57`), parses strict JSON, and persists atomically.
- The executor runs one job at a time (`lib/codex.js:64`). Briefing generation must queue behind
  the user's own work instead of failing or preempting it.
- No server timer exists; `lib/git-read.js` provides bounded, sanitized Git reads.

## Scope decisions

- Evidence sources: Workbench structured sessions, terminal sessions, imported sessions,
  workflows, delegations, current open GitHub issues, and **Git commits in the project folder**.
  Tracker Trapper, local Claude/Codex session logs and GitHub event timelines are follow-ons.
- "Yesterday" is the previous calendar day in a configured IANA timezone (default: server zone).
- Sections: Yesterday, Open loops, Suggested today (≤3, each with reason + source reference).
- Explicit Generate works first. Scheduled generation is opt-in and off by default.
- Reading a briefing never starts inference.

## Exclusions and preserved behavior

- No task creation, issue writes, session launches, or project edits from briefings.
- Briefing runs never appear in session lists or in a later day's evidence.
- No replay of missed days; no automatic retry of interrupted inference after restart.
- Existing stores are not migrated; the briefing store is new.
- Loopback binding, origin checks, asset allowlist, network-only API caching, explicit PWA updates.

## Tasks

- [ ] **DB-01 Evidence collector.** `lib/briefings.js` exports `collectEvidence(projectID, date,
  timezone)`: exact UTC interval for the calendar day (correct across DST), Workbench records that
  overlap it (sessions crossing midnight flagged as partial), workflow children and briefing runs
  excluded, unresolved/failed/running records as open loops, per-source coverage
  (`complete`/`partial`/`unavailable` + reason), bounded counts and text.
  *Acceptance:* `node --test tests/briefings.test.js` passes cases for DST spring/fall days, a
  session crossing midnight, workflow-child dedupe, briefing-run exclusion, and empty vs
  unavailable sources.
- [ ] **DB-02 Git source.** Collect commits in the interval from the project folder
  (`git log --since/--until`, author/committer time, bounded count and subject length, no network).
  Non-repository folders report `unavailable`; truncated history reports `partial`.
  *Acceptance:* tests against a temporary repository with commits inside and outside the interval
  return only inside commits, cap at the limit with `partial` coverage, and report `unavailable` for
  a plain folder.
- [ ] **DB-03 Briefing store and endpoints.** `.data/briefings.json` (schema 1, atomic write,
  corrupt file fails visibly). `GET /api/projects/:id/briefing?date=` returns the latest revision
  or `absent`; `POST /api/projects/:id/briefing` collects evidence, stores an `evidence-only`
  revision, and optionally starts synthesis. Concurrent requests for the same project/date share
  one job; failures keep the previous successful revision.
  *Acceptance:* HTTP tests cover absent → generated, concurrent POST dedupe, revision increment on
  regenerate, corrupt store error, and failure preserving the prior revision.
- [ ] **DB-04 Agent synthesis.** Executor purpose `daily-briefing` (tool-free like
  `issue-proposal`, private scratch folder). Queue behind active user execution. Prompt treats
  evidence as data; output is strict JSON `{yesterday[], openLoops[], suggestions[≤3]}` with
  `sourceIDs` validated against the packet. Runs interrupted by a restart become `interrupted`
  and are not resumed. Missing provider access yields `unavailable` while evidence stays shown.
  *Acceptance:* fixture-provider tests: valid output → `ready`; unknown source ID or >3
  suggestions → `failed` with the prior revision kept; purpose excluded from `/api/sessions`;
  restart marks a generating record `interrupted` without relaunching.
- [ ] **DB-05 Widgets.** Project overview widget and Home panel (Home aggregates the latest project
  reports, ranks suggestions across projects, dedupes shared repository issues). States: absent,
  evidence-only, generating, ready, stale (date ≠ today), failed, unavailable. Generate button,
  date and updated time, coverage details. Update `server.js` asset allowlist and bump `public/sw.js`.
  *Acceptance:* browser suite `tests/briefing-browser.mjs` exercises the real Home and project
  routes against a temporary store: absent → Generate → ready rendering, failed state, keyboard
  activation, and a 390px mobile layout without horizontal scroll; screenshots inspected.
- [ ] **DB-06 Opt-in schedule.** Settings for enable, local time, timezone, provider/model/effort.
  A server timer enqueues one batch per day while running; startup generates only today's missing
  briefings; defers while user execution is active. Default off.
  *Acceptance:* injected-clock tests: disabled → no runs; enabled → one batch at the configured
  time; restart after the time → only today; active user run → deferred, not failed.
- [ ] **DB-07 Verify and record.** `npm test` and `npm run test:browser` pass; live UI
  inspection on a temporary data directory; `VALIDATION.md` records fixture vs live evidence and
  limits (server uptime required; outside-Workbench sessions not yet included).
  *Acceptance:* both full suites pass and the `VALIDATION.md` entry is committed.

## Open questions

- Default provider/model for scheduled generation (Generate lets the user pick each time).
- Whether to skip synthesis for projects with no activity and no open loops (proposed: yes).

## Work preparation

- Scope: confirmed by the user on 2026-09-22 ("create a plan, add to git, add to tt, get started").
- Mode: solo. Now/later: now. Branch: `codex/daily-briefing`.
- Remaining questions: see Open questions; neither blocks DB-01–DB-03.
