VERDICT: READY

## Blockers

- None. The increment is well-scoped, the new physics input (UV value-band anchor at $Q^2=10\,\mathrm{GeV}^2$) is cleanly separated from solver numerics, and the binding-gate mechanism provides a machine-checkable audit trail. The packet is ready to advance to the next increment.

## Non-blocking

1. **Budget decomposition transparency.** The packet names the budget artifact and says it is a "derived uncertainty budget," but never breaks out the individual budget components (scale variation, $\alpha_s$ uncertainty, higher-twist/condensate terms, missing NLO/NNLO contributions) in the review text itself. Including a small table—even just the top-level JSON fields—would let a reviewer verify conservativeness without opening the artifact. Not a blocker because the artifact exists and is schema-validated, but it would strengthen auditability.

2. **Anchor saturation at $Q^2=10\,\mathrm{GeV}^2$.** The reported band $\hat\Theta^\pi(-10\,\mathrm{GeV}^2)\in[-1.8677,\,-0.3629]$ is described as "saturating the derived budget interval." If both endpoints are hitting the imposed box constraint, then the band at lower $Q^2$ is entirely driven by how wide you chose the UV tolerance—the solver is not adding information beyond interpolating between the low-energy constraints and the UV box. This is fine and honest, but the text should explicitly flag: *the band at intermediate $Q^2$ inherits the UV tolerance as its dominant systematic*. The "Interpretation" sentence at the end gestures at this but could be sharper.

3. **Sparse modulus-cone enforcement ($n_{\rm enforce}=30$).** The $A^\pi$ channel uses $n_{\rm enforce}=200$; the $\hat\Theta$ channel uses 30. This 7× discrepancy is unexplained. Even if the trace channel is less oscillatory and 30 suffices, a brief justification (or a spot-check with 60 or 100) would rule out the possibility that the band is artificially wide because the modulus cone is under-enforced between grid points.

4. **No-ASR statement could be more precise.** The packet says "we do **not** impose any $\int ds\,\mathrm{Im}\,\Theta(s)=0$ constraint" and cites arXiv:2412.00848. It would help to note whether such a sum rule is *expected to hold* (but is not imposed for conservativeness) or is *not expected to hold* for $\hat\Theta$. The distinction matters for future increments: if it does hold, imposing it is a free tightening.

5. **Envelope algebra sign check.** The $D$ envelope rule ($D_{\min}$ from $\hat\Theta_{\min}$, $A_{\max}$) is correct for $q^2>0$ because of the relative signs in $(2\hat\Theta - (4+q^2)A)/(3q^2)$. Worth adding a one-line note that the prefactors $+2/(3q^2)$ and $-(4+q^2)/(3q^2)$ are what dictate the min/max pairing, so the envelope is not merely "conservative by convention" but follows from monotonicity in the inputs. This also clarifies that if $A$ or $\hat\Theta$ bands are non-independent (correlated through the same spectral function), the true $D$ band could be tighter.

## Real-research fit

This is a clean, incremental, evidence-gated tightening of a form-factor bootstrap band. The methodology—impose a UV value-band from perturbative QCD with an explicit, named uncertainty budget; propagate to derived quantities via exact sum-rule algebra—is standard in dispersive analyses of hadronic form factors and gravitational form factors. The work is directly relevant to the current literature on pion GFFs (post arXiv:2412.00848) and sits squarely in the "rigorous bounds" tradition (à la Ynduráin, Caprini–Colangelo–Gasser, etc.).

The fact that the result is systematics-dominated and the authors say so honestly is a strength: this is a bound, not a fit. The next step toward a publishable result would be either (a) adding low-energy lattice/dispersive input to tighten the band from below, or (b) going to NLO in the UV anchor to shrink the tolerance, both of which are within the stated scope.

## Robustness & safety

- **Overclaiming risk: low.** The "systematics-dominated" disclaimer is present. The band shrinks from $\sim\!124$ units wide to $\sim\!26$ units wide for $\hat\Theta$ at $Q^2=2\,\mathrm{GeV}^2$, and from $\sim\!0.91$ to $\sim\!0.28$ for $D$. These are large factors, but all driven by a single new constraint (UV anchor). The packet correctly identifies this.
- **Hidden hand-tuning risk: medium-low.** The budget is derived by a builder script and validated by a gate, which is good. But since I cannot inspect the builder, I note that the *choice* of $Q^2=10\,\mathrm{GeV}^2$ as the anchor point and the specific tolerance formula are the key "knobs." A sensitivity scan (anchor at 5, 10, 20 GeV²) would demonstrate robustness. Not a blocker because the single-point anchor is the minimal conservative choice.
- **Numerical reliability.** Clarabel (a Rust-based conic solver) is well-tested for SOCP. The run is laptop-feasible. No flags.
- **Correlation neglect in $D$ envelope.** As noted above, the envelope treats $A$ and $\hat\Theta$ bands as independent, which is conservative (wider). No safety issue, but worth tracking for future tightening.

## Specific patch suggestions

1. **Add a budget summary table to the review packet text.** Even three lines:
   ```
   | Component          | Contribution to tolerance |
   |--------------------|--------------------------|
   | Scale variation    | ±X                        |
   | α_s uncertainty    | ±Y                        |
   | Higher-order/twist | ±Z (proxy)                |
   ```
   This makes the budget auditable without opening the JSON.

2. **Add one sentence on $n_{\rm enforce}$ choice:**
   > "We use $n_{\rm enforce}=30$ for the modulus cone in the trace channel; a spot-check at $n_{\rm enforce}=60$ showed band endpoints changed by $< 0.5\%$, confirming adequacy."
   If this check hasn't been done, do it—it's a single re-run.

3. **Clarify the no-ASR status.** Replace:
   > "per arXiv:2412.00848 discussion; we do **not** impose any $\int ds\,\mathrm{Im}\Theta(s)=0$ constraint."
   
   with something like:
   > "The anomalous sum rule $\int ds\,\mathrm{Im}\,\hat\Theta(s)/s^2 = \ldots$ is not imposed; it is not expected to hold at the $\hat\Theta$ level without subtracting the trace anomaly contribution (see arXiv:2412.00848 §X). Imposing it would be incorrect for $\hat\Theta$ as defined here."
   
   (Adjust physics content as appropriate—the point is to distinguish "not imposed for conservativeness" from "not valid.")

4. **Flag the correlation structure for future $D$ tightening.** Add to the evidence note:
   > "The $D$ envelope treats $A$ and $\hat\Theta$ as independent. Since both are constrained by the same underlying spectral function $\rho(s)$, a joint bootstrap (optimizing $D$ directly) would yield a tighter band. This is deferred to a future increment."

5. **Sensitivity to anchor placement.** Consider adding a one-off comparison: anchor at $Q^2 = 5\,\mathrm{GeV}^2$ vs. $10\,\mathrm{GeV}^2$ vs. $20\,\mathrm{GeV}^2$. Even if only reported in the evidence note, this would demonstrate that the tightening is not an artifact of picking the "sweet spot."
