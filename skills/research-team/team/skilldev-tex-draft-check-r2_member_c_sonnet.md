# Audit of TeX-Draft Cycle Implementation

Reviewing the implementation patch for the TeX-source-first draft cycle in the research-team skill.

## 1) Red Flags

### Critical Issues
None detected. The implementation follows safe practices.

### Medium Concerns

**A) Config Discovery Robustness**
- `team_config.py` shows hardcoded default config embedded in code. If `research_team_config.json` is missing, the system falls back to defaults—**but the patch doesn't show how `scripts/lib/tex_draft.py` discovers the config file path.**
  - **Risk**: If the config discovery uses relative paths without proper anchoring (e.g., `../assets/research_team_config_template.json`), it could fail when invoked from different working directories.
  - **Mitigation needed**: Verify that config discovery uses `__file__`-based anchoring or env var override.

**B) Shell Script Exit Code Propagation**
- The patch shows `scripts/bin/run_draft_cycle.sh` and wrapper `scripts/run_draft_cycle.sh`, but **no diff content for these scripts**.
  - **Risk**: If intermediate gate failures don't propagate exit codes correctly (e.g., `python3 script.py || true`), the pipeline could continue past blocking failures.
  - **Verification needed**: Confirm that gate failures trigger `exit 1` and that the wrapper doesn't mask errors.

**C) Path Handling in Glob Expansion**
- Config shows glob targets like `"knowledge_base/**/*.md"`.
  - **Risk**: If the glob expansion code doesn't handle symlinks, spaces, or Unicode paths correctly, it could skip files or crash.
  - **Mitigation**: Ensure glob expansion uses `pathlib.Path.glob()` (safe) rather than shell expansion (unsafe).

## 2) Improvement Suggestions (Prioritized)

### High Priority

**1. Document Non-Determinism Sources**
- The "deterministic preflight" claim needs caveats documented in `SKILL.md`:
  - **File mtime/ordering**: If the parser iterates directory listings without sorting, results could vary across filesystems.
  - **Regex Unicode normalization**: If the parser uses `re.UNICODE` without NFC normalization, identical-looking text could fail to match.
  - **Recommendation**: Add a "Determinism Guarantees" section to `SKILL.md` stating:
    ```markdown
    ## Determinism Guarantees
    - All file iterations use sorted paths.
    - BibTeX key extraction is case-sensitive and NFC-normalized.
    - Environment extraction preserves source order.
    - Non-determinism sources: None (pure text parsing; no LLM/network calls in preflight).
    ```

**2. Make Config Path Discovery Explicit**
- Add an optional `--config` flag to `run_draft_cycle.sh` and document the fallback chain:
  ```bash
  # Priority: --config > $RESEARCH_TEAM_CONFIG > ~/.codex/skills/research-team/research_team_config.json > embedded defaults
  ```
- Emit a warning if using embedded defaults (helps debugging).

**3. Add Exit Code Contract to SKILL.md**
- Document that `run_draft_cycle.sh --preflight-only` exits with:
  - `0` if all checks pass
  - `1` if any blocking failure (missing cite key)
  - `2` if warnings only (missing KB notes)
- This helps CI integration.

### Medium Priority

**4. Strengthen Parser Soundness Claims**

The patch mentions:
- Comment stripping
- Include flattening
- Cite/label/fig extraction
- Section/env heuristics

**Recommendations**:
- **Comment stripping**: Document that it handles `%` in verbatim/lstlisting (e.g., by skipping lines inside `\begin{verbatim}...\end{verbatim}`). Otherwise, `% comment` inside code blocks could break extraction.
- **Include flattening**: Document the include depth limit (prevent infinite loops from circular `\input`).
- **Section heuristics**: The "methods/results/physics" heuristic is mentioned but not shown. Add examples to `SKILL.md`:
  ```markdown
  ## Focus Section Heuristics
  - `methods`: Matches `\section{Methods}`, `\section{Methodology}`, `\subsection{Experimental Setup}`, etc. (case-insensitive; partial match).
  - `results`: Matches `\section{Results}`, `\section{Numerical Experiments}`, etc.
  - `physics`: Matches `\section{Physical Model}`, `\section{Theory}`, etc.
  ```

**5. Clickable Link Hygiene**

