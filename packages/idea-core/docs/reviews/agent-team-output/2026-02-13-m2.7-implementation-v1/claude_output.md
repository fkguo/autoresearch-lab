VERDICT: NOT_READY

## Blockers

1. **`_formalize_rationale_to_idea_card` is a deterministic stub, not an LLM-backed formalizer — but the trace claims `mode=explain_then_formalize_v1`.**
   Based on the diff description, the helper constructs the `idea_card` by mechanical field-mapping from `rationale_draft`. This means:
   - The "explain-then-formalize" semantics are **nominal only** — there is no actual reasoning step that transforms a free-text rationale into a structured hypothesis card with novelty claims, falsifiability criteria, or evidence pointers.
   - The trace field `mode=explain_then_formalize_v1` is misleading: it implies an LLM-mediated formalization pass occurred when in fact it's a dict copy.
   - **Fix required:** Either (a) rename the mode to `mechanical_extract_v0` and document that LLM formalization is deferred to M2.8+, or (b) actually wire the formalization through the LLM call with a structured-output prompt and schema validation on the result. Option (a) is minimal and honest; option (b) is the intended design.

2. **No negative-path test for _malformed_ `rationale_draft` → `idea_card` conversion.**
   The tests cover "idea_card present → promote succeeds" and "idea_card absent → promote fails", but there is no test for the case where `rationale_draft` exists yet is malformed/incomplete (e.g., missing `hypothesis`, empty `evidence_refs`). The formalize helper should either:
   - Reject the draft with a new error code (e.g., `-32003 / formalization_failed / reason=rationale_incomplete`), or
   - Produce a partial `idea_card` that itself fails the schema gate at promote time.
   Without this, a garbage-in-garbage-out path exists that silently produces schema-valid but scientifically meaningless cards.

3. **`rationale_hash` is computed but never verified downstream.**
   The trace records `rationale_hash=sha256:...`, which is good for auditability — but nothing in the promote gate or any downstream consumer checks that the `idea_card` actually corresponds to the recorded rationale hash. This breaks the provenance chain: you can mutate `rationale_draft` after formalization and promote will still succeed. Either:
   - Store `rationale_hash` inside `idea_card.provenance` **and** verify it at promote time, or
   - Document explicitly that hash verification is deferred (with a TODO that references a future milestone).

## Non-blocking

1. **Test file naming inconsistency.** `test_search_step_operator_m26.py` contains M2.7 formalization assertions. Consider renaming to `test_search_step_operator.py` or adding a separate `test_formalization_trace_m27.py` so test provenance matches milestone provenance.

2. **Formalization trace lives inside `operator_trace.params.formalization` for operator nodes — where does it live for seed nodes?** The description says both paths use the same helper, but seed nodes may not have an `operator_trace`. Confirm the trace is written to a uniform location (e.g., `node.meta.formalization_trace`) regardless of node origin.

3. **`sha256:...` prefix convention.** The hash uses a `sha256:` prefix string. Consider adopting the OCI/SRI convention (`sha256-<base64>` or `sha256:<hex>`) explicitly in a shared constant or utility, so future artifact hashing (model cards, evidence snapshots) uses the same format.

4. **41 tests in 1.52s is suspiciously fast for a system that should include schema validation.** Confirm that the JSON Schema validation in tests uses the actual `contracts/idea-generator-snapshot/` schemas (not inlined mocks). If tests mock the schema, a drift between the real schema and test expectations can hide regressions.

## Real-research fit

**HEP workflow alignment:**
- The "explain-then-formalize" pattern maps well to the physicist's workflow: write a rationale (free-text motivation, symmetry argument, anomaly observation) → produce a structured hypothesis card (observable, predicted signature, background estimate, falsifiability condition).
- However, the current implementation does **not** enforce any of the physics-meaningful fields that make an `IdeaCard` useful in practice. A real HEP idea card should minimally require: `hypothesis` (string), `observable` (string), `falsifiability_criterion` (string), `evidence_refs` (list, ≥1 entry). If the schema already enforces these via `required`, confirm the formalize helper actually populates them from the rationale. If the schema is loose (all fields optional), this is a latent safety hole — the gate passes but the card is empty.

**Evidence-first safety:**
- The provenance chain (`rationale_draft` → `rationale_hash` → `idea_card`) is the right architecture, but as noted in Blocker 3, it's write-only. For a real HEP evidence pipeline, this chain must be **verifiable**: given an `idea_card`, I should be able to reconstruct or at least checksum-verify the rationale that produced it.

