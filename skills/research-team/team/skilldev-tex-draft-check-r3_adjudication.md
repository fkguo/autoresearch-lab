# Adjudication — skilldev-tex-draft-check-r3

## Goal (delta)

Implement the next two requested improvements to the TeX-source-first draft cycle:
1) Support `\graphicspath{...}` when resolving `\includegraphics` in deterministic preflight (still WARN-only for missing figures/dirs).
2) Add substance-first draft reviewer system prompt templates and scaffold them into new projects.

## Changes

- `\graphicspath`:
  - Parse `\graphicspath{...}` directory specs from TeX sources (best-effort).
  - Resolve `\includegraphics{...}` by searching: local TeX file dir → main TeX dir → `graphicspath` dirs.
  - Missing `graphicspath` dir is WARN-only; missing figure file remains WARN-only; missing BibTeX keys remain FAIL.
- Draft reviewer prompts:
  - Add `assets/system_draft_member_a.txt` (correctness audit: derivations/method/results; evidence gaps).
  - Add `assets/system_draft_member_b.txt` (literature positioning + substance-first writing; propose query tasks).
  - Scaffold writes both to `prompts/` by default.
- Docs:
  - `SKILL.md` documents role split and mentions `\graphicspath` behavior.
- Regression:
  - Smoke test extended to assert `\graphicspath` resolves an otherwise-missing figure.

## Gate Results

- `bash scripts/dev/run_all_smoke_tests.sh` → PASS (includes updated `smoke_test_tex_draft_cycle.sh`).

## Member Reviews (A/B/C)

- Member A (Opus): `team/skilldev-tex-draft-check-r3_member_a_opus.md`
  - Verdict: approve-with-changes; main concern was visibility of new untracked files in diff context and scope confusion.
- Member B (Gemini): `team/skilldev-tex-draft-check-r3_member_b_gemini.md`
  - Verdict: APPROVE.
- Member C (Sonnet): `team/skilldev-tex-draft-check-r3_member_c_sonnet.md`
  - Verdict: OK WITH NITS (suggests extra idempotency tests and more docs; non-blocking).

## Adjudication

**ACCEPT r3.**

Rationale:
- The `\graphicspath` feature is deterministic, reduces false missing-figure WARNs, and is regression-covered.
- Draft reviewer prompts are scaffolded and explicitly bias toward substantive review (correctness + literature positioning), with explicit Markdown hygiene constraints.
- No change to the core WARN vs FAIL policy split.

## Optional Follow-ups (non-blocking)

1) Add idempotency smoke tests for Markdown autofix scripts (run twice; no second diff).
2) Add a short `prompts/README.md` in scaffold to map prompt files to workflows (team vs draft).

