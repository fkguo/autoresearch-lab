VERDICT: NOT_READY

## Blockers

### B1. `rank.compute` Pareto minimum-dimensions constraint is specified in OpenRPC prose but has no schema enforcement or error code distinction

The spec says Pareto requires ≥2 score dimensions in the effective scorecards, returning `insufficient_eval_data` with `reason=insufficient_dimensions`. However:
- `rpc_error_data_v1.schema.json` does not list `insufficient_dimensions` among known reasons for `-32013`.
- The `x-error-data-contract.known_reasons` in the OpenRPC doc only enumerates reasons for `-32002`, not for `-32013`. This makes the `insufficient_dimensions` sub-reason unenforceable by tooling.

**Fix**: Add `"-32013": ["insufficient_nodes", "insufficient_dimensions", "no_scorecards"]` to `x-error-data-contract.known_reasons` in the OpenRPC file.

### B2. `campaign.topup` state-machine spec vs. OpenRPC error list inconsistency for `exhausted → exhausted`

The architecture spec §2.4 says: "campaign.topup MUST NOT return budget_exhausted; insufficient topups are represented by a successful result whose campaign_status remains exhausted." The OpenRPC `campaign.topup` description agrees. But the OpenRPC `campaign.topup` error list **does not include** `-32001 budget_exhausted`, which is correct — however, the spec §2.4 says `campaign.resume` from `exhausted` returns `budget_exhausted`, yet there is **no documented path** for a caller to know whether a topup was "sufficient" without calling `campaign.status` afterward, because the `campaign_mutation_result` returns the **first-call snapshot** on replay. This creates an observability gap:

- After `topup` (idempotent replay), `transition.current_status` may show `exhausted` or `running`, but this is the **first-call snapshot**. There's no way to distinguish "topup was insufficient" from "topup succeeded but I'm seeing a stale replay" without a separate `campaign.status` call.

This is not a schema bug per se, but the spec needs an explicit **normative note** in `campaign.topup` that callers MUST call `campaign.status` after a topup replay to get current state. The current informational note is buried in the description but should be elevated to a normative requirement in the spec §2.4.

### B3. `idea_card_v1.schema.json` claim conditional — `evidence_uris` minimum for `literature|data|calculation|expert_consensus` is not enforced at the `allOf` level

The `allOf` block uses:
```json
"then": { "properties": { "evidence_uris": { "minItems": 1 } } }
```

This only **constrains** the property if it's present — it does not make it `required`. Since `evidence_uris` is already in `required` (at the claim item level), this works. BUT: if `evidence_uris` is an empty array `[]`, the claim passes the `required` check (it exists) but fails the `minItems: 1` in the `then` clause. This is actually correct behavior. ~~However~~, the subtlety is that JSON Schema `if/then` does not short-circuit: the `then` merges into the base schema. If the base already has `"evidence_uris": { "type": "array", "items": ... }` without `minItems`, and the `then` adds `minItems: 1`, the merge semantics in Draft 2020-12 apply the `then` constraints **only when `if` matches**. This is correct. **Not a blocker after close inspection.** Retracted.

### B3 (actual). `search.step` atomicity vs. `n_steps_executed` partial completion creates an ambiguous idempotency contract

The spec says:
- "each tick MUST be all-or-nothing"
- "the overall call may partially execute multiple ticks and report progress via `n_steps_executed`"
- "retries with the same idempotency_key MUST replay the same partial result"

This means if `search.step(n_steps=5)` completes 3 ticks then hits budget exhaustion, the idempotency record stores the partial result (`n_steps_executed=3`). A retry replays this. But: **what is the campaign status after the first call?** If budget was exhausted, the campaign transitions to `exhausted` as a side-effect. The idempotency replay returns the first-call response (which includes `budget_snapshot` from that moment). But the caller now has a stale `budget_snapshot` and cannot tell whether the campaign has been topped up since.

**This is documented** ("replay中的budget_snapshot是首次执行时的快照"), but the **blocker** is: the spec does not define whether the **campaign status transition** (`running → exhausted`) is part of the idempotency-protected side-effect. If the engine crashes after writing nodes but before transitioning to `exhausted`, on retry it replays the stored response (showing `early_stopped=true`) but the campaign might still be `running` with inconsistent budget state.

