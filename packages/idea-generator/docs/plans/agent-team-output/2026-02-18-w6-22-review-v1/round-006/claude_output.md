VERDICT: NOT_READY

## Blockers

1. **Cross-solver delta on implied-$f_1^{\min}$ exceeds proposed gate.**
   The ECOS→Clarabel shift on $f_1^{\min}$ at tol=62 is $|0.0118077 - 0.0113709| = 4.4 \times 10^{-4}$, which is small in absolute terms but represents a ~3.7% relative shift on a quantity that is itself a key derived observable. More critically, the $f_1^{\max}$ delta is $|0.344366 - 0.341370| = 3.0 \times 10^{-3}$, which is right at the edge of the proposed $5 \times 10^{-3}$ gate. No convergence-tightening run (e.g., increasing solver iterations, reducing feasibility tolerances) has been presented to determine whether these deltas are solver-precision artifacts or genuine feasible-set differences. Without this, the gate threshold is not empirically justified.
   - Evidence: scan summary `idea-runs/projects/pion-gff-bootstrap-positivity-pilot-2026-02-15/evidence/2026-02-18-w6-22-asrband-scan-summary-v1.md`, implied-$f_1$ table.

2. **ASR saturation story is now contradicted and unresolved.**
   At tol=150, Clarabel (v83) saturates the ASR constraint at $A_{\max}$ (residual = 150.000) while ECOS (v80) does not (residual = 143.775). The Round-005 narrative that "ASR becomes inactive beyond tol~143" was load-bearing for the interpretation of the plateau region. That claim is now solver-dependent and no updated interpretation or corrected narrative exists in the scan summary. This is a scientific-content blocker: the paper/note cannot state a saturation threshold without qualifying it per solver, or demonstrating convergence to a single answer.
   - Evidence: slope-tightened $A^\pi(-Q^*)$ table above; compare with Round-005 plateau discussion.

3. **No Clarabel run at tol=62 with slope constraint for $A^\pi(-Q^*)$.**
   The tail-sensitivity bracket (v85/v76/v86) is ECOS-only. Given that the cross-solver delta is comparable in magnitude to the tail-sensitivity envelope ($\Delta A_{\max} \sim 3.2 \times 10^{-3}$ from tail vs. a few $\times 10^{-3}$ from solver), the tail-sensitivity study is incomplete without a matching Clarabel run at the same point. You cannot claim the tail model is the dominant systematic when the solver systematic is the same size and has not been independently bounded at the same operating point.
   - Evidence: tail-sensitivity table (ECOS only, tol=62); no corresponding Clarabel entries in `pipeline/cross_solver_check_v1.json` at tol=62 with slope+tail variation.

4. **Cross-solver gate schema not shown to enforce the new tol=150 check.**
   The review packet states `cross_solver_check_v1.json` "now contains checks for tol=62 and tol=150," but no excerpt of the JSON or schema is provided, and no CI/validation log output is included demonstrating that `validate_project_artifacts.py` actually runs and passes (or fails) against the new entries. The gate is unauditable.
   - Evidence: `idea-runs/projects/pion-gff-bootstrap-positivity-pilot-2026-02-15/pipeline/cross_solver_check_v1.json` (contents not shown); `idea-runs/scripts/validate_project_artifacts.py` (output not shown).

## Non-blocking

- The proposed switch to "Clarabel-primary" (reviewer question 1) is reasonable in principle—Clarabel is an interior-point solver with more modern numerics—but should be justified by a convergence study (tighten solver tolerances on both solvers and show the deltas shrink), not by a single-point comparison.
- The scan summary note path is long and nested; consider a stable symlink or short alias for citation in the eventual paper draft.
- Tail scale factors of ±20% are a useful first bracket but the choice of 0.8/1.2 is not motivated from physics (e.g., from known asymptotic behavior uncertainties). A brief justification sentence in the note would strengthen it.

## Real-research fit

The scientific question—bounding the pion gravitational form factor $A^\pi(-Q^2)$ using dispersive positivity + soft ASR constraints—is well-posed and timely. The pilot-stage framing is appropriate. However, the current numerical evidence is not yet at the level where one can cleanly separate physical sensitivity (tail model, moment inputs) from numerical systematics (solver choice, tolerance settings). This separation is the prerequisite for any publishable claim, and the round-007 additions expose the problem rather than resolve it.

## Robustness & safety

- **Normalization/discretization:** The ASR residual is reported to six significant figures (e.g., 62.0000, 143.775). Confirm that the constraint is implemented as a true inequality $|\cdot| \le \text{tol}$ and not an equality or penalty term, since the saturation behavior is now a key observable. A unit test or assertion in the Julia code that checks the constraint type would be valuable.
- **Solver default tolerances:** Neither ECOS nor Clarabel default feasibility/optimality tolerances are reported. These are load-bearing: the entire cross-solver comparison is uninterpretable without knowing whether both solvers were run at comparable precision settings. Check `bochner_k0_socp_dispersion_bounds.jl` for explicit solver option settings and report them in the scan summary.
- **Floating-point determinism:** Clarabel and ECOS use different internal representations (Clarabel is native Julia; ECOS is C with Julia wrapper). Confirm that the problem data (matrices, vectors) passed to each solver are bitwise identical by logging a checksum.

## Specific patch suggestions

1. **`bochner_k0_socp_dispersion_bounds.jl`**: Add explicit solver tolerance settings and log them to the run metadata:
```julia
# After solver instantiation, before solve:
set_optimizer_attribute(model, "feastol", 1e-9)  # or equivalent per solver
@info "Solver tolerances" feastol=optimizer_get_attribute(model, "feastol")
```

2. **`pipeline/cross_solver_check_v1.json`**: Add a tol=62, slope=true, solver=Clarabel entry to close blocker 3. Minimally:
```json
{"tol_ASR": 62, "slope": true, "solver": "Clarabel", "baseline_solver": "ECOS", "abs_gate": 5e-3, "status": "pending"}
```

3. **`evidence/2026-02-18-w6-22-asrband-scan-summary-v1.md`**: Remove or qualify the "ASR inactive beyond tol~143" claim. Replace with a solver-conditional statement and flag the discrepancy as an open item.

4. **`scripts/validate_project_artifacts.py`**: Add a CI-style `--dry-run` or `--verbose` mode that prints pass/fail per gate entry, and include the output log in the next review packet to close blocker 4.

**Minimal next actions to clear blockers:**
- Run Clarabel at tol=62 with slope constraint + tail baseline (closes blocker 3).
- Run both solvers at tightened internal tolerances (e.g., feastol=1e-10) at tol=62 and tol=150 to determine whether cross-solver deltas shrink (closes blockers 1 and 2).
- Include `cross_solver_check_v1.json` contents and `validate_project_artifacts.py` output in the next packet (closes blocker 4).
