VERDICT: NOT_READY

## Blockers

1. **Slope constraint normalization not independently verified — possible units error driving false infeasibility.**
   The claim is that the slope sum rule is
   $$A'(0) = \frac{1}{\pi}\int_{4m_\pi^2}^{\infty} ds\,\frac{\mathrm{Im}\,A(s)}{s^2}$$
   and the target value is $f_1 = m_\pi^2/m_{f_2}^2$. However, the TMD estimate in arXiv:2507.05375 gives $A'(0)$ in *physical* units (GeV$^{-2}$), and the campaign works in $m_\pi = 1$ units where $s_{\rm thr} = 4$. The conversion factor between the two is $1/m_\pi^2 \approx 52\,\text{GeV}^{-2}$, i.e., $A'_{\text{campaign}}(0) = m_\pi^2 \, A'_{\text{phys}}(0)$. The stated target $f_1 = m_\pi^2/m_{f_2}^2 \simeq 0.0119$ (dimensionless) is numerically identical to $m_\pi^2/m_{f_2}^2$ in physical units — but whether the *spectral integral* on the RHS has had the same $m_\pi^2$ rescaling applied consistently is not demonstrated anywhere in the review packet. Specifically:
   - The tail integral `I_slope_tail = ∫_{s0}^{∞} ds Im_tail(s)/s^2` uses the campaign's `Im_tail(s)` which is defined in $m_\pi=1$ units. If the spectral function normalization in the campaign already absorbs a factor (e.g., because the overall GFF normalization convention differs from arXiv:2507.05375 by a factor of $m_\pi^2$ or $16\pi^2$), the slope target $f_1$ could be off by an $O(1)$ or $O(10^2)$ multiplicative factor — which would trivially explain the INFEASIBLE result.
   - **No cross-check** is provided (e.g., evaluating the slope integral on the *feasible baseline spectral function* and comparing with $f_1$). This single diagnostic would immediately distinguish "genuine physics incompatibility" from "units bug." Without it the INFEASIBLE conclusion cannot be trusted.
   - File: `idea-runs/.../compute/julia/bochner_k0_socp_dispersion_bounds.jl` — the lines computing `slope_eq` and `I_slope_tail` need an explicit units audit with a worked numerical example in the negative-result note.

   **Next action:** Compute $A'_{\rm baseline}(0) \equiv \frac{1}{\pi}\sum_i w_i^{\rm slope}\,c_i^{\rm baseline}$ on the *feasible* baseline solution (v33/v34/v35 runs) and compare with $f_1$. Report the ratio. If it is $O(1)$ the infeasibility is physics; if it is $\gg 1$ or $\ll 1$ there is a normalization bug.

2. **Tolerance band may be too narrow, masking a "barely feasible" scenario.**
   The tolerance is derived only from $\delta m_{f_2}$ propagated through $f_1 = m_\pi^2/m_{f_2}^2$. This gives a fractional uncertainty $\sim 2\,\delta m_{f_2}/m_{f_2} \approx 3\%$. But the TMD estimate itself is an $O(1)$ model assumption (single-resonance saturation of the slope), and there is no NLO ChPT error band quoted. A factor-of-2 tolerance scan should be run before concluding infeasibility is robust.
   - File: config JSONs (`...baseline_slope_tmd.json`, `...moml2_slope_tmd.json`) — `f1_absolute_tolerance` value.

   **Next action:** Re-run the feasibility solve with `f1_absolute_tolerance` multiplied by 2, 5, and 10, and record the critical tolerance at which feasibility is restored. Add this to the negative-result note.

3. **No solver cross-check (SCS/Clarabel) for the INFEASIBLE verdict.**
   The packet states ECOS returns INFEASIBLE, but ECOS is known to be fragile with near-degenerate linear constraints (the slope row is a single dense constraint added to a large SOCP). A single SCS or Clarabel run would rule out solver-specific false infeasibility.
   - File: config JSONs — `solver` field.

   **Next action:** Run v36 config with `solver: "SCS"` (or Clarabel) and record status. If SCS also returns INFEASIBLE, the conclusion is strengthened; if it returns a feasible point, the ECOS result is spurious.

## Non-blocking

