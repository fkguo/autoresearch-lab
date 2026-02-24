VERDICT: NOT_READY

## Blockers

### B1. Missing `formalism_registry.py` source — the central artifact is not included

The patch diff shows changes to `domain_pack.py`, `service.py`, and `test_node_promote.py`, but **the actual new module `src/idea_core/engine/formalism_registry.py` is not present in the diff or anywhere in the review bundle**. This is the single most important file under review — it defines `FormalismRegistry`, `MINIMAL_HEP_FORMALISM_ENTRIES`, `.merge()`, `.from_payload()`, `.to_payload()`, `.default_formalism_id()`, and `.missing_formalisms()`. Without it:

- We cannot verify the minimal HEP set (`hep/toy`, `hep/eft`, `hep/lattice`) is correctly defined with required fields (`c2_schema_ref`, `validator_id`, `compiler_id`).
- We cannot verify `.merge()` semantics (does override replace by `formalism_id` key? append? deep-merge?).
- We cannot verify `.missing_formalisms()` is a simple set-difference or something more subtle.
- We cannot verify the `ValueError` contract that `service.py` catches.
- We cannot verify thread-safety (the existing `domain_pack.py` uses threading).

**Fix:** Include the full `formalism_registry.py` in the review bundle.

### B2. Missing test file `tests/engine/test_formalism_registry_m31.py`

Listed in "Files under review" (§2) but not included in the patch. The acceptance criteria (§4) claim the registry MVP is tested, but we can only see one promote-gate test. Unit tests for the registry itself — construction, merge semantics, empty-registry rejection, duplicate-id handling — are unverifiable.

**Fix:** Include the full test file in the review bundle.

### B3. `copy.deepcopy` used without `import copy` verified

In `domain_pack.py`, the new line:
```python
default_formalisms = {"entries": [copy.deepcopy(entry) for entry in MINIMAL_HEP_FORMALISM_ENTRIES]}
```
The existing imports shown in the diff context do not include `import copy`. The original file header (`import threading`, `from dataclasses import dataclass`, etc.) may or may not include it. If `copy` is not imported, this is a runtime `NameError` on every `campaign.init` call.

**Fix:** Confirm `import copy` exists in `domain_pack.py`; if not, add it. Alternatively, if `MINIMAL_HEP_FORMALISM_ENTRIES` are frozen/immutable dataclasses, document that `deepcopy` is unnecessary and use a simpler copy strategy.

## Non-blocking

### N1. Defensive double-parse in `service.py` for `first_formalism` selection

After constructing `formalism_registry` via `FormalismRegistry.merge(...).to_payload()`, the code immediately re-parses the payload:
```python
first_formalism = FormalismRegistry.from_payload(
    formalism_registry,
    context="effective formalism registry",
).default_formalism_id()
```
This is a redundant round-trip. The `.merge()` call already returns a `FormalismRegistry` instance — store it and call `.default_formalism_id()` directly, then call `.to_payload()` for storage. Suggested refactor:

```python
registry_obj = FormalismRegistry.merge(
    defaults=default_formalisms,
    overrides=params.get("formalism_registry"),
    context="effective formalism registry",
)
formalism_registry = registry_obj.to_payload()
first_formalism = registry_obj.default_formalism_id()
```

This eliminates a validation pass, removes an unnecessary exception path, and is clearer.

### N2. `default_formalism_id()` semantics are implicit

The code uses "first entry" as the default formalism for seed nodes. This positional coupling is fragile — reordering `MINIMAL_HEP_FORMALISM_ENTRIES` silently changes campaign behavior. Consider either:
- An explicit `default: true` flag on one entry in the registry schema, or
- A `default_formalism_id` field on the registry payload itself, or
- At minimum, a docstring contract in `FormalismRegistry` stating "first entry is the default."

### N3. Promote gate test does not cover multi-formalism partial-miss

