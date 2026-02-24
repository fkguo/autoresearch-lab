VERDICT: READY

## Blockers

None identified. The three Round-003 Gemini blockers have been addressed with verifiable evidence:

1. **Auto-relay pollution removed**: `docs/plans/auto-relay/**` excised from the `idea-generator` workspace, confirmed by `test ! -d docs/plans/auto-relay` in the validation bundle.
2. **Anti-pollution scope clarified**: Both `idea-core/scripts/check_no_test_instance_pollution.py` and `idea-generator/scripts/check_no_test_instance_pollution.py` now carry explicit docstring boundary policy (`forbidden: research/**, docs/research/**, artifacts/runs/**`; `allowed: docs/plans/**, docs/reviews/**`). This eliminates the false-negative window from scope confusion.
3. **`agent-team-output` retention justified**: The retro+swarm archive under `docs/plans/agent-team-output/2026-02-15-m5-retro-swarm-v1/` is design/audit SSOT, not a run artifact. Retention is intentional and the validation bundle confirms presence.

## Non-blocking

1. **`idea-runs/manifest.lock` schema versioning**: `schemas/manifest.lock.schema.json` should carry a `"$schema"` meta-field and a `"version"` key (e.g., `"1.0.0"`) so that future schema evolution can be gated by the validator. Currently the schema works, but a breaking change later would require out-of-band coordination.

2. **Anti-pollution script: positive-match logging**: Both `check_no_test_instance_pollution.py` scripts enforce forbidden paths but do not emit a summary of what *was* scanned. Adding a `--verbose` flag that lists scanned paths would improve audit confidence in CI without changing the default contract.

3. **`idea-runs/_template` completeness**: The template project should include a stub `PROVENANCE.md` (even if empty with a `TODO` marker) to enforce the pattern demonstrated by `pion-gff-bootstrap-m5-legacy/PROVENANCE.md`. Currently, new projects forked from `_template` could omit provenance unless the `manifest.lock` validator checks for it.

4. **Makefile target ordering**: In `idea-core/Makefile`, `validate` runs `anti-pollution → migration guard → contracts validate`. Consider adding a `--fail-fast` or short-circuit so that anti-pollution failure skips the heavier contracts-validate step. Minor efficiency concern.

5. **`expected-limitations-method-drift` project**: No `PROVENANCE.md` visible in the packet for this project (only for `pion-gff-bootstrap-m5-legacy`). If provenance is a hard contract for all `idea-runs` projects, this is a gap; if provenance is only required for legacy migrations, document that policy explicitly in `_template/README.md`.

## Real-research fit

The three-repo split (`idea-core` for tool logic, `idea-generator` for design/planning, `idea-runs` for research instance data) is well-aligned with real HEP research workflows where:

- **Tool code** must be version-pinned and reproducible across collaborators.
- **Planning/design docs** accumulate over a program lifetime and need audit trails.
- **Run data** (event samples, fit results, bootstrap outputs) grows unboundedly and must be isolated from tool repos to avoid git bloat and accidental intellectual-property leakage.

The `manifest.lock` contract in `idea-runs` is a strong fit for reproducibility: it mirrors the lockfile pattern used in production HEP analysis frameworks (e.g., ATLAS AnalysisBase version locks). The `pion-gff-bootstrap-m5-legacy` migration with explicit `PROVENANCE.md` is exactly the right approach for maintaining chain-of-custody when moving research artifacts between systems.

The anti-pollution boundary (`research/**` forbidden in tool repos) directly mitigates the most common failure mode in physics research codebases: test fixtures or exploratory notebooks silently coupling to specific datasets.

## Robustness & safety

- **Provenance chain**: `PROVENANCE.md` in `idea-runs` projects establishes artifact lineage. This is critical for evidence-first safety. The `manifest.lock` + JSON schema validation provides a machine-checkable complement.
- **Hallucination mitigation**: The anti-pollution scripts serve as a structural guard against the idea-generator agent accidentally fabricating or referencing research artifacts that don't exist in the correct repo. By making `research/**` forbidden in tool repos, any agent-generated path that "hallucinates" a research file will fail validation.
- **Boundary enforcement**: The explicit `forbidden`/`allowed` docstring policy in the pollution checkers is the right granularity. It makes the contract human-readable and auditable without requiring external documentation.
- **Validation bundles as evidence**: The `*-validate-v2.txt` bundles in `docs/reviews/bundles/` serve as timestamped attestation artifacts. For stronger safety, consider signing these with a deterministic hash of the repo state (e.g., `git rev-parse HEAD` embedded in the bundle).

## Specific patch suggestions

1. **`idea-runs/_template/PROVENANCE.md`** (new file)
   ```markdown
   # Provenance
   <!-- Required for all idea-runs projects. Fill in upon project creation. -->
   - **Source**: (originating repo, commit, or agent session)
   - **Migration date**: (ISO 8601)
   - **Migration reason**: (e.g., legacy cleanup, new research thread)
   - **Validated by**: (validation bundle path or CI run ID)
   ```

2. **`idea-runs/schemas/manifest.lock.schema.json`** — add schema version field
   ```diff
    {
   +  "$schema": "http://json-schema.org/draft-07/schema#",
   +  "version": "1.0.0",
      "type": "object",
      "properties": {
   ```

3. **`idea-runs/scripts/validate_manifest_lock.py`** — add schema version check
   ```diff
    def validate(manifest_path, schema_path):
        # ... existing loading code ...
   +    schema_version = schema.get("version")
   +    if schema_version:
   +        logging.info(f"Validating against manifest.lock schema v{schema_version}")
        jsonschema.validate(instance=manifest, schema=schema)
   ```

4. **`idea-core/scripts/check_no_test_instance_pollution.py`** and **`idea-generator/scripts/check_no_test_instance_pollution.py`** — add verbose mode
   ```diff
   +import argparse
   +
   +parser = argparse.ArgumentParser()
   +parser.add_argument("--verbose", action="store_true",
   +                    help="List all scanned paths for audit trail")
   +args = parser.parse_args()
   +
    # ... after scanning ...
   +if args.verbose:
   +    for p in scanned_paths:
   +        print(f"  [scanned] {p}")
   ```

5. **`idea-generator/docs/plans/2026-02-15-w5-hardening-execution-plan.md`** — document provenance policy
   ```diff
    ## idea-runs project policy
   +
   +### Provenance requirement
   +- All projects under `idea-runs/projects/` MUST include a `PROVENANCE.md`.
   +- Legacy migrations: full lineage (source commit, migration date, reason).
   +- New research threads: minimal stub (auto-generated from `_template`).
   ```

6. **Validation bundles** — embed repo state hash for tamper evidence
   ```diff
    # In each validate-v2.txt bundle header:
   +# repo-state: idea-core=$(git -C ../idea-core rev-parse HEAD) idea-generator=$(git -C ../idea-generator rev-parse HEAD) idea-runs=$(git rev-parse HEAD)
   ```
