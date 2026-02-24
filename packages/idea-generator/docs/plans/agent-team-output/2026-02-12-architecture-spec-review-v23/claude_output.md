VERDICT: NOT_READY

## Blockers

### B1. `campaign.resume` from `exhausted` — spec vs. OpenRPC inconsistency

The architecture spec (§2.4) states:

> `campaign.resume`: `exhausted → exhausted`（固定拒绝：`budget_exhausted`）

But the OpenRPC description says:

> "Accepted when campaign status is paused|early_stopped|**exhausted**."

This creates ambiguity: is `exhausted` an *accepted* input state or not? The spec says "固定拒绝" (always reject), but the OpenRPC says "accepted." The behavior is ultimately "reject with `budget_exhausted`", but listing it under "Accepted" is misleading for code generators and SDK users. **Either remove `exhausted` from the "Accepted" list and add it to the errors section with an explicit note, or reword to "received but rejected."** As-is, any OpenRPC-based code generator will treat `exhausted` as a valid pre-condition for success.

### B2. `campaign.topup` — missing `budget_snapshot` in result

`campaign.topup` returns `CampaignMutationResult`, which contains `campaign_status` (→ `CampaignStatusV1` which embeds `budget_snapshot`). This is technically sufficient, but the spec (§2.3 point 2) says idempotency replays return the *first-call snapshot*, which may be stale. **The spec mandates callers use `campaign.status` for current budget — but `campaign.topup`'s own result embeds a `campaign_status` with `budget_snapshot`.** Is the embedded `budget_snapshot` the post-topup snapshot (live) or the first-call snapshot (replayed)? The idempotency contract says "all fields MUST match the first response" — so on replay the `budget_snapshot` is stale. This is fine for idempotency correctness, but needs an **explicit callout in the OpenRPC description** for `campaign.topup` that the returned `budget_snapshot` may be stale on replay. Without this, implementers will assume the returned budget is current.

### B3. `eval.run` atomicity vs. multi-node batch — no partial-success path

The spec mandates `eval.run` is atomic: "on any error... MUST perform no partial writes." But the RPC accepts `node_ids: array[minItems: 1]` — potentially many nodes. If the LLM evaluation of node #47 out of 50 hits budget exhaustion, the engine must roll back all 46 prior evaluations. This is architecturally expensive and potentially surprising. **Either:**
- Add a `partial_results_policy` param (e.g., `all_or_nothing | best_effort`) — or —
- Cap `node_ids` array size (e.g., `maxItems: 50`) and document the rollback cost — or —
- Change the spec to allow partial success with a `failed_node_ids` field in the result.

As-is, the strict atomicity across unbounded batch size is a blocker for implementability.

### B4. `idea_card_v1.schema.json` — `claims[].evidence_uris` allows empty array for `literature`/`data`/`calculation`/`expert_consensus`

The conditional `allOf` block correctly requires `evidence_uris` with `minItems: 1` for evidence-backed support types. **However**, the base property definition has no `minItems`, so a validator that doesn't support `if/then/allOf` (or a bundling step that flattens conditionals) will silently accept empty arrays. This is a real risk with some JSON Schema implementations. **Add a note in the spec that validators MUST support Draft 2020-12 `if/then` or use a pre-validation step.** Alternatively, split into two sub-schemas via `oneOf` with discriminator on `support_type` — more robust across implementations.

### B5. No schema for `idea_evidence_graph_v1.json` / `idea_novelty_report_v1.json` / `idea_scorecards_v1.json` / `idea_tournament_v1.json` / `idea_selection_v1.json`

Section 5.1 lists 9 SSOT artifacts. Schemas are provided for only 4 of them (`idea_card`, `idea_node`, `rationale_draft`, `idea_handoff_c2`). The remaining 5 have no schema files in the bundle. The SSOT contract rule (§2.3) says `schemas/*.schema.json` is the single source of truth — but these artifacts have no schema. **At minimum, stub schemas with `TODO` markers must exist for all 9 artifacts, or they must be explicitly deferred with a rationale.** Without this, the "evidence-first" audit chain has gaps — particularly `idea_evidence_graph_v1.json` which is referenced by the grounding audit gate (§4.2.1).

## Non-blocking

### N1. `BudgetEnvelope` — `max_cost_usd` and `max_wall_clock_s` allow `minimum: 0`

