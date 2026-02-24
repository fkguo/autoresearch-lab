# W5-05 Review Packet (Round 001)

## Scope
Review W5-05 control-plane hardening in `idea-core`/`hepar` as generic tooling capabilities (not tied to any test-instance research content).

## Hard requirements under review
1. Path boundary hardening via shared `safe_resolve_under(root, rel)`:
   - reject absolute path
   - reject `..` traversal
   - reject symlink escape
   - reject `file://` netloc bypass
2. Atomic writes for critical JSON/JSONL/MD text outputs.
3. Reviewer/external command timeout + retry backoff.
4. Ledger dedup performance fix (no per-event full ledger scan).
5. Runtime permission request reactive handling during SSE ingestion (request -> resolve loop).
6. Replay index concurrency safety.
7. `env_whitelist` recorded policy must match actual runtime payload passed to client.

## Ground-truth file mapping
- Path + file URI guards:
  - `src/idea_core/hepar/fs_ops.py`
  - usage in `src/idea_core/hepar/skill_bridge.py`
  - usage in `src/idea_core/hepar/runtime_adapter.py`
- Atomic writes:
  - `src/idea_core/hepar/fs_ops.py` (`atomic_write_text`, `atomic_write_json`)
  - `src/idea_core/hepar/control_plane.py`
  - `src/idea_core/contracts/bundle.py`
  - `src/idea_core/demo/m2_12_replay.py`
- Timeout/backoff:
  - `src/idea_core/hepar/retry_ops.py`
  - `src/idea_core/hepar/skill_bridge.py`
  - `src/idea_core/hepar/runtime_adapter.py`
- Ledger dedup index:
  - `src/idea_core/hepar/control_plane.py`
  - `src/idea_core/hepar/runtime_adapter.py`
- Permission reactive loop:
  - `src/idea_core/hepar/runtime_adapter.py` (`ingest_sse_events`, `handle_permission_request`)
- Replay concurrency:
  - `src/idea_core/hepar/skill_bridge.py` (`_replay_index_lock`, per-command lock)
- Env whitelist consistency:
  - `src/idea_core/hepar/runtime_adapter.py` (`_prepare_runtime_tool_policy`)

## Verification evidence
- `docs/reviews/bundles/2026-02-15-w5-05-validate-and-pytest-v1.txt`
- Command:
  - `make validate && pytest`
- Result:
  - `105 passed`

## Reviewer boundaries
- Evaluate generic control-plane hardening quality only.
- Reject any suggestion that introduces test-instance-specific logic.
- If claiming a blocker, cite exact file path + exact missing invariant.

## Required verdict format
First line exactly `VERDICT: READY` or `VERDICT: NOT_READY`.
