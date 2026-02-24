VERDICT: READY

## Blockers

- None. The Round-001Opus blockers (sum-rule auditability, band-width diagnostic, D-envelope sign analysis, intersection-grid handling) are all addressed. The "proof-of-concept only" framing is honest and prevents overclaiming. The packet is publishable as an internal milestone.

## Non-blocking

- The band-width diagnostic table makes the un-informativeness crystal clear (e.g. $\hat\Theta \in [-75, +77]$ at $Q^2=0.5\,\text{GeV}^2$), which is good scientific honesty, but the packet would benefit from a one-sentence comparison to any lattice or model expectation for $\hat\Theta$ or $D$ to quantify *how* uninformative the bands are (e.g. "lattice values of $D^\pi(0)$ cluster near $-1$; our band at $Q^2=0.05\,\text{GeV}^2$ spans $[-7.8, +7.6]$, roughly $15\times$ wider").
- The sum-rule audit numbers are excellent (total deviates from 2 by $\lesssim 5\times10^{-13}$), but the tail contribution $-1.0355$ is large relative to the grid target $3.0355$. A brief note on sensitivity to the pQCD tail model (e.g. varying $s_0$ by $\pm 10\%$) would strengthen confidence that the wide band is dominated by the Im-only cone weakness, not tail-model uncertainty.
- The PV-tightening recovery plan step (2) (variable rescaling $z_i$) is the most promising item. Consider prioritizing it over step (1) since the $A$-channel already demonstrated it works; the enforcement-density sweep is useful but secondary.
- The `eta_floor_0p6` piecewise-constant envelope for $\eta(s)$ is mentioned but its actual values/breakpoints are not listed in the packet. For reproducibility, include the explicit piecewise definition or a pointer to where it lives in the config.
- Minor: the table header says "$Q^2$ [GeV$^2$]" but the first entry is $0.046875 = 3/64$; stating the grid rule "$Q^2 = k/64$" in the table caption would help readers parse the non-round values.

## Real-research fit

The packet is well-positioned as a methodological contribution: it demonstrates that the $(A, \Theta, D)$ algebraic relation can be exploited inside a rigorous positivity-bootstrap pipeline, even when one of the input bands is currently weak. The honest "proof-of-concept" framing is appropriate. The failure-library entry for the PV+modulus run is a genuine research artifact — recording what doesn't work is valuable. The constraint stack is pion-only and laptop-feasible as required. The derived $D$ envelope, while wide, is mathematically rigorous (outer bound, no correlation assumption), which is the correct conservative choice at this stage.

## Robustness & safety

- The sum-rule enforcement is numerically exact to $\sim 10^{-13}$, which is well within solver tolerance. No concern.
- The D-envelope sign analysis is correct: for $q^2 > 0$, the coefficient $2/(3q^2) > 0$ on $\hat\Theta$ and $-(4+q^2)/(3q^2) < 0$ on $A$, so the stated min/max pairing is right.
- The intersection-grid logic (skipping $q^2$ points missing in the $A$ scan) is the safe choice — it avoids extrapolation. The `skipped_q2_missing_in_a` field provides auditability.
- No overclaiming detected. The packet explicitly states the band is not physically competitive and labels the deliverable as a pipeline proof-of-concept.
- The Clarabel `NUMERICAL_ERROR` for the PV+modulus run is correctly quarantined in the failure library and not used for any claimed result.

## Specific patch suggestions

- In the band-width diagnostic table, add a column or footnote with a reference value (e.g. from a chiral quark model or lattice) so the reader can immediately gauge the factor by which the band must shrink to become informative. This is a one-line addition.
- In the D-envelope derivation script, add an assertion that $q^2 > 0$ for every grid point processed (guard against the $q^2 = 0$ pole). If $Q^2 = 0$ is ever in the scan grid, the formula diverges; an explicit skip-and-log for $q^2 = 0$ would be safer than relying on it never appearing.
- In the config or packet text, spell out the `eta_floor_0p6` definition explicitly: e.g. "$\eta(s) = 0.6$ for $s < s_1$, $\eta(s) = \ldots$" so a reader can reproduce without opening the config JSON.
- Swap steps (1) and (2) in the PV-recovery plan, or at least flag step (2) as highest priority, since the variable-rescaling approach has a proven track record from the $A$-channel work.
