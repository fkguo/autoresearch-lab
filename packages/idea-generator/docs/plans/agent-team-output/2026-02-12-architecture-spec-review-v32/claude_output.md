VERDICT: NOT_READY

## Blockers

### B1. `campaign_mutation_result_v1.schema.json` — `allOf` constraint for `pause` is too strict and contradicts spec

The spec (§2.4) says `campaign.pause` is permitted from `running|early_stopped|exhausted`. The `allOf` block constraining `mutation=pause` forces `transition.changed=true`. But per the idempotency contract, a duplicate-hit replay of `campaign.pause` must return the same response—which would have `changed=true`—yet the campaign is *already* paused. This is technically consistent (replay returns the *first* response), but creates a subtle problem: there is no schema path for a "pause while already paused" scenario. If someone calls `campaign.pause` when already `paused`, the spec says `campaign_not_active`—but the spec *doesn't explicitly list `paused` as a rejected source state for `campaign.pause`*. The allowed sources are `running|early_stopped|exhausted`, so `paused → paused` should be rejected, which is correct. However, the *error case* is not covered by the schema (errors don't go through `campaign_mutation_result`), so this is borderline acceptable. **But**: the `previous_status` enum for `pause` is `["running", "early_stopped", "exhausted"]`, which is correct, yet the `current_status` is constrained to `const: "paused"` — this means the schema asserts the transition always succeeds. If the engine implements the state machine correctly this is fine, but there's a **real blocker**: what about `campaign.pause` from `exhausted` followed by a status priority conflict? The spec says `exhausted` can be paused, but `current_status` is forced to `paused`. This seems intentional per spec. OK — this specific point is actually consistent on close reading.

