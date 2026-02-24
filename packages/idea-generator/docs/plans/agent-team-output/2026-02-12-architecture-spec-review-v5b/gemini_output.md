VERDICT: NOT_READY

## Blockers
- **`eval.run` campaign scoping is not enforceable in the contract**: OpenRPC has `campaign_id` + `node_ids`, but no explicit error/semantics for “node exists but belongs to a different campaign” (current errors omit `node_not_found` / `node_not_in_campaign`). This is a real cross-campaign contamination footgun.
- **Budget envelope vs snapshot is internally inconsistent**: `BudgetEnvelopeV1` requires `max_wall_clock_s`, but `BudgetSnapshotV1.wall_clock_s_remaining` is nullable “if max_wall_clock_s was not set”. Pick one model (always-set vs optional/unbounded) and make both schemas agree.
- **Pagination termination is under-specified**: `NodeListResultV1.cursor` is optional, so a client cannot reliably know whether there are more pages without heuristics; this undermines “machine-enforceable” pagination.

## Non-blocking
- `campaign_id` echo is inconsistent across results: most results include it, but `NodeListResultV1` and `PromotionResultV1` do not (even though you called out “campaign_id echo” as a portability goal).
- Side-effecting RPCs lack idempotency hooks (`eval.run`, `rank.compute`, `node.promote`): retries can duplicate artifacts / mutate state nondeterministically.
- Several “observability MUST” statements in the spec aren’t enforced by required fields (e.g., `CampaignInitResultV1` doesn’t require `budget_snapshot`/`island_states`; `SearchStepResultV1` doesn’t require `n_steps_requested`).
- Phenotype profiling is described as feeding back into `origin`/`eval_info`, but current schemas don’t provide a clean, typed place for those metrics (and `origin`/`eval_info` are strict).

## Real-research fit
- The core research discipline is solid: Explain→Formalize, claim-level provenance, and a grounding audit gate are the right primitives for “real” progress rather than rhetoric.
- Multi-island + clean-room evaluation + debate triggers give you a plausible path to diversity without losing auditability, provided the artifacts for debates/scorecards are also schema-typed.

## Robustness & safety
- Treat grounding audit failures as **structured objects** (failure_type + affected_claim_id/uri + resolver_result) rather than free strings; otherwise downstream automation (“fix suggestions”, kill-criteria routing) becomes brittle.
- Make error responses actionable: for `schema_validation_failed` / `grounding_audit_failed` / `insufficient_eval_data`, include machine-readable `error.data` payloads (e.g., offending node_ids, missing dimensions, validation error paths).
- Consider scoping “read” calls too (`node.get`) if idea-core ever becomes multi-tenant; otherwise the adapter must enforce scoping perfectly forever.

## Specific patch suggestions
- `schemas/budget_snapshot_v1.schema.json`: either (A) change `wall_clock_s_remaining` to non-nullable `number` and update the description, **or** (B) make `budget_envelope_v1.schema.json.max_wall_clock_s` optional/nullable and keep snapshot nullable—do one, not both.
- `schemas/node_list_result_v1.schema.json`: add `"cursor"` to `"required"` (keep it `["string","null"]`), so clients can deterministically paginate; optionally also require `total_count` if you intend it to be reliable.
- `schemas/promotion_result_v1.schema.json`: add a top-level `campaign_id` field (and make it required) to satisfy the “campaign_id echo” discipline.
- `schemas/search_step_result_v1.schema.json`: (1) add `"n_steps_requested"` to `"required"`; (2) add `if/then` gates: `early_stopped=true => require early_stop_reason`, and `new_node_ids` non-empty `=> require new_nodes_artifact_ref`.
- `schemas/campaign_init_result_v1.schema.json`: if observability-at-init is a MUST, require `created_at`, `budget_snapshot`, and `island_states` (with `minItems: 1`) instead of leaving them optional.
- `schemas/idea_core_rpc_v1.openrpc.json`: in `eval.run`, add an explicit error (recommended: `node_not_in_campaign`) and/or include `node_not_found`; also add optional `idempotency_key`. Add `idempotency_key` to `rank.compute` and `node.promote` as well.
- `docs/plans/2026-02-12-idea-generator-architecture-spec.md`: (1) add a normative rule: “engine MUST verify node_ids belong to campaign_id for any campaign-scoped RPC”; (2) reconcile the v0.2 vs v0.3 placement of “bandit distributor / phenotype profiling” so the contract surface matches the milestone table.
- `docs/plans/2026-02-12-implementation-plan-tracker.md`: append an Update Log entry noting the above contract fixes (scoping + budget nullability + pagination cursor requirement), since these are interface/gate-affecting changes.
