VERDICT: READY

## Blockers
None. The architecture is internally consistent, and the cross-disciplinary reduction gates are correctly plumbed through both the OpenRPC contract and the JSON schemas.

## Non-blocking
- **Schema SSOT Violation (Redundancy)**: `grounding_audit` and `formalism_check` objects are redefined verbatim in `idea_node_v1`, `idea_handoff_c2_v1`, and `promotion_result_v1`. Extracting these to standalone files (`grounding_audit_v1.schema.json` and `formalism_check_v1.schema.json`) would prevent maintenance drift.
- **Error Data Validation**: `rpc_error_data_v1.schema.json` currently only enforces structure for `dimension_exhausted`. It should be extended to validate the required `details` fields for `-32013` (insufficient data) and `-32016` (reduction audit failed) as specified in the OpenRPC `x-error-data-contract`.
- **Ranking Auditability**: `ranking_result_v1.schema.json` does not record the `dimensions` actually used in the computation. Including this would make the Pareto front selection transparent in the ledger.

## Real-research fit
- **Reduction Provenance**: The combination of `abstract_problem_registry_v1` and the strict `reduction_audit` gate is an excellent mechanism for safely importing techniques from mathematics and computer science into HEP.
- **Promotion Integrity**: The requirement in `idea_handoff_c2_v1` that `reduction_audit.status` must be `pass` (which in turn requires `toy_check_result == pass`) ensures that "skipped" toy checks—while allowed for intermediate exploration—correctly block the transition to expensive execution phases (C2).

## Robustness & safety
- **Atomic Rollbacks**: The engine-level requirement for atomicity in `eval.run` and `search.step` is crucial for avoiding corrupt state in the `IdeaStore`.
- **Idempotency Hashing**: The use of JCS (RFC 8785) for payload hashing in the OpenRPC contract is a best-practice choice for ensuring deterministic re-execution in distributed agent environments.

## Specific patch suggestions

### 1. `schemas/ranking_result_v1.schema.json`
Add the `dimensions` field to capture the basis of the Pareto/Elo ranking.
```json
// Add to properties
"dimensions": {
  "type": "array",
  "minItems": 1,
  "items": { "enum": ["novelty", "feasibility", "impact", "tractability", "grounding"] },
  "description": "Dimensions actually used for this ranking computation."
}
// Add to required
"required": ["campaign_id", "method", "ranked_nodes", "budget_snapshot", "idempotency", "ranking_artifact_ref", "dimensions"]
```

### 2. `schemas/rpc_error_data_v1.schema.json`
Enforce the `details` contract for insufficient eval data.
```json
// Add to allOf
{
  "if": { "properties": { "reason": { "const": "insufficient_dimensions" } }, "required": ["reason"] },
  "then": {
    "required": ["details"],
    "properties": {
      "details": {
        "type": "object",
        "required": ["required_minimum", "actual_found"],
        "properties": {
          "required_minimum": { "type": "integer" },
          "actual_found": { "type": "integer" }
        }
      }
    }
  }
}
```

### 3. `schemas/promotion_result_v1.schema.json`
Sync the strictness of `formalism_check` with the handoff schema.
```json
// Update formalism_check.properties.missing_formalisms
"missing_formalisms": {
  "type": "array",
  "maxItems": 0,
  "description": "Must be empty on success."
}
```

### 4. `docs/plans/2026-02-12-idea-generator-architecture-spec.md`
Clarify the `toy_check_result` promotion constraint in §4.2.1.
```markdown
- **归约审计（reduction_audit）**: ...
- **晋升门禁补充**: `skipped` 状态的 `toy_check_result` 虽然允许存在于审计记录中，但会导致 `reduction_audit.status` 变为 `partial`，从而根据 §2.3 规则阻塞晋升到 C2。进入 C2 必须完成实锤验证（`pass`）。
```
