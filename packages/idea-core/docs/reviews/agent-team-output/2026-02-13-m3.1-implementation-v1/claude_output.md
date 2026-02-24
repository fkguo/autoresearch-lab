VERDICT: NOT_READY

## Blockers

### B1. Empty patch — no code to review

The review bundle's §7 "Patch (working tree diff)" is literally empty (````diff\n````). Without the actual implementation diff, it is impossible to verify:

- Whether `FormalismRegistry` enforces immutability / thread-safety of the built-in HEP set.
- Whether `node.promote` correctly computes `missing_formalisms` and returns a machine-auditable rejection payload.
- Whether `campaign.init` fail-fast is deterministic and does not leak internal state.
- Whether OpenRPC/schema semantic drift has been avoided.
- Whether the test coverage actually exercises the negative paths claimed.

**This is the single hard blocker.** Every other observation below is conditioned on reasonable assumptions about what the code *probably* looks like, but none can be confirmed.

### B2. No artifact contract / schema definition for `FormalismRegistry` entries

The bundle mentions three built-in entries (`hep/toy`, `hep/eft`, `hep/lattice`) but provides no schema for what a registry entry *is*. A formalism entry must carry at minimum:

| Field | Type | Purpose |
|---|---|---|
| `id` | `str` (namespaced, e.g. `hep/eft`) | Unique lookup key |
| `display_name` | `str` | Human-readable label |
| `version` | `str` (semver) | Pinning for reproducibility |
| `required_domain_pack` | `Optional[str]` | Link back to domain pack that provides it |
| `provenance_uri` | `Optional[str]` | Reference (arXiv, textbook, etc.) |
| `constraints` | `dict` | Machine-readable validity constraints (e.g., energy scale bounds for EFT) |

Without this contract, downstream consumers (promote gate, seed selection, idea-scoring) cannot be implemented deterministically. This must be defined in `src/idea_core/engine/formalism_registry.py` and exported as a `TypedDict` or Pydantic model before the milestone can close.

### B3. Missing negative-path test for `candidate_formalisms` partially outside registry

The acceptance criteria say "candidate_formalisms[] not in registry must fail on promote." The test file `test_node_promote.py` is not shown, so we cannot confirm whether the following critical case is covered:

```python
# Candidate has mix of valid and invalid formalisms
node.candidate_formalisms = ["hep/eft", "hep/nonexistent"]
result = node.promote(registry=registry)
assert result.status == "rejected"
assert result.reason == "formalism_not_in_registry"
assert result.missing_formalisms == ["hep/nonexistent"]
# Crucially: the valid formalism must NOT be partially promoted
```

If partial promotion is possible, this is an evidence-safety violation.

## Non-blocking

### N1. Registry extensibility path not documented

The design says "HEP first, then broader theoretical physics without rewriting the core." The registry must support runtime registration of domain packs (e.g., `condensed-matter/hubbard`). Suggested pattern:

```python
class FormalismRegistry:
    def register(self, entry: FormalismEntry) -> None:
        """Idempotent insert; raises DuplicateFormalism if id exists with different version."""
    
    def register_pack(self, pack: DomainPack) -> int:
        """Bulk-register all formalisms from a domain pack. Returns count added."""
```

This doesn't block M3.1 but should be tracked as M3.2 prerequisite.

### N2. No `__eq__` / `__hash__` contract on formalism IDs

If formalism IDs are plain strings, case sensitivity and normalization must be specified. `"hep/EFT"` vs `"hep/eft"` will silently pass or fail the promote gate depending on implementation. Recommend: lowercase-normalized, validated by regex `^[a-z0-9]+(/[a-z0-9_-]+)+$` at registration time.

### N3. TDD evidence format is append-only text

The red/green evidence lives in `docs/reviews/bundles/2026-02-13-m3.1-formalism-failure-repro-v1.txt` as appended text. This is fragile — a future append could overwrite the red phase. Recommend splitting into `*-red.txt` and `*-green.txt`, or using a structured JSONL log with timestamps and git SHAs.

