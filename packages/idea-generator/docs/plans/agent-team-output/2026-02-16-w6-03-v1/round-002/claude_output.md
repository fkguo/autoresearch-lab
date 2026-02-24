

I need to review this W6-03 design packet carefully. Let me explore the relevant files before rendering a verdict.

VERDICT: READY

## Blockers

None identified. The deliverables meet the stated DoD checklist: 5/5 extraction cards, ≥5 IN_SCOPE innovation candidates (6 present), OUT_OF_SCOPE closure via `failed_approach_v1.jsonl` with query hook, and all validation gates passing. The packet is sufficient to proceed to the next work unit (mainline selection + derivation/numerics).

## Non-blocking

1. **Extraction card equation indexing is implicit.** The review packet describes extraction cards containing "key equations + assumptions + implementation hooks," but there is no cross-card **equation registry** — a single manifest mapping `(paper, eq_label)` → `(card_file, section, normalization_convention)`. When derivation starts, the implementer will need to reconcile normalizations across papers (e.g., the GTB PSD matrix coupling in 2403.10772 vs. the EMT projection operator $j_T$ in 2505.19332). A lightweight `equation_registry_v1.jsonl` with fields `{paper_id, eq_ref, card_file, convention_tag, normalization_notes}` would save significant back-and-forth.

2. **Opportunity deduplication is soft.** Candidates `e3ef3ee8` ("sharper positivity-kernel inequality") and `cbd2a4b3` ("optimized positive-kernel moment bounds (SDP over kernels)") are closely related — both involve optimizing over kernel functions in the positivity bound. The JSONL pool should carry an explicit `overlaps_with` field (list of opportunity IDs) so the selection step can make an informed trade-off rather than accidentally scheduling both as "independent" islands.

3. **No implementation-difficulty estimate on IN_SCOPE records.** The opportunity pool schema should include a `complexity_tier` field (`{trivial, moderate, hard}`) with a one-line justification. This is critical for next-step readiness: the mainline pick should be the highest-leverage *and* tractable candidate. Without it, the selection step must re-derive complexity from scratch.

4. **Failure-library query hit format is opaque in the packet.** The review mentions `failure_library_hits_v1.json` but does not reproduce its schema. Future agents (or the human researcher) would benefit from a documented contract: `{query_text, matched_ids[], match_reason, timestamp}`.

5. **Scope classification artifact (`scope_classification_v1.json`) lacks a `max_channels` field.** The pion-only constraint is enforced by convention in veto text, not by a machine-checkable field. Adding `"max_channels": 1, "allowed_species": ["pi"]` to the scope schema would let the pipeline auto-reject future coupled-channel opportunities at validation time instead of relying on reviewer discipline.

## Real-research fit

The extraction cards and opportunity pool reflect a realistic and well-scoped HEP phenomenology workflow:

- **Tensor-only $2^{++}$ bounds for $A^\pi(t)$** (opportunity `ae7f921a`) is a genuinely clean pion-only channel that avoids the trace-sector coupled-channel ambiguity — this is the strongest mainline candidate and aligns with the literature gap identified in 2507.05375.
- **Watson-saturation iteration specialized to $j_T$** (opportunity `0674b384`) provides a natural "island" computation that can cross-validate the mainline SDP bound.
- The OUT_OF_SCOPE vetoes (coupled-channel trace sector, non-pion extension, $\pi\pi$ amplitude bootstrap-fit) are physically well-motivated exclusions that correctly reflect the laptop-only, pion-only constraints.
- The `preliminary_constraints` claim level with NOT_FOR_CITATION is appropriately conservative for a pilot campaign.

One physics note: the "inelasticity-agnostic eta-envelope" opportunity (`8bbd28b8`) is valuable precisely because it quantifies the systematic error from ignoring inelastic channels — this should be flagged as a **mandatory companion** to whichever mainline is chosen, not an optional island.

## Robustness & safety

**Provenance:** Each extraction card is tied to a specific arXiv ID; the opportunity pool carries UUIDs and status fields. This is adequate for traceability. However, the JSONL records should include a `source_card_ids` field (list of extraction card filenames that motivated the opportunity) to close the provenance chain from paper → card → opportunity → derivation.

