VERDICT: READY

## Blockers

No blockers identified for M3.1 scope. The patch is well-structured, TDD-evidenced, and the acceptance criteria are met with both positive and negative test coverage.

## Non-blocking

1. **`missing_formalisms` silently skips non-string entries.** In `FormalismRegistry.missing_formalisms`, if `candidate_formalisms` contains a non-string element, it's silently skipped (`if not isinstance(formalism_id, str): continue`). This is defensively fine, but a warn-level log or an explicit validation error would improve debuggability when an upstream agent emits malformed `candidate_formalisms`. Suggest adding at minimum a `logger.warning(...)` for the skip case.

2. **`merge()` error-path re-raises only `"must be non-empty"` string match.** The `except ValueError` block in `FormalismRegistry.merge` checks `if "must be non-empty" in str(exc)` to decide whether to re-wrap the message. This is fragile — if the upstream `from_payload` error message ever changes wording, the context re-wrapping silently stops. Prefer matching on a custom exception subclass or an error code attribute instead of string containment.

3. **`default_formalism_id()` relies on insertion-order stability of `dict.values()`.** In `merge()`, the `merged` dict is built with defaults first, then overrides. `default_formalism_id()` returns `entries[0]`, which will be the first default unless overridden. This is fine in CPython 3.7+ (insertion-ordered dicts), but the implicit contract "the first entry in the defaults list is the campaign default formalism" deserves a docstring or a dedicated `default_formalism_id` field in the payload rather than relying on positional convention.

4. **Double parse in `service.py` campaign init path.** After `FormalismRegistry.merge(...).to_payload()` at line ~730, the code re-parses via `FormalismRegistry.from_payload(formalism_registry, ...)` at line ~778 just to call `.default_formalism_id()`. This is harmless but wasteful. The `FormalismRegistry` object could be kept in scope and reused.

5. **`copy.deepcopy` on every `to_payload()` call and every `merge()` step.** For an MVP this is fine, but in a hot-loop expansion scenario (many campaigns, many formalisms), the deepcopy overhead will be non-trivial. Flag for M4+ profiling.

6. **Test `test_campaign_init_fails_when_effective_formalism_registry_is_empty` uses bare `assert False` instead of `pytest.raises`.** This is a style issue but it makes test failure messages less informative and bypasses pytest's built-in exception assertion machinery.

7. **`MINIMAL_HEP_FORMALISM_ENTRIES` uses `tuple[dict[str, str], ...]` type annotation** but the entries could evolve to have non-string values (e.g., nested `metadata` dicts). Consider `tuple[dict[str, Any], ...]` for forward compatibility, consistent with the `FormalismRegistry.entries` field type.

## Real-research fit

**Strong for HEP bootstrapping.** The three built-in formalisms (`hep/toy`, `hep/eft`, `hep/lattice`) cover the essential theory archetypes: a trivial test formalism, perturbative EFT, and non-perturbative lattice. This is a sensible minimal spanning set for idea-generation in HEP-ph.

**Extensibility path is clean.** The `DomainPackAssets.formalism_registry` + override merge pattern means a condensed-matter or astro-ph domain pack can inject its own formalisms without touching core code. The `FormalismRegistry.merge(defaults=..., overrides=...)` is the right seam.

**Promote gate is evidence-aligned.** The `formalism_not_in_registry` gate with `missing_formalisms` in the error payload is machine-auditable and gives downstream agents (or human reviewers) a concrete, actionable rejection reason — essential for an evidence-first pipeline.

**One gap for real research:** The `c2_schema_ref` URLs are all `example.org` placeholders. For M3.2+, these need to resolve to actual constraint schemas that validators can fetch and enforce. Without this, the registry is structurally sound but semantically vacuous. Consider adding a `TODO(m3.2)` marker in the code.

## Robustness & safety

1. **Hallucination mitigation (provenance).** The `evidence_uris_used` field in `_NoopOperator` is good test scaffolding. The promote gate enforces that `candidate_formalisms` must exist in the registry, which prevents an LLM from hallucinating a formalism name and having it silently accepted — this is a key safety property.

2. **Idempotency handling on error paths is correct.** Both `campaign.init` and `node.promote` store idempotency records before raising `RpcError`, preventing duplicate processing on retry.

3. **Fail-fast on empty registry.** The old code would `IndexError` on an empty formalism list during seed node creation. The new code validates early in `campaign.init` with a clear `schema_validation_failed` error. This is a meaningful safety improvement.

