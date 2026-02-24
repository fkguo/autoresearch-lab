VERDICT: NOT_READY

## Blockers

1. **Tail-subtraction convention not independently auditable from provided artifacts.**
   The diagnostic note (`evidence/neg_results/2026-02-18-implied-f1-range-qstar-baseline-vs-moml2-v1.txt`) and the implementation (`compute/julia/bochner_k0_socp_dispersion_bounds.jl`) both claim that the $f_1$ objective uses the "same tail-subtraction conventions as the slope constraint (when enabled)." However, the review packet does not include the actual code diff or the explicit formula for the UV-tail constant added to the grid integral. The slope integral

   $$f_1 = \frac{1}{\pi}\int_4^{\Lambda^2} ds\,\frac{\mathrm{Im}\,A(s)}{s^2} + C_{\rm tail}(\Lambda^2)$$

   is sensitive to how $C_{\rm tail}$ is computed. If the tail model differs from the one used in the slope *constraint* formulation of W6-19, the comparison "TMD target lies below $f_1^{\min}$" could be an artifact rather than a physics conclusion. **Minimal action:** Include the explicit tail formula and its numerical value in the diagnostic note (or a code snippet in the review bundle) so that a reviewer can verify $C_{\rm tail}$ is consistent with the W6-19 slope constraint implementation. A 1-line assert checking `f1_grid_min + C_tail == f1_min` from `results.json` would suffice.

2. **No cross-solver sanity check for the $f_1$ objective.**
   W6-19b already demonstrated that a $\pi$-factor tooling bug was present and only caught after a solver-level audit. For the new diagnostic mode (`diagnostics.mode=implied_f1_range`), only ECOS results are reported. Before declaring the implied range robust, at least one independent solver (SCS, Mosek, or Hypatia) should confirm that $f_1^{\min}$ agrees to within solver tolerance. **Minimal action:** Run the v49 config with one alternative solver and record the result in the diagnostic note or a new run (v51). If the alternative solver gives $f_1^{\min}$ differing by more than ~1%, that is a blocker on the "TMD excluded" conclusion.

3. **Dual recomputation check values not shown.**
   The packet states that `results.json` contains "dual recomputation checks" but does not quote them. Dual-objective agreement (primal vs. dual) is the standard certificate for SOCP feasibility/optimality. If the duality gap is large (say > 1% of the objective), the reported $f_1^{\min}$ is unreliable. **Minimal action:** Quote the primal-dual gap for both v49-min and v50-min in the diagnostic note and confirm it is below a stated tolerance (e.g., $10^{-6}$ absolute or $10^{-4}$ relative).

## Non-blocking

- **Grid resolution sensitivity.** Both runs use `grid200`. The review packet does not report a grid-convergence check (e.g., grid100 vs. grid200 vs. grid400) for the $f_1$ objective. This is not blocking because the $f_1$ range is wide enough ($[0.0215, 0.34]$) that moderate grid effects are unlikely to move $f_1^{\min}$ below the TMD target. Nevertheless, a brief grid-doubling test would strengthen the conclusion.

- **Report draft phrasing ("mystery ruled out").** The claim in item (4) that "solver-level mystery" is ruled out is slightly stronger than warranted without the cross-solver check requested above. Suggest softening to "no evidence of solver-level pathology in the ECOS runs" until a second solver confirms.

- **Failure library entry completeness.** The new JSONL entry `tension:low_energy_slope_target_outside_implied_range` should include the numerical values ($f_1^{\min}$, $f_1^{\rm TMD}$, ratio) inline so that future queries can filter on magnitude of tension. Currently the packet does not show the JSONL content.

- **Dashboard rerender evidence.** The bundle file `2026-02-18-w6-20-render-dashboards-v1.txt` is listed but its content is not shown. Minor: confirm the islands dashboard now reflects the W6-20 diagnostic as a distinct island/opportunity.

## Real-research fit

The diagnostic strategy—computing the implied feasible range for a quantity that was previously imposed as a hard constraint—is textbook for diagnosing infeasibility in semi-definite/SOCP bootstrap programs. The finding that the TMD target lies below the feasible minimum is physically interpretable: the current positivity + dispersion + moment constraint stack already demands a steeper low-energy slope than TMD predicts. This is a meaningful negative result that (a) cleanly explains the W6-19 infeasibility, and (b) points to specific constraints (ASR, eta-floor, moment targets) as candidates for relaxation. The approach is well-aligned with the broader pion gravitational form factor bootstrap literature.

## Robustness & safety

- **Normalization / $\pi$-factor risk (HIGH).** Given the W6-19b precedent where a $\pi$-factor bug was present, the absence of an explicit formula display for the $f_1$ objective (grid + tail) is the single largest robustness concern. The factor-of-2 ratio $f_1^{\min}/f_1^{\rm TMD} \approx 1.8$ is close enough that a stray $\pi$ or factor of 2 could flip the conclusion.

- **Solver-dependence risk (MEDIUM).** ECOS is a first-order method with known accuracy limitations for tightly constrained SOCPs. The dual recomputation fields exist but their values are not displayed.

- **Tail model risk (MEDIUM).** The UV tail is parameterized by a `scale_factor` that appears in the one-knob relaxation plan. If the tail constant $C_{\rm tail}$ dominates the grid integral at $s \to \Lambda^2$, the implied $f_1^{\min}$ is effectively a statement about the tail model, not the bootstrap constraints. Quantifying $f_1^{\rm grid\,min}$ vs. $C_{\rm tail}$ (which *are* recorded in `results.json` but not quoted in the packet) would clarify this.

## Specific patch suggestions

1. **`evidence/neg_results/2026-02-18-implied-f1-range-qstar-baseline-vs-moml2-v1.txt`:**
   Add a section "Tail convention audit" containing:
   ```
   C_tail (baseline, min): <value>
   C_tail (baseline, max): <value>
   f1_grid_min (baseline): <value>
   f1_grid_max (baseline): <value>
   Assert: f1_min == f1_grid_min + C_tail (to 1e-10)
   Primal-dual gap (min): <value>
   Primal-dual gap (max): <value>
   ```

2. **`compute/julia/bochner_k0_socp_dispersion_bounds.jl` (diagnostic mode block):**
   Add an assertion or logged check:
   ```julia
   @assert abs(f1_total - (f1_grid + C_tail)) < 1e-10 "Tail addition mismatch"
   ```

3. **New run (v51):** Duplicate v49 config, change `solver` from `ecos` to `scs` (or `mosek` if licensed). Record in a new bundle file `2026-02-18-w6-20-cross-solver-f1-range-v1.txt`.

4. **`artifacts/ideas/failed_approach_v1.jsonl` (new entry):**
   Add numerical fields:
   ```json
   {"f1_min_baseline": 0.02147, "f1_tmd_target": 0.01198, "ratio": 1.79, ...}
   ```

5. **`reports/draft.md` (W6-20 subsection):**
   Replace "solver-level mystery ruled out" with "no evidence of solver-level pathology in ECOS runs; cross-solver confirmation pending."

**Summary of minimal next actions to reach READY:**
- Display primal-dual gaps from `results.json` for v49/v50 min-objective runs.
- Display explicit tail constant $C_{\rm tail}$ and confirm $f_1 = f_1^{\rm grid} + C_{\rm tail}$ numerically.
- Run one cross-solver check (SCS or Mosek) for v49-min and confirm $f_1^{\min}$ agreement.
