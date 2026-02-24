VERDICT: NOT_READY

## Blockers

### B1. `rank.compute` `no_scorecards` semantics: ambiguity in "observed_keys is empty" vs "all scorecards have status=failed"

The OpenRPC description says:

> "If observed_keys is empty (i.e., eval.run has never been called for the resolved set, or all scorecards are missing/failed)..."

But `idea_scorecards_v1.schema.json` allows `status: "failed"` scorecards to still carry `scores: {}` (an empty object satisfies `additionalProperties: { "type": "number" }`). The spec says "implementations MAY ignore scorecards with status=failed", but this is a MAY — meaning two conforming engines can disagree on whether a set of all-failed scorecards triggers `no_scorecards` or `insufficient_dimensions`. This **must** be a MUST to be machine-enforceable. The `x-error-data-contract` correctly lists `no_scorecards` under `-32013`, but the triggering condition is under-specified.

**Fix required**: Promote "MAY ignore scorecards with status=failed" to "MUST ignore scorecards with status=failed when computing observed_keys" in both the OpenRPC `rank.compute` description and the architecture spec §2.3 bullet 1.

### B2. `rank.compute` effective-dimension counting: `dimensions` param interaction with `observed_keys` is ambiguous for the 0-intersection case

The description says:

> "If dimensions is provided, effective_dimensions = dimensions ∩ observed_keys"

But it doesn't specify what happens when this intersection is **non-empty but size 1** for `method=pareto`. The text says "effective dimension count MUST be >= 2", which covers this — but the error reason should be `insufficient_dimensions`, not `no_scorecards`. The current text is correct on this point but relies on the reader correctly distinguishing "`observed_keys` is empty" (→ `no_scorecards`) from "`effective_dimensions` count < 2 with non-empty `observed_keys`" (→ `insufficient_dimensions`). This distinction should be made explicit in a decision table.

**Fix required**: Add a normative decision table to `rank.compute` description (or at minimum to the architecture spec §2.3) with the three failure paths:

| Condition | Error reason |
|---|---|
| `observed_keys` is empty (after ignoring failed scorecards) | `no_scorecards` |
| `observed_keys` non-empty but `effective_dimensions` count < 2 (pareto) | `insufficient_dimensions` |
| Resolved node count < 2 (elo) or < 1 (pareto) | `insufficient_nodes` |

### B3. `promotion_result_v1.schema.json`: `reduction_audit_summary.toy_check_result` is locked to `"pass"` — breaks `partial` status propagation

In `promotion_result_v1.schema.json`, the `reduction_audit_summary` (when non-null) requires `toy_check_result: { "enum": ["pass"] }`. This is correct because promotion requires `reduction_audit.status == pass`, and the `reduction_audit_v1.schema.json` enforces that `status=pass` requires `toy_check_result=pass`. **However**, the `reduction_audit_v1.schema.json` also allows `status=pass` only when **all** assumptions are `satisfied` (not `pending_verification`). The `promotion_result_v1` enforces `all_assumptions_satisfied: { "const": true }` and `assumption_count: { "minimum": 1 }`.

**Problem**: There is no `assumption_count` field in `reduction_audit_v1.schema.json`. The `promotion_result_v1.schema.json` introduces a **derived** field (`assumption_count`) in the summary that has no direct counterpart in the source schema. The engine must compute this. This is acceptable but must be explicitly documented — otherwise implementers may forget to count, or may count `violated` assumptions.

**Fix required**: Add a normative note in `promotion_result_v1.schema.json` or the architecture spec that `assumption_count = len(reduction_audit.assumptions)` and `all_assumptions_satisfied = all(a.status == "satisfied" for a in reduction_audit.assumptions)`. Without this, two implementations can disagree on edge cases (e.g., are violated assumptions counted?).

### B4. `reduction_audit_v1.schema.json`: `abstract_problem` echo is present but not constrained to match `reduction_report.abstract_problem`

The schema has:

> `"abstract_problem": { "type": "string", "minLength": 1, "description": "Echo of reduction_report.abstract_problem for provenance..." }`

But there is **no schema-level or RPC-level constraint** that `reduction_audit.abstract_problem == reduction_report.abstract_problem`. This must be engine-enforced (runtime), but it's not stated anywhere as a MUST. A conforming engine could produce a reduction_audit with a *different* `abstract_problem` than the reduction_report, breaking the provenance chain.

**Fix required**: Add a normative statement in either the architecture spec §4.2.1 (reduction audit bullet) or the OpenRPC `node.promote` description: "Engine MUST verify that `reduction_audit.abstract_problem == reduction_report.abstract_problem`; mismatch MUST cause `reduction_audit_failed` with `error.data.reason=abstract_problem_mismatch`." Also add this reason to `x-error-data-contract.known_reasons["-32016"]`.

