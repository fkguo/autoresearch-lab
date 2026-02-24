VERDICT: READY

## Blockers

None.

## Non-blocking

1. **reviewer_b.resolved_model hardcoded to non-null `const`** — Severity: low. File: `schemas/milestone_gate_v1.schema.json`, key `review.reviewer_b.resolved_model`. The schema forces `resolved_model` to `const: "gemini-3-pro-preview"` while also declaring `fallback_reason: { "type": "null" }`. If a fallback actually fires (e.g., Gemini is unavailable and a different model resolves), the gate document cannot be expressed at all — `resolved_model` would differ and `fallback_reason` would be non-null. This means a legitimate fallback scenario is structurally unrepresentable. Consider relaxing `resolved_model` to `{ "type": "string" }` and `fallback_reason` to `{ "type": ["string", "null"] }` in a future version, while keeping the example as-is.

2. **Top-level `allOf` conditional is a tautology** — Severity: cosmetic. File: `schemas/milestone_gate_v1.schema.json`, root `allOf[0]`. The `if` checks both verdicts are `READY` then requires `both_ready: true`, but `both_ready` is already `const: true` unconditionally in the `review` object. The conditional adds no additional constraint. Not harmful, but adds schema noise. Could be removed for clarity.

3. **`literature.new_retrieval_count` minimum 5 may be too tight for early milestones** — Severity: design note. If a milestone involves a narrow sub-topic, requiring ≥5 new retrievals may force padding. Acceptable for v1 but worth revisiting.

4. **Tracker entry is in Chinese** — Severity: style. File: `docs/plans/2026-02-12-implementation-plan-tracker.md`. Consistent with prior entries, so not a blocker, but limits accessibility for non-Chinese-reading collaborators.

## Real-research fit

The milestone gate schema enforces the right invariants for an automated idea-generation pipeline:

- **Dual-review lock** (`reviewer_a.model=opus`, `reviewer_b.requested_model=gemini-3-pro-preview`, `both_ready=true`) prevents single-model rubber-stamping — critical for reducing hallucinated novelty claims.
- **Scope ↔ NOT_FOR_CITATION coupling** via `allOf` conditional is well-designed: ecosystem/preliminary scopes cannot omit the non-citation marker, which is essential for HEP community norms around preliminary results.
- **Core-loop anti-skip** (`steps_executed` must contain all four canonical steps, `failed_approach_count >= 1`, five required artifact refs) prevents completion claims that skip the search→eval→rank→promote pipeline. The `failed_approach_count >= 1` constraint is a thoughtful forcing function — it ensures the system has explored and rejected at least one avenue, which is a meaningful proxy for genuine exploration.
- **Literature retrieval floor** (`new_retrieval_count >= 5`) ensures the gate isn't passed on stale data.

This is a solid machine-checkable contract for gating milestone promotion in an automated research workflow.

## Robustness & safety

- **Validation pipeline consumed correctly**: `SCHEMA_FILES` and `EXAMPLE_MAP` in `validate_w5_quality_schemas.py` both include the new schema and example. `make validate` passes per evidence.
- **Checklist updated**: `docs/plans/2026-02-15-w5-04-quality-gates-checklist-v1.md` lists both the schema file and the example file, and adds the three mandatory gate check bullets (dual review lock, scope policy mirror, core-loop refs + failed_approach).
- **Tracker is append-only**: Single line appended, no deletions or reorderings.
- **Example validates against schema**: The example has all required fields with correct types/values. `additionalProperties: false` on all sub-objects ensures no silent drift.
- **`additionalProperties: false` everywhere**: Good — prevents undeclared fields from sneaking through.

One minor safety note: the `artifact_refs` patterns (`^(artifacts/|file://)`) allow `file://` URIs. In a sandboxed pipeline this is fine, but if gate documents are ever consumed by a web-facing service, `file://` refs could be a vector. Not a blocker for current scope.

## Specific patch suggestions

1. **Future-proof fallback representability** (non-blocking, `schemas/milestone_gate_v1.schema.json`):
```json
// reviewer_b: change resolved_model and fallback_reason to:
"resolved_model": { "type": "string", "minLength": 1 },
"fallback_reason": { "type": ["string", "null"] }
// Then add a conditional: if fallback_reason is null, resolved_model must equal requested_model.
```

2. **Remove tautological root `allOf`** (cosmetic, `schemas/milestone_gate_v1.schema.json`):
```diff
-  "allOf": [
-    {
-      "if": { ... both verdicts READY ... },
-      "then": { ... both_ready: true ... }
-    }
-  ],
   "additionalProperties": false
```
Since `both_ready` is already `const: true`, this block is redundant.
