VERDICT: READY

## Blockers

(none)

## Non-blocking

1. **Smoke test fixture tar escaping**: The fixture tar construction in `run_all_smoke_tests.sh` uses `b"\\\\documentclass{article}\\n"` — the double-escaped backslashes inside the Python heredoc may produce literal `\\documentclass` rather than `\documentclass` in the extracted file. If the smoke test is currently passing (as evidenced by the output), the byte escaping must be working, but this is fragile and hard to read. Consider generating the fixture `.tex` content via a temporary file write instead of inline bytes.

2. **`_strip_latex_comments` edge cases**: The implementation correctly handles `\\%` (even backslash count → comment) and `\%` (odd → literal percent). However, it does not handle `\verb|%|` or `\begin{verbatim}` blocks. The docstring says "not a full TeX parser" which is appropriate, but a brief comment noting these known gaps would aid future maintainers.

3. **`--run-models` default model name**: `--gemini-model` defaults to `"gemini-3.0-pro"` which does not currently exist (as of mid-2025, the latest is `gemini-2.5-pro` or similar). This will fail at runtime if used as-is. Since `--run-models` is optional and the docs correctly note prerequisites, this is non-blocking but should be updated.

4. **Diagnostics paragraph length filter**: The `_extract_segments_text` function filters paragraphs to 200–2500 chars. Some PRL papers have very dense single-paragraph conclusions that could be shorter than 200 chars and still carry diagnostics content. Consider lowering the floor to ~120 chars or making it configurable.

5. **Missing `--help` text verification**: Smoke tests call `--help` and redirect to `/dev/null`. They verify exit code 0 but don't check that the help output is non-empty or contains expected substrings. Low-risk but easy to add.

## Real-research fit

- The pipeline is well-designed for real physics research workflows: it fetches real LaTeX sources, flattens `\input` chains, strips comments, extracts structurally meaningful sections, and produces self-contained reading packs with evidence pointers back to the flattened source.
- The masking options (`--mask-math`, `--mask-cites`) are a thoughtful choice for focusing LLM extraction on discussion logic rather than equation details.
- The clean-room dual-model architecture (Claude + Gemini independently, no automatic merging into playbook) is excellent for auditability.
- The `RUNBOOK.md` now documents `--run-models` prerequisites (CLI runners + skills in `$CODEX_HOME`), satisfying the M3-r2 acceptance criterion.
- The N=10 default with descending arXiv ID ordering (recency proxy) is a reasonable heuristic for exemplar selection.

## Robustness & safety

- **Path traversal protection**: `_resolve_input_path` correctly checks `relative_to(paper_dir)` to prevent `\input{../../etc/passwd}` attacks. The corpus fetcher also rejects unsafe tar members (verified by `evil.tex` smoke test).
- **Resource limits**: `_flatten_inputs` has `max_depth=2` and `max_bytes=2_000_000` guards against zip-bomb-like TeX input chains.
- **Comment stripping (backslash parity)**: The `_strip_latex_comments` implementation now correctly handles `\\%` (even number of backslashes → comment starts) vs `\%` (odd → escaped literal percent). This satisfies the M3-r2 hardening criterion.
- **Graceful degradation**: Network failures in fetch are logged to `trace.jsonl`; the pipeline continues processing other papers on per-paper exceptions.
- **No automatic asset mutation**: The script explicitly does not update `physics_discussion_logic_playbook.md` — that remains a human/agent task, which is the right call for safety.

## Specific patch suggestions

1. **`scripts/bin/research_writer_learn_discussion_logic.py`, line ~argparse defaults**:
   ```python
   # Change:
   ap.add_argument("--gemini-model", default="gemini-3.0-pro")
   # To:
   ap.add_argument("--gemini-model", default="gemini-2.5-pro")
   ```

2. **`scripts/bin/research_writer_learn_discussion_logic.py`, `_strip_latex_comments` docstring** — add a brief note about known gaps:
   ```python
   """
   Best-effort comment stripping: remove '%' comments unless escaped as '\\%'.
   Not a full TeX parser (good enough for reading-pack generation).
   Known gaps: \\verb|%| and verbatim environments are not handled.
   """
   ```

3. **`RUNBOOK.md`, section 7** — consider adding a note about model name defaults:
   ```markdown
   > Note: `--claude-model` defaults to `opus` and `--gemini-model` defaults to
   > `gemini-2.5-pro`. Override with current model names as needed.
   ```

4. **`scripts/dev/run_all_smoke_tests.sh`** — consider adding a comment-stripping unit test for the `\\%` edge case to explicitly verify the M3-r2 fix:
   ```bash
   echo "[smoke] comment stripping: backslash-percent edge case"
   python3 -c "
   from scripts.bin.research_writer_learn_discussion_logic import _strip_latex_comments
   # \\% should start a comment (even backslash count)
   assert _strip_latex_comments('hello\\\\\\\\%comment') == 'hello\\\\\\\\\n'
   # \% should be kept (odd backslash count)  
   assert '\\\\%' in _strip_latex_comments('100\\\\% done')
   print('ok')
   "
   ```
   (Alternatively, a dedicated Python unit test file would be cleaner.)
