VERDICT: NOT_READY

## Blockers

### B1. Missing monotonicity evidence for bounds vs. `c_abs_max`

The packet claims that loosening the coefficient regulator (`c_abs_max` = 20000 → 50000 → 200000) restores feasibility at `scale_factor=1`, and reviewer question 2 explicitly asks whether bounds weaken monotonically as `c_abs_max` grows. However, the review bundle `docs/reviews/bundles/2026-02-16-w6-05-scale1-regulator-scan-summary-v1.txt` is referenced but its contents are not included in the packet. Without the actual numerical table showing bound values at each `c_abs_max`, there is **no reviewable evidence** for the core physics claim. If the bound does *not* weaken monotonically, the LP may be exhibiting numerical artefacts or the regulator is load-bearing in a non-trivial way (i.e., `c_abs_max` is not merely a numerical guard but is driving the physics).

**Next action:** Include the full summary table (bound value at $Q^2 = 10\,m_\pi^2$ as a function of `c_abs_max`) in the review packet and verify monotonicity explicitly. If non-monotonicity is observed, add a diagnostic note to the failure library and flag the result as unreliable.

### B2. No convergence / saturation analysis of the regulator scan

Even if monotonicity holds, the scan covers only three points (20 k, 50 k, 200 k). There is no statement about whether the bound has *converged* (i.e., whether further loosening would continue to change it materially). If the bound is still moving significantly between 50 k and 200 k, then the result at any fixed `c_abs_max` is arbitrary — the "improvement" over `scale_factor ≠ 1` is an artefact of where you stop scanning.

**Next action:** Either (a) add at least one more scan point (e.g., `c_abs_max=500000`) and report the relative change, or (b) fit a simple functional form (e.g., bound vs. 1/`c_abs_max`) and show the asymptotic value. Document this in the report and in the run metadata.

### B3. Conditionality on elastic-window sign input is buried

Reviewer question 3 asks whether the conditionality on $\mathrm{Im}\,A(s) \ge 0$ below KK threshold is explicit enough. From the packet, it appears only in the "updated limitations" subsection of the draft report. For a NOT_FOR_CITATION pilot this matters less externally, but **internally** it is a load-bearing assumption: if the sign input is wrong, the "positive lower bound" claim is vacuous. The dashboards (`islands_dashboard_v1.md`, `opportunities_dashboard_v1.md`) and the opportunity pool JSONL entries should each carry an explicit tag/caveat.

**Next action:** Add a `"conditional_on"` field to every opportunity pool entry and island record that depends on the elastic-window sign assumption. Add a one-line caveat to both dashboard headers.

### B4. DoD items still unchecked — no dual-model convergence

Two DoD items are explicitly unchecked: dual-model review convergence and board/SSOT updates. The dual-model convergence gate is part of the project's own stated methodology (via `review-swarm` / `research-team` skills). Marking the packet READY before this gate fires would violate the project's own process.

**Next action:** Run the dual-model convergence gate (or document a justified skip with a process-deviation note) before resubmitting.

---

## Non-blocking

- **Dashboard enforcement is reasonable but brittle.** Gating on exact filenames (`islands_dashboard_v1.md`) means any future schema bump (`v2`) will require updating `validate_project_artifacts.py`. Consider pattern-matching on `islands_dashboard_v*.md`.
  - File: `idea-runs/scripts/validate_project_artifacts.py`

- **Repro note naming convention uses future dates (2026-02-16).** Presumably synthetic/placeholder dates for the pilot, but if these ever land in a shared repo the timestamps will confuse collaborators. Minor.
  - File: `idea-runs/.../evidence/neg_results/2026-02-16-d0-ir-absolute-matching-infeasible.txt`

- **Draft report section title is informal.** "enforce IR scale_factor=1 via a coefficient-regulator scan" should be title-cased and more descriptive (e.g., "Absolute IR Threshold Matching: Feasibility via Coefficient-Regulator Relaxation").
  - File: `idea-runs/.../reports/draft.md`

- **No explicit solver tolerance / precision metadata in run directories.** The LP solver settings (tolerance, iteration limits) are not mentioned in the packet. For reproducibility, each run's config should record these.

---

## Real-research fit

The overall research direction — enforcing the absolute LO spectral-density shape in the D0 LP and propagating to Bochner/K0 bounds — is physically well-motivated and aligns with the goals stated in the pilot. The move from an ad-hoc `scale_factor` knob to an explicit regulator sensitivity axis is a genuine methodological improvement.

However, the **interpretive risk** is high: if the bound does not converge as `c_abs_max → ∞`, then the "stronger bound" claim is an artefact of the regulator, not a physical result. This is the single most important thing to resolve before the packet can be considered ready.

The elastic-window sign assumption ($\mathrm{Im}\,A(s) \ge 0$ below KK) is standard in the dispersive literature (e.g., Colangelo–Hoferichter–Stoffer) but is not a theorem; it relies on Watson's theorem plus elastic dominance. For the pion-only pilot this is acceptable, but coupled-channel effects would break it — consistent with the project's own scope restriction.

---

## Robustness & safety

- **Regulator as a free parameter is dangerous.** The entire "improvement" claim rests on choosing `c_abs_max = 20000` as the baseline. If this value has no independent justification (e.g., from matching to known form-factor values, or from a stability plateau), the result is effectively tuned. The convergence analysis requested in B2 is the minimal check.

- **No cross-check against known lattice/dispersive results.** The packet does not mention whether the new bound at $Q^2 = 10\,m_\pi^2$ is consistent with, e.g., lattice QCD values for the pion gravitational form factor or the dispersive extraction of Ref. [arXiv:2505.19332]. Even a sanity-check comparison would greatly strengthen confidence.

- **Numerical precision.** LP solvers can produce spurious optima when coefficient bounds are large (200 k). Dual feasibility / reduced-cost checks are not mentioned.

---

## Specific patch suggestions

1. **`docs/reviews/bundles/2026-02-16-w6-05-scale1-regulator-scan-summary-v1.txt`** — Include the full table in the review packet body (or inline it). Format:

   ```
   | c_abs_max | LP status | bound(Q²=10 m_π²) | Δ vs. previous |
   |-----------|-----------|---------------------|----------------|
   |  5000     | infeasible| —                   | —              |
   | 20000     | optimal   | X.XXX               | —              |
   | 50000     | optimal   | Y.YYY               | (Y-X)/X        |
   | 200000    | optimal   | Z.ZZZ               | (Z-Y)/Y        |
   ```

2. **`idea-runs/.../artifacts/opportunities/bootstrap_opportunity_pool_v1.jsonl`** — Add field:
   ```json
   "conditional_on": ["elastic_window_sign_below_KK"]
   ```

3. **`idea-runs/scripts/validate_project_artifacts.py`** — Replace exact filename check with glob:
   ```python
   # Before
   required = "islands_dashboard_v1.md"
   # After
   import glob
   required_pattern = "islands_dashboard_v*.md"
   matches = glob.glob(os.path.join(islands_dir, required_pattern))
   if not matches:
       ...
   ```

4. **`idea-runs/.../reports/draft.md`** — Add a "Sanity checks" paragraph comparing the best bound to at least one external reference (lattice or dispersive).

5. **Run config files** (all `scale1` runs) — Add solver metadata fields:
   ```yaml
   solver:
     name: "HiGHS"  # or whatever is used
     tolerance: 1e-9
     max_iterations: ...
   ```
