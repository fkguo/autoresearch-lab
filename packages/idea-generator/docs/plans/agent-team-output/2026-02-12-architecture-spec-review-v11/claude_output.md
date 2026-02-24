VERDICT: NOT_READY

## Blockers

### B1. OpenRPC `$ref` resolution is broken for `components.schemas`

The OpenRPC spec uses `$ref` inside `components.schemas` like:

```json
"CampaignCharterV1": { "$ref": "campaign_charter_v1.schema.json" }
```

This is a **bare file path**, not a JSON Pointer or a proper `$ref` URI. OpenRPC 1.2.6 inherits JSON Schema `$ref` semantics, which require the reference to resolve relative to the document's `$id` or base URI. Since `idea_core_rpc_v1.openrpc.json` has no `$id`, and the `$ref` targets are sibling files without anchors, tooling behavior is **implementation-defined** — some resolvers (e.g., `@open-rpc/meta-schema` validator, Spectral) will fail because `campaign_charter_v1.schema.json` is not a valid JSON Pointer fragment and there's no declared base URI.

**Fix required**: Either (a) add an `$id` to the OpenRPC doc (e.g., `"$id": "file:///schemas/idea_core_rpc_v1.openrpc.json"`) so relative file refs resolve deterministically, or (b) use the pattern `{"$ref": "./campaign_charter_v1.schema.json"}` with explicit relative-URI syntax. The spec doc's "契约 SSOT 规则" mandates `$ref`-only composition — but the refs must actually resolve.

### B2. `campaign.topup` error code `-32015` (`campaign_not_active`) is undocumented in the spec's error code table

Section 2.3 of the architecture spec lists the "错误码约定" as: `budget_exhausted / schema_validation_failed / grounding_audit_failed / formalism_not_in_registry / insufficient_eval_data / campaign_not_found / node_not_found / node_not_in_campaign`. The `campaign_not_active` code used by `campaign.topup` is **missing** from this list. This means the spec doc and the OpenRPC disagree on the error surface. Either the spec must be updated to include it, or the OpenRPC must use one of the declared codes.

**Similarly**: `invalid_charter` (`-32010`) is declared in `campaign.init` errors but not in the spec's error code table.

### B3. `node.list` pagination contract has a soundness gap: `cursor` is required in the result but there's no way to distinguish "first page, no cursor provided" from "exhausted"

In `node_list_result_v1.schema.json`, `cursor` is **required** and typed as `["string", "null"]`. This is correct for the response. However, in the OpenRPC method `node.list`, the *request* `cursor` param is typed as `{ "type": "string", "minLength": 1 }` with no `required: true` — so it's optional. This is fine.

