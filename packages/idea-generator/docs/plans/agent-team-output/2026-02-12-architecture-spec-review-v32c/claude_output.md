VERDICT: NOT_READY

## Blockers

### B1. `campaign_mutation_result_v1.schema.json` — `allOf` conditional constraints are incomplete/incorrect for `pause` from `exhausted`

The spec (§2.4) says `campaign.pause` is permitted from `running|early_stopped|exhausted`. The `allOf` block for `mutation=pause` constrains `previous_status` to `["running", "early_stopped", "exhausted"]` and `current_status` to `"paused"` with `changed: true`. However, idempotency replay of a successful pause must also return `changed: true` and `current_status: "paused"`. If the campaign has *subsequently* been resumed and is now `running`, the replay still returns the original snapshot with `changed: true, current_status: paused`. This is fine per the idempotency semantics. **But**: the schema has no conditional for `pause` from `paused` (which is the idempotency replay case where `previous_status` *was* e.g., `running` at first-call time). This is actually OK as-is since replay returns the first response. No blocker here on closer inspection.

**Real blocker for `pause`**: The spec says `paused|completed → campaign_not_active` for `campaign.pause`. But `campaign.pause` from `paused` is NOT listed as valid in the state machine. The OpenRPC description says "Permitted when campaign status is running|early_stopped|exhausted" — calling `pause` when already `paused` should return `campaign_not_active`. This is consistent. ✓

### B1 (actual). `rank.compute` — Pareto minimum node count is under-specified between spec and schema

The spec (§2.3 point 1) says: "Pareto 要求筛选后节点数 ≥ 1（0 则 fail）". The OpenRPC description says: "For method=pareto, the filter MUST resolve to >= 1 node (a single node is allowed and yields rank=1)." But the `ranking_result_v1.schema.json` has `ranked_nodes.minItems: 1`, which is consistent. **However**, for Pareto to be meaningful, you need ≥ 2 dimensions (the spec and OpenRPC both say this for `dimensions`), but the spec also says Pareto on a single node is allowed. This is logically consistent but operationally questionable — **the real issue is that the schema for `rank.compute` in the OpenRPC lacks a `dimensions` parameter description that enforces `minItems: 2` for Pareto**. While the OpenRPC description text says "effective dimension count MUST be >= 2", the `dimensions` param schema says `minItems: 1`. Since dimensions can be omitted (engine infers from scorecards), the `minItems: 1` is fine for the *input*, but there's no schema-level enforcement that the *effective* dimension count is ≥ 2 for Pareto. This should be documented as a runtime-only check, or the schema should add a conditional.

**Actual Blocker**: The `rank.compute` `dimensions` parameter allows `minItems: 1` even when `method=pareto`, but the spec requires effective dimensions ≥ 2 for Pareto. Add a conditional `allOf` rule:

```json
{
  "if": { "properties": { "method": { "const": "pareto" }, "dimensions": { "type": "array" } }, "required": ["method", "dimensions"] },
  "then": { "properties": { "dimensions": { "minItems": 2 } } }
}
```

Without this, a caller can send `method=pareto, dimensions=["novelty"]` and the schema validator will accept it, but the engine must reject at runtime. This is a **contract enforceability gap**.

### B2. `eval_result_v1.schema.json` — Missing `campaign_status` field; inconsistent with other mutation results

Every other side-effecting result (`campaign_mutation_result`, `search_step_result`, `promotion_result`) includes either `campaign_status` or sufficient context to know current state. `eval.run` only returns `budget_snapshot` but not the campaign's current status. If `eval.run` drains the budget causing `running → exhausted`, the adapter cannot know the campaign transitioned without a separate `campaign.status` call. This breaks the observability principle stated in §1.1 ("全流程事件追加到账本").

**Fix**: Add optional `campaign_status` to `eval_result_v1.schema.json`, or at minimum add `campaign_status_after: { enum: [...] }` so the adapter can detect implicit transitions.

### B3. `search_step_result_v1.schema.json` — Missing `campaign_status` / `campaign_status_after` field

Same issue as B2. `search.step` can trigger `running → exhausted` or `running → early_stopped`. The result includes `island_states` and `budget_snapshot` but **not** the campaign-level status. The adapter must infer the campaign state from `early_stopped` boolean + budget remaining, which is fragile and violates the "machine-readable status transition" pattern used by `campaign_mutation_result_v1`.

**Fix**: Add `campaign_status_after: { enum: ["running", "exhausted", "early_stopped"] }` (required) to `search_step_result_v1.schema.json`.

### B4. `idea_node_v1.schema.json` — No `status` field for node lifecycle

