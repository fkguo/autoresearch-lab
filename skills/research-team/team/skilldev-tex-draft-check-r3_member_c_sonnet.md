# Audit: TeX-source-first draft cycle incremental patch

## 1) Red flags

**None blocking**, but watch:

- **Scope creep potential**: Three new hygiene gates (`markdown_math_hygiene_gate`, `markdown_link_hygiene_gate`, `latex_macro_hygiene_gate`) + draft review infra is a substantial surface area increase. If any autofix script has a bug, it could corrupt Markdown at scale.
- **Default-on gates**: All three new hygiene gates default to `true` in the config template. If they produce false positives on edge-case Markdown (nested code blocks, HTML comments, raw LaTeX passthrough), users hit fail-fast on first run. Consider a grace period or explicit opt-in for first release.

## 2) Improvement suggestions (prioritized)

### High priority

1. **`\graphicspath` path resolution: Windows/symlink edge cases**  
   - Current diff doesn't show the Python implementation, but the SKILL.md says "warn-only if a listed dir is missing."  
   - **Suggestion**: Confirm the parser strips LaTeX comments (`%`) from the `\graphicspath` argument before splitting paths. Example hazard:
     ```latex
     \graphicspath{{figures/} % old path
                   {plots/}}
     ```
     Naïve split on `}{` will capture `% old path\n                   {plots/}` as a dir.
   - **Suggestion**: Resolve paths with `os.path.normpath` / `pathlib.Path.resolve()` to handle `..` and symlinks uniformly.

2. **Draft reviewer prompt over-formality risk**  
   - Diff adds `assets/system_draft_member_a.txt` and `system_draft_member_b.txt` but doesn't show content.  
   - **Suggestion**: If these templates inherit the strict "no handwaving" + "Definition-hardened" vocabulary from the main team prompts, they may be too rigid for early-stage LaTeX drafts (which often have TODOs, informal notes, placeholder citations).  
   - **Mitigation**: Ensure the draft prompts explicitly allow "draft-stage slack" (e.g., "flag incomplete citations as WARN, not FAIL; accept TODO markers in discussion sections").

3. **Autofix script determinism: idempotency test**  
   - Three new autofix scripts (`fix_markdown_math_hygiene.py`, `fix_markdown_link_hygiene.py`, `fix_markdown_latex_macros.py`).  
   - **Suggestion**: Add a smoke test that runs each autofix twice on the same input and asserts file content is unchanged after the second run (idempotency). This catches regex over-application bugs.

### Medium priority

4. **Headline tier enforcement: T2/T3 definition opacity**  
   - New Capsule requirement: `min_nontrivial_headlines: 1` with `nontrivial_tiers: ["T2", "T3"]`.  
   - The diff doesn't define what T1/T2/T3 mean (likely in a separate doc or code).  
   - **Suggestion**: Add a one-line comment in the config template explaining tiers (e.g., `"T1: direct result, T2: diagnostic cross-check, T3: independent validation"`). Otherwise, users will grep the codebase or trial-and-error.

5. **`draft_review.focus_sections` heuristic transparency**  
   - Config says "heuristic selection; not exact title matching" for `methods`, `results`, `physics`.  
   - **Suggestion**: Document the heuristic (e.g., "case-insensitive substring match in section titles; includes \section and \subsection"). If it's more complex (e.g., vectorized similarity to a prompt), flag that in the config comment to manage expectations.

6. **Scaffold file proliferation**  
   - Scaffold now writes 2 additional prompt files (`_system_draft_member_a.txt`, `_system_draft_member_b.txt`).  
   - Total prompt file count in a new project: 6 (team A/B, draft A/B, C numerics, packet template).  
   - **Suggestion**: Add a `prompts/README.md` that maps each file to its use case (preflight vs. team cycle vs. draft cycle), especially since naming is now prefix-based (`_system_*` vs. `_team_packet`).

### Low priority

