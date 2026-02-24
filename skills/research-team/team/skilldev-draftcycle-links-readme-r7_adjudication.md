# Adjudication — skilldev-draftcycle-links-readme-r7

## Goal

Two small UX improvements (no over-engineering, no LLM quality constraints):
1) Draft packet links to `prompts/README.md` when present.
2) Regression-cover the link contract in the TeX draft-cycle smoke test; clarify `_`-prefix convention in the scaffolded prompts README template.

## Changes

- `scripts/bin/build_draft_packet.py`
  - Adds `- Prompt files README: [prompts/README.md](../prompts/README.md)` (computed via `relpath`) when `prompts/README.md` exists.
- `scripts/dev/smoke/smoke_test_tex_draft_cycle.sh`
  - Creates a stub `prompts/README.md` and asserts the packet contains the prompt-README link (plus preflight links).
- `assets/prompts_readme_template.md`
  - Clarifies `_`-prefixed files are scaffolded defaults and are meant to be edited.

## Gate Results

- `bash scripts/dev/smoke/smoke_test_tex_draft_cycle.sh` → PASS
- `bash scripts/dev/run_all_smoke_tests.sh` → PASS

## Member Reviews (A/B/C)

- Member A (Opus): `team/skilldev-draftcycle-links-readme-r7_member_a_opus.md` → APPROVE
- Member B (Gemini): `team/skilldev-draftcycle-links-readme-r7_member_b_gemini.md` → APPROVE
- Member C (Sonnet): `team/skilldev-draftcycle-links-readme-r7_member_c_sonnet.md` → OK WITH NITS
  - Notes: smoke-test greps are intentionally strict; acceptable as a contract test (relax later only if format churn becomes a problem).

## Adjudication

**ACCEPT r7.**

