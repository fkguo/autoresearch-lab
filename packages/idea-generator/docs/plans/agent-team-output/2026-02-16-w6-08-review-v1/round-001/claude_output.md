VERDICT: NOT_READY

## Blockers

### B1. Dual certificate is not a rigorous proof — gap between "recomputed objective" and a true certificate

The review packet claims a "dual-certified lower bound" but what is actually produced is:

1. Extract dual variables from a numerical solver (Clarabel or ECOS).
2. Re-evaluate the dual objective from those variables.
3. Check stationarity ‖c − Aᵀy‖∞ and cone membership.

This is a **consistency audit of solver output**, not an independent dual certificate. A true dual certificate requires demonstrating **strict dual feasibility** — i.e., that the dual variables satisfy all constraints of the dual program with quantified margins, and that the dual objective value therefore constitutes a rigorous bound. The packet reports `stationarity_inf_norm` "should be small" and `dual_cone_min_margin` / `dual_cone_violations` as "sanity checks," but:

- No explicit numerical values for `stationarity_inf_norm` are quoted in this summary (they appear only indirectly via file references).
- No analysis converts these residuals into a **rigorous error bound** on the dual objective. If ‖c − Aᵀy‖∞ = ε > 0, the actual dual-feasible objective could be lower by O(ε · ‖x‖). Without bounding the primal norm, the recomputed dual objective is not a certified lower bound — it is an approximate one.
- `dual_cone_violations` is mentioned but the actual count/magnitude is not quoted here. If any violations are nonzero, dual feasibility fails and there is no certificate at all.

**Next action:** Quote `stationarity_inf_norm`, `dual_cone_min_margin`, and `dual_cone_violations` explicitly for both solvers. Then provide an explicit **perturbation analysis**: given these residuals, what is the worst-case correction to the dual objective? Only if `dual_obj_recomputed − perturbation_bound > 0` (after adding `tail_const_analytic`) is the bound certified.

*Files:* `idea-runs/.../runs/.../v19.../results.json` (both Clarabel and ECOS); kernel `bochner_k0_socp_dispersion_bounds.jl` (dual check implementation).

### B2. ECOS and Clarabel disagree on the primal by a factor of ~2.5×

- Clarabel primal: 0.007285
- ECOS primal: 0.018104

This is a **148% relative discrepancy** in the primal objective at the same point with the same conic program. The dual-recomputed values track the respective primals closely, so the discrepancy propagates into the dual certificates.

The packet proposes "take the smaller" as a conservative rule. This is not conservative — it is papering over a serious problem. A 2.5× spread means at least one solver is far from the true optimum, and possibly the conic reformulation is ill-conditioned or the bridging layer introduces different slack conventions. Until the source is identified:

- The "certified" value from either solver cannot be trusted.
- The conservative envelope (min of the two) has no rigorous justification unless you can prove both are **lower bounds** (which requires B1 to be resolved first).

**Next action:** Diagnose the Clarabel/ECOS discrepancy. Check: (a) Are the JuMP/MathOptInterface bridge transformations identical? Log the cone dimensions and constraint counts passed to each solver. (b) Is one solver hitting iteration limits or returning a near-infeasible status? Quote `termination_status` and `raw_status` for both. (c) Run a third solver (SCS, Hypatia, or COSMO) on the identical program as a tiebreaker.

*Files:* v19 configs (`..._clarabel.json`, `..._ecos.json`); `results.json` for both runs.

### B3. `tail_const_analytic` provenance is asserted but not audited

The packet states that `tail_const_analytic` is "the explicit tail integral contribution computed from the pQCD tail model" and is not "backed out from the primal." However:

- The actual formula used is not shown. Which integral, over what range, with what pQCD model parameters?
- The value −0.011306175356 is identical across both solvers (expected, since it is solver-independent), but there is no independent cross-check of this number (e.g., numerical quadrature vs. analytic formula, or comparison to literature).
- If `tail_const_analytic` has a sign error or integration-range error, the entire certified bound shifts by that amount. Given $A_{\min}^{\rm dual} \approx 0.0073$, an error of order 0.01 in the tail constant would flip the sign.

**Next action:** In the kernel file, identify the function computing `tail_const_analytic`, quote the formula/integral limits, and provide an independent numerical check (e.g., adaptive quadrature at higher precision).

*Files:* `bochner_k0_socp_dispersion_bounds.jl` — locate the `tail_const_analytic` computation.

### B4. Residuals at Q* include a negative SOC margin (Clarabel)

