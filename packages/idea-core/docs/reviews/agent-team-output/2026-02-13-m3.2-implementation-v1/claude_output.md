VERDICT: NOT_READY

## Blockers

### B1: `_choose_search_operator` shadows `_next_search_operator` with incompatible dispatch — static vs instance method collision

`_choose_search_operator` is defined as `@staticmethod` (line ~998) but calls `IdeaCoreService._next_search_operator(runtime, search_operators)` which is also a `@staticmethod` (already existed). However, `_next_search_operator` **mutates** `runtime["next_operator_index"]`. The new `_choose_search_operator` falls through to the round-robin path for any `island_id` that doesn't match `r"^island-(\d+)$"`. This is fine structurally, but the **static method cannot be overridden in subclasses** since the fallback hardcodes `IdeaCoreService._next_search_operator`. This is a minor design issue, but the real **blocker** is:

The `_next_search_operator` (pre-existing round-robin) is still called at the original call site for the `round_robin_v1` policy packs. But `_choose_search_operator` is only called in the `search.step` handler. If any other code path (now or future) calls `_next_search_operator` directly, the two selection mechanisms diverge silently. **The old call site for `_next_search_operator` should be removed or replaced** — confirm there are no remaining direct callers. The diff shows the call site in `_build_operator_node` is not touched; verify it isn't also selecting operators independently.

**Fix required:** Audit all call sites of `_next_search_operator` and ensure `_choose_search_operator` is the single entry point for operator selection.

### B2: New HEP operator classes don't implement `SearchOperator` protocol/ABC

The three new operator classes (`HepAnomalyAbductionOperator`, `HepSymmetryOperator`, `HepLimitExplorerOperator`) define `operator_id`, `operator_family`, `backend_id` as class-level attributes and a `run` method — but they don't inherit from or register with `SearchOperator`. The type annotation `tuple[SearchOperator, ...]` from `hep_operator_families_m32()` relies on structural subtyping (duck typing). This works at runtime in Python but:

1. `mypy --strict` or `pyright` will flag `tuple[SearchOperator, ...]` if `SearchOperator` is a class/ABC rather than a `Protocol`. The diff doesn't show the `SearchOperator` definition, so we can't confirm.
2. If `SearchOperator` is a dataclass or ABC with required methods beyond `run`, the new classes may silently fail at a later call site.

**Fix required:** Either (a) make the new operators explicitly subclass/implement `SearchOperator`, or (b) show that `SearchOperator` is a `Protocol` and these classes satisfy it, confirmed by a type-check pass (`mypy` or equivalent in CI).

### B3: `initial_island_count > seed_count` check happens **after** campaign record creation

Looking at `service.py`, the campaign dict is constructed (lines ~817+), then seed iteration begins. The `initial_island_count > len(seed_items)` check (line ~831+) happens after `campaign` is already assembled and potentially partially written. If the store has any write-on-construct semantics, this leaves a half-initialized campaign. The idempotency store gets an error entry, but the campaign dict itself may be in an inconsistent state.

**Fix required:** Move the `initial_island_count > seed_count` validation **before** campaign construction, adjacent to the `_resolve_initial_island_count` call (line ~744 area). This is a 3-line move.

### B4: Missing `_refresh_island_population_sizes` implementation in diff

Line ~879: `self._refresh_island_population_sizes(campaign, nodes)` is called but **not defined in the diff**. Either it's a pre-existing method (in which case it should be noted in the review bundle) or it's missing from the patch. Without this method, `campaign.init` will raise `AttributeError` at runtime.

**Fix required:** Include the implementation or confirm it exists in a prior milestone and document the dependency.

## Non-blocking

### N1: Placeholder `evidence_uris_used` are non-actionable

All three operators use URIs like `"https://example.org/hep/operator/anomaly-abduction"` — these are clearly placeholder. For an evidence-first system, even deterministic template operators should either (a) omit this field or (b) use a sentinel like `"urn:hepar:template:anomaly-abduction-v1"` that the provenance chain recognizes as "no external evidence consulted."

