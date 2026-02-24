VERDICT: READY

## Blockers

(none)

## Non-blocking

1. **Smoke test grep assertion is inverted**: In `run_all_smoke_tests.sh`, the final check `grep_re '\\\\Delta' "${md_dir}/t.md"` asserts that `\\Delta` still exists after the fixer runs. However, the inline code span contains the literal text `` `\\Delta` `` (with single backslash in the rendered markdown, but `\\` in the raw file). The grep pattern `\\\\Delta` matches the raw `\\Delta` which should indeed remain in the code span—this is correct but the comment "should still exist in code spans" could be clearer. Consider adding a negative assertion that the math regions no longer contain double backslashes (e.g., check that `$\Delta` now exists).

2. **Missing explicit exit 0 at end of smoke script**: The script relies on `set -e` and implicit success, which is fine but adding `exit 0` at the end would make intent explicit.

3. **ROADMAP.md M1 status not marked done**: The M0 section says "Status: done" but M1 has no status line. Consider adding "Status: in-review" or similar for clarity.

## Real-research fit

- **Artifact layout flexibility is good**: The scaffold searches multiple conventional paths (`artifacts/runs/<TAG>/`, `artifacts/<TAG>/`, etc.), which accommodates real project variance.
- **Graceful degradation on missing `Draft_Derivation.md`**: The warning-only approach is appropriate for real workflows where researchers may bootstrap a paper before completing the derivation notebook.
- **Style profile captures discipline-appropriate norms**: The FK voice guidance and skepticism/auditability requirements align well with physics publication standards.
- **BibTeX `journal=""` workaround**: This is a real pain point for RevTeX + INSPIRE exports; the deterministic fixer addresses it correctly.

## Robustness & safety

- **Double-backslash fixer is conservative**: Only rewrites inside math regions, leaves code spans untouched, and only fixes the safest patterns (`\\` before letters or `*_^`). This minimizes unintended changes.
- **Tag validation is safe**: The regex `[A-Za-z0-9][A-Za-z0-9._-]*` prevents shell injection or path traversal via `--tag`.
- **`--force` required for overwrite**: Prevents accidental data loss.
- **Network/DNS robustness is documented but not yet implemented**: The SKILL.md mentions graceful degradation for BibTeX fetch failures, but M1 scope is template-only; this is appropriate for M1 and deferred to M2.
- **Reviewer prompts enforce strict output contract**: Both reviewer system prompts are consistent and specify the exact format, supporting clean-room convergence.

## Specific patch suggestions

1. **`scripts/dev/run_all_smoke_tests.sh` ~line 72**: Add a positive assertion that the inline math was actually fixed:
   ```bash
   # After fix, inline math should have single backslash (not double)
   if grep_re '\$\\\\Delta' "${md_dir}/t.md"; then
     echo "ERROR: inline math still contains double backslash after fix" >&2
     exit 1
   fi
   ```

2. **`ROADMAP.md` M1 section**: Add status line for consistency:
   ```markdown
   ## M1: Design + scaffold
   
   Status: in-review
   
   Acceptance criteria:
   ...
   ```

3. **`assets/templates/revtex4-2_onecolumn_main.tex` line 38**: The placeholder `<tag>` in the Results section provenance comment isn't actually substituted by the scaffold script. Either remove it or add substitution logic in M2. For M1 (template-only), this is acceptable but worth noting.