A campaign with `max_cost_usd: 0` or `max_wall_clock_s: 0` would immediately exhaust. Consider `exclusiveMinimum: 0` for these fields (matching `budget_topup_v1` which already uses `exclusiveMinimum: 0` for `add_cost_usd` and `add_wall_clock_s`). Alternatively, document that `0` means "no budget for this dimension" (which would be a different semantic than "unlimited").

### N2. `EloConfig` — no K-factor or initial rating

Elo implementations require at minimum a K-factor and initial rating. `elo_config_v1.schema.json` only has `max_rounds` and `seed`. While `additionalProperties: false` blocks extension, any real Elo implementation will need these. **Recommend adding `k_factor` (number, default 32) and `initial_rating` (number, default 1500) as optional fields now**, before the schema is locked.

### N3. `node.list` pagination — `total_count` consistency caveat

The spec notes `total_count` "may differ across pages if the underlying set changes." This is correct, but `node.list` is read-only and `search.step` is single-writer — so in v0.x the set shouldn't change mid-pagination unless the caller interleaves `search.step` calls. Consider adding a `snapshot_version` or `as_of` timestamp to make this explicit and testable.

### N4. `idea_list_filter_v1` — no `min_score` / `eval_status` / `created_after` filters

For `rank.compute` with a filter, the current filter schema only supports `idea_id`, `node_id`, `island_id`, `operator_id`, `has_idea_card`, `grounding_status`. Missing: `min_score` (useful for "rank only top-evaluated nodes"), `created_after`/`created_before` (useful for incremental ranking), `eval_status` (has been evaluated or not). These will be needed quickly in practice.

### N5. `RationaleDraft` — `kill_criteria` vs `IdeaCard.claims[].verification_plan` semantic overlap

Both structures capture "how to kill/verify this idea." The relationship is unclear: does `kill_criteria` from the draft get promoted into `claims[].verification_plan`? Is there a mapping? Document the intended lifecycle: `kill_criteria` (draft-stage, informal) → `verification_plan` (card-stage, per-claim, falsifiable).

### N6. OpenRPC version drift risk

The OpenRPC doc is at version `1.8.10` while the architecture spec is `v0.2`. These versioning schemes will diverge. Consider aligning: OpenRPC version should embed the spec version (e.g., `0.2.10`) to make compatibility auditable.

### N7. `campaign.complete` from `completed` — idempotency semantics

The spec says `completed → completed` is a "no-op." But with idempotency, the first `campaign.complete` call stores a response; a second call with a *different* `idempotency_key` would be a *new* call (not a replay) that happens to be a no-op. This is fine, but the idempotency record for the second key also needs to be stored. Confirm this is intended: two different keys, both succeeding, both stored.

### N8. `search_step_result_v1` — `n_steps_executed` can be `0`

`minimum: 0` means a valid response can report zero ticks executed. This can happen if the budget is exhausted before the first tick. But if `campaign status == running` (required to call `search.step`), and budget is not exhausted (otherwise `budget_exhausted` error), when would `n_steps_executed == 0` occur? If never, set `minimum: 1`. If it can occur (e.g., step_budget fuse is set to 0 — but `budget_limit_v1` requires `minProperties: 1` and all fields have `minimum: 1`), document when.

## Real-research fit

### R1. HEP formalism coverage

The `formalism_registry_v1` pattern `^[a-z0-9_-]+\/[a-z0-9_.-]+$` is well-suited for namespacing (e.g., `hep-ph/chiral-perturbation-theory`, `hep-th/ads-cft`). The spec correctly ties `candidate_formalisms[]` to this registry with a hard gate at `node.promote`. This is **excellent** for preventing hallucinated formalisms from reaching C2.

However, the registry only validates *names*, not *capabilities*. A formalism entry requires `c2_schema_ref`, `validator_id`, `compiler_id` — but there's no validation that these references are resolvable at `campaign.init` time. **Recommend a startup validation step**: `campaign.init` should verify that all `formalism_registry.entries[].c2_schema_ref` URIs resolve and that `validator_id`/`compiler_id` correspond to registered plugins.

### R2. Evidence-first grounding — strong but needs calibration data

The grounding audit gate (§4.2.1) with active URI resolution is strong. The `folklore_risk_score ∈ [0,1]` is good but needs a calibration mechanism — what threshold triggers `A0-folklore` human review? This should be a `campaign_charter_v1` or `evaluator_config_v1` parameter, not hardcoded. Currently no schema field captures this threshold.

### R3. Cross-domain analogy safety

