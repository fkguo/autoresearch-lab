VERDICT: NOT_READY

## Blockers

### B1: `_raise_not_implemented` returns wrong error code and bypasses result schema validation

**File:** `src/idea_core/engine/service.py`, lines for `campaign_topup`, `campaign_pause`, `campaign_resume`, `campaign_complete`, `search_step`

The stubs use error code `-32601` (`method_not_found`), but these methods **are** found — they're dispatched to handlers. The OpenRPC spec already declares them with specific error codes. Using `-32601` is semantically wrong and breaks clients that distinguish "method doesn't exist" from "method exists but isn't implemented yet". More critically, the `handle()` method catches `RpcError` generically, so the `error.data` for these stubs (`{"reason": "method_not_implemented", ...}`) is **never validated** against `rpc_error_data_v1.schema.json` — the `_store_idempotency(kind="error")` no-op means these errors also silently skip the idempotency path. The `handle()` method validates error data only through `_schema_error`; direct `RpcError` raises from `_raise_not_implemented` bypass `catalog.validate_error_data()`.

**Fix:** Use a distinct code (e.g., `-32000` or `-32601` with `"method_not_implemented"` as a formally declared reason in `x-error-data-contract.known_reasons`), and call `self.catalog.validate_error_data(data)` before raising. Add `"method_not_implemented"` to the known_reasons map in the OpenRPC doc.

### B2: `eval.run` does not check `node.campaign_id` membership

In `eval_run`, the code checks `if node_id not in nodes` but never verifies `nodes[node_id]["campaign_id"] == campaign_id`. The `node.get` method does this check (raising `node_not_in_campaign`), but `eval.run` skips it. If the store is ever shared or nodes are malformed, this is a silent correctness bug. The OpenRPC spec for `eval.run` declares error `-32014 node_not_in_campaign`, implying the engine MUST check it.

### B3: Idempotency store is loaded/saved without holding the lock for read-only methods

`campaign.status`, `node.get`, and `node.list` do not acquire `mutation_lock`. While they don't mutate, on platforms where JSON file writes are non-atomic (despite the tmp+rename pattern), concurrent reads during a write can get partial data. The `_write_json` uses atomic rename, so this is **mostly** safe on POSIX, but on Windows `tmp.replace(path)` is not guaranteed atomic. Since `filelock` is already a dependency and the design claims portability, this is a gap. **Severity: blocker on Windows; non-blocking on POSIX-only deployments.**

### B4: `node.promote` does not validate `campaign_id` match in `campaign.status` check flow

`node_promote` calls `_ensure_campaign_running(campaign)` but the loaded `campaign` is from `_load_campaign_or_error(campaign_id)`, which loads by filesystem path. If the stored campaign JSON has a different `campaign_id` (corruption), this is silently accepted. Add a defensive `assert campaign["campaign_id"] == campaign_id` or equivalent.

### B5: Missing `referencing` in `pyproject.toml` dependencies

`catalog.py` imports `from referencing import Registry, Resource`, but `referencing` is not listed in `[project] dependencies`. This will cause `ImportError` on clean install. Tests pass only because `jsonschema[format]` might pull it in transitively, but this is not guaranteed and is a packaging bug.

## Non-blocking

### N1: Deterministic scoring is a stub — fine for M2, but needs a clear extension point

`_deterministic_score` uses `sha256(node_id:dimension)` to produce scores. This is acceptable for M2 bootstrap, but the service has no plugin/hook mechanism to swap in real multi-agent evaluation. Consider adding a `ScoringBackend` protocol/ABC now to avoid a service.py rewrite at M3.

### N2: `_filter_nodes` does not validate filter keys against schema

Unknown filter keys are silently ignored. If a caller passes `{"has_eval": true}` (typo for `has_eval_info`), they get unfiltered results with no error. Consider validating against `idea_list_filter_v1.schema.json` at the service layer.

### N3: Idempotency store grows unboundedly

The spec says "retained for campaign lifetime," but there's no compaction or TTL. For long-running campaigns with many steps, `idempotency_store.json` will grow large and slow down every mutating call (full load + full save). Consider a note in the design for M3 to move to an append-only log or sqlite.

### N4: `campaign_status` response omits `node_count` field when early_stopped

