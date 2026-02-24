VERDICT: READY

## Blockers

No hard blockers found. The implementation satisfies the three M3.5 acceptance criteria:

1. **≥2 heuristic classes** — `consistency` (dimension_units, known_constraints) and `feasibility` (compute_feasibility) are both present and structurally distinct.
2. **Structured `failure_modes`** — the 5-segment token format `hep:{class}:{validator_id}:{code}:{severity}` is deterministic, parseable, and grep-friendly.
3. **eval → promote regression gate** — `eval.run` appends diagnostics; `node.promote` blocks on any `critical`-severity HEP token; two regression tests cover both paths.

## Non-blocking

### N1. Token format is stringly-typed — consider a thin dataclass

The `hep:consistency:hep.known_constraints.v1:branching_ratio_out_of_range:critical` token is convenient for logs/grep, but downstream consumers (M3.6+ dashboards, audit export) will repeatedly `split(":")`. A `@dataclass(frozen=True)` `HepDiagnostic` with a `__str__` → token and `from_token(s: str)` round-trip would cost ~15 LOC and make the contract machine-verifiable today.

### N2. Deduplication ordering contract is implicit

`_dedupe_preserve_order(failure_modes)` is called but its ordering guarantee (first-seen wins) is only implied by the name. Add a one-line docstring or a unit test asserting insertion order is preserved when duplicates exist.

### N3. `severity` vocabulary is unbounded

Only `critical` is used; the gate checks `endswith(":critical")`. If a future validator emits `warning` or `info`, nothing enforces a closed enum. Consider a `SEVERITY_LEVELS = frozenset({"critical", "warning", "info"})` constant with an assertion in `_hep_failure_mode_token`.

### N4. `dimension_units.v1` validator coverage in tests

The test asserts `"consistency" in classes` and `"feasibility" in classes`, but doesn't separately assert that both `hep.dimension_units.v1` and `hep.known_constraints.v1` fire. A single consistency validator firing satisfies the set membership check. Adding a validator-id-level assertion would tighten the regression.

### N5. Error code reuse

`-32002` / `"schema_validation_failed"` is reused for HEP constraint failures. This is pragmatic (avoids OpenRPC drift, which is out of scope), but the `details.message = "hep_constraints_failed"` sub-field is the only discriminator. Document this convention so M3.6 doesn't accidentally change the error code thinking it's only for JSON Schema errors.

### N6. Placeholder compute methods in `compute_feasibility.v1`

The feasibility validator flags `compute_plan_placeholder_method`, which is good — but the review bundle doesn't show what patterns trigger this heuristic (regex? keyword list?). If it's keyword-matching on strings like `"placeholder"` or `"TODO"`, document the keyword set so it's auditable and extensible.

## Real-research fit

**Strong.** The two validator classes map directly onto real failure modes in HEP idea generation:

- **`known_constraints`**: Branching ratio bounds and mass contradictions are precisely the kind of errors an LLM will hallucinate (e.g., proposing B(H→γγ) = 0.5, or a massless particle with a lifetime). The `branching_ratio_out_of_range` check is a high-leverage first guard.
- **`compute_feasibility`**: Flagging ideas that claim to need lattice QCD but propose no compute plan (or a placeholder) prevents wasted downstream cycles. This is a real bottleneck in automated research pipelines.

**Gap for future milestones** (not a blocker for M3.5): The validators are currently pattern/keyword-based. For M3.6+, the architecture should accommodate validators that call external tools (e.g., `pdg-lookup` for mass/width bounds, `hep-calc` for dimensional analysis). The current `_build_hep_constraint_findings` function structure is compatible with this — each validator could become a plugin — but this isn't formalized yet.

**Extensibility to broader theoretical physics** is natural: the token format `hep:{class}:{validator_id}:{code}:{severity}` can be prefixed with a domain tag (e.g., `cosmo:`, `cond-mat:`) if the system expands. No rewrite needed.

## Robustness & safety

### Evidence-first compliance

- **Provenance**: Each finding carries `validator_id` with a version suffix (`.v1`), enabling audit trails. ✓
- **Hallucination mitigation**: The promote gate is a hard block — no critical-failure idea can advance without manual override. This is the correct default for evidence-first systems. ✓
- **Novelty check interaction**: Not in scope for M3.5, but the token format doesn't conflict with novelty-check artifacts. ✓

### Failure mode safety

