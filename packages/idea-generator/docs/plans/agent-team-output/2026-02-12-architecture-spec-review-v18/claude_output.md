VERDICT: NOT_READY

## Blockers

### B1. `campaign.topup` state-machine spec vs. OpenRPC description inconsistency on `early_stopped`

**Spec §2.4** says `campaign.topup` transition is `running|paused|early_stopped|exhausted → (same state)` — topup does NOT change state for `early_stopped`. The OpenRPC description for `campaign.topup` correctly says "If status is early_stopped (policy halt, not budget), topup adds budget but does NOT change the status."

**However**, `campaign.topup` does not list `campaign_not_active` for the `completed` state in its error list — wait, it does list `-32015`. OK, that's fine. But the OpenRPC `description` says:

> "If status is exhausted, successful topup MUST transition campaign status to running **only if** the campaign is no longer budget-exhausted"

This is correct. But the **spec §2.4** says:

> `campaign.topup`: `running|paused|early_stopped|exhausted → (same state)`; 若当前为 `exhausted`，topup 后**若预算已不再耗尽则转为 `running`**

This means for `exhausted → running` (conditional) the "same state" claim is false. The parenthetical corrects it, but the **summary line** contradicts the detailed rule. An implementer reading only the summary would get it wrong.

**Fix required**: Rewrite the summary transition to `exhausted → running|exhausted (conditional)` explicitly.

### B2. `campaign.resume` from `exhausted` — spec says MUST return `budget_exhausted`, but OpenRPC `description` says "callable when ... exhausted"

The spec §2.4 says: "若对 `status=exhausted` 调用 `campaign.resume`，必须返回 `budget_exhausted`（不改变状态）."

The OpenRPC description says: "Callable when campaign status is paused|early_stopped|exhausted." This phrasing implies it's _permitted_ from `exhausted`, but then goes on to say it returns `budget_exhausted`. The word "callable" is misleading — "callable" typically implies "will succeed". Should say "Accepted when status is paused|early_stopped. When status is exhausted, the engine MUST reject with budget_exhausted (-32001) without state change."

**Why this is a blocker**: An automated conformance test generator reading `"Callable when ... exhausted"` would classify `exhausted → budget_exhausted` as an error _path_ rather than the primary behavior. The ambiguity makes machine-generated test harnesses unreliable.

### B3. Missing `campaign_status` field in `campaign.init` result — how does the caller know the initial status?

`campaign_init_result_v1.schema.json` returns `campaign_id`, `created_at`, `budget_snapshot`, `island_states`, `idempotency` — but **not** the campaign `status` field. Every other mutation result wraps a full `CampaignStatusV1` (via `campaign_mutation_result`), so the caller can always see current state. But `campaign.init` is the one place where the caller doesn't get the status back.

The spec says `campaign.init` transitions to `running`. An implementer should return that. But the schema doesn't include it, so a strict validator cannot verify it.

**Fix required**: Either add `"status": { "const": "running" }` to `campaign_init_result_v1.schema.json`, or restructure it to embed `campaign_status` like the mutation results do.

### B4. `node.list` pagination: `cursor` is required in the result but there's no way to distinguish "first page with no cursor input" from "filter returned nothing"

In `node_list_result_v1.schema.json`, `cursor` is `required` and typed as `["string", "null"]`. That's fine. But the `node.list` **params** define `cursor` as `{ "type": "string", "minLength": 1 }` with no `required: true`. This means:
- First call: omit `cursor` → get page 1
- Last page: `cursor: null` in response → done

This is correct and standard. **Not a blocker per se.**

However, `total_count` is required. For large campaigns, computing exact `total_count` on every paginated call can be expensive. Consider making it optional or adding a note that it may be approximate. This is minor but worth flagging.