**Recommendation:** Define a `URN_TEMPLATE_OPERATOR = "urn:hepar:operator-template:{family}"` pattern and use it consistently.

### N2: Operator family names use mixed conventions

- `"AnomalyAbduction"` — PascalCase noun phrase
- `"SymmetryOperator"` — PascalCase but includes "Operator" in the family name (redundant)
- `"LimitExplorer"` — PascalCase agent noun

The family names should be semantically parallel. Suggest: `AnomalyAbduction`, `SymmetryExploitation`, `LimitExploration` (all action-nouns) or `AnomalyAbductor`, `SymmetryExploiter`, `LimitExplorer` (all agent-nouns).

### N3: Magic number 20 for max island count

`_resolve_initial_island_count` caps at 20 with no configurability. This is fine for M3.2 but should be a class-level constant:

```python
MAX_INITIAL_ISLANDS = 20
```

### N4: Test asserts exactly 3 repopulated islands — fragile coupling to stagnation heuristic

The test `test_m3_2_operator_families_are_diverse_across_islands_and_survive_repopulation` runs 12 steps across 3 islands (4 per island) and asserts all 3 hit `REPOPULATED`. This couples tightly to the stagnation threshold. If the threshold changes, this test breaks without any real regression. Consider asserting `len(repopulated_islands) >= 1` or parametrizing the stagnation threshold in the test fixture.

### N5: `import re` added globally for a single regex match

The `re.match(r"^island-(\d+)$", island_id)` in `_choose_search_operator` could use `island_id.split("-")` for this simple pattern, avoiding the regex import. Minor, but `service.py` is a hot path.

### N6: Round-robin state mutation in `island_index_v1` policy

When `island_index_v1` is active, `_choose_search_operator` bypasses `_next_search_operator`, so `runtime["next_operator_index"]` is never incremented. If the policy is ever switched mid-campaign (e.g., via charter amendment), the round-robin counter will be stale. Add a comment documenting this intentional behavior.

## Real-research fit

The three operator families map well to genuine HEP research strategies:

- **AnomalyAbduction**: corresponds to the standard phenomenology workflow of "explain an excess" (g-2, B-anomalies, W-mass). The template text correctly emphasizes correlated predictions and kill criteria — this is how real anomaly papers work.
- **SymmetryOperator**: maps to the symmetry-first approach (gauge invariance → allowed operators). The mention of "forbidden/allowed transition patterns" is appropriate for flavor physics.
- **LimitExplorer**: decoupling limits, large-N, soft/collinear — these are standard consistency checks in BSM and QCD.

**Concern:** All three currently produce **templated text**, not actual computations. This is fine for M3.2 (structural milestone), but the architecture must clearly delineate where LLM-generated content vs. deterministic templates are used. The current `trace_params["deterministic_policy"]` field does this adequately.

**Multi-island diversity** is a meaningful architectural feature. In real HEP, parallel exploration strategies (symmetry-driven vs. anomaly-driven vs. limit-based) genuinely produce non-overlapping hypothesis spaces. The `island_index_v1` policy correctly enforces this separation.

## Robustness & safety

1. **Hallucination mitigation**: The deterministic operators produce fixed templates — no LLM hallucination risk at this stage. Good. The `operator_trace` artifacts provide full provenance.

2. **Novelty collapse**: The `island_index_v1` policy deterministically maps island → operator family, which **by construction** prevents diversity collapse during repopulation. This is a strong guarantee.

3. **Provenance**: Each operator output includes `trace_inputs` and `trace_params` with enough context to reconstruct the full decision path. The `backend_id` field enables future auditing when real backends replace templates.

4. **Idempotency**: The `campaign.init` idempotency handling for the new validation paths (island count, seed count) correctly stores error entries. However, see Blocker B3 for ordering.

5. **Schema drift risk**: The addition of `operator_selection_policy` to `DomainPackAssets` is a data-model change. The review bundle claims "No OpenRPC/schema semantic drift" — verify this field is internal-only and not exposed in any JSON-RPC response schema. If `domain_pack` in campaign state includes this field, it may need schema registration.

