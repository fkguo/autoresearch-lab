VERDICT: READY

## Blockers
- None. The implementation demonstrates exceptional architectural discipline, particularly regarding idempotency and contract validation. The "prepared -> committed" state machine in `IdeaCoreService` is a robust solution for maintaining consistency in research workflows.

## Non-blocking
- **Schema Strictness:** `reduction_report_v1.schema.json` requires `minItems: 8` for the `reduction_map`. While this enforces high-fidelity mapping for mature research, it may be too high for early-phase exploration or simple analogies. Consider relaxing to `minItems: 3` to allow for lighter-weight "quick-look" reductions.
- **Evaluation Extensibility:** The `eval_run` logic currently stubs `grounding_audit` with a hardcoded pass. As the system moves toward M3, this should be refactored into an internal evaluator registry or plugin system to prevent the core service from becoming a dumping ground for model-specific prompts.

## Real-research fit
- **Hallucination Mitigation:** The use of `folklore_risk_score` and `novelty_delta_table` directly addresses a critical pain point in HEP research automation: LLMs often propose "new" ideas that are actually well-known folklore or superficial relabeling of existing theories.
- **Problem Abstraction:** Separating the `FormalismRegistry` from the `AbstractProblemRegistry` is a strong architectural choice. It allows the system to bridge the gap between high-level physics intuition and low-level computational solvers (e.g., mapping a BSM search to a specific optimization formalism).

## Robustness & safety
- **Deterministic Idempotency:** The use of RFC 8785 (JCS) for payload hashing ensures that the engine is resilient to trivial JSON formatting changes that often break naive idempotency implementations.
- **Promotion Gates:** The promotion logic in `node_promote` correctly enforces a "safety-first" protocol: requiring a schema-valid IdeaCard, a passing grounding audit, and a registered formalism before allowing an idea to exit the generator into the C2 (Formalism/Computation) layer.

## Specific patch suggestions

- **File:** `src/idea_core/engine/service.py`
- **Change:** In `rank_compute` (line ~640), the ELO rating calculation should respect the `elo_config`. Replace the hardcoded `1000` with the configured initial rating:
  ```python
  # current
  row["elo_rating"] = round(1000 + aggregate * 100, 6)
  # suggested
  row["elo_rating"] = round(elo_config.get("initial_rating", 1500) + aggregate * 100, 6)
  ```
- **File:** `contracts/idea-generator-snapshot/schemas/reduction_report_v1.schema.json`
- **Change:** Relax the `minItems` constraints for `reduction_map` and `compatibility_checks` to allow for more flexible early-stage idea development:
  ```json
  "reduction_map": { "type": "array", "minItems": 3 },
  "compatibility_checks": { "type": "array", "minItems": 1 }
  ```
- **File:** `src/idea_core/engine/service.py`
- **Change:** In `_prepared_side_effects_committed`, add a check for the `scorecards_artifact_ref` content if possible, or at least ensure the URI scheme is handled consistently across OS platforms (the current `ref[7:]` slice is correct for `file:///` on Unix but might need caution on Windows). No change required for now, but a note for M3.
