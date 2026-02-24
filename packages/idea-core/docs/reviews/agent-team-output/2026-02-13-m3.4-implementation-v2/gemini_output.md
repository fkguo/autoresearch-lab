VERDICT: READY

## Blockers
None.

## Non-blocking
1. **Hardcoded heuristics:** The similarity thresholds (`0.92`, `0.72`) and keyword lists in `_infer_non_novelty_flags` are hardcoded. This is acceptable for M3.4 as a baseline, but should be moved to `EvaluatorConfig` in M4+ for tunability.
2. **Simplified prior selection:** `_find_closest_prior` currently scans all nodes in the campaign (excluding self/descendants). As node count grows, this `O(N)` scan per eval will become a bottleneck. M4+ should use `DomainPackIndex` or vector search.
3. **Internal URN usage:** `urn:idea-core:novelty-prior-unavailable:{node_id}` is a good placeholder, but downstream consumers (e.g., UI) might need to handle this explicitly to avoid broken link rendering.

## Real-research fit
- **Novelty discipline:** The introduction of `novelty_delta_table` with `non_novelty_flags` directly addresses the "superficial novelty" problem common in LLM-generated ideas.
- **Explicit falsifiability:** `delta_statement` and `verification_hook` force the system to articulate *how* the novelty is measured, which is crucial for scientific rigor.
- **Duplicate detection:** The `equivalent_reformulation` flag provides an automated way to prune redundant branches, saving compute budget.

## Robustness & safety
- **Validation:** Runtime validation against `idea_scorecards_v1.schema.json` ensures downstream consumers receive structurally valid novelty data.
- **Fallbacks:** `_sanitize_text` and `_sanitize_evidence_uris` prevent crashes on malformed inputs.
- **Deterministic:** Deterministic hashing for `rationale_hash` and strict sorting in `_find_closest_prior` ensure reproducibility of evaluation runs.

## Specific patch suggestions
None required for M3.4 acceptance. Future work (M4+):
- Parameterize similarity thresholds in `EvaluatorConfig`.
- Optimize `_find_closest_prior` using an index.
- Add `citation_overlap` metric to `non_novelty_flags` logic.
