VERDICT: READY

## Blockers

No remaining hard blockers. The previous round's critical issues have been addressed:

1. **`node_id` vs `idea_id` ambiguity — RESOLVED.** §5.2 now gives crisp definitions: `node_id` = versioned graph node, `idea_id` = lineage/family. The schemas consistently use `node_id` as the primary key for `node.get`, `node.promote`, and graph edges (`parent_node_ids`), while `idea_id` appears as a grouping/filter field. This is correct.

2. **Pagination — RESOLVED.** `node.list` now has `cursor` (string, nullable) and `limit` params; `NodeListResultV1` returns `cursor: string|null` and `total_count`. Opaque cursor pattern is appropriate for append-only stores.

3. **`eval.run` campaign scoping — RESOLVED.** `eval.run` now requires `campaign_id` (required param) alongside `node_ids`, and returns `campaign_id` in `EvalResultV1`. This prevents cross-campaign node evaluation.

4. **`insufficient_eval_data` error — RESOLVED.** Error code `-32013` is declared on `rank.compute`, which is the correct location (ranking requires prior eval data).

5. **Schema SSOT — RESOLVED.** §2.3 states the hard constraint: `schemas/*.schema.json` is the single source; the OpenRPC uses only `$ref` to sibling files. The bundling discipline note is present.

## Non-blocking

### NB-1: `search.step` missing `campaign_id` echo in `node.get` / `node.promote`

`node.get` and `node.promote` take only `node_id` — they don't require or return `campaign_id` at the RPC param level. This is fine for `node.get` (the returned `IdeaNodeV1` contains `campaign_id`), but `node.promote` should consider accepting an optional `campaign_id` param for defense-in-depth (verify the node belongs to the expected campaign before promotion). Low severity since `IdeaNodeV1.campaign_id` is required and can be checked server-side.

### NB-2: `rank.compute` should support `node_ids` subset

Currently `rank.compute` ranks an entire campaign. For iterative workflows (rank just the new nodes from the last step against the existing top-k), a `node_ids` filter param would be valuable. Not blocking since full-campaign ranking is the MVP behavior.

### NB-3: `budget_snapshot_v1` — `wall_clock_s_remaining` type inconsistency pattern

`wall_clock_s_remaining` uses `"type": ["number", "null"]` while `steps_remaining` uses `"type": ["integer", "null"]`. This is correct JSON Schema 2020-12 (`type` as array), but some validators may not handle it identically to `oneOf: [{type: number}, {type: null}]`. The `idea_node_v1.schema.json` uses `oneOf` for nullable fields. **Recommendation: pick one pattern and use it consistently** (prefer `oneOf` for Draft 2020-12 purity, or `type-array` for brevity — but not both in the same schema set).

### NB-4: `eval_result_v1` is thin — no per-node score summary

`EvalResultV1` returns only `scorecards_artifact_ref` (a URI to the full artifact). For orchestrator-level decisions (e.g., "should I run another search step or promote?"), it would help to include a `summary` array with per-node aggregate scores inline, avoiding a mandatory artifact dereference for simple branching logic. Not blocking since the artifact ref pattern is consistent with the overall design.

### NB-5: `IdeaCard.claims[].allOf` conditional — `evidence_uris.minItems: 1` not enforced for `calculation`

The second `if/then` block applies `minItems: 1` to evidence_uris for `support_type ∈ {literature, data, calculation, expert_consensus}`. For `calculation`, the evidence may be a computation artifact that doesn't yet exist at IdeaCard creation time. Consider whether `calculation` should be in this group or have its own conditional (e.g., allow empty URIs but require `verification_plan`). Minor schema refinement.

### NB-6: Missing `search_policy_id` / `team_policy_id` validation

`CampaignCharterV1` declares `search_policy_id` and `team_policy_id` as optional strings. There's no mechanism in the OpenRPC to validate these IDs against a registry of known policies (analogous to `formalism_registry` for formalisms). For v0.2, documenting the known policy IDs in the spec is sufficient; for v0.3, consider a `policy_registry` schema.

### NB-7: `IdeaNodeV1.operator_trace.inputs` and `.params` are `type: object` with no constraints

These are opaque bags. For auditability, consider at minimum requiring a `description` or `schema_ref` field so a human reviewer can understand what the operator consumed. Not blocking for v0.2 since operator families aren't yet standardized.

### NB-8: `formalism_registry_v1` — no versioning/timestamp

The registry has no `version` or `updated_at` field. When DomainPacks evolve (add/deprecate formalisms), there's no way to detect or audit registry changes. Add `"version": {"type": "string"}` and `"updated_at": {"type": "string", "format": "date-time"}` at the top level.

### NB-9: `degradation_order` enum is closed

`BudgetEnvelopeV1.degradation_order` uses a fixed `enum`. DomainPacks may want custom degradation strategies. Consider making this `oneOf: [{enum: [...]}, {type: "string", pattern: "^x_"}]` to allow extension-prefixed custom strategies.

### NB-10: No explicit `campaign.cancel` / `campaign.pause` method

