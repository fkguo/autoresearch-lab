VERDICT: NOT_READY

## Blockers

1. **ECOS solver status not reported.** v100 Clarabel reports all-OPTIMAL for both min/max solves, but v101 (ECOS) has no equivalent solver-status audit. ECOS can silently return `OPTIMAL_INACCURATE`; without confirming all 8 solves (4 points × min/max) hit true `OPTIMAL`, the cross-check deltas are uninterpretable.- Evidence gap: no mention in `idea-runs/projects/pion-gff-bootstrap-positivity-pilot-2026-02-15/runs/2026-02-18-a-bochner-k0-socp-v101-.../results.json` or the run log of per-solve status.
   - **Next action:** Extract and tabulate ECOS solver status for every solve in v101. If any solve is not `OPTIMAL`, re-run with tighter ECOS tolerances or flag the affected point.

2. **$A_{\min}$ systematics entirely missing from cross-check and tail/ASR tables.** All cross-solver (v101), tail-scale (v102/v103), and ASR-tolerance (v104/v105) tables report only $A_{\max}$. The allowed band is two-sided; if $A_{\min}$ shifts asymmetrically under these variations the reported band width is unreliable.
   - Affected files: `evidence/2026-02-18-w6-23-multiq-asrband-slope-summary-v2.md`, all v101–v105 `results.json`.
   - **Next action:** Add $A_{\min}$ columns (and $\Delta A_{\min}$) to every systematics table. Verify band width $A_{\max}-A_{\min}$ is stable under each variation.

3. **Truncated artifact paths prevent independent verification.** v101–v105 run paths are listed as `.../runs/2026-02-18-a-bochner-k0-socp-v101-.../results.json` with literal ellipses. A reviewer cannot locate or re-run these artifacts.
   - **Next action:** Provide full, untruncated paths for every run directory (v101–v105 configs and results).

## Non-blocking

- The ASR tolerance spot-check (v104/v105) covers only two $Q^2$ values. Extending to $Q^2=5$ and $Q^2=10$ would strengthen the claim that the tens-of-$10^{-3}$ sensitivity is monotonic in $Q^2$, but is not strictly required for a pilot.
- The tail-scale envelope uses only $\pm 20\%$. Documenting the physics motivation for this range (or citing a prior estimate) would improve the evidence note but is not blocking.
- No primal-dual gap or constraint-violation magnitude is reported for any run. Logging these (especially for ECOS) would be good hygiene.

## Real-research fit

The overall structure — SOCP positivity bootstrap for the pion gravitational form factor with dispersive constraints, ASR band, and UV tail — is a legitimate and timely calculation. The systematic variation program (cross-solver, tail, ASR tolerance) is well-designed for a pilot. The dominant UV sensitivity at large $Q^2$ is correctly identified and honestly flagged as conditional. The work is on track for a credible pilot result once the blockers above are resolved.

## Robustness & safety

- **Normalization:** The ASR tolerance knob produces $\sim 3\times 10^{-2}$ shifts at $Q^*$ (tol 50→80), which is an order of magnitude larger than the cross-solver spread ($\sim 7\times 10^{-4}$). This hierarchy is physically sensible (UV assumption dominates solver numerics), but the absence of $A_{\min}$ data means we cannot confirm the band doesn't collapse or invert under extreme tol values.
- **Discretization:** 200-point dispersion grid and 200 enforcement points are stated in the config filename. No convergence study (grid 100 vs 200 vs 400) is presented; acceptable for a pilot but should be flagged for the full study.
- **Load-bearing assumption:** The entire band is conditional on `asr_absolute_tolerance`. The manuscript must not present the band as a model-independent result without prominently stating this conditioning. The evidence note v2 appears to do this correctly.

## Specific patch suggestions

1. `evidence/2026-02-18-w6-23-multiq-asrband-slope-summary-v2.md`: Add a table section "Cross-solver / tail / ASR systematics for $A_{\min}$" mirroring the existing $A_{\max}$ tables, pulling values from v101–v105 `results.json`.

2. `reports/draft.md` (W6-23 bullet): Add a sentence: "Cross-solver, tail, and ASR-tolerance systematics for both $A_{\min}$ and $A_{\max}$ are tabulated in the evidence note."

3. v101 run script or config: Add `"log_solver_status": true` (or equivalent) and re-run, or post-process `results.json` to extract and tabulate ECOS status codes.

4. `evidence/2026-02-18-w6-23-multiq-asrband-slope-summary-v2.md` artifact listing: Replace all `...` in run paths with full directory names.
