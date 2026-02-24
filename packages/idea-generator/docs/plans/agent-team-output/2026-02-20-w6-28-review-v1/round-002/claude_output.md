VERDICT: READY

## Blockers

(none)

## Non-blocking

1. The four budget-component "proxies" are presented as final numbers but the packet does not summarize the derivation method (e.g., which pQCD expression, which $\alpha_s$ value, which scale, which integration range). A one-paragraph derivation summary in the evidence note would make the artifact self-contained for any future reader who doesn't want to re-run the code.

2. Cross-solver spread on $A_{\min}$ at $Q^2=2\,\mathrm{GeV}^2$ is ~10% ($-0.0647$ vs $-0.0590$). This is larger than the $A_{\max}$ spread (~2%). Consider logging solver-internal tolerances and primal-dual gaps in `results.json` so future reviewers can distinguish numerical noise from structural sensitivity.

3. The implied-$f_1$ diagnostic range $[0.017, 0.345]$ is wide. Recording which extremal spectral function saturates each endpoint (min-$f_1$ vs max-$f_1$) would sharpen the next iteration's diagnosis of whether the tension is with the slope input or with the budget itself.

4. The `budget_mode=derived` field in the artifact JSON should ideally carry a `derivation_commit` or `derivation_script` pointer so the artifact is traceable without grepping the repo.

## Real-research fit

This is a well-structured negative-result increment. In real lattice/dispersive research workflows:

- Discovering that a previously hand-tuned tolerance is inconsistent with a derived budget is a genuine and publishable finding. The milestone correctly frames this as "evidence-first."
- The implied-$f_1$ diagnostic is exactly the right follow-up: it quantifies the tension rather than just reporting infeasibility.
- Recording the failure in a machine-queryable JSONL library is good practice and exceeds what most theory groups do.
- The fact that the band *widens* (weakens) relative to W6-26 is scientifically honest and correctly flagged in the manuscript limitations.

One gap: the packet does not discuss whether the "onset-window proxy" (1.13 $m_\pi^2$) is sensitive to the choice of matching scale $s_0$. In real pQCD-dispersive work, this is often the dominant systematic. A brief sensitivity comment would strengthen the evidence note.

## Robustness & safety

- Fail-closed: binding is opt-in via explicit config flag; the tolerance is read from a validated artifact, not from a free parameter in the config. No hidden knob is apparent.
- Two independent solvers (Clarabel, ECOS) cross-validate feasibility/infeasibility status for both the slope-enforced and slope-free cases. Agreement on INFEASIBLE (A) and OPTIMAL (B) across solvers is strong evidence.
- Gates all pass, including the failure-library index build and query, confirming the negative result is machine-indexed.
- The artifact explicitly labels itself as "pQCD-tail budget, not a full OPE budget," which prevents downstream consumers from over-interpreting the tolerance as a complete error budget. This is a good safety annotation.
- No PII, no secrets, no external data dependencies beyond the project's own artifacts.

## Specific patch suggestions

1. **`uv_asr_budget_v1.json`**: Add a `derivation_script` field pointing to the script/notebook that produced the four proxy values, and a `derivation_commit` field with the git SHA. This costs one line and makes the artifact fully traceable.

2. **Evidence note (`2026-02-20-w6-28-uv-asr-budget-binding-rerun-v1.md`)**: Add a subsection "Budget derivation summary" with ~5 lines stating: (a) the pQCD expression used, (b) the $\alpha_s$ and scale choices, (c) the cutoff $s_{\max}$, and (d) whether each proxy is a central value or a conservative upper bound. This is the single most impactful documentation improvement.

3. **`results.json` (v114, v115)**: Include `solver_primal_gap` and `solver_dual_gap` fields so the10% $A_{\min}$ spread can be attributed to numerical tolerance vs. structural sensitivity in future reviews.

4. **`failed_approach_v1.jsonl`** (new entry for slope+binding infeasibility): Confirm the entry includes the implied-$f_1$ range as a structured field (not just prose), so future automated queries can filter on "approaches that failed due to slope-budget tension."

5. **`draft.md`** (manuscript limitations bullet): Consider adding one sentence noting that the onset-window proxy has not yet been varied over $s_0$, flagging it as a known next step. This preempts reviewer questions if the draft is circulated.
