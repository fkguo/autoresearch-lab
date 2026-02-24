VERDICT: READY

## Blockers

No remaining blockers identified. All three round-002 blockers have been addressed with concrete, verifiable artifacts:

1. **Anti-pollution script**: Now included verbatim with exact `FORBIDDEN_ROOTS` list and fail-fast semantics; deployed to both `idea-core` and `idea-generator` with Makefile wiring. ✅
2. **`manifest.lock` schema**: Explicit JSON Schema file (`manifest.lock.schema.json`) plus automated Python validator plus `make validate` target in `idea-runs`. ✅
3. **Migration-completeness guard**: Explicit `MIGRATED_PATHS` tuple with fail-fast behavior, wired into `idea-core/Makefile` `validate` target. ✅

## Non-blocking

1. **`FORBIDDEN_ROOTS` divergence risk**: The anti-pollution script is duplicated across two repos with the same `FORBIDDEN_ROOTS` tuple. If either repo's forbidden-root list drifts, pollution could sneak through silently. Consider extracting the canonical list into `idea-runs/schemas/forbidden_roots.json` and having both tool-repo scripts load from a pinned reference (or at minimum, add a cross-repo consistency check to CI).

2. **`manifest.lock` checksum algorithm not stated**: The packet mentions "checksum metadata" but doesn't specify the hash algorithm (SHA-256? SHA-512? BLAKE3?). Pin the algorithm in the schema (`"checksum_algorithm": {"const": "sha256"}`) so validators are unambiguous.

3. **Validator error-message fidelity**: The packet shows fail-fast exit-non-zero behavior but doesn't mention structured error output (e.g., JSON diagnostics). For CI triage, emitting a one-line JSON error object (`{"gate": "anti-pollution", "path": "research/...", "status": "FAIL"}`) on stderr would accelerate debugging.

4. **Evidence bundle naming convention**: Files like `2026-02-15-w5-03-validate-v1.txt` use `v1` but no schema defines version-bump semantics. A `EVIDENCE_BUNDLE_NAMING.md` in `idea-runs/docs/` would prevent future ambiguity.

5. **`_template` project completeness**: The packet references `projects/_template/**` but doesn't enumerate its contents. Confirm it includes at minimum: `manifest.lock.json`, `PROVENANCE.md`, `README.md`, and a `toolchain/` stub—otherwise new projects will diverge from the validated schema immediately.

6. **No `pre-commit` hook wiring mentioned**: The Makefile targets exist, but the packet doesn't confirm they're wired into Git pre-commit hooks or CI pipelines. Without this, gates depend on developer discipline.

## Real-research fit

The three-repo separation (`idea-core` for tooling, `idea-generator` for the agent, `idea-runs` for research instance data) is a sound architecture for HEP research workflows:

- **Provenance chain is credible**: `manifest.lock.json` with repo URL + commit SHA + checksum gives reproducible toolchain pinning, analogous to how HEP experiments pin their software stacks (e.g., CMSSW release tags).
- **Migration guard is physics-aware**: The `MIGRATED_PATHS` list explicitly names pion GFF bootstrap milestones, demonstrating that the separation was designed around an actual physics research project, not an abstract template.
- **Expected-limitations sample project**: Including `expected-limitations-method-drift` as a first-class project signals that the system is designed for evidence-first reasoning about where methods break—critical for BSM/EFT workflows where systematic uncertainties dominate.
- **Extensibility path**: The `projects/<slug>/` template pattern supports arbitrary future physics projects (e.g., dark matter portal couplings, anomalous magnetic moments) without touching tool repos.

## Robustness & safety

- **Hallucination mitigation**: The anti-pollution gates prevent the most common failure mode in agent-assisted research—tool repos accumulating stale research artifacts that an LLM might treat as ground truth. Fail-fast is the correct semantics here.
- **Provenance integrity**: `PROVENANCE.md` in legacy-migrated projects provides a human-readable audit trail. Combined with `manifest.lock.json`, this gives both machine-verifiable and human-auditable provenance.
- **Novelty/duplication risk**: The migration-completeness guard prevents re-introduction of legacy content, which is a form of duplication detection. However, there is no cross-project novelty check within `idea-runs` (e.g., detecting near-duplicate projects). This is acceptable at current scale but should be flagged for future work.
- **Append-only tracker**: The tracker's append-only semantics prevent silent history rewriting—important for audit trails in collaborative research.

## Specific patch suggestions

1. **`idea-runs/schemas/manifest.lock.schema.json`** — Add checksum algorithm constraint:
   ```json
   "checksum_algorithm": {
     "type": "string",
     "const": "sha256",
     "description": "Hash algorithm used for all checksum fields"
   }
   ```
   Add this as a required top-level property.

2. **`idea-core/scripts/check_no_test_instance_pollution.py`** and **`idea-generator/scripts/check_no_test_instance_pollution.py`** — Extract shared constant to reduce drift:
   ```python
   # At top of both scripts, add:
   # NOTE: canonical source of truth is idea-runs/schemas/forbidden_roots.json
   # Update both copies simultaneously; CI cross-check planned for W6.
   _CANONICAL_REF = "idea-runs/schemas/forbidden_roots.json"
   ```
   And create **`idea-runs/schemas/forbidden_roots.json`**:
   ```json
   {
     "forbidden_roots": ["research", "docs/research", "artifacts/runs"],
     "version": 1
   }
   ```

3. **`idea-runs/projects/_template/manifest.lock.json`** — Ensure template includes all required fields with placeholder values:
   ```json
   {
     "toolchain": {
       "idea_core": {"repo": "FILL", "commit_sha": "FILL", "checksum": "FILL"},
       "idea_generator": {"repo": "FILL", "commit_sha": "FILL", "checksum": "FILL"}
     },
     "checksum_algorithm": "sha256",
     "created": "FILL_ISO8601",
     "locked_by": "FILL_AGENT_OR_HUMAN"
   }
   ```

4. **`idea-runs/Makefile`** — Add template-completeness check:
   ```makefile
   validate: validate-schema validate-template
   
   validate-template:
   	@echo "Checking _template completeness..."
   	@test -f projects/_template/manifest.lock.json || (echo "FAIL: missing template manifest.lock.json" && exit 1)
   	@test -f projects/_template/PROVENANCE.md || (echo "FAIL: missing template PROVENANCE.md" && exit 1)
   	@test -f projects/_template/README.md || (echo "FAIL: missing template README.md" && exit 1)
   ```

5. **`idea-generator/docs/plans/2026-02-15-w5-hardening-execution-plan.md`** — Append W6 forward-looking item:
   ```markdown
   ## W6 Forward Items (non-blocking)
   - [ ] Wire `make validate` into pre-commit hooks for all three repos
   - [ ] Add CI cross-repo consistency check for `FORBIDDEN_ROOTS` vs `idea-runs/schemas/forbidden_roots.json`
   - [ ] Add cross-project novelty detection within `idea-runs/projects/`
   ```
