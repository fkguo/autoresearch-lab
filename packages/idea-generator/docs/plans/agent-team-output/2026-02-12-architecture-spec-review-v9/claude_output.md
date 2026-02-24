VERDICT: NOT_READY

## Blockers

### B1. `campaign_id` format inconsistency — no UUID constraint at source

`campaign.init` creates the `campaign_id` (it's in the result, not the params), but `CampaignInitResultV1` declares `campaign_id` as `{"type": "string", "minLength": 1}` while every other schema that references node IDs uses `"format": "uuid"`. If `campaign_id` is not a UUID, that's fine — but then `IdeaNodeV1.campaign_id` is also `minLength: 1` without format constraint, while `node_id` and `idea_id` are UUID. **This is internally consistent but dangerously loose**: there is no regex/format constraint anywhere that prevents `campaign_id = ""` after trimming, or prevents collisions with the idempotency store namespace. Either promote `campaign_id` to `format: uuid` everywhere, or add a `pattern` constraint (e.g., `^[a-zA-Z0-9_-]{8,}$`).

### B2. `node.list` pagination contract is ambiguous on empty-result semantics

`NodeListResultV1` requires `cursor` (non-null string or null), but the schema says `"type": ["string", "null"]"`. When `total_count` is 0 and `nodes` is `[]`, what is `cursor`? The spec says "null if no more results", but `total_count` itself is **not required** (`required: ["campaign_id", "nodes", "cursor"]`). An implementation can omit `total_count`, making it impossible for callers to distinguish "first page of zero results" from "last page reached." **Fix**: either make `total_count` required, or document that `cursor === null && nodes.length === 0` is the canonical empty signal.

### B3. `idempotency_key` is missing from `eval.run` error-replay guarantee in the spec prose

Section 2.3 lists `eval.run` as a side-effecting call requiring `idempotency_key` (correct, it's in the OpenRPC params), but the prose only discusses replay rules for campaign.init/topup/search.step/node.promote in the "Idempotency replay rules" block. `eval.run` and `rank.compute` are not explicitly covered by the replay/retention rules. This is a contract gap: an implementer might skip idempotency dedup for eval.run. **Fix**: the "Idempotency replay rules" subsection must explicitly enumerate all 6 side-effecting methods.

### B4. `BudgetTopUpV1` allows all-zero top-up (semantic no-op but burns an idempotency key)

`minProperties: 1` + `minimum: 0` on every field means `{"add_tokens": 0}` is valid. This is a no-op that still consumes an idempotency slot. Either change all minimums to `1` (exclusiveMinimum: 0), or document that zero-delta top-ups are explicitly allowed and engines must treat them as no-ops without error.

### B5. `PromotionResultV1` schema has no conditional enforcement of failure blocking

The spec prose (§4.2.1 bullet 5) says `node.promote` MUST fail with `grounding_audit_failed` if status is `partial` or `fail`. But `PromotionResultV1` as a **success result** schema still includes `grounding_audit_summary.status: ["pass", "fail", "partial"]`. A successful promotion response should never carry `status: fail` or `partial` — this contradicts the hard constraint. **Fix**: restrict the success-path `grounding_audit_summary.status` to `{"const": "pass"}`, or split the schema into success/failure result types.

### B6. `rank.compute` with `method: "elo"` has no matchup/pairing specification

Elo requires pairwise comparisons. The RPC takes `filter` + `campaign_id` but provides zero guidance on how matchups are constructed, how many rounds are run, or whether this is deterministic. Without at least a `max_matchups` or `rounds` parameter, the budget cost is unbounded and untestable. **Fix**: add `elo_config` (optional, with defaults) containing at minimum `{max_rounds, seed}`.

---

## Non-blocking

### N1. `IdeaCard.claims` conditional `evidence_uris.minItems: 1` for hard-evidence types uses `allOf[1].then` but this is nested inside `items` — verify toolchain compatibility

The `if/then` inside `claims.items` is valid JSON Schema 2020-12, but several common validators (notably AJV with default options, Python jsonschema < 4.18) may not evaluate `allOf` inside `items` correctly. Recommend adding a CI validation test that exercises both passing and failing claim objects with each support_type.

### N2. `SearchStepResultV1.new_nodes_artifact_ref` conditional requirement

The `allOf[1]` conditional says: if `new_node_ids` has `minItems: 1`, then `new_nodes_artifact_ref` is required. The `if` clause checks `"type": "array", "minItems": 1` — this will match the *type* of `new_node_ids` (always an array) plus the `minItems` constraint. This is correct but fragile; a cleaner expression is `"if": {"properties": {"new_node_ids": {"minItems": 1}}}` (without re-declaring `"type": "array"`, which is redundant since the base schema already constrains it).

### N3. `IdeaNodeV1` mutability contract is in `description` only — not machine-enforceable

The distinction between immutable and mutable fields is documented in the description string but has no schema-level enforcement (e.g., no `readOnly: true` annotation). For v0.2, this is acceptable documentation-level; for v0.3, consider adding `readOnly` per JSON Schema 2020-12 or a custom `x-immutable` extension with CI linting.

### N4. `operator_trace.inputs` and `operator_trace.params` are `type: object` with no further constraint

This is maximally flexible but means validation can never catch malformed traces. Consider adding a `minProperties: 1` or at minimum documenting expected key shapes per operator family (even if via `x-examples`).

### N5. `EvaluatorConfigV1.weights` keys are unconstrained

`weights` uses `additionalProperties: { type: number }`, but there's no validation that the keys match `dimensions`. An evaluator could receive `weights: {"bogus": 1.0}` and silently ignore it. Consider adding a spec-level note: "Engine SHOULD warn if weight keys do not match `dimensions`."

### N6. `BudgetEnvelopeV1` lacks `max_eval_rounds` despite `degradation_order` including `reduce_eval_rounds`

The degradation strategy mentions reducing eval rounds, but there's no `max_eval_rounds` field in the budget envelope to degrade *from*. Either add it to `BudgetEnvelopeV1` or clarify that `reduce_eval_rounds` acts on `EvaluatorConfigV1.n_reviewers` or an extension field.

### N7. Island state `best_score` semantics are undefined

`IslandStateV1.best_score` is `["number", "null"]` but there's no indication whether higher is better, what scale it uses, or whether it's a single-objective proxy or a Pareto-rank. This matters for the stagnation trigger (`best_score_improvement(last_n_steps) < ε`).

### N8. Missing `campaign_id` in `FormalismRegistryV1`

The formalism registry is campaign-scoped (merged at `campaign.init`), but the schema has no `campaign_id` or provenance field. This makes it difficult to audit which registry was active for a given campaign after the fact. Consider adding `campaign_id` and `merged_at` to the resolved (post-merge) registry artifact.

### N9. `seed_type` in `SeedPackV1` is free-text

No enum constraint on `seed_type`. The spec mentions "C1 gaps, PDG tensions, KB priors, user seeds" but these aren't enforced. Consider at least a recommended enum with `additionalProperties` fallback.

### N10. No schema for `idea_handoff_c2_v1.json`

§8.2 says this is "the only allowed entry to C2" and "missing fields → reject," but no schema file is provided. This is the most critical downstream contract and must have a schema for the "缺字段 → 直接拒绝" constraint to be machine-enforceable.

---

## Real-research fit

### R1. The Explain-Then-Formalize pipeline maps well to actual theoretical physics workflows

Physicists do naturally work in two stages: (1) vague intuition/mechanism sketch → (2) Lagrangian/observable/prediction. The `RationaleDraft → IdeaCard` pipeline with `kill_criteria` is a sound formalization of this. The `analogy_mapping` table in `RationaleDraft` is particularly valuable for HEP-th work where dualities (AdS/CFT, electric-magnetic, etc.) are bread-and-butter.

### R2. The grounding audit gate is the single most important safety feature for real HEP use

In practice, LLMs generating HEP ideas will confidently cite non-existent papers or misattribute results. The active URI resolution + data consistency check (§4.2.1) directly addresses this. However, **the active resolution must include semantic verification** (does the cited paper actually support the claim?), not just "does the DOI resolve?" The current spec says "active lookup" but doesn't mandate semantic relevance checking. This is the difference between a useful system and a dangerous one.

### R3. Multi-island evolution is appropriate for HEP's multi-paradigm landscape

Different approaches to the same anomaly (e.g., $(g-2)_\mu$ via SUSY vs. leptoquarks vs. dark photons vs. extended Higgs sectors) naturally map to islands. The repopulation mechanism allows cross-pollination without premature convergence. The stagnation detection prevents wasting budget on exhausted directions.

### R4. The `minimal_compute_plan` with difficulty/infrastructure tiers is realistic

The `estimated_difficulty` enum (`straightforward` to `research_frontier`) and `required_infrastructure` enum accurately capture the HEP compute landscape. The `estimated_compute_hours_log10` is a pragmatic order-of-magnitude field. Adding `blockers[]` is good — many HEP calculations depend on unknown form factors, unsolved integrals, or unavailable experimental data.

### R5. The `candidate_formalisms` registry-validation is critical for C2 handoff

In HEP, the gap between "interesting idea" and "executable calculation" often lies in whether a formalism exists and has tooling. Requiring formalisms to be registry-validated ensures that promoted ideas are actually computable, not aspirational.

### R6. Missing: experimental constraint propagation

Real HEP idea generation must account for existing experimental constraints (LHC exclusion limits, precision electroweak data, cosmological bounds). The current schema has `constraints` as free-text strings in `CampaignCharterV1`. There's no structured way to express "this idea must be consistent with $m_H = 125.25 \pm 0.17$ GeV" or "this model is excluded below $m_{\tilde{g}} > 2.3$ TeV by ATLAS-SUSY-2019-08." Consider a `constraint_pack` with structured numerical bounds + reference URIs.

---

## Robustness & safety

### S1. Hallucination mitigation: the grounding audit is necessary but not sufficient

The current spec checks URI resolvability and data consistency, but the most dangerous hallucination mode is **semantic misattribution**: "Paper X shows Y" when paper X actually shows Z. The spec should mandate that the grounding audit includes a **claim-reference alignment check** (at minimum: compare the claim_text against the abstract/conclusion of the cited paper). This can be done via embedding similarity with a threshold, or via a dedicated LLM-as-judge step with the actual paper text.

### S2. Idempotency store is a single point of failure for retry safety

The spec requires idempotency records to persist for campaign lifetime. If the store is lost (crash, corruption), all in-flight retries become unsafe (could create duplicate nodes). The spec should require that the idempotency store is co-located with the append-only ledger (same durability guarantees), or that `node_id` generation is deterministic from `(campaign_id, idempotency_key, method)` so that duplicates are naturally prevented even without the store.

### S3. `eval.run` has no timeout/cancellation mechanism

If multi-agent evaluation gets stuck (LLM API timeout, infinite debate loop), there's no way to cancel the evaluation. The spec should add either a `max_wall_clock_s` parameter to `eval.run` or mandate that the step-level budget fuse applies to evaluation calls as well.

### S4. The `folklore_risk_score` threshold is not specified anywhere in the schemas

§4.2.1 says "超过阈值则必须走 A0-folklore 人类裁定" but the threshold value is not a configurable parameter in any schema. It should be in `EvaluatorConfigV1` or `CampaignCharterV1`.

### S5. No rate limiting or backpressure signal in the RPC contract

If the adapter fires `search.step` in a tight loop (e.g., automated orchestrator), there's no mechanism for the engine to signal "slow down." Consider adding a `retry_after_s` field to error responses, or a `backpressure` signal in `SearchStepResult`.

### S6. `operator_trace.random_seed` is optional — reproducibility gap

If `random_seed` is not provided, the operator execution is not reproducible. For evidence-first safety, this should be required (engine auto-generates if caller omits) and recorded.

### S7. No schema versioning mechanism in the artifacts themselves

Artifacts reference `v1` in filenames but the JSON objects themselves carry no `$schema` or `version` field. When v2 schemas inevitably arrive, consumers will have no way to distinguish artifact versions without filename parsing. Add a `schema_version` field to key artifacts (at minimum: `IdeaNodeV1`, `IdeaCardV1`, `CampaignCharterV1`).

---

## Specific patch suggestions

### P1. `schemas/promotion_result_v1.schema.json` — restrict success-path grounding status

```json
// File: schemas/promotion_result_v1.schema.json
// Change: grounding_audit_summary.status
// FROM:
"status": { "enum": ["pass", "fail", "partial"] }
// TO:
"status": { "const": "pass" }
```

This enforces the §4.2.1 hard constraint at the schema level. Failures should be communicated via the error response, not a success result with `fail` status.

### P2. `schemas/budget_topup_v1.schema.json` — prevent no-op top-ups

```json
// File: schemas/budget_topup_v1.schema.json
// Change: all field minimums from 0 to exclusiveMinimum: 0
// AND add a custom validation note
// FROM:
"add_tokens": { "type": "integer", "minimum": 0 }
// TO:
"add_tokens": { "type": "integer", "exclusiveMinimum": 0 }
// (apply to all 5 fields)
```

Alternatively, if zero-valued fields should be allowed as "present but not increased," add a schema-level annotation:
```json
"description": "...At least one field must have a value > 0."
```
and enforce via a custom validator or `anyOf` with per-field `exclusiveMinimum` branches.

### P3. `schemas/node_list_result_v1.schema.json` — make `total_count` required

```json
// File: schemas/node_list_result_v1.schema.json
// Change: add total_count to required array
// FROM:
"required": ["campaign_id", "nodes", "cursor"]
// TO:
"required": ["campaign_id", "nodes", "cursor", "total_count"]
```

### P4. `schemas/idea_card_v1.schema.json` — fix conditional `evidence_uris` enforcement

```json
// File: schemas/idea_card_v1.schema.json
// In claims.items.allOf[1] (the hard-evidence minItems conditional):
// FROM:
{
  "if": {
    "properties": { "support_type": { "enum": ["literature", "data", "calculation", "expert_consensus"] } },
    "required": ["support_type"]
  },
  "then": { "properties": { "evidence_uris": { "minItems": 1 } } }
}
// TO (make it a true requirement, not just a property constraint):
{
  "if": {
    "properties": { "support_type": { "enum": ["literature", "data", "calculation", "expert_consensus"] } },
    "required": ["support_type"]
  },
  "then": {
    "properties": { "evidence_uris": { "type": "array", "minItems": 1, "items": { "type": "string", "format": "uri" } } },
    "required": ["evidence_uris"]
  }
}
```

Note: `evidence_uris` is already required at the base level, so the key change is ensuring `minItems: 1` actually triggers validation failure. The current form sets `minItems` as a property refinement inside `then.properties`, which in 2020-12 is correct — but adding the explicit `required` makes it belt-and-suspenders safe across validators.

### P5. `schemas/idea_core_rpc_v1.openrpc.json` — add `elo_config` to `rank.compute`

```json
// File: schemas/idea_core_rpc_v1.openrpc.json
// In method "rank.compute", add param after "method":
{
  "name": "elo_config",
  "schema": {
    "type": "object",
    "properties": {
      "max_rounds": { "type": "integer", "minimum": 1, "default": 50 },
      "seed": { "type": "integer" },
      "k_factor": { "type": "number", "minimum": 0, "default": 32 }
    },
    "additionalProperties": false
  },
  "required": false,
  "description": "Configuration for Elo ranking. Required when method='elo'. Ignored otherwise."
}
```

And add to the method's `errors`:
```json
{ "code": -32002, "message": "schema_validation_failed", "data": "elo_config required when method=elo" }
```

### P6. `schemas/evaluator_config_v1.schema.json` — add `folklore_risk_threshold`

```json
// File: schemas/evaluator_config_v1.schema.json
// Add property:
"folklore_risk_threshold": {
  "type": "number",
  "minimum": 0,
  "maximum": 1,
  "default": 0.7,
  "description": "Folklore risk score above this threshold triggers A0-folklore human adjudication."
}
```

### P7. `schemas/idea_node_v1.schema.json` — make `random_seed` required in `operator_trace`

```json
// File: schemas/idea_node_v1.schema.json
// In operator_trace:
// FROM:
"required": ["inputs", "params", "evidence_uris_used"]
// TO:
"required": ["inputs", "params", "random_seed", "evidence_uris_used"]
```

### P8. `docs/plans/2026-02-12-idea-generator-architecture-spec.md` — enumerate all idempotent methods in replay rules

```markdown
// File: docs/plans/2026-02-12-idea-generator-architecture-spec.md
// Section 2.3, "Idempotency replay 规则" block
// ADD after "保留期限" bullet:

- **Covered methods (exhaustive list)**：`campaign.init`、`campaign.topup`、`search.step`、`eval.run`、`rank.compute`、`node.promote`。任何未来新增的 side-effecting method 必须在 OpenRPC 中标注 `idempotency_key` 为 required，并加入此列表。
```

### P9. New file: `schemas/idea_handoff_c2_v1.schema.json` (stub)

```json
// File: schemas/idea_handoff_c2_v1.schema.json (NEW)
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "idea_handoff_c2_v1.schema.json",
  "title": "IdeaHandoffC2 v1",
  "description": "The sole entry artifact into C2 (Method Design). Generated by node.promote. Missing required fields → C2 MUST reject.",
  "type": "object",
  "required": [
    "campaign_id",
    "idea_id",
    "node_id",
    "idea_card",
    "grounding_audit",
    "promotion_timestamp",
    "formalism_registry_snapshot"
  ],
  "properties": {
    "campaign_id": { "type": "string", "minLength": 1 },
    "idea_id": { "type": "string", "format": "uuid" },
    "node_id": { "type": "string", "format": "uuid" },
    "idea_card": { "$ref": "idea_card_v1.schema.json" },
    "grounding_audit": {
      "type": "object",
      "required": ["status", "folklore_risk_score", "failures", "timestamp"],
      "properties": {
        "status": { "const": "pass" },
        "folklore_risk_score": { "type": "number", "minimum": 0, "maximum": 1 },
        "failures": { "type": "array", "maxItems": 0 },
        "timestamp": { "type": "string", "format": "date-time" }
      },
      "additionalProperties": false
    },
    "promotion_timestamp": { "type": "string", "format": "date-time" },
    "formalism_registry_snapshot": { "$ref": "formalism_registry_v1.schema.json" },
    "eval_summary": {
      "type": "object",
      "description": "Optional summary of evaluation scores at promotion time.",
      "additionalProperties": true
    },
    "schema_version": { "const": "1.0.0" }
  },
  "additionalProperties": false
}
```

### P10. `schemas/idea_core_rpc_v1.openrpc.json` — add `$ref` for handoff schema and wire it into `PromotionResultV1`

```json
// File: schemas/idea_core_rpc_v1.openrpc.json
// In components.schemas, add:
"IdeaHandoffC2V1": { "allOf": [{ "$ref": "idea_handoff_c2_v1.schema.json" }] }
```

And in `promotion_result_v1.schema.json`, change `handoff_artifact_ref` description to note it points to an artifact validated against `idea_handoff_c2_v1.schema.json`.

### P11. `docs/plans/2026-02-12-idea-generator-architecture-spec.md` — add semantic claim-reference alignment to grounding audit

```markdown
// File: docs/plans/2026-02-12-idea-generator-architecture-spec.md
// Section 4.2.1, after bullet 1 (URI 可解析), ADD new bullet:

1b. **Claim-reference semantic alignment（active verification）**：对 `support_type ∈ {literature, data, calculation, expert_consensus}` 的 claim，grounding audit 必须验证 `claim_text` 与 `evidence_uris[]` 所引文献的实际内容存在语义支撑关系（而非仅 URI 可解析）。最小实现：用引用文献的 abstract/conclusion 与 claim_text 做嵌入相似度检查（阈值可配置，建议写入 `EvaluatorConfig.extensions.min_claim_ref_similarity`）；推荐实现：用 LLM-as-judge 对 (claim, paper_excerpt) 做二分类（supports / does_not_support / insufficient_information）。不通过的 claim 必须写入 `grounding_audit.failures[]`。
```
