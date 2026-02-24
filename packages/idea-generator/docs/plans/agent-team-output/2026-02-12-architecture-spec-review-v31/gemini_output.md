VERDICT: READY

## Blockers
*None identified.* The specifications are exceptionally complete, with rigorous state machine constraints encoded directly in JSON Schema `allOf` clauses and clear idempotency contracts.

## Non-blocking
1. **Idempotency Key Scope for `campaign.init`**: The spec correctly notes `campaign.init` lacks a `campaign_id` scope. Ensure the implementation's idempotency store indexes these by `(method='campaign.init', idempotency_key)` globally (or per-user), distinct from the `(campaign_id, ...)` scoped index.
2. **`node.promote` Mutation Semantics**: The spec implies `node.promote` is a gate check. If the audit is stale or missing, it fails. It does *not* explicitly state that `promote` triggers a re-audit. This is safer (read-only gate), but implies the user must run `eval.run` (with grounding enabled) or `search.step` (with checkers) *before* attempting promotion. This workflow dependency should be documented clearly in the integration guide.
3. **Trace Context**: The RPC lacks an explicit `trace_id` or `traceparent` parameter for distributed tracing (OpenTelemetry). While `idempotency_key` helps correlation, a standard trace header/field is recommended for the adapter layer.

## Real-research fit
1. **Fermi Estimation**: The `estimated_compute_hours_log10` in `IdeaCard` is a perfect fit for theoretical physics scoping (orders of magnitude matter more than precise hours).
2. **Folklore Risk**: Explicitly modeling `folklore_risk` and requiring `novelty_delta_table` directly addresses the common "reinventing the wheel" failure mode in AI science agents.
3. **Support Types**: Distinguishing `llm_inference` vs `calculation` vs `expert_consensus` in claims provides the necessary granularity for an "Evidence-First" system.

## Robustness & safety
1. **Schema-Encoded State Machine**: The `campaign_mutation_result` schema using `if/then` to enforce valid state transitions (e.g., `pause` only allowed from `running|early_stopped|exhausted`) is a brilliant defense-in-depth pattern.
2. **Budget Fuses**: The separation of `step_budget` (local fuse) and `campaign.status` (global envelope) prevents runaway costs effectively.
3. **Idempotency Hashing**: The `payload_hash` requirement (RFC 8785) prevents the "confused deputy" replay attack where a key is reused with different parameters.

## Specific patch suggestions

`schemas/idea_core_rpc_v1.openrpc.json`:
- **Change**: In `campaign.topup` description, clarify the `running` transition condition slightly to avoid ambiguity about "no longer budget-exhausted".
- **Current**: "...successful topup MUST transition campaign status to running only if the campaign is no longer budget-exhausted..."
- **Suggested**: "...successful topup MUST transition campaign status to 'running' IF AND ONLY IF all BudgetEnvelope dimensions have `remaining > 0` after the top-up. If any dimension remains `<= 0` (and is not unbounded), status MUST remain 'exhausted'."

`schemas/idea_node_v1.schema.json`:
- **Change**: `updated_at` description.
- **Current**: "Timestamp of last mutation (e.g., eval_info update, grounding re-audit)."
- **Suggested**: "Timestamp of last mutation. MUST be updated by the engine whenever `revision` is incremented."

`schemas/search_step_result_v1.schema.json`:
- **Change**: Add explicit `step_budget_snapshot`?
- **Current**: Returns `budget_snapshot` (global).
- **Suggested**: Keep as is. Global is more important for the circuit breaker. `degradation_events` covers the local context.