The spec correctly requires `mapping table + invariants + kill criteria` for cross-domain operators, plus grounding audit and target-domain constraints. This is well-thought-out for preventing "physics by analogy" hallucinations. The `CrossDomainAnalogy` operator family + `RationaleDraft.analogy_mapping[]` schema provides the structural backbone. Good.

### R4. Compute plan realism

The `minimal_compute_plan` with `estimated_difficulty`, `estimate_confidence`, `estimated_compute_hours_log10`, and `required_infrastructure` is practical and maps well to real HEP workflows. The `blockers[]` field is particularly valuable for catching "this requires a code that doesn't exist yet" early.

## Robustness & safety

### S1. Idempotency — JCS canonicalization is strong but needs test vectors

The RFC 8785 (JCS) canonicalization + SHA-256 payload hash is a solid choice. However, JCS has known edge cases with floating-point serialization (IEEE 754 → shortest representation). **Provide 3–5 test vectors** (e.g., `campaign.init` with specific charter/seed/budget → expected `payload_hash`) in a companion test file. Without these, two independent implementations may diverge on payload hashing and cause false `idempotency_key_conflict` errors.

### S2. Idempotency record + side-effect atomicity — "logical commit" is underspecified

The spec says: "idempotency record's commit must be in the same 'logical commit' as side-effects." For JSONL-based storage (v0.x), this means either:
- File-system atomicity (write to temp file + rename) — fragile across nodes/artifacts + idempotency store
- WAL-style approach (write-ahead log with recovery)

**Recommend specifying the minimum implementation strategy** for v0.x (e.g., "write side-effects + idempotency record to a single JSONL append in one `write()` call" or "use a two-phase approach with a recovery scan on startup").

### S3. Hallucination mitigation — URI active resolution is necessary but not sufficient

Active URI resolution catches phantom references. But it doesn't catch **citation misattribution** (real paper, wrong claim). The `support_type=literature` + `evidence_uris` structure doesn't require the engine to verify that the cited paper *actually supports* the claim. This is a known hard problem, but the spec should acknowledge it and specify a future hook (e.g., `relevance_verified: boolean` in claims, populated by `Librarian` role with abstract/passage matching).

### S4. Campaign isolation — cross-campaign node ID collision

The spec requires campaign-scoped isolation, but `node_id` uses UUID format globally. If two campaigns independently generate UUIDs, collision probability is negligible — but the spec should state whether `node_id` is **globally unique** (recommended) or only **campaign-scoped unique**. This affects idempotency store design and cross-campaign audits.

### S5. Budget — wall clock measurement ambiguity

`wall_clock_s_elapsed` in `BudgetSnapshot` — measured from when? Campaign creation? First `search.step`? The spec should define the epoch. Recommend: "wall clock elapsed since `campaign.init` success timestamp (`CampaignInitResult.created_at`), excluding time spent in `paused` status."

## Specific patch suggestions

### P1. `schemas/idea_core_rpc_v1.openrpc.json` — `campaign.resume` description

**File**: `schemas/idea_core_rpc_v1.openrpc.json`, method `campaign.resume`

**Change**: Replace `"Accepted when campaign status is paused|early_stopped|exhausted."` with:

```
"Accepted when campaign status is paused|early_stopped. If status is exhausted, the engine MUST reject with budget_exhausted (-32001) without changing state; exhausted is NOT a valid pre-condition for success — the caller must campaign.topup first. If campaign is completed, returns campaign_not_active (-32015)."
```

### P2. `schemas/eval_result_v1.schema.json` — add `node_ids` maxItems

**File**: `schemas/eval_result_v1.schema.json` (and the `eval.run` params in `idea_core_rpc_v1.openrpc.json`)

**Change**: Add `"maxItems": 100` to the `node_ids` param in `eval.run` and document the atomicity cost:

```json
"node_ids": {
  "type": "array",
  "minItems": 1,
  "maxItems": 100,
  "items": { "type": "string", "format": "uuid" },
  "description": "Batch size capped at 100 to bound rollback cost (eval.run is atomic: all-or-nothing)."
}
```

### P3. `schemas/budget_envelope_v1.schema.json` — use `exclusiveMinimum` for cost/time

**File**: `schemas/budget_envelope_v1.schema.json`

**Change**:
```json
"max_cost_usd": { "type": "number", "exclusiveMinimum": 0 },
"max_wall_clock_s": { "type": "number", "exclusiveMinimum": 0 }
```

### P4. `schemas/elo_config_v1.schema.json` — add K-factor and initial rating

