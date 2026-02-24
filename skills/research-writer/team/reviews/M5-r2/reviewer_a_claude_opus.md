VERDICT: READY

## Blockers

(none)

## Non-blocking

1. **Truncated file snippets**: The provided snippets of `fetch_prl_style_corpus.py` and `research_writer_learn_discussion_logic.py` are cut off mid-function. While the described functionality appears present, reviewers cannot verify the full implementation. Consider including complete files or explicit markers when snippets are intentional.

2. **External corpus count assertion is underdocumented**: The evidence line `packs 50 claude 50 gemini 50 both 50` relies on an unshown external directory. A one-liner shell snippet (e.g., `ls -1 packs | wc -l`) in the packet would make this self-verifying.

3. **Smoke test coverage of batching/resume**: The smoke tests exercise offline fixtures but do not explicitly demonstrate the `--resume` or `--mode repair` codepaths. Adding a deterministic two-pass smoke test (first run creates, second run skips) would strengthen confidence.

4. **Gemini preamble handling location**: `_sanitize_gemini_output()` is shown, but the smoke tests don't assert that model outputs start with expected content. A regex-based assertion on fixture outputs would make the contract enforceable.

## Real-research fit

- The N=50 scale and batching/resume workflow are realistic for iterative corpus studies where network flakiness or API rate limits interrupt runs.
- The repair mode (`--models gemini` subset reruns) directly addresses the real scenario of partial dual-model failures.
- The explicit refusal to auto-mutate the playbook preserves human/agent judgment in the loop, which is essential for anti-plagiarism and quality control.
- The separation of "raw measurement" vs. "model-dependent extraction" in the playbook (G6) reflects genuine methodological practice in precision physics.

## Robustness & safety

- **Allowlisted hosts** in the fetcher (`ALLOWED_HOSTS`) prevent arbitrary network access; appropriate for controlled metadata retrieval.
- **Path traversal protection** in `_safe_member_path()` rejects `..` and absolute paths.
- **Timeouts** on subprocess calls prevent indefinite hangs during model inference.
- **Trace JSONL** provides an audit trail for every fetch/model invocation, supporting reproducibility and debugging.
- **No automatic playbook mutation**: model outputs are written to separate files; merging into skill assets remains a deliberate step.

Minor concern: The subprocess calls to `bash` runners inherit the environment; if the runner scripts are user-editable outside this repo, that's a trust boundary to document (low risk in the intended single-user research context).

## Specific patch suggestions

1. **RUNBOOK.md, line ~90**: Add a verification one-liner after the N=50 section:
   ```bash
   # Verify pack counts:
   ls -1 "$OUT_DIR/packs" | wc -l          # should be 50
   ls -1 "$OUT_DIR/packs"/*/claude.md | wc -l  # should be 50
   ls -1 "$OUT_DIR/packs"/*/gemini.md | wc -l  # should be 50
   ```

2. **scripts/dev/run_all_smoke_tests.sh**: Consider adding a `--resume` round-trip smoke test:
   ```bash
   # [smoke] discussion-logic packs: resume mode (no re-generation)
   python3 scripts/bin/research_writer_learn_discussion_logic.py \
     --corpus-dir "$FIXTURE_CORPUS" --out-dir "$TMP_OUT" --n 1 --resume
   python3 scripts/bin/research_writer_learn_discussion_logic.py \
     --corpus-dir "$FIXTURE_CORPUS" --out-dir "$TMP_OUT" --n 1 --resume
   # assert second run logs "skipped_existing: 1"
   ```

3. **scripts/bin/research_writer_learn_discussion_logic.py**: The `_sanitize_gemini_output()` function could log when it strips a preamble, aiding debugging:
   ```python
   if cleaned != raw:
       _append_jsonl(trace, {"ts": _utc_now(), "event": "gemini_preamble_stripped", "path": str(path)})
       path.write_text(cleaned, encoding="utf-8")
   ```
   (Requires passing `trace` or a logger to the function.)

4. **assets/style/style_sources_used.md**: The N=50 list is arXiv IDs only. Adding a one-line title per entry (as done for N=10) would improve human auditability without bloating the file significantly.
