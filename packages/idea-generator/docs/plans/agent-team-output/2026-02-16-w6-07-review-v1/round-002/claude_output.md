VERDICT: NOT_READY

## Blockers

### B1. Cross-solver spread at Q* is comparable to the bound itself

At the claimed positivity endpoint $Q^* = 15.438$, the two solvers disagree on $A_{\min}$ by a factor of ~2.5×:

| Solver | $A_{\min}(Q^*)$ |
|--------|-----------------|
| Clarabel | 0.00728 |
| ECOS | 0.01810 |

The absolute spread $\delta A_{\min} \approx 1.08 \times 10^{-2}$ is **larger than the Clarabel bound itself** (0.00728). This means the sign of the bound—the single load-bearing claim ("positivity extends to $Q^*$")—is not solver-independent at the level needed to be publishable. The packet proposes to "conservatively report the Clarabel minimum," but that is only conservative if Clarabel's feasible set is a superset of the true feasible set (i.e., it is more permissive). With feasibility-margin violations of order $-10^{-6}$ to $-10^{-7}$, you cannot distinguish "Clarabel found a tighter valid bound" from "Clarabel accepted a slightly infeasible point that ECOS rejected."

**Next action:** Run both solvers at $Q^*$ with a **post-hoc feasibility check**: take the Clarabel-optimal spectral function, evaluate all constraints in exact (Float64) arithmetic outside the solver, and report the worst violation. Do the same for ECOS. If both are feasible to $< 10^{-8}$ after this external check, the spread is a true dual-gap issue and the conservative-min framing is defensible. Until then the bound at $Q^*$ is not auditable.

*Evidence:* Cross-solver table in review packet; `idea-generator/docs/reviews/bundles/2026-02-16-w6-07-dispersion-socp-robustness-summary-v3.txt`.

### B2. Feasibility-margin violations are negative—meaning constraints are violated, not satisfied

The packet reports:

- `k0_min_margin` min: **−3.665e-06**
- `soc_min_margin` min: **−6.571e-08**
- `modulus_min_margin` min: **−2.359e-08**

These are not "margins consistent with solver feasibility tolerances"; they are **constraint violations**. The interpretation paragraph waves this away, but the packet does not state:

1. What the solver's declared feasibility tolerance (`eps_feas` / `feastol`) actually is for the v18 Clarabel run.
2. Whether the reported margin is computed from the solver's primal or from a re-evaluation in Float64 outside the solver.
3. Whether the sign convention is `margin > 0 ⟹ feasible` (it appears so from context, making these genuine violations).

Without (1)–(3), the residual audit is not actually interpretable.

**Next action:** In the kernel (`bochner_k0_socp_dispersion_bounds.jl`), add a header comment or config echo that records the solver tolerance settings used, and document the sign convention for each margin field. Then confirm: is `k0_min_margin = -3.665e-06` within the declared `eps_feas` of Clarabel's default ($\sim 10^{-8}$)? If not, the solve is formally infeasible and the bound is unreliable.

*Evidence:* `idea-generator/docs/reviews/bundles/2026-02-16-w6-07-v18-residual-worstcase-v1.txt`; kernel at `compute/julia/bochner_k0_socp_dispersion_bounds.jl`.

### B3. No independent verification of the PV integral discretization

The packet states the implemented formula is
$${\rm Re}A(s_i) = \frac{1}{\pi}\,{\rm PV}\int dx\,\frac{{\rm Im}A(x)}{x - s_i}$$
plus a UV tail, but does not provide any convergence study or cross-check of the discretization (grid200). Questions:

- What quadrature rule is used for the PV integral? (Subtracted trapezoid? Hilbert-transform kernel?)
- Is there a grid-doubling test (grid200 → grid400) showing the bounds converge?
- The UV tail model: is it a power-law extrapolation? What systematic is assigned?

This matters because the dispersion relation *is* the coupling mechanism—it is the new physics content relative to the Im-only baseline. If the discretization error in the PV integral is $O(10^{-3})$, it can shift bounds at $Q^*$ by more than the bound itself.

**Next action:** Run grid400 (or at minimum grid300) at $Q^* = 15.438$ with Clarabel and report $A_{\min}$. If $|A_{\min}^{400} - A_{\min}^{200}| \ll A_{\min}^{200}$, the discretization is converged. Otherwise, the grid200 result is not trustworthy.

*Evidence:* Kernel at `compute/julia/bochner_k0_socp_dispersion_bounds.jl`; config at `compute/a_bochner_k0_socp_config_v2g_dispersion_grid200_enf200_full_resaudit.json`.

