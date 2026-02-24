VERDICT: READY

## Blockers

No blockers remain. The four v1 blockers (B1–B4) are credibly closed:

- **B1** (operator selection entry point): `_choose_search_operator` is the single dispatch point in `search.step`, delegating to `_next_search_operator` only as a fallback. The call site at line ~1299 confirms this.
- **B2** (SearchOperator protocol): `@runtime_checkable` added, with `test_operator_protocols_m32.py` exercising `isinstance` checks for all three operators.
- **B3** (seed_count validation ordering): `initial_island_count > len(seed_items)` check fires before campaign dict construction (lines ~747–780).
- **B4** (`_refresh_island_population_sizes`): Called at line ~883 with inline comment; population sizes are kept consistent across multi-island seeding.

No new blockers introduced by this patch.

## Non-blocking

1. **`_choose_search_operator` island-id parsing is fragile.** The `island_id.split("-", 1)` parser silently falls back to round-robin if the format changes (e.g., `island-0a`, `isle-0`). This is safe but should be hardened with a named regex or a centralized `parse_island_index(island_id) -> int | None` helper to avoid duplicating the convention.

2. **Operator classes don't inherit from a common ABC.** `HepAnomalyAbductionOperator`, `HepSymmetryOperator`, `HepLimitExplorerOperator` are structural subtypes of `SearchOperator` (duck typing via Protocol). This works but means typos in attribute names (e.g., `operator_famly`) would only be caught at runtime by the protocol `isinstance` check—not by static type checkers, since Protocol structural checks don't flag missing attributes at definition time. Consider a thin `@dataclass` base or explicit `SearchOperator` registration to get mypy coverage.

3. **`operator_selection_policy` is a bare string.** Use a `Literal["round_robin_v1", "island_index_v1"]` or a small enum to get exhaustiveness checking in `_choose_search_operator`. Currently an unknown policy silently falls through to round-robin.

4. **Idempotency store calls duplicated for error paths.** Lines ~750–768 and ~770–782 repeat the same `_store_idempotency(..., kind="error")` boilerplate. Extract a `_fail_with_idempotency(method, key, hash, msg)` helper.

5. **Test coverage gap: `initial_island_count` edge cases.** The test uses `initial_island_count=3` with 3 seeds. No test for: (a) `initial_island_count=2` with 3 seeds (round-robin distribution), (b) `initial_island_count=1` with the `hep.operators.v1` pack (should still work), (c) string-typed `"3"` in extensions. These are implied-working by the code but un-exercised.

6. **`_MAX_INITIAL_ISLAND_COUNT = 20` is undocumented.** The cap is reasonable but should appear in the charter extensions documentation / OpenRPC parameter description so callers know the limit before hitting a runtime error.

7. **Evidence URIs are synthetic placeholders.** `urn:hepar:operator-template:anomaly-abduction-v1` etc. are not resolvable. This is fine for M3.2 but should be tracked for M3.3+ when real provenance wiring lands.

## Real-research fit

The three operator families map cleanly to genuine HEP theory research strategies:

- **AnomalyAbduction**: Mirrors standard BSM phenomenology workflow—observe a tension (e.g., muon g−2, B-meson anomalies), abduct minimal NP explanation, derive correlated observable. The template text ("smallest structural change… crisp kill criterion") is appropriate.
- **SymmetryOperator**: Captures the bread-and-butter of model building—imposing discrete/continuous symmetries to constrain operators. The "forbidden/allowed transition pattern" framing is correct.
- **LimitExplorer**: Maps to standard consistency checks (decoupling limits, large-N, soft/collinear). "Scaling relation checkable with a toy computation" is exactly how theorists validate models.

The `island_index_v1` deterministic assignment ensures reproducible diversity—each island explores a distinct reasoning style. This is a sound design for eventual LLM-backed operator execution where you want controlled diversity rather than random sampling.

**One concern for real research**: The current operators are template-based (deterministic string interpolation). When these become LLM-backed, the `run()` interface should accept an `llm_context` or `backend_config` parameter. The current `backend_id` field in `OperatorOutput` is a good hook for this, but the `run()` signature will need extension. Worth noting in the M3.3 roadmap.

## Robustness & safety

1. **Hallucination mitigation**: Operator outputs include `evidence_uris_used` and structured `trace_inputs`/`trace_params`, providing full provenance chain. The deterministic template approach for M3.2 inherently avoids LLM hallucination—good staging decision.

2. **Determinism**: `hep_operator_families_m32()` returns a fixed-order tuple; `island_index_v1` maps deterministically. Repopulation preserves island IDs, so operator assignment is stable. Verified by the test asserting single-family-per-island invariant.

3. **Fail-fast validation**: `initial_island_count > seed_count` rejects early. Bool-typed values rejected. String "3" accepted (reasonable leniency). Negative values rejected.

4. **No schema drift**: The `make validate` evidence shows OpenRPC contract validation passes. `DomainPackAssets.operator_selection_policy` is an internal field (not exposed in the RPC schema), so no wire-format change.

5. **Backward compatibility**: `hep.default` pack retains `round_robin_v1` policy. `_choose_search_operator` falls through to `_next_search_operator` for that policy. All 56 pre-existing tests still pass (57 total with the new test).