### B5. Missing schema: `idea_candidates_v1.schema.json`

Section 5.2 describes `idea_candidates_v1.jsonl` as the most critical per-node artifact, but there is no `schemas/idea_candidates_v1.schema.json` in the 41 files. The `idea_node_v1.schema.json` exists, but the JSONL line format (which may differ from the full node schema — e.g., it might use artifact references instead of inline objects for `rationale_draft` / `idea_card`) is not formally specified. This breaks the stated SSOT rule: "schemas/*.schema.json is the only data contract truth source."

**Fix required**: Either (a) add `schemas/idea_candidates_v1.schema.json` that defines the JSONL line schema (possibly as `{ "$ref": "./idea_node_v1.schema.json" }` if identical), or (b) explicitly state in the architecture spec that each line of `idea_candidates_v1.jsonl` MUST conform to `idea_node_v1.schema.json`.

## Non-blocking

### N1. `reduction_audit_v1.schema.json` "all pending" → `partial` constraint is fragile

The last `allOf` entry attempts to enforce: "if all assumptions are `pending_verification` (none satisfied, none violated), and `reduction_type_valid=true`, and `toy_check_result ∈ {pass, skipped}`, then `status` must be `partial`." The JSON Schema `if` uses nested `not.contains` to express "no satisfied AND no violated" — this is logically correct but extremely hard to read and test. Consider adding a `$comment` explaining the intent, and definitely write explicit test fixtures for this case.

### N2. `promotion_result_v1.schema.json` `reduction_audit_summary` doesn't echo `reduction_type_valid`

The full `reduction_audit_v1` has `reduction_type_valid: boolean`, but the `reduction_audit_summary` in promotion_result doesn't include it (it's implied by `status=pass`). This is fine for correctness but reduces self-auditability — an auditor reading only the promotion result can't see whether the registry check passed without dereferencing the full audit. Consider adding `reduction_type_valid: { "const": true }` to the summary.

### N3. `rank.compute` `dimensions` param: no uniqueness constraint

The `dimensions` array has `minItems: 1` but no `uniqueItems: true`. A caller could pass `["novelty", "novelty"]` and the effective dimension count would be ambiguous. Add `"uniqueItems": true`.

### N4. Elo `ranked_nodes.minItems: 2` constraint location

In `ranking_result_v1.schema.json`, the conditional `if method=elo then ranked_nodes.minItems=2` is correct but relies on the engine never producing a result with fewer than 2 nodes. The symmetric constraint for pareto (`minItems: 1` in the base schema) is also correct. Good.

### N5. `idea_scorecards_v1.schema.json`: `scores` allows empty object

`scorecards[].scores: { "type": "object", "additionalProperties": { "type": "number" } }` permits `{}`. A scorecard with `status: "complete"` but `scores: {}` is schema-valid but semantically broken. Consider adding `minProperties: 1` when `status=complete`.

### N6. Missing `distributor_diagnostics_v1.schema.json`

Listed in §5.1 as an artifact but no schema file is included. This is optional ("可选") so not a blocker, but violates the SSOT rule if someone tries to produce it.

### N7. Architecture spec §2.3 bullet 1: "effective-dimension" terminology not used consistently

The spec says "有效评分维度 ≥ 2" but the OpenRPC uses "effective dimension count" and "effective_dimensions". Pin the English term in the Chinese spec for cross-referencing.

### N8. `campaign_mutation_result_v1.schema.json` topup allOf cascade is extremely complex

The 12+ `allOf` entries for encoding state-machine transitions are technically correct but will be painful to validate/debug. Consider whether a `x-state-machine` extension or a separate validation script would be more maintainable than pure JSON Schema conditionals.

## Real-research fit

**Strong points**:
- The operator library (§2 of executable-discovery-operators) maps real scientific reasoning patterns to auditable, composable units. The `ProblemReduction` and `TechniqueTransplant` operators are particularly well-designed for HEP, where many bottlenecks reduce to known mathematical problems.
- The grounding audit gate with active URI resolution is essential for HEP — INSPIRE/PDG phantom citations are a real problem.
- The `novelty_delta_table` with `non_novelty_flags` addresses a genuine failure mode in AI-assisted ideation (mistaking reformulation for novelty).
- The reduction audit chain (reduction_report → reduction_audit → promotion gate) correctly implements the "evidence-first" principle for cross-domain method transfer.

