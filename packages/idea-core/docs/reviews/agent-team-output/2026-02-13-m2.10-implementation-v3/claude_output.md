VERDICT: READY

## Blockers

None. The prior blockers from v1/v2 reviews have been addressed in commit `ae260a5`:

1. **JCS canonical hashing** — implemented via `jcs` library (RFC 8785). ✅
2. **Default filling before payload hash** — `_hash_without_idempotency` now injects param defaults from OpenRPC schema. ✅
3. **Mutation concurrency + durability** — `mutation_lock` (fcntl LOCK_EX) + fsync + atomic rename via `.tmp.replace()`. ✅
4. **`eval.run` atomicity** — result is pre-validated before any side-effect writes. ✅
5. **Seed-node schema validation** — validated against `idea_node_v1` during `campaign.init`. ✅
6. **`node.promote` gate coverage** — full test matrix in `test_node_promote.py`. ✅
7. **Registry merge + duplicate abstract_problem check** — enforced in `campaign_init`. ✅
8. **Idempotency conflict includes key + hash** — verified by `test_idempotency_key_conflict_includes_payload_hash_and_key`. ✅

All 17 tests pass. Contract validation passes. The scope is explicitly limited to contract correctness with deterministic stubs — this is the right call for M1+M2.

## Non-blocking

### N1: `fcntl` portability (low priority)
`fcntl.flock` is Unix-only. If Windows CI or contributor environments are anticipated, consider `filelock` or `msvcrt` fallback. Not a blocker — HEP workflows are overwhelmingly Linux.

### N2: Idempotency store growth is unbounded
The contract says "retained for campaign lifetime," which is correct. But for long-running campaigns, the in-memory `load_idempotency → dict → save_idempotency` pattern will become a bottleneck. Consider switching to append-only JSONL + index when implementing `search.step` (which will generate high volumes of idempotency records).

### N3: Artifact ref scheme is `file://` only
`load_artifact_from_ref` rejects non-`file://` URIs. This is fine for M2 but will need a resolver registry (e.g., `s3://`, `gs://`, campaign-relative refs) before real multi-node deployment. Worth a `TODO` comment.

### N4: `_deterministic_score` hash-based scoring could collide with real eval
The sha256-based stub is clean for testing, but when real LLM-backed eval lands, the `eval_info` schema written by the stub differs from what a real evaluator would produce (no `reviewer_details`, no `evidence_uris` on scorecards). Consider adding an `"evaluator_backend": "deterministic_stub"` field to `eval_info` now so downstream consumers can distinguish.

### N5: `campaign.status` missing `idempotency` field
`campaign.status` is read-only and has no `idempotency_key` param, which is correct. But the OpenRPC contract doesn't list it as having idempotency — confirm this is intentional (it is, per the "read-only, permitted in any status" description).

### N6: Error idempotency storage stores `error.__dict__`
In `_store_idempotency(..., kind="error")`, error responses are stored as `RpcError.__dict__` which includes `code`, `message`, `data`. On replay, these are unpacked via `RpcError(**payload)`. This works but is fragile — if `RpcError` gains fields, replay will break. Consider storing a structured envelope: `{"code": ..., "message": ..., "data": ...}`.

### N7: Missing `reduction.py` file
`test_reduction_and_schema_contracts.py` imports `from idea_core.engine.reduction import build_reduction_audit` but `reduction.py` is not in the provided files. The tests pass (17/17), so it exists — but it should be in the review bundle for completeness.

### N8: `test_payload_hash_fills_method_defaults_before_hashing` references `node.list`
This test checks default-filling for `node.list` which is not yet implemented. The test passes because `_hash_without_idempotency` reads the param schemas from the OpenRPC contract (which defines `node.list` with `limit: default=50`). This is correct behavior but should be documented as an integration-forward test.

## Real-research fit

### Strong points for HEP research integration

1. **Evidence-first promotion gates**: The `node.promote` chain (idea_card schema → grounding_audit pass → formalism registry → conditional reduction audit) is exactly right for preventing hallucinated physics from leaking into downstream C2 computation. This is the critical safety gate.

2. **Formalism + abstract problem registries**: Merge-with-override semantics allow domain packs (HEP-ph, HEP-th, astro-ph) to ship defaults while campaigns can specialize. The `abstract_problem_type` validation at promotion time ensures reduction reports map to known mathematical structures — essential for technique transplant (e.g., applying condensed matter methods to BSM phenomenology).

3. **Scorecard status semantics**: The `complete/partial/failed` trichotomy with normative failure ordering (`no_scorecards → insufficient_dimensions → insufficient_nodes`) prevents silent ranking on garbage data. The explicit rule that `failed` scorecards are ignored for `observed_keys` computation is correct — in real HEP eval, LLM reviewers will timeout or produce incoherent outputs, and the ranking system must be robust to this.

4. **Idempotency with JCS**: RFC 8785 canonicalization + default-filling before hashing is the right design. In real research loops, the orchestrator will retry `search.step` calls after transient failures, and false conflicts from key ordering or missing defaults would be catastrophic.

5. **Artifact provenance chain**: Scorecards → ranking → handoff artifacts form a traceable chain. Each artifact has a `campaign_id` + `generated_at` + upstream refs. This supports the evidence-first audit trail that distinguishes serious research automation from prompt-and-pray.

### Gaps for real research (not blockers for M2)

