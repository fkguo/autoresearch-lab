VERDICT: READY

## Blockers

- None.

## Non-blocking

- **Monotonicity claim is under-documented numerically.** The packet states the ECOS $\eta_{\rm floor}=0.8$ result "is consistent with the expected monotone weakening" but does not quote the actual $A_{\min}(-Q^*)$ values for the three ladder points ($\eta_{\rm floor}=0.6, 0.8, 1.0$) side by side with solver status and primal/dual residuals. A small comparison table (even three rows) should be included in the summary bundle so that the monotonicity claim is self-contained and auditable without chasing across multiple run directories. Recommend adding this before any future round promotes the ladder to "evidence."

- **Clarabel negative-result note should include version and platform.** The `failed_approach_v1` entry for v29 should record the exact Clarabel version, Julia/Python wrapper version, and OS/BLAS backend. Clarabel's interior-point numerics are sensitive to BLAS implementation; this metadata is essential for reproducibility and for deciding whether an upstream bug report is warranted.

- **Regularization-bias diagnostic (v30) needs a quantitative threshold.** The packet says the static reg $10^{-6}$ "materially shifts" the objective on the baseline, but does not quote the shift magnitude or the tolerance band that would constitute acceptable agreement. Before running the proposed sweep, define an explicit acceptance criterion (e.g., $|\Delta A_{\min}| / |A_{\min}^{\rm ECOS}| < 0.01$ or similar) so the sweep results can be adjudicated mechanically.

- **Solver-attribute sweep design should be pre-registered.** The proposed ladder (static reg $10^{-12}/10^{-10}/10^{-8}/10^{-7}$, dynamic reg on/off, equilibration/presolve toggles) is reasonable, but the acceptance/rejection logic should be written down as a config or script before running, not decided post hoc. This is standard practice for the project's evidence-first workflow and prevents cherry-picking.

- **ECOS tolerances not cross-checked.** ECOS is being used as the "ground truth" reference solver for the monotonicity ladder. The packet should confirm that ECOS primal/dual residuals and gap are well below the feasibility tolerance used for the Clarabel comparison, and that ECOS's default `feastol`/`abstol`/`reltol` settings are adequate for the problem scale.

## Real-research fit

The overall workflow is sound and well-aligned with evidence-first methodology for a dispersion-coupled SOCP bootstrap:

- Recording Clarabel instability as a structured negative result, rather than silently switching solvers or tuning until something works, is excellent scientific hygiene.
- The monotonicity ladder ($c_{\rm fac} \propto (1+\eta)/2$ relaxation → non-increasing $A_{\min}$) is a clean internal consistency check that should be standard for any future $\eta$-profile variation.
- The decision to quarantine regularization-biased objectives from physics evidence is correct. Premature use of solver-tuned results is a well-known failure mode in computational optimization-based physics analyses.
- The proposed next step (solver-attribute sweep → stable Clarabel settings → minimal $\eta$ scan) is the right order of operations.

One suggestion for the broader research arc: once stable Clarabel settings are identified, it would be valuable to run a dual-solver (ECOS + Clarabel) comparison on the full $\eta$ ladder to establish cross-solver agreement as part of the evidence base, not just as a diagnostic.

## Robustness & safety

- **Single-solver dependence for the ladder.** Currently the monotonicity ladder relies entirely on ECOS. If ECOS has a subtle numerical issue at some $\eta_{\rm floor}$ value (less likely than Clarabel but not impossible), the ladder would be silently corrupted. The proposed Clarabel sweep addresses this, but until it succeeds, the ladder should be labeled "single-solver diagnostic" in any downstream references.
- **No mention of problem scaling.** SOCP solvers are sensitive to constraint/variable scaling. If the Clarabel instability at $\eta_{\rm floor}=0.8$ is driven by poor scaling rather than an intrinsic solver weakness, the sweep may not fix it. Consider also testing with explicit problem rescaling (e.g., Ruiz equilibration applied externally) as a parallel diagnostic.
- **Failure library integration.** The packet mentions failure hook index build and query run passing, which is good. Confirm that the v29 and v30 negative results are queryable by both solver name and $\eta_{\rm floor}$ value, so future runs can automatically check for known failure patterns before launching.

## Specific patch suggestions

1. **Summary bundle table.** Add to the summary bundle a table with columns: `eta_floor | solver | run_tag | status | A_min(-Q*) | primal_res | dual_res | gap | notes`. Populate for v21 (baseline), v28 (ECOS η=0.8), v29 (Clarabel η=0.8), v30 (Clarabel reg diagnostic), and the prior W6-13 ECOS η=1.0 diagnostic. This makes the monotonicity assertion verifiable at a glance.

2. **Acceptance criterion for sweep.** In the sweep config or a companion note, add:
   ```
   acceptance_criteria:
     feasibility_status: ["OPTIMAL", "PRIMAL_INFEASIBLE"]  # not NUMERICAL_ERROR
     baseline_agreement: |A_min - A_min_ecos_baseline| / |A_min_ecos_baseline| < 0.01
     residual_threshold: max(primal_res, dual_res) < 1e-7
   ```

3. **Clarabel version pinning.** In the negative-result note for v29, add fields:
   ```
   clarabel_version: X.Y.Z
   wrapper_version: ...
   blas_backend: ...
   platform: ...
   ```

4. **Pre-sweep sanity check.** Before the Clarabel attribute sweep, run the ECOS $\eta_{\rm floor}=0.6$ baseline again with a tighter tolerance (`feastol=1e-10`) to confirm ECOS convergence is not marginal. If the objective shifts by more than $10^{-6}$ relative, the ECOS reference needs tightening before it can serve as ground truth for the sweep.

5. **Sweep script pre-registration.** Write the sweep as a single config file or script that enumerates all (static_reg, dynamic_reg, equilibration, presolve) combinations, with the acceptance criteria embedded, before executing. Commit this config before running any sweep instances.
