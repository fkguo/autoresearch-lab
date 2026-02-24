VERDICT: NOT_READY

## Blockers

### B1. `campaign.topup` state-machine spec vs. OpenRPC description inconsistency

The architecture spec §2.4 states:

> `campaign.topup`: `running|paused|early_stopped → (same state)` ∪ `exhausted → running|exhausted`

But the OpenRPC `campaign.topup` description says:

> "Permitted when campaign status is running|paused|early_stopped|exhausted."

And the `campaign.pause` description says:

> "Permitted when campaign status is running|early_stopped|exhausted (running|early_stopped|exhausted → paused)."

This means `campaign.pause` can be called in `exhausted` state, transitioning to `paused`. Then if `campaign.topup` is called in `paused` state, the spec says it stays `paused`. But the caller's intent was to refill budget—now the campaign is paused with enough budget but no automatic path to `running`. The user must call `campaign.resume` after `campaign.topup`. This is **fine** but nowhere explicitly documented as the expected workflow for "exhausted → pause → topup → resume". More critically:

**The spec says `campaign.topup` in `early_stopped` keeps the state as `early_stopped` and does NOT auto-transition.** But what if the `early_stopped` was actually caused by budget exhaustion that triggered the search policy to stop? There's an ambiguity: the spec distinguishes `exhausted` (budget fuse) from `early_stopped` (search policy), but a search policy *could* stop due to `budget_remaining < min_step_cost` (§3.2.1: `STAGNANT → EXHAUSTED`). The island-level `EXHAUSTED` vs. campaign-level `exhausted` vs. `early_stopped` creates a three-way confusion. **This MUST be disambiguated before implementation.**

### B2. No `payload_hash` field in `idempotency_meta_v1.schema.json`

The spec (§2.3, item 2c) requires:

> `payload_hash = sha256(canonical_json(params_without_idempotency_key))`

But `idempotency_meta_v1.schema.json` only has `idempotency_key` and `is_replay`. The computed `payload_hash` is never surfaced in any response schema. This means:

1. Clients cannot verify that the engine computed the same hash they expect.
2. Debugging `idempotency_key_conflict` errors is opaque—the client doesn't know what hash the engine stored.

**Fix**: Add `payload_hash` (string, pattern `^sha256:[a-f0-9]{64}$`) to `idempotency_meta_v1.schema.json` and to `rpc_error_data_v1.schema.json`'s `details` for conflict errors.

### B3. `campaign.resume` from `exhausted` state: spec says reject, but state machine table is ambiguous

§2.4 transition table:

> `campaign.resume`: `paused|early_stopped → running`

And supplementary:

> 若对 `status=exhausted` 调用 `campaign.resume`，必须返回 `budget_exhausted`

But the OpenRPC description says:

> "If status is exhausted (or budget is exhausted), the engine MUST reject with budget_exhausted (-32001) without changing state"

The parenthetical "(or budget is exhausted)" is ambiguous: does it mean "if the campaign is in `exhausted` state" OR "if the campaign is in `paused` state but the budget is actually exhausted"? The second interpretation would mean `campaign.resume` from `paused` must also check remaining budget and reject if zero. The spec §2.4 doesn't address this case explicitly—what if someone pauses a campaign, budget becomes exhausted (e.g., wall_clock ticks), then tries to resume? **The spec MUST clarify**: does `campaign.resume` from `paused` perform a budget-sufficiency check, or does it always succeed and let the next `search.step` fail?

### B4. `rank.compute` with `method=pareto` minimum node count inconsistency

The OpenRPC description says:

> "For method=pareto, the filter MUST resolve to >= 1 node (a single node is allowed and yields rank=1). For method=elo, the filter MUST resolve to >= 2 nodes."

But the architecture spec §2.3 item 1 says:

> 对 side-effecting 的 `rank.compute`：若筛选后为空（`pareto`）或少于 2 个节点（`elo`），引擎必须返回 `insufficient_eval_data`

