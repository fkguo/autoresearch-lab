VERDICT: NOT_READY

## Blockers

### B1. `allOf` wrapper in OpenRPC `$ref` prevents mechanical bundling and breaks some validators

In `idea_core_rpc_v1.openrpc.json`, every component schema uses the pattern:

```json
"CampaignCharterV1": { "allOf": [{ "$ref": "campaign_charter_v1.schema.json" }] }
```

This `allOf` with a single-element array is a well-known anti-pattern: it creates an implicit anonymous wrapper schema that (a) defeats `$ref`-only resolution in many OpenRPC toolchains (e.g., `open-rpc/meta-schema` expects component schemas to be direct `$ref` or inline, not `allOf`-wrapped), (b) makes mechanical bundling (e.g., `json-schema-ref-parser`, `@apidevtools/swagger-parser`) produce double-nested definitions, and (c) silently drops `description`/`title` from the referenced schema in some validators. Since the spec doc declares a **hard constraint** that bundling must be mechanized, this wrapper pattern will cause drift or breakage.

**Fix**: Replace each component entry with a direct `$ref`:
```json
"CampaignCharterV1": { "$ref": "campaign_charter_v1.schema.json" }
```

### B2. `node.list` pagination contract is incomplete — `limit` has no default and no server-side cap

`node.list` accepts `limit` with `minimum: 1` but no `maximum` and no `default`. A caller omitting `limit` gets undefined behavior (unbounded dump? error?). The spec doc does not state the engine's obligation when `limit` is absent. This is a contract gap that will cause divergent adapter/engine implementations.

**Fix**: Either (a) make `limit` required, or (b) add `"default": 50, "maximum": 500` (or similar) and state in the method description that omission returns a server-chosen page size.

### B3. `rank.compute` with `method=elo` does not enforce `elo_config` presence

The spec doc (§6.3) says Elo MUST be bounded + deterministic via `elo_config={max_rounds, seed}`. But the OpenRPC schema marks `elo_config` as `required: false`. There is no conditional schema (`if method=elo then elo_config required`). This means a caller can legally request `method=elo` without any bound, violating the spec's own hard constraint.

**Fix**: Add a method-level `allOf`/`if-then` or split into `rank.computePareto` / `rank.computeElo`, or document that the engine MUST return `schema_validation_failed` when `method=elo && elo_config absent` (and add this to the error list + test contract).

### B4. `campaign.topup` monotonicity is declared but not machine-enforced

The spec says "monotonic budget top-up" but the `BudgetTopUpV1` schema only validates that individual fields are positive. There is no mechanism ensuring that the engine rejects a topup that would _decrease_ any effective limit (e.g., if future versions add `set_max_tokens` alongside `add_tokens`). More critically, the OpenRPC doc doesn't specify what happens if the resulting budget exceeds some platform-level cap, or if a topup arrives when the campaign is `exhausted`/`completed`.

**Fix**: Add to the method description: (a) topup on a non-`running`/`paused` campaign returns a new error code (e.g., `campaign_not_active`); (b) topup is purely additive — no `set_*` fields are permitted in v1. Add `campaign_not_active` error to the method's error list.

### B5. Missing `idempotency_key` on `eval.run` response — no way to confirm replay

Side-effecting methods return results but don't echo back `idempotency_key`. When a caller retries and gets a cached response, there's no field in the result to confirm whether it's a fresh or replayed response. This makes debugging idempotency failures extremely difficult.

**Fix**: Add `"idempotency_key": { "type": "string" }` and `"is_replay": { "type": "boolean" }` to every side-effecting method's result schema (or define a common `IdempotencyMeta` object included in each).

---

## Non-blocking

### N1. `IdeaCard.claims[].evidence_uris` allows empty array for `literature`/`data`/`calculation`/`expert_consensus`

The `allOf` conditional does `"then": { "properties": { "evidence_uris": { "minItems": 1 } } }` — but this only adds a constraint within `properties`; it doesn't add `evidence_uris` to `required`. Since `evidence_uris` is already `required` at the top level, this does work correctly via the parent `required` + the conditional `minItems`. However, the intent would be clearer and less fragile with an explicit comment or by restructuring into `if/then` blocks that use `required` + `minItems` together. Low risk but recommend clarifying.

