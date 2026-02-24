VERDICT: NOT_READY

## Blockers

### B1. ASR tolerance of O(100) is unexplained and potentially signals a normalization or tail-model error

The soft-ASR band requires `tol_ASR ≈ 62` (in "$f$-style" units where physical sum-rule values are O(10⁻²)) before the problem even becomes feasible with the slope input. That is a tolerance roughly **5000×** the physical quantity it is supposed to constrain. No analytic estimate (OPE, leading-twist, or even a generous power-correction envelope) is provided to justify why such a large band is needed.

Two concrete failure modes are not ruled out:

1. **Tail subtraction double-counting or sign error.** The packet states "the enforced band applies to the full integral (grid + fixed tail)" but does not show the lines in `bochner_k0_socp_dispersion_bounds.jl` that construct the linear inequality, so there is no way to verify that the tail contribution is added to the LHS (spectral side) rather than subtracted from the RHS, or vice-versa. A single sign flip in the tail term would shift the effective target by twice the tail magnitude, easily producing an O(100) offset.

2. **Normalization mismatch.** The sum-rule target is written as $(1/\pi)\int ds\,\mathrm{Im}\,A(s)$. If the discretized spectral weights already absorb a factor of $1/\pi$ (as is common in dispersive bootstrap codes) while the ASR target does not, the constraint is off by $\pi$. This alone does not explain the full factor of ~5000, but it could compound with the tail issue.

**Next action:** Expose (in the review packet or an appendix) the exact code block that builds the ASR-band rows of the constraint matrix, including the tail term, the $1/\pi$ prefactor, and the RHS assembly. Provide an independent pencil-and-paper cross-check: evaluate the ASR integral analytically for a known test spectral function (e.g., single Breit–Wigner) on the same grid+tail, and compare the numerically returned `asr_eq_over_pi` against the analytic answer.

*Files:* `idea-runs/projects/pion-gff-bootstrap-positivity-pilot-2026-02-15/compute/julia/bochner_k0_socp_dispersion_bounds.jl` (ASR-band constraint construction — not shown).

---

### B2. Cross-solver spread is comparable to the tightening itself

ECOS gives $A^\pi(-Q^*) \in [0.8318,\,0.8479]$ (width 0.0161), while Clarabel gives $[0.8307,\,0.8518]$ (width 0.0211). The Clarabel interval is **31% wider**; the upper bounds differ by 0.0039 and the lower bounds by 0.0011. The packet describes this as "few $10^{-3}$" agreement, but the entire *tightening claim* rests on the width of this interval being meaningfully smaller than the no-slope baseline. Without stating the no-slope baseline width for comparison, the reader cannot judge whether the tightening survives the solver spread.

**Next action:** (a) Report the baseline (no-slope, same `tol_ASR=62`) interval for both solvers. (b) Report solver-internal convergence metrics (primal-dual gap, primal infeasibility residual) for all four solves (v66 min/max, v67 min/max). (c) If the Clarabel upper-bound solve has a primal-dual gap > 10⁻⁶, tighten solver tolerances and re-run before claiming cross-solver validation.

*Files:* `runs/2026-02-18-a-bochner-k0-socp-v66-.../results.json`, `runs/2026-02-18-a-bochner-k0-socp-v67-.../results.json`.

---

### B3. No unit / integration test covering the new ASR-band code path

The validation gates listed (`make validate`, `validate-project`) are generic infrastructure checks. No test is cited that exercises the ASR-band constraint in isolation (e.g., a small synthetic problem where the optimal value is known analytically with and without the band). This is a regression-safety issue: a future refactor of the tail model or normalization could silently break the ASR band without any test catching it.

**Next action:** Add at least one unit/regression test (Julia `@testset` or equivalent) that constructs a minimal SOCP with the ASR-band constraint for a known spectral function and checks: (i) feasibility flips at the expected tolerance, (ii) the `asr_eq_over_pi` audit value matches the analytic integral to within discretization error.

*Files:* `idea-runs/projects/pion-gff-bootstrap-positivity-pilot-2026-02-15/compute/julia/` (no test file for ASR band found).

---

## Non-blocking

### N1. Implied-$f_1$ threshold scan resolution

