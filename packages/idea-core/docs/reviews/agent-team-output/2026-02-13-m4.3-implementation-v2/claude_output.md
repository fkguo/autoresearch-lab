VERDICT: READY

## Blockers

None. All four M4.3 acceptance criteria are satisfied by the evidence provided:

1. **Command mapping completeness** — 8 `hepar.idea.*` commands are mapped to their corresponding `idea-core` RPC methods (`campaign.init`, `campaign.status`, `search.step`, `eval.run`, `rank.compute`, `node.promote`, `node.get`, `node.list`). This covers the declared command surface.

2. **Translation-only layer** — `params` are forwarded to `rpc_transport.call(method, params)` unchanged. Test 5 explicitly validates no business-logic mutation of params. No domain evaluation, ranking, or promotion logic resides in the bridge.

3. **Artifact persistence** — Request artifacts (`skill_bridge/requests/{command_id}.json`), response artifacts (`skill_bridge/responses/{command_id}.json`), and a replay index (`skill_bridge/replay_index.json` with `request_hash` + refs) are all persisted. Ledger events (`skill_bridge.request_marshaled`, `skill_bridge.response_persisted`) provide observability.

4. **Replay by command_id + request hash** — Test 3 confirms cached response is returned on matching `(command_id, request_hash)` without a second RPC call. Conflicting hashes on the same `command_id` raise `ValueError(command_id_conflict)`, which is a sound idempotency guard. The v2 URI-decode fix (test 4 + red→green evidence) closes the `%20`-path regression.

## Non-blocking

1. **Replay index concurrency**: The single `replay_index.json` file is a shared mutable resource. Under concurrent bridge invocations (e.g., parallel hepar skill calls from different agent threads), a read-modify-write race is possible. For M4.3 scope (single-threaded skill invocation) this is fine; flag for M4.4+ if parallel campaign runs are planned.

2. **Replay index growth**: No pruning/rotation strategy for `replay_index.json`. For long-lived campaigns with thousands of steps this file will grow unboundedly. Consider adding an optional TTL or max-entries cap in a future milestone.

3. **Error artifact persistence**: The summary does not mention whether RPC errors (transport failures, `rpc_transport.call` exceptions) are persisted as response artifacts. If an RPC call fails mid-flight, the replay index entry may be left without a response ref, creating a partial state. Suggest adding a `skill_bridge.rpc_error` artifact/event in a follow-up.

4. **Hash algorithm documentation**: The `request_hash` computation algorithm (SHA-256 of canonical JSON? MD5?) is not specified in the summary. Documenting this in `skill_bridge.py` docstring aids reproducibility audits.

5. **Export hygiene**: `__init__.py` exports `HeparSkillBridge` — good. Consider also exporting the command map as a public constant (e.g., `HEPAR_COMMAND_MAP`) so downstream tooling (docs generators, skill introspection) can enumerate the surface without importing the class.

## Real-research fit

The bridge design is well-suited for real HEP research workflows:

- **Artifact-first**: Every skill invocation produces auditable JSON artifacts. This aligns with evidence-first methodology — a reviewer or collaborator can replay a full idea-generation campaign from persisted artifacts without re-executing expensive RPC calls (e.g., `eval.run` which may involve FeynCalc or lattice computations).

- **Replay = reproducibility**: The `(command_id, request_hash)` replay contract is exactly what's needed for deterministic re-execution of search campaigns. If a researcher re-runs a notebook or script, identical requests hit the cache; mutated requests are flagged immediately via `command_id_conflict`.

- **Ledger integration**: The four ledger events provide the observability layer needed for hepar's approval-gate workflow. A campaign supervisor can inspect `skill_bridge.rpc_called` events to verify that the idea-generator actually consulted idea-core before promoting a node.

- **Extensibility**: The command map is a flat dictionary — adding new `hepar.idea.*` commands (e.g., `hepar.idea.prune_branch` for future tree-search pruning) requires a one-line addition with no structural changes. The translation-only constraint ensures the bridge never becomes a second source of domain logic.

## Robustness & safety

