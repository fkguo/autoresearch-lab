VERDICT: READY

## Blockers

(none)

## Non-blocking

1. **Provenance table column width**: The `p{0.60\linewidth}` column in the provenance table may cause overflow for long artifact paths. Consider using `\small\ttfamily` or wrapping with `\raggedright`.

2. **Title fallback uses directory name**: When `--title` is omitted, the scaffold uses `project_root.name` (e.g., "project: draft"), which may be uninformative for temp directories or generically named projects.

3. **Figure placement determinism**: `[tb]` float placement is fine, but the smoke test doesn't verify that the figure actually appears in the PDF (only that `latexmk` succeeds).

4. **Missing `--verbose` flag**: RUNBOOK.md mentions `--verbose` as a debugging hint, but `research_writer_scaffold.py` doesn't implement it.

## Real-research fit

- **Artifact layout flexibility**: The two-layout detection (preferred `runs/<TAG>/` and fallback `<TAG>_*.json`) covers realistic project evolution patterns.
- **Graceful BibTeX degradation**: The `--fetch-bibtex` trace logging to `bibtex_trace.jsonl` is excellent for reproducibility audits when network calls fail or partially succeed.
- **Draft outline extraction**: Pulling headings from `Draft_Derivation.md` and inserting them as comments in `main.tex` helps authors navigate between notebook and paper.
- **RevTeX4-2 @article workaround**: Addresses a real pain point with INSPIRE exports for preprints.

## Robustness & safety

- **LaTeX escaping for `\texttt{}`**: `_latex_escape_texttt()` handles the critical characters (`\_`, `\%`, `\&`, `\#`, `\$`, `{}`, `\textbackslash`). This prevents injection or compilation failures from artifact paths containing these characters.
- **Tag validation regex**: `[A-Za-z0-9][A-Za-z0-9._-]*` is conservative and prevents path traversal via crafted tags.
- **Symlink fallback to copy**: `_symlink_or_copy()` gracefully handles filesystems that don't support symlinks.
- **Double-backslash fixer scope**: Correctly limited to math regions outside code fences/spans, avoiding false positives on intended `\\` line breaks.

## Specific patch suggestions

1. **`scripts/bin/research_writer_scaffold.py` ~line 245**: Add a `--verbose` flag to match RUNBOOK.md documentation:
   ```python
   ap.add_argument("--verbose", action="store_true", help="Print artifact search paths and other debug info.")
   ```
   Then use it to print `_find_artifact_run_dir` search attempts.

2. **`assets/templates/revtex4-2_onecolumn_main.tex` provenance table**: Consider adding `\small` inside the cells or using `\begin{tabular}{l p{...}}` with `\raggedright` for the second column to prevent overflow.

3. **`RUNBOOK.md` line ~35**: Remove or qualify the `--verbose` reference since it's not yet implemented:
   ```markdown
   - If your project uses a different layout, inspect the scaffold output messages for search paths.
   ```

4. **`scripts/dev/run_all_smoke_tests.sh` ~line 76**: The final `grep_re '\\\\Delta'` assertion comment says the pattern "should still exist in code spans" but the regex tests the whole file. Consider making this more precise or adding a comment that the test verifies code spans weren't incorrectly modified.
