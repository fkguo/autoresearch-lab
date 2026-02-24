VERDICT: NOT_READY

## Blockers

### B1. HiGHS LP solver defect is unmitigated — potential non-conservatism in published bounds

The review packet itself documents that SciPy/HiGHS can return `OPTIMAL` with **wrong** solutions for near-threshold spectral-density LPs due to extreme ill-conditioning. This is a load-bearing issue: the envelope-LP baseline ($A_{\min}(-10m_\pi^2)=0.06653$) is the reference against which the dispersion-coupled improvement is measured. If the baseline is itself non-conservative (i.e., the true LP optimum is lower), the reported $\Delta A_{\min}\approx +0.006$ improvement may be artifactual or overstated.

**Evidence:**
- `idea-generator/docs/reviews/bundles/2026-02-16-w6-06-highs-lp-wrong-optimum-repro-v1.txt`
- `idea-runs/projects/.../evidence/neg_results/2026-02-16-highs-lp-wrong-optimum-repro.txt`

**Required next actions:**
1. Cross-validate every reported $A_{\min}$ value against at least one independent solver (e.g., Mosek, ECOS, or SCS via JuMP in the Julia pipeline; or CPLEX/Gurobi if available). Record solver-pair deltas in `results.json`.
2. For the SOCP dispersion-coupled runs specifically, verify that the Clarabel/JuMP solver status is `OPTIMAL` *and* that a primal-dual gap or complementarity residual is logged and below a stated tolerance (e.g., $10^{-7}$). If it is not currently logged, add it.
3. Establish a hard gate: no bound is "evidence-closed" unless two independent solvers agree to a stated relative tolerance. Document this gate in the run config or a `GATES.md`.

### B2. PV discretization error is unquantified

The principal-value integral is discretized on a finite $s$-grid, and the PV kernel $1/(x - s_i)$ is singular at $x = s_i$. No convergence study (grid refinement) or error estimate for the discretized PV integral is presented. Since the dispersion relation reconstruction of $\mathrm{Re}\,A(s_i)$ is the **core new ingredient**, an uncontrolled discretization error could either (a) spuriously tighten the bound (non-conservative) or (b) introduce infeasibility that the solver papers over.

**Required next actions:**
1. Run the dispersion-coupled SOCP at three or more grid densities (e.g., $N = 200, 400, 800, 1600$) with the same `n_enforce` and report the $A_{\min}(Q^2)$ curve at each. Publish the convergence plot or table.
2. Document the PV discretization scheme (midpoint, Gauss–Legendre, subtracted, …) and estimate the leading truncation error analytically or numerically.
3. Quantify the UV tail model contribution and its sensitivity (vary the UV ansatz parameters by ±20% and report $\Delta A_{\min}$).

### B3. Subset enforcement bias is uncharacterized

The modulus cone $({\rm Re}A)^2 + ({\rm Im}A)^2 \le c_{\rm fac}\,\rho$ is enforced on only `n_enforce = 30, 60, 90` out of (presumably hundreds or thousands of) grid points. The configs show the bound changes with `n_enforce` (v2 → v2b → v2c), but no extrapolation to full enforcement or proof of monotonicity/convergence is provided. If the bound is non-monotone in `n_enforce`, the "best" result at $n_{\rm enforce}=60$ may be an artifact of under-enforcement.

**Required next actions:**
1. Plot $A_{\min}(-10m_\pi^2)$ vs. `n_enforce` up to full enforcement on all grid points. Verify monotone tightening (more constraints → tighter or equal bound).
2. If full enforcement is infeasible (solver time), extrapolate and bound the residual gap.
3. Explain **which** indices are chosen for subset enforcement and why (uniform? importance-sampled? near-threshold?).

### B4. No automated reproducibility script or CI gate

The repro command listed requires a manual `--config <config.json>` invocation. There is no `Makefile`, `justfile`, or CI workflow that:
- runs all configs,
- compares outputs to reference `results.json`,
- checks solver status + tolerances,
- fails on regression.

Without this, the "evidence closed-loop" claim is aspirational. This is a process blocker for publishability.

**Required next action:** Add a single-command repro script (e.g., `make reproduce` or `julia run_all.jl`) that executes all configs in `compute/` and produces a summary table, and integrate it with the project's evidence gate.

---

## Non-blocking

### N1. $\eta(s)$ envelope is coarse
The piecewise-constant $\eta(s) = 1$ below $s = 16m_\pi^2$, then $\eta = 0.6$ above, is a rough approximation. A smoother, data-driven $\eta(s)$ (e.g., from $\pi\pi \to K\bar{K}$ coupled-channel $S$-matrix fits) could tighten or loosen the bound. This should be acknowledged as a systematic and explored in a sensitivity study before the paper is submitted, but it does not block the current "proof of concept" claim.

### N2. "Rigorous QCD bound" language must be deferred
The current setup is a *convex relaxation* of the full unitarity + crossing + analyticity constraints, with additional model-dependent inputs ($\chi$PT shape constraints, UV tail model, specific $\eta$ profile). The result is a valid lower bound **within the stated assumptions**, not a model-independent QCD bound. The paper should use language like "lower bound under [list of assumptions]" rather than "rigorous bound from QCD." This is a framing issue, not a technical blocker.

