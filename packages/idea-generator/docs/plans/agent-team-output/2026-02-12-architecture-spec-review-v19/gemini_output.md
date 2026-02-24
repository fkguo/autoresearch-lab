VERDICT: READY

## Blockers
None. The specifications and schemas are strictly consistent, implementing the "Explain-Then-Formalize" and "Evidence-First" workflows with precise machine-enforceable contracts.

## Non-blocking
1.  **Error Granularity**: `node.promote` fails if `idea_card` is null, but currently this would likely fall under a generic `schema_validation_failed`. Explicitly defining `idea_card_missing` as a known error reason would improve client UX.
2.  **Formalism Registry Pattern**: The regex validation in `idea_card_v1` (`^[a-z0-9_-]+\\/[a-z0-9_.-]+$`) is a good syntax check, but the runtime check against `formalism_registry` (via `node.promote`) is where the semantic safety lies. This split is appropriate.

## Real-research fit
-   **Provenance**: The `origin` and `operator_trace` fields in `IdeaNode` provide excellent auditability for scientific claims.
-   **Grounding**: The explicit `grounding_audit` with `folklore_risk_score` and `failures` array directly addresses the "hallucinated citation" problem in LLM-for-Science.
-   **Constraint**: The `support_type`-conditional validation in `IdeaCard` (requiring `verification_plan` for inference vs `evidence_uris` for literature) perfectly maps to how physicists validate theoretical vs cited claims.

## Robustness & safety
-   **Idempotency**: The `(method, campaign_id, idempotency_key)` deduplication logic, combined with the `payload_hash` verification, prevents the most dangerous class of errors (accidental replay with stale parameters).
-   **Budget Fuses**: The multi-level budget controls (global envelope + `campaign.topup` + local `search.step` fuse) ensure the agent cannot drain resources in a runaway loop.
-   **State Machine**: The `campaign.status` transitions are exhaustively defined, including the critical `exhausted -> topup -> running` edge case.

## Specific patch suggestions

### 1. Explicit Error Reason for Missing IdeaCard
Add `idea_card_missing` to the known error reasons to disambiguate "promotion failed because node is raw" vs "promotion failed because card content is invalid".

**File:** `schemas/idea_core_rpc_v1.openrpc.json`
```json
// Locate "x-error-data-contract" -> "known_reasons" -> "-32002"
// Change from:
"-32002": ["schema_invalid", "idempotency_key_conflict", "elo_config_required", "elo_config_unexpected"]
// To:
"-32002": ["schema_invalid", "idempotency_key_conflict", "elo_config_required", "elo_config_unexpected", "idea_card_missing"]
```

**File:** `schemas/rpc_error_data_v1.schema.json`
```json
// Locate "properties" -> "reason" -> "description"
// Append "idea_card_missing" to the list of example values.
"description": "Machine-readable sub-reason (string). Example values include: schema_invalid, idempotency_key_conflict, elo_config_required, elo_config_unexpected, idea_card_missing."
```

**File:** `schemas/idea_core_rpc_v1.openrpc.json` (Method: `node.promote`)
```json
// Update description to explicitly mention the check
"description": "Side-effecting. Only permitted when campaign status is running; otherwise campaign_not_active. Requires node.idea_card to be non-null (otherwise schema_validation_failed with error.data.reason=idea_card_missing).",
```
