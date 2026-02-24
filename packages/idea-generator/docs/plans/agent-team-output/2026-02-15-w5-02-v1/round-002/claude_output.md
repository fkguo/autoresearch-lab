VERDICT: READY

## Blockers

No blockers remain after Round 002. The three issues flagged by the Gemini review in Round 001 have been addressed:

1. **`tags` now required with `minItems: 1`** — failure records are always retrievable by at least one reusable key. This closes the "silent dead record" risk.
2. **`failure_evidence_uris` now has `minItems: 1`** — evidence-first safety is enforced at the schema level; you cannot file a failed approach without pointing to at least one piece of evidence.
3. **`failure_modes` now required with `minItems: 1`** — multi-label failure classification is mandatory, enabling structured retrieval (not just free-text grep).

All five verification commands pass. The delta is minimal and targeted.

## Non-blocking

1. **Tag vocabulary drift.** Tags are free-form strings (`"type": "string"`). Over time, inconsistent tagging (e.g., `"positivity"` vs `"positivity-constraint"` vs `"pos-constraint"`) will degrade retrieval recall. Consider adding an optional `tags_vocabulary.json` (or a `$ref`-able enum subset for the most common HEP failure categories) that tooling can validate against without making the field a closed enum. This preserves extensibility while nudging consistency.

2. **`failure_modes` could benefit from a controlled vocabulary layer.** Same drift risk as tags. A recommended (not mandatory) enum of common modes — `numerical_instability`, `gauge_dependence`, `unphysical_pole`, `convergence_failure`, `symmetry_violation`, `no_experimental_sensitivity` — would let dashboards and query hooks aggregate failures meaningfully. Ship it as a soft-validation linter, not a hard schema constraint.

3. **Query hook: no "staleness" signal.** The query config → hits artifact pipeline doesn't timestamp when the index was last rebuilt relative to the failure library. If a new `failed_approach` record is added but `make build-failure-library-index` is not re-run, the query hook will silently miss it. Add an `index_built_at` field to the index artifact and a `library_last_modified_at` from the failure-library directory's newest file. The hook should warn (not block) when `library_last_modified_at > index_built_at`.

4. **Hits artifact: include match-quality metadata.** Currently the hits artifact lists matching records but doesn't expose *why* they matched (which tags? which failure_modes?). Adding a `matched_on` field per hit (e.g., `{"tags": ["positivity"], "failure_modes": ["numerical_instability"]}`) improves downstream triage and makes the "avoid known dead ends" gate auditable.

5. **Schema versioning.** The file is `failed_approach_v1.schema.json`. Good. But neither the schema itself nor the records contain a `$schema` or `schema_version` field that tooling can assert against at validation time. Add `"schema_version": {"const": "1"}` as a required property in the record schema so that future v2 records are not silently validated against v1.

## Real-research fit

The failure library maps well to actual HEP theory workflow pain points:

- **Pion GFF bootstrap example is representative.** Positivity-constraint dead ends, numerical instability in dispersive integrals, and basis-choice failures are real and recurrent. The schema captures these without over-fitting to the specific project.
- **Tags + failure_modes generalize.** The same schema works for BSM model-building failures (`"tags": ["2HDM", "vacuum-stability"]`, `"failure_modes": ["symmetry_violation"]`), lattice QCD dead ends, or collider phenomenology. No HEP-specific field names are hard-coded into the schema itself.
- **Evidence URIs support heterogeneous backends.** Pointing to Mathematica notebooks, arXiv preprints, or internal artifact paths via URIs is the right abstraction. This will work with the `hepar` orchestrator's artifact store and with external references (Zotero, InspireHEP).
- **The "avoid known dead ends" hook is the highest-leverage feature.** In practice, research groups re-discover the same dead ends across students/postdocs. A machine-queryable negative-results library with a pre-idea-generation gate is a genuine workflow improvement, not just bookkeeping.

## Robustness & safety

