VERDICT: NOT_READY

## Blockers

### B1. Idempotency contract is under-specified for replay semantics

The spec mandates `idempotency_key` on side-effecting RPCs and says the engine deduplicates by `(method, campaign_id?, idempotency_key)`. But the OpenRPC schema and spec are silent on **what the engine returns on a duplicate hit**:

- Does it return the **original result** (cache-hit replay)? Or a special "already processed" envelope?
- What is the TTL / eviction policy for the idempotency store? (Critical for long-running campaigns.)
- If the original call **failed** (e.g., `budget_exhausted`), does a retry with the same key replay the error or re-attempt?

Without these answers, adapter implementers will make incompatible assumptions. This is a **blocker** because the spec explicitly calls idempotency a "MUST" but doesn't specify enough to test compliance.

**Fix:** Add to §2.3 and to OpenRPC `info.description`:
```
Idempotency semantics:
1. On duplicate (method, campaign_id, idempotency_key): return the stored result verbatim (cache-hit). HTTP analogy: the response is memoized.
2. If the original call returned an error, the error is replayed (caller must use a new key to retry with different intent).
3. Idempotency records MUST be retained for the lifetime of the campaign (or until campaign.delete, if added).
4. campaign.init: keyed by (method, idempotency_key) only (no campaign_id yet); a duplicate returns the same campaign_id.
```

### B2. `campaign.init` with `formalism_registry` param is not marked `required: false`

In the OpenRPC JSON, `formalism_registry` lacks a `"required"` field. OpenRPC `paramStructure: "by-name"` defaults to optional when `required` is absent, which is correct intent—but the charter param also lacks `required` annotations on several params. However, the real blocker is: **if `formalism_registry` is omitted AND the DomainPack has no built-in registry, what happens?** The spec says "engine uses the DomainPack built-in registry" but doesn't mandate that a DomainPack *must* have one. A campaign could be initialized with zero formalism entries, making `node.promote` permanently impossible.

**Fix:** Either:
- (a) Make `formalism_registry` required, or
- (b) Add a validation rule in `campaign.init`: if the merged registry is empty, return error `schema_validation_failed` with a message indicating no formalisms are available.

### B3. `ranking_result_v1.schema.json` missing `budget_snapshot`

`rank.compute` is a side-effecting call (idempotency_key required, persists ranking artifact). The spec §1.1.5 requires cost observability as a first-class property. But `RankingResultV1` does **not** include `budget_snapshot`, unlike `SearchStepResultV1` and `EvalResultV1`. This breaks the observability contract: after a `rank.compute`, the adapter has no way to know remaining budget without a separate `campaign.status` call.

**Fix:** Add `"budget_snapshot": { "$ref": "budget_snapshot_v1.schema.json" }` to `ranking_result_v1.schema.json` `required` and `properties`.

### B4. `node.promote` result always requires `handoff_artifact_ref` — but promotion can fail

`promotion_result_v1.schema.json` has `handoff_artifact_ref` in `required`. But if formalism_check fails or grounding_audit fails, the RPC returns an error code, so this is arguably fine (no success body). However, there's a gap: **partial success** (grounding_audit = "partial"). The spec in §4.2.1 says `partial` is a valid grounding status. Can a node with `grounding_audit.status = "partial"` be promoted? The `PromotionResultV1` has `grounding_audit_summary.status` that allows `"partial"`, but the error list for `node.promote` only has `grounding_audit_failed` — there's no way to express "promoted with caveats" vs "blocked."

**Fix:** Clarify in the spec and OpenRPC: either `partial` blocks promotion (change the error description) or add a `"warnings"` array to `PromotionResultV1` and document that `partial` grounding results in a successful promotion with warnings.

---

## Non-blocking

### N1. `IdeaNode.idea_card` nullable but `node.promote` doesn't list a dedicated error for missing IdeaCard

The spec §4 says "any idea entering Ranking / A0.2 must have IdeaCard + schema validation." But `node.promote` errors don't include a dedicated code for "idea_card is null." It would presumably fall under `schema_validation_failed`, but an explicit error code (`idea_card_missing`, e.g., `-32015`) would make adapter error handling cleaner.

