VERDICT: READY

## Blockers
- None.

## Non-blocking
- **Digitization Maintenance:** The `pdftotext -bbox` + SVG path extraction method is robust for the current file but brittle to any upstream PDF layout changes (e.g., arXiv version updates). While acceptable for this pilot, prefer requesting raw data tables from authors for the final publication pipeline.
- **High-$s$ Discontinuity:** Setting $\eta=1$ strictly for $s > 100 m_\pi^2$ introduces a discontinuity in the constraint envelope (and its derivative) if the digitized curve ends below 1. This is conservative and valid, but may cause minor numerical noise in dual variables near the cutoff.
- **Retry Visibility:** While the retry policy is robust, ensure the *final effective epsilon* for each grid point is logged in the run metadata. If a large percentage of the band relies on relaxed tolerances, the precision claim of the result needs to be qualified.

## Real-research fit
- **Methodology:** Replacing ad-hoc placeholders with digitized literature envelopes is the correct step towards a physical result. The vector-based extraction is superior to raster tracing.
- **Scope Interpretation:** The decision to revert to unitarity ($\eta=1$) outside the plot range is the correct conservative choice for a data-driven approach; extrapolating the dip without theoretical backing would be unsafe.
- **Next Steps:** Regarding the "next tightening" question: Prioritize the geometric constraints (halfspaces/regions from He/Su) over UV/OPE refinements. The disk constraint is the coarsest approximation; cutting the allowed region with crossing-symmetric hyperplanes will likely yield the most significant band reduction.

## Robustness & safety
- **Fail-Closed Logic:** The retry policy correctly maintains safety by failing closed if `OPTIMAL`-like status is not reached, even after relaxation.
- **Derived Band:** The outer envelope construction (min/max interval arithmetic) for $D^\pi$ is rigorous as a worst-case bound, assuming $A$ and $\Theta$ are treated as independent. This is safe, though likely over-conservative compared to a joint bootstrap.

## Specific patch suggestions
- **Digitization Sanity Check:** In `digitize_2410_s0_inelasticity.py`, add an assertion that the raw extracted values do not exceed $1.0 + \delta$ (where $\delta$ is a small numerical tolerance) *before* clamping, to catch potential coordinate transformation errors.
- **Labeling:** In the derived $D^\pi$ plot generation, explicitly label the band as "Uncorrelated Outer Envelope" to distinguish it from future joint-constraint results.
