VERDICT: NOT_READY

## Blockers

1. **Missing acceptance criterion evidence**: The packet claims "Updates the style profile with PRL/letter tactics and points to the corpus workflow" but `style_profile.md` only adds a section 7 that *references* `prl_style_corpus.md`. The acceptance criterion requires the style profile to be *updated* with PRL/letter tactics themselves (e.g., "fast hook opening", "concise structure", "result-forward figures"). Section 7 describes what those tactics are but does not integrate them into the existing style guidance in sections 1-6. The style profile should show *how* to apply PRL tactics when drafting (e.g., "For PRL targets, use X pattern instead of Y"), not just list them separately.

2. **Fetch script host allowlist incomplete**: `fetch_prl_style_corpus.py` defines `ALLOWED_HOSTS = {"inspirehep.net", "arxiv.org", "export.arxiv.org"}` but the INSPIRE API actually uses `inspirehep.net` for both UI and API endpoints. The script constructs API URLs like `https://inspirehep.net/api/literature?...` which is correct, but the docstring example and the Markdown guide use a UI URL (`https://inspirehep.net/literature?...`). The allowlist should explicitly document which subdomains/paths are expected, and the script should validate that the user-provided `--query-url` is not silently transformed into an API call without origin validation.

3. **Audit trace log format underspecified**: The acceptance criterion requires "an audit trace log" but does not specify what must be logged. The implementation writes JSONL events (download success/failure, extraction counts, skipped records) but does not log:
   - The full INSPIRE API response pagination state (e.g., total hits available vs. fetched),
   - Rate-limit responses (HTTP 429 is mentioned in comments but not logged as a distinct event),
   - Tarball extraction warnings (e.g., unsafe paths rejected, zero-byte files skipped).
   
   For research auditability, the trace must log *all* decision points so a human can verify the corpus is complete and unbiased.

4. **Network robustness claim not testable**: The smoke test calls `fetch_prl_style_corpus.py --dry-run` with `--max-records 0`, which skips all network operations. The acceptance criterion requires "network-robust" behavior, but there is no test that exercises HTTP failures, DNS timeouts, or partial downloads. The packet should include a test fixture (mock HTTP server or recorded responses) that validates graceful degradation and trace logging under failure conditions.

## Non-blocking

1. **BibTeX fetch trace not cross-referenced**: The `SKILL.md` mentions `paper/bibtex_trace.jsonl` when `--fetch-bibtex` is used, but the scaffold script `research_writer_scaffold.sh` is not included in the evidence. The runbook references this trace file but does not explain its schema or how to interpret failures. Add a schema comment or example entry in `RUNBOOK.md` for consistency with the PRL corpus trace format.

2. **Style profile M0 corpus list is stale**: The corpus list in `style_profile.md` section 8 still shows absolute paths (`/Users/fkg/Dropbox/...`) from a personal filesystem. For a skill intended for general use (or multi-user research teams), this section should either:
   - Be removed (corpus scanning is a one-time bootstrap, not runtime behavior),
   - Or documented as "example corpus used during M0 development; not required for using this skill."

3. **Smoke test grep portability**: The smoke test defines `grep_re()` with a fallback from `rg` to `grep -nE`, but the `-n` flag (line numbers) is not used in the test logic—only exit codes matter. Minor: remove `-n` for clarity or document why it's kept (e.g., for manual debugging on failure).

## Real-research fit

**Strengths:**
- The PRL corpus workflow is realistic: INSPIRE is the standard metadata source for HEP/nuclear theory, and arXiv source tarballs are the ground truth for LaTeX style learning.
- The trace log design (JSONL, per-record success/failure) matches real workflows where partial failures are expected and must be auditable.
- The "best-effort" framing (with fallback to stable links) respects that some arXiv entries may be missing or corrupted.

**Concerns:**
- **INSPIRE API pagination is implicit**: The script fetches page-by-page until `hits` is empty, but does not log the total available records vs. fetched count. A researcher using this corpus would want to know: "Did I get all 50 PRL papers, or did the API stop early?"
- **No deduplication logic**: If the same paper appears in multiple INSPIRE pages (e.g., due to metadata updates or multi-author listings), the script will download it multiple times. For a 10-record corpus this is minor, but for larger runs it wastes bandwidth and disk. Consider logging arXiv IDs seen and skipping duplicates.
- **Extension filter is heuristic**: The default extension list (`.tex,.bib,.sty,.cls,.bst,.bbl,.txt`) is reasonable but may miss `.tikz`, `.pgf`, or `.inc` files used in complex figures. The trace log should record *all* files seen (even if filtered out) so a user can audit what was excluded.

## Robustness & safety

**Strengths:**
- The tarball extraction uses `_safe_member_path()` to reject absolute paths and `..` traversal—good defense against malicious arXiv tarballs.
- The host allowlist prevents accidental scraping of non-INSPIRE/arXiv domains.
- The script continues on failure (per-record error logging) rather than aborting, which is correct for batch operations.

**Concerns:**
1. **No retry logic for transient failures**: HTTP timeouts or DNS resolution failures are logged but not retried. For a script designed to fetch 10–50 records, a single transient failure permanently skips that paper. Add a simple retry mechanism (e.g., 3 attempts with exponential backoff) or document that users must re-run the script manually.
2. **INSPIRE API rate limiting is mentioned but not handled**: The docstring says "INSPIRE may rate-limit (HTTP 429)" but the code does not catch `HTTPError` and check the status code. If a 429 occurs, the script logs a generic error and moves to the next page, which may trigger more 429s. Add explicit 429 detection and a backoff-and-retry loop.
3. **Tarball decompression is unbounded**: The script reads the entire tarball into memory (`tarfile.open(fileobj=io.BytesIO(tar_bytes))`) without size limits. A malicious or corrupted tarball could exhaust memory. Add a size check (e.g., refuse tarballs >100MB) or stream decompression with a byte counter.