The spec mentions hepar handles run lifecycle (pause/resume), but `idea-core` has no `campaign.cancel` or `campaign.pause` RPC method. If the core engine owns the search loop (which `search.step` implies), it needs a way to receive a cancellation signal beyond just budget exhaustion. For v0.2, the adapter can simply stop calling `search.step`, but explicit lifecycle methods would be cleaner.

## Real-research fit

**Strong points for HEP research workflows:**

1. **Evidence-first provenance is well-designed.** The claim-level `support_type` + `evidence_uris` + conditional `verification_plan` in `IdeaCard` is exactly what's needed for HEP-ph where claims span from well-measured PDG values to speculative BSM mechanisms. The grounding audit gate with active URI resolution is a genuine anti-hallucination measure, not theater.

2. **Formalism registry → C2 handoff is the right chokepoint.** In HEP theory work, the gap between "interesting idea" and "executable calculation" is precisely whether you can map the idea to a concrete formalism (EFT, specific model Lagrangian, lattice setup, etc.). Making `candidate_formalisms[]` validate against a DomainPack registry prevents "sounds good but can't be computed" ideas from consuming downstream resources.

3. **Multi-island with stagnation detection reflects real research dynamics.** Research groups naturally explore multiple approaches in parallel and need to detect when a direction is exhausted. The `STAGNANT → REPOPULATED` transition with donor islands mirrors how cross-pollination works in practice (e.g., applying lattice QCD insights to perturbative calculations).

4. **The Explain-Then-Formalize pipeline prevents premature formalization.** In my experience, the biggest risk in AI-assisted ideation for theory physics is jumping straight to formal-looking but empty structures. Requiring `RationaleDraft` (with `kill_criteria`) before `IdeaCard` forces the system to articulate *why* before *what*.

5. **Operator families map well to actual theory practice.** `SymmetryOperator`, `LimitExplorer`, and `RepresentationShift` are genuinely how theoretical physicists generate new ideas. `AnomalyAbduction` mapping to Peirce/Kuhn is the right philosophical framing for anomaly-driven BSM physics.

**Potential gaps for real usage:**

6. **No explicit "known result" / "textbook check" operator.** Before exploring novel directions, researchers often need to verify the system can reproduce known results as a sanity check. Consider adding a `ReproductionCheck` operator family that validates against known analytical/numerical results before branching into novelty.

7. **The `minimal_compute_plan` is disconnected from actual tool availability.** `tool_hint` is a free-form string. For real HEP workflows, the plan should reference specific tool chains (FeynCalc, MadGraph, CheckMATE, HiggsBounds, etc.) that can be validated against the `hep-calc` skill's capabilities. This is a v0.3 item.

8. **Phenotype profiling metrics are well-chosen** (`A0_pass@k`, `epochs_to_first_grounded_claim`, `tokens_per_promoted_node`, `checker_disagreement_rate`). These are genuinely useful for understanding which LLM configurations produce ideas that survive scrutiny vs. those that produce plausible-sounding but ungrounded proposals.

## Robustness & safety

1. **Hallucination mitigation: strong.** The three-layer defense (claim-level provenance → grounding audit with active URI resolution → folklore risk scoring) is well-designed. The requirement that `llm_inference`/`assumption` claims must have `verification_plan` is critical. The `allOf` conditional in `idea_card_v1.schema.json` correctly enforces this at the schema level.

2. **Budget safety: strong.** Circuit breaker with three independent triggers (tokens, cost, wall-clock), plus ordered degradation, plus `EarlyStop` state. The `budget_snapshot` being required in every result object (`SearchStepResultV1`, `EvalResultV1`, `CampaignStatusV1`) means the adapter can independently verify budget state.

3. **Schema enforceability: good with one concern.** The `oneOf: [null, object]` pattern for nullable fields (`eval_info`, `grounding_audit`, `idea_card`) is correct JSON Schema 2020-12. However, some JSON Schema validators handle `oneOf` with `null` differently from `type: ["object", "null"]`. **Recommendation: add a CI test that validates sample documents against all schemas using at least two independent validators** (e.g., `ajv` + `jsonschema` Python library).

4. **Idempotency: partially addressed.** `campaign.init` and `search.step` accept `idempotency_key` — good. But `eval.run` and `node.promote` don't. For `node.promote` especially (which produces a handoff artifact), idempotency is important to prevent duplicate C2 handoffs.

5. **Clean-room evaluation: well-specified.** The debate trigger threshold + structured `point/counterpoint + evidence_uris` output format prevents uncontrolled information leakage between evaluators.

6. **Append-only auditability: implied but not schema-enforced.** The spec mentions append-only ledger, but there's no `event_id` or `sequence_number` in the artifact schemas. For true auditability, consider adding a `ledger_event_ref` field to result schemas that links to the append-only log entry.

7. **Race condition risk in multi-island migration.** When `migrate()` copies nodes between islands, concurrent `search.step` calls could read stale population state. The spec doesn't address concurrency. For v0.2 with single-process stdio, this is fine; flag it for v0.3 when HTTP/WebSocket transport may enable concurrent callers.

