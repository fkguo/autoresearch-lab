VERDICT: READY

## Blockers

No blocking issues found. The v39 bundle is internally consistent across the claimed changes.

## Non-blocking

### 1. `reduction_audit_v1`: `partial` status logic — correctness verified but schema-level enforcement is fragile

The `allOf` chain in `reduction_audit_v1.schema.json` correctly encodes the decision tree from the `$comment`:
- `violated` → `fail` ✓
- `reduction_type_valid=false` → `fail` ✓
- `toy_check_result=fail` → `fail` ✓
- `status=pass` requires `reduction_type_valid=true` + `toy_check_result=pass` + no `pending_verification`/`violated` ✓
- The final `if` clause correctly captures the `partial` case: `reduction_type_valid=true`, `toy_check_result ∈ {pass, skipped}`, no `violated`, and (`any pending_verification` OR `toy_check_result=skipped`) → `status=partial` ✓

**Observation**: The `$comment` says "all assumptions satisfied + toy check pass → pass", but a document with `assumptions: [{status: "satisfied"}], toy_check_result: pass, reduction_type_valid: true, status: "pass"` would also need to *not* match the `partial` clause. The `anyOf` inside the `partial` `if` won't fire (no `pending_verification`, no `skipped`), so `partial` won't be forced — correct. However, the `partial` clause uses `"enum": ["partial"]` in `then`, which doesn't *reject* `pass` or `fail` — it only *requires* it be `partial` if the `if` matches. This is correct but worth a conformance test.

**Suggestion**: Add a `$comment` or test vector file (`tests/fixtures/reduction_audit_partial_cases.json`) covering:
- mixed `satisfied` + `pending_verification` + `toy_check_result=pass` → `partial`
- all `satisfied` + `toy_check_result=skipped` → `partial`
- all `satisfied` + `toy_check_result=pass` → `pass`

### 2. `ranking_result_v1`: `effective_dimensions` + `scorecards_artifact_ref` — verified

Both fields are `required` in the schema. `effective_dimensions` has `minItems: 1` and correct enum values. `scorecards_artifact_ref` is `format: uri`. The OpenRPC `rank.compute` description correctly specifies how `effective_dimensions` is computed (intersection logic) and when `insufficient_dimensions` fires (Pareto < 2). The response MUST echo the effective snapshot per the OpenRPC description. ✓

**Minor concern**: `effective_dimensions` doesn't enforce uniqueness. Two identical dimensions would be semantically nonsensical.

### 3. `idea_list_filter_v1`: `has_eval_info` — verified

New boolean field with clear description. `additionalProperties: false` is set. ✓

**Observation**: The filter lacks `has_reduction_report` which would be a natural companion for adapter-side workflows that need to find nodes requiring `reduction_audit`. Not blocking but worth noting for v1.10.

### 4. `idea_scorecards_v1`: `status` semantics — verified

The `allOf` conditional logic correctly enforces:
- `status=failed` → `scores.maxProperties=0` + `failure_modes.minItems=1` ✓
- `status ∈ {complete, partial}` → `scores.minProperties=1` ✓

The OpenRPC `rank.compute` description correctly says "MUST ignore scorecards with status=failed when computing observed_keys" ✓

### 5. `distributor_event_v1`: `rng_alg` — verified

New optional field with `type: string, minLength: 1`. Description says "Echo of the RNG algorithm used for this decision (for self-contained replay)." ✓ Consistent with `distributor_policy_config_v1.deterministic_sampling.rng_alg`.

### 6. OpenRPC v1.9.6 `rank.compute` ↔ `eval.run` linkage — verified

`rank.compute` has optional `scorecards_artifact_ref` param (format: uri) with clear description about pinning to a specific eval snapshot. `eval.run` returns `scorecards_artifact_ref` in its result. The `rank.compute` description says "the engine MUST echo the effective snapshot in ranking_result.scorecards_artifact_ref". ✓

### 7. `idea_scorecards_v1` missing `artifact_uri` / self-identification

The scorecards artifact has no self-referential URI field. When `eval.run` produces a `scorecards_artifact_ref` and `rank.compute` consumes it, the scorecards file itself doesn't declare its own identity. This is fine for file-based storage (identity = path) but could cause confusion in object-store / content-addressed contexts.

### 8. `ranking_result_v1.effective_dimensions` vs `evaluator_config_v1.dimensions` mismatch risk

The spec says `effective_dimensions = dimensions ∩ observed_keys` (or `observed_keys` if `dimensions` omitted). But `evaluator_config_v1.dimensions` uses the same enum values. If a future dimension is added to `evaluator_config_v1` but not to the `ranking_result_v1.effective_dimensions` enum, ranking will silently drop it. Consider making both enums reference a shared `$def` / `$defs` block.

### 9. Pagination: `node.list` default limit = 50 stated in OpenRPC but not in `node_list_result_v1`

The OpenRPC spec says "if limit is omitted, engine MUST treat it as 50" and the param schema has `"default": 50`. But the `node_list_result_v1.schema.json` doesn't echo the applied limit, making it harder for callers to verify the default was applied. Consider adding an `applied_limit` field.

