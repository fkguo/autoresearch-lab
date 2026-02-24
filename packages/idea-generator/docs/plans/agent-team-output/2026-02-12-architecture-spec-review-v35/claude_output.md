VERDICT: NOT_READY

## Blockers

### B1. Missing `abstract_problem_registry_v1.schema.json` — breaks `$ref` closure

The architecture spec (§7) and operator docs (§2.12) mandate a `DomainPack.abstract_problem_registry` with entries typed as `abstract_problem_type → {description, known_solution_families[], prerequisite_checklist[], reference_uris[]}`. The `reduction_audit_v1.schema.json` field `reduction_type_valid` and `reduction_report_v1.schema.json` field `abstract_problem` both depend on runtime validation against this registry. **No schema file is provided.** Without it:

- `node.promote`'s conditional reduction gate (`reduction_audit_failed` with `reason=abstract_problem_not_in_registry`) cannot be machine-tested.
- `campaign.init` cannot validate or merge an abstract_problem_registry the same way it does `formalism_registry`.
- The `ProblemReduction` operator has no contract for what constitutes a valid `abstract_problem` string.

**Fix:** Add `schemas/abstract_problem_registry_v1.schema.json` (see patch below).

### B2. `campaign.init` has no `abstract_problem_registry` parameter

The OpenRPC spec defines `formalism_registry` as an optional override/supplement parameter for `campaign.init`, but the analogous `abstract_problem_registry` is not exposed. This means:

- There is no way to override or supplement the DomainPack's built-in abstract problem registry at campaign init time.
- The reduction gate depends on a registry that is invisible to the RPC contract — it's a "side-channel" dependency.

**Fix:** Add an optional `abstract_problem_registry` parameter to `campaign.init` (see patch below).

### B3. `idea_handoff_c2_v1.schema.json` does not include `reduction_report` / `reduction_audit` for nodes that went through reduction

The handoff schema hardcodes `grounding_audit.status: "pass"` and `formalism_check.status: "pass"` as required fields, but completely omits the conditional reduction gate artifacts. A C2 consumer receiving a handoff artifact for a node that was produced via `ProblemReduction` has **no way to verify** that the reduction audit passed, and no access to the reduction report/transfer plan. This breaks the stated goal that `idea_handoff_c2_v1.json` is the "only allowed entry into C2" with full provenance.

**Fix:** Add optional `reduction_report` and `reduction_audit` fields to the handoff schema, with a conditional constraint that both must be present and `reduction_audit.status == "pass"` when `reduction_report != null` (see patch below).

### B4. `promotion_result_v1.schema.json` missing `reduction_audit_summary`

`node.promote` can fail with `reduction_audit_failed (-32016)`, and the spec states the reduction audit is a promotion gate. But the success result (`promotion_result_v1.schema.json`) has no `reduction_audit_summary` field. On success, the caller and the handoff artifact have no machine-readable confirmation that the reduction audit passed.

**Fix:** Add optional `reduction_audit_summary` to `promotion_result_v1.schema.json` (see patch below).

### B5. `rank.compute` Pareto single-node semantics conflict with spec prose

The OpenRPC `rank.compute` description says: "For method=pareto, the filter MUST resolve to >= 1 node (a single node is allowed and yields rank=1)." However, the architecture spec §2.3 says: "Pareto 要求筛选后节点数 ≥ 1（0 则 fail）". The OpenRPC `dimensions` parameter adds: "For method=pareto, the effective dimension count MUST be >= 2; otherwise insufficient_eval_data (-32013)."

Single-node Pareto with ≥2 dimensions is mathematically degenerate (trivially rank=1) but not harmful. **However**, the `ranking_result_v1.schema.json` has `ranked_nodes.minItems: 1` globally but the `allOf` conditional only constrains `minItems: 2` for Elo. This is consistent but the **prose in the architecture spec (§2.3)** says "Elo 要求节点数 ≥ 2（<2 则 fail）" — but doesn't mention the dimension floor for Pareto. The dimension floor (`>=2 dimensions`) is only in the OpenRPC doc and not in the architecture spec. This is a prose/contract drift that will confuse implementers.

**Fix:** Synchronize the architecture spec §2.3 to mention the `>=2 dimensions` Pareto requirement explicitly.

## Non-blocking

### N1. `OperatorSpec` not formalized as a schema

The executable-discovery-operators doc provides a textual `OperatorSpec` structure and says "This is not the final schema (avoid premature freezing)." That's fine for v0.2, but the absence of even a stub `operator_spec_v1.schema.json` means:

- Operator registry entries in the DomainPack have no machine-checkable structure.
- `operator_id` and `operator_family` on `IdeaNode` are free-text with no validation against a registry.

