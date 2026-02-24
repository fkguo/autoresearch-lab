VERDICT: READY

## Blockers

- None.

## Non-blocking

- **Monotonicity violation is the elephant in the room.** The fact that $A_{\min}(-Q^*)$ at $\eta_{\rm floor}=1$ exceeds the $\eta_{\rm floor}=0.6$ baseline is a serious diagnostic red flag. The $\eta_{\rm floor}=1$ constraint set should be a strict relaxation of $\eta_{\rm floor}=0.6$ (fewer constraints ⇒ smaller or equal minimum), so any reversal signals either (a) the two conic programs are not nested as assumed (bridge/grid differences, normalization, or enforcement-point mismatch), (b) solver-tolerance artifacts where Clarabel's regularized solution sits in a slightly different part of the feasible set than ECOS's solution at the tighter $\eta$ profile, or (c) a bug in how $\eta_{\rm floor}$ enters the constraint matrix. The decision to treat v27 values as diagnostic-only until this is audited is correct and necessary.

- **Regularization constant choice is ad hoc.** `static_regularization_constant=1e-6` with `dynamic_regularization_enable=false` resolved the `NUMERICAL_ERROR`, but without a scan over regularization values (e.g., $10^{-8}, 10^{-7}, 10^{-6}, 10^{-5}$) it is unclear whether the objective is sensitive to this parameter. If the objective moves meaningfully with the regularization constant, that is itself evidence of ill-conditioning rather than a trustworthy optimum. Recommend adding a brief regularization-sensitivity scan alongside the $\eta_{\rm floor}$ ladder.

- **Cross-solver envelope definition should be written down explicitly.** The phrase "min across solvers" as the conservative bound is good practice, but the envelope logic (which solver results are included, at which tolerances, and whether regularized Clarabel runs are admitted) should be documented as a formal protocol before it feeds into any physics claim.

- **Feasibility vs. optimality tolerance alignment.** Clarabel and ECOS may use different default feasibility/optimality tolerances. When comparing objective values across solvers for the monotonicity audit, ensure both are run at matched tolerance levels (e.g., both at `eps_abs = eps_rel = 1e-8`) so that any residual gap is not a tolerance artifact.

## Real-research fit

The workflow is sound for a bootstrap-positivity pilot study. Recording solver-tuning results as diagnostic artifacts (not physics conclusions) while flagging the monotonicity anomaly for a dedicated audit is exactly the right epistemic discipline. The proposed $\eta_{\rm floor}$ ladder scan at fixed $Q^*$ will directly test whether the constraint hierarchy is properly nested and whether solver objectives respect the expected monotonicity—this is the minimal next experiment needed before any objective value can be promoted to evidence status.

## Robustness & safety

- The conservative-envelope approach (taking the min across solvers) is a good safety net against individual solver artifacts, but it only works if at least one solver is returning a trustworthy value. The monotonicity violation suggests we cannot yet confirm that *any* solver's $\eta_{\rm floor}=1$ result is trustworthy, which is correctly acknowledged.
- Disabling dynamic regularization while adding static regularization changes the solver's internal preconditioning in a way that could shift the effective feasible region. This is fine for a diagnostic run but should not be treated as a "production" solver configuration without further validation.
- No risk of overclaiming: the packet explicitly demotes v27 results to diagnostic status. This is the correct posture.

## Specific patch suggestions

1. **Add a regularization sensitivity scan** to the monotonicity audit plan: run Clarabel at $\eta_{\rm floor}=1$ with `static_regularization_constant` ∈ {1e-8, 1e-7, 1e-6, 1e-5, 1e-4} and check whether $A_{\min}$ is stable to ≤ 0.1% variation. If it is not, report the spread as a systematic uncertainty on the Clarabel result.

2. **Match solver tolerances explicitly** in the $\eta_{\rm floor}$ ladder comparison. Add to the config or run script a comment/assertion that both ECOS and Clarabel are called with identical `eps_abs`, `eps_rel`, `max_iter` so that the monotonicity test is apples-to-apples.

3. **Log the constraint-matrix dimensions and hash** for each $\eta_{\rm floor}$ value in the ladder. This is the fastest way to confirm that the programs are properly nested (the $\eta_{\rm floor}=1$ program should have fewer or equal rows than $\eta_{\rm floor}=0.6$ if they share the same grid/bridge).

4. **Document the cross-solver envelope protocol** as a short Markdown file (e.g., `docs/protocols/cross-solver-envelope.md`) specifying: which solvers are included, admission criteria for regularized runs, how ties/anomalies are handled, and the tolerance floor below which results are flagged as unreliable.

5. **In the summary bundle**, add a one-line "monotonicity expectation" statement (e.g., "$A_{\min}(\eta_{\rm floor}=1) \leq A_{\min}(\eta_{\rm floor}=0.6)$ expected; VIOLATED by +X%") so that future readers immediately see the anomaly without having to reconstruct it from the raw numbers.
