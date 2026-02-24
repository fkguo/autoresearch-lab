VERDICT: READY

## Blockers

(none)

## Non-blocking

1. **Error digest in PROGRESS.md**: The acceptance criteria mention "a short error digest if any `paper_error` occurred," but the provided `progress_example.md` only shows `errors=0`. Consider adding an example or test case that demonstrates the error digest format when errors do occur, to confirm the feature works end-to-end.

2. **Smoke test output not included**: The packet references `team/reviews/M7-r1/smoke_output.txt` for the captured smoke test output, but the actual content is not provided in this review packet. This makes it impossible to directly verify the four smoke-test sub-criteria (resume, repair with `--stub-models`, gzip single-file, latexmk PDF + warning count). The summary evidence is suggestive but not conclusive.

3. **`Retry-After` header edge case**: The description says "uses `Retry-After` seconds when present, else exponential backoff." Confirm that `Retry-After` parsing handles both absolute HTTP-date and delta-seconds formats per RFC 7231, or document that only delta-seconds is supported.

## Real-research fit

- The stdout summary (`packs=1/1 dual=1/1 missing: claude=0 gemini=0`) is concise and actionable for a researcher monitoring a corpus job.
- The `PROGRESS.md` "last run" block provides durable state that survives terminal scrollback loss—good for long overnight runs.
- Deterministic backoff (no jitter) is appropriate for a single-client CLI tool where fairness among competing clients is not a concern; it simplifies debugging and reproducibility.
- Labeling the scheme/scale diagnostic as "especially common in hep-ph" is a helpful domain-specific calibration without over-specializing the playbook.

## Robustness & safety

- Deterministic backoff without jitter could cause lock-step retry storms if multiple users run the script simultaneously against the same endpoint. For a single-user research tool this is acceptable; document the assumption if sharing the script.
- Offline smoke tests with `--stub-models` are a strong addition for CI environments without LLM API keys.
- Handling gzip single-file arXiv sources closes a real gap (many short papers are distributed as `.tex.gz` rather than tarballs).

## Specific patch suggestions

1. **scripts/dev/run_all_smoke_tests.sh** — add explicit exit-code propagation:
   ```bash
   # Near the end of the script
   if [[ $overall_failures -gt 0 ]]; then
     echo "[smoke] $overall_failures test(s) failed"
     exit 1
   fi
   ```
   This ensures CI runners catch partial failures.

2. **scripts/bin/fetch_prl_style_corpus.py `_http_get()`** — guard against malformed `Retry-After`:
   ```python
   retry_after = resp.headers.get("Retry-After")
   try:
       wait = int(retry_after) if retry_after else (2 ** attempt)
   except ValueError:
       wait = 2 ** attempt  # fallback if header is HTTP-date or garbage
   ```

3. **PROGRESS.md template** — include placeholder for error digest:
   ```markdown
   ## Last run

   - processed=N errors=E skipped_existing=S skipped_no_main_tex=T

   ### Error digest (if any)
   <!-- populated automatically when E > 0 -->
   ```

4. **team/reviews/M7-r1/** — include the actual `smoke_output.txt` content (or a redacted excerpt) in future packets so reviewers can verify claims without tool access.
