VERDICT: READY

## Blockers

- None.

## Non-blocking

- The $\hat\Theta$ band at $Q^2=2\,\text{GeV}^2$ spans $[-61.74, 61.99]$, which is essentially symmetric about zero and ~124 units wide. The derived $D$ band $[-0.503, 0.411]$ is therefore almost entirely determined by the $A$ band and the $(4+q^2)/3q^2$ prefactor, with $\hat\Theta$ contributing negligible effective constraint. The packet acknowledges this ("do not treat as competitive physics constraint yet"), but it would strengthen the narrative to include a one-line quantitative decomposition showing what fraction of the $D$ band width comes from $\hat\Theta$ vs $A$ at the audit point. This makes the "unblocking only" claim self-evidently verifiable from the numbers alone.

- The jump from `n_enforce=200` (NUMERICAL_ERROR) to `n_enforce=30` is large. A brief note on whether any intermediate value (e.g., 50, 100) was tested—or a statement that this was not explored and is left for future work—would help readers understand whether30 is a floor or simply the first value tried. Not a blocker because the packet is explicitly framed as an unblocking increment, but it affects planning for the next round.

- The envelope rule for $D$ ($D_{\min}$ uses $\hat\Theta_{\min}$, $A_{\max}$; $D_{\max}$ uses $\hat\Theta_{\max}$, $A_{\min}$) is correct given the exact identity and $q^2>0$, since the coefficient of $\hat\Theta$ is $+2/(3q^2)>0$ and the coefficient of $A$ is $-(4+q^2)/(3q^2)<0$. However, the packet should note explicitly that this envelope is conservative (outer) and not necessarily tight, because $A_{\min}$ and $\hat\Theta_{\max}$ are not in general achieved by the same spectral function. The word "conservative" appears but the reason deserves one sentence.

- The evidence note path is listed but its contents are not included in the packet. For a full audit trail, the repro commands (or at least a summary of what they contain) should be visible to reviewers in the packet itself, not only by file reference.

## Real-research fit

The increment is well-scoped and honest. It solves exactly one problem (Clarabel feasibility failure in the trace channel with PV+modulus enforcement) by reducing enforcement density, propagates the result into the derived $D$ band, and explicitly warns against over-interpretation. This is a clean numerics-infrastructure step in a closed-loop evidence chain. The "pion-only, laptop-feasible, no coupled-channel" scope fence is maintained. The framing as "unblocking" rather than "tightening" is accurate given the numbers.

## Robustness & safety

- The constraint stack is internally consistent: the mass sum rule, absence of ASR for $\Theta$, UV tail model, GTB Im-only cone, and PV modulus cone are all carried forward from W6-31 with only the enforcement density changed. No new physics assumptions are introduced.
- The $A$ band (v118) is unchanged and sourced from a separate, previously reviewed run. Cross-contamination risk is low.
- The $Q^2\to0$ regime for $D$ is handled by starting the $D$ plot at $Q^2=0.015625\,\text{GeV}^2$, avoiding the $1/q^2$ pole. This is appropriate.
- No overclaiming detected. The packet does not compare to lattice or phenomenological extractions, and the "not competitive yet" caveat is prominent.

## Specific patch suggestions

- Add one sentence after the envelope rule stating: "This envelope is conservative (not necessarily saturated) because the extrema of $A$ and $\hat\Theta$ are not in general realized by the same spectral configuration."
- Add a parenthetical or footnote near the `n_enforce=30` choice: "(intermediate values such as 50 or 100 were not systematically scanned in this increment; this is deferred to future work)" — or, if they were tested, state the outcome.
- At the audit-point table, add a line showing the $D$ band width attributable to $\hat\Theta$ alone (holding $A$ at midpoint) vs $A$ alone (holding $\hat\Theta$ at midpoint), to make the "unblocking only" claim quantitatively self-evident.
- Include the key repro command(s) from the evidence note inline in the packet (even abbreviated), so the audit chain does not require file access to verify.
