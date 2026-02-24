VERDICT: NOT_READY

## Blockers

### B1. `rank.compute(method=pareto)` minimum-dimension constraint is unenforceable from schema alone

The spec (§2.3 item 3, OpenRPC `rank.compute` description) states Pareto requires ≥2 score dimensions. But there is no way for the engine to know "how many dimensions are available" from the `rank.compute` request itself—it depends on the scorecards artifact. The `evaluator_config_v1.schema.json` is not a param of `rank.compute`, and `scorecards_artifact_ref` is optional. This means:

- If the engine "uses the latest scorecards," the dimension count is an implicit runtime property.
- The `insufficient_eval_data` error with `reason=insufficient_dimensions` is specified but **the trigger condition is ambiguous**: does "≥2 dimensions" mean ≥2 distinct keys in the scorecard's `scores` object, or ≥2 matching the original `evaluator_config.dimensions`?

**Fix**: Add an explicit `dimensions` (or `score_dimensions`) array param to `rank.compute` (optional, defaults to "all dimensions in the referenced scorecards"), so the engine can validate early and the contract is machine-testable. At minimum, the spec must define: "dimension count = number of distinct keys across `scorecard.scores` objects for the resolved node set."

### B2. `campaign.topup` to `early_stopped` state: spec says "does NOT change the status" but state machine says `early_stopped → (same state)` — yet `campaign.resume` from `early_stopped` checks budget

The spec (§2.4) says:
- `campaign.topup` on `early_stopped`: adds budget, does NOT change status
- `campaign.resume` from `early_stopped`: checks budget, rejects if exhausted

This creates a **dead-state trap**: if the campaign is `early_stopped` *and* budget is exhausted, you cannot `resume` (budget check fails) and `topup` won't move you to `running`. The only escape is `topup` then `resume`, but `topup` doesn't check whether the *reason* for early_stop was budget vs. policy stagnation. If a policy halted the campaign AND budget happened to be depleted, the user must:
1. `topup` (stays `early_stopped`)
2. `resume` (checks budget → now OK → `running`)

This works but is **not documented as a required workflow for this edge case**, and worse: after `resume`, the policy's stagnation counter hasn't been reset. The spec says `STAGNANT → REPOPULATED → EXPLORING` resets the counter, but `campaign.resume` doesn't trigger `REPOPULATED`. So the search will immediately re-trigger early_stop.

**Fix**: Document in §2.4 that `campaign.resume` from `early_stopped` MUST reset the policy early-stop trigger (or require a `search_policy_override` param), otherwise the state machine is a livelock. Also, add a test scenario: "early_stopped + budget_exhausted → topup → resume → verify not immediately re-stopped."

### B3. `eval.run` atomicity + idempotency creates an impossible implementation requirement for large batches

The spec requires:
- `eval.run` is atomic (all-or-nothing across up to 100 nodes)
- On error, "no partial writes/mutations; if partial work occurs internally it MUST be rolled back before storing the idempotency record"
- Idempotency must store `first_response_json_bytes` for replay

For 100 nodes with multi-agent evaluation, this means the engine must hold all evaluation results in memory (potentially MBs of LLM output × n_reviewers × 100 nodes) before committing, and if *any* node fails (e.g., node 99 has a grounding issue), discard everything. This is:
1. Extremely expensive (you re-run 99 successful evaluations on retry)
2. Memory-intensive
3. Contradicts the evidence-first ethos (you lose diagnostic data from successful evals)

**Fix**: Either (a) reduce `maxItems` from 100 to something more practical like 10-20, or (b) adopt a **partial-success model** where `eval.run` returns `{succeeded_node_ids, failed_node_ids, failures[]}` and idempotency covers the whole batch result (including partial). Option (b) requires rethinking the atomicity contract. At minimum, add a `batch_strategy: "atomic" | "best_effort"` param with `atomic` as default.

### B4. `node.list` pagination `total_count` is inconsistent with concurrent mutations

