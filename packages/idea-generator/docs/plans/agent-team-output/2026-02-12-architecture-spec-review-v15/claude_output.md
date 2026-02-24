VERDICT: NOT_READY

## Blockers

### B1. `$ref` paths inconsistent between OpenRPC and JSON Schema files

The OpenRPC document uses `$ref: "./campaign_charter_v1.schema.json"` (with `./` prefix) in method params but `$ref: "budget_snapshot_v1.schema.json"` (bare filename) inside result schemas like `campaign_init_result_v1.schema.json`. JSON Schema `$ref` resolution is relative to `$id`, and OpenRPC `$ref` resolution is relative to the document. Mixing `./foo.json` and `foo.json` in different positions is technically fine under RFC 3986, but several popular validators (e.g., AJV in strict mode, `json-schema-ref-parser`) treat these differently when `$id` is set on sub-schemas. This **will** cause validation failures in at least one common toolchain.

**Fix required**: Normalize all `$ref` values to a single convention. Recommend `./filename.schema.json` everywhere (OpenRPC params AND result schemas that cross-reference siblings).

### B2. `campaign.complete` from `completed` state: spec vs. schema contradiction

The spec (§2.4) says `campaign.complete` is "Permitted when status is `running|paused|early_stopped|exhausted`" — `completed` is NOT in the allowed source set. But the OpenRPC description says "If already completed, the engine SHOULD treat this as a no-op (but still idempotent)." This is a direct contradiction: is `completed → completed` allowed or not? The state machine says no, the RPC description says yes-ish. This must be resolved before implementation because it affects both test harnesses and the idempotency store.

**Recommended resolution**: Treat `campaign.complete` on an already-completed campaign as an idempotent no-op (not an error), since the intent is fulfilled. Update §2.4 to include `completed → completed (no-op)` as a self-transition, and add `completed` to the allowed source set for `campaign.complete`. Alternatively, explicitly return `campaign_not_active` — but then the OpenRPC description must be updated to remove the SHOULD no-op language.

### B3. `campaign.pause` allows `early_stopped → paused`, but `exhausted` is not listed — inconsistency with `campaign.topup`

The spec (§2.4) allows `campaign.pause` from `running|early_stopped` but **not** from `exhausted`. However, a reasonable human operator scenario is: campaign hits `exhausted`, operator wants to freeze it (`pause`) while deciding whether to topup. Currently the only escape from `exhausted` is `topup` or `complete`. If the operator calls `campaign.pause` on `exhausted`, they get `campaign_not_active`, which is confusing since `exhausted` is not a terminal state. Either:
- Add `exhausted` to `campaign.pause`'s allowed sources, or
- Document explicitly that `exhausted` is a "frozen-but-not-paused" state and `pause` is not applicable.

This is a blocker because the current spec is silent, and implementers will guess differently.

### B4. No error code uniqueness constraint declared

The OpenRPC uses numeric codes like `-32001` through `-32015`, but there's no formal registry or uniqueness constraint. `-32002` (`schema_validation_failed`) appears in many methods but has subtly different semantics (missing `elo_config`, invalid charter structure, malformed IdeaCard). Without sub-codes or a machine-readable error detail schema, callers cannot programmatically distinguish "your EloConfig is missing" from "the IdeaCard failed schema validation." This directly impacts retry logic and adapter error handling.

**Fix required**: Define an error detail schema (e.g., `error_detail_v1.schema.json`) with at least `{ code, message, detail: { field?, reason?, schema_path? } }` and reference it from the OpenRPC `errors` definitions. Alternatively, assign distinct codes.

### B5. `rank.compute` is side-effecting but `ranked_nodes` requires `minItems: 1`

If a campaign has nodes but none pass the filter, or if all nodes lack eval data, `ranked_nodes` with `minItems: 1` means the engine cannot return a valid success response — it must error. But the only relevant error is `insufficient_eval_data (-32013)`, which doesn't cover "filter matched no nodes." This creates an ambiguous failure mode. Either:
- Remove `minItems: 1` from `ranked_nodes` (allow empty ranking), or
- Add a `no_matching_nodes` error code.

