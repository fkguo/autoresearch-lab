VERDICT: READY

## Blockers
*None identified.* The architecture spec and schema bundle provide a coherent, machine-enforceable foundation for the `idea-generator`. The separation of `idea-core` (standalone engine) from the `hepar` skill adapter is correctly defined via the OpenRPC contract.

## Non-blocking
1.  **Provenance Granularity**: While `operator_id` tracks *what* function ran, and `island_id` tracks the strategy context, the `IdeaNode.origin` schema lacks an explicit `role` field (e.g., "Ideator", "Librarian", "Critic"). Capturing the "Physicist Role" in the immutable artifact is crucial for diagnosing which agent personas are hallucinating vs. performing well, without coupling the core logic to the team topology.
2.  **Formalism Registry Sync**: The runtime enforcement of `candidate_formalisms` (checking if IDs exist in the registry) is an application-level constraint. The schema only validates the string pattern. This is acceptable for v0.2 but requires the `idea.promote` implementation to be rigorous about loading the registry.
3.  **Novelty Verification**: The `verification_hook` in `novelty_delta_table` is a string. In v0.3, this should likely become a structured object (e.g., `{ "type": "calculate_observable", "target": "..." }`) to allow automated follow-up.

## Real-research fit
The architecture demonstrates high alignment with HEP theoretical workflows:
*   **Explain-Then-Formalize**: This explicitly mirrors the "blackboard → LaTeX" workflow, preventing premature optimization of formalism before physical intuition is settled.
*   **Novelty Delta Table**: The `non_novelty_flags` (e.g., `equivalent_reformulation`) directly address the "salami slicing" publication problem common in mature fields like HEP.
*   **Grounding Audit**: The distinction between `llm_inference` (needs verification plan) and `data/literature` (needs URI) is the correct epistemological standard for AI-assisted science.

## Robustness & safety
*   **Circuit Breaking**: The `BudgetEnvelope` passed to `search.step` and `eval.run` ensures cost/time containment at the atomic operation level.
*   **Append-Only Logic**: The spec emphasizes an append-only `IdeaStore` (implied by `IdeaNode` immutability and `trace` fields), which is essential for reproducibility.
*   **Hallucination Containment**: The `grounding_audit` gate prior to promotion prevents "phantom citations" from leaking into downstream C2 systems.

## Specific patch suggestions

### 1. Add `role` to `IdeaNode` provenance
To fully realize the auditability of the "Physicist Community" model.

**File:** `schemas/idea_node_v1.schema.json` (and update `schemas/idea_core_rpc_v1.openrpc.json` to match)

```json
// Inside "properties" -> "origin" -> "properties"
"role": {
  "type": "string",
  "description": "The specific physicist role (e.g. 'Ideator', 'Librarian') that generated this node. Decouples capability from persona.",
  "minLength": 1
},
// Add "role" to "required" list in "origin"
```

### 2. Strengthen `novelty_delta_table` verification
Make the hook explicit to prevent vague promises.

**File:** `schemas/idea_node_v1.schema.json` (and OpenRPC copy)

```json
// Inside "eval_info" -> "novelty_delta_table" -> "items" -> "properties" -> "verification_hook"
"verification_hook": {
  "type": "string",
  "minLength": 10,
  "description": "Concrete, falsifiable test for this specific delta (e.g. 'Calculate Gamma(H->bb) deviation > 5%')."
}
```

### 3. Expose `role` in `SearchStepResult` island states (Optional)
To help the orchestrator visualize which roles are active on an island.

**File:** `schemas/island_state_v1.schema.json`

```json
// Add to "properties"
"active_roles": {
  "type": "array",
  "items": { "type": "string" },
  "description": "List of roles currently active or assigned to this island."
}
```
