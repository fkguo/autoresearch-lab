VERDICT: READY

## Blockers
*None identified.* The specifications are coherent, the schemas are syntactically valid (Draft 2020-12), and the RPC protocol strictly enforces the evidence-first design goals.

## Non-blocking
1. **Large Seed Payload:** `campaign.init` requires the `seed_pack` object inline. For campaigns with thousands of initial seed papers, this JSON payload could be large (MBs). Since the transport is `stdio` (local), this is acceptable for v1, but consider adding a `seed_pack_uri` alternative in v2 for remote deployments.
2. **Evaluator Config State:** `eval.run` takes a full `evaluator_config`. This makes the engine stateless regarding evaluation policy (good for testing), but places the burden on the Adapter (hepar skill) to persist/manage consistency of evaluation configs across runs. This is an acceptable architectural trade-off for v0.2.

## Real-research fit
- **Team/Role Topologies:** The explicit `role` field in `IdeaNode.origin` and the `TeamPolicy` references in `IslandState` map well to real scientific collaborations (e.g., separating the "Ideator" from the "Checker").
- **Novelty Rigor:** The `novelty_delta_table` (closest priors + explicit delta statements) directly addresses the common "LLM vague novelty" failure mode.
- **Grounding Audit:** The active resolution requirement for `claims[].evidence_uris` before promotion prevents "hallucinated citations" from polluting downstream C2 workflows.

## Robustness & safety
- **Idempotency:** The `payload_hash` verification + `is_replay` echo is a gold-standard pattern for preventing "accidental double-spend" of research budgets or duplication of artifacts.
- **Budget Fuses:** The dual-layer budget (global `BudgetEnvelope` + local `step_budget` in `search.step`) effectively prevents runaway loops.
- **Artifact Contracts:** Using `schemas/*.schema.json` as the SSOT ensures that the file-system artifacts (`idea_candidates.jsonl`, `idea_card.json`, etc.) are just as rigorously typed as the RPC, facilitating independent auditing tools.

## Specific patch suggestions

### 1. Enforce `verification_plan` strictness in IdeaCard
To ensure that "assumptions" are not just lazy hallucinations, strictly require the plan to be non-empty.

**File:** `schemas/idea_card_v1.schema.json`
**Change:** Add `minLength` to `verification_plan`.

```json
<<<<
          "verification_plan": {
            "type": "string",
            "description": "Required when support_type is llm_inference or assumption."
          },
====
          "verification_plan": {
            "type": "string",
            "minLength": 10,
            "description": "Required when support_type is llm_inference or assumption. Must detail how to falsify this claim."
          },
>>>>
```

### 2. Clarify `node.promote` idempotency scope
Explicitly state that promotion is a "snapshotting" event.

**File:** `schemas/idea_core_rpc_v1.openrpc.json`
**Change:** Update `node.promote` description.

```json
<<<<
      "description": "Side-effecting. Only permitted when campaign status is running; otherwise campaign_not_active.",
====
      "description": "Side-effecting. Only permitted when campaign status is running; otherwise campaign_not_active. Creates an immutable 'handoff artifact' snapshot of the node at this moment. Subsequent updates to the node do not invalidate the generated handoff artifact (though a new promotion would generate a new one).",
>>>>
```
