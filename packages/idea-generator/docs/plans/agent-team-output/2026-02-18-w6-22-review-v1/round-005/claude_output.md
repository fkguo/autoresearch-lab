VERDICT: NOT_READY

## Blockers

1. **No independent Clarabel scan beyond tol=62.** The cross-solver gate is demonstrated at a single point (tol=62, runs v76 vs v82). The entire upper half of the $A_{\max}$ saturation narrative (tol=100, 150, 200) and the full implied-$f_1$ scan rest on ECOS alone. Without at least one Clarabel cross-check in the saturation regime (tol≥150) and one in the $f_1$ scan, the "constraint activity" interpretation is single-solver and therefore not gated.
   - Evidence: scan tables in `evidence/2026-02-18-w6-22-asrband-scan-summary-v1.md`; `pipeline/cross_solver_check_v1.json` contains only the tol=62 entry.
   - **Next action:** Run Clarabel at tol=150 (or 200) for the $A(-Q^*)$ bounds and at tol=60 or 62 for the implied-$f_1$ scan. Add entries to `cross_solver_check_v1.json` and re-run `validate_project_artifacts.py`.

2. **Cross-solver deltas are uncomfortably large relative to the physics signal.** $\Delta A_{\max}\approx 3.8\times10^{-3}$ at tol=62, while the total $A_{\max}$ variation from tol=62→100 is only $\sim 33\times10^{-3}$. That means solver noise is ~12% of the signal being interpreted. The gate threshold ($5\times10^{-3}$ abs) was chosen to pass the current data, not derived from a precision requirement.
   - Evidence: `pipeline/cross_solver_check_v1.json` (threshold), scan table rows v76–v79.
   - **Next action:** Either (a) justify the $5\times10^{-3}$ threshold from the physics precision target, or (b) tighten solver tolerances (ECOS `feastol`/`abstol`, Clarabel `tol_gap_abs`/`tol_feas`) until $\Delta A_{\max}<1\times10^{-3}$ and update the gate accordingly.

3. **Tail integral sensitivity is flagged but not bounded.** The tail integral is described as "fixed input, not optimized" and a future `tail.scale_factor` scan is mentioned. Since the tail feeds directly into the ASR residual, any fractional shift in the tail integral shifts the effective tol and therefore the $f_1^{\min}$ threshold and $A_{\max}$ saturation point. Without even a two-point bracket (e.g., scale_factor = 0.8, 1.2), the headline numbers have unknown systematic uncertainty from this source.
   - Evidence: `compute/julia/bochner_k0_socp_dispersion_bounds.jl` (tail model config); scan summary stating constancy.
   - **Next action:** Run the $A(-Q^*)$ bounds at tol=62 with `tail.scale_factor` ∈ {0.8, 1.0, 1.2} and report the induced $\Delta A_{\max}$, $\Delta f_1^{\min}$.

4. **$f_1^{\max}$ ASR residuals are noisy and unexplained.** The residuals at $f_1^{\max}$ jump between ~4.4 and ~5.9 with no monotonic trend as tol increases (e.g., v68: 5.91, v70: 4.63, v71: 5.87, v72: 4.37). This non-monotonicity suggests either solver convergence jitter or a discrete change in the active constraint set. Neither is diagnosed.
   - Evidence: implied-$f_1$ scan table, column "ASR residual at $f_1^{\max}$ solve."
   - **Next action:** Report the full active-constraint set at $f_1^{\max}$ for at least two adjacent tol values (e.g., v70 and v71) to confirm the residual variation is benign.

## Non-blocking

- The scan summary note (`evidence/2026-02-18-w6-22-asrband-scan-summary-v1.md`) should include the solver tolerance settings used for ECOS and Clarabel so the cross-solver comparison is fully reproducible without reading the Julia source.
- The cross-solver schema (`schemas/cross_solver_check_v1.schema.json`) should require a `solver_settings` object per solver entry to make the gate self-documenting.
- The $f_1^{\rm TMD}\approx 0.01198$ reference value from arXiv:2507.05375 should carry its own uncertainty; comparing a point estimate to a band is misleading without it.

## Real-research fit

The soft-ASR-band formulation is a genuine methodological improvement over binary on/off and is well-motivated for dispersive bootstrap work. The constraint-activity narrative (active → inactive transition explaining $A_{\max}$ saturation) is physically sensible and, if validated across solvers, would be a clean result. The implied-$f_1$ threshold scan is the most novel output and directly relevant to TMD phenomenology. The overall direction is sound; the blockers are about quantitative reliability, not conceptual problems.

## Robustness & safety

- **Discretization dependence:** No scan over the number of grid points or the $s$-grid spacing is reported. The SOCP is solved on a finite grid; discretization error could be comparable to or larger than the cross-solver delta. This is not a blocker for a pilot but should be flagged as a known unknown.
- **Normalization:** The ASR integral is computed as `asr_grid_integral_over_pi + asr_tail_integral_over_pi`. The $1/\pi$ normalization is applied to both pieces, which is correct only if the tail model already returns Im$A(s)$ (not $(1/\pi)\mathrm{Im}A(s)$). This should be verified by inspection of `bochner_k0_socp_dispersion_bounds.jl` — the naming convention is ambiguous.
- **Gate gaming risk:** The cross-solver gate thresholds live in a user-editable JSON file in the instance repo, not in the schema. A future run could silently loosen the gate. Consider making the schema enforce a maximum allowed threshold.

## Specific patch suggestions

1. `pipeline/cross_solver_check_v1.json` — add entries for tol=150 (Clarabel) and tol=60 (Clarabel, $f_1$ scan) once those runs exist.

2. `scripts/validate_project_artifacts.py` — add a check that `cross_solver_check_v1.json` covers at least two distinct `tol_ASR` values before the gate passes. Currently a single-point gate is accepted.

3. `compute/julia/bochner_k0_socp_dispersion_bounds.jl` — in the results dict, add an `active_constraints` array listing which constraints have residual < solver_tol at the optimum. This directly addresses the $f_1^{\max}$ residual jitter and the tol≥150 inactivity claim without requiring manual inspection.

4. `evidence/2026-02-18-w6-22-asrband-scan-summary-v1.md` — add a "Solver settings" subsection recording `ECOS.feastol`, `ECOS.abstol`, `Clarabel.tol_gap_abs`, `Clarabel.tol_feas` used in the reported runs.

5. `schemas/cross_solver_check_v1.schema.json` — add `"max_abs_tolerance": {"type": "number", "maximum": 0.01}` at the top level so the gate cannot be silently loosened beyond 1%.
