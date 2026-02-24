VERDICT: NOT_READY

## Blockers

### B1. `campaign.resume` from `exhausted` state: spec vs. OpenRPC contradiction

The architecture spec §2.4 says:

> `campaign.resume`: `exhausted → exhausted`（固定拒绝：`budget_exhausted`）

But the OpenRPC `campaign.resume` description says:

> "If the campaign budget is exhausted (i.e., any BudgetEnvelope dimension has remaining <= 0), the engine MUST reject with budget_exhausted (-32001) without changing state **(this includes status=exhausted**, and also paused|early_stopped with exhausted budget)."

These are *consistent* in intent, but the **allowed source states** in the OpenRPC `description` field say "Permitted when campaign status is paused|early_stopped" — it does **not** list `exhausted`. Yet the spec's transition table explicitly shows `exhausted` as a valid input to `campaign.resume` (which then returns an error). This creates an ambiguity: should the engine return `campaign_not_active` (because `exhausted` is not in the permitted set) or `budget_exhausted` (because the spec says so)?

**Fix required**: The OpenRPC description for `campaign.resume` must explicitly list `exhausted` as a permitted input state (that deterministically returns `budget_exhausted`), OR the spec must clarify that calling `resume` on `exhausted` returns `campaign_not_active`. The current text goes both ways. I recommend the spec's approach (return `budget_exhausted` from `exhausted`, as it's more informative), and the OpenRPC description must be updated to match.

### B2. `campaign.topup` error list is missing `budget_exhausted` — but it also MUST NOT return it?

The spec §2.4 transition table says `campaign.topup` on `exhausted` can result in `exhausted` (if insufficient) or `running` (if sufficient). The OpenRPC description says:

> "campaign.topup MUST NOT return budget_exhausted; insufficient topups are represented by a successful result whose campaign_status remains exhausted."

This is internally consistent. However, the OpenRPC error list for `campaign.topup` **does not** include `budget_exhausted` — which is correct per the description. But then what error does a topup on `completed` return? The description says `campaign_not_active`, and that error IS in the list. ✅

BUT: the **spec** §2.4 says `campaign.topup` is allowed on `running|paused|early_stopped|exhausted`. The OpenRPC says "Permitted when campaign status is running|paused|early_stopped|exhausted." These match. ✅

**Actual blocker**: What about `campaign.topup` on `completed`? The spec §2.4 says: "campaign.topup 必须拒绝（campaign_not_active）" — but this transition is **not listed** in the "allowed explicit migrations" section for `campaign.topup`. It's only mentioned in the general note. The transition table format should include the rejection case explicitly to avoid implementer confusion: `completed → REJECT(campaign_not_active)`.

### B3. Idempotency for `campaign.init` lacks `campaign_id` — but `campaign_init_result_v1` includes it

The spec says `campaign.init` deduplicates by `(method, idempotency_key)` because there's no `campaign_id` yet. On replay, the engine returns the same `campaign_init_result` which includes the `campaign_id` generated on first execution. This is correct.

**Blocker**: The **idempotency store** for `campaign.init` is described as **not** campaign-scoped (§2.3 point 2: "除 campaign.init 外，idempotency store 必须 campaign-scoped"). But the spec never defines what the **global** idempotency store's retention policy is. It says "至少保留到 campaign 结束", but for `campaign.init` entries, the campaign might not exist yet (if the first call failed). If `campaign.init` fails, what is the retention scope? The spec must define: "For `campaign.init`, idempotency records MUST be retained in the global (non-campaign-scoped) store for at least [X duration / indefinitely / until explicit cleanup]."

### B4. `search.step` atomicity is undefined

`eval.run` explicitly states: "on any error... the engine MUST perform no partial writes/mutations; if partial work occurs internally it MUST be rolled back before returning." But `search.step` has **no such atomicity clause**. This is a critical gap because:

1. `search.step(n_steps=5)` might complete 3 steps then hit budget exhaustion.
2. The result has `n_steps_executed=3` and `early_stopped=true` — implying partial results ARE written.
3. But what about idempotency? The first response (with 3 steps) is stored. If retried, it replays the 3-step result. This is consistent.