**Hallucination mitigation:** The LaTeX-first extraction discipline (requiring equations/conditions to be copied from the papers) is a strong structural guard. The review packet does not mention whether extraction cards were **cross-checked against the actual PDFs** — if not, a spot-check of 2–3 key equations per card against the arXiv source should be performed before derivation begins.

**Novelty checks:** The failure-library query mechanism provides avoid-repeat closure. The query hook's effectiveness depends on its matching logic (semantic vs. keyword). If keyword-only, semantically similar but differently-worded re-proposals could slip through. Consider adding a `semantic_fingerprint` (3–5 keyword tags) to each failed/vetoed record to improve recall.

**Append-only integrity:** The JSONL pools are described as append-only, which is correct for audit trails. Ensure the validation gate (`make validate-project`) checks that no existing records have been mutated (e.g., by hashing prior records and comparing on each append).

## Specific patch suggestions

1. **File: `idea-runs/projects/pion-gff-bootstrap-positivity-pilot-2026-02-15/artifacts/opportunities/bootstrap_opportunity_pool_v1.jsonl`**
   - **Change:** Add `"overlaps_with": []` field to each record. For `e3ef3ee8`, set `"overlaps_with": ["cbd2a4b3"]` and vice versa. Add `"complexity_tier": "moderate"` (or appropriate value) and `"source_card_ids": ["2403.10772-extraction-card.md", ...]` to every record.

2. **File: `idea-runs/projects/pion-gff-bootstrap-positivity-pilot-2026-02-15/artifacts/scope/scope_classification_v1.json`**
   - **Change:** Add machine-checkable scope fields:
     ```json
     "max_channels": 1,
     "allowed_species": ["pi"],
     "coupled_channel_allowed": false
     ```

3. **File: `idea-runs/projects/pion-gff-bootstrap-positivity-pilot-2026-02-15/literature/extracts/` (new file: `equation_registry_v1.jsonl`)**
   - **Change:** Create a cross-card equation registry. Each line:
     ```json
     {"paper_id": "2403.10772", "eq_ref": "Eq.(2.3)", "card_file": "2403.10772-extraction-card.md", "card_section": "PSD matrix coupling", "convention_tag": "GTB_norm_v1", "normalization_notes": "F(t) normalized as in [GTB Eq.2.3]; factor of 2 vs Ref.[X]"}
     ```

4. **File: `idea-runs/projects/pion-gff-bootstrap-positivity-pilot-2026-02-15/artifacts/ideas/failed_approach_v1.jsonl`**
   - **Change:** Add `"semantic_tags": ["coupled-channel", "trace-sector", "K-matrix"]` (or similar) to each veto record to improve failure-library recall beyond keyword matching.

5. **File: `idea-runs/projects/pion-gff-bootstrap-positivity-pilot-2026-02-15/pipeline/failure_library_query_v1.json`**
   - **Change:** Document the output schema in a sibling file `failure_library_query_output_schema_v1.json`:
     ```json
     {"type": "object", "properties": {"query_text": {"type": "string"}, "matched_ids": {"type": "array", "items": {"type": "string"}}, "match_reason": {"type": "string"}, "timestamp": {"type": "string", "format": "date-time"}}, "required": ["query_text", "matched_ids", "timestamp"]}
     ```

6. **File: Validation Makefile (wherever `make validate-project` is defined)**
   - **Change:** Add an append-only integrity check for JSONL artifacts: compute SHA-256 of all-but-last-N-lines and compare against a stored checksum file (`.jsonl.checksum`), failing if prior records were mutated.

7. **File: `idea-runs/projects/pion-gff-bootstrap-positivity-pilot-2026-02-15/artifacts/opportunities/bootstrap_opportunity_pool_v1.jsonl` — record `8bbd28b8`**
   - **Change:** Add `"selection_constraint": "mandatory_companion"` to flag the inelasticity-agnostic eta-envelope as required alongside any mainline pick, not a standalone island.