**Extensibility to broader theory:**
- The `_formalize_rationale_to_idea_card` helper is the natural extension point for domain-specific formalization (e.g., condensed matter, astro). The current tight coupling to a single helper is fine for M2.7, but the function signature should accept a `formalization_strategy` parameter (defaulting to `hep_v1`) to avoid rewriting when M3+ adds new domains.

## Robustness & safety

1. **Hallucination mitigation gap.** If/when the formalize step becomes LLM-backed, there is no guard against the LLM inventing evidence references or fabricating arxiv IDs in the `idea_card`. Plan for a post-formalization validation step that checks `evidence_refs` against a known-papers index (e.g., the `pdg-lookup` / `zotero-import` toolchain already in the ecosystem).

2. **Idempotency replay correctness.** The tests assert replay doesn't duplicate side effects, but the description doesn't clarify what happens if the `rationale_draft` changed between the original promote and the replay. If the hash differs, this should be treated as a conflict (not a replay). Confirm the idempotency check compares `rationale_hash`, not just `idea_card` content.

3. **Error model completeness.** The existing `-32002 / schema_validation_failed` is reused for "no idea_card". This conflates two failure modes: (a) node has no idea_card at all, (b) node has an idea_card that fails schema validation. Consider sub-reason codes: `reason=idea_card_missing` vs `reason=idea_card_schema_invalid`.

## Specific patch suggestions

### Patch 1: `src/idea_core/engine/service.py` — honest trace mode + hash verification stub

```python
# In _formalize_rationale_to_idea_card(), change:
-    "mode": "explain_then_formalize_v1",
+    "mode": "mechanical_extract_v0",  # TODO(M2.8): replace with LLM-backed formalization

# Add at end of _formalize_rationale_to_idea_card():
+    idea_card["provenance"] = {
+        "rationale_hash": rationale_hash,
+        "formalization_mode": trace["mode"],
+    }

# In node_promote(), before schema gate, add:
+    if idea_card.get("provenance", {}).get("rationale_hash"):
+        current_hash = _hash_rationale(node.rationale_draft)
+        if current_hash != idea_card["provenance"]["rationale_hash"]:
+            raise JsonRpcError(-32002, "schema_validation_failed",
+                               data={"reason": "rationale_draft_mutated_after_formalization",
+                                     "expected_hash": idea_card["provenance"]["rationale_hash"],
+                                     "actual_hash": current_hash})
```

### Patch 2: `tests/engine/test_node_promote.py` — add malformed rationale test

```python
# Add new test:
+def test_node_promote_fails_when_rationale_draft_malformed():
+    """M2.7: formalize helper must reject incomplete rationale_draft."""
+    node = make_node(rationale_draft={"hypothesis": ""})  # empty hypothesis
+    with pytest.raises(JsonRpcError) as exc_info:
+        service.node_promote(node.id)
+    assert exc_info.value.code == -32002
+    assert "rationale_incomplete" in exc_info.value.data["reason"]

+def test_node_promote_fails_when_rationale_mutated_after_formalization():
+    """M2.7: provenance hash must catch post-formalization rationale edits."""
+    node = make_node_with_idea_card()  # formalized normally
+    node.rationale_draft["hypothesis"] = "MODIFIED AFTER FORMALIZATION"
+    with pytest.raises(JsonRpcError) as exc_info:
+        service.node_promote(node.id)
+    assert "rationale_draft_mutated" in exc_info.value.data["reason"]
```

### Patch 3: `src/idea_core/engine/service.py` — formalization_strategy parameter for extensibility

```python
# Change function signature:
-def _formalize_rationale_to_idea_card(rationale_draft: dict) -> dict:
+def _formalize_rationale_to_idea_card(
+    rationale_draft: dict,
+    strategy: str = "hep_mechanical_v0",
+) -> dict:
+    """Formalize a rationale draft into a schema-valid IdeaCard.
+    
+    Args:
+        strategy: Formalization strategy. Currently only 'hep_mechanical_v0'
+                  (deterministic field mapping). Future: 'hep_llm_v1', 'condensed_matter_v1'.
+    """
+    if strategy != "hep_mechanical_v0":
+        raise ValueError(f"Unknown formalization strategy: {strategy}")
```

### Patch 4: `tests/engine/test_node_promote.py` — distinguish error sub-reasons

```python
# In test_node_promote_fails_when_idea_card_missing, tighten assertion:
     assert exc_info.value.code == -32002
-    assert exc_info.value.data["reason"] == "schema_invalid"
+    assert exc_info.value.data["reason"] == "idea_card_missing"
```

This requires a corresponding change in `service.py`'s promote gate to emit `reason=idea_card_missing` when `idea_card is None`, vs `reason=idea_card_schema_invalid` when it exists but fails validation.