### N4. Campaign init error message should include remediation

The fail-fast on empty/invalid registry should tell the user *how* to fix it:

```python
raise SchemaError(
    "Effective formalism registry is empty. "
    "Ensure at least one domain pack is loaded via `campaign.load_pack(...)` "
    "or the built-in HEP pack is not explicitly excluded."
)
```

### N5. `make validate` + `55 passed` is necessary but not sufficient

No mutation testing or property-based testing evidence is provided. For a gate that is a safety boundary (hallucination mitigation via formalism grounding), at minimum `hypothesis`-based fuzzing of formalism ID strings into `promote()` should be added.

## Real-research fit

**HEP workflow alignment**: The three seed formalisms (`hep/toy`, `hep/eft`, `hep/lattice`) are reasonable for a minimal viable set but miss important HEP archetypes:

- `hep/perturbative_qcd` — the workhorse of collider phenomenology
- `hep/susy` — still a major BSM framework
- `hep/chiral_perturbation_theory` — essential for low-energy QCD

These don't need to block M3.1, but the "minimal HEP set" should be explicitly marked as *seed-only* with a documented extension path. Otherwise users will assume the registry is exhaustive and ideas outside these three formalisms will be systematically suppressed at the promote gate.

**Evidence-first fit**: The `formalism_not_in_registry` gate is the right architectural decision. It forces ideas to be grounded in a known theoretical framework before promotion, which is a strong hallucination mitigation. However, the gate's value depends entirely on the registry entry carrying enough metadata (see B2) to enable downstream validation — e.g., "this EFT idea claims Λ ∼ 10 TeV, is that consistent with the `hep/eft` entry's `constraints.energy_scale_range`?"

**Domain pack ↔ registry coupling**: The bundle lists both `formalism_registry.py` and `domain_pack.py` under review but provides no diff showing how they interact. The clean boundary should be: domain packs *provide* formalism entries, the registry *indexes* them, and the promote gate *queries* the registry. If `domain_pack.py` directly mutates registry state, that's a coupling violation.

## Robustness & safety

1. **Provenance gap**: Registry entries have no provenance URI. An idea claiming to use `hep/eft` should be traceable to a specific EFT framework (e.g., SMEFT vs HEFT). Without provenance, the gate is a string-match, not a semantic check.

2. **Concurrency**: If campaigns run in parallel (likely in production), the registry must be either immutable-after-init or use copy-on-write semantics. Mutable shared state in the registry is a race condition waiting to happen.

3. **Hallucination surface**: The promote gate catches *unknown* formalisms but does not catch *misattributed* formalisms (e.g., an idea tagged `hep/lattice` that contains no lattice-relevant content). This is a known limitation that should be documented as a future M4+ concern, not silently ignored.

4. **Deterministic fail-fast**: The `IndexError` → `SchemaError` fix is correct in principle, but without the diff we cannot verify that no other code paths still reach the old `IndexError` (e.g., via `random.choice(effective_formalisms)` when the list is empty after filtering).

## Specific patch suggestions

Since the diff is empty, these are prescriptive patches against the file paths listed in the bundle:

### P1. `src/idea_core/engine/formalism_registry.py` — Add entry schema

```python
# Add at top of file
from __future__ import annotations
from dataclasses import dataclass, field
from typing import Optional
import re

_ID_PATTERN = re.compile(r"^[a-z0-9]+(/[a-z0-9_-]+)+$")

@dataclass(frozen=True)
class FormalismEntry:
    id: str                          # e.g. "hep/eft"
    display_name: str
    version: str = "0.1.0"
    required_domain_pack: Optional[str] = None
    provenance_uri: Optional[str] = None
    constraints: dict = field(default_factory=dict)

    def __post_init__(self):
        if not _ID_PATTERN.match(self.id):
            raise ValueError(
                f"Formalism ID '{self.id}' must match {_ID_PATTERN.pattern}"
            )
```

