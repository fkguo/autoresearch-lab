VERDICT: READY

## Blockers
*None identified.* The specifications are rigorous, self-consistent, and enforce the required safety/idempotency properties via schema and protocol contracts.

## Non-blocking
1.  **`eval.run` Mutation Visibility**: `eval.run` mutates nodes (adding `eval_info`) but unlike `search.step`, it does not return a "mutation log" artifact ref. It returns `scorecards_artifact_ref`. Clients must imply the node state change from the scorecards or re-fetch nodes. This is acceptable for v0.2 but slightly asymmetric with `search.step`.
2.  **Pareto Artifact Schema**: `rank.compute(method="pareto")` returns `ranking_result_v1`, which includes `ranking_artifact_ref`. The schema for the file at this URI is not explicitly defined (unlike `IdeaTournament` for Elo). Implicitly it is likely a JSON dump of the `RankingResult` or just the `ranked_nodes` list.
3.  **`IdeaNode` Promotion State**: `IdeaNode` has no internal flag indicating it has been promoted. `node.promote` creates a handoff artifact. If called multiple times with different idempotency keys, it might create multiple handoffs. This is managed by the `IdeaSelection` ledger (which tracks `selected_node_ids`), so it is safe, but the node itself remains unaware of its "graduated" status.

## Real-research fit
-   **Methodology Mapping**: The `DomainPack` formalism registry (`formalism_registry_v1`) correctly decouples the generic "generator" from specific C2 compilers (e.g., FeynRules vs. S-Matrix elements).
-   **Novelty Hygiene**: The `novelty_delta_table` in `IdeaScorecards` (and `IdeaNode.eval_info`) with specific "non-novelty flags" (e.g., `relabeling_only`) is a crucial addition for suppressing "LLM fluff".
-   **Grounding**: The explicit `grounding_audit` in `IdeaNode` and the promotion gate requirements ensure provenance is checked before handoff.

## Robustness & safety
-   **Idempotency**: The `(method, campaign_id, idempotency_key)` scoping with `payload_hash` validation in OpenRPC is excellent. It prevents "blind retries" from executing different intents.
-   **Budget Fuses**: The "Step budget fuse" in `search.step` combined with global `BudgetEnvelope` provides necessary dual-layer protection (micro vs macro).
-   **State Machine**: The clear distinction between `exhausted` (budget) and `early_stopped` (policy) in `campaign_status_v1` prevents logic errors during `topup`.

## Specific patch suggestions

### 1. Clarify Pareto Artifact Schema
**File:** `schemas/ranking_result_v1.schema.json`
**Change:** explicit description of `ranking_artifact_ref` content for Pareto.

```diff
<<<<
    "ranking_artifact_ref": { "type": "string", "format": "uri" }
====
    "ranking_artifact_ref": {
      "type": "string",
      "format": "uri",
      "description": "URI to the persisted ranking record. For method='elo', points to an IdeaTournament (idea_tournament_v1.json). For method='pareto', points to a JSON dump of this RankingResult (or a dedicated pareto_front_v1.json)."
    }
>>>>
```

### 2. Explicit Content Contract for `search.step` Artifacts
**File:** `schemas/search_step_result_v1.schema.json`
**Change:** explicitly link artifact refs to their schema types in description.

```diff
<<<<
    "new_nodes_artifact_ref": { "type": "string", "format": "uri" },
    "updated_node_ids": {
====
    "new_nodes_artifact_ref": {
      "type": "string",
      "format": "uri",
      "description": "URI to a JSONL file containing the full snapshots of created nodes (conforming to schemas/idea_node_v1.schema.json)."
    },
    "updated_node_ids": {
>>>>
```

### 3. Add `promoted_at` to `IdeaNode` (Optional but recommended)
**File:** `schemas/idea_node_v1.schema.json`
**Change:** Add optional `promoted_at` to tracking properties to allow self-contained status checks.

```diff
<<<<
    "updated_at": {
      "type": "string",
      "format": "date-time",
      "description": "Timestamp of last mutation (e.g., eval_info update, grounding re-audit)."
    }
  },
====
    "updated_at": {
      "type": "string",
      "format": "date-time",
      "description": "Timestamp of last mutation (e.g., eval_info update, grounding re-audit)."
    },
    "promoted_at": {
      "type": "string",
      "format": "date-time",
      "description": "Optional timestamp if this node has been successfully promoted via node.promote. Managed by the engine."
    }
  },
>>>>
```