## Non-blocking

### N1. Definition of $Q^*$ is grid-dependent and coarse

$Q^*$ is defined as the largest contiguous grid point with $A_{\min} > 0$. With grid200 over some range, the grid spacing near $Q^* \approx 15.4$ could be $\Delta Q^2 \sim 0.5$–$1.0$. The true $Q^*$ (continuous) could differ by this amount. This is fine for an internal milestone but should be flagged as a discretization artifact in any paper draft. A bisection refinement near $Q^*$ would sharpen the number at negligible cost.

### N2. Amax spread is ~1% (benign but should be reported)

The Clarabel vs ECOS spread on $A_{\max}$ is $\sim 1\%$ across the mini-set, which is much larger than typical SOCP duality gaps. This suggests the problem may be poorly conditioned for the max objective as well. Not a blocker since the min bound is the physics claim, but worth a sentence in any write-up.

### N3. SCS failure is under-documented

The packet mentions SCS hitting `ITERATION_LIMIT` but does not record which SCS settings were tried (e.g., `max_iters`, `eps`). A brief parameter scan would strengthen the "we tried three solvers" narrative.

### N4. `failed_approach_v1.jsonl` hygiene

ECOS timeout is appended to this file, which is good practice. Confirm the JSON schema matches the project's artifact spec (the packet doesn't show the schema).

## Real-research fit

The physics question—how much does enforcing crossing symmetry via a dispersion relation tighten positivity bounds on the pion gravitational form factor—is well-posed and timely. The SOCP formulation is a genuine methodological contribution relative to existing moment-problem / Meiman–Okubo style approaches. If the numerics are made airtight, this is a publishable result in the "rigorous bounds" tradition (à la Pennington, Roy-equation bootstrap literature).

However, the current positivity endpoint ($Q^* \approx 15\,m_\pi^2 \approx 0.28\,{\rm GeV}^2$) is modest—lattice QCD already provides direct form-factor determinations in this range. The impact argument will hinge on either (a) pushing $Q^*$ much higher with additional constraints (Gram matrices, coupled channels), or (b) demonstrating that the bound is *saturated* or close to saturation by known parameterizations (VMD, dispersive fits). Neither is addressed yet, which is fine for a pilot, but should inform prioritization.

## Robustness & safety

- **Normalization assumption:** The sum-rule constraint (CSR) fixes the overall normalization. The packet does not discuss what happens if the CSR value is varied within its uncertainty. For a publishable result, this is a necessary systematic.
- **UV tail model:** Not specified in the packet. This is a load-bearing assumption for the dispersion integral at high $s_i$.
- **Solver default tolerances:** Clarabel's default `tol_feas` is $10^{-8}$, but the worst `k0_min_margin` is $-3.7 \times 10^{-6}$, which is 250× larger than the tolerance. This needs explanation—either the margin is computed differently than the solver's internal feasibility check, or the solve is genuinely infeasible.
- **No adversarial input testing:** The spectral function is discretized as a vector of free parameters. Is there a check that the optimal spectral function is non-negative (if that's a constraint) or physically sensible (no wild oscillations)?

## Specific patch suggestions

1. **`compute/julia/bochner_k0_socp_dispersion_bounds.jl`** — Add a post-solve feasibility recheck:
   ```julia
   # After solve, re-evaluate all constraints at the optimal point
   # using the problem's A, b, G, h matrices (not the solver's internal state)
   x_opt = value.(decision_vars)
   eq_residual = norm(A * x_opt - b, Inf)
   ineq_violation = maximum(G * x_opt - h)  # should be <= 0
   # Log these alongside solver-reported residuals
   ```
   This disambiguates solver-internal tolerances from actual constraint satisfaction.

2. **`compute/julia/bochner_k0_socp_dispersion_bounds.jl`** — Echo solver tolerance settings into `results.json`:
   ```julia
   results["solver_settings"] = Dict(
       "solver" => solver_name,
       "tol_feas" => tol_feas,
       "tol_gap_abs" => tol_gap_abs,
       ...
   )
   ```

3. **Config / kernel** — Add a `--grid_points` sweep mode or at minimum run `grid400` at the three mini-set Q2 values as a convergence diagnostic.

4. **Cross-solver table** — Add a column for the *external* feasibility recheck residual (from patch 1) so the table is self-contained and interpretable without knowing each solver's internal conventions.

5. **Documentation** — In the robustness summary (`2026-02-16-w6-07-dispersion-socp-robustness-summary-v3.txt`), add a subsection "UV tail model" specifying the functional form and the parameter values used, and "CSR input value" with its uncertainty.
