VERDICT: NOT_READY

## Blockers

### B1. The ASR tolerance is unphysically large and unanchored — yet the tightening claim rests on it

The soft-ASR band width $\mathrm{tol}_{\mathrm{ASR}} = 62$ (in $f$-style units) is order-$10^2$, while the physical sum-rule values $f_0, f_1$ are order $10^{-2}$. This means the "UV constraint" is roughly four orders of magnitude looser than the low-energy constraints it is supposed to complement. The packet acknowledges this as an "interpretability risk" (Claim 4), but then simultaneously advertises "tightening is real and auditable" (Claim 3). These two statements are in tension: **a constraint whose tolerance is $\sim 10^4 \times$ larger than the quantities it controls can only tighten bounds if the problem geometry happens to make the ASR direction nearly orthogonal to the objective — and that geometric accident has not been demonstrated or even discussed.**

**Next action:** Before claiming "tightening is real," provide a sensitivity/stability plot: $A^{\pi}_{\max/\min}(-Q^*)$ vs. $\mathrm{tol}_{\mathrm{ASR}}$ over a range (e.g., 30–200), not just three snapshots. Show where the constraint transitions from active to slack, and discuss what physical UV information would map to a given tolerance value. Without this, the headline result is a numerical curiosity, not evidence.

*Files:* `bochner_k0_socp_dispersion_bounds.jl` (ASR band implementation), results from v58/v64/v65/v66/v67.

### B2. Cross-solver agreement is not tight enough to support the claimed interval width

ECOS gives $A^{\pi}(-Q^*) \in [0.8318, 0.8479]$ (width $\approx 0.016$) while Clarabel gives $[0.8307, 0.8518]$ (width $\approx 0.021$). The discrepancy is $\sim 0.001$ on the lower bound and $\sim 0.004$ on the upper bound. The packet calls this "few $10^{-3}$ level" agreement, but:

- The upper-bound discrepancy ($0.8479$ vs. $0.8518$, $\Delta \approx 0.004$) is **25% of the ECOS interval width**. This is not negligible.
- The packet notes the ASR residual saturates the band on the upper-end solve, which is exactly where solver sensitivity is expected to be worst. This needs investigation, not just acknowledgment.

**Next action:** (a) Report the actual primal/dual residuals and solver status for v66 and v67 (both min and max solves). (b) If the upper bound is numerically fragile, flag it explicitly — don't present $[0.83, 0.85]$ as a robust interval. (c) Consider running SCS as a third solver or increasing ECOS/Clarabel tolerances.

*Files:* `runs/2026-02-18-a-bochner-k0-socp-v66-.../results.json`, `runs/2026-02-18-a-bochner-k0-socp-v67-.../results.json`.

### B3. Tail subtraction consistency is asserted but not audited against a reference

Claim 1 states "Tail subtraction is handled consistently: the enforced band applies to the full integral (grid + fixed tail), and audit residuals reflect the shifted RHS." However, the packet provides no explicit numerical evidence that the tail contribution to the ASR integral is being subtracted/added correctly. Given that the tail model is the dominant source of UV uncertainty and the ASR tolerance is enormous, a sign error or factor-of-$\pi$ error in the tail piece could easily hide inside $\mathrm{tol}_{\mathrm{ASR}} = 62$.

**Next action:** Add a dedicated audit row to `results.json` that separately reports: (i) the grid contribution $\frac{1}{\pi}\int_{\mathrm{grid}} ds\,\mathrm{Im}A(s)$, (ii) the fixed-tail contribution, and (iii) their sum vs. the ASR target. Show these numbers for at least one feasible run (e.g., v65 or v66). Verify the $\pi$ convention by comparing the tail piece against an independent hand calculation (even a one-line Mathematica check).

*Files:* `bochner_k0_socp_dispersion_bounds.jl` (tail handling + ASR constraint construction).

### B4. Implied-$f_1$ feasibility predictor validated at only two points

The implied-$f_1$ threshold scan uses only $\mathrm{tol}_{\mathrm{ASR}} \in \{60, 62\}$ to bracket the critical tolerance. This is too coarse to call it a "scan" or to validate it as a "feasibility diagnostic" (Claim 2). The transition from $f_1^{\min} \approx 0.01204$ (excludes TMD) to $0.01181$ (admits TMD) occurs over $\Delta\mathrm{tol} = 2$, yet no intermediate points are shown, and no error bars on $f_1^{\min}$ from solver tolerances are reported.

