VERDICT: NOT_READY

## Blockers

### B1. `campaign_mutation_result_v1.schema.json` — `allOf` constraints for `pause` are over-constrained and reject valid transitions

The spec (§2.4) says `campaign.pause` accepts `running|early_stopped|exhausted → paused`. But the schema's `allOf` block for `mutation=pause` forces `transition.changed: true` **always**. This is correct for the three allowed source states, but there is a subtle issue: the idempotency replay path. On a duplicate hit (`is_replay=true`), the engine replays the original response verbatim (including `transition`). This is fine. However, the spec never addresses what happens if `campaign.pause` is called when the campaign is **already paused** — the OpenRPC `description` says "Otherwise campaign_not_active", which implies `paused → paused` is rejected. But the spec in §2.4 does not list `paused` in the allowed source states for `campaign.pause`, while the OpenRPC description only lists `running|early_stopped|exhausted`. **This is consistent but undocumented in the state machine table.** Mark this as "needs explicit rejection row" for testability.

**Actual blocker**: The `campaign.pause` `allOf` constraint hard-codes `previous_status: {"enum": ["running","early_stopped","exhausted"]}` and `current_status: {"const": "paused"}` and `changed: {"const": true}`. If the engine ever returns a `pause` mutation result on an idempotency replay where the campaign has since been resumed and re-paused, the replayed response's `previous_status` from the first call is correct, but this is fragile. Not a schema blocker per se, but **the schema does not model the "already paused → error" rejection**, which means an implementer could mistakenly try to return a success result with `previous_status: "paused"` and the schema would reject it. This is actually correct behavior (the RPC should error), but it needs an explicit note.

**Real blocker**: More critically, the `campaign.resume` `allOf` constraint forces `previous_status: {"enum": ["paused","early_stopped"]}` but the spec says `exhausted → budget_exhausted (error)`. If the engine erroneously returns a success for `resume` from `exhausted`, the schema would allow it since there's no constraint blocking it — the `allOf/if` only fires when `mutation=resume`, and the `previous_status` enum doesn't include `exhausted`, so a non-matching `if` means the `then` is vacuously true. **The schema fails open on unexpected transitions.** The schema should add explicit `not` constraints or the `if` conditions should be exhaustive.

### B2. `rank.compute` — Pareto with 1 node + 1 dimension is under-specified