**Actual Blocker**: The `campaign.pause` from `exhausted` state means the campaign transitions to `paused`, but the spec says side-effecting RPCs in `paused` must return `campaign_not_active`. Then `campaign.topup` is allowed in `paused`—but `campaign.resume` from `paused` checks budget. If budget is still zero (topup hasn't happened), `campaign.resume` returns `budget_exhausted`. This flow works. **Withdrawing this as blocker.**

### B1 (revised). `rank.compute` — Pareto minimum node count is 1, but minimum dimension count is underconstrained in schema

The spec says Pareto requires `≥ 1 node` (§2.3 point 3), and the OpenRPC description says "effective dimension count MUST be >= 2". However, the `rank.compute` method's `dimensions` param schema allows `minItems: 1`. When `dimensions` is explicitly provided with only 1 item and `method=pareto`, the engine must reject — but there is **no schema-level enforcement** of the `dimensions.minItems >= 2` for Pareto. This is a runtime-only check. The problem: the OpenRPC method does not have a conditional schema constraint (`if method=pareto then dimensions.minItems=2`). This means a caller can submit a schema-valid request that must fail at runtime, and the only protection is the engine's runtime logic plus the prose description. 

**Severity**: Moderate blocker. Adding an `allOf` conditional to the method params would make this machine-enforceable at the schema level.

### B2. `search_step_result_v1` — `n_steps_executed: minimum: 0` allows a successful response with zero work done

If the engine returns a success (not an error) with `n_steps_executed=0` and `early_stopped=false`, that's a semantic contradiction (you requested ≥1 steps, got success with 0 steps and no early stop). The schema should enforce: `n_steps_executed >= 1 OR early_stopped == true`. Without this, an implementation could return a vacuous success.

**Fix**: Add an `allOf` conditional: `if n_steps_executed == 0, then early_stopped must be true`.

### B3. `eval_result_v1` — Missing `campaign_status` field (inconsistent with other mutation results)

`campaign.topup`, `campaign.pause`, `campaign.resume`, `campaign.complete` all return `campaign_status` embedded in `campaign_mutation_result`. But `eval.run` and `search.step` and `rank.compute` (all side-effecting) only return `budget_snapshot` — **not** the campaign status. If `eval.run` triggers a budget exhaustion and the campaign transitions `running → exhausted`, the caller has no way to learn the new campaign status from the response alone. They must make a separate `campaign.status` call.

This is at minimum an observability gap. For `search.step`, the spec mentions campaign status transitions as side-effects, but the result schema has no `campaign_status` field either. The adapter must always follow up with `campaign.status`, which adds latency and is error-prone.

**Fix**: Add optional `campaign_status` (enum) field to `search_step_result_v1`, `eval_result_v1`, and `ranking_result_v1` — at least as an optional field for observability.

### B4. `idea_card_v1` — `candidate_formalisms` pattern enforcement creates DX hazard with no escape hatch

The `pattern: "^[a-z0-9_-]+\\/[a-z0-9_.-]+$"` is a hard constraint in JSON Schema. If a DomainPack wants to use a formalism ID with uppercase letters, spaces, or other characters (e.g., `HEP-ph/ChPT.v2`), schema validation rejects it outright. The `formalism_registry_v1` has the same pattern constraint, so they're consistent — but this is a **naming convention baked into schema** with no escape. If you need to extend to other domains (e.g., `CondMat/BCS_theory`), the uppercase `C` fails.

**Fix**: Either relax the pattern to allow uppercase, or document this as a deliberate lowercase-slug convention with normalization rules.

### B5. Idempotency key conflict detection — no schema enforcement that `payload_hash` is returned on conflict errors

The spec says "engine must return `schema_validation_failed` with `error.data.reason=idempotency_key_conflict`". The `rpc_error_data_v1.schema.json` has `payload_hash` as optional. For `idempotency_key_conflict` errors specifically, the `payload_hash` of both the stored and incoming request should be returned to help the caller debug, but the schema has no conditional requiring it. This makes debugging key conflicts harder.

**Fix**: Add an `allOf` conditional in `rpc_error_data_v1.schema.json`: if `reason=idempotency_key_conflict`, require `payload_hash` and add a `stored_payload_hash` field.

## Non-blocking

### N1. `budget_snapshot_v1` — `wall_clock_s_remaining` is inherently non-reproducible in idempotency replay

The spec acknowledges replay returns "first-call snapshot" values, but `wall_clock_s_remaining` from the first call is nearly guaranteed to be stale/misleading on replay. Consider adding a documentation annotation in the schema (not just the spec prose) warning that this field is snapshot-time, not current-time.

### N2. `idea_node_v1` — No `tags` or `labels` field for lightweight classification

The `seed_pack_v1` has `tags`, but `IdeaNode` has none. During search, operators or roles may want to tag nodes with lightweight metadata (e.g., `["anomaly-driven", "BSM", "one-loop"]`) for filtering in `node.list`. Currently `node.list` filter has no tags-based filtering either. Consider adding an optional `tags` array to `idea_node_v1` and a `tags` filter to `idea_list_filter_v1`.

### N3. `evaluator_config_v1` — `weights` keys are unconstrained strings

The `weights` field uses `additionalProperties: { "type": "number" }` but doesn't constrain keys to match `dimensions`. A caller could provide `weights: {"novelty": 2, "typo_field": 1}` and it would pass schema validation. Consider either: (a) documenting that unrecognized keys are ignored, or (b) constraining `propertyNames` to the dimension enum.

### N4. `idea_tournament_v1` — `draw_allowed` has a default but `winner_node_id` is always required

If `draw_allowed=false`, `winner_node_id` should never be `null`, but the match schema allows `null` unconditionally. Add a conditional: `if draw_allowed=false, then matches[].winner_node_id must not be null`.

### N5. `campaign_charter_v1` — No `version` or `schema_version` field

For evolution. Currently the charter has no way to indicate which version of the charter schema it conforms to. Consider adding `"schema_version": { "const": "1" }`.

### N6. OpenRPC document — `x-error-data-contract.known_reasons` lists reasons for `-32013` but the error code `-32013` is not formally declared in any method's `errors` array except `rank.compute`

If `eval.run` or other methods could theoretically fail with `insufficient_eval_data`, they should declare it. Currently only `rank.compute` lists `-32013`. This is fine if the spec intends this, but it's worth confirming.

### N7. `budget_topup_v1` — Inconsistent minimum constraints

`add_tokens` has `minimum: 1` (inclusive), but `add_cost_usd` has `exclusiveMinimum: 0`. This means you can't top up by exactly $0 (correct) but the difference in constraint style (`minimum: 1` vs `exclusiveMinimum: 0`) is inconsistent. For integers, `minimum: 1` and `exclusiveMinimum: 0` are semantically equivalent, but for floats (`add_cost_usd`), `exclusiveMinimum: 0` allows e.g. $0.001. Consider documenting the intent or unifying.

### N8. `node_mutation_log_v1` — No upper bound on `mutations` array size

For a step that mutates many nodes, this could be unbounded. Consider `maxItems` or a note about chunking.

### N9. Missing schema: `idea_candidates_v1.jsonl` format

Section 5.2 describes the `idea_candidates_v1.jsonl` format but there's no corresponding JSON Schema for validation of individual lines. Since each line is an `IdeaNode`, the existing `idea_node_v1.schema.json` covers it, but this should be explicitly noted.

### N10. `campaign_init_result_v1` — `seed_pack_ref` is missing

`campaign.init` accepts a `seed_pack` but the result doesn't return a `seed_pack_ref` (artifact URI). The `idea_campaign_v1.schema.json` has `seed_pack_ref` — the init result should also surface it so the caller can verify storage.

## Real-research fit

**Strengths:**

1. **Evidence-first rigor is real**: The grounding audit gate with active URI resolution, the claim-level provenance in `IdeaCard`, and the `folklore_risk_score` are exactly what's needed to prevent LLM hallucination from propagating into research pipelines. This is the most important design decision and it's done right.

2. **Operator taxonomy maps to actual physics methodology**: The operator families (`AnomalyAbduction`, `SymmetryOperator`, `LimitExplorer`, `RepresentationShift`) correspond to how theoretical physicists actually work. The `CrossDomainAnalogy` operator with mandatory mapping table + invariants + kill criteria is particularly well-designed — it prevents vague "analogy by vibes."

3. **The Explain-Then-Formalize two-stage pipeline** mirrors real research practice (sketch → formalize) and prevents premature commitment to a formal structure before the idea is understood.

4. **Multi-island evolution with stagnation detection** is a good fit for the HEP theory landscape, where different theoretical approaches to the same anomaly often need to be explored in parallel (e.g., BSM model-building vs. QCD corrections vs. experimental systematics re-analysis).

5. **The `novelty_delta_table` with `non_novelty_flags`** addresses a real failure mode in AI-assisted research: generating ideas that look novel but are actually parameter tuning or reformulation.

**Concerns for real use:**

1. The architecture assumes that grounding audit URI resolution can be done quickly and cheaply. In practice, INSPIRE API rate limits, DOI resolution failures, and HEPData downtime could make this a bottleneck. Consider adding a `grounding_audit.resolution_timeout_s` config and a `degraded` status (partially resolved).

2. The `minimal_compute_plan` with `estimated_difficulty` and `estimated_compute_hours_log10` is great for tractability assessment, but HEP calculations can be wildly misjudged (a "straightforward" one-loop calculation can turn into a research project when IR divergences appear). The `blockers` field partially addresses this but could benefit from a `known_complications` field that maps to common HEP pitfalls (e.g., "IR sensitivity", "gauge dependence", "renormalization scheme ambiguity").

3. The Team/Role model is sensible but the `Derivation` role's scope ("symmetry/dimension/limit/consistency quick check") is vague. In practice, this role needs access to CAS tools (FeynCalc, Mathematica) to be useful beyond dimensional analysis. The `hep-calc` skill integration should be explicitly mentioned as the execution backend for this role.

## Robustness & safety

1. **Hallucination mitigation is strong**: The active URI resolution, `support_type` taxonomy with mandatory `verification_plan` for LLM inferences, and the grounding audit gate provide defense-in-depth. The requirement that `folklore_risk_score > threshold` triggers human review is the right safety valve.

2. **Budget safety is well-designed**: The multi-dimensional budget envelope with degradation order, step-level fuses, and the circuit breaker pattern prevent runaway costs. The `wall_clock_s` dimension is important for preventing hung LLM calls from consuming resources indefinitely.

3. **Idempotency is thorough**: The JCS canonicalization + `payload_hash` approach is the right way to detect key conflicts. The requirement for atomic idempotency record + side-effect commits prevents the most dangerous failure mode (partial writes without deduplication protection).

4. **Campaign isolation is well-specified**: The `campaign_id` scoping on all RPCs with `node_not_in_campaign` enforcement prevents cross-campaign contamination.

5. **Missing safety concern: LLM prompt injection through seed content**. The `seed_pack_v1` accepts arbitrary `content` strings. If a seed is sourced from a KB or user input, malicious content could manipulate operator prompts. Consider adding a `content_sanitized` boolean or a content validation step in the seed ingestion path.

6. **Missing safety concern: Unbounded `extensions` fields**. Nearly every schema has `"extensions": { "type": "object", "additionalProperties": true }`. These are necessary for extensibility but create an attack surface for schema-bypassing data injection. Consider adding `maxProperties` limits or at minimum a documentation note that `extensions` content must not be used for security-critical decisions.

7. **Tick atomicity under LLM failure**: The spec requires each tick to be all-or-nothing, but LLM calls are inherently fallible (rate limits, timeouts, content filtering). The rollback mechanism for a partially-completed tick (e.g., Ideator succeeded but Checker timed out) is not specified. Implementors need guidance: retry the whole tick? Mark it as failed and move on? This should be in the spec.

## Specific patch suggestions

### Patch 1: `schemas/search_step_result_v1.schema.json` — Enforce non-vacuous success

**File**: `schemas/search_step_result_v1.schema.json`  
**Change**: Add to the `allOf` array:
```json
{
  "if": {
    "properties": { "n_steps_executed": { "const": 0 } },
    "required": ["n_steps_executed"]
  },
  "then": {
    "required": ["early_stopped"],
    "properties": { "early_stopped": { "const": true } }
  }
}
```

### Patch 2: `schemas/search_step_result_v1.schema.json` + `schemas/eval_result_v1.schema.json` + `schemas/ranking_result_v1.schema.json` — Add campaign status echo

**File**: `schemas/search_step_result_v1.schema.json`  
**Change**: Add optional property:
```json
"campaign_status_after": {
  "enum": ["running", "paused", "early_stopped", "exhausted", "completed"],
  "description": "Campaign status after this operation completed (snapshot). Enables callers to detect status transitions (e.g., running → exhausted) without a separate campaign.status call."
}
```
Apply the same addition to `eval_result_v1.schema.json` and `ranking_result_v1.schema.json`.

### Patch 3: `schemas/rpc_error_data_v1.schema.json` — Require `payload_hash` on idempotency conflicts

**File**: `schemas/rpc_error_data_v1.schema.json`  
**Change**: Add to `allOf` array:
```json
{
  "if": {
    "properties": { "reason": { "const": "idempotency_key_conflict" } },
    "required": ["reason"]
  },
  "then": {
    "required": ["payload_hash", "details"],
    "properties": {
      "details": {
        "type": "object",
        "required": ["stored_payload_hash"],
        "properties": {
          "stored_payload_hash": {
            "type": "string",
            "pattern": "^sha256:[a-f0-9]{64}$",
            "description": "Payload hash of the original (stored) request, to help callers diagnose which request won."
          }
        },
        "additionalProperties": true
      }
    }
  }
}
```

### Patch 4: `schemas/idea_card_v1.schema.json` + `schemas/formalism_registry_v1.schema.json` — Relax pattern to allow mixed case

**Files**: `schemas/idea_card_v1.schema.json`, `schemas/formalism_registry_v1.schema.json`  
**Change**: Replace `"pattern": "^[a-z0-9_-]+\\/[a-z0-9_.-]+$"` with:
```json
"pattern": "^[a-zA-Z0-9_-]+\\/[a-zA-Z0-9_.-]+$"
```
Or alternatively, add a normalization rule in the spec that all formalism IDs are lowercased on ingestion, and keep the current pattern. Either way, document the decision.

### Patch 5: `schemas/campaign_init_result_v1.schema.json` — Add `seed_pack_ref`

**File**: `schemas/campaign_init_result_v1.schema.json`  
**Change**: Add property:
```json
"seed_pack_ref": {
  "type": "string",
  "format": "uri",
  "description": "Artifact URI for the persisted seed pack."
}
```
And add `"seed_pack_ref"` to `required`.

### Patch 6: `schemas/idea_node_v1.schema.json` — Add `tags` field

**File**: `schemas/idea_node_v1.schema.json`  
**Change**: Add optional property:
```json
"tags": {
  "type": "array",
  "items": { "type": "string", "minLength": 1 },
  "description": "Lightweight classification tags for filtering and search (e.g., ['anomaly-driven', 'BSM', 'one-loop'])."
}
```
**File**: `schemas/idea_list_filter_v1.schema.json`  
**Change**: Add optional property:
```json
"tags_any": {
  "type": "array",
  "items": { "type": "string", "minLength": 1 },
  "description": "Match nodes having any of the specified tags."
}
```

### Patch 7: `schemas/idea_core_rpc_v1.openrpc.json` — Add conditional dimension enforcement for `rank.compute`

**File**: `schemas/idea_core_rpc_v1.openrpc.json`  
**Change**: In the `rank.compute` method's `dimensions` param, add to the description:
```
"Implementation note: when method=pareto and dimensions is explicitly provided, engines MUST validate minItems >= 2 at request parsing time (before hitting the store), returning schema_validation_failed with reason=insufficient_dimensions if violated."
```
Better yet, split `dimensions` into two schemas conditionally selected by `method`, but that's harder in OpenRPC. At minimum, add this to the spec prose in §6.3.

### Patch 8: `docs/plans/2026-02-12-idea-generator-architecture-spec.md` — Add tick failure/rollback guidance

**File**: `docs/plans/2026-02-12-idea-generator-architecture-spec.md`  
**Change**: After the tick atomicity paragraph in §2.3 point 3 (the `search.step` semantics block), add:

```markdown
**Tick failure recovery (MUST)**: If any sub-operation within a tick fails (e.g., LLM timeout, tool error, content filter rejection), the engine MUST roll back all writes from that tick (including any partially-created nodes/artifacts). The tick counts as "not executed" (not reflected in `n_steps_executed` or `BudgetSnapshot.steps_used`). The engine MAY retry the failed tick internally (implementation-defined retry budget), but MUST NOT expose partial tick results to the caller. If the engine exhausts its internal retry budget for a tick, it SHOULD proceed to the next tick (if `n_steps_executed < n_steps_requested`) or return with `n_steps_executed` reflecting only successfully completed ticks.
```

### Patch 9: `schemas/idea_tournament_v1.schema.json` — Conditional draw enforcement

**File**: `schemas/idea_tournament_v1.schema.json`  
**Change**: Add to `allOf` (or create one):
```json
"allOf": [
  {
    "if": {
      "properties": { "draw_allowed": { "const": false } },
      "required": ["draw_allowed"]
    },
    "then": {
      "properties": {
        "matches": {
          "items": {
            "properties": {
              "winner_node_id": { "type": "string", "format": "uuid" }
            }
          }
        }
      }
    }
  }
]
```
This ensures `winner_node_id` cannot be `null` when draws are disallowed.

### Patch 10: `schemas/campaign_status_v1.schema.json` — Add `exhausted_dimensions`

**File**: `schemas/campaign_status_v1.schema.json`  
**Change**: Add optional property for observability:
```json
"exhausted_dimensions": {
  "type": "array",
  "description": "Budget dimensions currently at zero remaining (for adapter decision-making without parsing budget_snapshot).",
  "items": { "enum": ["tokens", "cost_usd", "wall_clock_s", "steps", "nodes"] }
}
```
And add conditional: if `status=exhausted`, then `exhausted_dimensions` is required with `minItems: 1`.