### N2. `BudgetSnapshot` has `steps_remaining` / `nodes_remaining` as nullable but `tokens_remaining` / `cost_usd_remaining` / `wall_clock_s_remaining` are non-nullable

This is consistent with the fact that `BudgetEnvelope` requires `max_tokens`/`max_cost_usd`/`max_wall_clock_s` but not `max_steps`/`max_nodes`. Good. But `steps_used` is required even when `max_steps` is not set — this is fine for observability, just note that the meaning of `steps_used` without a cap is "informational only." Consider adding a sentence to the description.

### N3. `IslandState` lacks `operator_ids` or `operator_weights` — no observability into per-island operator distribution

The spec doc (§3.1, §3.3) describes softmax-bandit allocation per operator per island, but the `IslandState` schema provides no field to observe which operators are active or their current weights. This means the adapter/human cannot diagnose "why island X is stagnant" without digging into engine internals.

**Fix**: Add optional `"active_operators": { "type": "array", "items": { "type": "string" } }` and/or `"operator_weights": { "type": "object", "additionalProperties": { "type": "number" } }` to `island_state_v1.schema.json`.

### N4. No explicit error code for "Elo config missing when method=elo"

Related to B3 but separable: even if fixed via conditional schema, the error list for `rank.compute` doesn't include `schema_validation_failed` (it has `budget_exhausted`, `campaign_not_found`, `insufficient_eval_data`). Add `-32002 schema_validation_failed` to `rank.compute` errors.

### N5. `search.step` `n_steps` default=1 is in schema but not in `required`

The parameter is optional with a default, which is fine. But the engine contract should explicitly state: if `n_steps` is omitted, the engine executes exactly 1 step. Currently this is only implied by `"default": 1`. Recommend adding a sentence to the method summary.

### N6. `EvaluatorConfig.weights` keys are not constrained to match `dimensions`

A caller could pass `weights: { "novelty": 2.0, "pizzazz": 1.0 }` where `"pizzazz"` is not in the `dimensions` enum. The schema allows this via `additionalProperties: { "type": "number" }`. Recommend either (a) documenting that unknown weight keys are ignored, or (b) adding a validation rule that weight keys must be a subset of `dimensions`.

### N7. `campaign_charter_v1.schema.json` — `domain` is free-text, not an enum

The spec doc recommends `hep-ph | hep-th | nucl-th` but the schema is `minLength: 1` string. This is intentional for extensibility (good), but means no compile-time validation of domain. Consider adding an optional `"examples"` array for documentation, or a `pattern` for the HEP-first case that can be relaxed later.

### N8. `formalism_registry_v1` — `entries` has `minItems: 1` but the spec says "merged registry MUST be non-empty"

The schema correctly enforces non-empty when provided, but the *merged* result (DomainPack default + caller override) non-emptiness can only be checked at runtime. This is fine, but the error path should be documented: if the DomainPack has no default and the caller omits `formalism_registry`, `campaign.init` must fail. Add this to the method description.

### N9. No versioning field on individual schemas

While filenames contain `v1`, there's no `"version"` field inside the schema objects themselves. This makes it harder for the engine to detect schema version mismatches at runtime (e.g., an adapter sending v2 `IdeaCard` to a v1 engine). Consider adding an optional `"schema_version": { "const": "1.0.0" }` or using `$id` parsing.

### N10. `search_step_result_v1` conditional: `new_nodes_artifact_ref` required when `new_node_ids` is non-empty

The `allOf` conditional is:
```json
{
  "if": { "properties": { "new_node_ids": { "type": "array", "minItems": 1 } } },
  "then": { "required": ["new_nodes_artifact_ref"] }
}
```

This is a well-known JSON Schema pitfall: `if` without `required: ["new_node_ids"]` in the `if` block means the condition triggers on *any* object where `new_node_ids`, if present, matches — but since `new_node_ids` is already required at the top level, this works. Still, the pattern is fragile. Recommend adding `"required": ["new_node_ids"]` to the `if` block for clarity and defensive correctness.