The scan jumps from `tol_ASR = 60` (infeasible for TMD slope) to `tol_ASR = 62` (feasible). A finer scan (e.g., steps of 0.5) would locate the threshold more precisely and provide a sharper diagnostic. Not blocking, but would strengthen Claim 2 substantially.

### N2. Config naming convention is becoming unwieldy

Config names like `a_bochner_k0_socp_config_v4bo_dispersion_grid200_enf200_qstar_audit7_ecos_asrband_implied_f1_asrtol62p0.json` are approaching the point where typos silently select the wrong config. Consider a structured config registry or at minimum a manifest mapping short tags to full filenames.

### N3. The draft report (draft.md) should flag the interpretability risk more prominently

Claim 4 acknowledges the issue, but the report's "Limitations/known gaps" bullet buries it. A reader could mistake the tightened interval as a robust physics result rather than a proof-of-concept awaiting UV anchoring.

### N4. Constraint activity on the upper-bound solve

The reviewer note says "ASR residual saturates the allowed ASR band (constraint active)" on the upper-end solve. This is expected for a one-sided tightening, but it means the upper bound is *entirely determined* by the tolerance choice. This should be stated explicitly in the report so that the tolerance is not later treated as an innocent numerical parameter.

## Real-research fit

The overall direction — replacing a hard on/off ASR switch with a soft band and scanning for compatibility with low-energy slope data — is methodologically sound and addresses a real gap identified in W6-21. The idea of using implied-$f_1$ as a feasibility diagnostic is creative and useful. However, the packet is not yet at the stage where the numbers can be trusted for a physics conclusion:

- The O(100) tolerance is not anchored to any UV estimate, making the tightened bounds effectively "what-if" results.
- Cross-solver agreement is marginal relative to the claimed tightening.

Once blockers B1–B3 are resolved, this would be a solid incremental step toward a publishable dispersive-bootstrap bound on $A^\pi(-Q^2)$.

## Robustness & safety

- **Discretization sensitivity:** Not tested in this round. Grid size is fixed at 200. At minimum, a 400-point run should be compared to check that the implied-$f_1$ threshold and the tightened bounds are stable.
- **Tail model dependence:** The tail is "fixed" (presumably a power-law or OPE-motivated form). Varying the tail within a reasonable envelope would test whether the large `tol_ASR` is an artifact of the tail model. This is related to B1 but is a broader robustness concern.
- **Numerical safety:** ECOS is known to be less robust than interior-point solvers for problems with near-degenerate constraints. The fact that v58 returns `INFEASIBLE` at `tol_ASR = 2.0` is expected, but the transition to feasibility at `tol_ASR ~ 60` should be checked for solver-specific artifacts (e.g., re-run v58 with Clarabel to confirm infeasibility is not ECOS-specific).

## Specific patch suggestions

1. **`bochner_k0_socp_dispersion_bounds.jl`** — In the ASR-band constraint block, add an inline comment or docstring that spells out:
   ```
   # ASR band:  |sum(w_i * Im_A_i) / π  +  tail_contribution / π  -  asr_target| ≤ tol_ASR
   #   where w_i are quadrature weights, Im_A_i are spectral variables,
   #   tail_contribution = <formula>, and all quantities are in f-style units.
   ```
   This makes the $\pi$ convention and tail handling auditable without reading surrounding code.

2. **`results.json` (v66, v67)** — Add fields `solver_primal_dual_gap`, `solver_primal_infeasibility`, `solver_dual_infeasibility` to the output schema so that cross-solver comparisons can be assessed quantitatively.

3. **New file: `compute/julia/test_asr_band.jl`** — Minimal regression test as described in B3. Skeleton:
   ```julia
   using Test
   @testset "ASR band: single-resonance analytic check" begin
       # Set up a single Breit-Wigner spectral function
       # Compute analytic ASR integral
       # Run SOCP with tol_ASR = analytic ± small δ → expect feasible
       # Run SOCP with tol_ASR = analytic ± small δ but offset target → expect infeasible
   end
   ```

4. **`draft.md`** — Under the W6-22 bullet, add a sentence: "The upper bound on $A^\pi(-Q^*)$ is controlled by the ASR tolerance, which is not yet anchored to a physical UV estimate; these numbers should not be quoted as physics bounds."
