VERDICT: READY

## Blockers

**No hard blockers remain.** The previous critical issues have been addressed:

1. **`node_id` vs `idea_id` ambiguity** — ✅ Resolved. §5.2 now has an explicit disambiguation paragraph. `idea_node_v1.schema.json` requires both as separate UUID fields. `parent_node_ids[]` correctly references `node_id`. The `IdeaListFilter` allows filtering by either.

2. **Pagination** — ✅ Resolved. `node.list` has `cursor` + `limit` params; `NodeListResultV1` returns `cursor: string|null` + `total_count`.

3. **`eval.run` campaign scoping** — ✅ Resolved. `eval.run` now requires `campaign_id` as a parameter, and `EvalResultV1` echoes it back.

4. **`insufficient_eval_data` error** — ✅ Resolved. `rank.compute` declares error code `-32013` for this case.

5. **Schema SSOT** — ✅ Resolved. The spec has an explicit "契约 SSOT 规则（硬约束）" paragraph mandating `$ref`-only in the OpenRPC file, no copy-paste, and mechanical bundling only. The OpenRPC file's `components.schemas` section correctly uses `$ref` to sibling `.schema.json` files.

6. **`oneOf(null, object)` portability** — ✅ Resolved. `idea_node_v1.schema.json` uses `"oneOf": [{"$ref": "..."}, {"type": "null"}]` for `idea_card`, `eval_info`, and `grounding_audit`. This is the correct JSON Schema 2020-12 idiom (avoids the `type: ["object", "null"]` anti-pattern that some validators reject when combined with `$ref`).

7. **`step_id` in `SearchStepResult`** — ✅ Resolved. It is now `required`.

8. **`campaign_id` echo** — ✅ Resolved. `SearchStepResultV1`, `EvalResultV1`, and `RankingResultV1` all include `campaign_id` in their `required` arrays.

## Non-blocking

### NB-1: `search.step` missing `campaign_not_found` when `node_not_found` for targeted expansion

`search.step` currently only declares `budget_exhausted` and `campaign_not_found` errors. If a future extension allows targeting specific `node_id`s for expansion (e.g., "expand this node"), a `node_not_found` error will be needed. Not blocking because the current `search.step` params don't include `node_id`, but worth noting for v0.3.

### NB-2: `eval.run` should declare `node_not_found` error

If any `node_id` in the array doesn't exist, the caller needs a clear error. Currently `eval.run` only declares `budget_exhausted`, `schema_validation_failed`, and `campaign_not_found`. This is an oversight but not blocking if the engine silently skips missing nodes and reports them in the result — but that behavior isn't specified.

**Recommendation:** Add `{ "code": -32004, "message": "node_not_found" }` to `eval.run` errors.

### NB-3: `BudgetSnapshot` `wall_clock_s_remaining` and `steps_remaining` use `type: ["number", "null"]` / `type: ["integer", "null"]`

This is the JSON Schema shorthand form (type-as-array). While valid in 2020-12, it's less portable than the `oneOf` pattern used elsewhere in this bundle. For consistency, consider aligning with the `oneOf` pattern used in `idea_node_v1.schema.json`. Not blocking because all major validators handle both forms correctly.

### NB-4: `formalism_registry` param in `campaign.init` is not marked `required`

The spec's §7 says `candidate_formalisms[]` must come from the registry and `node.promote` must fail if not in registry. But if the registry isn't provided at `campaign.init` time, the engine either needs a built-in default or must defer validation to `node.promote` time. The current design is technically coherent (the registry can be loaded from DomainPack config), but the spec should clarify: is the RPC param the *override* or the *primary source*?

**Recommendation:** Add a sentence to the spec or a `description` in the OpenRPC param clarifying: "If omitted, the engine uses the DomainPack's default formalism registry."

### NB-5: `island_state_v1.schema.json` has no `team_policy_id` or role composition reference

§3.4 introduces Teams/Roles per island, but the `IslandState` schema has no field linking to team configuration. For observability (especially debugging stagnation), a `team_policy_id` or `active_roles[]` field would be valuable.

### NB-6: `EvaluatorConfig` `dimensions` enum is closed but spec mentions extensibility

