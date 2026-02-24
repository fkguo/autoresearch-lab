VERDICT: READY

## Blockers

- None.

## Non-blocking

1. **Coarse tolerance is *very* coarse.** `rel=0.6` means two solvers can disagree by 60% and still pass. Combined with `abs=10`, the gate effectively only catches catastrophic failures (wrong sign, orders-of-magnitude divergence, infeasibility). This is acceptable *now* because (a) the NaN/inf and per-Q² status checks catch the most dangerous silent-failure modes, and (b) it is explicitly documented as a smoke gate. However, **before** the actual tightening milestone, the tolerance must be revisited with a justification grounded in the observed solver spread from the golden-reduced runs. Consider adding a non-blocking CI warning when relative deviation exceeds, say, 0.15, so you build a quantitative intuition for the solver-agreement envelope before you need to rely on it.

2. **Gate receipts are prospective.** The packet states receipts "will be regenerated" after the patch set. Ideally the review packet would include at least one end-to-end gate-pass receipt showing the new checks (finite filter, per-Q² status, cross-solver Θ̂ comparison) all executing on the golden-reduced smoke instance. If this receipt already exists but was simply omitted from the packet, no action needed; if it doesn't exist yet, generate it promptly post-merge and archive it before moving to the next milestone.

3. **Accepted-status allow-list should be schema-pinned.** The per-Q² status check references an "accepted list" of solver statuses, but the packet doesn't specify where this list is defined or whether it is hard-coded vs. configurable. Pin the canonical allow-list (e.g., `["OPTIMAL", "ALMOST_OPTIMAL"]`) in the cross-solver-check schema or pipeline config so it is version-controlled and auditable alongside the tolerance parameters.

4. **Minor: `1e-12` s-grid binding tolerance.** Documenting it is the right call. Note that if you ever move to single-precision intermediaries or serialise through a format that truncates (CSV with limited decimal places), this tolerance will silently break. A brief comment in the schema noting the IEEE-754 double-precision assumption would future-proof the contract.

## Real-research fit

The changes are well-scoped to the stated goal: infrastructure hardening, not physics claims. The separation between "smoke stability gate" and "tightening/promotion tolerance" is clearly drawn, and the evidence note correctly frames W6-36 as a tooling milestone. The next step (ingesting He/Su-style halfspace constraints) is a natural successor and does not require any structural changes to what is being merged here—only tighter tolerances and richer constraint content, both of which the current schema already accommodates.

## Robustness & safety

- **B1.5 (NaN/partial-status masking):** This is the most valuable addition in the round. The failure mode—SCS converging at Q²=0 but diverging at Q²=2 GeV², with the gate only checking the first entry—is exactly the kind of silent data-poisoning bug that propagates undetected through a pipeline. Rejecting non-finite values and requiring *all* per-Q² statuses to be in the accepted set is a correct fail-closed fix.
- **Fail-closed posture:** The design is properly fail-closed: missing data, unexpected statuses, and non-finite values all cause rejection rather than silent pass-through. This is the right default for a research pipeline where false confidence is more dangerous than false alarms.
- **No safety concerns** specific to this increment. The coarse tolerance is not a safety issue because the gate is explicitly not used for any physics claim or downstream promotion decision.

## Specific patch suggestions

1. **Pin the accepted-status list in the pipeline config:**
   ```json
   // cross_solver_check_v1.json
   "accepted_solver_statuses": ["OPTIMAL", "ALMOST_OPTIMAL"],
   ```
   and have `validate_project_artifacts.py` read it from there rather than (presumably) hard-coding it.

2. **Add a "deviation summary" output to the cross-solver checker** (non-blocking, but strongly recommended before tightening):
   ```python
   # In the cross-solver comparison loop:
   max_abs_dev = np.max(np.abs(bounds_a - bounds_b))
   max_rel_dev = np.max(np.abs(bounds_a - bounds_b) / np.maximum(np.abs(bounds_a), 1e-30))
   print(f"[cross-solver] max |Δ|={max_abs_dev:.4g}, max |Δ|/|ref|={max_rel_dev:.4g}")
   ```
   This costs nothing and gives you the empirical data to set principled tolerances for the next milestone.

3. **Schema comment for float-precision assumption:**
   ```json
   "s_grid_mpi2": {
     "description": "... |Δs| <= 1e-12 (assumes IEEE-754 binary64; will fail under single-precision or truncating serialisation)"
   }
   ```