**Recommendation:** Add a stub `schemas/operator_spec_v1.schema.json` with `operator_id`, `family`, `seed_kinds`, `hard_constraints`, `output_kind` as required fields. Mark it `$comment: "Stub, v0.2"`.

### N2. `TeamPolicy` / `RoleSpec` have no schema stubs

The architecture spec (§3.4) describes Team/Role concepts in prose but there are no schema files for `TeamPolicyConfig`, `RoleSpec`, or `IslandArchetype`. Since `island_state_v1.schema.json` already has `team_policy_id`, downstream implementers need at least a stub to validate configurations.

**Recommendation:** Add `schemas/team_policy_config_v1.schema.json` and `schemas/role_spec_v1.schema.json` as stubs.

### N3. `eval_result_v1.schema.json` has no `campaign_status` field

After `eval.run`, the campaign might have transitioned to `exhausted` (budget blown during eval). Unlike `search_step_result_v1` (which has `early_stopped` and `island_states`), the eval result gives no campaign status visibility. The caller must make an extra `campaign.status` call.

**Recommendation:** Add an optional `campaign_status` enum field to `eval_result_v1.schema.json` (or at minimum document that callers should follow up with `campaign.status`).

### N4. Entropy floor `ε` safety bound not schema-enforced

The stat-phys doc says `ε ∈ [0, 0.2]` but `distributor_policy_config_v1.schema.json` puts `epsilon_floor` under the free-form `hyperparameters` object. No schema validation bounds it.

**Recommendation:** If keeping it in `hyperparameters`, add a comment. Better: promote `epsilon_floor` to a named field in `hyperparameters` with `minimum: 0, maximum: 0.5`.

### N5. `distributor_event_v1.schema.json` missing free-energy / entropy diagnostics

The stat-phys doc (§2.6) specifically recommends logging `Z`, `F`, `H`, `N_eff`, `kl_to_prev` per decision step. The diagnostics field is `additionalProperties: true` (which allows them), but they have no named schema presence, making replay tooling brittle.

**Recommendation:** Add named optional fields: `free_energy_F`, `entropy_H`, `n_eff`, `kl_to_prev` in the `diagnostics` sub-object or as top-level optional fields.

### N6. No `campaign.delete` / `campaign.archive` RPC

The idempotency spec says records are retained "at least until campaign ends" and references a future `campaign.delete/archive`. This is fine for v0.x, but the absence means idempotency records grow unboundedly. Not a blocker for architecture review, but should be tracked.

### N7. `idea_node_v1.schema.json` — `operator_family` is optional

The field description says "recommended but not strictly required in v0.2," yet the `SearchPolicy reduction-priority predicate` in the operators doc needs `operator_family` to distinguish `ProblemReduction` nodes. If it's absent, the predicate has a fallback gap.

**Recommendation:** Make `operator_family` required in v0.3 (add to tracker).

### N8. `campaign_mutation_result_v1.schema.json` `allOf` complexity

The conditional constraints are thorough but the nested `allOf` with 13 branches is hard to validate by hand. Recommend adding a test fixture file (`tests/fixtures/campaign_mutation_*.json`) with at least one valid/invalid example per transition.

## Real-research fit

### R1. ProblemReduction workflow is well-designed for real HEP bottlenecks

The reduction pipeline (seed bottleneck → abstract_problem → known_solutions → transfer_plan → toy_check → reduction_audit) maps cleanly to real research patterns. Examples:

- **Lattice QCD sign problem** → abstract as `optimization` or `inference` → known solutions: complex Langevin, Lefschetz thimbles, tensor networks → toy check: free fermion or 0+1d model.
- **BSM parameter space scanning** → abstract as `optimization` → known solutions: nested sampling, Bayesian optimization → toy check: simplified 2-parameter model.
- **PDF fitting** → abstract as `inference` → known solutions: neural network regression with uncertainty → toy check: toy PDF at known values.

The `reduction_map.minItems: 8` requirement is appropriate — it forces genuine structural correspondence rather than hand-waving.

### R2. CrossDomainAnalogy + TechniqueTransplant distinction is valuable

Separating "structural analogy" (mapping table) from "method transplant" (executable transfer plan + toy check) avoids the common failure mode where physicists say "this is like X" without any operational content. The mandatory `compatibility_checks.minItems: 2` and `minimal_toy_check` enforce this.

### R3. FalsificationPressure as a first-class operator is excellent

Most AI-for-science systems generate ideas but don't systematically try to kill them. Having a dedicated operator that takes existing IdeaNodes and outputs kill criteria is a genuine improvement over "score and rank." The clean-room constraint (`Checker → Referee`) prevents self-evaluation bias.

### R4. Novelty delta table addresses a real problem