The spec says `total_count` "may differ across pages if the underlying set changes." Combined with the single-writer assumption (§2.3.1), this is *mostly* OK—but `search.step` can create nodes mid-pagination. More critically:

The `total_count` field is `required` but there's no guidance on whether it should be:
- Snapshot-consistent (expensive, requires a transaction/snapshot)
- Eventually-consistent estimate (cheap but misleading)

Since v0.x targets JSONL storage, a consistent `total_count` requires scanning all records per page request. This is fine for small campaigns but scales poorly.

**Fix**: Change `total_count` to optional (or add `total_count_approximate: boolean`). The pagination cursor is the reliable termination signal; `total_count` is sugar. Alternatively, document that it's an estimate.

### B5. No schema for `search.step` campaign-status transition reporting

When `search.step` triggers `running → exhausted` or `running → early_stopped`, this transition is "part of the idempotency-protected side-effects." But `SearchStepResult` doesn't include a `campaign_status` or `transition` field—only `budget_snapshot` and `island_states`. The caller has no way to know that the campaign status changed without making a separate `campaign.status` call.

**Fix**: Add `campaign_status: CampaignStatusV1.status` (the enum, not the full object) to `search_step_result_v1.schema.json`. This is critical for adapter correctness: the adapter needs to know whether to proceed with more steps or stop.

## Non-blocking

### N1. `idea_card_v1.schema.json` `claims[].evidence_uris` allows empty array for `literature`/`data`/`calculation`/`expert_consensus`

The `allOf` conditional uses `"then": { "properties": { "evidence_uris": { "minItems": 1 } } }` but doesn't add `evidence_uris` to `required`. Since `evidence_uris` is already in `required` at the claim object level, this works—but only because the base `required` includes it. The conditional `then` only constrains the array length, which is correct. However, the schema technically allows `evidence_uris: []` for `support_type: "llm_inference"` and `support_type: "assumption"`, which is fine by design but should be documented explicitly (LLM inference doesn't need evidence URIs, but *does* need verification_plan).

### N2. `novelty_delta_table` is duplicated across three schemas

The `novelty_delta_table` item schema is copy-pasted identically in:
- `idea_scorecards_v1.schema.json`
- `idea_node_v1.schema.json` (inside `eval_info`)
- (and conceptually referenced in the spec §6.2)

This violates the SSOT rule ("schemas are the SSOT; no copy-paste"). Extract to `schemas/novelty_delta_item_v1.schema.json` and `$ref` it.

### N3. `fix_suggestions` item schema is duplicated

Same issue: `fix_suggestions` item schema appears identically in `idea_scorecards_v1.schema.json` and `idea_node_v1.schema.json`. Extract to `schemas/fix_suggestion_v1.schema.json`.

### N4. `campaign_charter_v1.schema.json` `search_policy_id` and `team_policy_id` are not required

The spec (§3.2, §3.4) treats these as core to campaign operation (search policy, team topology), but the charter schema makes them optional. If omitted, the engine must pick defaults—but no default mechanism is documented. Either make them required or document the default selection.

### N5. `budget_envelope_v1.schema.json` `max_steps` and `max_nodes` are optional, but `budget_snapshot_v1.schema.json` makes `steps_remaining` and `nodes_remaining` required (nullable)

This is internally consistent (null = unbounded), but the spec's exhaustion check (§2.4: "any BudgetEnvelope dimension has remaining <= 0") doesn't address nullable dimensions. Does `steps_remaining: null` count as "not exhausted" for that dimension? Almost certainly yes, but it should be explicit.

### N6. `search.step` `n_steps_executed: 0` is valid per schema but semantically ambiguous

If the engine starts a step but immediately hits a budget fuse before completing the first tick, `n_steps_executed=0` with `early_stopped=true` is returned. But the spec says "tick atomicity: single tick writes must be all-or-nothing." So `n_steps_executed=0` means zero completed ticks. This is fine but should be documented as a valid state (not an error).

### N7. Missing `schema_validation_failed` error on `campaign.pause`/`campaign.resume`/`campaign.complete`

