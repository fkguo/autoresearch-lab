Using the research-team skill to perform this review correctly.

I'll now conduct a rigorous semantic audit of this draft-cycle enhancement proposal.

---

**DECISION: REQUEST_CHANGES**

**BLOCKERS:**

1. **Convergence gate bypass when `--no-require-convergence` is set but Member C runs anyway**
   - If user runs with `--member-c-*` flags but `--no-require-convergence`, the Leader report is generated but gate is skipped. Exit code is 0 regardless of blocking issues. This allows false "success" when leader finds blockers.
   - Fix: Either (a) make `--member-c-*` flags imply `--require-convergence`, or (b) document that running Member C without convergence gate is informational only and emit explicit warning: `[warn] member-c report generated but convergence gate disabled; blockers not enforced`.

2. **Exit code 2 vs 1 ambiguity in `run_draft_cycle.sh` propagation**
   - `check_draft_convergence.py` exits 2 for parse/contract errors. The review packet does not specify how `run_draft_cycle.sh` handles exit 2 distinctly from exit 1. If the shell script treats any non-zero as "not converged," users cannot distinguish "reviewer violated output contract" from "legitimate blockers found."
   - Fix: `run_draft_cycle.sh` must propagate exit code directly OR map: exit 2 → `draft_convergence_error` stage (already listed) AND exit non-zero (suggest exit 2). Confirm the trajectory stage `draft_convergence_error` is emitted on exit 2 specifically, not on exit 1.

3. **Counting rule edge case: empty "## Blocking …" section with declared `Blocking issues count: 0`**
   - Contract says "0 with `(none)`" but counting rule says "counts top-level list items." If reviewer writes `Blocking issues count: 0` but omits the section entirely or writes prose instead of `(none)`, what happens?
   - Fix: Specify exact required format: If N=0, section MUST contain exactly `(none)` as sole content (no list). If N>0, section MUST contain exactly N top-level list items. Parser must reject N=0 with list items present, and N>0 with `(none)` or missing section.

4. **Missing contract enforcement for Verdict string normalization**
   - `Verdict: ready for review cycle | needs revision` — what if reviewer writes `Verdict: Ready for Review Cycle` (capitalization) or `Verdict: ready for review cycle.` (trailing punctuation)?
   - Fix: Specify `check_draft_convergence.py` performs case-insensitive, stripped comparison. Document exact accepted strings: `ready for review cycle`, `needs revision` (case-insensitive, whitespace-trimmed, punctuation-stripped).

**NONBLOCKING:**

1. **`next_draft_tag.py` collision handling unspecified**
   - If `D0-r1` exists and user runs script, it suggests `D0-r2`. But if both `D0-r1` and `D0-r3` exist (manual jump), does it suggest `D0-r4` or `D0-r2`? Clarify: script should find max existing suffix and increment.

2. **Convergence log vs summary naming inconsistency**
   - `<tag>_draft_convergence_log.md` vs `<tag>_draft_converged_summary.md` — "converged" in summary name implies success, but summary is written even on non-convergence. Consider: `<tag>_draft_convergence_summary.md` (neutral).

3. **LATEST_DRAFT.md links to convergence artifacts when gate disabled**
   - If `require_convergence: false`, no convergence artifacts exist. Does `update_project_map.py` handle this gracefully (omit links) or emit broken links?
   - Suggest: Only include convergence artifact links if files exist.

4. **Contract brittleness concern (your Q4)**
   - The counting rule (top-level items only, indentation ≤2 spaces) is reasonable but may break on reviewers using tabs or 3-space indents. Consider: count lines matching `^[-*] ` (start of line, dash/asterisk, space) as top-level. Document this regex explicitly.

**NOTES:**

- The overall architecture is sound: deterministic gate, parseable verdicts, explicit trajectory stages.
- Default `require_convergence: true` in scaffold is correct for enforcing discipline on new projects.
- The three-reviewer structure with Leader as C is semantically clean.
- Recommend adding a `--dry-run` flag to `run_draft_cycle.sh` that runs convergence gate on existing reports without invoking models (useful for re-checking after manual edits).