The `non_novelty_flags` enum (`parameter_tuning_only`, `relabeling_only`, `equivalent_reformulation`, `no_new_prediction`, `known_components_no_testable_delta`) directly targets the most common failure mode in LLM-generated "novel" ideas. This is the right level of granularity.

### R5. Missing: seed provenance for "failed approaches" feedback loop

The architecture mentions `failed_approach_v1.jsonl` as a seed source (§8.1) and has a schema, but there's no documented mechanism for **how** failed approaches from downstream (C2 failures, W_compute failures) get written back into the idea-core's seed sources. The `seed_pack_v1.schema.json` `seed_type` is free-text, which allows it, but the feedback loop needs an explicit contract.

### R6. Folklore risk threshold not parameterized

The spec says "超过阈值则必须走 A0-folklore 人类裁定" but the threshold is nowhere in the schema — not in `evaluator_config_v1`, not in `campaign_charter_v1`. It's a runtime magic number.

**Recommendation:** Add `folklore_risk_threshold` to `evaluator_config_v1.schema.json` (with a sensible default, e.g., 0.7).

## Robustness & safety

### S1. Idempotency design is thorough and well-specified

The JCS canonicalization + SHA-256 payload hash, the replay-not-rerun semantics for non-deterministic operations, the explicit `is_replay` flag, and the conflict detection are all production-grade. The consistency requirement ("idempotency record commits with side-effects atomically") is the right constraint.

### S2. Grounding audit with active resolution is the correct approach

Requiring URI resolution (not just format validation) catches phantom citations — the most dangerous form of LLM hallucination in a research context. The `partial` status allows graceful degradation when some URIs are temporarily unreachable.

### S3. Reduction audit `allOf` constraints are well-crafted

The conditional logic in `reduction_audit_v1.schema.json` enforces:
- `violated` assumption → `status: fail`
- `reduction_type_valid: false` → `status: fail`
- `toy_check_result: fail` → `status: fail`
- `status: pass` → all assumptions satisfied, type valid, toy check pass
- All `pending_verification` + no violated + type valid + toy pass/skip → `partial`

This is machine-checkable and covers the key failure modes. The `skip_reason` requirement when `toy_check_result: skipped` prevents silent degradation.

### S4. Budget circuit breaker with multi-dimensional exhaustion reporting

The `exhausted_dimensions` array in error data is essential for automated adapters to know *which* dimension to topup. This is better than most budget systems which just say "out of budget."

### S5. Risk: No rate limiting on `eval.run` or `search.step`

With `eval.run` accepting up to 100 nodes and `search.step` accepting unbounded `n_steps`, a single malformed or adversarial call could consume the entire budget. The `step_budget` fuse helps for `search.step`, but `eval.run` has no per-call cost bound beyond the global budget.

**Recommendation:** Add an optional `eval_budget` parameter (analogous to `step_budget`) to `eval.run`, or document that implementations SHOULD impose a per-call cost estimate check before starting evaluation.

### S6. Risk: `total_count` in `node_list_result_v1` can drift across pages

The schema correctly documents this ("May differ across pages"), but automated consumers may cache `total_count` from page 1 and make allocation decisions. This is a standard pagination issue — no fix needed, just noting it's documented.

### S7. Risk: No versioning/migration contract for schema evolution

All schemas use `$id` with `_v1` suffix, which is good. But there's no documented migration strategy for when `_v2` schemas arrive. What happens to existing campaigns with `_v1` artifacts?

**Recommendation:** Add a brief "Schema Evolution" section to the architecture spec (even one paragraph: "v1 artifacts remain valid indefinitely; v2 schemas must be backward-compatible or campaigns must be migrated via an explicit migration tool").

## Specific patch suggestions

