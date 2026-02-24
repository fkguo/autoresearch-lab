VERDICT: NOT_READY

## Blockers

### B1. `reduction_audit_v1.schema.json` — `status` derivation rule is prose-only, not machine-enforceable

The arch spec (§4.2.1, item 6) defines the semantics: "all pending ⇒ `partial`; any violated ⇒ `fail`". But the schema has no `allOf`/`if-then` constraints encoding this. An engine could emit `status: "pass"` while an assumption has `status: "violated"` and still validate. This is the exact class of "prose-only invariant" the bundle claims to avoid.

**Fix**: Add conditional schema constraints:
```json
"allOf": [
  {
    "if": {
      "properties": {
        "assumptions": {
          "contains": { "properties": { "status": { "const": "violated" } }, "required": ["status"] }
        }
      }
    },
    "then": {
      "properties": { "status": { "enum": ["fail"] } }
    }
  },
  {
    "if": {
      "properties": {
        "reduction_type_valid": { "const": false }
      }
    },
    "then": {
      "properties": { "status": { "enum": ["fail"] } }
    }
  },
  {
    "if": {
      "properties": {
        "toy_check_result": { "const": "fail" }
      }
    },
    "then": {
      "properties": { "status": { "enum": ["fail"] } }
    }
  }
]
```

Without this, the `reduction_audit_failed` gate at `node.promote` is only as strong as the engine implementation's private logic — not the contract.

### B2. `node.promote` gate for `reduction_audit_failed` (-32016) — missing `reduction_report_missing` trigger path in OpenRPC

The OpenRPC declares error code `-32016` with known reasons `["reduction_audit_not_pass", "reduction_report_missing", "abstract_problem_not_in_registry"]`. Good. But the arch spec §4.2.1 says the gate is **conditional**: "when `IdeaNode.reduction_report != null`". This means:
- If `reduction_report != null` but `reduction_audit == null` (audit never ran), what happens? The spec doesn't say. The engine could let it through.
- The `node.promote` description in OpenRPC doesn't document this conditional trigger at all — it only lists the error code.

**Fix**: The OpenRPC `node.promote` description MUST state: "If `reduction_report` is non-null, `reduction_audit.status` MUST be `pass`; if `reduction_audit` is null when `reduction_report` is non-null, the engine MUST reject with `-32016` (`reduction_report_missing` is a misnomer — should be `reduction_audit_missing`)."

Also: rename `reduction_report_missing` to `reduction_audit_missing` in `x-error-data-contract.known_reasons[-32016]` — the current name implies the *report* is missing, but the actual failure mode is a non-null report without a completed audit.

### B3. `CampaignCharter.distributor` — `factorization` is required by arch spec §3.3.1 ("MUST declare"), but the schema marks it optional with a default

The charter schema has `"default": "factorized"` but doesn't list `factorization` in `required`. The arch spec says "CampaignCharter.distributor.factorization **must** declare action-space factorization". If the `distributor` object is present but `factorization` is omitted, JSON Schema will not inject the default — it will simply validate. Downstream code may silently assume `factorized` but the contract isn't enforced.

**Fix**: Either (a) add `"required": ["factorization"]` to the `distributor` sub-object, or (b) if the entire `distributor` block is optional, add a conditional: if `distributor` is present, `factorization` is required.

### B4. Missing schema files referenced by OpenRPC `$ref` — not provided, cannot verify contract completeness

The OpenRPC references these schemas that are **not included** in the bundle:
- `seed_pack_v1.schema.json`
- `budget_envelope_v1.schema.json`
- `budget_topup_v1.schema.json`
- `budget_limit_v1.schema.json`
- `budget_snapshot_v1.schema.json`
- `campaign_init_result_v1.schema.json`
- `campaign_status_v1.schema.json`
- `campaign_mutation_result_v1.schema.json`
- `formalism_registry_v1.schema.json`
- `island_state_v1.schema.json`
- `idempotency_meta_v1.schema.json`
- `idea_list_filter_v1.schema.json`
- `node_list_result_v1.schema.json`
- `promotion_result_v1.schema.json`
- `evaluator_config_v1.schema.json`
- `eval_result_v1.schema.json`
- `elo_config_v1.schema.json`
- `ranking_result_v1.schema.json`
- `rationale_draft_v1.schema.json`
- `idea_card_v1.schema.json`

