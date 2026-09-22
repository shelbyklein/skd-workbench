# Stream xterm terminal interaction

Issue: https://github.com/shelbyklein/skd-workbench/issues/12

Tracking marker: SKD-XTERM-STREAM-2026-09-22

## Outcome and evidence
Keep xterm.js and node-pty. Replace the 400 ms output polling and serialized per-keystroke HTTP requests in public/terminal-ui.js with one local WebSocket per attached terminal. At b0ae0f2, output is scheduled with setTimeout(poll,400); loopback health measured 2–5 ms after connection warm-up. This confirms an avoidable polling delay, not a complete performance profile.

Scope includes the plain workspace shell and Codex/Claude terminal sessions. This is transport work, separate from issue #6's protocol-owned activity capture. No provider inference, automatic worktree creation, merge, cleanup, or automatic process resume is added.

## Ordered checklist
- [x] TT-TERM-01 — Implement bounded, event-driven terminal transport. Acceptance: real HTTP upgrade tests prove same-origin/Host and session validation, immediate output, input/resize validation, reconnect cursor replay, slow-client limits, cleanup, and no launch on connect.
- [x] TT-TERM-02 — Connect the shared xterm panel to streaming. Acceptance: workspace and Agent browser checks prove typed input/paste, navigation, hide/reopen, refresh, resize, end, reconnect without input replay or duplicate processes, and bounded client buffering.
- [x] TT-TERM-03 — Validate latency and deliver locally. Acceptance: full Node/Chrome suites pass; record real-PTY local input-to-output latency against a <50 ms p95 target, inspect desktop/mobile UI, document limits, and integrate cleanly. Activate only when existing sessions can be preserved; otherwise leave activation explicitly pending. User acceptance precedes issue closure.

## Protocol and lifecycle
Server owns processes and fixed launch settings. Opening a socket only attaches to an existing session. Validate loopback Host and exact Origin on upgrades; reject missing/foreign Origin, invalid paths and unknown sessions. Input and resize are bounded messages. Never replay input after reconnect. Stream output with cursor acknowledgement and bounded chunks; allow only one unacknowledged output frame and disconnect stalled clients. Retained transcript remains bounded with explicit truncation/reset reporting. Reconnect resumes after the last rendered cursor; server restart cannot recreate an old process. Preserve existing HTTP endpoints for compatibility, with no HTTP input fallback that might duplicate commands.

## Rollout
Reuse the clean existing development worktree. Update the shell cache and validation record. Do not interrupt a live shell to activate server changes. Test with disposable stores and fixture Agent executables, not paid inference. Remote code push is separate from the requested issue publication. Roll back the transport commit and refresh cached shell if necessary; never restore stale user data.

## Delivery evidence

TT plan: 2DA63771-BF28-4068-9C74-72D54E608C36. Run: 2232B419-C182-4C15-BFB1-861B8294844A. Backend suite: 341 passed, plus two additional focused edge checks. All 36 Chrome suites passed. Final focused real-PTY input-to-display p95: 15.8 ms (30 samples). Both workspace and Agent terminals use the shared streaming transport. Source is staged in codex/workspace-registration; activation/integration is pending a safe server restart because the existing workspace shell remains running. No provider inference or remote code push. Issue remains open for user acceptance.

Activation completed after explicit user approval: local main integrated, service restarted, live WebSocket shell command verified, and all 22 saved JSON hashes unchanged. Test shell stopped. Issue remains open for user acceptance; remote code not pushed.
