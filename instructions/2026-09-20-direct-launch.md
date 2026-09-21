# Direct launch

Confirmed: configured Run with Codex and Try flow start immediately. Configuration belongs in Run settings, with a missing-settings fallback. Tiny Tasks shares one saved benchmark task and acceptance checklist; agent model/effort stays on each flow, with saved workspace mode and attempt limit. No paid benchmark during implementation.

Preparation: solo, implement now; user explicitly approved the proposed behavior. Continue local TT tracking rather than publishing a new issue.

SKD-LAUNCH-01: persist validated settings with revision protection; add direct launch and separate settings action; populate Tiny Tasks from its README; verify real/simulation clicks in fake-provider browser fixtures, missing settings, edits/reload and no duplicate starts; activate localhost preserving history and source; verify installed settings without starting Codex.

TT plan: local:B59B121D-BEBD-4481-AAB2-7F3B2830C807.

Delivery: functional acceptance passed (44 unit tests and eight browser suites), settings activated for both Tiny Tasks flows. Verification exception: one live click bypassed Playwright interception via the PWA worker and started Codex. Stopped immediately upon detection; archived/reset, baseline untouched, usage unknown. This breached the no-paid-run verification boundary; disclosed to the user and retained in history. See VALIDATION.md.
