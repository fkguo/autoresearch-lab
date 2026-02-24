I'll review this draft-cycle enhancement proposal systematically, focusing on semantic correctness, gate semantics, and contract enforceability.

---

**DECISION: REQUEST_CHANGES**

**BLOCKERS:**

1. **Exit-code propagation gap in run_draft_cycle.sh**: The description says the script "captures the convergence gate exit code and propagates it" but does not specify what happens when `--require-convergence` is false (or unset) and the gate is skipped. If the gate is never invoked, the script could exit 0 even when member reports contain blocking issues. The spec must explicitly state: when `require_convergence=false`, the gate is still run but exit 1 is downgraded to exit 0 (with a warning), OR the gate is skipped entirely. Current ambiguity allows false convergence in the skip-gate path.

2. **Contract mismatch: "Blocking issues count: N" vs bullet-counting rule**: The spec says the gate counts "top-level list items only (indentation < 2 spaces)" under `## Blocking …`. However, Markdown list items canonically start with `- ` or `* ` at column 0–1, meaning "indentation < 2 spaces" includes items at indent=0 and indent=1. An item at indent=1 (e.g., ` - foo`) is visually nested in many renderers. The rule should be: **indent == 0 only** (no leading whitespace before the `-`). Otherwise, nested bullets introduced by trailing space will be miscounted.

3. **Missing guard for empty/missing member report**: The gate spec says inputs are `--member-a`, `--member-b`, `--member-c`, but does not specify behavior when a file is missing or empty (e.g., Member C runner not invoked). If the gate silently treats missing file as "ready, N=0", that's a false-convergence vector. Spec must require: **missing or empty file → exit 2 (input error)**.

4. **Verdict regex ambiguity**: The allowed verdict values are `ready for review cycle | needs revision`, but the `|` is ambiguous (literal pipe vs alternation). If literal, the line `Verdict: ready for review cycle | needs revision` is valid—clearly wrong. Clarify: the two allowed values are `ready for review cycle` OR `needs revision`, and the regex must be anchored and exact: `^Verdict:\s*(ready for review cycle|needs revision)\s*$`.

5. **Trajectory stage written before gate completes**: The spec says `draft_member_reports` is a stage, then `draft_converged` / `draft_not_converged` / `draft_convergence_error`. If trajectory is written incrementally and the gate crashes mid-execution (e.g., SIGKILL), the trajectory could show `draft_member_reports` with no convergence stage, which is indistinguishable from "gate not run". Add a `draft_convergence_gate_start` stage written immediately before invoking the gate.

**NONBLOCKING:**

1. **`--out-log` and `--out-summary` paths not validated**: The gate writes to user-supplied paths. If paths are invalid (e.g., directory doesn't exist), the gate may succeed on verdict logic but fail on write. Consider: gate should validate paths exist/writable before parsing, or document that callers must ensure directory exists.

2. **Tag collision risk in `next_draft_tag.py`**: The helper scans `*_draft_member_*.md` but the spec doesn't say whether it locks or checks for in-flight runs. Two concurrent invocations could get the same tag. For single-user workflows this is fine; document the assumption.

3. **Bullet-counting ignores code blocks**: If a reviewer includes a code block with lines starting with `- `, those could be miscounted. Spec should note: counting is naive (no Markdown AST parsing), or explicitly require reviewers not to embed lists in code blocks under `## Blocking …`.

4. **`LATEST_DRAFT.md` links to convergence artifacts even when gate disabled**: If `require_convergence=false` and gate not run, those artifacts won't exist. `update_project_map.py` should conditionally include links only when artifacts exist, or document that links may be dead.

**NOTES:**

- The "declared N must match bullet count" invariant is good and catches reviewers who miscount their own issues—this is a valuable integrity check.
- The scaffold default of `require_convergence: true` is the right call for enforcing discipline in new projects.
- Q4 from the proposal (brittleness): The contract is appropriately strict. Exit 2 for parse failures is correct—reviewers must follow the format. If exit 2 is too frequent in practice, the fix is reviewer prompt iteration, not gate relaxation.
- The three-way A/B/Leader structure provides genuine triangulation value; Leader auditing the auditors is sound.
