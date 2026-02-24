VERDICT: READY

## Blockers

(none)

## Non-blocking

1. **Trace logging verbosity**: The `fetch_prl_style_corpus.py` script writes a JSONL trace that includes both offline fixture events and potential network failures. While the current implementation is functional, consider adding a `--verbose` flag to control trace detail level for production use (currently all events are logged unconditionally).

2. **Fixture tar member count**: The smoke test creates a minimal 4-member tar fixture (main.tex, references.bib, ../evil.tex, figure.png). Consider adding at least one more common file type (e.g., `.sty` or `.cls`) to increase fixture coverage of the extraction filter logic.

3. **PRL corpus doc clarity**: The phrase "This is not about superficial PRL formatting" appears in multiple files. While the intent is clear, consider a positive framing: "This is about extracting general physics discussion logic (argument flow, diagnostics, uncertainty narration) that transcends journal-specific formatting."

## Real-research fit

**Strong fit.** The milestone addresses a core real-research need: learning from exemplar papers without copy-pasting. Key strengths:

- **Playbook structure**: The `physics_discussion_logic_playbook.md` provides a reusable mind-map template + checklist + prompt template that an agent swarm (or a single agent in a loop) can apply to extract per-paper argument maps and then merge recurring patterns. This is directly actionable for iterative corpus learning.

- **Offline/deterministic smoke coverage**: The fixture-based test for `fetch_prl_style_corpus.py` exercises both the INSPIRE JSON parsing and the arXiv tar extraction in a reproducible, network-free mode. The test correctly validates unsafe path rejection (`../evil.tex`) and extension filtering (`.png` is skipped). This is exactly what a robust style-learning tool needs.

- **Skepticism + auditability preserved**: The updated `style_profile.md` and `writing_voice_system_prompt.txt` maintain the "UNVERIFIED" protocol and provenance requirements. The playbook reinforces these with explicit "limitations + validation plan" guidance in the discussion logic.

- **No external corpus modification**: The milestone explicitly preserves the read-only status of the original Overleaf projects and frames the INSPIRE→arXiv downloader as an *optional* deep-reading tool (not a mandatory dependency).

## Robustness & safety

**Good; minor hardening opportunities exist.**

1. **Path safety**: The `_safe_member_path` function correctly rejects absolute paths and `..` traversal. The smoke test validates this with `../evil.tex`. ✓

2. **Network failure handling**: The script degrades gracefully on HTTP errors (logs to JSONL and continues). The fixture-based test simulates offline mode by providing `--inspire-json` + `--arxiv-tar` paths. ✓

3. **Tar bomb / resource exhaustion**: The script has a 100 MB safety cap on tar size (`max_tar_bytes`). However, there is no explicit check on *number of members* within a tar. A malicious/broken tar with 10,000 tiny files would still be processed. **Suggestion**: Add a `max_members` cap (e.g., 1000) and abort extraction if exceeded.

4. **URL allowlist**: `ALLOWED_HOSTS` is enforced in `_http_get`. ✓

5. **Trace log size**: JSONL trace can grow unbounded if `--max-records` is large. For a 1000-record run, trace could be 1–10 MB (acceptable). Document the expected size or add a note that trace is appendable (safe for incremental runs).

## Specific patch suggestions

### 1. Add max-members cap to tar extraction (safety)

**File**: `scripts/bin/fetch_prl_style_corpus.py`

**Location**: Inside `_extract_filtered_tar`, before the `for m in tf.getmembers()` loop.

