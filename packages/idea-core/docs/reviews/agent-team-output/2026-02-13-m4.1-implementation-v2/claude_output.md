VERDICT: READY

## Blockers

No blocking issues found. The M4.1 implementation is well-scoped, TDD-evidenced, and the artifact/ledger contract is clean.

## Non-blocking

### 1. Idempotency key is present but unenforced
The `idempotency_key` appears in the ledger event payload, but there is no evidence of a **deduplication guard** in `record_work_order()`. If the same `WorkOrder` is submitted twice with the same `idempotency_key`, two artifacts and two ledger events will be created. For an append-only ledger this is especially dangerous because you can't delete the duplicate.

**Recommendation:** Add a check in `record_work_order` (and the other two write paths) that scans or indexes existing ledger events for a matching `idempotency_key` before persisting. At minimum, raise `DuplicateWorkOrderError`. This can be deferred to M4.2 if documented as a known gap.

### 2. `payload_hash` is computed but never verified on read
`read_ledger_events()` returns events with `artifact_hash` / `payload_hash` fields, but there is no `verify_artifact_integrity(work_id)` path that re-hashes the on-disk artifact and compares. For evidence-first safety, a verification round-trip is essential.

**Recommendation:** Add a `verify_artifact(artifact_ref: str, expected_hash: str) -> bool` method to `HeparControlPlaneStore`.

### 3. No schema version field on artifacts or ledger events
When M4.2+ extends these payloads, there is no `schema_version` field to distinguish V1 artifacts from later ones. This will make migration painful.

**Recommendation:** Add `"schema_version": "4.1.0"` to every persisted artifact JSON and every ledger event dict.

### 4. `WorkResult.status` guard is a string enum check — should be a proper `Enum`
A string guard like `status in ("ok", "failed", ...)` is fragile. Downstream consumers (e.g., the research-team convergence gate) will duplicate this set.

**Recommendation:** Extract to `class WorkResultStatus(str, Enum)` and use it in the dataclass.

### 5. Coordination policy guard same issue
`TeamPlan.coordination_policy` has the same string-set guard problem.

### 6. Missing `__all__` or explicit re-export in `__init__.py`
If `hepar/__init__.py` does `from .control_plane import *`, the public API surface is implicit. Prefer explicit `__all__` in both files.

### 7. Test coverage gap: no negative/boundary tests
The three tests cover the happy path. Missing:
- Invalid status string → expected error
- Invalid coordination_policy → expected error
- Duplicate `idempotency_key` (once guard is added)
- Empty `roles` list in `TeamPlan`
- Corrupted artifact file on read-back

## Real-research fit

The artifact triple (`WorkOrder`, `WorkResult`, `TeamPlan`) maps cleanly onto real HEP research workflows:

- **WorkOrder** ≈ a calculation request (e.g., "compute NLO QCD corrections to pp → tt̄ at √s = 14 TeV using FeynArts + FormCalc").
- **WorkResult** ≈ the result artifact from a `hep-calc` run, with status tracking for budget-exhausted or permission-denied (relevant for licensed tools like FORM or restricted cluster access).
- **TeamPlan** ≈ multi-agent coordination for parallel phenomenology studies (e.g., Claude handles analytic calculation while Gemini cross-checks numerics).

The `stage_gated` coordination policy is particularly well-suited to the `research-team` milestone-based workflow where, e.g., a FeynRules model must be approved before FeynArts diagram generation proceeds.

The ledger's append-only design provides the audit trail needed for reproducibility — a hard requirement in HEP where referee reports demand full provenance chains from Lagrangian → Feynman rules → amplitudes → cross-sections.

**Gap for broader theoretical physics:** The current schema has no field for `theory_framework` or `calculation_type` metadata. When extending beyond HEP (e.g., condensed matter field theory, cosmological perturbation theory), the `WorkOrder` will need a pluggable metadata slot. This is fine to defer but should be noted in design docs.

## Robustness & safety

### Hallucination mitigation
- ✅ `payload_hash` (SHA-256) anchors every artifact to its content — downstream agents cannot claim a result without a hash-verifiable artifact.
- ✅ Append-only ledger prevents retroactive tampering.
- ⚠️ **Missing:** No signature or agent-identity field on ledger events. In a multi-agent system, any agent can write any event. Add an `agent_id` field to every ledger event to enable blame attribution.

### Provenance
- ✅ `artifact_ref` paths are deterministic (`artifacts/work_orders/<work_id>.json`).
- ⚠️ **Missing:** No backlink from `WorkResult` to the specific `WorkOrder` version/hash it fulfills. If a `WorkOrder` is updated (new idempotency key, same `work_id`), the result's provenance chain breaks.

### Concurrency safety
- ⚠️ `append_ledger_event()` appends to a single `events.jsonl` file. Under concurrent multi-agent writes, this is a race condition. Options:
  - File-level `fcntl.flock` (POSIX)
  - Per-event files with merge-on-read (like git objects)
  - Document the single-writer assumption explicitly

### Frozen dataclasses
- ✅ Good: `@dataclass(frozen=True)` prevents mutation after creation, critical for hash integrity.

## Specific patch suggestions

