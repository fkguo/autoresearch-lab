VERDICT: READY

## Blockers
- None.

## Non-blocking
- **Tag vocabulary management.** As tags are free-form strings, there is a risk of vocabulary drift (e.g., `method:bootstrap` vs `bootstrap-method`). Consider providing a recommended taxonomy in documentation to improve retrieval consistency across projects.
- **Redundancy in failure classification.** The schema requires both a single `failure_mode` (string) and a `failure_modes` array. While this supports both simple and multi-label indexing, ensure documentation clarifies that `failure_mode` should be a member of the `failure_modes` array to maintain consistency.
- **Match transparency in hits.** The `failure_library_hits_v1.schema.json` lists matching records but does not specify which query criteria (tags, text, or modes) triggered the hit. Adding a `matched_on` field per hit would improve auditability.
- **URI reachability.** `failure_evidence_uris` are validated for format (`uri`) but not for reachability. This is acceptable for the schema level but should be considered for a future linting step in the toolchain.

## Real-research fit
- **Evidence-first grounding.** Mandatory evidence URIs for failure records mirror the high standards of actual HEP research, ensuring negative results are as rigorous and verifiable as positive ones.
- **High-leverage "dead end" avoidance.** The executable query hook provides immediate utility for research teams by preventing the re-exploration of failed approach families, addressing a common inefficiency in collaborative theory work.
- **Domain-agnostic structure.** The schema's reliance on generic tags and modes allows it to scale from pion GFFs to BSM model building or lattice QCD without any modifications to the core toolchain.

## Robustness & safety
- **Strict schema enforcement.** The requirement for non-empty `tags` and `failure_evidence_uris` (enforced via `minItems: 1`) prevents the creation of "orphaned" or ungrounded failure records that would otherwise degrade the library's utility.
- **Fail-fast gate logic.** By enforcing that a hits artifact must exist if a query config is present (as documented in the project validation scripts), the toolchain ensures the negative-results check cannot be silently bypassed.
- **Traceable provenance.** Each hit record in the library includes project and artifact location metadata, enabling full traceability back to the original failure context and ensuring results are not "hallucinated" by the aggregator.

## Specific patch suggestions
- **Add `schema_version` to `failed_approach_v1.schema.json`.** Including a constant `schema_version: "1"` property as a required field in the record schema would allow for automated version detection and forward-compatible validation.
- **Add optional `upstream_idea_id`.** Adding an optional `idea_id` field to link a failure record back to the specific idea-generator output that spawned the attempt would complete the provenance chain from generation to failure.
