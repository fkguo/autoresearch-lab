VERDICT: READY

## Blockers
None. The architecture is rigorous, the schemas are consistent, and the safety gates (idempotency, budget fuses, clean-room eval) are well-designed for high-stakes research agents.

## Non-blocking
1.  **Schema Filename/Usage Mismatch**: `campaign_topup_result_v1.schema.json` is used as the return type for `pause`, `resume`, and `complete`. It should be renamed to `campaign_mutation_result_v1.schema.json` to reflect its generic usage as a state-change receipt.
2.  **Idempotency Snapshot Semantics**: For `campaign.topup` (and other mutations), the spec requires replaying the "same logical response." It should be explicitly clarified that the `campaign_status` inside a replayed response must be the **snapshot at the time of the original mutation**, not the current wall-clock status (which might have changed via subsequent ops). This ensures strict "receipt" semantics.

## Real-research fit
- **Clean-room Evaluation**: The `EvaluatorConfig.clean_room` default (True) is excellent for preventing "echo chambers" in multi-agent discussions.
- **Novelty Delta Table**: The structured `novelty_delta_table` in `IdeaNode` is a standout feature. It forces the agent to explicitly classify innovation (e.g., "new_observable" vs. "relabeling_only"), which is crucial for HEP phenomenology.
- **Grounding Audit**: The active resolution check for `evidence_uris` before promotion is the correct defense against hallucinated citations.

## Robustness & safety
- **Budget Circuit Breakers**: The tiered budget model (Global Envelope + Local Step Fuse) prevents runaways.
- **Strict Idempotency**: The requirement to deduplicate side-effects by `(method, campaign_id, idempotency_key)` allows safe network retries without duplicating resource usage.
- **State Machine**: The transitions for `exhausted` $\to$ `running` (conditional on effective top-up) prevent zombie loops.

## Specific patch suggestions

### 1. Rename TopUp Result Schema for Generic Usage
**File:** `schemas/campaign_topup_result_v1.schema.json` -> `schemas/campaign_mutation_result_v1.schema.json`
*Action: Rename the file and update `title`.*

```json
{
  "$id": "campaign_mutation_result_v1.schema.json",
  "title": "CampaignMutationResult v1",
  ...
}
```

### 2. Update RPC References to Renamed Schema
**File:** `schemas/idea_core_rpc_v1.openrpc.json`
*Action: Update `$ref` in `campaign.topup`, `campaign.pause`, `campaign.resume`, `campaign.complete`.*

```json
// Find lines referencing "./campaign_topup_result_v1.schema.json" and replace with:
"schema": { "$ref": "./campaign_mutation_result_v1.schema.json" }
```

### 3. Clarify Idempotency Snapshot Semantics
**File:** `schemas/idea_core_rpc_v1.openrpc.json`
*Action: Append to the `info.description` idempotency section.*

```text
...
3) On duplicate, engine MUST return the same logical response as the first call (result or error), without repeating side-effects. The response MUST include idempotency metadata (idempotency_key + is_replay); is_replay MUST be true on duplicate hits and false on first execution. All other fields MUST match the first response.
+ For mutation methods returning campaign status, the replayed response MUST contain the status snapshot from the original execution time, not the current status.
4) Idempotency records ...
```