**Actual blocker**: The `limit` param has `"default": 50` in the OpenRPC schema. JSON Schema `default` is an annotation, not enforcement — if the engine doesn't read OpenRPC annotations at runtime, it has no page size default, and an omitted `limit` could return unbounded results. The schema says `"maximum": 500` but without `required: true`, the engine behavior on missing `limit` is undefined. Either make `limit` required or document that the engine MUST treat missing `limit` as 50.

### B5. Idempotency key conflict detection requires payload hashing — no spec for what constitutes "same payload"

The spec says: "若同一 (method, campaign_id?, idempotency_key) 被复用但 **输入 payload 不一致**, engine 必须返回 `schema_validation_failed` + `idempotency_key_conflict`."

But "input payload" is never defined. For `search.step`, does `step_budget` difference count? Does `n_steps` difference count? For `eval.run`, if the `evaluator_config.weights` differ slightly, is that a conflict?

**Fix required**: Specify that conflict detection is based on **all params except `idempotency_key` itself** — canonicalized JSON (sorted keys, no whitespace) then SHA-256 hashed. Store `payload_hash` alongside the idempotency record. This makes the contract testable.

### B6. `budget_snapshot_v1.schema.json` — `steps_remaining` and `nodes_remaining` are not `required` but are used in exhaustion checks

`steps_used` is required, `steps_remaining` is not required (it's `oneOf [integer, null]`). But `steps_remaining` is critical for the budget circuit breaker to determine if the campaign is exhausted. If the engine omits `steps_remaining` (schema allows it since it's not in `required`), the adapter cannot determine exhaustion.

**Fix**: Either make `steps_remaining` and `nodes_remaining` required (with null for unbounded), or add them to `required`. Currently they're defined but not required — a compliant engine could omit them entirely.

## Non-blocking

### N1. `eval_result_v1.schema.json` doesn't include per-node scores inline

The result only has `scorecards_artifact_ref` (a URI). This means the adapter must do a second fetch to see scores. For observability, consider adding an optional inline `scores_summary` array (node_id → dimension → score) so the adapter can do basic triage without dereferencing the artifact.

### N2. `evaluator_config_v1.schema.json` — `weights` keys are unconstrained

`weights` is `additionalProperties: { "type": "number" }` with no enum constraint on keys. Since `dimensions` is an enum, `weights` keys should be validated against the same enum (or at least documented that they must match `dimensions` entries). A `propertyNames` constraint or runtime check should enforce this.

### N3. `idea_card_v1.schema.json` — `claims` with `support_type: "data"` don't require numerical values

The spec §4.2.1 says "support_type=data 的数值类 claim 必须与 PDG/HEPData 在约定容差内一致". But the schema has no field for the actual numerical value or the reference value or the tolerance. This is a runtime audit concern, but the schema should at least have optional `numerical_value`, `reference_value`, `tolerance` fields for data claims to make the audit machine-actionable.

### N4. `formalism_registry_v1.schema.json` — `c2_schema_ref` is `format: "uri"` but likely a relative path

In practice, C2 schemas will be local files. Consider accepting `uri-reference` instead of `uri` (JSON Schema format) to avoid requiring absolute URIs for local schemas.

### N5. `search_step_result_v1.schema.json` — `new_nodes_artifact_ref` conditional is good but fragile

The `allOf` conditional requiring `new_nodes_artifact_ref` when `new_node_ids` is non-empty is well-designed. However, JSON Schema `if/then` with array `minItems` is notoriously tricky across validators. Recommend adding an integration test specifically for this conditional.

### N6. Campaign status machine — no `failed` state

If `campaign.init` partially fails (e.g., seed validation passes but island creation fails), the campaign is in limbo. Consider a `failed` terminal state for unrecoverable initialization errors, or specify that `campaign.init` is atomic (all-or-nothing).

### N7. `island_state_v1.schema.json` — missing `operator_weights` or `active_operators`

The spec §3.2.1 discusses operator/strategy configuration per island, but `IslandState` only exposes `island_id`, `state`, `population_size`, etc. There's no observability into which operators are active or their current bandit weights. Consider an optional `active_operators` or `operator_distribution` field.

