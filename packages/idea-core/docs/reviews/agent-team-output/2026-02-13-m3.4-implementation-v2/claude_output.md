

I need to review this design packet carefully. Let me first check if any skills apply.

VERDICT: READY

## Blockers

None. All three v1 blockers (B1, B2, B3) are credibly closed:

- **B1 (schema validation):** `validate_against_ref` against the SSOT schema transitively covers `novelty_delta_table` through the `$ref` chain (`idea_scorecards_v1 → novelty_delta_table_v1`). This is the correct structural guarantee—runtime payloads that lack or malform `novelty_delta_table` will raise before reaching callers.

- **B2 (heuristic visibility/testing):** `_find_closest_prior` and `_infer_non_novelty_flags` are now `@classmethod` helpers with direct unit tests exercising threshold boundaries (0.72, 0.92) and flag semantics. The threshold tests pin the exact boundary values, which is exactly what's needed for regression safety.

- **B3 (fake URI fallback):** The `urn:idea-core:novelty-prior-unavailable:{node_id}` pattern is correct—it's a proper URN under an internal namespace, machine-parseable, and carries the node identity for traceability. The test asserts the exact string.

## Non-blocking

1. **Threshold magic numbers should be named constants.** `0.92` and `0.72` appear as literals in both production code and tests. Extract to module-level constants (e.g., `EQUIV_REFORMULATION_THRESHOLD = 0.92`, `PARAM_TUNING_THRESHOLD = 0.72`) and import them in the test file. This prevents silent drift if one site is edited but not the other.

2. **`_text_similarity` implementation not shown.** The review bundle doesn't include its source. If it's a naïve token-overlap metric (Jaccard, etc.), the 0.72/0.92 thresholds are only meaningful for that specific metric. Add a one-line docstring on `_text_similarity` documenting the metric family so future maintainers know threshold recalibration is needed if the metric changes. Consider a `SIMILARITY_METRIC_VERSION` constant stamped into the `novelty_delta_table` rows themselves for provenance.

3. **`_contains_any` keyword list is HEP-biased but hard-coded.** The `predictive_keywords` tuple is reasonable for HEP but will need extension for broader theoretical physics (e.g., condensed-matter observables like "susceptibility", "conductance"). Make it a class attribute or config-driven parameter now to avoid a rewrite later.

4. **Evidence-URI subset check is asymmetric only.** `current_uris.issubset(prior_uris)` catches "reuses same evidence" but not "adds one trivially related ref." Consider logging a warning (not a flag—no false positives) when `len(current_uris - prior_uris) == 1` to aid human reviewers. Low priority.

5. **`candidate_ids` ordering.** `sorted(nodes.keys())` gives deterministic iteration but is sensitive to node-ID naming schemes. This is fine for now but document that "closest prior" selection is stable only under consistent ID generation.

6. **Test coverage gap: empty-graph edge case.** What happens when `nodes` contains only the target node (no candidates at all)? `best_node` stays `None`, `best_similarity` stays `-1.0` → clamped to `0.0`. The URN fallback handles the URI side, but confirm `_infer_non_novelty_flags` with `prior_node=None` and `claim_similarity=0.0` doesn't produce unexpected flags. A one-liner test would close this.

## Real-research fit

The design is well-calibrated for HEP idea triage:

- **`equivalent_reformulation` at ≥0.92** catches the common failure mode where an LLM rephrases the same BSM scenario with different notation. This is the single most important novelty filter in agent-generated idea graphs.
- **`parameter_tuning_only` at ≥0.72** catches "same mechanism, different mass window" scenarios that dominate LHC phenomenology brainstorming.
- **`no_new_prediction`** is a genuinely useful flag—ideas without testable predictions are the primary source of wasted compute in downstream evaluation chains.
- **`known_components_no_testable_delta`** via evidence-URI subset is a clean proxy for "nothing new was consulted." In a real pipeline where evidence URIs point to arXiv or InspireHEP records, this becomes very powerful.

The `novelty_delta_table` structure (per-node, with closest-prior reference and explicit flags) maps naturally to the kind of "novelty matrix" that a human physicist would construct when triaging a batch of related BSM proposals.

## Robustness & safety

