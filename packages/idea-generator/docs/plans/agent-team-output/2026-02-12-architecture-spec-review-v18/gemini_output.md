VERDICT: READY

## Blockers
None. The architecture, schema definitions, and RPC logic are internally consistent, cover the "evidence-first" and "idempotency" requirements strictly, and are ready for implementation.

## Non-blocking
- **Error Granularity (`node.promote`)**: Currently, attempting to promote a node that lacks an `IdeaCard` (i.e., still in `RationaleDraft` stage) would likely fall under `-32002 schema_validation_failed` (since the node state doesn't match the "promotable" schema). A dedicated error code `-32016 node_state_invalid` would be semantically clearer for clients than a generic schema error.
- **`updated_at` enforcement**: `IdeaNode` marks `updated_at` as optional, but also states `idea_card` is mutable. It is recommended that the engine *must* set `updated_at` whenever `idea_card` or `eval_info` is mutated, but this is an implementation detail rather than a schema blocker.

## Real-research fit
- **Novelty Deltas**: The `novelty_delta_table` in `IdeaNode` is a standout feature. By forcing the system to output `closest_prior_uris` and `delta_statement` (e.g., "new_regime"), it directly addresses the "re-inventing the wheel" problem in AI science.
- **Grounding Audit**: The strict `active resolution` requirement for `grounding_audit` (phantom reference check) is crucial for HEP.
- **Operator Families**: The distinct operators (e.g., `AnomalyAbduction`, `LimitExplorer`) map well to actual theoretical physics workflows.

## Robustness & safety
- **Idempotency**: The rigorous `(method, campaign_id, idempotency_key)` deduplication logic prevents "zombie runs" and ensures determinism in a retry-heavy environment.
- **Budget Fuses**: The multi-layer budget (Campaign `BudgetEnvelope` vs. Step `BudgetLimit` vs. `step_budget` arg) provides excellent safety against runaway inference costs.
- **Schema Contracts**: The use of `allOf` conditionals in `search_step_result_v1` (requiring artifacts if nodes are generated) and `idea_card_v1` (requiring verification plans for LLM inference) demonstrates high-quality, safety-conscious schema design.

## Specific patch suggestions

### 1. Add `node_state_invalid` error for cleaner state-machine handling

**File**: `schemas/idea_core_rpc_v1.openrpc.json`

**Change**: Add `-32016` to the errors list of `node.promote` to explicitly handle "Node exists but is not in a promotable state (e.g., missing IdeaCard)".

```json
// Inside methods[name="node.promote"].errors
{ "code": -32002, "message": "schema_validation_failed" },
{ "code": -32016, "message": "node_state_invalid" }, // <--- ADD THIS
{ "code": -32011, "message": "grounding_audit_failed" },
```

### 2. Clarify `node.promote` pre-conditions in Spec

**File**: `docs/plans/2026-02-12-idea-generator-architecture-spec.md`

**Change**: In section 2.3 (Idea Core RPC), under `node.promote`, explicitly mention the state requirement.

```markdown
<!-- Under node.promote bullet or description -->
- `node.promote`: ...
  - **Precondition**: Node MUST have a non-null `idea_card`. Promoting a raw `rationale_draft` MUST fail with `node_state_invalid` (or `schema_validation_failed` if strictly validating node schema).
```
