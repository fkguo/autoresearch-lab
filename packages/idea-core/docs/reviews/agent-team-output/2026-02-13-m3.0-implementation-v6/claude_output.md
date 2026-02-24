VERDICT: READY

## Blockers

No blocking issues remain. The three prior blockers (thread-safety, campaign pack fallback ambiguity, enable/disable conflict handling) are all addressed with both code fixes and regression tests. The implementation is clean, well-scoped to M3.0, and the test suite (52 passing) covers the critical paths.

## Non-blocking

1. **Double `copy.deepcopy` on formalism/abstract-problem registries.** The `DomainPackAssets` loader lambda already calls `copy.deepcopy` (lines 113–114 of `domain_pack.py`), and `campaign.init` in `service.py` does *another* `copy.deepcopy` on the loaded result (lines after the `_resolve_domain_pack_for_charter` call). This is harmless but wasteful—the loader already guarantees a fresh copy per `load()` miss, and the cache returns the *same* object on hits. Since the cache returns the same object and the service deepcopies it, the loader's deepcopy only matters on the first call. Consider documenting this invariant or removing one layer.

2. **`_extension_string_list` accepts both singular and plural key variants** (`enable_domain_packs` / `enabled_domain_packs`, `disable_domain_packs` / `disabled_domain_packs`, `domain_pack_id` / `active_domain_pack_id`). This is user-friendly but undocumented—should be listed in the OpenRPC `extensions` field description or a schema comment so downstream consumers know which aliases are canonical.

3. **Thread-safety test asserts `load_counter["hep.alpha"] == 1`**, which proves the lock prevents redundant loads but does not prove absence of data races on the *returned* object. Since `DomainPackAssets` is `frozen=True` and its mutable fields (dicts) are deepcopied in the loader, this is safe in practice, but the test could be strengthened with an `id()` check on the inner registries to confirm identity (not just top-level `is`).

4. **`DomainPackIndex` constructor accepts `tuple[DomainPackDescriptor, ...]` but internally stores `dict`.** Insertion order is preserved (Python 3.7+), so `list_pack_ids()` returns deterministic order. Worth a one-line docstring noting this guarantee, since `eligible_pack_ids_for_domain` falls back to `list_pack_ids()` and the first element becomes the default pack.

5. **No `__repr__` / `__str__` on `DomainPackDescriptor` or `DomainPackIndex`.** Debugging multi-pack configurations would benefit from these.

6. **`_next_search_operator` is now `@staticmethod` but still mutates `runtime` dict in place.** This is fine functionally but the staticmethod decorator suggests purity; a brief docstring noting the mutation would help future maintainers.

7. **Missing type annotation on `_TaggedOperator.run`** in the test file (has `# type: ignore` comment). Minor, but test helpers that mirror production interfaces should match the `SearchOperator` protocol for mypy coverage.

## Real-research fit

The DomainPack architecture is well-suited for real HEP research workflows:

- **Domain prefix matching** (`"hep-"`) correctly maps to arXiv-style domain identifiers (`hep-ph`, `hep-th`, `hep-lat`, `hep-ex`), which is the natural taxonomy for HEP idea generation campaigns.
- **Formalism registry per pack** allows distinct packs for, e.g., perturbative QFT vs. lattice vs. amplitude bootstrap vs. EFT matching—each with their own C2 schemas and validators. This maps directly to how theoretical physicists switch between computational frameworks.
- **The enable/disable mechanism** supports the common pattern where a researcher wants to restrict idea generation to a specific formalism subset (e.g., "only consider SMEFT operators" or "exclude lattice approaches for this campaign").
- **On-demand loading** is important for production: a full HEP domain pack might include heavy assets (FeynRules model files, pre-computed amplitude databases), and lazy loading avoids startup penalties when running multi-domain orchestration.
- **Extension to broader physics** is straightforward: add `DomainPackDescriptor` entries with prefixes like `"cond-mat-"`, `"astro-ph-"`, `"nucl-th-"` without touching core resolution logic.

One gap for real research: the current `DomainPackAssets` has no slot for **citation/reference databases** or **known-result registries** that would be needed for novelty checking. This is likely M3.1+ scope but worth flagging as a schema extension point.

## Robustness & safety

**Strengths:**