This is **20 missing schemas**. The "SSOT rule" (§2.3) says schemas are the single source — but over half the referenced schemas don't exist in this bundle. Several are directly relevant to the review focus (e.g., `budget_snapshot_v1` is needed to validate the `BudgetEnvelope.remaining <= 0` semantics for `campaign.resume`; `island_state_v1` is needed to verify the island-level `EXHAUSTED` state semantics).

**Fix**: At minimum, provide `budget_snapshot_v1`, `island_state_v1`, `idempotency_meta_v1`, `campaign_status_v1`, and `evaluator_config_v1` — these are load-bearing for the three review-focus areas. The rest should ship before v0.2 is declared complete.

### B5. `distributor_policy_config_v1.schema.json` — `action_space` doesn't enforce that factorized configs declare their factor enumerations

When `factorization: "factorized"`, the spec (arch spec §3.3.1 + statphys doc §1.1) requires that the factor dimensions (backend_ids, operator_ids, island_ids) are enumerated for replay. But the schema doesn't enforce this — all ID arrays are optional regardless of factorization mode.

**Fix**: Add conditional constraints:
```json
"allOf": [{
  "if": { "properties": { "factorization": { "const": "factorized" } } },
  "then": {
    "required": ["backend_ids", "operator_ids", "island_ids"]
  }
}]
```
inside `action_space`.

## Non-blocking

### N1. `reduction_report_v1.schema.json` — `compatibility_checks` is not required but the operator spec (§2.12) demands ≥2

The schema lists `compatibility_checks` as optional (not in `required`), but the arch spec and operator doc say the transfer plan must include compatibility checks. This should be promoted to `required` to match the prose contract.

### N2. `distributor_event_v1.schema.json` — `rng_seed_used` is a string, but no format/pattern is enforced

The arch spec requires `rng_seed_used` (or equivalent) for reproducibility. Making it a bare string with no pattern means anything goes. Recommend at minimum `"minLength": 1` and documenting expected format (e.g., integer-as-string, hex seed, etc.) in `description`.

### N3. `novelty_delta_table_v1.schema.json` — no `closest_prior_summary` field

The arch spec §6.2 says each closest prior should include "URI + one sentence summary". The schema only has `closest_prior_uris` (array of URIs) but no summary field. Adding an optional `closest_prior_summaries` array (or changing to an array of objects with `{uri, summary}`) would close the gap.

### N4. `failed_approach_v1.schema.json` — `failure_evidence_uris` allows empty array

The `required` list includes `failure_evidence_uris` but there's no `minItems: 1`. A failure record with zero evidence URIs is arguably not useful. Consider adding `minItems: 1`.

### N5. Campaign state machine — `campaign.pause` from `exhausted` state loses the "why we stopped" signal

When transitioning `exhausted → paused`, the original trigger (budget exhaustion) is absorbed. The spec says `campaign.resume` from `paused` checks budget, but there's no field in `campaign_mutation_result` (presumably) to echo "this campaign was paused from exhausted — budget was the root cause." This makes debugging harder. Suggest: include `previous_status` in the mutation result schema.

### N6. `search_step_result_v1.schema.json` — `distributor_policy_config_ref` is optional even when Distributor is used

The arch spec §3.3.1 says it "must" point to the config. The schema marks it optional (no required). If the campaign uses a Distributor, this ref should be required. Consider a conditional constraint keyed on the charter's `distributor` presence, or at minimum document that implementations MUST emit it when a Distributor is active.

### N7. Statphys doc — `p_min` safety bound is stated but not schema-enforced

The bandit-distributor-alternatives doc says `p_min >= 1/(10*N)` and "Log `p_min` in `distributor_policy_config_v1.json`". But the config schema has `hyperparameters` as a free-form object. Consider adding `p_min` as a named optional field under `hyperparameters` with a `minimum: 0` + `exclusiveMinimum: 0` constraint, and document the `1/(10*N)` bound in the description. Full enforcement requires runtime validation (depends on N), but the schema can at least prevent `p_min = 0`.

### N8. `IdeaNode.operator_family` is "recommended but not strictly required" — but `ProblemReduction` dispatch depends on it

The arch spec's `SearchPolicy reduction-priority predicate` (operator doc §4, item 4) needs to know operator family to decide priority. If `operator_family` is absent, the predicate is blind. Recommend promoting to `required` in v0.2 to support the reduction workflow.

### N9. `eval_info.scores` — no schema enforcement that keys match `EvaluatorConfig.dimensions`

