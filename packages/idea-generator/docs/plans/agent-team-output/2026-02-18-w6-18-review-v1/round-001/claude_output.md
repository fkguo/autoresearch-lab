VERDICT: READY

## Blockers

None identified. The implementation is faithful to the stated physics goal, the numerical evidence is internally consistent, and the solver regression is handled transparently.

## Non-blocking

1. **Small tightening magnitude warrants caution in claims.**
   The shift from componentwise absolute bands to the SRerr-style $L_2$ SOC constraint produces a relative tightening of $\sim 2.4\%$ on $A_{\min}$ and $\sim 0.07\%$ on $A_{\max}$ at the audit point $Q^*$. This is real and in the correct direction (the $L_2$ ball is strictly contained within the $L_\infty$ hypercube for $N_{\rm mom}>1$), but the effect is modest. The draft report (`idea-runs/projects/pion-gff-bootstrap-positivity-pilot-2026-02-15/reports/draft.md`) should be careful not to over-sell this as a major tightening; framing it as a "hygiene/alignment" step that also demonstrates the infrastructure can absorb richer constraints is more honest.

2. **Clarabel regression root cause is undiagnosed.**
   The failure (`NUMERICAL_ERROR` at feasibility) is recorded in the failure library (`idea-runs/.../artifacts/ideas/failed_approach_v1.jsonl`) and the diagnostic config/run are preserved, which is good practice. However, no triage of *why* Clarabel fails has been done (e.g., is it the SOC cone ordering, a scaling issue in the new $L_2$ auxiliary variables, a Clarabel version regression, or a problem-conditioning issue?). A minimal next action would be to check whether Clarabel succeeds on the *same* baseline (componentwise) config under the refactored code, isolating whether the regression is triggered by the $L_2$ SOC addition or by the code refactor itself. This is non-blocking because ECOS is a credible primary solver, but leaving Clarabel broken without diagnosis risks accumulating technical debt.

3. **SOC scaling convention should be documented more explicitly.**
   The Julia code (`idea-runs/.../compute/julia/bochner_k0_socp_dispersion_bounds.jl`) implements the $L_2$ constraint as a unit-radius scaled SOC $\| \mathbf{r}/\epsilon \|_2 \le 1$ (i.e., introducing auxiliary variables $\tilde{r}_i = r_i/\epsilon_i$ or a single global $\epsilon$). The review packet states "unit-radius scaled SOC constraint" but the exact convention (per-moment $\epsilon_i$ scaling vs. a single $\epsilon$) and whether the $\epsilon$ used matches arXiv:2403.10772's numerical prescription should be stated in a code comment or the report. If the per-moment tolerances $\epsilon_i$ are heterogeneous and the $L_2$ ball uses a single radius $\epsilon = \sqrt{\sum \epsilon_i^2}$, that is geometrically correct but worth making explicit for reproducibility.

4. **Dual residual / certificate auditing.**
   The packet mentions "dual recomputation + residual budgets are recorded" as a condition for proceeding with ECOS. The `results.json` outputs should include solver-reported primal/dual residuals and gap. Spot-check that these are present in the run directories (`idea-runs/.../runs/2026-02-18-a-bochner-k0-socp-v31-.../results.json` and `v32`). If they are not yet machine-parseable fields, adding them is a small but important hygiene item for downstream automated audits.

5. **Opportunity pool card for next tightening.**
   The opportunity pool (`idea-runs/.../artifacts/opportunities/bootstrap_opportunity_pool_v1.jsonl`) should contain a card for the UV/OPE trace-anomaly and low-energy constraint islands. Confirm this is present; if not, adding it ensures the next phase is tracked.

## Real-research fit

**Strong alignment.** The move from componentwise to vector-norm moment constraints is exactly the methodological refinement that distinguishes modern dispersive bootstrap work (arXiv:2403.10772, and earlier work by Colangelo–Hoferichter–Stoffer on $\pi\pi$ scattering) from older sum-rule analyses. Even though the numerical effect at a single $Q^*$ is small, the infrastructure upgrade is load-bearing: once UV/OPE inputs, trace-anomaly constraints, and additional low-energy conditions are layered in, the $L_2$ SOC formulation will compound tightenings in a way that independent bands cannot.

The choice of $Q^* = 15.438\ldots\, m_\pi^2 \approx 0.30\;\text{GeV}^2$ is physically sensible (spacelike, below the $\rho$ region, where the form factor is well-constrained by lattice and ChPT). The fact that $A_{\min}$ moves up and $A_{\max}$ moves down is the expected signature of a tighter feasible set.

