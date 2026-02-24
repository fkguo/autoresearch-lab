VERDICT: NOT_READY

## Blockers

### B1 — No cross-solver consistency gate for full-PSD SDP outputs

The smoke snapshot reveals a ~70% relative discrepancy on the upper bound between SCS (28.53) and COSMO (16.96) at $Q^2 = 2\,\text{GeV}^2$. The packet correctly *documents* this, but does **not** enforce a machine-checkable consistency gate. In an evidence-first, fail-closed architecture this is a hard gap: any downstream increment that consumes these bounds (e.g., an island-tightening step, a dashboard comparison, or an automated evidence note) can silently ingest solver-dependent width without tripping any validation. The existing mainline SOCP already has a cross-solver audit; the new full-PSD pathway must have parity.

**Fix (small, high-leverage):** Add a new gate kind `cross_solver_consistency` to `validate_project_artifacts.py`. When two or more compute configs share the same `(kernel, grid, constraints)` triple but differ in `solver`, the gate must:
1. Load the corresponding result artifacts.
2. Check that relative bound widths agree within a configurable tolerance (suggested default: 15% symmetric on each of lower/upper).
3. Fail-closed (block the project) if no matching pair exists *or* if the pair exceeds tolerance.

This is distinct from "the physics being wrong" — it's an *infrastructure contract* ensuring that evidence artifacts are solver-stable before they can be cited.

### B2 — Float comparison semantics in s-grid binding are unspecified

The gate description says `s_grid_mpi2[]` matching uses "strict float binding." JSON serialization of IEEE 754 doubles is not round-trip exact across all toolchains (Julia `JSON.print` vs Python `json.dumps` can differ at ULP level). If the Python validator does naive `==` on parsed floats against values emitted by the Julia kernel, the gate is **silently fragile** — it will pass on one CI image and fail on another, which is the opposite of fail-closed.

**Fix:** Specify comparison semantics explicitly in the schema doc and validator:
- Option A (recommended): Canonical representation — require all `s_grid_mpi2` values to be expressed as rational multiples of $m_\pi^2$ stored as exact integer numerator/denominator pairs, with float conversion only at compute time.
- Option B (acceptable): Relative tolerance `|a-b|/max(|a|,|b|) < 1e-12` with a documented rationale.
- The chosen semantics must be unit-tested (`test_s_grid_float_binding`) with an adversarial case (e.g., `4.00000000000000035` vs `4.0`).

---

## Non-blocking

### N1 — Missing content-hash binding on constraint artifacts (TOCTOU risk)

Between `validate_project_artifacts.py` running and the Julia kernel actually reading the constraint JSON, the file could be edited. For a laptop-local workflow this is low-risk, but the artifact contract should include a `sha256` field in the compute config referencing the constraint file. This is consistent with the existing pattern for spectral-function artifacts. Low urgency; fine to defer to W6-37.

### N2 — No solver-tolerance convergence sweep

A single `(SCS, eps=1e-3)` and `(COSMO, eps=1e-4)` pair is insufficient to distinguish "solver hasn't converged" from "formulation is loose." A minimal sweep (`eps ∈ {1e-3, 1e-4, 1e-5}` for each solver at grid80) with a convergence-plateau check would cost ~minutes on laptop and would let you separate formulation looseness from numerical noise. Not blocking because the packet doesn't claim physics, but it should be a TODO in the evidence note.

### N3 — Schema version not pinned in compute config

The compute configs reference `s_matrix_constraints_s0_v1.json` by filename, but don't record `"schema_version": "s_matrix_constraints_v1"` as a first-class field. If the schema evolves to `v2`, old compute configs will silently validate against the new schema (or fail opaquely). Add a `"constraint_schema_version"` field and have the validator assert match.

### N4 — Placeholder $|S| \le \eta(s)$ semantics not documented

The evidence note correctly says "disk-only placeholder," but the actual functional form of $\eta(s)$ used in the smoke runs is not recorded in the constraint artifact or compute config. For reproducibility, the constraint artifact should contain either the analytic expression or a tabulated $\eta(s_i)$ array with provenance (e.g., "elastic unitarity: $\eta=1$ for $4m_\pi^2 \le s \le 16m_\pi^2$; $\eta=0.95$ above" or whatever was actually used).