### P2. `src/idea_core/engine/formalism_registry.py` — Thread-safe registry with immutable snapshot

```python
import threading
from typing import FrozenSet

class FormalismRegistry:
    def __init__(self, entries: list[FormalismEntry] | None = None):
        self._lock = threading.Lock()
        self._entries: dict[str, FormalismEntry] = {}
        for e in (entries or []):
            self._entries[e.id] = e

    def lookup(self, formalism_id: str) -> FormalismEntry | None:
        return self._entries.get(formalism_id)

    def known_ids(self) -> FrozenSet[str]:
        return frozenset(self._entries.keys())

    def validate_candidates(self, candidate_ids: list[str]) -> list[str]:
        """Return list of candidate IDs not in registry (empty = all valid)."""
        known = self.known_ids()
        return [c for c in candidate_ids if c not in known]

    def register(self, entry: FormalismEntry) -> None:
        with self._lock:
            if entry.id in self._entries:
                existing = self._entries[entry.id]
                if existing.version != entry.version:
                    raise ValueError(
                        f"Duplicate formalism '{entry.id}' with conflicting version "
                        f"({existing.version} vs {entry.version})"
                    )
                return  # idempotent
            self._entries[entry.id] = entry
```

### P3. `src/idea_core/engine/service.py` — Promote gate must be atomic (no partial promotion)

```python
# In the promote() method, replace the current validation block with:
missing = self._registry.validate_candidates(node.candidate_formalisms)
if missing:
    return PromoteResult(
        status="rejected",
        reason="formalism_not_in_registry",
        missing_formalisms=missing,
        # No side-effects: node state unchanged
    )
# Only after full validation passes:
node.status = "promoted"
```

### P4. `tests/engine/test_node_promote.py` — Add partial-invalid test

```python
def test_promote_rejects_partial_invalid_formalisms(minimal_registry):
    """Mixed valid+invalid candidate list must reject entirely."""
    node = IdeaNode(candidate_formalisms=["hep/eft", "hep/nonexistent"])
    result = node.promote(registry=minimal_registry)
    assert result.status == "rejected"
    assert result.reason == "formalism_not_in_registry"
    assert result.missing_formalisms == ["hep/nonexistent"]
    assert node.status != "promoted"  # no partial promotion
```

### P5. `tests/engine/test_formalism_registry_m31.py` — Add ID normalization and constraints tests

```python
import pytest
from idea_core.engine.formalism_registry import FormalismEntry, FormalismRegistry

def test_invalid_id_rejected():
    with pytest.raises(ValueError, match="must match"):
        FormalismEntry(id="HEP/EFT", display_name="Bad Case")

def test_duplicate_same_version_is_idempotent():
    reg = FormalismRegistry()
    entry = FormalismEntry(id="hep/eft", display_name="EFT")
    reg.register(entry)
    reg.register(entry)  # no error
    assert len(reg.known_ids()) == 1

def test_duplicate_different_version_raises():
    reg = FormalismRegistry()
    reg.register(FormalismEntry(id="hep/eft", display_name="EFT", version="0.1.0"))
    with pytest.raises(ValueError, match="conflicting version"):
        reg.register(FormalismEntry(id="hep/eft", display_name="EFT", version="0.2.0"))
```

### P6. `docs/reviews/bundles/` — Split TDD evidence files

Rename:
- `2026-02-13-m3.1-formalism-failure-repro-v1.txt` → split into:
  - `2026-02-13-m3.1-formalism-failure-repro-v1-RED.txt` (original failures only)
  - `2026-02-13-m3.1-formalism-failure-repro-v1-GREEN.txt` (passing rerun only)

Each file should include the git SHA at which the test was run.

---

**Summary**: The architectural direction is sound — a formalism registry with a hard promote gate is exactly the right evidence-first safety boundary. However, the empty diff makes this unreviewable. The missing entry schema (B2) means downstream consumers have no contract to code against. Resubmit with the actual patch and the `FormalismEntry` dataclass, and this is likely a quick approve.
