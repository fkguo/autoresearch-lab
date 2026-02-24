VERDICT: NOT_READY

## Blockers

1. **No independent validation of the digitized η(s) against known tabulated values or cross-checks.** The digitization pipeline (`pdftotext -bbox` → `pdftocairo -svg` → linear tick-fit) is fragile by construction: PDF bounding-box coordinates can shift across renderers, and SVG path extraction relies on the black curve being the only (or the first) path element with the expected stroke. The packet lists audit points (`eta2410_big_dip_grid200_points_v1.json`) but does not report *any* numerical sanity check — e.g., comparing the digitized η at the ρ/f₂ peaks to known PDG-adjacent values, or overlaying the digitized curve on the original figure. Before this artifact is treated as a physics input (rather than a placeholder), at least one of the following must be present in the evidence note:
   - A comparison table of digitized η vs. analytically known η at ~3 landmark s values (threshold, ρ peak, f₂ region).
   - A generated overlay plot (digitized points on top of the original 2410 figure) committed as an audit artifact.

2. **The semantics change (η=1 for s > 100 m²_π) is under-documented and potentially unsound without an explicit argument.** The old placeholder used η = 0.6 out to the cutoff; the new profile simply turns off at s = 100 m²_π. This *loosens* the constraint in the high-s region that the spectral integral still covers (the dispersive grid goes to s₀ which, given grid200, likely extends well beyond 100 m²_π). The packet acknowledges this is "less constraining" but does not quantify the impact: how much of the final band width at Q² = 2 GeV² is attributable to s > 100 m²_π contributions? Without at least a brief sensitivity study (e.g., compare the band with η=1 above 100 vs. η=0.8 above 100), the user of the derived D^π bound cannot assess whether this design choice dominates the uncertainty. This is a blocker because the entire point of W6-38 is to replace ad-hoc choices with physics-driven ones; silently introducing a new ad-hoc choice (η=1 cutoff) without quantification undermines that goal.

3. **Retry-policy eps relaxation lacks a dual-feasibility or residual gate.** The packet states the policy "fails closed" if no OPTIMAL-like status is reached but does not mention any check on the *magnitude* of constraint violation after eps relaxation. SDP solvers (CVXPY/SCS/MOSEK) can return `optimal_inaccurate` with arbitrarily large primal-dual gaps when eps is loosened aggressively in late attempts. The production config must include an explicit residual or gap threshold (e.g., `max_primal_dual_gap: 1e-4`) that is checked *after* the solver returns, independent of status string. Without this, an `optimal_inaccurate` result with a 10% relative gap could silently pollute the band. This is a blocking robustness issue for any result labeled "production."

## Non-blocking

- The evidence note should clarify whether the "big-dip" scenario from 2410.23333 is the *most conservative* or *central* scenario in that reference. If other scenarios (e.g., "small-dip") give a tighter η, the choice of big-dip should be explicitly justified as the conservative option, or both should be run.
- The naming convention for configs is becoming unwieldy (the full-run config filename is 200+ characters). Consider a hash-indexed registry with human-readable aliases before the next increment.
- The derived D^π band endpoint numbers ([-0.203, 0.0896] at Q²=2 GeV²) are reported without comparison to the previous placeholder run. Including a Δ (old vs. new) in the evidence note would make the physics impact of this increment immediately legible.
- The failure-library entry for `ITERATION_LIMIT` is a good practice. Consider adding the solver version and platform (OS/arch) to the record, since SCS behavior is version-sensitive.
- Draft report "double backslash in math" fix is mentioned but not shown; confirm this doesn't introduce rendering regressions in other equations.

## Real-research fit

The overall direction — replacing ad-hoc S-matrix bounds with digitized literature constraints and feeding them into an SDP bootstrap — is methodologically sound and follows the standard workflow in the S-matrix bootstrap community. The pion-only, disk-only, GFF-only scope is clearly delimited. The choice of 2410.23333 as a source for inelasticity is reasonable; it is a recent, well-cited analysis. However, the digitization-from-PDF approach is inherently lossy and fragile — in a real publication pipeline, one would contact the authors for tabulated data. For a pilot/internal stage this is acceptable *provided* the validation artifacts described in Blocker 1 are added. The conservative outer-envelope rule for the derived D band is standard (pessimistic combination of independent bounds). The increment is honest about what it is *not* doing (no crossing constraints, no coupled channels).

## Robustness & safety

- **Solver robustness (Blocker 3 above):** The retry with eps relaxation is a known technique but must be paired with post-hoc residual validation. Without it, the "fail closed" claim is only as reliable as the solver's status string, which is not reliable enough for production bounds.
- **Digitization robustness (Blocker 1):** PDF-coordinate extraction is renderer-dependent. A single-point validation failure could indicate a systematic shift affecting the entire curve.
- **Schema validation:** The packet mentions schema-validated artifacts, which is good. Confirm the schema enforces `0 ≤ η(s) ≤ 1` for all grid points and `η(s) = 1` at threshold.
- **Reproducibility:** The digitization script is project-local and fully offline, which is good. However, it depends on external tools (`pdftotext`, `pdftocairo`) whose versions should be pinned in a requirements file or the evidence note.

## Specific patch suggestions

1. **Add a digitization validation artifact (Blocker 1):**
   - In `digitize_2410_s0_inelasticity.py`, add a final block that prints/writes a comparison table at s = 4 m²_π (threshold, η should ≈ 0), s ≈ 30 m²_π (ρ/f₂ region, η should have a known dip), and s = 100 m²_π (end of digitized range). Commit this as `audit/eta2410_big_dip_landmark_check_v1.json`.
   - Generate an overlay PNG (`audit/eta2410_big_dip_overlay_v1.png`) plotting digitized points on a copy of the original figure axis range.

2. **Add a sensitivity scan for the η=1 cutoff (Blocker 2):**
   - Run the smoke config (grid80) three times: with η=1 above 100, η=0.8 above 100, and η=0.6 above 100. Report the band widths. This can be a one-paragraph addition to the evidence note.

3. **Add a post-solver residual gate (Blocker 3):**
   - In the SDP runner, after each solve (including retries), check `prob.solver_stats` for primal/dual residuals and gap. Add a config key `max_acceptable_gap: 1e-4` (or similar). If the gap exceeds this after all retries, mark the point as failed (NaN) regardless of status string. Example:
     ```python
     if prob.solver_stats.duality_gap > config["max_acceptable_gap"]:
         result = float("nan")  # fail closed
     ```

4. **Pin external tool versions:**
   - Add to the evidence note or a `requirements-system.txt`:
     ```
     pdftotext (poppler-utils) >= 22.02
     pdftocairo (poppler-utils) >= 22.02
     ```

5. **Add old-vs-new comparison to evidence note:**
   - Include a brief table comparing the placeholder-run endpoints (from the previous increment) to the W6-38 endpoints at Q² = 0.5, 1.0, 2.0 GeV², so the physics impact of the digitized η is immediately visible.
