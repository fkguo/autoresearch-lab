# Review: code-cleanup-md-dedup-r1

## Decision: **APPROVE** (with minor conditions)

The proposal is well-scoped and addresses real duplication without over-engineering. The validation plan is sound.

---

## Top 3 Risks / Edge Cases

1. **Inline-code-span parsing divergence**
   - Current duplicated implementations may have subtle differences (e.g., handling of escaped backticks, nested backticks, edge cases like `` `foo``bar` ``). Consolidating assumes they're identical—if they aren't, one call-site's behavior changes silently.
   - **Mitigation**: Before writing `iter_inline_code_spans`, diff the existing implementations line-by-line. If any differ, document which behavior the shared version adopts and add a regression test for the divergent case.

2. **`iter_md_files_by_targets` exclude-glob semantics**
   - The three gates may use slightly different `fnmatch` vs `pathlib.match` vs `gitignore`-style semantics for `exclude_globs`. Centralizing could change which files are skipped.
   - **Mitigation**: Explicitly document the matching semantics (recommend `fnmatch` on relative paths). Add a smoke-test case with a file matching an exclude pattern to lock behavior.

3. **Error-message formatting / exit behavior in `check_knowledge_layers.py`**
   - That gate currently inlines math-hygiene errors with its own prefix/context. Calling the shared validator must preserve the `path_for_msgs` context so error output remains identical (CI logs, grep-ability).
   - **Mitigation**: Ensure `validate_markdown_math_hygiene` returns raw messages without hardcoded prefixes; let the caller prepend context. Compare `diff` of gate output before/after refactor on a known-bad file.

---

## Minimal Improvements to Keep Refactor Safe

| # | Suggestion |
|---|------------|
| 1 | **Add a unit-test file** `tests/unit/test_md_utils.py` with ≥3 cases for `iter_inline_code_spans`: (a) single backtick, (b) triple backtick, (c) unmatched/escaped backticks. Run before and after to confirm parity. |
| 2 | **Snapshot current gate output** on a small fixture directory (e.g., `tests/fixtures/md_hygiene_sample/`) before refactor. After refactor, assert byte-identical stdout/stderr. This is cheap and deterministic. |
| 3 | **Keep `_validate_markdown_math_hygiene` as a thin wrapper** in `check_knowledge_layers.py` for one release cycle if you want a rollback path—just have it delegate to the shared function. Remove the wrapper in a follow-up PR once CI is green. |

---

## Smoke-Test Adjustments

**Add or extend** the following in `scripts/dev/run_all_smoke_tests.sh` (or a dedicated unit-test):

```bash
# Assert inline-code-span parsing edge case (variable-length backticks)
echo 'Expect no link error inside code: `[not a link](foo)`' | \
  python3 scripts/gates/check_markdown_link_hygiene.py --stdin && echo "PASS: inline-code-span"
```

This locks the "code spans mask link-checking" behavior which is the most likely regression vector.

---

## Answers to Proposer Questions

1. **Scope**: Correct scope. Leave `check_notebook_integrity.py` for a separate PR—mixing concerns increases review burden.
2. **Inline-code-span risk**: Yes, real but manageable with the diff + unit-test approach above.
3. **Naming/placement**: `scripts/lib/md_utils.py` is fine. Avoid `scripts/lib/utils.py` (too generic). `md_math_hygiene.py` is appropriately narrow.

---

**TL;DR**: Green-light with the three mitigations above. Ship it.