7. **Forbidden macro list hardcodes math shortcuts**  
   - Config lists `"Rc", "Mc", "Cc", "cK", "re", "im"` as forbidden macros with expansions.  
   - **Suggestion**: Add a config key `"discover_from_tex_sources": false` (default off) that, when enabled, auto-populates the forbidden list by parsing local `.tex` files in `references/arxiv_src/` (using the mentioned `discover_latex_zero_arg_macros.py`). This avoids manual maintenance for projects with 50+ custom macros.

8. **Smoke test coverage: missing BibTeX key scenario**  
   - Diff says "Missing BibTeX key for a cited key: FAIL (blocking)" but doesn't show a new smoke test for this.  
   - **Suggestion**: Add a negative test case in `run_all_smoke_tests.sh` that cites `\cite{NonExistent2024}` in a `.tex` file with a `.bib` that lacks that key, and asserts the preflight exits non-zero with a specific error substring.

---

## 3) Quick sanity check: `\graphicspath` logic + smoke test

**(Inferred, since the diff doesn't include the Python implementation—requesting confirmation)**

Expected logic:
```python
import re

def parse_graphicspath(tex_content: str) -> list[str]:
    # Strip LaTeX comments first
    tex_no_comments = re.sub(r'%.*', '', tex_content)
    match = re.search(r'\\graphicspath\{(.*?)\}', tex_no_comments, re.DOTALL)
    if not match:
        return []
    arg = match.group(1)
    # Split on }{ boundaries
    paths = re.findall(r'\{([^}]+)\}', arg)
    return [p.strip() for p in paths if p.strip()]

def resolve_includegraphics(filename: str, graphicspath_dirs: list[str], tex_dir: str) -> str | None:
    # Try relative to .tex first
    candidate = os.path.join(tex_dir, filename)
    if os.path.exists(candidate):
        return candidate
    # Try graphicspath dirs in order
    for gp_dir in graphicspath_dirs:
        abs_dir = os.path.normpath(os.path.join(tex_dir, gp_dir))
        candidate = os.path.join(abs_dir, filename)
        if os.path.exists(candidate):
            return candidate
    return None  # warn-only
```

Smoke test assertions (from "Smoke test expanded to cover `\graphicspath` resolution"):
- **Given** `.tex` with `\graphicspath{{figs/}{plots/}}` and `\includegraphics{plot.pdf}`, **when** `figs/plot.pdf` exists but `plots/` missing, **then** preflight warns about missing `plots/` dir but succeeds (finds `figs/plot.pdf`).
- **Given** `.tex` with `\graphicspath{{missing/}}` and `\includegraphics{img.png}`, **when** `missing/` doesn't exist and `img.png` not in tex_dir, **then** preflight warns twice (missing dir + missing file) but exits 0 (warn-only).
- **Given** `.tex` with comment-polluted `\graphicspath{{figs/} % old\n{plots/}}`, **then** parser extracts `['figs/', 'plots/']` (not `['figs/', '% old\n{plots/']`).

**Request**: Confirm the actual `parse_graphicspath` implementation strips comments and the smoke test includes the comment-pollution case.

---

## 4) Verdict

**OK WITH NITS**

**Rationale**:
- Core `\graphicspath` feature is sound if comment-stripping is implemented (high confidence based on "warn-only" policy and multi-dir resolution intent).
- Draft reviewer prompts are a reasonable split (A=correctness, B=positioning) but need content inspection to confirm they don't overfit to formality.
- Three new hygiene gates are defensible (Markdown math/link/macro safety is a real pain point) but default-on is aggressive—acceptable if autofix scripts are well-tested.
- Smoke test expansion is good; suggest adding negative BibTeX case.
- File proliferation (6 prompt files) is borderline but manageable with a `prompts/README.md`.

**Blocking issues**: None.

**Nits to address before GA**:
1. Confirm comment-stripping in `\graphicspath` parser (1-line regex fix if missing).
2. Add idempotency smoke test for all three autofix scripts.
3. Document T1/T2/T3 tiers in config comment (1 line).
4. Create `prompts/README.md` mapping files to use cases (5 minutes).

**Risk level**: Low (hygiene gates can be toggled off if they misfire; draft cycle is opt-in).
