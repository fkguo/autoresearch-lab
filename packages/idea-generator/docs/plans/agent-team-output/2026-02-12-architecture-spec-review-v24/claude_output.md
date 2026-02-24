VERDICT: NOT_READY

## Blockers

### B1. `idea_card_v1.schema.json` claims `oneOf` + `additionalProperties: false` interaction is broken

The `claims` items use a top-level `required` + `properties` block **and** a `oneOf` where each branch re-declares `properties` with `additionalProperties: false`. In JSON Schema 2020-12, `additionalProperties` is evaluated against the **enclosing schema object**, not the `oneOf` branch. The outer schema has `additionalProperties: false` on the items level, but then the `oneOf` branches *also* declare `additionalProperties: false` — which means any instance must satisfy the outer `properties` constraint AND one branch's constraint simultaneously. The problem: the outer `items` object declares `properties` including `confidence`, `verification_plan`, `verification_status`, `verification_notes` as optional, but the `oneOf` branches *each* re-declare a subset. Since `additionalProperties: false` in each `oneOf` branch only sees properties declared *in that branch object*, fields like `confidence` present in the outer `properties` but not re-declared in a branch will be rejected by that branch's `additionalProperties: false`.

**Concrete failure**: A claim `{"claim_text": "...", "support_type": "literature", "evidence_uris": ["..."], "confidence": 0.9}` will fail validation because `confidence` is not in the `oneOf[0].properties` keys (it is, actually — let me re-read)... Actually, both branches do declare `confidence`. Let me re-read more carefully.

Actually, on closer inspection both branches do declare all the same property keys (`confidence`, `verification_plan`, `verification_status`, `verification_notes`). So the `additionalProperties: false` in the branches won't reject known keys. **However**, the outer `items` object *also* has `additionalProperties: false` which sees only the outer `properties` keys — and the outer `properties` includes all keys. So validation will work. But the design is fragile and redundant: having `properties` + `additionalProperties: false` at the outer level AND inside each `oneOf` branch means every property is declared in 3 places. Any drift between the outer and inner declarations will cause silent validation failures that are very hard to debug.

**Revised blocker**: This isn't a hard validation failure, but the triple-declaration pattern is a maintenance timebomb. More importantly:

### B1 (revised). The `oneOf` branches are not mutually exclusive by schema alone

Both `oneOf` branches accept `support_type: "literature"` (branch 0 has `enum: ["literature", "data", "calculation", "expert_consensus"]`). A claim with `support_type: "literature"` + `verification_plan: "some text"` (optional in branch 0, required in branch 1) will validate against **both** branches simultaneously, violating the `oneOf` exactly-one-match semantics. This makes the schema non-deterministic for a significant class of valid documents. The engine cannot reliably distinguish "evidence-backed claim that happens to have a verification_plan" from "inference-backed claim" without looking at `support_type` — but `oneOf` doesn't guarantee that. A `literature` claim with `verification_plan` present matches both branches → **validation failure** (zero matches, because `oneOf` requires *exactly* one). This is a **silent rejection of valid data**.

**Fix**: Replace `oneOf` with `if/then/else` keyed on `support_type`, or use `anyOf` + `discriminator` (OpenAPI-style, though not standard JSON Schema).

### B2. `campaign.topup` cannot return `budget_exhausted` per the OpenRPC spec, but the architecture spec §2.4 says `exhausted → running` only "if no longer budget-exhausted"

The OpenRPC explicitly says: *"campaign.topup MUST NOT return budget_exhausted"*. The architecture spec says topup from `exhausted` keeps `exhausted` if budget still insufficient. These are consistent. **However**, there's a semantic gap: the caller has no machine-readable way to know *which dimensions* are still exhausted after a topup. `campaign_mutation_result` embeds `campaign_status` which includes `budget_snapshot`, and budget_snapshot has `*_remaining` fields — but these are **first-call snapshot** values on idempotent replay. The caller must separately call `campaign.status` after a replayed topup to get current budget. This is documented but fragile: there's no field in `CampaignMutationResult` that says `"transition_occurred": true/false` or `"still_exhausted_dimensions": [...]`.

**This is a blocker** because the caller cannot programmatically determine whether a topup succeeded in unblocking the campaign without a second RPC call, and for automated adapter loops, this creates a race between "check status" and "next action".