**Fix**: The spec must state that the campaign status transition (if any) is part of the same "logical commit" as the tick writes and the idempotency record. §2.3 point 2's consistency requirement covers "副作用" generically, but `search.step`'s implicit campaign status transitions need to be explicitly listed as covered side-effects.

### B4. `eval.run` atomicity claim vs. lack of `updated_node_ids` consistency check in schema

The `eval_result_v1.schema.json` description says: "Atomicity invariant: on success, updated_node_ids MUST be set-equal to node_ids (all nodes are updated or none are)." However, this invariant is **not enforceable via JSON Schema** (you cannot express set-equality between two arrays). This is fine as a prose invariant, but there is **no mechanism** specified for the engine to validate this at the RPC boundary.

**Fix**: Either (a) remove `updated_node_ids` from `eval_result` and state that success implies all nodes were updated (simplifying the contract), or (b) keep it but add a normative note that adapters/test harnesses MUST assert `set(updated_node_ids) == set(node_ids)` post-hoc. Option (a) is cleaner; `updated_node_ids` is redundant given the atomicity invariant.

### B5. Missing `grounding_status` filter interaction with `rank.compute`

`rank.compute` uses `idea_list_filter_v1.schema.json` for the `filter` parameter. This filter includes `grounding_status`, but the spec doesn't say whether `rank.compute` should **default** to filtering only `grounding_status=pass` nodes. Without this, a caller could accidentally rank ungrounded nodes, which contradicts the evidence-first principle. This is a safety gap.

**Fix**: Add a normative note in `rank.compute` description: "If `filter.grounding_status` is not explicitly set, the engine SHOULD default to `pass` to prevent ranking ungrounded nodes. Implementations that rank ungrounded nodes MUST document this behavior."

## Non-blocking

### N1. `BudgetSnapshot` fields `steps_remaining` and `nodes_remaining` use `oneOf: [integer, null]` but `tokens_remaining` / `cost_usd_remaining` / `wall_clock_s_remaining` are required integers/numbers

This asymmetry is intentional (`max_steps` and `max_nodes` are optional in `BudgetEnvelope`, so remaining is nullable). However, `wall_clock_s_remaining` is always required despite `max_wall_clock_s` being required in `BudgetEnvelope` — this is consistent. **But** `max_cost_usd` has `"minimum": 0` which allows `0`, meaning a campaign could be initialized with `max_cost_usd=0` and immediately exhaust. Consider adding `exclusiveMinimum: 0` to `max_tokens`, `max_cost_usd`, `max_wall_clock_s` in `budget_envelope_v1.schema.json` to prevent degenerate campaigns.

### N2. `idea_node_v1.schema.json` — `eval_info.scores` is optional, but `rank.compute` presumably needs scores

If `eval.run` succeeds but doesn't populate `eval_info.scores` (it's not required within the `eval_info` object), then `rank.compute(method=pareto)` would have no dimensions to rank on. The `scores` field should be `required` within the non-null `eval_info` variant, or the `insufficient_eval_data` error must explicitly cover "nodes have eval_info but no scores."

### N3. `node_mutation_log_v1.schema.json` — `mutations[].mutated_fields` uses free-text strings

There's no enum constraint on `mutated_fields` values. This means different implementations could use `"idea_card"` vs `"ideaCard"` vs `"idea_card_v1"`. Consider adding an enum or at least a recommended set: `["idea_card", "eval_info", "grounding_audit", "updated_at", "revision"]`.

### N4. `idea_selection_v1.schema.json` — `anyOf` constraint allows `selected_node_ids: []` + `rejected_node_ids: [x]`

The `anyOf` requires at least one of the three arrays to have `minItems: 1`. This means you can have `selected_node_ids: []` (empty selection) as long as there are rejections. This seems intentional but worth verifying — a selection artifact with zero selected nodes is valid?

### N5. `campaign_charter_v1.schema.json` — `search_policy_id` and `team_policy_id` are optional