### Patch 1: Add schema version to all artifacts and events
**File:** `src/idea_core/hepar/control_plane.py`
**What to change:** In `record_work_order`, `record_work_result`, and `register_team_plan`, add `"schema_version": "4.1.0"` to the dict written to the artifact JSON and to the ledger event payload dict.

```python
# In record_work_order, where the artifact dict is built:
artifact_data = {
    "schema_version": "4.1.0",   # ← ADD
    "work_id": work_order.work_id,
    ...
}
# Same pattern in the ledger event dict:
self.append_ledger_event("work_order.created", {
    "schema_version": "4.1.0",   # ← ADD
    "work_id": work_order.work_id,
    ...
})
```

### Patch 2: Extract status/policy enums
**File:** `src/idea_core/hepar/control_plane.py`
**What to change:** Replace string guards with `Enum` types.

```python
from enum import Enum

class WorkResultStatus(str, Enum):
    OK = "ok"
    FAILED = "failed"
    CANCELED = "canceled"
    BUDGET_EXHAUSTED = "budget_exhausted"
    PERMISSION_DENIED = "permission_denied"

class CoordinationPolicy(str, Enum):
    PARALLEL = "parallel"
    SEQUENTIAL = "sequential"
    STAGE_GATED = "stage_gated"

@dataclass(frozen=True)
class WorkResult:
    ...
    status: WorkResultStatus  # was: str with guard

@dataclass(frozen=True)
class TeamPlan:
    ...
    coordination_policy: CoordinationPolicy  # was: str with guard
```

### Patch 3: Add `agent_id` to ledger events
**File:** `src/idea_core/hepar/control_plane.py`
**What to change:** In `append_ledger_event()`, accept an optional `agent_id: str | None = None` parameter and include it in every event dict.

```python
def append_ledger_event(self, event_type: str, payload: dict[str, Any],
                        agent_id: str | None = None) -> dict[str, Any]:
    event = {
        "event_id": str(uuid.uuid4()),
        "event_type": event_type,
        "agent_id": agent_id,          # ← ADD
        "timestamp": datetime.utcnow().isoformat() + "Z",
        **payload,
    }
    ...
```

Then thread `agent_id` through `record_work_order`, `record_work_result`, `register_team_plan` as an optional kwarg.

### Patch 4: Add artifact integrity verification
**File:** `src/idea_core/hepar/control_plane.py`
**What to change:** Add method to `HeparControlPlaneStore`:

```python
def verify_artifact(self, artifact_ref: str, expected_hash: str) -> bool:
    """Re-hash on-disk artifact and compare to expected hash."""
    artifact_path = self.base_dir / artifact_ref
    if not artifact_path.exists():
        raise FileNotFoundError(f"Artifact not found: {artifact_ref}")
    content = artifact_path.read_bytes()
    actual_hash = hashlib.sha256(content).hexdigest()
    return actual_hash == expected_hash
```

### Patch 5: Add `__all__` to both modules
**File:** `src/idea_core/hepar/control_plane.py`
```python
__all__ = [
    "WorkOrder", "WorkResult", "TeamPlan",
    "WorkResultStatus", "CoordinationPolicy",
    "HeparControlPlaneStore",
]
```

**File:** `src/idea_core/hepar/__init__.py`
```python
from .control_plane import __all__ as _cp_all
from .control_plane import *
__all__ = list(_cp_all)
```

### Patch 6: Add negative tests
**File:** `tests/hepar/test_control_plane_m41.py`
**What to change:** Append tests:

```python
def test_work_result_rejects_invalid_status(tmp_path):
    with pytest.raises((ValueError, KeyError)):
        WorkResult(work_id="w-1", status="bogus", payload={})

def test_team_plan_rejects_invalid_coordination_policy(tmp_path):
    with pytest.raises((ValueError, KeyError)):
        TeamPlan(team_id="t-1", coordination_policy="yolo", roles=[])

def test_verify_artifact_detects_tampering(tmp_path):
    store = HeparControlPlaneStore(base_dir=tmp_path)
    wo = WorkOrder(work_id="w-1", idempotency_key="k-1", payload={"task": "test"})
    result = store.record_work_order(wo)
    # tamper
    artifact_path = tmp_path / result["artifact_ref"]
    artifact_path.write_text('{"tampered": true}')
    assert not store.verify_artifact(result["artifact_ref"], result["artifact_hash"])
```

### Patch 7: Document known M4.1 gaps for M4.2
**File:** `docs/reviews/bundles/2026-02-13-m4.1-control-plane-failure-repro-v1.txt` (or a new `docs/design/m41-known-gaps.md`)
**What to change:** Add a section:

```markdown
## Known M4.1 gaps (to address in M4.2+)

1. **Idempotency key dedup not enforced** — `idempotency_key` is recorded but duplicate submissions are not rejected.
2. **No concurrent-write safety** — ledger appends assume single-writer; needs file locking or per-event files for multi-agent.
3. **No WorkOrder→WorkResult backlink hash** — `WorkResult` references `work_id` but not the specific `WorkOrder` artifact hash it fulfills.
4. **No pluggable metadata slot** — `WorkOrder.payload` is untyped `dict`; needs a `theory_framework` / `calculation_type` extension point for non-HEP domains.
```
