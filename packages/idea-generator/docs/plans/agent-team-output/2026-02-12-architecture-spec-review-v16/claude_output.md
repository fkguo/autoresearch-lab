VERDICT: NOT_READY

## Blockers

### B1. `campaign.topup` result schema reuse creates semantic confusion for `campaign.pause`/`campaign.resume`/`campaign.complete`

The methods `campaign.pause`, `campaign.resume`, and `campaign.complete` all return `campaign_topup_result_v1.schema.json`, which is titled "CampaignMutationResult" but has `$id` = `campaign_topup_result_v1`. This is a naming/identity mismatch. The `$id` is the canonical identifier for JSON Schema dereferencing — having `pause`/`resume`/`complete` return a schema whose `$id` says "topup" violates the principle of least surprise and will cause confusion in generated client stubs, documentation, and test fixtures. **Fix**: Rename to `campaign_mutation_result_v1.schema.json` (and update `$id` accordingly), or create distinct result schemas per method.

### B2. `campaign.resume` from `exhausted` state is unspecified in the state machine

Section 2.4 says `campaign.resume` is "Permitted when campaign status is paused or early_stopped." But the state machine also has `exhausted`. The spec says `exhausted` allows `campaign.topup` which can transition to `running` — but what if a user calls `campaign.resume` on an `exhausted` campaign? The OpenRPC description says it returns `budget_exhausted` but the state machine transition table doesn't list `exhausted → *` under `campaign.resume`. This ambiguity will cause implementation divergence. **Fix**: Either (a) explicitly allow `campaign.resume` from `exhausted` (returning `budget_exhausted` if still exhausted, or transitioning to `running` if topup already applied), or (b) explicitly forbid it with `campaign_not_active`. Document whichever choice in both the spec §2.4 and the OpenRPC method description.

### B3. Idempotency for `campaign.init` — no `campaign_id` in dedupe key creates collision risk across campaigns

For `campaign.init`, dedupe is `(method, idempotency_key)` — globally scoped. If two different callers (or the same caller for different charters) accidentally reuse an `idempotency_key`, the second call gets a replay of the *wrong* campaign init. The spec acknowledges `campaign.init` has no `campaign_id` but doesn't mitigate this. **Fix**: Either (a) require the idempotency store for `campaign.init` to also hash the `charter` + `seed_pack` + `budget` inputs (so different payloads with the same key are rejected as a conflict, not replayed), or (b) add a `namespace`/`caller_id` to the idempotency key scope to reduce collision probability. Without this, the system is unsafe for multi-tenant or multi-operator use.

### B4. `rank.compute` is listed as side-effecting but the atomicity/scoping semantics for `filter` are inconsistent

