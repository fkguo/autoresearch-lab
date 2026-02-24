VERDICT: NOT_READY

## Blockers

### B1: `EXHAUSTED` state is a terminal sink with no transition out — but `campaign.topup` (M2.6+) will need `EXHAUSTED → EXPLORING`

The `_advance_island_state_one_tick` method has no branch for `previous_state == "EXHAUSTED"`. Once islands enter `EXHAUSTED`, there is no code path to revive them. This is fine *if* the contract explicitly says `EXHAUSTED` is terminal within M2.5 scope, but it's not documented anywhere. More critically, `_mark_islands_exhausted` is called from two places (the loop and the post-loop budget check), but neither checks whether individual islands were already `EXHAUSTED` — no harm today, but a latent bug when multi-island (>1) is enabled.

**Required fix:** Add an explicit `elif previous_state == "EXHAUSTED": next_state = "EXHAUSTED"; transition_reason = "terminal"` branch to `_advance_island_state_one_tick`, and add a doc-comment or inline `# M2.5: EXHAUSTED is terminal; topup revival is M2.6+ scope` annotation.

### B2: Post-tick budget exhaustion check can overcount `n_steps_executed` by 1

In the main loop, the sequence is:
1. Check step_budget → maybe break
2. Check global exhaustion → maybe break
3. Advance island state
4. Increment `planned_campaign["usage"]["steps_used"] += 1` and `n_steps_executed += 1`
5. Call `_set_campaign_running_if_budget_available` which checks exhaustion
6. If exhausted, `_mark_islands_exhausted`, set `early_stop_reason`, break

The problem: step 4 increments the step counter *before* step 5 checks exhaustion. On the final tick that causes exhaustion, the step is counted. **This is actually correct** (the step was executed). However, the exhaustion check at step 2 uses `self._exhausted_dimensions(planned_campaign)` *before* the tick, which means if `steps_used == max_steps` at the top of the loop, it correctly breaks before executing. But there's a subtle edge: `_set_campaign_running_if_budget_available` at step 5 can set `status = "exhausted"`, but the `early_stop_reason` is only set if `n_steps_executed < n_steps_requested` — if the last requested tick is the one that exhausts the budget, `early_stop_reason` is NOT set and `early_stopped` is NOT emitted. The test `test_search_step_global_step_budget_exhaustion_sets_campaign_exhausted` only checks the case where `n_steps_requested > max_steps`.

**Required fix:** Add a test case where `n_steps == max_steps` (e.g., request exactly 2 steps with max_steps=2) and verify the result does *not* contain `early_stopped` but the campaign status is `exhausted`. Alternatively, if the intent is that budget exhaustion always sets `early_stopped`, fix the logic.

### B3: `search.step` doesn't consume any real resource besides `steps_used` — `tokens_used`, `cost_usd_used`, `wall_clock_s_elapsed` never increment

The step loop increments only `local_usage["steps"]` and `planned_campaign["usage"]["steps_used"]`. The other budget dimensions (`tokens`, `cost_usd`, `wall_clock_s`) are never touched. This means:
- `step_budget.max_tokens`, `step_budget.max_cost_usd`, `step_budget.max_wall_clock_s` fuses can never fire.
- Global token/cost/time exhaustion can never trigger from `search.step`.

This is arguably acceptable for M2.5 (stub operators produce no LLM calls), but the **`_step_budget_exhausted` method checks all dimensions** and will silently never trigger for non-step dimensions — creating a false sense of coverage. At minimum, the step artifact's `transition_events` should document this limitation.

**Required fix:** Add an explicit comment in `search_step` that non-step resource accounting is deferred to M2.6 when real operators exist. Add a test that verifies `step_budget: {"max_tokens": 1}` does NOT cause early stop (documenting the known limitation).

## Non-blocking

### N1: `search_runtime.next_island_index` is stored on `planned_campaign` but never persisted to schema

The `search_runtime` dict is stored in the campaign manifest via `self.store.save_campaign(planned_campaign)`, but it's not in `campaign_status_v1.schema.json`. This is fine (internal state), but if `additionalProperties: false` is ever added to the campaign manifest schema, this will break. Consider adding a comment.

### N2: `_advance_island_state_one_tick` is a `@staticmethod` that mutates its argument in-place

This is a code smell for testability. A pure function that returns a new island dict would be cleaner and easier to unit-test in isolation. Non-blocking because the current tests cover it through integration.

### N3: Missing `CONVERGING → STAGNANT` explicit test

