VERDICT: READY

## Blockers
- None. The implementation strictly adheres to the M2.6 goals, maintaining schema integrity and idempotency while providing a clean path for future operator expansion.

## Non-blocking
- **Parent Node Selection:** `_pick_parent_node` currently uses a fixed deterministic strategy (oldest node). While this satisfies M2.6 requirements, it may cause the search to stall on initial seeds during long `search.step` calls. Consider adding a round-robin or score-based selection strategy in future milestones to ensure broader search tree exploration.
- **Operator Trace Redundancy:** The `trace_inputs` in `operators.py` (e.g., `parent_node_id`, `step_id`) duplicate fields already present in the `IdeaNode` lineage. This is acceptable for immediate auditing but could be refactored for efficiency as the number of operators grows.
- **Hardcoded Support Type:** In `service.py`, `_build_operator_node` hardcodes the claim `support_type` as `"calculation"`. Operators should ideally define their own support types (e.g., `literature` for bridge expansion) in `OperatorOutput`.

## Real-research fit
- **Provenance:** The implementation of `OperatorOutput` with `evidence_uris_used` and `claim_text` provides the necessary hooks for real-world HEP research evidence tracking.
- **Formalism Anchoring:** By passing `formalism_id` to operators via `OperatorContext`, the system ensures that generated ideas are theoretically grounded in the campaign's registered frameworks (e.g., `hep/toy`).
- **Downstream Compatibility:** The successful smoke test (`search.step` -> `eval.run` -> `rank.compute` -> `node.promote`) confirms that generated nodes are robust enough for the full discovery lifecycle.

## Robustness & safety
- **Schema Enforcement:** Every new node is validated against `idea_node_v1.schema.json` before being committed to the store, preventing "corrupt" ideas from entering the population.
- **Idempotency Guardrails:** The enhanced `_prepared_side_effects_committed` check for `search.step` correctly verifies the existence of both the step artifact and the newly created nodes, ensuring atomic-like behavior across RPC retries.
- **Budgeting:** The dual accounting of `steps_used` and `nodes_used` in both `search.step` local budget and global campaign usage ensures strict resource control.

## Specific patch suggestions
- No urgent patches required. The current implementation is a solid foundation for the M2.7 (Explain-Then-Formalize) milestone.
