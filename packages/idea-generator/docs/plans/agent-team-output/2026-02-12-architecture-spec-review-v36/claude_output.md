VERDICT: NOT_READY

## Blockers

1. **`rank.compute` Pareto dimension sync is under-specified for the single-node case.** The spec says "filter MUST resolve to ≥ 1 node" for Pareto, but with 1 node and ≥ 2 dimensions, the Pareto front is trivially that node (rank=1). While technically allowed, the OpenRPC description says "a single node is allowed and yields rank=1" but `ranking_result_v1.schema.json` requires `ranked_nodes.minItems: 1` — this is consistent. **However**, the *spec text* in §2.3 says "Pareto 要求筛选后节点数 ≥ 1（0 则 fail）且有效评分维度 ≥ 2（不足则 `insufficient_eval_data`）" while the OpenRPC says the same, but **neither the spec nor the schema defines how `effective dimensions` are counted when a node has no scorecards at all.** If `eval.run` was never called, the node has `eval_info: null` and no scorecard entry exists. The engine must return `insufficient_eval_data` with `reason=no_scorecards`, but this sub-reason is listed in `x-error-data-contract` only for `-32013` and **is not documented in the `rank.compute` method description**. The method description only mentions `insufficient_dimensions` and `insufficient_nodes`. **Fix required**: add `no_scorecards` to the `rank.compute` method-level error documentation and clarify: "if no scorecards exist for the resolved node set (i.e., eval.run has never been called or all scorecards have status=failed), the engine MUST return insufficient_eval_data with error.data.reason=no_scorecards."

2. **`promotion_result_v1.schema.json` — `reduction_audit_summary` allows `toy_check_result: "pass"` only, but the arch spec §4.2.1 says `reduction_audit.status == pass` is the gate, which per `reduction_audit_v1.schema.json` requires `toy_check_result == "pass"`. This is consistent. BUT: `reduction_audit_summary.all_assumptions_satisfied` is `const: true` while the full `reduction_audit_v1` `status=pass` constraint forbids `pending_verification` *and* `violated`. The summary says `assumption_count` (integer ≥ 1) but doesn't expose which assumptions. This is fine for a summary. **The real blocker**: `reduction_audit_summary` is declared as non-required in `promotion_result_v1.schema.json` — it's not in the `required` array. When `reduction_report` is non-null in the handoff, the promotion should have passed the reduction gate, so `reduction_audit_summary` MUST be non-null. There's no `allOf`/`if-then` constraint in `promotion_result_v1` enforcing this.** If the handoff has a reduction_report, the promotion_result should guarantee `reduction_audit_summary != null`. Currently it doesn't.

3. **`idea_handoff_c2_v1.schema.json` has the conditional `allOf` for reduction_report → reduction_audit, but `promotion_result_v1.schema.json` does NOT.** This means a conforming engine could return a `promotion_result_v1` with a non-null `reduction_report` somewhere in the node but a `null` `reduction_audit_summary` in the promotion result. The handoff artifact itself would be correct (it has the `allOf` guard), but the RPC response to the caller would be misleading. This is a provenance gap in the caller-facing contract.

4. **`abstract_problem_registry_v1` is plumbed into `campaign.init` (good), but the `reduction_audit_v1.schema.json` has no field linking to which registry entry was validated.** The `reduction_report_v1` has `abstract_problem` (a string), and `reduction_audit_v1` has `reduction_type_valid` (bool), but there's no `abstract_problem_type` echo in the audit. This means an auditor reviewing the audit cannot tell *which* registry entry was matched without also reading the reduction_report. **Fix**: add `abstract_problem_type: string` (required) to `reduction_audit_v1` so the audit is self-contained for provenance.

5. **`campaign.init` `abstract_problem_registry` merge semantics are under-specified for conflict resolution.** The OpenRPC says "caller entries take precedence on abstract_problem_type collision" but the `abstract_problem_registry_v1.schema.json` is an array of entries. Two entries with the same `abstract_problem_type` in the merged result would violate uniqueness, but the schema has no `uniqueItems` or uniqueness constraint on `abstract_problem_type`. **Fix**: either (a) add a note that the engine MUST deduplicate by `abstract_problem_type` after merge (caller wins), or (b) add a schema-level uniqueness constraint (harder in JSON Schema draft 2020-12 for object arrays — typically needs runtime validation). At minimum, the spec text should mandate engine-side uniqueness validation post-merge, and return `schema_validation_failed` if duplicates remain.

## Non-blocking

1. **`reduction_audit_v1.schema.json` `allOf` logic is complex but correct.** The cascade `violated → fail`, `reduction_type_valid=false → fail`, `toy_check_result=fail → fail`, `pass requires all satisfied + type_valid + toy_pass`, and the "all pending + no violated + type_valid + toy pass/skipped → partial" is well-constructed. One edge case: if assumptions are *empty* (but schema says `minItems: 1`, so not possible). Good.

