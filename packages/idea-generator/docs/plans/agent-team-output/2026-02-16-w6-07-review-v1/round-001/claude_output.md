VERDICT: NOT_READY

## Blockers

### B1. No auditable numeric residuals are presented in the packet itself

The packet repeatedly references `results.json` files containing per-solve residual margins (CSR/ASR equality residuals, K0 positivity min-margin, SOC coupling min-margin, modulus-cone min-margin), but **none of these numbers are quoted in the review packet**. The reviewer is told "small constraint-margin violations at the ~1e-7–1e-6 level" but is given no table, no histogram, no worst-case breakdown. Without seeing the actual residuals, it is impossible to assess whether the claimed bounds are trustworthy or artifacts of near-infeasible solves.

**Files affected:**
- `idea-runs/projects/pion-gff-bootstrap-positivity-pilot-2026-02-15/runs/2026-02-16-a-bochner-k0-socp-v18-dispersion-grid200-enf200-full-resaudit/results.json` (not excerpted)
- `idea-runs/projects/pion-gff-bootstrap-positivity-pilot-2026-02-15/runs/2026-02-16-a-bochner-k0-socp-v18-dispersion-grid200-enf200-full-resaudit-ecos-smoke-v2/results.json` (not excerpted)

**Next action:** Include a full table (or at minimum the worst-case rows) of residual margins from both Clarabel and ECOS `results.json` files in the packet body, annotated with the solver's reported primal/dual status.

---

### B2. Cross-solver envelope is not quantified — only qualitatively described

The packet says "ECOS returns a higher minimum at the same Q2 mini-set" but gives **no numbers** for the ECOS bounds. The entire point of a cross-solver envelope is to bracket the bound; without the actual Clarabel-vs-ECOS comparison table (at least for the mini-set Q² points), the envelope is not reviewable and cannot be used to define a conservative claim.

**Next action:** Present a side-by-side table: for each Q² probe in the mini-set, the Clarabel bound, the ECOS bound, solver termination status, and the worst residual margin at that probe. State explicitly whether the ECOS run covered the same Q² grid or a strict subset.

---

### B3. The "contiguous positivity endpoint $Q^*$" definition is load-bearing but under-specified

$Q^* = 15.438$ is a headline number. The packet does not define the algorithm for determining $Q^*$ from the discrete Q² grid: is it the largest Q² at which $A_{\min}(-Q^2) > 0$? The largest at which $A_{\min}(-Q^2) > \epsilon$ for some tolerance? Interpolation-based? Since the bound at $Q^*$ is only $0.00728$, the answer is sensitive to the grid spacing and to solver tolerance. The ECOS run, which returns a *higher* minimum, would presumably shift $Q^*$ — is that reported?

**Next action:** Define $Q^*$ precisely in the kernel or config documentation, state the grid spacing near $Q^*$, and report $Q^*$ from both solvers.

---

### B4. ECOS smoke run covers only a "Q2 mini-set" — not the full grid

The cross-solver check is on a strict subset of the Q² probes. This means the cross-solver envelope does not cover the region near $Q^*$ (the most fragile part of the bound) unless the mini-set was specifically chosen to include it. The packet does not state what the mini-set contains.

**Next action:** Either (a) run ECOS on the full Q² grid (or at least a grid that includes the $Q^*$ neighborhood), or (b) explicitly list the mini-set Q² values and justify why the envelope is informative despite incomplete coverage.

---

### B5. Constraint violations flagged but no pass/fail gate implemented

The packet asks "Should we enforce a hard threshold on residual margins?" — meaning **no such gate currently exists**. The audit instrumentation is present but purely informational. A run with margin = −1e-4 (clear infeasibility) would still produce `results.json` and be indistinguishable from a clean run in the current pipeline. This is a reliability gap for any downstream claim.

**Next action:** Implement a configurable pass/fail gate in the Julia kernel (e.g., `--residual-threshold 1e-7`) that writes a top-level `"audit_pass": true/false` field into `results.json` and exits non-zero on failure. Re-run v18 with the gate active.

---

## Non-blocking

### N1. PV integral discretization scheme not documented in the packet

The once-subtracted PV reconstruction formula is stated, but the discretization (quadrature rule, treatment of the principal-value singularity at $x = s_i$, UV tail model and its parameters) is not described here. This is important for reproducibility and for assessing whether the ~1e-7 residuals are dominated by discretization error or solver tolerance.

**File:** `compute/julia/bochner_k0_socp_dispersion_bounds.jl` — the PV kernel construction section should have inline documentation or a companion methods note.

### N2. Failed approaches recorded in JSONL but no structured triage

`failed_approach_v1.jsonl` is mentioned in passing but the packet does not summarize its contents or extract lessons. For the robustness narrative, a one-paragraph digest of why SCS and tight-tolerance ECOS failed would strengthen the case that Clarabel is the preferred solver for a stated reason, not by default.