**Patch**:
```python
def _extract_filtered_tar(
    tar_bytes: bytes,
    *,
    out_dir: Path,
    exts: set[str],
    trace_path: Path,
    arxiv_id: str,
) -> tuple[int, dict[str, int]]:
    count = 0
    unsafe_rejected = 0
    skipped_ext = 0
    empty_or_unreadable = 0
    seen_files = 0
    max_members = 1000  # safety cap on tar member count
    try:
        with tarfile.open(fileobj=io.BytesIO(tar_bytes), mode="r:*") as tf:
            members = list(tf.getmembers())
            if len(members) > max_members:
                _append_jsonl(
                    trace_path,
                    {"ts": _utc_now(), "event": "tar_too_many_members", "arxiv_id": arxiv_id, "members": len(members), "max_allowed": max_members},
                )
                return 0, {
                    "seen_files": 0,
                    "extracted_files": 0,
                    "unsafe_rejected": 0,
                    "skipped_ext": 0,
                    "empty_or_unreadable": 0,
                    "aborted": "too_many_members",
                }
            for m in members:
                if not m.isfile():
                    continue
                # ... rest of loop unchanged
```

**Rationale**: Protects against tar bombs with pathological member counts (e.g., a 50 MB tar with 100k tiny files).

---

### 2. Add fixture member count > 2 (non-blocking; improves coverage)

**File**: `scripts/dev/run_all_smoke_tests.sh`

**Location**: Inside the Python heredoc that creates the tar fixture, add one more member.

**Patch**:
```python
with tarfile.open(tar_path, mode="w") as tf:
    add_bytes(tf, "main.tex", b"\\\\documentclass{article}\\n\\\\begin{document}\\nHello\\n\\\\end{document}\\n")
    add_bytes(tf, "references.bib", b"@article{K, title={T}, year={2024}, journal=\"\"}\\n")
    add_bytes(tf, "custom.sty", b"% minimal sty fixture\\n")  # <-- ADD THIS
    add_bytes(tf, "../evil.tex", b"should_not_extract\\n")
    add_bytes(tf, "figure.png", b"\\x89PNG\\r\\n\\x1a\\n")
```

After the extraction, add an assertion:
```bash
test -f "${corpus_out}/papers/1234.56789/custom.sty"
```

**Rationale**: Increases fixture coverage to include `.sty` (common in LaTeX sources) and ensures the extraction filter logic is tested for more than two allowed extensions.

---

### 3. Document trace log size expectations (clarity)

**File**: `assets/style/prl_style_corpus.md`

**Location**: After the `python3 scripts/bin/fetch_prl_style_corpus.py ...` code block.

**Patch**:
```markdown
Outputs:
- `/tmp/prl_style_corpus/meta.json` — query + extraction configuration
- `/tmp/prl_style_corpus/trace.jsonl` — per-record success/failure log (network/DNS robust; ~1–10 KB per record; for 100 records, expect ~1 MB)
- `/tmp/prl_style_corpus/papers/<arxiv_id>/...` — extracted TeX/Bib/Sty sources (filtered by extension)
```

**Rationale**: Sets user expectations for trace log size (useful for large-scale corpus builds).

---

### 4. Positive framing for "not superficial PRL formatting" (clarity)

**File**: `assets/style/prl_style_corpus.md`

**Location**: First paragraph under the title.

**Current**:
```markdown
Use this to collect **primary-source LaTeX** for close reading and for extracting **general discussion logic** (argument structure, diagnostics, uncertainty narration, and "bottom line" framing) from exemplar papers. This is **not** about superficial PRL formatting.
```

**Suggested**:
```markdown
Use this to collect **primary-source LaTeX** for close reading and for extracting **general discussion logic** (argument structure, diagnostics, uncertainty narration, and "bottom line" framing) from exemplar papers. The goal is to learn *how strong papers reason and argue*, independent of journal-specific formatting conventions.
```

**Rationale**: Positive framing is clearer and avoids repetition of the negative phrasing across multiple files.

---

**Overall assessment**: The milestone is ready. The acceptance criteria are met: the playbook exists, is wired into the style profile and drafting prompt, the PRL corpus is correctly framed as discussion-logic learning, and offline smoke tests exercise the corpus fetcher with deterministic fixtures (including unsafe-path rejection and trace logging). The non-blocking suggestions are minor improvements for robustness and clarity.
