VERDICT: READY

## Blockers

- None. The packet correctly identifies the Clarabel NUMERICAL_ERROR as a solver-level issue rather than a physics conclusion, records it as a negative result, and does not overclaim. The ECOS diagnostic result ($A_{\min}(-Q^*) \approx 0.006776 > 0$) is appropriately labeled as partial/diagnostic evidence, not a primary result. Proceeding to Clarabel tuning retries and an $\eta_{\rm floor}$ scan is the correct next step.

## Non-blocking

1. **Phrasing tightness on "partial robustness evidence."** The current language is acceptable but could be sharpened. Specifically: the ECOS result should carry an explicit caveat that ECOS is used here in a *diagnostic* capacity only (second-solver cross-check) and that the $\eta(s)=1$ robustness claim will not be promoted to mainline evidence until the primary solver (Clarabel) can reproduce it or a second independent solver (e.g., SCS, MOSEK) confirms. Suggest adding a one-sentence qualifier: *"This ECOS-only result constitutes a diagnostic indicator, not a solver-independent confirmation; it will be upgraded to mainline evidence only upon reproduction by at least one additional solver."*

2. **Dual-audit detail.** The summary says "dual-audit agrees within numerical noise" for the ECOS run but does not quote the primal-dual gap or the specific dual objective value. For the summary bundle (and any eventual paper supplemental), include: (a) primal objective, (b) dual objective, (c) absolute and relative gap, (d) ECOS exit flag and iteration count. This is standard practice for conic-program evidence and costs nothing.

3. **Clarabel retry strategy (answering reviewer question 3).** Highest-leverage options in rough priority order:
   - **(a) Explicit variable bounds / box constraints.** With $\eta_{\rm floor}=1$ the modulus constraint is *tighter* (the elastic-unitarity circle is smallest). If the feasible set is thin, Clarabel's interior-point method may lose numerical feasibility due to large iterates. Adding explicit upper bounds on the Bochner coefficients (even generous ones, e.g., $|a_k| \le 10^3$) can regularize the barrier and keep iterates bounded.
   - **(b) Clarabel's `direct_solve_method` toggle.** Switch from the default `qdldl` to `mkl_pardiso` (if available) or try `iterative` refinement. This often fixes NUMERICAL_ERROR that arises from poor pivot selection in the KKT factorization.
   - **(c) Tighten `eps_abs` / `eps_rel` asymmetrically.** Loosening the primal tolerance slightly (`eps_abs = 1e-6` → `1e-5`) while keeping dual tight can let Clarabel find a feasible point before the barrier degrades.
   - **(d) Warm-start from ECOS solution.** Export the ECOS primal-dual solution, convert to Clarabel variable ordering, and supply as a warm start. This sidesteps the cold-start feasibility issue entirely.
   - **(e) SCS as an independent third solver.** SCS (splitting conic solver, ADMM-based) handles ill-conditioned problems more gracefully than interior-point methods; it would give a genuinely independent confirmation alongside ECOS.

4. **$\eta_{\rm floor}$ scan grid design.** For the upcoming scan, suggest at minimum: $\eta_{\rm floor} \in \{0.6, 0.7, 0.8, 0.9, 0.95, 1.0\}$, run on both Clarabel and ECOS, with a machine-readable output table (JSON or CSV) that feeds directly into a monotonicity plot $A_{\min}(Q^*; \eta_{\rm floor})$ vs. $\eta_{\rm floor}$. This will cleanly show whether the positivity margin degrades smoothly or cliff-edges.

5. **Failure-library entry completeness.** Confirm that the `failed_approach_v1.jsonl` entry includes: (a) the full config path, (b) the Clarabel version string, (c) the termination status enum, (d) the iteration count at failure, and (e) the last primal/dual residuals before termination. These fields are essential for future automated triage.

## Real-research fit

The probe addresses a genuine concern that any referee would raise: *"How sensitive is the positivity bound to the assumed inelasticity profile?"* The $\eta(s)=1$ case is the physically most conservative (purely elastic unitarity everywhere), so demonstrating positivity there would be a strong robustness statement. The fact that this is being pursued as a dedicated work unit with failure recording is methodologically sound and reflects real research discipline. The ECOS diagnostic result ($A_{\min} \approx 0.00678 > 0$, compared to the mainline $\eta_{\rm floor}=0.6$ result which is presumably larger) is physically reasonable—tighter unitarity constraints should reduce the positivity margin but not necessarily eliminate it.

## Robustness & safety

- **No overclaiming detected.** The packet explicitly disclaims promoting the ECOS-only result to a Clarabel-backed robustness statement. This is correct.
- **Failure recording is appropriate.** Treating NUMERICAL_ERROR as a solver/numerics failure rather than physical infeasibility is the right call; the packet does not attempt to extract physics from a failed solver run.
- **One minor safety note:** When proceeding to the $\eta_{\rm floor}$ scan, ensure that any interpolation or monotonicity claims about $A_{\min}(\eta_{\rm floor})$ are based solely on successfully solved instances (not extrapolated through NUMERICAL_ERROR points). Flag any $\eta_{\rm floor}$ value where the primary solver fails.

## Specific patch suggestions

1. **Summary bundle, claim (1):** After "$A_{\min}(-Q^*) \approx 0.006776 > 0$", insert: *"(ECOS diagnostic only; not yet confirmed by primary solver. Primal-dual gap: [value]. ECOS iterations: [value]. This result is not promoted to mainline evidence.)"*

2. **Negative-result note:** Add Clarabel's last-iteration primal and dual residuals (available from the solver log) to the `.txt` file. These are diagnostic gold for the retry.

3. **Config for next Clarabel retry (v2q or similar):** Add to the JSON:
   ```json
   "clarabel_settings": {
     "direct_solve_method": "mkl_pardiso",
     "eps_abs": 1e-5,
     "eps_rel": 1e-7,
     "max_iter": 500,
     "equilibrate_enable": true
   },
   "variable_bounds": {
     "bochner_coeff_abs_max": 1000.0
   }
   ```
   (Adapt field names to your config schema.)

4. **Island progress stream:** Ensure the event for v24/v25 failures includes a `"next_action"` field pointing to the Clarabel tuning retry + $\eta_{\rm floor}$ scan, so the dashboard shows a clear forward path rather than a dead end.

5. **Scan grid output schema (for upcoming unit):** Define upfront:
   ```json
   {
     "eta_floor": 0.8,
     "solver": "clarabel",
     "status": "OPTIMAL",
     "A_min_Qstar": 0.0123,
     "primal_dual_gap": 1.2e-8,
     "iterations": 47
   }
   ```
   This avoids ad-hoc formatting across the scan and enables automated plotting.