The spec §2.3 says: "For method=pareto, the filter MUST resolve to >= 1 node (a single node is allowed and yields rank=1)." The OpenRPC description adds: "For method=pareto, effective dimension count MUST be >= 2." But the `ranking_result_v1.schema.json` has `ranked_nodes.minItems: 1`, and the Pareto algorithm with a single node and ≥2 dimensions is trivially rank=1. **However**, the schema does not enforce `pareto_front` is required when `method=pareto` (it's optional). An implementation could omit it. This should be required for Pareto results to be machine-useful.

### B3. `eval_result_v1.schema.json` — Missing atomicity enforcement in schema

The description says "updated_node_ids MUST be set-equal to node_ids" on success, but the schema has no `allOf`/`if-then` to enforce this. An engine returning `node_ids: ["a","b"]` and `updated_node_ids: ["a"]` would pass schema validation. This violates the stated invariant. **Add a schema-level enforcement or at minimum an `$comment` acknowledging this is a runtime-only invariant and add it to the conformance test checklist.**

### B4. `search_step_result_v1.schema.json` — `n_steps_executed: 0` with `new_node_ids: []` and `early_stopped: false` is valid but semantically nonsensical

The schema allows `n_steps_executed: 0` + `early_stopped: false`, which would mean "I did nothing but I didn't stop early either." This should be constrained: if `n_steps_executed < n_steps_requested` then `early_stopped` MUST be `true`. Add an `allOf` conditional.

### B5. No `campaign.init` idempotency replay edge case for `formalism_registry` merge

The spec says `campaign.init` with an optional `formalism_registry` that gets merged with the DomainPack default. But the idempotency payload hash includes all params (excluding `idempotency_key`). If the DomainPack default changes between deployments (e.g., a new formalism is added), a replayed `campaign.init` with the same `idempotency_key` and same caller params would return the old response — but the merged registry from the first call is stale. **The spec must clarify: is the DomainPack default considered part of the "engine state" (not hashed) or part of the "payload" (hashed)?** Current design implies only caller params are hashed, so this is consistent but the staleness risk needs documentation.

### B6. `idea_card_v1.schema.json` — `candidate_formalisms` pattern is strict but `formalism_registry_v1.schema.json` pattern matches the same — no cross-validation at schema level

Both use `^[a-z0-9_-]+\\/[a-z0-9_.-]+$`. This is fine for format, but there is **no schema-level mechanism to validate that `candidate_formalisms` entries exist in the registry**. This is acknowledged as a runtime check. Not a schema blocker, but the conformance test suite MUST include this cross-validation. **Promote to blocker because without this test, the grounding gate is bypassable.**

Actually, since the spec says `node.promote` MUST fail with `formalism_not_in_registry` if formalisms aren't in the registry, this is enforced at the RPC level. Downgrading to non-blocking but flagging for the test plan.

### B7. `budget_snapshot_v1.schema.json` — `wall_clock_s_remaining` semantics under idempotency replay are paradoxical

The spec says idempotency replay returns the first-call snapshot. `wall_clock_s_remaining` in the replayed response will be stale (it was computed at first-call time). The spec acknowledges this ("callers MUST use campaign.status for current budget") but `wall_clock_s_remaining` is particularly misleading because it's monotonically decreasing by real-time passage, unlike tokens/cost which only change on operations. **The spec should explicitly call out wall_clock as the most-likely-stale dimension on replay** and recommend adapters NEVER rely on replayed `wall_clock_s_remaining`.

## Non-blocking

### N1. OpenRPC version claim `1.2.6` — OpenRPC spec only goes up to `1.3.2`
The `"openrpc": "1.2.6"` is a valid version but old. Consider `1.3.2` for latest features (e.g., `x-` extension formalization).

### N2. `idea_selection_v1.schema.json` — `anyOf` allows all three arrays to be present simultaneously
The `anyOf` constraint allows `selected + rejected + deferred` all non-empty, which is fine, but a node could theoretically appear in multiple arrays. Add a `$comment` noting that `selected_node_ids ∩ rejected_node_ids ∩ deferred_node_ids = ∅` is a runtime invariant.

### N3. `campaign_charter_v1.schema.json` — `scope` has `minLength: 10` but no `maxLength`
A runaway scope string could be problematic. Consider `maxLength: 10000` or similar.

### N4. `seed_pack_v1.schema.json` — `seed_type` is free-text
No enum constraint on `seed_type`. Consider at least a recommended enum (`c1_gap | pdg_tension | kb_prior | user_seed | hepdata_anomaly`) with `additionalProperties` for extension.

### N5. `idea_node_v1.schema.json` — `origin.role` is free-text
Should reference the role enum from §3.4.2 (Ideator, Librarian, Formalizer, Derivation, Coder, Checker, Referee, Editor) as a recommended enum, even if extensible.

### N6. `budget_topup_v1.schema.json` — `add_tokens` minimum is 1 but `add_cost_usd` uses `exclusiveMinimum: 0`
Inconsistent: `add_tokens: {"minimum": 1}` means ≥1, while `add_cost_usd: {"exclusiveMinimum": 0}` means >0. Both exclude zero, but the style is inconsistent. Normalize to one pattern.

### N7. Missing `campaign_id` in `campaign.init` idempotency dedupe scope
The spec and OpenRPC correctly note `campaign.init` dedupes by `(method, idempotency_key)` without `campaign_id`. But the `idempotency_meta_v1.schema.json` doesn't have a `campaign_id` field — it's only in the result. This is correct since the init creates the campaign_id. No issue, just confirming.

### N8. `node_mutation_log_v1.schema.json` — No max size constraint on `mutations` array
For a multi-tick step that mutates many nodes, the mutation log could be large. Consider recommending a bounded size or pagination/artifact-splitting strategy.

### N9. `idea_evidence_graph_v1.schema.json` — Node `id` is `string` but node_id elsewhere is `uuid`
The evidence graph uses `"id": {"type": "string"}` for its nodes, while IdeaNode uses UUID. This is intentional (evidence graph nodes can be claims, not just idea nodes), but the type mismatch could cause integration confusion. Add `$comment`.

### N10. `evaluator_config_v1.schema.json` — `weights` keys are not constrained to match `dimensions`
A caller could provide `weights: {"nonexistent_dim": 1.0}`. Add a `$comment` noting that effective weights MUST be intersected with `dimensions` at runtime.

### N11. `island_state_v1.schema.json` — Missing `operator_ids` or operator distribution info
The spec says islands correspond to operator/constraint configurations, but the schema only exposes `team_policy_id`. For observability, consider adding `active_operator_ids` or `operator_distribution`.

### N12. `campaign_status_v1.schema.json` — `early_stop_reason` required when `status=early_stopped` via `allOf`, but `idea_campaign_v1.schema.json` does not have the same conditional
The campaign artifact schema has `early_stop_reason` as optional without the conditional `allOf`. Add the same `if/then` or reference the campaign_status schema.

### N13. `search_step_result_v1.schema.json` — `new_nodes_artifact_ref` conditional only fires on non-empty array
The `allOf` condition `{"if": {"properties": {"new_node_ids": {"type": "array", "minItems": 1}}}}` — this `if` will **always** match because `new_node_ids` is required and is always an array. The `minItems: 1` inside `if.properties` doesn't work as a conditional check in JSON Schema; it acts as a schema that the value must match, so an empty array would fail the `if` and the `then` wouldn't apply. This actually works correctly in JSON Schema 2020-12. Confirmed: no issue.

### N14. `rank.compute` — `scorecards_artifact_ref` and `dimensions` are optional but their interaction is under-specified
If `dimensions` is provided but `scorecards_artifact_ref` is omitted, the engine must still find scorecards that cover those dimensions. If the latest scorecards don't cover a requested dimension, should the engine fail with `insufficient_eval_data`? Clarify.

## Real-research fit

### R1. Evidence-first HEP workflow — strong fit
The grounding audit gate with active URI resolution (INSPIRE API, DOI resolver) is the right approach for HEP. The claim-level provenance in `IdeaCard.claims[]` with `support_type` discrimination and mandatory `verification_plan` for LLM inferences is exactly what's needed to prevent citation hallucination — a critical failure mode in LLM-driven physics research.

### R2. Operator families map well to actual physics discovery patterns
`AnomalyAbduction`, `SymmetryOperator`, `LimitExplorer` directly correspond to how theorists actually work. The `CrossDomainAnalogy` with mandatory mapping tables is particularly well-designed — it forces the kind of rigorous analogy that distinguishes real insights from superficial pattern-matching.

### R3. Novelty delta table addresses a real problem
The `non_novelty_flags` (parameter_tuning_only, relabeling_only, etc.) directly target the "salami-slicing" failure mode where LLMs generate variations that look different but have no new physics content. This is the right granularity.

### R4. Multi-island + Team topology — ambitious but well-scoped
The mapping of `island_id` to both search strategy and team composition is a clean abstraction. The clean-room default for evaluators prevents the "echo chamber" failure mode. The explicit debate protocol (point/counterpoint + evidence_uris) mirrors how real referee processes work.

### R5. Formalism registry enables real C2 handoff
The `formalism_id → {c2_schema_ref, validator, compiler}` mapping is essential. Without this, "method design" downstream would need to re-derive what computational framework applies. This is the kind of detail that makes the difference between a toy system and one that actually produces executable research plans.

### R6. Missing: experimental landscape awareness
The seed sources include PDG tensions and HEPData, but there's no explicit mechanism for tracking the **experimental schedule** (e.g., "LHCb Run 3 will have 10x statistics in channel X by 2027"). Ideas that are testable but not timely are less valuable. Consider adding a `timeliness` dimension to the evaluator or a `experimental_schedule` field to seeds.

### R7. Missing: failure memory across campaigns
The spec is campaign-scoped. There's no mechanism for cross-campaign learning ("idea X was tried in campaign C1 and failed grounding audit because..."). This is acknowledged as v0.3+ but should be flagged as a real research limitation: physicists maintain institutional memory across projects.

## Robustness & safety

### S1. Idempotency design is thorough and well-specified
The RFC 8785 JCS canonicalization, payload hash verification, default-value filling before hashing, and the explicit "first response stored + replayed" semantics for non-deterministic operations (LLM generation) are all correct and necessary. The explicit handling of failed-response replay is particularly important.

### S2. Idempotency + side-effect atomicity consistency requirement is the right call
The requirement that "idempotency record commit and side-effects MUST be in the same logical commit" prevents the most dangerous failure mode (side-effects committed but idempotency not recorded → retry causes double-write). For a JSONL-backed store, this requires careful implementation (write both atomically, e.g., fsync after combined write).

### S3. Budget circuit breaker is well-designed but wall_clock enforcement is hard
`wall_clock_s` remaining is inherently racy (time passes between check and action). The spec should note that wall_clock enforcement is best-effort and implementations SHOULD use a conservative margin (e.g., check `remaining > estimated_tick_cost * 1.5`).

### S4. Tick atomicity ("all-or-nothing") is essential but expensive for LLM calls
If a tick involves multiple LLM calls (Team topology with Ideator + Librarian + Formalizer), and the Formalizer call fails mid-way, all previous LLM outputs in that tick must be discarded (rolled back). This means tokens/cost are consumed but not reflected in artifacts. The budget accounting should still count these consumed tokens. **The spec should clarify: does a rolled-back tick's token consumption count against the budget?** If not, a pathological loop of failing ticks could consume unbounded tokens.

### S5. Campaign isolation is strong but cross-campaign seed sharing is unspecified
If a human wants to seed campaign B with a node from campaign A, there's no `node.export` or `seed.import_from_campaign` RPC. The workaround (manually extract IdeaCard, create new seed) works but loses lineage. This is a v1.0 concern.

### S6. `idea_handoff_c2_v1.schema.json` — `grounding_audit.status` and `formalism_check.status` are both `const: "pass"`
This is correct (only passed nodes should be in handoff artifacts), but it means the schema itself acts as a gate. Any schema-valid handoff artifact is guaranteed to have passed both checks. This is a strong safety property.

### S7. Hallucination mitigation layers are well-stacked
1. Claim-level provenance with `support_type` discrimination
2. Active URI resolution (not just format check)
3. Data consistency check against PDG/HEPData
4. Mandatory `verification_plan` for LLM inferences
5. Folklore risk scoring with human escalation
6. Clean-room multi-agent evaluation
7. Novelty delta table with non-novelty flags

This is one of the most thorough anti-hallucination stacks I've seen in an AI-assisted research system.

## Specific patch suggestions

### P1. `schemas/search_step_result_v1.schema.json` — Add early_stopped invariant when n_steps < requested

**File**: `schemas/search_step_result_v1.schema.json`  
**What**: Add to the `allOf` array:
```json
{
  "$comment": "If fewer steps were executed than requested and early_stopped is false, the result is semantically invalid. Enforce early_stopped=true when n_steps_executed < n_steps_requested.",
  "if": {
    "required": ["n_steps_requested", "n_steps_executed"],
    "not": {
      "properties": {
        "n_steps_executed": { "$data": "1/n_steps_requested" }
      }
    }
  }
}
```
Since JSON Schema doesn't support `$data` cross-field references in 2020-12, instead add a `$comment` and move this to the conformance test suite:
```json
{
  "$comment": "RUNTIME INVARIANT (not expressible in JSON Schema): if n_steps_executed < n_steps_requested, then early_stopped MUST be true. Enforce in conformance tests."
}
```

### P2. `schemas/campaign_mutation_result_v1.schema.json` — Add explicit `$comment` about fail-open on unexpected transitions

**File**: `schemas/campaign_mutation_result_v1.schema.json`  
**What**: Add at the top-level:
```json
"$comment": "WARNING: allOf/if-then constraints are NOT exhaustive for all (mutation, previous_status) combinations. If a (mutation, previous_status) pair does not match any 'if' condition, the 'then' is vacuously satisfied. Implementers MUST NOT rely solely on schema validation for state-machine correctness; the conformance test suite must cover all valid and invalid transitions."
```

### P3. `schemas/eval_result_v1.schema.json` — Add `$comment` for set-equality invariant

**File**: `schemas/eval_result_v1.schema.json`  
**What**: Add to the schema:
```json
"$comment": "RUNTIME INVARIANT (not expressible in JSON Schema): on success, set(updated_node_ids) == set(node_ids) and set(node_revisions.keys()) == set(node_ids). Enforce in conformance tests."
```

### P4. `schemas/idea_campaign_v1.schema.json` — Add `early_stop_reason` conditional like `campaign_status_v1`

**File**: `schemas/idea_campaign_v1.schema.json`  
**What**: Add `allOf` block:
```json
"allOf": [
  {
    "if": { "properties": { "status": { "const": "early_stopped" } }, "required": ["status"] },
    "then": { "required": ["early_stop_reason"] }
  }
]
```

### P5. `schemas/budget_topup_v1.schema.json` — Normalize minimum style

**File**: `schemas/budget_topup_v1.schema.json`  
**What**: Change `add_cost_usd` from `{"exclusiveMinimum": 0}` to `{"minimum": 0.01}` (or document why the styles differ). Similarly for `add_wall_clock_s`. Alternatively, change `add_tokens`/`add_steps`/`add_nodes` to `{"exclusiveMinimum": 0}` for consistency. The key is: pick one convention and stick with it across all budget schemas.

### P6. `schemas/ranking_result_v1.schema.json` — Require `pareto_front` for method=pareto

**File**: `schemas/ranking_result_v1.schema.json`  
**What**: Add to the `allOf` array:
```json
{
  "if": { "properties": { "method": { "const": "pareto" } }, "required": ["method"] },
  "then": {
    "properties": {
      "ranked_nodes": {
        "items": { "required": ["node_id", "rank", "pareto_front"] }
      }
    }
  }
}
```
And symmetrically for Elo:
```json
{
  "if": { "properties": { "method": { "const": "elo" } }, "required": ["method"] },
  "then": {
    "properties": {
      "ranked_nodes": {
        "items": { "required": ["node_id", "rank", "elo_rating"] }
      }
    }
  }
}
```

### P7. `schemas/seed_pack_v1.schema.json` — Add recommended `seed_type` enum

**File**: `schemas/seed_pack_v1.schema.json`  
**What**: Change `seed_type` from `{"type": "string", "minLength": 1}` to:
```json
"seed_type": {
  "type": "string",
  "minLength": 1,
  "description": "Recommended values: c1_gap | pdg_tension | kb_prior | user_seed | hepdata_anomaly | literature_gap | cross_domain_hint. Custom values are allowed for DomainPack extensions."
}
```
Or better, use `examples` (JSON Schema 2020-12 supports it):
```json
"seed_type": {
  "type": "string",
  "minLength": 1,
  "examples": ["c1_gap", "pdg_tension", "kb_prior", "user_seed", "hepdata_anomaly"]
}
```

### P8. `schemas/idea_node_v1.schema.json` — Add recommended `origin.role` enum

**File**: `schemas/idea_node_v1.schema.json`  
**What**: Change `origin.role` to include recommended values:
```json
"role": {
  "type": "string",
  "minLength": 1,
  "description": "Physicist role/persona that produced this node. Recommended values: Ideator, Librarian, Formalizer, Derivation, Coder, Checker, Referee, Editor. Custom roles are allowed for Team extensions.",
  "examples": ["Ideator", "Librarian", "Formalizer", "Derivation", "Coder", "Checker", "Referee", "Editor"]
}
```

### P9. `docs/plans/2026-02-12-idea-generator-architecture-spec.md` — Add wall_clock staleness warning to §2.4

**File**: `docs/plans/2026-02-12-idea-generator-architecture-spec.md`  
**What**: In the "Idempotency replay" bullet under §2.4, after "调用方应显式调用 `campaign.status`", add:
```
- **特别注意 `wall_clock_s_remaining`**：由于时间在 replay 间持续流逝，回放的 `wall_clock_s_remaining` 几乎一定是过期的。adapter 在做预算决策时 **禁止**依赖 replay 响应中的 `wall_clock_s_remaining`，必须调用 `campaign.status` 获取实时值。
```

### P10. `docs/plans/2026-02-12-idea-generator-architecture-spec.md` — Clarify rolled-back tick budget accounting (§3.2.1 / §3.3)

**File**: `docs/plans/2026-02-12-idea-generator-architecture-spec.md`  
**What**: Add to the "tick 原子性" bullet in §2.3 (`search.step` description):
```
- **回滚 tick 的预算计量（必须明确）**：若某 tick 在执行过程中失败并回滚（如 Team 中某 role 的 LLM 调用失败），该 tick 消耗的 token/cost **必须**仍计入 `BudgetSnapshot`（因为 LLM 调用已实际发生且不可撤回），但 `steps_used` 和 `nodes_used` **不得**递增（因为 tick 产物已回滚）。
```

### P11. `schemas/idea_core_rpc_v1.openrpc.json` — Add `rank.compute` error for `no_scorecards`

**File**: `schemas/idea_core_rpc_v1.openrpc.json`  
**What**: The `x-error-data-contract.known_reasons` already lists `no_scorecards` for `-32013`, but the `rank.compute` method's `description` doesn't explicitly call out this sub-reason. Add to the `rank.compute` description:
```
If no scorecards exist for the resolved node set, the engine MUST return insufficient_eval_data (-32013) with error.data.reason="no_scorecards".
```

### P12. `docs/plans/2026-02-12-idea-generator-architecture-spec.md` — Add conformance test plan reference

**File**: `docs/plans/2026-02-12-idea-generator-architecture-spec.md`  
**What**: Add a new §2.5 after §2.4:
```markdown
### 2.5 Conformance test plan（必须交付）

v0.2 必须交付 conformance test suite（至少 scenario-level），覆盖：
1. **State machine transitions**：所有 valid 迁移 + 所有 invalid 迁移（预期 error code + reason）
2. **Idempotency**：首次执行 / duplicate hit（is_replay=true）/ payload conflict（idempotency_key_conflict）/ error replay
3. **Campaign scoping**：node_not_in_campaign / 跨 campaign 泄漏检测
4. **Budget fuse**：step_budget exhaustion / global exhaustion / topup → running transition
5. **Pagination**：default limit=50 / max limit=500 / cursor=null 终止
6. **Atomicity**：eval.run partial failure → no writes / tick rollback → budget accounting
7. **Grounding gate**：promote with pass/fail/partial grounding → success/error
8. **Ranking guards**：pareto with <2 dimensions / elo with <2 nodes / missing scorecards → insufficient_eval_data + correct reason
9. **Runtime invariants**：eval_result set-equality / search_step early_stopped consistency
```
