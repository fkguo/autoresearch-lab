VERDICT: NOT_READY

## Blockers

### B1. `campaign.resume` from `exhausted` state: spec vs. OpenRPC inconsistency

The architecture spec §2.4 says:

> 若对 `status=exhausted` 调用 `campaign.resume`，必须返回 `budget_exhausted`（不改变状态）

But the OpenRPC `campaign.resume` description says:

> Permitted when campaign status is paused or early_stopped.

This means `exhausted → resume` should return `campaign_not_active` per the OpenRPC description (it's not in the permitted set), but the spec says it should return `budget_exhausted`. These are different error codes (`-32015` vs `-32001`). An implementer will pick one or the other arbitrarily. **This must be reconciled before implementation.**

**Recommendation:** The spec's intent is better (return `budget_exhausted` as a more specific diagnostic). Update the OpenRPC `campaign.resume` description to: `"Permitted when campaign status is paused, early_stopped, or exhausted. If exhausted, returns budget_exhausted (-32001) without state change (caller should topup first)."` and add `-32001` to the errors list (it's already there, but the description text contradicts it).

### B2. `campaign.topup` allowed transitions are underspecified in OpenRPC vs. spec

Spec §2.4 says `campaign.topup` is allowed in `running|paused|early_stopped|exhausted` and result is `(same state)` except `exhausted → running` when budget is restored. But the OpenRPC description says:

> If status is exhausted, successful topup MUST transition campaign status to running only if the campaign is no longer budget-exhausted

This is correct for exhausted, but it doesn't say what happens for `early_stopped`. Should topup on `early_stopped` keep `early_stopped`? That seems odd — if you add budget to an early-stopped campaign, the stagnation condition that caused early-stop is unrelated to budget. The spec says `(same state)`, so `early_stopped` stays `early_stopped`. This is internally consistent but should be made explicit in the OpenRPC description: topup doesn't change `early_stopped` (user must `campaign.resume` to go back to `running`).

### B3. `search.step` idempotency with `n_steps > 1` has undefined partial-completion semantics

If `search.step` is called with `n_steps=5`, executes 3 steps, then hits budget exhaustion, the result has `n_steps_executed=3` and `early_stopped=true`. If the same `idempotency_key` is replayed, it returns the stored result with `n_steps_executed=3`. But what if the caller wants to continue the remaining 2 steps? They need a new `idempotency_key`. This is fine — but there's a subtler problem:

Between the first call (which left the campaign at `exhausted`) and the replay, someone might have called `campaign.topup`. The replay still returns the old result (correct per spec). But the caller may be confused that their "retry" after topup doesn't make progress. **The spec should add an explicit note** that after early-stop/budget-exhaustion, callers MUST issue a new `idempotency_key` to request fresh work (the current idempotency rules technically cover this, but this specific scenario should be documented as a usage pattern).

### B4. `rank.compute` is side-effecting but has no `node_not_in_campaign` error

`rank.compute` accepts a `filter` (not explicit `node_ids`). Per spec §2.3 point 1, list/filter-style RPCs should "return empty results" for non-matching filters. But `rank.compute` has a `minItems: 1` on `ranked_nodes` in `ranking_result_v1.schema.json`. This means the engine can never return a valid success result with zero ranked nodes — but `insufficient_eval_data` is the specified error for that case.

**The real issue:** What if the filter matches nodes but they have no eval data? The error `insufficient_eval_data` is defined but the threshold for "sufficient" is nowhere specified. For Elo, the spec says `< 2 nodes` → error, but for Pareto with 1 node? The schema requires `minItems: 1` on `ranked_nodes`, so a single-node Pareto result is valid. But is it meaningful? **Add a minimum node count to the Pareto path** (recommend `minItems: 1` is fine for Pareto — a single-node Pareto front is trivially correct — but document it).

### B5. No error code for `idempotency_key_conflict`

The spec requires (§2.3 point 2b) that key reuse with different payload returns `schema_validation_failed` with `idempotency_key_conflict` in the message/data. But `schema_validation_failed` (`-32002`) is overloaded: it covers actual schema validation failures, idempotency conflicts, and (per `rank.compute`) missing `elo_config`. The implementer has no machine-parseable way to distinguish these.

**Recommendation:** Either:
- (a) Add a dedicated error code `-32016 idempotency_key_conflict`, or
- (b) Require all `-32002` errors to include a structured `data` field with `{ "reason": "idempotency_key_conflict" | "schema_invalid" | "elo_config_missing" | ... }` and add this to the OpenRPC error schema.

Option (b) is more extensible.

### B6. `idea_card_v1.schema.json` — `evidence_uris` minItems constraint is incomplete

