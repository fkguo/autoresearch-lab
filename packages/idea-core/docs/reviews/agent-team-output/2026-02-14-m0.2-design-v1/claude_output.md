

I need to review this M0.2 design packet against the five acceptance criteria. Let me evaluate each systematically.

VERDICT: READY

## Blockers

None. All five acceptance criteria are satisfied in the packet as provided. Details below per criterion:

1. **Layer split explicit and enforced** ✅ — Control-plane lives under `docs/research/pion-gff-bootstrap/` (tracker, milestone docs, sync/); compute-plane is a self-contained Julia project under `research/pion_gff_bootstrap/` with its own `Project.toml`, `bin/run.jl`, `configs/`, `out/`. The I/O boundary (`config.json` → `results.json`) is the only coupling surface. idea-core never calls Julia internals; it only writes configs and reads results.

2. **Compute-plane I/O contract specified and stable** ✅ — Input schema (`config.json`: `run_id`, physics params, bootstrap method + constraints, objective targets, numerics threads/tolerances) and output schema (`results.json`: bounds on `D^π(0)` and `r_g²`, stability metadata, provenance) are enumerated with named top-level keys. Sufficient for M0.2 (design-level); actual JSON Schema validation is appropriately deferred to M0.3.

3. **Modern bootstrap insertion point concrete; pure dispersive reproduction avoided** ✅ — The pipeline explicitly generates an *allowed family* of elastic partial waves (`t_0^0`, `t_2^0`) using modern bootstrap constraints (citing 2410.23333 / 2403.10772 / 2505.19332), then propagates to GFF bounds via envelopes. The main method is bootstrap-driven bounding, not dispersive integral reproduction. The truncation envelope for inelastic thresholds is a separate, conservative layer.

4. **Evidence-first gate requirements specified with machine-checkable intent** ✅ — M0.2 gate requires: design doc artifact, review bundle, dual-review outputs (Opus + Gemini-2.5-Pro-preview) with meta + trace artifacts. Acceptance criteria are explicitly enumerated. The "machine-checkable intent" is present via the plan to implement `MilestoneGate` artifacts + validators + wrappers, framing the current prose criteria as the spec for those validators.

5. **"Don't forget" encoded as gate artifacts** ✅ — The design adopts the brainstorming stance of design-gate + explicit acceptance + evidence, but commits to implementing them as ecosystem primitives (`MilestoneGate` artifacts + validators + wrappers) rather than relying on prose checklists alone. The clear plan to enforce in M0.3 is stated ("implement as ecosystem primitives").

## Non-blocking

1. **`results.json` schema lacks explicit key names for stability metadata.** The packet says "stability + provenance" but doesn't enumerate sub-keys (e.g., `convergence_status`, `num_iterations`, `wall_time_s`, `git_sha`, `julia_version`). This won't block M0.2 acceptance but will cause friction at M0.3 implementation. Recommend pinning at least the top-level keys now.

2. **No explicit `schema_version` field in either `config.json` or `results.json`.** For a system designed to evolve across milestones, schema versioning should be baked in from the start.

3. **Dual-review model list is fragile.** "opus + gemini-3-pro-preview" is hardcoded. If a model is unavailable at review time, the gate definition should specify a fallback or minimum-two-distinct-provider rule rather than exact model names.

4. **Bootstrap reference paper coverage.** Three references are cited for the bootstrap insertion point (2410.23333 / 2403.10772 / 2505.19332), but the evidence-anchor mapping doesn't specify *which equations* from each paper anchor which constraints. This is acceptable at M0.2 design level but should be pinned before M0.3 implementation begins.

5. **Truncation envelope family is underspecified.** "Conservative envelope family; report dependence" is fine for design, but M0.3 will need a concrete parameterization (e.g., how many envelope members, what variation axis). Flag for M0.3 planning.

## Real-research fit

**Strong.** The design correctly identifies a real, publishable physics target (pion gravitational form factor bounds from bootstrap methods) and correctly scopes it:

- **Elastic-only + pion-only** is a legitimate first-principles simplification with well-understood systematics.
- **Bootstrap → GFF envelope propagation** is a genuinely modern approach that avoids the "reproduce known dispersive results" trap. The cited papers (especially 2505.19332, which is very recent) confirm this is at the frontier.
- **D^π(0) and r_g²** are the right minimal observables—they're the gravitational analogues of charge and charge radius, directly comparable to lattice and dispersive results.
- **Laptop ≤ 3 days** is realistic for elastic-only bootstrap with modest partial-wave truncation in Julia.

The dual-purpose framing (real physics + ecosystem R&D testbed) is well-handled: the physics pipeline is not contorted to serve the software goals, and the software gates are not so heavy as to impede the physics.

**One concern for real-research credibility:** The design should eventually specify how results will be compared against existing lattice/dispersive determinations (e.g., D^π(0) from 2411.13398, r_g² from dispersive analyses). This is a validation step, not a reproduction step—important distinction. Not needed for M0.2 but essential for M0.4+.

## Robustness & safety

### Evidence-first safety

