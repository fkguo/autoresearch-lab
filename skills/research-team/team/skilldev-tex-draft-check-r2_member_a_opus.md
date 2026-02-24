I'll invoke the relevant skill first to ensure I follow the proper review process.

Using the research-team skill to guide my review of this TeX draft cycle implementation patch.

Now let me conduct a thorough review of this implementation patch.

---

# Gate/UX Correctness Review

## 1. Gate/UX Correctness Review

### ✅ Requirements That Match

| Requirement | Implementation Status |
|-------------|----------------------|
| **Default focus slices use heuristics** | ✅ `draft_review.focus_sections` uses `["methods", "results", "physics"]` selectors, not exact title matching. SKILL.md explicitly states "heuristic selection; not exact title matching". |
| **Key environments prioritize math/algorithm/proof** | ✅ `draft_review.focus_envs` defaults to `["auto"]` which "expands to core math (equation/align/...) + algorithm/code + theorem/proof" per config template. |
| **Missing label/ref = WARN** | ✅ Based on policy statement in context; need to verify actual implementation in `check_tex_draft_preflight.py` (not shown in diff). |
| **Missing figures = WARN** | ✅ Same as above; stated as non-blocking in requirements. |
| **Missing KB literature notes = WARN** | ✅ Same as above; stated as non-blocking in requirements. |
| **Missing BibTeX keys = FAIL** | ✅ Stated as blocking in requirements; implementation should enforce this. |
| **KB mapping rule: `knowledge_base/literature/<bibkey>.md`** | ⚠️ Path convention stated but enforcement needs verification in preflight gate (not shown in diff excerpt). |
| **Markdown links not wrapped in backticks** | ✅ `markdown_link_hygiene_gate` added with autofix tool; SKILL.md states "禁止把 Markdown 链接...包在反引号里（否则不可点击）". |
| **Minimal artifacts (不要产生不必要的文件)** | ✅ `--preflight-only` flag documented; shell wrapper pattern suggests clean separation. |
| **Deterministic regression with smoke tests** | ✅ `smoke_test_tex_draft_cycle.sh` referenced; full suite passed per context. |

### ⚠️ Concerns/Gaps

| Issue | Severity | Notes |
|-------|----------|-------|
| **Partial diff** — Core implementation files not shown | HIGH | `tex_draft.py`, `check_tex_draft_preflight.py`, `build_draft_packet.py` implementations not visible in diff excerpt. Cannot verify heuristic logic or WARN/FAIL severity assignments. |
| **"auto" expansion undocumented** | MEDIUM | What exactly does `["auto"]` for `focus_envs` expand to? The note says "core math + algorithm/code + theorem/proof" but the exact env names (e.g., `equation*`, `align`, `lstlisting`, `theorem`) should be enumerated. |
| **KB path enforcement** | MEDIUM | Config and SKILL.md don't explicitly show where `knowledge_base/literature/<bibkey>.md` path is checked/enforced. |

---

## 2. Failure Modes / Edge Cases

1. **Empty/malformed BibTeX file**: If `references.bib` is empty or syntactically invalid, does preflight fail gracefully with a clear message, or does it crash? The gate should distinguish "no entries" (possible WARN) from "parse error" (FAIL with diagnostic).

2. **Circular/self-citations in `\cite{}`**: If a document cites itself or has circular bibliography dependencies, the cite↔bib check could enter undefined behavior. Should be handled defensively.

3. **Multi-file TeX projects**: `--tex main.tex` assumes a single entry point, but many projects use `\input{}` or `\include{}`. Does the implementation recursively resolve these? If not, `\cite{}` commands in included files would be missed.

4. **Non-ASCII/Unicode in BibTeX keys**: Keys like `müller2024` or `中文Key` may cause encoding issues in file path mapping (`knowledge_base/literature/müller2024.md`). Filesystem compatibility varies by OS.

5. **Ambiguous section heuristics**: For `focus_sections: ["methods"]`, what if a document has both "Methodology" and "Numerical Methods" sections? The heuristic could select both (bloating the packet) or neither (missing content). Edge case: section titled "Results and Methods".

6. **Environment nesting**: LaTeX allows `\begin{theorem}\begin{proof}...\end{proof}\end{theorem}`. If extraction is naive, nested environments might be double-counted or have malformed boundaries.

