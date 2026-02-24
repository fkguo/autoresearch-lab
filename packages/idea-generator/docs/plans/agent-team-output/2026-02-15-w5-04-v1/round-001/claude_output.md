VERDICT: NOT_READY

## Blockers

### B1. Validation script does not perform JSON Schema validation against instances

`scripts/validate_w5_quality_schemas.py` only checks that each `.schema.json` file is valid JSON and (optionally) that each example file parses as JSON. It does **not** validate example instances against their declared schemas using `jsonschema.validate()`. This means the CI gate (`make validate`) cannot catch schema-example drift. When I ran `jsonschema.validate()` manually, examples like the `portability_report_v1` example passed—but only by luck. Without formal validation in CI, the quality-gate contract is unenforceable.

**Fix:** The validate script must `pip install jsonschema`, load each example's `schema_id`, resolve to the corresponding `.schema.json`, and run `jsonschema.validate(instance, schema)`. Fail hard on any `ValidationError`.

### B2. `additionalProperties` is not set on any schema

None of the seven schemas set `"additionalProperties": false` (or even `true` explicitly). This means any arbitrary key can appear in a conforming artifact, defeating the purpose of a quality gate. An agent could emit `{"schema_id": "scope_classification_v1", "garbage": true}` and technically pass. For contracts that enforce evidence-first discipline, open schemas are a safety hole.

**Fix:** Every schema must set `"additionalProperties": false` at the top level (and in nested `object` definitions where appropriate). Where extensibility is desired, add an explicit `"extensions": {"type": "object"}` property.

### B3. `core_loop_execution_audit_v1` steps lack `required` on item-level properties

The `steps` array specifies `items` with `properties` but no `required` array on the item object schema. An empty object `{}` in the steps array would validate. This makes the "anti-skip" guarantee unenforceable—an agent can declare a step as present but omit `status`, `skipped_reason`, or even `step_name`.

**Fix:** Add `"required": ["step_name", "status"]` (minimum) inside `steps.items`, and add `"minItems": 1` on the `steps` array itself.

### B4. `literature_search_evidence_v2` entries array items lack `required`

The `entries` array items define properties (`source`, `role`, `family`, `summary`, `url`) but have no `required` constraint on the item schema. An entry of `{}` validates. For an evidence-first system, every literature entry must at minimum have `source` and `role`.

**Fix:** Add `"required": ["source", "role"]` inside `entries.items`.

## Non-blocking

### N1. No `$schema` or `$id` declared in any schema file

None of the seven schemas declare `"$schema": "http://json-schema.org/draft-07/schema#"` or a `"$id"`. While functional, this hurts tooling interoperability (IDE autocomplete, external validators, schema registries). Add both to every schema.

### N2. `scope_classification_v1` non-citation semantics are implicit, not enforced

The checklist doc says "non-citation scope grading" but the schema has no explicit mechanism to prevent or flag citation-count-based scope claims. Consider adding a `"novelty_basis"` field with enum `["structural", "methodological", "phenomenological", "conceptual"]` and a `"citation_independent": true` boolean (or at minimum a `description` annotation on the `scope_grade` property stating it must not depend on citation metrics).

### N3. Examples are minimal but could be more pedagogically useful

The example JSONs validate but are bare-minimum. Adding one-line comments (via a `_comment` field, since JSON has no comments) showing "why this value" would help downstream agent developers understand intent. Not blocking but high leverage for adoption.

### N4. `numerics_validation_report_v1` has no `tolerance` or `convergence_criterion` field

The schema tracks validation results but doesn't require specifying what tolerance was used or what convergence criterion was applied. For reproducibility, add optional fields `"tolerance": {"type": "number"}` and `"convergence_criterion": {"type": "string"}`.

### N5. `method_fidelity_contract_v1` could benefit from `approximations` array

The contract tracks method choice but doesn't have a structured place to enumerate approximations/assumptions (e.g., "leading order", "narrow-width approximation", "massless limit"). Consider adding `"approximations": {"type": "array", "items": {"type": "object", "properties": {"name": ..., "justification": ..., "expected_impact": ...}}}`.

### N6. Makefile `validate` target should fail-fast on missing `jsonschema` dependency

Currently if `jsonschema` is not installed, the validate script may silently degrade. The Makefile should either install it in a venv or fail with a clear message.

### N7. `portability_report_v1` should enumerate concrete interface requirements

The schema currently tracks portability at a narrative level. Adding a `"required_interfaces"` array (schema_ids or artifact types the portable component depends on) would make cross-domain reuse machine-checkable.

## Real-research fit

**Strengths:**
- The schema set covers the critical quality gates for an idea-generation pipeline: scope, method, literature, numerics selection, numerics validation, portability, and execution audit.
- The separation of `numerics_method_selection` from `numerics_validation_report` correctly models the design→validate lifecycle.
- `literature_search_evidence_v2` with role/family/coverage/gap is exactly what's needed for evidence-first HEP research—it maps cleanly onto how a physicist evaluates whether a literature review is complete.
- `core_loop_execution_audit_v1` is architecturally sound as an anti-skip mechanism—it makes the pipeline introspectable.
- No HEP-specific terms leak into schemas (confirmed by automated scan). Examples are appropriately generic. This supports the "HEP first, then broader" extensibility goal.

**Gaps for real use:**
- A working physicist or research agent needs to know **when** each gate fires in the pipeline. The checklist doc lists schemas but doesn't specify gate ordering or dependency (e.g., "method_fidelity_contract must pass before numerics_method_selection is accepted"). This is critical for real orchestration.
- No schema addresses **novelty assessment** as a first-class artifact (distinct from scope classification). In practice, the idea-generator's core value proposition is novelty—there should be a dedicated `novelty_assessment_v1.schema.json` or the scope schema needs a richer novelty sub-object.