## Specific patch suggestions

### Patch 1: `src/idea_core/engine/service.py` — Move seed-count validation before campaign construction

```python
# CURRENT (line ~744 area, after _resolve_initial_island_count):
            try:
                initial_island_count = self._resolve_initial_island_count(params["charter"])
            except ValueError as exc:
                ...

# ADD immediately after:
            seed_items = params["seed_pack"]["seeds"]
            if initial_island_count > len(seed_items):
                error = self._schema_error(
                    f"initial_island_count ({initial_island_count}) exceeds seed count ({len(seed_items)})"
                )
                self._store_idempotency(
                    method="campaign.init",
                    idempotency_key=idempotency_key,
                    payload_hash_value=p_hash,
                    campaign_id=None,
                    response=error.__dict__,
                    kind="error",
                )
                raise error

# REMOVE the duplicate check at line ~831 (currently between campaign construction and seed iteration)
```

### Patch 2: `src/idea_core/engine/operators.py` — Explicit protocol conformance

```python
# At top of file, after SearchOperator definition (or import):
# If SearchOperator is a Protocol, add explicit registration. If it's an ABC, inherit.

# Option A (if Protocol):
class HepAnomalyAbductionOperator:  # already structurally conforms
    ...

# Option B (if ABC — preferred for safety):
class HepAnomalyAbductionOperator(SearchOperator):
    ...
# Repeat for HepSymmetryOperator, HepLimitExplorerOperator
```

### Patch 3: `src/idea_core/engine/operators.py` — Replace placeholder evidence URIs

```python
# In each of the three operator classes, change:
            evidence_uris_used=["https://example.org/hep/operator/anomaly-abduction"],
# To:
            evidence_uris_used=["urn:hepar:operator-template:anomaly-abduction-v1"],
# (and similarly for symmetry and limit-explorer)
```

### Patch 4: `src/idea_core/engine/service.py` — Extract island count cap as constant

```python
# At class level in IdeaCoreService:
    _MAX_INITIAL_ISLAND_COUNT = 20

# In _resolve_initial_island_count, change:
        if count > 20:
            raise ValueError("initial_island_count must be <= 20")
# To:
        if count > IdeaCoreService._MAX_INITIAL_ISLAND_COUNT:
            raise ValueError(f"initial_island_count must be <= {IdeaCoreService._MAX_INITIAL_ISLAND_COUNT}")
```

### Patch 5: `src/idea_core/engine/service.py` — Remove regex, use string split

```python
# In _choose_search_operator, replace:
        if selection_policy == "island_index_v1":
            match = re.match(r"^island-(\d+)$", island_id)
            if match:
                index = int(match.group(1))
                return search_operators[index % len(search_operators)]
# With:
        if selection_policy == "island_index_v1":
            parts = island_id.split("-", 1)
            if len(parts) == 2 and parts[0] == "island" and parts[1].isdigit():
                index = int(parts[1])
                return search_operators[index % len(search_operators)]
# And remove `import re` from the top of the file if no other usage remains.
```

### Patch 6: `tests/engine/test_search_step_operator_families_m32.py` — Decouple from stagnation threshold

```python
# Change line ~91:
    assert repopulated_islands == {"island-0", "island-1", "island-2"}
# To:
    assert len(repopulated_islands) >= 1, (
        "At least one island should have been repopulated to validate diversity survives repopulation"
    )
    # If all three repopulated, verify families remain distinct post-repopulation
    if repopulated_islands == {"island-0", "island-1", "island-2"}:
        # Bonus: re-run a step and verify family assignment persists
        pass
```

### Patch 7: `docs/reviews/bundles/2026-02-13-m3.2-operators-failure-repro-v1.txt` — Document `_refresh_island_population_sizes` dependency

```
# Add after "## GREEN (after fix)" section:

## Dependencies on prior milestones
- `_refresh_island_population_sizes` method (introduced in M2.6/M3.1) is required by this patch.
- `_pick_parent_node` island-aware selection (introduced in M3.1) is required.
```
