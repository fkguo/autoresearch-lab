VERDICT: NOT_READY

## Blockers

### B1. `campaign_status_v1.schema.json` missing from `idea_campaign_v1.schema.json` $ref resolution

`idea_campaign_v1.schema.json` has `"status": { "$ref": "./campaign_status_v1.schema.json" }`, but `campaign_status_v1.schema.json` is a **response envelope** (with `campaign_id`, `budget_snapshot`, `island_states`, etc.), not a bare status enum. Embedding the full `CampaignStatus v1` object inside `IdeaCampaign v1` creates a recursive/redundant nesting: `idea_campaign_v1.campaign_id` + `idea_campaign_v1.status.campaign_id` — with no uniqueness constraint preventing them from diverging. Either extract a `campaign_status_enum_v1.schema.json` (just the enum) for use inside `idea_campaign_v1`, or explicitly document which `campaign_id` is authoritative.

### B2. `campaign.topup` state-machine spec vs schema: `exhausted → running` transition is underspecified in `campaign_mutation_result_v1`

The spec says topup from `exhausted` can produce either `running` or `exhausted` (conditional on remaining budget). But `campaign_mutation_result_v1.transition` has no constraint tying `previous_status` / `current_status` to the calling method. A caller or test harness cannot **schema-validate** that the transition is legal. Add a `method` field to `transition` (or to the result), and add conditional `allOf`/`if-then` constraints in the schema enforcing the state machine per method — otherwise the "machine-enforceable" promise is hollow.

### B3. Idempotency payload-hash: default-value filling is underspecified for `campaign.init`

The spec states "optional fields: engine should do default-value filling before hashing." But `campaign.init` accepts `formalism_registry` (optional, default = DomainPack built-in). The DomainPack built-in registry is **runtime-dependent** and unknown to the caller. This makes `payload_hash` **non-reproducible on the client side** — the caller cannot verify its own hash. Either:
- Exclude `formalism_registry` from the hash when absent (document this), or
- Require the engine to echo the **effective** (post-fill) `formalism_registry` in the init result so callers can reconstruct the hash, or
- Document that client-side hash verification is best-effort for `campaign.init`.

### B4. `rank.compute` Pareto dimension minimum is inconsistent between spec and OpenRPC

The spec (§2.3 point 3) says "Pareto 要求筛选后节点数 ≥ 1（0 则 fail）" but says nothing about a minimum dimension count. The OpenRPC `rank.compute` description adds: "For method=pareto, effective dimension count MUST be >= 2; otherwise insufficient_eval_data (-32013) with error.data.reason=insufficient_dimensions." The spec document must be updated to match. Furthermore, the `rpc_error_data_v1.schema.json`'s `known_reasons` for `-32013` lists `insufficient_dimensions` but the enum on `x-error-data-contract` is informational — there's no JSON Schema enforcement linking error code to valid reasons. Consider adding an `allOf`/`if-then` or at minimum a `description` clarifying the mandatory mapping.

### B5. `eval.run` atomicity claim vs `eval_result_v1` schema: `updated_node_ids` MUST equal `node_ids` but schema doesn't enforce it

The description says "Atomicity invariant: on success, updated_node_ids MUST be set-equal to node_ids (all nodes are updated or none are)." JSON Schema 2020-12 cannot enforce set equality between two sibling arrays. This MUST be called out as a **runtime invariant that tests must verify**, not a schema-level guarantee. Currently there's no machine-readable annotation distinguishing "schema-enforced" from "runtime-enforced" invariants — add one (e.g., `x-runtime-invariants` array on the method or schema).

### B6. No `campaign_status_v1.schema.json` file listed for `campaign.status` result's `early_stop_reason` conditional

The `allOf` conditional in `campaign_status_v1.schema.json` requires `early_stop_reason` when `status=early_stopped`. Good. But no corresponding conditional exists for **forbidding** `early_stop_reason` when status ≠ `early_stopped`. A compliant engine could return `{"status": "running", "early_stop_reason": "stale_leftover"}` and pass validation. Add:
```json
{
  "if": { "properties": { "status": { "not": { "const": "early_stopped" } } } },
  "then": { "not": { "required": ["early_stop_reason"] } }
}
```
or use `"properties": { "early_stop_reason": false }` in the `then` branch.

### B7. `search_step_result_v1`: conditional `allOf` for `updated_nodes_artifact_ref` is vacuously true when `updated_node_ids` is `[]`

