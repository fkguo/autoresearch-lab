VERDICT: READY

## Blockers
*None identified.* The artifacts provided represent a comprehensive, logically consistent, and auditable specification that meets the high bar for an "evidence-first" research system.

## Non-blocking
*   **Budget Top-up Flexibility**: `schemas/budget_topup_v1.schema.json` uses `exclusiveMinimum: 0` for cost/time. This requires automated clients to explicitly *omit* keys if they calculate a zero increment (e.g., `add_cost_usd: 0.0` when only adding tokens), which requires extra conditional logic in the client. `minimum: 0` (allowing no-op) is generally more robust for generated payloads.
*   **Idempotency & Defaults**: The requirement that "engine SHOULD apply default-value filling... before hashing" for idempotency checks places a hidden dependency on the client knowing the engine's exact defaults to predict the `payload_hash` or avoid conflicts. This is acceptable for v1 but strict client-side explicit arguments are safer long-term.
*   **Node Promotion Re-entrancy**: The spec does not explicitly forbid calling `node.promote` multiple times on the same node with *different* idempotency keys. While likely harmless (producing multiple handoff artifacts), the system might prefer to treat promotion as a state transition that returns the existing artifact if already promoted.

## Real-research fit
*   **Provenance**: The `IdeaNode` -> `IdeaCard` -> `Claim` -> `EvidenceURI` chain is excellent. Forcing `verification_plan` for LLM inferences is a critical safeguard against hallucinated physics.
*   **Clean-room Eval**: The `evaluator_config` supporting `clean_room: true` and structured `debate_threshold` maps well to preventing "groupthink" in AI agent swarms.
*   **Novelty vs. Folklore**: The explicit `folklore_risk_score` and `novelty_delta_table` directly address the common failure mode where AI "rediscovers" standard textbook exercises as novel insights.

## Robustness & safety
*   **Budget Fuses**: The multi-layer budget (Campaign global + Step local) provides necessary safety against runaway agent loops.
*   **Schema Strictness**: The `oneOf` logic in `IdeaCard` (forcing evidence OR verification plan) is a strong usage of JSON Schema to enforce research discipline.
*   **Observability**: `search.step` returning both `budget_snapshot` and `island_states` ensures the orchestrator never flies blind.

## Specific patch suggestions

### 1. Relax Budget Top-up Constraints for Client Ease
Allow `0` in top-up fields to simplify client logic (identity operation).

**File**: `schemas/budget_topup_v1.schema.json`
**Change**:
```diff
- "add_cost_usd": { "type": "number", "exclusiveMinimum": 0 },
- "add_wall_clock_s": { "type": "number", "exclusiveMinimum": 0 },
+ "add_cost_usd": { "type": "number", "minimum": 0 },
+ "add_wall_clock_s": { "type": "number", "minimum": 0 },
```

### 2. Explicitly Bind Mutation Log Schema
Ensure `updated_nodes_artifact_ref` in `search.step` result is clearly typed for consumers.

**File**: `schemas/search_step_result_v1.schema.json`
**Change**:
```diff
     "updated_nodes_artifact_ref": {
       "type": "string",
       "format": "uri",
-      "description": "Artifact ref for a bounded diff/changelog of mutations applied to updated_node_ids (e.g., idea_card added, eval_info updated). Intended to point to an artifact conforming to schemas/node_mutation_log_v1.schema.json."
+      "description": "Artifact ref for a bounded diff/changelog of mutations applied to updated_node_ids. MUST point to a JSON artifact conforming to schemas/node_mutation_log_v1.schema.json."
     },
```

### 3. Clarify Handoff Schema Contract
Ensure the `formalism_check` logic in the handoff schema matches the RPC error behavior (redundancy is good here, but explicit is better).

**File**: `schemas/idea_handoff_c2_v1.schema.json`
**Change**:
```diff
     "formalism_check": {
       "type": "object",
       "required": ["status", "missing_formalisms"],
       "properties": {
         "status": { "const": "pass" },
-        "missing_formalisms": { "type": "array", "items": { "type": "string" }, "maxItems": 0 }
+        "missing_formalisms": { 
+          "type": "array", 
+          "items": { "type": "string" }, 
+          "maxItems": 0,
+          "description": "Must be empty for a passed formalism check."
+        }
       },
```