The `dimensions` field uses a fixed `enum`. Adding a new domain's evaluation dimension (e.g., `mathematical_rigor` for math-physics) requires a schema version bump. Consider using `anyOf` with a known-values enum plus a `pattern`-matched string for domain-specific dimensions, or just document that adding dimensions requires a minor schema revision.

### NB-7: `eval_info.failure_modes` is `array<string>` (free-form) while `fix_suggestions[].failure_mode` is enum

This inconsistency means `failure_modes[]` can contain values not in the `fix_suggestions` enum. Either (a) make `failure_modes` also use the enum, or (b) clarify that `failure_modes` is a superset (free-text diagnostics) while `fix_suggestions` maps to actionable categories. The current design works but will cause confusion.

### NB-8: `RationaleDraft` `references` field is `format: "uri"` but `IdeaCard` `claims[].evidence_uris` is also `format: "uri"` — no dedup/normalization spec

When a `RationaleDraft` evolves into an `IdeaCard`, references should carry over. There's no specified normalization (e.g., INSPIRE recid vs arXiv ID vs DOI). This matters for grounding audit dedup. Consider adding a note about canonical URI forms.

### NB-9: Distributor softmax formula is in prose only

The softmax-bandit formula (`p_i = exp(s_i / T_model) / Σ_j exp(s_j / T_model)`) is described in prose but has no schema or config surface. The `BudgetEnvelope.extensions` could host `T_model` and EMA window, but this isn't specified. Fine for v0.2 as the Distributor is v0.3 deliverable, but the extensions field should be documented as the intended injection point.

### NB-10: `promotion_result_v1` `grounding_audit_summary` is a simplified subset of `IdeaNode.grounding_audit`

The promotion result has `status` + `folklore_risk_score` but omits `failures[]` and `timestamp`. For a failed promotion, the caller needs to know *why* grounding failed. Either inline the full `grounding_audit` structure or add a `failures_summary` field.

## Real-research fit

### Strengths

1. **Evidence-first is deeply embedded**: The claim-level provenance in `IdeaCard`, the grounding audit gate, the `support_type` taxonomy with conditional `verification_plan` requirements, and the active URI resolution requirement are all well-designed for real HEP research. This is not theater — a physicist would genuinely benefit from having `folklore_risk_score` and `closest_prior_uris` surfaced.

2. **Operator families map to actual research moves**: `AnomalyAbduction`, `SymmetryOperator`, `LimitExplorer`, and `RepresentationShift` are genuine discovery strategies in HEP-ph. The `ProtectiveBeltPatch` (Lakatos) operator is a thoughtful addition for BSM model building. The operator trace with `random_seed` and `prompt_snapshot_hash` enables meaningful reproducibility.

3. **Multi-island evolution with stagnation detection**: The state machine (SEEDING → EXPLORING → CONVERGING → STAGNANT → REPOPULATED/EXHAUSTED) maps well to how research groups actually explore a problem space. The `should_repopulate` and `migrate` interfaces are clean.

4. **The two-stage RationaleDraft → IdeaCard pipeline is research-appropriate**: It mirrors how physicists actually work (intuition → formalization) and the kill criteria requirement prevents premature commitment.

5. **Formalism registry → C2 handoff**: The `formalism_id → {c2_schema_ref, validator, compiler}` mapping is the right abstraction for ensuring that an idea is actually computable, not just "sounds good." The `estimated_difficulty` + `required_infrastructure` + `blockers` fields in `minimal_compute_plan` are realistic.

6. **Budget circuit breaker with degradation ordering**: Real research has resource constraints. The `degradation_order` enum with a sensible hierarchy (reduce eval → reduce islands → disable cross-domain → reduce population → early stop) is practical.

### Concerns

1. **`novelty_delta_table` is ambitious for automated evaluation**: Producing a genuinely useful `closest_prior` + `delta_statement` requires deep domain knowledge. In practice, LLM-generated novelty assessments tend to be either too generic or confidently wrong. The `verification_hook` field is a good safety net, but the spec should explicitly state that **human spot-checking of novelty assessments is expected in v0.2**, not just theoretically possible.

