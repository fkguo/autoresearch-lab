VERDICT: READY

## Blockers

No blocking issues found. The five targeted micro-patches are correctly implemented:

1. **`ranking_result_v1.effective_dimensions` → `uniqueItems: true`**: Present and correct in `schemas/ranking_result_v1.schema.json`. This prevents duplicate dimension entries from silently corrupting Pareto/Elo computations.

2. **`idea_list_filter_v1.has_reduction_report`**: Present and correct in `schemas/idea_list_filter_v1.schema.json` with appropriate description. Enables querying nodes that need reduction audits before promotion.

3. **`rpc_error_data_v1` → `idempotency_key` + `payload_hash` required when `reason=idempotency_key_conflict`**: The `allOf` conditional in `schemas/rpc_error_data_v1.schema.json` correctly enforces both fields via `"then": { "required": ["idempotency_key", "payload_hash"] }`. The OpenRPC info description (§2b) also documents this clearly.

4. **`reduction_audit_v1.auditor_origin`**: Present as optional object with `{model, role, session_id}` properties in `schemas/reduction_audit_v1.schema.json`. The architecture spec §4.2.1 references it for clean-room provenance. Correctly optional (not all audits originate from multi-model setups).

5. **`distributor_event_v1` → if `rng_seed_used` then `rng_alg` required**: The `allOf` conditional is correctly implemented: `"if": { "required": ["rng_seed_used"] }, "then": { "required": ["rng_alg"] }`. This ensures self-contained replay without needing to dereference `distributor_policy_config_v1.json`.

6. **OpenRPC v1.9.7 + idempotency conflict payload_hash clarification**: Version bumped; the `info.description` §2b now explicitly documents `error.data.payload_hash` requirement for conflicts.

## Non-blocking

1. **`auditor_origin` lacks `timestamp`**: The `reduction_audit_v1` already has a top-level `timestamp`, but `auditor_origin` doesn't record *when* the auditor session started. For clean-room provenance across time-zones / async pipelines, consider adding `audited_at` inside `auditor_origin`. Low priority since the top-level `timestamp` covers the primary use case.

2. **`has_reduction_report` filter is boolean-only**: Consider adding `has_reduction_audit` as a companion filter (boolean), enabling the query pattern "nodes that have a reduction_report but *lack* a reduction_audit" directly, rather than requiring client-side post-filtering. This is the primary use case mentioned ("queuing reduction audits"). Currently the adapter must fetch `has_reduction_report=true` then filter client-side for `reduction_audit==null`.

3. **`rng_alg` in `distributor_event_v1` vs `distributor_policy_config_v1`**: Both schemas allow `rng_alg`; the event-level field is documented as "Echo … for self-contained replay." Consider adding a brief `$comment` noting that the event-level value MUST match the config-level value (if present) to prevent silent divergence. Currently this invariant is implicit.

4. **`uniqueItems` on `effective_dimensions` but not on `rank.compute.dimensions` param**: The input `dimensions` array in the OpenRPC `rank.compute` params schema doesn't enforce `uniqueItems`. A caller could send `["novelty", "novelty"]` and rely on the engine to deduplicate. Adding `uniqueItems: true` to the input would fail-fast.

5. **`auditor_origin.session_id` format `uuid`**: Good. But the `idea_node_v1.origin` block doesn't have a `session_id` field at all. For consistent clean-room traceability, consider adding an optional `session_id` to `origin` as well. Low priority.

6. **`payload_hash` pattern in `rpc_error_data_v1`**: Uses `^sha256:[a-f0-9]{64}$` — matches `idempotency_meta_v1.schema.json`. Good consistency. However, the spec says "compute `payload_hash = sha256(JCS(params_without_idempotency_key))`" — the string representation should be documented as `sha256:<hex>`. This is already implicitly clear from the regex but a `description` addition would help implementers.

7. **`distributor_event_v1.rng_alg` is not enum-constrained**: Unlike `distributor_policy_config_v1.deterministic_sampling.rng_alg` (also free-form), there's no recommended value set. Consider adding `examples: ["pcg64", "mt19937", "xoshiro256++"]` for discoverability.

