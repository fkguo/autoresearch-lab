VERDICT: READY

## Blockers
None. The bundle is architecturally sound and the schema refinements for auditability are well-implemented.

## Non-blocking
- **Self-contained Replay**: In `distributor_event_v1`, `rng_alg` is optional. To guarantee self-contained replay without chasing the `distributor_policy_config`, it should ideally be required if `rng_seed_used` is present.
- **Filter Expressiveness**: `idea_list_filter_v1` added `has_eval_info`, but as campaigns grow, filtering for "nodes needing re-formalization" (i.e., `has_idea_card=true` but `grounding_status=partial`) will become common; the current schema supports this via composition, but a combined `needs_grounding_audit` flag might be a useful future addition.

## Real-research fit
- **Mathematical Reduction Priority**: The emphasis on `ProblemReduction` and `TechniqueTransplant` operators is a high-leverage move for HEP. Theoretical breakthroughs often come from identifying that a physical bottleneck is isomorphic to a solved mathematical or CS problem (e.g., mapping amplitude structures to positive geometries).
- **Folklore Risk**: The `A0-folklore` gate and `folklore_risk_score` correctly address the "shadow literature" problem in physics—ideas that are "in the air" or known to be dead ends but not formally documented in a single arXiv paper.

## Robustness & safety
- **Idempotency Rigor**: The requirement for JCS (RFC 8785) canonicalization and `payload_hash` verification is excellent. This prevents the "hidden state" bugs common in agentic workflows where a slight change in an optional parameter causes non-deterministic branching during a retry.
- **Promotion Blocking**: The `partial` status for `reduction_audit` (triggered by pending verification or skipped toy checks) is a robust safety valve. It allows the graph to grow with "optimistic" reductions while strictly gating the handoff to the `C2` (Method Design) phase.

## Specific patch suggestions

### 1. `schemas/distributor_event_v1.schema.json`
**Change**: Enforce `rng_alg` presence if a seed is logged to ensure replayability.
```json
// Add to allOf in schemas/distributor_event_v1.schema.json
{
  "if": { "required": ["rng_seed_used"] },
  "then": { "required": ["rng_alg"] }
}
```

### 2. `schemas/idea_scorecards_v1.schema.json`
**Change**: Clarify that `failed` scorecards must still provide failure modes to the distributor for "negative reward" learning.
```json
// Update description for "status=failed" in scorecards items
"description": "Completeness marker for scores: ... failed=no usable scores (rank.compute MUST ignore when computing observed_keys; distributor MUST treat as high-penalty negative reward)."
```

### 3. `schemas/reduction_audit_v1.schema.json`
**Change**: Tighten the `partial` logic to ensure `failures` is populated if `toy_check_result` is `skipped` without a clear `skip_reason`. (Actually, the schema already requires `skip_reason` when `skipped`, so this is just a documentation suggestion).
**Update `$comment`**:
```text
// Change:
... either any pending_verification OR toy_check_result=skipped) => status=partial.
// To:
... either any pending_verification OR toy_check_result=skipped) => status=partial (promotion-blocking).
```