The `allOf` conditional says that for `support_type ∈ {literature, data, calculation, expert_consensus}`, `evidence_uris` must have `minItems: 1`. But JSON Schema 2020-12's `if/then` with `properties` override only works if the `then` clause contains `required`. Currently:

```json
"then": { "properties": { "evidence_uris": { "minItems": 1 } } }
```

This sets the constraint but **does not require `evidence_uris` to be present** — it only constrains it if it appears. Since `evidence_uris` is already in the `required` array of the claim object, this works, but only by coincidence. If someone refactors `evidence_uris` out of `required` (it's a reasonable refactoring since LLM-inference claims don't need URIs), the constraint silently stops working. **Make the `then` clause explicitly include `"required": ["evidence_uris"]`** for defensive correctness.

## Non-blocking

### N1. `budget_envelope_v1` — `max_cost_usd` and `max_wall_clock_s` allow zero

Both have `"minimum": 0`, meaning a budget of `0.0` USD or `0.0` seconds is technically valid. This would immediately trigger `budget_exhausted` on any operation. Consider `"exclusiveMinimum": 0` for both (matching `budget_topup_v1` which uses `exclusiveMinimum` for its USD/seconds fields).

### N2. `seed_pack_v1` — `seed_type` is uncontrolled

`seed_type` is `{ "type": "string", "minLength": 1 }` with no enum or pattern. For interoperability, recommend at least a `description` listing expected values (e.g., `c1_gap | pdg_tension | kb_prior | user_seed | hepdata_anomaly`) and consider adding an enum with an escape hatch (`"oneOf": [{"enum": [...]}, {"type": "string", "pattern": "^x-"}]`) so domain packs can extend.

### N3. `evaluator_config_v1` — `weights` keys are unconstrained

The `weights` object uses `additionalProperties: { "type": "number" }` but doesn't enforce that keys match the `dimensions` array. A caller could pass `weights: { "aesthetics": 0.5 }` with `dimensions: ["novelty"]` and the schema would accept it. Add a `description` noting that keys SHOULD match `dimensions`, and consider a runtime validation note.

### N4. `island_state_v1` — no `COMPLETED` or `MERGED` state

Islands can reach `EXHAUSTED` but there's no terminal success state for an island (e.g., when all its top candidates have been promoted). If islands are meant to run until the campaign ends, document that. If islands can be individually retired (e.g., after producing promoted nodes), consider adding `RETIRED` to the enum.

### N5. Missing `campaign_status_v1` fields for topup history

The spec mentions topup must be monotonic, but there's no way to observe topup history from `campaign.status`. Consider adding an optional `topup_history` array (or at least `total_budget_envelope` showing the current effective limits after all topups) for debugging and audit.

### N6. `node_list_result_v1` — `total_count` semantics under pagination

Is `total_count` the total matching the filter (across all pages) or just the current page? The former is standard but can be expensive. Clarify in the description. Given JSONL-backed storage in v0.x, this is likely cheap, but should be documented.

### N7. `rationale_draft_v1` — `kill_criteria` minimum too low

`kill_criteria` has `minItems: 1`, which the spec suggests should be "1–3 kill criteria." Consider whether 1 is genuinely sufficient or if `minItems: 2` better enforces research rigor (most non-trivial ideas should have at least 2 independent kill paths). Non-blocking because 1 is defensible for early-stage seeds.

### N8. Pagination cursor type mismatch between request and response

In `node.list` params, `cursor` is `{ "type": "string", "minLength": 1 }` (no null). In `node_list_result_v1`, `cursor` is `{ "type": ["string", "null"] }`. The request schema should also allow first-page calls without a cursor. Currently, since `cursor` is not in the `required` array of `node.list` params, omitting it works — but sending `null` would fail schema validation (string expected). Consider allowing `null` in the request cursor or documenting that first-page callers must omit the field entirely.

### N9. `eval_result_v1` returns only artifact refs, not inline scores

The `eval_result` schema returns `scorecards_artifact_ref` but no inline summary (e.g., aggregated scores per node). This means any consumer must do a second I/O operation to read the artifact. For observability in the adapter layer, consider adding an optional `summary` field with per-node aggregate scores.

### N10. `campaign.complete` from `exhausted` — confirm intent

The spec says `completed` is reachable from `exhausted`. This means a campaign that ran out of budget can be marked as "done" without ever getting useful results. This is probably intentional (human decides to give up), but add a `description` note confirming this is the intended "abandon" path.

## Real-research fit

### R1. Evidence-first discipline is well-structured and operationally sound

The claim-level provenance in `IdeaCard.claims[]` with `support_type` enum, conditional `verification_plan`, and active URI resolution in the grounding audit is significantly better than most AI-research-assistant designs. The `novelty_delta_table` with `non_novelty_flags` directly addresses the critical failure mode of LLMs generating trivial reformulations and calling them novel.