---

## Real-research fit

### R1. The Explain-Then-Formalize pipeline is well-designed for HEP

The two-stage `RationaleDraft → IdeaCard` pipeline directly maps to how theoretical physicists actually develop ideas: first a motivation/mechanism sketch (often in conversation or on a whiteboard), then a structured formalization. The mandatory `kill_criteria` in `RationaleDraft` and `verification_plan` for `llm_inference`/`assumption` claims are excellent safeguards against the common LLM failure mode of generating plausible-sounding but untestable ideas.

### R2. The operator taxonomy reflects real discovery patterns

`AnomalyAbduction`, `SymmetryOperator`, `LimitExplorer`, and `RepresentationShift` directly correspond to actual HEP discovery strategies (e.g., anomaly-driven BSM model building, soft/collinear limit analysis, duality transformations). `CrossDomainAnalogy` with mandatory mapping tables is a smart way to prevent the "metaphor-as-physics" failure mode.

### R3. Multi-island evolution is a good fit for HEP's branching research landscape

HEP research naturally has multiple competing paradigms (e.g., SUSY vs composite Higgs vs extra dimensions for the hierarchy problem). The island model with repopulation maps well to how the community actually explores: separate groups pursuing different approaches with occasional cross-pollination at conferences.

### R4. The formalism registry is critical and well-positioned

Requiring `candidate_formalisms[]` to resolve against a registry before C2 promotion prevents the common failure of generating "ideas" that sound great but have no executable computational framework. This is a real bottleneck in AI-assisted physics.

### R5. Gap: No explicit handling of "negative results" or "this direction is exhausted"

Real research often produces valuable negative results ("this symmetry breaking pattern is excluded by X data"). The current schema has no first-class representation of a node that reached a definitive negative conclusion. Such nodes are valuable for pruning future search but would currently just sit with low scores. Consider adding a `conclusion_type: "positive" | "negative" | "inconclusive"` field to `IdeaCard` or `IdeaNode`.

### R6. The `minimal_compute_plan` granularity is appropriate

The difficulty/infrastructure/blocker fields in `minimal_compute_plan` items map well to how HEP computations are actually scoped: "Can I do this on a laptop with FeynCalc, or does this need a cluster for lattice QCD?" The `estimated_compute_hours_log10` is a pragmatic choice for order-of-magnitude planning.

---

## Robustness & safety

### S1. Grounding audit is well-structured but needs active resolution timeout

The spec says evidence URIs must pass "active lookup" (INSPIRE API / DOI resolver), but doesn't specify timeout, retry, or fallback behavior. A single unreachable DOI server could block the entire grounding audit pipeline. Recommend adding `grounding_audit_config` with `resolution_timeout_s`, `max_retries`, and `fallback_policy: "mark_unresolvable" | "block"`.

### S2. Idempotency store lifecycle needs explicit garbage collection strategy

The spec says idempotency records "MUST be retained for the campaign lifetime." For long-running campaigns (weeks/months), this could grow unboundedly. The spec should either (a) specify a maximum record count with LRU eviction of oldest confirmed-delivered records, or (b) commit to bounded campaigns and document the expected record volume. The current design is correct for correctness but needs an operational bound.

### S3. `folklore_risk_score` threshold is not specified in any schema

The spec doc says "超过阈值则必须走 `A0-folklore` 人类裁定" but no schema contains the threshold value. It should either be in `EvaluatorConfig` (as `folklore_risk_threshold`) or in `CampaignCharter` (as a campaign-level policy).

### S4. Hallucination vector: `operator_trace.evidence_uris_used[]` is self-reported

The operator reports which evidence it "used," but there's no cross-check that these URIs actually influenced the output. A hallucinating LLM could list URIs it never read. Mitigation: the grounding audit should verify not just that `claims[].evidence_uris` exist, but that the claim content is semantically consistent with the cited evidence. This is noted in §4.2.1 but not reflected in any schema field (e.g., `relevance_score` per URI).