Given that the spec heavily depends on SearchPolicy and TeamPolicy, these should probably be required (with a default like `"default"` if the engine provides built-in policies). Currently a charter could omit both, leaving the engine with no policy guidance.

### N6. OpenRPC version string `1.8.10` seems high for a v1 spec

Minor, but version `1.8.10` suggests many prior iterations. Consider whether the version should track the schema bundle version or the iteration count. Semantic versioning would be clearer: `1.0.0-rc.1` or similar.

### N7. `campaign.complete` allows transition from `exhausted → completed` but doesn't mention whether unfinished work is archived

The spec says all states can transition to `completed`. For `exhausted` campaigns, this is fine, but the spec doesn't say whether the engine should write any "campaign summary" artifact on completion. Consider adding an optional `completion_summary_artifact_ref` to `campaign_mutation_result`.

### N8. `idea_tournament_v1.schema.json` — `draw_allowed` defaults to `false` but `winner_node_id` allows `null` (draw)

If `draw_allowed=false`, the schema still permits `winner_node_id: null`. This should either be enforced via a conditional (`if draw_allowed=false then winner_node_id must not be null`) or documented as a post-validation invariant.

### N9. `rationale_draft_v1.schema.json` — `kill_criteria` requires `minItems: 1` but the spec §4.2 says "1–3 kill criteria"

The schema enforces ≥1 but not ≤3. This is intentional (the spec says "1–3" as a recommendation, not a hard limit), but consider adding `maxItems: 5` as a soft guardrail.

### N10. `budget_topup_v1.schema.json` — `add_tokens` has `minimum: 1` but `add_cost_usd` has `exclusiveMinimum: 0`

Inconsistent minimums: `add_tokens` allows exactly 1, but `add_cost_usd` requires strictly > 0 (not exactly 0). Both are correct semantically but the asymmetry between `minimum: 1` (integer) and `exclusiveMinimum: 0` (float) is confusing. Consider using `minimum: 1` for integers and `exclusiveMinimum: 0` for floats consistently, and document this convention.

## Real-research fit

### R1. Evidence-first integrity: Strong

The grounding audit gate (§4.2.1) is well-designed for HEP. Active URI resolution against INSPIRE/DOI, data consistency against PDG/HEPData, and folklore pre-filtering are all appropriate. The claim-level provenance in `idea_card_v1` with `support_type` enumeration and conditional `verification_plan` requirements is excellent.

**Gap**: The spec doesn't address **temporal validity** of evidence. In HEP, PDG values update annually. A grounding audit that passes in February may fail in July. Consider adding `evidence_valid_as_of: date` to the grounding audit or claims.

### R2. Operator families map well to HEP discovery patterns

`AnomalyAbduction` (e.g., muon g-2 anomaly → BSM explanation), `SymmetryOperator` (e.g., exploring flavor symmetry breaking), `LimitExplorer` (e.g., heavy quark limit, large-Nc), and `CrossDomainAnalogy` (e.g., AdS/CFT-inspired condensed matter techniques applied back to QCD) are all well-motivated.

**Gap**: Missing an operator for **experimental constraint propagation**: given new LHC limits on a BSM particle, systematically propagate constraints to related models. This is a core HEP workflow (`ConstraintPropagation` operator).

### R3. Multi-island search is appropriate for theoretical physics

Different "schools of thought" (perturbative QCD vs. lattice vs. effective field theory vs. holography) naturally map to islands with different operator weights and formalism registries. The repopulation mechanism (migrating ideas between islands) mirrors how real-world cross-pollination works in HEP conferences.

### R4. C2 handoff is well-specified for downstream executability

The `idea_handoff_c2_v1.schema.json` with required `idea_card`, `grounding_audit`, and `formalism_check` all at `status: "pass"` ensures no half-baked ideas enter the method design phase. The `minimal_compute_plan` with `estimated_difficulty`, `required_infrastructure`, and `blockers` gives C2 enough information to estimate resource requirements.

### R5. Novelty assessment needs calibration data

