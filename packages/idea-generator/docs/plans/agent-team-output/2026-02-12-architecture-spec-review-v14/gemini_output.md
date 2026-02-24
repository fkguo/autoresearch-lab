VERDICT: READY

## Blockers

1.  **Missing Mutation Vector for IdeaCard**: The `idea_node_v1` schema description claims `idea_card` is `MUTABLE`, but the RPC interface (`search.step` produces new nodes, `node.promote` reads nodes) provides no method to update a node with a card.
    *   *Constraint violation*: You cannot form an IdeaCard from a RationaleDraft without either a new RPC method or violating the "new node" contract of `search.step`.
    *   *Resolution*: Enforce **Immutability**. Formalization must be an Operator that consumes a `RationaleDraft` node and produces a *new* child node (new `node_id`, same `idea_id`) containing the `IdeaCard`. This preserves the DAG lineage (`Draft -> Card`) and fits `search.step`.

## Non-blocking

1.  **Top-up Logic Trap**: The `campaign.topup` spec requires: *"MUST transition campaign status to running"*. If a campaign is exhausted on multiple dimensions (e.g., `cost` AND `steps`) and the user only tops up `cost`, the engine cannot legally transition to `running` while respecting `steps` limits.
2.  **List Utility**: `node.list` lacks a `sort` parameter. Researchers will frequently need `sort: "created_desc"` (monitoring) or `sort: "rank_desc"` (review), otherwise pagination is arbitrary.

## Real-research fit

- **Provenance Architecture**: The separation of `RationaleDraft` (Stage 1) and `IdeaCard` (Stage 2) maps perfectly to the "Notebook -> Preprint" mental model of physicists.
- **Novelty Enforcement**: The `novelty_delta_table` structure in `IdeaNode` is a critical defense against "parameter scanning masquerading as theory," a common failure mode in automated science.
- **Idempotency Replay**: Forcing `search.step` (an LLM-based non-deterministic op) to replay *stored results* on duplicate calls is the only way to ensure `idea-core` remains a deterministic state machine for the Orchestrator.

## Robustness & safety

- **Budget Fuses**: The hierarchy of Global (`BudgetEnvelope`) vs. Local (`step_budget`) fuses is correctly designed to prevent "runaway thought loops" from draining project funds.
- **Grounding Gate**: The requirement for *active* URI resolution (not just regex validation) in `grounding_audit` is essential for preventing hallucinated citations.

## Specific patch suggestions

### 1. Fix IdeaCard Immutability (`schemas/idea_node_v1.schema.json`)

Change the description to enforce DAG-based formalization.

```diff
<<<<
  "description": "A single candidate node in the ideation search space, with lineage, traces, diagnostics, and optional formalized IdeaCard.\n\nMutability contract (audit-first): Fields campaign_id, idea_id, node_id, parent_node_ids, island_id, operator_id, origin, operator_trace, rationale_draft, created_at are IMMUTABLE after creation. Fields idea_card, eval_info, grounding_audit, updated_at are MUTABLE (append/replace semantics; prior values should be preserved in the ledger or history artifacts).",
====
  "description": "A single candidate node in the ideation search space, with lineage, traces, diagnostics, and optional formalized IdeaCard.\n\nMutability contract (audit-first): Fields campaign_id, idea_id, node_id, parent_node_ids, island_id, operator_id, origin, operator_trace, rationale_draft, idea_card, created_at are IMMUTABLE after creation. Formalization (adding an IdeaCard) MUST be achieved by creating a child node. Fields eval_info, grounding_audit, updated_at are MUTABLE (append/replace semantics) to support asynchronous evaluation.",
>>>>
```

### 2. Relax Top-up Transition (`schemas/idea_core_rpc_v1.openrpc.json`)

Allow the engine to remain exhausted if the top-up is insufficient.

```diff
<<<<
      "description": "Monotonic, additive budget top-up. Permitted when campaign status is running|paused|early_stopped|exhausted. If status is exhausted, successful topup MUST transition campaign status to running. If the campaign is completed, the engine MUST reject the request with campaign_not_active.",
====
      "description": "Monotonic, additive budget top-up. Permitted when campaign status is running|paused|early_stopped|exhausted. If status is exhausted, successful topup transitions campaign status to running ONLY IF all budget constraints are satisfied. If limits remain exceeded (e.g., steps topped up but cost still exhausted), status remains exhausted. If the campaign is completed, the engine MUST reject the request with campaign_not_active.",
>>>>
```

### 3. Add Sort to List (`schemas/idea_core_rpc_v1.openrpc.json`)

```diff
<<<<
        { "name": "filter", "schema": { "$ref": "./idea_list_filter_v1.schema.json" } },
        { "name": "cursor", "schema": { "type": "string", "minLength": 1 } },
====
        { "name": "filter", "schema": { "$ref": "./idea_list_filter_v1.schema.json" } },
        { "name": "sort", "schema": { "enum": ["created_desc", "created_asc", "rank_desc", "rank_asc"], "default": "created_desc" } },
        { "name": "cursor", "schema": { "type": "string", "minLength": 1 } },
>>>>
```
