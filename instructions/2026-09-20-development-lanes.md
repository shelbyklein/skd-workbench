# SKD Workbench: development lanes and knowledge model

<!-- skd-development-lanes-2026-09-20 -->

Status: agreed product direction; future work, not implementation authorization.
GitHub issue: https://github.com/shelbyklein/skd-workbench/issues/1

## Outcome

Newton is the general-work app. SKD Workbench is specifically for accessing, organizing, creating, inspecting, and operating development work. Projects provide shared context across lanes, with global knowledge available across projects.

The existing issue board owns tasks for LLM execution. Do not introduce a competing task inbox or automatically turn informal notes into tasks.

## Current evidence

Inspected local checkout on 2026-09-20 at b34ae06. No Git remote is configured. Existing project scopes, workflow execution and retained attempts provide a foundation; see README.md and instructions/2026-09-20-real-workflows.md. This planning pass does not independently verify runtime behavior.

## Agreed lanes

### Scratchpad

Quick notes, ideas, snippets, and reminders to revisit. Saving a note persists it for the user without publishing an issue, scheduling execution, or adding it to LLM knowledge/memory. Explicit promotion actions may create an issue or a knowledge entry later.

### Knowledge

One lane contains two distinct content types:

- Reference knowledge: deliberately maintained documentation, architecture, requirements, conventions, and decisions.
- Development memory: lessons and observations retained from actual development work, with source, date, scope, and evidence.

The graph connects both types to projects, components, issues, runs, and assets. It is an organization and retrieval mechanism, not a third content type. Support search and concise agent retrieval in addition to visual graph exploration.

Knowledge exists globally and per project. Each project has independent on/off controls for using global knowledge and project knowledge, plus finer collection/entry controls. UI visibility filters are distinct from agent-use settings. Capturing new memories is controlled separately from retrieving existing knowledge.

Agent-generated memories begin as proposed entries that can be accepted, edited, or discarded. Preserve provenance, distinguish established decisions from tentative conclusions, and allow superseding stale entries without losing their history. Repeated observations can support an existing memory. Scratchpad content is not eligible for automatic retrieval merely because it was saved.

### Build

Visualize and configure execution through three related views in one lane:

- Flows: reusable definitions of agents, steps, connections, handoffs, checks, and review gates.
- Runs: individual executions, showing the exact flow version used, current step, traversed path, outputs, retries, and review decisions.
- Changes: resulting worktrees, diffs, artifacts, and verification evidence.

The issue board supplies executable work. Preserve single-agent execution without requiring a flow. Flow definitions and executions remain separate records; editing a flow must not rewrite historical or active run snapshots.

### Assets

Image generation and editing for development: illustrations, icons, textures, and mockups. Organize source references, prompts, variants, dimensions, transparency, export settings, and destinations. Track selected versions and where assets are integrated into a project; generation alone does not mean integration is complete.

### Inspector

Inspect interfaces, diffs, screenshots, logs, and test results. Investigation workspaces can retain reproduction steps, hypotheses, experiments, and evidence. Explicitly promote findings into issue-board work or durable knowledge. Keep static checks, fixtures, actual provider checks, and runtime inspection distinguishable.

### Ship & Monitor

Release readiness, build/deployment history, environment status, and post-deployment problems. Tie observed versions and evidence to each environment so planned, built, deployed, and verified states remain distinct.

## Shared capabilities

- Project overview: active work, pending reviews, blockers, recent decisions, and the next action, derived from authoritative records.
- Context packets: deliberately select a task, enabled knowledge, screenshots, and code references for a build or investigation run.
- Cross-lane links preserve project context and provenance without duplicating ownership of issues or execution state.

## Future implementation checklist

These are roadmap items, not started tasks. Split into bounded implementation issues once the remaining design decisions are resolved.

- [ ] SKD-LANES-01: Define shared navigation and project overview. Acceptance: project switching preserves correct scope and links back to authoritative issue/run records.
- [ ] SKD-LANES-02: Add persistent Scratchpad. Acceptance: a saved/reopened note creates no issue, execution, or retrievable memory; promotion is explicit.
- [ ] SKD-LANES-03: Define global/project knowledge and memory storage, provenance, proposal review, and toggles. Acceptance: disabled content is excluded from agent context; visibility and capture controls act independently; superseded entries retain history.
- [ ] SKD-LANES-04: Add graph/search and context packet assembly. Acceptance: selected enabled material is traceable to sources and stays within the intended scope.
- [ ] SKD-LANES-05: Organize Build into Flows, Runs, and Changes. Acceptance: a run displays its immutable flow version, attempts, outputs, changes, and verification; direct single-agent execution still works.
- [ ] SKD-LANES-06: Add Assets generation/editing and integration tracking. Acceptance: references, prompts, variants, exports, and project usage remain traceable through a real generation/edit/export exercise.
- [ ] SKD-LANES-07: Add Inspector and investigation records. Acceptance: reproduce and document a problem, attach evidence, and explicitly promote a finding without duplicating issue ownership.
- [ ] SKD-LANES-08: Add Ship & Monitor. Acceptance: distinguish build, deployment, and observed runtime state for a chosen environment, including failure and unavailable-status cases.
- [ ] SKD-LANES-09: Validate the connected development loop. Acceptance: exercise keyboard/mobile navigation, persistence/recovery, project isolation, knowledge exclusions, and cross-lane provenance through the actual interface.

## Open decisions and delivery boundaries

- Exact navigation, visual layouts, and implementation order remain to be designed. Earlier sequencing suggestions are not a committed schedule.
- Choose graph storage/retrieval, reference ingestion, and memory proposal review mechanics before implementation. Define toggle inheritance and active-run behavior explicitly.
- Choose image providers and editing capabilities, export/integration mechanics, and permission boundaries.
- Define issue-board integration contracts and monitoring/deployment targets, credentials, refresh cadence, and notification policy.
- Apply current repository rules and Tracker Trapper reporting to future implementation. Preserve existing data and use tested migrations and backups for schema changes.
- This record authorizes no implementation, task dispatch, provider usage, deployment, or repository creation. No application behavior was changed or tested by this planning task.