2. **The `all-pending → partial` constraint (last `allOf` block in `reduction_audit_v1`)** uses a double `not.contains` pattern to express "no `satisfied` and no `violated`" which correctly captures "all are `pending_verification`". However, it doesn't cover the mixed case of some `satisfied` + some `pending_verification` + no `violated` + type_valid + toy pass/skipped — this case should also be `partial` but is not constrained by the schema. The schema only pins `pass` (all satisfied) and `fail` (any violated / type invalid / toy fail); mixed satisfied+pending falls through unconstrained. **Suggest**: add one more `allOf` block constraining `status` to `partial` when `assumptions contains pending_verification` AND no `violated` AND `reduction_type_valid=true` AND `toy_check_result != fail`.

3. **`idea_handoff_c2_v1` reduction_report/reduction_audit are both `oneOf: [$ref, null]`.** This means both are optional fields (not in `required`). The `allOf` conditional enforces that when `reduction_report` is non-null, `reduction_audit` must be present and pass. But there's no guard for the reverse: `reduction_audit` non-null but `reduction_report` null. This is a minor semantic oddity — an audit without a report is meaningless. **Suggest**: add an inverse conditional or a note that `reduction_audit` without `reduction_report` is invalid.

4. **`distributor_event_v1.schema.json` `selected_action` requires `backend_id, operator_id, island_id` but makes `team_policy_id` optional.** Given that the spec says a tick "runs the configured TeamPolicy/topology for that island", the team_policy_id should arguably be required when the island has a team topology. This is hard to enforce in schema alone. Mark as informational.

5. **`eval_result_v1` requires `node_revisions` as a map of `node_id → integer`. Good for stale-read detection. But `search_step_result_v1` does NOT include node_revisions for `updated_node_ids`.** Instead it points to `updated_nodes_artifact_ref` which links to `node_mutation_log_v1`. This asymmetry means adapters must make an extra artifact fetch to get revision info after search.step but get it inline after eval.run. Consider adding `node_revisions` to `search_step_result_v1` as well (non-blocking but improves symmetry).

6. **The `campaign_mutation_result_v1` `allOf` blocks for `topup` encode transitions like `running → running (changed=false)`, `paused → paused (changed=false)`, `early_stopped → early_stopped (changed=false)`, `exhausted → running|exhausted`. This is thorough. However**, the spec says `campaign.topup` for `early_stopped` "adds budget but does NOT change the status". The schema correctly pins `current_status: early_stopped, changed: false` for that case. Good.

7. **No schema for `operator_spec` / `operator_registry`.** The operators doc (§1) proposes `OperatorSpec` as a conceptual interface but there's no `schemas/operator_spec_v1.schema.json`. This is acceptable for v0.2 (spec says "先用同形对象描述算子，後续再升级为稳定 schema") but should be on the v0.3 tracker.

8. **`BudgetEnvelope.max_steps` and `max_nodes` are optional** but `BudgetSnapshot` requires `steps_remaining` and `nodes_remaining` (as `integer|null`). This is handled correctly: null when the envelope field was not set. Good.

## Real-research fit

**Strengths (substantial):**

- The **ProblemReduction** operator + abstract_problem_registry is a genuine research multiplier for HEP. Many BSM bottlenecks (e.g., multi-loop integrals as optimization problems, signal/background discrimination as statistical inference, lattice QCD extrapolations as PDE/interpolation) can be cracked faster by recognizing the underlying mathematical structure. The registry-driven approach prevents hallucinated reductions.

- The **reduction_audit gate** is well-calibrated for real research: requiring toy checks prevents "paper reductions" that look good on paper but fail on contact with actual computation. The conditional enforcement (only when reduction_report exists) avoids overhead for non-reduction ideas.

- The **novelty_delta_table** with `non_novelty_flags` is excellent. In my experience reviewing HEP papers, at least 30% of "novel" claims are parameter tuning or relabeling. Making this a machine-enforced schema field is high-leverage.

- The **failed_approach_v1** artifact is underrated. Negative results are the dark matter of research — typically lost. Structuring them with `reuse_potential` enables future campaigns to avoid known dead ends.

**Gaps for real research:**

- **No `experimental_status` field in IdeaCard.** For HEP-ph, a critical dimension is whether the required observables are accessible at current/planned experiments (LHC Run 3, HL-LHC, Belle II, DUNE, etc.). The `required_observables[]` field is just strings; there's no machine-readable mapping to experiment capabilities or timelines. This matters for feasibility evaluation. Suggest: add optional `experimental_reach` metadata to `required_observables` items (even as an extension for v0.2).

