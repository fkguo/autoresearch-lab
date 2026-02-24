VERDICT: READY

## Blockers

No outright blockers remain. The critical items from this review cycle are well-addressed:

1. **`rank.compute` failure-reason decision tree is now MUST-level and deterministic.** The three-way triage (`no_scorecards` → `insufficient_dimensions` → `insufficient_nodes`) is clearly ordered in the OpenRPC description, the `x-error-data-contract.known_reasons` for `-32013` enumerates all three, and the prose in the architecture spec §2.3 item 1 matches. The "ignore failed scorecards" rule (only `status ∈ {complete, partial}` counts for `observed_keys`) is stated in both the spec and the OpenRPC `rank.compute` description. This is implementable as-is.

2. **Promotion/reduction provenance is machine-enforceable.** `promotion_result_v1.schema.json` requires `has_reduction_report` + conditional `reduction_audit_summary` via `allOf`/`if`/`then`. The `idea_handoff_c2_v1.schema.json` mirrors this with its own conditional requiring `reduction_audit.status == "pass"` when `reduction_report` is non-null. Both artifacts travel with the handoff. Good.

3. **`$ref` closure is verifiable.** All 41 schema files are included; every `$ref` in the OpenRPC document (campaign_charter_v1, seed_pack_v1, budget_envelope_v1, budget_limit_v1, elo_config_v1, evaluator_config_v1, idea_list_filter_v1, idea_node_v1, campaign_status_v1, campaign_init_result_v1, campaign_mutation_result_v1, search_step_result_v1, node_list_result_v1, promotion_result_v1, eval_result_v1, ranking_result_v1, idempotency_meta_v1, rpc_error_data_v1, budget_snapshot_v1, island_state_v1, formalism_registry_v1, abstract_problem_registry_v1, budget_topup_v1) resolves to an included file. Transitive refs (e.g., `idea_node_v1` → `rationale_draft_v1`, `idea_card_v1`, `reduction_report_v1`, `reduction_audit_v1`, `novelty_delta_table_v1`) also close. No dangling `$ref`.

## Non-blocking

### 1. `rank.compute` evaluation-order ambiguity under edge composition

The spec says check (1) `no_scorecards`, (2) `insufficient_dimensions`, (3) `insufficient_nodes` — but the OpenRPC description text interleaves the node-count check. Recommend making the priority order a numbered list in the OpenRPC `description` to remove any implementation wiggle room. Current prose is *sufficient* but could be clearer.

### 2. `rank.compute` single-node Pareto is allowed but semantically odd

The spec explicitly allows `method=pareto` with 1 node (rank=1). This is technically consistent but produces a trivially degenerate front. Consider whether a `warning` field in `ranking_result_v1` would be useful for downstream consumers (adapter/human) — not a blocker, but a usability concern.

### 3. `reduction_audit_v1.schema.json` "all pending" → `partial` logic is complex

The `allOf` chain encoding "all assumptions are `pending_verification` (none `satisfied`, none `violated`) + `reduction_type_valid=true` + `toy_check ∈ {pass, skipped}` → status must be `partial`" is correct but fragile under JSON Schema evaluation semantics. The five-way `allOf` in the "then" clause has no explicit negation of `satisfied` — it uses `not.contains` for both `satisfied` and `violated`. This means a mix of `satisfied` + `pending_verification` (no `violated`) doesn't trigger this constraint, which is correct (it falls through to being allowed as `partial` or `pass`). But a test suite should explicitly cover: (a) all-satisfied → pass, (b) all-pending → partial, (c) mix satisfied+pending → partial, (d) any violated → fail. The schema alone doesn't enforce (c) → partial; an implementation could claim `pass` for a mix. This is a **schema expressiveness gap** worth noting.

### 4. Missing `campaign_status` field in `campaign_status_v1.schema.json` for `rank.compute` error responses

When `rank.compute` fails with `insufficient_eval_data`, the error response has no campaign status attached. The adapter must make a separate `campaign.status` call. This is fine architecturally but worth documenting as a pattern (error responses don't carry campaign state snapshots).

### 5. `idea_list_filter_v1` has no `has_eval_info` filter

For `rank.compute`'s common use-case ("rank only nodes that have been evaluated"), the adapter must rely on the engine's internal filtering by scorecard existence. A `has_eval_info: boolean` filter would make the adapter's intent explicit and reduce round-trips. Low priority but worth adding in v0.3.

### 6. Scorecard `status=failed` definition is implicit

The spec says to ignore `failed` scorecards for `observed_keys`, but `idea_scorecards_v1.schema.json` doesn't define what causes a scorecard to be `failed` vs `partial`. This is an evaluator implementation detail, but a one-sentence normative note would help.

### 7. `distributor_event_v1.schema.json` has `rng_alg` in config but not in events

The per-event schema records `rng_seed_used` but doesn't echo `rng_alg`. For full replay fidelity, the event should either echo `rng_alg` or explicitly declare "refer to config". Minor.

### 8. `idea_handoff_c2_v1.schema.json` doesn't include `reduction_report`/`reduction_audit` as required when present

Wait — it does, via `allOf`/`if`/`then`. But it doesn't make `reduction_report`/`reduction_audit` top-level `required` (they're optional). The conditional logic is correct: if `reduction_report` is non-null, then `reduction_audit` must be present and pass. But a consumer doing naive required-field checking won't see them. This is fine for schema-aware consumers. No action needed.

