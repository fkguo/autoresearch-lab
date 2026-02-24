VERDICT: NOT_READY

## Blockers

### B1: `eval.run` atomicity contract violated
The OpenRPC spec states: *"on any error (including budget_exhausted, node_not_found, node_not_in_campaign), the engine MUST perform no partial writes/mutations; if partial work occurs internally it MUST be rolled back before returning (and before storing the idempotency record)."*

However, `service.py` `eval_run()` stores an idempotency record for the `node_not_found` error case **before** raising the error:
```python
error = RpcError(code=-32004, message="node_not_found", data=data)
self._store_idempotency(
    method="eval.run",
    ...
    response=error.__dict__,
    kind="error",
)
raise error
```
This means a transient failure (e.g., a node that was being concurrently created) gets permanently cached as an error. Error idempotency records are defensible for payload conflicts, but for `node_not_found` the contract says "MUST NOT store the idempotency record" on errors that preclude side-effects. The same pattern appears in `rank.compute` and `node.promote` for pre-condition check errors that are not payload conflicts.

**Fix:** Only store idempotency records for *committed* outcomes (success or semantic conflicts like `idempotency_key_conflict`). Pre-condition errors (`node_not_found`, `campaign_not_active`, `grounding_audit_not_pass`, etc.) should NOT be idempotency-cached—they are retriable conditions.

### B2: `search.step` and campaign mutation RPCs (`campaign.topup`, `campaign.pause`, `campaign.resume`, `campaign.complete`) are declared in the OpenRPC contract but not implemented
The contract file `idea_core_rpc_v1.openrpc.json` declares 12 methods. The `handle()` dispatcher registers only 7. Any caller invoking `search.step`, `campaign.topup`, `campaign.pause`, `campaign.resume`, or `campaign.complete` receives a generic `method_not_found` error. This is a contract drift: the vendored OpenRPC says these methods exist. The validation tooling (`validate.py`) checks that schemas are self-consistent but does **not** verify that declared methods have registered handlers. This is a live interop hazard for any adapter (like the hepar skill) that reads the OpenRPC to discover capabilities.

**Fix (pick one):**
- Add a `validate_method_coverage(service, openrpc_doc)` check that fails `make validate` if any declared method lacks a handler, OR
- Strip unimplemented methods from the vendored OpenRPC snapshot and re-add them when implemented. The snapshot should reflect the *implemented* surface, not the *planned* surface.

### B3: Crash between `prepared` write and `committed` write can leave orphaned idempotency records that block future retries
`_record_or_replay` calls `_prepared_side_effects_committed()` which checks whether the side-effect artifacts exist on disk. If a crash happens *after* the prepared record is written but *before* artifacts are flushed, the prepared record persists. On retry, `_record_or_replay` sees the prepared record, calls `_prepared_side_effects_committed()` → returns `False`, deletes the record, and re-executes. This is correct for the single-retry case.

However, there is a **race window**: if two concurrent retries hit the same prepared record simultaneously, both could delete the record and both attempt to re-execute. The `mutation_lock` mitigates this for the same campaign, but for `campaign.init` the lock is on `None` (global lock). If `FileLock` acquisition is not truly exclusive (e.g., NFS, or lock file corruption), both proceed. More critically: **the global idempotency store is read → mutated → written outside an atomic transaction**—the `load_idempotency` / `save_idempotency` pair can lose writes if two processes interleave reads.

**Fix:** Either:
- Document that the engine is single-writer only (add an assertion/startup check), OR
- Use atomic compare-and-swap on the idempotency store (e.g., embed a revision counter in the JSON and fail-retry on mismatch).

## Non-blocking

### N1: Deterministic scoring stub is not flagged as a stub in artifacts
`_deterministic_score` produces SHA-based scores that are written into scorecards artifacts and persisted as `eval_info` on nodes. Nothing in the artifact marks these as synthetic/stub scores. A downstream consumer (or a future `search.step` operator) could treat them as real evaluations.

**Suggestion:** Add `"synthetic": true` or `"evaluator_backend": "deterministic_stub"` to the scorecards artifact and to `eval_info` so downstream consumers can distinguish stub from real evaluation data.

### N2: `_filter_nodes` does not validate filter keys
Unknown filter keys are silently ignored. If a caller passes `{"has_eval": true}` (typo for `has_eval_info`), they get unfiltered results with no error. The `idea_list_filter_v1.schema.json` has `additionalProperties: false`, but the engine doesn't validate the filter object against this schema—it only validates top-level RPC params.