**On Reviewer Question 3 (most promising next direction):** The dominant source of the remaining wide interval ($A_{\min}/A_{\max} \sim 60\times$ ratio) is almost certainly the lack of:
- **Low-energy normalisation/slope constraints** ($F_\pi(0) = 1$, charge radius $\langle r^2 \rangle$), which pin the form factor at $Q^2 = 0$.
- **UV/OPE inputs** (leading-twist pQCD scaling, trace-anomaly sum rule), which constrain the large-$s$ tail of the spectral function.
- **Higher positivity kernels** ($k \ge 1$ Bochner conditions), which exclude more of the non-positive spectral functions.

Adding any one of these is likely to shrink the interval by an order of magnitude or more, dwarfing the $L_2$-vs-$L_\infty$ effect. The $L_2$ SOC infrastructure, however, is prerequisite for correctly combining these inputs, so the sequencing is correct.

## Robustness & safety

1. **Normalization / discretization assumptions.**
   - The spectral discretization ($N_{\rm grid}=200$, $N_{\rm enf}=200$) is unchanged between baseline and SRerr runs, so the comparison is apples-to-apples. Good.
   - The $Q^*$ audit point is shared. Good.
   - The moment targets and tolerances come from the same underlying OPE/SVZ input. The only change is the geometric shape of the feasible region (hypercube → ball). This is a clean A/B comparison.

2. **SOC constraint correctness.**
   The standard SOCP representation of $\|\mathbf{x}\|_2 \le t$ is a second-order cone constraint $(t, \mathbf{x}) \in \mathcal{Q}^{n+1}$. The code reportedly scales to unit radius, i.e., $\|(r_1/\epsilon, \ldots, r_N/\epsilon)\|_2 \le 1$, which is equivalent to $\|\mathbf{r}\|_2 \le \epsilon$. This is correct and is the standard encoding in JuMP/MathOptInterface. No concern here.

3. **Solver choice risk.**
   ECOS is a well-tested interior-point solver for SOCPs. It is a reasonable primary. The risk is that ECOS may also encounter numerical issues as the problem grows (more constraints, finer grids). The mitigation (recording residuals, maintaining Clarabel as a cross-check target) is adequate for a pilot.

4. **Failure library hygiene.**
   The Clarabel regression is recorded with a config, run directory, and failure-library entry. The index build and query run verification commands pass. This is good practice for a research pilot.

## Specific patch suggestions

1. **`idea-runs/.../compute/julia/bochner_k0_socp_dispersion_bounds.jl`**: Add a block comment at the SOC constraint construction site explaining the geometric relationship:
   ```julia
   # SRerr-style vector constraint (arXiv:2403.10772):
   #   ||r||_2 ≤ ε   ⟺   ||(r₁/ε, …, rₙ/ε)||_2 ≤ 1
   # where rᵢ = (moment_value_i - target_i).
   # This is strictly tighter than the componentwise |rᵢ| ≤ εᵢ
   # constraint when N_moments > 1, since the L2 ball is inscribed
   # in the L∞ hypercube.
   ```

2. **`idea-runs/.../reports/draft.md`**, Phase N (W6-18) section: Replace any language like "significant tightening" with "modest but correctly-signed tightening ($\sim 2\%$ on $A_{\min}$, $< 0.1\%$ on $A_{\max}$), demonstrating infrastructure readiness for compound constraints."

3. **Clarabel triage (next phase):** Add a one-line task to the opportunity pool or a TODO in the Clarabel diagnostic config:
   ```
   TODO: Re-run Clarabel on the *baseline* (componentwise) config under the refactored code
   to isolate whether the regression is caused by the L2 SOC addition or by the code refactor.
   ```

4. **`results.json` schema:** If not already present, ensure each run's `results.json` includes fields:
   ```json
   {
     "solver_primal_residual": ...,
     "solver_dual_residual": ...,
     "solver_gap": ...,
     "solver_status": "..."
   }
   ```
   This makes downstream automated auditing possible without re-parsing solver logs.

5. **Opportunity pool (`bootstrap_opportunity_pool_v1.jsonl`):** Confirm or add a card with `"id": "low-energy-norm-slope"` and `"id": "uv-ope-trace-anomaly"` as the two highest-priority next tightening islands, with estimated impact annotations (e.g., "expected order-of-magnitude tightening based on analogous $\pi\pi$ bootstrap results").
