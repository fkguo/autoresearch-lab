VERDICT: NOT_READY

## Blockers

1. **Non-monotonic ASR residuals in the implied-$f_1$ scan undermine the threshold narrative.**
   The "ASR total" column in the implied-$f_1$ table is wildly non-monotonic: tol=55 gives residual −33.3, tol=58 gives −21.6, tol=60 gives −24.0, tol=61 gives −35.7, tol=62 gives −36.7, tol=64 gives −21.5, etc. If the solver is finding feasible points whose ASR residuals jump around by factors of ~1.7× across adjacent tolerance steps, the optimization landscape is either poorly conditioned or the constraint is not binding in the way claimed. The $f_1^{\min}$ column *is* monotonic, but the erratic ASR residuals at the feasibility point mean the solver is not reliably exploring the same region of the feasible set across runs. This must be diagnosed before the threshold narrative (tol ≈ 61–62) can be trusted.
   - Evidence: scan table, runs v68–v75, column "ASR total $(1/\pi)\int ds\,\mathrm{Im}A$".
   - **Next action:** For each run v68–v75, log the primal ASR residual at *both* the min and max solves, and confirm the constraint is active (saturated) or slack. If the residual is not near ±tol at the $f_1^{\min}$ solve, explain why.

2. **$A_{\max}$ plateau at tol ≥ 150 is unexplained and suspicious.**
   Runs v80 (tol=150) and v81 (tol=200) give $A_{\max} \approx 0.912$ with ASR residuals of ~143.8 and ~142.6 respectively — both well *inside* the allowed band, not saturating it. This means some *other* constraint is binding and the ASR band is slack above tol ≈ 140. The review packet does not identify which constraint becomes dominant. Without this, the claim "tightening is real and auditable" is incomplete: the mechanism changes regime and the transition is uncharacterized.
   - Evidence: scan table, runs v80–v81, column "max-solve ASR residual".
   - **Next action:** For v80 and v81, report which constraints are active (dual variable > threshold) at the $A_{\max}$ solve. Identify the binding constraint that caps $A_{\max}$ when ASR is slack.

3. **Cross-solver discrepancy at tol=62 lacks a quantitative acceptance criterion.**
   $\Delta A_{\max} \sim 3.8 \times 10^{-3}$ between ECOS (v76) and Clarabel (v82) is presented as "few $10^{-3}$ level" but the *claimed bound width* at tol=62 is only $A_{\max} - A_{\min} \approx 0.016$. The solver discrepancy is therefore ~24% of the reported band width. No pre-registered tolerance or acceptance gate exists. The stationarity norms differ by an order of magnitude ($3.2 \times 10^{-6}$ vs $1.6 \times 10^{-7}$), suggesting ECOS is less converged.
   - Evidence: v76 vs v82 results, `results.json` dual-check fields.
   - **Next action:** (a) Define and document a quantitative cross-solver acceptance criterion (e.g., $\Delta / \text{band width} < 5\%$). (b) Re-run ECOS at tol=62 with tightened solver tolerances (`feastol`, `abstol` ≤ $10^{-9}$) and report whether the gap closes. (c) If it does not close, the tighter of the two bounds must be adopted as the conservative result.

4. **Grid-part ASR integral is identical across all implied-$f_1$ runs at the tail level.**
   `asr_tail_integral_over_pi = -15.5372` is constant to all displayed digits across v68–v75. This is expected (fixed tail model). However, the grid-part integral varies from −6.0 to −21.2 while the tolerance band is only ±55 to ±70. The packet does not confirm that the *constraint* is formulated on the total (grid + tail) rather than on the grid part alone. The audit excerpt from v76/v82 shows total ≈ 62.0 (saturated), but the implied-$f_1$ scan residuals are all *negative* and large, which is inconsistent with a target of 0 and tolerance of 55–70 unless the target is nonzero or the sign convention differs.
   - Evidence: implied-$f_1$ scan table vs tail audit excerpt from v76.
   - **Next action:** State explicitly in the scan summary: (a) the value of `asr_target` used in v68–v75, (b) whether the reported "ASR total" is the raw integral or the residual (integral − target), (c) confirm the sign convention. The v76 audit shows a *positive* total of +62 while the v68–v75 column shows *negative* values of order −20 to −37 — this sign flip must be explained.

