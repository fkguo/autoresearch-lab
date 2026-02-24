VERDICT: READY

## Blockers
*None. The architecture is coherent, the schemas are valid Draft 2020-12, and the RPC contract is strictly typed.*

## Non-blocking
1.  **Fat Node Payloads (Scalability)**: `idea_node_v1` currently *embeds* `rationale_draft` and `idea_card` via `$ref`. As campaigns grow (hundreds of nodes), `node.list` will return massive payloads.
    *   *Recommendation*: Modify schema to allow `rationale_draft` and `idea_card` to be either the embedded object OR a `string` (URI). This allows the engine to offload heavy text to artifacts and return lightweight nodes.
2.  **`campaign.init` Idempotency Storage Scope**: The spec mandates idempotency records be "retained for the campaign lifetime". However, `campaign.init` creates the campaign. If the idempotency record is stored *inside* the campaign, a retried `init` (which has no campaign ID yet) cannot check for duplicates effectively unless there is a pre-campaign/global idempotency index.
    *   *Recommendation*: Explicitly require a "Global or User-Session Idempotency Store" for `campaign.init` calls, distinct from the campaign-scoped store used for other methods.

## Real-research fit
1.  **Step Latency**: `search.step` is a blocking RPC call that may involve LLM generation + tool use (potentially minutes).
    *   *Observation*: Ensure the client (hepar skill) uses an appropriate timeout (e.g., 5-10m) or that the engine implements `search.step` with frequent internal yield points if moving to an async transport later. For `stdio`, blocking is acceptable but requires the user to be patient.
2.  **Claim Granularity**: `idea_card_v1` structure (`claims[]` with `support_type` and `evidence_uris`) is excellent. It forces the model to distinguish between "I derived this" (`calculation`) and "Standard Model says" (`literature`).

## Robustness & safety
1.  **Hallucination Containment**: The `grounding_audit` in `idea_node_v1` combined with the `node.promote` gate (`code -32011`) is a strong firewall. It prevents unverified hallucinations from leaking into C2.
2.  **Budget Fuses**: The hierarchy of `BudgetEnvelope` (global) vs `BudgetLimit` (step-local) is correct and necessary for preventing "infinite loop" token drains in a single runaway step.

## Specific patch suggestions

### 1. Allow URI references in `idea_node_v1` (Payload Hygiene)
**File**: `schemas/idea_node_v1.schema.json`
**Change**: Allow `rationale_draft` and `idea_card` to be URIs.

```json
// ... inside properties ...
"rationale_draft": {
  "oneOf": [
    { "$ref": "rationale_draft_v1.schema.json" },
    { "type": "string", "format": "uri", "description": "URI to the rationale draft artifact." }
  ]
},
"idea_card": {
  "oneOf": [
    { "$ref": "idea_card_v1.schema.json" },
    { "type": "string", "format": "uri", "description": "URI to the idea card artifact." },
    { "type": "null" }
  ]
},
// ...
```

### 2. Clarify Idempotency Scope for `init`
**File**: `schemas/idea_core_rpc_v1.openrpc.json`
**Change**: Update the info description.

```json
// ... inside info.description ...
"description": "... 4) Idempotency records for campaign-scoped methods MUST be retained for the campaign lifetime. Idempotency records for 'campaign.init' MUST be retained in a global or user-session scope to ensure valid deduplication of creation requests."
```

### 3. Fix missing `support_type` validation for specific evidence
**File**: `schemas/idea_card_v1.schema.json`
**Change**: The current schema requires `evidence_uris` for `literature` etc. Add `minItems: 1` to `evidence_uris` in the definition itself to default to "evidence required" or strengthen the `if/then` logic.
*Current state is actually fine (it puts `minItems: 1` in the `then` block), but adding a description to `evidence_uris` clarifies intent.*

```json
// ... inside claims.items.properties.evidence_uris ...
"evidence_uris": {
  "type": "array",
  "items": { "type": "string", "format": "uri" },
  "description": "Required for literature, data, calculation, expert_consensus support types."
}
```