The new test `test_node_promote_fails_when_candidate_formalism_not_in_registry` checks a single missing formalism (`hep/not-in-registry`). Add a case where `candidate_formalisms` contains a mix of valid and invalid IDs (e.g., `["hep/toy", "hep/bogus"]`) to verify `missing_formalisms` returns only the invalid subset.

### N4. No negative test for empty override producing empty registry

Acceptance item 3 says `campaign.init` should fail-fast on empty effective registry. The test file for this (`test_formalism_registry_m31.py`) is missing from the bundle, so we can't verify. Even if it exists, confirm there's a test for:
```python
params["formalism_registry"] = {"entries": []}
# with defaults also cleared somehow — or defaults overridden to empty
```

### N5. Thread-safety of `MINIMAL_HEP_FORMALISM_ENTRIES`

`MINIMAL_HEP_FORMALISM_ENTRIES` is a module-level mutable (presumably a `list[dict]`). The `deepcopy` in `domain_pack.py` protects against mutation, but any direct consumer that skips `deepcopy` could corrupt the shared state. Consider making the entries frozen — e.g., `tuple` of `MappingProxyType` or frozen dataclasses — at the module level.

### N6. `_merge_registry_entries` still used for `abstract_problem_registry`

The old generic `_merge_registry_entries` method is still called for abstract problems. The new `FormalismRegistry.merge()` duplicates its logic for formalisms. Consider whether `FormalismRegistry.merge()` should delegate to a shared generic merge utility to avoid semantic drift between the two merge paths. Not urgent for M3.1, but track for M3.2.

### N7. Error code `-32012` semantics

The test asserts `exc.code == -32012` and `exc.message == "formalism_not_in_registry"`, but this reuses the same error code as (presumably) other schema validation failures. Confirm in the OpenRPC spec that `-32012` is the designated code for `formalism_not_in_registry` specifically, or that it's a generic "validation gate failure" code. Document the code allocation to prevent collisions.

## Real-research fit

### R1. HEP minimal set is too minimal for real research workflows

Three built-in formalisms (`hep/toy`, `hep/eft`, `hep/lattice`) are a reasonable bootstrap, but real HEP idea generation needs at minimum:
- `hep/perturbative-qft` (standard model perturbation theory)
- `hep/bsm-simplified-models` (BSM simplified model frameworks)
- `hep/chiral-pt` (chiral perturbation theory)

The `hep/toy` entry with a placeholder schema ref (`https://example.org/schemas/toy-c2-v1.json`) signals this is purely a test fixture. **For M3.1 MVP this is acceptable**, but the registry should ship with a clear TODO/issue tracking when real schema refs and validators replace placeholders.

### R2. Formalism extensibility path is sound

The design — registry as a typed collection with merge semantics, domain packs providing defaults, user overrides at campaign init — cleanly supports adding new formalisms (e.g., `hep/amplitude-methods`, `cosmo/inflation-eft`) without modifying core logic. The `domain_pack` providing defaults per domain while `campaign.init` allows overrides is the right layering.

### R3. `candidate_formalisms` gate is research-critical

Catching unregistered formalisms at promote time (rather than letting them propagate to compilation/validation stages) is exactly right for evidence-first workflows. In real HEP research, an idea node claiming a formalism that has no validator/compiler would produce unauditable artifacts. The gate prevents this.

## Robustness & safety

### S1. Hallucination mitigation: formalism ID provenance

The registry gate on promote is a strong anti-hallucination measure — LLM-generated idea cards cannot reference formalisms that don't exist in the campaign's registry. This is a clean, mechanical check that doesn't depend on LLM judgment.

**Gap:** There's no validation that the `c2_schema_ref`, `validator_id`, or `compiler_id` in a registry entry actually resolve to real resources. A hallucinated formalism entry (with plausible-looking but fake refs) could pass the registry check. Consider adding a "registry entry health check" that validates refs are resolvable, at least at campaign init time. Track for M3.2.

### S2. Deterministic fail-fast on empty registry

