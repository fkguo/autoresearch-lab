VERDICT: NOT_READY

## Blockers

### B1. `campaign_mutation_result_v1.schema.json` — `allOf` conditional constraints are incomplete for `topup` + `changed`

The schema encodes `pause → changed=true`, `resume → changed=true`, `complete(from non-completed) → changed=true`, `complete(from completed) → changed=false`. But **`topup` has no `changed` constraint at all**. Per the spec, a topup from `exhausted → exhausted` (insufficient topup) should yield `changed=false`, and `exhausted → running` should yield `changed=true`. Also `running → running` topup is always `changed=false`. These are critical for adapters that branch on `transition.changed`. Without schema enforcement, adapters may silently proceed with stale assumptions.

**Fix**: Add `allOf` entries for topup + each `previous_status → current_status` pair that pin `changed` to the correct boolean.

### B2. `campaign.resume` from `exhausted` — error code / state conflict between spec and OpenRPC

The spec (§2.4) says: "若对 `status=exhausted` 调用 `campaign.resume`，必须返回 `budget_exhausted`（不改变状态）". The OpenRPC `campaign.resume` description says the same. **However**, `campaign.pause` allows `exhausted → paused`. Now consider:

1. Campaign is `exhausted`.
2. Caller does `campaign.pause` → state becomes `paused`.
3. Caller does `campaign.resume` → spec says "resume from paused must check budget; if any dimension remaining ≤ 0, reject with `budget_exhausted`" — correct.

But: **If the caller does `campaign.topup` (which works in `paused` state and adds budget) and then `campaign.resume`**, the budget may now be positive. This flow works. Good.

However, the **direct** flow `exhausted → campaign.resume` is explicitly rejected. But the `campaign.pause` description in the OpenRPC says it accepts `exhausted` as a source state, producing `paused`. The `allOf` constraint in `campaign_mutation_result_v1` locks `pause.previous_status ∈ [running, early_stopped, exhausted]` and `pause.current_status = paused, changed = true`. This is **internally consistent** but creates a UX trap: `exhausted → pause → topup → resume → running` is the only path, whereas `exhausted → topup → running` is also valid (topup can auto-transition `exhausted → running`). The spec documents this, but the **OpenRPC description for `campaign.topup`** does not list `budget_exhausted` as an error — it explicitly says "campaign.topup MUST NOT return budget_exhausted". This creates a discrepancy with the idea that topup might leave the campaign still `exhausted` (insufficient topup for a subset of dimensions). The caller's only signal is `transition.exhausted_dimensions_after` being non-empty + `current_status` still being `exhausted`. This is **fine** but needs the OpenRPC description to explicitly state this pattern as normative. Currently it's implicit.

**Blocker aspect**: The `campaign.topup` description says "campaign.topup MUST NOT return budget_exhausted; insufficient topups are represented by a successful result whose campaign_status remains exhausted." This is correct but **the schema doesn't enforce** that `campaign.topup` results never have certain error codes — OpenRPC `errors` array for `campaign.topup` doesn't list `-32001`. This is fine. **BUT**: `campaign.resume` rejects `exhausted` with `budget_exhausted`, while `campaign.topup` can transition `exhausted → running`. There is no schema-level or OpenRPC-level guarantee that after a successful topup with `transition.current_status = running`, the campaign is actually usable. A race (in future v1.0+) or a bug could leave it in an inconsistent state. This should at minimum be documented as an invariant.

**Real blocker**: `campaign.topup` from `early_stopped` keeps the status as `early_stopped` per the spec. But after topup, the caller must `campaign.resume` to enter `running`. The `campaign.resume` description says it's accepted from `early_stopped`. But `campaign.resume` must check budget — if the topup was sufficient, it transitions to `running`. If not, it rejects with `budget_exhausted`. **However, if the campaign was `early_stopped` (policy halt, not budget), the budget may be fine — the issue was policy stagnation.** The resume should succeed. This is all consistent. **The blocker is**: there is no way to distinguish "resume was rejected because budget is actually exhausted" from "resume was rejected because of some other issue" — both return `-32001 budget_exhausted`. The error.data.reason is not specified for `-32001`. The `rpc_error_data_v1` schema only specifies known_reasons for `-32002` and `-32013`. **`-32001` (budget_exhausted) needs at least one known_reason** (e.g., `dimension_exhausted` with `details.dimensions: [...]`) to be machine-actionable.

