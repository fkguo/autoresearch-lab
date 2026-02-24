VERDICT: READY

## Blockers
None. The architecture is rigorous, contract-driven, and correctly addresses the critical concerns of auditability, scoping, and budget control.

## Non-blocking
- **Schema Reusability**: The `eval_info` structure inside `idea_node_v1.schema.json` (containing `fix_suggestions` and `novelty_delta_table`) is quite rich. In v0.3, consider extracting this to `eval_info_v1.schema.json` so it can be referenced by the `scorecards` artifact schema without duplication. For v0.2, inline is acceptable.
- **Scorecard Persistence**: `IdeaNode` stores *diagnostics* (`eval_info`), but not raw *scores* (which live in `scorecards_artifact_ref` from `eval.run`). This is a valid "clean separation" choice, but implies that any ranking/filtering logic in the engine must efficiently join these sources or cache scores internally.
- **RPC Error Handling**: The `node.promote` method defines specific error codes for failed checks (`grounding_audit_failed`, etc.). Clients should be prepared to handle these specific negative outcomes as JSON-RPC errors rather than looking for a "success: false" field in the result object (which is only returned on success).

## Real-research fit
- **Formalism Registry**: The requirement for `candidate_formalisms` to validate against a runtime-injected `FormalismRegistry` is the "killer feature" for HEP. It prevents the generation of "pseudo-code physics" that cannot be compiled by FeynRules/FormCalc.
- **Novelty Delta**: The `novelty_delta_table` structure (forcing a choice between `new_mechanism`, `new_regime`, etc., vs `relabeling_only`) effectively operationalizes the "Referee" role, preventing the system from hallucinating novelty in trivial rewriting.
- **Grounding Audit**: The distinction between `evidence_uris` presence (syntax) and `active lookup` (semantics) in the `grounding_audit` gate is crucial for preventing "phantom citations".

## Robustness & safety
- **Idempotency**: The explicit requirement for `search.step` (a non-deterministic operation) to implement idempotency via "execute-once, store-artifact, replay-result" is the correct design for reproducible science. It ensures that a network retry doesn't spawn a parallel universe of ideas.
- **Budget Fuse**: The `step_budget` parameter in `search.step` provides necessary granular control, allowing the orchestrator to say "try to improve this idea, but stop if you spend >$1 or >5 mins", preventing infinite refinement loops.

## Specific patch suggestions

The schemas are solid. I have one minor consistency patch for `idea_card_v1.schema.json` to ensure `verification_plan` clarity, and a clarification for `idea_node_v1` description.

### 1. Clarify IdeaNode Description for `idea_id` vs `node_id`
**File**: `schemas/idea_node_v1.schema.json`
**Change**: Update `description` to explicitly state the difference, preventing implementer confusion.

```json
<<<<
  "description": "A single candidate node in the ideation search space, with lineage, traces, diagnostics, and optional formalized IdeaCard.\n\nMutability contract (audit-first): Fields campaign_id, idea_id, node_id, parent_node_ids, island_id, operator_id, origin, operator_trace, rationale_draft, created_at are IMMUTABLE after creation. Fields idea_card, eval_info, grounding_audit, updated_at are MUTABLE (append/replace semantics; prior values should be preserved in the ledger or history artifacts).",
====
  "description": "A single candidate node in the ideation search space. 'node_id' identifies this specific version/variant, while 'idea_id' identifies the persistent lineage/family of ideas. Multiple nodes may share the same idea_id (e.g., refinements). \n\nMutability contract (audit-first): Fields campaign_id, idea_id, node_id, parent_node_ids, island_id, operator_id, origin, operator_trace, rationale_draft, created_at are IMMUTABLE after creation. Fields idea_card, eval_info, grounding_audit, updated_at are MUTABLE (append/replace semantics; prior values should be preserved in the ledger or history artifacts).",
>>>>
```

### 2. Tighten `search.step` Budget Handling
**File**: `schemas/idea_core_rpc_v1.openrpc.json`
**Change**: Explicitly mention that an empty object for `step_budget` is not allowed (due to `minProperties: 1` in schema), to save developer debugging time.

```json
<<<<
          "name": "step_budget",
          "schema": { "$ref": "#/components/schemas/BudgetLimitV1" },
          "required": false,
          "description": "Optional local budget fuse for this call only. Any omitted field is treated as unbounded for that dimension. When exhausted, the engine SHOULD stop early and return early_stopped=true (recommended early_stop_reason: step_budget_exhausted) even if the global campaign budget remains."
====
          "name": "step_budget",
          "schema": { "$ref": "#/components/schemas/BudgetLimitV1" },
          "required": false,
          "description": "Optional local budget fuse for this call only. Must contain at least one limit if provided. Any omitted field is treated as unbounded for that dimension. When exhausted, the engine SHOULD stop early and return early_stopped=true (recommended early_stop_reason: step_budget_exhausted) even if the global campaign budget remains."
>>>>
```