### N3. Missing comparison to 2403/2505 literature bounds
No quantitative comparison is made to existing dispersive GFF bounds in the literature (e.g., Figures from 2403.xxxxx or 2505.xxxxx). Adding an overlay plot would contextualize the improvement and clarify novelty.

### N4. Solver tolerance not recorded in results.json
The SOCP results files should log the solver's reported primal-dual gap, iteration count, and termination status. This is standard practice for optimization-based physics bounds.

---

## Real-research fit

**Novelty assessment (Question 1):**
PV-dispersion coupling of the real part to enforce the full modulus cone is a natural but non-trivial extension of Im-only conic relaxations. The 2403/2505 GTB numerics for $\pi\pi$ scattering amplitudes *do* use dispersion relations, but typically in the $S$-matrix bootstrap context (partial waves, Roy equations), not in the specific setting of gravitational form factor lower bounds combined with Bochner-style transverse-density positivity (2412). The combination — PV reconstruction + modulus cone + $K_0$ positivity + sum rules — applied to pion GFF bounds appears to be a meaningful methodological contribution, provided the numerics are validated (see Blockers).

**Claim boundaries (Question 2):**
Safe to claim: "Under the stated analyticity, elastic unitarity, partial inelasticity, and transverse-density positivity assumptions, the dispersion-coupled SOCP yields measurably tighter lower bounds on $A^\pi(-Q^2)$ than Im-only conic relaxations, extending the positive-bound window from $\sim 14\,m_\pi^2$ to $\sim 15.4\,m_\pi^2$."
Must defer: any claim of model-independence, "from QCD," or comparison to lattice QCD results without explicit lattice data overlay and systematic error analysis.

---

## Robustness & safety

1. **Solver reliability:** The documented HiGHS defect is a red flag. The SOCP runs use JuMP+Clarabel (Julia), which is a different code path, but no independent cross-check is reported for the SOCP results either. A single-solver pipeline for optimization-based bounds is fragile.

2. **Normalization:** The sum rule $\int \mathrm{Im}\,A(s)/s = \pi f_0$ fixes the overall scale. Any discretization error in this integral propagates directly into the bound. The second sum rule $\int \mathrm{Im}\,A(s) = 0$ is a non-trivial constraint; verify it is satisfied to high precision in the optimal solution.

3. **Discretization of $K_0$ Bochner constraints:** The $K_0(b\sqrt{s})$ kernel is oscillatory for large $b\sqrt{s}$. What is the maximum $b$ enforced, and is the discretized sum converging? This was presumably validated in earlier rounds but should be re-checked after the grid changes introduced by the dispersion coupling.

4. **UV tail model:** The explicit UV tail contribution to the PV integral is model-dependent. Its fractional contribution to $\mathrm{Re}\,A(s_i)$ at the enforcement points should be tabulated. If it exceeds ~5–10% of the total, the bound's sensitivity to UV modeling must be reported.

5. **$\chi$PT shape constraints (2505):** These are input assumptions, not derived constraints. They should be clearly flagged as such. Removing them and reporting the bound weakening would strengthen the paper's credibility.

---

## Specific patch suggestions

1. **`bochner_k0_socp_dispersion_bounds.jl`:** After the `optimize!()` call, add logging of:
   ```julia
   @info "Solver status" termination_status(model) primal_status(model) dual_status(model)
   @info "Objective" objective_value(model)
   # If Clarabel, log primal-dual gap:
   @info "Solve info" solve_time(model) relative_gap(model)  # or equivalent
   ```
   Write these to `results.json` under a `"solver_diagnostics"` key.

2. **`a_bochner_k0_socp_config_v2b_dispersion_n60.json`:** Add fields:
   ```json
   "pv_discretization_scheme": "midpoint_subtracted",
   "pv_grid_points": 400,
   "uv_tail_model": "2412_eq_imF",
   "uv_tail_fraction_max": null
   ```
   The `null` should be filled after running the UV sensitivity check (Blocker B2).

3. **New file: `compute/julia/run_convergence_study.jl`** — Script that loops over `n_enforce ∈ [10, 20, 30, 60, 90, 150, all]` and `N_grid ∈ [200, 400, 800]`, runs the SOCP, and outputs a CSV table + convergence plot. This directly addresses Blockers B2 and B3.

4. **New file: `compute/julia/cross_solver_check.jl`** — Re-solve the same SOCP model with a second solver backend (e.g., `SCS` or `COSMO` via JuMP) and assert that $|A_{\min}^{\rm solver1} - A_{\min}^{\rm solver2}| / |A_{\min}^{\rm solver1}| < 10^{-4}$. This addresses Blocker B1.

5. **`results.json` (all runs):** Add a `"sum_rule_residuals"` field:
   ```json
   "sum_rule_residuals": {
     "sr1_int_imA_over_s_minus_pi_f0": 1.2e-9,
     "sr2_int_imA": 3.4e-10
   }
   ```

6. **Top-level `Makefile` or `justfile`:** Add:
   ```makefile
   reproduce:
       julia --project=compute/julia compute/julia/run_all_configs.jl
       julia --project=compute/julia compute/julia/cross_solver_check.jl
       julia --project=compute/julia compute/julia/run_convergence_study.jl
       @echo "All gates passed."
   ```