The test `test_search_step_best_score_improvement_resets_stagnation_to_converging` confirms `EXPLORING → CONVERGING`, but there's no test that `CONVERGING` with no further score improvement goes to `STAGNANT` after patience steps. The code handles it (the `elif previous_state in {"EXPLORING", "CONVERGING"}` branch), but it would be good to have an explicit regression test.

### N4: `REPOPULATED → EXPLORING` transition has no side effect

The `STAGNANT → REPOPULATED` and `REPOPULATED → EXPLORING` transitions happen but don't actually repopulate anything (no new nodes, no operator invocation). This is acceptable for M2.5 (operators are M2.6), but the `transition_events` in the step artifact should perhaps carry a `"note": "stub_no_op"` field to make audits unambiguous.

### N5: `step_artifact["transition_events"]` uses a freeform schema

The transition events written to the step artifact don't have a contract schema. For audit reproducibility, consider adding a `search_step_artifact_v1.schema.json` even if it's internal-only.

### N6: Score detection couples `search.step` to `eval.run` implementation details

`_island_best_score` reads `node["eval_info"]["scores"]` and computes a mean. This assumes the scoring contract from `eval.run`. If a future evaluator uses a different score representation, this will silently produce wrong best_score values. Consider extracting the score aggregation as a named strategy.

## Real-research fit

### R1: HEP workflow alignment — island model maps well to parallel hypothesis exploration

The multi-island state machine is a good fit for HEP phenomenology workflows where multiple theoretical approaches (e.g., different BSM models, different observable channels) need to be explored in parallel with independent stagnation detection. The `CONVERGING` state driven by score improvement is analogous to a scan that's narrowing in on a viable parameter region.

### R2: Stagnation patience is hardcoded

`STAGNATION_PATIENCE_STEPS = 2` is a reasonable default but should be configurable per-campaign or per-island (different theoretical approaches may need different exploration horizons). For HEP scans, patience of 2 is very aggressive — a typical MCMC chain might need O(100) steps before declaring convergence issues.

### R3: Single-island limitation

M2.5 only ever creates `island-0`. Real HEP campaigns would need multiple islands (e.g., one per BSM model class). The round-robin `next_island_index` scheduler is adequate as a placeholder but will need a fitness-proportional or UCB-style policy for real research.

### R4: No operator trace in search.step

The step artifact records transitions but not what operators were considered/selected. For research reproducibility, operator selection should be in the trace even when operators are stubs.

## Robustness & safety

### S1: Hallucination mitigation — score-driven transitions are grounded in eval artifacts

