VERDICT: READY

## Blockers
- None.

## Non-blocking
- The "Im-only cone" yields physically loose bands ($\hat\Theta \in [-66, 66]$ at $Q^2=2$), which limits the immediate utility of the derived $D$-band. The "proof-of-concept" framing is accurate, but the success of the deliverable sequence depends entirely on the PV-recovery plan.
- The sum-rule audit reports a negative tail contribution ($-1.03$). While the arithmetic holds ($3.03 - 1.03 \approx 2$), ensure this negative sign is consistent with the specific pQCD model (Eq. `imTh`) and phase conventions used, as scalar spectral densities are often positive in simple models.

## Real-research fit
- The algebraic derivation of $D^\pi$ from independent $A$ and $\Theta$ bands is standard and correct.
- The explicit reporting of "grid value," "tail value," and "target" in the residuals makes the mass sum rule implementation verifiable without code inspection.

## Robustness & safety
- The sign analysis for the $D$-envelope ($D_{\min}$ using $\hat\Theta_{\min}, A_{\max}$) is correct for the kinematic region $q^2 > 0$.
- The decision to restrict post-processing to the intersection grid correctly handles potential mismatches between the $A$ and $\Theta$ run configurations.

## Specific patch suggestions
- Regarding the PV-recovery plan (Step 2): When implementing the variable scaling $z_i = \mathrm{Im}\hat\Theta(s_i)/\sqrt{c_{\rm fac}(s_i)}$, verify that `scale_S0(s)` (and thus $c_{\rm fac}$) is strictly bounded away from zero on the chosen grid points to avoid introducing new singularities.