**The actual blocker**: `node.list` is a read-only method, yet it has **no** `idempotency_key` (correctly, as it's not side-effecting). But the spec in §2.3 says "涉及 `campaign_id` 的 RPC（包括 `node.get/node.list/node.promote`...）engine 必须验证所有涉及的 `node_id/node_ids` 都属于该 campaign". The `node.list` filter includes `node_id` as an optional filter field — but there's **no error declared** for `node_not_in_campaign` on `node.list`. If a caller filters by a `node_id` that doesn't belong to the campaign, the spec says it MUST error, but the OpenRPC declares only `campaign_not_found`.

**Fix**: Add `node_not_in_campaign` (`-32014`) to `node.list` errors, or clarify that the campaign-scoping rule for `node.list` means "results are always scoped to the campaign" (filter by `node_id` that doesn't match simply returns empty results, not an error). The latter is more practical for a list endpoint.

### B4. `search.step` idempotency semantics are under-specified for non-deterministic operations

The spec mandates that duplicate hits return "the same logical response as the first call." But `search.step` involves LLM generation, which is inherently non-deterministic (even with `random_seed`, different backends may not reproduce). The idempotency contract therefore **must** mean: "store and replay the first result," not "re-execute and expect the same output."

This is implicitly the intent, but it's not stated. If an implementation tries to "re-derive" instead of "replay from store," it violates the contract. The spec or OpenRPC description should explicitly state: **idempotency is achieved by storing and replaying the first successful response, not by re-execution.**

### B5. `eval.run` lacks a `node_not_in_campaign` check enforcement path for batch `node_ids`

The OpenRPC declares `node_not_in_campaign` as a possible error for `eval.run`. But with batch `node_ids` (array), the spec doesn't specify: does the engine fail the **entire** call if any single node_id is not in the campaign, or does it return partial results? For an idempotent side-effecting call, partial execution with partial failure is a **consistency hazard** — the idempotency replay would need to replay a partial result, which complicates the store.

**Fix**: The spec must mandate all-or-nothing semantics: if any `node_id` in the array fails validation (not found, not in campaign), the entire `eval.run` MUST fail atomically before any side-effects. State this in both the spec doc §2.3 and the OpenRPC method description.

---

## Non-blocking

### N1. `BudgetSnapshot` schema: `steps_remaining` and `nodes_remaining` use `oneOf: [integer, null]` but `tokens_remaining` and `cost_usd_remaining` don't

If `max_steps` and `max_nodes` are optional in the envelope, their `_remaining` counterparts can be `null`. But `max_tokens` / `max_cost_usd` / `max_wall_clock_s` are **required** in `BudgetEnvelopeV1`, so their remaining values are always computable. This asymmetry is logically correct but should be documented with a one-line note in `budget_snapshot_v1.schema.json` for implementors (e.g., "`tokens_remaining` is always present because `max_tokens` is required in BudgetEnvelope").

### N2. `IdeaCard.claims[].evidence_uris` allows empty array for `literature`/`data`/`calculation`/`expert_consensus`

The conditional `then` clause sets `"minItems": 1` for evidence-backed support types, but the `then` block doesn't use `required` — the property is already required at the top level. This actually works correctly because `evidence_uris` is in `required` and the `then` adds `minItems: 1`. ✅ Verified correct, but the `allOf` nesting is subtle. Consider adding a comment or test case.

### N3. `EloConfig` is very minimal — no K-factor, no initial rating, no pairing strategy

The spec says "pairing 规则写入 ranking artifact 以便回放" but the config only has `max_rounds` and `seed`. This is fine for v0.2 (implementation can choose defaults), but for reproducibility, consider adding optional `k_factor`, `initial_rating`, and `pairing_strategy` (enum: `random | swiss | round_robin`) in v0.3.

### N4. `search.step` `n_steps` has `"default": 1` in the schema but is not in `required`

JSON Schema `default` is advisory (not enforced by validators). The OpenRPC also doesn't mark it as required. This means the engine must handle the case where `n_steps` is omitted. The spec should clarify: engine MUST treat omitted `n_steps` as 1. Currently the default is only in the schema annotation.

### N5. `RationaleDraft` lacks a `created_at` / `origin` field

While the parent `IdeaNode` carries `origin` and `created_at`, if `RationaleDraft` is ever stored as a standalone artifact (the spec mentions "或其 artifact 引用"), it won't have intrinsic provenance. Consider adding optional `created_at` and `origin_ref` fields.

### N6. `IslandState` doesn't include `operator_weights` or `operator_ids`

The spec describes islands as having operator/constraint weight configurations, but the observable state schema doesn't expose which operators are active or their current bandit weights. This limits observability for debugging search dynamics.

### N7. Campaign lifecycle state machine is implicit

`CampaignStatusV1.status` has values `running | paused | early_stopped | exhausted | completed`, but the valid state transitions aren't documented anywhere. For example: can a campaign go from `exhausted` back to `running` after `campaign.topup`? The spec says topup is "permitted when campaign status is running|paused|early_stopped|exhausted" — so presumably yes. Document the state machine explicitly.

### N8. `degradation_order` enum in `BudgetEnvelopeV1` and `SearchStepResultV1.degradation_events` should be a shared enum definition

Currently the same enum is duplicated in two schemas. Extract to a shared `degradation_action_v1.schema.json` and `$ref` it from both.

### N9. The `idea_list_filter_v1.schema.json` has no `min_score` / `max_score` / `created_after` / `created_before` filters

For campaigns with thousands of nodes, time-range and score-range filtering will be essential. Not blocking for v0.2 but should be on the v0.3 roadmap.

### N10. `prompt_snapshot_hash` is optional in `operator_trace` but `prompt_hash` is required in `origin`

Both serve reproducibility. If the operator used a prompt, the snapshot hash should arguably be required in `operator_trace` as well (or at least documented why it's optional — e.g., tool-based operators don't use prompts).

---

## Real-research fit

### R1. The Explain-Then-Formalize pipeline maps well to actual HEP theory practice

Theorists typically start with physical intuition/motivation (why this anomaly matters, what symmetry could explain it) before writing down a Lagrangian. The `RationaleDraft → IdeaCard` pipeline mirrors this. The `kill_criteria` field in `RationaleDraft` is particularly valuable — it forces the system to think about falsifiability before investing in formalization.

### R2. Grounding Audit is the single most important safety mechanism

In my experience, LLM-generated physics ideas often cite papers that don't exist or mischaracterize existing results. The active URI resolution requirement (§4.2.1 point 1) and the data consistency check (point 2, PDG/HEPData tolerance) are **exactly right**. The promotion gate blocking on `grounding_audit.status != pass` is a strong, correct constraint.

### R3. The `formalism_registry` is a good forcing function but needs finer grain for HEP

Current pattern `^[a-z0-9_-]+\/[a-z0-9_.-]+$` (e.g., `hep-ph/eft-smeft-dim6`) is reasonable. However, real HEP formalisms often have version/variant semantics (e.g., SMEFT at dim-6 vs dim-8, Warsaw basis vs Green's basis). Consider allowing a version suffix in v0.3.

### R4. The multi-island evolution model is well-suited to theoretical physics idea exploration

Different "islands" can naturally correspond to different theoretical approaches (e.g., perturbative vs non-perturbative, EFT vs UV-complete, model-independent vs specific BSM model). The repopulation mechanism (cross-pollination between islands) mirrors how real physics communities cross-fertilize.

### R5. The `CrossDomainAnalogy` operator with mandatory mapping table is a strong hallucination guardrail

Requiring explicit source/target/mapping triples with invariants and kill criteria prevents the common LLM failure mode of making vague analogies ("this is like AdS/CFT but for condensed matter") without specifying what maps to what.

### R6. Missing: experimental sensitivity / reach estimation hook

For HEP-ph ideas to be truly C2-ready, there should be at minimum a placeholder for "which experiment(s) could test this" and "what is the approximate sensitivity reach." The `required_observables` field in `IdeaCard` is necessary but not sufficient — a `sensitivity_estimate` (even order-of-magnitude) would significantly improve downstream utility. This could be an `IdeaCard.extensions` field for v0.2.

---

## Robustness & safety

### S1. Idempotency store lifecycle needs explicit garbage collection semantics

The spec says "至少保留到 campaign 结束" but there's no `campaign.close` / `campaign.archive` / `campaign.delete` method. This means the idempotency store grows unboundedly. For v0.2 this is acceptable (campaigns are short-lived), but the spec should note this as a known limitation with a planned resolution in v0.3.

### S2. The `budget_exhausted` error should carry the budget snapshot

Currently, when `budget_exhausted` is returned as a JSON-RPC error, the error object only has `code` and `message`. The caller has no way to know *which* budget dimension was exhausted without a separate `campaign.status` call. Consider adding a `data` field to the error that includes a `BudgetSnapshotV1`.

### S3. No rate limiting or concurrency control on the RPC interface

The spec assumes a single caller (the hepar adapter), but doesn't address what happens if two adapters (or a retry + the original) call `search.step` concurrently with different idempotency keys. The engine needs at minimum a campaign-level mutex or optimistic concurrency check. The idempotency mechanism handles exact duplicates but not concurrent distinct calls.

### S4. `grounding_audit.failures[]` is `array of string` — too unstructured for machine consumption

For automated remediation (e.g., operator retry with different evidence), failures should be structured objects with at least `{claim_index, failure_type, details}`. The current string array requires downstream parsing.

### S5. No schema version field in any of the schemas

None of the schema files include a `version` field in the data objects themselves. If an `IdeaNode` is serialized to JSONL and read back months later, there's no way to know which schema version it was written against (except by examining the `$id`). Consider adding an optional `schema_version` field (or relying on a convention like `$schema` in each instance).

### S6. The `origin.prompt_hash` as SHA-256 is good, but there's no mechanism to retrieve the actual prompt

For true reproducibility, the prompt snapshots need to be stored somewhere retrievable by hash. The spec mentions `prompt_snapshot_hash` in `operator_trace` but doesn't specify a prompt archive. Add a note about a `prompt_store` (content-addressable, keyed by SHA-256).

---

## Specific patch suggestions

### P1. `schemas/idea_core_rpc_v1.openrpc.json` — Fix `$ref` resolution

**File**: `schemas/idea_core_rpc_v1.openrpc.json`  
**Location**: Top-level, add `$id`; all `$ref` in `components.schemas`  
**Change**:
```json
// Add after "openrpc": "1.2.6":
"$id": "https://hepar.dev/schemas/idea_core_rpc_v1.openrpc.json",

// Change all component refs from:
"CampaignCharterV1": { "$ref": "campaign_charter_v1.schema.json" }
// To:
"CampaignCharterV1": { "$ref": "./campaign_charter_v1.schema.json" }
```
(The `./` prefix is a minor but important URI normalization. The `$id` is the real fix.)

### P2. `docs/plans/2026-02-12-idea-generator-architecture-spec.md` — Add missing error codes to §2.3

**File**: `docs/plans/2026-02-12-idea-generator-architecture-spec.md`  
**Location**: §2.3, error code list  
**Change**: Replace
```
budget_exhausted / schema_validation_failed / grounding_audit_failed / formalism_not_in_registry / insufficient_eval_data / campaign_not_found / node_not_found / node_not_in_campaign
```
with:
```
budget_exhausted (-32001) / schema_validation_failed (-32002) / campaign_not_found (-32003) / node_not_found (-32004) / invalid_charter (-32010) / grounding_audit_failed (-32011) / formalism_not_in_registry (-32012) / insufficient_eval_data (-32013) / node_not_in_campaign (-32014) / campaign_not_active (-32015)
```
(Adds `invalid_charter` and `campaign_not_active`; adds numeric codes for machine-reference.)

### P3. `docs/plans/2026-02-12-idea-generator-architecture-spec.md` — Add idempotency implementation note

**File**: `docs/plans/2026-02-12-idea-generator-architecture-spec.md`  
**Location**: §2.3, after "Idempotency replay 规则"  
**Add paragraph**:
```markdown
- **实现方式（MUST）**：idempotency 通过"存储并重放首次成功响应"实现，
  而非重新执行。这对于涉及 LLM 生成的 non-deterministic 方法
  （如 `search.step`、`eval.run`）尤为关键——重新执行不保证相同输出。
  Engine 在首次成功执行后，必须将完整 response 持久化到 idempotency store；
  duplicate hit 时直接返回存储的 response（仅修改 `is_replay` 标志）。
```

### P4. `docs/plans/2026-02-12-idea-generator-architecture-spec.md` — Add atomicity requirement for batch methods

**File**: `docs/plans/2026-02-12-idea-generator-architecture-spec.md`  
**Location**: §2.3, after Campaign scoping MUST  
**Add**:
```markdown
3. **Batch atomicity MUST**：接受 `node_ids[]` 数组的 RPC（`eval.run`、未来可能的批量操作），
   必须在执行任何 side-effect 之前验证 **所有** node_ids 的存在性与 campaign 归属。
   任一 node 验证失败，整个调用必须原子性地失败（不产生部分 side-effect）。
   这确保 idempotency replay 不需要处理"部分成功"语义。
```

### P5. `schemas/idea_core_rpc_v1.openrpc.json` — Add `node_not_in_campaign` error to `node.list`

**File**: `schemas/idea_core_rpc_v1.openrpc.json`  
**Location**: `node.list` method, `errors` array  
**Change**: Either add the error:
```json
{ "code": -32014, "message": "node_not_in_campaign" }
```
OR (recommended, as it's a list endpoint) add a description clarifying the scoping behavior:
```json
"description": "List IdeaNodes in a campaign (paginated). All results are implicitly scoped to the campaign. Filtering by node_id that does not belong to the campaign returns an empty result set (not an error)."
```

### P6. `schemas/idea_node_v1.schema.json` — Structured grounding audit failures

**File**: `schemas/idea_node_v1.schema.json`  
**Location**: `grounding_audit.failures`  
**Change**: Replace
```json
"failures": { "type": "array", "items": { "type": "string" } }
```
with:
```json
"failures": {
  "type": "array",
  "items": {
    "type": "object",
    "required": ["failure_type", "details"],
    "properties": {
      "claim_index": {
        "type": "integer",
        "minimum": 0,
        "description": "Index into idea_card.claims[] that this failure pertains to. Omit for card-level failures."
      },
      "evidence_uri": {
        "type": "string",
        "format": "uri",
        "description": "The specific URI that failed resolution/validation, if applicable."
      },
      "failure_type": {
        "enum": ["uri_unresolvable", "data_mismatch", "missing_verification_plan", "folklore_overlap", "phantom_reference"]
      },
      "details": { "type": "string", "minLength": 1 }
    },
    "additionalProperties": false
  }
}
```
Also update `promotion_result_v1.schema.json`'s `grounding_audit_summary.failures` to match (or `$ref` a shared failure item schema).

### P7. `schemas/budget_envelope_v1.schema.json` and `schemas/search_step_result_v1.schema.json` — Extract shared degradation enum

**New file**: `schemas/degradation_action_v1.schema.json`
```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "degradation_action_v1.schema.json",
  "title": "DegradationAction v1",
  "description": "Enumeration of budget degradation actions.",
  "enum": [
    "reduce_eval_rounds",
    "reduce_islands",
    "disable_cross_domain_operators",
    "reduce_population",
    "early_stop"
  ]
}
```
Then `$ref` it from both `budget_envelope_v1` and `search_step_result_v1`.

### P8. `schemas/idea_core_rpc_v1.openrpc.json` — Add `data` field to `budget_exhausted` error

**File**: `schemas/idea_core_rpc_v1.openrpc.json`  
**Location**: Every method that declares `budget_exhausted`  
**Change**:
```json
{
  "code": -32001,
  "message": "budget_exhausted",
  "data": {
    "description": "SHOULD include a BudgetSnapshotV1 showing which dimension was exhausted.",
    "schema": { "$ref": "./budget_snapshot_v1.schema.json" }
  }
}
```

### P9. `docs/plans/2026-02-12-idea-generator-architecture-spec.md` — Add campaign state machine diagram

**File**: `docs/plans/2026-02-12-idea-generator-architecture-spec.md`  
**Location**: New subsection after §2.3 or within §8 (门禁)  
**Add**:
```markdown
### Campaign Lifecycle State Machine

```
          campaign.init
              │
              ▼
          ┌─────────┐
          │ running  │◄──────── campaign.topup (from early_stopped/exhausted/paused)
          └────┬─────┘
               │
       ┌───────┼────────┐
       ▼       ▼        ▼
   ┌────────┐ ┌──────────────┐ ┌───────────┐
   │ paused │ │ early_stopped│ │ exhausted  │
   └────┬───┘ └──────┬───────┘ └─────┬─────┘
        │            │               │
        └────────────┼───────────────┘
                     ▼
               ┌───────────┐
               │ completed  │  (terminal; topup rejected)
               └───────────┘
```

Valid transitions:
- `running → paused` (operator pause)
- `running → early_stopped` (budget fuse / degradation)
- `running → exhausted` (global budget depleted)
- `running → completed` (all objectives met or operator decision)
- `paused → running` (resume)
- `early_stopped → running` (after topup)
- `exhausted → running` (after topup)
- `completed` is terminal.
```

### P10. `schemas/idea_card_v1.schema.json` — Add optional `sensitivity_estimates` for HEP fitness

**File**: `schemas/idea_card_v1.schema.json`  
**Location**: After `claims` property  
**Add**:
```json
"sensitivity_estimates": {
  "type": "array",
  "description": "Optional order-of-magnitude experimental sensitivity estimates (HEP-specific but useful for C2 handoff).",
  "items": {
    "type": "object",
    "required": ["experiment_or_class", "observable", "estimated_reach"],
    "properties": {
      "experiment_or_class": { "type": "string", "minLength": 1 },
      "observable": { "type": "string", "minLength": 1 },
      "estimated_reach": { "type": "string", "minLength": 1 },
      "confidence": { "enum": ["high", "medium", "low", "speculative"] },
      "reference_uri": { "type": "string", "format": "uri" }
    },
    "additionalProperties": false
  }
}
```