- The negative-result note (`neg_results/2026-02-18-chpt-slope-sum-rule-infeasible-v1.txt`) is well-structured but should eventually include the baseline-slope diagnostic value requested in Blocker 1. Not blocking because the note is clearly marked NOT_FOR_CITATION and can be amended.
- The failure library JSONL records and dashboard updates are present and queryable — good practice.
- The draft report limitation bullet is appropriate in tone ("preliminary; units audit pending" would be more honest, but acceptable as-is for an internal draft).
- The `results.json` files from v36/v37 should include the `slope_eq` residual values even for INFEASIBLE runs (NaN or solver-reported dual certificate). If they are missing, add them for archival completeness.
- The opportunity pool diagnostic gate card is a good idea; the suggested "single-knob relaxation" scan (reviewer question 3) is exactly what Blockers 1–2 request.

## Real-research fit

The motivating physics question — whether low-energy ChPT/TMD slope information can tighten dispersive bootstrap bounds on $A^\pi(-Q^2)$ — is well-posed and relevant. The approach (adding a linear slope sum rule to the existing SOCP) is the natural first step. However, the research value of the negative result is limited unless the infeasibility is *demonstrated* to be physics-driven rather than normalization-driven. A confirmed infeasibility would itself be interesting: it would imply that the current spectral ansatz + positivity + OPE constraints are already inconsistent with single-$f_2$ dominance of the slope, suggesting either (a) the spectral parametrization is too rigid, or (b) the TMD estimate is quantitatively wrong for the pion. Either conclusion is publishable, but only after the units cross-check in Blocker 1.

Regarding reviewer question 4 (most promising tightening direction): the sharpest avenue consistent with pion-only, no coupled-channel is likely *threshold shape constraints* — imposing the known $\sqrt{s - 4m_\pi^2}$ P-wave phase-space behavior of $\mathrm{Im}\,A(s)$ near $s = 4m_\pi^2$ via additional linear constraints or a reparametrization of the low-$s$ spectral bins. This is complementary to the slope and does not suffer from the same TMD model dependence.

## Robustness & safety

- **Normalization/units:** This is the load-bearing concern. See Blocker 1. The review packet does not include an explicit worked example converting arXiv:2507.05375 Eq. (TMD) from physical units to campaign units.
- **Discretization:** The slope sum rule involves $1/s^2$ weights, which are large at threshold ($s = 4$) and decay rapidly. With 200 grid points the low-$s$ bins dominate; if the grid is log-spaced vs. linear, the effective constraint changes. The config should document the grid spacing used for the slope row. Not blocking because the baseline runs (without slope) use the same grid and are feasible.
- **Tail subtraction:** The `I_slope_tail` integral uses the campaign's asymptotic tail model. Since $1/s^2$ converges faster than the $1/s^{k}$ moments already in the stack, the tail contribution should be small — but its numerical value should be reported in the negative-result note.
- **Solver numerics:** See Blocker 3. ECOS infeasibility certificates can be unreliable when the infeasibility margin is small.

## Specific patch suggestions

1. **`bochner_k0_socp_dispersion_bounds.jl`** — Add a post-solve diagnostic block (even for INFEASIBLE status) that computes and logs:
   ```julia
   # Evaluate slope integral on baseline (no-slope) solution for cross-check
   slope_baseline = sum(w_slope .* c_baseline) / pi + I_slope_tail / pi
   @info "Slope integral on baseline solution" slope_baseline f1 ratio=slope_baseline/f1
   ```
   This is the single most informative diagnostic.

2. **Config JSONs (`...slope_tmd.json`)** — Add a `"f1_tolerance_scan": [1.0, 2.0, 5.0, 10.0]` field (or equivalent) and run the feasibility solve at each multiplier. Record the critical multiplier in `results.json`.

3. **Negative-result note** (`neg_results/2026-02-18-chpt-slope-sum-rule-infeasible-v1.txt`) — Amend with:
   - Explicit unit-conversion derivation (3–5 lines) from arXiv:2507.05375 physical units to campaign $m_\pi = 1$ units.
   - Numerical value of `I_slope_tail`.
   - Baseline slope integral value (once computed per suggestion 1).
   - Solver cross-check result (SCS/Clarabel, once run per Blocker 3).

4. **Failure library JSONL** (`failed_approach_v1.jsonl`) — Add a `"diagnosis_status": "pending_units_audit"` field to the two new records so that downstream queries can distinguish confirmed-physics failures from unverified ones.
