

I need to review this design packet carefully. Let me first check if any skills apply to this task.

VERDICT: NOT_READY

## Blockers

### B1. `novelty_delta_table` schema is not formally defined anywhere

The review bundle shows a de facto schema for `novelty_delta_table` rows (with keys `closest_prior_uris`, `delta_types`, `delta_statement`, `non_novelty_flags`, `verification_hook`), but there is **no JSON Schema, TypedDict, dataclass, or Pydantic model** governing this structure. The test validates it with ad-hoc `isinstance` checks. This means:

- Downstream consumers (approval gates, research-writer, hepar orchestrator) cannot validate artifacts at ingest.
- Any future field rename or addition is a silent, undetectable contract break.
- The OpenRPC service description (out-of-scope per the bundle, but the *return type* of `eval.run` has changed) is now silently stale.

**Required fix:** Add a concrete schema object (e.g., `NoveltyDeltaRow` TypedDict or Pydantic model in `src/idea_core/engine/schemas.py` or equivalent) and use it in both production code and test assertions. This is a blocker because without it, artifact-contract discipline—the core safety property of the ecosystem—is broken for this milestone.

### B2. `_find_closest_prior` and `_infer_non_novelty_flags` are not shown and not tested in isolation

The entire novelty-discrimination logic lives in two private helpers (`_find_closest_prior`, `_infer_non_novelty_flags`) whose implementations are not included in the review bundle. The acceptance tests only exercise them indirectly through `eval.run`. This is a blocker because:

- We cannot assess whether `claim_similarity` is a cosine similarity, Jaccard, exact string match, or something else. If it is string-equality based, the heuristic flags (`equivalent_reformulation`, `parameter_tuning_only`) are nearly useless for real research claims. If it is embedding-based, there is an undeclared model dependency.
- There are no unit tests for edge cases: empty nodes, missing `idea_card`, nodes with no claims, `claim_similarity` boundary values.
- The flag vocabulary (`equivalent_reformulation`, `parameter_tuning_only`, `known_components_no_testable_delta`, `no_new_prediction`) is mentioned in the acceptance mapping but never asserted individually in tests—`test_eval_run_flags_non_novel_duplicate_seed_claims` only checks `observed_flags` is non-empty, not *which* flags fire or *why*.

**Required fix:** (a) Include the source of `_find_closest_prior` and `_infer_non_novelty_flags` in the review scope. (b) Add unit tests for each flag individually, with known-input/known-output pairs. (c) Document the similarity metric and its threshold.

### B3. Hardcoded placeholder URI `"https://example.org/reference"` shipped as fallback

```python
if not closest_prior_uris:
    closest_prior_uris = ["https://example.org/reference"]
```

This is a provenance-poisoning vector. A downstream consumer (e.g., `research-writer`, `hepar` approval gate) that trusts `closest_prior_uris` as real evidence will silently incorporate a dummy URI. In an evidence-first system, **no evidence is better than fake evidence**. This must either:

- Emit an empty list and set a `non_novelty_flag` like `"no_prior_evidence_available"`, or
- Raise / mark the scorecard as `"status": "incomplete"`.

## Non-blocking

### N1. `observable-1` is a hardcoded placeholder string in delta statements

Both `delta_statement` templates reference `"observable-1"` literally. This is understandable for a scaffold, but should be tracked as tech-debt for M3.5: the statement should reference the actual observable from the node's `idea_card.claims[].observable` (or equivalent field). Add a `# TODO(M3.5)` comment and a tracking issue.

### N2. Single-row `novelty_delta_table` — design does not motivate the list wrapper

`_build_novelty_delta_table` always returns a single-element list. If multi-row is planned (e.g., per-claim deltas), document the intended cardinality in the schema. If not, consider returning a single dict and wrapping at the scorecard level, to avoid ambiguous semantics for consumers that `.pop(0)` vs iterate.

### N3. `copy.deepcopy` is applied three times per scorecard