The spec says pareto fails on empty (0 nodes), the OpenRPC says pareto requires >= 1. These are consistent for the 0-node case, but there's a discrepancy for the **1-node Pareto case**: the spec's Chinese text says "为空" (empty) is the failure condition for Pareto, implying 1 node is fine. The OpenRPC agrees. **However**, `ranking_result_v1.schema.json` has `"ranked_nodes": { "minItems": 1 }`, which means a 1-node Pareto result is representable. This is actually consistent—**but** the architecture spec says "不允许'空成功结果'" which only prohibits empty success, not 1-node success. **Verdict: marginally consistent but the spec prose should explicitly state "pareto: ≥1, elo: ≥2" for clarity, not rely on "empty" being ambiguous.**

### B5. Missing `campaign_id` field on `campaign.topup` error response path for `campaign_not_active`

When `campaign.topup` is called on a `completed` campaign, the spec says return `campaign_not_active`. But the `rpc_error_data_v1.schema.json` only has `reason` and `details`. There's no standard way to echo back the `campaign_id` in the error. This is a **general blocker**: `rpc_error_data_v1.schema.json` should include an optional `campaign_id` field (or the `details` object should have a recommended structure for campaign-scoped errors) so error handlers can correlate without parsing the request.

### B6. `search.step` `n_steps` semantics undefined relative to island/team topology

`search.step` takes `n_steps: integer >= 1`, but the spec never defines what "one step" means in a multi-island, multi-role team context. Is it:
- One operator application on one island?
- One full cycle across all islands?
- One "round" where each team on each island gets one turn?

This is critical for budget accounting (`steps_used`, `steps_remaining`), idempotency (is the granularity per-island or per-campaign?), and cost estimation. **MUST define step semantics.**

## Non-blocking

### N1. `budget_snapshot_v1.schema.json` required fields vs. optional budget dimensions

`BudgetSnapshot` requires `steps_remaining` and `nodes_remaining` but allows `null`. Meanwhile, `BudgetEnvelope` makes `max_steps` and `max_nodes` optional. This is handled correctly via `oneOf: [integer, null]`. However, the schema uses `"oneOf"` where `"type": ["integer", "null"]` with `"minimum": 0` would be simpler and more standard in draft 2020-12. The `oneOf` pattern works but adds unnecessary validation complexity.

### N2. `evaluator_config_v1.schema.json` `weights` keys not constrained to `dimensions` enum

The `weights` field is `additionalProperties: { type: number }` but doesn't validate that keys match the `dimensions` enum values. A caller could provide `{"weights": {"foo": 1.0}}` and it would pass schema validation. Consider adding a note or using `propertyNames: { enum: [...] }` (or document that the engine validates this at runtime).

### N3. `idea_card_v1.schema.json` claims conditional logic order

The `allOf` with two `if/then` blocks works correctly, but note that for `support_type: "llm_inference"`, both conditions fire: the first requires `verification_plan`, the second requires `evidence_uris` with `minItems: 1`. This means an LLM inference claim MUST have both a verification plan AND at least one evidence URI. **Is this intended?** An LLM inference might not have literature backing—that's the whole point of distinguishing it. If intended, document it. If not, the second `if` should exclude `llm_inference` and `assumption`.

**This is arguably a blocker** depending on intent, but I'm marking it non-blocking because the fix is small and the intent might be "even LLM inferences should cite what prompted the inference."

### N4. No versioning/migration story for schemas

The schemas use `v1` in filenames and `$id`, but there's no documented strategy for what happens when `v2` is needed. Will `idea_node_v2.schema.json` coexist? Will the OpenRPC document support version negotiation? Recommend adding a `VERSIONING.md` or section in the spec.

### N5. `island_state_v1.schema.json` missing `operator_weights` or `active_operators`

The spec §3.2.1 describes islands as having operator/constraint weight configurations, but `IslandState` only exposes `island_id`, `state`, `population_size`, `stagnation_counter`, `best_score`, `repopulation_count`. There's no observability into which operators are active or their weights on a given island. This limits debugging and tuning.

### N6. `formalism_registry_v1.schema.json` merge semantics not machine-checkable

The OpenRPC `campaign.init` description says caller-provided entries take precedence on `formalism_id` collision. But the merge result is never returned in `campaign_init_result_v1.schema.json`. The caller has no way to verify the merged registry. Consider adding `merged_formalism_registry` (or at least `formalism_ids: string[]`) to the init result.

### N7. `search_step_result_v1.schema.json` conditional for `new_nodes_artifact_ref`

