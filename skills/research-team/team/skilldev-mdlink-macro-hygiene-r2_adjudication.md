# Adjudication: skilldev-mdlink-macro-hygiene-r2

Date: 2026-01-21  
Decision: ACCEPT (merge-ready)  
Scope: research-team skill — global Markdown link hygiene + LaTeX macro hygiene

## Summary (what/why)

We add two deterministic, project-wide preflight gates and matching deterministic fixers to prevent recurring documentation regressions:
1) Non-clickable KB/file pointers caused by wrapping Markdown links or `.md` paths in inline code spans.
2) Custom LaTeX macros (paper `\newcommand` shortcuts such as `\Rc`, `\Mc`, `\Cc`, `\cK`) leaking into Markdown math where they do not render reliably.

Key requirement satisfied: these checks run **before any LLM calls** and are **deterministic**; fresh scaffolds pass by default.

## Changes landed (r1 → r2)

Addressed Member A/B blockers from r1:
- Inline code spans now parsed with variable-length backtick delimiters (handles ``...`` safely; avoids false positives).
- Fenced code blocks now tracked by delimiter type + minimum length (CommonMark-style; avoids fragile toggle).
- `.md#anchor` inline-code pointers are now treated as Markdown paths and are flagged/fixed.
- Macro fixer now errors when forbidden macros appear but no expansion is configured (prevents misleading “ok”).
- Gate directory scans skip `.git`.

## Gate/Regression evidence

- Skill smoke tests:
  - `scripts/dev/smoke/smoke_test_markdown_link_hygiene_gate.sh` PASS
  - `scripts/dev/smoke/smoke_test_markdown_latex_macro_hygiene_gate.sh` PASS

## Member reviews (tri-review)

Round 1:
- Member A (Opus): `team/skilldev-mdlink-macro-hygiene-r1_member_a.md` → REQUEST_CHANGES
- Member B (Gemini): `team/skilldev-mdlink-macro-hygiene-r1_member_b.md` → REQUEST_CHANGES
- Member C (Claude Sonnet): `team/skilldev-mdlink-macro-hygiene-r1_member_c.md` → APPROVE (non-blocking)

Round 2 (post-fixes):
- Member A (Opus): `team/skilldev-mdlink-macro-hygiene-r2_member_a.md` → APPROVE
- Member B (Gemini): `team/skilldev-mdlink-macro-hygiene-r2_member_b.md` → APPROVE
- Member C (Claude Sonnet): `team/skilldev-mdlink-macro-hygiene-r2_member_c.md` → APPROVE (non-blocking)

Note: Claude model `sonnet-4.5` was unavailable in this environment; Member C used `sonnet` as a non-blocking audit substitute.

## Adjudication (final)

- Accept the change set as converged and merge-ready.
- Keep current heuristics as the default policy:
  - links/citations/path pointers must be clickable (no backtick wrapping)
  - paper macros must be expanded in Markdown math
- Defer optional enhancements (not blocking):
  - extra edge-case tests (nested fence lengths, multi-span lines, anchor cases)
  - broader link regex hardening (nested brackets)

## Next steps

1) Roll these fixers over any existing in-flight projects that now fail the new gates:
   - `python3 ~/.codex/skills/research-team/scripts/bin/fix_markdown_link_hygiene.py --root <repo> --in-place`
   - `python3 ~/.codex/skills/research-team/scripts/bin/fix_markdown_latex_macros.py --root <repo> --in-place`
2) If a project needs additional macros, add them under `latex_macro_hygiene.forbidden_macros` + `latex_macro_hygiene.expansions` in `research_team_config.json`.

