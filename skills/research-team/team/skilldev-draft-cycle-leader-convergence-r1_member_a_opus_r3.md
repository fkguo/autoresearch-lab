Using the Skill tool to check for any applicable skills before responding to this review task.

I'll check if there are any research-team or review-related skills that might apply to this task.

Let me check for any code review or audit skills as well.

Now I'll proceed with the semantic audit of the draft-cycle enhancement proposal.

---

DECISION: REQUEST_CHANGES

BLOCKERS:
- **Convergence gate exit-code path in `run_draft_cycle.sh` is underspecified**: The packet states the gate script exits 0/1/2, but does not specify how `run_draft_cycle.sh` propagates these. If the shell script uses `set -e` (common), exit 2 (contract violation) would halt the script before writing `*_convergence_log.md` artifacts. The packet says "convergence artifacts are written only when the convergence gate is enabled" but doesn't clarify whether they're written *before* or *after* the gate check. If after, a contract violation (exit 2) could leave runs in an undiagnosable state. **Fix**: Explicitly state that `run_draft_cycle.sh` must (a) capture the gate exit code, (b) write convergence artifacts *before* interpreting the exit code, (c) propagate the exit code as the script's final exit.

- **Blocking-issue count extraction is ambiguous for edge cases**: The counting rule says "counts top-level list items only (indentation <= 2 spaces)". This is ambiguous: does a line starting with exactly 2 spaces count as top-level or nested? Standard Markdown list items with `- ` have 0 leading spaces; sub-items typically have 2+ spaces. The rule should be `indentation < 2` (strictly less than) or clarify that 0-1 leading spaces = top-level. **Fix**: Change to "indentation < 2 spaces before the `-`" or equivalently "lines matching `^- ` (no leading whitespace)".

- **Member C report path default may not exist at gate invocation**: The config default `draft_review.leader_system_prompt: prompts/_system_draft_member_c_leader.txt` is a *prompt* path, but the convergence gate takes `--member-c` expecting an *output report* path (`team/runs/<tag>/<tag>_draft_member_c_leader.md`). If Member C is not run (e.g., user runs only A+B), what happens? The packet doesn't specify whether `--member-c` is optional or required. If required and missing, does the gate exit 2? If optional and missing, how is convergence determined with only 2 reports? **Fix**: Specify: (a) `--member-c` is required when convergence gate is enabled, or (b) if missing, gate treats Leader as abstaining (dangerous—could allow false convergence), or (c) gate exits 2 if any expected report is missing.

- **Contract mismatch tolerance is zero, but "Verdict" parsing regex is unspecified**: The packet says the gate "Parses each report's `## Verdict` section" but doesn't give the exact regex. If a reviewer outputs `Verdict:ready for review cycle` (missing space) or `Verdict: Ready for review cycle` (capitalized), does it fail? Exit 2 would be correct for contract violation, but this should be explicit. **Fix**: Specify exact regex, e.g., `^Verdict:\s*(ready for review cycle|needs revision)\s*$` (case-insensitive or not—state which).

NONBLOCKING:
- **Trajectory stage naming inconsistency**: `draft_member_reports` (plural) vs `draft_preflight_start`/`draft_preflight_ok` (singular preflight). Minor, but could cause log-grep confusion. Consider `draft_reviews_complete` or similar for parallelism.

- **`next_draft_tag.py` collision behavior unspecified**: What if `D0-r1` exists but user passes `--tag D0-r1` explicitly to `run_draft_cycle.sh`? Does the script overwrite, fail, or warn? Not a convergence-gate issue, but affects iteration semantics.

- **Scaffold template sets `require_convergence: true` but lib default is `false`**: This is noted as intentional but could confuse users who clone the lib directly without scaffolding. Consider aligning defaults or documenting the divergence prominently.

NOTES:
- The three-reviewer convergence model (A/B/Leader unanimous) is sound; requiring all verdicts = `ready` with blocking count = 0 is correct semantics.
- The contract tightening (exact parseable lines) is appropriate for deterministic gating; brittleness is the price of correctness, and exit 2 is the right failure mode.
- The explicit log marker `[gate] running draft convergence gate ...` aids debuggability.
- The question "Is the contract too brittle?" has the right answer: **no**—reviewers should be prompted to emit exact format, and exit 2 forces prompt/output debugging rather than silent false convergence. The fix for brittleness is better prompts, not looser parsing.
