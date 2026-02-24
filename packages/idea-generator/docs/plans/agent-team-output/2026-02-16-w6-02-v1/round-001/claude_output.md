VERDICT: READY

## Blockers

No hard blockers. The design packet satisfies all five DoD items with verification evidence. The gate semantics (directory-existence triggers), schema enforcement, failure-library closure, and cross-repo schema snapshots are all structurally sound. I have no blocking objections to merging this round.

## Non-blocking

1. **Schema snapshot drift risk.** `idea-generator` owns the SSOT schemas; `idea-runs` carries snapshots. There is no automated mechanism (CI check, hash assertion, or symlink) to detect when the SSOT diverges from the snapshot. This will bite you within 2–3 schema revisions.

   *Recommendation:* Add a `make check-schema-sync` target in `idea-runs` that compares `sha256` of each snapshot against the SSOT copy (or use a `schemas/CHECKSUMS` manifest committed by `idea-generator`).

2. **Progress event JSONL validation is opt-in.** The gate only validates `idea_island_progress_v1.jsonl` *if the file exists*. A project could generate islands, never emit progress events, and still pass. Consider whether at least one `status: completed | abandoned | merged` terminal event per island should be required at campaign close (not necessarily at every gate check, but at a "finalize" gate).

3. **Opportunity pool is JSONL — no dedup key enforcement at the file level.** Two lines could carry the same `opportunity_id` with conflicting payloads. The schema validates per-line but not cross-line uniqueness. This matters because the failure-library query joins on `opportunity_id`.

4. **`failed_approach_v1.jsonl` append-only semantics are convention, not enforced.** Nothing in `validate_project_artifacts.py` checks monotonicity (no deletions/edits of earlier lines). For audit trail integrity, consider adding a line-count-only-grows assertion or a per-line `seq_id`.

5. **Tag vocabulary is open-ended.** `bootstrap_mechanism_tags`, `tags`, and `scope:*` values are free-form strings. For retrieval reliability (avoid-repeat closure), a controlled vocabulary or at least a `known_tags_v1.json` reference would reduce silent mismatches (e.g., `scope:out_of_scope` vs. `scope:out-of-scope`).

6. **No negative-test fixtures.** The validation scripts have passing examples but no deliberately-broken fixtures to prove the gate *rejects* bad input. This is standard schema-test hygiene.

## Real-research fit

The island/opportunity abstractions map well onto real HEP exploration patterns:

- **Islands as parallel hypotheses.** In pion GFF studies, one island might explore dispersive representations while another explores lattice-constrained sum rules. The `island_id` + plan artifact structure supports this cleanly.
- **Bootstrap opportunity pool.** This is a good fit for the bootstrap program in HEP (S-matrix bootstrap, conformal bootstrap, positivity bounds). The `bootstrap_mechanism_tags` field is directly useful for cross-referencing with known techniques (e.g., `["positivity_bounds","crossing_symmetry","unitarity_cut"]`).
- **Failure library closure.** The rejected-opportunity → veto → query-retrieval loop is the single most valuable safety feature for LLM-assisted theory work. It prevents the agent from rediscovering and re-proposing an idea that was already vetoed for physics reasons (e.g., violating a known positivity constraint). The demonstrated round-trip (veto record → index rebuild → query hit) is credible.
- **Extensibility beyond HEP.** The schemas use no HEP-specific required fields; domain specificity lives in tag values and evidence references. Extending to, say, condensed-matter bootstrap or amplitudes would require only new tag vocabularies, not schema changes. This is the right layering.

One gap: the opportunity card schema should probably carry an optional `arxiv_ids: string[]` field (or more generally `evidence_refs` should have a typed union: `{type: "arxiv", id: "2301.12345"}` vs. `{type: "inspire", id: "..."}` vs. `{type: "internal_artifact", path: "..."}`). Currently, if `evidence_refs` is just an array of strings, provenance quality depends entirely on convention.

## Robustness & safety

