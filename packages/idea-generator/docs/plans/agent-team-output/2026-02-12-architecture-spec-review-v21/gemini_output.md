VERDICT: READY

## Blockers

*   None identified. The specifications and schemas are rigorous, self-consistent, and effectively enforce the architectural constraints (idempotency, campaign scoping, auditability).

## Non-blocking

*   **`search.step` Mid-flight Exhaustion**: The current spec implies `budget_exhausted` (-32001) is returned if the budget runs out. For expensive operations like `search.step` (which might produce 3 nodes then hit the limit), returning a hard error discards valuable partial work (the 3 nodes). It is better to treat mid-flight exhaustion as a **partial success** (`early_stopped=true`, `early_stop_reason=budget_exhausted`) returning the nodes created so far, rather than a JSON-RPC error.
*   **`node.list` Deterministic Sort**: To ensure `cursor`-based pagination is robust and replayable, the spec should explicitly mandate the sort order (e.g., `created_at ASC` + `node_id` tie-break). Without a defined sort, database implementation differences could break cursor stability.
*   **RPC Error Data Refinement**: `rpc_error_data_v1` is excellent, but adding `payload_hash` to `idempotency_key_conflict` errors specifically would heavily aid debugging (proving to the client *why* the server rejected the key).

## Real-research fit

*   **Evidence-First**: The `IdeaCard` schema's `claims[].evidence_uris` and `support_type` structure is excellent for HEP. It forces the distinction between "literature says X" and "LLM infers Y".
*   **Novelty Hygiene**: The `novelty_delta_table` in `IdeaNode` (closest prior, delta statement, non-novelty flags) is a critical addition to prevent "hallucinated novelty" common in LLM science agents.
*   **Formalism Registry**: The explicit mapping of `formalism_id` to C2 validators (`schemas/formalism_registry_v1.schema.json`) ensures that the `idea-generator` doesn't just output text, but outputs *compilable* methods.

## Robustness & safety

*   **Idempotency**: The detailed 4-point idempotency contract (especially separating `idempotency_key` from payload hash) is industry-standard and prevents "double-spend" of research budget.
*   **Campaign Isolation**: strict scoping rules on `node.*` methods prevent cross-contamination of research contexts.

## Specific patch suggestions

### 1. Robustness: Prefer Partial Success for `search.step` Exhaustion

In `schemas/idea_core_rpc_v1.openrpc.json`, update the `search.step` description to favor `early_stopped` over strict errors for mid-execution limits.

```json
// schemas/idea_core_rpc_v1.openrpc.json

// Change this description in "search.step":
"description": "Side-effecting. ... If exhausted: budget_exhausted."

// To this (more robust):
"description": "Side-effecting. ... If the global or step budget is exhausted BEFORE execution starts, return budget_exhausted (-32001). If budget is exhausted DURING execution (partial progress), the engine MUST return a successful result with early_stopped=true, early_stop_reason='budget_exhausted', and include any nodes/artifacts created prior to exhaustion (partial success)."
```

### 2. Determinism: Define `node.list` Sort Order

In `schemas/idea_core_rpc_v1.openrpc.json`, constrain `node.list`.

```json
// schemas/idea_core_rpc_v1.openrpc.json

// Add to "node.list" description:
"description": "Read-only. ... Callers MUST paginate until cursor is null. To ensure cursor stability, the engine MUST return results sorted deterministically (e.g., by created_at ASC, with node_id as tie-breaker)."
```

### 3. Debugging: Add `payload_hash` to Error Data

In `schemas/rpc_error_data_v1.schema.json`, ensure `payload_hash` is highlighted for conflicts.

```json
// schemas/rpc_error_data_v1.schema.json

// Update "payload_hash" description:
"description": "Optional echo of computed payload_hash. RECOMMENDED when reason='idempotency_key_conflict' to prove mismatch against the stored record."
```
