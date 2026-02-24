VERDICT: NOT_READY

## Blockers

### B1. `rank.compute` minimum-node constraints are inconsistent between spec and schema

The architecture spec §2.3 says: "**Pareto 要求筛选后节点数 ≥ 1（0 则 fail），Elo 要求节点数 ≥ 2（<2 则 fail）**". The OpenRPC description repeats this correctly. However, `ranking_result_v1.schema.json` has `"ranked_nodes": { "type": "array", "minItems": 1 }` — this is correct for Pareto (≥1) but also applies when `method=elo`, where `minItems` should be 2. The schema cannot enforce `minItems` conditionally by `method`, so the JSON Schema as written **cannot machine-enforce the Elo ≥2 invariant at the schema layer**. The spec says "engine MUST" but no schema-level gate exists.

**Fix**: Add a conditional `allOf` / `if-then` to `ranking_result_v1.schema.json`:
```json
"allOf": [{
  "if": { "properties": { "method": { "const": "elo" } }, "required": ["method"] },
  "then": { "properties": { "ranked_nodes": { "minItems": 2 } } }
}]
```

### B2. `search_step_result_v1` conditional `allOf` for `updated_nodes_artifact_ref` is subtly wrong

The schema has:
```json
{
  "if": { "properties": { "updated_node_ids": { "type": "array", "minItems": 1 } }, "required": ["updated_node_ids"] },
  "then": { "required": ["updated_nodes_artifact_ref"] }
}
```
Since `updated_node_ids` is already `required` at the top level, the `"required": ["updated_node_ids"]` in the `if` clause is always true. The `if` condition degenerates to just the type+minItems check. This **happens to work** but is fragile and misleading. More critically: the `if` checks that the *value* is an array with ≥1 items AND the key exists. But if the engine returns `"updated_node_ids": []` (empty array — which is valid per the top-level schema since there's no `minItems` constraint on `updated_node_ids`), the `if` evaluates to false, so `updated_nodes_artifact_ref` is not required. This is the **intended** behavior but only by accident — the logic should be documented.

The same pattern for `new_node_ids` / `new_nodes_artifact_ref` has the identical issue: `new_node_ids` is required at top level but has no `minItems`, so the conditional only fires when the array is non-empty. This works but should be explicitly documented.

**Not a schema bug per se, but a readability/maintainability blocker**: any future editor may add `minItems: 0` (or remove the top-level `required`) and silently break the conditional. Add `$comment` annotations.

### B3. `campaign.topup` cannot return `budget_exhausted` per OpenRPC, but spec §2.4 says topup from `exhausted` may stay `exhausted`

The spec says: "*campaign.topup MUST NOT return budget_exhausted*" (OpenRPC description confirms). But the spec also says topup on `exhausted` may remain `exhausted` (if topup is insufficient). This is consistent — the "still exhausted" state is communicated via `campaign_mutation_result.transition.current_status = "exhausted"` with `changed = false`. However, the spec §2.4 state machine table says `exhausted → running|exhausted (conditional)`. The **adapter** (caller) has no explicit guidance on how to detect "topup succeeded but campaign is still exhausted" vs "topup applied and campaign is now running" — it must check `transition.current_status`. This is technically fine but the spec should **explicitly state this detection pattern** as a MUST for adapter implementors, because the natural instinct is to check for a `budget_exhausted` error.

**Fix**: Add a normative note to the `campaign.topup` description: "Adapters MUST inspect `transition.current_status` (not error codes) to determine whether the campaign exited the exhausted state."

### B4. `eval.run` atomicity claim contradicts `eval_result_v1` structure

The spec and OpenRPC both say eval.run is atomic: "on any error... no partial writes". The `eval_result_v1.schema.json` says `updated_node_ids MUST be set-equal to node_ids on success`. Good. But the schema allows `updated_node_ids` to be **any** array of UUIDs — there's no schema-level enforcement that `updated_node_ids ⊆ node_ids` or that they're set-equal. This means a buggy engine could return a success with `updated_node_ids ≠ node_ids` and it would pass schema validation.

**Fix**: This can't be fully enforced by JSON Schema, but add a `$comment` and consider a `minItems` / `maxItems` constraint on `updated_node_ids` matching `node_ids`:
```json
"updated_node_ids": {
  "type": "array",
  "minItems": 1,
  "maxItems": 100,
  "items": { "type": "string", "format": "uuid" }
}
```
At minimum, `minItems: 1` (since success implies at least one node was evaluated). Also add an `x-invariant` annotation for tooling.

### B5. `campaign_status_v1` conditional `early_stop_reason` required-if-early_stopped has a schema subtlety

```json
"allOf": [{
  "if": { "properties": { "status": { "const": "early_stopped" } }, "required": ["status"] },
  "then": { "required": ["early_stop_reason"] }
}]
```
This correctly makes `early_stop_reason` required when status is `early_stopped`. However, `early_stop_reason` is typed as `"type": "string"` with no `minLength`, so an empty string `""` would pass. Since this is machine-readable, add `"minLength": 1`.

### B6. No `campaign_status_v1.schema.json` standalone file is listed, but it's `$ref`'d everywhere

`campaign_init_result_v1.schema.json` contains `"status": { "const": "running" }` — this is fine, it's a literal.  
`idea_campaign_v1.schema.json` has `"status": { "$ref": "./campaign_status_v1.schema.json" }`.  
`campaign_mutation_result_v1.schema.json` has `"campaign_status": { "$ref": "./campaign_status_v1.schema.json" }`.

The file `campaign_status_v1.schema.json` IS in the bundle. ✓ No issue here — I was verifying.

### B7. `idea_node_v1` mutable fields lack version-gating for optimistic concurrency

The spec §2.3.1 mentions "v1.0+ 可考虑引入乐观并发控制（例如 `expected_version` 字段）". The `revision` field exists on `IdeaNode` (good!). But **no RPC method accepts `expected_revision`** as a parameter. If `eval.run` or `search.step` updates a node, there's no way to detect stale-write conflicts even in single-writer mode. The `revision` field is write-only from the engine's perspective — callers can read it but never assert on it.

**This is a blocker for testability**: the spec says "revision... Enables stale-read detection and future optimistic concurrency" but provides no mechanism to actually use it. Either:
- Add `expected_revision` as an optional param to `eval.run` / `node.promote` now (even if v0.x ignores it), or
- Explicitly document that `revision` is **informational-only** in v0.x and remove the "enables... optimistic concurrency" claim (which implies a contract that doesn't exist).

## Non-blocking

### N1. `seed_pack_v1.schema.json` duplicates `idea_seed_pack_v1.schema.json`

`seed_pack_v1` is the input param to `campaign.init`. `idea_seed_pack_v1` wraps it with `campaign_id + created_at`. This is fine architecturally (input vs. persisted artifact), but the naming is confusingly similar. Consider renaming `seed_pack_v1` → `seed_pack_input_v1` or adding a `$comment` to each clarifying the distinction.

### N2. `idea_list_filter_v1` has no `min_score` / `has_eval_info` / `status` filter

For `rank.compute`'s filter parameter, the spec implies filtering to nodes with scorecards. But `idea_list_filter_v1` has no `has_eval_info`, `min_score_*`, or `has_scorecard` predicate. This means `rank.compute` must internally join against scorecards rather than relying on the filter schema — which is fine for v0.x but will become painful. Add `has_eval_info: boolean` at minimum.

### N3. `novelty_delta_table` is duplicated inline in both `idea_scorecards_v1` and `idea_node_v1.eval_info`

The identical sub-schema appears verbatim in two places. This violates the spec's own "契约 SSOT 规则" (no copy-paste). Extract to `schemas/novelty_delta_entry_v1.schema.json` and `$ref` it.

### N4. `fix_suggestions` sub-schema is duplicated in `idea_scorecards_v1` and `idea_node_v1.eval_info`

Same issue as N3. Extract to `schemas/fix_suggestion_v1.schema.json`.

### N5. `budget_snapshot_v1` has `steps_remaining` and `nodes_remaining` as `oneOf: [integer, null]` but `tokens_remaining` / `cost_usd_remaining` / `wall_clock_s_remaining` are plain integers/numbers

This asymmetry implies tokens/cost/wall_clock are always bounded (they're `required` in `BudgetEnvelope`), while steps/nodes may not be. Correct — `BudgetEnvelope` makes `max_tokens`, `max_cost_usd`, `max_wall_clock_s` required but `max_steps` and `max_nodes` optional. The schema is **consistent**, but `wall_clock_s_remaining` has a description about clamping at 0, while other `*_remaining` fields don't. Add the same clamping note to `tokens_remaining` and `cost_usd_remaining` for consistency.

### N6. `search_step_result_v1.n_steps_executed` allows `minimum: 0`

If `n_steps_executed = 0` on a non-error success response, that means the engine consumed a call slot, wrote an idempotency record, but did literally nothing. Is this valid? The spec says a tick is atomic and the call "may partially execute multiple ticks." Zero ticks completed on success is an edge case that should be explicitly addressed — e.g., if the very first tick's budget check fails, should this be a success with `n_steps_executed=0, early_stopped=true` or an error `budget_exhausted`? The current schema allows both interpretations.

**Recommendation**: If `n_steps_executed = 0` is valid, the `early_stopped` conditional should fire (requiring `early_stop_reason`). Add a `$comment` clarifying this.

### N7. `idea_handoff_c2_v1` has `formalism_check.missing_formalisms` with `maxItems: 0`

This is clever — on a success artifact, missing formalisms must be empty. But JSON Schema `maxItems: 0` combined with `"type": "array"` means only `[]` is valid. This is correct but unusual. Alternatively, use `"const": []`. Both work; `const` is more readable.

### N8. OpenRPC `info.version` is `1.8.10` — very high for a v0.2 spec

This suggests many iterations already happened. Consider resetting to `0.2.0` (matching the spec version) to reduce confusion about maturity signals.

### N9. `campaign.pause` doesn't check budget before transitioning

The spec says `campaign.pause` accepts `running|early_stopped|exhausted → paused`. This means you can pause an `exhausted` campaign. Then `campaign.resume` from `paused` checks budget — if still exhausted, it rejects with `budget_exhausted`. This creates a "pause trap": `exhausted → pause → (topup) → resume`. The spec documents this as a "typical workflow" which is fine, but the interaction is subtle. No schema change needed, but add a test case to the spec.

### N10. `rank.compute` `dimensions` parameter defaults are under-specified

The spec says: "If omitted, the engine SHOULD use the dimensions available in the effective scorecards snapshot (optionally intersected with EvaluatorConfig.dimensions)." The "optionally" is too loose — it means two conforming implementations could produce different rankings from the same data. Change to MUST (pick one behavior).

## Real-research fit

### R1. Evidence-first provenance is well-designed

The `claims[].support_type + evidence_uris + verification_plan` structure in `idea_card_v1` is one of the strongest parts of this design. The conditional schema validation (`if support_type in [llm_inference, assumption] then require verification_plan`) is machine-enforceable and directly maps to the "every claim must be auditable" principle. This will genuinely help prevent the "looks like it has references but doesn't" failure mode in LLM-generated research ideas.

### R2. Grounding Audit Gate is realistic for HEP

Active URI resolution via INSPIRE API / DOI resolver is feasible and high-value. The `folklore_risk_score` with human escalation at threshold is a pragmatic compromise. For real HEP research, the biggest risk is not hallucinated references (easy to catch) but **correct references that don't actually support the claim** — the spec acknowledges this in §4.2.1 but the schema doesn't have a field for "claim-evidence relevance score." Consider adding `relevance_assessment` to the grounding audit.

### R3. Operator families map well to actual physics research strategies

`AnomalyAbduction`, `SymmetryOperator`, `LimitExplorer`, and `CrossDomainAnalogy` correspond to genuine heuristics used by working physicists. `CombinatorialSynthesis` maps to the "what if we combine technique X with model Y" pattern that produces many publishable papers. The formalization as explicit operators with traces is a real contribution over ad-hoc prompting.

### R4. The Explain-Then-Formalize pipeline addresses a real gap

Forcing LLMs through `RationaleDraft → IdeaCard` with schema validation in between is well-motivated. In practice, LLMs tend to either produce vague "wouldn't it be interesting if..." or jump straight to formalism without checking physical motivation. The two-stage pipeline with kill criteria in the draft stage and testable hypotheses in the card stage mirrors good research practice.

### R5. Cross-domain method transfer is correctly identified as critical

The note about "HEP-first ≠ HEP-only" and the explicit requirement for mapping tables + invariants + kill criteria for cross-domain analogies is important. Many breakthroughs in HEP (AdS/CFT, information-theoretic bounds, ML-based amplitude calculations) came from cross-domain transfer. The architecture correctly preserves this while requiring grounding.

### R6. Team/Role topology may be over-engineered for v0.2

The 8-role physicist community (Ideator, Librarian, Formalizer, Derivation, Coder, Checker, Referee, Editor) is aspirational. In practice, for v0.2, a 3-role pipeline (Ideator → Formalizer → Checker) would exercise the architecture while being implementable. The spec correctly says "v0.2 不要求一次性全实现" but doesn't prioritize which roles to implement first. Add a minimal viable role set.

## Robustness & safety

### S1. Idempotency design is thorough and well-specified

The RFC 8785 JCS canonicalization + `payload_hash` + first-response-replay semantics is production-grade. The explicit handling of "error replay" (failed first call → same error on retry) and the "key conflict" detection (same key + different payload → reject) are both critical and correctly specified. The requirement to store `first_response_json_bytes` for non-deterministic operations (LLM generation) is the right call.

### S2. Budget circuit breaker with degradation order is good defense-in-depth

The `degradation_order` enum provides a structured way to degrade gracefully. The `step_budget` fuse on `search.step` prevents runaway single calls. Combined with `BudgetSnapshot` in every response, this gives the adapter continuous observability.

### S3. Campaign isolation is correctly strict

The "node_not_in_campaign" atomicity requirement (no partial writes if any node is out-of-scope) is essential for multi-campaign safety. The `campaign.init` global dedup with 24h TTL is reasonable for preventing accidental duplicate campaigns.

### S4. Hallucination mitigation has multiple layers but lacks a "confidence calibration" mechanism

The design has: (1) evidence URI resolution, (2) data consistency checks, (3) folklore risk scoring, (4) verification plans for LLM inferences. What's missing is a mechanism to **calibrate** the LLM's own confidence scores. When a claim has `confidence: 0.9` and `support_type: llm_inference`, there's no protocol for validating whether 0.9 is justified. Consider requiring that `confidence` for `llm_inference` claims be cross-checked by the `Checker` role.

### S5. Single-writer assumption is reasonable for v0.x but needs a runtime guard

The spec acknowledges single-writer per campaign. But there's no mechanism to **detect** concurrent writers (e.g., two adapter instances calling `search.step` with different idempotency keys). Add a `writer_id` or `session_id` to side-effecting calls, and have the engine reject if a different writer is active.

### S6. Tick atomicity ("all-or-nothing") is hard to implement correctly

The spec requires each search tick to be atomic. Since a tick may involve multiple LLM calls (team topology), external tool calls (INSPIRE, PDG), and writes, this requires either:
- A write-ahead log with rollback capability, or
- Staging all writes in memory and committing only on tick success

The spec should recommend one of these patterns, or at least acknowledge the implementation complexity and provide a test strategy (e.g., "inject failure after the 2nd LLM call in a tick and verify no partial writes").

## Specific patch suggestions

### P1. `schemas/ranking_result_v1.schema.json` — Add conditional minItems for Elo

```json
// ADD after the existing properties block, before the closing }
"allOf": [
  {
    "if": { "properties": { "method": { "const": "elo" } }, "required": ["method"] },
    "then": { "properties": { "ranked_nodes": { "minItems": 2 } } }
  }
]
```

### P2. `schemas/campaign_status_v1.schema.json` — Add minLength to early_stop_reason

```json
// CHANGE
"early_stop_reason": { "type": "string", ... }
// TO
"early_stop_reason": { "type": "string", "minLength": 1, ... }
```

### P3. Extract duplicated `novelty_delta_entry` sub-schema

**New file**: `schemas/novelty_delta_entry_v1.schema.json`
```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "novelty_delta_entry_v1.schema.json",
  "title": "NoveltyDeltaEntry v1",
  "description": "A single structured novelty delta (closest prior + delta type + falsifiable statement + verification hook).",
  "type": "object",
  "required": ["closest_prior_uris", "delta_types", "delta_statement", "verification_hook"],
  "properties": {
    "closest_prior_uris": { "type": "array", "minItems": 1, "items": { "type": "string", "format": "uri" } },
    "delta_types": {
      "type": "array", "minItems": 1,
      "items": { "enum": ["new_mechanism","new_observable","new_regime","new_method","new_formalism","new_dataset","new_constraint"] }
    },
    "delta_statement": { "type": "string", "minLength": 1 },
    "non_novelty_flags": {
      "type": "array",
      "items": { "enum": ["parameter_tuning_only","relabeling_only","equivalent_reformulation","no_new_prediction","known_components_no_testable_delta"] }
    },
    "verification_hook": { "type": "string", "minLength": 1 }
  },
  "additionalProperties": false
}
```
Then in `idea_scorecards_v1.schema.json`, `idea_node_v1.schema.json` (eval_info.novelty_delta_table): replace inline definitions with `{ "$ref": "./novelty_delta_entry_v1.schema.json" }`.

### P4. Extract duplicated `fix_suggestion` sub-schema

**New file**: `schemas/fix_suggestion_v1.schema.json`
```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "fix_suggestion_v1.schema.json",
  "title": "FixSuggestion v1",
  "type": "object",
  "required": ["failure_mode", "suggested_action", "target_field", "priority"],
  "properties": {
    "failure_mode": { "enum": ["missing_evidence","too_similar","physics_inconsistency","not_computable","folklore_overlap","untestable"] },
    "suggested_action": { "type": "string", "minLength": 1 },
    "target_field": { "type": "string", "minLength": 1 },
    "operator_hint": { "type": "string" },
    "priority": { "enum": ["critical","major","minor"] }
  },
  "additionalProperties": false
}
```

### P5. `schemas/eval_result_v1.schema.json` — Add minItems to updated_node_ids

```json
// CHANGE
"updated_node_ids": { "type": "array", "items": { "type": "string", "format": "uuid" }, ... }
// TO
"updated_node_ids": {
  "type": "array",
  "minItems": 1,
  "maxItems": 100,
  "items": { "type": "string", "format": "uuid" },
  "$comment": "Atomicity invariant: on success, this MUST be set-equal to node_ids. Schema enforces minItems=1 (success implies ≥1 node evaluated)."
}
```

### P6. `schemas/idea_node_v1.schema.json` — Clarify revision semantics

```json
// CHANGE the revision description
"revision": {
  "type": "integer",
  "minimum": 1,
  "description": "Monotonically increasing revision counter. Incremented on each mutation. INFORMATIONAL in v0.x: no RPC method accepts expected_revision for optimistic concurrency (planned for v1.0+). Consumers MAY use it for stale-read detection in polling workflows."
}
```

### P7. `schemas/idea_list_filter_v1.schema.json` — Add `has_eval_info` filter

```json
// ADD to properties
"has_eval_info": {
  "type": "boolean",
  "description": "Filter to nodes with (true) or without (false) eval_info populated."
}
```

### P8. `docs/plans/2026-02-12-idea-generator-architecture-spec.md` §2.3 — Add adapter detection pattern for topup

After the `campaign.topup` description in §2.4, add:

```markdown
**Adapter MUST pattern（topup 结果检测）**：`campaign.topup` 不返回 `budget_exhausted` 错误；adapter **必须**通过检查 `transition.current_status`（而非错误码）来判断 campaign 是否已脱离 `exhausted` 状态。若 `transition.current_status == "exhausted"` 且 `transition.changed == false`，说明本次 topup 不足以解除预算耗尽。
```

### P9. `schemas/search_step_result_v1.schema.json` — Add $comment to conditional blocks

```json
// ADD $comment to each allOf entry
{
  "$comment": "Conditional: updated_nodes_artifact_ref is required only when updated_node_ids is non-empty. Since updated_node_ids is always present (required), the if-clause triggers on minItems:1 (non-empty array).",
  "if": { ... },
  "then": { ... }
}
```

### P10. `docs/plans/2026-02-12-idea-generator-architecture-spec.md` §2.3 — Add n_steps_executed=0 semantics

Add to the `search.step` step semantics section:

```markdown
- **Zero-tick completion（边界情况）**：若 engine 在首个 tick 之前即触发预算熔断（例如 `step_budget` 立即耗尽或全局预算不足以完成一个最小 tick），`search.step` **应当**返回成功响应，`n_steps_executed=0, early_stopped=true, early_stop_reason=step_budget_exhausted|budget_exhausted`（而非返回 RPC 错误），因为调用本身是合法的且 idempotency 记录已提交。但若 campaign `status != running`，则仍返回 `campaign_not_active` 错误。
```

### P11. `schemas/idea_core_rpc_v1.openrpc.json` — Normalize version

```json
// CHANGE
"version": "1.8.10"
// TO
"version": "0.2.0"
```

### P12. `schemas/rank.compute` in OpenRPC — Tighten `dimensions` default semantics

In the `rank.compute` method's `dimensions` param description, change:

```
"(optionally intersected with EvaluatorConfig.dimensions)"
```
to:
```
"(MUST be intersected with the set of dimensions for which all resolved nodes have scores; dimensions with missing scores for any node MUST be excluded from the effective set)"
```

This removes the "optionally" ambiguity and ensures deterministic behavior across implementations.
