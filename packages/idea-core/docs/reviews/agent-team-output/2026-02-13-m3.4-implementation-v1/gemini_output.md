VERDICT: READY

## Blockers
None.

## Non-blocking
None. The implementation strictly adheres to the M3.4 requirements for novelty detection and reporting.

## Real-research fit
The `non_novelty_flags` heuristics (text similarity thresholds 0.72/0.92, evidence subset checks, and predictive keyword absence) provide a solid baseline for the "Referee" agent to automatically flag incremental or superficial work. This correctly shifts the burden of proof to the `idea_card` to justify novelty when these flags are raised.

## Robustness & safety
- **Deterministic:** The scoring and flag inference rely on stable text processing and set operations, ensuring reproducibility.
- **Schema Compliance:** The output strictly matches `novelty_delta_table_v1.schema.json`.
- **Test Coverage:** Positive and negative cases (duplicate seeds vs. distinct seeds) are covered, as well as the configuration toggle to enable/disable the feature.

## Specific patch suggestions
None.
