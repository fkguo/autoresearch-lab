# Code Review: research-team skill — markdown math hygiene + team cycle hardening

## Decision: **APPROVE**

---

## Summary

This patch adds a global Markdown math hygiene gate (`check_markdown_math_hygiene.py`) and a deterministic autofix helper (`fix_markdown_math_hygiene.py`), integrates the gate into the preflight sequence of `run_team_cycle.sh`, and extends the existing `check_knowledge_layers.py` and `check_notebook_integrity.py` gates with split-equation detection. The implementation is consistent with the stated policy and the smoke tests provide adequate deterministic coverage.

---

## Top 3 Risks

### 1. **False positives on legitimate inline `$$` usage** (Low-Medium)
The gate rejects *any* `$$` that is not on its own line, which is stricter than some Markdown engines allow. Edge cases like `$$ x $$` in prose (rare but valid in some renderers) will be blocked. However, the policy explicitly requires fenced display math with standalone `$$` lines, so this is **by design** and documented.

### 2. **Autofix blank-line preservation changes semantic whitespace** (Low)
When merging split `$$` blocks, the autofix preserves blank lines *inside* the merged block. This is correct for avoiding content loss, but some TeX renderers treat blank lines inside `$$...$$` as paragraph breaks. The current behavior is the safer choice (no data loss), and the policy documents this.

### 3. **macOS bash 3.2 compatibility for array-less constructs** (Low)
The shell script uses `${var:-default}` and `set +e`/`set -e` toggling, which are bash-3.2-safe. No arrays or associative arrays are used in the new code paths. The `set +e; cmd; code=$?; set -e` pattern is idiomatic and works correctly under `set -euo pipefail`.

---

## Verification of Key Invariants

### ✅ Convergence gate guaranteed to run once Member A/B reports exist

The patch does **not** modify the convergence-gate invocation path. Reviewing `run_team_cycle.sh`:
- The new Markdown math hygiene gate runs **during preflight** (before team members are invoked).
- If preflight fails, the script exits early—*before* any member reports are written.
- Once preflight passes and members A/B complete, the script continues to `check_team_convergence.py`.
- The sidecar (Member C) is invoked with `|| true` and cannot block convergence.

**Verdict:** The invariant holds. The patch does not introduce any new exit paths between member-report creation and convergence-gate execution.

### ✅ Markdown math hygiene rules are consistent with stated policy

| Policy requirement | Gate enforces | Autofix handles |
|---|---|---|
| No `\(` `\)` `\[` `\]` | ✅ `delim_pat` regex | ❌ (manual rewrite required) |
| `$$` must be on its own line | ✅ early-exit check | ✅ `_INLINE_DISPLAY` rewrite |
| No `+`/`-`/`=` at line start inside `$$...$$` | ✅ loop check | ✅ `\\quad` prefix |
| No split `$$` blocks (back-to-back) | ✅ continuation-token heuristic | ✅ fence removal + merge |
| Ignore fenced code blocks (`\`\`\``, `~~~`) | ✅ `_iter_lines` / `in_fence` | ✅ `_CODE_FENCE_PREFIXES` |

### ✅ Bash safety under `set -euo pipefail`

```bash
set +e
python3 "${MD_MATH_HYGIENE_GATE_SCRIPT}" --notes "${NOTEBOOK_PATH}"
mmh_code=$?
set -e
if [[ ${mmh_code} -ne 0 ]]; then
  ...
  exit ${mmh_code}
fi
```

This pattern is correct:
- `set +e` prevents immediate exit on non-zero return.
- `$?` is captured before `set -e` re-enables errexit.
- The variable is quoted in `exit ${mmh_code}`.
- No unset variables (`-u` is satisfied; `mmh_code` is always assigned).

### ✅ macOS bash 3.2 compatibility

- No `declare -A` (associative arrays).
- No `${var,,}` / `${var^^}` (case modification—bash 4+).
- No `|&` (bash 4+).
- `[[ ... ]]` and `$(...)` are bash-3.2-safe.
- `grep -nF` is POSIX-compatible.

---

## Optional Improvements

1. **Consider a `--dry-run` summary for the autofix script**
   Currently `--in-place` is required to apply changes. A `--dry-run` mode that prints a unified diff would help users preview changes before committing. (Low priority; current check-mode output is sufficient.)

2. **Add a config option to downgrade inline-`$$` violations to warnings**
   Some legacy documents may have many inline `$$ x $$` usages. A `"strict_inline_display": false` option could downgrade to warnings without blocking CI. (Policy trade-off; not strictly necessary.)

3. **Document the `\\[2pt]` exception in RUNBOOK.md**
   The gate intentionally allows `\\[2pt]` (TeX vertical spacing) while blocking `\[`. A one-liner in the troubleshooting section would preempt confusion.

4. **Lint: unused import `fnmatch` in `check_markdown_math_hygiene.py`**
   `fnmatch` is imported and used correctly in `_iter_markdown_files`, so this is fine—but the function is duplicated between the gate and autofix scripts. Consider extracting to `scripts/lib/markdown_utils.py` if more gates need it. (Low priority; minor DRY improvement.)

---

## Regression Test Adequacy

| Test file | Coverage |
|---|---|
| `smoke_test_markdown_math_hygiene_gate.sh` | Scaffold → baseline pass → inject hazards (PREWORK + KB) → gate fails → autofix → gate passes. Also covers `\\[2pt]` false-positive avoidance and `~~~` fenced code. |
| `smoke_test_knowledge_layers_gate.sh` | Extended to cover KB math hygiene (fail → fix → pass), inline `$$` rejection, inline-code preservation, multi-inline skip, `~~~` fence ignore. |
| `smoke_test_notebook_integrity_gate.sh` | Extended to cover split-`$$` detection and `~~~` fence ignore. |
| `smoke_test_run_team_cycle_convergence_gate.sh` | Pre-existing; validates convergence-gate execution after member reports. |

**Verdict:** Smoke coverage is sufficient for the stated invariants. The tests are deterministic and exercise both failure and success paths.

---

## Conclusion

The patch is well-structured, the gate logic is sound, and the shell integration follows safe patterns. The mandatory convergence-gate invariant is preserved. No blocking issues found.

**APPROVE**

