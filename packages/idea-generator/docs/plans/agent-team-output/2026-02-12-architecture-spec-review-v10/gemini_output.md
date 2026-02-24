VERDICT: READY

## Blockers
None. The architecture is sound, and the RPC/schema bundle provides a robust, machine-enforceable contract for v0.2.

## Non-blocking
1.  **Ambiguity in `IdeaNode` Mutability**: The `IdeaNode` schema description lists `idea_card` as MUTABLE, but there is no RPC method to update a node's card (e.g., `node.formalize`). Given the "Evidence-first" lineage model and `search.step` being the primary generator, it is structurally cleaner if `IdeaNode` is immutable regarding its scientific content (`rationale_draft`, `idea_card`), and refinement/formalization creates *new* nodes (linked via `parent_node_ids`). I have suggested a patch to move `idea_card` to the IMMUTABLE list to align implementation with the "Refinement = New Node" pattern.
2.  **Promotion Visibility**: `node.list` currently cannot filter for "already promoted" nodes. While `node.promote` returns a result, having this state visible on the node and filterable allows hepar/users to quickly see "what's done".
3.  **Formalism Check Redundancy**: In `PromotionResult`, the `formalism_check.missing_formalisms` field is described as "Expected to be empty on success". Since failures MUST return a JSON-RPC error (`-32012`), this field in the success response is theoretically dead code, but keeping it as a confirmation of "0 missing" is acceptable for debugging.

## Real-research fit
1.  **Idempotency & Replay**: The `(method, campaign_id, idempotency_key)` deduplication strategy is critical for expensive/slow scientific steps. It ensures that network flakes don't trigger double-spending of the budget or duplicate idea forks.
2.  **Budget Fuses**: The hierarchical budget (`campaign` global envelope + `search.step` local fuse) matches the reality of LLM research where "one run away" loops can drain wallets. The explicit `degradation_order` allows the system to fail gracefully (e.g., "stop generating new islands, just finish evaluating what we have").
3.  **Grounding Audit**: Making `grounding_audit` a hard gate for promotion (and surfacing it in the node schema) effectively mitigates the "hallucinated citation" risk common in physics LLMs.

## Robustness & safety
1.  **Schema-First Contract**: `idea_core_rpc_v1.openrpc.json` combined with strict JSON Schemas is a high-robustness pattern. It allows the adapter and engine to be developed/tested in isolation.
2.  **Campaign Isolation**: The strict requirement to validate `node_id` against `campaign_id` prevents cross-campaign pollution, which is essential when running multiple parallel experiments.

## Specific patch suggestions

### 1. Align Node Mutability with Lineage Model
**File**: `schemas/idea_node_v1.schema.json`
**Change**: Move `idea_card` from MUTABLE to IMMUTABLE in the description. This clarifies that formalizing a draft creates a *new* node (preserving the draft as the parent), ensuring the lineage graph captures the evolution.

```json
<<<<
  "description": "A single candidate node in the ideation search space, with lineage, traces, diagnostics, and optional formalized IdeaCard.\n\nMutability contract (audit-first): Fields campaign_id, idea_id, node_id, parent_node_ids, island_id, operator_id, origin, operator_trace, rationale_draft, created_at are IMMUTABLE
