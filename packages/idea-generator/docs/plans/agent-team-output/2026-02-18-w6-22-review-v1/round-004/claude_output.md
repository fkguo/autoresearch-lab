VERDICT: NOT_READY

## Blockers

1. **Non-monotonic ASR residuals in the implied-$f_1$ scan undermine the threshold narrative.**
   The "ASR total" column in the implied-$f_1$ table is wildly non-monotonic: tol=55 gives residual −33.3, tol=58 gives −21.6, tol=60 gives −24.0, tol=61 gives −35.7, tol=62 gives −36.7, tol=64 gives −21.5, etc. If the solver is finding feasible points whose ASR residuals jump around by factors of ~1.7× across adjacent tolerance steps, the optimization landscape is either poorly conditioned or the constraint is not binding in the way claimed. The $f_1^{\min}$ column *is* monotonic, but the erratic ASR residuals at the feasibility point mean the solver is not reliably exploring the same region of the feasible set across runs. This must be diagnosed before the threshold narrative (tol ≈ 61–62) can be trusted.
   - Evidence: scan table, runs v68–v75, column "ASR total $(1/\pi)\int ds\,\mathrm{Im}A$".
   - **Next action:** For each run v68–v75, log the solver's primal iterate at the $f_1^{\min}$ solve and verify that the ASR constraint is either active or inactive with a clear margin. Plot the ASR residual vs tol for both min and max solves to confirm the constraint activation pattern.

2. **$A_{\max}$ saturation at tol ≥ 150 is unexplained and suspicious.**
   Runs v80 (tol=150) and v81 (tol=200) give nearly identical $A_{\max}$ (0.91198 vs 0.91153) and both report ASR residuals (~143.8, ~142.6) well below their allowed tolerance. This means the ASR band is no longer the active constraint — some other constraint is binding. But the review packet does not identify which constraint takes over, nor whether this saturation value is physically meaningful or an artifact of the grid/discretization.
   - Evidence: scan table, runs v80–v81.
   - **Next action:** For v80 and v81, report the full set of active constraints at the $A_{\max}$ solve. Identify the binding constraint that caps $A_{\max}$ at ~0.912. Verify this is not a discretization ceiling (e.g., the Bochner positivity matrix hitting a grid-resolution wall).

3. **Cross-solver discrepancy at tol=62 lacks a quantitative acceptance criterion.**
   $\Delta A_{\max} \sim 3.8 \times 10^{-3}$ between ECOS (v76) and Clarabel (v82) is presented as "few $10^{-3}$ level" but the claimed tightening band at tol=62 is itself only $A_{\max} - A_{\min} \approx 0.016$ (ECOS) or $\approx 0.021$ (Clarabel). The solver discrepancy is therefore 18–24% of the reported band width. No pre-registered acceptance gate exists.
   - Evidence: v76 vs v82 results; `bochner_k0_socp_dispersion_bounds.jl` (no cross-solver tolerance gate in code).
   - **Next action:** Define and implement a quantitative cross-solver agreement gate (e.g., $|\Delta A| / \text{band width} < 5\%$) in the validation pipeline. Re-run at tighter solver tolerances or with a third solver (SCS) to triangulate.

4. **Tail integral is suspiciously constant across all runs.**
   `asr_tail_integral_over_pi` = −15.5372 is identical to all displayed digits across every single run (v68–v82). If the tail is truly fixed (hard-coded from a UV model), this must be stated explicitly and the sensitivity of all claims to this single number must be assessed. If it is computed and happens to be constant, that is a different (and suspicious) situation.
   - Evidence: all scan tables; `bochner_k0_socp_dispersion_bounds.jl` (tail computation logic).
   - **Next action:** Confirm in the code that the tail is a fixed input (not optimized). Add a tail-variation sensitivity scan (e.g., ±10% on the tail) to bound the impact on $f_1^{\min}$ thresholds and $A(-Q^*)$ bounds. Document the tail's provenance (which UV model, which parameters).

## Non-blocking

- The $f_1^{\min}$ values are monotonically decreasing with tol, which is the correct qualitative behavior. The scan design is sound in principle.
- The `asr_within_band = True` flags are consistent with the reported residuals and tolerances in the slope-input scan (v76–v82).
- The stationarity norms (ECOS ~3.2e-6, Clarabel ~1.6e-7) are reasonable for SOCP on this scale, though ECOS is notably worse.
- Claim 4 (interpretability risk of tol ~ $O(10^2)$) is correctly flagged as open. This is honest and appropriate — but it also means the tightened bounds cannot yet be quoted as physics results.
- The gate/validation evidence (make validate, failure hooks, dashboard rerenders) appears procedurally complete based on the listed paths.

## Real-research fit

The soft-ASR-band approach is a legitimate and useful generalization of the binary ASR switch. The implied-$f_1$ threshold diagnostic is a good idea for mapping the feasibility boundary. However, the current evidence does not yet support the "tightening is real and auditable" claim (Claim 3) at the precision needed for a research result, primarily because the cross-solver discrepancy is a significant fraction of the claimed band and the ASR residual behavior in the threshold scan is erratic. The framework is on the right track but needs one more round of numerical hygiene before the bounds can be cited.

## Robustness & safety

- **Discretization dependence:** No grid-refinement study is presented for the W6-22 runs. The grid is described as "v16-scale" but the sensitivity of the tol=62 bounds to grid doubling is unknown. This is a load-bearing assumption.
- **Normalization convention:** The $(1/\pi)$ convention appears consistent between the ASR constraint, the $f_1$ definition, and the tail integral. The audit split (grid + tail = total) checks out numerically in the two excerpted runs (v76, v82). No double-counting is evident *in those two runs*, but the erratic ASR residuals in the threshold scan (Blocker 1) leave open the possibility of a subtle issue in other runs.
- **Fixed tail as a hidden prior:** The constant tail (−15.5372) acts as a strong implicit assumption. Any shift in this number directly translates to a shift in the effective ASR tolerance, meaning the "tol=62 threshold" is really "tol=62 given this specific tail model." This coupling is not discussed.

## Specific patch suggestions

1. `idea-runs/projects/pion-gff-bootstrap-positivity-pilot-2026-02-15/compute/julia/bochner_k0_socp_dispersion_bounds.jl` — Add a post-solve check that logs whether the ASR band constraint is active (slack < solver tolerance) or inactive, for every solve. Write this flag to `results.json` as `asr_constraint_active::Bool`.

2. `idea-runs/projects/pion-gff-bootstrap-positivity-pilot-2026-02-15/evidence/2026-02-18-w6-22-asrband-scan-summary-v1.md` — Add a column to both scan tables reporting the ASR constraint slack (= tol − |residual|) so reviewers can immediately see activation status without mental arithmetic.

3. `idea-runs/projects/pion-gff-bootstrap-positivity-pilot-2026-02-15/compute/julia/bochner_k0_socp_dispersion_bounds.jl` — Implement a cross-solver agreement gate: after running both ECOS and Clarabel, assert `|A_max_ecos - A_max_clarabel| / (A_max - A_min) < threshold` (suggest threshold = 0.05) and fail the validation if violated.

4. Add a new config + run that varies `asr_tail_integral_over_pi` by ±10% (i.e., −13.98 and −17.09) at tol=62 with slope input, to produce a tail-sensitivity table for $A(-Q^*)$ bounds. This can be a two-run addition (v83, v84).
