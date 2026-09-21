# Daily briefing widgets

## Prompt for Claude

Status: proposed design following source inspection on 2026-09-21. Not authorization to implement, dispatch, run inference, or publish. Preserve unrelated uncommitted changes and recheck the active playbooks worktree before implementation.

### Outcome
Show a Daily briefing on Home and each project overview: yesterday's observed work, unresolved items, and a short ranked list of suggestions for today. Suggestions link to existing work; they do not create tasks or launch sessions. Home prioritizes across projects using the same project briefing revisions.

### Current system
- `public/app.js:223` loads the last session; `mountProjectWidgets` at line 234 and `renderProjectOverview` at line 240 provide existing project widget integration. Home is rendered by `renderProjects`.
- `server.js:111` merges structured user sessions and terminal sessions, excluding workflow children and internal proposal runs. Collect workflow records separately and deduplicate child attempts.
- `lib/codex.js:71` captures structured run timestamps, project identity, output and activity; `lib/workflows.js:29` exposes run summaries with full detail available separately.
- `lib/terminals.js:11` and `:31` bound terminal output; `:60` marks completion from process exit. Neither proves task acceptance or a complete transcript.
- `instructions/2026-09-21-playbooks-and-session-activity.md` proposes richer activity capture. Integrate its actual delivered interface when available; do not implement a second activity ledger.
- README states the local server must be running. Current source inspection establishes widget and execution foundations, not a working daily scheduler or briefing service.

### Ownership and first slice
Implement one fixed daily-briefing routine and shared renderer before a general routine builder or customizable widget dashboard. The routine owns collection, synthesis and saved reports; widgets only read reports and offer explicit regeneration.

Source records remain authoritative. Saved briefings are versioned generated artifacts, not replacement task state. Store project ID, report date, IANA timezone, exact yesterday interval, current-state cutoff, source references/fingerprint, coverage/gaps, generatedAt, generator/prompt version, model selection, usage when reported, and report sections. Store report revisions atomically; Home records which project revisions it aggregates. Keep previous successful reports on errors. Do not fabricate old daily records from current issue state.

Use Workbench sessions and workflows for yesterday's evidence, plus current open issues and unresolved runs for today's suggestions. Preserve no-activity versus unavailable-data distinctions. Existing issue fetching is paginated; bound collection and expose incomplete coverage. External IDE work, Git history and GitHub event timelines are follow-ons with explicit source adapters.

### Ordered work and acceptance
- [ ] DB-01: Build a bounded evidence collector. Calendar-day intervals respect configured timezone and DST; sessions crossing midnight are included without claiming all their work happened yesterday. Current open issues are timestamped context, not historical accomplishments. Workflow children and internal report runs are not double counted. Source IDs remain project-scoped.
- [ ] DB-02: Add a validated briefing artifact store and guarded read/generate endpoints. Concurrent requests deduplicate by scope/date/generation key; explicit regeneration creates a revision. Failures and corrupt data are visible. Interrupted jobs never resume provider execution on restart. If modifying existing stores, provide migration backups and stale-write tests.
- [ ] DB-03: Implement bounded synthesis over a captured evidence packet. Reuse verified provider lifecycle and executor ownership where appropriate; inspect existing adapter assumptions before adding a report purpose. No project edits, enabled MCP tools, automatic issue writes or interactive prompts. Internal runs must not pollute session widgets or recursively enter tomorrow's briefing. Missing provider access yields a clear unavailable state with collected facts still usable. Validate structured output and source IDs; treat input text as data. Do not assume read-only workspace permission implies tool-free inference.
- [ ] DB-04: Render project and Home widgets with Yesterday, Open loops, and Suggested today sections; limit suggestions to three with a reason and source link. Home aggregates project reports, deduplicates shared repository issues while preserving distinct worktree scope, and shows partial coverage. Include date, updated time, source details, loading, absent, stale, generating and failed states. Merely reading a widget never starts inference.
- [ ] DB-05: Add opt-in daily generation with selected provider/model/effort, timezone and local time. A server timer enqueues one bounded batch while running; startup catches up only today's missing briefing. Do not replay missed days or retry interrupted inference automatically. Defer to active user execution. Default automatic generation off until configured; explicit Generate works first. Show that server uptime is required. Save generation intent/results so tabs and timer cannot duplicate paid work.
- [ ] DB-06: Verify and record evidence. Use injected clocks, temporary stores and fixture providers, then inspect desktop/mobile and keyboard behavior. Update `VALIDATION.md`, explicit asset allowlist and `public/sw.js` if shell assets change.

### Required semantics and tests
Test DST, midnight boundaries, timezone changes, empty/legacy/truncated records, unavailable GitHub, pagination caps, process success without acceptance, pending reviews, failed and interrupted runs, concurrent generate requests, stale results, restart recovery and partial global batches through real service/HTTP entry points. Recommendations are labeled suggestions; never infer dependency or completion without evidence. Missing telemetry is unknown. Preserve normal execution ownership, unsaved drafts, navigation, network-only APIs and explicit PWA updates.

Start with focused Node and browser suites; run `npm test` and `npm run test:browser` for integrated delivery. Record fixture and live evidence separately. No paid provider smoke run or live restart follows from this planning document.

### Follow-ons and decisions
Proposed defaults: yesterday means the previous calendar day; today's suggestions use current known state; automatic timing is user-configured. Later consider previous working day, report history UI, external activity adapters, richer accepted activity records, configurable widgets, and reusable routine definitions. A background operating-system service is separate work if reports must generate while the server is stopped. The issue board remains the task owner.
