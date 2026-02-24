VERDICT: READY

This is a well-constructed v4 bundle. The previous blockers (node_id vs idea_id ambiguity, pagination, eval/run campaign scoping, insufficient_eval_data, schema SSOT) are resolved. The contracts are machine-enforceable. Below I document remaining issues by severity.

---

## Blockers

**None.** All prior v3 blockers are resolved:

1. ✅ **node_id vs idea_id** — Now clearly separated in §5.2 with distinct semantics; `parent_node_ids[]` references only `node_id`; both appear in `IdeaNodeV1` schema as required UUIDs.
2. ✅ **Pagination** — `node.list` has `cursor` + `limit` params; `NodeListResultV1` returns nullable cursor + `total_count`.
3. ✅ **eval.run campaign scoping** — `campaign_id` is now a required param in `eval.run`.
4. ✅ **insufficient_eval_data** — Error code `-32013` added to `rank.compute`.
5. ✅ **Schema SSOT** — OpenRPC `components.schemas` use `$ref` to sibling `.schema.json` files; the spec explicitly mandates no copy-paste duplication (§2.3 boxed rule).

---

## Non-blocking

### N1. OpenRPC `$ref` path resolution ambiguity (medium priority)

The `components.schemas` entries use *two* different `$ref` styles:

- Method params/results: `{ "$ref": "#/components/schemas/CampaignCharterV1" }` (JSON Pointer within the OpenRPC doc)
- Component definitions: `{ "$ref": "campaign_charter_v1.schema.json" }` (relative file URI)

This is *technically* valid per the OpenRPC spec (component defs are resolved as sibling files), but many tooling consumers (e.g., `openrpc-generator`, Redocly) struggle with this two-hop indirection. **Recommendation**: add a CI bundling step (e.g., `json-schema-ref-parser`) that produces a fully-dereferenced `idea_core_rpc_v1.bundled.json` for tooling, while keeping the source files as SSOT. Mention this in the spec or add a `Makefile`/`justfile` target.

### N2. `eval_info.allOf` conditional requires tightening (medium)

In `idea_node_v1.schema.json`, `eval_info` is typed `["object", "null"]` with an `allOf` conditional:
```json
{ "if": { "type": "object" }, "then": { "required": ["fix_suggestions", "failure_modes"] } }
```
This is correct logically, but some JSON Schema validators (notably AJV in strict mode) emit warnings on `if/then` inside a `type: ["object","null"]` union. A cleaner pattern:
```json
"eval_info": {
  "oneOf": [
    { "type": "null" },
    {
      "type": "object",
      "required": ["fix_suggestions", "failure_modes"],
      "properties": { ... }
    }
  ]
}
```
Same issue applies to `grounding_audit`. Both are functionally equivalent but the `oneOf` pattern is more portable across validators.

### N3. `campaign_id` format inconsistency (low)

`campaign_id` is `{ "type": "string", "minLength": 1 }` everywhere, while `node_id` and `idea_id` are `{ "type": "string", "format": "uuid" }`. This is a conscious design choice (campaigns can have human-friendly names), but the spec doc should explicitly state this — otherwise implementors may assume UUID and get confused. One sentence in §5.2 or in `campaign_charter_v1.schema.json` description suffices.

### N4. `search.step` missing `campaign_id` in result required fields clarification (low)

`SearchStepResultV1` requires `campaign_id` which is good, but the `step_id` is not required. If `step_id` is intended as an idempotency/replay anchor (the spec mentions append-only ledger), consider making it required. Currently, a compliant engine can omit `step_id` entirely, which would make ledger replay fragile.

### N5. `rank.compute` lacks campaign scoping in result (low)

`RankingResultV1` doesn't include `campaign_id` in its required fields. While the request includes `campaign_id`, the response should echo it for self-describing artifact storage (especially when results are written to `idea_tournament_v1.json`).

### N6. `BudgetSnapshot` doesn't include `wall_clock_s_remaining` (low)

The snapshot has `wall_clock_s_elapsed` but not the remaining time. The envelope defines `max_wall_clock_s`, so the consumer could compute it, but for symmetry with `tokens_remaining` / `cost_usd_remaining`, consider adding `wall_clock_s_remaining`.

### N7. `promotion_result_v1.schema.json` grounding audit summary is flattened (low)

The promotion result's `grounding_audit_summary` has only `status` + `folklore_risk_score`. The full `grounding_audit` in `IdeaNodeV1` also includes `failures[]` and `timestamp`. Consider including `failure_count` or `failures[]` in the summary so the promotion response is self-contained for logging/display without a follow-up `node.get`.

### N8. Missing `$schema` / `$id` in some referenced schemas (cosmetic)

All standalone schema files correctly have `$schema` and `$id` — good. But `budget_snapshot_v1.schema.json` and `island_state_v1.schema.json` are only ever consumed via `$ref` from other schemas and the OpenRPC doc. Verify that your validator correctly resolves these transitive `$ref`s (especially `campaign_status_v1.schema.json` → `budget_snapshot_v1.schema.json`).

