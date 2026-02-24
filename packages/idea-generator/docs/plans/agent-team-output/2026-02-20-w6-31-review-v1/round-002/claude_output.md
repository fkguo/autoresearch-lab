VERDICT: NOT_READY

## Blockers

1. **Theta-hat band is uninformatively wide.** At $Q^2=2\,\text{GeV}^2$ the band is $\hat\Theta\in[-65.97,\,66.41]$, which is symmetric about zero to within ~0.3%. For a quantity whose forward value is pinned at $\hat\Theta(0)=2$, a band spanning $\pm66$ at moderate $Q^2$ carries essentially no physics content. The derived $D$-band inherits this: $D\in[-0.530,\,0.439]$ is driven almost entirely by the $\hat\Theta$ width divided by $q^2$, not by any interplay with the $A$ band. Before declaring this a "second independent target," the authors need either (a) a quantitative argument that the Im-only cone is expected to be this loose and that tightening is blocked by a fundamental obstacle (not just a Clarabel numerics issue), or (b) additional constraints that narrow the band to a regime where it provides information beyond what the mass sum rule alone gives. As it stands, the deliverable does not meet the stated purpose of providing an independent GFF target that adds evidence.

2. **The PV-tightened run is the one that would actually constrain $\hat\Theta$, and it failed.** The packet treats the `NUMERICAL_ERROR` termination as a negative result to file away, but the entire scientific value of the Theta band hinges on whether the dispersion-relation real-part constraint can be imposed. A failure-library entry is not a substitute for resolving the numerics. At minimum, the authors should try: (a) reduced grid size, (b) an alternative solver (SCS, MOSEK), (c) preconditioning or rescaling the PV kernel rows. Until the PV-tightened formulation is either made to work or shown to be fundamentally infeasible (not just numerically unstable in one solver), the Im-only fallback should not be promoted as the mainline deliverable.

3. **Missing cross-check of the mass sum rule discretization error.** The mass sum rule $\frac{1}{\pi}\int ds\,\text{Im}\hat\Theta(s)/s = 2$ is split into a grid integral plus a fixed pQCD tail. No estimate of the discretization error from the grid quadrature (200 points) is reported. For the $A$ channel this was presumably validated in earlier rounds, but $\text{Im}\,\Theta(s)$ has different threshold behavior and a slower UV falloff (the very reason no ASR exists). The packet must show that the grid+tail split reproduces the sum rule to a stated numerical tolerance, and that the band edges are insensitive to doubling the grid.

## Non-blocking

- The envelope rule for $D$ is correct but should include an explicit caveat sentence in the evidence note and draft that the outer-bound nature means the $D$ band is strictly wider than what a joint $(A,\Theta)$ optimization would yield. This is mentioned in passing ("no correlation assumed") but could easily be missed by a reader.
- The $\eta(s)$ piecewise-constant envelope (`eta_floor_0p6`) is referenced but its functional form and the value0.6 are not justified in the packet. A one-line rationale (or pointer to where it was validated) would help.
- Plot filenames use underscores inconsistently (`Theta_hat_band` vs `D_band`). Minor, but worth standardizing.
- The evidence note filename includes `v1` but references both v1 (failed) and v1b (mainline) runs. Consider renaming to avoid ambiguity.

## Real-research fit

The goal—bounding a second GFF and deriving a $D$-term band—is well-motivated and would be a genuine contribution if the bands were informative. The pion-only, no-coupled-channel, laptop-feasible scope is appropriate for a pilot. However, the current numerical outcome (band width ~130 in $\hat\Theta$ units at2 GeV²) means the result is essentially a proof-of-concept for the code infrastructure, not yet a physics result. The packet should be honest about this status rather than listing it as a deliverable on equal footing with the $A$ band.

## Robustness & safety

- The absence of an ASR for $\Theta$ is physically correct (the spectral function falls like $1/s$ times logs, not $1/s^2$), so not imposing one is the right call.
- The exact algebraic identity for $D$ is standard (trace decomposition of the EMT matrix element). The formula as written is correct for the conventions $q^2 = Q^2/m_\pi^2$.
- The $q^2 > 0$ restriction in the $D$ formula avoids the $Q^2=0$ pole; the derived-band plot starting at $Q^2 = 0.015625\,\text{GeV}^2$ is consistent with this.
- No risk of data leakage or circular reasoning: the $A$ and $\hat\Theta$ bands come from independent optimization runs with independent spectral channels.

## Specific patch suggestions

1. **Blocker 1 resolution:** Add a "band-width budget" table showing, for each constraint class (mass sum rule, Im-cone, pQCD tail), how much each one contributes to narrowing the band from the unconstrained dispersion relation. If the Im-only cone contributes negligibly, state this explicitly and downgrade the $\hat\Theta$ band to "infrastructure validation" status in the evidence note.

2. **Blocker 2 resolution:** In `theta_trace_s0_socp_dispersion_bounds.jl`, add a solver-fallback loop:
   ```julia
   for solver in [Clarabel.Optimizer, SCS.Optimizer]
       # attempt PV-tightened formulation
       # break on OPTIMAL or ALMOST_OPTIMAL
   end
   ```
   Report results for at least one alternative solver before concluding the PV formulation is numerically blocked.

3. **Blocker 3 resolution:** In the Julia kernel, after constructing the grid quadrature weights $w_i$ and tail contribution $T$, add a validation block:
   ```julia
   sumrule_grid = sum(w .* imTh_grid ./ s_grid) / π
   sumrule_total = sumrule_grid + tail_contribution
   @assert abs(sumrule_total - 2.0) < 1e-6"Mass sum rule discretization error: $(sumrule_total)"
   ```
   Log `sumrule_grid` and `tail_contribution` separately in the run metadata JSON.

4. In `derive_d_band_from_a_theta_hat.py`, add a header comment to the output JSON:
   ```python
   meta["envelope_type"] = "independent_outer_bound"
   meta["caveat"] = "D band is wider than joint (A, Theta) optimization would yield"
   ```

5. In the evidence note, replace "conservative band for $D^\pi$" with "conservative outer-envelope band for $D^\pi$ (no A–Θ correlation exploited)" to prevent overclaiming at first read.