8. **Idempotency conflict error code documentation**: The `x-error-data-contract.known_reasons` for `-32002` lists `idempotency_key_conflict` but the per-method `errors` blocks only reference `-32002` by message `schema_validation_failed`. This is correct (it's a sub-reason, not a separate code), but could confuse implementers skimming only the method-level error lists. A brief note in the OpenRPC `description` field of the `-32002` error reference saying "includes idempotency_key_conflict sub-reason" would help.

## Real-research fit

**Strong fit for HEP workflows.** The five micro-patches address genuine operational needs:

- **`uniqueItems` on dimensions**: Prevents a subtle ranking bug where duplicate dimensions would double-weight a criterion in Pareto front computation — a real concern when adapters programmatically construct dimension lists from evaluator configs.

- **`has_reduction_report` filter**: Directly serves the "reduction audit queue" workflow: after a `ProblemReduction` operator fires, the orchestrator needs to identify which nodes require auditing before they can be promoted. This is a first-class operation in the HEP research flow where mathematical reductions (e.g., reducing a BSM observable calculation to a standard integral family) are common.

- **`idempotency_key_conflict` with `payload_hash`**: Essential for multi-session orchestration where the hepar adapter might retry with stale keys. Having the hash in the error response lets the adapter immediately diagnose "same key, different intent" without round-tripping to logs.

- **`auditor_origin`**: Clean-room reduction audits are critical when the same LLM that generated the reduction report should not audit it. Recording the auditor's identity is necessary for the Checker role's independence guarantees (§3.4.2).

- **`rng_seed_used` → `rng_alg` dependency**: Without knowing the algorithm, a seed is useless for replay. This is especially important for the distributor's bandit policies where reproducibility is a hard requirement (§3.3.1).

The overall architecture continues to map well to real HEP discovery patterns: the `ProblemReduction` → `reduction_audit` gate mirrors how physicists validate that a loop integral really reduces to known master integrals before committing compute resources.

## Robustness & safety

1. **Evidence-first discipline maintained**: The `reduction_audit` gate remains a hard blocker for promotion. The addition of `auditor_origin` strengthens the clean-room guarantee without weakening the gate.

2. **Idempotency conflict detection is now fully machine-readable**: The `rpc_error_data_v1` conditional requiring both `idempotency_key` and `payload_hash` when `reason=idempotency_key_conflict` means adapters can auto-diagnose conflicts without human intervention. The JCS canonicalization spec (RFC 8785) is correctly referenced for deterministic hashing.

3. **Replay fidelity for distributor**: The `rng_seed_used` → `rng_alg` dependency in `distributor_event_v1` closes a replay gap. Previously, an event could record a seed without recording which algorithm consumed it, making replay impossible. This is now schema-enforced.

4. **No regression on existing gates**: Grounding audit, formalism registry check, and reduction audit gates remain unchanged in their blocking semantics. The new `has_reduction_report` filter is purely additive.

5. **Hallucination mitigation**: The `auditor_origin` field enables post-hoc verification that reduction audits were performed by independent sessions/models, supporting the clean-room discipline that is the primary defense against LLM self-confirmation bias.

6. **Minor safety gap**: The `reduction_audit_v1.auditor_origin` is optional. For maximum clean-room safety, it should be required when `status=pass` (the auditor identity should always be known for passed audits). However, making it required would be a breaking change for existing implementations, so the current optional approach is pragmatically correct for v0.2.

## Specific patch suggestions

### Patch 1: Add `has_reduction_audit` companion filter
**File**: `schemas/idea_list_filter_v1.schema.json`
**What**: Add `"has_reduction_audit": { "type": "boolean", "description": "Filter on presence of reduction_audit (true=non-null; false=null). Use with has_reduction_report=true to find nodes needing reduction audit." }` to `properties`.
**Why**: The stated purpose of `has_reduction_report` is "queuing reduction audits," but the actual query needs both filters to find un-audited reductions. Without this, the adapter must fetch all nodes with reduction reports and post-filter.

### Patch 2: Add `uniqueItems` to `rank.compute.dimensions` input param
**File**: `schemas/idea_core_rpc_v1.openrpc.json`
**What**: In the `rank.compute` method's `dimensions` param schema, add `"uniqueItems": true` alongside the existing `"minItems": 1`:
```json
"dimensions": {
  "type": "array",
  "minItems": 1,
  "uniqueItems": true,
  "items": { ... }
}
```
**Why**: If the output (`effective_dimensions`) enforces `uniqueItems`, the input should too — fail-fast at the API boundary rather than silently deduplicating.

### Patch 3: Add `rng_alg` consistency note to `distributor_event_v1`
**File**: `schemas/distributor_event_v1.schema.json`
**What**: Amend the `rng_alg` description to: `"description": "Echo of the RNG algorithm used for this decision (for self-contained replay). MUST match distributor_policy_config_v1.deterministic_sampling.rng_alg when present."`
**Why**: Prevents silent divergence between config-level and event-level `rng_alg` declarations.

### Patch 4: Strengthen `auditor_origin` for passed reduction audits
**File**: `schemas/reduction_audit_v1.schema.json`
**What**: Add a conditional in the existing `allOf` block:
```json
{
  "if": {
    "properties": { "status": { "const": "pass" } },
    "required": ["status"]
  },
  "then": {
    "required": ["reduction_type_valid", "toy_check_result", "assumptions", "auditor_origin"],
    "properties": {
      "reduction_type_valid": { "const": true },
      "toy_check_result": { "const": "pass" },
      ...existing constraints...
    }
  }
}
```
**Why**: A passed reduction audit that enters the promotion pipeline should always have traceable auditor provenance. This merges with the existing `status=pass` conditional block (add `"auditor_origin"` to its `required` list).

### Patch 5: Document `payload_hash` string format for implementers
**File**: `docs/plans/2026-02-12-idea-generator-architecture-spec.md`
**What**: In §2.3 under "Payload 等价（必须可机读）", after the `payload_hash = sha256(JCS(params_without_idempotency_key))` definition, add:
```
- **String representation**：`payload_hash` 必须以 `sha256:<hex>` 格式表示（64 位小写十六进制），与 `idempotency_meta_v1.schema.json` 和 `rpc_error_data_v1.schema.json` 的 pattern `^sha256:[a-f0-9]{64}$` 一致。
```
**Why**: The spec defines the computation but not the wire format. The schema enforces the pattern, but the spec should be self-contained for implementers who read the prose first.

### Patch 6: Add sub-reason note to per-method `-32002` error references
**File**: `schemas/idea_core_rpc_v1.openrpc.json`
**What**: In each method that lists error code `-32002` (e.g., `campaign.init`, `eval.run`, `rank.compute`, `node.promote`), amend the error object to include a `data` field or description note:
```json
{
  "code": -32002,
  "message": "schema_validation_failed",
  "data": { "$ref": "./rpc_error_data_v1.schema.json" }
}
```
Alternatively (lower friction), just add to each `-32002` error entry: `"description": "Sub-reasons per x-error-data-contract: schema_invalid, idempotency_key_conflict, elo_config_required, elo_config_unexpected."` Only needs to be added to the methods that carry `idempotency_key` (all side-effecting methods).
**Why**: Implementers scanning method-level error lists won't see the `idempotency_key_conflict` sub-reason without navigating to `x-error-data-contract`. This is a discoverability fix.
