VERDICT: READY

## Blockers

No blockers identified. The implementation is well-scoped and meets its stated contract requirements:

1. **Schema SSOT preserved**: The explicit exclusion of `contracts/idea-generator-snapshot` modifications is honored, and the checklist confirms no drift.
2. **34 tests pass** including the new M2.6-specific suites, with schema validation green.
3. **Idempotency semantics are complete**: Both replay (same key + payload → `is_replay=true`) and conflict (same key + different payload → error with `payload_hash`) are covered.
4. **Artifact provenance chain is intact**: `new_nodes_artifact_ref` links to actual IdeaStore entries, and per-tick operator trace artifacts carry `operator_id/backend_id/island_id`.
5. **Downstream closable**: New nodes flow through `eval.run → rank.compute → node.promote` without modification to those downstream methods.

## Non-blocking

1. **Operator registry is implicit**: The round-robin selection over `[dummy.expand.bridge, dummy.constraint.shift]` appears hardcoded. Before M2.7, extract operator discovery into a lightweight registry (e.g., `OperatorRegistry.register(operator_id, cls)` with `list_operators()`) so real operators don't require editing the step loop.

2. **Budget accounting granularity**: `steps_used` and `nodes_used` are both incremented in `search.step`, but there's no documented budget-exceeded behavior. Consider adding a `BudgetExhausted` error variant to the `search_step_result_v1` schema (as an optional `error` union member) before M2.7 to avoid a breaking schema change later.

3. **Operator trace artifact naming**: The trace artifacts presumably use a path convention, but the design packet doesn't specify the naming scheme. Pin it now (e.g., `artifacts/search/{island_id}/{tick}/{operator_id}.trace.json`) to prevent path-convention drift across operators.

4. **Missing negative-path test for malformed operator output**: The two dummy operators always produce valid `idea_node_v1` payloads. Add at least one test with a deliberately malformed operator output to verify that the pre-commit schema validation gate rejects it and the tick is cleanly rolled back (no partial store mutation).

5. **Deterministic round-robin state persistence**: If the process restarts mid-island, does the round-robin pointer reset? If so, idempotent replay is fine (same sequence), but document this explicitly so future stochastic operators know they must handle replay-safe state.

## Real-research fit

**HEP workflow alignment**: The operator abstraction maps well to real theory-exploration patterns:

- `dummy.expand.bridge` → future instantiation as "bridge two Lagrangian sectors" (e.g., portal couplings between SM and hidden sector).
- `dummy.constraint.shift` → future instantiation as "tighten parameter space given new experimental bound" (e.g., LHC Run-3 exclusion limits).

**Evidence-first compliance**: The design correctly requires schema validation of every new node *before* commit, and the `origin` + `operator_trace` + `rationale_draft` fields provide the provenance chain needed for downstream audit. When real LLM-backed operators replace the dummies, the `rationale_draft` field is the natural insertion point for chain-of-thought evidence that referees can inspect.

**Extensibility path to broader theory physics**: The operator interface is domain-agnostic at the type level (operators produce `idea_node_v1` payloads). HEP-specific semantics live in the `idea_card` sub-schema, which is already an opaque payload slot. This means condensed-matter or astro-particle operators can be added without modifying the engine, only extending `idea_card` variants—a clean boundary.

**Gap**: There is no explicit "novelty check" stage between operator output and commit. In real HEP research, a proposed idea must be checked against existing literature/nodes for redundancy. The current design defers this to `eval.run`, but a lightweight embedding-based or hash-based dedup gate at commit time would significantly reduce downstream noise once LLM operators are active.

## Robustness & safety

1. **Hallucination mitigation (future-proofing)**: The dummy operators are deterministic, so hallucination is not a current risk. However, the operator interface should already define an `evidence_refs: list[str]` field in the operator output contract, even if dummies return `[]`. This forces real operators to surface their evidence at creation time rather than retrofitting.

2. **Idempotency under concurrent access**: The prepared-commit check compares `new_nodes_artifact_ref` with store state, but there's no mention of locking or optimistic concurrency control. If two `search.step` calls race on the same island, the second could see stale state. For M2.6 (single-threaded dummy), this is fine, but add a `version_vector` or `last_commit_hash` to the island state before M2.7.