### B6. `search.step` `n_steps` semantic gap with multi-island

The `n_steps` parameter has no defined relationship to multi-island topology. Is 1 step = 1 node generated across any island? 1 step per island? 1 operator invocation? The team/role composition (§3.4.3) means a single "step" might invoke 4-8 LLM calls (Ideator + Librarian + Formalizer + Checker). Without a clear definition, budget estimation is impossible and `step_budget.max_steps` becomes meaningless.

**Fix required**: Add a `step_unit` enum or explicit definition in the spec. Recommended: 1 step = 1 operator invocation on 1 island producing 1+ candidate nodes (with all team roles counted as sub-operations within that step).

## Non-blocking

### N1. `campaign_topup_result_v1.schema.json` reused for `pause`/`resume`/`complete`

The filename and `$id` say "topup" but it's used for all campaign mutations. This is confusing. Recommend renaming to `campaign_mutation_result_v1.schema.json` with `$id` updated accordingly. Low priority but will cause confusion in documentation.

### N2. `BudgetSnapshot` has `steps_used` as required but `steps_remaining` as optional (nullable)

This asymmetry is intentional (steps_remaining is null when max_steps not set) but `nodes_remaining` follows the same pattern while `nodes_used` is required. The budget_envelope makes `max_nodes` optional but `max_tokens`, `max_cost_usd`, `max_wall_clock_s` mandatory. Consider making `max_steps` mandatory too (with a very large default sentinel), or make `steps_remaining` non-nullable and return `max_int` — this simplifies all downstream budget arithmetic.

### N3. `IdeaCard.claims[].evidence_uris` allows empty array for `literature`/`data`/`calculation`/`expert_consensus`

The conditional `allOf` in `idea_card_v1.schema.json` sets `minItems: 1` via `then`, but this is inside an `allOf` on the item level, not at the top level of the `claims` array item. This is **correct** JSON Schema 2020-12 — but many validators handle nested `allOf`/`if`/`then` inconsistently. Add an integration test that specifically validates a claim with `support_type: "literature"` and empty `evidence_uris` to confirm rejection.

### N4. `IslandState` lacks `created_at` / `last_transition_at`

For observability and debugging stagnation detection, island states should carry timestamps. Currently there's no way to determine how long an island has been `STAGNANT`.

### N5. `EvaluatorConfig.weights` keys are not constrained to match `dimensions`

The `weights` object has `additionalProperties: { type: number }` but no validation that keys must be a subset of the `dimensions` array. An evaluator could receive `weights: { "novelty": 2.0, "aesthetics": 1.0 }` where `"aesthetics"` is not in `dimensions`. Add a note that the engine MUST ignore or reject weights for dimensions not in the `dimensions` array.

### N6. No `campaign.delete` / `campaign.archive` — idempotency store growth

The spec notes idempotency records must be retained for campaign lifetime, and there's no delete/archive. For long-running research programs with many campaigns, this is a storage concern. Not blocking for v0.2, but flag for v0.3.

### N7. `node.list` pagination: `cursor` in request is optional but `cursor` in `NodeListResult` is required (nullable)