### B3. `idea_node_v1.schema.json` — `revision` is required but `search.step` / `eval.run` don't return it or acknowledge it

The spec (§2.3.1) says "v0.x … single-writer per campaign" and mentions "v1.0+ can consider optimistic concurrency (e.g., `expected_version` field)". The `revision` field exists on IdeaNode. But:

- `eval.run` takes `node_ids` and returns `updated_node_ids` — no `revision` in request or response.
- `search.step` returns `new_node_ids` and `updated_node_ids` — no revision info.
- `node.get` returns the full IdeaNode (which includes `revision`) — OK.

**Blocker**: Without revision in mutation responses, there is **no way** for the adapter to detect stale reads without re-fetching every node after every mutation. For v0.x single-writer this is tolerable, but `revision` is already part of the IdeaNode contract and the spec says it's "engine-managed: initialized to 1 at creation and incremented on each mutation." If `eval.run` returns `updated_node_ids` but not their current revisions, the adapter cannot verify atomicity was maintained without N additional `node.get` calls. This isn't a future-v1.0 concern — it's a v0.x observability gap.

**Fix**: Add `updated_node_revisions: { [node_id]: integer }` (or an array of `{node_id, revision}` tuples) to `eval_result_v1`, `search_step_result_v1`, and `promotion_result_v1`.

### B4. `rank.compute` — missing `dimensions` enforcement in schema for `method=pareto`

The spec says: "For method=pareto, the effective dimension count MUST be >= 2; otherwise insufficient_eval_data (-32013) with error.data.reason=insufficient_dimensions." The OpenRPC description repeats this. However, `ranking_result_v1.schema.json` has no conditional constraint binding `method=pareto` to any dimensional metadata in the result. The caller has no machine-readable way to verify which dimensions were actually used. 

**Fix**: Add `effective_dimensions: string[]` (required, minItems ≥ 1; conditional minItems ≥ 2 for pareto) to `ranking_result_v1.schema.json`.

### B5. `search_step_result_v1` — `n_steps_executed` can be 0 but `island_states` requires `minItems: 1`

If the engine starts a `search.step` call but immediately hits a budget fuse (step_budget or global), it may execute 0 ticks. The schema requires `n_steps_executed` minimum 0, `early_stopped` defaults to false. But `island_states` requires `minItems: 1`. If the campaign somehow has islands but 0 steps executed, the islands still exist, so this is arguably fine. **However**, the more concerning case: if `early_stopped=true` and `n_steps_executed=0`, the `new_node_ids` array is empty and `new_nodes_artifact_ref` is not required (the conditional `allOf` only fires when `new_node_ids.minItems: 1`). But `updated_node_ids` could also be empty, meaning the entire call is a no-op from an artifact perspective. **The blocker is**: the spec says "tick 原子性（必须）：单个 tick 内的写入必须 all-or-nothing" — but what about a `search.step` with `n_steps_executed=0`? Is this an error (should return `budget_exhausted`) or a valid success with `early_stopped=true`? The spec says "当局部预算先耗尽时，engine 应返回 `SearchStepResult.early_stopped=true`" — so 0-tick early stop is a valid success result. This is internally consistent. **Not a blocker after analysis — removing.**

Actually, re-examining: this IS a blocker because the `campaign_status` transition behavior is undefined for 0-tick steps. If the global budget runs out at the start of `search.step`, the spec says the campaign should transition to `exhausted`. But `search.step` returns a `SearchStepResult`, not an error, when `early_stopped=true`. **The spec says**: "对 side-effecting RPC … 在 `exhausted` 应优先返回 `budget_exhausted`（更具体）". So if the campaign is already `exhausted` at call time, it should error. But if the campaign transitions to `exhausted` mid-call (0 ticks completed), the response is a success with `early_stopped=true, n_steps_executed=0, early_stop_reason=budget_exhausted`. The `campaign_status` in the next `campaign.status` call should be `exhausted`. But `SearchStepResult` doesn't embed `campaign_status` — it only has `budget_snapshot` and `island_states`. **The adapter has no machine-readable way to know the campaign transitioned to `exhausted` during a 0-tick step without calling `campaign.status`.**

**Fix**: Add optional `campaign_status_after: enum[...]` to `search_step_result_v1.schema.json` so the adapter knows if a state transition occurred.

## Non-blocking

### N1. `idea_selection_v1.schema.json` — not referenced by any RPC method

