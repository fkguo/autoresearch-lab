VERDICT: READY

## Blockers
*None identified.* The architecture provides a solid, machine-enforceable foundation. The strict separation of `idea-core` via JSON-RPC/OpenRPC and Artifact Contracts is excellent for independent testing and modularity.

## Non-blocking
1.  **Ranking RPC Scalability**: `rank.compute` returns `ranked_nodes` inline. For long campaigns (>1000 nodes), this payload will become unwieldy or timeout.
    *   *Mitigation*: Added a `top_n` parameter in the patch to limit the inline response, relying on `ranking_artifact_ref` for the full dataset.
2.  **Node Score Observability**: `IdeaNode` objects contain `eval_info` (diagnostics) but not the numeric `scores` (which live in `scorecards` artifacts). This means `node.get` alone is insufficient to render a "scored card" UI; one must fetch the artifact or run `rank.compute`. This is acceptable for "Evidence-First" (source of truth is the artifact) but slightly inconvenient for UI.
3.  **Idempotency Error Precision**: The spec maps idempotency key conflicts to `-32002 (schema_validation_failed)`. While correct (contract violation), a dedicated error code (e.g., `-32005`) would make client-side debugging of retry logic easier.

## Real-research fit
1.  **`RationaleDraft.analogy_mapping`**: Explicitly modeling "source/target/mapping" is a high-value feature for theoretical physics (e.g., AdS/CFT mappings), matching how theorists actually work.
2.  **`IdeaCard.minimal_compute_plan`**: The log10-scale `estimated_compute_hours_log10` is a pragmatic choice for early-stage estimation where precision is impossible.
3.  **Grounding Audit**: enforcing `active lookup` for `evidence_uris` before promotion is crucial. It prevents the "hallucinated bibliography" problem common in LLM science agents.

## Robustness & safety
1.  **Budget Fuse**: The explicit `step_budget` in `search.step` combined with global `CampaignStatus` checks provides a robust double-layer defense against runaway costs.
2.  **Clean-Room Evaluation**: Enforcing clean-room contexts for reviewers by default (in `EvaluatorConfig`) prevents "groupthink" cascading in the early stages.
3.  **Explicit Scoping**: The requirement for `node_not_in_campaign` checks prevents cross-contamination between parallel research runs.

## Specific patch suggestions

### 1. `schemas/idea_core_rpc_v1.openrpc.json`
**Change**: Add `top_n` parameter to `rank.compute` to prevent payload explosion.

```json
<<<<
        {
          "name": "elo_config",
          "schema": { "$ref": "./elo_config_v1.schema.json" },
          "required": false,
          "description": "Required when method=elo. MUST bound tournament cost and ensure deterministic matchups. Engine MUST return schema_validation_failed (-32002) if method=elo and elo_config is absent, or if method=pareto and elo_config is provided."
        },
        { "name": "idempotency_key", "schema": { "type": "string", "minLength": 1 }, "required": true }
      ],
      "description": "Side-effecting. Only permitted when campaign status is running; otherwise campaign_not_active. If the filter resolves to an empty node set (pareto) or fewer than 2 nodes (elo), or evaluation data is insufficient, the engine MUST return insufficient_eval_data (-32013) and MUST NOT write ranking artifacts.",
====
        {
          "name": "elo_config",
          "schema": { "$ref": "./elo_config_v1.schema.json" },
          "required": false,
          "description": "Required when method=elo. MUST bound tournament cost and ensure deterministic matchups. Engine MUST return schema_validation_failed (-32002) if method=elo and elo_config is absent, or if method=pareto and elo_config is provided."
        },
        {
          "name": "top_n",
          "schema": { "type": "integer", "minimum": 1, "default": 100 },
          "description": "Limit the number of ranked nodes returned in the inline response (default 100). The full ranking MUST always be written to ranking_artifact_ref."
        },
        { "name": "idempotency_key", "schema": { "type": "string", "minLength": 1 }, "required": true }
      ],
      "description": "Side-effecting. Only permitted when campaign status is running; otherwise campaign_not_active. If the filter resolves to an empty node set (pareto) or fewer than 2 nodes (elo), or evaluation data is insufficient, the engine MUST return insufficient_eval_data (-32013) and MUST NOT write ranking artifacts. The inline `ranked_nodes` list SHOULD be truncated to `top_n`.",
>>>>
```

### 2. `schemas/idea_node_v1.schema.json`
**Change**: Tighten `prompt_hash` and `operator_trace` hash patterns to allow potential future algo upgrades (e.g. blake3) without breaking schema, or strictly stick to sha256. The current regex `^sha256:[a-f0-9]{64}$` is very strict. Suggest loosening slightly to `^[a-z0-9-]+:[a-f0-9]+$` to be future-proof, or keep strict if sha256 is the hard standard. Keeping strict is safer for now, but adding `updated_at` description clarification.

```json
<<<<
    "updated_at": {
      "type": "string",
      "format": "date-time",
      "description": "Timestamp of last mutation (e.g., eval_info update, grounding re-audit)."
    }
====
    "updated_at": {
      "type": "string",
      "format": "date-time",
      "description": "Timestamp of last mutation (e.g., eval_info update, grounding re-audit). Engine MUST update this field on any mutable change."
    }
>>>>
```

<<<<
        "prompt_hash": { "type": "string", "pattern": "^sha256:[a-f0-9]{64}$" },
====
        "prompt_hash": { "type": "string", "pattern": "^[a-z0-9-]+:[a-f0-9]+$", "description": "e.g. sha256:..." },
>>>>
```

### 3. `docs/plans/2026-02-12-idea-generator-architecture-spec.md`
**Change**: Clarify `rank.compute` inline limit in the Spec text.

```markdown
<<<<
  - `rank.compute`
- **错误码约定**：至少包含 `budget_exhausted` / `schema_validation_failed` / `invalid_charter` / `grounding_audit_failed` / `formalism_not_in_registry` / `insufficient_eval_data` / `campaign_not_found` / `campaign_not_active` / `node_not_found` / `node_not_in_campaign`
====
  - `rank.compute` (supports `top_n` to limit inline response payload)
- **错误码约定**：至少包含 `budget_exhausted` / `schema_validation_failed` / `invalid_charter` / `grounding_audit_failed` / `formalism_not_in_registry` / `insufficient_eval_data` / `campaign_not_found` / `campaign_not_active` / `node_not_found` / `node_not_in_campaign`
>>>>
```