7. **Large documents exceeding limits**: With `max_section_chars: 12000` and `max_env_blocks: 25`, truncation logic could cut mid-sentence or mid-equation. Are truncation markers (`[...]` or similar) inserted for reviewer awareness?

8. **Missing autofix idempotency**: If `fix_markdown_math_hygiene.py --in-place` is run twice, does it produce identical output? Non-idempotent fixes could cause churn in version control.

---

## 3. Test Coverage Review

### What's Covered (Based on Context)

| Test | Coverage |
|------|----------|
| Full smoke suite pass | ✅ Stated as passing |
| `smoke_test_tex_draft_cycle.sh` | ✅ Should cover pass/fail + packet generation per requirements |

### Gaps / Missing Tests

| Missing Test | Priority | Rationale |
|--------------|----------|-----------|
| **Heuristic section selection edge cases** | HIGH | No visible test for ambiguous section titles, missing sections, or multi-match scenarios. |
| **BibTeX key case sensitivity** | MEDIUM | `\cite{Key}` vs `key` in `.bib` — test both match and mismatch. |
| **`--preflight-only` artifact count** | MEDIUM | Explicitly verify no packet is generated; only gate output. |
| **KB note WARN vs BibTeX FAIL distinction** | HIGH | Critical requirement; needs explicit test case showing: (a) missing KB note → WARN, passes; (b) missing bib key → FAIL, blocks. |
| **UTF-8 robustness** | LOW | Non-ASCII in paths, keys, section titles. |
| **Nested environment extraction** | MEDIUM | Verify `\begin{proof}` inside `\begin{theorem}` doesn't break parser. |
| **Truncation markers** | LOW | Verify packet indicates when content was truncated. |

### Adequacy Assessment

The smoke test suite **appears minimal but may be adequate** if `smoke_test_tex_draft_cycle.sh` internally covers:
- A TeX file with valid cite↔bib (should PASS)
- A TeX file with missing bib key (should FAIL)
- Packet generation with focus section extraction

**However**, without seeing the smoke test implementation, I cannot confirm the WARN/FAIL distinction is tested. This is a **critical gap** given the explicit requirement.

---

## 4. Recommendation

### **APPROVE WITH CHANGES**

The design is sound and aligns with requirements. The config structure, SKILL.md documentation, and gate/hygiene infrastructure are well-organized. However, the following changes are needed before final approval:

---

### Actionable Change List

| # | Change | Severity | Rationale |
|---|--------|----------|-----------|
| 1 | **Add explicit test case for WARN vs FAIL severity** | 🔴 BLOCKING | Create a smoke test (or unit test) that verifies: (a) missing `knowledge_base/literature/<key>.md` → WARN, gate passes; (b) missing BibTeX entry for `\cite{key}` → FAIL, gate blocks. This is a hard requirement. |
| 2 | **Document `["auto"]` expansion for `focus_envs`** | 🟡 IMPORTANT | In config template or SKILL.md, enumerate the exact LaTeX environments: e.g., `["equation", "equation*", "align", "align*", "algorithm", "algorithmic", "lstlisting", "minted", "theorem", "lemma", "proof", "proposition", "corollary"]`. |
| 3 | **Handle multi-file TeX input** | 🟡 IMPORTANT | Either document that `\input{}`/`\include{}` are resolved, or add a WARN if they're detected but not followed (with a flag to enable recursive parsing). |
| 4 | **Verify `--preflight-only` produces no packet** | 🟢 MINOR | Add assertion in smoke test that output directory contains only gate logs, no `*_packet.md` or similar. |
| 5 | **Add truncation indicator** | 🟢 MINOR | When `max_section_chars` or `max_env_blocks` limits are hit, insert `[... truncated ...]` in packet for reviewer awareness. |
| 6 | **Idempotency check for autofix scripts** | 🟢 MINOR | Add smoke test: run `fix_markdown_*.py --in-place` twice, verify no diff on second run. |

---

### Summary

The patch demonstrates solid architectural decisions:
- Heuristic-based section selection avoids brittle title matching
- Configurable limits prevent packet bloat
- Hygiene gates with autofix tools reduce reviewer burden
- Clear separation of preflight-only vs full cycle

The primary risk is **insufficient test coverage for the WARN/FAIL severity distinction**, which is a hard requirement. Once change #1 is addressed, this is ready to merge.