**Gaps**:
- The `folklore_risk_score` threshold for triggering human review (`A0-folklore`) is never specified — not even as a configurable campaign parameter. This should be in `campaign_charter_v1.schema.json` or `evaluator_config_v1.schema.json`.
- No explicit schema for the `debate_packet` mentioned in §3.4.3 ("point/counterpoint + evidence_uris"). This is referenced in the evaluator clean-room discussion but has no artifact contract.
- The `failed_approach_v1.schema.json` exists but there's no RPC method or explicit integration point for writing/querying failed approaches. How does a `Checker` or `Referee` role produce one?

## Robustness & safety

**Hallucination mitigation**:
- The two-stage `RationaleDraft → IdeaCard` pipeline with mandatory grounding audit is a strong anti-hallucination mechanism. The requirement for active URI resolution (not just format checks) is critical.
- The `support_type=llm_inference` requiring `verification_plan` is good but the schema doesn't enforce `verification_plan.minLength > 0` when `support_type=llm_inference` — wait, actually it does via `allOf[1].then`. Correct.

**Provenance concerns**:
- The `abstract_problem` echo in `reduction_audit_v1` is a good provenance mechanism but needs the match constraint (Blocker B4).
- The `operator_trace` requiring `evidence_uris_used` is excellent for replay.
- The idempotency system is extremely well-specified (JCS canonicalization, payload hash, replay semantics). The `idempotency_meta_v1.schema.json` including `payload_hash` enables client-side verification.

**Cost safety**:
- The budget circuit breaker, step budget fuse, and degradation order are well-designed.
- The pre-tick budget check requirement ("MUST NOT start a tick if estimated_tick_cost > budget_remaining") in the statphys doc needs to be reflected in the OpenRPC `search.step` description (currently only mentioned in the supplementary doc).

**Schema closure**:
- Almost all `$ref` targets are present. Missing: `idea_candidates_v1.schema.json` (Blocker B5), `distributor_diagnostics_v1.schema.json` (non-blocking N6).

## Specific patch suggestions

### Patch 1: `schemas/idea_core_rpc_v1.openrpc.json` — `rank.compute` description
**File**: `schemas/idea_core_rpc_v1.openrpc.json`, method `rank.compute`, field `description`

Replace the current description with a version that includes the normative decision table and promotes "MAY ignore failed scorecards" to MUST:

```
"description": "Side-effecting. Only permitted when campaign status is running; otherwise campaign_not_active. Filter is applied within campaign scope.\n\nScorecard resolution: the engine MUST ignore scorecards with status=failed when computing observed_keys. Let observed_keys be the set of distinct score keys from non-failed scorecards across the resolved node set.\n\nError decision table (normative):\n1. If the resolved node set is empty (filter matches 0 nodes): pareto → insufficient_eval_data (reason=insufficient_nodes); elo → insufficient_eval_data (reason=insufficient_nodes).\n2. If observed_keys is empty after ignoring failed scorecards: insufficient_eval_data (reason=no_scorecards). MUST NOT write ranking artifacts.\n3. If dimensions is provided, effective_dimensions = dimensions ∩ observed_keys; else effective_dimensions = observed_keys.\n4. For method=pareto: if |effective_dimensions| < 2 → insufficient_eval_data (reason=insufficient_dimensions). MUST NOT write ranking artifacts. If resolved node count >= 1, proceed.\n5. For method=elo: if resolved node count < 2 → insufficient_eval_data (reason=insufficient_nodes). MUST NOT write ranking artifacts.\n\nFor method=pareto, a single node is allowed and yields rank=1. For method=elo, elo_config is required (schema_validation_failed with reason=elo_config_required if absent). If method=pareto and elo_config is provided, schema_validation_failed with reason=elo_config_unexpected."
```

### Patch 2: `schemas/idea_core_rpc_v1.openrpc.json` — `x-error-data-contract`
**File**: `schemas/idea_core_rpc_v1.openrpc.json`, field `x-error-data-contract.known_reasons["-32016"]`

Add `"abstract_problem_mismatch"` to the list:

```json
"-32016": [
  "reduction_audit_not_pass",
  "reduction_audit_missing",
  "abstract_problem_not_in_registry",
  "abstract_problem_mismatch"
]
```

### Patch 3: `schemas/promotion_result_v1.schema.json` — add derivation note for `assumption_count`
**File**: `schemas/promotion_result_v1.schema.json`, property `reduction_audit_summary`

Add `$comment` to the `reduction_audit_summary` object definition:

```json
"reduction_audit_summary": {
  "oneOf": [
    {
      "type": "object",
      "$comment": "Derivation rules: assumption_count = len(reduction_audit.assumptions); all_assumptions_satisfied = all(a.status == 'satisfied' for a in reduction_audit.assumptions). Engine MUST verify reduction_audit.abstract_problem == reduction_report.abstract_problem before populating this summary.",
      "required": ["status", "abstract_problem", "toy_check_result", "assumption_count", "all_assumptions_satisfied"],
      ...
    }
  ]
}
```

### Patch 4: `docs/plans/2026-02-12-idea-generator-architecture-spec.md` — §4.2.1 reduction audit
**File**: `docs/plans/2026-02-12-idea-generator-architecture-spec.md`, section 4.2.1, after the existing reduction audit bullet list

Add:

```markdown
   - `abstract_problem` echo consistency（MUST）：engine 在执行 reduction_audit 时，**必须**验证 `reduction_audit.abstract_problem == reduction_report.abstract_problem`；若不一致，必须返回 `reduction_audit_failed`（`error.data.reason=abstract_problem_mismatch`），不得写入审计产物。
```

### Patch 5: `schemas/rank.compute` `dimensions` param — add uniqueItems
**File**: `schemas/idea_core_rpc_v1.openrpc.json`, method `rank.compute`, param `dimensions`

Change:
```json
"schema": {
  "type": "array",
  "minItems": 1,
  "items": { ... }
}
```
To:
```json
"schema": {
  "type": "array",
  "minItems": 1,
  "uniqueItems": true,
  "items": { ... }
}
```

### Patch 6: Add `schemas/idea_candidates_v1.schema.json`
**File**: `schemas/idea_candidates_v1.schema.json` (new file)

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "idea_candidates_v1.schema.json",
  "title": "IdeaCandidates v1 (JSONL line)",
  "description": "Each line of idea_candidates_v1.jsonl MUST conform to idea_node_v1.schema.json. This schema exists solely to make the SSOT $ref closure explicit.",
  "$ref": "./idea_node_v1.schema.json"
}
```

### Patch 7: `docs/plans/2026-02-12-idea-generator-architecture-spec.md` — §2.3 rank.compute bullet
**File**: `docs/plans/2026-02-12-idea-generator-architecture-spec.md`, section 2.3, bullet 1 on `rank.compute`

After "引擎必须返回 `insufficient_eval_data` 且建议 `error.data.reason=no_scorecards`", add:

```markdown
   - **Scorecard 过滤（MUST）**：计算 `observed_keys` 时，engine **必须**忽略 `status=failed` 的 scorecards（不参与维度计数）。
   - **错误判定优先级（normative decision table）**：
     1. resolved 集合为空 → `insufficient_eval_data`（`reason=insufficient_nodes`）
     2. `observed_keys`（排除 failed scorecards 后）为空 → `insufficient_eval_data`（`reason=no_scorecards`）
     3. `effective_dimensions` 数量 < 2（仅 pareto） → `insufficient_eval_data`（`reason=insufficient_dimensions`）
     4. resolved 节点数 < 2（仅 elo） → `insufficient_eval_data`（`reason=insufficient_nodes`）
```

### Patch 8: `schemas/idea_scorecards_v1.schema.json` — tighten `scores` when `status=complete`
**File**: `schemas/idea_scorecards_v1.schema.json`, in the `scorecards` items

Add conditional:
```json
"allOf": [
  {
    "if": {
      "properties": { "status": { "const": "complete" } },
      "required": ["status"]
    },
    "then": {
      "properties": {
        "scores": { "minProperties": 1 }
      }
    }
  }
]
```

### Patch 9: `schemas/promotion_result_v1.schema.json` — add `reduction_type_valid` to summary
**File**: `schemas/promotion_result_v1.schema.json`, `reduction_audit_summary` non-null variant

Add to `required` and `properties`:
```json
"reduction_type_valid": { "const": true }
```

This makes the summary fully self-auditable without dereferencing the full reduction_audit artifact.

### Patch 10: `docs/plans/2026-02-12-idea-generator-architecture-spec.md` — §3.3 pre-tick budget check
**File**: `docs/plans/2026-02-12-idea-generator-architecture-spec.md`, section 3.3 (Budget Circuit Breaker)

Add after the existing circuit breaker bullets:

```markdown
- **Pre-tick budget check（MUST）**：Distributor 在选择 action 之前，**必须**检查 `estimated_tick_cost(team_topology) <= budget_remaining`；若不满足，`search.step` 应返回 `early_stopped=true`（`early_stop_reason=insufficient_for_minimum_tick`），而不是启动 tick 后因预算不足中途失败。
```
