VERDICT: READY

## Blockers

- None. The increment is well-scoped as a tooling/robustness fix, the fail-closed semantics are appropriate, and the evidence trail is adequate for a non-physics increment.

## Non-blocking

1. **Retry ladder ceiling deserves a hard cap in config schema.** The packet describes the retry ladder and per-attempt diagnostics but does not mention an upper bound on the number of retry attempts enforced at the schema/config level. Without one, a pathological config could burn unbounded laptop time. Recommend adding a `max_total_attempts` field (with a sensible default, e.g. 4) validated at config load time.

2. **Attempt-level wallclock timestamps.** The logged attempt fields include `(max_iter, eps_abs/rel, termination_status, diag)` but no per-attempt wall-clock duration. For laptop-budget management and for diagnosing whether a retry actually made progress vs. spinning, a `duration_s` field per attempt would be valuable. Low priority but easy to add.

3. **COSMO-as-primary should be explicit in the SSOT tracker.** The packet implicitly treats COSMO as the production solver for the full-PSD pathway going forward. This decision should be recorded as a tracker note (or a small "solver choice" subsection in the evidence note) so that future increments don't accidentally regress to SCS without re-evaluating.

4. **Fail-closed exit code semantics.** The packet says the run "exits non-zero" on failure. It would strengthen auditability to specify a distinguished exit code (e.g. exit 2 for solver-failure-after-retries vs. exit 1 for config/input errors), so that CI/orchestration can distinguish the two classes without parsing `log.txt`.

5. **SCS cross-check scope.** The packet proposes keeping SCS "only as an optional/coarse smoke cross-check." It would be helpful to define what "coarse" means concretely — e.g., SCS is run only on the two anchor $Q^2$ points, or only on the min objective, etc. — so the next increment doesn't have to re-decide this.

## Real-research fit

- This increment is correctly positioned as **infrastructure hardening**, not a physics claim. The packet is explicit that S-matrix constraints remain disk-only placeholders and that no tightening claim is made. This is exactly the right sequencing: you must trust your solver pipeline before trusting the bounds it produces.
- The documented baseline failure (silent NaN at $Q^2 = 2\,\text{GeV}^2$) is a genuine and dangerous hazard for any downstream analysis. Closing it before moving to He/Su-style halfspace constraints is sound methodology.
- COSMO producing clean bands where SCS fails is consistent with known behavior differences for full-PSD formulations (COSMO's native chordal decomposition vs. SCS's indirect handling). The choice to promote COSMO is well-motivated.

## Robustness & safety

- **Fail-closed is the correct default.** Partial results with NaN entries that could silently propagate into band plots or claim tables are the most dangerous failure mode for a bootstrap-style analysis. Aborting the run and writing an explicit error block in `results.json` is the right design.
- **Cross-$Q^2$ warm-start off by default for SCS is prudent.** SCS's sensitivity to starting points in the full-PSD setting means that a bad warm-start from an adjacent $Q^2$ point can push the solver into a worse basin. Defaulting to off and making it opt-in is the safe choice.
- **No downstream consumer of partial results.** The packet confirms that fail-closed runs do not produce plot artifacts or band arrays that could be mistakenly cited. This is verified by the evidence note and the FAIL-prefixed log convention.
- **One residual concern:** the retry ladder uses "best-effort start values from the last available iterate" within a single $Q^2$ point's retry sequence. If the previous attempt terminated with `ALMOST_DUAL_INFEASIBLE`, the iterate may be near an infeasibility certificate rather than a useful primal starting point. Consider adding a flag to optionally discard the warm-start after an infeasibility-flavored termination status within the ladder itself (not just cross-$Q^2$).

## Specific patch suggestions

1. **Config schema: add `max_total_attempts`.**
   ```json
   "retry_policy": {
     "max_total_attempts": 4,
     "ladder": [ ... ]
   }
   ```
   Validate at load: if `length(ladder) > max_total_attempts`, error.

2. **Per-attempt wallclock.**
   In the attempt record struct, add:
   ```julia
   push!(attempts, Dict(
       ... ,
       "duration_s" => round(time() - t0; digits=2)
   ))
   ```

3. **Infeasibility-aware warm-start discard within ladder.**
   ```julia
   if prev_status in (:ALMOST_DUAL_INFEASIBLE, :DUAL_INFEASIBLE, :INFEASIBLE)
       @warn "Discarding warm-start after infeasibility-flavored status"
       warm_start = nothing
   end
   ```

4. **Distinguished exit codes.**
   ```julia
   exit(2)  # solver failure after retry exhaustion
   exit(1)  # config / input validation error
   ```

5. **SSOT tracker note for solver promotion.**
   Add a line to the W6-37 row:
   > Solver: COSMO promoted to primary for full-PSD pathway; SCS retained as optional coarse cross-check (anchor-only).