Clarabel reports `soc_min_margin = −1.96e−10`. This means at least one SOC constraint is **violated** (albeit by a tiny amount). For a claimed "certified" result, any constraint violation — even at 1e−10 — must be accounted for in the error budget. The packet does not discuss this.

**Next action:** (a) Quantify how much the objective could shift if this SOC violation is repaired (project back to the feasible set). (b) If the answer is "negligibly," state this explicitly with a bound. (c) For the dual side, confirm `dual_cone_violations = 0` — if not, the dual certificate is invalid regardless of magnitude.

*Files:* v19 Clarabel `results.json`.

## Non-blocking

### N1. Definition of Q* is grid-dependent and should carry a discretization caveat

$Q^* = 15.438…\, m_\pi^2$ is reported to 12 significant figures, but it is defined as a grid point. The true positivity boundary lies somewhere in $(Q^*, Q^*_{\rm next})$. The paper draft should quote $Q^*$ only to 2–3 significant figures or explicitly state the grid spacing at the boundary (grid200 → spacing ~0.15 $m_\pi^2$?).

### N2. No v18 worst-case residual numbers are actually in this packet

The packet says "quoted verbatim from" a file, but the numbers themselves are not included in the review packet text. For a self-contained review, the worst-case residuals should be inlined. This is a presentation issue, not a blocker, but makes the packet harder to audit.

### N3. Minor: "conservative" should be "pessimistic" or "lower envelope"

Terminology nit: "conservative" in the physics community typically means "making the bound weaker to ensure correctness." Here, taking the minimum of two unvalidated numbers is not conservative in that sense unless both are proven to be lower bounds (see B1/B2).

## Real-research fit

The overall program — bootstrapping positivity bounds on the pion gravitational form factor via Bochner/SOCP — is a legitimate and interesting line of research with clear connections to the dispersive literature (e.g., 2412.xxxxx). The computational framework (Julia + JuMP + conic solvers) is reasonable. The *ambition* to provide dual-certified bounds elevates this above typical numerics-only work.

However, the current packet does not yet deliver on that ambition. The gap between "solver residuals are small" and "rigorous certificate" is real and well-known in the optimization community (see, e.g., the VSDP project for rigorous SDP bounds). The pilot framing is appropriate — this should be presented as a numerical exploration with residual control, not as a rigorous bound, unless B1–B4 are resolved.

## Robustness & safety

- **Normalization:** The relationship $A_{\min}^{\rm dual} = \text{dual\_obj\_recomputed} + \text{tail\_const\_analytic}$ is a load-bearing identity. Any mismatch in the sign convention of the tail integral (is it the contribution *above* the truncation, or the *negative* of the truncation error?) would flip the result. This must be traced through the code.
- **Discretization:** 200 grid points and 200 enforcement points. No convergence study in grid/enforcement density is shown (e.g., v16/v17 presumably had fewer — what was the trend?). The bound's sensitivity to discretization is uncharacterized.
- **Solver settings:** Default tolerances for Clarabel and ECOS differ. Are they set to the same tolerance in the configs? If not, the cross-solver comparison is confounded.
- **Bridging:** JuMP's MathOptInterface bridging can introduce auxiliary variables and reformulate cones differently depending on the target solver. The "identical conic program" claim needs verification at the solver-input level, not just the JuMP-model level.

## Specific patch suggestions

1. **`bochner_k0_socp_dispersion_bounds.jl`**: In the dual-check block, add an explicit computation:
   ```julia
   # Perturbation bound: if stationarity residual is eps, dual obj could be off by eps * norm(x)
   perturbation_bound = stationarity_inf_norm * norm(primal_solution)
   certified_dual_obj = dual_obj_recomputed - perturbation_bound
   ```
   Store `perturbation_bound` and `certified_dual_obj` in `results.json`.

2. **v19 configs** (`..._clarabel.json`, `..._ecos.json`): Ensure both specify the same feasibility/optimality tolerance (e.g., `tol_feas = 1e-9`, `tol_gap = 1e-9`). If Clarabel uses `tol_gap_abs/rel` and ECOS uses `abstol/reltol`, document the mapping.

3. **`results.json` schema**: Add fields `n_conic_constraints`, `n_variables`, `cone_dimensions` at the solver-input level (post-bridging) so that the "identical program" claim is machine-verifiable.

4. **Summary file** (`w6-08-v19-qstar-dualcert-summary-v1.txt`): Inline `stationarity_inf_norm`, `dual_cone_min_margin`, and `dual_cone_violations` for both solvers. Currently these are buried in the full `results.json`.

5. **Review packet**: Add a row to the residual table showing the Clarabel SOC violation (`soc_min_margin = −1.96e−10`) with an explicit statement of its impact on the bound.
