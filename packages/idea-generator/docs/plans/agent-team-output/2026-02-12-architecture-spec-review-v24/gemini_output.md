VERDICT: READY

## Blockers
*(None)*

## Non-blocking
1.  **Observability gap in `eval.run`**: `eval.run` is a side-effecting operation that mutates `IdeaNode`s (appending `eval_info`), but `EvalResult` does not return `updated_node_ids`. Clients (like the adapter) cannot efficiently invalidate caches or know which nodes were successfully annotated without re-fetching all target IDs.
2.  **Budget top-up ambiguity**: The behavior of `campaign.topup` on dimensions that were originally unbounded (e.g., `max_steps=null` in `BudgetEnvelope`) is undefined. (e.g., does `add_steps: 10` change `null` to `10`, `null`, or error?).

## Real-research fit
1.  **Novelty Delta Table**: The structured novelty assertion (`delta_statement` + `verification_hook` + `non_novelty_flags`) is a high-value addition for preventing "simulated innovation" common in LLM loops.
2.  **Grounding Audit**: Active resolution checks (`active lookup`) are essential for HEP. This spec correctly identifies that regex-validation of citations is insufficient.
3.  **Formalism Registry**: The explicit mapping to C2 compilers via `formalism_id` ensures the "idea" is not just text, but a verifiable protocol entry point.

## Robustness & safety
1.  **Idempotency Hashing**: The requirement for `payload_hash` verification in `schemas/idea_core_rpc_v1.openrpc.json` (Error data contract 2c) significantly reduces the risk of dangerous replay due to client-side key reuse bugs.
2.  **Budget Fuses**: The separation of `step_budget` (local fuse) from `BudgetEnvelope` (global fuse) allows safe "one-more-step" exploration without risking the entire campaign's quota.

## Specific patch suggestions

### 1. Add mutation visibility to `EvalResult`
**File**: `schemas/eval_result_v1.schema.json`
**Change**: Add `updated_node_ids` to the required properties to mirror `SearchStepResult`. This allows clients to track which nodes received new `eval_info`.

```json
  "required": ["campaign_id", "node_ids", "updated_node_ids", "scorecards_artifact_ref", "budget_snapshot", "idempotency"],
  "properties": {
    ...
    "updated_node_ids": {
      "type": "array",
      "items": { "type": "string", "format": "uuid" },
      "description": "IDs of nodes that were mutated (e.g., eval_info appended) during this operation."
    },
    ...
  }
```

### 2. Clarify Top-Up Semantics for Unbounded Dimensions
**File**: `schemas/budget_topup_v1.schema.json`
**Change**: Add a description note to clarify that top-ups on unbounded dimensions are no-ops or rejected.

```json
  "description": "Monotonic budget top-up request... Note: If a dimension was originally unbounded (null in BudgetEnvelope), providing a top-up value for it is undefined (SHOULD be treated as a no-op or rejected by engine). Top-up only increases existing finite limits.",
```

### 3. Surface `updated_node_ids` in RPC Spec
**File**: `schemas/idea_core_rpc_v1.openrpc.json`
**Change**: Update `eval.run` result description to mention the mutation tracking.

```json
    {
      "name": "eval.run",
      ...
      "result": { "name": "eval_result", "schema": { "$ref": "./eval_result_v1.schema.json" } },
      "description": "... Persists eval_info into IdeaNodes. Returns updated_node_ids to indicate which nodes were successfully annotated..."
    }
```