6. **Potential issue**: If `search_operators` is empty (shouldn't happen but defensive), `_choose_search_operator` will hit `ZeroDivisionError` on `index % len(search_operators)`. Add a guard or assert.

## Specific patch suggestions

### 1. `src/idea_core/engine/operators.py` — Add island-index parser utility

At the top of the file (after imports), add:

```python
import re

_ISLAND_ID_RE = re.compile(r"^island-(\d+)$")

def parse_island_index(island_id: str) -> int | None:
    """Return the integer index from 'island-N' or None if unparseable."""
    m = _ISLAND_ID_RE.match(island_id)
    return int(m.group(1)) if m else None
```

Then in `service.py`, replace the inline parsing in `_choose_search_operator`:

```python
from idea_core.engine.operators import parse_island_index

# In _choose_search_operator:
if selection_policy == "island_index_v1":
    index = parse_island_index(island_id)
    if index is not None and search_operators:
        return search_operators[index % len(search_operators)]
return cls._next_search_operator(runtime, search_operators)
```

**Rationale**: Single source of truth for island-id format; adds the empty-tuple guard.

### 2. `src/idea_core/engine/domain_pack.py` — Type-narrow `operator_selection_policy`

```python
# Change line 23 from:
    operator_selection_policy: str = "round_robin_v1"
# To:
from typing import Literal
    operator_selection_policy: Literal["round_robin_v1", "island_index_v1"] = "round_robin_v1"
```

**Rationale**: Exhaustiveness checking; prevents silent fallthrough on typos.

### 3. `src/idea_core/engine/service.py` — Extract idempotency error helper

After `_resolve_initial_island_count`, add:

```python
def _fail_campaign_init_with_idempotency(
    self,
    *,
    idempotency_key: str,
    payload_hash: str,
    message: str,
) -> RpcError:
    error = self._schema_error(message)
    self._store_idempotency(
        method="campaign.init",
        idempotency_key=idempotency_key,
        payload_hash_value=payload_hash,
        campaign_id=None,
        response=error.__dict__,
        kind="error",
    )
    return error
```

Then replace both duplicated blocks (~lines 750–768 and 770–782) with:

```python
raise self._fail_campaign_init_with_idempotency(
    idempotency_key=idempotency_key,
    payload_hash=p_hash,
    message=str(exc),  # or the formatted string
)
```

**Rationale**: DRY; this pattern will recur as more validation checks are added in M3.3+.

### 4. `tests/engine/test_search_step_operator_families_m32.py` — Add edge-case coverage

Append to the test file:

```python
def test_m3_2_two_islands_three_seeds_round_robin_distribution(tmp_path: Path) -> None:
    """Two islands with three seeds: island-0 gets 2 seeds, island-1 gets 1."""
    service = make_service(tmp_path)
    result = service.handle(
        "campaign.init",
        {
            "charter": {
                "campaign_name": "m3.2-2island-fixture",
                "domain": "hep-ph",
                "scope": "2-island round-robin seed distribution",
                "approval_gate_ref": "gate://a0.1",
                "extensions": {
                    "domain_pack_id": "hep.operators.v1",
                    "initial_island_count": 2,
                },
            },
            "seed_pack": {
                "seeds": [
                    {"seed_type": "text", "content": "seed-a"},
                    {"seed_type": "text", "content": "seed-b"},
                    {"seed_type": "text", "content": "seed-c"},
                ]
            },
            "budget": {
                "max_tokens": 100000,
                "max_cost_usd": 100.0,
                "max_wall_clock_s": 100000,
                "max_steps": 50,
            },
            "idempotency_key": "m3.2-2island-init",
        },
    )
    assert len(result["island_states"]) == 2
    pops = {s["island_id"]: s["population_size"] for s in result["island_states"]}
    assert pops["island-0"] == 2
    assert pops["island-1"] == 1


def test_m3_2_island_count_exceeds_seeds_fails(tmp_path: Path) -> None:
    service = make_service(tmp_path)
    import pytest
    with pytest.raises(Exception, match="exceeds seed count"):
        service.handle(
            "campaign.init",
            {
                "charter": {
                    "campaign_name": "m3.2-fail-fixture",
                    "domain": "hep-ph",
                    "scope": "should fail",
                    "approval_gate_ref": "gate://a0.1",
                    "extensions": {
                        "domain_pack_id": "hep.operators.v1",
                        "initial_island_count": 5,
                    },
                },
                "seed_pack": {
                    "seeds": [{"seed_type": "text", "content": "only-one"}]
                },
                "budget": {
                    "max_tokens": 100000,
                    "max_cost_usd": 100.0,
                    "max_wall_clock_s": 100000,
                    "max_steps": 50,
                },
                "idempotency_key": "m3.2-fail-init",
            },
        )
```

**Rationale**: Exercises the round-robin seed distribution path and the fail-fast guard—both are in the critical path but currently untested.

### 5. `src/idea_core/engine/operators.py` — Guard empty operator tuple

In `hep_operator_families_m32()`, add an assertion:

```python
def hep_operator_families_m32() -> tuple[SearchOperator, ...]:
    ops = (
        HepAnomalyAbductionOperator(),
        HepSymmetryOperator(),
        HepLimitExplorerOperator(),
    )
    assert len(ops) >= 1, "operator families tuple must be non-empty"
    return ops
```

And in `_choose_search_operator`, add at the top:

```python
if not search_operators:
    raise ValueError("search_operators tuple is empty; cannot select operator")
```

**Rationale**: Prevents `ZeroDivisionError` in a defensive-coding-critical path.