- **Provenance chain is preserved:** Campaign objects now persist `domain_pack.pack_id` and `domain_pack.enabled_pack_ids`, creating an auditable record of which formalism/operator set generated each idea. This is critical for reproducibility.
- **Fail-closed on missing metadata:** `_load_campaign_domain_pack` raises a deterministic `RpcError` with structured error data (`campaign_id`, reason, details`) if the campaign's `domain_pack` metadata is missing or malformed. The regression test `test_search_step_fails_if_campaign_domain_pack_metadata_missing` simulates store corruption and verifies this.
- **Mutual exclusion on cache writes** prevents double-loading under concurrency, which could cause subtle state divergence if loaders have side effects.
- **Frozen dataclasses** for `DomainPackAssets` and `DomainPackDescriptor` prevent accidental mutation of shared configuration.

**Concerns (non-blocking):**

- The `threading.Lock` in `DomainPackIndex.load()` holds the lock during the entire `loader()` call (which could be slow for real packs). A double-checked locking pattern or per-pack locks would reduce contention when loading different packs concurrently. For M3.0 scope with small test packs this is fine, but flag for M3.1.
- The `loader` callable in `DomainPackDescriptor` is opaque—there's no validation that it's idempotent or side-effect-free beyond the `pack_id` mismatch check. Consider adding a `validate()` method or a `DomainPackAssets.validate()` classmethod for structural self-checks.
- If the store is corrupted and `domain_pack` metadata is removed (as in the regression test), the error message is clear, but there's no automatic recovery path. For production, consider a "re-derive from charter" fallback behind an explicit `--force-recover` flag.

## Specific patch suggestions

### 1. `src/idea_core/engine/domain_pack.py` — Per-pack lock to reduce contention

```python
# Line 37-38: Replace single lock with per-pack lock pattern
# Current:
        self._cache: dict[str, DomainPackAssets] = {}
        self._cache_lock = threading.Lock()

# Proposed:
        self._cache: dict[str, DomainPackAssets] = {}
        self._cache_lock = threading.Lock()
        self._pack_locks: dict[str, threading.Lock] = {
            d.pack_id: threading.Lock() for d in descriptors
        }
```

Then in `load()`:
```python
    def load(self, pack_id: str) -> DomainPackAssets:
        descriptor = self._descriptors.get(pack_id)
        if descriptor is None:
            raise KeyError(f"unknown domain pack id: {pack_id}")
        # Fast path: no lock needed for cache hit
        cached = self._cache.get(pack_id)
        if cached is not None:
            return cached
        # Per-pack lock: doesn't block loading of other packs
        with self._pack_locks[pack_id]:
            cached = self._cache.get(pack_id)
            if cached is not None:
                return cached
            assets = descriptor.loader()
            if assets.pack_id != pack_id:
                raise ValueError(
                    f"domain pack loader mismatch: descriptor={pack_id}, loaded={assets.pack_id}"
                )
            if not assets.search_operators:
                raise ValueError(f"domain pack {pack_id} has no search operators")
            with self._cache_lock:
                self._cache[pack_id] = assets
            return assets
```

### 2. `src/idea_core/engine/domain_pack.py` — Add schema extension point for future novelty-check assets

```python
# After line 10, add optional field to DomainPackAssets for forward-compatibility:
@dataclass(frozen=True)
class DomainPackAssets:
    pack_id: str
    domain_prefixes: tuple[str, ...]
    formalism_registry: dict[str, Any]
    abstract_problem_registry: dict[str, Any]
    search_operators: tuple[SearchOperator, ...]
    # M3.1+ extension point: known-result registries for novelty checking
    extra: dict[str, Any] = field(default_factory=dict)
```

Add `from dataclasses import dataclass, field` to the imports.

### 3. `src/idea_core/engine/service.py` — Document canonical extension keys

```python
# Before _resolve_domain_pack_for_charter (around line 362), add docstring:
    def _resolve_domain_pack_for_charter(
        self,
        charter: dict[str, Any],
    ) -> tuple[DomainPackAssets, list[str]]:
        """Resolve the active DomainPack for a campaign charter.

        Supported charter.extensions keys:
          - enable_domain_packs / enabled_domain_packs: list[str] — restrict candidate packs
          - disable_domain_packs / disabled_domain_packs: list[str] — exclude packs
          - domain_pack_id / active_domain_pack_id: str — select a specific pack

        Resolution order:
          1. If enable list provided, use it (error on unknown IDs).
          2. Else, derive candidates from charter.domain prefix matching.
          3. Apply disable filter.
          4. If domain_pack_id specified, select it (must be in candidates).
          5. Else, select first candidate.
        """
```

### 4. `src/idea_core/engine/service.py` — Remove redundant deepcopy

```python
# Lines after _resolve_domain_pack_for_charter call in campaign.init:
# Current:
            domain_pack, enabled_pack_ids = self._resolve_domain_pack_for_charter(params["charter"])
            default_formalisms = copy.deepcopy(domain_pack.formalism_registry)
            default_abstract_problems = copy.deepcopy(domain_pack.abstract_problem_registry)

# Proposed (loader already deepcopies; cache returns same ref but we need isolation):
# Keep as-is BUT add comment explaining why:
            domain_pack, enabled_pack_ids = self._resolve_domain_pack_for_charter(params["charter"])
            # deepcopy needed: cached DomainPackAssets is shared across campaigns
            default_formalisms = copy.deepcopy(domain_pack.formalism_registry)
            default_abstract_problems = copy.deepcopy(domain_pack.abstract_problem_registry)
```

### 5. `tests/engine/test_domain_pack_m30.py` — Strengthen thread-safety assertion

```python
# In test_domain_pack_index_load_is_thread_safe, after line ~246:
# Current:
    first = results[0]
    assert all(asset is first for asset in results)

# Proposed (also verify internal registry identity to prove single-load):
    first = results[0]
    assert all(asset is first for asset in results)
    # Verify the formalism_registry dict is the exact same object (not a copy),
    # proving the cache returned the same DomainPackAssets instance each time.
    assert all(
        asset.formalism_registry is first.formalism_registry for asset in results
    )
```

### 6. `src/idea_core/engine/service.py` — Add `_next_search_operator` mutation docstring

```python
# Line 905:
    @staticmethod
    def _next_search_operator(
        runtime: dict[str, Any],
        search_operators: tuple[SearchOperator, ...],
    ) -> SearchOperator:
        """Select the next search operator in round-robin order.

        Note: Mutates runtime['next_operator_index'] in place.
        """
```