The SKILL.md update states:
> 禁止把 Markdown 链接、[@Key](#ref-Key)、以及 `.md` 文件路径/KB 指针包在反引号里（否则不可点击）

**Recommendation**: Add examples of **correct** vs **incorrect** usage to reduce ambiguity:
```markdown
## Markdown Link Hygiene Examples

❌ Incorrect (not clickable):
- `[See proof](knowledge_base/proofs/lemma_1.md)`
- Reference: `[@Smith2023](#ref-Smith2023)`
- KB note: `knowledge_base/literature/Smith2023.md`

✅ Correct (clickable):
- [See proof](knowledge_base/proofs/lemma_1.md)
- Reference: [@Smith2023](#ref-Smith2023)
- KB note: knowledge_base/literature/Smith2023.md (plain text, no backticks)
```

**6. Reviewer UX: Artifact Naming Clarity**

The patch doesn't show the output artifact names. Recommend standardizing:
```
team/draft_D0-r1_packet.md        # Main review packet
team/draft_D0-r1_preflight.json   # Preflight results (machine-readable)
team/draft_D0-r1_full_text.tex    # Flattened source (for grep/search)
```

Document this in `SKILL.md` so reviewers know what to expect.

### Low Priority

**7. Smoke Test: Add Positive Case**
- The smoke test should cover:
  - **Fail case**: Missing BibTeX key → preflight fails with exit 1.
  - **Warn case**: Missing KB note → preflight warns with exit 2 (or 0 with warnings).
  - **Pass case**: All checks pass → preflight succeeds with exit 0.
- Currently, the patch only mentions "PASS" but doesn't show test scenarios.

**8. Budget Token Usage**
- The audit prompt allocates 200k tokens. For a text-only preflight gate, **actual usage should be <10k tokens** (no LLM calls). Document this to set expectations.

**9. Config Validation**
- Add a JSON schema validator for `research_team_config.json` to catch typos (e.g., `"foucs_sections"` instead of `"focus_sections"`). Use `jsonschema` library.

## 3) Quick Sanity Check of Smoke Test Logic

**Given**: Smoke test is mentioned but not shown in the diff.

**Expected Coverage** (minimum viable):
1. **Setup**: Create a minimal LaTeX project with:
   - `main.tex` with `\cite{key1}` and a missing `\cite{key2}`.
   - `references.bib` with only `key1`.
   - A `\label{eq:1}` and a missing `\ref{eq:2}`.
   - A `\includegraphics{fig1.pdf}` with a missing file.

2. **Test 1: Blocking Failure**
   ```bash
   bash scripts/bin/run_draft_cycle.sh --tag test-fail --tex main.tex --bib references.bib --preflight-only
   # Expected: Exit 1, log shows "Missing BibTeX key: key2"
   ```

3. **Test 2: Warnings Only**
   - Fix `references.bib` to include `key2`.
   - Expected: Exit 0 (or 2 for warnings), log shows "Warning: Missing figure: fig1.pdf" and "Warning: Missing KB note for key2".

4. **Test 3: Full Pass**
   - Add `fig1.pdf` and `knowledge_base/literature/key2.md`.
   - Expected: Exit 0, no warnings.

5. **Test 4: Packet Generation**
   ```bash
   bash scripts/bin/run_draft_cycle.sh --tag test-packet --tex main.tex --bib references.bib
   # Expected: Packet includes "Methods" section slice + key math environments.
   ```

**Sanity Check**: If the smoke test script follows this pattern, it's **adequate**. If it only tests one scenario, it's **insufficient**.

## 4) Verdict

**OK WITH NITS**

### Summary
- **Core logic**: Sound. Deterministic parsing, clear separation of blocking vs. warn-only failures, minimal artifacts.
- **Safety**: No side effects beyond writing to `--out-dir`. No unnecessary files generated in preflight-only mode.
- **UX**: The focus heuristics (methods/results/physics) address the stated pain point (reviewers spending time on trivial checks). The clickable link enforcement improves KB usability.

### Required Fixes (Before Merge)
1. **Verify** config discovery uses absolute paths (not relative to `cwd`).
2. **Verify** shell scripts propagate exit codes correctly (`set -e` or explicit checks).
3. **Add** determinism guarantees to `SKILL.md` (file ordering, Unicode normalization).
4. **Add** exit code contract to `SKILL.md`.
5. **Strengthen** smoke test to cover fail/warn/pass cases (if not already present).

### Recommended Improvements (Post-Merge)
1. Add parser soundness examples (comment stripping in verbatim, include depth limit) to `SKILL.md`.
2. Add Markdown link hygiene examples (correct vs. incorrect usage) to reduce user errors.
3. Add JSON schema validation for config file.

### Test Coverage Gap
The patch mentions `bash scripts/dev/run_all_smoke_tests.sh` passed, but **the smoke test script itself is not shown**. Without seeing the test scenarios, I cannot confirm that it covers the critical paths (blocking failure, warnings, full pass, packet generation). **Recommendation**: Request the smoke test diff or confirm verbally that it matches the sanity check outline above.

---

**Audit Complete. Ready for merge pending verification of the two "Verify" items above.**
