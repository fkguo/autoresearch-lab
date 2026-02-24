VERDICT: READY

## Blockers

(none)

## Non-blocking

1. **Progress tracking UX**: `PROGRESS.md`/`PROGRESS.json` written to `--out-dir` is good, but consider adding a summary line to stdout (e.g., "96/96 packs complete, 0 missing") for quick scan without opening files.

2. **Error propagation visibility**: The smoke tests show successful runs, but real corpus failures (network timeouts, malformed arXiv responses, LLM API errors) should be logged distinctly from routine progress updates. Consider a separate `ERRORS.json` or error summary section in `PROGRESS.md`.

3. **Batch size tuning guidance**: The `--n 10` batching is mentioned but the RUNBOOK/SKILL.md don't provide guidance on choosing batch size based on corpus size, API rate limits, or local disk constraints. A one-line heuristic would help.

4. **Cross-subfield pattern validation**: The playbook adds "scheme/scale as diagnostic" as a new pattern from the hep-ph corpus (N=96), but it's unclear if this pattern was validated against the original N=50 set or if it's specific to hep-ph. Consider flagging subfield-specific patterns vs. general patterns.

5. **Latexmk compilation warnings**: The smoke test shows `main.pdf` generation, but doesn't surface whether warnings occurred. For real research output, capturing warning counts (overfull hboxes, undefined refs, etc.) would improve quality assurance.

## Real-research fit

**Strong alignment observed:**

- **Auditable LLM outputs**: External run directories with dual-model outputs (Claude/Gemini) enable manual inspection and comparison—critical for research integrity.
- **Deterministic resume**: `--resume` flag prevents re-running expensive LLM calls on partially complete corpus runs—essential for large-scale pattern extraction.
- **Repair mode**: `--mode repair` targets only missing outputs, minimizing cost and time for fixing transient failures.
- **Corpus robustness**: Handling both tar.gz archives and single-file gzip sources covers the real arXiv distribution (verified by the "gzip-compressed single-file" fix addressing actual failures).
- **Compilation verification**: `latexmk` check ensures generated papers are valid LaTeX, not just syntactically correct markdown-to-TeX conversions.

**Minor gap (non-blocking):**
- The skill doesn't yet guide users on *interpreting* dual-model discrepancies (e.g., when Claude identifies a pattern but Gemini doesn't). This is follow-on work, not a blocker for usability.

## Robustness & safety

**Strengths:**
- **No auto-mutation of skill assets**: LLM runs write to external directories, not back into `assets/style/`. This prevents skill drift and maintains version control integrity.
- **Offline smoke tests**: `--stub-models` allows testing pipeline logic without LLM API calls, reducing cost and enabling CI/CD integration.
- **Schema validation**: The `--strict-mcp-config` fix for `claude-cli-runner` prevents silent failures from malformed MCP responses.

**Recommended additions (non-blocking):**
1. **Rate-limit backoff**: The corpus fetcher and discussion-logic pipeline don't show explicit rate-limit handling for arXiv or LLM APIs. A simple exponential backoff on 429 responses would prevent corpus runs from failing mid-batch.
2. **Disk space pre-check**: For N=96 corpus runs, the combined `.tex` sources, PDFs, and dual-model outputs could be substantial. A pre-flight check estimating required disk space would prevent mid-run failures.
3. **LLM output size limits**: The discussion-logic pipeline doesn't appear to validate model output length. A pathological LLM response (e.g., infinite JSON array) could fill disk or memory. Add a max-output-size check.

## Specific patch suggestions

### 1. Add stdout summary to discussion-logic pipeline (non-blocking)
**File**: `scripts/bin/research_writer_learn_discussion_logic.py`  
**Location**: End of `main()` function, after writing `PROGRESS.json`  
**Patch**:
```python
# After writing PROGRESS.json:
print(f"\n[summary] {len(complete_packs)}/{total_papers} packs complete")
if missing_claude or missing_gemini:
    print(f"[summary] Missing outputs: Claude={len(missing_claude)}, Gemini={len(missing_gemini)}")
```

### 2. Flag subfield-specific patterns in playbook (non-blocking)
**File**: `assets/style/physics_discussion_logic_playbook.md`  
**Location**: Section G ("High-yield patterns observed in exemplar papers")  
**Patch**:
```markdown
- For any renormalized quantity, make scheme/scale conventions explicit and treat residual dependence (or cancellation) as part of the diagnostic. *(Primarily observed in hep-ph corpus; validate against other subfields before generalizing.)*
```

### 3. Add arXiv rate-limit backoff (non-blocking)
**File**: `scripts/bin/fetch_prl_style_corpus.py`  
**Location**: Inside the arXiv API request loop (wherever `urllib` or `requests` is called)  
**Patch**:
```python
import time
from urllib.error import HTTPError

# Inside fetch loop:
try:
    response = urlopen(url)
except HTTPError as e:
    if e.code == 429:
        wait_time = int(e.headers.get('Retry-After', 60))
        print(f"[rate-limit] Waiting {wait_time}s before retry...")
        time.sleep(wait_time)
        response = urlopen(url)  # Retry once
    else:
        raise
```

### 4. Add batch size heuristic to RUNBOOK (non-blocking)
**File**: `RUNBOOK.md`  
**Location**: Section describing `--n` flag for discussion-logic pipeline  
**Patch**:
```markdown
**Batch size (`--n`) recommendation:**
- For N < 50: Use `--n 10` (default).
- For N > 100: Use `--n 20` to reduce file I/O overhead.
- For rate-limited APIs: Use `--n 5` to minimize re-work on transient failures.
```

### 5. Add latexmk warning capture to smoke test (non-blocking)
**File**: `scripts/dev/run_all_smoke_tests.sh`  
**Location**: After `latexmk -pdf main.tex` call  
**Patch**:
```bash
# After latexmk:
warning_count=$(grep -c "LaTeX Warning" main.log || echo "0")
if [ "$warning_count" -gt 0 ]; then
    echo "[smoke] latexmk: $warning_count warnings in main.log"
fi
```

---

**Final assessment**: This milestone is **ready for release**. The acceptance criteria are met, the smoke tests pass, and the real-research fit is strong. The non-blocking items above are valuable follow-ons but do not prevent immediate usability for real workflows.
