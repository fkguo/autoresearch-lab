VERDICT: NOT_READY

## Blockers

1. **Digitization has no reported spot-check validation against independently known reference values.** The entire increment hinges on replacing an ad-hoc placeholder with a "physics-driven" envelope. Yet the packet reports no cross-check of the digitized η(s) against any verifiable reference point—e.g., η(4m_π²) should equal 1 at threshold, the big-dip minimum should match the value stated or implied in arXiv:2410.23333, and the curve should return toward 1 at large s. The audit-points file is mentioned but its contents are not shown, and no comparison metric (max deviation, RMS residual against any tabulated or known constraint) is provided. Until at least 3–5 anchor values are validated against the source figure or tabulated data, the digitized artifact cannot be treated as a serious physics input—it could silently carry a coordinate-mapping error (e.g., an offset or scale error in the linear fit from page coordinates). **Fix:** Add a validation section (or extend the audit artifact) that reports η at threshold, at the dip, and at the rightmost digitized point, compared to values read by hand from the figure or stated in the paper. Report the coordinate-mapping residual at the tick-label calibration points.

2. **No uncertainty band on the digitized curve itself.** A plot-digitization pipeline has finite resolution (line width, SVG path quantization, tick-label rounding). The artifact stores single `disk_radius` values with no tolerance. If the digitization uncertainty is comparable to the difference between the old placeholder and the new envelope at any s-point, the claimed "physics-driven" tightening may be illusory. **Fix:** Estimate the digitization uncertainty (even crudely, e.g., ± half the SVG stroke width in η-units) and either (a) store it in the artifact or (b) confirm it is negligible relative to the constraint differences that matter for the SDP band.

## Non-blocking

- **Brittleness of the PDF-parsing pipeline.** `pdftotext -bbox` and `pdftocairo -svg` outputs depend on the specific arXiv PDF build, font embedding, and even the Poppler version. This is acceptable for a one-shot digitization, but the script should at minimum assert that the expected number of tick labels and curve segments are found (fail-fast), and the evidence note should record the exact Poppler/pdftotext version used, plus the arXiv PDF hash. Otherwise a re-run on a different machine may silently produce a different artifact.

- **η(s)=1 above s=100 m_π² is conservative but should be flagged in the artifact metadata, not only in the evidence note.** Downstream consumers of the JSON artifact should see a clear `"note"` or `"validity_range"` field indicating that the constraint above 100 m_π² is pure unitarity, not the 2410 profile. This prevents a future user from mistakenly believing the full s-grid is physics-constrained.

- **Retry-policy eps relaxation:** The fail-closed design is correct. However, the packet does not state whether any Q² point in the production run actually required a relaxed-eps retry, and if so, what the final eps was. This should be logged in the run output metadata so a reviewer can check that the relaxed solutions are not qualitatively degraded. Consider also logging the primal-dual gap or solver residual for any point that needed retry.

- **Derived D band labeling:** The outer-envelope rule (Θ_min with A_max, Θ_max with A_min) is conservative by construction, which is fine. The packet should confirm explicitly that the A and Θ bands used are from runs with *identical* s-grid and η profile (both using the new 2410 envelope), not mixing old-placeholder A bands with new-Θ bands. If the A band is from an earlier run (the config name mentions `a_v118`), clarify whether that run used the same S-matrix constraint or a different one—mixing would invalidate the envelope semantics.

- **Minor:** The endpoint numbers ($\hat\Theta^\pi \in [-15.57, 12.55]$, $D^\pi \in [-0.203, 0.0896]$) are quoted without units on Θ. Convention in the literature is to state whether these are in GeV² or dimensionless; please confirm units.

## Real-research fit

The increment is well-motivated: replacing an ad-hoc constant-η constraint with a digitized physics profile is a clear improvement in the evidence chain, and doing so for the trace channel (scalar GFF) is the right next step before attempting crossing-style tightening. The conservative choices (disk-only, η=1 above cutoff, outer envelope for D) are appropriate for a pilot and do not overstate the result. The scope is deliberately limited (pion-only, no coupled-channel), which is honest. The connection to arXiv:2410.23333 is specific and traceable.

However, the value of this increment is entirely contingent on the digitization being *correct*—which is why the missing validation is a blocker rather than a nicety. A wrong envelope is worse than the placeholder, because it carries false confidence.

## Robustness & safety

- Fail-closed retry policy is the right design. Confirm no silent fallback to a weaker problem formulation.
- Schema validation of the artifact is good.
- The shift from a tighter placeholder (constant η=0.6 to high s) to η=1 above 100 m_π² means the new constraint is **less restrictive** at high s. This is correctly noted in the packet, but downstream band comparisons should not be presented as "tighter due to 2410 input" without this caveat. The bands may widen, which is the *honest* outcome of using a defensible constraint—but this must be stated clearly in any report/draft language.
- No data-integrity hash is reported for the digitized artifact. Adding a SHA-256 of the output JSON to the evidence note would close the audit loop.

## Specific patch suggestions

1. **In the digitization script**, add after the coordinate-mapping fit:
   ```python
   # Spot-check: η at threshold must be ~1.0
   eta_threshold = interp(4.0)  # s = 4 m_pi^2
   assert abs(eta_threshold - 1.0) < 0.05, f"Threshold check failed: η(4)={eta_threshold}"
   # Spot-check: big-dip minimum
   eta_min = min(eta_digitized)
   s_min = s_digitized[np.argmin(eta_digitized)]
   print(f"Big dip: η={eta_min:.3f} at s={s_min:.1f} m_pi^2")
   # Compare to expected value from 2410.23333 (fill in)
   ```

2. **In the artifact JSON**, add a top-level field:
   ```json
   "validity_range_s_mpi2": [4.0, 100.0],
   "above_range_policy": "unitarity_only_eta_eq_1",
   "digitization_uncertainty_eta": 0.02
   ```

3. **In the run output metadata**, log for each Q² point:
   ```json
   {"Q2": ..., "status": "optimal", "retries": 0, "final_eps": 1e-7, "primal_dual_gap": ...}
   ```
   so that any relaxed-eps point is immediately visible.

4. **In the D-band derivation config**, add an explicit assertion or config field confirming the A-band run used the same S-matrix constraint version:
   ```json
   "a_band_smatrix_constraint": "s_matrix_constraints_s0_grid200_eta2410_big_dip_v1",
   "theta_band_smatrix_constraint": "s_matrix_constraints_s0_grid200_eta2410_big_dip_v1"
   ```
   If they differ, document why the outer envelope is still valid.

5. **In the evidence note**, add a line:
   ```
   Artifact SHA-256: <hash of the grid200 JSON>
   Poppler version: <version>
   Source PDF SHA-256: <hash of the 2410.23333 PDF used>
   ```