### B3. `search_step_result_v1` requires `new_nodes_artifact_ref` when `new_node_ids` is non-empty, but `updated_node_ids` has no corresponding artifact ref

The `allOf[1]` conditional says: if `new_node_ids` has ≥1 item, then `new_nodes_artifact_ref` is required. But `updated_node_ids` (nodes mutated in-place, e.g., formalization added) has **no** artifact ref. For mutation observability — a stated review focus — the caller cannot trace what changed on updated nodes without doing `node.get` on each one. This breaks the "append-only audit" principle: there's no diff/changelog artifact for mutations.

### B4. No schema for `IdeaNode.eval_info.scores` — eval results are disconnected from nodes

`eval.run` produces `scorecards_artifact_ref` pointing to `idea_scorecards_v1`, and the spec says "Engine persists eval_info into IdeaNodes." But `IdeaNode.eval_info` contains `fix_suggestions` and `failure_modes` — **not scores**. The per-dimension scores live only in `idea_scorecards_v1.scorecards[].scores`. This means:
- `rank.compute` must read from the scorecards artifact, not from `IdeaNode`
- `node.get` returns a node with `eval_info` that has diagnostics but no scores
- There's no documented contract for how `rank.compute` locates the relevant scorecards (it receives a `filter` but no `scorecards_artifact_ref`)

This is a data-flow gap that will block implementation of `rank.compute`.

### B5. `idea_selection_v1.schema.json` requires `selected_node_ids` with `minItems: 1`

A campaign that concludes "none of these ideas are worth pursuing" cannot produce a valid selection artifact. The `selected_node_ids` must have at least 1 item. This is architecturally wrong: an evidence-first system must allow "reject all" as a valid outcome. Additionally, `idea_selection_v1` is a standalone artifact schema but there is no RPC method that produces it. Is it produced by `node.promote`? By the adapter? This lifecycle gap needs to be closed.

---

## Non-blocking

### N1. `campaign_status_v1` is used both as an embedded sub-object (in `campaign_mutation_result_v1`, `idea_campaign_v1`) and as the direct result of `campaign.status` RPC

As a result type for `campaign.status`, it works fine. But when embedded in `campaign_mutation_result_v1`, the `campaign_id` is redundant (already in the mutation context). This is a minor schema hygiene issue — not blocking, but consider extracting a `CampaignStatusCore` without `campaign_id` for embedding.

### N2. `budget_snapshot_v1` requires all 10 fields including `steps_remaining` and `nodes_remaining` (which can be null)

The `oneOf: [integer, null]` pattern for nullable fields is correct in 2020-12 but some JSON Schema validators handle this poorly. Consider documenting the validator requirements or switching to `type: ["integer", "null"]` (which is equivalent and more widely supported).

### N3. `idea_list_filter_v1` has no `min_score` / `has_eval_info` / `created_after` / `created_before` filters

For `rank.compute`, the spec says "filter is applied within campaign scope" but the filter schema only supports structural predicates. A `rank.compute` call cannot filter "only nodes with scores ≥ X" or "only nodes evaluated after date Y". This will be needed for incremental ranking workflows.

### N4. `island_state_v1` has no `operator_ids` or `team_composition` field

The spec says `island_id` simultaneously identifies the strategy population AND the team. But `IslandState` doesn't expose which operators or roles are active on the island. This limits observability.

### N5. No `campaign.delete` or `campaign.archive` method

The idempotency spec says records are retained "until campaign ends" but there's no mechanism to clean up. For long-running systems this will cause unbounded storage growth. Non-blocking for v0.2 but should be in the roadmap.

### N6. `formalism_registry_v1` entries have no `version` field

Formalisms evolve (e.g., `hep-ph/chiral-pt` might have v1 and v2 with different C2 schemas). Without versioning, the registry can't disambiguate.

### N7. The `degradation_order` enum in `budget_envelope_v1` is closed

New degradation strategies (e.g., `reduce_team_size`, `switch_to_cheaper_model`) require schema changes. Consider making this `type: "string"` with recommended values documented.

### N8. `eval_result_v1` doesn't include per-node pass/fail status

The caller knows `node_ids` were evaluated and gets a `scorecards_artifact_ref`, but can't tell from the result alone whether any node failed evaluation (e.g., couldn't be scored due to missing `idea_card`). Must fetch the scorecards artifact to find out.

### N9. `idea_tournament_v1.matches[].winner_node_id` doesn't support draws

