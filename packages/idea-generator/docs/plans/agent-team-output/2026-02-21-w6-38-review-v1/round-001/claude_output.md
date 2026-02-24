VERDICT: NOT_READY

## Blockers

1. **No independent validation of digitization accuracy.** The digitize script relies on `pdftotext -bbox` tick extraction and `pdftocairo -svg` path extraction with a fitted linear map. There is no stated round-trip check (e.g., overlay of digitized η(s) on the original figure, or comparison against tabulated values if any exist in supplementary material of 2410.23333). A single mis-parsed tick label or an SVG path that includes axis lines / legend decorations would silently shift the entire envelope. Before this artifact can be treated as a physics input: **(a)** produce an overlay plot (digitized curve on top of a rasterized crop of the original figure) and include it in `audit/`; **(b)** state the maximum pointwise deviation between any two independent digitizations (e.g., a second pass with WebPlotDigitizer or manual spot-checks at known landmarks such as the big-dip minimum). Without (a) and (b) the entire downstream band is unverifiable.

2. **Discontinuous η at s = 100 m\_π²; no sensitivity study.** The packet acknowledges that η jumps to 1 above s = 100 m\_π² but provides no quantification of how much the final Θ̂ or D band changes relative to the placeholder constant-η floor. If the band is *wider* with the new input (which the packet hints at: "can be less constraining at high s"), the reader cannot tell whether the loosening is dominated by the physics of the digitized curve or by the arbitrary cutoff at 100 m\_π². A one-line sensitivity test—rerun with η(s > 100) held at the last digitized value (continuation by constant) and report the Θ̂ band endpoints—is needed to make the result interpretable. This is a physics-integrity blocker, not just a nicety.

3. **Retry-policy eps relaxation lacks a dual-infeasibility / residual gate.** The packet says the policy "fails closed when no OPTIMAL-like status is reached," but CVXPY's `optimal_inaccurate` (or MOSEK's `NEAR_OPTIMAL`) can hide large primal-dual gaps. There is no stated threshold on `prob.solver_stats.extra_stats` residuals or on `|primal_obj − dual_obj|/max(1,|primal_obj|)`. A relaxed-eps solve that returns OPTIMAL_INACCURATE with a 5 % duality gap would silently contaminate the band. **Gate requirement:** log and check `duality_gap_relative < tol` (suggest tol ≤ 1e-3) for every point that enters the final band; reject otherwise.

## Non-blocking

- The naming convention for configs is getting unwieldy (150+ chars). Consider a hash-based naming with a human-readable alias file; this is housekeeping, not blocking.
- The evidence note and draft report mention fixing "double backslash in math" — this is fine but should not be bundled as a change description bullet alongside physics changes; it inflates the diff surface for reviewers.
- The failure-library entry for the ITERATION_LIMIT pitfall is welcome. Minor: the `approach_id` UUID should be cross-referenced from the evidence note for traceability.
- Audit points are provided for grid200 but not explicitly for grid80 (smoke). If smoke is only for CI gating this is acceptable, but state so explicitly.

## Real-research fit

The motivation is sound: replacing an ad-hoc constant η with a literature-derived, s-dependent inelasticity is exactly the kind of incremental tightening a bootstrap pilot should pursue. The choice of the "big-dip" scenario from 2410.23333 is physically reasonable for S0. The overall architecture (schema-validated artifact → SDP config → band) is clean and reproducible in principle. The derived-D outer-envelope approach (conservative combination of A and Θ bands) is standard. However, the increment's value proposition depends entirely on the digitized curve being *correct*, which circles back to Blocker 1.

## Robustness & safety

- **Fail-closed claim is incomplete** (Blocker 3). The retry policy's final fallback must include a residual/gap check, not just solver status.
- The cutoff at s = 100 m\_π² is a silent assumption that could dominate the physics; it should be flagged as such in the artifact metadata (e.g., a `caveats` field in the schema) so downstream consumers are warned.
- No regression test is described that would catch a future schema change breaking the η artifact. A minimal CI assertion (load artifact, check monotonicity/range of η values, verify grid alignment with the SDP config) would be cheap insurance.

## Specific patch suggestions

1. **Digitization overlay (Blocker 1):**
   In `digitize_2410_s0_inelasticity.py`, after writing the artifact, add:
   ```python
   # --- Audit overlay ---
   import matplotlib.image as mpimg
   fig, ax = plt.subplots()
   bg = mpimg.imread("cropped_fig_2410_big_dip.png")
   ax.imshow(bg, extent=[s_min, s_max, 0, 1], aspect='auto', alpha=0.5)
   ax.plot(s_grid, eta_digitized, 'r-', lw=1.5, label='digitized')
   ax.set_xlabel(r'$s\;[m_\pi^2]$'); ax.set_ylabel(r'$\eta(s)$')
   ax.legend(); fig.savefig("audit/eta2410_overlay_check.png", dpi=200)
   ```
   and commit the resulting PNG.

2. **Sensitivity to η cutoff (Blocker 2):**
   Add a one-shot rerun (smoke grid is fine) with:
   ```json
   "eta_continuation_above_smax": "constant_last_value"
   ```
   and report Θ̂ band endpoints alongside the η = 1 continuation. Two numbers suffice.

3. **Duality-gap gate (Blocker 3):**
   In the retry loop, after obtaining a solution:
   ```python
   gap = abs(prob.value - dual_value) / max(1.0, abs(prob.value))
   if status in ACCEPTABLE_STATUSES and gap > DUALITY_GAP_TOL:
       log.warning(f"Rejected: duality gap {gap:.2e} > {DUALITY_GAP_TOL}")
       status = "REJECTED_GAP"
   ```
   Set `DUALITY_GAP_TOL = 1e-3` and document.

4. **Schema caveat field:**
   In `s_matrix_constraints_v1.schema.json`, add an optional `"caveats": {"type": "array", "items": {"type": "string"}}` and populate the artifact with `["eta set to 1.0 for s > 100 m_pi^2; no continuation model applied"]`.

5. **Minor — evidence note cross-ref:** Add `failure_library_ref: ec5fc5c2-...` to the evidence note YAML front-matter.