These methods accept `idempotency_key` (side-effecting), so they're subject to idempotency key conflict detection. But their `errors` arrays don't list `-32002 schema_validation_failed`. An idempotency key conflict should return `-32002` per the spec. Add this error to their error lists in the OpenRPC.

### N8. `idea_selection_v1.schema.json` `anyOf` constraint is weak

The `anyOf` requires at least one of `selected_node_ids`, `rejected_node_ids`, or `deferred_node_ids` to be non-empty. But the `required` at top level already includes `selected_node_ids` and `rejected_node_ids` (both can be empty arrays). The `anyOf` doesn't override `required`—it just adds a constraint that at least one list has ≥1 item. This means you can't have "no decision yet" as a valid state. This is probably intentional, but document it.

### N9. `idea_handoff_c2_v1.schema.json` `grounding_audit.failures` allows non-empty array with `status: "pass"`

The `failures` array has no `maxItems: 0` constraint (unlike `formalism_check.missing_formalisms`). A pass with failures is contradictory. Add `maxItems: 0` or a conditional.

### N10. `EloConfig.max_rounds` semantics need clarification

Is `max_rounds` the maximum number of *matchups* (individual pairings) or *rounds* (where each round may contain multiple matchups, e.g., Swiss-system)? For deterministic cost bounding, this matters significantly. The schema says "upper bound on Elo tournament rounds/matchups (implementation-defined)"—but "implementation-defined" defeats the purpose of a deterministic spec.

### N11. OpenRPC `x-error-data-contract` is non-standard

`x-error-data-contract` is a vendor extension. OpenRPC tooling won't validate it. Consider moving the `known_reasons` mapping into the spec doc or into a dedicated schema, and referencing it from method error descriptions.

## Real-research fit

### R1. Evidence-first pipeline is genuinely strong

The four-gate grounding audit (URI resolution → data consistency → inference transparency → folklore pre-screening) is one of the strongest evidence-first designs I've seen in AI-assisted research systems. The `claims[]` structure with `support_type` + mandatory `verification_plan` for LLM inferences directly addresses the hallucination-as-citation problem that plagues most AI research tools.

### R2. Operator taxonomy maps well to actual physics discovery patterns

The operator families (AnomalyAbduction, SymmetryOperator, LimitExplorer, CrossDomainAnalogy) correspond to real methodological moves in theoretical physics. The `RepresentationShift` operator is particularly well-chosen—many breakthroughs in HEP come from re-expressing problems (e.g., AdS/CFT, bosonization). The `mapping_table + invariants + kill_criteria` requirement for cross-domain analogies is exactly the right discipline.

### R3. Multi-island evolution addresses a real research pathology

The pattern where AI ideation systems converge to a small cluster of "safe" ideas is well-documented. The repopulation mechanism (STAGNANT → REPOPULATED → EXPLORING) directly counters this. The separation of island-level EXHAUSTED from campaign-level `exhausted` is correct—different research directions exhaust at different rates.

### R4. IdeaCard → C2 handoff is the right abstraction boundary

The decision to stop at "C2-ready structured input" rather than attempting full paper generation is correct for research quality. The `minimal_compute_plan` with difficulty estimates and infrastructure requirements gives downstream stages actionable information rather than vague aspirations.

### R5. Concern: folklore detection at scale is an unsolved problem

The spec treats `folklore_risk_score ∈ [0,1]` as a well-defined quantity, but in HEP, much "folklore" lives in seminar talks, private communications, and unpublished notes. The INSPIRE/arXiv retrieval pipeline will miss significant amounts of prior work in areas like BSM model-building where many ideas circulate informally. The `A0-folklore` human gate is the correct safety valve, but the threshold for triggering it should be conservative (low, not high).

### R6. Missing: experimental feasibility estimation

The `feasibility` evaluation dimension exists, but there's no structured mechanism for checking whether proposed observables are actually measurable at current/planned experiments. For HEP-ph, this means checking: "Is this accessible at LHC Run 3? At HL-LHC? At a future e+e- collider?" The `required_observables` field captures *what* to measure but not *where* or *when*. Consider adding `experimental_reach` to `IdeaCard` or the eval dimensions.