This artifact exists as a standalone schema but there is no RPC method to produce or consume it. It's presumably created by the adapter/hepar layer or by human-in-the-loop. This is fine for v0.2 but should be documented as "adapter-produced, not engine-produced."

### N2. `idea_evidence_graph_v1.schema.json` — stub with very loose typing

The `nodes[].id` is `string` (not `uuid`) while `edges[].from/to` reference these IDs. No referential integrity is enforceable via JSON Schema alone, but worth noting for implementors that a validator/linter should check edge endpoint existence.

### N3. `idea_novelty_report_v1.schema.json` — `novelty_score` is optional, unbounded above

The `novelty_score` has `minimum: 0` but no `maximum`. Meanwhile `folklore_risk_score` is bounded `[0,1]`. Unless novelty_score is intentionally on a different scale (e.g., distance metric), consider bounding it or documenting the expected scale.

### N4. `budget_snapshot_v1` — `steps_remaining` / `nodes_remaining` nullable semantics

Using `oneOf: [integer, null]` to represent "unbounded" is fine but non-standard for budget tracking. Downstream consumers must handle null explicitly. Consider adding a description note on `campaign_status_v1` that null remaining dimensions never contribute to `exhausted` status.

### N5. `elo_config_v1` — `draw_allowed` is on `idea_tournament_v1` but not on `elo_config_v1`

The `draw_allowed` field appears on the tournament artifact but not on the config input. This means the engine decides whether draws are allowed without caller input. If this is intentional (engine policy), fine. If the caller should control it, add `draw_allowed` to `elo_config_v1`.

### N6. OpenRPC `info.description` embeds normative contract text

The `description` field in `info` contains critical idempotency semantics. While this is pragmatically useful, OpenRPC tooling typically treats `info.description` as informational. Consider extracting these as `x-idempotency-contract` or similar extension to make them machine-parseable.

### N7. `seed_pack_v1.schema.json` — `seed_type` is freeform string

No enum constraint on `seed_type`. For HEP-first, consider at least documenting recommended values (e.g., `c1_gap`, `pdg_tension`, `kb_prior`, `user_seed`) even if not enforced in the schema. This aids interoperability.

### N8. `idea_list_filter_v1` — missing `has_grounding_audit` and `has_eval_info` filters

The filter supports `has_idea_card` and `grounding_status` but not `has_eval_info: boolean` or `has_grounding_audit: boolean` (distinct from grounding_status which requires a specific value). These would be useful for the adapter to find "nodes that need evaluation" or "nodes that need grounding."

### N9. Mutation observability gap: `eval.run` returns `updated_node_ids` but not `new_node_ids`

Unlike `search.step` which returns both `new_node_ids` and `updated_node_ids`, `eval.run` only returns `updated_node_ids`. The spec says eval doesn't create new nodes (only mutates existing ones), which is correct. But this asymmetry should be explicitly documented to avoid confusion.

### N10. `campaign_init_result_v1` — missing `seed_pack_ref`

The init result includes `campaign_id`, `status`, `budget_snapshot`, `island_states` but not `seed_pack_ref`. The `idea_campaign_v1` artifact includes `seed_pack_ref`. The adapter has no way to confirm the seed pack was persisted without calling `campaign.status` (which also doesn't include `seed_pack_ref` — it's only on `idea_campaign_v1`). Consider adding `seed_pack_ref` to init result.

## Real-research fit

### R1. Evidence-first discipline is well-served

The four-tier grounding audit (URI resolution, data consistency, inference transparency, folklore pre-screening) combined with the mandatory `grounding_audit.status == pass` gate on `node.promote` is exactly right for HEP. The claim-level provenance in `IdeaCard.claims[]` with conditional `verification_plan` requirements for `llm_inference/assumption` is a strong hallucination mitigation pattern.

### R2. Operator taxonomy maps to real physics practice

The eight operator families (AnomalyAbduction through RepresentationShift) correspond to recognizable modes of theoretical physics reasoning. `SymmetryOperator` and `LimitExplorer` are particularly well-suited to HEP-ph/th workflows. `CrossDomainAnalogy` with the required mapping table + invariants + kill criteria is a good safeguard against vague analogies.

### R3. Multi-island evolution with Team/Role composition is promising

The mapping of `island_id` to both a search strategy population and a Team topology is a good abstraction for modeling different research group "styles" (e.g., one island focused on symmetry-breaking mechanisms with a Sequential Convergence team policy, another on anomaly-driven approaches with Parallel Divergence). The clean-room default between roles is critical for avoiding groupthink artifacts.

