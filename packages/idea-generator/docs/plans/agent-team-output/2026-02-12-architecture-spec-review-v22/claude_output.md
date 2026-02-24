VERDICT: NOT_READY

## Blockers

### B1. `campaign.resume` from `exhausted` state: spec vs. OpenRPC contradiction

The architecture spec §2.4 states:

> `campaign.resume`: `exhausted → exhausted`（固定拒绝：`budget_exhausted`）

But the OpenRPC `campaign.resume` description says:

> "Accepted when campaign status is paused|early_stopped|**exhausted**."

This is ambiguous. The spec says "accepted" (i.e., the RPC doesn't return `campaign_not_active`) but then rejects with `budget_exhausted`. Meanwhile, `campaign.topup`'s description says for `exhausted → running` transitions: "successful topup MUST transition campaign status to running only if the campaign is no longer budget-exhausted." The intended workflow is `exhausted → topup → resume`, but the resume description's "Accepted" phrasing will confuse implementers. The OpenRPC description should explicitly say: "If status is `exhausted`, the engine MUST reject with `budget_exhausted` (-32001) **without changing state**; the caller should `campaign.topup` first."

**Fix required**: Clarify `campaign.resume` OpenRPC description to remove ambiguity about `exhausted` acceptance vs rejection.

### B2. `eval.run` atomicity conflicts with idempotency store semantics

The spec says `eval.run` MUST be fully atomic (no partial writes on any error) AND that idempotency records store the first response. But consider: if `eval.run` partially completes evaluation for 3 of 5 nodes, then hits `budget_exhausted`, it rolls back all writes. The idempotency record should then store the **error** response. However, the spec doesn't clarify: **when is the idempotency record written for atomic-rollback methods?** If the record is written before rollback, a retry with the same key replays the error. If it's written after rollback, and the process crashes between rollback and idempotency-write, the key is lost and retry re-executes (correct, but violates "MUST" idempotency).

The parenthetical in §2.3 point 2 says "if partial work occurs internally it MUST be rolled back **before storing the idempotency record**", which is good but only covers the error path. The **success path** needs the inverse guarantee: idempotency record and side-effects must be committed atomically (or at least the idempotency record must not be committed without the side-effects). This is a classic two-phase problem.

**Fix required**: Add an explicit atomicity guarantee for the idempotency store itself: "For success responses, the idempotency record MUST be committed in the same transaction as the method's side-effects. For error responses (after rollback), the idempotency record MUST be committed only after successful rollback."

### B3. `search.step` tick atomicity + idempotency creates a state-space explosion

The spec says individual ticks are atomic but the overall `search.step` call can partially complete N-of-M ticks. Combined with idempotency replay (which replays the first response verbatim), this means:

- Call `search.step(n_steps=5, idem_key=K)` → completes 3 ticks → early stops → stores result with `n_steps_executed=3`
- Caller does `campaign.topup` → retries with **same** `idem_key=K` → gets replayed `n_steps_executed=3` (stale)

The spec does note this in §2.4 "Post-early-stop usage pattern" (use new key). But the OpenRPC schema/description for `search.step` doesn't surface this constraint machine-readably. An implementer reading only the OpenRPC won't know.

**Fix required**: Add an `x-idempotency-note` or equivalent in the `search.step` OpenRPC method description explicitly warning that partial-completion replays are expected and callers MUST use a new key for continuation.

### B4. No schema for the `idea_handoff_c2_v1.json` artifact

The spec (§8.2) says `idea_handoff_c2_v1.json` is "the only allowed entry into C2" and "缺字段 → 直接拒绝". The `promotion_result_v1.schema.json` references a `handoff_artifact_ref` URI but there's **no schema** for the handoff artifact itself. Without it, the "must be machine-enforceable" contract is broken: C2 cannot validate the handoff payload.

**Fix required**: Add `schemas/idea_handoff_c2_v1.schema.json` with at minimum the fields required for C2 intake (thesis, hypotheses, formalisms, compute plan, claim provenance, grounding audit summary).

### B5. `node.promote` budget impact is unspecified

`node.promote` is listed as side-effecting (requires `idempotency_key`) but is not listed in `campaign_not_active` → `budget_exhausted` logic for the `exhausted` state. §2.4 says side-effecting RPCs in `exhausted` "should优先返回 `budget_exhausted`", but `node.promote`'s error list doesn't include `budget_exhausted`. Does promotion consume budget? If not, why is it side-effecting? If yes, its error list is incomplete.

**Fix required**: Either add `budget_exhausted` to `node.promote` errors (if it consumes budget), or clarify in the spec that `node.promote` is side-effecting for write purposes but does not consume budget envelope resources (and thus returns `campaign_not_active` rather than `budget_exhausted` when in `exhausted` state).

---

## Non-blocking

### N1. `campaign.topup` cannot return `budget_exhausted` — but should echo remaining deficits

The OpenRPC description correctly says `campaign.topup MUST NOT return budget_exhausted`. However, if a topup is insufficient (e.g., adds 100 tokens but 10000 are needed), the caller has no structured way to know *which* dimensions are still exhausted without a separate `campaign.status` call. Consider adding a `deficit_dimensions[]` field to `CampaignMutationResult` (or to the embedded `campaign_status`).

### N2. `BudgetSnapshot` nullable fields inconsistency

`steps_remaining` and `nodes_remaining` can be `null` (when max not set), but `tokens_remaining`, `cost_usd_remaining`, `wall_clock_s_remaining` are always required integers/numbers. Since `max_tokens`, `max_cost_usd`, `max_wall_clock_s` are required in `BudgetEnvelope`, this is internally consistent. But if a future version makes any of those optional, the snapshot schema must change. Add an `x-design-note` to `budget_snapshot_v1.schema.json` documenting this coupling.

### N3. `EvaluatorConfig.weights` keys are not constrained to `dimensions`

The `weights` field is `additionalProperties: { type: number }` but doesn't validate that keys match the `dimensions` array. An implementer could provide `weights: { "novelty": 0.5, "typo_dimension": 0.5 }` and pass schema validation. Add a note that the engine MUST reject weights keys not in the provided `dimensions` (runtime validation, since JSON Schema can't express this cross-field constraint easily).

