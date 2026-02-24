VERDICT: READY

## Blockers

(none)

## Non-blocking

1. **Central pQCD target value not stated numerically.** The enforced window [0.0172, 0.0517] lets one back-calculate the central value (~0.0345), but the packet should state it explicitly alongside the formula so a reader doesn't have to reverse-engineer it. Add one line to the evidence note: "LO pQCD target at Q²=10 GeV²: A^π ≈ 0.0345, window = target × [0.5, 1.5]."

2. **Equation reference "Eq. Qem" in arXiv:2412.00848 is ambiguous.** This looks like an internal LaTeX label rather than a published equation number. Pin it to the actual equation number in the published/posted version (e.g., "Eq. (3.12)") so an external auditor can locate it.

3. **`low_energy_value_bands` is a misleading key name for a Q²=10 GeV² constraint.** 10 GeV² is not low energy. Consider renaming to `value_band_constraints` or adding a `high_energy_value_bands` key. This is config hygiene that will matter when more anchors are added.

4. **No ECOS cross-check at the anchor point Q²=10 GeV² itself.** The v117 ECOS run is single-Q² at 2 GeV². The anchor constraint is active in both solvers, so the Q²=2 cross-check indirectly validates it, but a direct cross-check of the anchor-point min/max would close the loop more convincingly. Consider adding a single ECOS run at Q²=10 GeV² in the next milestone.

5. **Explicit acceptance criteria section missing.** The goals are stated and the results clearly satisfy them, but enumerating the pass/fail criteria in a dedicated section (as was done in earlier milestones) would improve auditability of the convergence loop.

## Real-research fit

- Adding a pQCD anchor as a value band is a physically well-motivated step. It is the natural next constraint after UV/ASR budget binding, and it mirrors what practitioners do when matching dispersive representations to short-distance QCD. The choice of Q²=10 GeV² is reasonable — high enough for pQCD relevance, low enough to avoid extreme numerical ratios.
- The ±50% tolerance is conservatively wide and honestly labeled as a proxy. This is appropriate at this stage; a tighter, derived error budget (DA uncertainty, αs corrections, higher-twist) is correctly identified as a follow-up.
- The negative A_min values at all Q² points (e.g., −0.023 at Q²=2 GeV²) are worth noting. If the physics requires A^π ≥ 0 in the space-like region, this suggests the current constraint set doesn't enforce positivity of the form factor itself (as opposed to spectral positivity). This may be intentional, but it should be discussed in the evidence note — either as "expected given current constraints" or as a candidate for a future positivity anchor.
- The tightening is modest but monotonically increasing with Q² (5% at0.5 GeV², 8% at 1.0 GeV², 20% at 2.0 GeV²), which is the expected pattern for a UV anchor. This lends confidence that the constraint is acting through the dispersive integral as intended rather than through a numerical artifact.

## Robustness & safety

- Cross-solver agreement at ~2% of bandwidth is well within the stated5% criterion. No conditioning red flags at this level.
- The large ratio Q²/m_π² ≈ 513 at the anchor point could in principle cause numerical issues in the dispersion kernel, but the OPTIMAL solver status and the clean saturation of the anchor window suggest this is handled. Worth monitoring if the anchor is moved to higher Q².
- The anchor window saturation (both endpoints of [0.0172, 0.0517] are reached) is a good sign — it means the constraint is active, not slack. If future runs show the window is not saturated, that would indicate the anchor is redundant given other constraints.
- No new solver or tolerance parameters were introduced, so regression risk relative to W6-28 is minimal.

## Specific patch suggestions

1. **Evidence note** (`evidence/2026-02-20-w6-29-pqcd-anchor-a10gev-tighten-band-v1.md`): Add a line stating the numerical central value and the formula used:
   ```
   LO pQCD target: A^π(-Q²=10 GeV²) ≈ 0.0345
   Formula: [Eq. (XX) of arXiv:2412.00848], evaluated with f_π = 92.1 MeV, α_s(10 GeV²) = ...Tolerance: ±50% (proxy; see next-step item W6-30for derived error budget)
   ```

2. **Config file** (the v4cco config): Rename `constraints.low_energy_value_bands` → `constraints.value_band_constraints` (or add a parallel `high_energy_value_bands` key) to avoid semantic confusion. If renaming is too disruptive, add a comment field in the JSON:
   ```json
   "low_energy_value_bands_NOTE": "misnomer: includes high-Q2 pQCD anchor at Q2=10 GeV2; rename planned"
   ```

3. **Comparison table in evidence note**: Add a "% tightening" column to the before/after table so the reader doesn't have to compute it:
   ```
   | Q² (GeV²) | W6-28 width | W6-29 width | % tightening |
   |        0.5 |0.729002 |    0.692344 |         5.0% |
   |        1.0 |    0.568870 |    0.524983 |         7.7% |
   |        2.0 |    0.398867 |    0.317199 |        20.5% |
   ```

4. **Opportunity pool** (`bootstrap_opportunity_pool_v1.jsonl`): Confirm that the next-step item for deriving the pQCD error budget (replacing the ±50% proxy) is captured as a machine-readable opportunity with priority≥ the current milestone. If not present, add:
   ```json
   {"id": "opp-pqcd-error-budget", "priority": "high", "description": "Derive auditable pQCD/OPE error budget for Q2=10 GeV2 anchor (replace ±50% proxy)", "depends_on": "W6-29"}
   ```

5. **Draft manuscript** (`reports/draft.md`): In the limitations bullet for W6-29, explicitly note that A_min < 0 at all sampled Q² and state whether this is expected or whether form-factor positivity is a candidate future constraint.
