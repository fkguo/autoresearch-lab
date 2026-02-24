# W5-04 Generic Quality Gates Checklist (Schema + Examples)

## Scope
This checklist defines generic (domain-agnostic) quality-gate contracts. It must not encode project-specific physics logic.

## Schema Artifacts
- `schemas/method_fidelity_contract_v1.schema.json`
- `schemas/literature_search_evidence_v2.schema.json`
- `schemas/numerics_method_selection_v1.schema.json`
- `schemas/numerics_validation_report_v1.schema.json`
- `schemas/portability_report_v1.schema.json`
- `schemas/scope_classification_v1.schema.json`
- `schemas/core_loop_execution_audit_v1.schema.json`
- `schemas/milestone_gate_v1.schema.json`

## Mandatory Gate Checks
- Method fidelity:
  - Claimed methodology must be explicitly listed.
  - Implemented method classification must be explicit.
  - If `implemented_method_classification=unconstrained_sampling`, either constraints are present or `expected_limitation=true`.
- Literature quality:
  - Every record includes `evidence_role`, `method_family`, and `triage_reason`.
  - Coverage report includes per-method-family coverage status.
  - Seed gaps are explicit and actionable.
- Numerics method selection:
  - At least 2 methods considered.
  - For `preliminary_physics` or `publication_ready`, choosing simplest method requires explicit justification.
- Numerics validation:
  - Must include convergence sweeps and cross checks.
  - `conclusion=pass` requires `failed_checks_count=0`.
- Portability:
  - Absolute-path and file-netloc hits are explicitly reported.
  - `portable=true` requires zero path/netloc violations.
- Scope policy:
  - `scope=ecosystem_validation|preliminary_physics` implies `non_citation_required=true` and marker `NOT_FOR_CITATION`.
  - `scope=publication_ready` implies `non_citation_required=false`.
- Core-loop anti-skip audit:
  - Must include `search.step`, `eval.run`, `rank.compute`, `node.promote` events.
  - Must include artifact refs:
    - `idea_candidates_v1.jsonl`
    - `idea_scorecards_v1.json`
    - `ranking_result_v1.json`
    - `idea_selection_v1.json`
    - `failed_approach_v1.jsonl` (count >= 1)
- Milestone completion gate:
  - Must include dual review lock: `reviewer_a.model=opus`, `reviewer_b.requested/resolved=gemini-3-pro-preview`, `fallback_mode=ask`, `both_ready=true`.
  - Must include scope policy mirror: `scope=ecosystem_validation|preliminary_physics` => `NOT_FOR_CITATION` required.
  - Must include core-loop artifact refs and `failed_approach_count>=1` to prevent skip-step completion claims.

## Example Artifacts (minimal)
- `docs/plans/examples/2026-02-15-w5-04-gates/scope_classification_v1.ecosystem_validation.example.json`
- `docs/plans/examples/2026-02-15-w5-04-gates/scope_classification_v1.publication_ready.example.json`
- `docs/plans/examples/2026-02-15-w5-04-gates/method_fidelity_contract_v1.example.json`
- `docs/plans/examples/2026-02-15-w5-04-gates/literature_search_evidence_v2.example.json`
- `docs/plans/examples/2026-02-15-w5-04-gates/numerics_method_selection_v1.example.json`
- `docs/plans/examples/2026-02-15-w5-04-gates/numerics_validation_report_v1.example.json`
- `docs/plans/examples/2026-02-15-w5-04-gates/portability_report_v1.example.json`
- `docs/plans/examples/2026-02-15-w5-04-gates/core_loop_execution_audit_v1.example.json`
- `docs/plans/examples/2026-02-15-w5-04-gates/milestone_gate_v1.example.json`

## Validation Commands
- `python3 scripts/validate_w5_quality_schemas.py`
- `make validate`
