VERDICT: NOT_READY

## Blockers

1. **Anti-pollution script not shown — cannot verify gate correctness.** The review packet references `scripts/check_no_test_instance_pollution.py` in both `idea-core` and `idea-generator` but does not include the script source. Without seeing the forbidden-path patterns (regex or glob list), I cannot confirm the gate blocks all test-instance artifacts (e.g., `.jsonl` idea files, `artifacts/` directories, `sync/` board dumps, run-specific configs). A false-negative in this gate silently defeats the entire W5-03 objective. **Action required:** include the full script source in the review packet, or at minimum the exact list of forbidden path patterns and the exit-code contract.

2. **`manifest.lock.json` schema is unspecified.** The DoD says "repo URL + commit SHA + checksum metadata" but no JSON schema or example is provided. Without a schema contract, downstream consumers (e.g., `idea-generator` reading the lock to verify toolchain provenance) have no way to validate. **Action required:** add a `manifest.lock.schema.json` (JSON Schema draft-07+) or at least an `## Artifact Contract` section in the execution plan documenting required fields, types, and validation rules. Minimum fields: `{ repo_url: string(uri), commit_sha: string(hex, 40), checksum_algo: enum["sha256"], checksum: string(hex, 64), locked_at: string(iso8601) }`.

3. **No automated test for migration completeness.** The packet claims test-instance files were migrated out of tool repos, but there is no CI-level assertion that the *specific* migrated paths are absent. The anti-pollution script is a generic gate; there should also be a one-time migration-completeness test (or the anti-pollution script's forbidden list must explicitly include every migrated path). Without this, a `git revert` or bad merge could silently reintroduce the files. **Action required:** either (a) add the exact migrated paths to the anti-pollution forbidden list, or (b) add a dedicated migration-completeness check that asserts those 5 specific paths are absent.

## Non-blocking

- **Makefile ordering concern.** `idea-core/Makefile` runs anti-pollution check *first* in `validate`. This is correct for fail-fast, but if the check script has a Python import error, the error message may be confusing. Consider adding a `python3 -c "import sys; sys.exit(0)"` canary or a more descriptive error wrapper.

- **Duplicate script maintenance.** `check_no_test_instance_pollution.py` exists in both `idea-core` and `idea-generator`. Unless these have different forbidden-path lists (which would be valid), consider extracting a shared script into a common dev-tooling location or making the forbidden-path list a config file so the script itself is identical and can be symlinked or vendored from one source of truth.

- **`idea-runs` template structure is described but not fully shown.** The packet mentions `projects/<project_slug>/` template structure but doesn't show the full directory tree or a `README` template. This is non-blocking for W5-03 but will become a blocker for W5-04/W5-05 if other agents need to scaffold new projects.

- **Append-only tracker enforcement is manual.** The tracker updates are described as "append-only" but there is no programmatic enforcement (e.g., a pre-commit hook that rejects non-append edits to `implementation-plan-tracker.md`). This is acceptable for now but should be tracked as tech debt.

- **Legacy archive path depth.** `projects/pion-gff-bootstrap-m5-legacy/archive/from-idea-core-docs-research/pion-gff-bootstrap/**` is 4 levels deep under `archive/`. Consider flattening to `projects/pion-gff-bootstrap-m5-legacy/archive/pion-gff-bootstrap/**` with a provenance note in a `PROVENANCE.md` file rather than encoding the source path in the directory structure.

## Real-research fit

The decoupling of test-instance data from tool repos is a high-value architectural move for HEP research workflows. In practice, a single `idea-generator` toolchain will be applied across multiple physics targets (pion form factors, BSM Higgs couplings, dark matter EFT matching, etc.). Keeping run artifacts in `idea-runs/projects/<slug>/` while the generator logic stays clean enables:

- **Reproducibility:** Each run project locks its toolchain version via `manifest.lock.json`, so a collaborator can reconstruct the exact generator state that produced a given idea set.
- **Parallel campaigns:** Multiple research targets can be active simultaneously without cross-contamination.
- **Peer review:** Reviewers can audit `idea-runs` artifacts without needing write access to the tool repos.

However, the current design doesn't yet address how `idea-generator` *discovers* which `idea-runs` project to write to at runtime. This is presumably a W5-04/W5-05 concern, but the interface should be sketched now to avoid painting yourself into a corner. A minimal contract: `IDEA_RUNS_PROJECT_DIR` environment variable pointing to the active project root, validated by the generator at startup.

The expected-limitations sample project (`expected-limitations-method-drift`) is a good inclusion — it demonstrates that the system records *negative* results, which is critical for evidence-first research. Real HEP workflows generate far more failed approaches than successful ones, and having a first-class artifact for this (`failed_approach_v1.jsonl`) sets the right cultural norm.

## Robustness & safety

**Provenance chain:** The `manifest.lock.json` concept is sound but under-specified (see Blocker #2). For evidence-first safety, the lock file should also include a `provenance` field recording *who* (agent ID or human) locked the version and *why* (e.g., "locked for W5-03 expected-limitations run"). This prevents orphaned locks.

**Hallucination mitigation:** The anti-pollution gate is a form of hallucination mitigation — it prevents the generator from "hallucinating" that test data is part of its core logic. This is good. However, the gate only runs at `make validate` time, not at write time. If an agent writes a test-instance file to a tool repo and then crashes before `make validate` runs, the pollution persists until the next validation. Consider adding a `.gitignore`-level defense (ignoring common test-instance patterns) as a belt-and-suspenders measure.

**Novelty/dedup:** The `idea-runs` structure does not yet show how duplicate ideas across projects are detected. If `project-A` and `project-B` both generate an idea about, say, "use dispersive relations for pion GFF," there is no cross-project dedup. This is acceptable for W5-03 scope but should be flagged for the idea-generator's novelty-check module.

**Audit integrity:** Append-only tracker updates are claimed but not enforced (see Non-blocking #4). For safety-critical audit chains, this should eventually be enforced by a pre-commit hook or a signed-commit policy.

## Specific patch suggestions

1. **`idea-core/scripts/check_no_test_instance_pollution.py`** — Add explicit forbidden paths for all migrated files:
   ```python
   # Add to FORBIDDEN_PATTERNS list:
   FORBIDDEN_PATHS = [
       "docs/research/pion-gff-bootstrap/m0.1-preflight.md",
       "docs/research/pion-gff-bootstrap/m0.2-design.md",
       "docs/research/pion-gff-bootstrap/tracker.md",
       "docs/research/pion-gff-bootstrap/sync/2026-02-14-m0.2-board-sync.txt",
       "docs/research/pion-gff-bootstrap/sync/2026-02-14-m0.3-blocked-note.txt",
   ]
   # Check these explicitly in addition to pattern-based checks
   for path in FORBIDDEN_PATHS:
       if os.path.exists(path):
           failures.append(f"Migrated file still present: {path}")
   ```

2. **`idea-runs/projects/expected-limitations-method-drift/toolchain/manifest.lock.json`** — Replace with schema-validated structure:
   ```jsonc
   // File: idea-runs/manifest.lock.schema.json (NEW, add at repo root)
   {
     "$schema": "http://json-schema.org/draft-07/schema#",
     "type": "object",
     "required": ["tool_repo", "commit_sha", "checksum_algo", "checksum", "locked_at"],
     "properties": {
       "tool_repo": { "type": "string", "format": "uri" },
       "commit_sha": { "type": "string", "pattern": "^[0-9a-f]{40}$" },
       "checksum_algo": { "type": "string", "enum": ["sha256"] },
       "checksum": { "type": "string", "pattern": "^[0-9a-f]{64}$" },
       "locked_at": { "type": "string", "format": "date-time" },
       "locked_by": { "type": "string", "description": "Agent ID or human identifier" },
       "lock_reason": { "type": "string" }
     },
     "additionalProperties": false
   }
   ```

3. **`idea-generator/Makefile`** — Add descriptive error wrapper:
   ```makefile
   # Change:
   # validate:
   #     python3 scripts/check_no_test_instance_pollution.py
   # To:
   validate:
   	@echo "==> Anti-pollution gate..."
   	@python3 scripts/check_no_test_instance_pollution.py || \
   		(echo "FAIL: test-instance pollution detected. See above." && exit 1)
   	@echo "==> All validation passed."
   ```

4. **`docs/plans/2026-02-15-w5-hardening-execution-plan.md`** — Add artifact contract section:
   ```markdown
   ## Artifact Contracts

   ### idea-runs project directory layout
   ```
   projects/<project_slug>/
   ├── README.md              # Project description, research question, status
   ├── toolchain/
   │   └── manifest.lock.json # Schema: /manifest.lock.schema.json
   ├── artifacts/
   │   └── ideas/             # Generated idea artifacts (.jsonl)
   └── PROVENANCE.md          # Migration/creation provenance
   ```

   ### Runtime discovery
   The `idea-generator` resolves its target project via:
   - `IDEA_RUNS_PROJECT_DIR` env var (required, validated at startup)
   - Fallback: error with actionable message
   ```

5. **`idea-runs/projects/pion-gff-bootstrap-m5-legacy/`** — Add `PROVENANCE.md`:
   ```markdown
   # Provenance

   Migrated from `idea-core` on 2026-02-15 (W5-03).
   Original paths:
   - `docs/research/pion-gff-bootstrap/m0.1-preflight.md`
   - `docs/research/pion-gff-bootstrap/m0.2-design.md`
   - `docs/research/pion-gff-bootstrap/tracker.md`
   - `docs/research/pion-gff-bootstrap/sync/2026-02-14-m0.2-board-sync.txt`
   - `docs/research/pion-gff-bootstrap/sync/2026-02-14-m0.3-blocked-note.txt`

   Migration commit: <insert SHA from idea-core removal commit>
   ```
