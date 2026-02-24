# Adjudication — skilldev-tex-draft-check-r2

## Goal

Ship a TeX-source-first “draft cycle” for `research-team` that:
- runs a deterministic preflight (cite↔bib, refs/labels, figures, KB note mapping),
- builds a focused review packet that prioritizes **methods/results/physics** slices using heuristics (not exact titles),
- extracts key **math/algorithm/proof** environments so reviewers focus on nontrivial content,
- keeps missing label/ref, missing figures, missing KB notes as **WARN**, while missing bib keys for cited entries is **FAIL**.

## Patch Summary (key artifacts)

- Entrypoint: `scripts/bin/run_draft_cycle.sh` (+ wrapper `scripts/run_draft_cycle.sh`)
- Preflight gate: `scripts/gates/check_tex_draft_preflight.py`
- Packet builder: `scripts/bin/build_draft_packet.py`
- TeX parsing utilities: `scripts/lib/tex_draft.py`
- Config defaults/docs: `scripts/lib/team_config.py`, `assets/research_team_config_template.json`, `SKILL.md`
- Regression: `scripts/dev/smoke/smoke_test_tex_draft_cycle.sh`

## Gate Results

- Full smoke suite: `bash scripts/dev/run_all_smoke_tests.sh` → PASS
- Draft-cycle regression: `scripts/dev/smoke/smoke_test_tex_draft_cycle.sh` covers:
  - missing BibTeX key → FAIL (non-zero)
  - missing KB note / missing label / missing figure → WARN-only, cycle still succeeds and packet contains slices

## Member Reviews

- Member A (Opus): `team/skilldev-tex-draft-check-r2_member_a_opus.md`
  - Verdict: **Approve with changes** (main concerns: clarity of `focus_envs=["auto"]` expansion; ensure WARN vs FAIL is tested)
- Member B (Gemini): `team/skilldev-tex-draft-check-r2_member_b_gemini.md`
  - Verdict: **Approve** (notes: `\\graphicspath` not supported → potential noisy WARN; truncation could cut mid-env but acceptable)
- Member C (Sonnet): `team/skilldev-tex-draft-check-r2_member_c_sonnet.md`
  - Verdict: **OK with nits** (docs/exit-code suggestions; verify robustness)

## Adjudication

**Accept r2 implementation.** The core requirements are satisfied:
- Focus slices are heuristic-driven and substantive-first (methods/results/physics) and do not rely on exact section title matching.
- Math/algorithm/theorem/proof env extraction is enabled by default (`focus_envs=["auto"]`).
- WARN vs FAIL severity split is enforced and regression-covered.

### Follow-ups implemented immediately (low-risk)

- Documented the exact `focus_envs=["auto"]` expansion in:
  - `SKILL.md`
  - `assets/research_team_config_template.json`
- Hardened `scripts/bin/run_draft_cycle.sh` to avoid bash arrays (reduces shell-mode parsing risk).

### Deferred follow-ups (optional, non-blocking)

1) Add `\\graphicspath{...}` support for figure resolution (reduce noisy WARNs).
2) Improve truncation to prefer paragraph breaks where possible (packet readability).

## Next Task Suggestion

- Add draft-member system prompt templates under `assets/` (A=derivation audit, B=literature audit) and document recommended reviewer contracts for `run_draft_cycle.sh`.