**Suggestion:** Validate the `filter` param body against `idea_list_filter_v1.schema.json` explicitly, or rely on the existing param-level schema validation (which should already catch this if the `$ref` resolves correctly—verify this path).

### N3: No test for `campaign.status` with `early_stopped` status
The `campaign_status_v1.schema.json` requires `early_stop_reason` when `status == "early_stopped"` (via `allOf`/`if`/`then`). There's no test exercising this path. The `campaign_status` handler includes `status.get("early_stop_reason", "policy_halt")` but only conditionally adds it—this could silently pass until a real early-stop scenario is triggered.

### N4: `_write_json` temp-file cleanup on error
`_write_json` creates a `.tmp` file, writes, fsyncs, and renames. If the write or fsync raises, the `.tmp` file is left on disk. Not critical for correctness (next write will overwrite), but could accumulate on repeated failures.

### N5: `node.list` result not validated against contract
Unlike other mutating methods, `node.list` and `node.get` results are returned directly from `handle()` which *does* call `self.catalog.validate_result()`. However, `node.list` returns a `nodes` array of full `IdeaNode` objects—each validated only at creation time. If any in-memory mutation (e.g., via `_mutate_node` in tests, or a future bug) corrupts a node, `validate_result` will catch it but with an opaque error. Consider adding a specific node-level validation error message.

### N6: Missing `Makefile` in the packet
The packet references `make validate` but the `Makefile` is not included. Reviewers cannot verify the exact commands.

## Real-research fit

### R1: HEP domain grounding is purely structural, not semantic
The grounding audit is a stub that always returns `"status": "pass"` with `folklore_risk_score: 0.2` when the `grounding` dimension is evaluated. For real HEP research:
- Grounding needs to check claims against arXiv/INSPIRE/PDG data
- Folklore risk scoring needs actual novelty retrieval (embedding similarity against prior art)
- The `evidence_uris` in seed nodes point to `https://example.org/reference`

This is acceptable for M2-minimal but the architecture needs a **grounding provider interface** (plugin point) before M3. The current code hardcodes grounding into `eval_run`, making it non-replaceable without modifying the service.

### R2: Reduction report/audit flow is well-designed for technique transplant
The `reduction_report_v1` → `reduction_audit_v1` → promotion gate chain is a genuinely useful pattern for cross-domain method transfer in HEP (e.g., applying ML optimization techniques to lattice QCD). The 8-row minimum on `reduction_map`, 2-solution minimum on `known_solutions`, and the toy check requirement are reasonable guards against shallow analogies.

### R3: The island model is structurally present but functionally inert
`island_states` is tracked but there's no island-level search policy, migration, or stagnation detection. For real multi-island evolutionary search (which is the stated design intent), the `search.step` implementation will need to drive island dynamics. Current M2 correctly defers this.

### R4: Budget circuit breaker is functional and production-appropriate
The multi-dimensional budget tracking (tokens, cost, wall-clock, steps, nodes) with `exhausted` status transitions and the `degradation_order` schema in `BudgetEnvelope` show forethought for real research runs that need cost control.

## Robustness & safety

### S1: Idempotency payload hash includes defaults—good, but fragile
`_hash_without_idempotency` fills defaults from the contract schema before hashing. This is correct per the OpenRPC spec ("Engines SHOULD apply default-value filling"). However, if a schema default changes between versions, all existing idempotency records become stale (different hash for same intent). The `contract_version` is tracked in `ContractCatalog` but never embedded in the idempotency record.

**Recommendation:** Embed `contract_version` in the idempotency store record so that version migration can invalidate/recompute hashes.

### S2: No rate limiting or abuse protection on the stdio JSON-RPC server
The server reads unbounded input lines. A malicious or buggy adapter could send arbitrarily large JSON payloads. Not critical for M2 (local process), but should be addressed before any network transport.

### S3: Error idempotency caching creates a denial-of-service vector
Per B1, pre-condition errors are cached. An attacker (or buggy adapter) that sends `eval.run` with a non-existent `node_id` using a valid `idempotency_key` permanently poisons that key. The real request with correct `node_ids` but the same key would get an `idempotency_key_conflict`.

### S4: JCS canonicalization + default filling is the correct approach for deterministic hashing
The use of RFC 8785 (JCS) for payload hashing is the right choice. The `jcs` library is well-maintained and handles edge cases (number formatting, key ordering). This is a safety-positive design decision.

### S5: `file://` artifact refs are inherently non-portable
All artifact refs are `file://` URIs resolved against the local filesystem. This is fine for M2 but blocks any distributed or cloud deployment. The `EngineStore.load_artifact_from_ref` correctly validates that refs stay within the store root (path traversal protection).

