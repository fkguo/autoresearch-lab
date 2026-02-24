# Adjudication — skilldev-draftcycle-links-readme-r5

## Goal

Apply two small, non-invasive UX improvements (no over-engineering):
1) Make preflight artifacts discoverable by adding clickable links in the draft review packet.
2) Make prompt files discoverable by scaffolding a minimal `prompts/README.md`.

## Changes

- Draft packet UX:
  - `scripts/bin/build_draft_packet.py` now includes clickable links to:
    - `team/<tag>_draft_preflight.md`
    - `team/<tag>_draft_structure.json`
  - Links are emitted as bare Markdown (`[name](name)`) and are not wrapped in backticks.
- Scaffold UX:
  - New template `assets/prompts_readme_template.md`
  - `scripts/bin/scaffold_research_workflow.sh` now writes `prompts/README.md` in new projects.

## Gate Results

- `bash scripts/dev/run_all_smoke_tests.sh` → PASS

## Member Reviews (A/B/C)

- Member A (Opus): `team/skilldev-draftcycle-links-readme-r5_member_a_opus.md`
  - Verdict: APPROVE WITH NITS (no blockers; warns about relative-link assumptions)
- Member B (Gemini 3 Pro): `team/skilldev-draftcycle-links-readme-r5_member_b_gemini.md`
  - Verdict: APPROVE
- Member C (Sonnet): `team/skilldev-draftcycle-links-readme-r5_member_c_sonnet.md`
  - Verdict: OK WITH NITS

## Adjudication

**ACCEPT r5.**

Rationale:
- Improves reviewer throughput (preflight artifacts are one click away).
- Improves onboarding (prompt file purpose is discoverable without reading code).
- No extra gates, no new LLM constraints, no additional coupling.

## Next Suggestions (optional)

1) Add a minimal one-liner in `prompts/README.md` explaining the underscore naming convention (`_system_*` templates).
2) Add a packet footer link to `prompts/README.md` when the packet is generated inside a scaffolded project.