### 10. `idea_scorecards_v1.scorecards[].scores` typing for `partial`

When `status=partial`, `minProperties: 1` is enforced but there's no way to know *which* dimensions are missing vs present. Callers computing `observed_keys` across scorecards must union over whatever keys exist, but can't distinguish "this dimension was attempted and scored 0.0" from "this dimension was not attempted." Consider adding an optional `attempted_dimensions` array.

## Real-research fit

### Strong points

1. **`reduction_audit_v1` partial classification**: Correctly models real research scenarios where some assumptions are verified but others are pending (common in early-stage theoretical physics where, e.g., a perturbative assumption is verified in a toy model but a non-perturbative regime hasn't been checked). The `partial` status correctly blocks promotion, which prevents premature commitment to under-validated reductions.

2. **`ProblemReduction` / `TechniqueTransplant` pipeline**: The `abstract_problem_registry` is a genuinely useful innovation for HEP. Many BSM calculations reduce to well-studied optimization/inference problems (e.g., global fits → constrained optimization, anomaly detection → hypothesis testing). The registry forces explicit mapping and prevents the common failure mode of "we used ML because it's trendy" without checking whether classical methods already solve the problem.

3. **`novelty_delta_table` with `non_novelty_flags`**: Addresses a real plague in HEP-ph where papers rebrand known mechanisms (e.g., "novel portal" that is just a singlet scalar mixing). The `parameter_tuning_only` and `equivalent_reformulation` flags are precise enough to be actionable.

4. **`folklore_risk_score` with configurable threshold**: In HEP-th, a large fraction of "new" ideas are community folklore that has never been written down. The threshold being DomainPack-overridable is correct — folklore norms vary by subfield (hep-th is more folklore-heavy than hep-ph phenomenology).

5. **Evidence-first grounding audit with active URI resolution**: Prevents the #1 failure mode of LLM-assisted literature work: phantom citations. Requiring INSPIRE API / DOI resolution is feasible for HEP (INSPIRE coverage is excellent).

### Potential gaps for real research

1. **No explicit "known result" registry**: In HEP, many ideas are technically novel but turn out to be special cases of known theorems (e.g., Goldstone's theorem, Vafa-Witten theorem, various no-go results). The system should eventually support a `known_results_registry` that `FalsificationPressure` and `Referee` can query. Not a v0.2 blocker.

2. **Missing experimental feasibility data integration**: `required_observables` in `IdeaCard` is a string array. For real HEP research, you'd want this to link to actual experimental capabilities (LHC luminosity projections, Belle II sensitivity, neutrino experiment baselines). This could be a DomainPack extension.

## Robustness & safety

### Hallucination mitigation

1. **Active URI resolution** (grounding audit gate): Strong. ✓
2. **Clean-room evaluation**: Prevents cross-contamination between evaluators. ✓
3. **`verification_plan` required for `llm_inference`/`assumption` claims**: Forces the system to acknowledge uncertainty. ✓
4. **`folklore_risk_score` threshold**: Catches "sounds new but isn't." ✓
5. **`non_novelty_flags`**: Catches "reworded but equivalent." ✓

### Provenance safety

1. **`origin.prompt_hash`** with `sha256:` prefix: Enables exact replay. ✓
2. **`operator_trace.evidence_uris_used`**: Links generation to evidence. ✓
3. **Idempotency with `payload_hash`** (JCS + sha256): Prevents replay attacks and cross-run contamination. ✓
4. **`node.revision` monotonic counter**: Enables stale-read detection. ✓

### Remaining concerns

1. **`idempotency_meta_v1.payload_hash` is only in success responses**: The `rpc_error_data_v1` has an *optional* `payload_hash`. For `idempotency_key_conflict` errors, it should be *required* so the caller can debug which payload conflicted. Currently it's optional in the error schema.

2. **`reduction_audit_v1` doesn't record who performed the audit**: No `auditor_model` or `auditor_role` field. For safety, you'd want to know if the same LLM that generated the reduction also audited it (which would defeat clean-room).

3. **`toy_check_result=skipped` with `skip_reason` is allowed but not rate-limited**: There's no mechanism to prevent a system from always skipping toy checks "due to budget." Consider a campaign-level `max_toy_check_skip_ratio` or at least a diagnostic counter.

## Specific patch suggestions

### Patch 1: Add `uniqueItems` to `ranking_result_v1.effective_dimensions`

**File**: `schemas/ranking_result_v1.schema.json`  
**Change**: Add `"uniqueItems": true` to the `effective_dimensions` array.

```json
"effective_dimensions": {
  "type": "array",
  "minItems": 1,
  "uniqueItems": true,
  "items": { "enum": ["novelty", "feasibility", "impact", "tractability", "grounding"] },
  "description": "The dimensions actually used for ranking (intersection of requested dimensions and observed scorecard keys)."
}
```

**Rationale**: Prevents semantically invalid duplicate dimensions that could cause double-counting in Pareto front computation.

---

### Patch 2: Add `has_reduction_report` to `idea_list_filter_v1`

**File**: `schemas/idea_list_filter_v1.schema.json`  
**Change**: Add optional boolean field.

```json
"has_reduction_report": {
  "type": "boolean",
  "description": "Filter on presence of reduction_report (true=non-null; false=null). Useful for finding nodes that need reduction_audit before promotion."
}
```

**Rationale**: Natural companion to `has_eval_info`; adapter-side workflows that queue reduction audits need this filter.

---

### Patch 3: Require `payload_hash` in error data for `idempotency_key_conflict`

**File**: `schemas/rpc_error_data_v1.schema.json`  
**Change**: Add conditional requirement.

```json
{
  "if": {
    "properties": { "reason": { "const": "idempotency_key_conflict" } },
    "required": ["reason"]
  },
  "then": {
    "required": ["payload_hash", "idempotency_key"],
    "properties": {
      "payload_hash": {
        "type": "string",
        "pattern": "^sha256:[a-f0-9]{64}$",
        "description": "Hash of the NEW (conflicting) request payload. Caller can compare with the hash from the original request for debugging."
      }
    }
  }
}
```

Add this to the existing `allOf` array in `rpc_error_data_v1.schema.json`.

**Rationale**: When a caller hits `idempotency_key_conflict`, the most useful debugging information is *which* payload was expected vs. received. Making `payload_hash` required for this specific reason enables automated conflict resolution.

---

### Patch 4: Add `auditor_origin` to `reduction_audit_v1`

**File**: `schemas/reduction_audit_v1.schema.json`  
**Change**: Add optional provenance field for the audit itself.

```json
"auditor_origin": {
  "type": "object",
  "description": "Provenance of the audit execution (model/role that performed it). Recommended for clean-room verification.",
  "properties": {
    "model": { "type": "string", "minLength": 1 },
    "role": { "type": "string", "minLength": 1 },
    "session_id": { "type": "string", "format": "uuid" }
  },
  "additionalProperties": false
}
```

**Rationale**: Without this, there's no machine-checkable way to verify that the reduction audit was performed by a different agent/session than the one that produced the reduction_report. This is a safety gap for clean-room enforcement.

---

### Patch 5: Add shared dimension enum `$defs` block

**File**: `schemas/ranking_result_v1.schema.json` (and propagate to `evaluator_config_v1.schema.json`, `rank.compute` params)  
**Change**: Define dimensions once, reference everywhere.

Create a new file `schemas/_defs/score_dimensions.schema.json`:
```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "_defs/score_dimensions.schema.json",
  "title": "ScoreDimension enum",
  "description": "Canonical score dimension identifiers shared across evaluator, ranking, and scorecard schemas.",
  "enum": ["novelty", "feasibility", "impact", "tractability", "grounding"]
}
```

Then in `ranking_result_v1.schema.json`, `evaluator_config_v1.schema.json`, and `rank.compute` params:
```json
"items": { "$ref": "./_defs/score_dimensions.schema.json" }
```

**Rationale**: The dimension enum is currently duplicated in 4 places (`evaluator_config_v1`, `ranking_result_v1`, `rank.compute` params, `idea_scorecards_v1` implicitly). Adding a new dimension requires touching all of them. Single source prevents drift.

---

### Patch 6: Clarify `idea_scorecards_v1` status=`partial` semantics in the spec doc

**File**: `docs/plans/2026-02-12-idea-generator-architecture-spec.md`  
**Change**: In §6.1 (Evaluator), add a note after the `eval.run` description:

```markdown
> **Scorecard `status` semantics (normative; machine-enforced by `schemas/idea_scorecards_v1.schema.json`)**:
> - `complete`: all intended dimensions have usable scores (`scores` has ≥1 key; typically equal to `EvaluatorConfig.dimensions`).
> - `partial`: some dimensions scored but not all (e.g., `grounding` audit ran but `novelty` reviewer timed out). `scores` has ≥1 key. `rank.compute` treats these as usable (contributes to `observed_keys`).
> - `failed`: evaluation produced no usable scores (all reviewers failed/timed out/errored). `scores` MUST be empty (`{}`). `failure_modes` MUST be non-empty. `rank.compute` MUST ignore these when computing `observed_keys`.
```

**Rationale**: The schema enforces the structure but the spec doc doesn't explicitly state the ranking implications of `partial` vs `failed`. This is where implementers will look first.

---

### Patch 7: Add `uniqueItems` to `rank.compute` `dimensions` param

**File**: `schemas/idea_core_rpc_v1.openrpc.json`  
**Change**: In `rank.compute.params[].dimensions.schema`, add `"uniqueItems": true`.

```json
"dimensions": {
  "type": "array",
  "minItems": 1,
  "uniqueItems": true,
  "items": {
    "enum": ["novelty", "feasibility", "impact", "tractability", "grounding"]
  }
}
```

**Rationale**: Matches the semantic intent (you can't rank on the same dimension twice) and prevents edge cases in the intersection logic.