**Next action:** Run at least 5 points in the range $\mathrm{tol}_{\mathrm{ASR}} \in [55, 70]$ and plot $f_1^{\min}$ vs. $\mathrm{tol}_{\mathrm{ASR}}$. Report solver residuals at each point. Confirm monotonicity (it must be monotone by construction — if it isn't, there is a bug).

*Files:* configs `v4bn`, `v4bo`; results v64, v65.

---

## Non-blocking

### N1. Config naming convention is becoming unwieldy

Config file names like `a_bochner_k0_socp_config_v4bq_dispersion_grid200_enf200_qstar_audit7_clarabel_asrband_slope_tmd_asrtol62p0.json` are human-unreadable. Consider a structured metadata header inside the JSON and shorter filenames with a lookup table.

### N2. Draft report bullets should note the negative result (v58 infeasibility) more prominently

The infeasibility at $\mathrm{tol}_{\mathrm{ASR}} = 2.0$ with slope input is a useful physics datapoint (the original exact ASR is too restrictive). In `reports/draft.md`, this is buried. Consider making it the lead observation, since the entire W6-22 motivation flows from it.

### N3. The slope input $f_1 = 0.01198 \pm 0.001$ from arXiv:2507.05375 — clarify whether $\pm 0.001$ is $1\sigma$ or hard bounds

The distinction matters for how the conic constraints are set up: if it's a $1\sigma$ band being imposed as hard walls, the effective coverage is different from what a reader might expect.

### N4. Missing units discussion for $\mathrm{tol}_{\mathrm{ASR}}$

Even if the normalization is internally consistent, the packet should state explicitly what units/dimensions $\mathrm{tol}_{\mathrm{ASR}} = 62$ carries (e.g., GeV$^n$, dimensionless, etc.) so future readers don't have to reverse-engineer it from the code.

---

## Real-research fit

The physics question — how strongly does asymptotic (UV) information constrain the spacelike pion gravitational form factor — is well-motivated and timely. The bootstrap/positivity approach is sound in principle. However, the current round is essentially a **numerical feasibility study for the ASR band implementation**, not yet a physics result. The large tolerance and thin cross-solver margin mean the "tightening" headline should not yet appear in any paper draft. The methodology (SOCP + dispersion relation + sum-rule constraints) is standard and appropriate.

---

## Robustness & safety

- **Normalization / $\pi$-convention risk:** HIGH. The packet asserts consistency but provides no decomposed numerical audit (see B3). A factor-of-$\pi$ error in the tail contribution would be invisible at $\mathrm{tol}_{\mathrm{ASR}} = 62$ and would corrupt all downstream results once the tolerance is tightened.
- **Discretization:** Grid of 200 points with 200 enforcement points — adequate for the current tolerance regime, but will need revisiting when $\mathrm{tol}_{\mathrm{ASR}}$ is reduced toward physical values.
- **Solver sensitivity:** The ASR constraint is active at the boundary for the upper bound (v66/v67), which is exactly the regime where SOCP solvers are least reliable. The 25%-of-width cross-solver discrepancy on the upper bound is a yellow flag.
- **Load-bearing assumptions:** The tail model (presumably a power-law or OPE-motivated form beyond the grid cutoff) is load-bearing for the ASR integral but is not varied or uncertainty-quantified in this round.

---

## Specific patch suggestions

1. **`bochner_k0_socp_dispersion_bounds.jl`**: Add a post-solve audit block that prints (to `results.json`) the decomposition: `asr_grid_piece`, `asr_tail_piece`, `asr_total`, `asr_target`, `asr_residual`, `asr_band_width`. This is ~10 lines of code and directly resolves B3.

2. **`bochner_k0_socp_dispersion_bounds.jl`**: In the ASR band constraint construction, add an assertion or log line confirming the $\pi$ convention: e.g., `@assert abs(tail_contribution_over_pi - expected_value) < 1e-8 "Tail/pi convention mismatch"` using a known analytic test case.

3. **New script or config sweep** (resolves B1 + B4): Create a parameter-sweep driver that loops over `asr_absolute_tolerance ∈ [40, 45, 50, 55, 58, 60, 61, 62, 65, 70, 80, 100]` and collects `{tol, f1_min, A_min, A_max, solver_status, primal_residual}`. Output to a single CSV. This replaces ad-hoc config proliferation and produces the sensitivity plot needed for B1.

4. **`results.json` (v66, v67)**: Include `solver_primal_residual`, `solver_dual_residual`, `solver_termination_status` fields if not already present. These are needed for B2.

5. **`reports/draft.md`**: Add a sentence: *"The required ASR band tolerance ($\sim 62$ in $f$-style units) is not yet anchored to a physical UV/OPE estimate; the tightening reported here should be regarded as a methodological demonstration, not a physics constraint, until $\mathrm{tol}_{\mathrm{ASR}}$ is calibrated against perturbative QCD or lattice data."*
