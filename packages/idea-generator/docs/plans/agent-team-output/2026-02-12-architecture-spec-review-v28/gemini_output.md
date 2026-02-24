VERDICT: READY

## Blockers
*None.* The architecture specification and schemas are coherent, self-consistent, and meet the machine-enforceability requirements for a robust v0.2 implementation.

## Non-blocking
1.  **Mutation Audit Asymmetry (`eval.run` vs `search.step`)**:
    *   `search.step` returns `updated_nodes_artifact_ref` pointing to a `NodeMutationLog`, providing a strict audit trail of *what* changed (e.g., `revision` bump, `idea_card` added).
    *   `eval.run` modifies nodes (updates `eval_info`, increments `revision`) but only returns `scorecards_artifact_ref`. While the scorecard is the *source* of the data, the *fact* of the node mutation (and its new revision number) is not logged in a widely accessible artifact like `NodeMutationLog`.
    *   *Impact:* Slight reduction in "ledger completeness" for `eval` operations compared to `search` operations.
2.  **Budget Top-up on Unbounded Dimensions**:
    *   The spec correctly notes that topping up an unbounded dimension is undefined. Implementations must handle this gracefully (reject or no-op). This is a potential implementation pitfall but the spec warning is sufficient.

## Real-research fit
1.  **`novelty_delta_table` (Excellent)**: The explicit requirement to categorize innovation (e.g., `new_mechanism` vs `parameter_tuning_only`) and provide a "delta statement" directly addresses the "salami slicing" problem in academic publishing.
2.  **`grounding_audit` Gate**: The requirement for active URI resolution (no phantom citations) and strict checking against `formalism_registry` ensures that promoted ideas are actually compatible with downstream C2 systems (FeynRules/FormCalc), avoiding "paperware" theoretical models.
3.  **Clean-room + Debate**: The `evaluator_config` supporting `clean_room` by default aligns perfectly with rigorous peer review standards.

## Robustness & safety
1.  **Idempotency & Replay**: The specification for `(method, campaign_id, idempotency_key)` deduplication is rigorous. The requirement to replay the *first* response (including stale snapshots) while forcing clients to check `campaign.status` for current state is the correct distributed systems approach.
2.  **Campaign Isolation**: The requirement that read/write operations must check `node_not_in_campaign` prevents cross-talk between concurrent research runs, which is critical when running multiple explorations on shared infrastructure.
3.  **Circuit Breakers**: Global (BudgetEnvelope) and Local (`step_budget`) fuses provide dual-layer protection against runaway LLM costs.

## Specific patch suggestions

### 1. Unified Mutation Logging (`schemas/eval_result_v1.schema.json`)
To make `eval.run` as auditable as `search.step`, add an optional mutation log reference.

```diff
--- schemas/eval_result_v1.schema.json
+++ schemas/eval_result_v1.schema.json
@@ -16,6 +16,11 @@
       "items": { "type": "string", "format": "uuid" },
       "description": "IDs of nodes that were mutated (e.g., eval_info appended) during this operation. MUST be set-equal to node_ids on success."
     },
+    "updated_nodes_artifact_ref": {
+      "type": "string",
+      "format": "uri",
+      "description": "Optional artifact ref for a bounded diff/changelog of mutations applied (e.g. revision bump, eval_info update). Conforms to schemas/node_mutation_log_v1.schema.json."
+    },
     "scorecards_artifact_ref": { "type": "string", "format": "uri" },
     "budget_snapshot": { "$ref": "./budget_snapshot_v1.schema.json" },
     "idempotency": { "$ref": "./idempotency_meta_v1.schema.json" }
```

### 2. Allow `NodeMutationLog` to be Step-Agnostic (`schemas/node_mutation_log_v1.schema.json`)
If we use `NodeMutationLog` for `eval.run`, `step_id` might not apply (or should refer to the eval operation ID).

```diff
--- schemas/node_mutation_log_v1.schema.json
+++ schemas/node_mutation_log_v1.schema.json
@@ -6,9 +6,9 @@
   "$comment": "Stub schema (v0.2): intended to back updated_nodes_artifact_ref in SearchStepResult. Keep it small and append-only; consumers should treat it as a hint for what to refetch and as an audit record of mutations.",
   "type": "object",
-  "required": ["campaign_id", "step_id", "generated_at", "mutations"],
+  "required": ["campaign_id", "generated_at", "mutations"],
   "properties": {
     "campaign_id": { "type": "string", "format": "uuid" },
-    "step_id": { "type": "string", "format": "uuid" },
+    "step_id": { "type": "string", "format": "uuid", "description": "Optional reference to the search step that caused these mutations. May be omitted for eval-driven mutations." },
     "generated_at": { "type": "string", "format": "date-time" },
     "mutations": {
```