The `allOf` block requires `new_nodes_artifact_ref` when `new_node_ids` has `minItems: 1`. However, JSON Schema `if/then` with `minItems` on an existing array is tricky—if `new_node_ids` is `[]`, the `if` doesn't match, so `new_nodes_artifact_ref` becomes optional. This is correct behavior but fragile: the `if` block checks `"type": "array", "minItems": 1` which technically always matches an array property declaration, not the instance value. **Test this with a real validator**—some implementations evaluate `if` against the instance, not the schema. This should work in draft 2020-12 but warrants a conformance test.

### N8. `degradation_order` in `BudgetEnvelope` is a flat array, not a priority-ordered specification

The `degradation_order` enum list doesn't enforce ordering semantics in the schema (JSON arrays are ordered, but there's no "these must be in priority order" constraint). Document that array index = priority rank.

### N9. Elo `K`-factor and initial rating not configurable

`elo_config_v1.schema.json` only has `max_rounds` and `seed`. Standard Elo implementations need `K`-factor (sensitivity) and `initial_rating`. These should be optional fields with sensible defaults, or the spec should state the engine uses fixed values and document them.

### N10. No `campaign.delete` / `campaign.archive` RPC

The idempotency retention rule says "records MUST be retained until campaign ends." But `completed` is a terminal state with no delete. This means idempotency records accumulate forever. Not blocking for v0.x but should be on the v0.3 roadmap.

## Real-research fit

### R1. Evidence-first pipeline is well-designed for HEP

The grounding audit gate (§4.2.1) with active URI resolution, data consistency checks against PDG/HEPData, and folklore pre-screening is **exactly right** for HEP-ph/th. The claim-level provenance in `IdeaCard.claims[]` with conditional `verification_plan` for LLM inferences is a strong hallucination mitigation pattern that I haven't seen in other AI-for-science frameworks.

### R2. Operator families map well to actual HEP research patterns

`SymmetryOperator`, `LimitExplorer`, and `AnomalyAbduction` are the workhorses of theoretical HEP discovery. `CrossDomainAnalogy` with mandatory mapping tables is a good guard against shallow metaphor. The `ProtectiveBeltPatch` (Lakatos) operator is unusually sophisticated and maps well to how BSM model-building actually works (keep gauge structure, modify matter content/symmetry breaking pattern).

### R3. Multi-island evolution matches real research group dynamics

The island model with repopulation mirrors how different research groups explore different corners of theory space and periodically cross-pollinate. The stagnation detection and repopulation mechanism is a reasonable proxy for the "workshop effect" in physics research.

### R4. Gap: No explicit handling of "negative results" / "this idea was tried and failed"

The `eval_info.failure_modes` captures evaluation failures, but there's no first-class mechanism for recording "this approach was tried in the literature and failed because X" or "we computed this and it's ruled out by data." The `IdeaNode` should support a `disposition` field (`active | superseded | ruled_out | merged`) to prevent the search from repeatedly rediscovering dead ends.

### R5. Gap: No connection to experimental timeline

HEP ideas have urgency tied to experimental programs (LHC Run 3/4, DUNE, etc.). The `IdeaCard` has no field for "relevant experimental timeline" or "data availability window." This affects `impact` and `tractability` scoring in practice.

## Robustness & safety

### S1. Idempotency design is thorough but has an edge case with wall-clock budget

`BudgetEnvelope.max_wall_clock_s` is a real-time constraint. If a `search.step` is replayed via idempotency, the original `wall_clock_s_elapsed` is returned—but the actual wall clock has advanced. The `budget_snapshot.wall_clock_s_remaining` in the replayed response will be stale. **Either**: (a) wall-clock fields must be recomputed even on replay (breaking pure replay semantics), or (b) document that wall-clock fields in replayed responses are snapshots from original execution and may be stale.

### S2. Canonical JSON hashing is underspecified for floating-point

The spec says "numbers in standard JSON representation" but IEEE 754 floats have multiple valid JSON representations (`1.0` vs `1` vs `1.00`). For `max_cost_usd: 10.0` vs `max_cost_usd: 10`, canonical JSON must pick one. Recommend adopting RFC 8785 (JCS) explicitly, which specifies `JSON.stringify` number serialization rules (ES2015 `Number.prototype.toString`).

### S3. Hallucination mitigation is strong at the card level but weak at the rationale level