The spec mentions "promote" and grounding gates, but `IdeaNode` has no explicit lifecycle status (e.g., `draft | evaluated | grounded | promoted | rejected`). Without this:
- `node.list` filter cannot filter by promotion status (the `idea_list_filter_v1` has `has_idea_card` and `grounding_status` but no `node_status`)
- There's no way to prevent double-promotion or to distinguish "evaluated but not yet promoted" from "promoted"
- The `idea_selection_v1` artifact tracks `selected_node_ids / rejected_node_ids / deferred_node_ids`, but this isn't reflected back into the node itself

**Fix**: Add `status: { enum: ["draft", "formalized", "evaluated", "promoted", "rejected", "deferred"] }` to `idea_node_v1.schema.json` (required, mutable). Add `status` to `idea_list_filter_v1.schema.json`.

### B5. `idea_handoff_c2_v1.schema.json` — Missing `rationale_draft` and `operator_trace` provenance

The C2 handoff is the terminal artifact entering the next phase. It includes `idea_card` and audit fields but omits `rationale_draft` (the "WHY"), `origin` (model/role provenance), and `operator_trace`. This means C2 loses:
- The motivation/intuition that drove the idea
- The model/temperature/prompt that generated it (needed for reproducibility audit)
- The operator family and evidence URIs used

The spec (§1.1) says "可审计" (auditable) and "可追溯" (traceable). A handoff without provenance breaks this.

**Fix**: Add `rationale_draft`, `origin`, and `operator_trace` (or their artifact refs) to `idea_handoff_c2_v1.schema.json`.

### B6. `campaign.topup` — Schema allows topup of unbounded dimensions without clear semantics

`budget_topup_v1.schema.json` note says: "If a dimension was originally unbounded... implementations SHOULD treat it as a no-op or reject." The word "SHOULD" here is insufficient — this is a **semantic ambiguity** that will cause implementation divergence. If `max_steps` was not set in the original `BudgetEnvelope` (optional field), and someone sends `add_steps: 100`, what happens?

The `budget_snapshot_v1` returns `steps_remaining: null` when `max_steps` was not set. After a topup of `add_steps: 100`, should `steps_remaining` become `100`? Or remain `null`? This needs to be MUST-level.

**Fix**: Change to MUST: "If a dimension was not set in the original BudgetEnvelope (treated as unbounded), the engine MUST reject a topup for that dimension with `schema_validation_failed` (reason: `topup_on_unbounded_dimension`)." Add this reason to the known_reasons list.

## Non-blocking

### N1. `idea_campaign_v1.schema.json` vs `campaign_status_v1.schema.json` — Redundant structures

`idea_campaign_v1` contains essentially the same fields as `campaign_status_v1` plus `charter` and `seed_pack_ref`. The `$comment` says "intentionally denormalized" but doesn't explain when to use which. Clarify in the spec: `campaign_status_v1` is the RPC response schema; `idea_campaign_v1` is the SSOT artifact for persistence/export. Consider having `idea_campaign_v1` embed `campaign_status_v1` via `$ref` to reduce drift risk.

### N2. `idea_scorecards_v1.schema.json` — Score key validation is weak

`scores` is `additionalProperties: { "type": "number" }`, meaning any string key is valid. It should at least document (or validate) that keys should come from `EvaluatorConfig.dimensions`. A `propertyNames` constraint or at least a note in the description would help.

### N3. `island_state_v1.schema.json` — Missing `operator_ids` / `operator_weights`

The spec (§3.1–3.2) describes operators assigned per island and bandit-weighted scheduling. `IslandState` doesn't expose which operators are active or their weights. This limits observability of the Distributor's allocation decisions.

**Suggestion**: Add optional `active_operators: array<{operator_id, weight}>`.

### N4. `elo_config_v1.schema.json` — Missing dimension selection for Elo

Elo tournaments compare nodes, but the spec doesn't clarify which dimension(s) the Elo judge uses for comparison. Is it a composite score? A single dimension? The `elo_config` has no `dimension` or `comparison_strategy` field.

**Suggestion**: Add `comparison_dimensions` (array, optional) and `comparison_strategy` (enum: `composite_weighted | single_dimension | holistic_judge`) to `elo_config_v1`.

### N5. `formalism_registry_v1.schema.json` — No uniqueness constraint on `formalism_id`

The schema allows duplicate `formalism_id` values in the `entries` array. JSON Schema can't enforce array-element uniqueness on a specific property, but the spec should document MUST-level uniqueness and the engine should enforce it at runtime.

### N6. OpenRPC `x-error-data-contract` — Not a standard OpenRPC extension point

