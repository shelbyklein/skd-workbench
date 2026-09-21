# Sessions naming

Confirmed: rename the single-agent view to Sessions, with New session and Codex identified as the agent. Solo implementation now. Preserve provider APIs, stored records and legacy URLs. This naming slice does not implement multi-turn continuation or Claude.

SKD-SESSION-01: update navigation, page/form/history labels and canonical session routes; verify relevant browser fixtures and live read-only UI, inspect screenshot, bump PWA cache and commit. Acceptance: provider-neutral Sessions entry points, Codex identified as agent, old routes still load, no live executions or data changes.

TT plan: local:2CB54B3D-ABCB-431C-A744-4068624B2499.

Completed: both relevant browser suites and live read-only route/mobile checks passed; saved state/history unchanged. Screenshot and receipt in output; PWA cache 0.5.0-7.
