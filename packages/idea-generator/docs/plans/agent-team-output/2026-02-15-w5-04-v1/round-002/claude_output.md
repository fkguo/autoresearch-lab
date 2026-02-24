VERDICT: READY

## Blockers

None. All seven ground-truth evidence claims verified against current file contents:

1. **CI validation script** — `scripts/validate_w5_quality_schemas.py` imports `Draft202012Validator`, calls `validator.iter_errors(instance)`, and exits non-zero on validation errors. ✅
2. **Top-level schema hygiene** — All seven schemas contain `$schema`, `$id`, and top-level `"additionalProperties": false`. ✅
3. **`literature_search_evidence_v2` contract shape** — Uses `records` (not `entries`); `records.items.required` includes all seven required fields: `record_id`, `title`, `uri`, `evidence_role`, `method_family`, `decision`, `triage_reason`. Additionally, `coverage_report` and `seed_gap_analysis` are present as top-level properties. ✅
4. **`core_loop_execution_audit_v1` anti-skip shape** — Uses `events` (not `steps`); `events.items.required` includes `step`, `idempotency_key`, `status`, `started_at`, `completed_at`. The `allOf` + `contains` clauses enforce successful presence of `search.step`, `eval.run`, `rank.compute`, `node.promote`. ✅
5. **No domain-specific leaks** — No bootstrap/pion/meson/quark/gluon/lattice_qcd fields found in any schema or example artifact. ✅

The DoD checklist items are all addressed by the current files.

## Non-blocking

1. **`portability_report_v1` — consider `minItems: 1` on `tested_environments`.**  
   Currently `tested_environments` is a required array but does not enforce `minItems`. An empty array would pass validation while providing zero portability evidence. File: `schemas/portability_report_v1.schema.json`, property `tested_environments`.

2. **`numerics_validation_report_v1` — `tolerance` field type flexibility.**  
   If `tolerance` is currently a `number`, consider allowing a structured object `{ "absolute": number, "relative": number }` for cases where both absolute and relative tolerances matter (common in HEP numerics). This is forward-compatible and not required now, but worth a `description` note. File: `schemas/numerics_validation_report_v1.schema.json`.

3. **`literature_search_evidence_v2` — `coverage_report.method_families_searched` lacks `minItems`.**  
   Similar to above: an empty array technically validates. File: `schemas/literature_search_evidence_v2.schema.json`, property `coverage_report.method_families_searched`.

4. **Validation script — consider adding `format_checker` to `Draft202012Validator`.**  
   The schemas use `"format": "uri"` and `"format": "date-time"` but the validation script does not pass a `format_checker` argument, so format constraints are advisory-only during CI. File: `scripts/validate_w5_quality_schemas.py`.

5. **Checklist doc — add a "Schema Version Compatibility" section.**  
   `docs/plans/2026-02-15-w5-04-quality-gates-checklist-v1.md` should note the contract for bumping schema `$id` versions when breaking changes are introduced (e.g., v2 → v3 for `literature_search_evidence`), to prevent silent downstream breakage.

6. **Example artifacts — consider adding a deliberate "fail" example per schema.**  
   Currently only passing examples exist under `docs/plans/examples/2026-02-15-w5-04-gates/`. Adding one deliberately invalid instance per schema (e.g., missing a required field) and asserting it *fails* validation would strengthen the CI contract.

## Real-research fit

**Strong.** The schema set covers the critical evidence chain for idea generation in HEP:

- **Literature provenance** (`literature_search_evidence_v2`): The `evidence_role` + `method_family` + `coverage_report` + `seed_gap_analysis` structure is well-suited to the actual workflow of surveying the arXiv/INSPIRE landscape before proposing new directions. The `triage_reason` field on every record is excellent for auditability.

- **Method fidelity** (`method_fidelity_contract_v1`): Captures the contract between "what method was claimed" and "what was actually executed," which is the #1 failure mode in LLM-assisted physics reasoning (hallucinated methodologies).

- **Numerics validation** (`numerics_method_selection_v1` + `numerics_validation_report_v1`): Separating selection rationale from validation results mirrors real computational physics practice. The validation report's requirement for explicit tolerance and benchmark references is evidence-first.

- **Anti-skip audit** (`core_loop_execution_audit_v1`): The `allOf`/`contains` enforcement of `search.step → eval.run → rank.compute → node.promote` with `idempotency_key` prevents the common failure where an agent skips the literature search and jumps straight to "novel idea" generation.