`x-error-data-contract` is a vendor extension. This is fine but should be documented as such. More importantly, individual method error definitions don't reference the `rpc_error_data_v1.schema.json` — there's no schema-level guarantee that error responses conform to it. Consider adding `x-error-data-schema` to each error definition.

### N7. `budget_snapshot_v1.schema.json` — `wall_clock_s_remaining` semantics with idempotency replay

On idempotency replay, the returned `budget_snapshot` is a stale snapshot from first execution. For `wall_clock_s_remaining`, this is especially misleading (time has passed). The spec already notes callers should use `campaign.status` for current budget, but `wall_clock_s_remaining` is uniquely problematic because it's the only dimension that changes without any RPC interaction. Consider flagging it specifically in the `IdempotencyMeta` description or adding a `snapshot_at` timestamp to `BudgetSnapshot`.

**Suggestion**: Add `snapshot_at: { type: "string", format: "date-time" }` (required) to `budget_snapshot_v1.schema.json`.

### N8. `eval.run` — Missing `evaluator_config` echo in `eval_result_v1`

The result doesn't echo which config was used. For auditability, the `scorecards_artifact_ref` artifact contains it, but the direct RPC response doesn't. Minor audit gap.

### N9. `node_mutation_log_v1.schema.json` — No constraint that `after_revision > before_revision`

The schema has both fields as `minimum: 1` but doesn't enforce ordering. Add a note or consider a custom keyword / description-level MUST.

### N10. `search_step_result_v1.schema.json` — `n_steps_executed` can be 0

If the engine immediately hits a budget fuse before completing even one tick, `n_steps_executed=0` with `early_stopped=true`. This is semantically correct but should be explicitly documented as valid. Currently the schema allows it (`minimum: 0`) but neither the spec nor OpenRPC description calls it out.

## Real-research fit

### R1. HEP evidence grounding is well-designed

The four-layer grounding audit (URI resolution → data consistency → inference transparency → folklore pre-screening) maps well to real HEP research workflows. The mandatory `evidence_uris` with active resolution (not just format checks) is critical — phantom citations are a real problem in LLM-generated physics. The `folklore_risk_score` with human escalation is a pragmatic middle ground.

### R2. Operator families map to real discovery patterns

The operator taxonomy (`AnomalyAbduction`, `SymmetryOperator`, `LimitExplorer`, `CrossDomainAnalogy`, etc.) reflects genuine scientific reasoning patterns. The `RepresentationShift` operator is particularly important for theoretical physics (e.g., switching from coordinate space to momentum space, or employing a dual description). The `ProtectiveBeltPatch` (Lakatos) operator captures how real theorists extend models when confronted with anomalies.

### R3. Two-stage Explain-Then-Formalize captures real workflow

Physicists genuinely think in two modes: intuitive/analogical exploration followed by mathematical formalization. Forcing `RationaleDraft → IdeaCard` mirrors how real papers are structured (Introduction/motivation → Formalism/calculations). The `kill_criteria` in `RationaleDraft` enforces the Popperian discipline that distinguishes real physics from speculation.

### R4. Multi-island evolution needs clearer HEP semantics

The multi-island model is promising but the mapping to HEP research is underspecified. In practice, "islands" in HEP ideation correspond to distinct theoretical frameworks or phenomenological approaches (e.g., "SUSY explanations" vs "composite Higgs" vs "extra dimensions" for a given anomaly). The `island_id` is a string — consider providing guidance on naming conventions (e.g., `hep-ph/susy-explanation`, `hep-th/ads-cft-inspired`) and how islands map to DomainPack constraints.

### R5. Missing: experimental constraint integration timeline

The spec mentions PDG/HEPData but doesn't specify how time-dependent experimental constraints (new results from LHC Run 3, Belle II, etc.) are incorporated. A real research idea that's viable today may be excluded by next month's data. Consider adding a `constraint_vintage` or `data_cutoff_date` field to `CampaignCharter` or `IdeaCard`.

### R6. Compute plan difficulty estimates are appropriately granular

The `minimal_compute_plan` with `estimated_difficulty`, `estimated_compute_hours_log10`, and `required_infrastructure` is exactly what a method-design phase (C2) needs to prioritize. The `blockers` field captures real research risks. The `not_yet_feasible` infrastructure level is an honest acknowledgment that some ideas exceed current computational capabilities.

## Robustness & safety

### S1. Idempotency design is thorough but has an atomicity concern

The spec requires "idempotency record committed atomically with side-effects." For a JSONL-based store (v0.x non-goal to have a real DB), achieving atomicity between "write nodes to JSONL" and "write idempotency record" is non-trivial. A crash between the two writes creates an inconsistent state. The spec should acknowledge this and recommend a strategy (e.g., write-ahead log, or a single atomic append containing both the idempotency record and the side-effect data).

