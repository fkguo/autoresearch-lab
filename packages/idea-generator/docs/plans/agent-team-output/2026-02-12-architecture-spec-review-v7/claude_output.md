VERDICT: NOT_READY

## Blockers

### B1. `idempotency_key` is not `required` on any side-effecting RPC

In the OpenRPC spec, `campaign.init`, `search.step`, `eval.run`, `rank.compute`, and `node.promote` all declare `idempotency_key` as a parameter but **never mark it `required: true`**. The architecture spec §2.3 says "adapter **should** provide idempotency_key" and "engine **must** deduplicate by `(method, campaign_id, idempotency_key)`". But if the key is optional, the engine cannot enforce dedup discipline—it must silently accept calls without a key, which defeats the stated invariant. Either:

- Make `idempotency_key` **required** on all side-effecting methods, or
- Specify engine behavior when omitted (e.g., "treat as unique / never deduplicate" — but then the spec's "MUST deduplicate" language is contradicted).

This is a blocker because it makes the idempotency contract unenforceable at the schema level, and retry safety in a multi-agent system is a correctness-critical property.

### B2. `node.get` lacks `campaign_id` — campaign scoping invariant is broken

The spec §2.3 states: "凡是入参包含 `campaign_id` 的 RPC，engine 必须验证所有涉及的 `node_id` 都属于该 campaign." But `node.get` takes **only** `node_id` with no `campaign_id`. This means:

1. Cross-campaign node leakage is possible via `node.get`.
2. The campaign-scoping invariant has a hole — any caller who knows a `node_id` can read nodes from any campaign.

Either add `campaign_id` as a required param to `node.get` (with `node_not_in_campaign` error), or explicitly declare `node.get` as a campaign-agnostic read (and document why that's safe). Currently, the spec says one thing and the RPC does another.

### B3. `$ref` resolution strategy in OpenRPC is ambiguous and likely broken

The `components.schemas` block uses `$ref` like this:
```json
"CampaignCharterV1": { "$ref": "campaign_charter_v1.schema.json" }
```

This is a **bare relative file reference** inside a `components/schemas` entry. Then the method params reference `#/components/schemas/CampaignCharterV1`. This creates a two-hop indirection: `#/components/schemas/CampaignCharterV1` → `{ "$ref": "campaign_charter_v1.schema.json" }`. The semantics depend entirely on which JSON Schema / OpenRPC resolver is used. Many toolchains (e.g., `json-schema-ref-parser`, OpenRPC playground) will not resolve a `$ref` that is the **entire value** of a `components/schemas` entry correctly, because the entry itself becomes a reference object rather than a schema.

**Fix**: Use `$ref` directly in params:
```json
{ "name": "charter", "schema": { "$ref": "campaign_charter_v1.schema.json" } }
```
Or define proper `components/schemas` entries with `allOf: [{ "$ref": "..." }]` wrapping. This must be tested with at least one canonical validator (e.g., `@open-rpc/schema-utils-js`) before declaring the SSOT contract machine-enforceable.

### B4. `BudgetEnvelope` vs `BudgetSnapshot` consistency is one-directional

`BudgetEnvelope` has `max_nodes` and `max_steps`. `BudgetSnapshot` has `steps_used`/`steps_remaining` but **no** `nodes_used`/`nodes_remaining`. If `max_nodes` is set in the envelope, the snapshot provides no way to observe progress toward that limit. The circuit breaker cannot report node budget status to the adapter, violating the observability contract.

### B5. `rank.compute` has no campaign scoping for node membership validation

The spec says "凡是入参包含 `campaign_id` 的 RPC" must validate node membership, but `rank.compute` takes only `campaign_id` and `method` — it implicitly ranks all nodes in the campaign. That's fine semantically, but the RPC has no `node_ids` param to allow ranking a **subset**. More critically, there's no filter or scope param, so the caller cannot rank only nodes that passed grounding audit, or only nodes on a specific island. This forces the adapter to do multi-step `node.list` → filter → if needed, eval subset — which is both wasteful and pushes filtering logic outside the engine boundary. Consider adding an optional `filter` param (reuse `IdeaListFilterV1`) or at minimum an optional `node_ids` array.

---

## Non-blocking

### N1. `search.step` `n_steps` default value is spec-only, not schema-enforceable
The OpenRPC param declares `"default": 1` for `n_steps`, but JSON-RPC has no default-injection mechanism — the server must implement this. Document in the spec that the engine applies the default, or make it required.

### N2. `IdeaCard.claims` conditional validation is limited
The `allOf` conditional requiring `evidence_uris.minItems: 1` when `support_type` is `literature|data|calculation|expert_consensus` uses a `then` block that sets `properties.evidence_uris.minItems: 1` — but this **does not add `evidence_uris` to `required`**. Since `evidence_uris` is already in the outer `required`, this works, but only because the outer schema already requires the field. The intent is correct but fragile; a future refactor that makes `evidence_uris` optional would silently break the invariant. Add a comment or use `then: { required: ["evidence_uris"], properties: { evidence_uris: { minItems: 1 } } }` for belt-and-suspenders.

### N3. `IslandState` has no `operator_ids` or `operator_weights`
The architecture spec ties islands to operator/strategy configurations, but the `IslandState` schema only has `island_id`, `state`, and `population_size`. For observability of the bandit distributor, consider adding `active_operator_ids[]` and/or `operator_reward_ema{}`.

### N4. `EvalResult` is thin — no per-node summary
`EvalResult` returns `node_ids` + `scorecards_artifact_ref` but no inline per-node scores or aggregated pass/fail. The adapter must fetch and parse the artifact to know if any node failed. Adding an optional `per_node_summary` (array of `{node_id, overall_score, grounding_status}`) would make the common path cheaper.

### N5. Cursor semantics are improved but under-specified
`NodeListResult.cursor` is `string | null` (null = no more). Good. But the spec doesn't declare cursor **stability guarantees** — can nodes created *during* pagination appear or disappear? For an append-only store this is mostly fine, but if `eval_info` or `grounding_audit` updates between pages change filter match, results could be inconsistent. State: "cursors are snapshot-stable" or "cursors reflect live state" explicitly.

### N6. `campaign.init` `formalism_registry` param is optional but merge semantics are only in `description`
The merge-on-collision policy ("caller entries take precedence on formalism_id collision") is stated in a `description` string. This is not machine-enforceable. Consider either: (a) documenting it in the spec as a MUST, or (b) adding a `merge_strategy` enum param (`"override" | "reject_collision"`).

### N7. Missing `nodes_remaining` in `BudgetSnapshot` is also a non-blocking UX issue
(Promoted to blocker B4 for the consistency issue, but even if `max_nodes` is rarely used, its absence from the snapshot is a design gap.)

### N8. `RationaleDraft` has no `operator_id` or `origin` backreference
Once separated from its containing `IdeaNode`, a `RationaleDraft` artifact has no way to trace back to its generator. Consider adding optional `node_id` and `operator_id` fields for standalone artifact integrity.

### N9. `PromotionResult` does not include `promoted_at` timestamp
For audit trail completeness, the promotion event should be timestamped at the result level.

### N10. `evaluator_config_v1` `weights` keys are free-form strings
`weights` is `additionalProperties: { type: number }` but there's no validation that keys match the `dimensions` array. A weight for `"noveltyy"` (typo) would be silently accepted. Consider adding a spec-level invariant: "keys of `weights` MUST be a subset of `dimensions`" (enforceable via custom validation, not pure JSON Schema, but should be stated).

---

## Real-research fit

### Strengths

1. **The Explain-Then-Formalize pipeline is well-matched to actual HEP theory workflow.** In practice, theorists sketch intuition (rationale) before formalizing into Lagrangians/observables. The forced two-stage structure with kill criteria is a genuine anti-hallucination mechanism that mirrors real editorial discipline.

2. **Claim-level provenance with `support_type` taxonomy** is one of the strongest aspects. The distinction between `literature`, `data`, `calculation`, `llm_inference`, and `assumption` — with conditional `verification_plan` — maps directly onto how HEP papers structure their arguments. The `expert_consensus` type with review-level reference requirement is a smart addition.

3. **The formalism registry / C2 handoff gate** prevents the common failure mode of LLM-generated "ideas" that sound interesting but have no executable path. Requiring `candidate_formalisms[]` to map to DomainPack entries with validators/compilers is a meaningful real-world constraint.

4. **Multi-island evolution with explicit stagnation detection** corresponds to real research group dynamics where parallel approaches are explored and cross-pollinated. The `STAGNANT → REPOPULATED` transition with donor island migration is a reasonable operationalization.

### Concerns

5. **The `minimal_compute_plan` schema is ambitious but may be unreliable.** LLMs are poor at estimating `estimated_compute_hours_log10` for novel HEP calculations. The `estimate_confidence` field helps, but there's no mechanism to calibrate these estimates against historical data. Consider adding a `calibration_ref` field pointing to similar completed calculations.

6. **The novelty pipeline's `folklore_risk_score` is a single float.** In HEP, folklore status varies dramatically by sub-community (e.g., something well-known in lattice QCD may be unknown in BSM phenomenology). Consider making this a per-community score or at minimum requiring the community/subfield scope.

7. **The Grounding Audit's "active resolution" requirement** (§4.2.1, point 1) is excellent but operationally expensive for INSPIRE/DOI lookups at scale. The spec should clarify whether this is synchronous (blocking) or can be batched/async with a `pending` status.

---

## Robustness & safety

### Hallucination mitigation
- **Strong**: The claim-level provenance with forced `verification_plan` for LLM inferences is the right structure. The grounding audit gate with active URI resolution is a genuine defense.
- **Gap**: There's no mechanism to detect **fabricated URIs that resolve to real but irrelevant papers**. An LLM might generate `inspire-hep.net/literature/12345` which exists but doesn't actually support the claim. The grounding audit checks resolvability but not relevance. Consider adding a `relevance_check` step that verifies the cited paper's abstract/title has semantic overlap with the claim.

### Budget safety
- **Strong**: Circuit breaker with `degradation_order` is well-designed. The `BudgetSnapshot` in every response enables tight control loops.
- **Gap**: No **per-step cost cap**. A single `search.step` with `n_steps=100` could exhaust the budget before the adapter can react. Consider adding `max_cost_per_step` to `BudgetEnvelope` or documenting that the engine MUST check budget before each sub-step within a multi-step call.

### Data integrity
- **Strong**: Append-only IdeaStore, `operator_trace` with prompt hashes, campaign scoping.
- **Gap**: The `updated_at` field on `IdeaNode` implies mutation, which conflicts with the "append-only" claim in the spec. Clarify: is the store truly append-only (new versions create new node_ids) or does it allow in-place updates to `eval_info`/`grounding_audit`? If in-place, document which fields are mutable and add a `version` counter.

### Idempotency
- **Critical gap**: See Blocker B1. Without required idempotency keys, retry safety is unenforceable.

### Cross-campaign isolation
- **Critical gap**: See Blocker B2. `node.get` bypasses campaign scoping.

---

## Specific patch suggestions

### Patch 1: `schemas/idea_core_rpc_v1.openrpc.json` — Make `idempotency_key` required on side-effecting RPCs

For methods `campaign.init`, `search.step`, `eval.run`, `rank.compute`, `node.promote`:

```diff
-        { "name": "idempotency_key", "schema": { "type": "string", "minLength": 1 } }
+        { "name": "idempotency_key", "schema": { "type": "string", "minLength": 1 }, "required": true }
```

### Patch 2: `schemas/idea_core_rpc_v1.openrpc.json` — Add `campaign_id` to `node.get`

```diff
     {
       "name": "node.get",
       "summary": "Fetch a single IdeaNode by node_id.",
       "paramStructure": "by-name",
       "params": [
+        { "name": "campaign_id", "schema": { "type": "string", "minLength": 1 }, "required": true },
         { "name": "node_id", "schema": { "type": "string", "format": "uuid" }, "required": true }
       ],
       "result": { "name": "node", "schema": { "$ref": "#/components/schemas/IdeaNodeV1" } },
-      "errors": [{ "code": -32004, "message": "node_not_found" }]
+      "errors": [
+        { "code": -32003, "message": "campaign_not_found" },
+        { "code": -32004, "message": "node_not_found" },
+        { "code": -32014, "message": "node_not_in_campaign" }
+      ]
     },
```

### Patch 3: `schemas/budget_snapshot_v1.schema.json` — Add `nodes_used` / `nodes_remaining`

```diff
     "steps_remaining": {
       "oneOf": [{ "type": "integer", "minimum": 0 }, { "type": "null" }],
       "description": "null if max_steps was not set in the BudgetEnvelope."
-    }
+    },
+    "nodes_used": { "type": "integer", "minimum": 0 },
+    "nodes_remaining": {
+      "oneOf": [{ "type": "integer", "minimum": 0 }, { "type": "null" }],
+      "description": "null if max_nodes was not set in the BudgetEnvelope."
+    }
   },
```

Also add `"nodes_used"` to the `required` array.

### Patch 4: `schemas/idea_core_rpc_v1.openrpc.json` — Add optional `filter` to `rank.compute`

```diff
       "params": [
         { "name": "campaign_id", "schema": { "type": "string", "minLength": 1 }, "required": true },
         { "name": "method", "schema": { "enum": ["pareto", "elo"] }, "required": true },
+        {
+          "name": "node_ids",
+          "schema": { "type": "array", "items": { "type": "string", "format": "uuid" }, "minItems": 1 },
+          "description": "Optional subset of nodes to rank. If omitted, all evaluated nodes in the campaign are ranked."
+        },
         { "name": "idempotency_key", "schema": { "type": "string", "minLength": 1 } }
       ],
```

### Patch 5: `schemas/idea_node_v1.schema.json` — Add `version` field for mutable-field discipline

```diff
     "updated_at": {
       "type": "string",
       "format": "date-time",
       "description": "Timestamp of last mutation (e.g., eval_info update, grounding re-audit)."
+    },
+    "version": {
+      "type": "integer",
+      "minimum": 1,
+      "default": 1,
+      "description": "Monotonically increasing version counter. Incremented on any mutation to eval_info, grounding_audit, or idea_card. Enables optimistic concurrency and audit trail."
     }
```

### Patch 6: `schemas/promotion_result_v1.schema.json` — Add `promoted_at`

```diff
   "required": [
     "campaign_id",
     "node_id",
     "idea_id",
     "handoff_artifact_ref",
     "formalism_check",
-    "grounding_audit_summary"
+    "grounding_audit_summary",
+    "promoted_at"
   ],
   "properties": {
+    "promoted_at": { "type": "string", "format": "date-time" },
```

### Patch 7: `docs/plans/2026-02-12-idea-generator-architecture-spec.md` §2.3 — Tighten idempotency language

```diff
- 2. **Idempotency MUST（side-effecting calls）**：对会落盘/写 artifact/更新节点的 RPC（`campaign.init`/`search.step`/`eval.run`/`rank.compute`/`node.promote`），adapter 应提供 `idempotency_key`；
+ 2. **Idempotency MUST（side-effecting calls）**：对会落盘/写 artifact/更新节点的 RPC（`campaign.init`/`search.step`/`eval.run`/`rank.compute`/`node.promote`），adapter **必须**提供 `idempotency_key`（OpenRPC schema 中标为 required）；
```

### Patch 8: `docs/plans/2026-02-12-idea-generator-architecture-spec.md` §4.2.1 — Add relevance check to grounding audit

After point 1 (URI 可解析), add:

```diff
+ 1b. **Relevance verification**：对每个 resolved URI，engine 必须验证被引文献的 title/abstract 与 `claim_text` 存在语义关联（最小实现：embedding cosine similarity > threshold，或 LLM binary判定）。仅"存在且可解析"不足以通过 grounding audit；引用必须 **支撑** claim。
```

### Patch 9: `schemas/idea_core_rpc_v1.openrpc.json` — Fix `$ref` resolution pattern in `components.schemas`

Replace the indirection pattern with direct `$ref` in method params and remove the `components.schemas` block, **or** use proper wrapping:

```diff
   "components": {
     "schemas": {
-      "CampaignCharterV1": { "$ref": "campaign_charter_v1.schema.json" },
+      "CampaignCharterV1": { "allOf": [{ "$ref": "campaign_charter_v1.schema.json" }] },
-      "SeedPackV1": { "$ref": "seed_pack_v1.schema.json" },
+      "SeedPackV1": { "allOf": [{ "$ref": "seed_pack_v1.schema.json" }] },
```

(Apply to all entries.) Alternatively and preferably, add a CI step that bundles and validates the OpenRPC document with `@open-rpc/schema-utils-js` and document the tested resolver in the spec.

### Patch 10: `docs/plans/2026-02-12-idea-generator-architecture-spec.md` §5.2 — Clarify mutability model

After the `grounding_audit` field description, add:

```diff
+ **Mutability discipline**：`IdeaNode` 采用 **append-only with in-place mutable slots** 模型：`eval_info`、`grounding_audit`、`idea_card`（从 null → 填充）允许就地更新，但每次更新必须递增 `version` 并更新 `updated_at`。其余字段（`campaign_id`、`idea_id`、`node_id`、`parent_node_ids`、`island_id`、`operator_id`、`origin`、`operator_trace`、`rationale_draft`、`created_at`）在创建后不可变。Engine 必须拒绝对 immutable 字段的写入尝试。
```
