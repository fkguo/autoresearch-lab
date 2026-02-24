VERDICT: NOT_READY

## Blockers
- `schemas/failed_approach_v1.schema.json` fails to enforce the "must include evidence refs and reusable retrieval keys" requirement:
  - `tags` is not in the `required` list, despite being defined as the primary "reusable retrieval keys" and being mandatory in the `failure_library_query_v1` schema.
  - `failure_evidence_uris` is required but lacks `minItems: 1`, permitting empty arrays that satisfy the schema but violate the hard requirement to include evidence.
- There is a functional mismatch between the record schema (where `tags` is optional) and the query schema (where `tags` is mandatory with `minItems: 1`). This allows the creation of failure records that are structurally unretrievable by the executable query hook.

## Non-blocking
- `failure_modes` (array) in `failed_approach_v1.schema.json` is optional; it should ideally be required or synchronized with the mandatory `failure_mode` string to ensure multi-label retrieval consistency.
- The "key:value" tag convention is documented in descriptions but lacks regex enforcement; while keeping the toolchain generic is a priority, this relies heavily on manual agent discipline.

## Real-research fit
- The inclusion of `lessons` and `reuse_potential` in the failure records correctly captures the intellectual value of negative results, facilitating actual research acceleration rather than just error logging.
- The aggregated index approach (`failure_library_index_v1`) is well-suited for a monorepo, allowing new projects to benefit from the "dead ends" encountered by previous campaigns.

## Robustness & safety
- The gate-enforcement logic (configured in `idea-runs` via `validate_project_artifacts.py`) correctly treats the "avoid pitfalls" check as a hard gate: if a query is configured, the hits must be generated and validated.
- Use of `uniqueItems: true` and `minLength: 1` across all retrieval keys (tags, failure_modes) prevents index pollution and ensures query integrity.

## Specific patch suggestions
- In `schemas/failed_approach_v1.schema.json`:
  - Add `tags` and `failure_modes` to the `required` list.
  - Add `"minItems": 1` to `failure_evidence_uris`, `tags`, and `failure_modes`.
  - Update the description of `failure_modes` to clarify that it must contain at least the primary `failure_mode`.
- In `schemas/failure_library_query_v1.schema.json`:
  - Ensure `output_artifact_path` validation in the toolchain is strictly enforced as a relative path under `artifacts/` to maintain project portability.
