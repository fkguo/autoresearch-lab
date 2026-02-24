VERDICT: NOT_READY

## Blockers

### B1. `campaign.pause` from non-`running` states: spec vs. schema ambiguity on `exhausted`

The architecture spec §2.4 says `campaign.complete` accepts `running|paused|early_stopped|exhausted → completed`. But `campaign.pause` only accepts `running → paused`. **What happens if the operator wants to pause an `early_stopped` campaign before completing it?** The state machine has no `early_stopped → paused` edge. This isn't fatal on its own, but becomes a blocker because:

- `campaign.resume` accepts `paused|early_stopped → running`, so `early_stopped` can resume. But if the operator wants to "freeze" an early-stopped campaign (prevent accidental resume) without completing it, there's no path. This is a real operational gap.
- **Fix**: Either add `early_stopped → paused` via `campaign.pause`, or document explicitly that `early_stopped` is already effectively paused (only read-only + resume allowed). The current spec is silent, which will cause implementation divergence.

### B2. `campaign.complete` allows transition from `exhausted`, but the OpenRPC description doesn't mention `exhausted`

The spec §2.4 explicitly says `campaign.complete`: `running|paused|early_stopped|exhausted → completed`. But the OpenRPC `campaign.complete` `description` field says only "Transitions the campaign into a terminal completed state" without listing allowed source states. The `errors` list for `campaign.complete` only includes `campaign_not_found`—it lacks `campaign_not_active`. **If a future implementer reads only the OpenRPC (as they should, since it's the SSOT), they have no machine-enforceable source-state constraint.** Either:
- The engine accepts `campaign.complete` from *any* non-completed state (then the spec §2.4 is correct but the OpenRPC should say so explicitly), or
- The engine should reject `campaign.complete` from certain states (then we need `campaign_not_active` in the errors list).

**Proposed fix**: Add `campaign_not_active` to `campaign.complete` errors. Add to description: "Permitted when status is running|paused|early_stopped|exhausted. Returns campaign_not_active if already completed (idempotent replay excepted)."

### B3. `rank.compute` with `method=pareto` + `elo_config` present: no schema constraint

The spec says `elo_config` is required when `method=elo` and the description says "Engine MUST return schema_validation_failed if method=elo and elo_config is absent." But there's no `if/then` in the OpenRPC param schema or a separate validation schema to enforce this. The `elo_config` param is simply `required: false`. An implementer could silently ignore `elo_config` when `method=pareto`, or fail. **This conditional requirement is not machine-enforceable from the schema alone.**

**Fix**: Add a wrapper request schema for `rank.compute` params with `allOf`/`if-then`:
```json
{
  "if": { "properties": { "method": { "const": "elo" } } },
  "then": { "required": ["elo_config"] }
}
```
Or introduce a dedicated `rank_compute_params_v1.schema.json` referenced by the OpenRPC method.

### B4. `node.list` pagination: `cursor` is required in result but there's no guarantee of stable ordering

`node_list_result_v1.schema.json` requires `cursor` (type `["string", "null"]`). Good. But neither the schema nor the spec defines:
1. What the cursor is opaque *over* (creation order? node_id lexicographic? insertion order?)
2. Whether the cursor is invalidated by concurrent `search.step` writes (new nodes appearing mid-pagination).

For an append-only store this is tractable, but the contract must state: **cursors are stable across concurrent writes (append-only: new nodes may appear after current cursor position, never before)**. Without this, pagination is unreliable for any caller doing full-campaign scans.

### B5. `idea_card_v1.schema.json` `claims[].evidence_uris` minItems enforcement gap

The `allOf` conditional says: if `support_type` ∈ `[literature, data, calculation, expert_consensus]`, then `evidence_uris` must have `minItems: 1`. **But the `then` clause only sets a property constraint without `required: ["evidence_uris"]`.** Since `evidence_uris` is already in the top-level `required` array of the claim object, the field will always be present. However, the `then` clause uses:
```json
"then": { "properties": { "evidence_uris": { "minItems": 1 } } }
```
This is correct JSON Schema semantics (it constrains the already-required field). ✅ Actually on re-read this works. **Retracted as blocker**—but note that `evidence_uris` for `llm_inference`/`assumption` types has no `minItems` constraint, meaning it can be an empty array. This is intentional (good).

**Replacement B5**: `BudgetSnapshot` requires `steps_used` but `BudgetEnvelope` has `max_steps` as optional. When `max_steps` is not set, `steps_remaining` is correctly nullable. But `steps_used` is unconditionally required even when the engine doesn't track steps. This forces the engine to always count steps even if the campaign has no step budget. This is arguably fine (just report 0 or actual), but the bigger issue is: **`BudgetEnvelope` makes `max_steps` optional but `search.step` has a required `n_steps` param—these are conceptually different (requested steps vs. budgeted steps), but the naming overlap (`steps_used`/`steps_remaining` vs `n_steps`/`max_steps`) will cause confusion**. The spec should clarify: `steps_used` in the snapshot counts `search.step` invocations (or individual sub-steps within?). The `n_steps_requested` vs `n_steps_executed` in `SearchStepResult` suggests "steps" are sub-steps within a single RPC call, while `max_steps` in the envelope is... total calls? Total sub-steps? **This is ambiguous and will produce incorrect budget accounting.**

**Fix**: Add a note to `BudgetEnvelope.max_steps`: "Counts logical search iterations (same unit as `SearchStepResult.n_steps_executed`), not RPC call count."

### B6. Idempotency store scope for `campaign.init` is underspecified for collision handling

The spec says `campaign.init` deduplicates by `(method, idempotency_key)` (no `campaign_id` since it doesn't exist yet). But what if two *different* callers (or the same caller with different charters) reuse the same `idempotency_key` for `campaign.init`? The first call creates campaign A; the second call (different charter, same key) replays campaign A's result. **This is semantically wrong—the caller intended a different campaign.**

The spec says "若首次调用返回 error，调用方如要表达'新的意图'...必须使用新的 `idempotency_key`", but it doesn't address the case where the first call *succeeded* and the caller sends a *different* charter with the same key.

**Fix**: Either:
1. Engine MUST compare the incoming params (charter hash) against stored params for replay, and reject with a new error `idempotency_conflict` if they differ, OR
2. Explicitly document that `idempotency_key` for `campaign.init` MUST be globally unique (e.g., UUIDv4), and collisions are caller bugs (but then add a detection mechanism or at least a recommendation).

Option 1 is standard practice (Stripe, etc.) and should be adopted.

---

## Non-blocking

### N1. `campaign_topup_result_v1.schema.json` is reused for pause/resume/complete

The file is named `campaign_topup_result_v1` but the description says "campaign.topup / campaign.pause / campaign.resume / campaign.complete". This works but the naming is misleading. Rename to `campaign_mutation_result_v1.schema.json` and update all `$ref`s. The OpenRPC already uses `"name": "campaign_mutation_result"` in the result for pause/resume/complete, so the schema filename should match.

### N2. `EvaluatorConfig.weights` keys are not constrained to match `dimensions`

`weights` is `additionalProperties: { "type": "number" }` but nothing enforces that keys ∈ `dimensions`. An evaluator could receive `dimensions: ["novelty", "feasibility"]` and `weights: {"impact": 0.5}`. Suggest adding a runtime validation note in the description, or consider a `propertyNames.enum` approach (though dynamic enum based on sibling field isn't expressible in JSON Schema alone—acknowledge this as a runtime check).

### N3. `IdeaNode.operator_trace.inputs` and `params` are unconstrained `object`

These accept arbitrary JSON. For auditability, consider adding at minimum `"minProperties": 1` or documenting expected keys per operator family. Not a schema blocker but weakens reproducibility.

### N4. `seed_pack_v1.schema.json` `seed_type` is free-form string

No enum constraint. In HEP-first context, expected values are `c1_gap`, `pdg_tension`, `kb_prior`, `user_seed`, etc. Suggest at least a recommended enum in the description, even if `additionalProperties` remains open for extensibility.

### N5. Missing `$id` prefix consistency

Some schemas use bare filenames (`"$id": "idea_node_v1.schema.json"`) while `$ref` values use `./` prefix in the OpenRPC. This works for most resolvers but can cause issues with strict URI resolution. Normalize to all use `./` or all bare filenames.

### N6. `SearchStepResult.new_nodes_artifact_ref` conditional requirement is nice but could be tighter

The `allOf` conditional requires `new_nodes_artifact_ref` when `new_node_ids` has ≥1 item. Good. But the inverse isn't constrained: if `new_node_ids` is empty, `new_nodes_artifact_ref` could still be present (pointing to an empty artifact). Consider whether this should be `null` when no nodes are created, for cleaner downstream logic.

### N7. No explicit error code for `idempotency_conflict`

Per Blocker B6, if you adopt param-mismatch detection, you need a new error code. Even without B6, the error code table is missing a generic "idempotency replay failed" scenario (e.g., stored response was lost due to infra issue). Consider reserving `-32016` for `idempotency_conflict`.

### N8. `island_state_v1.schema.json` lacks a budget sub-snapshot

Each island has `population_size`, `stagnation_counter`, `best_score`, but no per-island budget usage. The Distributor section (§3.3) talks about budget allocation across islands, but there's no observable per-island cost. Consider adding optional `tokens_used` / `cost_usd_used` at island level for budget debugging.

### N9. `formalism_registry_v1.schema.json` `entries` should have uniqueness constraint on `formalism_id`

JSON Schema can't enforce array-element uniqueness on a specific property, but the description should state "Engine MUST reject registries with duplicate `formalism_id` values" and this should be a runtime validation.

### N10. `campaign.init` `formalism_registry` merge semantics need tiebreaker documentation

The description says "caller entries take precedence on formalism_id collision". This is clear, but should also specify: **does the merged registry persist as the campaign's effective registry, or is it re-merged on every call?** Since `campaign.init` is idempotent (replay returns original result), the merged registry should be snapshotted at init time and stored with the campaign. Document this.

---

## Real-research fit

### Strengths

1. **Evidence-first is deeply embedded**: The claim-level provenance with `support_type` + `evidence_uris` + conditional `verification_plan` is exactly right for HEP. The grounding audit gate (active URI resolution, not just format checks) is a strong anti-hallucination measure that goes beyond what most AI research systems implement.

2. **Operator families map well to real physics discovery**: `SymmetryOperator`, `LimitExplorer`, `AnomalyAbduction` directly correspond to how HEP theorists actually think. The `CrossDomainAnalogy` with mandatory mapping table + invariants is particularly well-designed—it prevents the common LLM failure mode of superficial analogy.

3. **The two-stage RationaleDraft → IdeaCard pipeline is physically motivated**: Theorists do think in "intuition first, then formalize". Forcing the kill-criteria at the draft stage is excellent—it prevents "ideas that can never be wrong" from consuming resources.

4. **Multi-island evolution with stagnation detection**: This addresses a real problem in AI-assisted ideation (mode collapse). The repopulation mechanism (migrate from donor islands) is well-designed for maintaining diversity.

5. **Budget circuit breaker with degradation order**: Realistic for actual research use. The `degradation_order` being explicit (reduce eval rounds → reduce islands → disable cross-domain → early stop) reflects real resource tradeoffs.

### Gaps for real HEP research

1. **No explicit "negative result" or "known dead-end" representation**: In real HEP theory, knowing what *doesn't* work is as valuable as new ideas. The `IdeaNode` has `eval_info.failure_modes` but no mechanism to persist "this approach was tried by [citation] and failed because [reason]" as a first-class searchable artifact. Suggest adding a `known_dead_ends` field to `SeedPack` or a `dead_end_registry` at campaign level.

2. **No phenomenological constraint integration**: For hep-ph, ideas must be consistent with existing experimental bounds (LHC limits, flavor observables, cosmological constraints). The `IdeaCard.claims` can capture this, but there's no structured "constraint checklist" that maps to PDG/HEPData. Consider adding `experimental_constraints[]` to `IdeaCard` with structured `{observable, current_bound, source_uri, consistency_status}`.

3. **The `minimal_compute_plan` difficulty scale needs calibration**: `straightforward/moderate/challenging/research_frontier` is vague. In HEP theory, "straightforward" could mean "1-loop calculation" (days) or "tree-level" (hours). The `estimated_compute_hours_log10` helps but is optional. Make it required, or at minimum strongly recommended.

---

## Robustness & safety

### Hallucination mitigation: STRONG

- Active URI resolution in grounding audit (not just format checking) is the single most important anti-hallucination measure. ✅
- Claim-level provenance with mandatory `verification_plan` for LLM inferences. ✅
- Folklore risk scoring with human escalation (`A0-folklore`). ✅
- Clean-room evaluation (reviewers don't share context). ✅

### Provenance: STRONG with one gap

- `origin.prompt_hash` (sha256) enables reproducibility. ✅
- `operator_trace` captures inputs, params, random seed, evidence URIs used. ✅
- **Gap**: No mechanism to capture the *version* of the DomainPack (operators, prompt templates, validators) that was active when a node was created. If the pack is updated mid-campaign, old nodes can't be accurately replayed. Add `domain_pack_version` to `origin` or `operator_trace`.

### Cost control: STRONG

- Multi-level budget (global envelope + per-step fuse + degradation order). ✅
- Team cost multiplier awareness in distributor. ✅
- Step budget early-stop is well-specified. ✅

### Idempotency: MOSTLY STRONG, one hole

- Store-and-replay semantics for non-deterministic LLM calls. ✅
- Campaign-scoped idempotency stores (prevents cross-campaign pollution). ✅
- **Hole**: No param-mismatch detection (see Blocker B6). This is a safety issue because a replayed result for a different charter could lead to operating under wrong assumptions.

### Atomicity: STRONG

- Cross-campaign node access blocked. ✅
- `eval.run` with mixed-campaign nodes → full rejection (no partial writes). ✅

### Data integrity: ONE CONCERN

- The mutability contract on `IdeaNode` (§5.2 description in schema) says mutable fields should have "prior values preserved in the ledger or history artifacts". But this is only a SHOULD, not enforced. If `eval_info` is overwritten without history, the provenance chain breaks. Consider making `eval_info` an array of timestamped entries (append-only), or add a `eval_history_artifact_ref` field.

---

## Specific patch suggestions

### Patch 1: Fix `campaign.complete` error list (Blocker B2)
**File**: `schemas/idea_core_rpc_v1.openrpc.json`  
**Location**: `methods[name=campaign.complete].errors`  
**Change**: Add `campaign_not_active` error and expand description:
```json
"description": "Side-effecting. Permitted when campaign status is running|paused|early_stopped|exhausted. If campaign is already completed, returns campaign_not_active (idempotent replay excepted, which returns the stored result).",
"errors": [
  { "code": -32003, "message": "campaign_not_found" },
  { "code": -32015, "message": "campaign_not_active" }
]
```

### Patch 2: Add conditional `elo_config` requirement (Blocker B3)
**File**: New file `schemas/rank_compute_params_v1.schema.json`  
**Change**: Extract `rank.compute` params into a dedicated schema with `if/then`:
```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "rank_compute_params_v1.schema.json",
  "title": "RankComputeParams v1",
  "type": "object",
  "required": ["campaign_id", "method", "idempotency_key"],
  "properties": {
    "campaign_id": { "type": "string", "format": "uuid" },
    "method": { "enum": ["pareto", "elo"] },
    "filter": { "$ref": "./idea_list_filter_v1.schema.json" },
    "elo_config": { "$ref": "./elo_config_v1.schema.json" },
    "idempotency_key": { "type": "string", "minLength": 1 }
  },
  "allOf": [{
    "if": { "properties": { "method": { "const": "elo" } }, "required": ["method"] },
    "then": { "required": ["elo_config"] }
  }],
  "additionalProperties": false
}
```
Then in the OpenRPC, reference this schema for `rank.compute` params (or document that the conditional is enforced at runtime only—less ideal).

### Patch 3: Clarify `steps` unit in `BudgetEnvelope` (Blocker B5)
**File**: `schemas/budget_envelope_v1.schema.json`  
**Location**: `properties.max_steps`  
**Change**:
```json
"max_steps": {
  "type": "integer",
  "minimum": 1,
  "description": "Maximum number of logical search iterations (same unit as SearchStepResult.n_steps_executed). Each search.step RPC call may execute up to n_steps iterations; this envelope caps the cumulative total across all calls."
}
```

### Patch 4: Add `idempotency_conflict` error code (Blockers B6, N7)
**File**: `schemas/idea_core_rpc_v1.openrpc.json`  
**Location**: `info.description` (idempotency semantics section) + each side-effecting method's `errors` array  
**Change**: Add to the description:
```
5) Param-mismatch detection (MUST for campaign.init, SHOULD for all side-effecting methods): If a duplicate idempotency_key is received with different params (detected via param hash comparison), the engine MUST return idempotency_conflict (-32017) rather than replaying a mismatched result.
```
Add to `campaign.init` (and optionally all side-effecting methods):
```json
{ "code": -32017, "message": "idempotency_conflict" }
```

### Patch 5: Add cursor stability guarantee (Blocker B4)
**File**: `schemas/node_list_result_v1.schema.json`  
**Location**: `properties.cursor.description`  
**Change**:
```json
"cursor": {
  "type": ["string", "null"],
  "description": "Opaque pagination cursor. null if no more results. Cursors are stable across concurrent append-only writes: new nodes created after cursor issuance appear after the cursor's position, never before. Cursors MUST remain valid for the campaign lifetime (or until campaign.complete)."
}
```

### Patch 6: Add `early_stopped → paused` transition or document equivalence (Blocker B1)
**File**: `docs/plans/2026-02-12-idea-generator-architecture-spec.md`  
**Location**: §2.4, allowed explicit migrations  
**Change**: Add:
```
- `campaign.pause`：`running|early_stopped → paused`（early_stopped 也允许显式"冻结"，防止意外 resume）
```
And in the OpenRPC `campaign.pause` description:
```
"description": "Side-effecting. Permitted when campaign status is running or early_stopped; otherwise campaign_not_active."
```

### Patch 7: Rename `campaign_topup_result_v1.schema.json` → `campaign_mutation_result_v1.schema.json` (N1)
**File**: Rename `schemas/campaign_topup_result_v1.schema.json` → `schemas/campaign_mutation_result_v1.schema.json`  
**Change**: Update `$id` to `campaign_mutation_result_v1.schema.json`. Update all `$ref` in `idea_core_rpc_v1.openrpc.json` (4 occurrences: topup, pause, resume, complete results).

### Patch 8: Add `domain_pack_version` to `origin` (Robustness gap)
**File**: `schemas/idea_node_v1.schema.json`  
**Location**: `properties.origin.properties`  
**Change**: Add:
```json
"domain_pack_version": {
  "type": "string",
  "minLength": 1,
  "description": "Version identifier of the DomainPack (operators, prompt templates, validators) active when this node was created. Enables accurate replay if the pack is updated mid-campaign."
}
```
Add to `origin.required`: `"domain_pack_version"`.

### Patch 9: Add `formalism_id` uniqueness requirement (N9)
**File**: `schemas/formalism_registry_v1.schema.json`  
**Location**: `properties.entries.description`  
**Change**: Add to the `entries` array description:
```json
"description": "List of formalism entries. Engine MUST reject registries with duplicate formalism_id values (return schema_validation_failed)."
```

### Patch 10: Add `experimental_constraints` to `IdeaCard` (Real-research fit)
**File**: `schemas/idea_card_v1.schema.json`  
**Location**: `properties` (new optional field)  
**Change**: Add:
```json
"experimental_constraints": {
  "type": "array",
  "description": "Optional structured experimental/observational constraints that the idea must satisfy (HEP-first: LHC bounds, flavor observables, cosmological limits). Strongly recommended for hep-ph ideas.",
  "items": {
    "type": "object",
    "required": ["observable", "constraint_type", "source_uri"],
    "properties": {
      "observable": { "type": "string", "minLength": 1 },
      "constraint_type": { "enum": ["upper_bound", "lower_bound", "measurement", "exclusion", "consistency"] },
      "current_value": { "type": "string", "description": "Current experimental value or bound (as string to handle units)." },
      "source_uri": { "type": "string", "format": "uri" },
      "consistency_status": { "enum": ["consistent", "tension", "excluded", "unchecked"], "default": "unchecked" }
    },
    "additionalProperties": false
  }
}
```
