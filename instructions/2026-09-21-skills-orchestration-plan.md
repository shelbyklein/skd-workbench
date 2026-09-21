# Global and project Skills — individual orchestration plan

## Prompt for Claude

### Orchestration preparation and integration rules

This is an individual, standalone plan split from the combined resource/graph handoff. It is the active execution entry for this feature; the combined handoff remains historical coordination context. Planning is complete, but no implementation, dispatch, provider usage, issue publication or server activation is authorized by saving this document. No specific model has been selected for its roles.

Before execution, read AGENTS.md, README.md and VALIDATION.md; inspect current Git status, branches/worktrees, active runs and source drift. The previous inspected baseline was `codex/github-issues` at `d7edd1de5c0d69145218084669c4cdf5f13045f1` with substantial pending work. Establish a reviewed prerequisite baseline before creating isolated codex/ task worktrees; preserve unrelated dirty work and the other task's detached publication checkout. Never reset, stash, overwrite or take over another task's unfinished work.

Assign one integration owner. Freeze server payloads, mount lifecycle (`dispose`, `isDirty`, `isPending`), scope/identity and test fixtures before parallel edits. Workers own only assigned files. Shared server.js, app.js, style.css, package/lockfiles, public/index.html, public/sw.js, existing provider adapters and shared tests require explicit exclusive ownership and serial integration. Other feature plans may be active: coordinate rather than independently claiming those files. At most three child lanes may run alongside the integration owner across the whole implementation; a validation lane can replace a completed worker.

On authorized tracked execution, retrieve/register this feature's exact checklist and stable IDs without duplicating prior plans. Follow repository Tracker Trapper rules: each session's own run and verified JSONL watcher, task start before work, completion immediately after acceptance, periodic activity and honest finish status. This preparation created no tracker records or GitHub issues. Existing runtime dependency IDs are references, not grants to take over their owners.

Run focused temporary-store/fixture checks before the relevant full suites. Inspect actual rendered UI for visual changes. Keep APIs network-only and updates explicit; cache changes preserve unsaved drafts. A later authorized local activation must inspect active execution and protect data before restart. Rollback preserves new records and requires schema compatibility. No implicit merge to main, push, deployment, real inference or automatic issue closure.

Each worker returns its baseline/worktree, scoped commits/files, exact test evidence, inspected screenshots where relevant, limitations and dependencies. The integration owner reports implemented/tested/activated and fixture/actual-provider evidence separately. Do not mark dependent todos complete from placeholders or old test receipts.

### Feature-specific orchestration

Own global/project skill discovery, managed instruction CRUD, explicit assignments and supported provider delivery. The corrected graph feature provides visualization only and injects no knowledge. Remove all dependency on a curated knowledge store or combined knowledge budget.

| Role | Owned work |
| --- | --- |
| Integration/provider owner | `lib/agent-context.js`, provider/terminal/workflow/domain integration and shared-file wiring |
| Skills worker | `lib/skills.js`, `public/skills-ui.js`, `public/skills.css`, feature unit/browser tests |
| Validation worker | Independent assignment/delivery fixtures and regression evidence; reports source failures to owners |

Sequence: freeze scope, stable assignment IDs and resolver output → Skills worker implements inventory/store/CRUD while validation builds isolation fixtures → add project/provider/step selection → integration owner proves and wires supported delivery → end-to-end validation. Provider file ownership is shared with the graph and MCP plans, so adapter edits integrate serially through one owner.

Preserve `SKD-SKL-01` through `SKD-SKL-05`. Native discovery does not prove activation. Saving assignments grants no tools. Prompt-free sessions must stay prompt-free; unsupported instruction-delivery modes are explicit and retain unmet acceptance. No graph, MCP or multi-agent-engine implementation is required for this library's first useful slice.

Navigation owner supplies shared Home/project entry points and cache/allowlist wiring. Final delivery tests must exercise actual launch entry points with fake providers: exact frozen skill version, explicit empty selection, cross-project exclusion, stale revision, byte budget, next-launch removal and preservation of current sessions/history.

### Full feature contract and acceptance checklist

Status: investigated implementation proposal; no implementation authorization. Target `/Users/shelbyklein/Vibes/skd-workbench`. Read repository guidance and `2026-09-21-navigation-orchestration-plan.md`; preserve unrelated pending edits. Do not edit Newton or user/provider skill files as part of this feature.