| Concern | Assessment |
|---------|-----------|
| **Hallucination mitigation** | Translation-only design prevents the bridge from fabricating or modifying physics results. All domain logic stays in idea-core RPC handlers. ✅ |
| **Provenance** | Every request/response pair is persisted with a content hash. The replay index provides a full audit trail. ✅ |
| **Idempotency** | Same `(command_id, hash)` → cached result. Different hash on same `command_id` → hard error. This prevents silent data corruption from stale replays. ✅ |
| **URI decode fix** | The `%20` regression (v1→v2) was caught via red→green test evidence. The fix (`urlparse + unquote`) is the correct approach for file-URI artifact refs. ✅ |
| **Unknown command rejection** | Test 2 confirms unknown commands are rejected before any RPC call is made. This prevents accidental invocation of unintended idea-core methods. ✅ |
| **Test coverage** | 5 targeted tests covering the happy path, error path, replay, regression, and pass-through. 88 total tests passing in the suite. Adequate for M4.3 gate. ✅ |

## Specific patch suggestions

### 1. `src/idea_core/hepar/skill_bridge.py` — Document hash algorithm

```python
# In the docstring of the method that computes request_hash, add:
"""
request_hash: SHA-256 of the canonical JSON serialization
(json.dumps(params, sort_keys=True, separators=(',', ':')))
of the request params. This ensures deterministic hashing
independent of key ordering or whitespace.
"""
```
*Rationale*: Reproducibility audit requires knowing the hash contract. Zero behavioral change.

### 2. `src/idea_core/hepar/skill_bridge.py` — Guard against partial replay index entries

```python
# After the RPC call, wrap response persistence in try/finally:
try:
    result = self.rpc_transport.call(method, params)
except Exception as e:
    # Persist error artifact so replay index is never left dangling
    error_artifact = {"command_id": command_id, "error": str(e), "type": type(e).__name__}
    self._persist_artifact(f"skill_bridge/errors/{command_id}.json", error_artifact)
    self.ledger.emit("skill_bridge.rpc_error", {"command_id": command_id})
    raise
```
*Rationale*: Prevents orphaned replay index entries when RPC fails. Non-blocking for M4.3 but high-leverage for robustness.

### 3. `src/idea_core/hepar/__init__.py` — Export command map

```python
# Change:
from .skill_bridge import HeparSkillBridge
# To:
from .skill_bridge import HeparSkillBridge, HEPAR_COMMAND_MAP
```
*Rationale*: Enables downstream introspection (e.g., hepar skill auto-discovery, docs generation) without reaching into private module internals.

### 4. `tests/hepar/test_skill_bridge_m43.py` — Add conflict-detection test

```python
def test_replay_conflict_raises_on_hash_mismatch(tmp_path):
    """command_id reuse with different params must raise ValueError."""
    bridge = HeparSkillBridge(rpc_transport=mock_transport, artifact_dir=tmp_path)
    bridge.call("hepar.idea.campaign_status", {"campaign_id": "c1"}, command_id="cmd-1")
    with pytest.raises(ValueError, match="command_id_conflict"):
        bridge.call("hepar.idea.campaign_status", {"campaign_id": "c2"}, command_id="cmd-1")
```
*Rationale*: The conflict path is described in the design but not explicitly listed among the 5 tests. Adding it closes a coverage gap on a safety-critical code path. (If this is already implicitly covered in one of the existing 5 tests, disregard.)

### 5. `docs/milestones/m4.3-acceptance.md` (or equivalent gate doc) — Record v2 regression context

```markdown
### v1 → v2 Regression: URI-encoded artifact paths

**Root cause**: `skill_bridge/responses/` paths containing spaces were stored
as `file:///...path%20with%20spaces/...` in `replay_index.json`. On replay,
the raw URI was passed to `open()`, which failed with `FileNotFoundError`,
surfacing as `KeyError: 'rpc_result'`.

**Fix**: `urlparse(uri).path` + `urllib.parse.unquote()` before file read.

**Evidence**: `docs/reviews/bundles/2026-02-13-m4.3-skill-bridge-failure-repro-v1.txt`
```
*Rationale*: Preserves institutional knowledge of the regression for future maintainers. Zero code change.
