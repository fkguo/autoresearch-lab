VERDICT: READY

## Blockers
*(None detected. The architecture is structurally sound, the state machine is complete, and the idempotency logic is rigorous.)*

## Non-blocking
1.  **Observability Inconsistency in `eval.run`**: `search.step` returns `updated_nodes_artifact_ref` (providing immediate access to the mutated state), but `eval.run` only returns `updated_node_ids`. This forces the adapter to issue follow-up `node.get` calls to retrieve the generated diagnostics (`eval_info`), increasing latency and complexity for the "feedback loop" visualization.
2.  **`node.list` Silent Scoping**: The requirement that "filters that do not match the campaign return empty results" (rather than an error) is semantically clean but risks masking client-side bugs where a user queries with the wrong `campaign_id`. A warning in `node_list_result` metadata might be helpful in v1.1.
3.  **Promotion Re-entrancy**: The spec implies `node.promote` is side-effecting. It does not explicitly state behavior if called on an already-promoted node with a *different* `idempotency_key`. Ideally, this should either fail (`node_already_promoted`) or return the existing handoff (idempotent by state), to prevent duplicate C2 entries for the same node version.

## Real-research fit
1.  **Novelty Delta Table**: The structured `novelty_delta_table` (distinguishing "new mechanism" from "relabeling") is a critical differentiator for theoretical physics, where "math-washing" known ideas is a common LLM failure mode.
2.  **Grounding Audit**: The active resolution check for `evidence_uris` before promotion effectively blocks "phantom citation" hallucinations, a primary barrier to trust in automated science.
3.  **Formalism Registry**: decoupling the "method compiler" from the core engine via a registry allows the system to evolve from simple "Python scripts" to complex "FeynRules/Mathematica" pipelines without engine rewrites.

## Robustness & safety
1.  **Idempotency Contract**: The `payload_hash` verification + `(method, campaign_id, key)` tuple scope is state-of-the-art for preventing "zombie retries" and cross-run pollution.
2.  **Budget Fuses**: The separation of `step_budget` (local fuse) from `BudgetEnvelope` (global circuit breaker) prevents a single runaway search step from draining the entire campaign budget.
3.  **State Machine**: The explicit `exhausted` vs `early_stopped` distinction, and the conditional `topup` logic, prevents the system from getting stuck in a "dead" state where budget is added but the flag remains "exhausted".

## Specific patch suggestions

### 1. Align `eval.run` observability with `search.step`

**File:** `schemas/eval_result_v1.schema.json`
**Change:** Add `updated_nodes_artifact_ref` to enable efficient retrieval of evaluation results (diagnostics).

```diff
--- schemas/eval_result_v1.schema.json
+++ schemas/eval_result_v1.schema.json
@@ -10,6 +10,11 @@
       "items": { "type": "string", "format": "uuid" },
       "description": "IDs of nodes that were mutated (e.g., eval_info appended) during this operation."
     },
+    "updated_nodes_artifact_ref": {
+      "type": "string",
+      "format": "uri",
+      "description": "Artifact ref for the snapshot/diff of nodes updated by this evaluation (containing the new eval_info). Enables adapter to render diagnostics without N+1 node.get calls."
+    },
     "scorecards_artifact_ref": { "type": "string", "format": "uri" },
     "budget_snapshot": { "$ref": "./budget_snapshot_v1.schema.json" },
```

### 2. Enforce `eval.run` output in OpenRPC

**File:** `schemas/idea_core_rpc_v1.openrpc.json` (Method: `eval.run`)
**Change:** Update description to reflect the schema change.

```diff
--- schemas/idea_core_rpc_v1.openrpc.json
+++ schemas/idea_core_rpc_v1.openrpc.json
@@ -213,7 +213,7 @@
         { "name": "idempotency_key", "schema": { "type": "string", "minLength": 1 }, "required": true }
       ],
-      "description": "Side-effecting. Only permitted when campaign status is running... Returns updated_node_ids...",
+      "description": "Side-effecting. Only permitted when campaign status is running... Returns updated_node_ids and updated_nodes_artifact_ref...",
```

```
