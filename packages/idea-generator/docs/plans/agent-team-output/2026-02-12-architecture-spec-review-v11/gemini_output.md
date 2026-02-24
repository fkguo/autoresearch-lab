VERDICT: READY

## Blockers
*(None detected. The specs and schemas are consistent, complete, and enforce the "safety-first" requirements.)*

## Non-blocking
1.  **Artifact Granularity (Clarification):** `SearchStepResultV1` returns `new_nodes_artifact_ref`. It is implicit that this should point to a *delta* artifact (e.g., `nodes_step_N.jsonl`) or a specific byte-range/URI in the append-only `idea_candidates_v1.jsonl`. If it points to the entire master file, clients might need to parse the whole file to find the new nodes. Suggest implementation treats these as delta packet URIs where possible for performance.
2.  **Ranking Schema strictness:** In `ranking_result_v1.schema.json`, the `ranked_nodes` items contain optional `pareto_front` and `elo_rating`. While correct that these depend on the `method`, the schema allows `method="elo"` but `elo_rating` missing. This is handled by engine logic, but could be tightened with `if/then` schema conditionals for maximum rigor.

## Real-research fit
The architecture is exceptionally well-aligned with HEP research workflows:
-   **Grounding Gate:** The `PromotionResult` schema hard-coding `status: "pass"` for `grounding_audit_summary` is a brilliant use of "Make Invalid States Unrepresentable" at the API level. It physically prevents the system from reporting a successful promotion if the evidence links are broken.
-   **Novelty Hygiene:** The `novelty_delta_table` in `IdeaNode` directly addresses the "repackaging vs. innovation" problem common in AI-generated physics ideas.
-   **Formalism Registry:** Decoupling the "valid formalisms" from the core engine via `DomainPack` allows the system to support `hep-th` (String Theory) and `hep-ph` (Phenomenology) simultaneously without code changes.

## Robustness & safety
-   **Idempotency:** The OpenRPC spec explicitly mandates the `(method, campaign_id, idempotency_key)` tuple for deduplication and requires specific replay behavior (echoing `is_replay`). This is critical for expensive operations like LLM-based search steps.
-   **Budget Circuit Breaker:** The `BudgetEnvelope` vs. `BudgetSnapshot` vs. `BudgetLimit` hierarchy allows coarse-grained (campaign) and fine-grained (step) control. The `degradation_order` provides a graceful failure mode rather than a hard crash.

## Specific patch suggestions

One minor suggestion to tighten the `IdeaCard` schema constraints slightly for `support_type`.

**File:** `schemas/idea_card_v1.schema.json`

**Change:** Explicitly forbid `verification_plan` when it is NOT inference/assumption, to keep the card clean.

```json
<<<<
          {
            "if": {
              "properties": { "support_type": { "enum": ["literature", "data", "calculation", "expert_consensus"] } },
              "required": ["support_type"]
            },
            "then": { "properties": { "evidence_uris": { "minItems": 1 } } }
          }
====
          {
            "if": {
              "properties": { "support_type": { "enum": ["literature", "data", "calculation", "expert_consensus"] } },
              "required": ["support_type"]
            },
            "then": {
              "properties": { "evidence_uris": { "minItems": 1 } },
              "not": { "required": ["verification_plan"] }
            }
          }
>>>>
```

*Note: The existing schema is valid and safe; this patch just adds strictness to avoid "verification plan" fields appearing where they don't belong (garbage data).*