### 9. No explicit `rank.compute` dimension-selection determinism guarantee

When `dimensions` is omitted, the effective dimensions come from `observed_keys` across scorecards. If a new `eval.run` happens between two `rank.compute` calls (different idempotency keys), the dimension set can change. The `scorecards_artifact_ref` param helps pin this, but the spec doesn't say what happens if the ref points to a stale/nonexistent artifact. Suggest: engine MUST reject with `schema_validation_failed` if `scorecards_artifact_ref` is provided but not resolvable.

### 10. `eval.run` atomicity + batch size

Batch cap is 100 nodes (`maxItems: 100`), and atomicity is all-or-nothing. For large eval batches near budget boundaries, the engine might need to pre-check budget feasibility for 100 evals before starting. The spec doesn't require a pre-check, just rollback on failure. This is fine but implementers should note the cost of rollback grows with batch size.

## Real-research fit

This design is **unusually well-suited** for real HEP research workflows. Specific strengths:

1. **Evidence-first provenance chain**: The `claim → evidence_uris → grounding_audit → promotion gate` pipeline directly maps to how theoretical physics papers are actually validated. The requirement for active URI resolution (INSPIRE/DOI lookup, not just format checks) is critical — phantom citations are a real problem in LLM-generated content.

2. **Reduction/transplant operators with toy-check gates**: The `ProblemReduction` → `reduction_report` → `reduction_audit` pipeline captures a genuine discovery pattern in theoretical physics (e.g., recognizing that a scattering amplitude problem reduces to a known combinatorial identity, or that a BSM model's parameter space exploration reduces to a constrained optimization problem with known algorithms). The toy-check requirement prevents "impressive-sounding but vacuous" reductions.

3. **Novelty delta table**: The `non_novelty_flags` enum (`parameter_tuning_only`, `relabeling_only`, `equivalent_reformulation`, `no_new_prediction`, `known_components_no_testable_delta`) captures the most common failure modes of LLM-generated "novel" physics ideas. This is the single most important anti-hallucination feature in the design.

4. **Multi-island search with operator diversity**: Mapping different discovery strategies (anomaly abduction, symmetry operations, limit exploration) to separate islands with independent stagnation detection prevents the mode collapse that would occur with a single-prompt brainstorm approach.

5. **Formalism registry → C2 handoff**: The requirement that `candidate_formalisms[]` must map to registered `formalism_id → {c2_schema_ref, validator, compiler}` ensures that ideas don't get "promoted" into method-design without a concrete computational pathway.

**Potential real-research friction points:**

- The `abstract_problem_registry` is powerful but requires careful curation. A poorly populated registry will cause `ProblemReduction` to fail at `reduction_type_valid` checks, potentially blocking genuinely novel reduction pathways. The merge semantics (caller entries take precedence) help, but the DomainPack default registry needs to be comprehensive enough to avoid false negatives.

- `folklore_risk_score` thresholds will need empirical calibration per subfield. What counts as "folklore" in hep-ph (e.g., "maybe there's a light scalar") is different from hep-th (e.g., "the landscape suggests..."). The design accommodates this via DomainPack-level configuration, but the threshold should be explicitly exposed as a campaign-level knob (currently it's implicit).

## Robustness & safety

### Hallucination mitigation: strong

The three-layer defense (grounding audit with active URI resolution → novelty delta table with non-novelty flags → Referee clean-room with structured debate) is comprehensive. The key insight — that hallucination in scientific contexts manifests as *plausible-sounding but ungrounded claims* and *trivial relabeling disguised as novelty* — is well-addressed.

### Idempotency: thorough but implementation-heavy

The RFC 8785 JCS + `payload_hash` + default-value-filling-before-hashing specification is the most rigorous idempotency contract I've seen in a research-system design. The "first response stored and replayed" semantics for non-deterministic operations (LLM generation) is exactly right. However, the implementation burden is significant — this is essentially building a reliable exactly-once delivery layer over stdio JSON-RPC. Implementers should consider using an existing idempotency store (e.g., SQLite with WAL) rather than building from scratch.

### Budget safety: well-designed

The multi-dimensional budget envelope with per-dimension exhaustion tracking, step-level fuses, and the `exhausted_dimensions` error data contract gives adapters precise information for recovery. The `degradation_order` is a nice touch for graceful degradation. The `status_priority` rule (budget exhaustion trumps policy early-stop) prevents ambiguous states.

### Campaign isolation: adequate for v0.x

Single-writer assumption is clearly stated. The `node_not_in_campaign` atomicity requirement (no partial writes on cross-campaign node references) is critical and well-specified. The `revision` field on `IdeaNode` provides a foundation for future optimistic concurrency control.

### Schema-level safety properties verified:

- `reduction_audit_v1`: The `allOf` constraints correctly enforce that `violated` assumptions → `fail`, `reduction_type_valid=false` → `fail`, `toy_check=fail` → `fail`, and `pass` requires all assumptions `satisfied` + `toy_check=pass` + `reduction_type_valid=true`.
- `promotion_result_v1`: The `has_reduction_report=true ↔ reduction_audit_summary≠null` biconditional is correctly encoded.
- `campaign_mutation_result_v1`: The transition constraints for each mutation type are correctly encoded (e.g., `topup` from `exhausted` can go to `running` or stay `exhausted`; `pause` from `running|early_stopped|exhausted` always goes to `paused`).

### Potential safety gap: `eval.run` doesn't validate node `idea_card` existence

A node without an `idea_card` (still at `RationaleDraft` stage) can be passed to `eval.run`. The evaluator might produce scores for unformalized nodes, which then feed into `rank.compute`. This isn't necessarily wrong (you might want to evaluate drafts for triage), but the spec should clarify whether this is intentional. If unformalized nodes get scored and ranked, they could theoretically be promoted (though `node.promote` would catch the missing `idea_card`). The risk is wasted compute on evaluation of nodes that can never be promoted.

## Specific patch suggestions

### 1. `schemas/idea_core_rpc_v1.openrpc.json` — `rank.compute` description: make priority order an explicit numbered list

**File**: `schemas/idea_core_rpc_v1.openrpc.json`  
**Location**: `methods[name=rank.compute].description`  
**Change**: Replace the current prose with a clearly numbered decision procedure:

```
"description": "Side-effecting. Only permitted when campaign status is running; otherwise campaign_not_active. Filter is applied within campaign scope. Definition: one search step is one SearchPolicy tick... [existing preamble]. MUST-level failure decision procedure (evaluate in this order; return the FIRST matching failure): (1) Compute observed_keys := set of distinct score keys across scorecards with status ∈ {complete, partial} for the resolved node set. Scorecards with status=failed MUST be ignored. If observed_keys is empty → return insufficient_eval_data (-32013) with error.data.reason=no_scorecards. (2) Compute effective_dimensions := (dimensions ∩ observed_keys) if dimensions provided, else observed_keys. If method=pareto and |effective_dimensions| < 2 → return insufficient_eval_data (-32013) with error.data.reason=insufficient_dimensions. (3) If method=pareto and |resolved_nodes| < 1, or method=elo and |resolved_nodes| < 2 → return insufficient_eval_data (-32013) with error.data.reason=insufficient_nodes. (4) If method=elo and elo_config is absent → return schema_validation_failed (-32002) with error.data.reason=elo_config_required. If method=pareto and elo_config is present → return schema_validation_failed (-32002) with error.data.reason=elo_config_unexpected. None of these failures MUST write ranking artifacts."
```

This makes the evaluation order unambiguous for implementers and test-writers.

### 2. `schemas/ranking_result_v1.schema.json` — add `effective_dimensions` and `scorecards_artifact_ref` fields

**File**: `schemas/ranking_result_v1.schema.json`  
**Change**: Add two fields to the `properties` and add `effective_dimensions` to `required`:

```json
"effective_dimensions": {
  "type": "array",
  "minItems": 1,
  "items": {
    "enum": ["novelty", "feasibility", "impact", "tractability", "grounding"]
  },
  "description": "The dimensions actually used for ranking (intersection of requested dimensions and observed scorecard keys). Enables downstream consumers to verify what was ranked on."
},
"scorecards_artifact_ref": {
  "type": "string",
  "format": "uri",
  "description": "Reference to the scorecards snapshot used for this ranking computation. Enables deterministic audit/replay."
}
```

Add `"effective_dimensions"` and `"scorecards_artifact_ref"` to the `required` array. This makes ranking results self-documenting and reproducible without requiring the consumer to reconstruct which dimensions were effective.

### 3. `schemas/reduction_audit_v1.schema.json` — add an explicit "mixed satisfied+pending → partial" constraint

**File**: `schemas/reduction_audit_v1.schema.json`  
**Change**: Add a clarifying constraint to the `allOf` array. The current schema doesn't enforce that a mix of `satisfied` + `pending_verification` (no `violated`) results in `partial` rather than `pass`. The existing `pass` constraint already prevents this (it requires all assumptions to be `satisfied`), but for defensive schema validation, add a comment in the `$comment` or `description`:

```json
"$comment": "Status decision tree: any violated → fail; reduction_type_valid=false → fail; toy_check=fail → fail; all satisfied + toy_check=pass + type_valid → pass; any pending_verification (no violated) → partial. The pass constraint (allOf item 5) enforces that pass requires NO pending_verification, which transitively ensures mixed satisfied+pending → partial. Test suites SHOULD cover: (a) all-satisfied → pass, (b) all-pending → partial, (c) mixed satisfied+pending → partial, (d) any violated → fail, (e) toy_check_skipped + all-satisfied → NOT pass (because toy_check must be pass for status=pass)."
```

### 4. `schemas/idea_core_rpc_v1.openrpc.json` — `rank.compute` add `scorecards_artifact_ref` validation

**File**: `schemas/idea_core_rpc_v1.openrpc.json`  
**Location**: `methods[name=rank.compute].params[name=scorecards_artifact_ref].description`  
**Change**: Append to the existing description:

```
"description": "Explicit reference to the scorecards artifact to rank against. If omitted, the engine SHOULD use the latest available scorecards for the campaign. Providing this enables deterministic ranking against a specific eval snapshot. If provided but the referenced artifact is not found or not resolvable within the campaign scope, the engine MUST return schema_validation_failed (-32002) with error.data.reason=schema_invalid."
```

### 5. `docs/plans/2026-02-12-idea-generator-architecture-spec.md` — add folklore_risk_score threshold as campaign-level knob

**File**: `docs/plans/2026-02-12-idea-generator-architecture-spec.md`  
**Location**: §4.2.1 (Grounding Audit Gate), item 4  
**Change**: Extend the folklore bullet:

```
4. **folklore 预筛**：产出 `folklore_risk_score ∈ [0,1]`；超过阈值则必须走 `A0-folklore` 人类裁定。阈值应作为 `CampaignCharter.extensions.folklore_risk_threshold`（默认 `0.7`，DomainPack 可覆盖）显式暴露，而非硬编码。
```

And in `schemas/campaign_charter_v1.schema.json`, document this as a recommended extension key (no schema change needed since `extensions` is already `additionalProperties: true`).

### 6. `schemas/distributor_event_v1.schema.json` — add `rng_alg` echo or explicit config reference

**File**: `schemas/distributor_event_v1.schema.json`  
**Change**: Add to `properties`:

```json
"rng_alg": {
  "type": "string",
  "minLength": 1,
  "description": "Echo of the RNG algorithm used for this decision (from distributor_policy_config_v1). Included for self-contained replay without requiring config dereference."
}
```

### 7. `docs/plans/2026-02-12-idea-generator-architecture-spec.md` — clarify eval.run on unformalized nodes

**File**: `docs/plans/2026-02-12-idea-generator-architecture-spec.md`  
**Location**: §6.1 (Evaluator), after "关键工程约束"  
**Change**: Add:

```
- `eval.run` 不要求节点已完成 IdeaCard 形式化（`idea_card` 可为 null）；但评估未形式化的节点应降低 `tractability`/`feasibility` 评分（因为缺少结构化可执行计划）。评估者应在 `eval_info.fix_suggestions[]` 中建议 `{failure_mode: "not_computable", suggested_action: "formalize to IdeaCard", target_field: "idea_card", priority: "critical"}`。
```

This makes the intended behavior explicit without adding a hard gate at eval time.

### 8. Minor: `schemas/idea_core_rpc_v1.openrpc.json` — add `-32013` to `rank.compute` error for `scorecards_artifact_ref` not found

Actually, this should be `-32002` (schema_validation_failed) as suggested in patch 4, not a new code. No additional change needed beyond patch 4.

---

**Summary**: The v38 bundle is ready for implementation. The `rank.compute` failure-reason decision tree is now deterministic and MUST-level. Promotion/reduction provenance is machine-enforceable through both `promotion_result_v1` and `idea_handoff_c2_v1` schemas. All `$ref` closures are verifiable. The non-blocking items above are quality-of-life improvements that can be addressed incrementally. The design's real-research fit is excellent, particularly the evidence-first provenance chain, novelty delta table anti-hallucination features, and the reduction/transplant audit pipeline.