**However**: what if step 3 itself partially writes (creates a node but fails mid-evaluation)? The spec needs to clarify: **each tick is atomic** (either all artifacts from that tick are written, or none), but the overall `search.step` call is **not atomic** across ticks (partial progress is preserved and reported via `n_steps_executed`). This must be stated explicitly, because without it, an implementer might try to roll back all 3 ticks on a step-4 failure.

### B5. `BudgetSnapshot` for `steps_remaining`/`nodes_remaining` nullability vs. `BudgetEnvelope` required fields

`budget_envelope_v1.schema.json` marks `max_tokens`, `max_cost_usd`, `max_wall_clock_s` as **required**, but `max_steps` and `max_nodes` are **optional**. `budget_snapshot_v1.schema.json` marks `steps_remaining` and `nodes_remaining` as `oneOf: [integer, null]` (nullable) — matching the optionality. ✅

But `tokens_remaining`, `cost_usd_remaining`, `wall_clock_s_remaining` are `integer`/`number` (non-nullable) — matching their required status in the envelope. ✅

**Blocker on `wall_clock_s_remaining`**: In `budget_snapshot_v1`, `wall_clock_s_remaining` has `"minimum": 0`. But wall-clock can go negative if the engine checks *after* the deadline passes (race condition). The engine would detect this and transition to `exhausted`, but the snapshot might be generated with a slightly negative value. The schema should allow `"minimum": 0` and require the engine to clamp to 0, OR allow negative. Either way, this edge case must be defined. (I recommend clamping to 0 with a note.)

---

## Non-blocking

### N1. `node.list` filter has no `min_score` / `eval_status` / `promoted` filter

The `idea_list_filter_v1.schema.json` only supports filtering by `idea_id`, `node_id`, `island_id`, `operator_id`, `has_idea_card`, `grounding_status`. For ranking workflows, callers will want to filter by "has been evaluated" or "minimum composite score" or "promoted status". Without these, `rank.compute` must rely on the existing filters, which can't express "all nodes with scorecards" — yet `rank.compute` will fail with `insufficient_eval_data` if the resolved set lacks scorecards.

**Suggestion**: Add at least `has_eval_info: boolean` and `promoted: boolean` to the filter schema.

### N2. `EloConfig` is too minimal — no K-factor or initial rating

The `elo_config_v1.schema.json` only has `max_rounds` and `seed`. Real Elo systems need at minimum a K-factor (or learning rate) and initial rating. Without these, implementations will diverge.

**Suggestion**: Add optional `k_factor` (number, default 32) and `initial_rating` (number, default 1500) to `elo_config_v1.schema.json`.

### N3. `campaign_charter_v1` has no `version` / `schema_version` field

For schema evolution, every artifact should carry its schema version. The charter doesn't. Neither does `seed_pack_v1`, `budget_envelope_v1`, etc.

**Suggestion**: Add `"schema_version": { "const": "v1" }` to all top-level schemas as a required field, enabling forward-compatible readers.

### N4. `evaluator_config_v1` dimensions enum is closed — not extensible

The `dimensions` array items are restricted to `["novelty", "feasibility", "impact", "tractability", "grounding"]`. DomainPacks might want custom dimensions (e.g., `"symmetry_consistency"`, `"experimental_accessibility"`).

**Suggestion**: Either add `"additionalItems": true` or change the items schema to `{ "type": "string", "minLength": 1 }` with the current enum as recommended values in the description.

### N5. `idea_card_v1.claims` allows `evidence_uris: []` for `llm_inference`/`assumption` support types

The conditional `allOf` logic requires `verification_plan` for `llm_inference`/`assumption`, and requires `evidence_uris` with `minItems: 1` for `literature`/`data`/`calculation`/`expert_consensus`. But for `llm_inference`/`assumption`, there's no constraint on `evidence_uris` — they could be empty, which is correct (the inference might have no backing evidence). ✅ This is fine but should be documented explicitly.

