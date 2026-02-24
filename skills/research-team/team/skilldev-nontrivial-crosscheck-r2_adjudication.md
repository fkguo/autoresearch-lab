# Adjudication — skilldev-nontrivial-crosscheck-r2

## Summary

Goal: prevent “Computation Replication” from degenerating into trivial closed-form arithmetic by enforcing **at least one nontrivial diagnostic/proxy** per milestone, deterministically.

Status: **P0 rollout complete** (capsule gate + config/template alignment + regression coverage + reviewer prompt escalation).

## Decision Log (r2)

1) **Adopt tier taxonomy as hard contract** for Capsule E) headline lines:
- Each `- Hn:` must include `[T1]` / `[T2]` / `[T3]`.
- Default: require at least one Tier-T2/T3 headline (nontrivial diagnostic/proxy).
Reason: make “nontrivial audit” unavoidable at the artifact contract level, independent of reviewer behavior.

2) **Add prompt-level triviality escalation** (Member A/B):
- Require `Triviality classification: TRIVIAL / NONTRIVIAL`.
- If any Tier-T2/T3 exists in the capsule, reviewer must check at least one.
- If all checked headlines are TRIVIAL, Computation replication must be `fail` (unless the capsule explicitly sets `Min nontrivial headlines: 0`).
Reason: close the loophole where reviewers select only an easy T1 check and still report “pass”.

3) **Prioritize deterministic regression tests** over “best-effort” heuristics:
- Added/updated smoke tests to lock the contract and avoid future regressions.
Reason: the failure mode was process-level; deterministic tests are the highest-leverage defense.

## Implementation (r2)

Config + templates
- Added `capsule.min_nontrivial_headlines` and `capsule.nontrivial_tiers` defaults in `assets/research_team_config_template.json`.
- Mirrored defaults in `scripts/lib/team_config.py`.
- Documented tier contract + override precedence in `assets/AGENTS_template.md`.

Demo + examples
- Updated `scripts/bin/generate_demo_milestone.py` to generate a Tier-T2 diagnostic headline and include `Min nontrivial headlines: 1`.
- Updated headline examples in `scripts/bin/build_team_packet.py`.

Regression tests
- Updated capsule-embedding smoke fixtures:
  - `scripts/dev/smoke/smoke_test_capsule_gate.sh`
  - `scripts/dev/smoke/smoke_test_claim_dag_gates.sh`
- Added `scripts/dev/smoke/smoke_test_capsule_headline_tiers.sh` to cover:
  - missing tiers → fail
  - all-T1 with `Min nontrivial headlines: 1` → fail
  - all-T1 with `Min nontrivial headlines: 0` → pass
  - at least one T2 → pass

Reviewer prompts
- Updated `assets/system_member_a.txt` and `assets/system_member_b.txt` with:
  - tier-aware check selection
  - required triviality classification
  - escalation semantics

## Gate Results

- Smoke suite: pass
  - Command: `bash scripts/dev/run_all_smoke_tests.sh`

## Multi-member Review

- Member A (Opus): [skilldev-nontrivial-crosscheck-r2_member_a_opus.md](skilldev-nontrivial-crosscheck-r2_member_a_opus.md)
  - Initial recommendation: **REVISE** (requested precedence clarification + min-nontrivial=0 pass regression + rubric tightening).
  - Follow-up action: implemented the requested clarifications + regression coverage in this round.
- Member B (Gemini): [skilldev-nontrivial-crosscheck-r2_member_b_gemini.md](skilldev-nontrivial-crosscheck-r2_member_b_gemini.md)
  - Recommendation: **ACCEPT** (P0 requirements met).
- Member C (Sonnet): [skilldev-nontrivial-crosscheck-r2_member_c_sonnet.md](skilldev-nontrivial-crosscheck-r2_member_c_sonnet.md)
  - Recommendation: **ACCEPT** with minor tightening suggestions (reviewer must check at least one T2/T3 if available; added).

## Adjudication

We accept r2 as completing P0:
- Deterministic capsule gate enforces tier tags + minimum nontrivial diagnostics.
- Reviewer prompts force explicit triviality accounting and block “pass-by-triviality”.
- Regression suite locks the behavior (including the `Min nontrivial headlines: 0` escape hatch).

## Next Steps (choose one)

1) **P1 (auto):** add boundary regressions for `Min nontrivial headlines: 2` and custom `nontrivial_tiers` (e.g. `["T3"]` only).
2) **P1 (auto):** document tier parsing rules precisely (case/placement; what is accepted/rejected) and add a malformed-tier negative test.
3) **P2 (manual):** define “Tier T3” more rigorously (two-method delta contract) and decide whether to add a gate that requires at least one explicit two-method check for `numerics_only/mixed` profiles.

