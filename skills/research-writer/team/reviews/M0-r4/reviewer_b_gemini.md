VERDICT: READY

## Blockers

## Non-blocking
- `scripts/bin/fetch_prl_style_corpus.py`: `_http_get` reads the full response into memory (`r.read()`) before checking `max_tar_bytes`. While unlikely for arXiv sources, a malicious or erroneous URL could cause an OOM.
- `scripts/bin/fetch_prl_style_corpus.py`: No `User-Agent` header is set. INSPIRE/arXiv APIs often request identifying user agents for responsible use.

## Real-research fit
- The "UNVERIFIED" protocol in `physics_discussion_logic_playbook.md` is a high-value addition, effectively modeling the real-world constraint where researchers must bound the scope of validation.
- The distinction between superficial PRL formatting and "discussion logic" (argument maps) correctly targets the deeper difficulty in AI-assisted writing.

## Robustness & safety
- The offline smoke test (`scripts/dev/run_all_smoke_tests.sh`) explicitly verifies security controls (rejection of `../evil.tex`), which is excellent practice for tool-generated file operations.
- `_safe_member_path` provides directory traversal protection.

## Specific patch suggestions
In `scripts/bin/fetch_prl_style_corpus.py`, consider bounding the read in `_http_get` to fail fast on oversized downloads:

```python
def _http_get(url: str, *, accept: str, timeout_s: int = 30, max_size: int = 105 * 1024 * 1024) -> bytes:
    if not _host_ok(url):
        raise ValueError(f"refusing host not in allowlist: {url}")
    req = Request(url, headers={"Accept": accept})
    with urlopen(req, timeout=timeout_s) as r:
        # Read slightly more than max to detect overflow without buffering GBs
        data = r.read(max_size + 1)
        if len(data) > max_size:
            raise ValueError(f"response body exceeds {max_size} bytes")
        return data
```