## Specific patch suggestions

### Patch 1: Add idempotency to `eval.run` and `node.promote`

**File:** `schemas/idea_core_rpc_v1.openrpc.json`

In the `eval.run` method's `params` array, add:
```json
{ "name": "idempotency_key", "schema": { "type": "string", "minLength": 1 } }
```

In the `node.promote` method's `params` array, add:
```json
{ "name": "idempotency_key", "schema": { "type": "string", "minLength": 1 } }
```

### Patch 2: Add version/timestamp to formalism registry

**File:** `schemas/formalism_registry_v1.schema.json`

Add to `properties` (and add `"version"` to `required`):
```json
"version": { "type": "string", "minLength": 1 },
"updated_at": { "type": "string", "format": "date-time" },
"domain": { "type": "string", "minLength": 1, "description": "Domain this registry serves (e.g., hep-ph)." }
```

### Patch 3: Normalize nullable field pattern — use `oneOf` consistently

**File:** `schemas/budget_snapshot_v1.schema.json`

Change:
```json
"wall_clock_s_remaining": { "type": ["number", "null"], "minimum": 0, ... }
```
To:
```json
"wall_clock_s_remaining": {
  "oneOf": [{ "type": "number", "minimum": 0 }, { "type": "null" }],
  "description": "null if max_wall_clock_s was not set in the BudgetEnvelope."
}
```

Same for `steps_remaining`:
```json
"steps_remaining": {
  "oneOf": [{ "type": "integer", "minimum": 0 }, { "type": "null" }],
  "description": "null if max_steps was not set in the BudgetEnvelope."
}
```

This aligns with the `oneOf` pattern already used in `idea_node_v1.schema.json`.

### Patch 4: Add `node_not_found` error to `eval.run`

**File:** `schemas/idea_core_rpc_v1.openrpc.json`

In the `eval.run` method's `errors` array, add:
```json
{ "code": -32004, "message": "node_not_found" }
```

Rationale: `eval.run` takes `node_ids[]`; any invalid node_id should produce this error rather than silently skipping or returning a confusing `schema_validation_failed`.

### Patch 5: Add inline score summary to `EvalResultV1`

**File:** `schemas/eval_result_v1.schema.json`

Add to `properties`:
```json
"score_summary": {
  "type": "array",
  "description": "Optional per-node aggregate scores for quick orchestrator decisions without dereferencing the full scorecards artifact.",
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

### Patch 6: Add `campaign_id` validation param to `node.promote`

**File:** `schemas/idea_core_rpc_v1.openrpc.json`

In the `node.promote` method's `params` array, add:
```json
{ "name": "campaign_id", "schema": { "type": "string", "minLength": 1 }, "description": "Optional campaign_id for cross-check (defense-in-depth)." }
```

### Patch 7: Add `campaign_id` to `PromotionResultV1`

**File:** `schemas/promotion_result_v1.schema.json`

Add `"campaign_id"` to the `required` array and add to `properties`:
```json
"campaign_id": { "type": "string", "minLength": 1 }
```

This ensures the promotion result is self-describing and traceable back to its campaign, consistent with how `EvalResultV1`, `RankingResultV1`, and `SearchStepResultV1` all echo `campaign_id`.

### Patch 8: Spec doc — clarify operator trace extensibility

**File:** `docs/plans/2026-02-12-idea-generator-architecture-spec.md`

In §5.2, after the `operator_trace` bullet, add:

> **Extensibility note:** `operator_trace.inputs` and `operator_trace.params` are intentionally opaque (`type: object`) in v0.2. Each `Operator` family SHOULD publish a sub-schema for its trace (e.g., `symmetry_operator_trace_v1.schema.json`) and reference it via `operator_trace.params.$schema`. This enables per-operator auditability without coupling the core schema to specific operators.

### Patch 9: Spec doc — add `ReproductionCheck` to operator families

**File:** `docs/plans/2026-02-12-idea-generator-architecture-spec.md`

In §3.1 under "Operator families (v0.2 建议)", add:

> - `ReproductionCheck`：已知结果复现（sanity check）——在探索新方向前，先验证系统能对已知 benchmark/textbook result 给出一致结论（输出 `consistency_report`）。

### Patch 10: Add `node.get` `campaign_not_found` consideration

**File:** `schemas/idea_core_rpc_v1.openrpc.json`

`node.get` currently only has `node_not_found`. Since nodes are globally unique (UUID), this is technically sufficient. However, for consistency and to support future multi-tenant scenarios, consider adding an optional `campaign_id` param (not required) to `node.get` as well, mirroring the defense-in-depth pattern.

---

**Summary:** The bundle is architecturally sound, internally consistent, and addresses all previously identified blockers. The schemas are machine-enforceable with minor normalization needed (nullable field pattern consistency). The evidence-first safety design (claim provenance → grounding audit → formalism registry gate) is well-layered. The patches above are high-leverage, minimal-diff improvements focused on consistency, defense-in-depth, and auditability rather than architectural changes.