### N8. `idea_node_v1.schema.json` — `eval_info.failure_modes` is `array of string` (free text) while `fix_suggestions[].failure_mode` is an enum

This inconsistency could cause confusion. Consider making `failure_modes` also typed (enum + free-text extension) or renaming one to distinguish structured vs. unstructured diagnostics.

### N9. OpenRPC `x-error-data-contract` is non-standard

`x-error-data-contract` is a custom extension. This is fine for internal use, but tooling (OpenRPC generators, validators) will ignore it. Document that conformance tests must check this manually.

### N10. `rank.compute` with `method=pareto` allows 1 node; spec says "filter MUST resolve to >= 1 node"

This is technically correct (a single node is trivially on the Pareto front) but potentially surprising. Document this edge case explicitly so adapters don't treat rank=1 with 1 node as a meaningful signal.

## Real-research fit

### R1. Evidence-first provenance chain is well-designed

The `claims[] → support_type + evidence_uris → grounding_audit → promotion gate` chain is the right architecture for HEP. The active URI resolution requirement (not just format checks) is critical and well-specified. The `folklore_risk_score` is a pragmatic addition — many "new" HEP ideas are rediscoveries of known folklore.

### R2. Operator families map well to actual HEP discovery patterns

`SymmetryOperator`, `LimitExplorer`, and `AnomalyAbduction` correspond to real methodologies in hep-ph/hep-th. The `CrossDomainAnalogy` with mandatory mapping table is particularly good — it forces the system to articulate *what* structural correspondence exists rather than making vague analogies.

### R3. Multi-island evolution is appropriate for HEP idea generation

HEP research naturally has competing paradigms (e.g., SUSY vs composite Higgs vs extra dimensions for BSM physics). The island model with repopulation captures this well. The stagnation detection is sensible.

### R4. IdeaCard compute plan is realistic but incomplete

The `minimal_compute_plan` with `estimated_difficulty` and `required_infrastructure` fields is practical. The `estimated_compute_hours_log10` is a smart way to handle the enormous range (seconds to years). However:
- Missing: dependency ordering between compute steps. A `depends_on` field (referencing other step indices) would prevent the C2 handoff from receiving an unsequenced bag of tasks.
- Missing: `success_criterion` per step — how does C2 know if a computation succeeded?

### R5. The Explain-Then-Formalize pipeline matches theoretical physics practice

Physicists genuinely work this way: intuition/analogy first, then formalization. The forced separation prevents premature formalization (which kills creative ideas) while ensuring nothing unformalizable reaches downstream.

### R6. Gap: No mechanism for "negative results" or "killed ideas" to inform future campaigns

When a grounding audit fails or an idea is killed, that information is valuable for future campaigns (avoid regenerating the same dead end). The current design records failures on nodes but has no cross-campaign knowledge propagation mechanism. This is acceptable for v0.2 but should be flagged for v0.3.

## Robustness & safety

### S1. Idempotency is well-specified but needs explicit storage requirements

The idempotency spec is thorough (replay semantics, conflict detection, retention period). However:
- No mention of storage format or size bounds. For long-running campaigns with many `search.step` calls, the idempotency store (which must retain full responses for replay) could grow large.
- Recommend: specify that idempotency records store `(method, campaign_id, idempotency_key, payload_hash, response_bytes, created_at)` and that implementations MAY compress stored responses.

### S2. Campaign isolation is strong but untested for the JSONL storage backend

The spec mandates strict campaign scoping, but the suggested v0.x storage is JSONL. JSONL files don't have built-in scoping — a bug in the file reader could easily leak nodes across campaigns. Recommend: campaign-scoped file paths (e.g., `artifacts/{campaign_id}/idea_candidates_v1.jsonl`) as a MUST.

### S3. Hallucination mitigation is well-layered

