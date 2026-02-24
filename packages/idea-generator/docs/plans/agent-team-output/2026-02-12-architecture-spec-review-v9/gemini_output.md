VERDICT: READY

## Blockers
*None identified.* The specifications are coherent, the schemas are syntactically valid (assuming standard JSON Schema Draft 2020-12), and the strictness aligns with the safety requirements.

## Non-blocking
1.  **Formalism ID Constraints**: The regex `^[a-z0-9_]+\/[a-z0-9_.-]+$` forbids hyphens in the namespace (e.g., `hep-ph/sm` would fail). Given that `hep-ph` and `hep-th` are standard identifiers, this should be relaxed.
2.  **RPC Error Codes**: `campaign.init` declares `budget_exhausted` as a possible error. Since `init` establishes the budget envelope and usage starts at zero, this error is logically unreachable unless the engine performs an external "account-level" check (which is outside the scope of `idea-core`'s campaign containment).
3.  **Schema Strictness**: `IdeaNode` schema defines `operator_trace.inputs` and `params` as generic objects. While flexible, enabling `additionalProperties: true` explicitly (or defining a "blackboard" schema) would signal intent better than relying on the default.

## Real-research fit
- **Community Metaphor**: Mapping "Teams/Roles" to physical agents (Librarian, Checker, etc.) is excellent. It models the actual social division of labor in theoretical physics and prevents "LLM as God" hallucinations by compartmentalizing the "Formalizer" and "Checker" roles.
- **Folklore Management**: Explicitly modeling `folklore_risk` and requiring a "Novelty Delta Table" directly addresses the primary failure mode of AI in science: generating correct but trivial/well-known results.
- **Explain-Then-Formalize**: The separation of `RationaleDraft` (Stage 1, high temp) and `IdeaCard` (Stage 2, strict schema) matches the cognitive flow of "blackboard sketch" → "Draft paper".

## Robustness & safety
- **Budget Fuses**: The mandatory `BudgetEnvelope` (global) combined with optional `step_budget` (local) and `BudgetSnapshot` observability provides a robust double-safety layer against runaway loops.
- **Idempotency**: The requirement for `idempotency_key` on all side-effecting RPCs, combined with strict replay rules, ensures that network retries or orchestration crashes won't corrupt the campaign state or duplicate artifacts.
- **Provenance**: `IdeaNode` immutability + DAG lineage is the correct approach for auditability.

## Specific patch suggestions

### 1. Relax Formalism ID Pattern
Allow hyphens in the namespace to support `hep-ph`, `cond-mat`, etc.

**Files**: `schemas/formalism_registry_v1.schema.json`, `schemas/idea_card_v1.schema.json`
```diff
- "pattern": "^[a-z0-9_]+\\/[a-z0-9_.-]+$",
+ "pattern": "^[a-z0-9_-]+\\/[a-z0-9_.-]+$",
```

### 2. Cleanup `campaign.init` Errors
Remove the illogical budget error from initialization.

**File**: `schemas/idea_core_rpc_v1.openrpc.json`
```diff
       "result": { "name": "campaign_init_result", "schema": { "$ref": "#/components/schemas/CampaignInitResultV1" } },
       "errors": [
-        { "code": -32001, "message": "budget_exhausted" },
         { "code": -32002, "message": "schema_validation_failed" },
         { "code": -32010, "message": "invalid_charter" }
       ]
```

### 3. Explicit Flexible Trace Params
Document intent for operator flexibility.

**File**: `schemas/idea_node_v1.schema.json`
```diff
         "inputs": { "type": "object" },
         "params": { "type": "object" },
+        "additionalProperties": true,
         "random_seed": { "type": "integer" },
```
```

### 4. Ensure `grounding_audit` in `node.promote`
The spec text mentions `node.promote` must fail if `grounding_audit != pass`. The OpenRPC defines `grounding_audit_failed` error (-32011). To be safe, add this requirement to the schema description for `node.promote` or the `PromotionResult` to reinforce that `handoff_artifact_ref` is only yielded on success.

**File**: `schemas/promotion_result_v1.schema.json`
```diff
     "handoff_artifact_ref": { "type": "string", "format": "uri" },
+    "description": "URI to the C2 handoff artifact. MUST be present if promotion succeeds.",
     "formalism_check": {
```
