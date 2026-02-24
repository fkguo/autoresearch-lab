VERDICT: READY

## Blockers

No blockers found. The implementation satisfies all M2.5 requirements:

1. **State machine transitions are correct and tested**: SEEDING→EXPLORING→STAGNANT→REPOPULATED path is exercised, CONVERGING via best-score improvement works, EXHAUSTED is terminal.
2. **Contract compliance**: All three schemas (`island_state_v1`, `campaign_status_v1`, `search_step_result_v1`) are respected; `make validate` and 29 tests pass.
3. **Idempotency**: Replay prevents double-spend of steps — tested explicitly.
4. **Budget semantics**: Local fuse (`step_budget.max_steps`), global exhaustion, exact-boundary (`n_steps == max_steps` without `early_stopped`), and token no-op all have dedicated regression tests.
5. **Consistency**: `campaign.status` and `search.step` expose identical `island_states` — asserted in every state-machine test.

## Non-blocking

1. **`REPOPULATED → EXPLORING` transition is unconditional and untested in isolation.** After REPOPULATED, the next tick always goes to EXPLORING regardless of whether any actual repopulation occurred (no new nodes in M2.5). This is fine for M2.5 but should have a dedicated single-tick regression:

   ```python
   # tests/engine/test_search_step_island_state_machine.py
   def test_repopulated_to_exploring_single_tick(tmp_path):
       service = make_service(tmp_path)
       cid = init_campaign(service, max_steps=20)
       # 3 ticks → STAGNANT, 1 tick → REPOPULATED
       service.handle("search.step", {"campaign_id": cid, "n_steps": 4, "idempotency_key": "s1"})
       result = service.handle("search.step", {"campaign_id": cid, "n_steps": 1, "idempotency_key": "s2"})
       assert result["island_states"][0]["state"] == "EXPLORING"
       assert result["island_states"][0]["stagnation_counter"] == 0
   ```

2. **`_advance_island_state_one_tick` is a `@staticmethod` that mutates its argument.** This is pragmatic but makes unit-testing the state machine in isolation harder. Consider extracting a pure function that returns a new island dict (or at minimum a named-tuple of deltas). Low priority — current test coverage compensates.

3. **`transition_events` in the step artifact are not schema-validated.** The step artifact written to `search_steps/{step_id}.json` includes `transition_events` with rich structure (`tick`, `from_state`, `to_state`, `reason`, `score_improved`, `best_score`), but there's no JSON Schema for it. When M2.6 consumers (or external audit tools) start reading these artifacts, schema drift is likely.

