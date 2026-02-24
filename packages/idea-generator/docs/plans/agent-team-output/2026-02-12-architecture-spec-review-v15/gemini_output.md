VERDICT: READY

## Blockers
*None identified.* The specifications and schemas are coherent, complete enough for v0.2, and enforce the "evidence-first" constraints strictly.

## Non-blocking
1.  **RPC/Schema Naming Hygiene**: `schemas/campaign_topup_result_v1.schema.json` is used as the generic result for `pause`, `resume`, and `complete`. Its title is `CampaignMutationResult`, which is correct, but the filename is specific to `topup`. This invites confusion.
2.  **IdeaCard Mutability Ambiguity**: `IdeaNode` docs declare `idea_card` as MUTABLE, but there is no explicit `node.update` RPC. Implicit mutation likely occurs via `eval.run` (updating `verification_status`) or `search.step` (populating the card on a *new* node). Explicitly clarifying *who* mutates `idea_card` (internal engine vs. agent) would help implementers.
3.  **Evaluator Config**: `evaluator_config_v1` allows `weights` for dimensions, but `EvaluatorConfig.dimensions` is an array of enums. Ensure the engine validation correlates the keys in `weights` to the active `dimensions`.

## Real-research fit
*   **High**. The "Explain-Then-Formalize" (Rationale -> IdeaCard) separation is excellent for physics, allowing intuition to precede formalism.
*   **Provenance**: The `origin` and `operator_trace` fields in `IdeaNode`, combined with `evidence_uris` in claims, provide the necessary audit trail for scientific assertions.
*   **Role Topology**: The `Physicist Community` concept (Librarian/Formalizer/Checker) maps well to real research workflows and provides a clear path for "clean-room" validation.

## Robustness & safety
*   **Idempotency**: The `(method, campaign_id, idempotency_key)` deduplication strategy is strictly defined and covers all side-effecting operations.
*   **Budget Fuses**: The multi-layer budget (global `BudgetEnvelope` + local `search.step(step_budget)`) prevents runaway costs.
*   **Isolation**: The requirement for campaign-scoped lookups in `node.get`/`node.promote` prevents data leakage between concurrent experiments.

## Specific patch suggestions

### 1. Rename Mutation Result Schema
Use a generic name to match the schema title and usage (`pause`/`resume`/`complete` use this, not just `topup`).

**Action**: Rename `schemas/campaign_topup_result_v1.schema.json` → `schemas/campaign_mutation_result_v1.schema.json`.

**Update**: `schemas/idea_core_rpc_v1.openrpc.json`
```json
// Change 4 occurrences of "$ref": "./campaign_topup_result_v1.schema.json"
// To:
"$ref": "./campaign_mutation_result_v1.schema.json"
```

### 2. Clarify IdeaNode Mutability
In `schemas/idea_node_v1.schema.json`:

```diff
- "description": "A single candidate node... Fields idea_card, eval_info, grounding_audit, updated_at are MUTABLE (append/replace semantics; prior values should be preserved in the ledger or history artifacts).",
+ "description": "A single candidate node... Fields eval_info and grounding_audit are MUTABLE (via eval.run or internal audit). Field idea_card is MUTABLE (typically populated via search.step or internal formalization processes; verification_status may be updated by evaluation). Fields campaign_id, ... are IMMUTABLE.",
```

### 3. Campaign Init Schema Ref
In `schemas/idea_core_rpc_v1.openrpc.json` (inside `campaign.init`):

```diff
// Ensure formalism_registry is optional as per spec logic (override behavior)
{
  "name": "formalism_registry",
  "schema": { "$ref": "./formalism_registry_v1.schema.json" },
- "required": false
+ "required": false,
  "description": "Override or supplement..."
}
```
// (The JSON is technically valid, just confirming strict alignment with text)
```