The `novelty_delta_table` structure is excellent (especially `non_novelty_flags`), but the spec doesn't address how the novelty pipeline is **calibrated**. In HEP, "novel" is highly context-dependent (a known idea in hep-th might be novel when applied to hep-ph). Consider requiring `domain_context` in the novelty report entries.

## Robustness & safety

### S1. Idempotency design is thorough but has a crash-recovery gap

The spec requires "idempotency record and side-effects in the same logical commit" (§2.3 point 2). For JSONL-based storage (v0.x), this means either:
- (a) Write to a single file atomically (rename-based), or
- (b) Use a WAL/journal pattern.

The spec should recommend (a) for v0.x simplicity and note that (b) is needed for production.

### S2. Hallucination mitigation is well-layered

Three layers protect against hallucinated physics:
1. `support_type` classification with conditional `verification_plan`
2. Active URI resolution in grounding audit
3. Folklore risk scoring with human escalation

**Gap**: No mechanism for detecting **fabricated calculations** (e.g., LLM invents a cross-section value). The `Derivation` role does consistency checks, but the spec should require that any numerical claim with `support_type=calculation` must include a `reproducibility_recipe` (minimal script/formula that can be independently verified).

### S3. Budget circuit breaker is well-designed but lacks observability for team-cost amplification

§3.4.3 notes that team topology multiplies per-step cost. But `BudgetSnapshot` doesn't expose `team_cost_multiplier` or per-step cost estimates. An adapter observing `tokens_remaining` dropping faster than expected has no way to diagnose whether it's team overhead or expensive operators. Consider adding `estimated_tokens_per_step` to `BudgetSnapshot` or `SearchStepResult`.

### S4. Campaign isolation is strong but node deduplication across campaigns is unspecified

The spec requires strict campaign scoping, but what if two campaigns independently discover the same idea? There's no cross-campaign deduplication or awareness. This is fine for v0.x (single-writer) but should be flagged as a v1.0 concern.

### S5. The `revision` field enables future optimistic concurrency but has no current consumer

The `revision` field on `IdeaNode` is described as "enables stale-read detection and future optimistic concurrency" but no RPC method accepts or checks it. For v0.x single-writer this is fine, but consider adding `expected_revision` to `eval.run` and `node.promote` as optional params now (ignored in v0.x, enforced in v1.0) to avoid a breaking schema change later.

## Specific patch suggestions

### P1. `schemas/idea_core_rpc_v1.openrpc.json` — Add known reasons for `-32013`

```json
// In x-error-data-contract.known_reasons, add:
"-32013": ["insufficient_nodes", "insufficient_dimensions", "no_scorecards"]
```

### P2. `schemas/idea_core_rpc_v1.openrpc.json` — `rank.compute` description: add default grounding filter note

In the `rank.compute` method `description`, append:
```
If filter.grounding_status is not explicitly set, the engine SHOULD default to 'pass' to prevent ranking ungrounded nodes. Implementations that permit ranking ungrounded nodes MUST document this deviation.
```

### P3. `schemas/idea_core_rpc_v1.openrpc.json` — `search.step` description: explicitly list campaign status transitions as covered side-effects

In the `search.step` method `description`, append:
```
Campaign status transitions triggered during this call (e.g., running → exhausted due to budget depletion, running → early_stopped due to policy halt) are part of the idempotency-protected side-effects: they MUST be committed atomically with tick writes and the idempotency record.
```

### P4. `schemas/eval_result_v1.schema.json` — Make atomicity invariant testable

Either:
**Option A (preferred)**: Remove `updated_node_ids` and add a description note:
```json
// Remove updated_node_ids from required and properties
// Add to description: "On success, all node_ids are guaranteed to have been updated (atomicity invariant). No separate updated_node_ids is needed."
```

**Option B**: Keep `updated_node_ids` but add normative note:
```json
"updated_node_ids": {
  // existing definition...
  "description": "... On success, MUST be set-equal to node_ids. Adapters and test harnesses MUST assert len(set(updated_node_ids) ^ set(node_ids)) == 0."
}
```

I recommend Option B to maintain observability consistency with `search_step_result_v1` which also has `updated_node_ids`.