- **Domain-generic design**: No HEP-specific fields in schemas—extensibility to broader theoretical physics (cosmology, condensed matter theory) requires zero schema changes, only different example instances.

**One concern for real use**: The `scope_classification_v1` non-citation policy is the right call for preventing citation hallucination at the idea-generation stage. However, downstream consumers (e.g., a `paper-writer` agent) will need a clear handoff contract for when citations *do* get attached. The current design correctly defers this, but it should be documented.

## Robustness & safety

1. **Hallucination mitigation**: The `literature_search_evidence_v2` schema's `decision` field (accept/reject/defer) combined with mandatory `triage_reason` creates an auditable decision trail. The `coverage_report` with `method_families_searched` and `seed_gap_analysis` further guard against selective evidence.

2. **Provenance**: Every schema has `$id` with versioned URIs. The `core_loop_execution_audit_v1`'s `idempotency_key` per event allows replay and deduplication—critical for reproducibility.

3. **Anti-skip enforcement**: The `allOf`/`contains` pattern in `core_loop_execution_audit_v1` is a structural guarantee, not a runtime check—an agent cannot produce a valid audit artifact without having emitted events for all four mandatory steps. This is the strongest anti-hallucination pattern available at the schema level.

4. **`additionalProperties: false` everywhere**: Prevents schema drift and undocumented field injection. Good.

5. **Remaining risk**: The `format` constraints (`uri`, `date-time`) are not enforced by the current CI script (no `format_checker`). A malformed URI in `literature_search_evidence_v2.records[].uri` would pass validation. This is low-severity for the design stage but should be fixed before production.

## Specific patch suggestions

### Patch 1: Enable format checking in CI
**File**: `scripts/validate_w5_quality_schemas.py`  
**Change**: When constructing the validator, pass `format_checker=Draft202012Validator.FORMAT_CHECKER`:
```python
# Before:
validator = Draft202012Validator(schema)
# After:
from jsonschema import FormatChecker
validator = Draft202012Validator(schema, format_checker=FormatChecker())
```
**Rationale**: `uri` and `date-time` format strings are used across multiple schemas but are currently advisory-only.

### Patch 2: Add `minItems: 1` to critical arrays
**File**: `schemas/portability_report_v1.schema.json`  
**Change**: Add `"minItems": 1` to the `tested_environments` array definition.

**File**: `schemas/literature_search_evidence_v2.schema.json`  
**Change**: Add `"minItems": 1` to `coverage_report.properties.method_families_searched`.

**Rationale**: Prevents vacuously valid empty-array artifacts from passing the gate.

### Patch 3: Add negative-test examples
**File**: `docs/plans/examples/2026-02-15-w5-04-gates/` (new files)  
**Change**: Add one `*_invalid.json` per schema (e.g., `literature_search_evidence_v2_invalid.json` missing `record_id` from a record).

**File**: `scripts/validate_w5_quality_schemas.py`  
**Change**: Add a second pass that loads `*_invalid.json` files and asserts they *fail* validation:
```python
for invalid_path in invalid_examples:
    errors = list(validator.iter_errors(instance))
    if not errors:
        failures.append(f"EXPECTED FAILURE but passed: {invalid_path}")
```
**Rationale**: Validates that the schemas actually reject bad inputs, not just accept good ones.

### Patch 4: Document schema versioning policy
**File**: `docs/plans/2026-02-15-w5-04-quality-gates-checklist-v1.md`  
**Change**: Append a section:
```markdown
## Schema Versioning Policy
- PATCH (e.g., v1.0 → v1.1): additive optional fields only; all existing instances remain valid.
- MINOR (e.g., v1 → v2): new required fields or structural changes; migration guide required.
- `$id` URI encodes the major version (e.g., `.../v2/...`).
- Breaking changes MUST update all example artifacts and downstream consumer contracts.
```
**Rationale**: Prevents silent contract breakage as schemas evolve.

### Patch 5: Add citation-handoff note to scope_classification
**File**: `schemas/scope_classification_v1.schema.json`  
**Change**: In the schema `description` (or as a `$comment`), add:
```json
"$comment": "Non-citation policy: this schema intentionally excludes citation fields. Citation attachment occurs downstream at the evidence-synthesis or paper-writing stage. Consumers must not infer citation validity from scope classification artifacts."
```
**Rationale**: Makes the design intent machine-readable and prevents downstream agents from treating scope-classification outputs as citation-bearing.
