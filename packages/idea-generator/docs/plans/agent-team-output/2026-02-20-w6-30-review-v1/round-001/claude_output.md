VERDICT: NOT_READY

## Blockers

1. **Suspiciously circular tolerance — NLO=0 reproduces the ad hoc number.**
   The derived budget yields relative tolerance ≈ 0.500922, nearly identical to the W6-29 ad hoc ±50%. With the NLO proxy coefficient explicitly set to 0 (`idea-runs/projects/pion-gff-bootstrap-positivity-pilot-2026-02-15/artifacts/assumptions/uv_anchor_budget_v1.json`), the remaining three components (scale-variation, DA/matching, higher-twist) are doing all the work — and apparently sum to the same number as before. The evidence note (`idea-runs/projects/pion-gff-bootstrap-positivity-pilot-2026-02-15/evidence/2026-02-20-w6-30-uv-anchor-budget-derived-binding-v1.md`) must include an explicit statement on whether the component magnitudes were fitted to reproduce ±50% or independently estimated. If they were independently estimated and the agreement is coincidental, show the intermediate arithmetic. If they were calibrated against the old knob, say so — that makes the budget a *reparametrization*, not a *derivation*, and the `budget_mode=derived` label is misleading.

2. **Solver spread at Q²=2 GeV² is unreported and uncharacterized.**
   Clarabel (v118) gives A_min = −0.0234, ECOS (v119) gives A_min = −0.0162 — a gap of 0.0072. On the upper bound:0.2938 vs 0.2890, gap0.0048. These differences are 2–3% of the band width and comparable in magnitude to the lower bound itself. Neither the evidence note nor the results files (`.../runs/.../results.json`) appear to report this spread or attribute it (solver tolerance settings, barrier parameter, conditioning from the high-Q² anchor row in the constraint matrix). This must be quantified and discussed before the run pair can be cited as a cross-check. Specifically:
   - Report the primal/dual residuals from both solvers at the Q²=2 GeV² optimizations.
   - State whether the spread is dominated by the UV anchor constraint row (condition number contribution) or is solver-intrinsic.

3. **Negative A_min at Q²=2 GeV² needs physics comment.**
   Both solvers return negative lower bounds for A^π(−Q²) at Q²=2 GeV². For a gravitational form factor extracted from a positive spectral function (the entire premise of the Bochner positivity bootstrap), a negative value is either (a) permitted by the current constraint set but would be excluded by additional physics input, or (b) an artifact of the UV anchor tolerance being too wide. The draft (`idea-runs/projects/pion-gff-bootstrap-positivity-pilot-2026-02-15/reports/draft.md`) must contain at least one sentence addressing this, otherwise a referee will flag it immediately.

## Non-blocking

- **Single UV anchor fragility.** Only one anchor at Q²=10 GeV² is used. A sensitivity study (e.g., moving the anchor to 8 or 15 GeV² and reporting band-width change at Q²=2 GeV²) would strengthen the case but is not blocking for this round.
- **Gate does not validate physics content of budget components.** The binding gate (`idea-runs/scripts/validate_project_artifacts.py`) checks arithmetic consistency (sum of abs_contributions = absolute_tolerance) and config-to-budget matching, but cannot check whether individual component estimates are reasonable. This is a known limitation; a brief note in the schema doc or evidence note acknowledging this would be helpful.
- **Plot filename is informative but the Q² range is misleading for the science claim.** `A_band_Q2_GeV2_0to10.png` spans0–10 GeV² but the physics claim is about [0, 2] GeV². Consider a companion plot zoomed to [0, 2] GeV² so the band structure in the region of interest is visually clear.
- **Config filename length.** The v4ccq/v4ccr config filenames are >200 characters. This is a portability nuisance on some filesystems but not a correctness issue.

## Real-research fit

The incremental move from an ad hoc tolerance knob to a budgeted, gate-enforced artifact is a genuine methodological improvement for reproducibility in bootstrap-style form factor extractions. The pQCD anchor idea itself (constraining a dispersive bootstrap at high Q² via perturbative input) is well-motivated and appears in the recent literature (arXiv:2412.00848 cited). The scope (pion-only, single channel, LO pQCD) is appropriate for a pilot.

However, the scientific value of the current bounds — A^π ∈ [−0.023, 0.294] at Q²=2 GeV² — is limited: the band is wide enough to be consistent with essentially all existing model predictions and lattice data. The real payoff will come from tightening (additional anchors, moment constraints, or NLO input). The packet should be explicit that this round demonstrates the *infrastructure* for auditable UV input, not yet a competitive phenomenological constraint.

## Robustness & safety

- **Discretization.** 200-point dispersion grid + 200 enforcement points. No convergence study (grid-doubling) is reported for the bound values. Given that the solver spread is already ~0.007, grid discretization error should be shown to be sub-dominant.
- **Normalization.** The anchor is at Q²/m_π² ≈ 513.35, while the target region is Q²/m_π² ∈ [0, ~103]. The constraint matrix mixes rows with very different Q² scales. Condition number of the SOCP constraint matrix is not reported. This is the most likely source of the Clarabel/ECOS spread and should be checked.
- **Load-bearing assumption: LO pQCD at10 GeV².** The entire UV anchor rests on LO pQCD being a reasonable central value at Q²=10 GeV² for the pion GFF. At this scale, αs ≈ 0.18–0.20, so NLO corrections are O(20%). Setting the NLO proxy to zero and absorbing this into the tolerance is defensible *if stated clearly* — but the current `budget_mode=derived` label overstates the rigor.
- **No adversarial tolerance inflation test.** The gate prevents *drift* (config≠ budget) but not *inflation* (someone sets each budget component to a large value). A future gate could cross-check component magnitudes against reference ranges, but this is not blocking.

## Specific patch suggestions

1. **`idea-runs/projects/.../evidence/2026-02-20-w6-30-uv-anchor-budget-derived-binding-v1.md`** — Add a subsection "Budget component provenance" with:
   - The formula or reference for each of the three nonzero components (scale-variation, DA/matching, higher-twist).
   - An explicit statement: "The near-agreement with the earlier±50% proxy is [coincidental / by construction / partially calibrated] because [reason]."

2. **`idea-runs/projects/.../evidence/2026-02-20-w6-30-uv-anchor-budget-derived-binding-v1.md`** — Add a subsection "Solver cross-check" reporting:
   - Clarabel vs ECOS endpoint values at Q²=2 GeV² side by side.
   - Primal/dual residuals or gap from each solver's output.
   - One sentence attributing the spread.

3. **`idea-runs/projects/.../reports/draft.md`** — In the results section for Q²=2 GeV², add: "The negative lower bound indicates that the current constraint set (dispersive + positivity + single LO UV anchor) does not yet exclude A^π < 0 at Q²=2 GeV²; additional input (e.g., normalization at Q²=0or moment constraints) would raise this bound."

4. **`idea-runs/projects/.../artifacts/assumptions/uv_anchor_budget_v1.json`** — Consider renaming `budget_mode` from `derived` to `proxy-derived` or `LO-proxy` to avoid implying full perturbative error analysis. Alternatively, add a `caveats` string field in the schema (`idea-runs/schemas/uv_anchor_budget_v1.schema.json`) and populate it.

5. **`idea-runs/scripts/validate_project_artifacts.py`** — The binding gate should emit a WARNING (not just pass silently) when any budget component has `abs_contribution =0` and `proxy_coefficient = 0`, since this means a known error source is being zeroed out. This is a one-line addition to the validation loop.
