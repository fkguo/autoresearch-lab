# Adjudication: skilldev-latex-macros-reim (Round 2)

Date: 2026-01-21  
Decision: ACCEPT (converged)  
Scope: research-team skill — extend default LaTeX macro hygiene to include `\re` / `\im`

## Change

- Add `re` and `im` to `latex_macro_hygiene.forbidden_macros` defaults.
- Provide deterministic expansions:
  - `\re` → `{\operatorname{Re}}`
  - `\im` → `{\operatorname{Im}}`
- Extend the macro-hygiene smoke test to include:
  - Positive cases: `\re s`, `\im s` (must fail pre-fix, pass post-fix).
  - Negative prefix-collision cases: `\ref{...}`, `\implies`, `\renewcommand` (must NOT be flagged).

Rationale: `\re` / `\im` are common paper macros that break Markdown rendering; safe boundary regex `(?![A-Za-z])` prevents false positives for standard commands like `\ref` / `\implies`.

## Gate / regression evidence

- `scripts/dev/smoke/smoke_test_markdown_latex_macro_hygiene_gate.sh` PASS

## Member reviews (tri-review)

- Member A (Opus): `team/skilldev-latex-macros-reim-r2_member_a.md` → APPROVE
- Member B (Gemini): `team/skilldev-latex-macros-reim-r2_member_b.md` → APPROVE
- Member C (Sonnet, non-blocking): `team/skilldev-latex-macros-reim-r2_member_c.md` → APPROVE

## Adjudication

- Accept and ship the default macro list extension.
- Keep boundary regex `(?![A-Za-z])` (correct for TeX command-name termination).
- Defer optional extra edge-case tests (`\re` at EOF, digit suffix) as non-blocking.

