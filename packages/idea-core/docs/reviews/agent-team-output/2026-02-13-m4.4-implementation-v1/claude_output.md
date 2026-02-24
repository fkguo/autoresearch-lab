VERDICT: READY

## Blockers

None. All four M4.4 acceptance criteria are met based on the authoritative evidence provided:

1. **Parallel/sequential/stage-gated execution** — `TeamRoleOrchestrator.run_team_plan(...)` implements all three policies (`parallel`, `sequential`, `stage_gated` with `all_must_succeed` gate). ✅
2. **Parallel Referee+Checker clean-room path validated** — Test 1 in `test_team_orchestrator_m44.py` explicitly exercises parallel Referee+Checker with `clean_room=true`, confirming role inputs are isolated from peer outputs. ✅
3. **Merge-back into IdeaStore** — Merged payload is written via `EngineStore.write_artifact` under `artifacts/team_reviews/*`, confirmed by test assertions on artifact write-back. ✅
4. **Stage-gate auditability via ledger events** — Test 2 exercises `stage_gated` with a failing gate, confirms `team_orchestration.stage_blocked` event emission, and the full event lifecycle (`started`, `stage_blocked`, `merged`, `completed`) is documented. ✅

Gate evidence (`91 passed`, `make validate` OK, red→green repro) is internally consistent.

## Non-blocking

1. **`stage_gated` policy rigidity** — Only `all_must_succeed` is implemented as a gate policy. Future milestones will likely need `majority_succeed`, `quorum(n)`, or custom predicate gates. The current single-policy design is fine for M4.4 but should be refactored to a strategy pattern before M5 orchestration work begins. No action required now.

2. **Missing timeout/deadline enforcement test** — `budget` and `deadline` are accepted as inputs to `run_team_plan(...)` but no test exercises deadline expiry or budget exhaustion behavior. This is out-of-scope for M4.4 acceptance but is a gap that should be covered before production use.

3. **Merge conflict semantics undocumented** — When two parallel roles produce artifacts with colliding keys, the merge-back behavior (last-write-wins? error? namespace?) is not explicitly specified in the provided evidence. Recommend adding a brief docstring or design note in `orchestrator.py` clarifying the merge strategy.

4. **`clean_room=false` sequential test does not assert isolation violation** — Test 3 validates that downstream roles *receive* upstream outputs, but does not assert that upstream roles are *not* contaminated by downstream outputs (i.e., the directionality guarantee). A negative-path assertion would strengthen confidence.

5. **Export hygiene** — `TeamRoleOrchestrator` is exported from `hepar/__init__.py`. Consider whether `TeamPlan` (the dataclass/schema for the plan input) should also be exported for downstream consumers to construct plans without reaching into `orchestrator.py` internals.

## Real-research fit

The design maps well to real HEP multi-agent review workflows:

