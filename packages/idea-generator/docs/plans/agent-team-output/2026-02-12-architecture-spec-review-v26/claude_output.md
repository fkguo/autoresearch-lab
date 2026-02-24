VERDICT: NOT_READY

## Blockers

### B1. `campaign_status_v1.schema.json` missing `"completed"` → `"completed"` no-op guard in schema

The spec (§2.4) states `campaign.complete` on an already-completed campaign is a no-op. The `campaign_mutation_result_v1.schema.json` `transition.previous_status` allows `"completed"`, which is correct. However, the OpenRPC `campaign.complete` description says "SHOULD treat this as a no-op" — this **MUST** be elevated to **MUST** for idempotency consistency (a SHOULD leaves room for implementations to reject, breaking the state-machine contract).

### B2. `eval.run` atomicity claim contradicts `eval_result_v1` `updated_node_ids` schema

The spec says "updated_node_ids MUST be set-equal to node_ids on success" (good), but `eval_result_v1.schema.json` does not enforce this with a JSON Schema constraint. More critically, the atomicity invariant ("no partial writes on error") means any error should result in `updated_node_ids = []`, but the error path returns a JSON-RPC error (no result). This is **fine semantically**, but the schema description should explicitly state that `updated_node_ids` only appears in the **success** result. Currently the description could mislead an implementer into thinking partial-write results are possible.

*Impact: implementers may build partial-write logic expecting `updated_node_ids ⊂ node_ids`.*

### B3. `search_step_result_v1` `allOf` conditional for `updated_nodes_artifact_ref` is logically wrong

The third `allOf` entry:
```json
{
  "if": { "properties": { "updated_node_ids": { "type": "array", "minItems": 1 } }, "required": ["updated_node_ids"] },
  "then": { "required": ["updated_nodes_artifact_ref"] }
}
```
The `if` block tests `"type": "array"` and `"minItems": 1`, but `updated_node_ids` is **already required** and already typed as `array` in the top-level `required`/`properties`. The `if` condition will **always** match when `updated_node_ids` is present (even if empty, since `"type": "array"` passes for `[]`). The `minItems: 1` in an `if` does **not** act as a conditional guard in JSON Schema Draft 2020-12 the way you'd expect — it validates true only when the instance satisfies the subschema. An empty array `[]` fails `minItems: 1`, so the `if` would be false, and the `then` wouldn't apply. Actually — re-checking: in JSON Schema, `if` evaluates the subschema against the instance. If `updated_node_ids` is `[]`, then `{ "properties": { "updated_node_ids": { "minItems": 1 } } }` fails because `[].length < 1`, so `if` is false → `then` doesn't apply. This is actually correct behavior.

**However**, the same logic for `new_node_ids` (second `allOf`) has the same pattern and is correct. I retract the "logically wrong" claim after re-analysis. The conditionals are correct. *(Leaving this note for transparency — the pattern is subtle but valid.)*

### B3 (revised). `idea_node_v1` missing `version` or `etag` field for mutation observability