The condition `"if": { "properties": { "updated_node_ids": { "type": "array", "minItems": 1 } } }` will match when `updated_node_ids` is present and has ≥1 item. But `updated_node_ids` is **required** and defaults to `[]` — the `if` branch evaluates against the *schema constraint*, not the *data value*. JSON Schema `if` checks whether the data **validates** against the `if` schema. An empty array `[]` is `type: "array"` but fails `minItems: 1`, so the `if` is false and the `then` is skipped — correct behavior. However, the same pattern for `new_node_ids` has a subtlety: `new_node_ids` is `required` and could be `[]` too, yet the intent is that `new_nodes_artifact_ref` is required only when there are new nodes. **This is actually correct as-is** upon closer inspection. Removing this from blockers — but see B6 above for a real structural issue.

*(Replacing B7):*

### B7. `node.list` `limit` default value: OpenRPC `"default": 50` is informational only

OpenRPC `default` on a param schema is **not** JSON Schema `default` (which itself is only an annotation, not enforcement). The spec demands "engine MUST treat omitted limit as 50" and "strong enforce max 500." The schema has `"maximum": 500` (enforced) and `"default": 50` (not enforced). This is fine if the engine handles it, but the **idempotency payload hash** computation depends on this default filling. Document explicitly in the OpenRPC `description` that for hash purposes, absent `limit` → `50`, absent `cursor` → `null`, absent `filter` → `{}`.

## Non-blocking

### N1. `idea_node_v1.schema.json` — `revision` not present in `search_step_result_v1` or `eval_result_v1`

The `revision` field enables optimistic concurrency (per the description), but neither `search_step_result_v1.new_node_ids` nor `eval_result_v1.updated_node_ids` carry the resulting `revision`. A caller doing `node.get` after `eval.run` can observe the revision, but it requires an extra round-trip. Consider adding `node_revisions: Array<{node_id, revision}>` to `search_step_result_v1` and `eval_result_v1` to enable single-call stale detection.

### N2. `idea_selection_v1.schema.json` — `anyOf` constraint is too permissive

The `anyOf` says at least one of `selected_node_ids`, `rejected_node_ids`, or `deferred_node_ids` must have `minItems: 1`. But the outer schema also `required: ["selected_node_ids", "rejected_node_ids"]` with no `minItems` — so the following passes: `{"selected_node_ids": ["x"], "rejected_node_ids": []}`. The `anyOf` branches test individual fields but the overall validation can succeed with an empty `rejected_node_ids` because `selected_node_ids` satisfies one branch. This is *probably* intended (a selection where everything is selected and nothing rejected), but the `anyOf` complicates reasoning. Consider replacing with a prose invariant + `x-runtime-invariant`.

### N3. Elo `draw_allowed` in tournament schema but no mechanism to configure it

`idea_tournament_v1.schema.json` has `draw_allowed` but `elo_config_v1.schema.json` has no `draw_allowed` field. The tournament artifact records what happened, but there's no way for the caller to *request* draws-allowed via the RPC. If draws are always engine-decided, document that; if configurable, add to `elo_config_v1`.

### N4. `budget_snapshot_v1` — `wall_clock_s_remaining` can go stale on replay

Idempotency replay returns the first-call snapshot. For wall-clock, this is inherently stale (time has passed). The spec notes this ("调用方应显式调用 `campaign.status`") but the schema doesn't flag `wall_clock_s_remaining` as "potentially stale on replay." Consider an `x-stale-on-replay: true` annotation or a top-level `snapshot_at` timestamp on `BudgetSnapshot`.

### N5. `formalism_registry_v1` merge semantics: collision behavior is prose-only

"Caller entries take precedence on formalism_id collision" — this is not testable from the schema. Consider requiring the engine to echo the **effective merged registry** in `campaign_init_result_v1` (or a ref to the persisted artifact) so tests can verify merge behavior.

### N6. `idea_card_v1.claims[].evidence_uris` allows empty array for `llm_inference`/`assumption`

The conditional `allOf` only enforces `minItems: 1` for `literature|data|calculation|expert_consensus`. For `llm_inference`/`assumption`, `evidence_uris` can be `[]`. This is probably intentional (the inference has no backing evidence), but it means grounding audit must special-case this. Worth a brief comment in the schema.

### N7. No versioning/schema-version field on any artifact

All schemas have `$id` with `_v1` suffix, but the actual JSON objects carry no `schema_version` field. If v2 schemas are introduced, the engine/adapter has no in-band way to detect which version a given artifact conforms to. Consider a standard `"schema_version": {"const": "v1"}` field on major artifacts (`idea_node_v1`, `idea_card_v1`, `idea_handoff_c2_v1`).

### N8. `search.step` `step_budget` and global budget interaction