## Robustness & safety

### S1. Idempotency design is thorough but has a subtle race in error recording

The spec says: "For failed responses: must first complete rollback, then commit idempotency record." But if the process crashes between rollback completion and idempotency record commit, the next retry will see no idempotency record and re-execute. This is *safe* (the first attempt was rolled back), but the spec should explicitly note: "crash between rollback and idempotency commit is safe because the absence of an idempotency record will trigger fresh execution, which is equivalent to 'no prior attempt.'"

### S2. JCS (RFC 8785) canonicalization with default-value filling creates a subtle contract

The spec says defaults should be filled before hashing (e.g., `node.list.limit` omitted → 50). But `campaign.init` has complex params (charter, seed_pack, budget) where "default filling" is domain-specific. The spec should enumerate which fields have defaults for payload hashing, or better: document that only *documented* defaults (those with `"default"` in the JSON Schema) are filled before hashing.

### S3. Budget wall-clock tracking is unreliable for idempotency replay

If a replayed response contains `budget_snapshot.wall_clock_s_elapsed` from the first call, and the caller uses this to estimate remaining time, they'll get stale data. The spec correctly notes "callers MUST use campaign.status for current budget," but this creates a trap: every side-effecting call's budget snapshot is potentially stale on replay. Consider adding a `snapshot_at: datetime` field to `BudgetSnapshot` so callers can detect staleness.

### S4. Grounding audit active resolution is a network dependency

URI resolution (INSPIRE API, DOI resolvers) introduces network dependencies into what is otherwise a local computation pipeline. If INSPIRE is down, the grounding audit fails, blocking all promotions. The spec should define: (a) a timeout for resolution attempts, (b) a "resolution_pending" status that allows temporary deferral, and (c) a cache/TTL for previously resolved URIs.

### S5. Clean-room evaluation is the right default but expensive

With `n_reviewers` independent sessions per node, and potentially 100 nodes per `eval.run`, the token cost scales as O(nodes × reviewers × dimensions). The spec mentions "team_cost_multiplier" in extensions but doesn't enforce that `eval.run` pre-checks whether the requested evaluation would exceed the remaining budget before starting. Add a pre-flight budget check to the `eval.run` spec.

## Specific patch suggestions

### P1. `schemas/search_step_result_v1.schema.json` — Add campaign status field

```json
// ADD to "required" array:
"campaign_status"

// ADD to "properties":
"campaign_status": {
  "enum": ["running", "paused", "early_stopped", "exhausted", "completed"],
  "description": "Campaign status after this step completes. Critical for adapter control flow: if status changed (e.g., running → exhausted), the adapter MUST NOT issue further search.step calls without intervention."
}
```

### P2. `schemas/budget_snapshot_v1.schema.json` — Add snapshot timestamp

```json
// ADD to "required" array:
"snapshot_at"

// ADD to "properties":
"snapshot_at": {
  "type": "string",
  "format": "date-time",
  "description": "Timestamp when this snapshot was captured. Critical for idempotency replay: replayed snapshots reflect first-call state, not current state."
}
```

### P3. Extract duplicated sub-schemas — Create two new files

**File: `schemas/novelty_delta_item_v1.schema.json`**
```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "novelty_delta_item_v1.schema.json",
  "title": "NoveltyDeltaItem v1",
  "type": "object",
  "required": ["closest_prior_uris", "delta_types", "delta_statement", "verification_hook"],
  "properties": {
    "closest_prior_uris": { "type": "array", "minItems": 1, "items": { "type": "string", "format": "uri" } },
    "delta_types": {
      "type": "array", "minItems": 1,
      "items": { "enum": ["new_mechanism","new_observable","new_regime","new_method","new_formalism","new_dataset","new_constraint"] }
    },
    "delta_statement": { "type": "string", "minLength": 1 },
    "non_novelty_flags": {
      "type": "array",
      "items": { "enum": ["parameter_tuning_only","relabeling_only","equivalent_reformulation","no_new_prediction","known_components_no_testable_delta"] }
    },
    "verification_hook": { "type": "string", "minLength": 1 }
  },
  "additionalProperties": false
}
```

