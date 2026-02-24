VERDICT: NOT_READY

## Blockers

1.  **Mutation Observability Gap in `search.step`**:
    - **Context**: The `IdeaNode` specification (Section 5.2 and `idea_node_v1.schema.json`) explicitly defines `idea_card` as a **MUTABLE** field to support the "Explain-Then-Formalize" workflow (Section 4). This implies that a "Formalizer" operator running within a `search.step` tick will update an existing node (adding the `IdeaCard`) rather than creating a new one.
    - **Issue**: The `search_step_result_v1.schema.json` only exposes `new_node_ids`. It lacks a field to report `updated_node_ids`.
    - **Impact**: The adapter/client cannot detect which nodes were formalized or modified during a step without aggressively polling `node.list`. This breaks the event-driven capability to detect "Formalization Complete" or "Derivation Added".

## Non-blocking

1.  **`idea_card_v1` Schema Strictness**:
    - The `required_observables` and `minimal_compute_plan` fields are `minItems: 1`. While excellent for phenomenology, this might force "filler" content for pure theory (e.g., "mathematical consistency" as an observable). *Suggestion: Keep as is for HEP-first, but document that "observable" can include theoretical consistency checks.*

2.  **Redundant `required` in `idea_card_v1`**:
    - `evidence_uris` is in the top-level `required` list, so it must always be present. The `allOf` conditional adds `minItems: 1`. This is technically correct (field must exist, can be empty if not literature-based), just slightly verbose.

## Real-research fit

- **Strong Provenance**: The `IdeaCard` schema's structure (`claims` with `support_type` + `evidence_uris` + `verification_plan`) directly addresses the "hallucination vs. evidence" problem.
- **Folklore Risk**: Explicitly modeling `folklore_risk` and `grounding_audit` in the node schema aligns perfectly with HEP community standards where "rediscovering the wheel" is a major noise source.
- **Formalism Registry**: The `FormalismRegistry` contract is a brilliant addition to ensure that generated ideas are not just text, but mappable to downstream computational tools (C2).

## Robustness & safety

- **Idempotency**: The OpenRPC spec provides an exceptionally robust `idempotency_key` contract, including payload hashing and replay rules. This is production-grade.
- **Budgeting**: The distinction between `step_budget` (local fuse) and `campaign.budget` (global envelope) is well-architected.

## Specific patch suggestions

### 1. Fix Mutation Visibility in `schemas/search_step_result_v1.schema.json`

Add `updated_node_ids` to allow tracking Formalizer/Derivation updates.

```json
<<<<
    "n_steps_executed",
    "new_node_ids",
    "island_states",
====
    "n_steps_executed",
    "new_node_ids",
    "updated_node_ids",
    "island_states",
>>>>
```

```json
<<<<
    "new_node_ids": { "type": "array", "items": { "type": "string", "format": "uuid" } },
    "new_nodes_artifact_ref": { "type": "string", "format": "uri" },
    "island_states": { "type": "array", "minItems": 1, "items": { "$ref": "./island_state_v1.schema.json" } },
====
    "new_node_ids": { "type": "array", "items": { "type": "string", "format": "uuid" } },
    "new_nodes_artifact_ref": { "type": "string", "format": "uri" },
    "updated_node_ids": {
      "type": "array",
      "items": { "type": "string", "format": "uuid" },
      "description": "IDs of existing nodes that were mutated (e.g., formalized, derivation added) during this step."
    },
    "island_states": { "type": "array", "minItems": 1, "items": { "$ref": "./island_state_v1.schema.json" } },
>>>>
```

### 2. Update RPC Spec to reflect mutation in `schemas/idea_core_rpc_v1.openrpc.json`

```json
<<<<
      "description": "Side-effecting. Only permitted when campaign status is running. Definition: one search step is one SearchPolicy tick that selects (at minimum) an island and an operator (and runs the configured TeamPolicy/topology for that island), then writes any newly created nodes/artifacts. Atomicity: each tick MUST be all-or-nothing (no partial writes within a tick), but the overall call may partially execute multiple ticks and report progress via n_steps_executed. Idempotency note: if n_steps_executed < n_steps_requested (early stop), retries with the same idempotency_key MUST replay the same partial result; callers MUST use a new idempotency_key to request fresh work/continuation. If paused|early_stopped|completed: campaign_not_active. If exhausted: budget_exhausted.",
====
      "description": "Side-effecting. Only permitted when campaign status is running. Definition: one search step is one SearchPolicy tick that selects (at minimum) an island and an operator (and runs the configured TeamPolicy/topology for that island), then writes any newly created nodes or updates existing nodes (e.g. Formalizer adding idea_card). Atomicity: each tick MUST be all-or-nothing (no partial writes within a tick), but the overall call may partially execute multiple ticks and report progress via n_steps_executed. Idempotency note: if n_steps_executed < n_steps_requested (early stop), retries with the same idempotency_key MUST replay the same partial result; callers MUST use a new idempotency_key to request fresh work/continuation. If paused|early_stopped|completed: campaign_not_active. If exhausted: budget_exhausted.",
>>>>
```