## Specific patch suggestions

### Patch 1: Stop caching pre-condition errors in idempotency store

**File:** `src/idea_core/engine/service.py`

In `eval_run`, `rank_compute`, and `node_promote`: remove the `self._store_idempotency(...)` calls that precede `raise error` for pre-condition failures (`node_not_found`, `grounding_audit_not_pass`, `reduction_audit_*`, `insufficient_eval_data`, `campaign_not_active`). Keep idempotency caching only for:
1. Successful results (prepared → committed)
2. `idempotency_key_conflict` (already handled in `_record_or_replay`)
3. Schema validation errors that are deterministic given the payload (e.g., duplicate `abstract_problem_type`)

Specifically, remove ~15 instances of:
```python
self._store_idempotency(
    method="...",
    idempotency_key=idempotency_key,
    payload_hash_value=p_hash,
    campaign_id=campaign_id,
    response=error.__dict__,
    kind="error",
)
```
that appear before `raise error` for non-deterministic pre-condition checks. Retain the instances in `campaign_init` for the duplicate `abstract_problem_type` case (that *is* deterministic given the payload).

### Patch 2: Add method coverage validation

**File:** `src/idea_core/contracts/validate.py`

Add after `validate_drift_guard`:
```python
def validate_method_coverage(openrpc_doc: LoadedDoc, *, implemented_methods: set[str] | None = None) -> None:
    """Warn or fail if OpenRPC declares methods not in the implemented set."""
    if implemented_methods is None:
        return  # Skip when not provided (e.g., standalone schema validation)
    declared = {m["name"] for m in openrpc_doc.data.get("methods", [])}
    unimplemented = declared - implemented_methods
    if unimplemented:
        # For now, emit a warning in the validation output rather than hard-fail
        import sys
        print(f"[validate] WARN: declared but unimplemented methods: {sorted(unimplemented)}", file=sys.stderr)
```

### Patch 3: Mark stub evaluator output as synthetic

**File:** `src/idea_core/engine/service.py`, in `eval_run` method

Change the scorecard construction (~line in `eval_run`):
```python
scorecard = {
    "node_id": node_id,
    "scores": scores,
    "reviewer_count": n_reviewers,
    "status": "complete",
    "fix_suggestions": [],
    "failure_modes": [],
}
```
to:
```python
scorecard = {
    "node_id": node_id,
    "scores": scores,
    "reviewer_count": n_reviewers,
    "status": "complete",
    "fix_suggestions": [],
    "failure_modes": [],
    "notes": "synthetic:deterministic_stub",
}
```

### Patch 4: Embed contract version in idempotency records

**File:** `src/idea_core/engine/service.py`, in `_store_idempotency`

Change:
```python
store[key] = {
    "payload_hash": payload_hash_value,
    "created_at": utc_now_iso(),
    "state": state,
    "response": { "kind": kind, "payload": response },
}
```
to:
```python
store[key] = {
    "payload_hash": payload_hash_value,
    "created_at": utc_now_iso(),
    "state": state,
    "contract_version": self.catalog.contract_version,
    "response": { "kind": kind, "payload": response },
}
```

### Patch 5: Add early-stopped campaign status test

**File:** `tests/engine/test_node_read_methods.py` (or new file)

Add:
```python
def test_campaign_status_early_stopped_requires_reason(tmp_path: Path) -> None:
    service = make_service(tmp_path)
    campaign_id = init_campaign(service)
    campaign = service.store.load_campaign(campaign_id)
    campaign["status"] = "early_stopped"
    campaign["early_stop_reason"] = "policy_halt"
    service.store.save_campaign(campaign)

    result = service.handle("campaign.status", {"campaign_id": campaign_id})
    assert result["status"] == "early_stopped"
    assert result["early_stop_reason"] == "policy_halt"
    # Validates against campaign_status_v1 schema (via handle -> validate_result)
```

### Patch 6: Strip unimplemented methods from vendored OpenRPC OR add `x-status` annotations

**File:** `contracts/idea-generator-snapshot/schemas/idea_core_rpc_v1.openrpc.json`

For each unimplemented method (`campaign.topup`, `campaign.pause`, `campaign.resume`, `campaign.complete`, `search.step`), add:
```json
"x-implementation-status": "not_implemented"
```
as a sibling of `"name"`. Then update the method coverage validator to skip methods with this annotation. This preserves the full contract for documentation while making the implementation gap explicit and machine-readable.