### N4. `IdeaListFilter` could benefit from `min_score` / `eval_status` filters

Currently `node.list` filters only by structural fields. For `rank.compute` pre-filtering and for caller convenience, supporting `min_eval_score` or `has_eval_info` booleans would reduce chattiness. Low priority for v0.2 but worth a TODO.

### N5. Pagination `total_count` may be expensive and racy

`node_list_result_v1` requires `total_count` which may be expensive on large campaigns and is inherently racy (documented: "May differ across pages"). Consider making it optional or replacing with `has_more: boolean` for v1.0. Non-blocking because the current spec acknowledges the race.

### N6. `RationaleDraft` has `references` as `format: uri` but `IdeaCard.claims[].evidence_uris` also `format: uri` — no shared URI vocabulary

Both schemas use `format: uri` but don't specify what URI schemes are valid (e.g., `inspire:recid/1234567`, `doi:10.xxx`, `arxiv:2301.12345`, `pdg:S066`). A shared `x-uri-schemes` annotation or a `hepar_uri_v1.schema.json` pattern union would improve interop and make URI resolution testable.

### N7. `island_state_v1` missing `operator_ids` / `operator_weights`

The island state only exposes `island_id`, `state`, `population_size`, etc. For observability and debugging of the bandit/distributor, it should also expose the current operator distribution or at least active operator IDs. Non-blocking for v0.2.

### N8. Missing `campaign.init` error for empty merged formalism registry

The spec says "merged registry MUST be non-empty; otherwise campaign.init MUST fail with schema_validation_failed." But `campaign.init` doesn't list a specific `reason` for this case. Should be `schema_invalid` with `details.field = "formalism_registry"`. Add to the `x-error-data-contract.known_reasons` or at least note in the description.

### N9. `elo_config_v1` could use `k_factor` and `initial_rating`

The Elo config only has `max_rounds` and `seed`. Standard Elo implementations need K-factor and initial rating. These can go in `additionalProperties` but since the schema has `additionalProperties: false`, they're currently rejected. Either add them as optional fields or relax `additionalProperties`.