### Patch 1: Add `schemas/abstract_problem_registry_v1.schema.json` (new file)

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "abstract_problem_registry_v1.schema.json",
  "title": "AbstractProblemRegistry v1",
  "description": "DomainPack-declared registry mapping abstract problem types to known solution families, prerequisites, and references. Used by ProblemReduction/TechniqueTransplant operators and validated at reduction_audit time.",
  "type": "object",
  "required": ["entries"],
  "properties": {
    "entries": {
      "type": "array",
      "minItems": 1,
      "items": {
        "type": "object",
        "required": ["abstract_problem_type", "description", "known_solution_families", "prerequisite_checklist", "reference_uris"],
        "properties": {
          "abstract_problem_type": {
            "type": "string",
            "minLength": 1,
            "description": "Canonical type ID (e.g., optimization, inference, graph, pde, geometry, algebra, control, signal_processing, numerics)."
          },
          "description": { "type": "string", "minLength": 10 },
          "known_solution_families": {
            "type": "array",
            "minItems": 1,
            "items": { "type": "string", "minLength": 1 }
          },
          "prerequisite_checklist": {
            "type": "array",
            "items": { "type": "string", "minLength": 1 },
            "description": "Conditions that must hold for the abstract problem type to be applicable (e.g., convexity, finite dimensionality)."
          },
          "reference_uris": {
            "type": "array",
            "minItems": 1,
            "items": { "type": "string", "format": "uri" }
          }
        },
        "additionalProperties": false
      }
    }
  },
  "additionalProperties": false
}
```

### Patch 2: `schemas/idea_core_rpc_v1.openrpc.json` — add `abstract_problem_registry` to `campaign.init`

In the `campaign.init` method's `params` array, after the `formalism_registry` param, add:

```json
{
  "name": "abstract_problem_registry",
  "schema": {
    "$ref": "./abstract_problem_registry_v1.schema.json"
  },
  "description": "Override or supplement the DomainPack default abstract problem registry. If omitted, the engine uses the DomainPack built-in registry. If provided, entries are merged (caller entries take precedence on abstract_problem_type collision). Used at reduction_audit time to validate reduction_report.abstract_problem.",
  "required": false
}
```

### Patch 3: `schemas/idea_handoff_c2_v1.schema.json` — add reduction provenance

Add after the `formalism_check` property:

```json
"reduction_report": {
  "oneOf": [
    { "$ref": "./reduction_report_v1.schema.json" },
    { "type": "null" }
  ],
  "description": "Present when the promoted node went through ProblemReduction/TechniqueTransplant. null otherwise."
},
"reduction_audit": {
  "oneOf": [
    { "$ref": "./reduction_audit_v1.schema.json" },
    { "type": "null" }
  ],
  "description": "Present (and status=pass) when reduction_report is non-null. null otherwise."
}
```

Add to `allOf`:

```json
{
  "if": {
    "properties": { "reduction_report": { "not": { "type": "null" } } },
    "required": ["reduction_report"]
  },
  "then": {
    "required": ["reduction_audit"],
    "properties": {
      "reduction_audit": {
        "type": "object",
        "required": ["status"],
        "properties": { "status": { "const": "pass" } }
      }
    }
  }
}
```

### Patch 4: `schemas/promotion_result_v1.schema.json` — add `reduction_audit_summary`

Add after `grounding_audit_summary`:

```json
"reduction_audit_summary": {
  "oneOf": [
    {
      "type": "object",
      "required": ["status"],
      "properties": {
        "status": { "const": "pass" },
        "abstract_problem": { "type": "string", "minLength": 1 },
        "toy_check_result": { "enum": ["pass"] },
        "assumption_count": { "type": "integer", "minimum": 1 },
        "all_assumptions_satisfied": { "const": true }
      },
      "additionalProperties": false
    },
    { "type": "null" }
  ],
  "description": "Non-null when the promoted node has a reduction_report. Summarizes the passed reduction audit."
}
```

### Patch 5: `docs/plans/2026-02-12-idea-generator-architecture-spec.md` §2.3 — sync Pareto dimension requirement

In the bullet under `rank.compute` constraints, change:

> **Pareto 要求筛选后节点数 ≥ 1（0 则 fail），Elo 要求节点数 ≥ 2（<2 则 fail）**

to:

> **Pareto 要求筛选后节点数 ≥ 1（0 则 fail）且有效评分维度 ≥ 2（不足则 `insufficient_eval_data` with `reason=insufficient_dimensions`），Elo 要求节点数 ≥ 2（<2 则 fail）**

### Patch 6: `schemas/evaluator_config_v1.schema.json` — add `folklore_risk_threshold`

Add to `properties`:

```json
"folklore_risk_threshold": {
  "type": "number",
  "minimum": 0,
  "maximum": 1,
  "default": 0.7,
  "description": "Threshold above which folklore_risk_score triggers mandatory A0-folklore human adjudication."
}
```

### Patch 7: `schemas/idea_core_rpc_v1.openrpc.json` — add `-32016` error to `x-error-data-contract.known_reasons`

Already present — confirmed. Good.

### Patch 8: `docs/plans/2026-02-12-idea-generator-architecture-spec.md` §9 — add schema evolution note

Add after the v0.3 bullet list:

> **Schema Evolution Policy (v0.x → v1.0)**
> - All `_v1` artifacts remain valid indefinitely; engines MUST NOT reject valid v1 artifacts.
> - Future `_v2` schemas MUST be backward-compatible (v1 documents validate against v2) OR campaigns MUST be migrated via an explicit `campaign.migrate` RPC or offline migration tool.
> - Schema `$id` suffixes (`_v1`, `_v2`) serve as version discriminators; engines MUST inspect `$id` or an explicit `schema_version` field (to be added in v1.0) to determine which validator to apply.