### N3. The UV tail contribution is not sensitivity-tested

The PV formula includes "an explicit UV tail beyond $s_{\max}$." The packet does not report any variation of $s_{\max}$ or the UV tail ansatz. Even a single alternative $s_{\max}$ (e.g., ×2) would establish whether the bounds are UV-tail-dominated.

### N4. Board-sync and validate artifacts are listed but no pass/fail summary

The hygiene gate section lists file paths but does not state whether all checks passed. A one-line "all green" or a summary of any warnings would be helpful.

---

## Real-research fit

The physics goal — bootstrapping rigorous lower bounds on the pion gravitational form factor $A(t)$ using dispersive sum rules, Bochner positivity of the spectral function, and SOCP optimization — is well-motivated and timely. The approach of combining K0 positivity with dispersion relations to tighten the bound beyond the "Im-only" baseline is sound in principle and the improvement from $Q^* \approx 13.9$ to $Q^* \approx 15.4$ is a meaningful gain.

However, the paper-readiness of the numerical claims depends critically on the blockers above: without quantified cross-solver agreement and explicit residual budgets, an external referee would question whether the bounds are solver artifacts. The gap between the Clarabel and ECOS results (direction: ECOS gives a *higher* minimum, i.e., a *stronger* bound) is actually concerning — in a well-converged problem, both should agree to within solver tolerance, and the fact that they don't suggests either (a) the problem is near the boundary of feasibility for one solver, or (b) the conic reformulation has numerical conditioning issues. This needs to be understood, not just recorded.

---

## Robustness & safety

1. **Normalization of the spectral function:** The packet does not state how ${\rm Im}\,A(x)$ is parameterized or normalized. If it is discretized on a grid with spacing $\Delta x$, there is a factor-of-$\Delta x$ ambiguity in the meaning of the optimization variable. This is a classic source of silent errors in bootstrap codes.

2. **Solver tolerance as systematic uncertainty:** The ~1e-7 margin violations are small compared to the $A_{\min}$ values (~0.007–0.08), but the ratio at $Q^*$ is $\sim 10^{-7}/7 \times 10^{-3} \approx 10^{-4.8}$, which is fine. However, this assessment requires the actual numbers, not the reviewer's back-of-envelope from qualitative statements (see B1).

3. **Grid-200 discretization error:** 200 grid points over the spectral range is a choice. The packet does not report any grid-convergence study (e.g., grid-100 vs grid-200 vs grid-400). This is non-blocking for this round but becomes blocking before any publication claim.

4. **No dual-feasibility check:** SOCP duality gap is reported by solvers, but the packet does not mention whether the dual solution is extracted and used to verify the bound independently (strong duality check). This is standard practice in rigorous optimization-based physics bounds.

---

## Specific patch suggestions

1. **In `bochner_k0_socp_dispersion_bounds.jl`**, add after the solve call:

```julia
# === Residual gate ===
residual_threshold = get(config, "residual_threshold", 1e-7)
audit_pass = (min_margin_k0 >= -residual_threshold) &&
             (min_margin_soc >= -residual_threshold) &&
             (abs(csr_residual) <= residual_threshold) &&
             (abs(asr_residual) <= residual_threshold)
results["audit_pass"] = audit_pass
if !audit_pass
    @warn "Residual gate FAILED" min_margin_k0 min_margin_soc csr_residual asr_residual
    exit(1)  # or configurable soft-fail
end
```

2. **In the review packet / robustness summary**, add a table like:

```markdown
| Q² | Clarabel Amin | ECOS Amin | Δ(%) | worst margin (Clar) | worst margin (ECOS) | status (Clar) | status (ECOS) |
|----|---------------|-----------|------|---------------------|---------------------|---------------|---------------|
| 10 | 0.08065       | ???       | ???  | ???                 | ???                 | OPTIMAL       | ???           |
| Q* | 0.00728       | ???       | ???  | ???                 | ???                 | OPTIMAL       | ???           |
```

3. **In the config JSON** (`compute/a_bochner_k0_socp_config_v2g_dispersion_grid200_enf200_full_resaudit.json`), add:

```json
"residual_threshold": 1e-7,
"audit_gate_enabled": true
```

4. **Define $Q^*$ explicitly** in the robustness summary or in the kernel docstring:

```
Q* := max { Q² in grid : A_min(-Q²) > 0 AND solver status ∈ {OPTIMAL, ALMOST_OPTIMAL} AND all residual margins > -threshold }
```

5. **For the ECOS run**, re-run with the full Q² grid (or at minimum include Q² = 15.0, 15.5, 16.0 to bracket $Q^*$) and default ECOS tolerances (not the 1e-10 that caused blowup).
