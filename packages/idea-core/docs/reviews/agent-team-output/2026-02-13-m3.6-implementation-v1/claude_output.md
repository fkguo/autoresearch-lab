VERDICT: READY

## Blockers

None. The M3.6 deliverable is well-scoped and the TDD evidence chain (RED → GREEN → full suite green at 67 passed) is complete. The three acceptance criteria — default rubric backfill, anti-pseudo-computable gate, and `eval.run → node.promote` regression coverage — are each addressed with concrete implementation and test evidence.

## Non-blocking

1. **Magic threshold `0.7` for `estimated_compute_hours_below_rubric`**: The 0.7 log10 gap (≈5× underestimate) is reasonable but undocumented. A one-line docstring or constant with rationale (e.g., "half an order of magnitude tolerance") would help future maintainers and reviewers from other subfields recalibrate without reading the code.

2. **Rubric tier naming — `frontier_not_yet_feasible`**: Good naming, but consider adding an explicit `estimated_compute_hours_log10` ceiling or sentinel (e.g., `float('inf')` or `None` with documented semantics) so downstream consumers don't accidentally treat it as a plannable tier. Currently the rubric rules tuple handles this implicitly, but an explicit contract is safer for plugin authors.

3. **`_is_number` helper**: Minor — confirm it handles `numpy` numeric types and string-encoded floats (`"3.5"`) that may arrive from LLM-generated JSON. If it only checks `isinstance(x, (int, float))`, a malformed but parseable estimate could silently bypass the backfill path. A small unit test for edge cases (`None`, `"3.5"`, `NaN`, `np.float64(3.0)`) would close this.

4. **`_infrastructure_rank` ordering**: The rank function is central to the anti-pseudo-computable gate. Ensure the ordering is explicitly tested (e.g., `assert _infrastructure_rank("toy_laptop") < _infrastructure_rank("batch_workstation") < _infrastructure_rank("heavy_cluster") < _infrastructure_rank("frontier_not_yet_feasible")`). This is likely implicitly covered, but an explicit ordering test is cheap insurance against future tier insertions breaking the invariant.