- **No arXiv/INSPIRE evidence URI resolution**: `evidence_uris` are currently opaque strings. Real grounding audits need to verify that cited papers exist and support the claimed physics. This is explicitly out of scope but should be the first M3 priority.
- **No novelty delta table population**: The `novelty_delta_table_v1.schema.json` is referenced in scorecards but never populated by the stub evaluator. Real novelty checking requires embedding-based comparison against existing literature.
- **Single-island assumption**: All seed nodes go to `island-0`. The island model (for diversity maintenance via migration/repopulation) is structurally present but not exercised.

## Robustness & safety

### Hallucination mitigation
- **Schema-enforced gates**: Every promotion requires `grounding_audit.status == "pass"`. There's no way to bypass this through the RPC interface — the check is in `node_promote` before any artifact write.
- **Formalism registry check**: Prevents nodes from claiming formalisms that don't exist in the campaign's effective registry. This stops LLM-generated idea cards from inventing phantom theoretical frameworks.
- **Reduction audit chain**: If a node has `reduction_report`, it MUST have a passing `reduction_audit` with an `abstract_problem` that exists in the registry. This prevents phantom technique transplants.

### Concurrency safety
- File locking via `fcntl.flock(LOCK_EX)` with campaign-scoped lock files. Adequate for single-machine deployment.
- Atomic writes via `tmp.replace(path)` + `fsync`. Correct pattern for crash consistency.
- Lock scope is per-campaign for campaign-scoped methods and global for `campaign.init`. This prevents cross-campaign interference.

### Idempotency correctness
- Payload hash conflict detection is correct: same key + different hash → reject with `idempotency_key_conflict`.
- Replay returns `is_replay: true` with the original response.
- Error responses are also idempotent (stored and replayed).
- The pre-validation pattern (validate result schema before committing side effects) prevents half-written state on schema violations.

### Remaining risk
- **No request-level timeout/cancellation**: A malicious or buggy client could hold the mutation lock indefinitely. Consider adding `LOCK_EX | LOCK_NB` with a timeout wrapper for production use.
- **No rate limiting**: The stdio server processes requests sequentially, but a fast client could exhaust disk with artifact writes. Not a concern for M2 but worth noting.

## Specific patch suggestions

### Patch 1: Add evaluator backend tag to stub eval_info
**File**: `src/idea_core/engine/service.py`
**Location**: `eval_run` method, where `eval_info` is constructed (~line in the `for node_id in node_ids` loop)
**Change**: Add `"evaluator_backend": "deterministic_stub_v1"` to the `eval_info` dict:
```python
node["eval_info"] = {
    "evaluator_backend": "deterministic_stub_v1",
    "scores": scores,
    "fix_suggestions": [],
    "failure_modes": [],
}
```
**Rationale**: Downstream consumers (especially real grounding auditors) need to distinguish stub scores from LLM-generated scores. This is a one-line, zero-breakage change.

### Patch 2: Add TODO for artifact resolver registry
**File**: `src/idea_core/engine/store.py`
**Location**: `load_artifact_from_ref` method
**Change**: Add comment:
```python
def load_artifact_from_ref(self, artifact_ref: str) -> dict[str, Any]:
    # TODO(m3): Add resolver registry for s3://, gs://, and campaign-relative refs.
    # Current: file:// only (sufficient for single-machine M2 deployment).
    if not artifact_ref.startswith("file://"):
        raise FileNotFoundError(f"unsupported artifact ref: {artifact_ref}")
```

### Patch 3: Include `reduction.py` in review bundle
**File**: Review bundle / `src/idea_core/engine/reduction.py`
**Change**: Include this file in subsequent review bundles. It's imported by tests but absent from the audit surface.

### Patch 4: Structured error envelope for idempotency storage
**File**: `src/idea_core/engine/service.py`
**Location**: All `_store_idempotency(..., kind="error")` call sites
**Change**: Replace `response=error.__dict__` with explicit dict construction:
```python
response={"code": error.code, "message": error.message, "data": error.data},
```
**Rationale**: `__dict__` is fragile if `RpcError` gains fields (e.g., `__cause__` from exception chaining). Explicit dict construction is safer and costs nothing.

### Patch 5: Add `fcntl` import guard with clear error
**File**: `src/idea_core/engine/store.py`
**Location**: Top of file, after existing imports
**Change**:
```python
try:
    import fcntl
except ImportError:
    raise ImportError(
        "idea-core requires fcntl (Unix-only). "
        "Windows is not supported in this release."
    ) from None
```
**Rationale**: Fails fast with a clear message instead of a cryptic ImportError deep in a lock path.

### Patch 6: Harden `_set_campaign_running_if_budget_available` transition
**File**: `src/idea_core/engine/service.py`
**Location**: `_set_campaign_running_if_budget_available` method
**Change**: Only transition from `exhausted` to `running`, not from other terminal states:
```python
def _set_campaign_running_if_budget_available(self, campaign: dict[str, Any]) -> None:
    if self._exhausted_dimensions(campaign):
        if campaign["status"] == "running":
            campaign["status"] = "exhausted"
    elif campaign["status"] == "exhausted":
        campaign["status"] = "running"
```
**Rationale**: The current code could theoretically set status to `exhausted` even if the campaign was `paused` or `early_stopped` (though `_ensure_campaign_running` guards against this at the entry point). Making the transition explicit prevents future bugs when more status transitions are added.