**File**: `schemas/elo_config_v1.schema.json`

**Change**: Add optional fields:
```json
"k_factor": {
  "type": "number",
  "minimum": 1,
  "default": 32,
  "description": "Elo K-factor controlling rating volatility."
},
"initial_rating": {
  "type": "number",
  "minimum": 0,
  "default": 1500,
  "description": "Initial Elo rating for unrated nodes."
}
```

### P5. `schemas/campaign_charter_v1.schema.json` — add `folklore_risk_threshold`

**File**: `schemas/campaign_charter_v1.schema.json`

**Change**: Add:
```json
"folklore_risk_threshold": {
  "type": "number",
  "minimum": 0,
  "maximum": 1,
  "default": 0.7,
  "description": "Folklore risk score threshold above which A0-folklore human review is triggered."
}
```

### P6. `schemas/idea_card_v1.schema.json` — add `relevance_verified` to claims

**File**: `schemas/idea_card_v1.schema.json`, inside `claims[].properties`

**Change**: Add:
```json
"relevance_verified": {
  "type": "boolean",
  "default": false,
  "description": "Whether the cited evidence has been verified (e.g., by Librarian role) to actually support the claim text, not just exist at the URI."
}
```

### P7. `schemas/budget_snapshot_v1.schema.json` — add `epoch_ref`

**File**: `schemas/budget_snapshot_v1.schema.json`

**Change**: Add:
```json
"wall_clock_epoch": {
  "type": "string",
  "format": "date-time",
  "description": "Reference epoch for wall_clock_s_elapsed (campaign.init created_at). Enables unambiguous elapsed-time computation."
},
"wall_clock_paused_s": {
  "type": "number",
  "minimum": 0,
  "description": "Total seconds the campaign has spent in paused status (excluded from wall_clock_s_elapsed if the engine tracks active time only)."
}
```

### P8. `docs/plans/2026-02-12-idea-generator-architecture-spec.md` — add missing schema stubs to §5.1

**File**: `docs/plans/2026-02-12-idea-generator-architecture-spec.md`, section 5.1

**Change**: Add after the artifact list:

```markdown
**Schema delivery status (v0.2)**:
- ✅ Delivered: `idea_card_v1`, `idea_node_v1`, `rationale_draft_v1`, `idea_handoff_c2_v1`
- ⏳ Deferred to v0.3 (stub schemas required before v0.2 freeze):
  - `idea_campaign_v1.schema.json` — campaign-level metadata (superset of CampaignCharter + runtime state)
  - `idea_seed_pack_v1.schema.json` — alias of `seed_pack_v1.schema.json` (clarify naming)
  - `idea_evidence_graph_v1.schema.json` — grounding audit aggregation
  - `idea_novelty_report_v1.schema.json` — novelty pipeline output
  - `idea_scorecards_v1.schema.json` — evaluator scorecard aggregation
  - `idea_tournament_v1.schema.json` — Elo tournament log
  - `idea_selection_v1.schema.json` — final selection rationale + ranking snapshot
```

### P9. `schemas/search_step_result_v1.schema.json` — `n_steps_executed` minimum

**File**: `schemas/search_step_result_v1.schema.json`

**Change**: Add a conditional:
```json
{
  "if": {
    "properties": { "early_stopped": { "const": false } },
    "required": ["early_stopped"]
  },
  "then": {
    "properties": { "n_steps_executed": { "minimum": 1 } }
  }
}
```
And add to description: `"n_steps_executed may be 0 only when early_stopped=true and the budget fuse triggered before the first tick could complete."`

### P10. `schemas/idea_node_v1.schema.json` — clarify `node_id` uniqueness scope

**File**: `schemas/idea_node_v1.schema.json`

**Change**: Update `node_id` description:
```json
"node_id": {
  "type": "string",
  "format": "uuid",
  "description": "Globally unique node identifier (UUIDv4). Global uniqueness (not just campaign-scoped) is REQUIRED to support cross-campaign audits and idempotency store integrity."
}
```

### P11. Add idempotency test vectors file

**New file**: `schemas/tests/idempotency_test_vectors_v1.json`

**Content**: A JSON file containing 3–5 test cases with:
- Method name
- Input params (full JSON)
- Expected `payload_hash` (after JCS canonicalization, excluding `idempotency_key`)
- Notes on edge cases (float serialization, optional field defaults)

This is critical for cross-implementation compatibility of the JCS + SHA-256 payload hashing contract.