`fix_suggestions`, `failure_modes`, and `novelty_delta_table` are all deep-copied before insertion into the scorecard dict. Since these are freshly constructed local lists of plain dicts/strings with no shared references, `deepcopy` is unnecessary overhead. Replace with shallow copies or direct assignment. Non-blocking, but it signals defensive coding without clear threat model.

### N4. `_sanitize_text` is called but its contract is not specified

Is it HTML-escaping? Truncating? Stripping newlines? If it strips meaningful content (e.g., LaTeX operators like `\hat{O}_{ij}`), that could silently corrupt HEP-relevant identifiers. Document its contract.

### N5. Test `test_eval_run_flags_non_novel_duplicate_seed_claims` should assert specific flags

Currently:
```python
assert observed_flags  # just "non-empty"
```

Strengthen to:
```python
assert observed_flags & {"equivalent_reformulation", "parameter_tuning_only"}
```
This verifies the *semantics* of the duplicate-detection heuristic, not just that it fires.

## Real-research fit

### Strengths

- The `novelty_delta_table` structure is well-motivated: HEP research ideas frequently suffer from "reformulation-as-novelty" (e.g., re-parameterizing a known BSM benchmark as a "new" scenario). Explicit `non_novelty_flags` with categories like `parameter_tuning_only` directly address a real failure mode in automated idea generation.
- The `verification_hook` field ("run X and compare observable against baseline") maps cleanly to the `hep-calc` pipeline: a downstream agent can parse this and dispatch a FeynCalc/FormCalc comparison run.
- Tying novelty evaluation to `closest_prior_uris` creates an auditable evidence chain.

### Gaps

- **No physics-aware similarity.** Real HEP novelty requires comparing *physics content* (e.g., "Is this the same effective operator in a different basis?" or "Is this the same loop correction at a different scale?"). The current heuristic-only approach (string/claim similarity) will produce both false positives (flagging genuinely novel ideas that use similar language) and false negatives (missing reformulations that use different terminology). This is acceptable for M3.4 as a scaffold, but the architecture must leave a clean seam for a physics-aware comparator (e.g., FeynRules model equivalence check). The current private-method design (`_find_closest_prior`) does leave this seam, but it should be documented as an explicit extension point.
- **No connection to the PDG or known-result databases.** A `non_novelty_flag` like `known_components_no_testable_delta` is only meaningful if compared against actual known results. Currently it's heuristic-only.

## Robustness & safety

| Concern | Severity | Detail |
|---------|----------|--------|
| Provenance poisoning via placeholder URI | **High** | See Blocker B3. Fake URIs in `closest_prior_uris` undermine the entire evidence-first contract. |
| Unbounded `_find_closest_prior` scan | **Medium** | If `nodes` is large (hundreds of ideas), pairwise comparison without indexing could be slow. Not a correctness issue, but a scalability concern. Add a comment or config for max comparisons. |
| No hallucination guard on `delta_statement` | **Medium** | The `delta_statement` is template-generated (good—no LLM involved), but the `operator_id` is user-supplied and injected unsanitized into the string. `_sanitize_text` is called, but its contract is unspecified (N4). If `operator_id` contains adversarial content, the delta statement becomes misleading. |
| `claim_similarity` threshold undocumented | **Medium** | See B2. Without knowing the threshold, we cannot assess false-positive/false-negative rates for non-novelty flagging. |
| Missing `idea_card` graceful degradation | **Low** | `node.get("idea_card", {})` handles missing cards, but `compute_plan[0]` indexing after a truthiness check on the list is safe. Acceptable. |

## Specific patch suggestions

### Patch 1: `src/idea_core/engine/schemas.py` (NEW FILE)

Create a formal schema for the novelty delta row. Minimal version:

```python
# src/idea_core/engine/schemas.py
from __future__ import annotations
from typing import TypedDict

class NoveltyDeltaRow(TypedDict):
    closest_prior_uris: list[str]  # Must be real evidence URIs; empty list if none found.
    delta_types: list[str]         # e.g., ["new_observable", "new_mechanism", "new_regime"]
    delta_statement: str           # Human-readable testable-delta claim.
    non_novelty_flags: list[str]   # Empty if novel; populated from KNOWN_NON_NOVELTY_FLAGS.
    verification_hook: str         # Actionable computation instruction.

KNOWN_NON_NOVELTY_FLAGS: frozenset[str] = frozenset({
    "equivalent_reformulation",
    "parameter_tuning_only",
    "known_components_no_testable_delta",
    "no_new_prediction",
    "no_prior_evidence_available",  # NEW: replaces placeholder URI fallback
})
```

### Patch 2: `src/idea_core/engine/service.py` — Remove placeholder URI

Replace:
```python
if not closest_prior_uris:
    closest_prior_uris = ["https://example.org/reference"]
```
With:
```python
if not closest_prior_uris:
    closest_prior_uris = []
    non_novelty_flags_extra = ["no_prior_evidence_available"]
```
Then merge `non_novelty_flags_extra` into the flags downstream. This eliminates the provenance-poisoning vector.

### Patch 3: `src/idea_core/engine/service.py` — Type-annotate return with schema

Change:
```python
) -> list[dict[str, Any]]:
```
To:
```python
) -> list[NoveltyDeltaRow]:
```
And import `NoveltyDeltaRow` from `schemas.py`. This makes the contract machine-checkable with `mypy`.

### Patch 4: `tests/engine/test_novelty_delta_m34.py` — Strengthen flag assertion

In `test_eval_run_flags_non_novel_duplicate_seed_claims`, replace:
```python
assert observed_flags
```
With:
```python
from idea_core.engine.schemas import KNOWN_NON_NOVELTY_FLAGS
assert observed_flags, "Duplicate seed claims must trigger at least one non-novelty flag"
assert observed_flags <= KNOWN_NON_NOVELTY_FLAGS, (
    f"Unknown non-novelty flags emitted: {observed_flags - KNOWN_NON_NOVELTY_FLAGS}"
)
assert observed_flags & {"equivalent_reformulation", "parameter_tuning_only"}, (
    "Duplicate seeds should trigger reformulation or parameter-tuning flags"
)
```

### Patch 5: `tests/engine/test_novelty_delta_m34.py` — Add isolated unit tests for helpers

Add a new test class or test functions:
```python
def test_find_closest_prior_returns_none_for_single_node(tmp_path: Path) -> None:
    """With only one node in the graph, no prior exists."""
    ...

def test_infer_non_novelty_flags_empty_for_dissimilar_claims() -> None:
    """Nodes with clearly different claims should produce no flags."""
    ...

def test_infer_non_novelty_flags_fires_for_identical_claims() -> None:
    """Nodes with identical claim text should flag equivalent_reformulation."""
    ...

def test_build_novelty_delta_table_no_placeholder_uri() -> None:
    """Even with no evidence URIs, the table must NOT contain example.org."""
    ...
```

### Patch 6: `src/idea_core/engine/service.py` — Document extension seam

Add a docstring to `_find_closest_prior`:
```python
@classmethod
def _find_closest_prior(cls, *, node_id, node, nodes):
    """Find the most similar prior node by claim text.

    Current implementation: heuristic string similarity.
    Extension point (M3.5+): replace with physics-aware comparator
    (e.g., FeynRules operator-basis equivalence, embedding cosine similarity).

    Returns:
        Tuple of (prior_node_dict | None, similarity_score: float).
        similarity_score ∈ [0, 1]; threshold for "too similar" is CLASS_ATTR.
    """
```

### Patch 7: `docs/reviews/bundles/2026-02-13-m3.4-novelty-failure-repro-v1.txt` — No change needed

The TDD red-green evidence is clean and well-structured. No patch required.