`RationaleDraft` has optional `references` but no mandatory grounding. This is by design (high-temperature exploration), but it means the system could generate many plausible-sounding but hallucinated rationales that waste budget before the formalization gate catches them. Consider adding an optional lightweight "pre-screen" (e.g., at least one reference must resolve) to reduce waste without killing divergent exploration.

### S4. No rate limiting or abuse protection on RPC

The single-writer assumption (§2.3.1) is noted, but there's no protection against a buggy adapter flooding `search.step` calls with unique idempotency keys. The `step_budget` fuse helps per-call, but a tight loop of calls could still drain the global budget rapidly. Consider a `min_interval_between_steps_ms` field in `BudgetEnvelope.extensions`.

### S5. `prompt_hash` and `prompt_snapshot_hash` provenance is good

Recording SHA-256 hashes of prompts in `origin` and `operator_trace` enables audit and reproducibility. This is a strong safety feature. Ensure the spec mandates that the actual prompt content is stored somewhere recoverable (not just the hash), or that the hash can be resolved to content via an artifact store.

## Specific patch suggestions

### Patch 1: Fix `idea_card_v1.schema.json` claims conditional to not require evidence URIs for LLM inferences

**File**: `schemas/idea_card_v1.schema.json`  
**Change**: In the `claims.items.allOf[1]` block, change the `if` condition to exclude `llm_inference` and `assumption`:

```json
{
  "if": {
    "properties": { "support_type": { "enum": ["literature", "data", "calculation", "expert_consensus"] } },
    "required": ["support_type"]
  },
  "then": { "required": ["evidence_uris"], "properties": { "evidence_uris": { "minItems": 1 } } }
}
```

This is already correct as written (the `enum` only matches those 4 types). **However**, verify intent: if LLM inference claims SHOULD also require evidence URIs (the "what prompted this inference" rationale), then keep as-is but add a comment/description. If not, this is already correct—but add `"description": "evidence_uris may be empty for llm_inference/assumption claims; verification_plan is required instead"` to the claim object.

### Patch 2: Add `payload_hash` to `idempotency_meta_v1.schema.json`

**File**: `schemas/idempotency_meta_v1.schema.json`  
**Change**: Add field:

```json
{
  "properties": {
    "idempotency_key": { "type": "string", "minLength": 1 },
    "is_replay": { "type": "boolean" },
    "payload_hash": {
      "type": "string",
      "pattern": "^sha256:[a-f0-9]{64}$",
      "description": "SHA-256 hash of canonical JSON of request params (excluding idempotency_key). Enables client-side verification and conflict debugging. Computed per RFC 8785 (JCS) canonical form."
    }
  },
  "required": ["idempotency_key", "is_replay", "payload_hash"]
}
```

### Patch 3: Add `disposition` field to `idea_node_v1.schema.json`

**File**: `schemas/idea_node_v1.schema.json`  
**Change**: Add to `properties`:

```json
"disposition": {
  "enum": ["active", "superseded", "ruled_out", "merged", "archived"],
  "default": "active",
  "description": "Lifecycle disposition of this node. 'ruled_out' = known to be falsified or experimentally excluded; 'superseded' = a descendant node replaces this; 'merged' = combined into another node. Prevents search from rediscovering dead ends."
}
```

Also add to the mutable fields list in the description.

### Patch 4: Specify canonical JSON as RFC 8785 (JCS)

**File**: `docs/plans/2026-02-12-idea-generator-architecture-spec.md`  
**Change**: In §2.3 item 2c, replace:

> canonical JSON：对象键按字典序排序；数组顺序保持；不插入多余空白；数值按标准 JSON 表示

with:

> canonical JSON：**RFC 8785 (JSON Canonicalization Scheme / JCS)**；具体为：对象键按 Unicode code point 字典序排序；数组顺序保持；不插入多余空白；数值按 ECMAScript `Number.prototype.toString` 规则序列化（避免 `1.0` vs `1` 歧义）。实现方应使用经过测试的 JCS 库而非自行编写。

Also update the OpenRPC `info.description` correspondingly.

### Patch 5: Disambiguate island-level EXHAUSTED vs. campaign-level exhausted

**File**: `docs/plans/2026-02-12-idea-generator-architecture-spec.md`  
**Change**: In §3.2.1, add after the state list:

