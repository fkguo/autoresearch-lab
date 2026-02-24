VERDICT: READY

## Blockers
(None)

## Non-blocking
1.  **IdeaNode Nullability Ergonomics**: In `schemas/idea_node_v1.schema.json`, the mutable fields `idea_card`, `eval_info`, and `grounding_audit` are defined as nullable (`oneOf: [null, object]`) but are not in the `required` list. This creates ambiguity between "field missing" and "field is null". For strict client generation (Rust/Go) and explicit state tracking, it is better to require these keys to be present (even if value is `null`).
2.  **Default Value Determinism**: In `schemas/search_step_result_v1.schema.json`, `early_stopped` has a default of `false`. JSON Schema `if/then` validation logic can vary by implementation regarding default values. It is safer to make `early_stopped` a required field to ensure the `allOf` conditional validation for `early_stop_reason` always triggers deterministically.

## Real-research fit
The architecture strongly supports high-integrity HEP workflows:
- **Novelty Delta Table**: The structured `closest_prior` + `delta_statement` requirement (in `idea_node_v1` / `eval_info`) effectively counters "salami slicing" and rhetorical novelty, forcing substantive comparison.
- **Formalism Registry**: The requirement that `candidate_formalisms` map to a declared registry (checked at `node.promote`) ensures that ideas are not just text, but are C2-compatible method specs.
- **Grounding Audit**: The separation of `support_type` (e.g., `llm_inference` vs `data`) and the mandatory `verification_plan` for non-grounded claims provides a realistic path for AI-augmented speculation.

## Robustness & safety
- **Idempotency Protocol**: The `payload_hash` check in the OpenRPC contract (and error data schema) provides excellent defense against "accidental key reuse" and "copy-paste" errors.
- **Budget Fuse**: The `step_budget` parameter in `search.step` is a critical safety mechanism for preventing runaway costs in automated loops.
- **Schema Hygiene**: Consistent use of `additionalProperties: false` and strict types ensures the artifact contract is machine-enforceable.

## Specific patch suggestions

**1. Enforce explicit nulls in `IdeaNode` for state clarity**
File: `schemas/idea_node_v1.schema.json`
Action: Add mutable nullable fields to the `required` array.

```json
  "required": [
    "campaign_id",
    "idea_id",
    "node_id",
    "parent_node_ids",
    "island_id",
    "operator_id",
    "origin",
    "operator_trace",
    "rationale_draft",
    "idea_card",       // <-- Add
    "eval_info",       // <-- Add
    "grounding_audit", // <-- Add
    "created_at"
  ],
```

**2. Make `early_stopped` required to harden conditional validation**
File: `schemas/search_step_result_v1.schema.json`
Action: Add `early_stopped` to `required` array and remove `"default": false`.

```json
  "required": [
    "campaign_id",
    "step_id",
    "n_steps_requested",
    "n_steps_executed",
    "new_node_ids",
    "island_states",
    "budget_snapshot",
    "idempotency",
    "early_stopped" // <-- Add
  ],
  "properties": {
    "early_stopped": { "type": "boolean" }, // <-- Remove default
    ...
  }
```