---

## Real-research fit

### Strong points

1. **Evidence-first provenance** is deeply woven in: claim-level `support_type` + `evidence_uris` + conditional `verification_plan` is exactly right for HEP where phantom citations destroy credibility. The `allOf` conditional requiring `verification_plan` for `llm_inference`/`assumption` and requiring ≥1 URI for `literature`/`data`/`calculation`/`expert_consensus` is a genuine advance over most AI-idea systems.

2. **Grounding Audit Gate** with active URI resolution (not just format check) addresses the #1 failure mode of LLM-generated research ideas: plausible-sounding but nonexistent references.

3. **Formalism registry → C2 handoff** ensures ideas aren't "one-sentence moonshots" but actually compile to executable method specs. The `candidate_formalisms` pattern constraint (`namespace/name`) enables real validation.

4. **Multi-island evolution with team/role topology** maps well to how actual theoretical physics groups work: parallel exploration by different "styles" (phenomenology-driven vs symmetry-driven vs data-driven), with periodic cross-pollination.

5. **Operator families** drawn from philosophy of science (Kuhn, Peirce, Lakatos, Popper) are well-chosen for HEP where paradigm tensions, anomaly abduction, and protective belt modification are genuine research patterns (e.g., SUSY → split SUSY → mini-split is textbook Lakatos).

6. **`novelty_delta_table` with `non_novelty_flags`** directly addresses the "GPT thinks everything is novel" problem. Requiring `closest_prior_uris` + falsifiable `delta_statement` is a significant quality gate.

### Gaps for real research

1. **No explicit handling of negative results / dead ends**: Real research generates many "this doesn't work because X" results that are valuable for pruning but aren't captured by the current `IdeaNode` schema. Consider an explicit `outcome: productive | dead_end | inconclusive` field.

2. **`minimal_compute_plan` difficulty estimates are coarse**: `straightforward | moderate | challenging | research_frontier` is better than nothing, but HEP computations have very specific bottleneck types (loop order, number of external legs, phase-space dimensionality, lattice volume). The `extensions` escape hatch via `additionalProperties: false` on compute plan items is currently **blocked**. This should be relaxed or an `extensions` field added.

3. **No temporal/collaboration context for seeds**: Real HEP ideas often emerge from "paper X appeared last week + tension Y worsened in latest PDG update." The `seed_pack_v1` has `created_at` but individual seeds lack timestamps or urgency signals. The `metadata` field partially addresses this but is unstructured.

---

## Robustness & safety

### Hallucination mitigation: STRONG