### R2. Operator taxonomy maps to real HEP discovery patterns

The operator families (`AnomalyAbduction`, `SymmetryOperator`, `LimitExplorer`, `RepresentationShift`) correspond to real methodological moves in HEP theory. The `formalism_registry` binding to C2 schemas ensures ideas aren't just narrative but connect to executable computation — this is the right architectural boundary for a HEP-first system.

### R3. Compute plan granularity is appropriate

`minimal_compute_plan` with `estimated_difficulty`, `estimated_compute_hours_log10`, and `required_infrastructure` gives downstream stages (C2) enough information to triage without over-constraining the idea generation phase. The `blockers` field per step is a good addition for feasibility-aware prioritization.

### R4. Multi-island with stagnation detection addresses mode collapse

The island state machine with `STAGNANT → REPOPULATED` via migration is a direct response to the known failure mode of LLM-based idea generation converging on a narrow set of phrasings. The `should_repopulate` and `migrate` interfaces are appropriately abstract for v0.2.

### R5. Gap: No explicit connection to experimental timeline/program

HEP ideas have a temporal dimension — some are testable at current facilities (LHC Run 3), some require future experiments (FCC-ee, CEPC). The `IdeaCard` has `required_observables` but no `experimental_timeline` or `facility_requirements` field. This matters for prioritization. **Consider adding to v0.3 scope.**

## Robustness & safety

### S1. Hallucination mitigation is multi-layered (good)