Then in `idea_scorecards_v1.schema.json`, `idea_node_v1.schema.json`: replace inline definitions with `{ "$ref": "./novelty_delta_item_v1.schema.json" }`.

**File: `schemas/fix_suggestion_v1.schema.json`** — same pattern for the duplicated fix_suggestion item.

### P4. `schemas/idea_handoff_c2_v1.schema.json` — Constrain `grounding_audit.failures`

```json
// CHANGE in grounding_audit.failures:
"failures": { "type": "array", "items": { "type": "string" }, "maxItems": 0 }
```

### P5. `schemas/idea_core_rpc_v1.openrpc.json` — Add `-32002` to `campaign.pause`, `campaign.resume`, `campaign.complete` error lists

For each of these three methods, add:
```json
{ "code": -32002, "message": "schema_validation_failed" }
```
to their `errors` arrays (needed for idempotency key conflict detection).

### P6. `docs/plans/2026-02-12-idea-generator-architecture-spec.md` §2.4 — Document early_stopped + exhausted escape hatch and stagnation counter reset

After the "补充约定" block, add:

```markdown
**Edge case: early_stopped + budget exhausted (must be testable)**:
- If `status=early_stopped` AND all budget dimensions are exhausted, the workflow is:
  `early_stopped → campaign.topup → (still early_stopped) → campaign.resume → running`
- `campaign.resume` from `early_stopped` MUST reset the policy's early-stop trigger state
  (e.g., stagnation counter) to prevent immediate re-triggering. If the caller wants to
  preserve the stagnation signal, they should inspect `campaign.status.early_stop_reason`
  before resuming and adjust the search_policy parameters via charter extensions.
```

### P7. `schemas/rank_compute` in OpenRPC — Add optional `score_dimensions` param

```json
{
  "name": "score_dimensions",
  "schema": {
    "type": "array",
    "minItems": 1,
    "items": { "enum": ["novelty", "feasibility", "impact", "tractability", "grounding"] }
  },
  "required": false,
  "description": "Explicit dimensions to rank on. If omitted, uses all dimensions present in the effective scorecards. For method=pareto, the effective dimension count MUST be >= 2; for method=elo, >= 1. Enables early validation without resolving scorecards."
}
```

### P8. `schemas/campaign_charter_v1.schema.json` — Make `search_policy_id` and `team_policy_id` required (or document defaults)

Either change to `"required": ["domain", "scope", "approval_gate_ref", "search_policy_id", "team_policy_id"]` or add:

```json
"search_policy_id": {
  "type": "string", "minLength": 1,
  "default": "multi_island_diverge_converge",
  "description": "..."
},
"team_policy_id": {
  "type": "string", "minLength": 1,
  "default": "sequential_convergence",
  "description": "..."
}
```

### P9. `docs/plans/2026-02-12-idea-generator-architecture-spec.md` §2.3 — Add JCS default-filling scope clarification

After the "Payload 等价" bullet, add:

```markdown
- **Default-filling scope (必须明确)**：only fields with an explicit `"default"` value in their
  JSON Schema definition are subject to default-filling before hashing. Domain-specific or
  DomainPack-implied defaults do NOT participate in payload canonicalization (to avoid coupling
  the idempotency layer to domain logic).
```

### P10. `schemas/eval_result_v1.schema.json` — Add pre-flight budget estimate

```json
// ADD to properties:
"estimated_cost_before_execution": {
  "type": "object",
  "properties": {
    "estimated_tokens": { "type": "integer", "minimum": 0 },
    "estimated_cost_usd": { "type": "number", "minimum": 0 }
  },
  "description": "Pre-flight cost estimate captured before evaluation began. Enables post-hoc audit of estimate accuracy."
}
```