Elo systems commonly have draws (especially in subjective comparison). The schema requires a `winner_node_id` with no draw/tie option.

### N10. Pagination: `node_list_result_v1.total_count` is documented as potentially inconsistent across pages

The schema says "May differ across pages if the underlying set changes." This is fine for informational purposes but could confuse automated consumers that use `total_count` for progress bars or completeness checks. Consider adding a `snapshot_at` timestamp.

---

## Real-research fit

**Strengths**:

1. **Explain-Then-Formalize is excellent for HEP**. The two-stage `RationaleDraft → IdeaCard` pipeline mirrors how theorists actually work: sketch the physics intuition, *then* formalize. The mandatory `kill_criteria` in `RationaleDraft` and `testable_hypotheses` in `IdeaCard` enforce Popperian discipline that's rare in automated systems.

2. **Grounding audit with active URI resolution** is the right call. HEP has excellent infrastructure (INSPIRE, PDG, HEPData) for automated fact-checking. The `folklore_risk_score` addresses a real problem: many "new" BSM ideas are rediscoveries of 1970s-80s work.

3. **Multi-island evolution maps well to HEP subfield structure**. Different islands can represent different BSM paradigms (SUSY, composite Higgs, extra dimensions, etc.) with natural repopulation = cross-pollination.

4. **The operator taxonomy is well-chosen for theoretical physics**. `SymmetryOperator`, `LimitExplorer`, and `AssumptionInversion` correspond to actual discovery heuristics used by theorists. `RepresentationShift` (duality transforms, gauge choices) is particularly apt for HEP-th.

5. **`minimal_compute_plan` with `estimated_difficulty` and `required_infrastructure`** is practical for prioritizing ideas by feasibility. The `research_frontier` + `not_yet_feasible` options honestly handle cases where computation isn't possible yet.

**Gaps for real research**:

1. **No explicit handling of the "known result, new method" pattern**. In HEP-th, re-deriving a known result with a new technique (e.g., bootstrapping an amplitude previously computed via Feynman diagrams) is legitimate and publishable. The novelty framework's `non_novelty_flags` would incorrectly flag this as `no_new_prediction`. Need a `delta_type: "new_derivation_method"` and guidance that "same prediction, genuinely new technique" counts.

2. **`candidate_formalisms` is too coarse for multi-scale physics**. An idea might require both EFT (low-energy) and UV completion (high-energy) formalisms simultaneously. The current schema treats them as a flat list; consider allowing structured formalism dependencies.

3. **No mechanism for "negative results" or "idea killed" outcomes**. A campaign should be able to record "this idea was tested and falsified" as a valuable artifact. Currently, a failed grounding audit blocks promotion, but there's no positive artifact for "we proved this doesn't work."

4. **The `Checker` role (clean-room re-derivation) will be extremely expensive**. In real HEP, even a quick consistency check (dimensional analysis, symmetry constraints, known limits) can be substantial. The cost model needs to account for this, and there should be guidance on when to deploy lightweight vs. heavyweight checking.

---

## Robustness & safety

### Hallucination mitigation

1. **Strong**: Active URI resolution in grounding audit is the most important anti-hallucination measure. The requirement that `support_type=llm_inference` must have `verification_plan` is good.

2. **Gap**: No mechanism to detect **fabricated but plausible-looking URIs**. An LLM might generate `https://inspirehep.net/literature/12345` where record 12345 exists but discusses an unrelated topic. The grounding audit checks "URI resolves" but not "URI content supports the claim." The spec mentions "数据一致性" for data claims but not semantic relevance checking for literature claims. This is the most dangerous failure mode.

3. **Gap**: `origin.prompt_hash` enables replay but not inspection. There's no mechanism to retrieve the actual prompt for audit. Consider a `prompt_snapshot_ref` (URI to stored prompt) alongside the hash.

### Provenance integrity

1. **Strong**: The immutable/mutable field partition in `IdeaNode` is well-defined. The append-only ledger principle is good.

2. **Gap**: `updated_at` is a single timestamp. If `eval_info` and `grounding_audit` are updated at different times, only the latest mutation is visible. Consider per-field timestamps or a `mutation_log[]`.

### Budget safety

1. **Strong**: Multi-dimensional budget envelope with circuit breaker is well-designed. The step-level fuse (`step_budget`) prevents runaway single operations.