2. **`expert_consensus` as a `support_type`**: This is hard to ground automatically. Unlike `literature` or `data`, there's no URI that definitively establishes expert consensus. Consider adding guidance that `expert_consensus` claims require at least 2 independent review-level citations (e.g., PDG review chapters, Particle Physics Community Planning reports).

3. **Team/Role coordination modes need runtime cost modeling**: "Parallel Divergence" with N roles × M reviewers can explode token budgets. The spec should note that the Distributor's budget allocation must account for team topology (e.g., a 6-role sequential pipeline costs ~6× a single-role call per node).

## Robustness & safety

### Hallucination mitigation — well designed

- **Active URI resolution** (not just regex) for claims: ✅ Correct approach
- **Conditional `verification_plan`** for `llm_inference`/`assumption`: ✅ Forces transparency
- **`folklore_risk_score` with human escalation**: ✅ Appropriate safety valve
- **Clean-room evaluation with structured debate**: ✅ Reduces groupthink/echo-chamber scoring
- **`prompt_snapshot_hash`** in operator trace: ✅ Enables auditing prompt drift

### Remaining safety gaps

1. **No schema-level constraint on `evidence_uris` minimum length for `literature`/`data`/`calculation`/`expert_consensus` support types**: The `allOf/if/then` block in `idea_card_v1.schema.json` correctly requires `minItems: 1` for these support types. ✅ This is actually handled.

2. **No rate limiting or retry semantics in the RPC spec**: If the engine makes external calls (INSPIRE API, DOI resolver) during grounding audit, there's no specified behavior for transient failures. Should a grounding audit be `partial` on network timeout? The `grounding_audit.failures[]` field can capture this, but the spec should state the policy.

3. **`prompt_snapshot_hash` is required in `origin` but optional (via `prompt_snapshot_hash` in `operator_trace`)**: The `origin.prompt_hash` is `required`, but the `operator_trace.prompt_snapshot_hash` is not. These serve different purposes (the origin hash is the top-level prompt; the trace hash is the operator-specific prompt). This is fine but should be documented.

4. **No versioning field on `IdeaNode`**: If a node's `eval_info` or `grounding_audit` is updated after creation (e.g., re-evaluation), there's no version counter or `updated_at` timestamp. The append-only ledger may compensate, but the node itself doesn't carry its mutation history.

## Specific patch suggestions

### Patch 1: Add `node_not_found` error to `eval.run`

**File:** `schemas/idea_core_rpc_v1.openrpc.json`  
**Location:** `methods[name="eval.run"].errors`  
**Change:** Append `{ "code": -32004, "message": "node_not_found" }` to the errors array.

```json
"errors": [
  { "code": -32001, "message": "budget_exhausted" },
  { "code": -32002, "message": "schema_validation_failed" },
  { "code": -32003, "message": "campaign_not_found" },
  { "code": -32004, "message": "node_not_found" }
]
```

### Patch 2: Add `failures_summary` to `PromotionResult` grounding audit

**File:** `schemas/promotion_result_v1.schema.json`  
**Location:** `properties.grounding_audit_summary.properties`  
**Change:** Add `failures` array for actionable diagnostics on promotion failure:

```json
"grounding_audit_summary": {
  "type": "object",
  "required": ["status"],
  "properties": {
    "status": { "enum": ["pass", "fail", "partial"] },
    "folklore_risk_score": { "type": "number", "minimum": 0, "maximum": 1 },
    "failures": {
      "type": "array",
      "items": { "type": "string" },
      "description": "Summary of grounding failures that blocked promotion."
    }
  },
  "additionalProperties": false
}
```

Note: also add `"partial"` to the `status` enum to align with `IdeaNode.grounding_audit.status`.

### Patch 3: Add `updated_at` to `IdeaNode` for mutation tracking

**File:** `schemas/idea_node_v1.schema.json`  
**Location:** `properties` (add after `created_at`)  
**Change:**

```json
"updated_at": { "type": "string", "format": "date-time", "description": "Timestamp of last mutation (eval_info update, grounding re-audit, etc.)." }
```

### Patch 4: Add `team_policy_id` to `IslandState` for observability