### N6. `search_step_result_v1` conditional: `new_nodes_artifact_ref` required when `new_node_ids` is non-empty

The `allOf` conditional logic is:
```json
"if": { "properties": { "new_node_ids": { "type": "array", "minItems": 1 } }, "required": ["new_node_ids"] },
"then": { "required": ["new_nodes_artifact_ref"] }
```

This `if` condition will **always** match because `new_node_ids` is already required and is always an array. The `minItems: 1` in the `if` block is checking whether the *schema* matches, not the *value*. In JSON Schema, `if` validates the instance against the subschema — so if the array has 0 items, `{ "type": "array", "minItems": 1 }` will **fail** validation, meaning the `if` doesn't match and `then` doesn't apply. This is actually correct but relies on subtle JSON Schema semantics. A comment would help.

### N7. No `campaign.delete` / `campaign.archive` method

The spec mentions these in passing ("或未来新增 campaign.delete/archive") but they're not in the RPC. For v0.x this is fine, but note that without `campaign.delete`, idempotency records accumulate indefinitely. Should be tracked as a v1 item.

### N8. `BudgetTopUp` allows partial dimension topups but doesn't address interaction

If a campaign is `exhausted` because `tokens_remaining=0` AND `cost_usd_remaining=0`, and the caller tops up only `add_tokens`, the campaign might still be exhausted (because cost is still 0). The spec handles this: "topup 后若预算已不再耗尽（各受限维度 remaining > 0）则转为 running，否则保持 exhausted." But "各受限维度" is ambiguous — does it mean ALL dimensions, or only the dimensions that were originally set? Since `max_steps` and `max_nodes` are optional, a dimension that was never set can't be exhausted. **Clarify**: "受限维度" = dimensions that have finite limits in the BudgetEnvelope (i.e., `max_tokens`, `max_cost_usd`, `max_wall_clock_s` always; `max_steps`/`max_nodes` only if set).

### N9. No explicit ordering guarantee for `node.list`

The `node_list_result_v1` has `cursor` pagination but no `sort_by` parameter. Without a defined default sort order, pagination results may be inconsistent across implementations (or even across pages within the same implementation if nodes are being created concurrently — though v0.x is single-writer).

**Suggestion**: Add `sort_by` with a default of `created_at` ascending, or document the default.

### N10. `promotion_result_v1.formalism_check.missing_formalisms` and `grounding_audit_summary.failures` always empty on success

These arrays exist in the success schema but the description says they should be empty. Their presence adds noise to the success path. Consider removing them from the success schema and only surfacing them in the error path (via `error.data.details`). Alternatively, keep them for forward compatibility but mark them with a note.

---

## Real-research fit

### R1. The Explain-Then-Formalize pipeline is sound for HEP

The two-stage `RationaleDraft → IdeaCard` maps well to how theoretical physics ideas actually develop: physicists sketch an intuition (often with analogies, dimensional arguments, symmetry reasoning), then formalize into a calculable framework. The mandatory `kill_criteria` in `RationaleDraft` and `verification_plan` in `IdeaCard.claims` enforce the falsifiability discipline that separates productive theoretical physics from speculation.

### R2. Operator families are well-chosen for HEP

`SymmetryOperator`, `LimitExplorer`, `AnomalyAbduction`, and `RepresentationShift` are the workhorses of theoretical HEP discovery. `CrossDomainAnalogy` with mandatory mapping tables is particularly valuable — many breakthroughs in HEP (AdS/CFT, lattice gauge theory from statistical mechanics, etc.) came from precisely this kind of structured cross-domain transfer.

### R3. The formalism registry is a critical safety feature

Requiring `candidate_formalisms` to map to registered formalisms with validators and compilers prevents the common failure mode of LLM-generated ideas: proposing calculations in frameworks that don't exist or can't be computed. This is the right enforcement point.

### R4. Grounding audit with active URI resolution is essential

