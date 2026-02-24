VERDICT: READY

## Blockers

None identified. The round-002 packet resolves the single blocker from round-001 (π-scaled tolerance semantics) with an explicit fix, and the negative result is properly recorded, gated, and queryable.

## Non-blocking

1. **Tail-subtraction sensitivity not yet quantified.** The slope sum rule involves $\int_{4m_\pi^2}^{\infty} ds\,\mathrm{Im}A(s)/s^2$, and the tail beyond $s_{\max}$ is subtracted analytically. The review packet does not include a one-knob scan varying the tail model (e.g., leading Regge vs. perturbative-QCD continuum exponent) to see how much of the infeasibility is driven by tail assumptions vs. the finite-grid spectral region. This is acknowledged in the "next-step posture" but should be the first diagnostic before any further constraint additions.
   - *Files:* `bochner_k0_socp_dispersion_bounds.jl` (tail subtraction logic); neg-result note `2026-02-18-chpt-slope-sum-rule-infeasible-v2.txt`.

2. **Feasibility cliff between tol=0.0061 and tol=0.01 is steep and unexplored.** Runs v45/v48 (INFEASIBLE at Δf₁ ≤ 0.0061) jump to v46 (OPTIMAL at Δf₁ = 0.01). Bisecting this interval (e.g., 0.007, 0.008, 0.009) would pin down the critical tolerance and sharpen the tension statement. Low cost, high diagnostic value.
   - *Files:* configs `v3ae`, `v3ai`, `v3af` and corresponding `results.json` for v45, v48, v46.

3. **ECOS solver only.** All runs use ECOS. A single cross-check with a different conic solver (e.g., Mosek, SCS, Clarabel) on the marginal-tolerance case (tol ≈ 0.008–0.01) would rule out solver-specific infeasibility artifacts. Not blocking because the INFEASIBLE→OPTIMAL transition across tolerance is smooth and physics-consistent, but it is good practice.

4. **Negative-result note could cite the TMD reference more precisely.** The note references arXiv:2507.05375 for the NLO ChPT slope + TMD estimate, but does not quote the specific equation number or numerical value of the central slope used. Adding `f_1^{TMD} = ...` with units and equation reference strengthens reproducibility.
   - *File:* `2026-02-18-chpt-slope-sum-rule-infeasible-v2.txt`.

5. **Dashboard rendering evidence is listed but content not included inline.** The bundle references `2026-02-18-w6-19b-render-dashboards-v1.txt` but I cannot verify the dashboard visually. Not blocking since gate logs confirm PASS.

## Real-research fit

The work is well-scoped for an exploratory pilot: testing whether a single additional low-energy condition (NLO ChPT slope at $t=0$) can materially tighten dispersive bounds on $A^\pi(-Q^2)$. The answer—**no, under the current constraint stack the slope is in tension**—is itself a useful result because:

- It localizes the tension to the interplay between the positive-definite spectral ansatz and the ChPT slope value, which is informative for anyone building a bootstrap/positivity program for pion GFFs.
- The tolerance sweep (strict → relaxed) cleanly distinguishes "wrong implementation" from "genuine physics tension," especially now that the π-factor bug is resolved.
- The structured negative-result discipline (failure library entry, dashboard update, limitation statement, gate evidence) meets the standard expected for an internal research note. It does **not** overclaim.

The limitation is correctly stated: the pilot uses a single-channel (pion-only) spectral function with a specific discretization and tail model; coupled-channel or subthreshold information could change the picture.

## Robustness & safety

**Normalization / π-factor (the round-001 blocker):**
The fix is sound in principle. The dispersion relation $f_1 = \frac{1}{\pi}\int \frac{\mathrm{Im}A(s)}{s^2}ds$ means the solver's linear constraint on $\sum_i c_i \,\mathrm{Im}A(s_i)$ must enforce a tolerance band of $\pi \cdot \Delta f_1$ on the integral side. The config files now carry both `slope_eq_f1_abs` and `slope_integral_absolute_tolerance` fields, making the mapping auditable. The audit summary in `2026-02-18-w6-19b-slope-sum-rule-audit-v1.txt` confirms the two are related by the expected factor of π.

**Discretization:**
200-point grids for both the spectral integral and enforcement are adequate for a pilot but could introduce ~1% quadrature error on the slope integral (which weights $1/s^2$ and is IR-sensitive). Since the feasibility cliff sits at ~60% relative tolerance on $f_1$, discretization error is unlikely to be the driver—but it is a load-bearing assumption that should be checked if the project proceeds to publication-grade claims.

**Solver numerics:**
ECOS is an interior-point solver with well-understood infeasibility certificates. The clean INFEASIBLE→OPTIMAL transition across tolerance values is consistent with a genuine geometric infeasibility rather than a numerical artifact.

**Safety of the negative claim:**
The note does not claim "the ChPT slope is wrong" or "the bootstrap fails." It correctly frames the result as tension between the current constraint stack and the TMD slope estimate, which could be resolved by relaxing any of several assumptions (tail model, η-related thresholds, ASR normalization, or the TMD value itself). This is appropriately cautious.

## Specific patch suggestions

1. **Bisect the feasibility cliff** (non-blocking but highest-value next step):
   ```
   # Add configs for Δf₁ ∈ {0.007, 0.008, 0.009}
   # in idea-runs/projects/.../compute/
   # Copy v3af config, change only sum_rules.f1_absolute_tolerance
   ```
   This pins down the critical tolerance to ~10% precision and gives a sharper tension statement.

2. **Add tail-model sensitivity scan** (recommended before any further constraint work):
   In `bochner_k0_socp_dispersion_bounds.jl`, parameterize the tail exponent (currently presumably fixed) and run the strict-tolerance case with ±1 on the Regge exponent. If infeasibility persists across all reasonable tail models, the tension is robust; if not, the tail is the driver and should be reported as such.

3. **Quote the central slope value explicitly in the neg-result note:**
   ```diff
   # In 2026-02-18-chpt-slope-sum-rule-infeasible-v2.txt
   + Central value used: f_1^{TMD} = [value] GeV^{-2} (arXiv:2507.05375, Eq. [N])
   + with absolute tolerance Δf_1 = 0.004 (≈3% band) for strict runs.
   ```

4. **Cross-solver check** (one run, low effort):
   ```julia
   # In config, swap solver:
   # "solver": "Clarabel"  # or "SCS" with appropriate tolerances
   ```
   Run the tol=0.01 (marginal OPTIMAL) case to confirm the feasibility boundary is solver-independent.

5. **Minor: config file naming** — The config filenames are very long and encode multiple attributes. Consider a mapping file (e.g., `run_index.tsv`) that maps run tags (v43–v48) to config paths and key parameters, for easier navigation. This is purely ergonomic.
