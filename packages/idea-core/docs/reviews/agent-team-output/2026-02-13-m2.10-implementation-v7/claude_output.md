VERDICT: READY

## Blockers

No blockers remain. All five v6 blockers (B1–B5) are resolved:

1. **B1 `eval.run` cross-campaign node check**: ✅ `node_not_in_campaign` with code `-32014` is emitted after the `node_not_found` check, with correct error data, and regression-tested in `test_eval_run_rejects_node_not_in_campaign`.

2. **B2 Read-method locking**: ✅ `campaign.status`, `node.get`, and `node.list` all acquire `self.store.mutation_lock(campaign_id)` for portable consistency.

3. **B3 Defensive campaign payload consistency**: ✅ `_load_campaign_or_error` checks `campaign.get("campaign_id") != campaign_id` and raises `-32003` if mismatched.

4. **B4 Stub methods return validated error data**: ✅ `_raise_not_implemented` uses code `-32000`, reason `"method_not_implemented"`, and validates via `catalog.validate_error_data(data)` before raising. Regression-tested in `test_stub_method_returns_method_not_implemented_error`.

5. **B5 `referencing` dependency**: ✅ Declared in `pyproject.toml` as `referencing>=0.35.0,<1`.

## Non-blocking

1. **`_raise_not_implemented` is called *after* param validation in `handle()`**: The current flow validates request params before dispatching to the handler. For stub methods like `search.step`, this means a schema-invalid request gets `-32002` instead of `-32000`. This is arguably correct (fail-fast on bad input), but the OpenRPC spec doesn't declare whether param validation should precede the "not implemented" guard. Consider documenting this ordering as intentional in the OpenRPC `info.description` or a comment.

2. **`node.get` cross-campaign check is redundant given store scoping**: `node.get` loads `self.store.load_nodes(campaign["campaign_id"])` which is already campaign-scoped by directory. The `node_not_in_campaign` check on the retrieved node's `campaign_id` field is a defense-in-depth integrity check—good—but will only fire if the stored JSON was corrupted or tampered with. The same pattern in `eval.run` is genuinely needed (caller could pass a node_id belonging to campaign B into campaign A's eval). Consider adding a brief comment distinguishing the two use-cases.

3. **Read-method lock granularity**: Acquiring `mutation_lock` for read-only methods (`campaign.status`, `node.get`, `node.list`) serializes reads with writes, which is correct for file-backed stores but will bottleneck under concurrent access. This is fine for the M2 milestone (single-process, file-backed), but should be revisited if the store moves to SQLite or a database backend. No action needed now.

4. **Error code `-32000` semantics**: JSON-RPC 2.0 reserves `-32000` to `-32099` for "server errors." Using `-32000` for `method_not_implemented` is within spec, but `-32601` ("method not found") is the standard code for unknown methods. The distinction between "method exists in the contract but is not implemented" (`-32000`) vs. "method not found" (`-32601`) is clear and well-motivated, but consumers should be warned that `-32000` is not the same as `-32601`. The `known_reasons` table already documents this—sufficient.

5. **No test for `_load_campaign_or_error` defensive check (B3)**: The campaign-ID mismatch path is hard to trigger without corrupting the store. Consider adding a targeted unit test that writes a campaign JSON with a mismatched `campaign_id` field and asserts `-32003`.

6. **`node.promote` also checks `node_not_in_campaign`**: The promote path already had this check before this delta. Consistent with the new `eval.run` and `node.get` behavior. No action needed.

7. **Missing `__init__.py` in `src/idea_core/engine/`**: Not visible in the diff, but if absent, imports may fail in some packaging modes. Likely already present from prior milestones—just flagging for completeness.

## Real-research fit

The artifact contract and gating logic are well-suited for HEP research automation:

- **Evidence provenance**: Every node carries `origin.prompt_hash`, `operator_trace.evidence_uris_used`, and `idea_card.claims[].evidence_uris`. The `grounding_audit` gate blocks promotion of nodes without verified evidence chains. This directly maps to the physics requirement that no hypothesis should be promoted without literature-backed support.

- **Reduction audit as a formal verification layer**: The `reduction_report` → `reduction_audit` → `abstract_problem_registry` pipeline is a clean analog of the physics workflow where a new idea must be mapped to a known problem class (e.g., "this flavor anomaly reduces to a constrained BSM optimization problem") before it can be handed off to computation. The `toy_check_result` field enforces that at least a minimal sanity check has been performed—critical for HEP where order-of-magnitude estimates often kill ideas early.

- **Formalism registry as domain extensibility**: The merge semantics for `formalism_registry` and `abstract_problem_registry` (caller overrides take precedence by key) allow domain packs to ship defaults while letting specific campaigns override with custom formalisms (e.g., SMEFT vs. simplified models). The current `hep/toy` default is appropriate for bootstrap; real domain packs would ship `hep/eft`, `hep/simplified-model`, etc.

- **Idempotency for long-running research workflows**: The prepare/commit two-phase idempotency pattern is well-suited for research workflows where a crash during artifact writing (e.g., a 30-minute eval run) should not corrupt state. The `_prepared_side_effects_committed` check is the right recovery strategy.

- **Campaign budget model**: The `pilot-then-scale` pattern (init with small budget → topup) matches how real research computing allocations work (test on small allocation, then request full allocation after validation).