> **Island EXHAUSTED vs Campaign exhausted 区分（硬约束）**：
> - Island `EXHAUSTED`：该 island 的局部预算不足以完成一次最小 step（`island_budget_remaining < min_step_cost`），但其他 islands 可能仍可运行。此状态**不**直接触发 campaign-level 状态迁移。
> - Campaign `exhausted`：全局 `BudgetEnvelope` 的**任一受限维度** remaining ≤ 0（`tokens_remaining` 或 `cost_usd_remaining` 或 `wall_clock_s_remaining` 或 `nodes_remaining` 或 `steps_remaining`）。仅在全局层面触发。
> - Campaign `early_stopped`：search policy 的全局判定（如所有 islands 均为 STAGNANT/EXHAUSTED），但**不**由预算触发。若预算耗尽恰好同时触发了 search policy 停止，engine 必须优先使用 `exhausted`（因为 `campaign.topup` 可以恢复 `exhausted` 但不改变 `early_stopped`）。

### Patch 6: Define "step" semantics for multi-island context

**File**: `docs/plans/2026-02-12-idea-generator-architecture-spec.md`  
**Change**: In §2.3 under `search.step`, add:

> **Step 语义定义（v0.2 硬约束）**：一个 "step" 定义为：search policy 选择一个 island，在该 island 上对一个或多个节点应用一次 operator（产出若干候选节点），并完成即时评估（若 policy 要求）。`n_steps` 是这样的单元操作次数上界。每个 step 消耗的 token/cost 取决于该 step 涉及的 team topology（角色数 × 每角色 LLM 调用）。`budget_snapshot.steps_used` 计数的是已完成的 step 单元数（不是 LLM 调用数或 island 轮次数）。

### Patch 7: Add `campaign.resume` budget check clarification to OpenRPC

**File**: `schemas/idea_core_rpc_v1.openrpc.json`  
**Change**: In `campaign.resume` description, replace:

> "If status is exhausted (or budget is exhausted), the engine MUST reject with budget_exhausted (-32001) without changing state"

with:

> "If campaign status is exhausted, the engine MUST reject with budget_exhausted (-32001) without changing state. If campaign status is paused but the remaining budget is insufficient to execute at least one minimal step (any limited dimension has remaining ≤ 0), the engine MUST reject with budget_exhausted (-32001) and transition the campaign status to exhausted (since the budget condition is now the binding constraint). This prevents entering running state with zero budget."

### Patch 8: Add wall-clock staleness caveat to idempotency replay spec

**File**: `docs/plans/2026-02-12-idea-generator-architecture-spec.md`  
**Change**: In §2.3 item 2 (Idempotency replay rules), add after "其余字段必须与首次响应一致":

> **Wall-clock 字段例外（informative）**：`budget_snapshot.wall_clock_s_elapsed` 和 `wall_clock_s_remaining` 在 replay 时返回的是**首次执行时的快照值**，可能已过期。调用方如需实时 wall-clock 信息，应额外调用 `campaign.status`（read-only，不受 idempotency 约束）。

### Patch 9: Add `K_factor` and `initial_rating` to `elo_config_v1.schema.json`

**File**: `schemas/elo_config_v1.schema.json`  
**Change**: Add optional fields:

```json
{
  "required": ["max_rounds", "seed"],
  "properties": {
    "max_rounds": { "type": "integer", "minimum": 1 },
    "seed": { "type": "integer", "minimum": 0 },
    "k_factor": {
      "type": "number",
      "minimum": 1,
      "default": 32,
      "description": "Elo K-factor controlling rating sensitivity per matchup. Default 32."
    },
    "initial_rating": {
      "type": "number",
      "minimum": 0,
      "default": 1500,
      "description": "Initial Elo rating for unrated nodes. Default 1500."
    }
  }
}
```

### Patch 10: Constrain `evaluator_config_v1.schema.json` weights keys

**File**: `schemas/evaluator_config_v1.schema.json`  
**Change**: Replace the `weights` property with:

```json
"weights": {
  "type": "object",
  "description": "Dimension weights. Keys MUST be a subset of the 'dimensions' array. Engine MUST reject unknown keys at runtime.",
  "propertyNames": {
    "enum": ["novelty", "feasibility", "impact", "tractability", "grounding"]
  },
  "additionalProperties": { "type": "number", "minimum": 0 }
}
```
