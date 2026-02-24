VERDICT: READY

## Blockers

- None.

## Non-blocking

1. **Certified-dot terminology could benefit from a one-sentence clarification in the manuscript.** The phrase "perturbation-certified (dot)" is introduced but its operational definition (i.e., what perturbation model is applied and what "dot" refers to—presumably the inner product $\langle y, b\rangle$ of the dual solution with the constraint RHS) may not be immediately transparent to a reader encountering it for the first time. A parenthetical gloss such as "(the dual objective evaluated at the recovered dual point, minus the maximal perturbation consistent with solver-reported residuals)" would help. This is a readability issue, not a correctness issue.

2. **ECOS robustness-probe framing.** The packet correctly notes that ECOS inputs can differ due to MOI/bridge transformations, and the report treats ECOS as a robustness probe rather than an independent certificate. This is appropriate. However, it would strengthen the manuscript to add one sentence quantifying the *magnitude* of the Clarabel–ECOS discrepancy at $Q^*$ (even qualitatively: "agree to $\sim$X%"), so the reader can assess how informative the cross-solver check actually is. If the ECOS run does not converge or returns a substantially different value, that should be noted explicitly.

3. **Reproduction commands reference config filenames with underscores vs. hyphens.** The cited configs `compute/a_bochner_k0_socp_config_v2j_dispersion_grid200_enf200_qstar_audit3_{clarabel,ecos}.json` use underscores throughout, while run directory names use hyphens. This is presumably a project convention (configs use underscores, run dirs use hyphens), but a brief note or a symlink/alias would reduce friction for an external reproducer.

4. **Numerical precision display.** The dual-audit value $0.007013843297$ and certified-dot value $0.001323470939$ are reported to 12–13 significant figures. Given that the solver tolerances are typically $\mathcal{O}(10^{-8})$ or worse, displaying this many digits could give a false impression of precision. Consider truncating to the number of digits actually warranted by solver accuracy and stating the solver tolerance alongside the value (e.g., "$0.00701 \pm \mathcal{O}(\epsilon_{\rm solver})$"). This is a presentation suggestion, not a factual error.

## Real-research fit

The update is well-scoped: it is a documentation-hardening pass that swaps v19 numbers for v21 audit3 numbers and adds a conservative perturbation bound. The key physics claims—positivity of $A_{\min}$ at the chosen $Q^*$—remain a numerical audit, not a rigorous certificate, and the manuscript is appropriately careful about this distinction. The addition of the certified-dot bound is a genuine value-add: it provides a lower bound that accounts for solver residuals, and its positivity ($\sim 1.3 \times 10^{-3}$) provides meaningful margin above zero even after perturbation corrections. This is a sensible incremental step before the planned robustness scans (varying `eta_floor`, tail model, `s_max`).

The overall pilot methodology—SOCP relaxation of the Bochner positivity constraint on the pion gravitational form factor spectral function, with dual-gap and cross-solver audits—remains sound and well-motivated for a bootstrap-style feasibility study.

## Robustness & safety

- **No overstatement detected.** The packet and manuscript excerpts consistently frame the result as a "numerical audit" and explicitly disclaim formal certificate status. The certified-dot bound is labeled "optional" and "conservative," which is appropriate.
- **Solver-dependence is acknowledged.** The dual-audit methodology relies on re-evaluating the dual objective outside the solver, which mitigates (but does not eliminate) solver-specific numerical artifacts. The ECOS cross-check further reduces this risk.
- **The margin above zero is modest but meaningful.** The primary dual-audit value ($7.0 \times 10^{-3}$) is well above typical solver noise ($\lesssim 10^{-7}$), and the certified-dot bound ($1.3 \times 10^{-3}$) retains a comfortable margin. This does not guarantee that the bound survives systematic physics variations (which is the purpose of the next unit), but numerically the current audit is robust.
- **No risk of data leakage or circular reasoning** in this documentation update; the underlying Phase K bounds are unchanged.

## Specific patch suggestions

1. **In the manuscript, after introducing $A_{\min}^{\rm certified\text{-}dot}$, add:** "Here the 'certified-dot' bound subtracts from the recomputed dual objective the maximum perturbation consistent with the solver's reported primal and dual residuals (see Appendix X / the `dual_check` diagnostic in the run output)."

2. **Add solver tolerance context alongside the reported values**, e.g.: "Clarabel reports primal/dual residuals $\lesssim 10^{-8}$; the certified-dot bound absorbs these residuals and remains positive at $1.32 \times 10^{-3}$."

3. **Truncate displayed precision** to 4–6 significant figures unless the full-precision values are needed for exact bitwise reproduction: $A_{\min}^{\rm dual\text{-}audit}(Q^*) = 0.007014$ and $A_{\min}^{\rm certified\text{-}dot}(Q^*) = 0.001323$.

4. **In the reproduction-commands block, add a note:** "Config files use underscores; run directories use hyphens per project convention."