## Robustness & safety

1. **Hallucination mitigation via schema validation**: Every result and error is validated against the contract schema before being returned. The `validate_error_data` call on all error paths ensures that error responses are machine-parseable and conform to the contract. This is a strong defense against hallucinated error shapes from future LLM-driven method implementations.

2. **Atomicity via prepare/commit**: The two-phase idempotency pattern (`state="prepared"` → write artifacts → `state="committed"`) provides crash recovery. If the process dies between prepare and commit, the next call with the same idempotency key detects uncommitted state via `_prepared_side_effects_committed` and retries. This is correct and well-tested.

3. **File-path traversal protection**: `store.load_artifact_from_ref` validates that the resolved path is under `self.root_dir`, preventing path-traversal attacks via crafted `artifact_ref` values. Good.

4. **Lock scope correctness**: The `mutation_lock` is per-campaign (or global for `campaign.init`). This correctly isolates concurrent campaigns while serializing operations within a campaign.

5. **Deterministic scoring is appropriate for M2**: The `_deterministic_score` function (SHA256-based) is explicitly a stub for engine contract testing. It's deterministic, reproducible, and clearly not a real evaluator. The function name and the seed node's `"method": "deterministic scoring stub"` make this transparent.

6. **One concern**: `_store_idempotency` silently returns without storing when `kind == "error"`. This means error responses are NOT idempotent—retrying the same request after an error will re-execute. This is documented behavior (errors are not cached), but could lead to surprising behavior if, e.g., a `node_not_found` error is transient (node created by a concurrent operation between retries). For M2's single-process model this is acceptable; for M3+ with concurrent access, error idempotency should be revisited.

## Specific patch suggestions

1. **`src/idea_core/engine/service.py` — Add targeted comment for defense-in-depth checks**

   In `node_get`, line where `node.get("campaign_id") != campaign_id` is checked, add:
   ```python
   # Defense-in-depth: store is campaign-scoped, so this only fires on
   # data corruption.  In eval.run the same check catches genuine cross-
   # campaign node_id misuse.
   ```

2. **`tests/engine/test_node_read_methods.py` — Add test for `_load_campaign_or_error` defensive path (B3)**

   Append after `test_node_get_not_found`:
   ```python
   def test_campaign_status_rejects_corrupted_campaign_id(tmp_path: Path) -> None:
       """Regression: _load_campaign_or_error defensive consistency check (B3)."""
       service = make_service(tmp_path)
       campaign_id = init_campaign(service)
   
       # Corrupt the stored campaign's campaign_id field
       campaign = service.store.load_campaign(campaign_id)
       campaign["campaign_id"] = "00000000-0000-4000-8000-000000000000"
       service.store.save_campaign(campaign)
   
       try:
           service.handle("campaign.status", {"campaign_id": campaign_id})
           assert False, "expected RpcError"
       except RpcError as exc:
           assert exc.code == -32003
           assert exc.data["reason"] == "campaign_not_found"
   ```

3. **`contracts/idea-generator-snapshot/schemas/idea_core_rpc_v1.openrpc.json` — Add `-32014` to `known_reasons`**

   The `known_reasons` table is missing code `-32014`. Add:
   ```json
   "-32014": [
     "node_not_in_campaign"
   ],
   ```
   after the `-32013` entry. This ensures the error catalog is complete for downstream tooling that enumerates known error codes.

4. **`contracts/idea-generator-snapshot/schemas/idea_core_rpc_v1.openrpc.json` — Add `-32003`, `-32004`, `-32011`, `-32012`, `-32015` to `known_reasons`**

   For completeness, add all error codes that appear in `errors` arrays of methods but are missing from `known_reasons`:
   ```json
   "-32003": ["campaign_not_found"],
   "-32004": ["node_not_found"],
   "-32011": ["grounding_audit_not_pass"],
   "-32012": ["formalism_not_in_registry"],
   "-32014": ["node_not_in_campaign"],
   "-32015": ["campaign_not_active"]
   ```
   This makes `known_reasons` a complete index of all error codes and reasons, enabling automated tooling to validate error coverage.

5. **`src/idea_core/engine/service.py` — `_raise_not_implemented` should accept `params` to include `campaign_id` when available**

   Current stub methods like `campaign.topup(params)` call `self._raise_not_implemented("campaign.topup")` without forwarding `campaign_id`. For consistency with other error paths that include `campaign_id`, consider:
   ```python
   def _raise_not_implemented(self, method: str, params: dict[str, Any] | None = None) -> None:
       data: dict[str, Any] = {"reason": "method_not_implemented", "details": {"method": method}}
       if params and "campaign_id" in params:
           data["campaign_id"] = params["campaign_id"]
       self.catalog.validate_error_data(data)
       raise RpcError(code=-32000, message="method_not_implemented", data=data)
   ```
   Then update callers: `self._raise_not_implemented("campaign.topup", params)`. This improves debuggability when a stub is hit in a multi-campaign environment.

6. **`pyproject.toml` — Pin `referencing` lower bound more tightly**

   `referencing>=0.35.0,<1` is a wide range. The `Registry` and `Resource.from_contents` APIs used in `catalog.py` were stable from 0.35+, but the jump to 1.0 could introduce breaking changes. Consider `referencing>=0.35.0,<0.40` for tighter compatibility, or add a comment noting the API surface relied upon.
