VERDICT: NOT_READY

## Blockers

### B1. `campaign.resume` from `exhausted` contradicts spec vs. OpenRPC

The architecture spec §2.4 states:
> `campaign.resume`: `exhausted → exhausted`（固定拒绝：`budget_exhausted`）

But the OpenRPC `campaign.resume` description says:
> "If status is exhausted, the engine MUST reject with budget_exhausted (-32001) without changing state"

These are consistent in *intent*, but the spec's transition table also lists:
> `campaign.pause`: `running|early_stopped|exhausted → paused`

This creates an ambiguity: if a campaign is `exhausted → paused` (via `campaign.pause`), then `campaign.resume` from `paused` must check budget. The spec says:
> `campaign.resume` 从 `paused|early_stopped` 恢复时，必须检查**当前**预算是否已耗尽

But the OpenRPC description **only** mentions the `exhausted` state rejection explicitly; it does not codify the "check budget on resume from paused" rule in the error list. The `budget_exhausted` error is listed, but the description focuses on the `exhausted` state check.

**Fix required**: The OpenRPC `campaign.resume` description must explicitly state: "When resuming from `paused` or `early_stopped`, the engine MUST verify that no BudgetEnvelope dimension has `remaining <= 0`; if any does, MUST reject with `budget_exhausted` without state change." This is currently implied but not machine-enforceable from the OpenRPC doc alone.

### B2. `search.step` mutation observability: `updated_node_ids` artifact ref conditional is not tight enough

The `search_step_result_v1.schema.json` uses `allOf` with conditional:
```json
{
  "if": { "properties": { "updated_node_ids": { "type": "array", "minItems": 1 } }, "required": ["updated_node_ids"] },
  "then": { "required": ["updated_nodes_artifact_ref"] }
}
```

**Problem**: `updated_node_ids` is already `required` at the top level, so the `"required": ["updated_node_ids"]` in the `if` clause is always satisfied. The `if` condition then only tests whether the value has `minItems: 1`. However, JSON Schema `if` semantics mean if `updated_node_ids` is `[]` (empty array), the `if` fails (good), and `then` doesn't apply (good). So the logic is actually correct. But the same pattern for `new_node_ids` has a subtle issue: `new_node_ids` is required and could be `[]`, and `new_nodes_artifact_ref` is **not** in the `required` top-level list. This means when `new_node_ids = []`, `new_nodes_artifact_ref` may be absent (correct). When `new_node_ids` has items, `new_nodes_artifact_ref` is required (correct).

**Actual blocker**: Neither `new_nodes_artifact_ref` nor `updated_nodes_artifact_ref` has a type constraint at the top level — they only have `"type": "string", "format": "uri"` which is fine. But `updated_nodes_artifact_ref` description says "bounded diff/changelog" — this is unspecified. There's no schema for what that artifact *contains*. Without a schema for the mutation changelog, consumers cannot machine-parse what changed on each node. This is a blocker for **mutation observability** (one of your review foci).

**Fix required**: Define a minimal `node_mutation_log_v1.schema.json` that the `updated_nodes_artifact_ref` points to, containing at minimum: `[{node_id, mutated_fields: string[], timestamp, step_id}]`.

### B3. `eval.run` does not expose `updated_node_ids` semantics vs. `node_ids` input