### P5. `schemas/idea_node_v1.schema.json` — Make `eval_info.scores` required when `eval_info` is non-null

```json
// In the non-null variant of eval_info, change:
"required": ["fix_suggestions", "failure_modes"]
// to:
"required": ["scores", "fix_suggestions", "failure_modes"]
```

This ensures `rank.compute` always has dimensions to work with after eval.

### P6. `schemas/budget_envelope_v1.schema.json` — Prevent degenerate zero-budget campaigns

```json
// Change:
"max_tokens": { "type": "integer", "minimum": 1 },
"max_cost_usd": { "type": "number", "minimum": 0 },
"max_wall_clock_s": { "type": "number", "minimum": 0 },
// To:
"max_tokens": { "type": "integer", "minimum": 1 },
"max_cost_usd": { "type": "number", "exclusiveMinimum": 0 },
"max_wall_clock_s": { "type": "number", "exclusiveMinimum": 0 },
```

### P7. `schemas/node_mutation_log_v1.schema.json` — Constrain `mutated_fields` values

```json
"mutated_fields": {
  "type": "array",
  "minItems": 1,
  "items": {
    "type": "string",
    "enum": ["idea_card", "eval_info", "grounding_audit", "updated_at", "revision"]
  },
  "description": "Field paths that changed. Limited to mutable fields per IdeaNode mutability contract."
}
```

### P8. `schemas/campaign_charter_v1.schema.json` — Make policy IDs required with defaults

```json
"search_policy_id": {
  "type": "string",
  "minLength": 1,
  "default": "multi_island_diverge_converge",
  "description": "Required. Use 'multi_island_diverge_converge' for the default v0.2 policy."
},
"team_policy_id": {
  "type": "string",
  "minLength": 1,
  "default": "sequential_convergence",
  "description": "Required. Use 'sequential_convergence' for the default v0.2 team topology."
}
```
And add both to `"required": ["domain", "scope", "approval_gate_ref", "search_policy_id", "team_policy_id"]`.

### P9. `docs/plans/2026-02-12-idea-generator-architecture-spec.md` — §2.4: Add normative note about topup observability

After the `campaign.topup` transition rules, add:

```markdown
**Normative**: After a `campaign.topup` call that returns `idempotency.is_replay=true`, the `transition` and `budget_snapshot` fields reflect the **first-call snapshot** and may be stale. Callers MUST call `campaign.status` to obtain the current budget and status if they need to make subsequent decisions (e.g., whether to `campaign.resume`).
```

### P10. `docs/plans/2026-02-12-idea-generator-architecture-spec.md` — §3.1: Add `ConstraintPropagation` operator

Under `Operator families (v0.2 建议)`, add:
```markdown
- `ConstraintPropagation`：实验约束传播（给定新的 LHC/暗物质实验限制，系统性排除/约束相关 BSM 模型参数空间，输出可检验的剩余窗口）
```

### P11. `schemas/idea_card_v1.schema.json` — Add `reproducibility_recipe` for calculation claims

In the `claims` items, add:
```json
"reproducibility_recipe": {
  "type": "string",
  "description": "Minimal executable recipe (formula, script reference, or FeynCalc expression) for independently reproducing this claim. Required when support_type is 'calculation'."
}
```

And add a conditional:
```json
{
  "if": {
    "properties": { "support_type": { "const": "calculation" } },
    "required": ["support_type"]
  },
  "then": {
    "required": ["reproducibility_recipe"],
    "properties": { "reproducibility_recipe": { "minLength": 1 } }
  }
}
```

### P12. `schemas/idea_tournament_v1.schema.json` — Enforce draw consistency

Add a conditional:
```json
"allOf": [
  {
    "if": {
      "properties": { "draw_allowed": { "const": false } },
      "required": ["draw_allowed"]
    },
    "then": {
      "properties": {
        "matches": {
          "items": {
            "properties": {
              "winner_node_id": { "type": "string", "format": "uuid" }
            }
          }
        }
      }
    }
  }
]
```
This removes the `null` option for `winner_node_id` when draws are not allowed.