5. **Finding code namespacing**: `required_infrastructure_below_rubric` and `estimated_compute_hours_below_rubric` are good descriptive codes. For consistency with the existing `hep:feasibility:...` token prefix mentioned in the bundle, ensure the finding `code` field values also carry the `hep:feasibility:` prefix (or document why they don't). This avoids ambiguity when findings from multiple domains are aggregated.

## Real-research fit

**Strong.** The rubric tiers (`toy_laptop` → `frontier_not_yet_feasible`) map cleanly to actual HEP compute profiles:

| Tier | Real-world analog |
|---|---|
| `toy_laptop` | Tree-level cross-sections, toy MC, analytic checks |
| `batch_workstation` | NLO fixed-order with MCFM/MadGraph, small-grid scans |
| `heavy_cluster` | NNLO QCD, full detector simulation, large BSM parameter scans |
| `frontier_not_yet_feasible` | Lattice QCD at physical pion mass with dynamical charm, N³LO+ |

The anti-pseudo-computable gate addresses a genuine failure mode in AI-assisted research: an LLM confidently proposing a "straightforward NNLO calculation" while underestimating by 3+ orders of magnitude. The 0.7 log10 threshold catches ≥5× underestimates, which is appropriately conservative — a factor-of-3 error in HEP compute planning is common and acceptable, but a factor-of-5 usually means a qualitative misunderstanding (e.g., confusing LO with NLO, or fixed-order with matched/resummed).

**Extensibility note**: The rubric-rule tuple structure is naturally extensible to other subfields (cosmological N-body simulations, lattice gauge theory, collider phenomenology grids) without touching the gate logic — only the rules and tier names change. This is well-designed for the HEP-first-then-broader mandate.

## Robustness & safety

1. **Hallucination mitigation**: The backfill-then-validate pattern is correct. By first defaulting missing fields to the rubric's conservative estimate and *then* checking whether user/LLM-supplied values underestimate, the system fails safe — an LLM that omits compute info gets the rubric default (conservative), and an LLM that lowballs gets flagged as `critical` and promotion-blocked. This is the right evidence-first posture.

2. **Promotion-blocking semantics**: The `critical` severity → promotion block is load-bearing. Confirm that no code path in `node.promote` downgrades `critical` findings to `warning` (e.g., via an override flag or admin bypass). If such a path exists or is planned, it should require an explicit human approval artifact with provenance.

3. **Deterministic tokens**: The `hep:feasibility:...` tokens emitted by `eval.run` enable downstream audit and replay. Good. Ensure these are included in the node's artifact provenance chain (not just logged) so that a post-hoc audit can reconstruct *why* a node was blocked.

4. **No schema drift**: The bundle correctly notes no OpenRPC/schema semantic changes. Verified against the scope — `minimal_compute_plan` is an existing nested object, and the new fields (`required_infrastructure`, `estimated_compute_hours_log10`) are backfilled within the existing structure. No contract-breaking changes.

## Specific patch suggestions

### 1. `src/idea_core/engine/service.py` — Document the 0.7 threshold

```python
# File: src/idea_core/engine/service.py
# Location: near the `0.7` comparison in anti-pseudo-computable check
# Change: extract to named constant with docstring

# --- Current ---
if rubric_estimate - estimate >= 0.7:
    add_finding(code="estimated_compute_hours_below_rubric", ...)

# --- Proposed ---
# A log10 gap of 0.7 corresponds to ~5× underestimate.
# In HEP, factor-of-3 errors in compute planning are routine;
# factor-of-5+ typically signals a qualitative misclassification
# (e.g., confusing LO with NLO complexity).
_COMPUTE_HOURS_LOG10_UNDERESTIMATE_THRESHOLD = 0.7

if rubric_estimate - estimate >= _COMPUTE_HOURS_LOG10_UNDERESTIMATE_THRESHOLD:
    add_finding(code="estimated_compute_hours_below_rubric", ...)
```

### 2. `tests/engine/test_compute_plan_rubric_m36.py` — Add explicit rank-ordering test

```python
# File: tests/engine/test_compute_plan_rubric_m36.py
# Location: after existing tests
# Change: add one small test for the tier ordering invariant

def test_infrastructure_rank_ordering_invariant():
    """Guard against future tier insertions breaking the rank order."""
    from idea_core.engine.service import IdeaEngineService
    rank = IdeaEngineService._infrastructure_rank
    tiers = ["toy_laptop", "batch_workstation", "heavy_cluster", "frontier_not_yet_feasible"]
    for i in range(len(tiers) - 1):
        assert rank(tiers[i]) < rank(tiers[i + 1]), (
            f"Rank ordering violated: {tiers[i]} should be < {tiers[i+1]}"
        )
```

### 3. `tests/engine/test_compute_plan_rubric_m36.py` — Add `_is_number` edge-case coverage

```python
# File: tests/engine/test_compute_plan_rubric_m36.py
# Location: after existing tests
# Change: add parametrized edge-case test for _is_number

import pytest

@pytest.mark.parametrize("value,expected", [
    (3.0, True),
    (0, True),
    (-1.5, True),
    (None, False),
    ("3.5", False),   # string-encoded floats should NOT bypass backfill
    ("", False),
    (float("nan"), True),  # NaN is numeric; downstream validation handles it
    (float("inf"), True),
])
def test_is_number_edge_cases(value, expected):
    from idea_core.engine.service import IdeaEngineService
    assert IdeaEngineService._is_number(value) is expected
```

### 4. `src/idea_core/engine/service.py` — Namespace finding codes consistently

```python
# File: src/idea_core/engine/service.py
# Location: finding code strings in the anti-pseudo-computable block
# Change: prefix with hep:feasibility: for consistency with emitted tokens

# --- Current ---
add_finding(code="required_infrastructure_below_rubric", ...)
add_finding(code="estimated_compute_hours_below_rubric", ...)

# --- Proposed ---
add_finding(code="hep:feasibility:required_infrastructure_below_rubric", ...)
add_finding(code="hep:feasibility:estimated_compute_hours_below_rubric", ...)

# Also update the test assertions accordingly:
# --- In tests/engine/test_compute_plan_rubric_m36.py ---
assert any("hep:feasibility:required_infrastructure_below_rubric" in mode for mode in failure_modes)
assert any("hep:feasibility:estimated_compute_hours_below_rubric" in mode for mode in failure_modes)
```

### 5. `docs/reviews/bundles/2026-02-13-m3.6-compute-rubric-failure-repro-v1.txt` — No changes needed

The TDD evidence bundle is complete and well-structured. No patch required.