**File:** `schemas/island_state_v1.schema.json`  
**Location:** `properties`  
**Change:**

```json
"team_policy_id": {
  "type": "string",
  "minLength": 1,
  "description": "Reference to the TeamPolicy governing role composition and coordination on this island."
}
```

(Not added to `required` since it's optional for implementations that don't use the team/role subsystem yet.)

### Patch 5: Clarify `formalism_registry` optionality in OpenRPC

**File:** `schemas/idea_core_rpc_v1.openrpc.json`  
**Location:** `methods[name="campaign.init"].params[name="formalism_registry"]`  
**Change:** Add description:

```json
{
  "name": "formalism_registry",
  "schema": { "$ref": "#/components/schemas/FormalismRegistryV1" },
  "description": "Override or supplement the DomainPack default formalism registry. If omitted, the engine uses the DomainPack built-in registry. If provided, entries are merged (caller entries take precedence on formalism_id collision)."
}
```

### Patch 6: Add guidance on `expert_consensus` evidence requirements

**File:** `schemas/idea_card_v1.schema.json`  
**Location:** `properties.claims.items.properties.support_type`  
**Change:** Enhance the description:

```json
"support_type": {
  "enum": ["literature", "data", "calculation", "llm_inference", "assumption", "expert_consensus"],
  "description": "Source category. 'expert_consensus' should be backed by ≥1 review-level reference (PDG review, SPIRES review, community white paper) in evidence_uris."
}
```

### Patch 7: Normalize `failure_modes` to use enum or explicitly document the divergence

**File:** `schemas/idea_node_v1.schema.json`  
**Location:** `properties.eval_info.oneOf[1].properties.failure_modes`  
**Change:** Either align with the fix_suggestions enum or add a description:

```json
"failure_modes": {
  "type": "array",
  "items": { "type": "string" },
  "description": "Superset of failure modes (may include free-text diagnostics beyond the fix_suggestions enum). Structured actionable failures should appear in fix_suggestions; this field captures all detected issues including informational ones."
}
```

### Patch 8: Add cost-awareness note for team topology in spec prose

**File:** `docs/plans/2026-02-12-idea-generator-architecture-spec.md`  
**Location:** §3.4.3, after the "关键纪律" paragraph  
**Change:** Add:

```markdown
> **成本感知约束**：Team topology 的 token 消耗大致为 `Σ(roles) × per-role-cost`；Distributor 在分配预算时必须将 team composition 纳入每步成本估算（而非假设每步 = 1 次 LLM 调用）。`BudgetEnvelope.extensions` 可承载 `team_cost_multiplier` 等运行时参数。
```

### Patch 9: Align `BudgetSnapshot` nullable fields with `oneOf` pattern

**File:** `schemas/budget_snapshot_v1.schema.json`  
**Location:** `properties.wall_clock_s_remaining` and `properties.steps_remaining`  
**Change:** For consistency with the bundle's `oneOf` pattern:

```json
"wall_clock_s_remaining": {
  "oneOf": [{ "type": "number", "minimum": 0 }, { "type": "null" }],
  "description": "null if max_wall_clock_s was not set in the BudgetEnvelope."
},
"steps_remaining": {
  "oneOf": [{ "type": "integer", "minimum": 0 }, { "type": "null" }],
  "description": "null if max_steps was not set in the BudgetEnvelope."
}
```

### Patch 10: Add `n_steps` default and `campaign_id` to `search.step` idempotency scope note

**File:** `schemas/idea_core_rpc_v1.openrpc.json`  
**Location:** `methods[name="search.step"].params[name="n_steps"]`  
**Change:** Add default:

```json
{ "name": "n_steps", "schema": { "type": "integer", "minimum": 1, "default": 1 }, "description": "Number of search steps to execute. Defaults to 1." }
```

---

**Summary:** The bundle is in good shape. The previous blockers are cleanly resolved. The schemas are machine-enforceable, the SSOT rule is explicit, and the `$ref` wiring is correct. The 10 patches above are minor improvements — none is a blocker. The design is genuinely research-appropriate for HEP and the extensibility seams (DomainPack, extensions fields, operator families) are well-placed for future domain expansion.