### Outcome and first useful slice

Home → Skills shows global managed instructions and discovered skill files; project Skills shows project files, applicable global entries and project assignments. Users can inspect provenance, create/import/edit managed instruction entries, and choose what future sessions/workflow steps receive. Saving a skill grants no tools or account permissions.

First slice: a useful, truthful inventory and managed library with saved assignments. Delivery is the second milestone and must be validated before displaying “Included in launch.” The complete feature includes supported provider delivery; an inventory alone does not complete it.

### Confirmed evidence and adaptation from Newton

- Workbench's `lib/settings.js:23` discovers bounded instruction previews but not a skill library. `public/agent-card.js` supplies provider/model/effort UI, not persistent bot identities. `lib/workflows.js:38–43` keys agent configuration by stable step ID. Workbench has sessions, flow steps and issue roles, not Newton's persistent bots.
- Newton `docs/skills.md` and `src/SkillsView.tsx:267–327` distinguish saved instructions from inherited files and explain fresh-session semantics. `crates/newton-core/src/skills.rs:108` validates assignments/revisions; `:220` assembles bounded launch text. Local reference root: `/Users/shelbyklein/.newton-dev/development/workspace`.
- Newton imports instruction text only, limits each entry to 16 KiB and assigned serialized context to 32 KiB, and does not claim assignment disables inherited copies. Reuse these boundaries. Do not copy its bot schema or claim to install native provider packages.
- Workbench `lib/terminals.js:13–17` launches interactive Codex with native configuration; interactive Claude uses safe mode, empty strict MCP and disabled slash commands. Headless `lib/codex.js:86` ignores user config/rules; `lib/claude.js:56` uses restricted/safe mode. Discovery is not proof these paths load a skill.

### Ownership, discovery and data

Add `lib/skills.js` and `.data/skills.json` with schema/library revision, managed entries, version history and scoped assignment policies. Each managed entry has stable ID, version, global/project scope, name, description, instructions, source/import metadata, timestamps and optional archived state. Import is a deliberate copy of at most 16 KiB UTF-8 text, never installation/execution of scripts or assets. Show unresolved relative-file references before assignment. Editing a global entry identifies its affected projects and applies only to future launches.

Discovered files remain external facts, refreshed explicitly. Inventory the selected provider's documented skill locations and recognized project/ancestor `.agents/skills`, `.codex/skills`, `.claude/skills` paths where applicable; verify actual installed provider discovery semantics before labeling a path provider-supported. Do not recursively crawl the home directory. Use bounded candidates (initially 500 entries / 16 KiB metadata preview), configured allowed roots, canonical path identity and cycle detection. Handle established symlinked skill installations only when their resolved target is in a recognized allowed root; otherwise show unavailable. Never silently escape into arbitrary files. Test newline/Unicode names and duplicate names at different paths.

Read metadata without executing scripts, loading plugins or following Markdown instructions. Provide a separately requested bounded body preview. Use a real safe frontmatter parser without custom tags; declare direct dependencies instead of relying on Graft's transitive packages. Identity combines canonical path and provider/source, not display name. Read failures and omitted plugin-bundled skills are explicit; never imply exhaustive runtime inventory.

Managed assignments reference managed entry IDs. Discovered native packages are initially view-only; to make a managed entry, explicitly Import instruction text. Keep their original scope/path visible. An imported copy does not track later file edits and may lack required supporting files. Removing a managed assignment does not disable a native copy.

### Assignment and launch rules

Use project defaults keyed by provider plus explicit launch overrides and workflow-step overrides. Defaults have a single owning representation in the skills store; per-step selections live with the saved flow definition and are frozen with it. Extend `validateFlow`/save paths without losing fields. New entries and migrated old flows have no assignments. Treat override as `inherit` or `replace` (including explicit empty), not an ambiguous union. Project/global exclusion is a hard deny.

Workflow targets are `(flowID, stepID)` and sessions use per-launch selection. Do not invent bot records or bind assignments to display labels/model names. For issue planning/work, resolve against the actual launch purpose through existing `lib/issue-work.js`; unimplemented orchestration remains unimplemented. Issue-edit proposals default to no skill injection, preserving their confined drafting contract.