- **Provenance:** The `results.json` contract includes provenance fields; the evidence-anchor system maps claims to specific papers + equations + local TeX paths. This is solid.
- **Hallucination mitigation:** Dual-review with distinct model providers is the right architectural choice. The gate requiring both reviews before acceptance creates a genuine cross-check.
- **Novelty checks:** Not explicitly mentioned but partially covered by the evidence-anchor requirement (you can't claim a result without citing the source equation). Recommend adding an explicit "novelty vs. reproduction" tag to result artifacts.

### Failure modes to watch

| Failure mode | Current mitigation | Recommendation |
|---|---|---|
| Control-plane silently modifies compute config | I/O contract boundary | Add config hash to `results.json` provenance |
| Bootstrap solver doesn't converge | "stability metadata" in output | Pin explicit convergence criteria in schema |
| Inelastic contamination underestimated | Truncation envelope | Require envelope width to be reported as % of central value |
| Gate reviewer models hallucinate approval | Dual-review requirement | Add requirement that review artifacts must contain specific checklist item verdicts, not just prose |
| `results.json` schema drifts across runs | Not yet mitigated | Add `schema_version` field |

### Ecosystem safety

The layer split (idea-core never touches Julia internals) is the single most important safety property. It means:
- Compute bugs don't propagate to control-plane state
- Control-plane orchestration errors can't corrupt intermediate physics results
- Each layer can be tested independently

This is well-designed.

## Specific patch suggestions

### Patch 1: Add schema versioning to I/O contract
**File:** `docs/research/pion-gff-bootstrap/m0.2-design.md` (Compute I/O Contract section)

Add to both `config.json` and `results.json` specifications:
```diff
  Input: config.json
+   schema_version: "0.2.0"  # semver; bump on any key addition/removal/rename
    run_id: ...
    ...

  Output: results.json
+   schema_version: "0.2.0"
+   config_sha256: "<hex digest of input config.json>"
    bounds: ...
```

### Patch 2: Pin stability/provenance sub-keys in results.json
**File:** `docs/research/pion-gff-bootstrap/m0.2-design.md` (Compute I/O Contract section)

```diff
  Output: results.json with bounds on D^pi(0) and r_g2 plus stability + provenance
+ Stability keys (minimum):
+   convergence_status: "converged" | "marginal" | "failed"
+   objective_value: float
+   num_iterations: int
+   wall_time_s: float
+ Provenance keys (minimum):
+   julia_version: string
+   git_sha: string
+   config_sha256: string
+   timestamp_utc: ISO-8601 string
```

### Patch 3: Make dual-review gate machine-checkable
**File:** `docs/research/pion-gff-bootstrap/m0.2-design.md` (Gate definition section)

```diff
  M0.2 gate requires: design doc, review bundle, dual review outputs
- (opus + gemini-3-pro-preview) with meta+trace artifacts
+ from ≥2 distinct LLM providers, each producing a structured verdict artifact:
+   {
+     "reviewer": "<model_id>",
+     "verdict": "READY" | "NOT_READY",
+     "blockers": [string],
+     "criteria_verdicts": {
+       "<criterion_id>": {"pass": bool, "evidence": string}
+     }
+   }
+ Gate passes iff: all reviewers emit READY AND all criteria_verdicts.pass == true
+ across all reviewers. Disagreements require human adjudication artifact.
```

### Patch 4: Add evidence-anchor equation pinning for bootstrap references
**File:** `docs/research/pion-gff-bootstrap/m0.2-design.md` (Evidence anchors section)

```diff
  Bootstrap insertion point: generate allowed family of elastic partial waves
  (t_0^0, t_2^0) using modern bootstrap constraints inspired by
- 2410.23333 / 2403.10772 / 2505.19332
+ 2410.23333 (§ TBD, positivity + crossing constraints on π–π amplitude)
+ 2403.10772 (§ TBD, S-matrix bootstrap setup for elastic scattering)
+ 2505.19332 (§ TBD, numerical bootstrap bounds methodology)
+ NOTE: Exact equation anchors to be pinned during M0.3 implementation planning,
+ recorded in tracker.md evidence_anchors table.
```

### Patch 5: Add "don't forget" enforcement spec for M0.3
**File:** `docs/research/pion-gff-bootstrap/m0.2-design.md` (Gate definition or new subsection)

```diff
+ ## M0.3 enforcement plan for workflow rules
+
+ The following M0.2 prose requirements MUST be implemented as programmatic
+ validators before M0.3 gate approval:
+
+ | Rule | Validator | Artifact |
+ |------|-----------|----------|
+ | Layer split respected | `check_no_julia_imports(control_plane_dir)` | pass/fail log |
+ | I/O contract stable | `jsonschema.validate(config, schema_v)` | validation report |
+ | Evidence anchors present | `check_anchors(results.json, anchor_table)` | anchor coverage report |
+ | Dual review completed | `count(review_artifacts) >= 2 AND all READY` | gate verdict JSON |
+ | Config provenance | `sha256(config.json) == results.json.config_sha256` | integrity check |
+
+ These validators are the "don't forget" mechanism: they run automatically
+ at gate time and block advancement on failure.
```

### Patch 6: Add truncation envelope reporting requirement
**File:** `docs/research/pion-gff-bootstrap/m0.2-design.md` (Truncation handling section)

```diff
  Truncation handling for t > elastic_t_max: conservative envelope family;
- report dependence
+ report dependence as:
+   envelope_width_abs: float  # max - min of observable across envelope family
+   envelope_width_rel: float  # envelope_width_abs / central_value
+   elastic_t_max_used: float  # GeV^2
+   n_envelope_members: int    # number of envelope family members sampled
+ These fields are REQUIRED in results.json when truncation is active.
```
