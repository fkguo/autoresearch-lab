# Adjudication: draft cycle leader audit + convergence gate (r3)

Date: 2026-01-23
Repo: `~/.codex/skills/research-team`

## Change Summary

Goal: Upgrade the TeX-source-first draft review workflow so it supports a real Team Leader audit report (Member C) and a deterministic convergence gate with strict iteration semantics, without breaking existing team cycle semantics.

## Key Decisions (with rationale)

1) Add a third draft reviewer role (Member C = Team Leader Draft Audit) with a strict, parseable output contract.
- Rationale: leader must contribute an independent equation-by-equation audit, and must be included in convergence (correctness-first).

2) Add a deterministic convergence gate for draft review reports (exit 0/1/2).
- Rationale: convergence must be enforceable without trusting free-form LLM text; exit codes must distinguish “needs revision” vs “contract broken”.

3) Keep backward compatibility for existing projects by defaulting `draft_review.require_convergence=false` in library defaults, but set scaffold default to `true` for new projects.
- Rationale: do not break existing workflows; enforce discipline in newly scaffolded projects.

## Files Changed / Added

Core implementation:
- `scripts/bin/run_draft_cycle.sh`
- `scripts/gates/check_draft_convergence.py`
- `scripts/check_draft_convergence.py`
- `scripts/bin/next_draft_tag.py`
- `scripts/bin/scaffold_research_workflow.sh`
- `assets/system_draft_member_c_leader.txt`
- `assets/system_draft_member_a.txt`
- `assets/system_draft_member_b.txt`
- `assets/research_team_config_template.json`
- `scripts/lib/team_config.py`
- `scripts/bin/update_trajectory_index.py`
- `scripts/bin/update_project_map.py`
- `assets/team_latest_draft_template.md`

Docs:
- `SKILL.md`
- `RUNBOOK.md`
- `assets/prompts_readme_template.md`

Tests / validation:
- `scripts/dev/smoke/smoke_test_tex_draft_cycle.sh` (adds exit=2 propagation check)
- `scripts/validation/run_full_contract_validation.sh`

## Deterministic Gate Results

- Smoke tests: `bash scripts/dev/run_all_smoke_tests.sh` → PASS
- Contract validation: `bash scripts/validation/run_full_contract_validation.sh --skip-smoke` → PASS
- Draft smoke (focused): `bash scripts/dev/smoke/smoke_test_tex_draft_cycle.sh` → PASS (covers pass, not_converged exit=1, contract violation exit=2)

## Member Reviews

Member A (Claude Opus 4.5):
- Final: ACCEPT
- Artifact: `team/skilldev-draft-cycle-leader-convergence-r3_member_a_opus.md`
- Note: earlier summary-only packet led to false negatives; rerun with code excerpts resolved.

Member B (Gemini 3 Pro):
- ACCEPT
- Artifact: `team/skilldev-draft-cycle-leader-convergence-r2_member_b_gemini.md`

Member C (Claude Sonnet 4.5):
- ACCEPT
- Artifact: `team/skilldev-draft-cycle-leader-convergence-r2_member_c_sonnet.md`

## Adjudication

Decision: ACCEPT (ship).

Rationale:
- All acceptance criteria are met:
  - leader produces an independent report and is included in convergence when enabled;
  - convergence is deterministic and strict (exit 0/1/2) and is integrated into `run_draft_cycle.sh`;
  - per-run artifacts are discoverable under `team/runs/<tag>/`;
  - preflight-only behavior is preserved;
  - deterministic smoke/validation coverage exists.

Non-blocking follow-ups (optional):
1) Improve convergence log UX by adding explicit links from the convergence log to each member report and/or blocking items.
2) Add an “exit 2 / contract violation” brake check to full contract validation (smoke already covers it).

## Next Tasks

1) (auto) Keep prompt templates stable and strict; if reviewers frequently violate `Blocking issues count: N`, iterate prompt wording rather than relaxing the gate.
2) (manual) If desired, rename `_draft_converged_summary.md` to a more status-neutral filename (requires docs + tooling update).

