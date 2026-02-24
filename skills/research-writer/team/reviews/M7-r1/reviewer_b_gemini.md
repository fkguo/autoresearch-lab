VERDICT: READY

## Blockers

## Non-blocking
- **Trace performance:** `research_writer_learn_discussion_logic.py` re-reads the entire `trace.jsonl` to calculate "last run" stats. For very large corpora (e.g., >10k papers), this will become slow. Consider seeking from the end or maintaining a separate run-state file.
- **Ambiguous main file:** The heuristic in `_find_main_tex` (score based on `\documentclass`, `\title`, etc.) is robust for standard arXiv sources but might pick the wrong file if multiple driver files exist (e.g., `response_to_referees.tex` vs `main.tex`). A command-line override for specific papers could be useful in future.

## Real-research fit
- **Rate-limit compliance:** The deterministic backoff in `fetch_prl_style_corpus.py` (respecting `Retry-After` or using strict exponential growth) is well-suited for institutional scraping where jitter is less important than strict obedience to server directives.
- **Workflow resilience:** The split between "new" (batch processing) and "repair" (filling gaps) modes in `research_writer_learn_discussion_logic.py` accurately reflects the reality of building datasets over unstable connections or flaky API endpoints.

## Robustness & safety
- **Resource limits:** `fetch_prl_style_corpus.py` enforces `max_tar_bytes` (100MB) and `_safe_member_path` (traversal prevention), which effectively mitigates risks from malicious or malformed arXiv sources.
- **Offline safety:** `run_all_smoke_tests.sh` correctly mocks network interactions and model calls (`--stub-models`), ensuring CI does not leak API credits or fail due to external outages.

## Specific patch suggestions
- None. The implementations verify the acceptance criteria directly.
