VERDICT: READY

## Blockers

None. The round is well-scoped: a negative solver result with proper artifact persistence, no physics-assumption changes, and clean validation passes. No blocking issues prevent proceeding.

## Non-blocking

1. **Capture SCS iteration count and primal/dual residual norms in `results.json` on `ITERATION_LIMIT`.** The current feasibility-failure persistence writes termination status and SOC/modulus margins, but SCS exposes `sol.info.pobj`, `sol.info.dobj`, `sol.info.res_pri`, `sol.info.res_dual`, and `sol.info.iter` — all of which are cheap to serialize and would make the negative-result artifact far more queryable for future solver-tuning attempts.

   *Concrete suggestion (see Specific patch suggestions below).*

2. **`failed_approach_v1.jsonl` schema could carry a `solver_diagnostics` sub-object.** Currently the JSONL entry records the approach label and outcome string. Embedding a small structured block (`{"iter": …, "res_pri": …, "res_dual": …, "pobj": …, "dobj": …}`) would let a future failure-library query distinguish "SCS hit iteration limit at 1e5 with res_pri=0.3" from "SCS hit iteration limit at 1e5 with res_pri=1e-6" — qualitatively different regimes for triage.

3. **Run-dir collision guard.** The kernel now creates `runs/<slug>/` on every invocation including failures. Confirm that a second invocation with the same config does not silently overwrite an existing run directory. The safest pattern is `isdir(rundir) && error("Run directory already exists: $rundir")` before `mkdir`. If this guard is already present, no action needed; I could not confirm from the review packet alone.

4. **Neg-result writeup could note the SCS version tested.** Solver behavior across SCS releases (especially 3.x vs 2.x) differs substantially. Pinning the version in the neg-result text file (`SCS.jl vX.Y.Z / libscs vA.B.C`) makes the conclusion reproducible without re-reading `Manifest.toml`.

## Real-research fit

**Strong.** This round exemplifies exactly the workflow the evidence-first ecosystem is designed for:

- A concrete hypothesis was tested (SCS with tuned parameters can reach approximately-feasible status for this SOCP instance).
- The negative result is recorded with full provenance (config, run artifacts, residual audit).
- The conclusion is appropriately scoped: "SCS remains diagnostics-only *for this instance class*" — not a blanket dismissal.
- The failure-library infrastructure (JSONL + index + query) turns negative results into reusable institutional knowledge, preventing future re-runs of the same dead-end.

The decision to proceed with Clarabel (primary) + ECOS (cross-check) is well-supported. SCS's `ITERATION_LIMIT` with large negative SOC margins is not a borderline case; it is a clear non-convergence. Promoting SCS from diagnostics-only would require a qualitatively different outcome (convergence + small residuals), which was not observed.

## Robustness & safety

1. **Success-path invariance.** The kernel change is additive: on `OPTIMAL` termination, the existing write-and-return path is unchanged. The new code only activates on non-`OPTIMAL` status, writing artifacts *then* raising. This is safe.

2. **No physics-assumption drift.** Persisting failure artifacts does not alter constraint matrices, objective coefficients, or any problem formulation. The SOCP instance reaching the solver is identical pre- and post-patch.

3. **Hallucination / over-generalization risk.** The neg-result writeup and island-progress event correctly scope the conclusion to the tested instance (v15b, Q²=10, N=60, x-formulation with SCS eps=1e-3). No extrapolation to other Q² values, truncation orders, or problem sizes is made. This is the right epistemic discipline.

4. **Artifact contract validity.** The `results.json` written on failure must remain valid JSON and must not contain `NaN` or `Inf` literals (invalid in JSON). If SCS returns `NaN` for any field, those should be serialized as `null` or as the string `"NaN"`. Worth a quick check (see patch suggestion below).

5. **Validation harness coverage.** All three `make validate` targets pass. The failure-library index-build and query-run both pass. This gives adequate confidence for a non-blocking round.

