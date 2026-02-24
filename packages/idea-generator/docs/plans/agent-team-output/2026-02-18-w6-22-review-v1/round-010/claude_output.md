VERDICT: NOT_READY

## Blockers

1. **Tail-envelope numerical values missing.** Paths for v92 (tail=0.8) and v93 (tail=1.2) are cited but no $A_{\max}$ values or deltas relative to the baseline v82 (tail=1.0) are reported. Without these numbers, the tail systematic is unquantified and the claimed "tail envelope" is an assertion, not evidence.
   - Files: `idea-runs/projects/pion-gff-bootstrap-positivity-pilot-2026-02-15/runs/2026-02-18-a-bochner-k0-socp-v92-.../results.json`, `...v93-.../results.json`
   - **Next action:** Extract $A_{\max}$ from v92 and v93 `results.json`, report absolute and relative shifts vs v82, and state whether the tail variation is sub-dominant to the s-grid/ansatz systematic (~few $\times 10^{-3}$) or comparable/larger.

2. **Cross-solver gate tol_ASR=62 $\Delta A_{\max}$ is within 5% of the gate threshold.** The reported $\Delta A_{\max} \approx 3.81 \times 10^{-3}$ against a gate of abs ≤ 0.004 leaves a margin of only $\sim 0.19 \times 10^{-3}$. This is uncomfortably tight and raises the question of whether the gate tolerance was tuned post-hoc to accommodate the observed delta. No justification for the choice of (abs ≤ 0.004, rel ≤ 0.005) is provided.
   - File: `idea-runs/projects/pion-gff-bootstrap-positivity-pilot-2026-02-15/pipeline/cross_solver_check_v1.json`
   - **Next action:** Either (a) provide a physics-motivated or solver-precision-motivated derivation of the gate thresholds that is independent of the observed deltas, or (b) acknowledge the tight margin explicitly in the pilot text and flag it as a known limitation requiring tighter agreement at production level (e.g., with poly24 cross-solver comparison, which should yield much smaller deltas given the tol_ASR=150 result).

3. **No poly24 cross-solver comparison.** The cross-solver gate is run only at poly18. Since the paper's final claim will rest on the poly24 ansatz (which is what restores feasibility at grid250), the gate must also pass for poly24 to be credible even at pilot level. The tol_ASR=150 gate passes easily, but that is a different operating point.
   - **Next action:** Run the cross-solver gate (ECOS vs Clarabel) for at least one poly24 configuration (e.g., grid200-poly24 at tol_ASR=62) and report deltas.

## Non-blocking

- **b-grid stability (v95) is referenced but not shown in this packet.** The review packet says "b-grid discretization is stable (v95)" without citing the v95 path or any numerical evidence. For completeness, include the v95 artifact path and the relevant delta. Not a blocker because the s-grid story is the load-bearing one, but it should appear in the final packet.
- **Monotonicity of the poly24 s-grid sequence is suggestive but not conclusive.** v98 (grid200) → v97 (grid250) shows a +$4.18 \times 10^{-4}$ upward shift. A single additional grid point (e.g., grid300-poly24) would strengthen the convergence narrative. Not required for pilot, but worth flagging for the follow-up.
- **ECOS run versions (v76, v89) are not path-cited in this packet.** The Clarabel runs have full paths; the ECOS counterparts do not. Include them for auditability.

## Real-research fit

The overall structure — Bochner positivity bootstrap for the pion gravitational form factor, SOCP formulation, dispersion-relation constraints with ASR tolerance — is a legitimate and timely pilot study. The sensitivity analysis (s-grid × ansatz, b-grid, tail, cross-solver) covers the right axes. The claim level ("pilot") is appropriately scoped. The main risk is that the cross-solver gate at the working operating point (poly18, tol_ASR=62) is marginal, which could undermine confidence if a referee probes it.

## Robustness & safety

- **s-grid discretization:** The poly18 → INFEASIBLE at grid250 is a genuine and important finding. The recovery via poly24 with a quantified few-$10^{-3}$ shift is the right response. The residual concern is that the shift direction is monotonically upward (v82 → v98 → v97), suggesting the bound has not yet converged from above. This must be stated as a systematic uncertainty, not swept under "stable."
- **Cross-solver agreement:** The tol_ASR=150 gate is clean ($\mathcal{O}(10^{-4})$ deltas). The tol_ASR=62 gate is marginal. This asymmetry suggests the tol_ASR=62 operating point is solver-sensitive, which is physically meaningful (tighter ASR tolerance → more constrained problem → solver differences matter more). The pilot text should discuss this.
- **Tail envelope:** Cannot assess without the missing numbers (Blocker 1).
- **Normalization:** The packet does not discuss how $A_{\max}$ is normalized or whether the SOCP objective is scale-invariant. If the bound depends on an input normalization (e.g., $F_\pi(0)=1$), this should be stated explicitly.

## Specific patch suggestions

1. **In the tail-envelope section of the review packet**, add after the v92/v93 paths:
   ```
   - v92 (tail=0.8): A_max ≈ <value>  (Δ ≈ <value> vs v82)
   - v93 (tail=1.2): A_max ≈ <value>  (Δ ≈ <value> vs v82)
   Tail variation is [sub-dominant to / comparable to] the s-grid/ansatz systematic.
   ```

2. **In the cross-solver gate section**, add a justification block:
   ```
   Gate threshold rationale: abs ≤ 0.004 chosen because [solver precision argument /
   physics-scale argument]. Margin at tol_ASR=62: ~5%. This is acknowledged as tight
   and motivates poly24 cross-solver validation in the next round.
   ```

3. **Add a poly24 cross-solver run** (even a single one) and append its delta to the gate section:
   ```
   3) tol_ASR=62 endpoint (ECOS vXX vs Clarabel v98, poly24):- ΔA_min ≈ ...
      - ΔA_max ≈ ... (rel ≈ ...)
      - PASS/FAIL under (abs≤0.004, rel≤0.005)
   ```

4. **In the conclusion**, replace "b-grid discretization is stable (v95)" with the explicit path and delta, or at minimum a forward reference:
   ```
   b-grid stability: v95 (path: <full path>) shows Δ ≈ <value> vs v82,
   confirming sub-10^{-4} sensitivity.
   ```
