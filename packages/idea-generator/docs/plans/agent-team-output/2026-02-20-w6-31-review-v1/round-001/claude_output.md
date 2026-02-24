VERDICT: NOT_READY

## Blockers

1. **Theta-hat band is uninformatively wide.** At $Q^2=2\,\text{GeV}^2$ the band is $\hat\Theta\in[-65.97,\,66.41]$, which is symmetric around zero to within ~0.3%. For a quantity whose forward value is pinned at $\hat\Theta(0)=2$, a band spanning $\pm66$ at moderate $Q^2$ carries essentially no physics content. The derived $D$-band inherits this: $D\in[-0.530,\,0.439]$ is driven almost entirely by the $\hat\Theta$ width divided by $q^2$, not by any interplay with the $A$ band. Before declaring this a "second independent GFF target," the authors need either (a) a quantitative argument that the Im-only cone is expected to be this loose and that tightening is blocked by a fundamental obstacle (not just a Clarabel numerical error), or (b) additional constraints that narrow the band to a regime where it actually discriminates among models. As it stands, the deliverable does not meet the stated purpose of providing an independent constraint beyond $A^\pi$.

2. **PV-tightened failure is insufficiently diagnosed.** The v1 run with the full modulus cone + PV dispersion relation—which is the physically more complete formulation—fails with Clarabel `NUMERICAL_ERROR`. Recording this in the failure library is necessary but not sufficient. There is no evidence that the failure is due to an intrinsic ill-conditioning of the problem rather than a fixable implementation issue (e.g., scaling, preconditioning, solver tolerances, or switching to MOSEK/SCS). The Im-only fallback is presented as the mainline deliverable, but it is a strict relaxation of the intended constraint stack. The packet should demonstrate at least one serious remediation attempt (alternative solver, rescaled variables, reduced grid) before accepting the fallback as the deliverable.

3. **Missing cross-check of the mass sum rule discretization.** The mass sum rule $\frac{1}{\pi}\int ds\,\mathrm{Im}\hat\Theta(s)/s = 2$ is split into a grid integral plus a fixed pQCD tail contribution. No numerical verification is shown that the tail integral converges and that the grid-vs-tail split is stable under variation of $s_0$ (the matching point). Given that $\mathrm{Im}\,\Theta$ decays slowly (the very reason no ASR exists), the tail contribution could be large and sensitive to the matching scale. A table or plot showing the tail fraction and its $s_0$-dependence is needed.

## Non-blocking

- The $D$-band plot starts at $Q^2=0.015625\,\text{GeV}^2$ rather than $Q^2=0$, which is correct given the $1/q^2$ pole in the exact relation, but the evidence note should explicitly state that $D^\pi(0)$ is not accessible from this envelope and note the limiting behavior.
- The `eta_floor_0p6` piecewise-constant envelope for $\eta(s)$ is mentioned but its actual values and breakpoints are not listed in the packet. Including them (or a pointer to the config key) would aid reproducibility.
- The phrase "no coupled-channel" appears twice in the scope statement; once suffices.
- The evidence note and manuscript bullet should explicitly flag that the $D$-band is an outer (uncorrelated) envelope, not a rigorous bootstrap bound. The packet text does this, but confirm the downstream documents do too.

## Real-research fit

The goal—bootstrapping a second pion GFF from dispersion + positivity—is well-motivated and fills a genuine gap. The algebraic relation among $(A,\Theta,D)$ is standard and the idea of deriving $D$ from independent bands on the other two is sound in principle. However, the current numerical output (band width $\sim130$ in $\hat\Theta$ units at2 GeV²) is far from competitive with even rough lattice or model estimates, so the research value at this stage is limited to methodology demonstration rather than phenomenological constraint.

## Robustness & safety

- The absence of an ASR for $\Theta$ is physically correct (the spectral function falls like $1/s$ times logs, not $1/s^2$), so not imposing one is the right call.
- The "independent outer bound" envelope for $D$ is conservative by construction; no overclaiming risk there, provided it is labeled as such everywhere (see non-blocking note).
- The failure-library entry for the PV run is a good practice. However, relying on the Im-only fallback without understanding why the full formulation fails introduces a risk that the claimed band is artificially loose due to missing constraints rather than reflecting a true physical bound.

## Specific patch suggestions

1. **Diagnose the PV failure before shipping.** Try at minimum: (a) halve the grid to `grid100` to check if the problem is condition-number-driven, (b) run with SCS (which handles `NUMERICAL_ERROR` differently from Clarabel), (c) rescale the $\mathrm{Re}\,F$ enforcement rows by $1/s$ to improve matrix conditioning. Report results in the failure-library entry. If any of these yield a feasible tighter band, promote it to mainline.

2. **Add $s_0$-stability check for the mass sum rule.** Vary $s_0$ by a factor of 2 in each direction and tabulate: (i) tail integral fraction, (ii) resulting $\hat\Theta$ band width at $Q^2=0.5$ and $2\,\text{GeV}^2$. Include as a table in the evidence note.

3. **Report band width at $Q^2=0$ for $\hat\Theta$.** Since the forward value is pinned at 2, the band should collapse there. Confirm numerically that $\hat\Theta_{\min}(0)\approx\hat\Theta_{\max}(0)\approx 2$ to within solver tolerance. This is a basic sanity check that is currently missing from the spot-check numbers.

4. **In `derive_d_band_from_a_theta_hat.py`, add an assertion** that $q^2 > q^2_{\min} > 0$ for every evaluation point, to guard against the $1/q^2$ singularity. The current config starts at $Q^2=0.015625$ which gives $q^2\approx0.8$, but a future config change could silently introduce a division-by-zero.

5. **Tighten the manuscript bullet language.** Replace any phrasing like "we obtain a $D^\pi$ band" with "we obtain a conservative outer envelope for $D^\pi$ from uncorrelated $(A,\hat\Theta)$ bands," to preempt misreading as a correlated bootstrap bound.