## Specific patch suggestions

### Patch 1: Capture SCS solver diagnostics in failure `results.json`

**File:** `idea-runs/projects/pion-gff-bootstrap-positivity-pilot-2026-02-15/compute/julia/bochner_k0_socp_dispersion_bounds.jl`

**Location:** The block that constructs the failure-path `results` dict (the non-`OPTIMAL` branch, just before `JSON3.write`).

**Change:** Add solver-info fields:

```julia
# --- EXISTING (approx) ---
results = Dict(
    "status" => string(termination_status(model)),
    "raw_status" => string(raw_status(model)),
    # ... SOC/modulus margins ...
)

# --- PROPOSED ADDITION ---
# Capture SCS-specific diagnostics if available (cheap, aids future triage)
if solver_name(model) == "SCS"
    try
        info = backend(model).optimizer.sol.info
        results["solver_diagnostics"] = Dict(
            "iterations"   => info.iter,
            "res_pri"      => _safe_json_float(info.res_pri),
            "res_dual"     => _safe_json_float(info.res_dual),
            "pobj"         => _safe_json_float(info.pobj),
            "dobj"         => _safe_json_float(info.dobj),
            "setup_time"   => _safe_json_float(info.setup_time),
            "solve_time"   => _safe_json_float(info.solve_time),
        )
    catch e
        results["solver_diagnostics"] = Dict("error" => string(e))
    end
end
```

Add a helper at module scope:

```julia
"""Guard against NaN/Inf in JSON serialization."""
_safe_json_float(x::Real) = isfinite(x) ? x : nothing
```

**Rationale:** Makes the negative-result artifact self-contained for solver-tuning triage. The `try/catch` ensures this never breaks the failure-persistence path even if SCS internals change.

### Patch 2: Add run-dir collision guard (if not already present)

**File:** Same Julia file.

**Location:** Just before `mkpath(rundir)`.

**Change:**

```julia
# Before creating the run directory, guard against overwrite
if isdir(rundir)
    error("Run directory already exists (refusing to overwrite): $rundir")
end
mkpath(rundir)
```

**Rationale:** Ensures reproducibility — a re-run cannot silently clobber a prior negative-result artifact. If this guard is already present, disregard.

### Patch 3: Add SCS version to neg-result writeup

**File:** `idea-runs/projects/pion-gff-bootstrap-positivity-pilot-2026-02-15/evidence/neg_results/2026-02-17-v15b-scs-tuned-eps1e-3-iteration-limit-v1.txt`

**Change:** Append a line in the header/metadata section:

```
SCS version: SCS.jl v2.0.1 / libscs 3.2.4   # ← replace with actual from Manifest.toml
```

**Rationale:** SCS convergence behavior differs across major versions; pinning this makes the neg-result conclusion version-specific and reproducible.

### Patch 4: Embed solver diagnostics in `failed_approach_v1.jsonl` entry

**File:** `idea-runs/projects/pion-gff-bootstrap-positivity-pilot-2026-02-15/artifacts/ideas/failed_approach_v1.jsonl`

**Change:** In the JSONL entry for this SCS tuned run, add a `solver_diagnostics` field mirroring Patch 1's output:

```jsonl
{"approach":"scs-tuned-eps1e-3-v15b-q2a10","outcome":"ITERATION_LIMIT","solver_diagnostics":{"iterations":100000,"res_pri":0.31,"res_dual":0.028},...}
```

**Rationale:** Makes failure-library queries solver-diagnostic-aware without requiring a join to the run directory.

---

**Summary:** This is a clean, well-scoped round. The negative result is correctly stated, properly bounded in scope, and now durably persisted. The patches above are non-blocking quality-of-life improvements that strengthen the diagnostic value of the failure artifacts. Proceed with Clarabel (primary) + ECOS (cross-check) as the mainline solver pair, with SCS retained as diagnostics-only.