2. **Gap**: No rate-limiting or burst protection. A malfunctioning adapter could fire 1000 `search.step` calls with different idempotency keys before the budget circuit breaker catches up. Consider a `max_concurrent_steps` or `min_step_interval_s` guard.

3. **Gap**: `wall_clock_s` budget is hard to enforce atomically. If a tick takes longer than the remaining wall clock, the engine can only detect this after the fact. The spec should clarify whether `wall_clock_s` is best-effort or strict (strict would require cancellation mid-tick, violating tick atomicity).

### Campaign isolation

1. **Strong**: The campaign-scoped idempotency store and strict `node_not_in_campaign` checking are well-specified.

2. **Minor gap**: `campaign.init` idempotency records are global (no campaign_id). If two different adapters independently try to create campaigns with the same `idempotency_key` but different charters, the conflict detection works. But there's no namespace mechanism to prevent accidental key collisions across unrelated users/sessions.

---

## Specific patch suggestions

### P1. Fix `idea_card_v1.schema.json` claims validation (BLOCKER B1)

**File**: `schemas/idea_card_v1.schema.json`  
**What to change**: Replace the `oneOf` + triple-declaration pattern with `if/then` keyed on `support_type`:

```json
"claims": {
  "type": "array",
  "minItems": 1,
  "items": {
    "type": "object",
    "required": ["claim_text", "support_type", "evidence_uris"],
    "properties": {
      "claim_text": { "type": "string", "minLength": 1 },
      "support_type": {
        "enum": ["literature", "data", "calculation", "llm_inference", "assumption", "expert_consensus"]
      },
      "evidence_uris": { "type": "array", "items": { "type": "string", "format": "uri" } },
      "confidence": { "type": "number", "minimum": 0, "maximum": 1 },
      "verification_plan": { "type": "string" },
      "verification_status": { "enum": ["verified", "unverified", "falsified"], "default": "unverified" },
      "verification_notes": { "type": "string" }
    },
    "additionalProperties": false,
    "allOf": [
      {
        "if": {
          "properties": { "support_type": { "enum": ["literature", "data", "calculation", "expert_consensus"] } },
          "required": ["support_type"]
        },
        "then": {
          "properties": { "evidence_uris": { "minItems": 1 } }
        }
      },
      {
        "if": {
          "properties": { "support_type": { "enum": ["llm_inference", "assumption"] } },
          "required": ["support_type"]
        },
        "then": {
          "required": ["verification_plan"],
          "properties": { "verification_plan": { "minLength": 1 } }
        }
      }
    ]
  }
}
```

This eliminates the `oneOf` ambiguity, keeps one declaration of properties, and conditionally requires `verification_plan` and `evidence_uris.minItems` based on `support_type`.

### P2. Add `transition_summary` to `campaign_mutation_result_v1` (BLOCKER B2)

**File**: `schemas/campaign_mutation_result_v1.schema.json`  
**What to change**: Add a `transition` field:

```json
{
  "required": ["campaign_status", "idempotency", "transition"],
  "properties": {
    "campaign_status": { "$ref": "./campaign_status_v1.schema.json" },
    "idempotency": { "$ref": "./idempotency_meta_v1.schema.json" },
    "transition": {
      "type": "object",
      "required": ["previous_status", "current_status", "changed"],
      "properties": {
        "previous_status": { "enum": ["running", "paused", "early_stopped", "exhausted", "completed"] },
        "current_status": { "enum": ["running", "paused", "early_stopped", "exhausted", "completed"] },
        "changed": { "type": "boolean", "description": "True if status actually changed; false for no-ops (e.g., complete on already-completed, or topup that didn't unblock)." }
      },
      "additionalProperties": false
    }
  }
}
```

### P3. Add `updated_nodes_artifact_ref` to `search_step_result_v1` (BLOCKER B3)

**File**: `schemas/search_step_result_v1.schema.json`  
**What to change**: Add alongside `updated_node_ids`:

```json
"updated_nodes_artifact_ref": {
  "type": "string",
  "format": "uri",
  "description": "Artifact ref for a diff/changelog of mutations applied to updated_node_ids. Contains per-node field-level diffs (e.g., idea_card added, eval_info updated)."
}
```

Add a third `allOf` conditional:
```json
{
  "if": { "properties": { "updated_node_ids": { "type": "array", "minItems": 1 } }, "required": ["updated_node_ids"] },
  "then": { "required": ["updated_nodes_artifact_ref"] }
}
```

