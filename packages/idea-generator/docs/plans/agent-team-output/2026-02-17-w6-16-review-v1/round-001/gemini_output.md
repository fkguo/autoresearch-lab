VERDICT: READY

## Blockers
- None.

## Non-blocking
- Regarding Clarabel attributes: To reduce objective bias while maintaining stability, prioritize investigating `iterative_refinement_enable` and `equilibrate_enable`. If 1e-7 regularization is required for convergence but shifts the objective, tightening `tol_gap_abs` and `tol_gap_rel` in conjunction with refinement may help recover the baseline values.
- The fact that dynamic regularization (v34) did not rescue the 1e-8 case suggests the ill-conditioning is structural to the constraint matrix at $\eta_{\rm floor}=0.8$, rather than a transient search-space issue.

## Real-research fit
- This diagnostic sweep is essential for physical claims. In bootstrap positivity studies, bounds often become numerically "stiff" as parameters approach physical or mathematical limits. Ensuring the solver is not introducing a systematic bias through regularization is a prerequisite for any $A_{\rm min}$ publication.

## Robustness & safety
- The use of the $\eta_{\rm floor}=0.6$ baseline (v33 vs v21) as a control for "regularization-induced objective shift" is a high-integrity safety check.
- The documentation of negative results in `neg_results/` ensures the ladder sweep has a clear starting point and avoids redundant "numerical error" cycles.

## Specific patch suggestions
- None.