This is fine semantically but the request `cursor` has no `"required": false` marker in the OpenRPC params array (it's simply absent from `required`). Make this explicit with `"required": false` for clarity.

### N8. `formalism_registry_v1` entries lack versioning

A `formalism_id` like `hep-ph/chiral-pert` has no version component. When the C2 schema evolves, the registry entry must change, but there's no mechanism to version individual formalisms. Consider adding an optional `version` field to entries.

### N9. `RationaleDraft.references` vs `IdeaCard.claims[].evidence_uris` — duplicate provenance paths

A rationale draft can carry `references[]` which may or may not overlap with the formalized `claims[].evidence_uris`. There's no defined relationship. Consider adding a note that `references` in `RationaleDraft` are "soft pointers" and `claims[].evidence_uris` are the "hard provenance" that undergoes grounding audit.

### N10. Missing `campaign_id` in `campaign.init` idempotency dedupe documentation

The spec correctly notes `campaign.init` deduplicates by `(method, idempotency_key)` since no `campaign_id` exists yet. But if the same `idempotency_key` is used for two different charters (different `seed_pack`, different `budget`), the second call replays the first result — which is correct idempotency behavior but may surprise callers. Add a warning note.

## Real-research fit

### Strengths

1. **Evidence-first provenance chain is genuinely useful for HEP**: The `claims[] → evidence_uris → grounding_audit → promotion gate` pipeline maps well onto how real HEP phenomenology papers work. A theorist proposing a new mechanism (e.g., a BSM portal) must cite PDG constraints, existing limits, and theoretical consistency arguments. The schema enforces this.

2. **Operator families map to real discovery patterns**: `AnomalyAbduction` (e.g., muon g-2 anomaly → new physics models), `SymmetryOperator` (e.g., extending SM gauge group), `LimitExplorer` (heavy quark/soft limits) — these are genuinely how HEP theorists think. The `CrossDomainAnalogy` operator is particularly valuable: AdS/CFT, lattice-inspired methods for condensed matter, etc.

3. **Multi-island evolution prevents mode collapse**: A critical real-world failure mode in AI-assisted ideation is converging on a single "popular" direction. The island model with stagnation detection and repopulation directly addresses this.

4. **Formalism registry prevents "vaporware" ideas**: By requiring `candidate_formalisms` to map to a registry with `validator_id` and `compiler_id`, the system forces ideas to be grounded in executable formalism rather than hand-waving.

### Concerns

5. **`minimal_compute_plan` difficulty estimates are likely unreliable**: LLMs estimating whether a QCD calculation is "moderate" or "research_frontier" is a known failure mode. Consider making `estimated_difficulty` optional, or requiring a `Derivation` role sign-off for anything beyond "straightforward."

6. **`folklore_risk_score ∈ [0,1]` is underspecified**: What generates this score? Is it a semantic similarity to existing literature? A classifier? The spec treats it as a first-class gate (blocking promotion if above threshold) but provides no specification for how it's computed. For HEP, "folklore" is particularly tricky — e.g., "dark photon" ideas are both actively researched AND considered somewhat overexplored. The threshold and methodology need at least a stub specification.

7. **No explicit handling of negative results / "idea already falsified"**: In real HEP research, discovering that an idea is already experimentally excluded is a common and valuable outcome. The `verification_status: "falsified"` exists in claims but there's no campaign-level mechanism to record and propagate "this entire direction is excluded by LHC Run 2 data." Consider adding a `node_status` field (e.g., `active | superseded | falsified | withdrawn`).

8. **Team/Role model is aspirational for v0.2**: The 8-role physicist community (§3.4.2) is well-designed but represents a massive implementation surface. For real v0.2 delivery, recommend hard-requiring only `Ideator` + `Formalizer` + `Checker`, with the rest as optional extensions.

## Robustness & safety

### R1. Idempotency implementation for `search.step` requires careful design

The spec correctly identifies that LLM outputs are non-deterministic and mandates "store first result, replay on duplicate." But the storage requirement is significant: a `search.step` with `n_steps=10` might produce 10+ `IdeaNode` objects with full rationale drafts. The idempotency store must capture the entire `SearchStepResult` including all `new_node_ids` and the nodes themselves. Ensure the implementation spec addresses:
- Storage format (inline vs. reference to artifact store)
- Partial failure: if step 7 of 10 fails, what's stored? The spec says "no partial writes" for cross-campaign validation but doesn't address partial step execution within a single `search.step` call.

### R2. Grounding audit "active resolution" is a network dependency

§4.2.1 requires URI resolution against INSPIRE API / DOI resolver. This means:
- `node.promote` has a network dependency (can fail due to API outage)
- Test suites need mock resolvers
- Rate limiting against INSPIRE/DOI APIs must be handled

Recommend: grounding audit should be **cached and timestamped**, with a configurable staleness threshold. A URI resolved 1 hour ago should not need re-resolution on promote.

### R3. Hallucination vector: LLM-generated `evidence_uris`

The most dangerous failure mode is an LLM fabricating plausible-looking INSPIRE or arXiv URIs (e.g., `https://arxiv.org/abs/2401.XXXXX` with a real-looking but nonexistent ID). The grounding audit's active resolution catches this, but only at promote time. If the Ideator generates 100 nodes with fabricated URIs, the cost of discovery is deferred. Recommend: **eager URI validation** at node creation time (in `search.step`), not just at promote time. This is cheaper than discovering 100 bad nodes at ranking time.

### R4. No rate limiting / backpressure in RPC spec

The OpenRPC has no concept of rate limiting. A runaway adapter could fire 1000 `search.step` calls. The idempotency layer helps (duplicate keys are no-ops) but distinct keys would all execute. Add either:
- A `max_concurrent_steps` field to `CampaignCharter` or `BudgetEnvelope`
- A `-32016: rate_limited` error code

### R5. `eval.run` atomicity with large `node_ids` arrays

The spec requires atomicity: if any node is not in the campaign, no partial writes. But evaluating 50 nodes might take significant time/cost. If node #49 fails validation, all prior eval work is discarded. Consider:
- Validate all node membership BEFORE starting evaluation (cheap pre-check)
- Document this as a MUST in the spec (currently only implied)

## Specific patch suggestions

### P1. `schemas/idea_core_rpc_v1.openrpc.json` — Normalize `$ref` paths

**File**: `schemas/idea_core_rpc_v1.openrpc.json`
**Change**: In all result schemas that reference siblings (e.g., `campaign_init_result_v1.schema.json` referencing `budget_snapshot_v1.schema.json`), prefix with `./`:
```diff
- "$ref": "budget_snapshot_v1.schema.json"
+ "$ref": "./budget_snapshot_v1.schema.json"
```
Apply to every `$ref` in every `schemas/*.schema.json` file that references a sibling. This includes `campaign_init_result_v1`, `campaign_status_v1`, `campaign_topup_result_v1`, `search_step_result_v1`, `node_list_result_v1`, `eval_result_v1`, `ranking_result_v1`, `promotion_result_v1`, `idea_node_v1`.

### P2. `schemas/campaign_topup_result_v1.schema.json` — Rename to generic mutation result

**File**: Rename `schemas/campaign_topup_result_v1.schema.json` → `schemas/campaign_mutation_result_v1.schema.json`
**Change**: Update `$id` and `title`:
```diff
- "$id": "campaign_topup_result_v1.schema.json",
- "title": "CampaignMutationResult v1",
+ "$id": "campaign_mutation_result_v1.schema.json",
+ "title": "CampaignMutationResult v1",
```
Update all `$ref` in `idea_core_rpc_v1.openrpc.json` that point to the old filename.

### P3. `schemas/idea_core_rpc_v1.openrpc.json` — Add error detail schema

**New file**: `schemas/rpc_error_detail_v1.schema.json`
```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "rpc_error_detail_v1.schema.json",
  "title": "RPCErrorDetail v1",
  "description": "Structured error detail for JSON-RPC error responses.",
  "type": "object",
  "required": ["error_code", "message"],
  "properties": {
    "error_code": { "type": "string", "minLength": 1 },
    "message": { "type": "string", "minLength": 1 },
    "field": { "type": "string", "description": "JSON path of the offending field, if applicable." },
    "reason": { "type": "string" },
    "node_ids": {
      "type": "array",
      "items": { "type": "string", "format": "uuid" },
      "description": "Node IDs that caused the error (for node_not_in_campaign, node_not_found)."
    }
  },
  "additionalProperties": false
}
```
Reference this from the OpenRPC `errors` via `data` field.

### P4. `docs/plans/2026-02-12-idea-generator-architecture-spec.md` §2.4 — Resolve `campaign.complete` self-transition

**File**: `docs/plans/2026-02-12-idea-generator-architecture-spec.md`
**Change** in §2.4 under "允许的显式迁移":
```diff
- - `campaign.complete`：`running|paused|early_stopped|exhausted → completed`
+ - `campaign.complete`：`running|paused|early_stopped|exhausted|completed → completed`（若已 `completed`，视为幂等 no-op）
```

### P5. `docs/plans/2026-02-12-idea-generator-architecture-spec.md` §2.3 — Define step_unit

**File**: `docs/plans/2026-02-12-idea-generator-architecture-spec.md`
**Change**: Add after the `search.step` bullet in §2.3:
```markdown
**Step unit definition (MUST)**：1 step = 1 operator invocation on 1 island, producing 0 or more candidate nodes. All team-role sub-operations within that operator invocation (e.g., Librarian lookup, Ideator generation, Formalizer pass) count as sub-steps of that single step. Budget accounting (`steps_used`, `max_steps`) counts at the operator-invocation level, not at the LLM-call level. Token/cost accounting counts all LLM calls within the step.
```

### P6. `schemas/idea_node_v1.schema.json` — Add `node_status` field

**File**: `schemas/idea_node_v1.schema.json`
**Change**: Add to `properties`:
```json
"node_status": {
  "type": "string",
  "enum": ["active", "superseded", "falsified", "withdrawn"],
  "default": "active",
  "description": "Lifecycle status. 'falsified' = idea contradicted by evidence; 'superseded' = replaced by a descendant node; 'withdrawn' = manually retracted."
}
```
This is not required (backward compatible), but the `idea_list_filter_v1.schema.json` should also gain a `node_status` filter property.

### P7. `schemas/island_state_v1.schema.json` — Add timestamps

**File**: `schemas/island_state_v1.schema.json`
**Change**: Add to `properties`:
```json
"created_at": { "type": "string", "format": "date-time" },
"last_transition_at": {
  "type": "string",
  "format": "date-time",
  "description": "Timestamp of last state transition (for stagnation duration observability)."
}
```

### P8. `schemas/ranking_result_v1.schema.json` — Relax `minItems` on `ranked_nodes`

**File**: `schemas/ranking_result_v1.schema.json`
**Change**:
```diff
  "ranked_nodes": {
    "type": "array",
-   "minItems": 1,
    "items": { ... }
  }
```
And add an `"empty_reason"` optional field:
```json
"empty_reason": {
  "type": "string",
  "description": "Human-readable explanation if ranked_nodes is empty (e.g., filter matched no evaluated nodes)."
}
```

### P9. `schemas/search_step_result_v1.schema.json` — Add `n_steps` semantic note

**File**: `schemas/search_step_result_v1.schema.json`
**Change**: Update `n_steps_executed` description:
```json
"n_steps_executed": {
  "type": "integer",
  "minimum": 0,
  "description": "Number of operator invocations completed (1 step = 1 operator invocation on 1 island). May be less than n_steps_requested if early-stopped or budget-exhausted."
}
```

### P10. `schemas/idea_core_rpc_v1.openrpc.json` — Add pre-validation note to `eval.run`

**File**: `schemas/idea_core_rpc_v1.openrpc.json`, `eval.run` method
**Change**: Append to description:
```diff
- "description": "Side-effecting. Only permitted when campaign status is running; otherwise campaign_not_active. Atomicity: if any node_id in node_ids is not in the specified campaign, the engine MUST return node_not_in_campaign (-32014) and perform no partial writes/mutations."
+ "description": "Side-effecting. Only permitted when campaign status is running; otherwise campaign_not_active. Atomicity: if any node_id in node_ids is not in the specified campaign, the engine MUST return node_not_in_campaign (-32014) and perform no partial writes/mutations. Implementation MUST validate all node_ids for campaign membership BEFORE beginning any evaluation work (fail-fast pre-check)."
```