### N9. Team/Role model is spec-only, no schema (acceptable for v0.2)

The Team/Role/Community concepts (§3.4) are well-articulated in prose but have no corresponding JSON Schema. This is fine for v0.2 (the `origin.role` field in `IdeaNodeV1` is the minimal touchpoint), but flag for v0.3: a `team_config_v1.schema.json` and `role_manifest_v1.schema.json` will be needed when Team coordination becomes an RPC-level concern.

---

## Real-research fit

**Strong.** This design demonstrates genuine understanding of HEP research workflows:

1. **Evidence-first provenance** is deeply embedded: claim-level `support_type` + `evidence_uris` with conditional `verification_plan` for inferences/assumptions is exactly what a careful physicist would demand. The `allOf` conditional in `idea_card_v1.schema.json` (requiring `verification_plan` for `llm_inference`/`assumption`, requiring `minItems: 1` evidence URIs for `literature`/`data`/`calculation`/`expert_consensus`) is well-designed.

2. **Formalism registry** preventing promotion of ideas using unregistered formalisms is a critical safety rail. The `<namespace>/<name>` pattern with regex validation allows clean DomainPack scoping (e.g., `hep_ph/chiral_perturbation_theory`, `hep_th/ads_cft_holographic`).

3. **Novelty delta table** (§6.2 / `eval_info.novelty_delta_table`) is a standout feature. The `non_novelty_flags` enum (`parameter_tuning_only`, `relabeling_only`, `equivalent_reformulation`, `no_new_prediction`, `known_components_no_testable_delta`) directly addresses the most common failure mode of LLM-generated "ideas" — superficial repackaging.

4. **Multi-island state machine** maps well to how research groups actually explore: multiple parallel directions, stagnation detection, cross-pollination. The state transitions are sensible (`STAGNANT → REPOPULATED | EXHAUSTED` based on budget) and the exposed predicates (`should_repopulate`, `migrate`) are the right abstraction level.

5. **Kill criteria** as a required field in `RationaleDraft` enforces Popperian falsifiability discipline from the start — essential for preventing the "unfalsifiable but sounds profound" failure mode.

**One research-fit concern**: The `minimal_compute_plan` in `IdeaCard` has `estimated_difficulty` as a 4-level enum (`straightforward` through `research_frontier`). In real HEP, the boundary between "moderate" and "challenging" is where most time estimates go wrong. Consider adding an optional `confidence_in_estimate` field (high/medium/low) or a `blockers` string array per step.

---

## Robustness & safety

1. **Hallucination mitigation**: The Grounding Audit Gate (§4.2.1) with active URI resolution is the single most important safety feature. The requirement that phantom references cause `grounding_audit.status = fail` with written `failures[]` provides a hard audit trail. The `grounding_audit_failed` error code on `node.promote` makes this enforceable.

2. **Budget circuit breaker**: Well-designed with `degradation_order[]` giving graceful degradation before hard stop. The `BudgetSnapshot` in every response (search steps, evals, rankings) ensures the adapter/operator always has cost visibility.

3. **Clean-room evaluation**: The `clean_room: true` default in `EvaluatorConfigV1` with explicit `debate_threshold` trigger prevents groupthink among evaluator agents. The structured debate protocol (point/counterpoint + evidence_uris) in §6.1.1 is good.

4. **Idempotency**: `campaign.init` and `search.step` both accept `idempotency_key`. Good for crash recovery / retry safety.

5. **Potential gap — replay/audit trail**: The spec mentions "append-only ledger" (§1.1.4) but there's no schema for ledger events. For v0.2 this is acceptable (it's an internal implementation detail), but a `ledger_event_v1.schema.json` would strengthen auditability. At minimum, document that the engine must persist `(step_id, timestamp, method, params_hash, result_hash)` tuples.

6. **Potential gap — rate limiting / concurrent access**: No mention of how concurrent `search.step` calls on the same campaign are handled. Should the engine serialize them? Reject with a `campaign_busy` error? This matters for the multi-agent Team/Role topology where parallel roles might trigger concurrent steps.

---

## Specific patch suggestions

### Patch 1: `schemas/idea_node_v1.schema.json` — Replace `type + allOf/if-then` with `oneOf` for `eval_info` and `grounding_audit`

**File**: `schemas/idea_node_v1.schema.json`  
**What to change**: Replace the `eval_info` and `grounding_audit` definitions with cleaner `oneOf [null, object]` patterns.

```jsonc
// BEFORE (eval_info):
"eval_info": {
  "type": ["object", "null"],
  "properties": { ... },
  "allOf": [{ "if": { "type": "object" }, "then": { "required": [...] } }],
  "additionalProperties": false
}

// AFTER (eval_info):
"eval_info": {
  "oneOf": [
    { "type": "null" },
    {
      "type": "object",
      "required": ["fix_suggestions", "failure_modes"],
      "properties": {
        "novelty_delta_table": { /* unchanged */ },
        "fix_suggestions": { /* unchanged */ },
        "failure_modes": { /* unchanged */ }
      },
      "additionalProperties": false
    }
  ]
}
```
Apply the same pattern to `grounding_audit`. This eliminates validator warnings and improves code-generation compatibility (e.g., `quicktype`, `datamodel-codegen`).