| Concern | Assessment |
|---------|-----------|
| **Hallucination mitigation** | Good: evidence refs are required (≥1), and the gate validates their presence. However, the gate does *not* validate that the referenced evidence actually exists on disk or resolves to a real arXiv ID. This is a known limitation. |
| **Provenance** | Adequate for this round. Append-only JSONL + failure library index gives a paper trail. Strengthen with `seq_id` or content hashing per line. |
| **Novelty / avoid-repeat** | The failure-library query hook is the primary mechanism. It works for the demonstrated case. Risk: if tag vocabularies drift, the query may miss relevant vetoes (see Non-blocking #5). |
| **Anti-pollution** | The review packet explicitly states examples-only in `idea-generator`. No research-run scaffolds appear to have leaked. The `docs/plans/examples/` path is appropriate. |
| **Schema poisoning** | If an agent writes a syntactically valid but semantically nonsensical island plan (e.g., `"hypothesis": "asdfghjkl"`), the schema gate will pass. Consider adding a minimum-length or non-empty-meaningful-content check for key string fields, or flag this as a future LLM-output-quality gate. |

## Specific patch suggestions

### 1. `idea-runs/Makefile` — Add schema-sync check

```makefile
# Add target
SCHEMA_SSOT_DIR ?= ../idea-generator/schemas
check-schema-sync:
	@for f in schemas/idea_island_plan_v1.schema.json \
	          schemas/idea_island_registry_v1.schema.json \
	          schemas/idea_island_progress_event_v1.schema.json \
	          schemas/bootstrap_opportunity_card_v1.schema.json; do \
	  if ! diff -q "$$f" "$(SCHEMA_SSOT_DIR)/$$(basename $$f)" >/dev/null 2>&1; then \
	    echo "DRIFT: $$f differs from SSOT"; exit 1; \
	  fi; \
	done
	@echo "All schema snapshots match SSOT."

# Wire into existing validate
validate: check-schema-sync validate-project
```

### 2. `idea-generator/schemas/bootstrap_opportunity_card_v1.schema.json` — Strengthen `evidence_refs`

Change `evidence_refs` from `{"type": "array", "items": {"type": "string"}, "minItems": 1}` to a typed-ref union:

```json
"evidence_refs": {
  "type": "array",
  "minItems": 1,
  "items": {
    "type": "object",
    "required": ["ref_type", "ref_id"],
    "properties": {
      "ref_type": {
        "type": "string",
        "enum": ["arxiv", "inspire", "doi", "internal_artifact", "pdg", "other"]
      },
      "ref_id": { "type": "string", "minLength": 1 },
      "description": { "type": "string" }
    },
    "additionalProperties": false
  }
}
```

Apply the same change to `idea_island_plan_v1.schema.json` if it carries `evidence_refs`.

### 3. `idea-runs/scripts/validate_project_artifacts.py` — Add opportunity_id uniqueness check

After the per-line JSONL validation loop for `bootstrap_opportunity_pool_v1.jsonl`, add:

```python
# After: for i, line in enumerate(lines): ...
seen_ids = {}
for i, record in enumerate(parsed_records):
    oid = record.get("opportunity_id")
    if oid in seen_ids:
        errors.append(
            f"bootstrap_opportunity_pool_v1.jsonl: duplicate opportunity_id "
            f"'{oid}' at lines {seen_ids[oid]} and {i+1}"
        )
    seen_ids[oid] = i + 1
```

### 4. `idea-runs/scripts/validate_project_artifacts.py` — Add island_id uniqueness in registry

Same pattern for `idea_island_registry_v1.json`:

```python
island_ids = [entry["island_id"] for entry in registry.get("islands", [])]
if len(island_ids) != len(set(island_ids)):
    errors.append("idea_island_registry_v1.json: duplicate island_id values")
```

### 5. `idea-generator/docs/plans/examples/` — Add negative test fixtures

Add a directory `docs/plans/examples/2026-02-16-w6-01-islands-opportunities/invalid/` containing:

- `island_plan_missing_evidence.json` — plan with empty `evidence_refs`
- `opportunity_card_no_id.json` — card missing `opportunity_id`
- `registry_duplicate_island.json` — registry with duplicate `island_id`

Then in `scripts/validate_w6_islands_opportunities_schemas.py`, add a test mode:

```python
def test_negative_fixtures(invalid_dir, schema_map):
    """Every file in invalid/ must FAIL validation."""
    for path in sorted(invalid_dir.glob("*.json")):
        schema_key = infer_schema_from_filename(path.stem)
        try:
            jsonschema.validate(json.loads(path.read_text()), schema_map[schema_key])
            raise AssertionError(f"EXPECTED FAILURE but {path.name} passed validation")
        except jsonschema.ValidationError:
            print(f"  ✓ {path.name} correctly rejected")
```

### 6. `idea-generator/schemas/idea_island_plan_v1.schema.json` — Add `minLength` guards

For fields like `hypothesis`, `motivation`, `island_id`:

```json
"hypothesis": { "type": "string", "minLength": 20 },
"island_id":  { "type": "string", "pattern": "^[a-z0-9_-]{4,80}$" }
```

This prevents trivially empty or garbage-string artifacts from passing the gate, providing a minimal semantic floor without requiring NLP-level checking.

---

**Summary:** This is a well-structured round with clear gate enforcement, good failure-library closure, and sensible schema design. The six patches above are all non-blocking quality/robustness improvements. The design is ready to merge as-is; applying patches 1–4 before merge would meaningfully improve long-term maintainability.
