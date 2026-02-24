VERDICT: READY

## Blockers
None.

## Non-blocking
- **Template scoring**: Relevance scores (e.g., `0.92`, `0.88`) are currently hardcoded in `build_default_librarian_recipe_book`. While appropriate for M3.3 templating, future iterations (M4+) should likely derive these from actual retrieval similarity scores or rank positions.
- **Text compaction**: `_compact_text` uses `split()`/`join()` which normalizes whitespace aggressively. This is generally good for search queries but might strip semantic formatting from `claim_text` if LaTeX or structured text is ever used there.

## Real-research fit
- **Taxonomy alignment**: The mapped recipes (`inspire.anomaly_abduction.v1`, `pdg.symmetry_baselines.v1`, etc.) align perfectly with the M3.2 operator families (`AnomalyAbduction`, `SymmetryOperator`, `LimitExplorer`).
- **Audit trail**: The flow of `evidence_packet_ref` into both `operator_events` and `idea_card.claims[].evidence_uris` ensures that every generated idea can be traced back to the specific search templates and simulated hits that justified it.

## Robustness & safety
- **Graceful fallback**: `LibrarianRecipeBook._templates_for_family` correctly falls back to `default_templates` for unknown operator families, preventing crashes on extension families.
- **URI Encoding**: `_provider_landing_uri` correctly uses `quote_plus`, ensuring generated links are valid even with complex query strings.

## Specific patch suggestions
- **Search syntax safety**: In `src/idea_core/engine/retrieval.py`, `fields` injected into `query_template` (like `{claim_text}`) are not escaped for the search provider's syntax. If a claim contains a double quote (`"`), it might break the `fulltext:"..."` clause in the INSPIRE template.
    - *Suggestion*: Add a `_sanitize_for_query` helper that escapes quotes or strips forbidden characters before `template.format(**fields)`.
