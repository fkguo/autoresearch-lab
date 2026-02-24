VERDICT: READY

## Blockers

## Non-blocking
- The smoke test (`scripts/dev/run_all_smoke_tests.sh`) only checks `python3 ... --help`. It does not exercise the runtime logic (e.g., via `--dry-run`).
- In `fetch_prl_style_corpus.py`, `_extract_filtered_tar` calls `tf.extractfile(m)` twice per file (check + read), which is slightly inefficient but functional.

## Real-research fit
- The logic correctly separates "style" (structure/latex source) from "content" (warning against plagiarism).
- Targeting specific co-authors (Guo/Meißner/Hoferichter) in PRL is a highly realistic heuristic for calibration.

## Robustness & safety
- **Network Safety:** The script enforces a strict allowlist (`inspirehep.net`, `arxiv.org`) for outgoing requests.
- **Filesystem Safety:** `_safe_member_path` correctly checks for absolute paths and `..` traversal during tar extraction.
- **Auditability:** The `trace.jsonl` output provides a necessary record of what was fetched and any failures.

## Specific patch suggestions
- **Efficiency (`scripts/bin/fetch_prl_style_corpus.py`):**
  Avoid opening the stream twice:
  ```python
  # Current
  data = tf.extractfile(m).read() if tf.extractfile(m) is not None else None
  
  # Suggested
  ef = tf.extractfile(m)
  data = ef.read() if ef else None
  ```
- **Test Coverage (`scripts/dev/run_all_smoke_tests.sh`):**
  Add a dry-run execution to verify argument parsing and startup logic beyond simple import:
  ```bash
  echo "[smoke] PRL fetcher: dry-run"
  python3 scripts/bin/fetch_prl_style_corpus.py \
    --query "find a guo" \
    --max-records 1 \
    --out-dir "${tmp_root}/prl_corpus" \
    --dry-run >/dev/null
  ```