Before spawn, `lib/agent-context.js` resolves authorized IDs, verifies revision and scope, and enforces a 32 KiB serialized skills budget. Persist exact instructions, version IDs and exclusions in the immutable context snapshot. Over-limit or missing explicitly selected skill stops launch visibly; no truncation, dropping or silent fallback. Enforce the skills context budget and adapter input limits; report oversized selections before launch.

For structured runs, append the managed section to the existing server-built prompt; preserve user-task boundaries and explain that instructions do not grant permissions. For workflows, use the frozen per-step selection and recheck revocations before subsequent attempts. Changes never rewrite retained exact input.

Interactive sessions must remain prompt-free at startup. Validate a separate provider system/developer-instruction mechanism with installed CLI help and disposable fixtures; do not pass skills as the positional user prompt or send hidden PTY input. Installed Claude help advertises `--append-system-prompt`; validate its interaction with safe mode rather than assuming. Codex's supported non-user-turn instruction path must be established in the adapter spike. If unsupported, mark that delivery mode unavailable with a reason, retaining assignments for supported modes; do not submit a model turn as a workaround. Do not write persistent `AGENTS.md`, `CLAUDE.md`, user config, or project skill directories to inject text.

### User journey and API

Use `/#skills` and `/#skills/<project-id>`. Filters: source (Workbench-managed/project/inherited), provider, search. Details show scope, provenance, when to use, body, support-file warning, version, assignments and actual delivery status. Show native inventory separately from managed assignment controls; “Available on disk,” “Selected for next launch,” “Included in launch,” and “Not supported in this mode” have different meanings.

Proposed API family: GET inventory/library/details; POST managed import/create; PUT managed edit and assignment policy with revision; archive/remove assignment actions. Accept a discovered-file opaque ID, not an arbitrary filesystem path. Browser file import submits bounded text, not a path the server blindly reads. Explicit refresh is read-only. No inventory action spawns a provider.

### Ordered checklist

- [ ] **SKD-SKL-01 — Discovery and managed store.** Implement safe metadata inventory, import validation, atomic records/history and revision checks. Acceptance: supported roots, duplicates, link boundaries, malformed/oversized files, missing providers and corrupt stores have tests; browsing causes no execution or provider-file writes.
- [ ] **SKD-SKL-02 — Global/project UI and CRUD.** Implement filters, details, create/import/edit/archive and actionable errors. Acceptance: scope is visible; global effects are clear; imported text survives reload; scripts/assets are never copied; unsaved edits survive failed saves/navigation cancellation.
- [ ] **SKD-SKL-03 — Assignment model and preview.** Add project/provider defaults, launch/step overrides and exclusions. Acceptance: a step can explicitly receive none, project B cannot receive project A's skill, and current sessions/history remain unchanged after edits.
- [ ] **SKD-SKL-04 — Provider delivery spike and integration.** Test structured and prompt-free interactive paths with fake executables and current CLI help. Integrate supported adapters through the common resolver. Acceptance: exact input/argv and snapshot agree, normal launch sends no user turn, forbidden provider config/hooks remain excluded where currently required, oversize and revocation fail visibly.
- [ ] **SKD-SKL-05 — End-to-end evidence.** Add fixtures/browser tests, cache/module allowlists and documentation. Acceptance: creation → assignment → new fixture session/step receives the exact version; removal affects next launch only; existing runtime inventory is never called proof of model use.

### Tests, verification and exclusions

Add `tests/skills.test.js`, `tests/skills-browser.mjs`, and shared context tests; extend workflow/terminal/issue-work fixtures at real launch entry points. Cover stale revisions, conflicting tabs, Unicode byte accounting, project rename/folder changes, archived assigned skills, deleted steps, same-name native and managed copies, resumptions, unsupported CLI versions, serialization boundaries and skills and provider-input budgets.

Run focused new suites and affected terminal/workflow/issue suites, then `npm test` and `npm run test:browser`. Temporary data and fake providers are mandatory for routine checks. Inspect desktop/mobile/keyboard and light/dark UI, and verify PWA updates respect skill drafts. Record fixtures, CLI help/startup, real instruction delivery and actual model use as separate evidence. Planning verified source/help only, not delivery.

Out of first release: editing shared files with an agent, native package installation, repository downloads, plugin management, script execution, skill recommendations and automatic assignment. Newton's “Edit with a bot” can inform a later explicit draft handoff, but never sends a message automatically.