4. **Round-robin island selection with `search_runtime.next_island_index`** is persisted in the campaign dict but `search_runtime` is not in `campaign_status_v1.schema.json` (correctly — it's internal). However, `campaign` dict is the authoritative store, so any future serialization/migration tooling needs to know about this field. Add a brief `# Internal: not exposed via contract` comment.

5. **`best_score` update happens _before_ the state transition call** — `_island_best_score` scans all nodes, then `_is_score_improved` compares against `island["best_score"]`. This means `best_score` is updated to `current_best_score` even if `score_improved` is `False` (because `current_best_score == previous_best_score`). This is benign but semantically surprising — the stored `best_score` can be set to the same value every tick even without improvement. Consider only updating `island["best_score"]` when `score_improved is True`.

6. **`test_search_step_step_budget_max_tokens_is_noop_in_m2_5` asserts 2 steps executed without early_stop.** The assertion `"early_stopped" not in result` depends on `max_tokens: 1` not firing because `local_usage["tokens"]` stays at 0.0. If M2.6 accidentally starts charging tokens inside `search.step` without updating this test, it will break silently in a confusing way. Add a comment or a `# M2.6_BREAKS_THIS` marker.

7. **No negative/zero `n_steps` test.** The schema enforces `minimum: 1`, but there's no test that the contract layer rejects `n_steps: 0`. This is a minor gap since `validate_request_params` handles it, but a one-liner regression would be cheap.

## Real-research fit

**Strong fit for evidence-first HEP research workflows.**

- The multi-island state machine models the real pattern of hypothesis exploration in HEP phenomenology: you explore a region of theory space, stagnate when no new observables improve, repopulate with fresh seeds (analogous to trying a new BSM sector or coupling structure), and converge when a promising direction emerges.

- `CONVERGING` triggered by `best_score` improvement is a good proxy for the real signal: in HEP, "convergence" typically means a candidate model's predicted observables are moving closer to experimental data (e.g., improving $\chi^2/\text{dof}$ against LHC measurements).

- The `EXHAUSTED` terminal state correctly models finite compute budgets in real research runs — you don't want a search to silently restart after budget is gone.

- **Gap for real HEP use**: The single-island round-robin with `island-0` only is fine for M2.5, but real multi-island search needs at least 2 islands to exercise the round-robin and cross-island migration. M2.6 should introduce a second island in the init path and test interleaved transitions.

- **Provenance is solid**: Step artifacts with `transition_events` create an auditable trace of why the search made each decision. This is critical for reproducibility in physics research — a reviewer should be able to replay the entire search path from artifacts.

## Robustness & safety

1. **Hallucination mitigation**: The deterministic scoring stub (`_deterministic_score` via SHA256) is the right approach for M2.5 — it prevents any LLM-generated scores from leaking into the state machine before real evaluators are wired. The `best_score` path correctly uses `eval.run` output, not fabricated scores.

2. **Atomicity**: The prepared/committed two-phase idempotency pattern is well-implemented. The `_prepared_side_effects_committed` check for `search.step` correctly verifies both `last_step_id` match and artifact existence before promoting to committed.

3. **Budget safety**: The exhaustion check _inside_ the tick loop (before each tick) prevents over-spending. The post-loop `_set_campaign_running_if_budget_available` handles the exact-boundary case.

4. **Potential issue — `_set_campaign_running_if_budget_available` can transition `exhausted → running`**: This method (line ~940) will flip an exhausted campaign back to running if budget becomes available (e.g., after topup). But in the current `search.step` flow, this is called _after_ incrementing `steps_used`, so the campaign correctly stays exhausted when `steps_used == max_steps`. However, this method is also called in `eval.run` and `rank.compute`, which increment `steps_used` — if someone calls `eval.run` on an exhausted campaign... wait, `_ensure_campaign_running` blocks that. Good.

5. **No TOCTOU on budget check**: The mutation lock is held for the entire `search.step` call, so there's no race between checking budget and committing the step. Correct.

6. **`early_stopped` flag semantics are precise**: Present only when `n_steps_executed < n_steps_requested` _and_ caused by a fuse/budget limit. The exact-boundary test (`n_steps == max_steps`) correctly verifies no `early_stopped` flag when the caller got exactly what they asked for, even though the campaign transitions to `exhausted`. This matches the OpenRPC description.

## Specific patch suggestions

### 1. `src/idea_core/engine/service.py` — Only update `best_score` when improved

**Lines ~810-815** (inside `search_step`, the tick loop):

```python
# CURRENT:
if current_best_score is not None:
    score_improved = self._is_score_improved(previous_best_score, current_best_score)
    island["best_score"] = current_best_score

# PROPOSED:
if current_best_score is not None:
    score_improved = self._is_score_improved(previous_best_score, current_best_score)
    if score_improved:
        island["best_score"] = current_best_score
```

**Rationale**: Avoids semantically misleading `best_score` updates on every tick; ensures `best_score` only changes when the state machine actually transitions to `CONVERGING`.

### 2. `src/idea_core/engine/service.py` — Add internal-field comment for `search_runtime`

**After the line** `planned_campaign.setdefault("search_runtime", {})`:

```python
# Internal scheduling state; NOT exposed via campaign_status_v1 contract.
# Contains: next_island_index (round-robin cursor).
planned_campaign.setdefault("search_runtime", {})
```

### 3. `tests/engine/test_search_step_island_state_machine.py` — Add REPOPULATED→EXPLORING regression

**Append after the last test**:

```python
def test_search_step_repopulated_to_exploring_single_tick(tmp_path: Path) -> None:
    """Verify REPOPULATED → EXPLORING transition occurs on the very next tick."""
    service = make_service(tmp_path)
    campaign_id = init_campaign(service, max_steps=20)

    # 3 ticks: SEEDING→EXPLORING→EXPLORING(stag=1)→STAGNANT
    # 1 tick:  STAGNANT→REPOPULATED
    service.handle(
        "search.step",
        {"campaign_id": campaign_id, "n_steps": 4, "idempotency_key": "setup-repopulated"},
    )
    result = service.handle(
        "search.step",
        {"campaign_id": campaign_id, "n_steps": 1, "idempotency_key": "repop-to-exploring"},
    )
    island = result["island_states"][0]
    assert island["state"] == "EXPLORING"
    assert island["stagnation_counter"] == 0
    assert island["repopulation_count"] == 1
```

### 4. `tests/engine/test_search_step_island_state_machine.py` — Add `n_steps=0` rejection test

```python
def test_search_step_rejects_zero_n_steps(tmp_path: Path) -> None:
    service = make_service(tmp_path)
    campaign_id = init_campaign(service, max_steps=20)
    try:
        service.handle(
            "search.step",
            {"campaign_id": campaign_id, "n_steps": 0, "idempotency_key": "zero-steps"},
        )
        assert False, "expected RpcError for n_steps < 1"
    except RpcError as exc:
        assert exc.code == -32002
```

### 5. `tests/engine/test_search_step_island_state_machine.py` — Add M2.6 breakage marker

**In `test_search_step_step_budget_max_tokens_is_noop_in_m2_5`**, add comment:

```python
def test_search_step_step_budget_max_tokens_is_noop_in_m2_5(tmp_path: Path) -> None:
    # WARNING: M2.6 will start consuming tokens in search.step (operator execution).
    # When that happens, max_tokens=1 WILL trigger early_stop. Update this test at M2.6.
    service = make_service(tmp_path)
    ...
```

### 6. `contracts/idea-generator-snapshot/schemas/` — Add step artifact schema stub

**New file: `contracts/idea-generator-snapshot/schemas/search_step_artifact_v1.schema.json`**:

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "search_step_artifact_v1.schema.json",
  "title": "SearchStepArtifact v1",
  "description": "Audit artifact written per search.step call. Contains full transition trace for reproducibility.",
  "type": "object",
  "required": ["campaign_id", "step_id", "n_steps_requested", "n_steps_executed", "transition_events", "island_states", "budget_snapshot", "generated_at"],
  "properties": {
    "campaign_id": { "type": "string", "format": "uuid" },
    "step_id": { "type": "string", "format": "uuid" },
    "n_steps_requested": { "type": "integer", "minimum": 1 },
    "n_steps_executed": { "type": "integer", "minimum": 0 },
    "transition_events": {
      "type": "array",
      "items": {
        "type": "object",
        "required": ["tick", "island_id", "from_state", "to_state", "reason"],
        "properties": {
          "tick": { "type": "integer", "minimum": 1 },
          "island_id": { "type": "string", "minLength": 1 },
          "from_state": { "$ref": "./island_state_v1.schema.json#/properties/state" },
          "to_state": { "$ref": "./island_state_v1.schema.json#/properties/state" },
          "reason": { "type": "string" },
          "score_improved": { "type": "boolean" },
          "best_score": { "type": ["number", "null"] }
        },
        "additionalProperties": false
      }
    },
    "step_budget": { "type": ["object", "null"] },
    "budget_snapshot": { "$ref": "./budget_snapshot_v1.schema.json" },
    "island_states": { "type": "array", "minItems": 1, "items": { "$ref": "./island_state_v1.schema.json" } },
    "early_stopped": { "type": "boolean" },
    "early_stop_reason": { "type": ["string", "null"] },
    "generated_at": { "type": "string", "format": "date-time" }
  },
  "additionalProperties": false
}
```

**Rationale**: This schema-validates the artifact written to disk, closing the provenance gap identified in non-blocking item 3. Wire it into `write_artifact` or at minimum validate in tests.
