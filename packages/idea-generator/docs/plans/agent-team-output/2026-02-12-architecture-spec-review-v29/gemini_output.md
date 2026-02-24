VERDICT: READY

## Blockers
*   None. The architecture is solid, schemas are well-structured, and the OpenRPC contract is rigorous regarding idempotency and error handling.

## Non-blocking
*   **RPC Response Blowout Risk**: `rank.compute` returns `ranking_result`, which includes `ranked_nodes` (an array). If a campaign has 10k nodes, this response will be huge (MBs), potentially timing out the RPC transport, even though the full data is persisted in `ranking_artifact_ref`.
*   **Node Workflow Tagging**: `IdeaNode` lacks a mutable `metadata` or `extensions` field. There is currently no place to store workflow flags like "promoted", "deferred", or "flagged_for_human" directly on the node (without abusing `eval_info`).
*   **Mutation Observability Asymmetry**: `search.step` returns a mutation log reference (`updated_nodes_artifact_ref`), but `eval.run` (which also mutates nodes) does not. This is acceptable for v0.2 because `eval.run` returns a `scorecards` artifact which implicitly contains the updates, but consistent "mutation log" patterns would be cleaner in v1.0.

## Real-research fit
*   **High**: The "Explain-Then-Formalize" flow (`RationaleDraft` → `IdeaCard`) mirrors the actual theoretical physics process (intuition → calculation).
*   **Idempotency**: The rigorous hashing of payloads (`sha256(JCS(...))`) is excellent for preventing "phantom retries" in expensive GPU-based search steps.
*   **Provenance**: The `grounding_audit` gate and `origin`/`trace` fields provide the necessary chain-of-custody for scientific claims.

## Robustness & safety
*   **Budget Fuses**: The hierarchy of Global Envelope (`campaign.init`) vs Local Fuse (`step_budget`) is correctly designed to prevent "runaway agents".
*   **Schema Strictness**: Using `additionalProperties: false` in core schemas prevents "data stuffing" and drift.

## Specific patch suggestions

### 1. Protect `rank.compute` from response explosion
Add a `limit` parameter to the RPC method to control the size of the inline `ranked_nodes` list (the full results are still in the artifact).

**File**: `schemas/idea_core_rpc_v1.openrpc.json`
**Change**: Add `limit` parameter to `rank.compute`.

```json
        {
          "name": "limit",
          "schema": { "type": "integer", "minimum": 1, "default": 100 },
          "required": false,
          "description": "Max number of top-ranked items to return in the RPC response inline list (ranked_nodes). Full results are always written to ranking_artifact_ref."
        },
```

### 2. Allow extensible tags on `IdeaNode`
Match the pattern of other artifacts by adding a mutable `extensions` field.

**File**: `schemas/idea_node_v1.schema.json`
**Change**: Add `extensions` to properties and the mutable list description.

```json
    "extensions": {
      "type": "object",
      "description": "Mutable user-defined metadata (e.g., workflow tags, UI flags).",
      "additionalProperties": true
    }
```

*And update the description text:*
`"Fields revision, idea_card, eval_info, grounding_audit, updated_at, extensions are MUTABLE..."`

### 3. Enforce `schema_validation_failed` error data in OpenRPC
The `x-error-data-contract` is defined but not explicitly linked in the `errors` definition for `-32002`. While the top-level info mentions it, explicit documentation helps generators. (Optional/Minor).