The design has four anti-hallucination layers: (1) claim-level `support_type` forcing transparency, (2) active URI resolution in grounding audit, (3) `folklore_risk_score` with human escalation, (4) clean-room multi-reviewer evaluation. This is a strong stack. The key risk is implementation quality of layer (2) — INSPIRE API calls can fail or return false positives (e.g., a paper exists but doesn't support the claim). The spec correctly identifies this but doesn't prescribe a relevance check beyond URI resolution.

**Recommendation for v0.3:** Add a `claim_support_relevance` check (does the cited paper actually discuss the claimed topic?) as an optional grounding audit dimension.

### S2. Idempotency design is correct but storage growth is unbounded

Idempotency records must be retained for campaign lifetime. For long-running campaigns with many `search.step` calls, this could grow significantly. The spec says "至少保留到 campaign 结束" which is correct, but there's no guidance on storage format or compaction. For v0.x with JSONL, this is likely fine; flag for v1.0.

### S3. Cost control is well-designed but `max_wall_clock_s` is hard to enforce

Wall-clock budget is meaningful for human planning but difficult to enforce precisely in a distributed/async system. If `search.step` makes multiple LLM calls, the engine can check between calls but can't preempt a running call. Document that `max_wall_clock_s` is a best-effort bound with check granularity at inter-call boundaries.

### S4. Campaign isolation is well-specified

The explicit `node_not_in_campaign` error and the "list returns empty, not error" semantics for filter-style RPCs is a clean design that prevents cross-campaign data leakage. This is particularly important for safety when multiple research directions are explored concurrently.

### S5. No rate limiting or concurrency control

The spec doesn't address concurrent `search.step` calls to the same campaign. If two adapter instances call `search.step` simultaneously with different `idempotency_key`s, the engine must handle concurrent writes to the same island/node store. For v0.x with single-process stdio, this is moot, but should be documented as a constraint: **"v0.x assumes single-writer per campaign; concurrent side-effecting RPCs to the same campaign have undefined behavior."**

## Specific patch suggestions

### P1. `schemas/idea_core_rpc_v1.openrpc.json` — Fix `campaign.resume` description for `exhausted` state

**File:** `schemas/idea_core_rpc_v1.openrpc.json`  
**Method:** `campaign.resume`  
**Change `description`** from:
```
"Permitted when campaign status is paused or early_stopped. If budget is exhausted, returns budget_exhausted. If campaign is completed, returns campaign_not_active."
```
to:
```
"Side-effecting. Permitted when campaign status is paused, early_stopped, or exhausted. Transitions paused|early_stopped → running. If status is exhausted, the engine MUST return budget_exhausted (-32001) without changing state (caller should topup first, then resume). If campaign is completed, returns campaign_not_active (-32015)."
```

### P2. `schemas/idea_core_rpc_v1.openrpc.json` — Add structured `data` field to error contract

**File:** `schemas/idea_core_rpc_v1.openrpc.json`  
**Location:** `info.description` (append), or add a new top-level `"x-error-data-contract"` extension  
**Add:**
```json
{
  "x-error-data-contract": {
    "description": "All JSON-RPC errors SHOULD include a structured 'data' field: { \"reason\": \"<sub_reason>\", \"details\": { ... } }. Known sub-reasons for -32002: schema_invalid, idempotency_key_conflict, elo_config_required, elo_config_unexpected."
  }
}
```

### P3. `schemas/idea_card_v1.schema.json` — Strengthen `evidence_uris` conditional

**File:** `schemas/idea_card_v1.schema.json`  
**Location:** `claims.items.allOf[1].then`  
**Change** from:
```json
"then": { "properties": { "evidence_uris": { "minItems": 1 } } }
```
to:
```json
"then": { "required": ["evidence_uris"], "properties": { "evidence_uris": { "minItems": 1 } } }
```

### P4. `schemas/budget_envelope_v1.schema.json` — Disallow zero budgets

**File:** `schemas/budget_envelope_v1.schema.json`  
**Change** `max_cost_usd` and `max_wall_clock_s` from `"minimum": 0` to `"exclusiveMinimum": 0` (matching `budget_topup_v1` conventions).

### P5. `schemas/node_list_result_v1.schema.json` — Clarify `total_count`

**File:** `schemas/node_list_result_v1.schema.json`  
**Change** `total_count` from:
```json
"total_count": { "type": "integer", "minimum": 0 }
```
to:
```json
"total_count": {
  "type": "integer",
  "minimum": 0,
  "description": "Total number of nodes matching the filter across all pages (not just the current page). Implementations MAY return -1 if the total is expensive to compute, in which case the caller should paginate until cursor is null."
}
```
(And if allowing -1, change `"minimum": 0` to `"minimum": -1`.)

### P6. `docs/plans/2026-02-12-idea-generator-architecture-spec.md` — Add concurrency constraint

**File:** `docs/plans/2026-02-12-idea-generator-architecture-spec.md`  
**Location:** After §2.3, before §2.4  
**Add:**
```markdown
### 2.3.1 Concurrency constraint (v0.x)

v0.x assumes **single-writer per campaign** at the RPC layer. Concurrent side-effecting RPCs to the same campaign from different adapter instances have undefined behavior. Idempotency protects against retries from a single caller, not against concurrent multi-writer races. Future versions (v1.0+) may introduce optimistic concurrency control (e.g., `expected_version` fields).
```

### P7. `docs/plans/2026-02-12-idea-generator-architecture-spec.md` — Add post-early-stop usage pattern

**File:** `docs/plans/2026-02-12-idea-generator-architecture-spec.md`  
**Location:** §2.3, after the idempotency replay rules  
**Add:**
```markdown
**Post-early-stop / post-exhaustion usage pattern (informative):**
When `search.step` returns `early_stopped=true` (whether due to step-local or global budget exhaustion), the caller MUST NOT retry with the same `idempotency_key` expecting fresh work — that will replay the original partial result. To continue searching after budget topup or policy change, the caller MUST issue a new `search.step` with a fresh `idempotency_key`. This follows directly from the idempotency rules but is called out explicitly to prevent a common integration mistake.
```

### P8. `schemas/idea_core_rpc_v1.openrpc.json` — Add `campaign.topup` behavior note for `early_stopped`

**File:** `schemas/idea_core_rpc_v1.openrpc.json`  
**Method:** `campaign.topup`  
**Append to `description`:**
```
If the campaign status is early_stopped (search policy halt, not budget), topup adds budget but does NOT change the status; the caller must explicitly campaign.resume to re-enter running.
```

### P9. `schemas/campaign_charter_v1.schema.json` — Add `domain` enum recommendation

**File:** `schemas/campaign_charter_v1.schema.json`  
**Change** `domain` to add recommended values:
```json
"domain": {
  "type": "string",
  "minLength": 1,
  "description": "Primary target domain. Recommended values for HEP-first: hep-ph, hep-th, hep-ex, hep-lat, nucl-th, nucl-ex, astro-ph, cond-mat, math-ph. Cross-domain operators are not restricted to this domain but must satisfy its constraints.",
  "examples": ["hep-ph", "hep-th", "nucl-th"]
}
```

### P10. `schemas/search_step_result_v1.schema.json` — Add campaign status to result

**File:** `schemas/search_step_result_v1.schema.json`  
**Add to `required`:** `"campaign_status"`  
**Add to `properties`:**
```json
"campaign_status": {
  "enum": ["running", "paused", "early_stopped", "exhausted", "completed"],
  "description": "Campaign status AFTER this step completed. Critical for detecting implicit transitions (running → exhausted, running → early_stopped) without requiring a separate campaign.status call."
}
```

This is important because `search.step` can trigger implicit transitions (`running → exhausted`), and without this field, the caller must make a separate `campaign.status` call after every step to detect them.
