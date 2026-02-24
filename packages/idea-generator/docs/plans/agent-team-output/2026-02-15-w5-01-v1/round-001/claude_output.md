VERDICT: READY

## Blockers

No blockers identified. The W5-01 deliverables satisfy the stated DoD:

1. **Decoupled pilot exists** under a properly slugged path in `idea-runs/projects/`.
2. **A0.1 charter and A0.2 promotion smoke** are present with JSON schemas and a validator script (`validate_project_artifacts.py`), making them machine-checkable.
3. **Scope discipline** is enforced (`ecosystem_validation` classification + `NOT_FOR_CITATION` in the human report).
4. **Replayable evidence** is persisted: toolchain manifest lock, evidence index, and validation output bundles.
5. **No cross-contamination**: `idea-generator` changes are limited to tracker updates and evidence bundles — no pilot-instance content leaked.

## Non-blocking

1. **Absolute path in evidence index**: The review packet itself references `/Users/fkg/Coding/Agents/Autoresearch/idea-runs/projects/...` as the pilot evidence index path. While the packet notes "confirm pilot docs avoid absolute-path dependence," the review packet is the one containing the absolute path. Verify that `evidence/index.md` and `manifest.lock.json` inside the pilot project use only relative paths. If the absolute path appears only in this review submission (not in committed artifacts), this is fine.

2. **Schema snapshot versioning**: The schemas are added as snapshots (`schemas/campaign_charter_v1.schema.json`, etc.) directly into `idea-runs/`. This is correct for reproducibility, but there is no mechanism documented for detecting schema drift if the canonical schemas evolve in `idea-generator`. Consider adding a `schema_source_commit` field to each snapshot or to the manifest lock so future validators can flag staleness.

3. **Validator coverage depth**: `validate_project_artifacts.py` validates JSON schema conformance and `NOT_FOR_CITATION` presence. It should also validate:
   - That `promotion_result_v1.smoke.json` has `"is_smoke": true` or equivalent flag so downstream tooling never mistakes it for a real promotion.
   - That `campaign_charter_v1.json` contains a `scope` field matching the value in `scope_classification_v1.json` (cross-artifact consistency).

4. **Makefile target naming**: `validate-project` takes a `PROJECT` env var. Consider also supporting `make validate-project PROJECT=...` as a positional or defaulting to glob-all-projects for CI, so a future multi-pilot repo doesn't require per-project invocation.

5. **Evidence bundle format**: The validation evidence is `.txt` files. For machine-parseable CI gating in later milestones, consider emitting a structured JSON sidecar (e.g., `2026-02-15-w5-01-validate-v1.json` with `{"pass": true, "checks": [...]}`) alongside the human-readable `.txt`.

## Real-research fit

**Strong fit.** This milestone correctly establishes the "scaffolding before physics" pattern:

- The pion GFF bootstrap + positivity topic is a genuine, publishable HEP direction (dispersive bounds on pion gravitational form factors via unitarity/positivity constraints). Choosing it as the pilot slug signals that the ecosystem will be tested against a real research trajectory, not a toy problem.
- The `ecosystem_validation` / `NOT_FOR_CITATION` scope discipline is exactly right: it prevents premature physics claims while the toolchain is still being validated. This is the kind of safety rail that distinguishes a serious research automation system from a demo.
- The A0.1 → A0.2 artifact ladder (charter → promotion contract) maps cleanly onto how real HEP collaborations gate work: you don't run expensive computations until the analysis framework is validated.

**One concern for future milestones**: The promotion contract (A0.2) is currently a smoke test. When it becomes a real gate (A1+), it will need to encode physics-level acceptance criteria (e.g., "reproduces known dispersive bound within 2σ" or "sum rule saturates to expected precision"). Plan the schema to accommodate a `criteria` array with typed entries (numerical tolerance, citation requirement, cross-check reference) so the promotion contract can grow without schema breaks.

