# Adjudication: localdocs sync (r1)

Date: 2026-01-23  
Scope: Sync Nutstore `localdocs/` to current `research-team` skill behavior (output layout, navigation pointers, and zoomable Graphviz diagrams).

## Change set

Updated Nutstore docs under:
- `/Users/fkg/Nutstore Files/Coding/research-team/localdocs/README.md`
- `/Users/fkg/Nutstore Files/Coding/research-team/localdocs/research_team_skill_usage_zh_v1.md`
- `/Users/fkg/Nutstore Files/Coding/research-team/localdocs/research_team_gates_convergence_overrides_v1.md`
- `/Users/fkg/Nutstore Files/Coding/research-team/localdocs/hybrid_architecture_claim_dag_trajectory_v1.md`
- `/Users/fkg/Nutstore Files/Coding/research-team/localdocs/theory_breakthrough_mechanisms_appendix_v1.md`
- `/Users/fkg/Nutstore Files/Coding/research-team/localdocs/research_team_architecture_diagrams_v1.md`

Updated + re-rendered Graphviz assets:
- `/Users/fkg/Nutstore Files/Coding/research-team/localdocs/research_team_architecture_data_layer_v1.dot`
- `/Users/fkg/Nutstore Files/Coding/research-team/localdocs/research_team_architecture_data_layer_v1.svg`
- `/Users/fkg/Nutstore Files/Coding/research-team/localdocs/research_team_system_map_v1.dot`
- `/Users/fkg/Nutstore Files/Coding/research-team/localdocs/research_team_system_map_v1.svg`

Key doc outcomes:
- Canonical run outputs are under `team/runs/<tag>/...` (packet, pointer-lint report, member reports, adjudication).
- Navigation front door is `PROJECT_MAP.md` + `team/LATEST*.md` (+ `artifacts/LATEST.md`).
- Minority/dissent notes standardized to `team/runs/<tag>/<tag>_minority_member_a.md` (replace `member_a` as needed).
- Debug commands in troubleshooting point to correct gate paths and use `--notes ./Draft_Derivation.md` with optional `--root <PROJECT_ROOT>`.

## Deterministic regression

PASS:
- Graphviz regeneration succeeded (`dot -Tsvg ...` for both `.dot` sources).
- Stale-path sweep: no remaining `team/{tag}_*.md` / `team/<tag>_*.md` references in localdocs (except explicit “old path compatible” notes).

## Member reviews

Member A (Claude Opus 4.5):
- r1: REQUEST_CHANGES (minority optionality + pointer-lint visibility + `--root` clarification)
- r2: REQUEST_CHANGES (naming consistency + “cwd/project root” clarification + trajectory mention)
- r3: REQUEST_CHANGES (invalid: claimed `--artifact` flags + phantom `append_trajectory.py`)
- r4: ACCEPT after adding concrete `--help` excerpts proving gate flags are `--notes` and confirming `append_trajectory.py` does not exist

Member B (Gemini 3 Pro):
- r2: ACCEPT (verified script/config existence and default `PROJECT_MAP.md` math hygiene target)

Member C (Claude Sonnet 4.5):
- r2: ACCEPT (nonblocking usability notes only)

## Adjudication

Decision: **ACCEPT**.

Adopted from reviews:
- Added pointer-lint output to `research_team_system_map_v1.dot` and re-rendered SVG.
- Clarified capsule gate troubleshooting: explicit `./Draft_Derivation.md` and optional `--root <PROJECT_ROOT>`.
- Standardized minority report naming across docs to `..._minority_member_a.md` with “replace member id” guidance.
- Added hard evidence in the review packet (`--help` excerpts) to resolve CLI-flag disagreement and avoid LLM drift.

## Next steps (optional)

- In prose (not only diagrams), add one sentence early in `research_team_skill_usage_zh_v1.md` that `PROJECT_MAP.md` is the primary navigation entry.
- Consider unifying placeholder style (`<tag>` vs `{tag}`) across diagrams for aesthetics (non-functional).
