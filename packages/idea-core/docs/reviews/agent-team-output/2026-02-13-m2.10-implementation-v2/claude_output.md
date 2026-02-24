VERDICT: NOT_READY

## Blockers

### B1. File-system store has no concurrency safety
`EngineStore._write_json` uses rename-over-tmp (good), but `_append_jsonl` and the load→mutate→save cycle in `_record_or_replay` / `_store_idempotency` are not atomic. Two concurrent stdio requests (or a future HTTP transport) will race on idempotency stores and node state. Even with single-threaded stdio today, the contract text says "idempotency records MUST be retained for the campaign lifetime" — a crash between `save_nodes` and `save_campaign` in `eval_run` leaves inconsistent state with no recovery path.

**Required fix:** At minimum, add a per-campaign file lock (e.g., `fcntl.flock` or `filelock` library) around every mutating handler, and document the single-writer assumption in `EngineStore` docstring. Add a `fsync` after `tmp.write_text` before the `replace` call in `_write_json` to survive power loss.

### B2. `payload_hash` does not use RFC 8785 (JCS) as required by the OpenRPC contract
`src/idea_core/engine/utils.py` computes `payload_hash` via `json.dumps(obj, sort_keys=True, ensure_ascii=True)` which is **not** JCS — it doesn't handle number canonicalization (`1.0` vs `1` vs `1.00`), and `json.dumps` doesn't guarantee RFC 8785 compliant output for edge cases (e.g., `-0`, large integers). The OpenRPC description explicitly states "JCS = RFC 8785 JSON Canonicalization Scheme."

**Required fix:** Use a JCS library (e.g., `canonicaljson` or `jcs` package) or implement the RFC 8785 number serialization rules. Add a regression test with numeric edge cases (`-0`, `1.0` vs `1`, etc.).

### B3. `eval.run` atomicity violation
The OpenRPC contract states: "Atomicity (MUST): on any error … the engine MUST perform no partial writes/mutations." But the current implementation validates `node_ids` existence early, then proceeds to score and write. If `self.catalog.validate_result` fails (line after all side-effects), nodes and artifacts have already been written. There's no rollback mechanism.

**Required fix:** Either (a) validate the result before any `save_nodes` / `save_campaign` / `write_artifact` calls (pre-compute then commit), or (b) implement a transactional wrapper that rolls back on failure.

### B4. No test coverage for `node.promote` with reduction gates
The scope checklist says "reduction gate (`reduction_audit_missing` / `reduction_audit_not_pass`)" is covered, but no test in the provided files exercises `node.promote` at all — the test files only cover `rank.compute`, idempotency, and reduction schema validation. The reduction tests (`test_reduction_and_schema_contracts.py`) only test the `build_reduction_audit` function against schemas, not the promotion code path.

**Required fix:** Add integration tests for:
- `node.promote` success (with and without reduction_report)
- `node.promote` failure: `reduction_audit_missing`
- `node.promote` failure: `reduction_audit_not_pass`
- `node.promote` failure: `grounding_audit_not_pass`
- `node.promote` failure: `abstract_problem_not_in_registry`