### N5 — Evidence note should record wall-clock times

The grid200 run was "aborted" as too slow, but no wall-clock estimate is recorded. Even a rough `> 20 min on [machine spec]` is valuable for planning scale-up and for the failure library.

---

## Real-research fit

**Strong points:**

1. The separation of *tooling readiness* from *physics tightening readiness* is exactly right and is clearly maintained throughout the packet. The interpretation paragraph in the smoke-run section is a model of how to frame incremental computational evidence.

2. The choice to implement the S-matrix constraint as an *input contract* (validated artifact) rather than as inline code in the SDP kernel is architecturally sound. It means (a) the same constraint artifact can be consumed by different kernels (SOCP, full-PSD, future ADMM), and (b) the constraint itself becomes a first-class auditable object with provenance — essential for evidence-first workflows.

3. The pion-only, no-coupled-channel scope discipline is holding well. The `partial_wave_label` field in the schema is forward-compatible with future $S2$, $D0$ extensions without requiring schema-breaking changes.

**Gaps relative to real HEP bootstrap practice:**

- The most impactful tightening in the Paulos/He/Su program comes not from $|S|\le 1$ (which is what the disk constraint encodes) but from **crossing symmetry + Mandelstam analyticity** constraints on the partial-wave amplitude. The current architecture has no slot for crossing-symmetry constraints. This is fine for the current scope but should be flagged as a first-class schema extension point (see patch suggestions).

- For the $\hat\Theta^\pi$ form factor specifically, the connection between the spectral function $\rho_\Theta(s)$ and the $S$-matrix is through the **Omnès representation** (or its generalization). The current full-PSD formulation seems to treat $|S(s)|$ as a box constraint rather than linking it to $\rho$ via the Omnès phase. This limits how much the S-matrix constraint can actually tighten the island. This is a physics-architecture concern, not a software one, but it should be documented as a known limitation in the evidence note.

**Recommendation on reviewer question 3** (He/Su-style halfspaces vs. drop full-PSD for SOC-tightening):

Neither in isolation. The credible next step is:

1. **Short-term (W6-37):** Fix blockers B1/B2, add tolerance sweep (N2), and run the stabilized full-PSD at grid80 to establish a *solver-converged baseline*. This determines whether the formulation is loose (physics) or just noisy (numerics).

2. **Medium-term (W6-38–39):** If the converged full-PSD baseline is still no tighter than SOCP, the disk constraint is genuinely uninformative and the full-PSD pathway should be **parked** (not deleted — keep the kernel and smoke evidence). Instead, invest in encoding the Omnès phase constraint as a **rotated second-order cone** within the existing SOCP framework. This is laptop-feasible, stays in proven solver territory, and directly couples $S$-matrix phase information to $\rho_\Theta(s)$.

3. **Only if (2) saturates:** Revisit full-PSD with He/Su-style halfspace inner-approximations of the Argand-diagram region, which requires $O(N_{\text{halfspaces}} \times N_s)$ additional linear constraints but no new conic structure.

---

## Robustness & safety

| Aspect | Assessment |
|---|---|
| **Fail-closed gating** | Partially achieved. The s-grid binding gate is correctly fail-closed in intent but fragile in implementation (B2). The cross-solver gate is absent (B1). All other existing gates pass per receipts. |
| **Provenance** | Good. Constraint artifacts have version tags, grid specs, and partial-wave labels. Missing: content hashes (N1) and $\eta(s)$ functional form (N4). |
| **Hallucination mitigation** | Excellent discipline. The packet explicitly flags that smoke bounds are *wider* than mainline and does not claim tightening. The "not READY for tightening" framing in `draft.md` is appropriate. |
| **Novelty / overclaim** | No overclaim detected. The only novelty claim is architectural (the gate + contract), which is verifiable. |
| **Reproducibility** | Partial. Compute configs specify solver + tolerance + grid, but wall-clock and $\eta(s)$ are missing (N4, N5). Julia environment (Manifest.toml pinning) not mentioned — important for SDP solver version reproducibility. |
| **Extensibility** | Good for partial-wave and grid extensions. Missing: crossing-symmetry constraint slot (see patch below). |