### S2. Hallucination mitigation is multi-layered (good)

The design has at least four hallucination barriers:
1. Active URI resolution (no phantom citations)
2. Data consistency checks against PDG/HEPData
3. Clean-room multi-agent evaluation (reviewers can't collude)
4. Structured debate with evidence URIs when disagreements arise

This is significantly more robust than typical LLM pipelines. The `folklore_risk_score` adds a fifth layer specifically targeting the "rediscovery-as-novelty" failure mode.

### S3. Budget circuit breaker is well-specified but degradation order needs more guidance

The `degradation_order` enum is a good starting point, but the spec doesn't define the thresholds that trigger each degradation level. Without thresholds, implementers will make ad-hoc choices. Consider adding `degradation_thresholds` to `BudgetEnvelope.extensions` with recommended defaults.

### S4. Campaign isolation is strong

The `node_not_in_campaign` check with atomic rejection (no partial writes) is the right call for preventing cross-campaign contamination. This is especially important for an evidence-first system where provenance chains must be clean.

### S5. Missing: Rate limiting / abuse prevention for LLM calls

The budget envelope caps total cost, but there's no per-minute/per-second rate limit for LLM API calls. A `search.step(n_steps=100)` could fire hundreds of concurrent LLM requests, hitting API rate limits and causing unpredictable failures. Consider adding `max_concurrent_llm_calls` and `max_rpm` to `BudgetEnvelope.extensions`.

### S6. Payload hash canonicalization (JCS/RFC 8785) is the right choice

Using RFC 8785 for deterministic hashing avoids the common pitfall of JSON key ordering differences causing false idempotency conflicts. The explicit call-out of default-value filling before hashing is important — this prevents `{limit: 50}` vs `{}` from being treated as different payloads.

### S7. Missing: Schema version negotiation

All schemas are `v1` but there's no version negotiation in the RPC. If `idea-core` is updated to v2 schemas while the adapter still sends v1, behavior is undefined. Consider adding `schema_version` to the OpenRPC `info` or as a parameter to `campaign.init`.

## Specific patch suggestions

### Patch 1: `schemas/search_step_result_v1.schema.json` — Add `campaign_status_after`

**File**: `schemas/search_step_result_v1.schema.json`

Add to `required`:
```json
"required": [
  "campaign_id", "step_id", "n_steps_requested", "n_steps_executed",
  "new_node_ids", "updated_node_ids", "island_states",
  "budget_snapshot", "idempotency", "campaign_status_after"
]
```

Add to `properties`:
```json
"campaign_status_after": {
  "enum": ["running", "exhausted", "early_stopped"],
  "description": "Campaign-level status after this search.step completes. Enables adapter to detect implicit status transitions (e.g., running→exhausted) without a separate campaign.status call."
}
```

### Patch 2: `schemas/eval_result_v1.schema.json` — Add `campaign_status_after`

**File**: `schemas/eval_result_v1.schema.json`

Add to `required` and `properties`:
```json
"campaign_status_after": {
  "enum": ["running", "exhausted"],
  "description": "Campaign-level status after this eval.run completes."
}
```

### Patch 3: `schemas/idea_node_v1.schema.json` — Add node lifecycle `status`

**File**: `schemas/idea_node_v1.schema.json`

Add to `required` array: `"status"`

Add to `properties`:
```json
"status": {
  "enum": ["draft", "formalized", "evaluated", "promoted", "rejected", "deferred"],
  "description": "Node lifecycle status. 'draft' = created with rationale_draft only; 'formalized' = idea_card attached; 'evaluated' = eval_info populated; 'promoted' = passed all gates and handoff produced; 'rejected'/'deferred' = selection decision applied. MUTABLE."
}
```

### Patch 4: `schemas/idea_list_filter_v1.schema.json` — Add `status` filter

**File**: `schemas/idea_list_filter_v1.schema.json`

Add to `properties`:
```json
"status": {
  "enum": ["draft", "formalized", "evaluated", "promoted", "rejected", "deferred"],
  "description": "Filter by node lifecycle status."
}
```

### Patch 5: `schemas/idea_handoff_c2_v1.schema.json` — Add provenance fields

**File**: `schemas/idea_handoff_c2_v1.schema.json`

Add to `required`: `"rationale_draft"`, `"origin"`

Add to `properties`:
```json
"rationale_draft": { "$ref": "./rationale_draft_v1.schema.json" },
"origin": {
  "type": "object",
  "required": ["model", "temperature", "prompt_hash", "timestamp", "role"],
  "properties": {
    "model": { "type": "string", "minLength": 1 },
    "temperature": { "type": "number", "minimum": 0 },
    "prompt_hash": { "type": "string", "pattern": "^sha256:[a-f0-9]{64}$" },
    "timestamp": { "type": "string", "format": "date-time" },
    "role": { "type": "string", "minLength": 1 }
  },
  "additionalProperties": false
},
"operator_trace_ref": {
  "type": "string",
  "format": "uri",
  "description": "Artifact ref to the full operator trace for reproducibility audit."
}
```

### Patch 6: `schemas/idea_core_rpc_v1.openrpc.json` — Add Pareto dimensions conditional to `rank.compute`

**File**: `schemas/idea_core_rpc_v1.openrpc.json`

In the `rank.compute` method, the `dimensions` param schema should add a note or (since OpenRPC doesn't support cross-param conditionals natively) the method description should be strengthened:

Replace in `rank.compute` description, after "effective dimension count MUST be >= 2":
```
Note: the dimensions parameter schema allows minItems=1 because dimensions may be omitted (engine infers). When explicitly provided with method=pareto, callers SHOULD provide >= 2 dimensions; the engine MUST reject with insufficient_eval_data if the effective count is < 2.
```

### Patch 7: `schemas/budget_snapshot_v1.schema.json` — Add `snapshot_at` timestamp

**File**: `schemas/budget_snapshot_v1.schema.json`

Add to `required`: `"snapshot_at"`

Add to `properties`:
```json
"snapshot_at": {
  "type": "string",
  "format": "date-time",
  "description": "Timestamp when this snapshot was taken. Critical for interpreting wall_clock_s_remaining correctly, especially on idempotency replay where the snapshot may be stale."
}
```

### Patch 8: `schemas/budget_topup_v1.schema.json` — Strengthen unbounded-dimension semantics

**File**: `schemas/budget_topup_v1.schema.json`

Replace the `description`:
```json
"description": "Monotonic budget top-up request for an existing campaign. At least one field must be provided. All fields must be non-negative. MUST constraint: If a dimension was not set in the original BudgetEnvelope (treated as unbounded), the engine MUST reject a topup targeting that dimension with schema_validation_failed (reason: topup_on_unbounded_dimension). This prevents silent semantic ambiguity."
```

### Patch 9: `schemas/rpc_error_data_v1.schema.json` — Add missing known reasons

**File**: `schemas/rpc_error_data_v1.schema.json` (and the OpenRPC `x-error-data-contract.known_reasons`)

Add `topup_on_unbounded_dimension` to the `-32002` known reasons list in the OpenRPC file:
```json
"-32002": ["schema_invalid", "idempotency_key_conflict", "elo_config_required", "elo_config_unexpected", "topup_on_unbounded_dimension"]
```

### Patch 10: `docs/plans/2026-02-12-idea-generator-architecture-spec.md` — Add atomicity guidance for JSONL store

**File**: `docs/plans/2026-02-12-idea-generator-architecture-spec.md`

After §2.3, point 2 (Idempotency MUST), add:

```markdown
   **v0.x atomicity strategy (JSONL/file-backed store)**：对于无事务支持的 file-backed 存储（如 JSONL），建议采用以下策略实现"逻辑原子提交"：
   - 使用单一 append 操作将 `(side-effect data, idempotency record)` 写入同一文件（或使用 write-ahead log 模式：先写 WAL，再 apply）
   - 启动时执行 crash recovery：检查 WAL 中未完成的事务并回滚/重放
   - 这确保不会出现"副作用已写但 idempotency 未记录"的不可见状态
```

### Patch 11: `docs/plans/2026-02-12-idea-generator-architecture-spec.md` — Add data vintage to campaign charter

**File**: `docs/plans/2026-02-12-idea-generator-architecture-spec.md`

In §8.1, after the seed sources list, add:

```markdown
- **数据截止日期（推荐）**：`CampaignCharter.extensions` 建议包含 `data_cutoff_date`（ISO 8601），标明该 campaign 所依赖实验数据的时间截点（例如 PDG 2024 edition / LHCb Run 2 full dataset）。Grounding audit 在检查数据一致性时应尊重此截点（不引用更新的结果作为反驳依据，除非显式标注为"新约束 → 需要重新评估"）。
```

And add to `schemas/campaign_charter_v1.schema.json` in `extensions` description:

```json
"description": "DomainPack-specific knobs (kept out of the stable surface). Recommended keys: data_cutoff_date (ISO 8601 date string), cross_domain_packs (array of pack IDs), team_cost_multiplier (number)."
```
