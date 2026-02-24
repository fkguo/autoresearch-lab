

I need to review this design packet carefully. Let me first check if any skills apply.

VERDICT: READY

## Blockers

None. The Phase A engineering pre-flight packet meets all stated DoD criteria:

1. **All five verification commands report PASS** with persisted evidence bundles.
2. **Board ↔ tracker sync** is evidenced by both JSON snapshots (board state) and the tracker markdown update log entry.
3. **Failure library hook** produces both the aggregated index and project-local hits artifact, and `validate-project` passes after the hook run.
4. **Scope discipline** is maintained — no physics-result language appears in the artifacts or the review packet itself.

## Non-blocking

1. **Evidence bundle naming convention drift**: The board snapshots use a mix of suffixes (`-v1.json`, `-v2.json`, `-v2.txt`) without a manifest explaining which is superseded vs. complementary. Consider adding a `bundle-manifest.yaml` under `docs/reviews/bundles/` that lists each file, its purpose, and whether it supersedes a prior version. This prevents future auditors from needing to infer lineage.

2. **Absolute paths in Evidence Paths section**: The failure library index and project hits artifact are listed with absolute `/Users/fkg/...` paths. These should be repo-relative (e.g., `evidence/failure_library_index_v1.json`) so the review packet remains portable across machines and CI environments.

3. **Failure library index schema version pinning**: The file is named `failure_library_index_v1.json` — confirm that the schema version is declared *inside* the JSON (e.g., a top-level `"schema_version": "1.0"` field), not only in the filename. This matters for forward compatibility when v2 schema changes arrive.

4. **Idempotency of `build-failure-library-index`**: The packet doesn't state whether re-running the index build target is idempotent (same input → identical output bytes). If the index includes timestamps or ordering that varies across runs, downstream diffing in CI will produce false positives. Recommend adding a `--deterministic` flag or documenting the canonical sort order.

5. **W6-02 / W6-03 tracker rows added but no board cards yet**: The tracker appends rows for W6-02 and W6-03, but the board snapshots only show a card created for W6-01. This is fine for Phase A scope, but flag it as a task for Phase B pre-flight to avoid tracker↔board skew accumulating.

## Real-research fit

The phase-A design is well-suited for HEP bootstrap campaigns:

- **Failure library as institutional memory**: Aggregating past failure modes before launching a new positivity-constraint pilot is exactly the right workflow — pion GFF bootstrap calculations are notorious for subtle positivity violations that look like numerical noise. Having a queryable failure index prevents re-discovering the same dead ends.
- **Separation of engineering pre-flight from physics phases**: This is critical for auditability. Phase A produces zero physics claims, which means the provenance chain for any eventual result starts clean.
- **Extensibility to other GFF channels**: The `projects/` directory structure and `validate-project` target are channel-agnostic. Extending to kaon or nucleon GFFs requires only a new project directory and (potentially) new failure library tags, not architectural changes.

## Robustness & safety

1. **Hallucination mitigation**: Phase A is purely mechanical (sync, validate, hook run), so hallucination risk is minimal. The evidence-bundle approach (persisting raw CLI output) is the correct mitigation — any future dispute about pass/fail can be resolved by inspecting the bundle.
2. **Provenance**: Board snapshots are raw JSON from the GitHub Project API, which is the strongest provenance available short of signed commits. The tracker markdown update log entry provides a human-readable audit trail.
3. **NOT_FOR_CITATION discipline**: Confirmed — no artifact in the packet contains language that could be mistaken for a physics result or preliminary finding.
4. **Schema validation gap**: The packet states `validate-project` passes but doesn't specify *which* schema the failure library artifacts are validated against. If the schema is defined in a Makefile target, that's acceptable but should be documented in the review packet for completeness.

## Specific patch suggestions

1. **`docs/plans/2026-02-12-implementation-plan-tracker.md`** — In the Update Log entry for 2026-02-16, add W6-02/W6-03 board card creation as an explicit TODO:
   ```markdown
   - [ ] TODO(Phase B pre-flight): Create board cards for W6-02, W6-03 and sync statuses
   ```

2. **Review packet (this document), Evidence Paths section** — Replace absolute paths with repo-relative paths:
   ```markdown
   - Failure library index: `evidence/failure_library_index_v1.json`  (idea-runs repo)
   - Project hits artifact: `projects/pion-gff-bootstrap-positivity-pilot-2026-02-15/artifacts/failure_library/failure_library_hits_v1.json`  (idea-runs repo)
   ```

3. **`idea-runs/evidence/failure_library_index_v1.json`** — If not already present, add a top-level schema version field:
   ```json
   {
     "schema_version": "1.0",
     "generated_at": "2026-02-16T...",
     ...
   }
   ```

4. **`idea-runs/Makefile`** (or equivalent build target) — Add a comment documenting idempotency expectations for `build-failure-library-index`:
   ```makefile
   # NOTE: Output is sorted by (project, failure_id) for deterministic diffing.
   # Timestamps in the index header may vary across runs.
   build-failure-library-index:
   	...
   ```

5. **`docs/reviews/bundles/`** — Add a lightweight manifest (new file `docs/reviews/bundles/2026-02-16-manifest.yaml`):
   ```yaml
   date: 2026-02-16
   phase: W6-01-A
   files:
     - name: 2026-02-16-board-item-list-v1.json
       purpose: initial board item snapshot
       superseded_by: 2026-02-16-board-item-list-v2.json
     - name: 2026-02-16-board-item-list-v2.json
       purpose: board item snapshot after W6-01 card creation
     - name: 2026-02-16-w6-01-idea-runs-validate-project-v2.txt
       purpose: project validation after failure library hook (supersedes v1 if any)
       note: v1 was not persisted; v2 is the first successful run
   ```