The requirement for active INSPIRE/DOI lookup (not just format validation) addresses the known problem of LLM "phantom citations." This is necessary but has operational implications: the engine needs reliable access to INSPIRE API, DOI resolvers, etc., and must handle transient failures gracefully (the spec should define whether a transient lookup failure counts as a grounding failure or triggers a retry).

### R5. Folklore risk scoring fills a real gap

In HEP, many "ideas" are well-known folklore that hasn't been published because it doesn't work or is too obvious. The `folklore_risk_score` mechanism with human escalation (`A0-folklore`) is a good design. However, operationalizing this is hard — the score will likely need calibration on a per-subfield basis (what's folklore in hep-ph may be novel in nucl-th).

### R6. Missing: experimental landscape awareness

The `IdeaCard` has `required_observables` and `testable_hypotheses`, but there's no structured field for **which experiments/facilities** could test these predictions (LHC, Belle II, DUNE, etc.), or **what sensitivity/luminosity** is needed. For HEP, this is often the difference between a "publishable idea" and a "useful idea." Consider adding `experimental_targets[]` to `IdeaCard` in a future version.

### R7. `minimal_compute_plan` difficulty taxonomy is good but incomplete

The `estimated_difficulty` enum (`straightforward/moderate/challenging/research_frontier`) maps well to real computation complexity. The addition of `estimated_compute_hours_log10` and `required_infrastructure` is excellent for feasibility triage. The `blockers` field captures known unknowns.

---

## Robustness & safety

### S1. Idempotency design is thorough and well-specified

The JCS-based payload hashing, conflict detection, and replay semantics are well thought out. The requirement to store `first_response_json_bytes` and replay them (rather than re-executing) is the correct approach for non-deterministic operations like LLM generation. The explicit handling of "failed first call → replay error on retry" prevents silent data corruption.

### S2. Campaign isolation is properly enforced

The `node_not_in_campaign` error for cross-campaign node references, combined with campaign-scoped idempotency stores, prevents data leakage between campaigns. The atomicity requirement on `eval.run` (no partial writes on error) is correct.

### S3. Budget circuit breaker design is solid

Multi-dimensional budget enforcement (tokens, cost, wall-clock, steps, nodes) with a configurable degradation order provides graceful degradation. The distinction between step-local fuse (`step_budget`) and global envelope is useful for exploratory runs.

### S4. Hallucination mitigation has multiple layers

- Claim-level provenance with typed support (`literature`/`data`/`llm_inference`/`assumption`)
- Active URI resolution in grounding audit
- Mandatory `verification_plan` for LLM inferences
- Folklore risk scoring with human escalation
- Clean-room evaluation (independent reviewers)
- Structured debate on disagreement

This is a good defense-in-depth approach. However:

### S5. Risk: Grounding audit bypass via `expert_consensus`

The `expert_consensus` support type requires "≥1 review-level reference" but the schema only enforces `evidence_uris.minItems: 1` — any URI passes. A malicious or careless LLM could cite a random arXiv paper as "expert consensus" for an unsupported claim. The grounding audit's active resolution would catch non-existent URIs, but not semantically irrelevant ones.

**Mitigation suggestion**: For `expert_consensus` claims, the grounding audit should verify that at least one cited URI is a review/white paper/PDG review (e.g., by checking INSPIRE document type or arXiv category). This should be documented as a SHOULD requirement.

### S6. Risk: Idempotency store as attack/corruption surface

If the idempotency store is corrupted (e.g., stored response bytes are truncated), replay will return garbage. The spec should require integrity verification on stored responses (e.g., store a checksum alongside `first_response_json_bytes` and verify on replay).

### S7. Concurrency disclaimer is appropriate for v0.x

The explicit "single-writer per campaign" constraint with the note about future optimistic concurrency control is the right pragmatic choice. The mention of `expected_version` for v1.0+ shows forward thinking.

### S8. Risk: Wall-clock budget is hard to enforce atomically

Wall-clock time advances continuously, and the engine might not check mid-operation. A single expensive LLM call (e.g., a complex team topology with 8 roles) could blow past the wall-clock limit. The spec's degradation order helps, but the engine should also support a hard interrupt mechanism for LLM calls that exceed a per-call timeout. This is an implementation concern but should be noted in the spec.

---

## Specific patch suggestions

### P1. Fix `campaign.resume` OpenRPC description (Blocker B1)

**File**: `schemas/idea_core_rpc_v1.openrpc.json` → `methods[4]` (`campaign.resume`)  
**Change**: Replace the `description` field:

```json
"description": "Side-effecting. Permitted when campaign status is paused|early_stopped|exhausted. For paused|early_stopped: transitions to running if budget is sufficient, otherwise rejects with budget_exhausted (-32001) without changing state. For exhausted: always rejects with budget_exhausted (-32001) without changing state (caller must campaign.topup first). If campaign is completed or not found: returns campaign_not_active (-32015) or campaign_not_found (-32003)."
```

### P2. Define `search.step` tick-level atomicity (Blocker B4)

**File**: `docs/plans/2026-02-12-idea-generator-architecture-spec.md` → §2.3, point 3  
**Add after** the `search.step` step semantics paragraph:

```markdown
   **`search.step` atomicity contract (MUST)**：
   - **Per-tick atomic**: Each SearchPolicy tick is an atomic unit — either all nodes/artifacts produced by that tick are persisted, or none are (rollback on tick-internal failure).
   - **Cross-tick non-atomic**: A `search.step(n_steps=N)` call that completes K < N ticks (due to budget exhaustion, early stop, or tick-internal error after K successful ticks) MUST persist the K completed ticks' results and report `n_steps_executed=K, early_stopped=true`. The idempotency record stores this partial-success response.
   - **Consequence**: Callers MUST NOT assume `n_steps_executed == n_steps_requested` on success; they must check `early_stopped` and `n_steps_executed`.
```

### P3. Define global idempotency store retention for `campaign.init` (Blocker B3)

**File**: `docs/plans/2026-02-12-idea-generator-architecture-spec.md` → §2.3, point 2  
**Add after** "作用域：除 campaign.init 外，idempotency store 必须 campaign-scoped（防跨 campaign 污染）。":

```markdown
   - **campaign.init 全局 store 保留策略**：`campaign.init` 的 idempotency 记录存储在全局（非 campaign-scoped）store 中。若 `campaign.init` 成功，该记录至少保留到所创建 campaign 结束；若 `campaign.init` 失败（返回 error），该记录至少保留 `7 × 24h`（防止短期重试窗口内 key 冲突误判），之后可由 GC 回收。
```

### P4. Clarify `wall_clock_s_remaining` clamping (Blocker B5)

**File**: `schemas/budget_snapshot_v1.schema.json` → `wall_clock_s_remaining`  
**Change**: Update the property description:

```json
"wall_clock_s_remaining": {
  "type": "number",
  "minimum": 0,
  "description": "Remaining wall-clock seconds under the BudgetEnvelope. Engine MUST clamp to 0 (never negative); if the actual deadline has passed, report 0 and trigger the budget circuit breaker."
}
```

### P5. Add `has_eval_info` and `promoted` to list filter (Non-blocking N1)

**File**: `schemas/idea_list_filter_v1.schema.json`  
**Add properties**:

```json
"has_eval_info": { "type": "boolean", "description": "Filter nodes with/without eval_info." },
"promoted": { "type": "boolean", "description": "Filter nodes that have/haven't been promoted to C2." },
"min_created_at": { "type": "string", "format": "date-time", "description": "Only nodes created at or after this timestamp." }
```

### P6. Extend `EloConfig` with K-factor and initial rating (Non-blocking N2)

**File**: `schemas/elo_config_v1.schema.json`  
**Add optional properties**:

```json
"k_factor": {
  "type": "number",
  "minimum": 1,
  "default": 32,
  "description": "Elo K-factor (learning rate). Higher = more volatile ratings."
},
"initial_rating": {
  "type": "number",
  "minimum": 0,
  "default": 1500,
  "description": "Initial Elo rating for unrated nodes."
}
```

### P7. Add `schema_version` to all top-level schemas (Non-blocking N3)

**Files**: All `schemas/*.schema.json` files that represent top-level artifacts (not sub-components).  
**Change**: Add to each schema's `required` array and `properties`:

```json
"schema_version": { "const": "v1", "description": "Schema version identifier for forward-compatible readers." }
```

Priority targets: `idea_node_v1`, `idea_card_v1`, `rationale_draft_v1`, `campaign_charter_v1`, `seed_pack_v1`, `budget_envelope_v1`, `formalism_registry_v1`.

### P8. Add default sort order to `node.list` (Non-blocking N9)

**File**: `schemas/idea_core_rpc_v1.openrpc.json` → `methods[8]` (`node.list`)  
**Add parameter**:

```json
{
  "name": "sort_by",
  "schema": { "enum": ["created_at_asc", "created_at_desc", "updated_at_desc"], "default": "created_at_asc" },
  "required": false,
  "description": "Sort order for results. Default: created_at_asc (oldest first, deterministic pagination)."
}
```

### P9. Define transient grounding lookup failure handling (Real-research R4)

**File**: `docs/plans/2026-02-12-idea-generator-architecture-spec.md` → §4.2.1  
**Add after** point 1 (URI 可解析):

```markdown
   - **Transient failure handling (MUST)**：若 URI 解析因网络/服务暂时不可用而失败（HTTP 5xx/timeout/DNS failure），engine 不得立即判定 `fail`；必须在 `grounding_audit.failures[]` 中标注 `transient_lookup_failure`，并将 `status` 置为 `partial`（而非 `fail`）。调用方/Checker 可在网络恢复后重新触发 grounding audit（需新的 `idempotency_key`）。只有对已确认不存在的 URI（HTTP 404/410、INSPIRE API 返回"not found"）才判定 `fail`。
```

### P10. Add idempotency store integrity check recommendation (Safety S6)

**File**: `docs/plans/2026-02-12-idea-generator-architecture-spec.md` → §2.3, point 2  
**Add after** the "去重记录的最小落盘内容" paragraph:

```markdown
   - **存储完整性（SHOULD）**：idempotency store 在落盘 `first_response_json_bytes` 时 SHOULD 同时存储 `response_checksum = sha256(first_response_json_bytes)`；replay 时 SHOULD 验证 checksum，若不一致则返回 internal error（`-32603`）并记录告警，而不是回放损坏数据。
```

### P11. Clarify "受限维度" semantics for topup transitions (Non-blocking N8)

**File**: `docs/plans/2026-02-12-idea-generator-architecture-spec.md` → §2.4, `campaign.topup` transition  
**Replace**: "若预算已不再耗尽（各受限维度 remaining > 0）"  
**With**: "若预算已不再耗尽（所有在 BudgetEnvelope 中设定了有限上限的维度——即 `max_tokens`, `max_cost_usd`, `max_wall_clock_s` 始终受限；`max_steps`/`max_nodes` 仅在 BudgetEnvelope 中显式设定时受限——的 remaining 均 > 0）"

### P12. Add `campaign.resume` to OpenRPC error list for `exhausted` state (Blocker B1 companion)

**File**: `schemas/idea_core_rpc_v1.openrpc.json` → `methods[4]` (`campaign.resume`)  
**Verify**: The error list already includes `budget_exhausted (-32001)`. ✅ No schema change needed, only the description fix from P1.

### P13. Spec §2.4: add explicit rejection transitions to the transition table

**File**: `docs/plans/2026-02-12-idea-generator-architecture-spec.md` → §2.4  
**Add** to the transition table after the `campaign.topup` entry:

```markdown
- `campaign.topup`（rejection）：`completed → REJECT(campaign_not_active)`
- `campaign.resume`（rejection）：`exhausted → REJECT(budget_exhausted)` ∪ `completed → REJECT(campaign_not_active)`
```