- **Parallel Referee+Checker with clean-room isolation** directly models the standard practice of independent referee reports (e.g., two anonymous reviewers for a journal submission who must not see each other's drafts). This is the correct default for evidence-first research.
- **Stage-gated execution** correctly models phased review pipelines (e.g., consistency check → physics review → editorial review), where a failing early gate should block expensive downstream computation (lattice QCD cross-checks, loop integral evaluations).
- **Sequential non-clean-room** is appropriate for iterative refinement workflows (e.g., phenomenologist produces fit → theorist refines model → experimentalist validates against data), where each stage genuinely needs the prior stage's output.
- **Merge-back to IdeaStore** ensures that multi-agent review artifacts are first-class citizens alongside the original research artifacts, supporting full provenance chains for reproducibility audits.

One consideration for future milestones: real HEP collaborations often have **conditional fan-out** (e.g., if the Referee flags a potential anomaly, spawn a dedicated statistical analysis agent). The current flat `TeamPlan` → roles structure would need DAG-style execution for this. Not a blocker for M4.4.

## Robustness & safety

**Strengths:**
- Clean-room isolation prevents cross-contamination of independent assessments — this is the most important safety property for evidence-first research and it is tested.
- Ledger event emission at each lifecycle transition (`started`, `stage_blocked`, `merged`, `completed`) provides a complete audit trail. This is critical for reproducibility and for detecting orchestration failures in long-running campaigns.
- Stage-gate `all_must_succeed` is the conservative default — it fails closed rather than allowing potentially invalid results to propagate.

**Risks (non-blocking for M4.4):**
- **No idempotency guarantee documented.** If `run_team_plan` is retried after a partial failure (e.g., one parallel role completed but the other timed out), the behavior regarding already-written artifacts is unclear. Recommend documenting whether partial artifacts are cleaned up or whether the merge is idempotent.
- **Hallucination mitigation at merge boundary.** The merge-back writes role outputs as-is to IdeaStore. There is no schema validation or consistency check on the merged payload before it becomes a first-class artifact. For M4.4 this is acceptable; for production, consider a lightweight schema gate on merge output.
- **Event ordering under parallelism.** If `parallel` roles emit sub-events concurrently, the ledger ordering depends on the runtime executor's event dispatch. Documenting whether the ledger guarantees causal ordering or only wall-clock ordering would help downstream consumers.

## Specific patch suggestions

### 1. `src/idea_core/hepar/orchestrator.py` — Document merge strategy

**What to change:** Add a docstring or inline comment to the merge-back section of `run_team_plan` clarifying the merge semantics when parallel roles produce overlapping artifact keys.

```python
# In the merge-back section of run_team_plan:
# Merge strategy: role outputs are namespaced by role_id under
# artifacts/team_reviews/{campaign_id}/{plan_id}/.
# If two roles produce identically-named sub-artifacts, the last
# writer wins (dict.update order = role execution order for sequential,
# arbitrary for parallel). Callers requiring deterministic conflict
# resolution should use distinct role output schemas.
```

### 2. `src/idea_core/hepar/__init__.py` — Export `TeamPlan` schema

**What to change:** Add `TeamPlan` to the public exports so downstream consumers can construct plans without importing from the internal `orchestrator` module.

```python
# Current:
from hepar.orchestrator import TeamRoleOrchestrator

# Proposed:
from hepar.orchestrator import TeamRoleOrchestrator, TeamPlan
```

### 3. `tests/hepar/test_team_orchestrator_m44.py` — Add negative-path assertion for sequential directionality

**What to change:** In the sequential non-clean-room test (test 3), add an assertion that upstream role's input artifacts were *not* modified by downstream role outputs.

```python
# After asserting downstream received upstream outputs:
# Also verify upstream isolation (directionality guarantee):
upstream_role_inputs = executor.get_role_inputs(roles[0].role_id)
assert "downstream_output_key" not in upstream_role_inputs, \
    "Upstream role must not see downstream outputs in sequential mode"
```

### 4. `src/idea_core/hepar/orchestrator.py` — Add `stage_gated` policy extensibility hook

**What to change:** Refactor the gate check from an inline `all(...)` to a pluggable predicate, preparing for future gate policies without requiring a rewrite.

```python
# Current (inferred):
if not all(r.success for r in stage_results):
    emit("team_orchestration.stage_blocked", ...)
    return

# Proposed:
GATE_POLICIES = {
    "all_must_succeed": lambda results: all(r.success for r in results),
    # Future: "majority_succeed", "quorum", "custom_predicate"
}

gate_fn = GATE_POLICIES.get(plan.stage_gate_policy, GATE_POLICIES["all_must_succeed"])
if not gate_fn(stage_results):
    emit("team_orchestration.stage_blocked", ...)
    return
```

This is a ~5-line change that makes M5+ stage-gate extensions zero-cost.

### 5. `docs/reviews/bundles/` — Add merge idempotency note

**What to change:** In the M4.4 review bundle or a companion design note, add a brief section on retry/idempotency semantics.

```markdown
### Retry / Idempotency (M4.4 scope note)

Current behavior: `run_team_plan` is **not idempotent**. Re-running a plan
with the same `plan_id` will overwrite previously merged artifacts in IdeaStore
without conflict detection. Partial failures (e.g., one parallel role times out)
leave partial artifacts in the store; the merge event is not emitted until all
roles complete. Callers should treat a missing `team_orchestration.merged` event
as an incomplete run. Full idempotency guarantees are deferred to M5.
```