The description says "Keys should match EvaluatorConfig.dimensions" but this is cross-schema validation that JSON Schema can't enforce alone. This is fine, but the engine MUST validate at runtime. Suggest adding a normative note in the description: "Engine MUST reject eval_info where score keys ⊄ EvaluatorConfig.dimensions."

### N10. `distributor_event_v1.schema.json` — `selection_probs` values should sum to ≈1

No JSON Schema constraint can enforce this, but a normative note should be added: "Engine MUST ensure values sum to 1.0 (within floating-point tolerance). Replay tooling SHOULD flag events where |Σ p_i - 1| > 1e-6."

## Real-research fit

### R1. ProblemReduction + ReductionAudit is the highest-leverage new addition

In real HEP research, an enormous fraction of bottlenecks are reducible to known math/CS problems (spectral methods for operator mixing, optimization for likelihood fits, graph algorithms for Feynman diagram topology, etc.). The `ProblemReduction` operator with its `reduction_map` (≥8 items) and `known_solutions` (≥2 with references) forces exactly the kind of structured thinking that prevents "reinventing the wheel." The `reduction_audit` gate with `toy_check_result` is a practical kill-switch that would genuinely save researcher time.

**Real concern**: The `reduction_map.minItems: 8` may be too high for simple reductions (e.g., "this integral is a known hypergeometric function" — the mapping is 3-4 items). Consider `minItems: 4` with a "completeness_flag" to indicate whether the mapping is exhaustive.

### R2. NoveltyDeltaTable addresses a real peer-review failure mode

The `non_novelty_flags` enum (`parameter_tuning_only`, `relabeling_only`, etc.) directly targets the #1 quality problem in HEP-th: papers that relabel existing results and claim novelty. The `verification_hook` per delta is key — it forces the system to articulate *how* the novelty claim could be checked.

### R3. `TechniqueTransplant` vs `ProblemReduction` overlap is a real taxonomic issue

In practice, many cross-disciplinary breakthroughs could be classified as either. The arch spec doesn't clearly delineate when to use which. The `reduction_audit` gate only triggers when `reduction_report != null`, but `TechniqueTransplant` also produces outputs that should be audited similarly. Consider: should `TechniqueTransplant` also produce a `reduction_report` (it has the same structure), or does it need its own audit schema?

### R4. Failed approaches as structured negative results

The `failed_approach_v1.schema.json` is valuable for real research — HEP has a huge "dark matter of negative results" that never gets recorded. The `reuse_potential` field is a pragmatic addition. However, the schema doesn't link to specific `node_id`s that failed — only `idea_id`. Adding `node_ids: array[uuid]` would enable tracing exactly which search-tree branches were dead ends.

### R5. Multi-Island archetypes map well to real HEP research strategies

`S1_anomaly` (anomaly-focused), `S2_symmetry` (symmetry-focused), `S3_analogy` (cross-domain), `S4_formalism` (representation) correspond to recognizable "schools" in theoretical physics. This is a sensible decomposition. The `repopulate` mechanism (migrating ideas between islands) is a good analogy to how ideas actually cross-pollinate between research groups.

## Robustness & safety

### RS1. Grounding audit + reduction audit together create a strong anti-hallucination stack

The two-gate system (grounding for evidence integrity, reduction for logical validity) is well-designed. The `node.promote` rejection cascade (grounding_audit_failed → reduction_audit_failed → formalism_not_in_registry) creates defense in depth. This is significantly stronger than a single "quality score."

### RS2. Idempotency contract is exceptionally thorough but creates a large implementation surface

The JCS canonicalization + payload_hash + per-campaign scoping + replay semantics + TTL management is a production-grade idempotency system. This is good for safety but represents a significant implementation burden for v0.2. The risk is that implementers cut corners on the "Idempotency record + side-effect atomicity" requirement (§2.3, bullet 2) — this is the hardest part to get right and the most dangerous to get wrong.