### Patch 2: `schemas/ranking_result_v1.schema.json` — Add `campaign_id` as required

**File**: `schemas/ranking_result_v1.schema.json`  
**What to change**: Add `campaign_id` to `required` and `properties`.

```jsonc
"required": ["campaign_id", "method", "ranked_nodes"],
"properties": {
  "campaign_id": { "type": "string", "minLength": 1 },
  // ... rest unchanged
}
```

### Patch 3: `schemas/search_step_result_v1.schema.json` — Make `step_id` required

**File**: `schemas/search_step_result_v1.schema.json`  
**What to change**: Move `step_id` from optional to required for ledger integrity.

```jsonc
"required": ["campaign_id", "step_id", "n_steps_executed", "new_node_ids", "island_states", "budget_snapshot"],
```

### Patch 4: `schemas/campaign_charter_v1.schema.json` — Add `campaign_id` format note

**File**: `schemas/campaign_charter_v1.schema.json`  
**What to change**: Add a `description` to clarify that `campaign_id` (assigned by engine at init time) is intentionally *not* UUID-formatted.

In `properties`, add:
```jsonc
"campaign_name": {
  "type": "string",
  "minLength": 1,
  "description": "Human-readable campaign name. The engine-assigned campaign_id (returned by campaign.init) is a free-form string, not necessarily UUID; this allows human-friendly identifiers."
}
```

### Patch 5: `schemas/budget_snapshot_v1.schema.json` — Add `wall_clock_s_remaining`

**File**: `schemas/budget_snapshot_v1.schema.json`  
**What to change**: Add `wall_clock_s_remaining` for symmetry.

```jsonc
"wall_clock_s_remaining": {
  "type": ["number", "null"],
  "minimum": 0,
  "description": "null if max_wall_clock_s was not set or is unbounded."
}
```

### Patch 6: `schemas/idea_card_v1.schema.json` — Add optional `blockers` per compute step

**File**: `schemas/idea_card_v1.schema.json`  
**What to change**: In `minimal_compute_plan.items.properties`, add:

```jsonc
"blockers": {
  "type": "array",
  "items": { "type": "string", "minLength": 1 },
  "description": "Known blockers or unknowns that could affect feasibility of this step."
},
"estimate_confidence": {
  "enum": ["high", "medium", "low"],
  "description": "Confidence in the difficulty/compute-hours estimate."
}
```

### Patch 7: `schemas/promotion_result_v1.schema.json` — Enrich grounding audit summary

**File**: `schemas/promotion_result_v1.schema.json`  
**What to change**: Add `failure_count` and optional `failures` to `grounding_audit_summary`.

```jsonc
"grounding_audit_summary": {
  "type": "object",
  "required": ["status", "failure_count"],
  "properties": {
    "status": { "enum": ["pass", "fail", "partial"] },
    "failure_count": { "type": "integer", "minimum": 0 },
    "folklore_risk_score": { "type": "number", "minimum": 0, "maximum": 1 },
    "failures": { "type": "array", "items": { "type": "string" } }
  },
  "additionalProperties": false
}
```
Note: also added `"partial"` to the status enum to match `IdeaNodeV1.grounding_audit.status` which allows `pass | fail | partial`.

### Patch 8: `docs/plans/2026-02-12-idea-generator-architecture-spec.md` — Add concurrent access note

**File**: `docs/plans/2026-02-12-idea-generator-architecture-spec.md`  
**Where**: §2.3, after the error code list  
**What to add**:

```markdown
- **并发控制约定**：同一 `campaign_id` 上的 `search.step` 与 `eval.run` 调用默认互斥（engine 应序列化或返回 `campaign_busy` 错误码 `-32014`）。adapter 层负责排队。跨 campaign 的调用可并行。
```

And add to the error list:
```markdown
- `campaign_busy`（`-32014`）：当前 campaign 有进行中的搜索/评估步骤
```

### Patch 9: `schemas/idea_core_rpc_v1.openrpc.json` — Add bundling CI note

**File**: `schemas/idea_core_rpc_v1.openrpc.json`  
**What to change**: In `info.description`, append:

```json
"description": "JSON-RPC interface between the idea-generator adapter (hepar skill) and the standalone idea-core engine. Contract schemas are referenced via $ref to sibling files in this directory. For tooling that requires a single-file spec, run `make bundle-openrpc` to produce a fully-dereferenced bundle (do NOT hand-edit the bundle)."
```

---

**Summary**: This is a mature, well-structured v4 spec with no blockers. The 9 patches above are all non-blocking improvements targeting validator portability, self-describing responses, and operational safety. The evidence-first design, formalism registry gating, and novelty delta table are standout features that directly address the hardest problems in LLM-assisted scientific ideation.
