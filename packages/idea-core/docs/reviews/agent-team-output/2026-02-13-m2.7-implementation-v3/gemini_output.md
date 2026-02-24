VERDICT: READY

## Blockers
None. The implementation covers all specified M2.7 requirements and constraints.

## Non-blocking
*   **Missing explicit test case for `source_artifact` validation**: The `_validate_formalization_trace` function explicitly checks `formalization.get("source_artifact") != "rationale_draft"`. While the logic is present and likely covered by broader schema validation, an explicit unit test case for this specific failure scenario would improve test coverage and clarity.

## Real-research fit
The M2.7 implementation significantly enhances the integrity and auditability of the research process by enforcing provenance during the `node.promote` step. By ensuring that `IdeaCard` formalization originates from a `RationaleDraft` via a deterministic process and validating its hash, it directly supports:
*   **Reproducibility**: Researchers can trace back the origin of a promoted idea to its initial rationale and verify its transformation.
*   **Transparency**: The explicit formalization mode (`explain_then_formalize_deterministic_v1`) makes the formalization process clear and auditable.
*   **Reliability**: Preventing promotion of ill-formed or unverified `IdeaCard`s (missing `idea_card`, invalid trace, hash mismatch) improves the quality of promoted research artifacts.
*   **Idempotency**: The robust idempotency mechanism ensures consistent behavior and prevents unintended side effects, which is critical for long-running research campaigns and robust infrastructure.

## Robustness & safety
The implementation demonstrates strong robustness and safety features:
*   **Idempotency**: Thoroughly implemented and tested, preventing duplicate side effects and correctly handling conflicts, which is crucial for a reliable RPC service.
*   **Strict Validation**: The `_validate_formalization_trace` function performs detailed checks on the formalization trace, including its existence, structure, mode, source artifact, and hash matching. This prevents invalid or unproven `IdeaCard`s from being promoted.
*   **Schema Error Model**: Uses the existing `RpcError` with detailed error data (`schema_validation_failed`, `reason`, `details`) for validation failures, providing clear diagnostics.
*   **Atomic Operations**: The use of `self.store.mutation_lock(campaign_id)` ensures that mutations to the campaign state are atomic, preventing race conditions.
*   **Error Handling**: Catches `RpcError` during validation and stores it for idempotency, ensuring consistent error responses.
*   **No Contract Drift**: The review confirms that the scope is limited to M2.7 and does not introduce M2.8+/M3+ expansions or contract drift, maintaining system stability.

## Specific patch suggestions
None for M2.7 core functionality. The implementation is solid. A non-blocking suggestion would be to add an explicit test case for `test_node_promote_fails_when_formalization_source_artifact_not_rationale_draft` to cover the `source_artifact` check in `_validate_formalization_trace`.
