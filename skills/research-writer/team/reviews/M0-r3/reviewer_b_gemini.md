VERDICT: READY

## Blockers
(None)

## Non-blocking
- **Date extraction robustness**: In `fetch_prl_style_corpus.py`, `_extract_year` uses `v[:4].isdigit()`. While likely sufficient for INSPIRE data, a regex match for `^(19|20)\d{2}` would be slightly more robust against malformed date strings in metadata.
- **Documentation readability**: The `fetch_prl_style_corpus.py` command example in `assets/style/prl_style_corpus.md` uses a very long URL. Consider showing the `--query` alternative for readability, although the URL copy-paste is practical for users.

## Real-research fit
- **Efficiency**: Filtering for `.tex/.bib/.sty` (excluding PDFs/images) is an excellent design choice for a style corpus; it minimizes bandwidth and storage while preserving exactly what is needed (narrative structure and LaTeX mechanics).
- **Network Resilience**: The script correctly implements "best-effort" logic, logging failures to `trace.jsonl` and continuing, which is essential for batch scraping against rate-limited APIs like INSPIRE.

## Robustness & safety
- **Archive Extraction**: The `_safe_member_path` function explicitly checks for absolute paths and `..` components, preventing Zip Slip/Tar Slip vulnerabilities during extraction.
- **SSRF Protection**: `_host_ok` enforces an allowlist (`inspirehep.net`, `arxiv.org`), preventing the script from being repurposed to fetch arbitrary URLs if a user carelessly pastes a malicious command.

## Specific patch suggestions
(Optional) Strengthen year extraction in `scripts/bin/fetch_prl_style_corpus.py`:

```python
def _extract_year(md: dict[str, Any]) -> str:
    # ... existing logic ...
    # Replace simple slicing with regex to ensure 4 digits
    if isinstance(v, str):
        m = re.match(r'^(\d{4})', v)
        if m:
            return m.group(1)
    # ...
```
