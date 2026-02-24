

I'll review this design bundle systematically. Let me first check if any skills apply to this task.

Given this is a detailed architecture review of an AI-assisted scientific discovery system, I should check the referee-review and hepar skills as they're directly relevant.

VERDICT: READY

---

## Blockers

**No blocking issues remain.** All previously identified blockers have been resolved:

1. **`node_id` vs `idea_id` ambiguity** — Resolved. §5.2 of the spec clearly defines the semantics: `node_id` is a version-level graph node, `idea_id` is a lineage/family identifier. `parent_node_ids[]` correctly references `node_id`. The `IdeaListFilterV1` schema exposes both as independent filter axes. The `IdeaNodeV1` schema marks both as `format: "uuid"` and both are required. Clean.

2. **Pagination** — Resolved. `node.list` takes `cursor` (opaque string) and `limit`; `NodeListResultV1` returns `cursor: string|null` and `total_count`. Sufficient for forward-only cursor pagination. No issues.

3. **`eval.run` campaign scoping** — Resolved. `eval.run` now takes both `campaign_id` (required) and `node_ids[]` (required, minItems: 1). The `campaign_not_found` and `node_not_found` errors are both listed. This means the engine can validate that all `node_ids` belong to the specified campaign before proceeding.

4. **`insufficient_eval_data`** — Resolved. Error code `-32013` is declared on `rank.compute`, which is the correct locus (ranking requires prior eval data to exist).

5. **Schema SSOT** — Resolved. The spec (§2.3) includes a hard constraint that `schemas/*.schema.json` is the single source of truth, the OpenRPC file uses only `$ref`, and any bundling must be mechanical. The OpenRPC `components.schemas` entries all use `$ref` to sibling files. No duplication detected.

---

## Non-blocking

### N1. `search.step` `n_steps` default value in JSON Schema vs OpenRPC

The OpenRPC param declares `"default": 1` inline in the method definition. This is fine for documentation, but JSON Schema Draft 2020-12 treats `default` as an annotation, not a validation keyword. The *implementation* must supply the default server-side. This is standard practice but worth a one-line comment in the spec to prevent adapter implementors from assuming the schema itself enforces the default.

**Severity**: Informational.

### N2. `BudgetSnapshot` `oneOf` for nullable fields

`wall_clock_s_remaining` and `steps_remaining` both use `oneOf: [{ type: number/integer }, { type: null }]`. This is the correct Draft 2020-12 pattern for nullable fields. Coherent and well-documented with the `description` fields explaining when null applies. ✅

### N3. `eval.run` `node_not_found` — error code newly added

Error code `-32004` (`node_not_found`) is now listed under `eval.run`. This is the correct fix: if any node_id in the batch is invalid, the engine should reject early. However, there's a UX subtlety: should the engine report *which* node_id(s) failed? The current error object is just `{ code, message }`. Consider:

**Suggestion**: Allow the JSON-RPC error `data` field to carry `{ "invalid_node_ids": ["uuid1", "uuid2"] }`. This doesn't require schema changes (JSON-RPC 2.0 allows freeform `data` in error objects), but a brief note in the spec or a comment in the OpenRPC would help implementors.

### N4. `PromotionResult` `grounding_audit_summary` — well-structured

The `grounding_audit_summary` in `promotion_result_v1.schema.json` includes `status`, `folklore_risk_score`, and `failures[]`. This mirrors the `grounding_audit` field in `IdeaNodeV1` but serves as a *summary* at promotion time. The naming distinction (`grounding_audit` on the node vs `grounding_audit_summary` on the promotion result) is clear. ✅

### N5. `IslandState.team_policy_id` — not required

`team_policy_id` is optional in `island_state_v1.schema.json` (not in `required`). This is consistent with the spec, which says islands *may* be associated with a Team. However, `CampaignCharterV1` also has an optional `team_policy_id`. There's no stated rule about inheritance (campaign-level default → island-level override). This is fine for v0.2 but should be specified by v0.3.

### N6. `IdeaNode.updated_at` — present but not required

`updated_at` is defined but not in the `required` array of `idea_node_v1.schema.json`. This is appropriate: a freshly created node that has never been mutated might omit it. The description ("Timestamp of last mutation") is clear. ✅