## Specific patch suggestions

### 1. Integrate PRL tactics into `style_profile.md` sections 1–6

**File:** `assets/style/style_profile.md`

**Change:** Move section 7 ("PRL 'letter' tactics") content into the relevant existing sections. For example:
- Section 1 (High-level voice): add "For PRL targets: lead with a 1-sentence high-level hook, then mechanism, then consequence. Avoid multi-paragraph context in the intro."
- Section 2 (Paragraph mechanics): add "For PRL: use italic lead paragraph ('Introduction.—') instead of a sectioned preamble; signposting is compressed to 1–2 sentences."
- Section 5 (Figure/table captions): add "For PRL: 1–2 key figures max; captions must interpret the feature that carries the argument, not just describe axes."

Then make section 7 a short pointer: "To expand this corpus with your coauthor papers, see `prl_style_corpus.md`."

### 2. Add INSPIRE API total-hits logging

**File:** `scripts/bin/fetch_prl_style_corpus.py`

**Location:** In `_iter_inspire_records()`, after parsing the JSON response.

**Change:**
```python
obj = json.loads(raw.decode("utf-8", errors="replace"))
total_hits = obj.get("hits", {}).get("total", 0)
if page == 1:
    _append_jsonl(trace_path, {"ts": _utc_now(), "event": "inspire_query_start", "url": url, "total_hits": total_hits})
```

This logs the total available records on the first page, so users can verify completeness.

### 3. Add HTTP 429 rate-limit handling

**File:** `scripts/bin/fetch_prl_style_corpus.py`

**Location:** In `_http_get()`, wrap `urlopen()` in a retry loop.

**Change:**
```python
from time import sleep
from urllib.error import HTTPError

def _http_get(url: str, *, accept: str, timeout_s: int = 30, retries: int = 3) -> bytes:
    if not _host_ok(url):
        raise ValueError(f"refusing host not in allowlist: {url}")
    req = Request(url, headers={"Accept": accept})
    
    for attempt in range(retries):
        try:
            with urlopen(req, timeout=timeout_s) as r:
                return r.read()
        except HTTPError as e:
            if e.code == 429 and attempt < retries - 1:
                backoff = 2 ** attempt
                sleep(backoff)
                continue
            raise
    raise RuntimeError("unreachable")
```

Update the trace log in `_iter_inspire_records()` and `_download_arxiv_source()` to log 429 events separately:
```python
except HTTPError as exc:
    if exc.code == 429:
        _append_jsonl(trace_path, {"ts": _utc_now(), "event": "rate_limit_429", "url": url})
    _append_jsonl(trace_path, {"ts": _utc_now(), "event": "http_error", "url": url, "status": exc.code, "error": str(exc)})
```

### 4. Add tarball size check

**File:** `scripts/bin/fetch_prl_style_corpus.py`

**Location:** In the main loop, before `_extract_filtered_tar()`.

**Change:**
```python
MAX_TAR_SIZE = 100 * 1024 * 1024  # 100 MB

try:
    tar_bytes = _download_arxiv_source(rec.arxiv_id)
    if len(tar_bytes) > MAX_TAR_SIZE:
        _append_jsonl(trace_path, {"ts": _utc_now(), "event": "tarball_too_large", "arxiv_id": rec.arxiv_id, "bytes": len(tar_bytes)})
        continue
    _append_jsonl(trace_path, {"ts": _utc_now(), "event": "arxiv_download_ok", "arxiv_id": rec.arxiv_id, "bytes": len(tar_bytes)})
except Exception as exc:
    ...
```

### 5. Add network failure smoke test

**File:** `scripts/dev/run_all_smoke_tests.sh`

**Location:** After the offline dry-run test.

**Change:** Add a test that mocks a DNS failure by using an invalid query URL:
```bash
echo "[smoke] PRL style corpus fetcher: network failure (invalid host)"
set +e
python3 scripts/bin/fetch_prl_style_corpus.py \
  --query "dummy" \
  --query-url "https://invalid.invalid/literature?q=test" \
  --max-records 1 \
  --out-dir "${tmp_root}/prl_style_corpus_fail" \
  >/dev/null 2>&1
code=$?
set -e
if [[ $code -eq 0 ]]; then
  echo "ERROR: expected nonzero exit for invalid host" >&2
  exit 1
fi
test -f "${tmp_root}/prl_style_corpus_fail/trace.jsonl"
grep_re 'inspire_query_error' "${tmp_root}/prl_style_corpus_fail/trace.jsonl"
```

This validates that the script writes a trace log even when the network call fails.

### 6. Document BibTeX trace schema in `RUNBOOK.md`

**File:** `RUNBOOK.md`

**Location:** After section 3 (BibTeX hygiene).

**Change:** Add:
```markdown
### BibTeX fetch trace schema (when --fetch-bibtex is used)

The scaffold writes `paper/bibtex_trace.jsonl` with one JSON object per line:
- `{"ts": "ISO8601", "event": "fetch_ok", "key": "Bezanson2017", "source": "inspire", "url": "https://..."}`
- `{"ts": "ISO8601", "event": "fetch_error", "key": "Smith2020", "error": "HTTP 404", "fallback": "doi_link"}`

Check this file if BibTeX entries are incomplete or use placeholder DOI links.
```
