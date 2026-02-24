VERDICT: READY

## Blockers

No hard blockers identified. The packet satisfies all five DoD checklist items, provides verification evidence, and the architectural decisions (test-instance decoupling, anti-pollution gates, monorepo scaffolding for `idea-runs`) are sound and well-motivated.

## Non-blocking

1. **Anti-pollution check scope ambiguity.** The packet says the script blocks "forbidden paths" but does not enumerate what patterns are matched. The review should confirm the script uses an explicit allowlist/denylist (e.g., glob patterns like `docs/research/*/`, `projects/*/artifacts/`) rather than heuristic filename matching. If it's regex-based, document the regex in a header comment for future maintainers.

2. **`manifest.lock.json` schema is under-specified.** The DoD says "repo URL + commit SHA + checksum metadata" but doesn't pin:
   - Which checksum algorithm (SHA-256 recommended).
   - Whether the checksum covers the tarball, the tree object, or individual files.
   - Whether there is a JSON Schema or at least a validated example.
   Recommend adding a `$schema` field or a co-located `manifest.lock.schema.json`.

3. **`idea-runs` has no `.gitignore` or CI wiring mentioned.** A monorepo intended to hold artifacts (`.jsonl`, lock files) should have:
   - A `.gitignore` that excludes large binary artifacts or temp files.
   - At minimum a placeholder CI job (even `make validate: true`) so the pattern is consistent across all three repos.

4. **Legacy archive path depth.** `projects/pion-gff-bootstrap-m5-legacy/archive/from-idea-core-docs-research/pion-gff-bootstrap/**` is 5 levels deep below `projects/`. This will be painful for `find`/`glob` tooling. Consider flattening to `projects/pion-gff-bootstrap-m5-legacy/archive/` with a `PROVENANCE.md` file recording the original source path.

5. **Tracker append-only enforcement is procedural, not mechanical.** The tracker is a Markdown file—any agent or human can rewrite it. Consider adding a git pre-commit hook or CI step that verifies the tracker diff is append-only (no deletions or edits to prior log entries).

## Real-research fit

The decoupling is well-motivated for HEP research workflows:

- **Run isolation** prevents idea-generation tooling from accumulating stale physics artifacts (e.g., pion GFF lattice data, bootstrap outputs) that would confuse future novelty checks and provenance queries.
- **`manifest.lock.json`** with commit SHAs gives reproducibility: a collaborator can reconstruct which version of `idea-core` + `idea-generator` produced a given run's ideas. This is essential for the evidence-first philosophy—every idea must trace back to the exact tool state.
- **The `expected-limitations` sample project** is a smart inclusion. Failed approaches are first-class research artifacts in HEP (e.g., documenting why a particular dispersion-relation bootstrap didn't converge). Having a template for this avoids the common failure mode where negative results are silently dropped.

**Extension to broader theoretical physics:** The `projects/<project_slug>/` template with `toolchain/`, `artifacts/ideas/` is physics-agnostic. When extending to, say, condensed-matter or cosmology, the only change needed is project-specific artifact schemas (under `artifacts/`), not structural rewiring. This is good.

## Robustness & safety

| Concern | Status | Recommendation |
|---------|--------|----------------|
| Hallucination mitigation | ✅ Provenance chain (manifest lock → commit SHA → tool version) exists | Add checksum verification step to `make validate` in `idea-runs` |
| Novelty check integrity | ✅ Decoupling prevents stale run data from contaminating tool-side checks | Document the invariant explicitly in `idea-runs/README.md` |
| Anti-pollution false negatives | ⚠️ Not fully verifiable from packet alone | See patch suggestion #1 below |
| Append-only audit trail | ⚠️ Procedural only | See patch suggestion #3 below |
| Cross-repo consistency | ✅ Both `idea-core` and `idea-generator` have identical gate scripts | Pin the script to a shared version or symlink to avoid drift |

## Specific patch suggestions

### 1. `idea-core/scripts/check_no_test_instance_pollution.py` — add explicit pattern documentation

```python
# At top of file, after imports, add:
# --- Forbidden path patterns (update this list when new instance types are added) ---
FORBIDDEN_PATTERNS: list[str] = [
    "docs/research/*/",          # migrated to idea-runs
    "projects/",                 # never belongs in tool repos
    "artifacts/ideas/",          # run-time artifacts belong in idea-runs
    "*.jsonl",                   # idea output files belong in idea-runs
]
# If you add a pattern here, also add a test case in tests/test_anti_pollution.py
```

**Why:** Makes the gate auditable. Reviewers (and future agents) can verify coverage without reading regex internals.

### 2. `idea-runs/projects/expected-limitations-method-drift/toolchain/manifest.lock.json` — add schema and checksum algorithm

```jsonc
{
  "$schema": "../../../schemas/manifest.lock.schema.json",
  "tool_repos": [
    {
      "name": "idea-core",
      "url": "https://github.com/<org>/idea-core",
      "commit_sha": "<sha>",
      "checksum": {
        "algorithm": "sha256",
        "target": "tree",
        "value": "<hex>"
      }
    },
    {
      "name": "idea-generator",
      "url": "https://github.com/<org>/idea-generator",
      "commit_sha": "<sha>",
      "checksum": {
        "algorithm": "sha256",
        "target": "tree",
        "value": "<hex>"
      }
    }
  ],
  "locked_at": "2026-02-15T00:00:00Z"
}
```

Also add `idea-runs/schemas/manifest.lock.schema.json` with a JSON Schema definition. **Why:** Without a schema, downstream agents cannot programmatically validate lock files, breaking the evidence chain.

### 3. `idea-generator/Makefile` — add append-only tracker guard

```makefile
# After the anti-pollution check, add:
.PHONY: check-tracker-append-only
check-tracker-append-only:
	@echo "Checking tracker is append-only..."
	@git diff HEAD -- docs/plans/2026-02-12-implementation-plan-tracker.md \
	  | grep -E '^\-[^-]' \
	  && { echo "ERROR: Tracker has deletions — append-only violation"; exit 1; } \
	  || echo "OK: tracker changes are append-only"

validate: check-tracker-append-only check-no-test-instance-pollution
```

**Why:** Mechanically enforces the append-only invariant that the packet claims but doesn't verify.

### 4. `idea-runs/README.md` — add decoupling invariant documentation

Add a section:

```markdown
## Decoupling Invariant

This repo holds **run-time artifacts only**. The generating tools (`idea-core`,
`idea-generator`) must never contain:
- Research project directories (`projects/`)
- Idea output files (`*.jsonl`)
- Run-specific configuration or data

Conversely, this repo must never contain tool source code, library
implementations, or prompt templates. The boundary is enforced by
`scripts/check_no_test_instance_pollution.py` in each tool repo.

Each project's `toolchain/manifest.lock.json` records the exact tool
versions used, enabling full provenance reconstruction.
```

**Why:** The architectural intent is implicit in the current packet. Making it explicit prevents future drift when new contributors (human or agent) add projects.

### 5. `idea-generator/scripts/check_no_test_instance_pollution.py` — deduplicate with `idea-core`

Either:
- **(a)** Extract to a shared package (e.g., `idea-common`) and depend on it, or
- **(b)** Add a header comment: `# MIRROR: keep in sync with idea-core/scripts/check_no_test_instance_pollution.py` and add a CI step that diffs the two files.

**Why:** Two independent copies of a gate script will silently diverge. Option (a) is better long-term; option (b) is acceptable for this milestone.