- Active URI resolution (not just format validation) for evidence
- Conditional `verification_plan` requirement for LLM inferences
- `folklore_risk_score` with human escalation gate
- Clean-room evaluation (evaluators don't share context)
- Structured debate only on explicit trigger (prevents groupthink)
- `non_novelty_flags` prevent superficial-novelty hallucination

### Provenance: STRONG

- `origin` with model/temperature/prompt_hash/role
- `operator_trace` with inputs/params/seed/evidence_uris/prompt_snapshot_hash
- Append-only IdeaNode with immutability contract on creation fields
- Idempotency metadata for replay auditability

### Cost control: GOOD with caveats

- Budget Circuit Breaker is well-specified
- Degradation order is configurable
- Step-level budget fuse prevents runaway single steps
- **Caveat**: No per-island budget allocation mechanism in the schema (only at campaign level). A runaway island could consume disproportionate budget before the global fuse triggers. The `extensions` on `BudgetEnvelope` can carry this, but it's not enforced.

### Idempotency: STRONG but see Blocker B2

- RFC 8785 JCS canonicalization is the right choice
- Default-value filling before hashing prevents false conflicts
- Payload hash echo enables client-side verification
- Campaign-scoped stores prevent cross-campaign pollution
- **Gap**: No explicit TTL/GC for idempotency records of non-init methods (spec says "at least until campaign end" which is correct but implementation guidance for storage growth is absent)

### Concurrency: EXPLICITLY DEFERRED (acceptable for v0.x)

The single-writer-per-campaign constraint is honest and appropriate. The note about future optimistic concurrency control (`expected_version`) is the right direction.

---

## Specific patch suggestions

### P1. `schemas/idea_core_rpc_v1.openrpc.json` — `campaign.resume` description clarification

**File**: `schemas/idea_core_rpc_v1.openrpc.json`  
**Location**: `methods[4].description` (campaign.resume)  
**Change**: Replace:
```
"Accepted when campaign status is paused|early_stopped|exhausted."
```
with:
```
"Accepted (not campaign_not_active) when campaign status is paused|early_stopped|exhausted. However, if status is exhausted, the engine MUST reject with budget_exhausted (-32001) without changing state; the caller should campaign.topup first. If status is paused or early_stopped but current budget is exhausted (any dimension remaining <= 0), the engine MUST also reject with budget_exhausted (-32001) without changing state."
```

### P2. `schemas/idea_core_rpc_v1.openrpc.json` — `search.step` idempotency warning

**File**: `schemas/idea_core_rpc_v1.openrpc.json`  
**Location**: `methods[6].description` (search.step)  
**Change**: Append to description:
```
"\n\nIdempotency + partial completion: If a search.step call completes fewer than n_steps ticks (due to early stop, budget fuse, or policy halt), the idempotency record stores this partial result. Retrying with the same idempotency_key after topup/resume will replay the original partial result, NOT continue from where it stopped. Callers MUST use a new idempotency_key to request additional steps after addressing the early-stop cause."
```

### P3. `schemas/idea_core_rpc_v1.openrpc.json` — `eval.run` atomicity + idempotency ordering

**File**: `schemas/idea_core_rpc_v1.openrpc.json`  
**Location**: `methods[9].description` (eval.run)  
**Change**: Append to description:
```
"\n\nIdempotency + atomicity ordering: For successful execution, the idempotency record and all eval side-effects MUST be committed atomically (or the idempotency record must only be visible after all side-effects are durable). For error responses requiring rollback, the idempotency record storing the error MUST be committed only after all partial side-effects are fully rolled back."
```

### P4. Add `schemas/idea_handoff_c2_v1.schema.json` (new file)

**File**: `schemas/idea_handoff_c2_v1.schema.json` (NEW)  
**Content**:
```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "idea_handoff_c2_v1.schema.json",
  "title": "IdeaHandoffC2 v1",
  "description": "Structured handoff artifact from idea-generator (A0.2 promotion) to C2 Method Design. This is the sole entry point into C2; missing required fields MUST cause rejection at C2 intake.",
  "type": "object",
  "required": [
    "campaign_id",
    "node_id",
    "idea_id",
    "idea_card",
    "grounding_audit_summary",
    "formalism_check",
    "promotion_timestamp",
    "provenance"
  ],
  "properties": {
    "campaign_id": { "type": "string", "format": "uuid" },
    "node_id": { "type": "string", "format": "uuid" },
    "idea_id": { "type": "string", "format": "uuid" },
    "idea_card": { "$ref": "./idea_card_v1.schema.json" },
    "grounding_audit_summary": {
      "type": "object",
      "required": ["status", "folklore_risk_score"],
      "properties": {
        "status": { "const": "pass" },
        "folklore_risk_score": { "type": "number", "minimum": 0, "maximum": 1 }
      },
      "additionalProperties": false
    },
    "formalism_check": {
      "type": "object",
      "required": ["status", "resolved_formalisms"],
      "properties": {
        "status": { "const": "pass" },
        "resolved_formalisms": {
          "type": "array",
          "minItems": 1,
          "items": {
            "type": "object",
            "required": ["formalism_id", "c2_schema_ref", "compiler_id"],
            "properties": {
              "formalism_id": { "type": "string", "pattern": "^[a-z0-9_-]+\\/[a-z0-9_.-]+$" },
              "c2_schema_ref": { "type": "string", "format": "uri" },
              "compiler_id": { "type": "string", "minLength": 1 }
            },
            "additionalProperties": false
          }
        }
      },
      "additionalProperties": false
    },
    "promotion_timestamp": { "type": "string", "format": "date-time" },
    "provenance": {
      "type": "object",
      "required": ["origin", "operator_trace"],
      "properties": {
        "origin": { "$ref": "./idea_node_v1.schema.json#/properties/origin" },
        "operator_trace": { "$ref": "./idea_node_v1.schema.json#/properties/operator_trace" },
        "parent_node_ids": { "type": "array", "items": { "type": "string", "format": "uuid" } }
      },
      "additionalProperties": false
    }
  },
  "additionalProperties": false
}
```

### P5. `schemas/idea_core_rpc_v1.openrpc.json` — `node.promote` add `budget_exhausted` error

**File**: `schemas/idea_core_rpc_v1.openrpc.json`  
**Location**: `methods[8].errors` (node.promote)  
**Change**: Add to errors array:
```json
{ "code": -32001, "message": "budget_exhausted" }
```
And update description to: "Side-effecting. Only permitted when campaign status is running; if exhausted returns budget_exhausted (-32001); otherwise campaign_not_active."

Alternatively, if `node.promote` is intentionally budget-free, add to the description: "node.promote does not consume budget envelope resources; in exhausted state, the engine returns campaign_not_active (not budget_exhausted), since promotion is a write operation gated on campaign liveness, not budget availability."

### P6. `schemas/idea_card_v1.schema.json` — add `extensions` to `minimal_compute_plan` items

**File**: `schemas/idea_card_v1.schema.json`  
**Location**: `properties.minimal_compute_plan.items`  
**Change**: Add before `"additionalProperties": false`:
```json
"extensions": {
  "type": "object",
  "description": "Domain-specific compute plan metadata (e.g., loop_order, n_external_legs, lattice_volume, phase_space_dim for HEP).",
  "additionalProperties": true
}
```

### P7. `schemas/idea_node_v1.schema.json` — add `outcome` field

**File**: `schemas/idea_node_v1.schema.json`  
**Location**: `properties` (top-level, after `grounding_audit`)  
**Change**: Add:
```json
"outcome": {
  "enum": ["active", "productive", "dead_end", "inconclusive", "promoted"],
  "default": "active",
  "description": "Lifecycle outcome of this node. 'dead_end' captures valuable negative results. 'promoted' is set after successful node.promote. Mutable field."
}
```

### P8. `schemas/elo_config_v1.schema.json` — add `k_factor` and `initial_rating`

**File**: `schemas/elo_config_v1.schema.json`  
**Change**: Add optional properties:
```json
"k_factor": {
  "type": "number",
  "minimum": 1,
  "default": 32,
  "description": "Elo K-factor controlling rating volatility per match."
},
"initial_rating": {
  "type": "number",
  "minimum": 0,
  "default": 1500,
  "description": "Initial Elo rating for all nodes entering the tournament."
}
```

### P9. `docs/plans/2026-02-12-idea-generator-architecture-spec.md` — add atomicity guarantee for idempotency store

**File**: `docs/plans/2026-02-12-idea-generator-architecture-spec.md`  
**Location**: §2.3 point 2, after "去重记录的最小落盘内容" bullet  
**Change**: Add new bullet:
```markdown
- **Idempotency store atomicity（必须）**：
  - 成功路径：idempotency 记录必须与该方法的 side-effects 在同一事务中提交（或 idempotency 记录仅在所有 side-effects 持久化后才可见）。
  - 失败路径（rollback 后）：idempotency 记录存储 error 响应，必须仅在所有部分 side-effects 完全回滚后提交。
  - 崩溃语义：若进程在 side-effects 提交与 idempotency 记录写入之间崩溃，重试必须安全（最坏情况：重新执行该请求，不会产生重复产物；因此 side-effects 自身也应具有去重能力，例如 node_id 基于确定性种子生成）。
```

### P10. `schemas/idea_core_rpc_v1.openrpc.json` — add `info.description` note about OpenRPC version

**File**: `schemas/idea_core_rpc_v1.openrpc.json`  
**Location**: `info` block  
**Change**: The version `1.8.9` is high for a v1 API still in design. Consider whether this tracks the schema iteration count or semantic versioning. If it's design iterations, add: `"x-design-iteration": 189` and reset `"version": "1.0.0-rc.1"` to signal pre-release status. This prevents downstream consumers from assuming stability.
