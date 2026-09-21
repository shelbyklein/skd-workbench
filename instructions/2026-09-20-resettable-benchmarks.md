# Resettable benchmarks — SKD Workbench

User scope: implement automatic reset before running the Tiny Tasks comparison. Use real Codex execution when the user starts it; do not run a paid benchmark during this delivery.

TT plan: local:E02FA78C-9138-42F3-BAC6-9CEA3D87544C

- SKD-RESET-01: Pin benchmark projects to a full Git commit and preserve complete artifacts before clearing owned worktrees. Acceptance: fixture runs start from the same commit after source HEAD moves; source stays untouched; tracked/new/binary/ignored files, links, command evidence, tokens and review notes survive; reviews/retryable failures retain worktrees; archive failures block deletion.
- SKD-RESET-02: Expose settings/reset status/archive downloads, enable Tiny Tasks and activate the local app. Acceptance: desktop/mobile browser exercise with a fake provider, regression checks, installed route inspected, original Tiny Tasks source clean and no real benchmark calls.

## Lifecycle

Normal projects keep their current behavior. Benchmark mode is opt-in under Project details → Set up benchmark. Pin a clean Git repository's HEAD, tag or commit once; persist the resolved full SHA and repository identity. Future real runs must use a fresh worktree at that SHA. No source checkout reset/clean is performed. Updating settings affects future runs only.

A workflow shares its temporary worktree across steps, reviews and retries. Every finished agent attempt archives a snapshot; final completion or explicit Stop archives the whole run and then removes the worktree and owned temporary branch. Failed/interrupted workflows remain retryable and keep their workspace until stopped. Standalone completed/failed/cancelled tasks archive then clear; interrupted tasks are retained. Simulation-only runs do not create worktrees.

Archives live at `.data/artifacts/<run-id>.json` and download from run details. They contain final file bytes (base64), modes, directories, symbolic-link targets, a binary Git diff, run input/output, command evidence as reported by Codex, usage and timestamps. No automatic test execution is added; the configured agent/check steps still determine acceptance. Files are not accepted merely because the run completes.

Archive bound: 32 MiB of file contents and 10,000 entries. Special files, invalid ownership, changed branches, unreadable files or a changed snapshot cause retention. The archive is atomically replaced, flushed and read back for checksum verification before cleanup. Only registered app-owned worktrees under the canonical data directory qualify for removal. Symlinks are recorded, never followed. Interrupted cleanup is marked for inspection on restart, never resumed automatically.

## Validation / activation

Use unit and browser fixtures with a fake Codex executable, never the live smoke scripts. Record evidence in VALIDATION.md. Enable only Tiny Tasks against `benchmark-start` after confirming no active local user run. Keep its two existing comparison workflows, baseline repository and saved run history unchanged. Commit app changes locally and restart the existing localhost service. Keep this delivery local; pushing is not part of this task.