## Robustness & safety

1. **Hallucination mitigation**: The `NOT_FOR_CITATION` enforcement is the primary hallucination safety mechanism at this stage. It's well-placed. For A1+, the promotion contract should require provenance links (arXiv IDs, equation numbers) for any claimed physics result — plan this now in the schema even if not enforced yet.

2. **Idempotency**: The presence of `idempotency_meta_v1.schema.json` is good foresight. Confirm that `validate_project_artifacts.py` checks for idempotency metadata in the pilot artifacts (or that the schema is currently optional and will become required at A1).

3. **Toolchain pin integrity**: `manifest.lock.json` with checksums is the right approach. Ensure the validator checks that the lock file is self-consistent (all referenced tools have checksums, no dangling references).

4. **Smoke label propagation**: The `promotion_result_v1.smoke.json` filename encodes "smoke" in the filename, which is fragile. If the file is renamed or copied, the smoke/real distinction is lost. The JSON payload itself must contain a `"test_type": "smoke"` or `"is_smoke": true` field, and the validator must reject any promotion result that lacks this field.

## Specific patch suggestions

### 1. `idea-runs/schemas/promotion_result_v1.schema.json`
**What to change:** Add a required `test_type` field (enum: `"smoke"`, `"live"`) to the schema so the smoke/real distinction is machine-enforced, not filename-dependent.

```json
{
  "properties": {
    "test_type": {
      "type": "string",
      "enum": ["smoke", "live"],
      "description": "Whether this is a contract smoke test or a real promotion evaluation"
    }
  },
  "required": ["test_type"]
}
```

### 2. `idea-runs/scripts/validate_project_artifacts.py`
**What to change:** Add two checks:

```python
# After schema validation of promotion result:
if "smoke" in artifact_path and payload.get("test_type") != "smoke":
    fail(f"Smoke-labeled file {artifact_path} missing test_type='smoke' in payload")

# Cross-artifact consistency check:
charter_scope = charter_payload.get("scope")
scope_class = scope_payload.get("classification")
if charter_scope != scope_class:
    fail(f"Scope mismatch: charter says '{charter_scope}', scope_classification says '{scope_class}'")
```

### 3. `idea-runs/schemas/campaign_charter_v1.schema.json`
**What to change:** Add an optional `schema_source_commit` field for future drift detection:

```json
{
  "properties": {
    "schema_source_commit": {
      "type": "string",
      "pattern": "^[0-9a-f]{7,40}$",
      "description": "Git commit hash of the idea-generator repo from which this schema snapshot was taken"
    }
  }
}
```

### 4. `idea-runs/projects/pion-gff-bootstrap-positivity-pilot-2026-02-15/evidence/index.md`
**What to change:** Audit for absolute paths. If any `/Users/...` paths exist, replace with relative paths anchored to the project root:

```markdown
<!-- BEFORE (if present) -->
Evidence: /Users/fkg/Coding/Agents/Autoresearch/idea-runs/projects/.../artifacts/charter/...

<!-- AFTER -->
Evidence: ../../artifacts/charter/campaign_charter_v1.json
```

### 5. `idea-runs/Makefile`
**What to change:** Add a `validate-all-projects` target for CI scalability:

```makefile
validate-all-projects:
	@for proj in projects/*/; do \
		echo "=== Validating $$proj ==="; \
		PROJECT=$$proj $(MAKE) validate-project || exit 1; \
	done
```

### 6. `idea-generator/docs/plans/2026-02-12-implementation-plan-tracker.md`
**What to change:** Verify the W5-01 log entry includes the exact validation command outputs (or a hash/pointer to the evidence bundle) so the tracker is self-contained for audit:

```markdown
### W5-01 Log
- Status: IN_PROGRESS → REVIEW
- Evidence: `docs/reviews/bundles/2026-02-15-w5-01-validate-v1.txt` (sha256: <hash>)
```