---

## Specific patch suggestions

### Patch 1 — Add cross-solver consistency gate (Blocker B1)

**File:** `idea-runs/scripts/validate_project_artifacts.py`

After the existing `s_matrix_constraints` grid-binding check, add a new validation pass:

```python
# --- Cross-solver consistency gate (full-PSD and any multi-solver kernel) ---
def check_cross_solver_consistency(project_dir, configs, tolerance_rel=0.15):
    """Fail-closed: if two configs share (kernel, grid_hash, constraints_hash)
    but differ in solver, their result artifacts must agree within tolerance."""
    from collections import defaultdict
    groups = defaultdict(list)
    for cfg in configs:
        key = (cfg["kernel"], cfg["grid_hash"], cfg.get("constraints_hash"))
        groups[key].append(cfg)
    for key, cfgs in groups.items():
        solvers = {c["solver"]["name"] for c in cfgs}
        if len(solvers) < 2:
            continue
        results = [load_result_artifact(c) for c in cfgs if result_exists(c)]
        if len(results) < 2:
            raise GateError(
                f"Cross-solver gate: kernel={key[0]} has {len(solvers)} solvers "
                f"but only {len(results)} result artifacts. "
                f"Run all solver variants before validating."
            )
        for (r1, r2) in itertools.combinations(results, 2):
            for bound in ["lower", "upper"]:
                v1, v2 = r1["bounds"][bound], r2["bounds"][bound]
                rel = abs(v1 - v2) / max(abs(v1), abs(v2), 1e-30)
                if rel > tolerance_rel:
                    raise GateError(
                        f"Cross-solver drift: {bound} bound "
                        f"{r1['solver']}={v1:.4f} vs {r2['solver']}={v2:.4f} "
                        f"(rel={rel:.2%} > {tolerance_rel:.0%}). "
                        f"Tighten solver tolerances or investigate formulation."
                    )
```

Add `"cross_solver_tolerance_rel": 0.15` to the project-level config with override per kernel.

### Patch 2 — Fix float comparison in s-grid binding (Blocker B2)

**File:** `idea-runs/scripts/validate_project_artifacts.py`

Replace the grid comparison logic (currently presumed `==`) with:

```python
import math

S_GRID_REL_TOL = 1e-12

def s_grids_match(grid_a, grid_b):
    if len(grid_a) != len(grid_b):
        return False
    for a, b in zip(grid_a, grid_b):
        if a == 0.0 and b == 0.0:
            continue
        if abs(a - b) / max(abs(a), abs(b)) > S_GRID_REL_TOL:
            return False
    return True
```

**File:** `idea-runs/schemas/s_matrix_constraints_v1.schema.json`

Add to the schema description:

```json
"s_grid_mpi2": {
  "type": "array",
  "items": {"type": "number"},
  "description": "S-channel grid in units of m_pi^2. Compared with relative tolerance 1e-12. Values MUST be emitted with at minimum 15 significant digits."
}
```

**New file:** `idea-runs/tests/test_s_grid_float_binding.py`

```python
def test_ulp_mismatch_passes():
    """Grid values differing by < 1 ULP must pass."""
    a = [4.0, 16.000000000000004, 100.0]
    b = [4.0, 16.0,               100.0]
    assert s_grids_match(a, b)

def test_real_mismatch_fails():
    a = [4.0, 16.0, 100.0]
    b = [4.0, 16.1, 100.0]
    assert not s_grids_match(a, b)
```

### Patch 3 — Record $\eta(s)$ in constraint artifact (N4)

**File:** `idea-runs/schemas/s_matrix_constraints_v1.schema.json`

Add required field:

```json
"elasticity_profile": {
  "type": "object",
  "required": ["type"],
  "oneOf": [
    {
      "properties": {
        "type": {"const": "uniform_disk"},
        "eta_max": {"type": "number", "exclusiveMinimum": 0, "maximum": 1}
      },
      "required": ["type", "eta_max"]
    },
    {
      "properties": {
        "type": {"const": "tabulated"},
        "s_mpi2": {"type": "array", "items": {"type": "number"}},
        "eta": {"type": "array", "items": {"type": "number", "minimum": 0, "maximum": 1}}
      },
      "required": ["type", "s_mpi2", "eta"]
    },
    {
      "properties": {
        "type": {"const": "elastic_unitarity_below_inelastic_threshold"},
        "inelastic_threshold_mpi2": {"type": "number"},
        "eta_above": {"type": "number", "minimum": 0, "maximum": 1}
      },
      "required": ["type", "inelastic_threshold_mpi2", "eta_above"]
    }
  ]
}
```

**Files:** Both `s_matrix_constraints_s0_v1.json` and `s_matrix_constraints_s0_grid80_v1.json`

Add the actual profile used, e.g.:

```json
"elasticity_profile": {
  "type": "uniform_disk",
  "eta_max": 1.0
}
```

### Patch 4 — Add crossing-symmetry extension point (future-proofing)

**File:** `idea-runs/schemas/s_matrix_constraints_v1.schema.json`

Add optional, currently-unused field:

```json
"crossing_symmetry": {
  "type": "object",
  "description": "Reserved for crossing-symmetry constraints (e.g., Roy equations). Not implemented in v1; presence triggers a validation error to prevent silent misuse.",
  "properties": {
    "enabled": {"type": "boolean", "const": false}
  },
  "required": ["enabled"]
}
```

**File:** `idea-runs/scripts/validate_project_artifacts.py`

Add:

```python
if constraint.get("crossing_symmetry", {}).get("enabled", False):
    raise GateError(
        "crossing_symmetry.enabled=true but no validator exists for v1. "
        "This constraint type requires schema v2+."
    )
```

### Patch 5 — Add solver-convergence sweep TODO to evidence note (N2)

**File:** `idea-runs/projects/pion-gff-bootstrap-positivity-pilot-2026-02-15/evidence/2026-02-21-w6-36-theta-fullpsd-smoke-and-smatrix-gate-v1.md`

Append to the "Next steps" section:

```markdown
### Solver-tolerance convergence sweep (TODO W6-37)

Before interpreting full-PSD bounds as physics, run a tolerance sweep at grid80:
- SCS: eps ∈ {1e-3, 1e-4, 1e-5, 1e-6}
- COSMO: eps ∈ {1e-3, 1e-4, 1e-5, 1e-6}

Accept the bound as converged when successive tightenings change by < 2% relative.
Record wall-clock time per (solver, eps) pair for budget planning.

**Gate criterion:** cross-solver consistency (Patch 1) must pass at the converged tolerance
before any full-PSD result can be cited in `draft.md` or used as input to island comparison.
```

### Patch 6 — Pin Julia environment for SDP reproducibility

**File:** `idea-runs/projects/pion-gff-bootstrap-positivity-pilot-2026-02-15/compute/julia/`

Add or verify existence of `Manifest.toml` (not just `Project.toml`). The evidence note should record:

```markdown
**Julia environment:** See `compute/julia/Manifest.toml` (committed).
Key packages: JuMP v1.x.y, SCS v2.x.y, COSMO v0.x.y.
```

If `Manifest.toml` is gitignored, un-ignore it for this subdirectory.

### Patch 7 — Add wall-clock to evidence note (N5)

**File:** Same evidence note.

Add to the smoke-run results table:

```markdown
| Config | Solver | eps | Grid | Lower | Upper | Wall-clock | Machine |
|--------|--------|-----|------|-------|-------|------------|---------|
| smoke_grid80_scs | SCS | 1e-3 | 80 | -16.48 | 28.53 | ~Xs | [CPU model, RAM] |
| smoke_grid80_cosmo | COSMO | 1e-4 | 80 | -17.60 | 16.96 | ~Ys | [CPU model, RAM] |
| grid200_scs | SCS | 1e-3 | 200 | — | — | aborted >Zmin | [CPU model, RAM] |
```