- **Hallucination mitigation:** Schema validation at the `eval.run` boundary is the correct chokepoint. Any downstream consumer (ranking, export, human review) can trust that `novelty_delta_table` conforms to the SSOT schema without re-validating.
- **Provenance:** The internal URN for missing priors is strictly better than a placeholder URL—it cannot be confused with a real reference, and it encodes the node identity for audit trails.
- **Flag determinism:** All flags are computed from deterministic string operations (similarity metric + keyword scan + set comparison). No LLM calls in the flag-generation path. This is critical—novelty assessment must not itself be subject to hallucination.
- **Fail-open vs. fail-closed:** The current design is mildly fail-open: if `_text_similarity` returns unexpected values (e.g., NaN from a future metric change), no flags would fire. Consider adding a guard: if `claim_similarity` is not in `[0.0, 1.0]`, raise or flag `"novelty_assessment_error"`.

## Specific patch suggestions

### 1. `src/idea_core/engine/service.py` — Extract threshold constants

**Location:** Top of file or class-level constants.

```python
# Add near top of module or as class attributes:
EQUIV_REFORMULATION_THRESHOLD: float = 0.92
PARAM_TUNING_THRESHOLD: float = 0.72

# In _infer_non_novelty_flags, replace:
-        if claim_similarity >= 0.92:
+        if claim_similarity >= cls.EQUIV_REFORMULATION_THRESHOLD:
             flags.append("equivalent_reformulation")
-        elif claim_similarity >= 0.72:
+        elif claim_similarity >= cls.PARAM_TUNING_THRESHOLD:
             flags.append("parameter_tuning_only")
```

### 2. `tests/engine/test_novelty_delta_m34.py` — Import thresholds, add edge case

```python
# Replace hardcoded thresholds:
-    high_similarity_flags = service._infer_non_novelty_flags(..., claim_similarity=0.95)
+    from idea_core.engine.service import EQUIV_REFORMULATION_THRESHOLD, PARAM_TUNING_THRESHOLD
+    high_similarity_flags = service._infer_non_novelty_flags(
+        ..., claim_similarity=EQUIV_REFORMULATION_THRESHOLD + 0.03
+    )

# Add empty-graph edge case:
+def test_novelty_delta_table_single_node_graph(tmp_path: Path) -> None:
+    """When the graph has only one node, prior is None and URN fallback is used."""
+    # ... setup with nodes={"node-1": single_node}
+    # assert prior_node is None
+    # assert "urn:idea-core:novelty-prior-unavailable:node-1" in uris
+    # assert flags from _infer_non_novelty_flags(prior_node=None, claim_similarity=0.0)
+    #   do not include "equivalent_reformulation" or "parameter_tuning_only"
```

### 3. `src/idea_core/engine/service.py` — Guard on similarity range

**Location:** Top of `_infer_non_novelty_flags`.

```python
+        if not (0.0 <= claim_similarity <= 1.0):
+            flags.append("novelty_assessment_error")
+            return flags
```

### 4. `src/idea_core/engine/service.py` — Make predictive keywords configurable

```python
# Replace inline tuple with class attribute:
+    PREDICTIVE_KEYWORDS: ClassVar[tuple[str, ...]] = (
+        "predict", "observable", "testable", "signature",
+        "scaling", "shift", "transition", "constraint",
+    )

# In _infer_non_novelty_flags:
-        predictive_keywords = (
-            "predict", "observable", "testable", "signature",
-            "scaling", "shift", "transition", "constraint",
-        )
-        if not cls._contains_any(current_claim, predictive_keywords):
+        if not cls._contains_any(current_claim, cls.PREDICTIVE_KEYWORDS):
             flags.append("no_new_prediction")
```

This allows subclasses or config injection to extend the keyword set for non-HEP domains without modifying the core logic.

### 5. `docs/reviews/bundles/2026-02-13-m3.4-novelty-failure-repro-v1.txt` — No changes needed

Evidence chain (RED → GREEN → POST-REVIEW GREEN) is clean and sufficient for M3.4 gate.

---

**Summary:** M3.4 acceptance criteria are met. The v1 blockers are credibly closed with correct architectural choices (SSOT schema validation, deterministic heuristics, proper URN fallback). The non-blocking suggestions are quality-of-life improvements that reduce future maintenance risk but do not gate this milestone.
