# Adjudication — skilldev-latex-macro-autoparse-r1

## Scope

Decision review for how `research-team` should handle *custom LaTeX macros* in Markdown math, without regressing deterministic gates.

## Options under review

- **Option A (status quo)**: manually maintain `latex_macro_hygiene.forbidden_macros` + `latex_macro_hygiene.expansions` in `research_team_config.json` (or defaults).
- **Option B**: deterministically parse local LaTeX sources (e.g., `references/arxiv_src/**`) to extract **0-argument** macro definitions and use them to reduce manual macro-by-macro additions.

## Member reports

- Member A (Opus): [skilldev-latex-macro-autoparse-r1_member_a_opus.md](skilldev-latex-macro-autoparse-r1_member_a_opus.md)
- Member B (Gemini): [skilldev-latex-macro-autoparse-r1_member_b_gemini.md](skilldev-latex-macro-autoparse-r1_member_b_gemini.md)
- Member C (Sonnet, non-blocking): [skilldev-latex-macro-autoparse-r1_member_c_sonnet.md](skilldev-latex-macro-autoparse-r1_member_c_sonnet.md)

## Gate impact (this round)

- No gates executed in this decision-only round (no code changes yet).

## Convergence summary

- **A**: Recommends **Hybrid (A+B)** — keep explicit config as the authoritative gate contract; use LaTeX parsing only as *proposal tooling* (warn-only) to preserve determinism and avoid silently trusting unreviewed arXiv sources.
- **B**: Recommends **Option B with strict guardrails** — auto-parsing is necessary for workflow velocity, but must be conservative (0-arg only), deterministic, and visible/debuggable.
- **C**: Recommends **Hybrid (B-lite + A-core)** — same thrust as A; B-lite should discover/suggest, not auto-approve.

## Adjudication (final decision)

Adopt **Hybrid (A-core + B-lite)**, with the user’s requested emphasis: **direct parsing of 0-arg macros**.

### What we will do

1) **Keep the existing fail-fast LaTeX macro hygiene gate** as the enforcement layer.
2) Add a deterministic, local-only **0-arg macro discovery tool** that:
   - scans configured source roots (default: `references/arxiv_src/**`) for `.tex`/`.sty`/`.cls`
   - extracts only **safe 0-argument** definitions (skip anything with `#` args or `[...]` arg-count)
   - supports (minimum): `\newcommand`, `\renewcommand`, `\providecommand`
   - supports (optional, if safe): `\DeclareMathOperator` → emits `{\operatorname{...}}`
   - produces a stable, reviewable output (sorted; deterministic conflict handling)
3) Integrate discovery output as **suggestions** to reduce manual toil:
   - print a ready-to-paste JSON fragment for `latex_macro_hygiene.expansions`
   - optionally write a separate artifact file (e.g., `references/arxiv_src/_macros_zero_arg.json`) for provenance
4) Keep **human approval** as the boundary for updating `research_team_config.json` (to avoid silent gate weakening).

### What we will NOT do (for now)

- We will not attempt full TeX evaluation (catcodes, conditionals, parameterized macros, `\input` semantics beyond shallow scan).
- We will not let the gate behavior depend implicitly on whatever LaTeX sources happen to be present unless explicitly enabled by config (future extension).

## Acceptance criteria for the upcoming implementation

- Deterministic: same repo state → same discovered mapping (stable file order + stable conflict policy).
- Conservative: parameterized macros are ignored (with warnings), not mis-parsed.
- Prefix-safe: discovery and the existing gate must not introduce prefix-collision regressions (`\re` must not match `\ref`; `\im` must not match `\implies`).
- Traceable: discoveries include the source file path and allow auditing in diffs.

## Next tasks (to execute next round)

1) Implement `scripts/bin/discover_latex_zero_arg_macros.py` (or equivalent).
2) Add a smoke/regression test covering:
   - deterministic ordering
   - 0-arg extraction success
   - parameterized macro ignored
   - `\DeclareMathOperator` handling (if implemented)
   - prefix-collision guardrails (explicit fixtures)
3) Optional: hook into `scripts/bin/literature_fetch.py arxiv-source` behind a flag (post-download macro discovery artifact).