Three layers: (1) claim-level `support_type` forcing explicit labeling, (2) grounding audit with active URI resolution, (3) promotion gate blocking `partial/fail`. This is good. The `verification_plan` requirement for `llm_inference`/`assumption` is critical.

### S4. Clean-room evaluation prevents collusion but may miss synthesis

The strict clean-room default (evaluators don't share drafts) prevents groupthink but could miss cases where two evaluators have complementary evidence. The structured debate trigger (Δscore > threshold) is a good compromise. Consider also triggering debate on `support_type` disagreement (one reviewer finds literature support, another doesn't).

### S5. Budget circuit breaker lacks hysteresis

The `exhausted → running` transition on topup happens immediately when `remaining > 0`. But if `remaining` is barely above 0 (e.g., 1 token remaining), the next operation will immediately re-exhaust. Consider a minimum viable budget threshold for the `exhausted → running` transition (e.g., `remaining > min_step_cost`).

### S6. `max_cost_usd` requires real-time cost tracking

Budget envelope includes `max_cost_usd`, but tracking actual USD cost requires knowing per-model pricing, which changes over time. The schema doesn't specify how cost is calculated. This should be documented (e.g., "cost is computed using the model pricing table in the Distributor configuration at the time of the call").

## Specific patch suggestions

### Patch 1: Fix `campaign_init_result_v1.schema.json` — add `status` field (Blocker B3)

**File**: `schemas/campaign_init_result_v1.schema.json`

Add `"status"` to `required` array and add the property:

```json
"status": {
  "const": "running",
  "description": "Initial campaign status. Always 'running' on successful init."
}
```

Alternatively, restructure to embed full `campaign_status`:

```json
{
  "required": ["campaign_id", "campaign_status", "idempotency"],
  "properties": {
    "campaign_id": { "type": "string", "format": "uuid" },
    "campaign_status": { "$ref": "./campaign_status_v1.schema.json" },
    "idempotency": { "$ref": "./idempotency_meta_v1.schema.json" }
  }
}
```

This makes `campaign.init` consistent with all other mutation results and avoids special-casing.

### Patch 2: Fix `budget_snapshot_v1.schema.json` — make nullable fields required (Blocker B6)

**File**: `schemas/budget_snapshot_v1.schema.json`

Change `required` to include `steps_remaining` and `nodes_remaining`:

```json
"required": [
  "tokens_used", "tokens_remaining",
  "cost_usd_used", "cost_usd_remaining",
  "wall_clock_s_elapsed", "wall_clock_s_remaining",
  "steps_used", "steps_remaining",
  "nodes_used", "nodes_remaining"
]
```

These are already typed as `oneOf [integer, null]` — making them required just means the engine must explicitly say `null` when the dimension is uncapped, which is the correct observability behavior.

### Patch 3: Fix spec §2.4 topup transition summary (Blocker B1)

**File**: `docs/plans/2026-02-12-idea-generator-architecture-spec.md`

Replace:
```
- `campaign.topup`：`running|paused|early_stopped|exhausted → (same state)`
```

With:
```
- `campaign.topup`：`running|paused|early_stopped → (same state)` ∪ `exhausted → running|exhausted`（conditional：topup 后若所有受限维度 remaining > 0 则转 `running`，否则保持 `exhausted`）
```

### Patch 4: Fix `campaign.resume` OpenRPC description ambiguity (Blocker B2)

**File**: `schemas/idea_core_rpc_v1.openrpc.json`

In the `campaign.resume` method, replace the `description`:

```json
"description": "Side-effecting. Transitions paused|early_stopped → running. If status is exhausted, the engine MUST reject with budget_exhausted (-32001) without changing state; caller should campaign.topup first. If campaign is completed, returns campaign_not_active (-32015). Not permitted from running (no-op or campaign_not_active at implementer's discretion)."
```

### Patch 5: Specify idempotency payload hashing (Blocker B5)

