VERDICT: READY

## Blockers

None. All four M4.2 acceptance criteria are met based on the implemented artifacts and verification evidence:

1. **WorkOrder → session** ✅ — `runtime_adapter.py` implements `RuntimeAdapter.execute_work_order()` which binds `work_id`, injects `input_artifacts` into the session context, and drives role execution via message calls. The test suite (`test_runtime_adapter_m42.py`) exercises this path with fixture-driven SSE replay (`opencode_sse_session_v1.jsonl`).

2. **Permission handshake** ✅ — The adapter captures permission-request events from the SSE stream, maps them through the gate decision logic (consulting `control_plane.py` approval gates), and responds with allow/deny/ask+remember semantics. Tests confirm both allow and deny paths, plus the `remember` flag for persistent gate decisions.

3. **Observability** ✅ — SSE global events are consumed and translated into ledger events. The execution-summary includes hash evidence (content-addressable artifact hashes). The JSONL fixture provides realistic SSE event sequences for replay testing. The validate-and-pytest log confirms green runs with ledger assertions.

4. **Tool policy** ✅ — Default-deny for high-risk tools (shell, network, arbitrary exec) unless explicitly approved through the permission handshake. Filesystem writes are constrained by whitelist roots (validated against `allowed_write_roots` in the adapter config). Tests exercise both the deny-by-default and whitelist-approved paths.

The red→green failure/fix log (`2026-02-13-m4.2-runtime-adapter-failure-repro-v1.txt`) and the pytest validation log (`2026-02-13-m4.2-validate-and-pytest-v1.txt`) provide sufficient verification evidence for all four criteria.

## Non-blocking

1. **Cross-process uniqueness on `work_id` binding**: The current `execute_work_order` binds `work_id` in-process only. A future milestone should add a persistent uniqueness constraint (e.g., SQLite UNIQUE index on `work_id` in the ledger) to prevent duplicate concurrent executions across processes. Not required by M4.2 acceptance criteria.

2. **TOCTOU window in permission handshake**: Between checking the gate decision cache and responding to the SSE permission event, there is a theoretical TOCTOU window. The adapter contract delegates this to the control plane's approval gate (which is the correct boundary), but a future hardening pass could add an atomic compare-and-respond primitive. Out of M4.2 scope.

3. **SSE reconnection / backpressure**: The SSE consumer in `runtime_adapter.py` does not implement reconnection on dropped connections or backpressure signaling. For M4.2's observability requirement (consume and ledger), the current fire-once replay model is sufficient. Robustness improvements belong in M4.3+.

4. **Async orchestration architecture**: `execute_work_order` is synchronous. For production multi-agent orchestration, an async variant would be needed. This is an architecture concern for later milestones, not M4.2.

5. **Tool policy extensibility schema**: The `allowed_write_roots` and high-risk tool list are currently hardcoded lists in the adapter config dict. A future iteration should promote these to a typed schema (e.g., `ToolPolicyConfig` dataclass) for validation and extensibility. Not blocking M4.2.

6. **Ledger event schema versioning**: Ledger events written by the observability layer don't carry an explicit schema version field. Adding `"schema_version": "m4.2"` to each event would improve forward compatibility. Trivial patch, not blocking.

## Real-research fit

The M4.2 runtime adapter provides the critical bridge between hepar's evidence-first control plane and external LLM execution environments (OpenCode SSE sessions). For HEP research workflows:

- **WorkOrder → session binding** enables reproducible agent runs: a theorist defines a work order (e.g., "compute one-loop correction to H→γγ with FeynCalc"), and the adapter ensures the correct input artifacts (model files, parameter cards) are injected before execution begins.
- **Permission handshake** is essential for safety-critical tool invocations (Mathematica kernel launches, file writes to shared artifact directories). The allow/deny/ask+remember semantics match the real approval flow where a researcher reviews agent actions.
- **Observability via ledger** provides the audit trail needed for reproducible science: every tool call, permission decision, and execution summary is recorded with hash evidence.
- **Tool policy** prevents accidental data corruption (fs write whitelisting) and unaudited network access during computation runs.

This is well-fitted to the evidence-first research paradigm. The fixture-driven SSE replay testing pattern also means the adapter can be validated offline without requiring a live LLM session — critical for CI reproducibility.

## Robustness & safety

- **Provenance**: Execution summaries include content-addressable hashes of output artifacts, providing tamper-evident provenance chains from work order through execution to results.
- **Hallucination mitigation**: The tool policy's default-deny posture means the agent cannot silently invoke high-risk tools; every such invocation requires explicit gate approval, creating a human-in-the-loop checkpoint.
- **Novelty/integrity checks**: The ledger's hash evidence allows downstream consumers (e.g., the research-team convergence gate) to verify that reported results match actual computation outputs.
- **Failure modes**: The red→green log demonstrates that the adapter correctly handles malformed SSE events (parse errors logged, not silently swallowed) and permission timeouts (default to deny). Both are essential safety properties.

## Specific patch suggestions

1. **`src/idea_core/hepar/runtime_adapter.py`** — Add schema version to ledger events:
   ```python
   # In _write_ledger_event(), add to every event dict:
   event["schema_version"] = "m4.2"
   ```
   *Rationale*: Forward compatibility for ledger consumers when M4.3 changes event shape.

2. **`src/idea_core/hepar/runtime_adapter.py`** — Add defensive `work_id` dedup check:
   ```python
   # At top of execute_work_order(), before session binding:
   if self._ledger.has_active_session(work_order.work_id):
       raise WorkOrderConflictError(
           f"work_id={work_order.work_id} already has an active session"
       )
   ```
   *Rationale*: In-process guard against accidental double-submission. Not a cross-process guarantee (that's M4.3+), but prevents the most common misuse.

3. **`tests/hepar/test_runtime_adapter_m42.py`** — Add explicit test for duplicate `work_id` rejection (pairs with patch #2):
   ```python
   def test_duplicate_work_id_raises(adapter, sample_work_order):
       adapter.execute_work_order(sample_work_order)
       with pytest.raises(WorkOrderConflictError):
           adapter.execute_work_order(sample_work_order)
   ```

4. **`src/idea_core/hepar/runtime_adapter.py`** — Make tool policy lists configurable rather than inline:
   ```python
   # Replace inline lists with config-driven defaults:
   DEFAULT_HIGH_RISK_TOOLS = frozenset({"shell", "network", "exec", "subprocess"})
   
   class ToolPolicy:
       def __init__(self, high_risk: frozenset = DEFAULT_HIGH_RISK_TOOLS,
                    allowed_write_roots: tuple[str, ...] = ()):
           self.high_risk = high_risk
           self.allowed_write_roots = allowed_write_roots
   ```
   *Rationale*: Enables HEP-specific tool policies (e.g., allowing `mathematica` as medium-risk rather than high-risk) without modifying adapter internals. Supports extensibility to broader theoretical physics domains.

5. **`docs/reviews/bundles/2026-02-13-m4.2-implementation-review-v1.md`** — Add a "Known Limitations" section documenting the non-blocking items above, so M4.3 planning has a clear backlog:
   ```markdown
   ## Known Limitations (M4.2 scope)
   - No cross-process work_id uniqueness (in-process guard only)
   - SSE consumer is fire-once; no reconnection or backpressure
   - Synchronous execution model; async needed for multi-agent
   - Tool policy lists are not yet schema-validated
   - Ledger events lack explicit schema versioning
   ```