### R4. The Explain-Then-Formalize pipeline is well-suited to theoretical physics

Requiring `RationaleDraft` before `IdeaCard` mirrors how real theorists work: intuition/analogy first, then formalization. The kill criteria requirement at the draft stage forces the system to think about falsifiability early, which is good physics methodology.

### R5. Cross-domain method migration is well-guarded

The requirement that cross-domain operators produce explicit mapping tables + invariants + kill criteria, then pass through grounding audit and target-domain hard constraints, prevents the system from generating hand-wavy analogies without substance.

### R6. Concern: no mechanism for "negative results" or "this direction is known to fail"

The system tracks `rejection` in `idea_selection_v1` but there's no structured way to record *why* a direction failed and feed that back as anti-seeds. In real physics research, knowing "this approach doesn't work because of X" is as valuable as positive results. Consider adding a `failure_record` to IdeaNode or a campaign-level `negative_results` artifact.

## Robustness & safety

### S1. Idempotency design is thorough and well-specified

The RFC 8785 JCS canonicalization for payload hashing, the explicit key-conflict detection, the store-and-replay semantics for non-deterministic operations (LLM generation), and the consistent `idempotency.is_replay` flag are all well-designed. The requirement that idempotency records and side-effects be in the same "logical commit" prevents ghost writes.

### S2. Budget circuit breaker with degradation order is critical for cost control

The `degradation_order` enum and the per-step budget fuse (`step_budget`) provide defense-in-depth against runaway costs. The distinction between step-local and global budget exhaustion is clean.

### S3. Single-writer assumption (v0.x) is correctly scoped

The explicit statement that concurrent side-effecting RPCs are undefined behavior, with idempotency only protecting retries, is the right simplification for v0.x. The `revision` field on IdeaNode pre-wires optimistic concurrency for v1.0.

### S4. Grounding audit with active URI resolution is excellent hallucination mitigation

Requiring actual INSPIRE API / DOI resolver lookups (not just format checks) to validate `evidence_uris` prevents phantom citations — one of the most dangerous failure modes for LLM-generated research.

### S5. Risk: `operator_trace.prompt_snapshot_hash` is optional

The `prompt_snapshot_hash` is not in the `required` array for `operator_trace`. For reproducibility, the prompt used to generate a node is critical audit data. While the prompt itself may be large (stored elsewhere), the hash should be required to enable verification.

### S6. Risk: no explicit token/cost tracking per node

`BudgetSnapshot` tracks campaign-level token usage but there's no per-node cost attribution. Without this, the Distributor's bandit algorithm has no per-operator/per-model cost signal. The `origin` field has `model` and `temperature` but not `tokens_used` or `cost_usd`. This makes `tokens_per_promoted_node` (mentioned in §3.3) uncomputable from artifacts alone.

## Specific patch suggestions

### P1. `schemas/search_step_result_v1.schema.json` — Add `campaign_status_after`

```json
// Add to properties:
"campaign_status_after": {
  "enum": ["running", "paused", "early_stopped", "exhausted", "completed"],
  "description": "Campaign status after this step completed. Enables adapter to detect state transitions (e.g., running → exhausted) without a separate campaign.status call."
}
// Add to required array: "campaign_status_after"
```

### P2. `schemas/eval_result_v1.schema.json` — Add node revision map

```json
// Add to properties:
"node_revisions": {
  "type": "object",
  "description": "Map of node_id → revision after eval mutation. Enables stale-read detection without refetching.",
  "additionalProperties": { "type": "integer", "minimum": 1 }
}
// Add to required array: "node_revisions"
```

### P3. `schemas/ranking_result_v1.schema.json` — Add effective dimensions

```json
// Add to properties:
"effective_dimensions": {
  "type": "array",
  "minItems": 1,
  "items": { "enum": ["novelty", "feasibility", "impact", "tractability", "grounding"] },
  "description": "Dimensions actually used in this ranking computation."
}
// Add to required array: "effective_dimensions"
// Add allOf conditional:
{
  "if": { "properties": { "method": { "const": "pareto" } }, "required": ["method"] },
  "then": { "properties": { "effective_dimensions": { "minItems": 2 } } }
}
```

### P4. `schemas/rpc_error_data_v1.schema.json` — Add `exhausted_dimensions`

```json
// Add to properties:
"exhausted_dimensions": {
  "type": "array",
  "description": "Budget dimensions that triggered the error (for budget_exhausted errors).",
  "items": { "enum": ["tokens", "cost_usd", "wall_clock_s", "steps", "nodes"] }
}
```