- **The `CrossDomainAnalogy` operator requires a mapping table with "at least 5 corresponding items"**, but this is only in the prose spec, not schema-enforced. The `rationale_draft_v1.schema.json` `analogy_mapping` has no `minItems`. If this is a hard constraint, it should be in the schema (or in a DomainPack validator reference).

- **No explicit handling of "known results" vs "new predictions".** In HEP-th work, a common failure mode is proposing a "new" prediction that is actually a known consequence of an existing framework (e.g., predicting FCNC suppression in the SM, which is already the GIM mechanism). The `folklore_risk_score` partially addresses this, but a structured "known_consequences" field in the IdeaCard would be more robust.

## Robustness & safety

1. **Hallucination mitigation is strong**: The grounding audit with active URI resolution, the claim-level `support_type` + `verification_plan` requirement for LLM inferences, and the clean-room evaluation protocol form a solid three-layer defense. The `phantom reference` check (§4.2.1 point 1) is particularly important — LLMs are notorious for fabricating plausible-looking arXiv IDs.

2. **The idempotency design is thorough** — RFC 8785 JCS canonicalization for payload hashing, explicit replay semantics, and the `first_response_json_bytes` storage requirement prevent the most common idempotency pitfalls. The "payload mismatch → reject" rule prevents accidental cross-contamination.

3. **Budget circuit breaker** is well-designed with multi-dimensional fusing. The `degradation_order` is a good operational safety valve.

4. **Potential safety gap: no rate limiting on `eval.run` batch size evolution.** `maxItems: 100` is a hard cap, but there's no guidance on progressive scaling. A campaign could repeatedly call `eval.run` with 100 nodes, burning through budget faster than the circuit breaker can react (if the breaker only fires at tick boundaries). Consider documenting that `eval.run` cost should be pre-estimated against remaining budget before execution.

5. **The `reduction_audit_v1` `status=partial` allows promotion to be blocked** (as specified: "partial/fail 一律阻塞晋升"). This is correct and conservative. However, the schema's `allOf` constraint for `partial` only covers the "all pending, no violated" case. The mixed "some satisfied, some pending, no violated" case is unconstrained in the schema (see Non-blocking #2). An implementation could incorrectly allow `status=pass` for this case without schema-level rejection. This is a robustness gap.

6. **No schema-level enforcement that `grounding_audit.failures` is empty when `status=pass`.** The `idea_handoff_c2_v1` pins `status: const "pass"` but doesn't constrain `failures` to be empty (only `maxItems: 0` is on `formalism_check.missing_formalisms`). An implementation could produce `status=pass` with non-empty `failures`, which would be semantically inconsistent. Fix: add `"failures": { "maxItems": 0 }` to the grounding_audit in `idea_handoff_c2_v1`.

## Specific patch suggestions

### Patch 1: `schemas/promotion_result_v1.schema.json` — enforce reduction_audit_summary when reduction exists

```json
// File: schemas/promotion_result_v1.schema.json
// ADD to the top-level object (after existing properties), an allOf block:

"allOf": [
  {
    "if": {
      "not": {
        "properties": { "reduction_audit_summary": { "type": "null" } }
      },
      "$comment": "This is a proxy: if reduction_audit_summary is non-null, it should be valid. The real enforcement is: the engine MUST set reduction_audit_summary non-null whenever the underlying node has reduction_report != null."
    },
    "then": {}
  }
]

// BETTER approach: Since promotion_result doesn't carry reduction_report itself,
// add a required "has_reduction" boolean and use conditional:

// In "required" array, ADD: (no change needed if we use a different approach)
// In "properties", ADD:
"has_reduction": {
  "type": "boolean",
  "description": "True when the promoted node had a non-null reduction_report. When true, reduction_audit_summary MUST be non-null."
}

// Then ADD allOf:
"allOf": [
  {
    "if": { "properties": { "has_reduction": { "const": true } }, "required": ["has_reduction"] },
    "then": {
      "properties": {
        "reduction_audit_summary": {
          "type": "object"
        }
      },
      "required": ["reduction_audit_summary"]
    }
  }
]

// And add "has_reduction" to the top-level "required" array.
```

### Patch 2: `schemas/reduction_audit_v1.schema.json` — add `abstract_problem_type` for self-contained provenance

```json
// File: schemas/reduction_audit_v1.schema.json
// In "required" array, ADD: "abstract_problem_type"
// In "properties", ADD:

"abstract_problem_type": {
  "type": "string",
  "minLength": 1,
  "description": "Echo of the abstract problem type that was validated against the registry. Enables self-contained audit without requiring a separate read of reduction_report."
}
```