### S5. No rate limiting or concurrent step protection

The spec doesn't address what happens if two `search.step` calls arrive concurrently for the same campaign. With idempotency keys they won't collide if they have different keys, but they could compete for budget. Recommend adding either (a) a `campaign_lock` mechanism (only one active step per campaign), or (b) documenting that concurrent steps are supported with optimistic budget deduction.

### S6. `prompt_hash` and `prompt_snapshot_hash` are strong audit features

These SHA-256 hashes of the actual prompts used are excellent for reproducibility and hallucination forensics. However, the spec doesn't say where the actual prompt content is stored — only hashes are in the schema. Recommend specifying that prompt snapshots are stored in a campaign-scoped artifact store keyed by hash, enabling full replay.

---

## Specific patch suggestions

### P1. `schemas/idea_core_rpc_v1.openrpc.json` — Fix `allOf` wrapper anti-pattern
**File**: `schemas/idea_core_rpc_v1.openrpc.json`  
**Section**: `components.schemas`  
**Change**: Replace every entry of the form:
```json
"CampaignCharterV1": { "allOf": [{ "$ref": "campaign_charter_v1.schema.json" }] }
```
with:
```json
"CampaignCharterV1": { "$ref": "campaign_charter_v1.schema.json" }
```
Apply to all 17 component schema entries.

### P2. `schemas/idea_core_rpc_v1.openrpc.json` — Add conditional enforcement for `elo_config`
**File**: `schemas/idea_core_rpc_v1.openrpc.json`  
**Section**: `methods[name=rank.compute]`  
**Change**: Add to the method description:
```
"description": "... When method=elo, elo_config MUST be provided; omission returns schema_validation_failed (-32002)."
```
Add `-32002 schema_validation_failed` to the method's `errors` array. In the params, add a note:
```json
{
  "name": "elo_config",
  "schema": { "$ref": "#/components/schemas/EloConfigV1" },
  "required": false,
  "description": "Required when method=elo. Engine MUST return schema_validation_failed (-32002) if method=elo and elo_config is absent."
}
```

### P3. `schemas/idea_core_rpc_v1.openrpc.json` — Add `limit` default and max to `node.list`
**File**: `schemas/idea_core_rpc_v1.openrpc.json`  
**Section**: `methods[name=node.list].params[name=limit]`  
**Change**:
```json
{
  "name": "limit",
  "schema": { "type": "integer", "minimum": 1, "maximum": 500, "default": 50 },
  "description": "Page size. Defaults to 50 if omitted. Maximum 500."
}
```

### P4. `schemas/idea_core_rpc_v1.openrpc.json` — Add `campaign_not_active` error to `campaign.topup`
**File**: `schemas/idea_core_rpc_v1.openrpc.json`  
**Section**: `methods[name=campaign.topup].errors`  
**Change**: Add:
```json
{ "code": -32015, "message": "campaign_not_active", "data": "Topup is only permitted when campaign status is running or paused." }
```

### P5. Add `IdempotencyMeta` to all side-effecting result schemas
**File**: New schema `schemas/idempotency_meta_v1.schema.json`:
```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "idempotency_meta_v1.schema.json",
  "title": "IdempotencyMeta v1",
  "type": "object",
  "required": ["idempotency_key", "is_replay"],
  "properties": {
    "idempotency_key": { "type": "string", "minLength": 1 },
    "is_replay": {
      "type": "boolean",
      "description": "true if this response was served from the idempotency cache."
    }
  },
  "additionalProperties": false
}
```
**Files to modify**: `campaign_init_result_v1.schema.json`, `campaign_status_v1.schema.json` (for topup result), `search_step_result_v1.schema.json`, `eval_result_v1.schema.json`, `ranking_result_v1.schema.json`, `promotion_result_v1.schema.json`.  
**Change**: Add `"idempotency_meta": { "$ref": "idempotency_meta_v1.schema.json" }` to `properties` and `"idempotency_meta"` to `required`.

