VERDICT: READY

## Blockers

None. The W5-02 delivery meets all DoD items. The schemas, indexing tooling, query hook, gate validation, and pilot project form a coherent, testable unit. No architectural showstoppers prevent merge.

## Non-blocking

1. **Tag vocabulary drift risk.** The `tags[]` field uses a `key:value` string convention (e.g., `"observable:pion-gff"`) but there is no controlled vocabulary or enum constraint in the schema. Over time, projects will invent incompatible keys (`obs:pion-gff` vs `observable:pion_gff`). **Suggestion:** Add an optional `schemas/failure_tag_vocabulary_v1.schema.json` that lists canonical key prefixes (`observable`, `method`, `sector`, `symmetry`, `kinematics`) with regex patterns, and reference it via `$ref` or a validator flag. This is non-blocking because freeform tags still work; the vocabulary can be layered on later.

2. **`failure_modes[]` semantic overlap with `tags[]`.** Both are string arrays used for retrieval. The distinction—`tags` for taxonomy, `failure_modes` for failure classification—is documented only implicitly via examples. **Suggestion:** Add a 2-sentence `description` field to each in the JSON Schema (`failed_approach_v1.schema.json`) clarifying: _tags_ are for discovery/filtering (what domain, what method), _failure_modes_ are for classifying _why_ it failed (numerical instability, constraint violation, gauge dependence, etc.). This costs one line each and prevents confusion.

3. **Index staleness.** `build_failure_library_index.py` produces a point-in-time snapshot. If a project adds a failure record after the index is built, queries against the stale index silently miss it. **Suggestion:** Add a `build_timestamp` + `source_glob_hash` (SHA-256 of the sorted list of input file paths + their mtimes) to `failure_library_index_v1.json`. The query script can then warn (not fail) if the index is older than the newest source file. Minimal code change (~8 lines in the build script, ~5 in the query script).

4. **Hits artifact doesn't record query parameters.** `failure_library_hits_v1.json` contains the matched records but doesn't embed the query that produced them. For auditability, the hits artifact should include a `query` field (or `query_ref` pointing to the pipeline config). **Suggestion:** In `failure_library_hits_v1.schema.json`, add an optional `query` object (or `query_config_path` string) so the provenance chain is self-contained.

5. **No deduplication guard on the index.** If two projects copy the same `failed_approach_v1.jsonl` record (e.g., a shared negative result), the index will contain duplicates. **Suggestion:** The index builder should deduplicate on `(approach_id, project)` or on a content hash, and log a warning for cross-project duplicates.

6. **Absolute paths in evidence.** The evidence paths section includes `/Users/fkg/Coding/Agents/Autoresearch/idea-runs/...`. These are fine for local verification but should not leak into committed artifacts. Confirm that the committed JSON files use repo-relative paths (e.g., `evidence/failure_library_index_v1.json`), not absolute ones.

## Real-research fit

**Strong.** This addresses a genuine pain point in HEP phenomenology: researchers repeatedly attempt approaches that are known to fail (e.g., naive dispersive representations that violate positivity, truncation schemes that break gauge invariance). The failure library's tag+failure_mode retrieval directly maps to how a physicist would mentally query: "Has anyone tried a conformal expansion for this form factor and hit a convergence wall?"

The pilot project (pion GFF bootstrap + positivity) is a well-chosen demonstrator because:
- Positivity constraints in form-factor parameterizations are a real, active area (cf. Bourrely-Caprini-Lellouch bounds, Okubo-type constraints).
- Known failure modes (e.g., polynomial parameterizations violating unitarity bounds at large Q²) are concrete and documentable.

**Generalization path is clear:** the `tags` key:value convention and `failure_modes` enum-like strings scale to BSM searches (e.g., `sector:ewsb`, `method:effective-potential`, `failure_mode:gauge_dependence`), lattice QCD workflows, and collider phenomenology without schema changes.

**One gap for real research:** The current schema doesn't have a `severity` or `confidence` field on the failure record. In practice, some failures are hard blockers ("this integral diverges and no regularization saves it") while others are soft ("this converged slowly but might work with better numerics"). A future iteration should add an optional `severity: hard|soft|inconclusive` enum. Not blocking for W5-02.

## Robustness & safety

1. **Hallucination mitigation: good.** Every `failed_approach` record requires `evidence_refs[]` (URIs to papers, computation logs, or notebook cells). This is the right design—no orphan claims. The gate validator in `validate_project_artifacts.py` enforces that the hits artifact exists and validates against schema, which prevents phantom references.

2. **Provenance chain: complete for the happy path.** The chain is: `failed_approach_v1.jsonl` → `failure_library_index_v1.json` → `failure_library_query_v1.json` (config) → `failure_library_hits_v1.json`. Each step is schema-validated. The one weak link is that `evidence_refs` URIs are not validated for reachability (e.g., a typo in an arXiv ID would pass schema validation). This is acceptable for now—URI reachability checks belong in a CI linter, not the schema.

