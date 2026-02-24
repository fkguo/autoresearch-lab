VERDICT: NOT_READY

## Blockers

1. **Tail-envelope run artifacts not cited with concrete file paths.**
   The review packet references runs v92 and v93 (tail scale_factor 0.8 and 1.2) but does not provide the file paths to their raw output logs or result files under `idea-runs/projects/pion-gff-bootstrap-positivity-pilot-2026-02-15/evidence/`. Without these, the tail-systematic envelope cannot be independently audited. The baseline v82 path is inferrable from the scan summary, but v92/v93 are not traceable.
   - *Next action:* Add explicit relative paths for v92 and v93 run logs/results to the scan summary at `idea-runs/projects/pion-gff-bootstrap-positivity-pilot-2026-02-15/evidence/2026-02-18-w6-22-asrband-scan-summary-v1.md`.

2. **No discretization-sensitivity evidence at the tightened endpoint (tol_ASR=62).**
   The gate tolerances are justified against the tail systematic (ΔA_max ≈ 3.2e-3), but there is no evidence that the SDP discretization grid is fine enough that discretization error is subdominant to both the solver delta and the tail systematic at tol=62. This is a load-bearing assumption: if discretization error is O(3e-3) or larger, the quoted envelope is unreliable and the tolerance justification collapses.
   - *Next action:* Run (or cite an existing run of) a discretization refinement check (e.g., double the number of grid points) at tol_ASR=62 with Clarabel, and show the bound shift is ≪ 3.2e-3. Add the result to the evidence directory and reference it in the scan summary.

3. **`accepted_statuses` policy for tol=150 is not enforced per-solver in the schema.**
   The JSON gate config (`pipeline/cross_solver_check_v1.json`) applies `accepted_statuses` per-check, not per-solver. The review text says tol=150 allows ECOS `ALMOST_OPTIMAL` while requiring Clarabel `OPTIMAL`, but the schema (`idea-runs/schemas/cross_solver_check_v1.schema.json`) and the check entry have a single `accepted_statuses` array that would accept `ALMOST_OPTIMAL` from *either* solver. This means the stated policy (Clarabel-primary must be `OPTIMAL`) is not actually machine-enforced.
   - *Next action:* Either (a) restructure the check entry to have per-solver status requirements (e.g., `"solver_statuses": {"clarabel": ["OPTIMAL"], "ecos": ["OPTIMAL","ALMOST_OPTIMAL"]}`), update the schema accordingly, and re-run `validate_project_artifacts.py`; or (b) split the tol=150 check into two separate per-solver checks with distinct `accepted_statuses`.

## Non-blocking

- The headline bound is quoted to 7 significant figures (e.g., 0.8306845). Given the tail envelope width of ~6e-3 and solver deltas of O(1e-3), reporting beyond 3–4 significant figures is misleading. Consider rounding to 4 sig figs in the scan summary (`idea-runs/projects/pion-gff-bootstrap-positivity-pilot-2026-02-15/evidence/2026-02-18-w6-22-asrband-scan-summary-v1.md`).
- The slope input uncertainty ($f_1 = 0.01198 \pm 0.001$) is not propagated into the headline envelope. At pilot level this is acceptable, but it should be flagged as a known omission before any publication-level claim.
- The validate-project log (`idea-generator/docs/reviews/bundles/2026-02-18-w6-22-idea-runs-validate-project-v3.txt`) is cited but its contents are not excerpted. Including the final PASS/FAIL line and the checked artifact list in the scan summary would improve auditability without requiring reviewers to open a separate file.

## Real-research fit

The pilot is addressing a well-defined question (positivity bounds on the pion gravitational form factor via dispersive bootstrap + SDP), and the methodology — cross-solver validation, tail-systematic propagation, machine-checkable gates — is appropriate for a reproducible computational physics result. The remaining gaps (discretization sensitivity, per-solver status enforcement) are standard due-diligence items, not conceptual problems.

## Robustness & safety

- **Normalization:** The tail scaling prescription (uniform multiplicative factor on the spectral tail) is the simplest possible model. It does not capture shape uncertainties. Acceptable at pilot level, but should be upgraded before a publication claim.
- **Discretization:** As noted in Blocker 2, this is currently unquantified at the tightened endpoint. This is the single largest robustness gap.
- **Solver trust:** Allowing `ALMOST_OPTIMAL` from ECOS at tol=150 is reasonable, but the lack of per-solver enforcement (Blocker 3) means the gate is weaker than advertised.
- **Load-bearing assumption:** The tolerance justification ("solver deltas must be subdominant to tail systematic") is circular if discretization error inflates the solver delta. The chain of dominance must be: discretization ≪ solver delta ≪ tail systematic. Only the last inequality is currently demonstrated.

## Specific patch suggestions

1. `pipeline/cross_solver_check_v1.json` — replace the tol=150 check entry:
```json
{
  "check_id": "w6-22-asrband-slope-qstar-tol150-ecos-vs-clarabel",
  "abs_tolerance": 0.004,
  "rel_tolerance": 0.005,
  "solver_accepted_statuses": {
    "clarabel": ["OPTIMAL"],
    "ecos": ["OPTIMAL", "ALMOST_OPTIMAL"]
  }
}
```
Update `idea-runs/schemas/cross_solver_check_v1.schema.json` to accept either the flat `accepted_statuses` array or the per-solver `solver_accepted_statuses` object, and update `idea-runs/scripts/validate_project_artifacts.py` to enforce the per-solver variant when present.

2. `idea-runs/projects/pion-gff-bootstrap-positivity-pilot-2026-02-15/evidence/2026-02-18-w6-22-asrband-scan-summary-v1.md` — add a section citing v92/v93 paths explicitly, e.g.:
```
## Tail-envelope runs
- scale_factor=0.8: evidence/runs/v92/result.json
- scale_factor=1.0: evidence/runs/v82/result.json (baseline)
- scale_factor=1.2: evidence/runs/v93/result.json
```

3. Same scan summary file — add a discretization-sensitivity subsection once the refinement run is complete, citing the run path and the observed bound shift.