### P4. Add `scorecards_ref` linkage to `rank.compute` (BLOCKER B4)

**File**: `schemas/idea_core_rpc_v1.openrpc.json` — `rank.compute` method  
**What to change**: Add a `scorecards_artifact_ref` parameter:

```json
{
  "name": "scorecards_artifact_ref",
  "schema": { "type": "string", "format": "uri" },
  "required": false,
  "description": "Explicit reference to the scorecards artifact to rank against. If omitted, engine uses the latest scorecards for the campaign. Providing this ensures deterministic ranking against a specific eval snapshot."
}
```

### P5. Fix `idea_selection_v1` to allow empty selection (BLOCKER B5)

**File**: `schemas/idea_selection_v1.schema.json`  
**What to change**: Change `selected_node_ids` constraint:

```json
"selected_node_ids": {
  "type": "array",
  "items": { "type": "string", "format": "uuid" },
  "description": "May be empty if all candidates were rejected/deferred."
}
```

Remove `minItems: 1`. Add a validation constraint:
```json
"anyOf": [
  { "properties": { "selected_node_ids": { "minItems": 1 } } },
  { "properties": { "rejected_node_ids": { "minItems": 1 } } },
  { "properties": { "deferred_node_ids": { "minItems": 1 } } }
]
```

This ensures at least one decision was recorded.

### P6. Add semantic relevance check to grounding audit spec (Robustness gap)

**File**: `docs/plans/2026-02-12-idea-generator-architecture-spec.md` — §4.2.1 Grounding Audit Gate  
**What to change**: Between items 1 and 2, add:

> **1b. Semantic relevance (active verification)**: For `support_type=literature` claims, the grounding audit MUST verify that the referenced document's abstract/title/content is **semantically relevant** to the claim (not just that the URI resolves). Implementation: retrieve the document metadata (title + abstract via INSPIRE API) and verify topical relevance (keyword overlap, embedding similarity, or LLM judge). Irrelevant references must be flagged in `grounding_audit.failures[]` as `irrelevant_reference:<uri>`.

### P7. Add `delta_type: "new_derivation_method"` to novelty taxonomy (Real-research gap)

**File**: `schemas/idea_node_v1.schema.json` — `eval_info.novelty_delta_table[].delta_types`  
**What to change**: Add to the enum:

```json
"delta_types": {
  "type": "array",
  "minItems": 1,
  "items": {
    "enum": [
      "new_mechanism", "new_observable", "new_regime",
      "new_method", "new_formalism", "new_dataset",
      "new_constraint", "new_derivation_method"
    ]
  }
}
```

Also update the architecture spec §6.2 `delta type` enum to match.

### P8. Add `draw` support to tournament matches (N9)

**File**: `schemas/idea_tournament_v1.schema.json` — `matches[].winner_node_id`  
**What to change**: Make `winner_node_id` nullable:

```json
"winner_node_id": {
  "type": ["string", "null"],
  "format": "uuid",
  "description": "Winner of the match. null indicates a draw."
}
```

### P9. Clarify `wall_clock_s` enforcement semantics

**File**: `docs/plans/2026-02-12-idea-generator-architecture-spec.md` — §3.3 Budget Circuit Breaker  
**What to add** after the circuit breaker description:

> **Wall-clock enforcement semantics (MUST)**: `wall_clock_s` is **checked at tick boundaries** (best-effort, not preemptive). If a tick is in progress when the wall-clock limit is reached, the engine MUST complete the current tick (preserving tick atomicity) and then stop. The `budget_snapshot.wall_clock_s_elapsed` may therefore exceed `max_wall_clock_s` by up to one tick's duration. Implementations SHOULD log a `wall_clock_overrun` event when this occurs.

### P10. Add `version` to `formalism_registry_v1` entries (N6)

**File**: `schemas/formalism_registry_v1.schema.json`  
**What to change**: Add `version` field to entries:

```json
{
  "formalism_id": { ... },
  "version": {
    "type": "string",
    "pattern": "^[0-9]+\\.[0-9]+$",
    "description": "Semantic version of the formalism entry. Allows multiple versions of the same formalism to coexist."
  },
  "c2_schema_ref": { ... },
  ...
}
```

Update `required` to include `"version"`. Update `formalism_id` description to note that the combination of `(formalism_id, version)` is the unique key.