And in `schemas/idea_core_rpc_v1.openrpc.json`, add to `x-error-data-contract.known_reasons`:
```json
"-32001": ["dimension_exhausted", "global_budget_exhausted"]
```

### P5. `schemas/idea_core_rpc_v1.openrpc.json` — `campaign.topup` missing transition from `running/paused/early_stopped` with `changed=false`

In `schemas/campaign_mutation_result_v1.schema.json`, add `allOf` entries for topup `changed` constraints:

```json
// After the existing topup previous_status constraints, add:
{
  "if": {
    "properties": {
      "mutation": { "const": "topup" },
      "transition": {
        "properties": {
          "previous_status": { "enum": ["running", "paused", "early_stopped"] }
        },
        "required": ["previous_status"]
      }
    },
    "required": ["mutation", "transition"]
  },
  "then": {
    "properties": {
      "transition": {
        "properties": {
          "changed": { "const": false }
        }
      }
    }
  }
}
```

And for `exhausted → running`:
```json
{
  "if": {
    "properties": {
      "mutation": { "const": "topup" },
      "transition": {
        "properties": {
          "previous_status": { "const": "exhausted" },
          "current_status": { "const": "running" }
        },
        "required": ["previous_status", "current_status"]
      }
    },
    "required": ["mutation", "transition"]
  },
  "then": {
    "properties": {
      "transition": {
        "properties": {
          "changed": { "const": true }
        }
      }
    }
  }
}
```

And `exhausted → exhausted` (insufficient topup):
```json
{
  "if": {
    "properties": {
      "mutation": { "const": "topup" },
      "transition": {
        "properties": {
          "previous_status": { "const": "exhausted" },
          "current_status": { "const": "exhausted" }
        },
        "required": ["previous_status", "current_status"]
      }
    },
    "required": ["mutation", "transition"]
  },
  "then": {
    "properties": {
      "transition": {
        "properties": {
          "changed": { "const": false }
        }
      }
    }
  }
}
```

### P6. `schemas/idea_node_v1.schema.json` — Make `prompt_snapshot_hash` required in `operator_trace`

```json
// In operator_trace.required, change from:
"required": ["inputs", "params", "evidence_uris_used"]
// To:
"required": ["inputs", "params", "evidence_uris_used", "prompt_snapshot_hash"]
```

### P7. `schemas/idea_node_v1.schema.json` — Add per-node cost attribution

```json
// Add to properties (top level, optional):
"cost_attribution": {
  "oneOf": [
    { "type": "null" },
    {
      "type": "object",
      "required": ["tokens_used", "cost_usd"],
      "properties": {
        "tokens_used": { "type": "integer", "minimum": 0 },
        "cost_usd": { "type": "number", "minimum": 0 },
        "wall_clock_s": { "type": "number", "minimum": 0 }
      },
      "additionalProperties": false
    }
  ]
}
```

### P8. `docs/plans/2026-02-12-idea-generator-architecture-spec.md` — Add negative results artifact

In §5.1 (SSOT artifacts list), add:
```
- `idea_negative_results_v1.json` (optional; structured "known dead ends" for anti-seed feedback)
```

In §5.2, add a note:
```
When an IdeaNode is rejected with substantive failure analysis (not just low scores), the
rejection rationale + kill criteria that fired should be persisted as a negative result entry.
These feed back as anti-seeds: SearchPolicy should consult them to avoid re-exploring
known dead ends, and Operators should receive them as negative priors.
```

### P9. `schemas/idea_list_filter_v1.schema.json` — Add missing useful filters

```json
// Add to properties:
"has_eval_info": { "type": "boolean" },
"has_grounding_audit": { "type": "boolean" },
"min_revision": {
  "type": "integer",
  "minimum": 1,
  "description": "Filter to nodes with revision >= this value (useful for finding recently mutated nodes)."
}
```

### P10. `schemas/seed_pack_v1.schema.json` — Document recommended `seed_type` values

```json
// Change seed_type from:
"seed_type": { "type": "string", "minLength": 1 }
// To:
"seed_type": {
  "type": "string",
  "minLength": 1,
  "description": "Seed source category. Recommended values: c1_gap, pdg_tension, hepdata_anomaly, kb_prior, user_seed, literature_gap, failed_approach. Freeform string to support DomainPack extensibility."
}
```
