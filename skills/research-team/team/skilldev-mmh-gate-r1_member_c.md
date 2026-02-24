# Audit Report: research-team skill — Markdown math hygiene + team cycle hardening

**Verdict:** CONCERNS

---

## Concerns

1. **Silent workflow skip risk** (the regression driver):
   - `run_team_cycle.sh` starts Member C (sidecar) as a **background process** (`&`), stores its PID, and attempts cleanup on exit via trap.
   - **No `wait` on the convergence gate** is visible in the diff. If the script exits prematurely (trap fires, background sidecar killed, but convergence gate hasn't run yet), the trajectory never advances to `converged`/`not_converged`.
   - The patch adds a new preflight gate (`check_markdown_math_hygiene.py`) but does **not** add synchronization or ordering guarantees for the Member A/B → convergence gate pipeline.
   - **Shell portability hazard**: traps firing during early exit may kill the sidecar before the foreground convergence check runs, especially if an earlier preflight gate fails and the script `exit`s without reaching the convergence stage.

2. **Sidecar process isolation** (reliability):
   - The diff does not show explicit `set +e` / `|| true` wrappers around the sidecar's final status check, nor does it show a \"warn-only\" contract enforced at the shell level (the smoke test verifies sidecar on/off modes reach convergence, but the script itself must guarantee that a sidecar failure cannot block the mandatory convergence gate).
   - **Failure mode**: if the sidecar script itself crashes or returns non-zero during its own checks (not just during Member C's LLM call), the trap cleanup may fire but leave the trajectory in an inconsistent state.

3. **Math hygiene autofix correctness** (edge case brittleness):
   - `fix_markdown_math_hygiene.py` merges back-to-back `$$` blocks when the second starts with a continuation token (`\\qquad`, `\\quad`, `\\times`, `\\cdot`) **or** an operator (`+`, `-`, `=`).
   - **Risk**: the continuation token check scans forward to find the next nonblank line. If a user has a **legitimate** second display block that happens to start with `\\qquad` (e.g., a separate equation with a spacing prefix), the autofix will **merge it destructively**.

4. **Blank line preservation during merge** (subtle state bug):
   - The autofix buffers blank lines between a closing `$$` and the next opening `$$`, then flushes them into the merged block if a merge happens.
   - **Risk**: multiple consecutive blank lines could be preserved inside `$$...$$` and confuse some renderers.

5. **Inline code span regex** (edge case false negative):
   - The gate/fixer remove inline code spans via a simple regex. Escaped-backtick edge cases may desync.

6. **TeX linebreak spacing guard** (false positive risk):
   - The negative lookbehind that allows `\\\\[2pt]` but blocks `\\[` could misbehave in rare triple-backslash cases.

7. **Config schema drift** (maintainability):
   - The patch adds `markdown_math_hygiene.targets` / `exclude_globs`, but does not include an explicit smoke case for \"config key missing → default targets\" fallback.

---

## Suggested follow-ups

1. **Synchronization audit**: verify full-script ordering guarantees (Member A/B reports → convergence gate → trajectory update) are never bypassed.
2. **Sidecar isolation test**: deterministic smoke where sidecar crashes, but convergence still runs and trajectory updates.
3. **Autofix heuristic**: add smoke case for adjacent-but-intentional `$$` blocks starting with `\\qquad` and decide whether autofix should merge or not (document either way).
4. **Config fallback test**: remove `markdown_math_hygiene` key and confirm defaults apply.