**File**: `docs/plans/2026-02-12-idea-generator-architecture-spec.md`

In §2.3, after the "Key 冲突" bullet, add:

```markdown
   - **Payload identity 定义（必须可测试）**：payload 不一致的判定应基于除 `idempotency_key` 之外的所有请求参数的 canonical JSON 表示（键排序、无多余空白、UTF-8 NFC 归一化）的 SHA-256 摘要。engine 应在首次执行时存储该摘要（`payload_hash`），后续相同 `(method, campaign_id?, idempotency_key)` 的请求必须比对 `payload_hash`。
```

Also add to `idempotency_meta_v1.schema.json`:

```json
"payload_hash": {
  "type": "string",
  "pattern": "^sha256:[a-f0-9]{64}$",
  "description": "SHA-256 of the canonical request payload (excluding idempotency_key) stored for conflict detection."
}
```

And add `"payload_hash"` to the `required` array.

### Patch 6: Add `node.list` `limit` default enforcement note (Blocker B4)

**File**: `schemas/idea_core_rpc_v1.openrpc.json`

In `node.list`, change the `limit` parameter:

```json
{
  "name": "limit",
  "schema": { "type": "integer", "minimum": 1, "maximum": 500 },
  "required": false,
  "description": "Page size. Engine MUST treat omitted limit as 50. Maximum 500."
}
```

Remove the `"default": 50` from the schema (it's unenforceable) and put it in the description as a MUST.

### Patch 7: Add `depends_on` to compute plan steps (Non-blocking R4)

**File**: `schemas/idea_card_v1.schema.json`

In `minimal_compute_plan.items.properties`, add:

```json
"step_id": {
  "type": "string",
  "minLength": 1,
  "description": "Unique identifier for this step within the compute plan."
},
"depends_on": {
  "type": "array",
  "items": { "type": "string", "minLength": 1 },
  "description": "Step IDs that must complete before this step. Empty or omitted means no dependencies."
},
"success_criterion": {
  "type": "string",
  "minLength": 1,
  "description": "Observable criterion for determining if this computation step succeeded."
}
```

### Patch 8: Add budget hysteresis threshold (Safety S5)

**File**: `schemas/budget_envelope_v1.schema.json`

Add:

```json
"min_viable_budget": {
  "type": "object",
  "description": "Minimum budget that must remain after topup for exhausted→running transition. Prevents oscillation between exhausted and running when budget is barely above zero.",
  "properties": {
    "min_tokens": { "type": "integer", "minimum": 1 },
    "min_cost_usd": { "type": "number", "exclusiveMinimum": 0 },
    "min_wall_clock_s": { "type": "number", "exclusiveMinimum": 0 }
  },
  "additionalProperties": false
}
```

Update the spec §2.4 `campaign.topup` exhausted transition to reference this threshold.

### Patch 9: Enforce campaign-scoped storage paths (Safety S2)

**File**: `docs/plans/2026-02-12-idea-generator-architecture-spec.md`

In §5.1, add:

```markdown
**存储路径约定（v0.x JSONL 后端必须）**：所有 campaign-scoped artifacts 必须存储在 `artifacts/{campaign_id}/` 下（例如 `artifacts/{campaign_id}/idea_candidates_v1.jsonl`），以物理隔离防止跨 campaign 泄漏。Idempotency store 同理：`artifacts/{campaign_id}/.idempotency/`（`campaign.init` 的 idempotency 记录存于全局 `artifacts/.idempotency/`）。
```

### Patch 10: Add `"promoted"` to `grounding_status` filter and IdeaNode lifecycle (Non-blocking)

**File**: `schemas/idea_list_filter_v1.schema.json`

Add a `promoted` filter:

```json
"is_promoted": { "type": "boolean", "description": "Filter nodes by promotion status." }
```

This enables the adapter to quickly list all C2-handed-off ideas without scanning promotion results.