Section 2.3 §1 says for "list/filter-style RPCs" (`node.list`, `rank.compute`'s `filter`), mismatched node IDs should return empty results. But `rank.compute` is classified as **side-effecting** (writes ranking artifacts), not read-only. A side-effecting method that silently returns empty results when filtering to zero nodes is dangerous — it creates an empty ranking artifact that could be consumed downstream as "no good ideas." **Fix**: `rank.compute` should require `ranked_nodes` to have `minItems: 1` (already in schema — good), but the OpenRPC description should state that if the filter resolves to fewer than 2 nodes (for Elo) or 1 node (for Pareto), the engine MUST return `insufficient_eval_data` rather than silently creating a degenerate ranking.

### B5. `search_step_result_v1.schema.json` — `island_states` has `minItems: 1` but search could eliminate all islands

If all islands reach `EXHAUSTED` and the step produces zero results, the system still requires at least 1 island state. This is probably correct (islands don't disappear, they just change state), but this invariant is not stated in the spec. More critically: `n_steps_executed: 0` is allowed (`minimum: 0`) combined with `new_node_ids: []` (empty array), but the `allOf` conditional requires `new_nodes_artifact_ref` only when `new_node_ids` has `minItems: 1`. This means a zero-result step has no artifact ref, which is fine — but the spec doesn't clarify whether zero-result steps should still be persisted in the idempotency store (they should, since they consumed wall-clock and tokens). **Fix**: Add a note that zero-result steps are valid completions that MUST be idempotency-stored and budget-accounted.

### B6. No error code for idempotency conflicts

The spec describes idempotency replay semantics in detail but provides no error code for **idempotency conflicts** (same key, different payload — especially critical for B3 above). Without this, an implementation that detects a payload mismatch on an existing key has no standardized way to signal the error. **Fix**: Add error code `idempotency_conflict` (e.g., `-32016`) to the OpenRPC error list, defined as "the idempotency_key was previously used with different parameters."

## Non-blocking

### N1. `BudgetSnapshot` missing `steps_remaining` in `required`

`steps_remaining` and `nodes_remaining` are nullable but not in `required`. This means they could be entirely absent (not just `null`). Since `steps_used` and `nodes_used` *are* required, consumers would need to handle three states: present-with-value, present-as-null, and absent. **Suggestion**: Add `steps_remaining` and `nodes_remaining` to `required` and rely on `null` for "not configured." This simplifies client code.

### N2. `node.list` pagination: `cursor` is required in result but could be null on first page with zero results

The schema correctly uses `"type": ["string", "null"]` for cursor. But `total_count` combined with cursor-based pagination can drift (new nodes created between pages). **Suggestion**: Add a note that `total_count` is a snapshot at query time and MAY change between pages. Or alternatively, return a `snapshot_version`/`as_of` timestamp.

### N3. `EvaluatorConfig.weights` keys are not constrained to match `dimensions`

`weights` is `additionalProperties: { "type": "number" }` — any string key is accepted. A caller could provide weights for dimensions not in `dimensions[]`. **Suggestion**: Either validate at runtime that weight keys ⊆ dimensions (and document this in the schema description), or use a tuple-based representation `[{dimension, weight}]`.

### N4. `IdeaCard.claims[].evidence_uris` allows empty array for `literature`/`data`/`calculation`/`expert_consensus`

The conditional `then` sets `minItems: 1` on `evidence_uris` for evidence-backed claims, which is correct. However, this is inside a claim-level `allOf` — implementers should verify that the JSON Schema validator they use correctly evaluates `if/then` within array items. **Suggestion**: Add a test vector (a claim with `support_type: "literature"` and empty `evidence_uris`) to a conformance test suite, to catch validators that silently ignore nested conditionals.

### N5. `IdeaNode.operator_trace.inputs` and `.params` are untyped objects

Both are `"type": "object"` with no constraints. This is intentional for extensibility, but it means there's no way to validate operator-specific trace completeness. **Suggestion**: Consider adding an optional `operator_schema_ref` field that points to an operator-specific schema for `inputs`/`params`, enabling optional deep validation.

### N6. Formalism registry merge semantics under-specified

`campaign.init` says caller entries take precedence on `formalism_id` collision, but doesn't specify whether the DomainPack default entries are still available (i.e., is it a full override or a shallow merge?). **Suggestion**: Clarify that the merge is union-with-override: all DomainPack entries plus caller entries, where caller wins on `formalism_id` collision.

### N7. `degradation_order` in `BudgetEnvelope` is a flat array — no thresholds

The degradation strategies are listed but there's no associated trigger threshold (e.g., "reduce_eval_rounds when remaining_budget < 30%"). Without thresholds, the engine must invent its own, making behavior non-reproducible across implementations. **Suggestion**: Change to `[{action, trigger_pct_remaining}]` or document that thresholds are implementation-defined but MUST be logged in degradation_events.

### N8. `search.step` `n_steps` semantics vs `step_budget` overlap

`n_steps` bounds the number of search iterations, while `step_budget.max_steps` also bounds steps. When both are provided, which takes precedence? **Suggestion**: Clarify that `n_steps` is the *requested* count and `step_budget.max_steps` is the *cost fuse*; effective steps = `min(n_steps, step_budget.max_steps, remaining_global_steps)`.

### N9. No schema version negotiation

The OpenRPC doc is `1.8.3` but there's no mechanism for the adapter to discover which schema version the engine supports. **Suggestion**: Add an `engine.capabilities` or `engine.info` read-only method that returns supported schema versions and available DomainPacks.

### N10. `campaign_status_v1.schema.json` — `last_step_id` is optional but not nullable

It's not in `required` and has no `null` type. For a campaign that has never executed a step, this field would be absent. **Suggestion**: Either add to `required` with `"type": ["string", "null"]`, or document that absence means "no steps executed."

## Real-research fit

**Strengths (significant)**:

1. **Evidence-first provenance is deeply wired**: Claim-level `support_type` + `evidence_uris` + conditional `verification_plan` for LLM inferences is exactly right for HEP, where a single ungrounded claim can waste months of compute. The grounding audit gate at promotion is a critical safety mechanism.

2. **Operator taxonomy maps well to actual HEP discovery patterns**: `AnomalyAbduction` (B-meson anomalies → new physics), `SymmetryOperator` (breaking/restoring gauge symmetries), `LimitExplorer` (heavy quark limit, large-N, soft/collinear limits) — these directly correspond to how theorists actually generate ideas. The `CrossDomainAnalogy` with mandatory mapping tables is particularly valuable (e.g., AdS/CFT-inspired condensed matter applications).

3. **Formalism registry is essential for C2 handoff**: In HEP, the gap between "interesting idea" and "executable calculation" often dies at the formalism choice. Requiring `candidate_formalisms` to map to a registry with `validator + compiler` is a genuine workflow improvement.

4. **Multi-island with stagnation detection**: This correctly models how research groups explore — parallel threads that can cross-pollinate. The `STAGNANT → REPOPULATED` transition corresponds to the real-world pattern of "importing techniques from a neighboring subfield."

**Gaps for real research**:

5. **No mechanism for "negative results" or "kill confirmations"**: In HEP, confirming that an idea *doesn't work* (and documenting why) is as valuable as generating new ideas. The schema has `verification_status: "falsified"` on claims, but there's no campaign-level mechanism for systematically tracking and surfacing killed ideas as valuable outputs (they prevent re-exploration and inform future operators).

6. **PDG/HEPData integration is mentioned but not wired**: The grounding audit says "must be consistent with PDG/HEPData" but there's no schema for the data comparison result (tolerance, measured vs. predicted values, confidence level). This will be critical for claims like "the anomalous magnetic moment deviates by 4.2σ."

7. **Temporal dynamics of evidence**: HEP evidence evolves (new measurements supersede old ones, PDG values update annually). The grounding audit has a `timestamp` but no mechanism for re-auditing when upstream evidence changes. This matters for long-running campaigns.

## Robustness & safety

1. **Hallucination mitigation is well-architected**: The Explain-Then-Formalize pipeline with mandatory grounding audit is a strong defense. The requirement for `verification_plan` on LLM inferences and the `folklore_risk_score` are good secondary defenses. The `Checker` role as clean-room independent verification is the right pattern.

2. **Budget safety is comprehensive**: The three-level budget system (global envelope, step-level fuse, degradation cascade) with circuit breaker is well-designed. The `exhausted` state with topup recovery avoids the common failure mode of "budget exceeded, campaign dead."

3. **Idempotency for LLM calls is correctly specified**: The "store-and-replay, not re-execute" requirement for `search.step` is critical — without this, retries would generate duplicate ideas with different content, corrupting the search tree.

4. **Risk: Prompt injection through `seed_pack` and `campaign_charter`**: Seeds come from external sources (C1 gaps, user seeds). A malicious or malformed seed could attempt prompt injection through the `content` field. The schema constrains `content` to `string` but has no sanitization requirement. **Recommendation**: Add a note that the engine MUST treat seed content as data (not instructions) and implement appropriate sandboxing.

5. **Risk: Unbounded `eval_info.failure_modes[]` as free text**: This field accepts arbitrary strings, which could be used to smuggle instructions if eval output is later fed back into prompts. **Recommendation**: Either enumerate allowed values or require sanitization before re-injection.

6. **Risk: `operator_trace.inputs` as untyped object**: Could contain arbitrarily large payloads, causing storage and replay issues. **Recommendation**: Add a `maxProperties` or size limit guidance.

## Specific patch suggestions

### Patch 1: Rename topup result schema (`schemas/campaign_topup_result_v1.schema.json`)

**File**: `schemas/campaign_topup_result_v1.schema.json`  
**Change**: Rename file to `schemas/campaign_mutation_result_v1.schema.json`. Update internal fields:
```json
{
  "$id": "campaign_mutation_result_v1.schema.json",
  "title": "CampaignMutationResult v1",
  ...
}
```
Update all `$ref` in `schemas/idea_core_rpc_v1.openrpc.json` for `campaign.topup`, `campaign.pause`, `campaign.resume`, `campaign.complete` to point to `./campaign_mutation_result_v1.schema.json`.

### Patch 2: Add idempotency conflict error code (`schemas/idea_core_rpc_v1.openrpc.json`)

**File**: `schemas/idea_core_rpc_v1.openrpc.json`  
**Change**: Add to every side-effecting method's `errors` array:
```json
{ "code": -32016, "message": "idempotency_conflict" }
```
And add to the `info.description`:
```
5) If an idempotency_key is reused with different parameters (detected via parameter hash comparison), 
the engine MUST return idempotency_conflict (-32016) and MUST NOT replay or re-execute.
```

### Patch 3: Add payload hash to idempotency for `campaign.init` (`docs/plans/2026-02-12-idea-generator-architecture-spec.md`)

**File**: `docs/plans/2026-02-12-idea-generator-architecture-spec.md`, Section 2.3, Idempotency MUST  
**Change**: Replace:
```
`campaign.init` 无 `campaign_id`，因此该项为空
```
With:
```
`campaign.init` 无 `campaign_id`，因此 dedupe key 为 `(method, idempotency_key)`；
但 engine 必须额外验证 payload 一致性（通过存储参数 hash），若同一 idempotency_key 
对应不同 charter/seed_pack/budget，必须返回 `idempotency_conflict`（-32016），不得 
replay 或重新执行。
```

### Patch 4: Require `steps_remaining` and `nodes_remaining` in `BudgetSnapshot` (`schemas/budget_snapshot_v1.schema.json`)

**File**: `schemas/budget_snapshot_v1.schema.json`  
**Change**: Add `"steps_remaining"` and `"nodes_remaining"` to the `required` array. They already support `null` via `oneOf`.

### Patch 5: Clarify `rank.compute` minimum node requirement (`schemas/idea_core_rpc_v1.openrpc.json`)

**File**: `schemas/idea_core_rpc_v1.openrpc.json`, `rank.compute` method  
**Change**: Append to `description`:
```
If the filter resolves to fewer than 2 nodes (for method=elo) or 0 nodes (for method=pareto), 
the engine MUST return insufficient_eval_data (-32013), not an empty or degenerate ranking artifact.
```

### Patch 6: Clarify `n_steps` vs `step_budget.max_steps` precedence (`schemas/idea_core_rpc_v1.openrpc.json`)

**File**: `schemas/idea_core_rpc_v1.openrpc.json`, `search.step` `n_steps` param  
**Change**: Update `n_steps` description to:
```json
"description": "Requested number of search steps (>= 1). Effective steps executed = min(n_steps, step_budget.max_steps if set, global budget remaining steps). If step_budget.max_steps is also provided and is less than n_steps, the step_budget fuse takes precedence."
```

### Patch 7: Add zero-result step idempotency note (`docs/plans/2026-02-12-idea-generator-architecture-spec.md`)

**File**: `docs/plans/2026-02-12-idea-generator-architecture-spec.md`, Section 2.3, after step budget fuse SHOULD  
**Change**: Add:
```
4. **Zero-result steps MUST（审计完整性）**：`search.step` 返回 `n_steps_executed=0` 且 
`new_node_ids=[]` 的结果仍然是有效完成（consumed wall-clock/tokens），MUST 写入 
idempotency store 并计入 budget accounting。
```

### Patch 8: Add `campaign.resume` from `exhausted` to state machine (`docs/plans/2026-02-12-idea-generator-architecture-spec.md`)

**File**: `docs/plans/2026-02-12-idea-generator-architecture-spec.md`, Section 2.4, `campaign.resume` transition  
**Change**: Replace:
```
- `campaign.resume`：`paused|early_stopped → running`（若预算不足则 `budget_exhausted`）
```
With:
```
- `campaign.resume`：`paused|early_stopped|exhausted → running`（若预算不足则 `budget_exhausted`；
  对 `exhausted` 状态，`campaign.resume` 等价于"检查预算是否已被 topup 补足"——
  若已补足则 `→ running`，否则返回 `budget_exhausted` 并保持 `exhausted`）
```
This aligns the spec with the OpenRPC description which mentions `budget_exhausted` as a possible error, implying `exhausted` is an accepted input state.

### Patch 9: Add data comparison sub-schema for grounding audit (`schemas/idea_node_v1.schema.json`)

**File**: `schemas/idea_node_v1.schema.json`, `grounding_audit` object  
**Change**: Add optional `data_checks` field inside the grounding_audit non-null branch:
```json
"data_checks": {
  "type": "array",
  "description": "Results of numerical comparisons against PDG/HEPData for data-backed claims.",
  "items": {
    "type": "object",
    "required": ["claim_index", "source", "measured_value", "claimed_value", "tolerance_sigma", "status"],
    "properties": {
      "claim_index": { "type": "integer", "minimum": 0 },
      "source": { "type": "string", "minLength": 1 },
      "measured_value": { "type": "string", "minLength": 1 },
      "claimed_value": { "type": "string", "minLength": 1 },
      "tolerance_sigma": { "type": "number", "minimum": 0 },
      "status": { "enum": ["consistent", "tension", "inconsistent"] }
    },
    "additionalProperties": false
  }
}
```

### Patch 10: Add `engine.info` read-only method (`schemas/idea_core_rpc_v1.openrpc.json`)

**File**: `schemas/idea_core_rpc_v1.openrpc.json`, `methods` array  
**Change**: Add:
```json
{
  "name": "engine.info",
  "summary": "Return engine capabilities, supported schema versions, and available DomainPacks.",
  "paramStructure": "by-name",
  "params": [],
  "description": "Read-only. Always available. No authentication or campaign context required.",
  "result": {
    "name": "engine_info",
    "schema": {
      "type": "object",
      "required": ["engine_version", "schema_versions", "domain_packs"],
      "properties": {
        "engine_version": { "type": "string" },
        "schema_versions": { "type": "array", "items": { "type": "string" } },
        "domain_packs": { "type": "array", "items": { "type": "string" } },
        "supported_operators": { "type": "array", "items": { "type": "string" } }
      },
      "additionalProperties": false
    }
  },
  "errors": []
}
```