## Non-blocking

- The $f_1^{\max}$ values cluster around 0.338–0.341 across all tolerance values, suggesting the upper slope bound is insensitive to the ASR band. This is fine but worth a one-line note in the scan summary confirming it is expected (the upper bound is controlled by positivity, not ASR).
- The config file naming convention (e.g., `..._asrtol2p0.json`) encodes tolerance in the filename but the mapping to the actual `asr_absolute_tolerance` JSON field is not documented in the packet. A lookup table or naming convention doc would help reproducibility.
  - Path: `.../compute/a_bochner_k0_socp_config_v4bh_dispersion_grid200_enf200_qstar_audit7_ecos_asrband_slope_tmd_asrtol2p0.json`
- Claim 4 (interpretability risk) is correctly flagged as open. The tol values of order $10^2$ in "$f$-style" units should eventually be compared to a perturbative OPE estimate of the ASR violation. This is not a blocker for the computational infrastructure review but is a blocker for any physics publication.

## Real-research fit

The soft-ASR-band approach is a sound generalization of the binary on/off switch from W6-21. The implied-$f_1$ diagnostic is a genuinely useful feasibility predictor. The overall direction — scanning tolerance to map out the feasibility/tightening tradeoff — is the right one for a bootstrap-style analysis. The infrastructure (audit splits, cross-solver checks, config-driven runs) is maturing appropriately.

However, the packet is not yet at the level where an external reader could reproduce the key claims without resolving the sign-convention ambiguity (Blocker 4) and the non-monotonic residual issue (Blocker 1). The cross-solver gate (Blocker 3) is a methodological gap that will become critical when results are quoted in a paper.

## Robustness & safety

- **Numerical robustness:** The ECOS stationarity norm of $3.2 \times 10^{-6}$ is marginal for claims at the $10^{-3}$ level in the objective. Clarabel's $1.6 \times 10^{-7}$ is better but still not comfortably below the claim precision. Tightening solver tolerances is recommended before any publication-grade claim.
- **Tail model sensitivity:** The fixed tail ($-15.5372/\pi$) is load-bearing. No sensitivity analysis (e.g., ±10% tail variation) is presented. This is acceptable for a pilot but should be flagged as a required step before publication.
- **Discretization:** Grid size (200 points) and enforcement count (200) are stated in the config filename but no convergence study (grid refinement) is presented in this packet. Again acceptable for pilot, required for publication.

## Specific patch suggestions

1. `idea-runs/projects/pion-gff-bootstrap-positivity-pilot-2026-02-15/evidence/2026-02-18-w6-22-asrband-scan-summary-v1.md`: Add a column or footnote to the implied-$f_1$ scan table specifying `asr_target` and clarifying whether the "ASR total" column is the raw integral or the residual (integral − target). Resolve the sign discrepancy with the v76/v82 audit excerpts.

2. `idea-runs/projects/pion-gff-bootstrap-positivity-pilot-2026-02-15/compute/julia/bochner_k0_socp_dispersion_bounds.jl`: In the results-writing block, add `asr_target_used` and `asr_tolerance_used` fields to `results.json` so that each run is self-documenting. Currently the reviewer must cross-reference the config file.

3. `idea-runs/projects/pion-gff-bootstrap-positivity-pilot-2026-02-15/evidence/2026-02-18-w6-22-asrband-scan-summary-v1.md`: For the $A^\pi(-Q^*)$ bounds table (v76–v81), add a column identifying the binding constraint at the $A_{\max}$ solve (ASR band vs. other), especially for v80/v81 where ASR is slack.

4. Cross-solver gate: define a quantitative acceptance criterion in the project's `METHODOLOGY.md` or equivalent, e.g.:
   ```
   Cross-solver acceptance: |Δ_obj| / band_width < 0.05
   ```
   and enforce it programmatically in the validation pipeline.