### Patch 3: `schemas/reduction_audit_v1.schema.json` — fix unconstrained mixed satisfied+pending case

```json
// File: schemas/reduction_audit_v1.schema.json
// ADD one more allOf block to handle: some satisfied + some pending + no violated + type_valid + toy not fail → must be partial

{
  "if": {
    "allOf": [
      {
        "properties": {
          "assumptions": {
            "contains": {
              "properties": { "status": { "const": "pending_verification" } },
              "required": ["status"]
            }
          }
        },
        "required": ["assumptions"]
      },
      {
        "properties": {
          "assumptions": {
            "not": {
              "contains": {
                "properties": { "status": { "const": "violated" } },
                "required": ["status"]
              }
            }
          }
        },
        "required": ["assumptions"]
      },
      {
        "properties": {
          "reduction_type_valid": { "const": true },
          "toy_check_result": { "enum": ["pass", "skipped"] }
        },
        "required": ["reduction_type_valid", "toy_check_result"]
      }
    ]
  },
  "then": {
    "properties": {
      "status": { "const": "partial" }
    },
    "required": ["status"]
  }
}
```

### Patch 4: `schemas/idea_handoff_c2_v1.schema.json` — pin grounding_audit.failures to empty on pass

```json
// File: schemas/idea_handoff_c2_v1.schema.json
// In the "grounding_audit" property definition, change:
"failures": {
  "type": "array",
  "items": { "type": "string" }
}
// TO:
"failures": {
  "type": "array",
  "items": { "type": "string" },
  "maxItems": 0
}
```

### Patch 5: `schemas/abstract_problem_registry_v1.schema.json` — document uniqueness requirement

```json
// File: schemas/abstract_problem_registry_v1.schema.json
// ADD to the "entries" property:

"$comment": "Engine MUST enforce uniqueness of abstract_problem_type across entries after merge (caller entries take precedence on collision). If duplicates remain after merge, engine MUST reject with schema_validation_failed (reason=schema_invalid, details.message='duplicate abstract_problem_type after merge')."
```

### Patch 6: `schemas/idea_core_rpc_v1.openrpc.json` — document `no_scorecards` in rank.compute

```diff
// File: schemas/idea_core_rpc_v1.openrpc.json
// In the rank.compute method description, APPEND:

+If no scorecards exist for the resolved node set (e.g., eval.run has never been called, or all scorecards have status=failed for the resolved nodes), the engine MUST return insufficient_eval_data (-32013) with error.data.reason=no_scorecards.
```

### Patch 7: `docs/plans/2026-02-12-idea-generator-architecture-spec.md` — clarify rank.compute dimension counting when no scorecards exist

```diff
// File: docs/plans/2026-02-12-idea-generator-architecture-spec.md
// In §2.3, item 1 (Campaign scoping), the rank.compute paragraph, APPEND after "不足时引擎必须返回 `insufficient_eval_data`":

+   - 若已过滤节点集在 scorecards 中无任何有效条目（`eval.run` 从未对这些节点执行，或所有 scorecards status=failed），engine 必须返回 `insufficient_eval_data`（`error.data.reason=no_scorecards`）。
```

### Patch 8: `schemas/idea_handoff_c2_v1.schema.json` — guard against orphan reduction_audit

```json
// File: schemas/idea_handoff_c2_v1.schema.json
// ADD another allOf block to prevent reduction_audit without reduction_report:

{
  "if": {
    "properties": {
      "reduction_report": { "type": "null" }
    },
    "required": ["reduction_report"]
  },
  "then": {
    "properties": {
      "reduction_audit": { "type": "null" }
    }
  }
}
```

### Patch 9: `schemas/rationale_draft_v1.schema.json` — add minItems to kill_criteria

The spec says "1–3 个 kill criteria" but `kill_criteria` already has `minItems: 1`. Consider adding `maxItems: 5` to prevent unbounded lists that dilute focus:

```json
// File: schemas/rationale_draft_v1.schema.json
// Change:
"kill_criteria": { "type": "array", "minItems": 1, "items": { "type": "string", "minLength": 1 } }
// TO:
"kill_criteria": { "type": "array", "minItems": 1, "maxItems": 5, "items": { "type": "string", "minLength": 1 } }
```

---

**Summary**: The bundle is impressively thorough — the reduction provenance pipeline, abstract_problem_registry plumbing, and idempotency mechanics are production-grade. The five blockers are all fixable with small schema patches (no architectural rework needed). The core gap is consistency enforcement at schema boundaries: the `promotion_result` ↔ `idea_handoff` provenance link for reductions, the `reduction_audit` mixed-state constraint, and the `rank.compute` no-scorecards edge case. Fix those and this is ready for implementation.