### B5. `_seed_node` produces `idea_card.thesis_statement` that is not schema-validated
Seed nodes are created with hardcoded `thesis_statement` strings like `"{content} This hypothesis is intentionally minimal for engine bootstrap."` but are never validated against `idea_card_v1.schema.json`. If a seed `content` is empty string (allowed by `seed_pack_v1.schema.json` if `minLength` isn't set), the resulting node may fail promotion or eval in unexpected ways.

**Required fix:** Validate seed nodes against `idea_node_v1.schema.json` at creation time (in `campaign_init`). This catches contract drift early.

## Non-blocking

### N1. Deterministic scoring defeats the purpose of ranking tests
`_deterministic_score` using SHA-256 is fine for a stub, but the tests can't distinguish between "ranking logic is correct" and "ranking logic happens to work for these particular hash values." Consider adding a test with manually injected scores (via artifact manipulation, as done in `test_rank_compute_ignores_failed_scorecards`) for explicit rank-ordering verification.

### N2. `campaign_status` result schema mismatch risk
`campaign_status` adds `node_count` and conditionally `early_stop_reason` to the result, but there's no test verifying the result validates against `campaign_status_v1.schema.json`. The `handle` method does validate results, but only if `campaign_status` is called through `handle`. Add a through-`handle` test for `campaign_status`.

### N3. Missing `utils.py` in audit files
`src/idea_core/engine/utils.py` is referenced but not included in the review bundle. The `payload_hash` and `sha256_hex` implementations are critical for idempotency correctness. This is not just a documentation gap — it's the file where B2 lives.

### N4. `_filter_nodes` doesn't validate filter keys
Unknown filter keys are silently ignored. A typo like `{"has_eval_infoo": true}` passes silently and returns all nodes. Consider raising on unknown keys or at minimum logging a warning.

### N5. `node.promote` doesn't bump `node.revision`
`eval.run` increments `node.revision` on mutation, but `node.promote` writes a handoff artifact without updating the node's state (no revision bump, no `promoted_at` on the node itself). This means the node log doesn't record the promotion event, and the node's `revision` is stale after promotion.

### N6. Error code reuse
`-32002` is used for both schema validation failures AND idempotency key conflicts. While the `reason` field disambiguates, this violates JSON-RPC convention where error codes should be semantically distinct. Consider using a dedicated code for idempotency conflicts.

### N7. `EngineStore` path traversal
`load_artifact_from_ref` accepts arbitrary `file://` URIs and resolves them to `Path` objects. A malicious artifact ref like `file:///etc/passwd` would be read. Add a check that the resolved path is under `self.root_dir`.

### N8. `CONTRACT_SOURCE.json` sync mechanism
`scripts/sync_contracts_snapshot.sh` is present but there's no CI integration or `make` target for drift detection against an upstream contract repo. The `CONTRACT_SOURCE.json` file is listed but not shown.

## Real-research fit

### R1. HEP domain grounding is placeholder-only
The `grounding_audit` is always set to `{"status": "pass", "folklore_risk_score": 0.2}` in the stub evaluator. For real HEP research, folklore risk is the primary safety concern (e.g., claiming a result already disproven by LEP/LHC data). The stub needs a clear extension point — an abstract `GroundingChecker` interface — not just a hardcoded pass.

### R2. Formalism registry is too generic
The default `hep/toy` formalism doesn't encode any actual HEP structure (e.g., Lagrangian terms, symmetry groups, particle content). The `c2_schema_ref` is a placeholder URL. For this to be usable in HEP-ph, the schema needs at least a `domain_metadata` extension point where HEP-specific fields (gauge group, particle spectrum, loop order) can live without polluting the core schema.

### R3. Evidence provenance chain is incomplete
Seed nodes reference `source_uris` but there's no mechanism to verify those URIs resolve to actual papers (INSPIRE/arXiv), nor to propagate evidence through the idea graph. The `evidence_uris_used` in `operator_trace` is a flat list — for real research, you need a DAG of evidence dependencies (claim A depends on result B from paper C).

### R4. No connection to `hepar` orchestrator
The design packet describes this as part of an "evidence-first HEP research ecosystem" but there's no adapter, hook, or interface for the `hepar` skill to invoke `idea-core`. The `rpc/server.py` stdio transport is a start, but there should be at least a documented integration contract (e.g., "hepar calls `idea-core` via stdio with these campaign charters").

## Robustness & safety

### S1. Hallucination mitigation is absent
The `idea_card.claims[].support_type` field exists in the schema but there's no enforcement that `support_type: "literature"` claims actually have resolvable `evidence_uris`. A stub evaluator that always passes grounding means hallucinated claims propagate through promotion unchecked.

### S2. No novelty deduplication
The OpenRPC schema references `novelty_delta_table_v1.schema.json` and `idea_novelty_report_v1.schema.json`, but neither is used in any code path. Two identical ideas can be seeded and promoted without detection.

### S3. Idempotency store grows unbounded
The contract says "retained for campaign lifetime" but there's no eviction, compaction, or size limit. For long-running campaigns with many eval/rank cycles, the idempotency JSON files will grow large and slow down load/save.

### S4. No input sanitization on `charter.scope` or seed `content`
These free-text fields flow into node structures that could later be used as LLM prompts. No length limits, no encoding validation, no injection guards. When real LLM backends replace the deterministic stub, this becomes a prompt injection surface.

### S5. `RpcError` stored as `error.__dict__` in idempotency includes Python internals
`error.__dict__` on a dataclass includes all fields, which is fine today, but if `RpcError` gains methods or non-serializable attributes, the idempotency store breaks silently. Use an explicit serialization method.

## Specific patch suggestions

### Patch 1: `src/idea_core/engine/utils.py` — JCS compliance
```python
# File: src/idea_core/engine/utils.py
# Change: Replace json.dumps-based hashing with JCS
# Before (inferred):
#   def payload_hash(obj): return f"sha256:{hashlib.sha256(json.dumps(obj, sort_keys=True).encode()).hexdigest()}"
# After:
import jcs  # pip install python-jcs
def payload_hash(obj: dict) -> str:
    canonical = jcs.canonicalize(obj)
    return f"sha256:{hashlib.sha256(canonical).hexdigest()}"
```
Also add `python-jcs>=0.3` to `pyproject.toml` dependencies.

### Patch 2: `src/idea_core/engine/store.py` — Path traversal guard
```python
# File: src/idea_core/engine/store.py
# In load_artifact_from_ref, after line `path = Path(artifact_ref[7:])`:
# Add:
        resolved = path.resolve()
        if not str(resolved).startswith(str(self.root_dir.resolve())):
            raise FileNotFoundError(f"artifact ref outside data directory: {artifact_ref}")
```

### Patch 3: `src/idea_core/engine/store.py` — Write durability
```python
# File: src/idea_core/engine/store.py
# In _write_json, after tmp.write_text(...):
# Add:
        import os
        fd = os.open(str(tmp), os.O_RDONLY)
        try:
            os.fsync(fd)
        finally:
            os.close(fd)
        tmp.replace(path)
```

### Patch 4: `src/idea_core/engine/service.py` — Validate seed nodes at creation
```python
# File: src/idea_core/engine/service.py
# In campaign_init, after the seed node creation loop (after `nodes[node["node_id"]] = node`):
# Add:
        try:
            self.catalog._validate_with_schema(
                {"$ref": "./idea_node_v1.schema.json"},
                node,
                base_uri=self.catalog.openrpc_path.resolve().as_uri() + "#/seed_node_validation",
            )
        except ContractRuntimeError as exc:
            raise self._schema_error(f"seed node {index} invalid: {exc}") from exc
```

### Patch 5: `src/idea_core/engine/service.py` — Atomicity fix for eval.run
```python
# File: src/idea_core/engine/service.py
# In eval_run, restructure to validate result BEFORE persisting:
# Move the result construction + catalog.validate_result call BEFORE store.save_nodes/save_campaign.
# Specifically, after building `result` dict and before any store writes:
        try:
            self.catalog.validate_result("eval.run", result)
        except ContractRuntimeError as exc:
            raise self._schema_error(f"result_schema_invalid: {exc}") from exc
        # Only now persist:
        self.store.save_nodes(campaign_id, updated_nodes)
        # ... rest of persistence
```
Note: this requires removing the redundant validate_result call in `handle()` or making it a no-op on already-validated results.

### Patch 6: `tests/engine/test_service_rank_and_idempotency.py` — Add node.promote tests
```python
# File: tests/engine/test_node_promote.py (new file)
# Add at minimum these test functions:
# - test_node_promote_success_without_reduction
# - test_node_promote_success_with_reduction
# - test_node_promote_fails_grounding_not_pass
# - test_node_promote_fails_reduction_audit_missing
# - test_node_promote_fails_reduction_audit_not_pass
# - test_node_promote_fails_abstract_problem_not_in_registry
# Each should call through service.handle("node.promote", ...) and verify
# the RpcError code/reason or success result schema.
```

### Patch 7: `pyproject.toml` — Add missing dependency
```toml
# File: pyproject.toml
# In [project.dependencies], add:
"python-jcs>=0.3",
"filelock>=3.12",
```

### Patch 8: `src/idea_core/engine/service.py` — Promote should update node state
```python
# File: src/idea_core/engine/service.py
# In node_promote, before self.store.save_campaign, add:
        node["promoted_at"] = now
        node["revision"] = int(node["revision"]) + 1
        nodes[node_id] = node
        self.store.save_nodes(campaign_id, nodes)
        self.store.append_node_log(campaign_id, node, mutation="promote")
```
