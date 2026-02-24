VERDICT: READY

## Blockers

None identified. The three claims (numerics-only equivalence of the x-formulation, practical solver unreliability of SCS/COSMO, and structured negative-result capture) are each supported by the evidence bundle described in the packet.

## Non-blocking

1. **Explicit round-trip test for equivalence claim.**
   The scaling diagnostic (`docs/reviews/bundles/2026-02-17-w6-11-socp-scaling-diagnostic-v1.txt`) shows the dynamic-range improvement (~2.9e7 → ~2.8e1), but the packet does not mention a direct numerical comparison of *optimal objective values* between the old z-formulation and the new x-formulation on the same problem instance (e.g., v15b Q²=10) using the same solver (Clarabel). A single such comparison—showing agreement to solver tolerance—would close the "numerics-only equivalence" claim mechanically rather than relying on algebraic audit alone. Recommend adding this as a one-off verification run before Phase K scans begin.

2. **Cone-violation residual audit: quantitative threshold.**
   The SCS summary (`docs/reviews/bundles/2026-02-17-w6-11-scs-optimal-but-violates-cones-summary-v1.txt`) documents O(1) cone violations, which is obviously disqualifying. However, the residual-audit code path in `bochner_k0_socp_dispersion_bounds.jl` currently appears to be an ad-hoc post-hoc check. Consider promoting it to a *gating* assertion that runs automatically after every solve (for any solver) and fails the run if the maximum cone residual exceeds a configurable threshold (e.g., `numerics.cone_residual_tol`). This would prevent a future solver upgrade or tolerance change from silently producing cone-violating "OPTIMAL" solutions in a batch scan.

3. **`solver_attributes` pass-through: input validation.**
   The new `numerics.solver_attributes` JSON pass-through in the driver script is convenient but has no schema validation. A typo in a solver attribute name (e.g., `"max_iters"` vs `"max_iter"`) would be silently ignored by MOI and could lead to confusing results. A warning log when an attribute is not recognized by the active solver would be cheap insurance.

4. **Failure-library entry completeness.**
   The appended entry in `artifacts/ideas/failed_approach_v1.jsonl` should ideally include the *exact solver version strings* (SCS version, COSMO version) used in the failing runs. Solver behavior can change across patch releases; pinning the version makes the negative result more useful for future re-evaluation.

5. **Minor: negative-result writeup phrasing.**
   In `evidence/neg_results/2026-02-17-v15b-scs-optimal-but-violates-cones-v1.txt`, confirm the text explicitly states the conclusion applies to *this SOCP family* on commodity hardware at these problem sizes. SCS and COSMO are perfectly fine solvers in many other contexts; the negative result is specific to the high-dynamic-range, dispersion-coupled rotated-SOC structure here. The claim as stated in the review packet (Section 2 of "Claim under review") is appropriately scoped; just verify the standalone writeup matches.

## Real-research fit

The work is well-scoped for a numerics/infrastructure improvement round within a positivity-bootstrap pilot. Key observations:

- **No physics assumptions changed.** The x-formulation is a diagonal rescaling of the optimization variable; the feasible set (and hence any physics bound) is invariant. This is the correct framing.
- **Negative results are first-class.** Documenting SCS/COSMO limitations as a structured failure-library entry is good research hygiene and directly useful: it prevents wasted compute in future phases and provides a concrete criterion ("cone residual audit") for when/whether to revisit these solvers.
- **The mainline path (Clarabel primary + ECOS cross-check) is unaffected.** The x-formulation scaling improvement benefits all solvers, including Clarabel, by reducing condition numbers. SCS/COSMO demotion to "diagnostic only" status is a conservative, defensible operational choice.

## Robustness & safety

1. **Load-bearing assumption: $\sqrt{c_{\rm fac}(s_i)}$ is real and positive at every grid point.** This is guaranteed by the physics ($c_{\rm fac}$ is the spectral function integrand weight, positive above threshold), but the code should contain an explicit assertion/check that `c_fac[i] > 0` before taking the square root. If a grid point accidentally falls below threshold (e.g., due to discretization of the $2m_\pi$ cut), a silent NaN or complex value would corrupt the entire SOCP without a clear error message. Verify this guard exists in `bochner_k0_socp_dispersion_bounds.jl`.

2. **Discretization sensitivity.** The dynamic-range diagnostic is shown for a single instance (v15b, Q²=10, n=60). The scaling improvement should be *monotonic* in the sense that it helps uniformly across the grid, but it would be reassuring to spot-check that the improvement holds at the extremes of the planned Phase K scan range (e.g., Q²=0.1 and Q²=50, if applicable). This is non-blocking but recommended before committing to large batch runs.

3. **Solver-status trust model.** The packet correctly identifies that solver status alone is insufficient. The recommendation to treat SCS/COSMO as "diagnostics only" is sound. Going forward, *every* solver result—including Clarabel and ECOS—should be subjected to the cone-residual audit before being used in any physics conclusion. This is already implicit in the workflow but should be made an explicit, automated gate (see Non-blocking item 2).

## Specific patch suggestions

1. **`bochner_k0_socp_dispersion_bounds.jl` — promote residual audit to gating assertion:**
   ```julia
   # After solve, before writing results:
   max_cone_residual = compute_cone_residuals(model, x_sol)
   cone_tol = get(numerics, "cone_residual_tol", 1e-6)
   if max_cone_residual > cone_tol
       @error "Cone residual $(max_cone_residual) exceeds tolerance $(cone_tol); marking run as INFEASIBLE_POST_AUDIT"
       result_status = :CONE_VIOLATED
       # write result with this status, do NOT propagate as valid bound
   end
   ```

2. **`bochner_k0_socp_dispersion_bounds.jl` — guard on `c_fac` positivity:**
   ```julia
   @assert all(c_fac .> 0) "c_fac must be strictly positive at all grid points; got min=$(minimum(c_fac))"
   sqrt_cfac = sqrt.(c_fac)
   ```

3. **`bochner_k0_socp_dispersion_bounds.jl` — solver-attribute warning:**
   ```julia
   for (attr_name, attr_val) in solver_attributes
       attr_sym = Symbol(attr_name)
       try
           MOI.set(optimizer, MOI.RawOptimizerAttribute(String(attr_sym)), attr_val)
       catch e
           @warn "Solver attribute '$attr_name' not recognized by $(typeof(optimizer)): $e"
       end
   end
   ```

4. **`artifacts/ideas/failed_approach_v1.jsonl` — add solver version pins:**
   ```json
   {"solver": "SCS", "version": "3.2.x", ...}
   {"solver": "COSMO", "version": "0.8.x", ...}
   ```
   (Replace `x` with actual patch versions from `Pkg.status()` output.)

5. **Add a one-off z-vs-x equivalence validation run** (new entry in `runs/` or `evidence/`):
   Run both formulations on v15b Q²=10 with Clarabel, compare optimal objectives, and record the agreement (or discrepancy) with a tolerance annotation. This closes the equivalence claim empirically.