### N2. `search.step` `n_steps` default value is in the OpenRPC but JSON Schema doesn't enforce defaults

The `"default": 1` on `n_steps` is informational only in JSON Schema draft 2020-12 (validators don't inject it). Document that the **engine** must apply the default, not the schema validator.

### N3. `IdeaListFilterV1` has no `min_score` / `eval_status` filter

For practical campaign management, callers will want to filter by evaluation status (evaluated vs. not) and by minimum score. Currently the only filters are structural (island, operator, grounding_status). Suggest adding `evaluated: boolean` and `min_composite_score: number` as optional fields.

### N4. `BudgetSnapshot` `steps_remaining` / `nodes_remaining` uses `oneOf: [integer, null]` — prefer explicit nullable

`oneOf` with `[type: integer, type: null]` is valid but can confuse code generators. Consider using `"type": ["integer", "null"]` for consistency with how `cursor` is typed in `NodeListResultV1`.

### N5. `campaign_status_v1` missing `"paused"` state

The spec §2.1 mentions hepar manages "pause/resume", and the hepar skill has `pause/resume` commands. But `CampaignStatusV1.status` enum is `["running", "early_stopped", "exhausted", "completed"]` — no `"paused"`. Add it.

### N6. No `campaign.delete` or `campaign.archive` RPC

Long-lived systems will accumulate campaigns. Not critical for v0.2 but worth a placeholder.

### N7. `eval_result_v1` doesn't return per-node scores inline

The result only has `scorecards_artifact_ref`. For adapter UX (and for `rank.compute` to be called immediately), the adapter must first fetch and parse the artifact. Consider adding an optional `summary_scores` array with `{node_id, composite_score}` tuples.

### N8. Operator trace `inputs` and `params` are `"type": "object"` with no further constraints

This makes them opaque bags. For auditability, consider requiring at least `{"type": "object", "minProperties": 1}` on `inputs` or adding a `description` noting that DomainPacks should publish sub-schemas for their operators.

### N9. `seed_pack_v1` `seed_type` is free-form string

The spec §8.1 lists four seed sources (C1 gaps, KB priors, PDG tensions, user seeds) but the schema doesn't constrain `seed_type`. Add a recommended enum + `"x-"` prefix convention for extensions, or at minimum a `description` with the canonical values.

### N10. Missing `$schema` / `$id` consistency in OpenRPC

The OpenRPC doc uses `allOf: [{$ref: "file.schema.json"}]` pattern for component schemas. This works but some OpenRPC tooling resolves `$ref` relative to the document. Add an `externalDocs` or a note in the `info` block confirming that `$ref` paths are sibling-relative.

---

## Real-research fit

### R1. HEP workflow alignment: strong

The seed sources (C1 gaps, PDG tensions, INSPIRE retrieval) map directly to real HEP phenomenology workflows. The formalism registry concept correctly mirrors how HEP methods (effective field theory, perturbative QCD, lattice, etc.) each require different downstream toolchains. The `candidate_formalisms` → registry gate is a genuine quality-of-life feature for preventing "ideas that sound good but have no executable path."

### R2. Explain-Then-Formalize is well-motivated

The two-stage `RationaleDraft → IdeaCard` pipeline mirrors how actual theorists work: intuition/analogy first, then formalization. The kill-criteria requirement in `RationaleDraft` is excellent — real research benefits enormously from pre-registered failure modes. The schema enforces this at the machine level.

### R3. Grounding audit is the right gate but needs calibration data

The `folklore_risk_score ∈ [0,1]` is architecturally sound, but the spec doesn't discuss how the threshold is set or adapted. In practice, what's "folklore" in hep-ph (e.g., "dark photon mixing with SM photon") is a well-established framework, not a novel claim. The system needs domain-specific calibration data for folklore scoring. Suggest adding a `folklore_calibration_ref` field to `CampaignCharter.extensions` for v0.3.

### R4. Novelty delta table fills a real gap

The `novelty_delta_table` with explicit `non_novelty_flags` like `parameter_tuning_only` and `equivalent_reformulation` is genuinely useful. In HEP, a large fraction of "new" papers are parameter scans of known models; this filter would catch that.

### R5. Multi-island maps to real research strategy diversity

Different islands corresponding to different theoretical approaches (e.g., perturbative vs. non-perturbative, EFT vs. UV-complete) is how real theory groups diversify. The repopulation mechanism (migrating ideas between islands) mirrors cross-pollination at workshops.

### R6. Gap: no explicit "negative result" or "dead end" artifact

Real research generates valuable negative results. The current schema allows `STAGNANT → EXHAUSTED` but doesn't create a structured artifact capturing *why* a direction failed. This is valuable for future campaigns. Suggest an optional `autopsy_report` field on exhausted islands or pruned nodes.

---

## Robustness & safety

### S1. Hallucination mitigation: good structural defenses, one gap

The grounding audit with active URI resolution is a strong defense. The `support_type` taxonomy forces explicit labeling of LLM inference. **Gap:** There's no mechanism to detect when an LLM fabricates a plausible-looking but non-existent arXiv ID (e.g., `2401.12345`). The "active lookup" requirement should explicitly state that INSPIRE API 404 → immediate failure, not just "format valid."

### S2. Cross-campaign contamination: addressed by scoping rule

The `node_not_in_campaign` error code and the scoping MUST in §2.3 are correct. However, the idempotency store itself should be campaign-scoped (for `campaign.init`, globally scoped). Make this explicit.

### S3. Budget circuit breaker: well-specified but missing observability hook

The `degradation_order` is good. Missing: **notification** when degradation occurs. The `SearchStepResultV1` has `early_stopped` + `early_stop_reason`, but there's no equivalent for "degraded but continuing." Add an optional `degradation_events[]` to `SearchStepResultV1` (e.g., `{"action": "reduce_eval_rounds", "timestamp": "...", "budget_at_trigger": {...}}`).

### S4. Append-only store: declared but not enforced by schema

The spec says "append-only" but `IdeaNode` has `updated_at`, implying mutation. This is fine (eval_info gets added later), but the spec should clarify: **which fields are immutable after creation** (campaign_id, idea_id, node_id, parent_node_ids, island_id, operator_id, origin, operator_trace, rationale_draft) vs. **which are mutable** (eval_info, grounding_audit, idea_card, updated_at). This is critical for audit trail integrity.

### S5. Clean-room evaluation: architecturally sound

The `clean_room: true` default and structured debate protocol are good. The `debate_threshold` being a single number is slightly underspecified (threshold on what — max delta across dimensions? any single dimension?). Clarify.

---

## Specific patch suggestions

### P1. `schemas/ranking_result_v1.schema.json` — Add budget_snapshot

```json
// File: schemas/ranking_result_v1.schema.json
// Change: add "budget_snapshot" to required array and properties

"required": ["campaign_id", "method", "ranked_nodes", "budget_snapshot"],
// In properties, add:
"budget_snapshot": { "$ref": "budget_snapshot_v1.schema.json" }
```

### P2. `schemas/campaign_status_v1.schema.json` — Add "paused" to status enum

```json
// File: schemas/campaign_status_v1.schema.json
// Change: extend status enum
"status": { "enum": ["running", "paused", "early_stopped", "exhausted", "completed"] }
```

### P3. `schemas/idea_core_rpc_v1.openrpc.json` — Document idempotency replay semantics

```json
// File: schemas/idea_core_rpc_v1.openrpc.json
// Change: extend info.description
"description": "JSON-RPC interface between the idea-generator adapter (hepar skill) and the standalone idea-core engine. Contract schemas are referenced via $ref to sibling files in this directory.\n\nIdempotency contract: Side-effecting methods require an idempotency_key. The engine deduplicates by (method, campaign_id, idempotency_key) — for campaign.init, by (method, idempotency_key) only. On duplicate: the stored result is returned verbatim (including errors). Idempotency records are retained for the campaign lifetime. Callers must use a new key to express new intent after a failure."
```

### P4. `schemas/search_step_result_v1.schema.json` — Add degradation_events

```json
// File: schemas/search_step_result_v1.schema.json
// Change: add optional degradation_events to properties
"degradation_events": {
  "type": "array",
  "items": {
    "type": "object",
    "required": ["action", "timestamp"],
    "properties": {
      "action": { "enum": ["reduce_eval_rounds", "reduce_islands", "disable_cross_domain_operators", "reduce_population", "early_stop"] },
      "timestamp": { "type": "string", "format": "date-time" },
      "budget_at_trigger": { "$ref": "budget_snapshot_v1.schema.json" }
    },
    "additionalProperties": false
  }
}
```

### P5. `schemas/idea_node_v1.schema.json` — Document field mutability

```json
// File: schemas/idea_node_v1.schema.json
// Change: add to top-level description
"description": "A single candidate node in the ideation search space, with lineage, traces, diagnostics, and optional formalized IdeaCard.\n\nMutability contract: Fields campaign_id, idea_id, node_id, parent_node_ids, island_id, operator_id, origin, operator_trace, rationale_draft, created_at are IMMUTABLE after creation. Fields idea_card, eval_info, grounding_audit, updated_at are MUTABLE (append/replace semantics; prior values should be preserved in the ledger)."
```

### P6. `schemas/budget_snapshot_v1.schema.json` — Normalize nullable pattern

```json
// File: schemas/budget_snapshot_v1.schema.json
// Change: replace oneOf with type array for steps_remaining and nodes_remaining
"steps_remaining": {
  "type": ["integer", "null"],
  "minimum": 0,
  "description": "null if max_steps was not set in the BudgetEnvelope."
},
"nodes_remaining": {
  "type": ["integer", "null"],
  "minimum": 0,
  "description": "null if max_nodes was not set in the BudgetEnvelope."
}
```

### P7. `docs/plans/2026-02-12-idea-generator-architecture-spec.md` §2.3 — Add idempotency replay semantics

```markdown
<!-- File: docs/plans/2026-02-12-idea-generator-architecture-spec.md -->
<!-- Change: After the existing idempotency paragraph in §2.3, add: -->

3. **Replay semantics**：若 engine 收到重复的 `(method, campaign_id?, idempotency_key)`：
   - 返回首次调用的**完整结果**（含 error，若首次失败）；不重新执行副作用。
   - 若首次调用结果为错误，调用方必须使用新 key 重试。
   - Idempotency 记录的生命周期 = campaign 生命周期（`campaign.init` 的记录为全局，直到显式清理）。
```

### P8. `schemas/promotion_result_v1.schema.json` — Clarify partial grounding

```json
// File: schemas/promotion_result_v1.schema.json
// Change: add optional warnings array and clarify grounding_audit_summary
"warnings": {
  "type": "array",
  "items": { "type": "string" },
  "description": "Non-blocking issues detected during promotion (e.g., grounding_audit partial). Empty array if clean promotion."
}
// And add "warnings" to required array — OR keep it optional with default [].
// Also add to description: "If grounding_audit_summary.status is 'partial', promotion succeeds but warnings MUST be non-empty."
```

### P9. `docs/plans/2026-02-12-idea-generator-architecture-spec.md` §5.2 — Add mutability contract

```markdown
<!-- File: docs/plans/2026-02-12-idea-generator-architecture-spec.md -->
<!-- Change: After §5.2 field listing, add: -->

**字段可变性契约（Field Mutability）**：
- **不可变（创建后 frozen）**：`campaign_id`, `idea_id`, `node_id`, `parent_node_ids`, `island_id`, `operator_id`, `origin`, `operator_trace`, `rationale_draft`, `created_at`
- **可变（追加/替换语义）**：`idea_card`, `eval_info`, `grounding_audit`, `updated_at`
- 对可变字段的每次更新，引擎应将先前值写入 ledger（保证审计可回放）。
```

### P10. `schemas/idea_core_rpc_v1.openrpc.json` — Add `campaign.init` empty-registry validation

```json
// File: schemas/idea_core_rpc_v1.openrpc.json
// Change: add a new error to campaign.init errors array
{ "code": -32016, "message": "empty_formalism_registry", "data": "No formalisms available after merging caller-provided and DomainPack registries. At least one formalism entry is required." }
```