`eval_result_v1.schema.json` has both `node_ids` (input echo) and `updated_node_ids`. But what if evaluation fails for some nodes but succeeds for others? The spec says atomicity is MUST (all-or-nothing), but the schema doesn't enforce `updated_node_ids == node_ids` on success. If atomicity is truly all-or-nothing, then on success `updated_node_ids` MUST equal `node_ids`. The schema should either:
- Add `"description"` clarifying this invariant, OR
- Add a machine-check (though JSON Schema can't express cross-array equality)

**Fix required**: Add to `eval_result_v1.schema.json` description: "On success, `updated_node_ids` MUST be a set-equal copy of `node_ids` (atomicity invariant: all nodes are updated or none are)."

### B4. No `budget_snapshot` in `promotion_result_v1.schema.json`

Every other side-effecting result (`campaign_init_result`, `campaign_mutation_result`, `search_step_result`, `eval_result`, `ranking_result`) includes `budget_snapshot`. But `promotion_result_v1.schema.json` does not. Since `node.promote` is side-effecting and may consume tokens (grounding audit, formalism check), this breaks the budget observability contract.

**Fix required**: Add `"budget_snapshot": { "$ref": "./budget_snapshot_v1.schema.json" }` to `promotion_result_v1.schema.json` required fields.

### B5. `campaign.topup` transition from `exhausted` → `running` is under-specified for `early_stopped`

The spec says `campaign.topup` on `early_stopped` yields `(same state)`. But consider: a campaign is `early_stopped` (policy halt) AND simultaneously budget-exhausted (multiple dimensions at 0). After topup, budget is replenished but the policy halt flag persists. When the caller then calls `campaign.resume`, does the engine check budget? Yes, per spec. But the `early_stopped` → `running` path doesn't require re-checking whether the policy halt condition still holds. This is logically correct (resume overrides early_stop), but **the `campaign_mutation_result_v1`'s `transition.exhausted_dimensions_after` doesn't distinguish "policy-halted" from "budget-halted"**.

**Fix required**: Add `"early_stop_reason"` (optional string) to `campaign_status_v1.schema.json` to disambiguate why a campaign is in `early_stopped` state. Without this, adapters cannot programmatically decide whether to topup or resume.

---

## Non-blocking

### N1. `idea_tournament_v1.schema.json` allows draws but schema doesn't model them

`matches[].winner_node_id` is required, but Elo systems commonly allow draws. Consider making `winner_node_id` nullable or adding `"outcome": {"enum": ["a_wins", "b_wins", "draw"]}`. Low priority for v0.2 but will need addressing.

### N2. `evaluator_config_v1.schema.json` `weights` keys are not constrained to match `dimensions`

`weights` is `additionalProperties: { "type": "number" }` with no enforcement that keys ⊆ `dimensions`. A caller could provide `weights: {"bogus": 1.0}` and pass validation. Consider adding a note that engine MUST validate `keys(weights) ⊆ dimensions` at runtime, or documenting this as a runtime invariant.

### N3. `budget_snapshot_v1.schema.json`: `wall_clock_s_remaining` can drift on idempotency replay

The spec correctly notes that replay snapshots are "first-call snapshots" and may be stale. However, `wall_clock_s_remaining` is particularly misleading on replay since wall clock always advances. Consider adding `snapshot_at: date-time` to `budget_snapshot_v1.schema.json` so consumers can detect staleness.

### N4. `idea_list_filter_v1.schema.json` has no `min_score` / `has_eval_info` filter

For `rank.compute`'s pre-filter use case (finding evaluated nodes), there's no way to filter by "has been evaluated" or "has idea_card with grounding_audit.status=pass". Consider adding `has_eval_info: boolean` and `min_score: {dimension: string, value: number}` to the filter.

### N5. Seed `seed_id` is optional in `seed_pack_v1.schema.json`

If `seed_id` is omitted, the engine must auto-generate one, but this isn't specified. Consider making it required or documenting auto-generation behavior.

### N6. `campaign_charter_v1.schema.json` has `search_policy_id` and `team_policy_id` as optional

The spec repeatedly references these as critical (§3.2, §3.4), but the schema makes them optional. If the engine has defaults, document them. If they're required for meaningful operation, make them `required`.

### N7. No `campaign.delete` / `campaign.archive` RPC

The spec mentions "未来新增 `campaign.delete/archive`" but the idempotency retention rules depend on it ("至少保留到 campaign 结束"). For v0.x, document what "campaign ends" means for idempotency GC — is it `completed` status?

### N8. `idea_node_v1.schema.json` `eval_info.scores` is optional within the eval_info object

When `eval_info` is non-null, `scores` is not required. This means a node can have `eval_info` with `fix_suggestions` and `failure_modes` but no scores. This is valid (e.g., if evaluation errored on scoring but produced diagnostics), but `rank.compute` would need to handle nodes with eval_info but no scores. Document this edge case.

### N9. `idea_card_v1.schema.json` `claims[].evidence_uris` for `llm_inference`/`assumption`

The conditional schema requires `verification_plan` for these types but does NOT require `evidence_uris` to be non-empty. This is intentional (pure inference may have no references), but the grounding audit gate §4.2.1 says "推断透明：support_type=llm_inference/assumption 必须有 verification_plan". The schema enforces this. Good. But consider whether `evidence_uris: []` with `support_type=literature` should fail schema validation (currently it would, since the `allOf` conditional requires `minItems: 1` for literature/data/calculation/expert_consensus). Verified: this is correctly handled.

### N10. `formalism_registry_v1.schema.json` `formalism_id` pattern doesn't match `idea_card_v1` pattern

Both use `^[a-z0-9_-]+\\/[a-z0-9_.-]+$` — these are identical. Good, no issue.

---

## Real-research fit

### R1. Evidence-first pipeline is well-designed for HEP

The four-gate grounding audit (URI resolution, data consistency, inference transparency, folklore pre-screen) maps well to real HEP research workflows. The requirement that `support_type=data` claims cross-check against PDG/HEPData is exactly right — this catches the most common form of hallucination in physics LLM outputs (fabricated or outdated numerical values).

### R2. Operator families map to genuine discovery patterns

`AnomalyAbduction`, `SymmetryOperator`, `LimitExplorer`, and `CrossDomainAnalogy` correspond to well-documented patterns in HEP history (e.g., anomaly-driven BSM model building, large-N/strong-coupling limits, condensed matter ↔ particle physics dualities). The `ProtectiveBeltPatch` operator is a creative choice that formalizes how most "incremental but publishable" HEP-ph work actually happens.

### R3. Novelty delta table addresses a real failure mode

The `novelty_delta_table` with `non_novelty_flags` like `parameter_tuning_only` and `equivalent_reformulation` is **exactly** what's needed. In practice, LLM-generated "novel" ideas are overwhelmingly either parameter variations of known models or notational rephrasings. The explicit enumeration of non-novelty types is a strong design choice.

### R4. Formalism registry enables real C2 handoff

Requiring `candidate_formalisms` to be drawn from a registry (with compiler/validator references) prevents the common failure mode of "great idea, but nobody can compute anything from it." This is a genuine bottleneck in AI-assisted theoretical physics.

### R5. Team/Role topology is appropriately cautious

The clean-room default between roles, with explicit structured debate triggers, avoids the "echo chamber" problem where multiple LLM agents reinforce each other's errors. The `Checker` as independent clean-room re-derivation is critical for physics correctness.

### R6. Missing: literature recency check

The grounding audit checks URI resolvability and data consistency, but doesn't enforce checking whether the claim is **already superseded** by more recent work. In HEP, a common failure mode is citing a 2015 result that was updated/corrected in 2023. Consider adding a `recency_check` step to the grounding audit (at least a warning if the most recent citation is older than some threshold).

### R7. Missing: experimental feasibility cross-check

`IdeaCard.required_observables` lists what needs to be measured, but there's no schema-level support for linking to actual experimental capabilities (e.g., "this requires HL-LHC luminosity" or "this observable is not accessible at current facilities"). This is informational for v0.2 but should be planned for v0.3.

---

## Robustness & safety

### S1. Idempotency design is thorough and well-specified

The RFC 8785 JCS canonicalization requirement for payload hashing, the explicit `idempotency_key_conflict` error, the "store first response + replay" model for non-deterministic LLM calls, and the co-transactional commit of idempotency records with side effects — all of these are production-grade specifications. The edge cases (error replay, partial completion replay for `search.step`) are correctly addressed.

### S2. Hallucination mitigation is multi-layered

Three independent checks: (1) active URI resolution (not just format validation), (2) PDG/HEPData numerical cross-check, (3) folklore risk scoring with human escalation. This is a strong defense-in-depth approach.

### S3. Budget circuit breaker prevents runaway costs

The `degradation_order` is a good design. The step-budget fuse for `search.step` prevents a single call from consuming the entire budget. The `team_cost_multiplier` consideration in extensions is forward-thinking.

### S4. Single-writer assumption needs prominent documentation

The v0.x single-writer assumption (§2.3.1) is reasonable but could cause subtle data corruption if violated. Consider: the idempotency store itself could be corrupted by concurrent writers using different keys. The spec should recommend that the adapter layer enforces mutual exclusion (e.g., a campaign-level lock file or advisory lock).

### S5. `search.step` tick atomicity vs. LLM failure

A single tick may involve multiple LLM calls (Team topology). If the second LLM call in a tick fails after the first succeeds, the spec requires rollback of the entire tick. This is correct but implementation-challenging. The spec should note that implementations SHOULD use write-ahead logging or staging areas for in-progress ticks, committing only on tick completion.

### S6. Error code reuse across semantically different failures

Error code `-32002` (`schema_validation_failed`) is reused for: actual schema errors, idempotency key conflicts, missing elo_config, and unexpected elo_config. While the `error.data.reason` field disambiguates, monitoring/alerting systems that only look at error codes will conflate these. Consider whether `idempotency_key_conflict` deserves its own top-level code (e.g., `-32016`). Non-blocking but worth tracking.

### S7. No rate limiting or back-pressure specification

If the adapter repeatedly calls `search.step` with `n_steps=1` in a tight loop (e.g., after each step, check results, decide whether to continue), there's no specified back-pressure mechanism. The budget envelope provides eventual termination, but not protection against burst costs. Consider a `min_step_interval_s` in `BudgetEnvelope.extensions`.

---

## Specific patch suggestions

### P1. `schemas/promotion_result_v1.schema.json` — Add `budget_snapshot`

```diff
  "required": [
    "campaign_id",
    "node_id",
    "idea_id",
    "handoff_artifact_ref",
    "formalism_check",
    "grounding_audit_summary",
-   "idempotency"
+   "idempotency",
+   "budget_snapshot"
  ],
  "properties": {
    ...
+   "budget_snapshot": { "$ref": "./budget_snapshot_v1.schema.json" },
    "idempotency": { "$ref": "./idempotency_meta_v1.schema.json" }
```

### P2. `schemas/campaign_status_v1.schema.json` — Add `early_stop_reason`

```diff
  "properties": {
    ...
    "status": { "enum": ["running", "paused", "early_stopped", "exhausted", "completed"] },
+   "early_stop_reason": {
+     "type": "string",
+     "description": "Machine-readable reason when status=early_stopped (e.g., 'stagnation', 'diversity_collapse'). Null/absent when status is not early_stopped."
+   },
    "created_at": { "type": "string", "format": "date-time" },
```

### P3. `schemas/budget_snapshot_v1.schema.json` — Add `snapshot_at`

```diff
  "required": [
    "tokens_used",
    "tokens_remaining",
    ...
    "nodes_used",
-   "nodes_remaining"
+   "nodes_remaining",
+   "snapshot_at"
  ],
  "properties": {
    ...
+   "snapshot_at": {
+     "type": "string",
+     "format": "date-time",
+     "description": "Timestamp when this snapshot was captured. Critical for detecting staleness on idempotency replay."
+   },
    "tokens_used": { "type": "integer", "minimum": 0 },
```

### P4. `schemas/eval_result_v1.schema.json` — Document atomicity invariant

```diff
    "updated_node_ids": {
      "type": "array",
      "items": { "type": "string", "format": "uuid" },
-     "description": "IDs of nodes that were mutated (e.g., eval_info appended) during this operation."
+     "description": "IDs of nodes that were mutated (e.g., eval_info appended) during this operation. Atomicity invariant: on success, this MUST be set-equal to node_ids (all-or-nothing)."
    },
```

### P5. New file: `schemas/node_mutation_log_v1.schema.json`

Create this file to give `updated_nodes_artifact_ref` a concrete contract:

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "node_mutation_log_v1.schema.json",
  "title": "NodeMutationLog v1",
  "description": "Bounded changelog for nodes mutated during a search step or eval run. Referenced by updated_nodes_artifact_ref.",
  "type": "object",
  "required": ["campaign_id", "step_id", "mutations", "generated_at"],
  "properties": {
    "campaign_id": { "type": "string", "format": "uuid" },
    "step_id": { "type": "string", "format": "uuid" },
    "generated_at": { "type": "string", "format": "date-time" },
    "mutations": {
      "type": "array",
      "minItems": 1,
      "items": {
        "type": "object",
        "required": ["node_id", "mutated_fields", "mutation_type", "timestamp"],
        "properties": {
          "node_id": { "type": "string", "format": "uuid" },
          "mutated_fields": {
            "type": "array",
            "minItems": 1,
            "items": { "enum": ["idea_card", "eval_info", "grounding_audit", "updated_at"] }
          },
          "mutation_type": { "enum": ["append", "replace", "initialize"] },
          "timestamp": { "type": "string", "format": "date-time" },
          "role": { "type": "string", "minLength": 1, "description": "Role that triggered this mutation." }
        },
        "additionalProperties": false
      }
    }
  },
  "additionalProperties": false
}
```

### P6. `schemas/idea_core_rpc_v1.openrpc.json` — Tighten `campaign.resume` description

In the `campaign.resume` method description, after the existing text, add:

```diff
-     "description": "Side-effecting. Accepted when campaign status is paused|early_stopped. Transitions paused|early_stopped → running. If status is exhausted, the engine MUST reject with budget_exhausted (-32001) without changing state (caller should campaign.topup first). If the campaign budget is exhausted (i.e., any BudgetEnvelope dimension has remaining <= 0), the engine MUST reject with budget_exhausted (-32001) without changing state. If campaign is completed, returns campaign_not_active (-32015).",
+     "description": "Side-effecting. Accepted when campaign status is paused|early_stopped. Transitions paused|early_stopped → running, subject to budget check. If status is exhausted, the engine MUST reject with budget_exhausted (-32001) without changing state (caller should campaign.topup first). Budget pre-check (MUST): when resuming from paused or early_stopped, the engine MUST verify that ALL BudgetEnvelope dimensions have remaining > 0; if any dimension has remaining <= 0, the engine MUST reject with budget_exhausted (-32001) without changing state. This prevents resuming into an immediately-exhausted campaign. If campaign is completed, returns campaign_not_active (-32015).",
```

### P7. `schemas/search_step_result_v1.schema.json` — Reference mutation log schema

```diff
    "updated_nodes_artifact_ref": {
      "type": "string",
      "format": "uri",
-     "description": "Artifact ref for a bounded diff/changelog of mutations applied to updated_node_ids (e.g., idea_card added, eval_info updated)."
+     "description": "Artifact ref for a bounded diff/changelog of mutations applied to updated_node_ids (e.g., idea_card added, eval_info updated). The referenced artifact MUST conform to node_mutation_log_v1.schema.json."
    },
