# Interactive Sessions

Confirmed: embedded terminal in a column sliding out from the right. Agent and matching model pills, discrete effort slider, reset warning at top. Start session opens the interactive CLI with no required task or automatic prompt submission. One worktree per entire conversation, manual review/merge later; benchmark reset only at session end. Hide detaches the view, not the process. Reload reconnects to the same process; server restart interrupts without silently launching a replacement.

Solo execution now under existing request-to-work process. No external publishing. Preserve legacy session results and workflow executors. Use a local PTY and xterm.js with local-only JSON endpoints; fixed server-selected binaries/argv, bounded transcript, input and resize validation, shared execution lock and durable metadata. No shell command interpolation. CLI approval prompts remain in terminal. Native CLI sessions do not yet expose reliable structured usage; show it as unavailable rather than zero. Do not automatically merge, delete normal worktrees, resume interrupted processes, or submit paid inference during validation.

SKD-TERM-01: PTY lifecycle, input/output/resize, stable reconnect, worktree retention and benchmark archive/reset, shared executor lock, shutdown. Test actual PTY fixture and HTTP origin rejection, no arbitrary binary/cwd.
SKD-TERM-02: pills, effort, reset notice and ELI10 worktree help, terminal column with Hide/Reopen/End, preserved legacy output, desktop/mobile/keyboard/reload checks. Inspect actual CLI startup without sending a prompt. Activate only after no active work and preserve preexisting state. Commit locally.

TT plan local:EB00F1FC-6E68-4892-A7F5-3358C4F3DB3B.
Sources: installed CLI help; https://developers.openai.com/codex/cli/reference ; https://github.com/microsoft/node-pty ; https://xtermjs.org/docs/api/terminal/classes/terminal/ .

Completed: 55 Node tests and 11 browser suites passed. Both actual CLIs opened native startup/trust screens in disposable test data with no prompt or trust acceptance. Live controls verified and state/history preserved after activation. See VALIDATION.md for receipts and limits. Interactive usage totals remain unavailable; no merge action was added.