The move from `IndexError` (runtime crash) to explicit `ValueError` → `_schema_error()` is a significant robustness improvement. The old path would produce an opaque stack trace; the new path produces a machine-readable RPC error.

### S3. Idempotency key storage on error paths

Both `campaign.init` and `node.promote` correctly store idempotency entries on the error path before raising. This prevents retry-induced inconsistency. Good.

### S4. Missing: input sanitization on formalism IDs

`formalism_id` values appear to be arbitrary strings. There's no validation of format (e.g., `domain/name` pattern). A malformed ID like `../../etc/passwd` or an empty string could cause downstream issues depending on how IDs are used in file paths or keys. Add a regex constraint (e.g., `^[a-z][a-z0-9]*(/[a-z][a-z0-9-]*)+$`) in the `FormalismRegistry` constructor.

## Specific patch suggestions

### P1. `src/idea_core/engine/domain_pack.py` — ensure `import copy`

```python
# At top of file, add if not already present:
import copy
```

### P2. `src/idea_core/engine/service.py` lines ~718–735 — eliminate redundant re-parse

Replace:
```python
try:
    formalism_registry = FormalismRegistry.merge(
        defaults=default_formalisms,
        overrides=params.get("formalism_registry"),
        context="effective formalism registry",
    ).to_payload()
except ValueError as exc:
    # ... error handling ...

# ... later ...
first_formalism = FormalismRegistry.from_payload(
    formalism_registry,
    context="effective formalism registry",
).default_formalism_id()
```

With:
```python
try:
    _formalism_registry_obj = FormalismRegistry.merge(
        defaults=default_formalisms,
        overrides=params.get("formalism_registry"),
        context="effective formalism registry",
    )
    formalism_registry = _formalism_registry_obj.to_payload()
except ValueError as exc:
    # ... error handling unchanged ...

# ... later ...
first_formalism = _formalism_registry_obj.default_formalism_id()
```

### P3. `src/idea_core/engine/formalism_registry.py` (new file, not yet reviewed) — add formalism ID format validation

```python
import re

_FORMALISM_ID_RE = re.compile(r"^[a-z][a-z0-9]*(/[a-z][a-z0-9-]*)+$")

class FormalismRegistry:
    def __init__(self, entries: list[dict]) -> None:
        for entry in entries:
            fid = entry.get("formalism_id", "")
            if not _FORMALISM_ID_RE.match(fid):
                raise ValueError(
                    f"Invalid formalism_id format: {fid!r}. "
                    f"Must match {_FORMALISM_ID_RE.pattern}"
                )
        # ... rest of init
```

### P4. `tests/engine/test_node_promote.py` — add partial-miss test

After the new test, add:
```python
def test_node_promote_fails_lists_only_missing_formalisms(tmp_path: Path) -> None:
    """When candidate_formalisms has a mix of valid and invalid, only invalid are reported."""
    service = make_service(tmp_path)
    campaign_id, node_id = init_campaign(service)
    _enable_grounding_pass(service, campaign_id, node_id)

    nodes = service.store.load_nodes(campaign_id)
    nodes[node_id]["idea_card"]["candidate_formalisms"] = ["hep/toy", "hep/bogus"]
    service.store.save_nodes(campaign_id, nodes)

    try:
        service.handle(
            "node.promote",
            {
                "campaign_id": campaign_id,
                "node_id": node_id,
                "idempotency_key": "promote-partial-miss",
            },
        )
        assert False, "expected RpcError"
    except RpcError as exc:
        assert exc.code == -32012
        assert exc.data["details"]["missing_formalisms"] == ["hep/bogus"]
```

### P5. Review bundle itself — include the two missing files

In `docs/reviews/bundles/` or equivalent location, the next version of this review bundle **must** include:
- Full content of `src/idea_core/engine/formalism_registry.py`
- Full content of `tests/engine/test_formalism_registry_m31.py`

Without these, the review cannot be completed. This is the sole remaining structural blocker from the v1→v2 iteration.
