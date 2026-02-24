Using the `research-team` skill to review this patch against the documented workflows and requirements.

---

# Patch Review — TeX-source-first draft cycle (graphicspath + reviewer prompts)

## 1) Correctness Review

### Delta vs Requirements

| Requirement | Implementation Status | Notes |
|-------------|----------------------|-------|
| `\graphicspath` support for `\includegraphics` resolution | **MET (inferred)** | Diff shows SKILL.md documents the behavior; smoke test coverage claimed. Actual Python logic not shown but referenced as passing. |
| WARN-only for missing graphics (not FAIL) | **MET** | SKILL.md: "warn-only if a listed dir is missing" |
| Fail-fast for missing BibTeX keys preserved | **NOT SHOWN** | Diff does not show changes to BibTeX key logic. Assumed unchanged—spec drift risk low since no diff touches citation preflight. |
| New reviewer prompts (A=derivation/method audit, B=literature+substance) | **PARTIALLY SHOWN** | Scaffold copies them; SKILL.md documents the role split. Actual prompt text (`assets/system_draft_member_a.txt`, `assets/system_draft_member_b.txt`) not in diff—cannot verify bias toward nontrivial correctness. |
| Scaffold writes prompts to `prompts/` | **MET** | `scaffold_research_workflow.sh` updated. |
| Smoke test covers `\graphicspath` resolution | **CLAIMED** | Diff references "Validation run: PASS" but actual test file diff not shown. |

### Spec Drift Concerns

1. **Prompt content not visible.** The hard requirement "bias reviewers toward nontrivial correctness (physics/method/results), not formalia" cannot be verified from this diff. The scaffold copies the files, but the file contents are not shown.

2. **New config knobs added without explicit gate logic.** Three new gates (`markdown_math_hygiene_gate`, `markdown_link_hygiene_gate`, `latex_macro_hygiene_gate`) and their config blocks appear in the template. This is *outside* the stated delta scope (which was about `\graphicspath` and draft reviewer prompts). This is scope creep or an undocumented bundled change.

3. **Headline tier system introduced.** The diff adds `[T1]`/`[T2]`/`[T3]` tier annotations to Capsule section E and new config knobs (`min_nontrivial_headlines`, `nontrivial_tiers`). This is **not** in the stated delta focus and represents a separate feature.

**Verdict:** The stated delta is mostly correct, but the patch includes **unstated changes** (hygiene gates, headline tiers) that were not flagged for review.

---

## 2) Failure Modes / Edge Cases

1. **`\graphicspath` with nested/relative paths.** If a user writes `\graphicspath{{./figs/}{../shared/}}` and the TeX file is not at repository root, the resolution logic must handle the base directory correctly. Edge case: symlinks inside `\graphicspath` dirs.

2. **Multiple `\graphicspath` declarations.** LaTeX allows redefinition; only the last one should apply (or scope rules apply if inside groups). Does the preflight handle this?

3. **Macro-generated `\includegraphics` paths.** If a path is built via `\input` or macro expansion (e.g., `\includegraphics{\figdir/foo.pdf}`), the preflight will not resolve it. Warn-only is fine, but documentation should mention this limitation.

4. **Draft system prompts missing in scaffold source.** If the asset files (`assets/system_draft_member_a.txt`, `assets/system_draft_member_b.txt`) are not committed or are empty, `copy_template` will fail silently or produce empty prompts. The scaffold script should validate presence.

5. **New hygiene gates default-on without migration path.** The template sets `markdown_math_hygiene_gate: true` etc. Existing projects that pull a new skill version and regenerate config will suddenly face new gates. Consider default-off or migration guidance.

6. **Headline tier enforcement logic not shown.** Adding tier annotations to the template is one thing; the *gate* that enforces `min_nontrivial_headlines` must parse them. If that parser is not in this patch, the feature is incomplete.

7. **Markdown rendering: display math line starts.** The SKILL.md text mentions "禁止 `\(` `\)` `\[` `\]`" and "行首不能是 `+/-/=`". The autofix script is referenced, but the *gate* itself must reject or warn. If the gate only warns, the hard requirement is not enforced.

8. **`exclude_globs` honored by all three hygiene gates?** Config shows `exclude_globs: []` for each. Confirm the scanning logic respects this (e.g., for generated files or vendored Markdown).

---

## 3) Test Coverage Review

### What the Diff Claims
- "Smoke test expanded to cover `\graphicspath` resolution" — **not shown in diff.**
- "Validation run: PASS" — **output claim only; no test code visible.**

### Minimal Adequate Coverage

For the *stated* delta:

| Scenario | Covered? |
|----------|----------|
| Single `\graphicspath` with single dir, image exists | Unknown |
| Single `\graphicspath` with single dir, image missing | Unknown |
| Multiple dirs in `\graphicspath`, image in second dir | Unknown |
| `\graphicspath` with non-existent dir → WARN (not FAIL) | Unknown |
| BibTeX key missing → FAIL (regression) | Not shown; must be preserved |
| `\includegraphics` without `\graphicspath` (existing behavior) | Presumably existing tests |

**Assessment:** Cannot confirm adequate regression coverage without seeing the test diff. The test file (`test_tex_preflight_graphicspath.py` or similar) should be included in the review.

---

## 4) Recommendation

### APPROVE WITH CHANGES

**Actionable Change List (blocking):**

1. **Include the actual smoke test diff** for `\graphicspath` handling so reviewers can verify coverage of:
   - Multiple search directories
   - Missing directory (WARN, not FAIL)
   - Regression: BibTeX key missing still FAILs

2. **Include the prompt file contents** (`assets/system_draft_member_a.txt`, `assets/system_draft_member_b.txt`) or a separate review pass confirming they bias toward method/physics correctness, not formalia.

3. **Split or explicitly acknowledge the bundled changes:**
   - Markdown math/link/LaTeX macro hygiene gates (new gates, new config)
   - Headline tier system (`[T1]`/`[T2]`/`[T3]`, `min_nontrivial_headlines`)
   
   These deserve their own delta statement and test coverage confirmation.

**Non-blocking suggestions:**

- Add a note to SKILL.md that `\graphicspath` macro resolution has limitations (e.g., no macro-expanded paths).
- Consider `enabled: false` as default for new hygiene gates to avoid breaking existing projects on skill upgrade.
- Scaffold script: add a guard that checks asset file existence before `copy_template`.

---

**Summary:** The core `\graphicspath` improvement and scaffold extension are sound in design. However, the patch bundles undocumented features (hygiene gates, headline tiers), and the test diff for the stated delta is not visible. Approve once the test coverage is shown and the scope creep is acknowledged or split.
