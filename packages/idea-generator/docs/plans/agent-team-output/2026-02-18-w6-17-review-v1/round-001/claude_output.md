VERDICT: READY

## Blockers

- None.

## Non-blocking

1. **Solver cross-check missing.** The entire "no material tightening" conclusion rests on COSMO alone. A single cross-solver sanity check (e.g., SCS, Hypatia, or even Mosek via academic license) for at least one of v14b or v15 would substantially increase confidence that the null result is physics rather than a COSMO-specific artifact (warm-start handling, scaling heuristics, etc.). This is not a blocker because the OPTIMAL termination at eps=1e-5 is reassuring, but it should be done before the negative result is cited in a draft paper.

2. **Quantitative "essentially unchanged" threshold.** The packet states the interval is "essentially unchanged" but does not quote the actual numerical bounds from v14b/v15 alongside the v10 LP baseline with explicit relative differences. The neg-result writeup should include a small table: `[run, min, max, width, Δwidth/width_LP(%)]` so the claim is auditable without re-running. Recommend adding this to the diagnostic file.

3. **Gram set design rationale.** The choice of "cross5" (5 $b$-points in a cross pattern) is described only by name. A brief justification of why this particular set is expected to be representative—or an argument that the Gram matrix rank is too low relative to the number of free spectral coefficients to generate a non-trivial constraint—would turn the negative result from empirical into semi-analytic and make it far more informative for deciding whether larger Gram sets are worth pursuing.

4. **Dashboards referenced but not included.** The islands and opportunities dashboards are listed as artifacts but their content is not in the packet. Including at least the relevant rows would help reviewers assess the proposed next-step prioritization.

5. **Minor: config naming proliferation.** v14 → v14b → v15 in rapid succession suggests the config-versioning convention is becoming hard to navigate. Consider a lightweight changelog or `VERSIONS.md` in the compute directory.

## Real-research fit

The work fits well into the bootstrap-positivity pilot. The question "does Bochner PSD tightening at a single $Q^*$ point shrink the allowed region?" is a natural first test before committing to a full SDP reformulation. Recording it as a structured negative result is methodologically sound and aligns with evidence-first research norms.

The proposed next steps (OPE/trace-anomaly moment constraints, dispersion-coupled SOCP integration) are physically well-motivated. In the ππ amplitude bootstrap analogy, the dramatic bound shrinkage comes from imposing **crossing + unitarity simultaneously**, not from PSD alone. The analogous mechanism here would be coupling the Bochner PSD constraints with the dispersive (SOCP/second-order cone) structure, which is correctly identified as a higher-priority path.

One physics concern worth flagging: the Gram-PSD constraints evaluated at a **single** $Q^2$ anchor are inherently weaker than requiring PSD for all $Q^2$ (i.e., the full Bochner condition is an infinite family of PSD constraints). The null result at one or two anchor points does not rule out that a continuum-discretized version (many $Q^2$ anchors with moderate Gram sets) could bite. This should be acknowledged in the neg-result writeup.

## Robustness & safety

- **Solver termination:** The observation that eps=1e-6 hits ITERATION_LIMIT while eps=1e-5 gives OPTIMAL is correctly flagged and handled. The decision to relax to eps=1e-5 is reasonable for a diagnostic run but should be noted as a caveat: if bounds are insensitive to the Gram constraint, this tolerance choice is immaterial, but if future richer Gram sets start to bite, solver tolerance will need revisiting.
- **Reproducibility:** Configs are version-controlled and runs are archived with solver metadata. The `make validate` passes are recorded. This is adequate.
- **No risk of false-positive tightening:** The concern here would be accidentally concluding tightening when there is none (or vice versa). Since the result is null, the main risk is a false negative (missing real tightening due to implementation bug). The cross-solver check recommended above mitigates this.

## Specific patch suggestions

1. **Add a comparison table to the neg-result diagnostic file:**
   ```
   | Run  | Constraint set        | eps   | Status   | min(F)  | max(F)  | width   | Δw/w_LP |
   |------|-----------------------|-------|----------|---------|---------|---------|---------|
   | v10  | LP baseline           | 1e-5  | OPTIMAL  | X.XXXX  | X.XXXX  | X.XXXX  | —       |
   | v14b | LP + Gram-PSD cross5  | 1e-5  | OPTIMAL  | X.XXXX  | X.XXXX  | X.XXXX  | ~0%     |
   | v15  | LP + 2-anchor Gram    | 1e-5  | OPTIMAL  | X.XXXX  | X.XXXX  | X.XXXX  | ~0%     |
   ```

2. **Add a one-paragraph analytic estimate** of the expected constraint strength: how many independent conditions does the $5\times5$ Gram PSD add vs. how many free spectral parameters exist? If the ratio is small, the null result is expected on dimensional grounds.

3. **Acknowledge the single-vs-continuum $Q^2$ limitation** in the neg-result writeup (one sentence suffices).

4. **Before moving to the next island, run one SCS cross-check** on v14b to rule out solver-specific artifacts. This can be a single min or max run.

5. **In `bochner_k0_bounds.jl`**, consider adding a `solver_backend` config key now (even if only COSMO is implemented) to make future cross-solver runs config-driven rather than requiring code changes.