When `step_budget.max_steps` is set and `n_steps` is also set, which wins? The spec implies `step_budget` is a fuse on *resources* while `n_steps` is a fuse on *ticks*. But `step_budget` also has `max_steps`. If both `n_steps=10` and `step_budget.max_steps=5`, the intent is presumably `min(10, 5) = 5`. Document this explicitly.

## Real-research fit

### R1. Evidence-first provenance is genuinely strong

The `claims[]` structure with `support_type` enum + conditional `verification_plan` requirement for `llm_inference`/`assumption` is one of the best claim-level provenance schemas I've seen for AI-assisted research. The grounding audit gate (`URI active resolution` + `data consistency` + `folklore prescreening`) maps well to real HEP workflow: checking INSPIRE hits, PDG values, and avoiding folklore rediscovery.

### R2. Multi-island evolution + Team/Role topology is research-appropriate

The mapping of `island_id` to both a search strategy population and a team composition is a natural fit for theoretical physics research where different "schools of thought" (perturbative vs lattice vs effective field theory) explore in parallel. The repopulate/migrate mechanism maps to cross-pollination between research groups.

### R3. Operator families are well-chosen for HEP

`AnomalyAbduction`, `SymmetryOperator`, `LimitExplorer` are not just generic creativity heuristics — they correspond to actual reasoning patterns in theoretical physics (Kuhn's anomaly-driven paradigm shifts, Noether's theorem exploitation, RG flow analysis). The `CrossDomainAnalogy` operator with mandatory mapping table + kill criteria is a critical safety mechanism against "hand-wavy analogies."

### R4. The Explain-Then-Formalize pipeline addresses a real failure mode

In practice, LLM-generated research ideas fail most often at the "sounds plausible but is actually vacuous" stage. The two-stage `RationaleDraft → IdeaCard` with `thesis_statement.minLength: 20`, `testable_hypotheses.minItems: 1`, and `minimal_compute_plan` with difficulty estimates creates real friction against vacuous ideation.

### R5. Gap: no explicit representation of "negative results" or "dead ends"

Real research campaigns generate many dead ends that are informative. The current `IdeaNode` can be evaluated and scored low, but there's no first-class `dead_end_reason` or `lessons_learned` field that could feed back into future campaigns or seed generation. This matters for HEP where knowing "this approach fails because of X" is itself a publishable result.

## Robustness & safety

### S1. Hallucination mitigation is architecturally sound

The layered defense is: (1) `RationaleDraft.kill_criteria` forces early falsifiability thinking, (2) `IdeaCard.claims[].support_type` forces provenance categorization, (3) grounding audit forces URI resolution, (4) `Checker` role in clean-room provides independent verification. This is a real four-layer defense, not theater.

### S2. Budget circuit breaker is well-designed but missing one case

The degradation order is good (`reduce_eval_rounds → reduce_islands → disable_cross_domain → reduce_population → early_stop`). Missing: what happens if the engine is **mid-LLM-call** when budget is exhausted? The spec says "立即终止所有 pending" but doesn't specify whether partial LLM responses are discarded or saved. For reproducibility/auditability, partial responses should be **saved but flagged** (e.g., `origin.truncated=true`).

### S3. Idempotency design is thorough but the consistency guarantee is implementation-challenging

"副作用与 idempotency record 处于同一逻辑提交" requires either a transactional store or careful two-phase handling. For the v0.x JSONL backend, this means either: (a) write to a single JSONL file atomically (rename-on-commit), or (b) accept that crash-recovery may have inconsistencies and add a startup reconciliation step. The spec should acknowledge this and recommend a minimal implementation strategy.

### S4. Clean-room evaluator isolation is a genuine safety property

Requiring evaluators to not share drafts until structured debate is triggered prevents groupthink — a real problem when multiple LLM instances are from the same model family and tend to agree. The `debate_threshold` on score divergence is the right trigger mechanism.

### S5. Missing: rate limiting on formalism registry lookups

If `candidate_formalisms[]` references are validated against the registry at `node.promote` time, and the registry is provided at `campaign.init`, there's no protection against a malformed registry with thousands of entries being merged. Add `maxItems` to `formalism_registry_v1.entries`.

## Specific patch suggestions

### P1. `schemas/campaign_status_v1.schema.json` — Forbid `early_stop_reason` when not `early_stopped`

```json
// ADD to the existing allOf array:
{
  "if": {
    "properties": { "status": { "not": { "const": "early_stopped" } } },
    "required": ["status"]
  },
  "then": {
    "properties": { "early_stop_reason": false }
  }
}
```

