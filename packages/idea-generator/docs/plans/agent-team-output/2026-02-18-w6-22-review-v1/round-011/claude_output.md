VERDICT: READY

## Blockers

None remaining. The three blockers from Round-015 (tail envelope unquantified, poly24 cross-solver ungated, threshold rationale missing) are all resolved with concrete numbers and artifacts.

## Non-blocking

- The poly24 cross-solver delta (Clarabel v98 vs ECOS v99, ~2.72×10⁻³) sits right at ~70% of the gate tolerance (0.004). This passes, but leaves limited headroom. If future runs tighten the grid or change the ansatz order, the gate could become marginal. Consider logging a note-to-self to re-evaluate the threshold if the setup changes materially.

- The tail envelope is asymmetric: the downward shift (tail=0.8, delta ≈ −3.13×10⁻³) is ~14% larger in magnitude than the upward shift (tail=1.2, delta ≈ +2.75×10⁻³). This is physically plausible (spectral weight redistribution), but worth a one-line comment in the paper or supplemental noting the asymmetry so referees don't flag it as an error.

- The threshold formula uses max(tail-sensitivity, ansatz-sensitivity) rather than a quadrature sum. This is the conservative choice (good), but the 1.25× safety factor is somewhat ad hoc. Acceptable for a pilot study; for a final publication you'd want to either justify 1.25× from a coverage argument or switch to a more principled envelope.

## Real-research fit

The systematic error budget is now self-consistent and auditable:

- Tail sensitivity: ~3.1×10⁻³ (`v92`/`v93` vs `v82` at `idea-runs/projects/pion-gff-bootstrap-positivity-pilot-2026-02-15/runs/...v92.../results.json`, `...v93.../results.json`)
- Ansatz sensitivity: ~2.7×10⁻³ (`v82` vs `v98` at `...v82.../results.json`, `...v98.../results.json`)
- Cross-solver: ~2.7×10⁻³ (`v98` vs `v99` at `...v98.../results.json`, `...v99.../results.json`)

All three systematics are at the few×10⁻³ level, mutually consistent, and small relative to the bound itself (~0.85). This is a credible pilot-level error budget for a positivity bootstrap on the pion gravitational form factor.

## Robustness & safety

- Gate is machine-executed (`cross_solver_check_v1.json` entry for v99 vs v98) and validated by `make validate-project` (proof at `idea-generator/docs/reviews/bundles/2026-02-18-w6-22-idea-runs-validate-project-v5.txt`). No manual overrides.
- Threshold is derived from the scale of observed systematics (×1.25 safety), not from the observed cross-solver delta itself. This avoids the circular-threshold antipattern flagged in earlier rounds.
- Solver tolerance (tol=62) is held constant across all comparison runs, eliminating a potential confound.
- The discretization (grid200, enf200) is fixed across all variants. No hidden resolution changes between compared runs.

## Specific patch suggestions

1. `idea-runs/projects/pion-gff-bootstrap-positivity-pilot-2026-02-15/` (project README or summary table): Add a one-line note on the tail-delta asymmetry (−3.13×10⁻³ vs +2.75×10⁻³) so downstream consumers don't mistake it for a bug.

2. `cross_solver_check_v1.json`: Consider adding a `"headroom_fraction"` field (observed_delta / tolerance ≈ 0.68) so future CI can warn when headroom drops below, say, 0.3.

3. Gate threshold documentation (wherever the 1.25× factor is recorded): Add a sentence: "The 1.25× prefactor provides ~25% headroom above the largest single systematic; a more rigorous coverage prescription (e.g., Feldman-Cousins or profile-likelihood) is deferred to the full-scale study."