| Aspect | Assessment |
|--------|------------|
| **Hallucination mitigation** | Evidence URIs with `minItems: 1` + format `uri` constraint ensure every failure claim is anchored. The schema cannot accept a failure record with zero evidence. This is the correct evidence-first posture. |
| **Provenance** | Records include `project_id`, `date`, `contributors`, and `failure_evidence_uris`. This is sufficient for audit trails. Consider adding an optional `upstream_idea_id` field linking back to the idea-generator output that spawned the failed approach (closes the provenance loop). |
| **Novelty checking** | The query hook correctly gates idea generation against known failures. The current matching is tag/failure_mode-based. For stronger novelty checking, a future iteration could add embedding-based semantic similarity over the `description` + `lessons_learned` fields, but tag-based matching is a sound MVP. |
| **Missing hits artifact fails when config exists** | Confirmed by the `validate-project` Makefile target. This is the right enforcement: if you declare you want failure-library checking (config exists), you must actually run it (hits artifact must exist). Silent skipping would undermine the gate. |
| **Schema validation** | Both `make validate` targets pass. The schema is valid JSON Schema draft-07 (inferred from structure). No ambiguous `additionalProperties` handling observed. |

## Specific patch suggestions

### 1. `schemas/failed_approach_v1.schema.json` — Add `schema_version` field

```jsonc
// ADD to "required" array:
"required": ["id", "project_id", "date", "description", "tags", "failure_modes", "failure_evidence_uris", "schema_version"]

// ADD to "properties":
"schema_version": {
  "type": "string",
  "const": "1",
  "description": "Schema version for forward-compatible validation"
}
```

### 2. `schemas/failed_approach_v1.schema.json` — Add optional `upstream_idea_id`

```jsonc
// ADD to "properties" (not required):
"upstream_idea_id": {
  "type": "string",
  "description": "ID of the idea-generator output that spawned this failed approach. Closes the provenance loop from idea → attempt → failure."
}
```

### 3. Query hook index artifact — Add staleness detection

**File:** `idea-runs/Makefile` (or equivalent index-build script)

```makefile
# In build-failure-library-index target, write timestamp into index:
build-failure-library-index:
	@echo "Building failure library index..."
	# ... existing index build logic ...
	@echo "{\"index_built_at\": \"$$(date -u +%Y-%m-%dT%H:%M:%SZ)\"}" > $(INDEX_DIR)/index_meta.json
```

**File:** `idea-runs/scripts/run-failure-library-query.sh` (or equivalent query script)

```bash
# ADD staleness check before query:
LIBRARY_NEWEST=$(find "$FAILURE_LIBRARY_DIR" -name '*.json' -newer "$INDEX_DIR/index_meta.json" 2>/dev/null | head -1)
if [ -n "$LIBRARY_NEWEST" ]; then
  echo "WARNING: Failure library has records newer than index. Re-run 'make build-failure-library-index'." >&2
fi
```

### 4. Hits artifact schema — Add `matched_on` per hit

**File:** Wherever the hits artifact schema is defined (e.g., `schemas/failure_query_hits_v1.schema.json` or inline in query config docs)

```jsonc
// Each hit object should include:
{
  "failed_approach_id": "...",
  "matched_on": {
    "tags": ["positivity"],
    "failure_modes": ["numerical_instability"]
  },
  "summary": "..."
}
```

### 5. `docs/` — Add recommended tag/failure_mode vocabulary

**File:** `docs/failure-library-conventions.md` (new file)

```markdown
# Failure Library Conventions

## Recommended `failure_modes` (not enforced, but preferred)
- `numerical_instability`
- `gauge_dependence`
- `unphysical_pole`
- `convergence_failure`
- `symmetry_violation`
- `no_experimental_sensitivity`
- `basis_dependence`
- `renormalization_scheme_artifact`
- `overcounting`
- `infrared_divergence`

## Tag naming conventions
- Use lowercase kebab-case: `pion-gff`, not `PionGFF`
- Prefer established HEP terminology over abbreviations
- Include at least one *physics-concept* tag and one *method* tag per record
```
