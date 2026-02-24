VERDICT: READY

## Blockers
None.

## Non-blocking
- The `HEP_COMPUTE_RUBRIC_RULES` tuple is hardcoded in `service.py`. Ideally, this should eventually move to a configuration file or the domain pack for easier updates without code changes, but it is acceptable for M3.6.
- The `_infer_hep_compute_rubric` method relies on simple keyword matching (`_contains_any`). This might be brittle for complex method descriptions but suffices for the current scope and "minimal" compute plan calibration.

## Real-research fit
- The heuristic correctly identifies "heavy" HEP methods (lattice, detector sim, global fits) and enforces a "cluster" infrastructure requirement, which is a crucial reality check for research planning.
- Blocking "not_yet_feasible" infrastructure prevents the system from hallucinating actionable plans for problems that are currently intractable (e.g., full sign-problem lattice QCD).

## Robustness & safety
- The implementation safely handles missing fields in `minimal_compute_plan` by applying defaults derived from the rubric, ensuring backward compatibility with older nodes or incomplete LLM outputs.
- The `node.promote` gate strictly enforces the "critical" severity findings, preventing the promotion of unrealistic research plans.
- Idempotency is correctly handled in the modified methods.

## Specific patch suggestions
None.
