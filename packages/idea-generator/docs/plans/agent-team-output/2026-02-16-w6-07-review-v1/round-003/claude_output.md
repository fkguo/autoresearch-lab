VERDICT: NOT_READY

## Blockers

### B1. Dual certificate is not a true dual certificate — it relies on solver self-reporting

The packet constructs `A_min^dual(Q*)` by reading `dual_objective_value` directly from the solver's output dictionary and adding `tail_const`. This is **not** an independently verified dual certificate. A proper dual certificate would extract the dual variables (y, s), verify primal/dual feasibility of those vectors to within a stated tolerance, and then evaluate the dual objective from them. The current approach simply trusts the solver's internal bookkeeping, which is exactly the thing cross-solver comparison was supposed to guard against.

**Next action:** In `bochner_k0_socp_dispersion_bounds.jl`, after each solve at Q*, extract the full dual variable vector from the solver, independently recompute:
1. dual feasibility residual ‖A^T y + s − c‖,
2. conic membership of s (s ∈ K*),
3. dual objective value b^T y,

and log all three. Only the independently recomputed b^T y + tail_const constitutes a dual-certified lower bound.

### B2. `tail_const` derivation is circular and unauditable

The tail constant is computed as `tail_const = A_min(Q*) − objective_value`, i.e., it is backed out from the *primal* optimal value. This means the "dual lower bound" is mechanically `A_min − (obj − dual_obj)`, which is just `A_min − duality_gap`. The packet never shows an independent derivation of `tail_const(Q*)` from the UV-tail integral formula. If the tail integral has even a sign error or an off-by-one in the discretization boundary, the entire certificate is wrong and this construction would hide it.

**Next action:** Compute `tail_const(Q*)` directly from the analytic UV-tail formula (the integral from `t_max` to ∞) as a standalone function, log it separately, and cross-check against the backed-out value. Both numbers must agree to within solver tolerance. Document the formula in the kernel source.

### B3. No `results.json` file is included or quoted in machine-readable form

The review packet quotes six floating-point numbers for Clarabel and four for ECOS but provides no path to an actual `results.json` that a reviewer can inspect. The stated file paths point to run directories, not to specific JSON files. Without machine-readable provenance, the numbers cannot be audited offline.

**Next action:** Include the literal `results.json` contents (or the exact relative path within each run directory) for both v18-full and v18-ecos-smoke-v2 runs.

### B4. ECOS run is a "smoke v2" on a mini-grid — not comparable at the same Q* grid point

The packet says ECOS uses a "Q2 mini-set" while Clarabel uses the full 200-point grid. Unless both solvers solve the **identical** conic program (same Q* value, same discretization grid, same `N_enf`), the cross-solver comparison is not meaningful for certification purposes. The large spread in A_min(Q*) between the two solvers (0.0073 vs 0.018) is suspicious and may reflect different problems being solved rather than solver differences.

**Next action:** Run ECOS on the identical full 200-point grid and `N_enf=200` configuration used for Clarabel. If resource constraints prevent this, run at least the single Q* = 15.438084 problem with identical parameters under both solvers, and document the parameter match explicitly.

### B5. No worst-case residual numbers are quoted in the packet

The packet references `2026-02-16-w6-07-v18-residual-worstcase-v1.txt` but does not quote the actual worst-case residual values. A reviewer cannot assess feasibility without these numbers. The phrase "order 1e-10–1e-9" is vague and applies only to Q*, not to the full grid.

**Next action:** Quote the worst-case residual values (equality and inequality/conic margins) across the full grid, with the grid point at which each worst case occurs.

## Non-blocking

- **N1.** The conservative framing (report smallest dual-certified bound, cite spread as systematic) is reasonable *once the dual certificate is genuine* (B1–B2 resolved). However, the factor-of-2.5 spread between Clarabel and ECOS A_min values at Q* should be investigated and explained, not merely enveloped.

- **N2.** The question about hard-enforcing a residual gate in-kernel (reviewer question 3): this is recommended but non-blocking. A post-hoc gate at review time is acceptable if the residuals are fully logged and quoted.

- **N3.** The six-digit precision in Q* = 15.438084 m_π² suggests grid-resolution dependence. A brief comment on how Q* shifts with grid refinement (e.g., 100 vs 200 vs 400 points) would strengthen the paper but is not required for Phase L sign-off.

## Real-research fit

The overall approach — Bochner positivity + dispersive SOCP to establish a model-independent positivity window for the pion gravitational form factor — is physically well-motivated and would be a novel result if the numerics are properly certified. The $Q^*$ framing is conservative and appropriate for a first pilot. The main risk is that the "certification" layer currently provides less assurance than it claims (see B1–B2), which could undermine the paper's central quantitative statement.

## Robustness & safety

- The duality-gap construction (B2) masks rather than reveals potential discretization or tail-integral errors. This is the most safety-critical issue.
- Single-channel assumptions are stated but the kernel code path that enforces them has not been quoted or diff'd in the packet. A brief code-level confirmation that no multi-channel terms enter the SOCP would be valuable.
- The lack of a grid-refinement convergence study means the positivity window could shift materially with finer grids. Not a blocker, but it means the claimed Q* precision is overstated.

## Specific patch suggestions

1. **`bochner_k0_socp_dispersion_bounds.jl`** — After `optimize!(model)`, add:

```julia
# Independent dual certificate
y = dual.(constraints_eq)       # or however JuMP exposes duals
s = ...                          # extract conic dual slack
dual_feas = norm(A' * y + s - c) # recompute
dual_obj_check = dot(b, y)       # recompute
@assert dual_obj_check ≈ dual_objective_value(model) atol=1e-8
# Log dual_feas, dual_obj_check, conic membership of s
```

(Exact syntax depends on JuMP/MathOptInterface version; adapt accordingly.)

2. **`bochner_k0_socp_dispersion_bounds.jl`** — Add a standalone function:

```julia
function uv_tail_const(Q2, t_max, spectral_params...)
    # Analytic integral from t_max to ∞
    # Document formula with equation reference
    return tail_value
end
```

Call this at each Q2 probe point and log `tail_const_analytic` alongside the backed-out `tail_const_solver`. Assert agreement.

3. **Run scripts** — For the ECOS comparison run, ensure the launch script passes identical `--grid`, `--N_enf`, and `--t_max` parameters as the Clarabel run. Log these in `meta.json` or equivalent.

4. **Review packet** — Include a table like:

| Quantity | Clarabel (v18 full) | ECOS (v18 full) | Path |
|---|---|---|---|
| A_min(Q*) | ... | ... | `runs/.../results.json` |
| dual_obj (recomputed) | ... | ... | ... |
| dual_feas_norm | ... | ... | ... |
| tail_const (analytic) | ... | ... | ... |
| worst-case eq residual | ... | ... | ... |
| worst-case ineq margin | ... | ... | ... |
