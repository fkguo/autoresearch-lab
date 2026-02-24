VERDICT: NOT_READY

## Blockers

### B1. `campaign.status` is the only read-only method but lacks idempotency echo parity documentation

Not a true blocker per se, but the following is: **`node.get` and `node.list` are listed in the OpenRPC as side-effect-free, yet `node.list` has no documented contract for what happens when the campaign is in `completed` or `exhausted` state.** The spec says `campaign_not_active` is returned for write operations on completed campaigns, but read operations are underspecified. Should `node.list` / `node.get` / `campaign.status` work on completed campaigns? The `campaign_not_active` error is only listed on write methods, which is correct — but this needs to be explicitly stated as a guarantee (reads always succeed on any state except `campaign_not_found`).

**Severity: Blocker** because implementors may inadvertently add state guards to reads.

### B2. `campaign.resume` from `early_stopped` has an ambiguous budget contract

The spec says `campaign.resume` transitions `paused|early_stopped → running`. But if a campaign is `early_stopped` because the budget was exhausted, resuming without a `topup` first would immediately re-trigger the circuit breaker. The OpenRPC lists `budget_exhausted` as a possible error for `campaign.resume`, but the **ordering constraint** "must topup before resume from exhausted/early_stopped" is not formalized.

More critically: the `campaign_status_v1.schema.json` has status enum `["running", "paused", "early_stopped", "exhausted", "completed"]` — but the spec (section 2.3) says `campaign.topup` is "Permitted when campaign status is running|paused|early_stopped|exhausted." This means `exhausted` is a distinct state from `early_stopped`, yet `campaign.resume` only lists `paused|early_stopped → running`, not `exhausted → running`. **There is no documented transition out of `exhausted` except via `topup` (which doesn't change state — it only adds budget) followed by... what?** The state machine is incomplete.

**Severity: Blocker.** Implementors cannot determine the correct `exhausted` → `running` transition path.

### B3. Missing campaign state machine schema / formal definition

The campaign lifecycle states (`running`, `paused`, `early_stopped`, `exhausted`, `completed`) and their valid transitions are described informally across multiple method descriptions but never consolidated. For example:
- What transitions `running → exhausted` vs `running → early_stopped`?
- Can `exhausted` be resumed after topup?
- Is `completed` truly terminal (the spec says topup is rejected, but what about `campaign.status` or `node.list`)?

Without a formal state transition table or schema, the idempotency guarantees break down: if a `campaign.pause` is replayed but the campaign has since been resumed and completed, the engine must return the original pause result — but this conflicts with the campaign's actual state being `completed`.

**Severity: Blocker.** The idempotency replay contract (§2.3) assumes deterministic state, but the state machine is not fully specified.

### B4. `$ref` paths in OpenRPC are relative without anchoring convention

The OpenRPC file uses `$ref` paths like `"$ref": "./campaign_charter_v1.schema.json"` and result schemas use `"$ref": "budget_snapshot_v1.schema.json"` (no `./` prefix). This inconsistency means:
- `campaign.init` params use `./campaign_charter_v1.schema.json`
- `campaign_init_result_v1.schema.json` internally uses `"$ref": "budget_snapshot_v1.schema.json"` (no `./`)

Most JSON Schema resolvers treat these identically when the `$id` is in the same directory, but the **inconsistency violates the stated SSOT discipline** (§2.3 final note). More critically, `campaign_init_result_v1.schema.json` uses `$ref` without `./` while the OpenRPC uses `$ref` with `./` — a bundling tool that normalizes differently could break resolution.

**Severity: Blocker** for CI/mechanical bundling (the spec explicitly mandates mechanical bundling).

### B5. `rank.compute` is side-effecting (requires `idempotency_key`) but the ranked output for `pareto` is deterministic while `elo` depends on `elo_config.seed` — yet idempotency replay semantics for `pareto` with a changing node set are undefined

If between a first `rank.compute(method=pareto, idempotency_key=X)` call and a replay of the same key, new nodes have been evaluated, the first-call result (stored) would be stale. The idempotency contract says "return same logical response" — which is correct for safety — but the spec never warns callers that **they must use a new idempotency_key after any eval.run or search.step that changes the ranking input set**. This is a correctness footgun.

**Severity: Blocker** for real usage. Callers will almost certainly hit this.

### B6. `ranking_result_v1.schema.json` requires `ranked_nodes` with `minItems: 1` but `rank.compute` can be called with a filter that matches zero evaluated nodes

If a filter matches nodes with no eval data, the engine should return `insufficient_eval_data` (-32013). But the schema for success requires `minItems: 1`, so a successful rank with zero matches is impossible. This is fine **if and only if** the engine guarantees it will always error on zero matches. The spec says `insufficient_eval_data` is an error, but the boundary is unclear: what if 1 node has eval data but it's insufficient for Elo (needs ≥2 for pairwise)? The `insufficient_eval_data` threshold is not specified.

**Severity: Blocker** — Elo with 1 node is undefined; `minItems: 1` on the success path doesn't protect against it.

## Non-blocking

### N1. `BudgetSnapshot` has `steps_used` as required but `steps_remaining` as nullable

This asymmetry is reasonable (steps may not be capped), but `nodes_used` / `nodes_remaining` follows the same pattern. However, `BudgetEnvelope` makes `max_tokens`, `max_cost_usd`, `max_wall_clock_s` all required, while `max_nodes` and `max_steps` are optional. This means `tokens_remaining` and `cost_usd_remaining` and `wall_clock_s_remaining` are always computable, but the snapshot schema has `wall_clock_s_remaining` as required (not nullable). **This is actually fine** but worth documenting: if `max_wall_clock_s` is set to 0, `wall_clock_s_remaining` would immediately be 0, which is a degenerate campaign.

**Suggestion**: Add `minimum: 1` to `BudgetEnvelope.max_wall_clock_s` (and `max_cost_usd`) to prevent degenerate zero-budget campaigns, or `exclusiveMinimum: 0`.

### N2. `evaluator_config_v1` `dimensions` enum is closed but extensibility is needed

The enum `["novelty", "feasibility", "impact", "tractability", "grounding"]` is fixed. When extending to condensed matter or astrophysics, new dimensions (e.g., `experimental_accessibility`, `numerical_stability`) would require a schema version bump. Consider a hybrid: keep the known enum but allow `"type": "string"` with a pattern for custom dimensions (e.g., `^x-[a-z_]+$`).

### N3. `idea_card_v1` `candidate_formalisms` pattern `^[a-z0-9_-]+\/[a-z0-9_.-]+$` doesn't allow uppercase or spaces

This is intentional (machine-friendly IDs), but the pattern doesn't match the `formalism_registry_v1` entries — oh wait, it does, `formalism_id` in the registry uses the same pattern. Good. But note that the pattern uses `/` which must be escaped in some JSON contexts; the schema correctly uses a regex string, so this is fine. Non-blocking, just noting the consistency is correct.

### N4. `search_step_result_v1` conditional `allOf` for `new_nodes_artifact_ref`

The conditional "if new_node_ids has minItems 1, then require new_nodes_artifact_ref" is clever but has an edge case: `new_node_ids: []` (empty array) means no artifact ref is required, which is correct for early-stopped-with-no-work. However, the `required` array already includes `new_node_ids`, so an empty array is always valid. The conditional works correctly. Non-blocking.

### N5. `IdeaNode.eval_info.failure_modes` is `array of string` (free text) alongside structured `fix_suggestions`

This dual representation (structured + free text) is pragmatic but could lead to divergence. Consider making `failure_modes` items reference the same enum as `fix_suggestions[].failure_mode` when possible, with a `"other"` escape hatch.

### N6. `campaign.topup` reuses `campaign_topup_result_v1.schema.json` for pause/resume/complete

The schema is named `CampaignMutationResult` in its title but the filename is `campaign_topup_result_v1`. This naming mismatch will confuse implementors. Rename the file to `campaign_mutation_result_v1.schema.json`.

### N7. Missing `created_at` as required in `campaign_status_v1.schema.json`

`created_at` is optional in the status response but required in `campaign_init_result_v1`. Since the campaign creation timestamp is immutable and always known, it should be required in status too.

### N8. No versioning field in any schema

None of the schemas include a `schema_version` or `$schema` self-reference field in the data objects themselves. While the file names contain `v1`, payloads in the wire protocol don't self-identify their version. For forward compatibility, consider adding `"version": {"const": "1"}` to key schemas (`IdeaNode`, `IdeaCard`, `CampaignCharter`).

### N9. `IdeaNode.operator_trace.inputs` and `params` are untyped `object`

These are intentionally open (`"type": "object"` with no properties defined), which is correct for extensibility. But for audit/replay, consider requiring at minimum that they are JSON-serializable (already implied by JSON Schema) and adding a recommendation that operator implementations document their specific sub-schemas.

### N10. `seed_pack_v1` `seed_type` is free-text string

No enum or pattern constraint. The spec mentions `C1 gaps`, `PDG/HEPData tensions`, `KB priors`, `user seeds` — these should be at least a recommended enum with escape hatch.

## Real-research fit

### R1. Grounding audit as a gate is well-designed for HEP

The requirement that `evidence_uris` undergo active resolution (INSPIRE API, DOI resolver) before promotion is **exactly right** for HEP where the literature infrastructure is mature. The `folklore_risk_score` with human-in-the-loop escalation is also appropriate — much HEP "common knowledge" is never properly cited.

### R2. The Explain-Then-Formalize pipeline matches real theoretical physics workflow

Theorists do operate in this two-phase mode: informal intuition/analogy → formal calculation/testable prediction. The `RationaleDraft → IdeaCard` pipeline with mandatory kill criteria is a faithful mechanization.

### R3. The operator taxonomy is reasonable but needs hierarchy

`AnomalyAbduction`, `SymmetryOperator`, `LimitExplorer` are at different levels of abstraction. In practice, a symmetry analysis often involves limit-taking, and anomaly explanation may require assumption inversion. The spec should note that operators can be **composed** (an operator can internally invoke sub-operators), and the `operator_trace` should support nested traces.

### R4. Multi-island evolution is well-suited to HEP phenomenology

Different phenomenological approaches to the same anomaly (e.g., B-physics anomalies explored via leptoquarks, Z', SMEFT, etc.) map naturally to islands. The repopulation mechanism (migrating good ideas between islands) mirrors how the real community works — when one approach gains traction, others adapt.

### R5. The C2 handoff contract is the right boundary

Stopping at "C2-ready" rather than trying to automate the full calculation is wise. The `minimal_compute_plan` with difficulty estimates and infrastructure requirements gives the downstream agent (or human) actionable information without overcommitting.

### R6. Missing: temporal/priority ordering of seeds

Real research has urgency — a new experimental result at a conference should be prioritized over a 5-year-old anomaly. The `SeedPack` has no priority/urgency field. Consider adding `priority: integer` or `urgency: enum [routine, timely, urgent]` to seed items.

### R7. Missing: negative results / dead-end tracking

The spec focuses on promoting successful ideas but doesn't formalize how dead ends are recorded. In real research, knowing what was tried and failed is as valuable as knowing what succeeded. The `IdeaNode` can have `eval_info.failure_modes`, but there's no campaign-level "graveyard" or negative result artifact.

## Robustness & safety

### S1. Idempotency for `search.step` with LLM generation is the hardest contract to fulfill

The spec correctly identifies this (§2.3: "must be implemented by storing and replaying the first response, not by re-execution"). This requires that the engine serialize the complete LLM response, including all generated nodes, before returning. If the engine crashes between LLM completion and response serialization, the idempotency guarantee is broken. Consider adding a WAL (write-ahead log) requirement or at least documenting the crash-recovery semantics.

### S2. Grounding audit active resolution is a network-dependent operation

The grounding audit requires INSPIRE/DOI resolution, which can fail due to network issues, API rate limits, or service outages. The spec should define:
- Retry policy for failed resolutions
- Whether a timeout counts as `fail` or `partial`
- Whether a `partial` grounding audit can be upgraded to `pass` later (re-audit)

The current `IdeaNode.grounding_audit` has a single `status` and `timestamp` — there's no provision for incremental re-audits. A `grounding_audit_history` array would be more robust.

### S3. The `prompt_hash` in `origin` is good for reproducibility but insufficient for safety

SHA-256 of the prompt captures what was asked but not the system prompt, tool definitions, or model version (beyond the `model` string). For hallucination forensics, consider storing `system_prompt_hash` separately or expanding to a `prompt_envelope_hash` that covers the full input context.

### S4. No rate limiting or concurrency control in the RPC spec

The spec doesn't address concurrent `search.step` calls on the same campaign. Can two concurrent steps run? If not, the engine needs a locking mechanism. If yes, how do they interact with the budget circuit breaker (race condition on remaining budget)?

### S5. `folklore_risk_score` threshold is not in any schema

The spec says "超过阈值则必须走 A0-folklore 人类裁定" but the threshold value is not in `EvaluatorConfig`, `CampaignCharter`, or any other schema. It should be configurable per campaign (e.g., `charter.extensions.folklore_threshold` or a dedicated field in `EvaluatorConfig`).

### S6. Clean-room evaluation is specified but not enforced by the schema

The `EvaluatorConfig` has `clean_room: boolean, default: true` but there's no mechanism in the schema or RPC to verify that clean-room isolation was actually achieved at runtime. Consider adding an `eval_isolation_attestation` field in `EvalResult` that records whether each reviewer ran in a separate context.

## Specific patch suggestions

### Patch 1: Add campaign state transition table
**File**: `docs/plans/2026-02-12-idea-generator-architecture-spec.md`
**Location**: After §2.3 (before §3)
**Add**:
```markdown
### 2.4 Campaign State Machine (formal)

| Current State   | Event / Method          | Next State      | Precondition                        |
|-----------------|-------------------------|-----------------|-------------------------------------|
| (none)          | campaign.init           | running         | —                                   |
| running         | campaign.pause          | paused          | —                                   |
| running         | campaign.complete       | completed       | —                                   |
| running         | budget exhausted        | exhausted       | circuit breaker fires               |
| running         | step_budget exhausted   | running*        | early_stopped in step, campaign OK  |
| running         | search.step early stop  | early_stopped   | global budget < min_step_cost       |
| paused          | campaign.resume         | running         | budget_remaining > 0                |
| paused          | campaign.complete       | completed       | —                                   |
| paused          | campaign.topup          | paused          | budget increased                    |
| early_stopped   | campaign.resume         | running         | budget_remaining > min_step_cost    |
| early_stopped   | campaign.topup          | early_stopped   | budget increased                    |
| early_stopped   | campaign.complete       | completed       | —                                   |
| exhausted       | campaign.topup          | early_stopped** | budget increased; resume needed     |
| exhausted       | campaign.complete       | completed       | —                                   |
| completed       | (any mutation)          | (rejected)      | campaign_not_active                 |

\* The campaign stays `running`; the step result has `early_stopped=true`.
\** After topup from exhausted, the campaign transitions to `early_stopped` (not directly to `running`), requiring an explicit `campaign.resume` to restart. This prevents accidental auto-restart.

Read-only methods (`campaign.status`, `node.get`, `node.list`) MUST succeed in any state (including `completed` and `exhausted`).
```

### Patch 2: Normalize `$ref` prefix convention
**File**: `schemas/campaign_init_result_v1.schema.json` (and all other schema files with `$ref`)
**Change**: Standardize all `$ref` to use `./` prefix:
```diff
-    "budget_snapshot": { "$ref": "budget_snapshot_v1.schema.json" },
+    "budget_snapshot": { "$ref": "./budget_snapshot_v1.schema.json" },
-    "island_states": { ... "items": { "$ref": "island_state_v1.schema.json" } },
+    "island_states": { ... "items": { "$ref": "./island_state_v1.schema.json" } },
-    "idempotency": { "$ref": "idempotency_meta_v1.schema.json" }
+    "idempotency": { "$ref": "./idempotency_meta_v1.schema.json" }
```
Apply the same `./` normalization to every `$ref` in: `campaign_status_v1`, `campaign_topup_result_v1`, `search_step_result_v1`, `node_list_result_v1`, `eval_result_v1`, `ranking_result_v1`, `promotion_result_v1`, `idea_node_v1`.

### Patch 3: Rename `campaign_topup_result_v1` → `campaign_mutation_result_v1`
**Files**: Rename `schemas/campaign_topup_result_v1.schema.json` → `schemas/campaign_mutation_result_v1.schema.json`
**Update** `$id` inside the file:
```diff
-  "$id": "campaign_topup_result_v1.schema.json",
+  "$id": "campaign_mutation_result_v1.schema.json",
```
**Update** all `$ref` references in `schemas/idea_core_rpc_v1.openrpc.json`:
```diff
-      "result": { "name": "campaign_mutation_result", "schema": { "$ref": "./campaign_topup_result_v1.schema.json" } },
+      "result": { "name": "campaign_mutation_result", "schema": { "$ref": "./campaign_mutation_result_v1.schema.json" } },
```
(Apply to `campaign.topup`, `campaign.pause`, `campaign.resume`, `campaign.complete`.)

### Patch 4: Add `min_nodes_for_elo` to `elo_config_v1.schema.json`
**File**: `schemas/elo_config_v1.schema.json`
```diff
   "required": ["max_rounds", "seed"],
   "properties": {
     "max_rounds": { ... },
-    "seed": { ... }
+    "seed": { ... },
+    "min_nodes": {
+      "type": "integer",
+      "minimum": 2,
+      "default": 2,
+      "description": "Minimum number of evaluated nodes required to run an Elo tournament. Engine returns insufficient_eval_data if fewer nodes are available."
+    }
   },
```

### Patch 5: Add `folklore_threshold` to `evaluator_config_v1.schema.json`
**File**: `schemas/evaluator_config_v1.schema.json`
```diff
     "debate_threshold": { "type": "number", "minimum": 0 },
+    "folklore_threshold": {
+      "type": "number",
+      "minimum": 0,
+      "maximum": 1,
+      "default": 0.7,
+      "description": "folklore_risk_score above this value triggers A0-folklore human review gate."
+    },
     "weights": { ... },
```

### Patch 6: Add idempotency staleness warning to spec
**File**: `docs/plans/2026-02-12-idea-generator-architecture-spec.md`
**Location**: §2.3, after the idempotency replay rules block
**Add**:
```markdown
   - **Staleness advisory (SHOULD)**: Callers SHOULD use a fresh `idempotency_key` for `rank.compute` and `eval.run` after any intervening `search.step` or `eval.run` that mutated the campaign's node set or eval data. Replaying a stale key will return the (correct but outdated) first-call result. The engine SHOULD NOT attempt to detect or warn about staleness; the discipline is on the caller side. Adapter implementations SHOULD auto-generate a new idempotency_key per logical operation (not reuse keys across distinct orchestrator commands).
```

### Patch 7: Add `seed_type` recommended enum to `seed_pack_v1.schema.json`
**File**: `schemas/seed_pack_v1.schema.json`
```diff
          "seed_type": {
-           "type": "string", "minLength": 1
+           "type": "string",
+           "minLength": 1,
+           "description": "Recommended values: c1_gap | pdg_tension | hepdata_anomaly | kb_prior | user_seed | conference_highlight. Custom types allowed."
          },
```

### Patch 8: Add concurrency note to OpenRPC description
**File**: `schemas/idea_core_rpc_v1.openrpc.json`
**Location**: `info.description`, append:
```diff
+\n\nConcurrency: The engine MUST serialize side-effecting calls within a campaign (no concurrent search.step or eval.run on the same campaign_id). Implementations MAY use per-campaign locks or queues. Concurrent calls to different campaigns are permitted. Read-only calls (campaign.status, node.get, node.list) MAY run concurrently with side-effecting calls.
```

### Patch 9: Add `exhausted → early_stopped` topup transition to OpenRPC
**File**: `schemas/idea_core_rpc_v1.openrpc.json`, `campaign.topup` method
```diff
      "description": "Monotonic, additive budget top-up. Permitted when campaign status is running|paused|early_stopped|exhausted. If the campaign is completed, the engine MUST reject the request with campaign_not_active.",
+     If the campaign status is exhausted, a successful topup MUST transition the campaign to early_stopped (requiring an explicit campaign.resume to restart). In all other permitted states, the status is unchanged by topup.
```

### Patch 10: Add `schema_version` to `idea_node_v1.schema.json`
**File**: `schemas/idea_node_v1.schema.json`
```diff
   "required": [
     "campaign_id",
+    "schema_version",
     "idea_id",
     ...
   ],
   "properties": {
+    "schema_version": { "const": "1", "description": "Wire-format version for forward-compatible parsing." },
     "campaign_id": { "type": "string", "format": "uuid" },
```
Apply similarly to `idea_card_v1.schema.json` and `campaign_charter_v1.schema.json`.
