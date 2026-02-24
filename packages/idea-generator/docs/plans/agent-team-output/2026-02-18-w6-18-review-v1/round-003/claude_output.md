VERDICT: READY

## Blockers

None identified that would prevent proceeding to the next tightening phase.

## Non-blocking

1. **Small tightening magnitude warrants caution in interpretation.** The SRerr $L_2$ constraint tightens the allowed interval $[A_{\min}, A_{\max}]$ at $Q^*$ by $\sim 0.3\%$ on the lower bound and $\sim 0.07\%$ on the upper bound. This is consistent with the expectation that replacing componentwise $\ell_\infty$-style bands with a joint $\ell_2$-norm ball of the same radius is a *geometric* tightening (the $L_2$ ball is inscribed in the $L_\infty$ box), and the effect is small because only a few moments contribute. The claim of "measurable tightening" is technically correct but should not be over-sold in any draft language; a sentence like "the tightening is modest at the current truncation order and tolerance, consistent with the small number of active moment constraints" would be appropriate.
   - *Files:* `idea-runs/.../evidence/neg_results/2026-02-18-srerr-moment-l2-socp-qstar-v1.txt`, `idea-runs/.../reports/draft.md`

2. **Clarabel regression is recorded but root-cause is undiagnosed.** The failure library entry and diagnostic retest config are present, which is good practice. However, the packet does not contain a hypothesis for *why* the refactor triggers `NUMERICAL_ERROR` in Clarabel (e.g., whether the new SOC row scaling interacts poorly with Clarabel's regularization or whether it is a known upstream issue). A brief root-cause note in the failure library entry would strengthen auditability. This is non-blocking because ECOS results are self-consistent and the Clarabel issue is explicitly deferred.
   - *Files:* `idea-runs/.../artifacts/ideas/failed_approach_v1.jsonl`, `idea-runs/.../runs/2026-02-18-a-bochner-k0-socp-v35-.../`

3. **Unit-radius scaling convention should be documented in code comments.** The SRerr SOC constraint is implemented as a unit-radius scaled cone $\|w/\epsilon\|_2 \le 1$. This is standard, but the mapping from the paper's notation to the code variables (which slack is the epigraph variable, how tolerance $\epsilon$ enters) should have a one-paragraph docstring in `bochner_k0_socp_dispersion_bounds.jl` near the constraint construction, citing arXiv:2403.10772 Eq. reference explicitly. Currently the code change description says "unit-radius scaled SOC constraint" but I cannot verify inline documentation without file access.
   - *Files:* `idea-runs/.../compute/julia/bochner_k0_socp_dispersion_bounds.jl`

4. **Tolerance value provenance.** The packet does not explicitly state what numerical value of $\epsilon$ (the moment tolerance) was used in both the componentwise and $L_2$ runs, nor whether the same $\epsilon$ was used for both. For the comparison to be clean, the componentwise run should use $|w_i| \le \epsilon$ per component and the $L_2$ run should use $\|w\|_2 \le \epsilon$ with the *same* $\epsilon$. If $\epsilon$ differs (e.g., rescaled by $\sqrt{N_{\rm mom}}$), the tightening comparison is confounded. Please confirm in the evidence text or config JSONs that the same tolerance scalar is used.
   - *Files:* configs `..._ecos_baseline_rerun.json`, `..._ecos_moml2_rerun.json`

5. **Opportunity pool / next-step prioritization.** The opportunity dashboard and JSONL pool are updated, which is good. The reviewer notes that the most promising next tightening directions (answering reviewer question 3) are, in rough expected-impact order:
   - **(a)** Additional low-energy constraints (e.g., charge radius / slope from lattice or dispersive analyses) — these pin the spectral function in the region where the current bounds are loosest.
   - **(b)** UV/OPE / trace-anomaly matching — imposes asymptotic decay conditions that are currently absent and should cut the upper bound significantly.
   - **(c)** Higher-order positivity kernels ($k \ge 1$ Bochner) — changes the geometry of the allowed cone.
   - **(d)** More SVZ moments (higher $N_{\rm mom}$) — incremental within the current $L_2$ framework, likely diminishing returns.

   This ordering should be reflected in the opportunity pool priority scores.

## Real-research fit

The SRerr-style vector-norm moment constraint is a faithful and well-motivated translation of modern bootstrap methodology (arXiv:2403.10772) into the SOCP framework. The key physics point — that correlated moment errors are more constraining than independent per-moment bands — is correctly captured by the $L_2$ SOC formulation. The effect is expectedly small at this stage because:

- The number of moment constraints is small (the $L_2$ ball only differs significantly from the $L_\infty$ box when many components are active simultaneously).
- The dominant looseness in the bounds comes from the absence of UV/OPE and low-energy anchoring, not from moment tolerance geometry.

The approach is sound and positions the infrastructure correctly for the next (more impactful) tightening steps.

## Robustness & safety

1. **Solver reliability.** Using ECOS as primary with Clarabel explicitly flagged as regressed is the correct posture. The dual residuals and primal-dual gaps should continue to be recorded in `results.json` for every run. No evidence of ECOS numerical issues is reported.

2. **Discretization sensitivity.** Both runs use `grid200` / `enf200`. The packet does not include a grid-doubling check for the SRerr $L_2$ run (though prior phases may have established grid convergence for the componentwise variant). A single confirmatory run at `grid400` for the $L_2$ case would be prudent before the next phase but is not blocking.

3. **Normalization / scaling assumption.** The $L_2$ SOC constraint requires careful dimensional consistency: if the moment targets $\mu_i$ have different physical dimensions or vastly different magnitudes, an unweighted $L_2$ norm $\|w\|_2$ may not be the most physical choice (a weighted norm $\|D^{-1}w\|_2$ with $D_{ii} = \mu_i$ or $D_{ii} = \sigma_i$ might be more appropriate). The arXiv:2403.10772 paper uses relative errors in `SRerr`. Confirm that the tolerance $\epsilon$ and residual vector $w$ are defined consistently with the reference's normalization convention. This is a **load-bearing assumption** — if the moments span orders of magnitude and the norm is unweighted, the constraint may be dominated by the largest-magnitude moment and effectively unconstrained on the others, partially defeating the purpose. Flag for verification in next phase.

4. **Reproducibility.** Config JSONs, run directories, and machine-checkable validation outputs are all present and cross-referenced. The evidence chain from config → run → results.json → summary text is intact based on the described artifacts.

## Specific patch suggestions

1. **`bochner_k0_socp_dispersion_bounds.jl`**: Add a docstring block at the SOC constraint construction site:
   ```julia
   # SRerr-style L2 moment constraint (arXiv:2403.10772, Eq. XX):
   #   || (mu_computed - mu_target) / epsilon ||_2  ≤  1
   # Implemented as SOC: (t, w/epsilon) ∈ Q^{n+1}, t = 1
   # where w_i = sum_j K_{ij} * rho_j - mu_target_i
   ```
   Adjust to match actual implementation. This makes the physics↔code mapping auditable.

2. **Evidence summary text** (`2026-02-18-srerr-moment-l2-socp-qstar-v1.txt`): Add explicit statement of:
   - The tolerance value $\epsilon$ used in both runs.
   - Whether the residual vector $w$ is absolute or relative (i.e., $(w_i - \mu_i)$ vs $(w_i - \mu_i)/\mu_i$).
   - The number of active moment constraints $N_{\rm mom}$.

3. **Failure library entry** (`failed_approach_v1.jsonl`): Add a `"hypothesis"` field to the Clarabel regression entry, even if speculative (e.g., `"hypothesis": "SOC row scaling may interact with Clarabel's default regularization; upstream issue tracker not yet checked"`).

4. **Opportunity pool** (`bootstrap_opportunity_pool_v1.jsonl`): If not already present, add priority-ordered entries for (a) low-energy anchoring constraints, (b) UV/OPE trace-anomaly matching, with estimated impact annotations (e.g., "expected to dominate current tightening by 1–2 orders of magnitude based on dimensional analysis of missing constraints").

5. **`draft.md`**: In the Phase N (W6-18) section, temper the tightening language: replace any phrasing suggesting the $L_2$ constraint is a major numerical improvement with a statement that it is a **structural/methodological** improvement (correct conic encoding of correlated errors) whose quantitative impact will grow as more moment constraints are added.