### P2. `schemas/idea_campaign_v1.schema.json` — Replace inline $ref to CampaignStatus with a status enum

Replace:
```json
"status": { "$ref": "./campaign_status_v1.schema.json" }
```
With:
```json
"status": { "enum": ["running", "paused", "early_stopped", "exhausted", "completed"] },
"early_stop_reason": { "type": "string" }
```
Or create a new `schemas/campaign_status_enum_v1.schema.json` containing just the enum, and reference that.

### P3. `schemas/campaign_mutation_result_v1.schema.json` — Add `method` to `transition`

```json
"transition": {
  "type": "object",
  "required": ["method", "previous_status", "current_status", "changed", "exhausted_dimensions_after"],
  "properties": {
    "method": { "enum": ["campaign.topup", "campaign.pause", "campaign.resume", "campaign.complete"] },
    // ... existing fields
  }
}
```

### P4. `schemas/budget_snapshot_v1.schema.json` — Add `snapshot_at` timestamp

```json
"snapshot_at": {
  "type": "string",
  "format": "date-time",
  "description": "Timestamp when this snapshot was captured. CRITICAL for idempotency replay: on replay, this is the original capture time, not 'now'."
}
```
Add to `required` array.

### P5. `schemas/idea_node_v1.schema.json` — Add `dead_end` metadata

```json
"dead_end": {
  "oneOf": [
    { "type": "null" },
    {
      "type": "object",
      "required": ["reason", "lessons", "timestamp"],
      "properties": {
        "reason": { "type": "string", "minLength": 1 },
        "lessons": { "type": "array", "items": { "type": "string", "minLength": 1 } },
        "kill_criterion_triggered": { "type": "string" },
        "timestamp": { "type": "string", "format": "date-time" }
      },
      "additionalProperties": false
    }
  ]
}
```

### P6. `schemas/elo_config_v1.schema.json` — Add `draw_allowed`

```json
"draw_allowed": {
  "type": "boolean",
  "default": false,
  "description": "Whether the tournament judge may declare draws. Must match the tournament artifact's draw_allowed field."
}
```

### P7. `schemas/formalism_registry_v1.schema.json` — Add `maxItems` safety bound

```json
"entries": {
  "type": "array",
  "minItems": 1,
  "maxItems": 1000,
  // ... rest unchanged
}
```

### P8. `schemas/idea_core_rpc_v1.openrpc.json` — `search.step` description: clarify `n_steps` vs `step_budget.max_steps` interaction

Add to `search.step.description`:
```
"Step count semantics: n_steps bounds the number of ticks; step_budget bounds resource consumption. When both n_steps and step_budget.max_steps are provided, the engine MUST stop at min(n_steps, step_budget.max_steps) ticks. step_budget.max_steps is redundant with n_steps but exists for uniform budget-fuse ergonomics."
```

### P9. `schemas/campaign_init_result_v1.schema.json` — Echo effective formalism registry

Add:
```json
"effective_formalism_registry_ref": {
  "type": "string",
  "format": "uri",
  "description": "Artifact ref to the persisted merged formalism registry (DomainPack defaults + caller overrides). Enables client-side verification of merge semantics and payload_hash reconstruction."
}
```
Add to `required`.

### P10. `docs/plans/2026-02-12-idea-generator-architecture-spec.md` — §2.3 point 3: Add Pareto dimension minimum

After "Pareto 要求筛选后节点数 ≥ 1（0 则 fail）" add:
```
此外 Pareto 还要求有效评分维度数 ≥ 2（<2 则返回 `insufficient_eval_data`，`error.data.reason=insufficient_dimensions`）；单维度排名应使用 `elo` 或其它方法。
```

### P11. `schemas/idea_node_v1.schema.json` — Add `schema_version`

Add to `required` and `properties`:
```json
"schema_version": {
  "const": "v1",
  "description": "In-band schema version for forward compatibility."
}
```
Apply the same pattern to `idea_card_v1`, `idea_handoff_c2_v1`, and other SSOT artifacts.

### P12. `docs/plans/2026-02-12-idea-generator-architecture-spec.md` — §2.3 Idempotency: document hash-excluded fields for `campaign.init`

Add after the payload_hash description:
```
对 `campaign.init`：由于 `formalism_registry` 省略时引擎会使用 DomainPack 默认值（运行时相关），`payload_hash` 的计算范围为调用方实际传入的 params（不含 `idempotency_key`），**不做 formalism_registry 默认值填充**。引擎在首次执行时必须记录 `payload_hash`；后续 duplicate hit 时仅比对 `payload_hash`，不重新解析 DomainPack。
```