- The `_blocking_hep_failure_modes` filter correctly scans `eval_info.failure_modes` for `hep:*:*:*:critical` patterns. The `startswith("hep:")` + `endswith(":critical")` guards are sufficient and avoid over-matching non-HEP tokens.
- The `RpcError` includes full `blocking_failure_modes` list in `data.details`, enabling caller-side diagnostics without re-querying.

### Concern: silent pass on empty input

If an idea node has no physics claims (e.g., a purely methodological idea), the validators will find nothing to flag and the idea passes silently. This is acceptable for M3.5 but should be documented as a known gap — a "no-claims-detected" informational diagnostic in M3.6 would be prudent.

## Specific patch suggestions

### Patch 1: Add frozen dataclass for diagnostic tokens
**File**: `src/idea_core/engine/service.py`
**Location**: Near `_hep_failure_mode_token`
**Change**: Add a thin dataclass and round-trip method:
```python
from dataclasses import dataclass

SEVERITY_LEVELS = frozenset({"critical", "warning", "info"})

@dataclass(frozen=True)
class HepDiagnostic:
    heuristic_class: str   # "consistency" | "feasibility"
    validator_id: str       # e.g. "hep.known_constraints.v1"
    code: str               # e.g. "branching_ratio_out_of_range"
    severity: str           # must be in SEVERITY_LEVELS

    def __post_init__(self):
        if self.severity not in SEVERITY_LEVELS:
            raise ValueError(f"Unknown severity {self.severity!r}; expected one of {SEVERITY_LEVELS}")

    def __str__(self) -> str:
        return f"hep:{self.heuristic_class}:{self.validator_id}:{self.code}:{self.severity}"

    @classmethod
    def from_token(cls, token: str) -> "HepDiagnostic":
        prefix, hclass, vid, code, sev = token.split(":")
        assert prefix == "hep"
        return cls(heuristic_class=hclass, validator_id=vid, code=code, severity=sev)
```
Keep `_hep_failure_mode_token` as a backward-compatible wrapper that delegates to `str(HepDiagnostic(...))`. This is ~20 LOC, zero behavioral change, pure safety gain.

### Patch 2: Tighten test to assert both consistency validators fire
**File**: `tests/engine/test_hep_constraints_m35.py`
**Location**: `test_eval_run_emits_structured_hep_failure_modes_and_fix_suggestions`
**Change**: After the existing class-level assertions, add:
```python
    validator_ids = {mode.split(":")[2] for mode in hep_failure_modes}
    assert "hep.dimension_units.v1" in validator_ids or "hep.known_constraints.v1" in validator_ids
    # Ensure at least one feasibility validator also fired:
    assert "hep.compute_feasibility.v1" in validator_ids
```
This prevents a regression where one validator is accidentally disabled but the class-level check still passes.

### Patch 3: Document error code reuse convention
**File**: `docs/reviews/bundles/2026-02-13-m3.5-hep-constraints-failure-repro-v1.txt` (or a new `docs/conventions/rpc-error-codes.md`)
**Change**: Add a section:
```markdown
## RPC Error Code Conventions

| Code    | message                    | details.message            | Meaning                           |
|---------|----------------------------|----------------------------|-----------------------------------|
| -32002  | schema_validation_failed   | (varies by JSON Schema)    | Node fails JSON Schema validation |
| -32002  | schema_validation_failed   | hep_constraints_failed     | Node fails HEP constraint gate    |

Discriminate via `details.message`. M3.6+ may allocate a dedicated code for HEP constraints.
```

### Patch 4: Add docstring to `_dedupe_preserve_order`
**File**: `src/idea_core/engine/service.py`
**Location**: `_dedupe_preserve_order` method
**Change**:
```python
    def _dedupe_preserve_order(self, items: list[str]) -> list[str]:
        """Return items with duplicates removed, preserving first-occurrence order."""
        seen: set[str] = set()
        result: list[str] = []
        for item in items:
            if item not in seen:
                seen.add(item)
                result.append(item)
        return result
```

### Patch 5: Add informational note about silent pass on empty claims
**File**: `src/idea_core/engine/service.py`
**Location**: Top of `_build_hep_constraint_findings`
**Change**: Add a comment/docstring:
```python
        # NOTE(M3.5): If the idea contains no detectable physics claims
        # (e.g., no mass values, branching ratios, or compute plans),
        # all validators pass silently. M3.6 should add a
        # "no_physics_claims_detected" informational diagnostic.
```
