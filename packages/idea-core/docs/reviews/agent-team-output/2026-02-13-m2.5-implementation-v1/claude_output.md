VERDICT: READY

## Blockers

None. The implementation is solid for its stated scope. All tests pass, contract validation is green, idempotency semantics are correctly extended to `search.step`, and the island state machine transitions are deterministic and observable. The code is ready to merge as-is for M2.5.

## Non-blocking

1. **`CONVERGING` state is unreachable.** `_advance_island_state_one_tick` handles `CONVERGING` in the same branch as `EXPLORING` (stagnation counter increment), but no transition ever produces `CONVERGING`. This is fine for M2.5 (the schema allows it, and the code won't crash), but it's dead code that should be documented as "reserved for M2.6+ score-improvement detection" or tested with a unit test that manually sets an island to `CONVERGING` and verifies the expected transition.

2. **`EXHAUSTED` is a terminal absorbing state with no test for re-entry prevention.** If a future caller somehow modifies an island to `EXHAUSTED` and then calls `search.step` again (after a `campaign.topup` that un-exhausts the campaign), `_advance_island_state_one_tick` will hit the `no_change` fallthrough and leave the island stuck in `EXHAUSTED` forever. This is arguably correct (EXHAUSTED should be terminal), but there's no explicit test or documentation of this invariant.

3. **Round-robin island selection with single island is trivially correct but under-tested for multi-island.** The `next_island_index` rotation logic works, but there are no tests with `len(islands) > 1`. Since M2.5 scope is "minimal," this is acceptable, but a two-island test would catch subtle off-by-one issues in the modular arithmetic before M2.6 lands.

4. **`search_runtime` is persisted in the campaign manifest but not in the schema.** `campaign_status_v1.schema.json` has `"additionalProperties": false`, so `search_runtime` will be stripped or cause validation errors if it ever leaks into a `campaign.status` response. Currently it doesn't (status reads from the campaign dict but only selects whitelisted keys), but this is fragile. Consider adding `search_runtime` to the campaign manifest schema (not the status response schema) or documenting the invariant.

5. **`transition_events` are written to the step artifact but not surfaced in the RPC result.** This is fine for observability-via-artifact, but downstream agents that want to react to transitions without reading artifacts will need a future schema extension. Worth noting in the M2.6 design doc.

6. **Step artifact has no schema validation.** The `step_artifact` dict written to `search_steps/{step_id}.json` is not validated against any schema. The RPC result is validated, but the artifact could drift silently. Consider adding a `search_step_artifact_v1.schema.json` and validating before write.

7. **`stagnation_counter` assertion in `test_search_step_reaches_stagnant_then_repopulated` asserts `== 2` after 3 steps.** This is correct (SEEDING→EXPLORING resets to 0, then two EXPLORING ticks increment to 1 and 2, with the second triggering STAGNANT), but the test comment should trace the expected state machine path to make the assertion non-mysterious for future maintainers.

8. **Minor: `_step_budget_exhausted` uses `float()` casts on budget values.** If someone passes a string like `"2"` for `max_steps`, this silently works. The schema should enforce `integer`/`number` types, and the code should fail fast on type violations rather than silently coercing.

## Real-research fit

The island state machine is a sound abstraction for HEP idea exploration. The key design decisions are well-suited:

- **Stagnation detection → repopulation cycle** maps directly to the real problem of search getting stuck in local optima when exploring BSM scenarios or effective field theory parameter spaces. The `STAGNATION_PATIENCE_STEPS = 2` default is conservative but appropriate for a minimal bootstrap.

- **Budget fusing (local `step_budget` vs. global campaign budget)** is critical for real research workflows where you want to "try 5 steps on this island" without risking the entire campaign budget. The implementation correctly prioritizes local fuse before global exhaustion check.

- **Idempotency under partial execution** is essential for research reproducibility. The fact that `n_steps_executed < n_steps_requested` replays correctly means interrupted long-running searches don't corrupt state.

- **The `EXHAUSTED` terminal state** correctly prevents zombie campaigns from consuming resources, which matters in multi-campaign orchestration.

For HEP-specific concerns: the single-island bootstrap with deterministic round-robin is appropriate for M2.5. Real HEP campaigns will need score-aware island selection (e.g., prioritize islands with higher `best_score` improvement gradients), but that's correctly deferred to M2.6+.

## Robustness & safety

1. **Hallucination mitigation**: The state machine is purely deterministic with no LLM calls—this is correct for M2.5. The `new_node_ids: []` and `updated_node_ids: []` empty arrays make it clear no content generation happens yet, preventing any accidental hallucination surface.

2. **Provenance**: Step artifacts with `transition_events` provide full audit trail. The `step_id` is a UUID v4, and the artifact path `search_steps/{step_id}.json` is deterministic given the step_id.

3. **Budget safety**: The double-check pattern (check budget before tick, check again after tick, mark EXHAUSTED) is correct. The `_set_campaign_running_if_budget_available` call after each tick ensures the campaign status is always consistent with remaining budget.

4. **Crash recovery**: The `prepared → committed` idempotency state machine correctly handles the case where the process crashes after writing the artifact but before committing the idempotency record. The `_prepared_side_effects_committed` check for `search.step` verifies both the artifact file existence AND that the campaign's `last_step_id` matches, which is a strong consistency check.

5. **Concurrency**: The `mutation_lock(campaign_id)` ensures serialized access. No TOCTOU issues in the current single-process design.

6. **One subtle concern**: If `_exhausted_dimensions` is called and returns truthy at the *start* of a tick (before incrementing `steps_used`), the campaign is marked `exhausted` and the loop breaks *without* executing that tick. This is correct—it means the budget check is "can I afford this tick?" not "did I overspend?" But the interaction between the pre-tick check and the post-tick `_set_campaign_running_if_budget_available` means there are two code paths that can set `status = "exhausted"`, which could be confusing. Consider unifying.

## Specific patch suggestions

### 1. Add state-machine path comments to test assertions

**File**: `tests/engine/test_search_step_island_state_machine.py`  
**What to change**: Add inline comments tracing the expected state transitions in `test_search_step_reaches_stagnant_then_repopulated_and_status_matches`.

```python
# After line 51 (the stagnant = service.handle(...) call), before assertions:
    # Expected path for single island with STAGNATION_PATIENCE_STEPS=2:
    #   tick 1: SEEDING → EXPLORING (stagnation_counter=0)
    #   tick 2: EXPLORING → EXPLORING (stagnation_counter=1)  
    #   tick 3: EXPLORING → STAGNANT (stagnation_counter=2, threshold reached)
```

### 2. Add a unit test for `_advance_island_state_one_tick` in isolation with CONVERGING

**File**: `tests/engine/test_search_step_island_state_machine.py`  
**What to change**: Append a unit test covering the `CONVERGING` branch and `EXHAUSTED` terminal behavior.

```python
def test_advance_island_state_converging_increments_stagnation(tmp_path: Path) -> None:
    """CONVERGING behaves like EXPLORING: increments stagnation_counter."""
    island = {"state": "CONVERGING", "stagnation_counter": 0, "repopulation_count": 0}
    prev, next_, reason = IdeaCoreService._advance_island_state_one_tick(island)
    assert prev == "CONVERGING"
    assert next_ == "CONVERGING"
    assert reason == "stagnation_counter_incremented"
    assert island["stagnation_counter"] == 1


def test_advance_island_state_exhausted_is_terminal(tmp_path: Path) -> None:
    """EXHAUSTED has no outgoing transition."""
    island = {"state": "EXHAUSTED", "stagnation_counter": 0, "repopulation_count": 0}
    prev, next_, reason = IdeaCoreService._advance_island_state_one_tick(island)
    assert prev == "EXHAUSTED"
    assert next_ == "EXHAUSTED"
    assert reason == "no_change"
```

### 3. Add two-island round-robin test

**File**: `tests/engine/test_search_step_island_state_machine.py`  
**What to change**: Append a test that manually injects a second island to verify round-robin selection.

```python
def test_search_step_round_robin_with_two_islands(tmp_path: Path) -> None:
    """Verify round-robin alternation across two islands."""
    service = make_service(tmp_path)
    campaign_id = init_campaign(service, max_steps=20)

    # Inject a second island into the campaign manifest
    campaign = service.store.load_campaign(campaign_id)
    campaign["island_states"].append({
        "island_id": "island-1",
        "state": "SEEDING",
        "population_size": 0,
        "stagnation_counter": 0,
        "repopulation_count": 0,
        "best_score": None,
    })
    service.store.save_campaign(campaign)

    result = service.handle(
        "search.step",
        {
            "campaign_id": campaign_id,
            "n_steps": 4,
            "idempotency_key": "search-round-robin-2",
        },
    )
    assert result["n_steps_executed"] == 4
    # island-0: tick 1 (SEEDING→EXPLORING), tick 3 (EXPLORING, stagnation=1)
    # island-1: tick 2 (SEEDING→EXPLORING), tick 4 (EXPLORING, stagnation=1)
    states = {isl["island_id"]: isl for isl in result["island_states"]}
    assert states["island-0"]["state"] == "EXPLORING"
    assert states["island-0"]["stagnation_counter"] == 1
    assert states["island-1"]["state"] == "EXPLORING"
    assert states["island-1"]["stagnation_counter"] == 1
```

### 4. Document `search_runtime` as internal-only in campaign manifest

**File**: `src/idea_core/engine/service.py`  
**What to change**: Add a docstring/comment near the `search_runtime` usage.

```python
# After the line: planned_campaign.setdefault("search_runtime", {})
# Add:
            # NOTE: search_runtime is internal engine state persisted in the campaign
            # manifest but NOT exposed in campaign.status or search.step results.
            # It tracks round-robin cursor and other policy state across calls.
```

### 5. Consider validating step artifact against a schema

**File**: `src/idea_core/engine/service.py`  
**What to change**: This is lower priority, but for completeness, add a schema file and validation call.

Create `contracts/idea-generator-snapshot/schemas/search_step_artifact_v1.schema.json`:
```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "search_step_artifact_v1.schema.json",
  "title": "SearchStepArtifact v1",
  "type": "object",
  "required": ["campaign_id", "step_id", "n_steps_requested", "n_steps_executed", "transition_events", "island_states", "budget_snapshot", "generated_at"],
  "properties": {
    "campaign_id": {"type": "string", "format": "uuid"},
    "step_id": {"type": "string", "format": "uuid"},
    "n_steps_requested": {"type": "integer", "minimum": 1},
    "n_steps_executed": {"type": "integer", "minimum": 0},
    "transition_events": {
      "type": "array",
      "items": {
        "type": "object",
        "required": ["tick", "island_id", "from_state", "to_state", "reason"],
        "properties": {
          "tick": {"type": "integer", "minimum": 1},
          "island_id": {"type": "string"},
          "from_state": {"type": "string"},
          "to_state": {"type": "string"},
          "reason": {"type": "string"}
        },
        "additionalProperties": false
      }
    },
    "step_budget": {},
    "budget_snapshot": {"$ref": "./budget_snapshot_v1.schema.json"},
    "island_states": {"type": "array", "minItems": 1, "items": {"$ref": "./island_state_v1.schema.json"}},
    "early_stopped": {"type": "boolean"},
    "early_stop_reason": {"type": ["string", "null"]},
    "generated_at": {"type": "string", "format": "date-time"}
  },
  "additionalProperties": false
}
```

Then in `service.py`, before `self.store.write_artifact(...)`:
```python
            self.catalog.validate_against_ref(
                "./search_step_artifact_v1.schema.json",
                step_artifact,
                base_name=f"search.step/artifact/{step_id}",
            )
```
