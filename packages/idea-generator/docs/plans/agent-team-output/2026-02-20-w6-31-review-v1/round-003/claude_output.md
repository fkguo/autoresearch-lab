VERDICT: NOT_READY

## Blockers

1. **Theta-hat band is uninformatively wide.** At $Q^2=2\,\text{GeV}^2$ the band is $\hat\Theta\in[-65.97,\,66.41]$, which is symmetric around zero to within ~0.3%. For a quantity whose forward value is exactly2(mass sum rule), a band spanning $\pm66$ at moderate $Q^2$ carries essentially no constraining power. The derived $D$-band inherits this: $D\in[-0.530,\,0.439]$ is dominated by the $\hat\Theta$ width divided by $q^2\sim103$, so the $A$-band contribution is almost irrelevant. Before declaring this a "deliverable," the packet must either (a) demonstrate that the band narrows meaningfully at lower $Q^2$ (show a table at $Q^2=0.05,\,0.1,\,0.5\,\text{GeV}^2$), or (b) explicitly state that the current Im-only cone is too weak to be physically informative and that the result is a proof-of-concept only. Without this, the evidence note and manuscript bullet risk overclaiming.

2. **The PV-tightened run failure is not just a footnote—it is the critical path.** The Im-only cone discards the real-part dispersion relation, which is the main source of constraining power in the $A$-band GTB setup. Recording the `NUMERICAL_ERROR` as a failure-library entry is necessary but not sufficient: the packet needs a concrete next-step plan (preconditioning, reformulation, solver switch to MOSEK/SCS, reduced grid) to recover the PV constraint. Without it, the Theta channel is stuck at proof-of-concept indefinitely.

3. **Missing cross-check of the mass sum rule enforcement.** The packet states the sum rule $(1/\pi)\int ds\,\text{Im}\hat\Theta(s)/s=2$ is enforced via a grid+tail split, but provides no numerical verification that the optimizer's solution actually satisfies it (e.g., printing the realized integral value at the optimum for both the min and max problems). For the $A$-band work, analogous sum-rule residuals were presumably checked; the same audit is needed here.

4. **Envelope rule correctness is not proven for the sign structure.** The stated rule "$D_{\min}$ uses $\hat\Theta_{\min}$ and $A_{\max}$" is correct only when the coefficients of $\hat\Theta$ and $A$ in the $D$ formula have definite signs. The formula is $D = [2\hat\Theta - (4+q^2)A]/(3q^2)$. For $q^2>0$: the coefficient of $\hat\Theta$ is $+2/(3q^2)>0$ and the coefficient of $A$ is $-(4+q^2)/(3q^2)<0$. So indeed $D_{\min}$ needs $\hat\Theta_{\min}$ and $A_{\max}$, and vice versa. The algebra checks out—but the packet never shows this sign analysis. It should be stated explicitly in the evidence note so a reader can verify the envelope without re-deriving.

## Non-blocking

- The $\eta$-floor value `eta_floor_0p6` is mentioned but not motivated. A brief sentence on why0.6 was chosen (and whether the band is sensitive to it) would strengthen the evidence note.
- The plot helper generalization (`--ymin-key` etc.) is fine but the naming convention is fragile; consider a single `--observable` flag that sets defaults.
- The manuscript bullet text is not shown in the packet. Ensure it does not claim the $D$-band is "tight" or "competitive with lattice"—it should say "conservative outer bound from independent pion-only channels."
- The `scale_S0(s)` reference to arXiv:2403.10772 Eq. (FFS0scale) should include the equation number, not just a tag, for reproducibility.

## Real-research fit

The strategy of bootstrapping $\hat\Theta$ independently and then combining algebraically with $A$ to get $D$ is sound and well-motivated. The pion $D$-term is a high-value target (mechanical properties, pressure distribution). However, the current numerical outcome ($\hat\Theta$ band width ~132 at $Q^2=2\,\text{GeV}^2$) means the physics payoff is near zero until the PV-tightened version works. The proof-of-concept value is real—confirming the code, sum rule, and algebra pipeline—but the packet should frame it that way rather than as a completed deliverable.

## Robustness & safety

- The absence of an ASR for $\Theta$ is correctly noted and correctly handled (not imposed). This is consistent with the slow UV falloff of $\text{Im}\,\Theta$.
- Using a fixed pQCD tail beyond $s_0$ is standard but introduces model dependence. The packet does not vary $s_0$ or the tail normalization to assess sensitivity. This is acceptable at proof-of-concept stage but must be addressed before any physics claim.
- The failure-library entry for the PV run is good practice. Ensure the entry includes the Clarabel version, Julia version, and machine specs so the failure is reproducible.

## Specific patch suggestions

1. **Add a sum-rule residual check (Blocker 3).** In `theta_trace_s0_socp_dispersion_bounds.jl`, after solving, compute and print:
   ```julia
   sr_grid = sum(imTh_opt[i] / s_grid[i] * ds for (i, ds) in enumerate(ds_weights)) / π
   sr_tail = <tail integral value>
   @info "Mass sum rule check" sr_grid sr_tail sr_total=sr_grid+sr_tail target=2.0
   ```
   Include these values in the run's `summary.json`.

2. **Add sign-analysis comment in `derive_d_band_from_a_theta_hat.py` (Blocker 4).** Near the envelope computation:
   ```python
   # D = [2*Th_hat - (4+q2)*A] / (3*q2)
   # coeff of Th_hat: +2/(3*q2) > 0  =>  D_min needs Th_hat_min
   # coeff of A:-(4+q2)/(3*q2) < 0  =>  D_min needs A_max
   ```

3. **Add a low-$Q^2$ table to the evidence note (Blocker 1).** Show $\hat\Theta$ and $D$ bands at $Q^2\in\{0.05, 0.1, 0.25, 0.5, 1.0, 2.0\}\,\text{GeV}^2$ so the reader can see where (if anywhere) the band is informative.

4. **Frame the deliverable as proof-of-concept in the manuscript bullet and evidence note (Blocker 1).** Replace any language suggesting a "result" with language like "pipeline validated; band not yet physically competitive; PV-tightening required for informative constraints."