The `best_score` improvement check reads from `eval_info` which is written by `eval.run` with deterministic scoring and artifact persistence. This is a good evidence chain. However, there's no check that the `eval_info` is from the *current* campaign's eval run (a node's `eval_info` could theoretically be stale from a different context if nodes were ever shared).

### S2: Idempotency for `search.step` is well-implemented

The prepared/committed two-phase pattern correctly prevents double-spend on replay. The test `test_search_step_idempotency_replay_does_not_double_spend_steps` covers the critical path.

### S3: No crash-recovery test between prepared and committed states

If the process crashes after `save_campaign` but before the final `_store_idempotency(..., state="committed")`, the next replay call will find a `prepared` record and attempt `_prepared_side_effects_committed`. The check verifies `campaign["last_step_id"] == step_id` and artifact existence. This is sound but not tested with simulated crash injection.

### S4: `_mark_islands_exhausted` is unconditional

When budget is exhausted, ALL islands are marked `EXHAUSTED` regardless of their current state. There's no transition event recorded for this. This means the step artifact's `transition_events` won't capture the `EXPLORING → EXHAUSTED` (or `STAGNANT → EXHAUSTED`) transition that happens via `_mark_islands_exhausted`. This breaks audit completeness.

## Specific patch suggestions

### Patch 1: `src/idea_core/engine/service.py` — Add explicit EXHAUSTED branch

```python
# In _advance_island_state_one_tick, after the REPOPULATED branch (around the last elif):
# ADD:
        elif previous_state == "EXHAUSTED":
            # M2.5: EXHAUSTED is terminal. Revival via campaign.topup is M2.6+ scope.
            next_state = "EXHAUSTED"
            transition_reason = "terminal_no_change"
```

### Patch 2: `src/idea_core/engine/service.py` — Record EXHAUSTED transitions in transition_events

In the `search_step` method, after the call to `_mark_islands_exhausted(planned_campaign)` inside the loop (two locations), add transition event recording:

```python
# After _mark_islands_exhausted(planned_campaign) at ~line 810 and ~line 835:
for isl in planned_campaign["island_states"]:
    if isl["state"] == "EXHAUSTED":
        transition_events.append({
            "tick": tick + 1 if 'tick' in dir() else n_steps_executed,
            "island_id": isl.get("island_id", "unknown"),
            "from_state": "unknown",  # could track pre-exhaustion state
            "to_state": "EXHAUSTED",
            "reason": "budget_exhausted_forced",
            "score_improved": False,
            "best_score": isl.get("best_score"),
        })
```

Better approach: snapshot island states *before* `_mark_islands_exhausted` to record accurate `from_state`:

```python
# Before _mark_islands_exhausted call:
pre_exhaustion_states = {isl["island_id"]: isl["state"] for isl in planned_campaign["island_states"]}
self._mark_islands_exhausted(planned_campaign)
for isl in planned_campaign["island_states"]:
    iid = isl.get("island_id", "unknown")
    prev = pre_exhaustion_states.get(iid, "unknown")
    if prev != "EXHAUSTED":
        transition_events.append({
            "tick": n_steps_executed,
            "island_id": iid,
            "from_state": prev,
            "to_state": "EXHAUSTED",
            "reason": "budget_exhausted_forced",
            "score_improved": False,
            "best_score": isl.get("best_score"),
        })
```

### Patch 3: `src/idea_core/engine/service.py` — Add resource-accounting stub comment

```python
# In search_step, after local_usage initialization (~line 780):
                # M2.5 NOTE: Only steps_used is tracked. Token/cost/wall_clock accounting
                # requires real operator execution (M2.6+). step_budget fuses for non-step
                # dimensions are accepted but will never fire in this milestone.
```

### Patch 4: `tests/engine/test_search_step_island_state_machine.py` — Add CONVERGING→STAGNANT test

```python
def test_search_step_converging_without_improvement_reaches_stagnant(tmp_path: Path) -> None:
    """CONVERGING with no further score improvement should reach STAGNANT after patience steps."""
    service = make_service(tmp_path)
    campaign_id = init_campaign(service, max_steps=20)
    node_ids = list(service.store.load_nodes(campaign_id).keys())

    # Tick 1: SEEDING -> EXPLORING
    service.handle("search.step", {
        "campaign_id": campaign_id, "n_steps": 1, "idempotency_key": "warmup-1",
    })

    # Eval to establish a best_score
    service.handle("eval.run", {
        "campaign_id": campaign_id,
        "node_ids": [node_ids[0]],
        "evaluator_config": {"dimensions": ["novelty", "impact"], "n_reviewers": 2},
        "idempotency_key": "eval-converging",
    })

    # Tick 2: EXPLORING -> CONVERGING (score improvement detected)
    result = service.handle("search.step", {
        "campaign_id": campaign_id, "n_steps": 1, "idempotency_key": "to-converging",
    })
    assert result["island_states"][0]["state"] == "CONVERGING"

    # Tick 3-4: CONVERGING with no further improvement -> should stagnate
    result = service.handle("search.step", {
        "campaign_id": campaign_id, "n_steps": 2, "idempotency_key": "converging-to-stagnant",
    })
    assert result["island_states"][0]["state"] == "STAGNANT"
    assert result["island_states"][0]["stagnation_counter"] == 2
```

### Patch 5: `tests/engine/test_search_step_island_state_machine.py` — Add exact-budget exhaustion test

```python
def test_search_step_exact_budget_does_not_set_early_stopped(tmp_path: Path) -> None:
    """When n_steps == max_steps exactly, all steps execute; early_stopped should not be set."""
    service = make_service(tmp_path)
    campaign_id = init_campaign(service, max_steps=2)

    result = service.handle("search.step", {
        "campaign_id": campaign_id, "n_steps": 2, "idempotency_key": "exact-budget",
    })

    assert result["n_steps_executed"] == 2
    assert result["budget_snapshot"]["steps_used"] == 2
    assert result["budget_snapshot"]["steps_remaining"] == 0
    # All requested steps were executed, so early_stopped should not be set
    # (or if it is, the reason should be budget_exhausted — document which is correct)
    status = service.handle("campaign.status", {"campaign_id": campaign_id})
    assert status["status"] == "exhausted"
```

### Patch 6: `contracts/idea-generator-snapshot/schemas/island_state_v1.schema.json` — Make `stagnation_counter` and `repopulation_count` required

The code always emits these fields, and they're critical for observability:

```json
  "required": ["island_id", "state", "population_size", "stagnation_counter", "repopulation_count"],
```

This is a schema tightening that should be done now before external consumers depend on the optional behavior.