3. **Replay determinism guarantee**: Round-robin over a fixed operator list is deterministic only if the list order is stable. If `operators.py` reorders the list (e.g., due to import order or dict iteration), replays produce different nodes. Pin the operator order explicitly (e.g., sorted by `operator_id` string) or store the sequence in the trace.

4. **Schema validation performance**: Validating every node against `idea_node_v1.schema.json` on every tick is correct but could become a bottleneck at scale. Consider caching the compiled schema validator (e.g., `jsonschema.validators.validator_for(schema)(schema)` instantiated once at engine init).

## Specific patch suggestions

### 1. `src/idea_core/engine/operators.py` — Add `evidence_refs` to operator output contract

```python
# Current (inferred):
@dataclass
class OperatorOutput:
    idea_card: dict
    rationale_draft: str
    operator_trace: dict

# Proposed addition (line ~15, after existing fields):
@dataclass
class OperatorOutput:
    idea_card: dict
    rationale_draft: str
    operator_trace: dict
    evidence_refs: list[str] = field(default_factory=list)  # NEW: provenance anchors; empty for dummies
```

### 2. `src/idea_core/engine/operators.py` — Add minimal operator registry

```python
# After the OperatorOutput dataclass, add:

class OperatorRegistry:
    """Singleton registry for search operators. Sorted iteration guarantees replay determinism."""
    _operators: dict[str, type] = {}

    @classmethod
    def register(cls, operator_id: str, operator_cls: type) -> None:
        cls._operators[operator_id] = operator_cls

    @classmethod
    def list_operators(cls) -> list[tuple[str, type]]:
        return sorted(cls._operators.items(), key=lambda x: x[0])

    @classmethod
    def get(cls, operator_id: str) -> type:
        return cls._operators[operator_id]

# At module bottom, auto-register dummies:
OperatorRegistry.register("dummy.constraint.shift", DummyConstraintShiftOperator)
OperatorRegistry.register("dummy.expand.bridge", DummyExpandBridgeOperator)
```

### 3. `src/idea_core/engine/service.py` — Use registry instead of hardcoded list

```python
# In search_step() method, replace hardcoded operator list:
# BEFORE (inferred):
#   operators = [DummyExpandBridgeOperator(), DummyConstraintShiftOperator()]
#   op = operators[tick % len(operators)]

# AFTER:
from idea_core.engine.operators import OperatorRegistry

operator_entries = OperatorRegistry.list_operators()  # sorted → deterministic
op_id, op_cls = operator_entries[tick % len(operator_entries)]
op = op_cls()
```

### 4. `tests/engine/test_search_step_operator_m26.py` — Add malformed-output rejection test

```python
def test_malformed_operator_output_rejected(engine, island_id):
    """Operator producing invalid idea_node_v1 must not mutate store."""
    from idea_core.engine.operators import OperatorRegistry, BaseOperator, OperatorOutput

    class BadOperator(BaseOperator):
        operator_id = "test.bad"
        def run(self, context):
            return OperatorOutput(
                idea_card={"missing_required_field": True},  # invalid
                rationale_draft="",
                operator_trace={},
            )

    OperatorRegistry.register("test.bad", BadOperator)
    node_count_before = len(engine.node_list(island_id))
    try:
        result = engine.search_step(island_id)
    finally:
        OperatorRegistry._operators.pop("test.bad", None)
    # Store must be unchanged
    assert len(engine.node_list(island_id)) == node_count_before
```

### 5. `src/idea_core/engine/service.py` — Cache compiled schema validator

```python
# At module or class level:
import jsonschema
from functools import lru_cache

@lru_cache(maxsize=8)
def _compiled_validator(schema_path: str):
    import json
    with open(schema_path) as f:
        schema = json.load(f)
    cls = jsonschema.validators.validator_for(schema)
    return cls(schema)

# In the node validation call, replace:
#   jsonschema.validate(node_data, idea_node_schema)
# With:
#   _compiled_validator(IDEA_NODE_SCHEMA_PATH).validate(node_data)
```

### 6. Documentation — Pin artifact path convention

Add to `docs/conventions/artifact-paths.md` (or inline in `operators.py` docstring):

```markdown
## Search Operator Trace Artifacts

Path: `artifacts/search/{island_id}/{tick:04d}/{operator_id}.trace.json`

Contents: Full `OperatorOutput` plus `backend_id`, `timestamp_utc`, `commit_hash`.
Immutable after write. Referenced by `new_nodes_artifact_ref` in `search_step_result_v1`.
```