```

### P8. `docs/plans/2026-02-12-idea-generator-architecture-spec.md` §2.4 — Add early_stop_reason to status machine

After the `early_stopped` bullet, add:

```diff
  - `early_stopped`：search policy 判定"应当停止"（例如 stagnation）；允许 `campaign.resume` 显式继续（否则视为非活动）。
+   - `CampaignStatusV1` 在 `early_stopped` 状态下**必须**携带 `early_stop_reason`（string），供 adapter 判断是否需要人工干预（例如 `stagnation` vs `diversity_collapse` vs `user_requested`）。
```

### P9. `schemas/idea_list_filter_v1.schema.json` — Add `has_eval_info` filter

```diff
  "properties": {
    ...
    "grounding_status": { "enum": ["pass", "fail", "partial"] },
+   "has_eval_info": {
+     "type": "boolean",
+     "description": "If true, return only nodes with non-null eval_info. If false, return only nodes with null eval_info."
+   },
+   "has_idea_card_grounding_pass": {
+     "type": "boolean",
+     "description": "Convenience composite filter: has_idea_card=true AND grounding_status=pass. Useful for pre-filtering rank.compute candidates."
+   }
  },
```

### P10. `schemas/seed_pack_v1.schema.json` — Make `seed_id` required

```diff
  "items": {
    "type": "object",
-   "required": ["seed_type", "content"],
+   "required": ["seed_id", "seed_type", "content"],
    "properties": {
      "seed_id": { "type": "string", "format": "uuid" },
```

This avoids ambiguity about auto-generation and ensures seed lineage is always traceable.
