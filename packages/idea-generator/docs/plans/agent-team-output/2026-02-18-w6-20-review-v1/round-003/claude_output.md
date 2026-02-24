VERDICT: READY

## Blockers

None. The Round-002 packet closes the load-bearing concern raised in Round-001 (Opus). The audit bundle now makes the tail handling, the $1/\pi$ normalization, and the primal/dual gaps fully auditable, which was the single blocker from the previous round.

## Non-blocking

1. **Convention cross-check still deferred.** The packet correctly flags that $f_1^{\rm TMD} \approx 0.01198$ lies below $f_1^{\rm min}$ by $\sim 0.0095$–$0.0097$, but does not yet contain an independent rederivation of the mapping from $\langle r^2 \rangle$ (or the TMD moment) to the dispersion-integral definition of $f_1$. The risk of a residual normalization mismatch (e.g., a factor-of-2 from $F_\pi$ vs $F_\pi^2$ conventions, or an $s_0$ vs $4m_\pi^2$ threshold subtlety) is not large, but at $f_1^{\rm min}/f_1^{\rm TMD} \approx 1.8$ it is not negligible either. Recommend a one-page convention audit as a Phase-O item.
   - Relevant file: `idea-runs/projects/pion-gff-bootstrap-positivity-pilot-2026-02-15/evidence/neg_results/2026-02-18-implied-f1-range-qstar-baseline-vs-moml2-v1.txt` (where $f_1^{\rm TMD}$ is quoted but not derived).

2. **Solver cross-check.** All runs use ECOS. The primal/dual gaps are excellent ($\mathcal{O}(10^{-10})$), but a single independent solver (e.g., SCS or Clarabel) confirmation of the min/max bounds would harden the result against ECOS-specific feasibility tolerance artifacts. Not a blocker because the gaps are clean and the grid/tail decomposition is now transparent.

3. **Tail fraction quantification.** The audit bundle quotes $I_{\rm slope\,tail}/\pi \approx -3.1 \times 10^{-5}$, which is indeed small relative to the grid part ($f_{1,\rm grid}^{\rm min} \sim 0.021$). Consider adding the ratio $|I_{\rm slope\,tail}/\pi| / f_{1,\rm grid}^{\rm min} \approx 0.14\%$ explicitly in the audit note to make "small" quantitative at a glance.
   - Relevant file: `docs/reviews/bundles/2026-02-18-w6-20-implied-f1-audit-v1.txt`.

4. **Failure-library entry completeness.** The new `tension:low_energy_slope_target_outside_implied_range` entry in `failed_approach_v1.jsonl` should cross-reference the audit bundle path so future queries retrieve the full evidence chain. Currently the failure hook index build and query logs (`docs/reviews/bundles/2026-02-18-w6-20-failure-library-*-v1.txt`) confirm the entry exists but I cannot verify the cross-reference field without file access.

## Real-research fit

**Strong.** This is exactly the kind of necessary-condition diagnostic that a positivity-bootstrap pilot should produce before investing in more expensive relaxation sweeps. The result—$f_1^{\rm TMD}$ is excluded by the implied feasible range under baseline + SRerr-L2 moment stacks—is a clean, falsifiable negative finding. The fact that it retroactively explains the W6-19b sweep behavior ($\Delta f_1 = 0.01$ restoring feasibility ≈ the computed gap) is a strong internal consistency check. The implied-$f_1$ diagnostic adds genuine scientific value: it converts a "no feasible solution found" numerical output into a quantitative physics statement about the tension between the dispersive constraints and the TMD slope target.

## Robustness & safety

- **$1/\pi$ normalization:** Now auditable. The audit bundle quotes the defining code lines and shows the tail is added as $I_{\rm slope\,tail}/\pi$, matching the dispersion-relation definition. The earlier W6-19b $\pi$-factor bugfix history motivated this audit, and the chain is now closed.
  - Evidence: `docs/reviews/bundles/2026-02-18-w6-20-implied-f1-audit-v1.txt`.

- **Primal/dual gaps:** $\mathcal{O}(10^{-10})$ for all four solves (min/max × v49/v50). This rules out weak-feasibility or near-infeasibility artifacts driving the bounds.
  - Evidence: same audit bundle, extracting `objective_value` and `dual_objective_value` from `results.json` for runs v49 and v50.

- **Load-bearing assumption — grid discretization:** The grid200 discretization with $s_{\rm max}$ cutoff plus analytic tail is standard for this stack. The tail contribution being $\sim 0.1\%$ of the bound means the result is not sensitive to the UV model. No concern here.

- **Load-bearing assumption — $Q^*$ choice:** The diagnostic is evaluated at a single $Q^* = 15.438\,m_\pi^2$. The implied range could widen or narrow at other $Q^*$ values. This is acknowledged implicitly (configs are single-point) but a $Q^*$ sweep of the implied-$f_1$ diagnostic would strengthen the claim. Not a blocker for readiness of this specific result.

- **Gate checks:** All five validation gates (idea-generator, idea-runs, validate-project, failure-library index+query, dashboards) report PASS per the listed bundle files in `docs/reviews/bundles/`.

## Specific patch suggestions

1. **`docs/reviews/bundles/2026-02-18-w6-20-implied-f1-audit-v1.txt`:** Add an explicit line:
   ```
   Tail fraction: |I_slope_tail/π| / f1_grid_min = 3.1e-5 / 0.0214 ≈ 0.14%
   ```
   to make the "tail is small" claim immediately verifiable without mental arithmetic.

2. **`idea-runs/projects/.../artifacts/ideas/failed_approach_v1.jsonl`** (entry `tension:low_energy_slope_target_outside_implied_range`): Ensure the JSON entry includes a field like:
   ```json
   "audit_bundle": "docs/reviews/bundles/2026-02-18-w6-20-implied-f1-audit-v1.txt"
   ```
   so the failure-library query tool returns the full evidence chain.

3. **`idea-runs/projects/.../reports/draft.md`** (W6-20 limitation bullet): Consider adding a parenthetical noting that the $f_1^{\rm min}/f_1^{\rm TMD} \approx 1.8$ ratio, while large enough to be confident the exclusion is real, is small enough that a convention error (e.g., factor of 2) could in principle flip the conclusion. This makes the "next step: convention audit" recommendation self-motivating for the reader.

4. **`idea-runs/projects/.../compute/julia/bochner_k0_socp_dispersion_bounds.jl`** (diagnostics mode): In the `implied_f1_range` diagnostic output block, consider emitting `tail_contribution_over_pi` as a separate field in `results.diagnostics_f1_range` so downstream consumers don't need to recompute $I_{\rm slope\,tail}/\pi$ from raw fields.

---

**Answer to reviewer question 2 (sharpest next one-knob relaxation):** Relax the $f_2(1270)$ mass to a ±Γ window (i.e., replace the strict-$m_{f_2}$ delta-function resonance constraint with a Breit-Wigner smeared over $[m_{f_2}-\Gamma/2,\, m_{f_2}+\Gamma/2]$). This is a single-parameter relaxation (width of the smearing window) that directly tests whether the $f_1^{\rm min}$ floor is driven by the rigid resonance-position assumption.

**Answer to reviewer question 3:** Treat it as "physics tension under current assumptions" for now, but schedule the convention audit (non-blocking item 1 above) as the *first* Phase-O task before investing in further relaxation sweeps. The $1.8\times$ ratio makes a pure convention error unlikely but not impossible.
