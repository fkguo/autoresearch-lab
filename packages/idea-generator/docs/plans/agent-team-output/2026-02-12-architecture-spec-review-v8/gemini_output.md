VERDICT: NOT_READY

## Blockers

1.  **Immutable Budget Envelope (The "Pilot-then-Scale" Trap)**
    - **Issue:** `campaign.init` sets the global `BudgetEnvelope` (max cost/tokens/steps), but there is no RPC method to update or extend these limits. If a campaign hits `budget_exhausted` (error -32001), it enters a terminal state.
    - **Why it blocks:** Research workflows are iterative. Users typically run a low-budget pilot ($1), validate results, then inject more budget ($100) to scale. The current architecture forces a hard stop or a campaign restart, losing the context/lineage.
    - **Requirement:** A `campaign.update` method or similar mechanism to increase the budget caps on an existing campaign.

2.  **`search.step` Missing Budget Constraints**
    - **Issue:** The `search.step` method summary claims to "Advance the search by a *bounded step budget*", but the parameters only include `n_steps`.
    - **Why it blocks:** A single "step" (especially with `n_candidates` or complex operators) can theoretically consume an arbitrary amount of the global campaign budget if not capped. Orchestrators need to say "Run 1 step, but do not spend more than $2 now" to prevent a runaway agent from draining the entire project wallet in one hallucinated loop.

## Non-blocking

1.  **`IdeaNode` List Weight**: `node.list` returns an array of full `IdeaNode` objects. If `rationale_draft` or `eval_info` grows large (tens of KB), fetching a list of 50 nodes could return megabytes of JSON.
    - *Suggestion:* Add a `view` parameter (`summary` vs `full`) to `node.list`, or introduce `IdeaNodeSummary` for list operations.

2.  **`estimated_compute_hours_log10` Precision**: In `IdeaCard`, this is a raw number.
    - *Suggestion:* While technically fine, bounding this (e.g., -5 to +15) in schema adds a sanity check against parsing errors (e.g. "1000" instead of "3" for log scale).

3.  **Missing `node.update` for Human-in-the-loop**: The architecture mentions an "Editor" role or "human operator" refining ideas. Currently, the only way to "update" a node seems to be internal engine logic or `eval.run` (which updates scores). There is no explicit RPC for a human to patch a `rationale_draft` typo or fix a `formalism_id` before promotion.

## Real-research fit

- **Strong:** The "Explain-Then-Formalize" two-stage artifact flow is excellent for physics. It allows creative "hand-waving" (Abduction) while enforcing strict rigor before the expensive C2/Compute phase.
- **Strong:** The `delta_statement` and `closest_prior` in `eval_info` directly address the "salami slicing" problem in academic publishing.
- **Gap:** The lack of budget extensibility (Blocker #1) is the primary friction point for real-world usage where "grant renewal" (budget injection) is a standard lifecycle event.

## Robustness & safety

- **Scoping:** The requirement for `campaign_id` scoping in RPC is critical. The design text mandates it, but the implementation must ensure `node_id` lookups are strictly filtered by the provided `campaign_id` to prevent cross-contamination.
- **Idempotency:** The pervasive use of `idempotency_key` in the OpenRPC is excellent and essential for reliable distributed orchestration.

## Specific patch suggestions

### 1. Add `campaign.update` to `schemas/idea_core_rpc_v1.openrpc.json`

Allow the orchestrator to raise the budget limits for a campaign.

```json
{
  "name": "campaign.update",
  "summary": "Update campaign configuration, specifically to extend budget limits.",
  "params": [
    { "name": "campaign_id", "schema": { "type": "string", "minLength": 1 }, "required": true },
    { 
      "name": "budget_update", 
      "schema": { "$ref": "#/components/schemas/BudgetEnvelopeV1" },
      "description": "New budget envelope. Non-null fields overwrite existing limits. (e.g. increase max_cost_usd). To implement 'top-up', caller calculates current_used + additional_amount."
    },
    { "name": "idempotency_key", "schema": { "type": "string", "minLength": 1 }, "required": true }
  ],
  "result": { "name": "campaign_status", "schema": { "$ref": "#/components/schemas/CampaignStatusV1" } },
  "errors": [
    { "code": -32003, "message": "campaign_not_found" }
  ]
}
```

### 2. Add `step_budget` to `search.step` in `schemas/idea_core_rpc_v1.openrpc.json`

Align implementation with the "bounded step budget" description.

```json
// Inside "methods": [ { "name": "search.step", "params": [ ...
{
  "name": "step_budget",
  "schema": { "$ref": "#/components/schemas/BudgetEnvelopeV1" },
  "description": "Optional budget limit strictly for this step execution. If exhausted, the step halts even if the global campaign budget remains. Acts as a 'local fuse'."
}
```

### 3. Update `schemas/idea_core_rpc_v1.openrpc.json` (Method: `campaign.init`)

Fix strict `required` boolean for optional parameters (OpenRPC spec).

```json
// In "params" for campaign.init
{
  "name": "formalism_registry",
  "schema": { "$ref": "#/components/schemas/FormalismRegistryV1" },
  "description": "...",
  "required": false  // Explicitly mark as optional
}
```