The spec (§2.3.1) acknowledges single-writer-per-campaign in v0.x and hints at `expected_version` for v1.0+. But the `idea_node_v1.schema.json` has **no version/revision counter**, making it impossible to:
1. Detect stale reads after mutation (consumer sees `updated_at` but can't distinguish "I already saw this update" from "new update")
2. Build optimistic concurrency later without a schema-breaking change

**This is a blocker** because `node_mutation_log_v1` lists `mutated_fields` but consumers can't correlate log entries to the node's current state without a monotonic revision.

### B4. `rank.compute` for `method=pareto` missing minimum-dimensions constraint

The spec says Pareto requires ≥1 node, but **Pareto front computation requires scores on ≥2 dimensions** to be meaningful (otherwise it degenerates to a simple sort). Neither the OpenRPC description nor `evaluator_config_v1.schema.json` enforces this. An implementation could silently compute a "Pareto front" on 1 dimension, which is semantically wrong.

### B5. `campaign.topup` on `early_stopped` state: spec vs OpenRPC description inconsistency

Spec §2.4 says: `campaign.topup` on `early_stopped` → `(same state)` (i.e., stays `early_stopped`).
OpenRPC `campaign.topup` description says: "If status is early_stopped (policy halt, not budget), topup adds budget but does NOT change the status".

These are consistent. **However**, the `campaign_mutation_result_v1.schema.json` `transition.current_status` enum does not include any validation that `current_status` must match the state-machine transitions. An engine could return `transition: {previous_status: "early_stopped", current_status: "running"}` after a topup, violating the spec but passing schema validation. The transition object needs tighter conditional constraints or at minimum a normative note that `current_status` must obey the state machine.

### B6. No `campaign.init` error for empty formalism registry after merge

The OpenRPC says: "The merged registry MUST be non-empty; otherwise campaign.init MUST fail with schema_validation_failed." But `formalism_registry_v1.schema.json` already has `"minItems": 1` on `entries`. If the caller omits `formalism_registry` entirely and the DomainPack built-in is empty, the schema validation passes (because the param is optional and absent). The engine needs runtime validation beyond schema — which is fine, but the **error code should be a dedicated one** (e.g., `empty_formalism_registry`) rather than overloading `schema_validation_failed`, because the schema itself didn't fail.

### B7. `idea_card_v1` `claims[].evidence_uris` allows empty array for `literature`/`data`/`calculation`/`expert_consensus`

The `allOf` conditional:
```json
{
  "if": { "properties": { "support_type": { "enum": ["literature", "data", "calculation", "expert_consensus"] } } },
  "then": { "properties": { "evidence_uris": { "minItems": 1 } } }
}
```
This is correct — it requires ≥1 URI for those support types. **But**: the `then` only sets `minItems` on the property; it doesn't add `evidence_uris` to `required`. Since `evidence_uris` is already in the top-level `required`, this is fine. *(Verified: no blocker here — retracting.)*

### B7 (revised). `budget_snapshot_v1` `steps_remaining` and `nodes_remaining` use `oneOf` with `null` but `tokens_remaining` / `cost_usd_remaining` / `wall_clock_s_remaining` do not

`max_steps` and `max_nodes` are optional in `BudgetEnvelope`, so their `_remaining` fields correctly allow `null`. But `max_tokens`, `max_cost_usd`, `max_wall_clock_s` are **required** in `BudgetEnvelope`, so their remaining fields are always integers/numbers — this is consistent. No blocker. *(Retracting.)*

### B7 (final). `idea_tournament_v1` `winner_node_id` allows draws?

The tournament match schema requires `winner_node_id` but provides no mechanism for draws/ties. In Elo tournaments, draws are a standard outcome (half-point). The schema **must** support draws or explicitly state they're not allowed (which constrains the judge implementation).

---

**Confirmed blockers:**
1. **B1**: `campaign.complete` no-op SHOULD→MUST
2. **B3r**: `idea_node_v1` missing `version`/`revision` field
3. **B4**: Pareto minimum-dimensions constraint missing
4. **B5**: `transition` object lacks state-machine enforcement
5. **B7f**: `idea_tournament_v1` no draw support

## Non-blocking

### N1. `idea_list_filter_v1` missing score/eval-based filters
The filter has `has_idea_card` and `grounding_status` but no way to filter by eval scores (e.g., "nodes with novelty > X" or "nodes with any eval_info"). For `rank.compute`'s filter use case, this means you can't easily select "nodes that have been evaluated" — the engine must infer this internally. Add `has_eval_info: boolean` and optionally `min_score: {dimension: string, value: number}`.

### N2. `evaluator_config_v1` `weights` keys are not constrained to match `dimensions`
`weights` uses `additionalProperties: { "type": "number" }` but doesn't validate that keys ∈ `dimensions`. A caller can supply `weights: { "creativity": 0.5 }` with `dimensions: ["novelty"]` — no schema error.

### N3. `budget_topup_v1` all fields use `minimum: 1` or `exclusiveMinimum: 0`, but `add_tokens` uses `minimum: 1` while `add_cost_usd` uses `exclusiveMinimum: 0`
This is intentionally correct (tokens are integers, cost is float), but the asymmetry is subtle. A brief `$comment` would prevent confusion.

### N4. `idea_evidence_graph_v1` node `id` is `string` but `idea_node_v1` uses `uuid`
The evidence graph uses generic `id: string` for nodes (which can be claims, evidence, or idea_nodes). When `kind=idea_node`, the `id` should match the `node_id` format (uuid). Consider adding a conditional: if `kind=idea_node`, `id` must be `format: uuid`.

### N5. `rationale_draft_v1` missing `operator_id` / `island_id` back-reference
The rationale draft is embedded in `idea_node_v1` which provides context, but if the draft is stored as a standalone artifact (the spec mentions "or its artifact reference"), consumers lose the operator/island context. Add optional `operator_id` and `island_id` fields.

### N6. `campaign_charter_v1` `search_policy_id` and `team_policy_id` are optional but referenced in §3.2/§3.4 as required for execution
If both are omitted, the engine must have defaults. The schema should either make them required or document the default behavior.

### N7. `node_mutation_log_v1` mutations lack `mutation_type` enum
`mutated_fields` tells you *what* changed but not *how* (append vs replace vs delete). For audit replay, knowing the mutation type is critical. Add `mutation_type: enum ["set", "append", "clear"]`.

### N8. OpenRPC `x-error-data-contract` is a custom extension not validated by OpenRPC tooling
This is fine as documentation but won't be enforced by standard OpenRPC validators. Consider also adding error schemas to each method's `errors` array using the `data` field (supported in OpenRPC error objects).

### N9. `search_step_result_v1` `degradation_events` should include `island_id`
When degradation occurs (e.g., `reduce_islands`), knowing *which* island was affected is critical for debugging. Add optional `island_id` to the degradation event object.

### N10. `idea_selection_v1` `anyOf` constraint is too weak
The constraint says at least one of `selected_node_ids`, `rejected_node_ids`, or `deferred_node_ids` must be non-empty. But the `anyOf` uses `minItems: 1` inside `properties` — this only applies if the array is present. Since all three arrays are listed in top-level `properties` (but not `required`), a document with all three absent would fail the `required` constraint for `selected_node_ids` and `rejected_node_ids` but not `deferred_node_ids`. Actually — `selected_node_ids` and `rejected_node_ids` are in `required`. The `anyOf` checks `minItems` on whichever array has it — but since `selected_node_ids` is always required, an empty `[]` would pass the outer schema but fail the `anyOf` *only if* `rejected_node_ids` and `deferred_node_ids` are also empty. Wait — `anyOf` passes if *any one* subschema passes. With `selected_node_ids: []`, the first `anyOf` branch checks `minItems: 1` → fails. Second: `rejected_node_ids: []` → fails. Third: `deferred_node_ids` absent → the `properties` subschema vacuously passes (property constraint only applies if the property is present). So `anyOf` would pass on the third branch even when all arrays are empty. **This is a bug**: the `anyOf` doesn't actually prevent all-empty selections.

## Real-research fit

### Strengths

1. **Evidence-first provenance is deeply wired**: The claim-level `support_type` + `evidence_uris` + `verification_plan` + grounding audit gate is exactly what's needed for HEP research integrity. The `active resolution` requirement (not just format checking) is a critical differentiator from typical AI-generated-paper systems.

2. **Operator taxonomy maps well to actual physics discovery patterns**: `AnomalyAbduction`, `SymmetryOperator`, `LimitExplorer`, and `AssumptionInversion` directly correspond to how theoretical physicists actually generate ideas. The `CrossDomainAnalogy` with mandatory mapping tables is particularly well-designed — this prevents the "vague analogy" failure mode.

3. **Multi-island evolution with repopulation** mirrors real research community dynamics (different groups trying different approaches, with cross-pollination). The state machine (SEEDING→EXPLORING→CONVERGING→STAGNANT→REPOPULATED) is a good formalization.

4. **Formalism registry → C2 handoff** is the right forcing function: it ensures ideas are not just "interesting" but computationally actionable. Requiring `candidate_formalisms` to come from a registry prevents the "great idea but nobody knows how to calculate it" failure mode.

5. **Folklore risk scoring** addresses a real problem in AI-assisted research: LLMs confidently proposing well-known results as novel.

### Gaps for real HEP workflows

1. **No explicit handling of "negative results" or "dead-end documentation"**: In real research, documenting *why* an approach fails is as valuable as the approach itself. Nodes that reach `STAGNANT` or fail grounding should have structured "lesson learned" artifacts that feed back into future campaigns (preventing wheel-reinvention).

2. **Missing experimental feasibility integration**: The `minimal_compute_plan` focuses on theoretical computation but doesn't address "can this actually be measured?" For HEP-ph ideas, feasibility depends on collider energy/luminosity, detector capabilities, and timeline. A `experimental_feasibility` field on `IdeaCard` (even if initially stub) would prevent generating ideas that require, e.g., a 100 TeV collider when only LHC Run 3 data is available.

3. **No mechanism for "literature-driven serendipity"**: Real breakthroughs often come from reading a paper on an adjacent topic and noticing a connection. The seed sources (§8.1) are all structured inputs; consider adding a `Librarian`-driven "browsing mode" operator that explores adjacent literature and surfaces unexpected connections.

## Robustness & safety

### Hallucination mitigation: STRONG
- Grounding audit with active URI resolution (not just format check) ✓
- `support_type=llm_inference` requires explicit `verification_plan` ✓
- Clean-room multi-agent evaluation prevents groupthink ✓
- Folklore risk scoring with human escalation ✓
- Novelty delta table requiring falsifiable statements ✓

### Provenance: STRONG
- `origin` (model/temperature/prompt_hash/timestamp/role) on every node ✓
- `operator_trace` (inputs/params/random_seed/evidence_uris_used/prompt_snapshot_hash) ✓
- Append-only semantics with mutation logs ✓
- Idempotency with stored first-response replay ✓

### Cost control: GOOD but with gaps
- Budget circuit breaker ✓
- Step-level budget fuse ✓
- Degradation order ✓
- **Gap**: No per-team/per-role cost accounting. Team topology multiplier is mentioned but not in the budget snapshot schema. `BudgetSnapshot` should include `cost_by_role: { [role]: number }` for debugging cost blowouts.

### Safety concerns
1. **Idempotency record storage**: The spec requires records "at least until campaign ends" but doesn't bound storage growth. For long-running campaigns with thousands of steps, the idempotency store could grow unbounded. Add `max_idempotency_records` or a compaction strategy.
2. **RFC 8785 JCS dependency**: Requiring JCS canonicalization introduces a non-trivial dependency. If implementations get canonicalization wrong (e.g., number formatting edge cases), idempotency_key_conflict false positives will occur. The spec should mandate a test vector.
3. **No rate limiting on `search.step`**: A buggy adapter could call `search.step(n_steps=1)` in a tight loop with new idempotency keys, rapidly exhausting budget. The step budget fuse helps but isn't mandatory (SHOULD not MUST).

## Specific patch suggestions

### P1. `schemas/idea_node_v1.schema.json` — Add revision counter

```json
// Add to "required":
"revision"

// Add to "properties":
"revision": {
  "type": "integer",
  "minimum": 1,
  "description": "Monotonically increasing revision counter. Incremented on each mutation (eval_info, grounding_audit, idea_card update). Enables stale-read detection and future optimistic concurrency."
}
```
Also add `"revision"` to the immutable-fields note in the description (it's engine-managed, not caller-set).

### P2. `schemas/idea_tournament_v1.schema.json` — Support draws

```json
// Change matches[].winner_node_id:
"winner_node_id": {
  "oneOf": [
    { "type": "string", "format": "uuid" },
    { "type": "null" }
  ],
  "description": "Winner of this match. null indicates a draw."
}

// Add optional draw_allowed:
"draw_allowed": {
  "type": "boolean",
  "default": false,
  "description": "Whether the tournament judge was permitted to declare draws."
}
```

### P3. `schemas/idea_core_rpc_v1.openrpc.json` — campaign.complete SHOULD→MUST

In the `campaign.complete` description, change:
```
"the engine SHOULD treat this as a no-op"
```
to:
```
"the engine MUST treat this as a no-op (idempotent: same idempotency metadata, transition.changed=false)"
```

### P4. `schemas/idea_card_v1.schema.json` — Add experimental_feasibility stub

```json
// Add to "properties" (not required in v0.2):
"experimental_feasibility": {
  "type": "object",
  "description": "Stub (v0.2): experimental feasibility context. Future: collider/detector/timeline constraints.",
  "properties": {
    "target_experiments": {
      "type": "array",
      "items": { "type": "string", "minLength": 1 },
      "description": "E.g., ['LHC Run 3', 'Belle II', 'DUNE']"
    },
    "required_luminosity_ifb": { "type": "number", "minimum": 0 },
    "required_energy_gev": { "type": "number", "minimum": 0 },
    "timeline_constraint": { "type": "string" }
  },
  "additionalProperties": true
}
```

### P5. `schemas/search_step_result_v1.schema.json` — Add `island_id` to degradation events

```json
// In degradation_events items properties, add:
"island_id": {
  "type": "string",
  "minLength": 1,
  "description": "Island affected by this degradation event (when applicable)."
}
```

### P6. `schemas/idea_selection_v1.schema.json` — Fix the `anyOf` vacuous pass bug

Replace the `anyOf` with:
```json
"anyOf": [
  { "required": ["selected_node_ids"], "properties": { "selected_node_ids": { "minItems": 1 } } },
  { "required": ["rejected_node_ids"], "properties": { "rejected_node_ids": { "minItems": 1 } } },
  { "required": ["deferred_node_ids"], "properties": { "deferred_node_ids": { "minItems": 1 } } }
]
```
This ensures at least one array exists **and** is non-empty.

### P7. `schemas/idea_list_filter_v1.schema.json` — Add eval-aware filters

```json
// Add to properties:
"has_eval_info": {
  "type": "boolean",
  "description": "Filter for nodes that have (true) or lack (false) eval_info."
},
"min_grounding_folklore_risk": {
  "type": "number",
  "minimum": 0,
  "maximum": 1,
  "description": "Filter for nodes with folklore_risk_score >= this value (useful for human review queues)."
}
```

### P8. `schemas/node_mutation_log_v1.schema.json` — Add mutation semantics

```json
// In mutations items, add to "required": "mutation_type"
// Add to properties:
"mutation_type": {
  "enum": ["set", "append", "clear"],
  "description": "How the field was mutated: set (replace), append (add to array/object), clear (set to null)."
}
```

### P9. `schemas/evaluator_config_v1.schema.json` — Add minimum-dimensions constraint for ranking

```json
// Add at the schema level:
"$comment": "For Pareto ranking (rank.compute method=pareto), dimensions SHOULD have minItems >= 2 to produce a meaningful Pareto front. A single dimension degenerates to a simple sort."
```

And in `schemas/idea_core_rpc_v1.openrpc.json`, `rank.compute` description, add:
```
"For method=pareto, the evaluator_config (or the latest scorecards) MUST have scores on >= 2 dimensions; if only 1 dimension is available, the engine MUST return insufficient_eval_data."
```

### P10. `docs/plans/2026-02-12-idea-generator-architecture-spec.md` — Add JCS test vector requirement

In §2.3, after the payload_hash description, add:

```markdown
**JCS test vector (MUST ship with engine)**: The engine MUST include at least one
test case that verifies JCS canonicalization + SHA-256 for a representative
`campaign.init` payload (with and without optional fields) and a `search.step`
payload, to prevent implementation drift on number formatting and key ordering.
```

### P11. `schemas/campaign_mutation_result_v1.schema.json` — Add conditional state-machine validation

Add to the schema a `$comment` (since full state-machine encoding in JSON Schema is impractical):

```json
"$comment": "Normative: transition.current_status MUST obey the campaign state machine (§2.4 of the architecture spec). JSON Schema cannot fully encode state-machine transitions; implementations MUST add runtime validation. Specifically: campaign.topup on early_stopped MUST NOT change status; campaign.pause MUST result in current_status=paused; campaign.resume on paused|early_stopped MUST result in current_status=running (or reject with budget_exhausted)."
```

### P12. `schemas/idea_node_v1.schema.json` — Add `dead_end` / `lessons_learned` field

```json
// Add to properties (optional, mutable):
"dead_end_report": {
  "oneOf": [
    { "type": "null" },
    {
      "type": "object",
      "required": ["reason", "lessons"],
      "properties": {
        "reason": { "type": "string", "minLength": 1 },
        "lessons": {
          "type": "array",
          "minItems": 1,
          "items": { "type": "string", "minLength": 1 },
          "description": "Structured lessons from this dead end (feeds into future campaign seeding)."
        },
        "related_node_ids": {
          "type": "array",
          "items": { "type": "string", "format": "uuid" }
        }
      },
      "additionalProperties": false
    }
  ]
}
```