The `campaign_status` method constructs a `status` dict that conditionally adds `early_stop_reason` but always adds `node_count`. This is fine, but the `campaign_status_v1.schema.json` marks `node_count` as optional — consider always including it for consistency (already done, just noting it's good).

### N5: `_seed_node` hardcodes `"island-0"` and `"seed.import"` operator

This is fine for M2 but should be documented as a known hardcoding that multi-island support (M3+) will need to parameterize.

### N6: No `__init__.py` files shown

The packet doesn't show `__init__.py` files for the packages. If they're missing, namespace packages may work but explicit `__init__.py` is more reliable for the setuptools `find` configuration.

### N7: `_prepared_side_effects_committed` for `eval.run` only checks scorecards artifact

It doesn't verify that `nodes_latest.json` was also written. If a crash happens between `write_artifact` and `save_nodes`, the prepared record will be promoted to committed on replay, but the nodes won't have eval_info. This is a narrow crash window but worth documenting.

### N8: `rank.compute` uses `last_scorecards_artifact_ref` from campaign state

This ref is set by `eval.run` but is not part of any schema — it's an internal campaign field. If multiple `eval.run` calls happen with different node subsets, only the last one's ref is stored. This means `rank.compute` without an explicit `scorecards_artifact_ref` silently uses whatever the last eval produced, which may not cover all nodes. Document this behavior or store a list.

## Real-research fit

### R1: HEP domain adequacy

The contract schemas are well-designed for HEP-ph research workflows. The `formalism_registry` pattern with `<namespace>/<name>` IDs (`hep/toy`, extendable to `hep/qft`, `hep/eft`, etc.) is clean. The `reduction_report` → `reduction_audit` pipeline maps well to the pattern of reducing HEP problems to known mathematical structures (optimization, group theory, etc.).

### R2: Evidence-first design is strong

The claim-level provenance in `idea_card_v1` (`claims[].support_type`, `evidence_uris`, `verification_plan` required for LLM inference/assumption) is genuinely useful for HEP research where folklore and unverified claims are common failure modes. The `folklore_risk_score` in grounding audit is a good innovation.

### R3: The `novelty_delta_table` is a strong differentiator

The `non_novelty_flags` enum (`parameter_tuning_only`, `relabeling_only`, `equivalent_reformulation`, etc.) addresses a real problem in LLM-assisted physics research where models frequently present known results as novel.

### R4: Gap: No integration point for actual literature retrieval

The schemas reference `evidence_uris` extensively but the engine has no mechanism to verify URI liveness or resolve arXiv/INSPIRE/PDG references. This is acceptable for M2 but should be flagged for M3 planning — the `hepar` and `sci-hub` skills in the ecosystem could provide this.

### R5: Gap: No C2 consumer interface

The handoff artifact is produced but there's no `c2.intake` or equivalent method. The design implicitly assumes an external consumer reads `file://` artifacts. This is fine architecturally but should be documented as a contract boundary.

## Robustness & safety

### S1: Hallucination mitigation is structurally sound

The `support_type` enum with mandatory `verification_plan` for `llm_inference` and `assumption` types is a good structural guard. The `grounding_audit` gate before promotion prevents ungrounded ideas from reaching C2.

### S2: Budget circuit breaker works correctly

The exhaustion detection, `_set_campaign_running_if_budget_available` rehydration, and `_ensure_campaign_running` guard form a correct budget safety net. The `degradation_order` in `budget_envelope_v1` is a forward-looking design.

### S3: Crash recovery has a narrow window

The `prepared → committed` staging is a good pattern, but the `_prepared_side_effects_committed` heuristic (checking if files exist) is fragile. If a file exists but is corrupt (partial write despite fsync), the record will be promoted. Consider adding a checksum in the prepared record.

### S4: `store.py` path traversal risk

`load_artifact_from_ref` checks `str(path).startswith(str(root) + os.sep)`, which is a string prefix check. On case-insensitive filesystems (macOS HFS+, Windows NTFS), this can be bypassed with case variations. Use `path.resolve()` and `root.resolve()` (already done) but also consider `os.path.commonpath` for a more robust check.

### S5: No rate limiting on stdio server

The server reads from stdin in a tight loop with no backpressure. A malicious or buggy client can flood it. For M2 this is acceptable, but note for production.

## Specific patch suggestions

### Patch 1: Add `referencing` to dependencies
**File:** `pyproject.toml`
```diff
 dependencies = [
   "jsonschema>=4.22.0,<5",
   "jcs>=0.2.1,<1",
   "filelock>=3.16.0,<4",
+  "referencing>=0.35.0,<1",
 ]
```

### Patch 2: Fix `_raise_not_implemented` to validate error data and use correct semantics
**File:** `src/idea_core/engine/service.py`
```diff
     def _raise_not_implemented(self, method: str) -> None:
+        data = {"reason": "method_not_implemented", "details": {"method": method}}
+        self.catalog.validate_error_data(data)
         raise RpcError(
-            code=-32601,
+            code=-32000,
             message="method_not_implemented",
-            data={"reason": "method_not_implemented", "details": {"method": method}},
+            data=data,
         )
```

### Patch 3: Add `method_not_implemented` to known error reasons in OpenRPC
**File:** `contracts/idea-generator-snapshot/schemas/idea_core_rpc_v1.openrpc.json`
```diff
     "known_reasons": {
       "-32001": ["dimension_exhausted"],
       "-32002": ["schema_invalid", "idempotency_key_conflict", "elo_config_required", "elo_config_unexpected"],
+      "-32000": ["method_not_implemented"],
       "-32013": ["insufficient_nodes", "insufficient_dimensions", "no_scorecards"],
```

### Patch 4: Add campaign_id membership check in `eval_run`
**File:** `src/idea_core/engine/service.py`, inside `eval_run`, after the `if node_id not in nodes` block:
```diff
             for node_id in node_ids:
                 if node_id not in nodes:
                     # ... existing error handling ...
+                if nodes[node_id].get("campaign_id") != campaign_id:
+                    data = {
+                        "reason": "node_not_in_campaign",
+                        "campaign_id": campaign_id,
+                        "node_id": node_id,
+                    }
+                    self.catalog.validate_error_data(data)
+                    error = RpcError(code=-32014, message="node_not_in_campaign", data=data)
+                    self._store_idempotency(
+                        method="eval.run",
+                        idempotency_key=idempotency_key,
+                        payload_hash_value=p_hash,
+                        campaign_id=campaign_id,
+                        response=error.__dict__,
+                        kind="error",
+                    )
+                    raise error
```

### Patch 5: Defensive campaign_id consistency check in `_load_campaign_or_error`
**File:** `src/idea_core/engine/service.py`
```diff
     def _load_campaign_or_error(self, campaign_id: str) -> dict[str, Any]:
         campaign = self.store.load_campaign(campaign_id)
         if campaign is None:
             data = {"reason": "campaign_not_found", "campaign_id": campaign_id}
             self.catalog.validate_error_data(data)
             raise RpcError(code=-32003, message="campaign_not_found", data=data)
+        if campaign.get("campaign_id") != campaign_id:
+            data = {"reason": "campaign_not_found", "campaign_id": campaign_id}
+            self.catalog.validate_error_data(data)
+            raise RpcError(code=-32003, message="campaign_not_found", data=data)
         return campaign
```

### Patch 6: Add test for `eval.run` node_not_in_campaign check
**File:** `tests/engine/test_service_rank_and_idempotency.py` (append)
```python
def test_eval_run_rejects_node_not_in_campaign(tmp_path: Path) -> None:
    service = make_service(tmp_path)
    init_result = init_campaign(service)
    campaign_id = init_result["campaign_id"]
    nodes = service.store.load_nodes(campaign_id)
    node_id = next(iter(nodes))
    # Corrupt the node's campaign_id
    nodes[node_id]["campaign_id"] = "00000000-0000-4000-8000-000000000000"
    service.store.save_nodes(campaign_id, nodes)

    try:
        service.handle(
            "eval.run",
            {
                "campaign_id": campaign_id,
                "node_ids": [node_id],
                "evaluator_config": {"dimensions": ["novelty"], "n_reviewers": 2},
                "idempotency_key": "eval-wrong-campaign",
            },
        )
        assert False, "expected RpcError"
    except RpcError as exc:
        assert exc.code == -32014
        assert exc.data["reason"] == "node_not_in_campaign"
```

### Patch 7: Use `os.path.commonpath` for safer path traversal guard
**File:** `src/idea_core/engine/store.py`
```diff
     def load_artifact_from_ref(self, artifact_ref: str) -> dict[str, Any]:
         if not artifact_ref.startswith("file://"):
             raise FileNotFoundError(f"unsupported artifact ref: {artifact_ref}")
         path = Path(artifact_ref[7:]).resolve()
         root = self.root_dir.resolve()
-        if not str(path).startswith(str(root) + os.sep):
+        try:
+            common = Path(os.path.commonpath([path, root]))
+        except ValueError:
+            raise FileNotFoundError(f"artifact ref outside store root: {artifact_ref}")
+        if common != root:
             raise FileNotFoundError(f"artifact ref outside store root: {artifact_ref}")
         if not path.exists():
             raise FileNotFoundError(path)
         return self._read_json(path, default={})
```