### P6. `schemas/island_state_v1.schema.json` — Add operator observability
**File**: `schemas/island_state_v1.schema.json`  
**Change**: Add to `properties`:
```json
"active_operators": {
  "type": "array",
  "items": { "type": "string", "minLength": 1 },
  "description": "Currently active operator IDs on this island."
},
"operator_allocation_weights": {
  "type": "object",
  "additionalProperties": { "type": "number", "minimum": 0 },
  "description": "Current softmax-bandit allocation weights (operator_id → weight). Optional; omit if distributor is not yet active."
}
```

### P7. `schemas/evaluator_config_v1.schema.json` — Add `folklore_risk_threshold`
**File**: `schemas/evaluator_config_v1.schema.json`  
**Change**: Add to `properties`:
```json
"folklore_risk_threshold": {
  "type": "number",
  "minimum": 0,
  "maximum": 1,
  "default": 0.7,
  "description": "Folklore risk score above which the node must be routed to A0-folklore human adjudication."
}
```

### P8. `schemas/idea_card_v1.schema.json` — Add `conclusion_type` for negative results
**File**: `schemas/idea_card_v1.schema.json`  
**Change**: Add to `properties` (not `required`, to maintain backward compatibility):
```json
"conclusion_type": {
  "enum": ["positive", "negative", "inconclusive"],
  "default": "positive",
  "description": "Whether this idea represents a constructive proposal (positive), a definitive exclusion/no-go result (negative), or an open question (inconclusive). Negative results are valuable for pruning future search."
}
```

### P9. `schemas/search_step_result_v1.schema.json` — Harden the `if` conditional
**File**: `schemas/search_step_result_v1.schema.json`  
**Change**: In the `allOf` conditionals, add `"required"` to both `if` blocks:
```json
{
  "if": {
    "required": ["early_stopped"],
    "properties": { "early_stopped": { "const": true } }
  },
  "then": { "required": ["early_stop_reason"] }
},
{
  "if": {
    "required": ["new_node_ids"],
    "properties": { "new_node_ids": { "type": "array", "minItems": 1 } }
  },
  "then": { "required": ["new_nodes_artifact_ref"] }
}
```

### P10. `docs/plans/2026-02-12-idea-generator-architecture-spec.md` — Add concurrency and prompt storage policy
**File**: `docs/plans/2026-02-12-idea-generator-architecture-spec.md`  
**Section**: After §2.3 (RPC interface), add:

```markdown
### 2.4 Concurrency and Operational Policies

1. **Single-active-step per campaign**: The engine MUST serialize `search.step` calls per campaign. If a step is in progress, subsequent `search.step` calls with a *different* `idempotency_key` MUST return error `-32016 step_in_progress`. (This avoids budget races without requiring distributed locks.)

2. **Prompt snapshot storage**: For every `prompt_hash` / `prompt_snapshot_hash` recorded in `origin` / `operator_trace`, the engine MUST store the full prompt text in a campaign-scoped content-addressable store (keyed by the SHA-256 hash). This enables full replay and hallucination forensics.

3. **Grounding resolution config**: Active URI resolution (§4.2.1) MUST respect `resolution_timeout_s` (default: 10) and `max_retries` (default: 2) from `EvaluatorConfig.extensions`. URIs that fail resolution after retries are recorded as `unresolvable` in `grounding_audit.failures[]` and the audit status is set to `partial` (not `pass`).
```

### P11. `schemas/idea_core_rpc_v1.openrpc.json` — Add missing error codes
**File**: `schemas/idea_core_rpc_v1.openrpc.json`  
**Change**: Add to the `info.description` or a new top-level `"x-error-registry"`:
```json
{
  "-32001": "budget_exhausted",
  "-32002": "schema_validation_failed",
  "-32003": "campaign_not_found",
  "-32004": "node_not_found",
  "-32010": "invalid_charter",
  "-32011": "grounding_audit_failed",
  "-32012": "formalism_not_in_registry",
  "-32013": "insufficient_eval_data",
  "-32014": "node_not_in_campaign",
  "-32015": "campaign_not_active",
  "-32016": "step_in_progress"
}
```
Also add `-32002` to `rank.compute` errors and `-32016` to `search.step` errors.
