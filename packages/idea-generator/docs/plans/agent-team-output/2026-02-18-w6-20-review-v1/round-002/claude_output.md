VERDICT: NOT_READY

## Blockers

1. **Tail-subtraction convention not independently verifiable from packet alone.**
   The packet claims the $f_1$ objective uses "the same tail-subtraction conventions as the slope constraint (when enabled)," but no code snippet or formula is shown for how the UV tail constant is added to the grid integral. The key identity is
   $$f_1 = \underbrace{\frac{1}{\pi}\sum_i w_i \frac{\mathrm{Im}\,A(s_i)}{s_i^2}}_{\text{grid}} + \underbrace{\frac{1}{\pi}\int_{s_{\max}}^{\infty} ds\,\frac{\mathrm{Im}\,A(s)}{s^2}}_{\text{UV tail}}$$
   and the tail piece must be treated as a **known constant** (from the assumed asymptotic form) added outside the SOCP objective. Without seeing the relevant lines in `bochner_k0_socp_dispersion_bounds.jl` (tools disabled, so I cannot open it), I cannot confirm whether the tail constant is (a) computed with the correct power of $s$, (b) uses the same `scale_factor` and cutoff $s_{\max}$ as the slope constraint pathway, and (c) is added with the correct sign. A single $1/s$ vs $1/s^2$ slip in the tail integral would shift $f_1^{\min}$ by an $O(1)$ amount and could entirely explain the gap.

   **Next action:** Provide the exact code block (or a self-contained formula with numerical values) that constructs the SOCP objective vector for the $f_1$ diagnostic mode, including the tail constant. A minimal unit test comparing the grid+tail sum against a known analytic spectral function (e.g., single Breit-Wigner at $m_{f_2}$) would close this blocker.

2. **No cross-check of $f_1^{\min}$ against a simple analytic bound.**
   The implied minimum $f_1^{\min}\approx 0.0215$ is the load-bearing number: if it were instead $\lesssim 0.012$ the entire negative-result conclusion would flip. Yet no independent sanity check is provided. For instance, one could evaluate $f_1$ on the **extremal spectral function** returned by the min-$f_1$ solve (ECOS returns a primal solution) and verify it reproduces the reported objective. The packet mentions "dual recomputation checks" but does not show the numerical values or the primal–dual gap.

   **Next action:** Report the primal $f_1$ (from reconstructed spectral function), the dual $f_1$, and the absolute gap for both v49-min and v50-min. If the gap exceeds $10^{-4}$ (relative to the target $\sim 0.012$), the conclusion is not yet robust.

3. **Normalization / $\pi$-factor discipline after W6-19b bug.**
   W6-19b already found and fixed a $\pi$-factor bug in the slope constraint pathway. The packet does not state whether the $f_1$ diagnostic pathway was written *after* that fix or whether it was refactored from pre-fix code. Given the history, an explicit confirmation (ideally a unit test) that the factor of $1/\pi$ in the definition
   $$f_1 = \frac{1}{\pi}\int_4^\infty ds\,\frac{\mathrm{Im}\,A(s)}{s^2}$$
   is consistently applied in both the grid weights and the tail constant is required before the negative result can be trusted.

   **Next action:** Add a deterministic regression test in the Julia test suite that computes $f_1$ for a delta-function spectral density $\mathrm{Im}\,A(s)=c\,\delta(s-m^2)$ and checks the analytic answer $f_1 = c/(\pi m^4)$. Reference the test file path in the evidence bundle.

## Non-blocking

- **Solver robustness (ECOS only).** Both runs use ECOS. A single confirmatory run with a different solver (e.g., Mosek or SCS with high precision) for at least the min-$f_1$ problem would strengthen confidence but is not strictly blocking given that the feasibility question is a binary pass/fail.

- **Grid resolution sensitivity.** Grid200 is used throughout. A brief note (even qualitative) on whether grid400 shifts $f_1^{\min}$ by more than a few percent would be reassuring but is not blocking for the current diagnostic conclusion.

