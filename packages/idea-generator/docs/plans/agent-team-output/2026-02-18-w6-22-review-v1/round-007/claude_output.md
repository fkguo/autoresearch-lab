VERDICT: NOT_READY

## Blockers

1. **ECOS `ALMOST_OPTIMAL` status used as headline evidence without documented acceptance policy.**
   The tightened ECOS runs (v89, v91) both return `ALMOST_OPTIMAL`, not `OPTIMAL`. The review packet treats these as equivalent to `OPTIMAL` for cross-solver agreement claims, but there is no written policy in the project (e.g. in the scan summary or the validation config) that defines which solver statuses are acceptable for gate-passing evidence. Without this, the cross-solver gate is under-specified.
   - `idea-runs/projects/pion-gff-bootstrap-positivity-pilot-2026-02-15/evidence/2026-02-18-w6-22-asrband-scan-summary-v1.md` — must document accepted statuses.
   - Validation config JSON `checks` entries — should include a `"accepted_statuses"` field or equivalent.

2. **Cross-solver gate tolerances are not justified.**
   The validation config uses `abs_tolerance: 0.005` and `rel_tolerance: 0.01` but there is no derivation or justification for these thresholds. For the tol=150 slope case, the ECOS–Clarabel delta on $A_{\max}$ is $\sim 1.4 \times 10^{-4}$, well within the gate — but the gate would also pass deltas 30× larger. A gate that cannot fail is not a gate. The tolerances need to be motivated (e.g., fraction of the physical uncertainty band, or fraction of the tail sensitivity spread).
   - Validation config in `idea-generator/docs/reviews/bundles/2026-02-18-w6-22-idea-runs-validate-project-v2.txt` — must include tolerance rationale.

3. **Tail sensitivity is not propagated into the headline bounds.**
   The tail ±20% rescaling gives $\Delta A_{\max} \sim 3{-}6 \times 10^{-3}$, which is comparable to or larger than the ECOS–Clarabel spread. Yet the scan summary and the headline bounds (tol=150 and tol=62 tables) quote single-solver point values without a systematic error bar from the tail. Until the tail uncertainty is folded in (even as a simple envelope), the headline numbers are incomplete.
   - `idea-runs/projects/pion-gff-bootstrap-positivity-pilot-2026-02-15/evidence/2026-02-18-w6-22-asrband-scan-summary-v1.md` — headline bounds must carry a tail-systematic bracket.

4. **No reproducibility artifact for the tightened ECOS runs.**
   Runs v89 and v91 are the load-bearing new evidence. The review packet does not confirm that the solver parameters (`eps_abs`, `eps_rel = 1e-9`) are recorded in the run metadata/config files alongside the results. If these are only set in a REPL session or a transient script flag, the runs are not reproducible.
   - `idea-runs/projects/pion-gff-bootstrap-positivity-pilot-2026-02-15/compute/julia/bochner_k0_socp_dispersion_bounds.jl` — must show how tightened tolerances are selected (CLI flag, config key, etc.) and the run logs/configs for v89, v91 must persist the setting.

## Non-blocking

- The `ALMOST_OPTIMAL` issue may be intrinsic to ECOS at 1e-9 tolerances. If the team adopts Clarabel-primary (reviewer question 2), this becomes moot — but the decision and its rationale should be recorded in the scan summary regardless.
- The implied-$f_1$ cross-check (tol=62, no slope) shows good convergence ($\delta f_1^{\min} \sim 4.4 \times 10^{-5}$). This is a strength of the packet.
- The ±20% tail rescaling range is a reasonable first pass, but a physics-motivated prior (e.g., from pQCD large-$s$ behavior or lattice constraints on the spectral function tail) would strengthen the claim before any citation-level use.

## Real-research fit

The scientific question — mapping UV/ASR uncertainty into bounds on $A^\pi(-Q^*)$ via positivity + dispersion — is well-posed and the SOCP formulation is appropriate. The pilot is at the right stage: the solver-convergence diagnosis is exactly the kind of due diligence needed before quoting numbers. The gap is between "we ran the checks" and "the checks are auditable and the numbers carry proper error budgets."

## Robustness & safety

- The reliance on two second-order cone solvers (ECOS, Clarabel) is good practice. However, the packet does not mention any check of constraint feasibility margins (slack variables) at the optimal point. A near-degenerate feasibility region could make bounds fragile even when the solver reports OPTIMAL.
- Discretization of the dispersive integral (number of nodes, quadrature rule) is not discussed anywhere in the review packet. If the node count is too low, the ASR constraint is only approximately enforced, and the bounds could be artificially loose or tight. This should be documented even if it was checked earlier.
- No mention of dual-variable inspection to confirm which constraints are active at the optimum. This is standard for bootstrap-style problems and would directly answer reviewer question 1 about ASR saturation.

## Specific patch suggestions

1. **Scan summary** (`idea-runs/projects/pion-gff-bootstrap-positivity-pilot-2026-02-15/evidence/2026-02-18-w6-22-asrband-scan-summary-v1.md`):
   Add a section "Systematic uncertainties" with a table: `| source | method | ΔA_max | notes |` covering at minimum: (a) solver spread, (b) tail rescaling, (c) discretization. Quote headline bounds as `A_max ± δ_sys`.

2. **Validation config**:
   Add `"accepted_statuses": ["OPTIMAL"]` (or `["OPTIMAL", "ALMOST_OPTIMAL"]` with written justification) to each check entry. Add a `"tolerance_rationale"` string field.

3. **Solver script** (`bochner_k0_socp_dispersion_bounds.jl`):
   Ensure solver tolerance overrides are exposed as a named keyword/config parameter (not hardcoded), and that the run output directory captures the effective solver settings in a machine-readable `run_meta.json` or equivalent.

4. **Decision record**: Add a short ADR or equivalent note in the evidence directory recording the Clarabel-primary / ECOS-diagnostic decision (if adopted), with the reasoning (ECOS `ALMOST_OPTIMAL` at tight tol, Clarabel `OPTIMAL` throughout).