**Recommendation**: Add an explicit conformance test suite reference (even if the tests don't exist yet) for idempotency behavior. E.g., "An implementation MUST pass the idempotency conformance suite defined in `tests/conformance/idempotency_*.test.json` before deployment."

### RS3. Budget circuit breaker has no "grace period" for in-flight operations

The spec says "immediately terminate all pending" when budget is exceeded. But if a Team topology has 4 roles in a sequential pipeline and the budget triggers after role 2, what happens to the partial artifacts from roles 1-2? The tick atomicity requirement says "all-or-nothing" per tick, but the budget check granularity isn't specified — is it checked between roles within a tick, or only between ticks?

**Fix**: Clarify that budget checks occur at tick boundaries (not mid-tick), and that a tick in progress when budget is exceeded MUST complete (or roll back entirely) before the campaign transitions to `exhausted`. This is implied by tick atomicity but should be stated explicitly.

### RS4. The `abstract_problem_registry` is a critical safety component but has no schema

The arch spec (§7) says DomainPack must declare `abstract_problem_type → {description, known_solution_families[], prerequisite_checklist[], reference_uris[]}`. This registry is load-bearing for `reduction_audit.reduction_type_valid`. But there's no `abstract_problem_registry_v1.schema.json` in the bundle. Without it, the `reduction_type_valid` check is unverifiable.

### RS5. Distributor `p_min` floor prevents probability collapse, but the replicator policy (Policy B) has a separate `η` divergence risk

Large `η` in the multiplicative weights update can cause `w_i → 0` or `w_i → ∞` within a few steps. The entropy floor `ε` partially mitigates this, but `η` bounds are not enforced anywhere. The statphys doc mentions this is a "learning rate" but doesn't cap it. Add a `max_eta` to `hyperparameters` with a sensible default (e.g., `1.0`).

### RS6. `eval.run` atomicity over up to 100 nodes is expensive

The OpenRPC says `maxItems: 100` for `node_ids` and demands full atomicity (all-or-nothing). Rolling back 100 nodes' eval_info writes on failure is non-trivial in an append-only JSONL store. This is implementable but the cost model should be documented. Consider adding a normative note that implementations MAY use a WAL (write-ahead log) pattern internally.

## Specific patch suggestions

### P1. `schemas/reduction_audit_v1.schema.json` — Add machine-enforceable status derivation

**File**: `schemas/reduction_audit_v1.schema.json`  
**Change**: Append to the existing `allOf` array:

```json
{
  "if": {
    "properties": {
      "assumptions": {
        "contains": {
          "properties": { "status": { "const": "violated" } },
          "required": ["status"]
        }
      }
    }
  },
  "then": {
    "properties": { "status": { "enum": ["fail"] } }
  }
},
{
  "if": {
    "properties": { "reduction_type_valid": { "const": false } }
  },
  "then": {
    "properties": { "status": { "enum": ["fail"] } }
  }
},
{
  "if": {
    "properties": { "toy_check_result": { "const": "fail" } }
  },
  "then": {
    "properties": { "status": { "enum": ["fail"] } }
  }
}
```

### P2. `schemas/campaign_charter_v1.schema.json` — Make `factorization` required when `distributor` is present

**File**: `schemas/campaign_charter_v1.schema.json`  
**Change**: In the `distributor` sub-object, add `"required": ["factorization"]`.

### P3. `schemas/idea_core_rpc_v1.openrpc.json` — Fix `node.promote` description for reduction audit gate

**File**: `schemas/idea_core_rpc_v1.openrpc.json`  
**Change**: In the `node.promote` method's `description`, append:

```
Reduction audit gate (conditional): if the node's reduction_report is non-null, reduction_audit MUST also be non-null and reduction_audit.status MUST be 'pass'. If reduction_report is non-null but reduction_audit is null, the engine MUST reject with reduction_audit_failed (-32016) with error.data.reason='reduction_audit_missing'. If reduction_audit.status is 'fail' or 'partial', the engine MUST reject with reduction_audit_failed (-32016) with error.data.reason='reduction_audit_not_pass'.
```

### P4. `schemas/idea_core_rpc_v1.openrpc.json` — Rename `reduction_report_missing` to `reduction_audit_missing`

**File**: `schemas/idea_core_rpc_v1.openrpc.json`  
**Change**: In `x-error-data-contract.known_reasons["-32016"]`, replace `"reduction_report_missing"` with `"reduction_audit_missing"`.

### P5. `schemas/distributor_policy_config_v1.schema.json` — Enforce factor enumeration for factorized mode

**File**: `schemas/distributor_policy_config_v1.schema.json`  
**Change**: In `action_space`, add:

```json
"allOf": [{
  "if": {
    "properties": { "factorization": { "const": "factorized" } },
    "required": ["factorization"]
  },
  "then": {
    "required": ["backend_ids", "operator_ids", "island_ids"]
  }
}]
```

### P6. `schemas/reduction_report_v1.schema.json` — Promote `compatibility_checks` to required

**File**: `schemas/reduction_report_v1.schema.json`  
**Change**: Add `"compatibility_checks"` to the `required` array.

### P7. `schemas/reduction_report_v1.schema.json` — Reduce `reduction_map.minItems` from 8 to 4

**File**: `schemas/reduction_report_v1.schema.json`  
**Change**: In `reduction_map`, change `"minItems": 8` to `"minItems": 4`. Add a field:

```json
"reduction_map_completeness": {
  "enum": ["exhaustive", "partial"],
  "default": "partial",
  "description": "Whether the mapping covers all relevant variables/constraints. 'exhaustive' asserts all load-bearing correspondences are listed."
}
```

Add `"reduction_map_completeness"` to `required`.

### P8. `schemas/novelty_delta_table_v1.schema.json` — Add closest prior summaries

**File**: `schemas/novelty_delta_table_v1.schema.json`  
**Change**: Replace `closest_prior_uris` with a structured array:

```json
"closest_priors": {
  "type": "array",
  "minItems": 1,
  "items": {
    "type": "object",
    "required": ["uri", "summary"],
    "properties": {
      "uri": { "type": "string", "format": "uri" },
      "summary": { "type": "string", "minLength": 1 }
    },
    "additionalProperties": false
  }
}
```

Update `required` from `closest_prior_uris` to `closest_priors`.

### P9. `schemas/failed_approach_v1.schema.json` — Add `node_ids` for tree traceability

**File**: `schemas/failed_approach_v1.schema.json`  
**Change**: Add:

```json
"node_ids": {
  "type": "array",
  "items": { "type": "string", "format": "uuid" },
  "description": "Node IDs in the search tree that represent this failed approach (for provenance tracing)."
}
```

### P10. `docs/plans/2026-02-12-idea-generator-architecture-spec.md` — Clarify budget check granularity within a tick

**File**: `docs/plans/2026-02-12-idea-generator-architecture-spec.md`  
**Change**: In §2.3 (search.step tick semantics), after "tick 原子性（必须）", add:

> **Budget check granularity（必须）**：预算检查必须发生在 tick 边界（而非 tick 内部的 role 调用之间）。一个已开始执行的 tick 必须完成或整体回滚后，campaign 才能转换为 `exhausted`。这保证 tick 原子性不被预算检查打断为 partial state。

### P11. `docs/plans/2026-02-12-idea-generator-architecture-spec.md` — Clarify `TechniqueTransplant` audit pathway

**File**: `docs/plans/2026-02-12-idea-generator-architecture-spec.md`  
**Change**: In §4.2.1 (Grounding Audit Gate), item 6 (reduction_audit), after "通常来自 `ProblemReduction`/`TechniqueTransplant`", add:

> `TechniqueTransplant` 算子如果产出的输出结构符合 `reduction_report_v1.schema.json`（即包含 `abstract_problem`、`reduction_map`、`known_solutions` 等），则**必须**以 `reduction_report` 形式写入 `IdeaNode`，从而触发 `reduction_audit` 门禁。若 `TechniqueTransplant` 的输出仅涉及方法级迁移且不涉及问题归约（无 `abstract_problem`），则不产出 `reduction_report`，但仍须通过 `grounding_audit`。

### P12. New schema needed: `schemas/abstract_problem_registry_v1.schema.json`

**File**: `schemas/abstract_problem_registry_v1.schema.json` (new file)  
**Content**:

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "abstract_problem_registry_v1.schema.json",
  "title": "AbstractProblemRegistry v1",
  "description": "DomainPack registry of abstract problem types for ProblemReduction validation.",
  "type": "object",
  "minProperties": 1,
  "additionalProperties": {
    "type": "object",
    "required": ["description", "known_solution_families", "prerequisite_checklist", "reference_uris"],
    "properties": {
      "description": { "type": "string", "minLength": 1 },
      "known_solution_families": {
        "type": "array", "minItems": 1,
        "items": { "type": "string", "minLength": 1 }
      },
      "prerequisite_checklist": {
        "type": "array", "minItems": 1,
        "items": { "type": "string", "minLength": 1 }
      },
      "reference_uris": {
        "type": "array", "minItems": 1,
        "items": { "type": "string", "format": "uri" }
      }
    },
    "additionalProperties": false
  }
}
```

This is referenced by the arch spec §7 and load-bearing for `reduction_audit.reduction_type_valid`.