4. **Deduplication in `from_payload`.** The `seen_ids` set prevents duplicate `formalism_id` entries from being accepted, which avoids ambiguous registry lookups downstream.

5. **Frozen dataclass.** `FormalismRegistry` is `frozen=True`, preventing accidental mutation after construction. Good defensive design.

## Specific patch suggestions

### 1. `src/idea_core/engine/formalism_registry.py` — Eliminate fragile string matching in `merge()`

**Lines 70-73:** Replace string-containment error re-wrapping with direct construction:

```python
# REPLACE:
        try:
            default_registry = cls.from_payload(defaults, context="default formalism registry")
        except ValueError as exc:
            if "must be non-empty" in str(exc):
                raise ValueError(f"{context} must be non-empty") from exc
            raise

# WITH:
        if not isinstance(defaults, dict) or not defaults.get("entries"):
            raise ValueError(f"{context} must be non-empty")
        default_registry = cls.from_payload(defaults, context="default formalism registry")
```

### 2. `src/idea_core/engine/formalism_registry.py` — Fix type annotation for forward-compat

**Line 8:** Change:
```python
# REPLACE:
MINIMAL_HEP_FORMALISM_ENTRIES: tuple[dict[str, str], ...] = (

# WITH:
MINIMAL_HEP_FORMALISM_ENTRIES: tuple[dict[str, Any], ...] = (
```

### 3. `src/idea_core/engine/service.py` — Eliminate double-parse of formalism registry

**Lines ~728–778:** Keep the `FormalismRegistry` object from `merge()` and reuse it:

```python
# REPLACE (around line 730):
            try:
                formalism_registry = FormalismRegistry.merge(
                    defaults=default_formalisms,
                    overrides=params.get("formalism_registry"),
                    context="effective formalism registry",
                ).to_payload()
            except ValueError as exc:
                ...

# ... (around line 778):
            first_formalism = FormalismRegistry.from_payload(
                formalism_registry,
                context="effective formalism registry",
            ).default_formalism_id()

# WITH (around line 730):
            try:
                formalism_registry_obj = FormalismRegistry.merge(
                    defaults=default_formalisms,
                    overrides=params.get("formalism_registry"),
                    context="effective formalism registry",
                )
                formalism_registry = formalism_registry_obj.to_payload()
            except ValueError as exc:
                ...

# ... (around line 778):
            first_formalism = formalism_registry_obj.default_formalism_id()
```

### 4. `src/idea_core/engine/formalism_registry.py` — Add logging for silently skipped non-string formalisms

**Lines 100-102:** Add a warning:

```python
# REPLACE:
            if not isinstance(formalism_id, str):
                continue

# WITH:
            if not isinstance(formalism_id, str):
                import logging
                logging.getLogger(__name__).warning(
                    "Skipping non-string candidate_formalisms entry: %r", formalism_id
                )
                continue
```

(Move the `import logging` to module top-level.)

### 5. `tests/engine/test_formalism_registry_m31.py` — Use `pytest.raises` instead of bare `assert False`

**Lines 104-121:** Replace:

```python
# REPLACE:
    try:
        _campaign_init(
            service,
            idempotency_key="m3.1-empty-registry",
            extensions={"enable_domain_packs": ["hep.empty-formalisms"]},
        )
        assert False, "expected RpcError"
    except RpcError as exc:
        assert exc.code == -32002
        ...

# WITH:
    import pytest
    with pytest.raises(RpcError) as exc_info:
        _campaign_init(
            service,
            idempotency_key="m3.1-empty-registry",
            extensions={"enable_domain_packs": ["hep.empty-formalisms"]},
        )
    exc = exc_info.value
    assert exc.code == -32002
    assert exc.message == "schema_validation_failed"
    assert exc.data["reason"] == "schema_invalid"
    assert "effective formalism registry must be non-empty" in exc.data["details"]["message"]
```

Apply the same pattern to `test_node_promote_fails_when_candidate_formalism_not_in_registry` in `tests/engine/test_node_promote.py`.

### 6. `src/idea_core/engine/formalism_registry.py` — Add TODO for placeholder schema URIs

**After each `c2_schema_ref` in `MINIMAL_HEP_FORMALISM_ENTRIES`**, add:

```python
        "c2_schema_ref": "https://example.org/schemas/eft-c2-v1.json",  # TODO(m3.2): resolve to real constraint schema
```
