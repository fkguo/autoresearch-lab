VERDICT: READY

## Blockers

None identified against the five M0.2 acceptance criteria. Each criterion is satisfied by the packet as summarized:

1. **Layer split explicit and enforced:** Control-plane lives in `docs/research/pion-gff-bootstrap/` (Markdown tracker, gate artifacts, sync/); compute-plane lives in `research/pion_gff_bootstrap/` (Julia `Project.toml`, `src/`, `bin/run.jl`). The split is structural (separate directory trees, separate languages), and the only coupling point is the I/O contract (`config.json` → `results.json`). No evidence that idea-core calls Julia internals or that Julia code imports control-plane logic.

2. **Compute-plane I/O contract specified and stable:** `config.json` input schema (run_id, physics params, bootstrap method + constraints, objective targets, numerics threads/tolerances) and `results.json` output schema (bounds on D^π(0), r_g², stability metadata, provenance) are enumerated. Keys are named. This is sufficient for an M0.2 design-level contract.

3. **Modern bootstrap insertion point concrete; pure dispersive reproduction avoided:** The pipeline explicitly generates families of elastic partial waves (t_0^0, t_2^0) using modern bootstrap constraints (citing 2410.23333, 2403.10772, 2505.19332), then propagates to GFF bounds via envelopes. The main method is *not* a dispersive reproduction; it is a bootstrap-constrained envelope. The dispersive integral is used only as a mapping tool (frozen observables from partial-wave families → GFF values), not as the primary scientific claim.

4. **Evidence-first gate requirements specified and framed for automation:** M0.2 gate requires a design-doc artifact, review bundle, and dual-review outputs (Opus + Gemini-2.5-Pro) with meta + trace artifacts. This is machine-checkable in principle (file existence, JSON schema validation on review artifacts). Intent to automate is stated via MilestoneGate artifacts + validators + wrappers.

5. **"Don't forget" encoded as gate artifacts:** The packet explicitly states that workflow rules are implemented as ecosystem primitives (MilestoneGate artifacts + validators), not prose-only. The gate definition enumerates required artifact paths. A plan to enforce in M0.3 via automated validators/wrappers is stated.

## Non-blocking

1. **`results.json` schema lacks explicit JSON Schema or TypeScript-style type definition.** The keys are listed in prose but not as a machine-parseable schema file (e.g., `schemas/results.schema.json`). This is fine for M0.2 design but should be formalized before M0.3 implementation begins.

2. **Dual-review model names should be pinned with date/version.** "Opus" and "gemini-3-pro-preview" are model families; exact snapshot IDs (e.g., `claude-3-opus-20240229`, `gemini-2.5-pro-preview-05-06`) should appear in the gate artifact metadata for reproducibility. Not a blocker because M0.2 only requires the *design* of the gate, not its execution.

3. **Truncation envelope specification is qualitative.** "Conservative envelope family; report dependence" is stated but the parameterization (e.g., how many envelope members, what functional form above `elastic_t_max`) is not yet pinned. Acceptable at M0.2 design level; needs quantitative spec by M0.3.

4. **`sync/` directory purpose is implicit.** Presumably this is where control-plane ↔ compute-plane artifacts are exchanged. A one-line README or a sync manifest schema would clarify the contract.

5. **No explicit error/failure contract.** What does `results.json` look like when the solver fails, or when a bootstrap constraint is infeasible? A `status` field with enum values (`success | partial | failed`) and an `errors` array would make the contract robust to runtime failures in M0.3.

6. **Evidence anchor TeX paths are "local path recorded" but no canonical naming convention is stated.** If multiple runs reference different TeX extracts, a naming convention (e.g., `evidence/{arxiv_id}/eq_{label}.tex`) would prevent drift.

## Real-research fit

**Strong.** The physics pipeline is well-scoped and realistic for a laptop-bounded project:

- **Elastic-only with inelastic truncation envelopes** is a defensible simplification that avoids the coupled-channel complexity explosion while honestly reporting systematic uncertainty. This mirrors standard practice in rigorous S-matrix bootstrap work.
- **The bootstrap references are current and relevant.** 2410.23333 (Guerrieri–Penedones–Vieira style pion bootstrap), 2403.10772, and 2505.19332 represent the state of the art in applying modern S-matrix bootstrap to low-energy hadron physics. The pipeline correctly positions itself as *applying* these methods to GFF extraction rather than reproducing them.
- **Frozen observables (D^π(0) and r_g²)** are physically meaningful and directly comparable to lattice QCD and phenomenological extractions, making the results publishable or at minimum citeable as a cross-check.
- **The evidence-first workflow is genuinely useful for HEP.** Tracing each bound to specific partial-wave configurations and specific equations in specific papers is exactly the kind of provenance that reviewers and collaborators need. This is a real workflow improvement, not just process theater.

One concern for real-research fit (non-blocking): the design does not mention how the bootstrap constraints themselves will be validated. In practice, one would want to check that the partial-wave families satisfy crossing symmetry, unitarity, and Froissart bounds to the stated precision. A "bootstrap constraint validation" step (even if it's just a checklist item in the gate) would strengthen the physics credibility.

## Robustness & safety

**Hallucination mitigation:**
- The evidence-anchor mechanism (local TeX file paths for specific equations from specific papers) is a strong anti-hallucination measure. If a claim cannot be traced to a recorded equation, it fails the gate. This is well-designed.
- Dual-review (two independent LLMs) provides a second line of defense. However, the packet does not specify what happens when the two reviewers *disagree*. A conflict-resolution protocol (e.g., human escalation, third reviewer, or conservative-default) should be specified by M0.3.

**Provenance:**
- `run_id` in both config and results provides traceability. The `provenance` field in `results.json` should include at minimum: git commit hash, config hash, Julia environment hash (`Manifest.toml` hash), and wall-clock time. The packet implies this but doesn't enumerate the sub-fields.

**Reproducibility:**
- `Manifest.toml` is included in the repo layout, which pins Julia dependencies. Good.
- `configs/` directory suggests multiple configurations can be tracked. Good.
- No mention of random seed management. If any stochastic element exists (e.g., random sampling of bootstrap-allowed partial waves), a seed field in `config.json` is needed.

**Safety against over-claiming:**
- The truncation envelope approach is inherently conservative (reports dependence on unknown inelastic contributions). This is a safety feature.
- The "frozen observables" approach (compute only D^π(0) and r_g², not the full form factor) limits the surface area for incorrect claims.

## Specific patch suggestions

### 1. `docs/research/pion-gff-bootstrap/m0.2-design.md` — Add machine-parseable I/O schema

**What to add:** After the prose description of `config.json` and `results.json`, insert a subsection with actual JSON Schema (or at minimum, a canonical example with types annotated):

```markdown
### Compute I/O Schema (v1)

#### config.json (canonical example)
```json
{
  "run_id": "string (UUID)",
  "physics": {
    "m_pi": 0.13957,
    "elastic_t_max": 0.7744,
    "partial_waves": ["t00", "t20"]
  },
  "bootstrap": {
    "method": "envelope",
    "constraints": ["unitarity", "crossing", "froissart"],
    "n_samples": 500,
    "seed": 42
  },
  "targets": {
    "observables": ["Dpi_0", "r_g2"]
  },
  "numerics": {
    "threads": 4,
    "tolerances": {"quad_rtol": 1e-8, "bootstrap_tol": 1e-6}
  }
}
```

#### results.json (canonical example)
```json
{
  "run_id": "string (matches config)",
  "status": "success | partial | failed",
  "bounds": {
    "Dpi_0": {"lower": -0.5, "upper": -0.2, "unit": "dimensionless"},
    "r_g2": {"lower": 0.3, "upper": 0.6, "unit": "fm^2"}
  },
  "stability": {
    "elastic_t_max_sensitivity": {},
    "n_samples_convergence": {}
  },
  "provenance": {
    "git_commit": "string",
    "config_sha256": "string",
    "manifest_sha256": "string",
    "wall_clock_s": 0.0,
    "julia_version": "string"
  },
  "errors": []
}
```
```

**Why:** Transforms prose contract into a testable artifact. Validators in M0.3 can check against this directly.

---

### 2. `docs/research/pion-gff-bootstrap/m0.2-design.md` — Add dual-review conflict resolution protocol

**Where:** In the gate definition section, after specifying dual-review requirement.

**What to add:**

```markdown
### Dual-Review Conflict Resolution (M0.2+)

If Opus and Gemini-2.5-Pro reviews disagree on any acceptance criterion:
1. The **conservative default** applies: the criterion is marked NOT_MET.
2. A `conflicts.json` artifact is generated listing each disagreement with both reviewers' reasoning.
3. Human review is required to resolve before the gate can pass.
4. In M0.3+, a third reviewer (Gemini-2.5-Flash or Claude Sonnet) may be used as a tiebreaker, but human override remains available.
```

**Why:** Without this, a split verdict leaves the gate in an undefined state.

---

### 3. `docs/research/pion-gff-bootstrap/m0.2-design.md` — Pin reviewer model versions

**Where:** Gate definition section.

**What to change:** Replace "Opus + gemini-3-pro-preview" with pinned identifiers:

```markdown
- Reviewer A: `claude-3-opus-20240229` (or latest available Opus snapshot; record exact model ID in review artifact metadata)
- Reviewer B: `gemini-2.5-pro-preview-05-06` (or latest; record exact model ID)
```

**Why:** Reproducibility of the gate itself. Model behavior drifts across snapshots.

---

### 4. `research/pion_gff_bootstrap/configs/` — Add a `README.md`

**What to add:**

```markdown
# Configs

Each `.json` file in this directory is a complete, self-contained run configuration
conforming to the compute I/O contract (see `docs/research/pion-gff-bootstrap/m0.2-design.md`).

Naming convention: `{run_id_short}_{description}.json`
Example: `001_baseline_elastic.json`

All configs MUST include a `seed` field for reproducibility.
```

**Why:** Prevents config sprawl and undocumented runs.

---

### 5. `docs/research/pion-gff-bootstrap/sync/README.md` — Define sync directory contract

**What to add (new file):**

```markdown
# Sync Directory

This directory is the exchange surface between the control-plane (idea-core) and
the compute-plane (Julia). Files placed here are artifacts that cross the boundary.

## Contract
- Control-plane WRITES: `config.json` files (copied from `research/.../configs/`)
- Compute-plane WRITES: `results.json` files (copied from `research/.../out/`)
- Gate validators READ from this directory.

## Naming
- `{run_id}.config.json`
- `{run_id}.results.json`

## Invariant
No file in `sync/` should be manually edited. All files are machine-generated copies.
```

**Why:** The sync directory is mentioned in the layout but its semantics are undefined. This prevents it from becoming a junk drawer.

---

### 6. `docs/research/pion-gff-bootstrap/m0.2-design.md` — Add bootstrap constraint validation checklist

**Where:** After the bootstrap insertion point description.

**What to add:**

```markdown
### Bootstrap Constraint Validation (pre-propagation)

Before propagating partial-wave families to GFF bounds, each family member must pass:
- [ ] Elastic unitarity: |S_l| ≤ 1 for all sampled t in [4m_pi^2, elastic_t_max]
- [ ] Correct threshold behavior: t_l^I(s) ~ (s - 4m_pi^2)^l near threshold
- [ ] Crossing symmetry: satisfied to within `bootstrap_tol`
- [ ] Froissart bound: no member grows faster than s·log²(s) (checked at diagnostic points)

Failed members are discarded with logging. If >50% of samples fail, the run is flagged as `partial` in results.json.
```

**Why:** Without this, the bootstrap families could contain unphysical members that contaminate the GFF bounds. This is a physics-safety issue.

---

### 7. `docs/research/pion-gff-bootstrap/tracker.md` — Add "don't forget" enforcement row

**Where:** In the milestone tracker table.

**What to add as a column or row:**

```markdown
| Milestone | Gate Artifacts Required | Validator | Enforcement |
|-----------|----------------------|-----------|-------------|
| M0.2 | design-doc, review-bundle, dual-review-{opus,gemini}.json | File-existence check + JSON schema check | Manual (M0.2); automated wrapper (M0.3+) |
| M0.3 | results.json, convergence-report, evidence-trace.json | Schema validator + provenance hash check | `bin/gate_check.jl` or `scripts/gate_check.sh` |
```

**Why:** This is the concrete encoding of the "don't forget" requirement as a table that can be programmatically parsed, not just a paragraph to be skimmed.