3. **Gate enforcement: correct design.** The rule "if query config exists, hits must exist and validate" is the right polarity—it's opt-in (no config = no enforcement) but strict once opted in. This avoids false negatives in projects that haven't adopted the hook yet.

4. **Schema versioning: adequate.** The `_v1` suffix on all schemas enables future evolution. The `$id` and `$schema` fields in the JSON Schemas should include the version for machine-parseable compatibility checks (verify this is the case in the actual files).

5. **No execution of untrusted code in the query path.** The query script reads JSON configs and filters JSON records—no `eval`, no shell injection surface. Good.

## Specific patch suggestions

### 1. `idea-generator/schemas/failed_approach_v1.schema.json`
**What to change:** Add `description` fields to `tags` and `failure_modes` for disambiguation.
```jsonc
// In "properties.tags":
"tags": {
  "type": "array",
  "items": { "type": "string" },
  "uniqueItems": true,
+ "description": "Discovery/filtering keys using key:value convention (e.g., 'observable:pion-gff', 'method:conformal-expansion'). Used for WHAT was attempted."
}

// In "properties.failure_modes":
"failure_modes": {
  "type": "array",
  "items": { "type": "string" },
+ "description": "Classification labels for WHY the approach failed (e.g., 'numerical_instability', 'positivity_violation', 'gauge_dependence'). Used for failure-type retrieval."
}
```

### 2. `idea-generator/schemas/failure_library_hits_v1.schema.json`
**What to change:** Add optional `query_config_path` for provenance.
```jsonc
// Add to top-level "properties":
+ "query_config_path": {
+   "type": "string",
+   "description": "Repo-relative path to the query config that produced these hits. Optional but recommended for audit trail."
+ }
```

### 3. `idea-runs/schemas/failure_library_index_v1.schema.json`
**What to change:** Add `build_timestamp` and `source_hash` for staleness detection.
```jsonc
// Add to "properties":
+ "build_timestamp": {
+   "type": "string",
+   "format": "date-time",
+   "description": "ISO 8601 timestamp when the index was built."
+ },
+ "source_hash": {
+   "type": "string",
+   "description": "SHA-256 of sorted source file paths + mtimes, for staleness detection."
+ }
// Add both to "required" array.
```

### 4. `idea-runs/scripts/build_failure_library_index.py`
**What to change:** Emit `build_timestamp` and `source_hash`; deduplicate on `(approach_id, source_project)`.
```python
# After collecting all records:
+ import hashlib, datetime
+ source_sig = hashlib.sha256(
+     "\n".join(f"{p}:{p.stat().st_mtime_ns}" for p in sorted(source_files))
+     .encode()
+ ).hexdigest()
+ index["build_timestamp"] = datetime.datetime.utcnow().isoformat() + "Z"
+ index["source_hash"] = source_sig

# Dedup:
+ seen = set()
+ deduped = []
+ for rec in index["entries"]:
+     key = (rec["approach_id"], rec.get("source_project", ""))
+     if key not in seen:
+         seen.add(key)
+         deduped.append(rec)
+     else:
+         logging.warning(f"Duplicate entry skipped: {key}")
+ index["entries"] = deduped
```

### 5. `idea-runs/scripts/run_failure_library_query.py`
**What to change:** Emit `query_config_path` in the hits artifact; warn on stale index.
```python
# After loading the index:
+ if "build_timestamp" in index:
+     from datetime import datetime
+     built = datetime.fromisoformat(index["build_timestamp"].rstrip("Z"))
+     # Check newest source file
+     newest = max(p.stat().st_mtime for p in source_files) if source_files else 0
+     if newest > built.timestamp():
+         logging.warning("Failure library index is stale; consider re-running build-failure-library-index")

# When writing hits artifact:
+ hits["query_config_path"] = str(query_config_path.relative_to(project_root))
```

### 6. `idea-runs/projects/pion-gff-bootstrap-positivity-pilot-2026-02-15/artifacts/failure_library/failure_library_hits_v1.json`
**What to change:** Verify no absolute paths are committed. If any `evidence_refs` contain `/Users/fkg/...`, replace with repo-relative paths.

### 7. `idea-generator/docs/plans/` (relevant design doc, if one exists for W5-02)
**What to change:** Add a one-paragraph "Retrieval Key Discipline" section documenting the canonical tag key prefixes:
```markdown
### Retrieval Key Discipline
Tags use `key:value` format. Canonical key prefixes:
- `observable:` — the physical quantity (e.g., `observable:pion-gff`)
- `method:` — the computational/analytical approach (e.g., `method:conformal-expansion`)
- `sector:` — physics sector (e.g., `sector:qcd-lowenergy`, `sector:ewsb`)
- `symmetry:` — symmetry constraint (e.g., `symmetry:crossing`, `symmetry:isospin`)
- `kinematics:` — kinematic regime (e.g., `kinematics:timelike`, `kinematics:large-Q2`)

These are conventions, not enforced enums. Future iterations may promote them to a controlled vocabulary schema.
```