- **Dashboard / failure-library cosmetics.** The failure library label `tension:low_energy_slope_target_outside_implied_range` is informative but long; consider a shorter canonical key for programmatic queries. Non-blocking.

- **Report draft (NOT_FOR_CITATION).** The W6-20 limitation bullet in `reports/draft.md` should quote the numerical $f_1^{\min}$ values and the TMD target side-by-side for quick reading. Currently the packet describes this but does not confirm the draft contains the numbers.

## Real-research fit

The diagnostic strategy is sound and well-motivated: after finding infeasibility (W6-19b), computing the implied feasible range for the problematic observable is exactly the right next step. The finding—that the TMD target sits below the feasible floor by roughly a factor of 2—is a clean, informative negative result that sharpens the research question (what drives the floor?).

However, the physics interpretation hinges entirely on the correctness of $f_1^{\min}\approx 0.0215$. If this number is wrong by a factor of $\sim 2$ (easily possible from a stray $\pi$, wrong $s$-power in the tail, or sign error in the tail constant), the conclusion reverses. The W6-19b $\pi$-factor precedent makes this concern concrete, not hypothetical.

The proposed next phase (one-knob relaxations to localize the driver of the lower bound) is the right experimental design. The sharpest single knob to try first is **turning off the asymptotic sum rule (ASR)** constraint, because: (i) the ASR directly constrains the high-$s$ tail of $\mathrm{Im}\,A$, which feeds into $f_1$ with a $1/s^2$ weight that is most sensitive to the transition region near $s_{\max}$; (ii) it is a single on/off switch with no continuous parameter to sweep; and (iii) if $f_1^{\min}$ drops substantially when ASR is removed, it immediately identifies the ASR as the dominant driver and motivates a careful check of whether the ASR value used is consistent with the TMD analysis.

## Robustness & safety

- **Load-bearing assumption: UV tail model.** The spectral function above $s_{\max}$ is modeled (presumably power-law or Regge-motivated). The $1/s^2$ kernel in $f_1$ provides good UV convergence, but the tail constant still contributes a finite shift. Its numerical value and sensitivity to `scale_factor` should be reported.

- **Load-bearing assumption: moment targets.** The moment constraints encode the known GFF normalization and low-$Q^2$ derivatives. Any mismatch between the moment definitions used here and the conventions in arXiv:2507.05375 would propagate into $f_1^{\min}$. The packet does not discuss this cross-check.

- **Negative-result reproducibility.** The packet lists reproduction commands in the draft report but does not include them in the review bundle itself. For a negative result that will guide future work, the exact `julia` command line (with config path and random seed if any) should appear in the evidence directory.

## Specific patch suggestions

1. **`bochner_k0_socp_dispersion_bounds.jl`** — In the `implied_f1_range` diagnostic block, add an assertion or logged check:
   ```julia
   # After computing f1_grid and f1_tail:
   @assert abs(f1_tail) < 0.5 * abs(f1_grid) "UV tail dominates f1; check s-power and scale_factor"
   ```
   This guards against silent tail-computation errors.

2. **`bochner_k0_socp_dispersion_bounds.jl`** — Log the primal–dual gap explicitly in `results.json`:
   ```julia
   results["diagnostics_f1_range"]["primal_dual_gap_min"] = abs(f1_min_primal - f1_min_dual)
   results["diagnostics_f1_range"]["primal_dual_gap_max"] = abs(f1_max_primal - f1_max_dual)
   ```

3. **New test file (e.g., `test/test_f1_diagnostic.jl`)** — Add a unit test with a delta-function spectral density to validate the $1/\pi$ normalization and $s^{-2}$ weighting end-to-end.

4. **Evidence note** (`2026-02-18-implied-f1-range-qstar-baseline-vs-moml2-v1.txt`) — Add a "Tail contribution" subsection reporting `f1_tail` numerically for both min and max solves, and state the tail model used (power-law exponent, cutoff $s_{\max}$, scale_factor).

5. **Config files** (`*_implied_f1_range.json`) — Add a comment or metadata field recording the git hash of the solver script used, so that the $\pi$-factor fix provenance is traceable.