### N7. Missing `max_nodes` budget dimension

The spec §1.1.5 mentions "节点数" (node count) as a budget parameter, but `BudgetEnvelopeV1` doesn't have `max_nodes`. This is manageable via `extensions`, but it's a gap between prose and schema.

### N8. `campaign.init` `formalism_registry` parameter — merge semantics

The OpenRPC description says "entries are merged (caller entries take precedence on formalism_id collision)." This is clear, but the merge is by `formalism_id` which is a unique key within the `entries` array. Since the schema uses an array (not a map), the engine must de-duplicate by `formalism_id`. An implementation note or a `uniqueItems`-like constraint (JSON Schema doesn't support uniqueness on a sub-field) would be helpful as a comment.

### N9. `EvalResultV1` lacks per-node score summary

`eval_result_v1.schema.json` returns `node_ids`, `scorecards_artifact_ref`, and `budget_snapshot` — but no inline score summary. The caller must dereference `scorecards_artifact_ref` to see any results. This is a defensible design choice (scores belong in artifacts, not in RPC results) but makes the RPC less self-contained for monitoring dashboards. Consider an optional `score_summary` array.

### N10. No `campaign_id` parameter on `node.get` or `node.promote`

Both `node.get` and `node.promote` take only `node_id`. If `node_id` is globally unique (UUID), this is fine. But it means the engine must maintain a global node index, not just per-campaign stores. This is an implementation concern, not a schema bug, but worth noting for storage design.

---

## Real-research fit

### Strong points

1. **Evidence-first provenance is deeply wired**: The claim-level `support_type` + `evidence_uris` + conditional `verification_plan` requirement (via `allOf/if/then`) is exactly right for HEP research integrity. The `allOf` constraint in `idea_card_v1.schema.json` that forces `verification_plan` for `llm_inference`/`assumption` and `minItems: 1` for `evidence_uris` on literature/data/calculation claims is a **machine-enforceable hallucination mitigation** — this is excellent.

2. **Formalism registry gating promotion**: The requirement that `candidate_formalisms[]` must match the registry before `node.promote` succeeds is a real research safety valve. In HEP, "I'll use effective field theory" is meaningless without specifying *which* EFT, what power counting, what matching scheme. The `formalism_id` pattern (`namespace/name`) forces this specificity.

3. **Grounding audit with active URI resolution**: The spec requires actual API calls to INSPIRE/DOI resolvers (not just regex validation). This addresses a real failure mode: LLMs confidently cite non-existent papers ("phantom references"). The `grounding_audit.failures[]` field provides actionable diagnostics.

4. **Multi-island search with stagnation detection**: The state machine (SEEDING → EXPLORING → CONVERGING → STAGNANT → REPOPULATED/EXHAUSTED) maps well to real research exploration patterns. The `repopulate` mechanism (injecting ideas from productive islands into stagnant ones) mirrors actual research group dynamics.

5. **Operator taxonomy reflects real physics reasoning**: `AnomalyAbduction`, `SymmetryOperator`, `LimitExplorer`, and `AssumptionInversion` correspond to actual modes of theoretical physics reasoning. The `ProtectiveBeltPatch` (Lakatos) operator is a particularly sophisticated touch — protecting the hard core while modifying auxiliary hypotheses is exactly how BSM model-building works in practice.

6. **`novelty_delta_table` with `non_novelty_flags`**: The explicit enumeration of things that *don't* count as novelty (`parameter_tuning_only`, `relabeling_only`, `equivalent_reformulation`, `no_new_prediction`) addresses a pervasive failure mode in LLM-generated research ideas, where superficial reformulations are presented as breakthroughs.

### Potential research-workflow gaps

7. **No explicit "literature saturation" signal**: In real HEP research, you often reach a point where the INSPIRE search returns the same cluster of papers repeatedly. The system has `STAGNANT` for score-based stagnation but no explicit mechanism for detecting that the evidence base is exhausted (all relevant literature has been retrieved). This could be a v0.3 addition.

8. **`minimal_compute_plan` granularity is good**: The `estimated_difficulty` enum (`straightforward` through `research_frontier`) and `required_infrastructure` enum (`laptop` through `not_yet_feasible`) map well to real physics resource planning. The `estimated_compute_hours_log10` is a pragmatic touch.

---

## Robustness & safety

### S1. Hallucination mitigation — multi-layered and adequate

The design implements defense-in-depth:
- **Layer 1**: `support_type` forces classification of every claim.
- **Layer 2**: Conditional `verification_plan` requirement for LLM-generated claims.
- **Layer 3**: Active URI resolution in grounding audit.
- **Layer 4**: Clean-room multi-agent evaluation (reviewers don't share drafts).
- **Layer 5**: `folklore_risk_score` with human escalation above threshold.

This is a strong hallucination mitigation stack. The main residual risk is that the LLM generating the `support_type` label itself might misclassify — e.g., labeling an `llm_inference` as `literature` and then citing a real but irrelevant paper. The active resolution (Layer 3) would pass, but the claim-evidence alignment would be wrong. This is acknowledged in §4.2.1 ("看似有引用但引用并不支撑 claim") but the grounding audit spec focuses on *resolvability* and *data consistency*, not semantic relevance. Consider:

**Recommendation**: Add a `claim_evidence_alignment` check to the grounding audit (even as a soft/advisory dimension) that verifies the cited paper actually discusses the topic of the claim. This could be a v0.3 evaluator dimension.

### S2. Budget circuit breaker — well-specified

The three-axis circuit breaker (tokens, USD, wall-clock) with ordered degradation is robust. The `degradation_order` enum is specific and actionable. The `BudgetSnapshot` is returned by every mutating RPC call, enabling external monitoring.

### S3. Clean-room guarantee — enforced by architecture

The spec correctly identifies that clean-room evaluation requires *separate sessions/contexts*, not just prompt instructions. The `EvaluatorConfig.clean_room: true` (default) flag is the right mechanism. The structured debate protocol (`|Δscore| > 2` triggers point/counterpoint exchange) is a reasonable compromise between evaluation cost and disagreement resolution.

### S4. Append-only ledger — mentioned but not schematized

The spec mentions "全流程事件追加到账本（append-only）" but there's no ledger event schema in the bundle. This is acceptable for v0.2 (hepar handles the ledger), but a `ledger_event_v1.schema.json` should be on the v0.3 roadmap.

### S5. Idempotency keys — good

`campaign.init` and `search.step` both accept optional `idempotency_key`. This is critical for retry safety in a system where each step involves expensive LLM calls. The key should be documented as client-generated (which the OpenRPC implies by making it a parameter, not a response field).

---

## Specific patch suggestions

### Patch 1: Add `max_nodes` to `BudgetEnvelopeV1`

**File**: `schemas/budget_envelope_v1.schema.json`

**Change**: Add `max_nodes` as an optional property:
```json
"max_nodes": {
  "type": "integer",
  "minimum": 1,
  "description": "Maximum number of IdeaNodes that may be created in this campaign. Optional; uncapped if omitted."
}
```
**Rationale**: The spec §1.1.5 lists "节点数" as a budget dimension but the schema omits it. This is a first-class search space size control.

### Patch 2: Document error `data` field conventions for batch operations

**File**: `schemas/idea_core_rpc_v1.openrpc.json`

**Change**: Add a top-level `"x-error-data-conventions"` (or within `info.description`) noting:
```
For batch-accepting methods (eval.run), error objects MAY include a 'data' field: 
{ "invalid_node_ids": ["<uuid>", ...] } for node_not_found, 
{ "field": "<path>", "message": "<detail>" } for schema_validation_failed.
```
**Rationale**: JSON-RPC 2.0 allows `data` on error objects. Documenting conventions aids adapter implementors without requiring schema changes.

### Patch 3: Add optional `score_summary` to `EvalResultV1`

**File**: `schemas/eval_result_v1.schema.json`

**Change**: Add optional inline summary:
```json
"score_summary": {
  "type": "array",
  "description": "Optional per-node aggregate scores for quick inspection. Full scorecards remain in the artifact.",
  "items": {
    "type": "object",
    "required": ["node_id", "aggregate_score"],
    "properties": {
      "node_id": { "type": "string", "format": "uuid" },
      "aggregate_score": { "type": "number" },
      "dimension_scores": {
        "type": "object",
        "additionalProperties": { "type": "number" }
      }
    },
    "additionalProperties": false
  }
}
```
**Rationale**: Avoids a round-trip artifact dereference for monitoring/dashboards; the full scorecards artifact remains the SSOT.

### Patch 4: Add `created_at` to `IdeaNodeV1` required fields

**File**: `schemas/idea_node_v1.schema.json`

**Change**: Move `created_at` from optional to `required`:
```json
"required": [
  "campaign_id", "idea_id", "node_id", "parent_node_ids",
  "island_id", "operator_id", "origin", "operator_trace",
  "rationale_draft", "created_at"
]
```
**Rationale**: `origin.timestamp` exists (required), but `created_at` on the node itself is the canonical append-only ordering key. Since every node must be created at a known time, this should be required. Alternatively, if `origin.timestamp` is intended to serve this purpose, document that explicitly and remove `created_at` as a separate field to avoid ambiguity.

### Patch 5: Add `campaign_id` to `node.promote` params

**File**: `schemas/idea_core_rpc_v1.openrpc.json`

**Change**: Add optional `campaign_id` parameter to `node.promote`:
```json
{
  "name": "campaign_id",
  "schema": { "type": "string", "minLength": 1 },
  "description": "Optional campaign context. If provided, engine validates node belongs to campaign. If omitted, engine resolves via global index."
}
```
**Rationale**: Defense-in-depth for multi-campaign deployments; prevents promoting a node from campaign A while intending campaign B. Keeps backward compatibility by being optional.

### Patch 6: Clarify `formalism_registry` merge semantics in spec prose

**File**: `docs/plans/2026-02-12-idea-generator-architecture-spec.md`

**Change**: In §7 (DomainPack), after the formalism registry bullet, add:

> **Merge rule**: When `campaign.init` provides `formalism_registry`, entries are merged with the DomainPack default by `formalism_id`. Caller-provided entries take precedence on collision. The resulting merged registry is immutable for the campaign lifetime (no hot-reload). To update, create a new campaign.

**Rationale**: The OpenRPC param description mentions the merge rule, but the spec prose (which is the design SSOT) doesn't. This creates a single-source-of-truth risk.

### Patch 7: Add `status` field to `IdeaNodeV1`

**File**: `schemas/idea_node_v1.schema.json`

**Change**: Add a lifecycle status field:
```json
"status": {
  "enum": ["draft", "evaluated", "promoted", "rejected", "archived"],
  "default": "draft",
  "description": "Lifecycle status of this node. Transitions: draft→evaluated (after eval.run), evaluated→promoted (after node.promote), any→rejected/archived (manual or policy)."
}
```
**Rationale**: Currently there's no way to distinguish a freshly generated node from one that has been evaluated, promoted, or rejected without checking for the existence of `eval_info`, `grounding_audit`, etc. A status field enables efficient filtering (e.g., `node.list` with `filter.status = "evaluated"`) and clearer lifecycle management.

### Patch 8: Tighten `IdeaListFilterV1` with `status` filter

**File**: `schemas/idea_list_filter_v1.schema.json`

**Change**: Add (contingent on Patch 7):
```json
"status": {
  "enum": ["draft", "evaluated", "promoted", "rejected", "archived"]
}
```
**Rationale**: Natural complement to Patch 7; enables listing only promotable/evaluated nodes.

### Patch 9: Add minimum `n_steps_executed` documentation

**File**: `schemas/search_step_result_v1.schema.json`

**Change**: Add to `n_steps_executed` description:
```json
"n_steps_executed": {
  "type": "integer",
  "minimum": 0,
  "description": "Actual steps executed. May be less than n_steps_requested if budget was exhausted or early_stopped was triggered. Zero indicates the campaign was already in a terminal state."
}
```
**Rationale**: Clarifies the semantics of `n_steps_executed = 0` (valid case: campaign already EXHAUSTED).

---

**Overall assessment**: This is a well-architected, evidence-first design with machine-enforceable contracts. The schema work is thorough, the `$ref`-only SSOT rule is correctly implemented, all previously identified blockers have been addressed, and the recent portability/observability patches (nullable `oneOf`, `node_not_found` on `eval.run`, `updated_at`, `team_policy_id`, `n_steps` default) are coherent. The suggested patches are quality-of-life improvements that strengthen the contract without structural changes. Ready for implementation.