## Robustness & safety

**Provenance:** Schemas include `schema_id` and `schema_version` in most examples but these are not **required** fields in the schemas themselves. This is a provenance gap—every artifact must self-declare its schema for audit trails. (See patch suggestion below.)

**Hallucination mitigation:** The `literature_search_evidence_v2` schema is the primary anti-hallucination gate, but it doesn't require a `"verification_status"` field on entries (e.g., "url_checked", "abstract_confirmed", "not_verified"). Without this, an LLM can fabricate plausible-looking literature entries. Add a `"verification_status"` enum to each entry.

**Anti-skip safety:** As noted in B3, the current `core_loop_execution_audit_v1` is structurally correct but has no `required` on step items, making it bypassable.

**Schema evolution:** No schema declares a `"version"` at the schema level (distinct from `schema_version` in the data). When schemas evolve, there's no machine-readable way to detect version mismatches. Add a top-level `"version"` property to each schema file.

## Specific patch suggestions

### Patch 1: `scripts/validate_w5_quality_schemas.py` — Add real schema validation

**File:** `scripts/validate_w5_quality_schemas.py`
**Change:** After the existing JSON-parse checks, add:

```python
from jsonschema import validate, Draft7Validator, ValidationError
import sys

errors = []

# 1. Validate each schema is well-formed JSON Schema
for schema_file in sorted(glob.glob("schemas/*.schema.json")):
    with open(schema_file) as f:
        schema = json.load(f)
    try:
        Draft7Validator.check_schema(schema)
    except Exception as e:
        errors.append(f"INVALID SCHEMA {schema_file}: {e}")

# 2. Validate each example against its declared schema
for example_file in sorted(glob.glob("docs/plans/examples/2026-02-15-w5-04-gates/*.json")):
    with open(example_file) as f:
        instance = json.load(f)
    schema_id = instance.get("schema_id")
    if not schema_id:
        errors.append(f"{example_file}: missing schema_id")
        continue
    schema_path = f"schemas/{schema_id}.schema.json"
    if not os.path.exists(schema_path):
        errors.append(f"{example_file}: schema {schema_path} not found")
        continue
    with open(schema_path) as f:
        schema = json.load(f)
    try:
        validate(instance=instance, schema=schema)
    except ValidationError as e:
        errors.append(f"{example_file}: {e.message} at {list(e.absolute_path)}")

if errors:
    for e in errors:
        print(f"FAIL: {e}", file=sys.stderr)
    sys.exit(1)
else:
    print("All schemas valid, all examples conform.")
```

### Patch 2: All 7 schemas — Add `additionalProperties`, `$schema`, `$id`, and require `schema_id`/`schema_version`

**Files:** All `schemas/*.schema.json`
**Change:** Add to each schema's top-level object:

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "$id": "https://idea-generator.hepar.dev/schemas/<SCHEMA_NAME>.schema.json",
  "additionalProperties": false
}
```

And ensure `"schema_id"` and `"schema_version"` appear in the `"required"` array of every schema.

### Patch 3: `schemas/core_loop_execution_audit_v1.schema.json` — Enforce step requirements

**File:** `schemas/core_loop_execution_audit_v1.schema.json`
**Change:** Inside `properties.steps.items`, add:

```json
"required": ["step_name", "status"],
"additionalProperties": false
```

And on `properties.steps`, add:

```json
"minItems": 1
```

### Patch 4: `schemas/literature_search_evidence_v2.schema.json` — Enforce entry requirements and add verification

**File:** `schemas/literature_search_evidence_v2.schema.json`
**Change:** Inside `properties.entries.items`, add:

```json
"required": ["source", "role"],
```

And add a new property inside each entry item:

```json
"verification_status": {
  "type": "string",
  "enum": ["url_verified", "abstract_confirmed", "full_text_checked", "not_verified"],
  "description": "How thoroughly this entry has been verified against external sources"
}
```

### Patch 5: `schemas/scope_classification_v1.schema.json` — Make non-citation semantics explicit

**File:** `schemas/scope_classification_v1.schema.json`
**Change:** Add property:

```json
"novelty_basis": {
  "type": "string",
  "enum": ["structural", "methodological", "phenomenological", "conceptual", "computational"],
  "description": "Primary dimension of novelty. Must not depend on citation counts or impact metrics."
}
```

And add `"novelty_basis"` to `"required"`.

### Patch 6: `docs/plans/2026-02-15-w5-04-quality-gates-checklist-v1.md` — Add gate ordering section

**File:** `docs/plans/2026-02-15-w5-04-quality-gates-checklist-v1.md`
**Change:** Add a new section:

```markdown
## Gate Execution Order

Quality gates must be evaluated in this dependency order:

1. `scope_classification_v1` — Must pass before any downstream gates
2. `literature_search_evidence_v2` — Required before method selection
3. `method_fidelity_contract_v1` — Required before numerics
4. `numerics_method_selection_v1` → `numerics_validation_report_v1` (sequential pair)
5. `portability_report_v1` — Evaluated after method+numerics gates pass
6. `core_loop_execution_audit_v1` — Generated at pipeline completion, audits all above

Gates 2-3 may run in parallel if scope gate has passed.
```

### Patch 7: `Makefile` — Add jsonschema dependency check

**File:** `Makefile`
**Change:** In the `validate` target, before running the Python script:

```makefile
validate:
	python3 -c "import jsonschema" 2>/dev/null || (echo "ERROR: jsonschema not installed. Run: pip install jsonschema" && exit 1)
	python3 scripts/check_no_test_instance_pollution.py
	python3 scripts/validate_w5_quality_schemas.py
```
