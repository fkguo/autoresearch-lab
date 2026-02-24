Here is my code review of the hepar control-plane modules.

**1-line summary:** The codebase has solid auditability infrastructure but contains path-traversal vulnerabilities, subprocess injection risks, race conditions in shared state, and several correctness issues around error handling and resource cleanup.

## Correctness

- **Severity: H** — Location: `milestone_pipeline.py` / `_run_command` — Problem: The function computes `_selected_env(env_whitelist)` and discards the result (`_ = ...`), then passes the full `os.environ.copy()` to `subprocess.run`, meaning the env_whitelist has no filtering effect on the actual subprocess execution environment. — Suggestion: Either filter `env` to only contain whitelisted keys (if that's the intent) or remove the dead call to avoid confusion about what environment the subprocess actually sees.

- **Severity: M** — Location: `milestone_pipeline.py` / `run_dual_review` — Problem: The two reviewers run sequentially (claude first, then gemini), so if claude succeeds but gemini fails, the function raises without archiving claude's output, losing partial evidence. — Suggestion: Consider archiving whatever outputs exist before raising, or wrap both invocations so partial results are preserved for debugging.

- **Severity: M** — Location: `milestone_pipeline.py` / `_normalize_leading_blank_lines` — Problem: If the output file doesn't contain any line with "VERDICT:", the function strips leading blank lines but the subsequent `_parse_verdict_first_line` will fail with a confusing error, since the break condition is never hit and `lines` may be unmodified after the loop. — Suggestion: Add explicit handling or a clearer error when no VERDICT line is found during normalization.

- **Severity: M** — Location: `campaign_runner.py` / `run_campaign` — Problem: When a case is skipped (existing results with `status == "ok"`), the manifest entry omits `config_path` and `attempts`, making the manifest schema inconsistent across skipped vs. executed cases. — Suggestion: Include `config_path` and `attempts: []` in skipped case manifests for schema uniformity.

- **Severity: M** — Location: `orchestrator.py` / `_execute_parallel` — Problem: `future.result()` can raise an exception if `_execute_role` itself raises (despite the internal try/except, `ThreadPoolExecutor.submit` propagates unhandled exceptions from the callable). The `_execute_role` method has a catch-all, but if `WorkResult(...)` construction fails (e.g., status validation), the exception escapes. — Suggestion: Wrap `future.result()` in a try/except within the `as_completed` loop to handle unexpected failures gracefully.

- **Severity: L** — Location: `runtime_adapter.py` / `ingest_sse_events` — Problem: The `has_ledger_event` dedup check re-reads and parses the entire ledger file on every event, giving O(n²) behavior; but more importantly, the ledger events written by `ingest_sse_events` don't include `event_key` in all cases (e.g., `runtime.permission_requested` from `handle_permission_request` has no `event_key`), so the dedup check will never match those events. — Suggestion: Ensure `event_key` is consistently included in all ledger events that should be deduped, or use an in-memory set for the dedup within a single ingestion session.

- **Severity: L** — Location: `review_audit.py` / `_detect_meta_format` — Problem: `agent_team_v1` format check looks for `"reviewer_a"` which also exists in `milestone_pipeline_v1`, so detection depends on the check for `"schema_version"` and `"paths"` being tested first; if a milestone_pipeline meta happens to include those keys, it will be misclassified. — Suggestion: Make the detection more robust by checking for keys unique to each format, or add an explicit `format` field to meta files.

## Reliability

- **Severity: H** — Location: `milestone_pipeline.py` / `run_review_convergence` — Problem: The convergence loop has no backoff or delay between rounds; if both reviewer commands fail instantly (e.g., missing binary), it will spin through `max_model_failures` (default 10) or `max_rounds` (default 100) iterations as fast as possible, hammering the system. — Suggestion: Add an exponential or fixed backoff sleep after model failures.

- **Severity: H** — Location: `runtime_adapter.py` / `ingest_sse_events` — Problem: The producer thread is started as a daemon and never joined; if `stream_global_events` blocks indefinitely or the producer hangs, there's no cleanup mechanism and the thread leaks. — Suggestion: Keep a reference to the thread and join it with a timeout after the consumer loop exits, or use a cancellation mechanism.

- **Severity: M** — Location: `skill_bridge.py` / `execute` — Problem: The replay index is loaded, checked, and saved without any file locking; concurrent calls with different command_ids could cause a lost-update race on `replay_index.json`. — Suggestion: Use file locking (e.g., `fcntl.flock` or a lockfile) around the replay index read-modify-write cycle.

- **Severity: M** — Location: `milestone_pipeline.py` / `_write_json` (module-level) — Problem: Unlike `HeparControlPlaneStore._write_json`, this version writes directly to the target path without atomic rename, risking a corrupt file if the process is interrupted mid-write. — Suggestion: Use the same write-to-tmp-then-rename pattern used in `control_plane.py`.

- **Severity: M** — Location: `milestone_pipeline.py` / `run_dual_review` — Problem: The subprocess calls for claude and gemini have no timeout; a hung reviewer process will block the convergence loop forever. — Suggestion: Pass a `timeout` parameter to `subprocess.run` and handle `subprocess.TimeoutExpired`.

- **Severity: L** — Location: `control_plane.py` / `has_ledger_event` — Problem: This reads and parses the entire ledger file on every call with no caching; for large ledgers this becomes a performance and reliability issue (file could be very large). — Suggestion: Consider an in-memory index or at minimum cache the parsed events within a session.

## Security

- **Severity: H** — Location: `milestone_pipeline.py` / `_resolve_cmd` — Problem: The `{config}` and `{run_dir}` placeholders are replaced via simple string substitution on user-controlled config values; a malicious config_path containing shell metacharacters or path traversal sequences could inject unexpected arguments. — Suggestion: Validate that resolved paths are within expected boundaries, and consider using parameterized invocation rather than string template substitution.

- **Severity: H** — Location: `milestone_pipeline.py` / `run_gate_check` — Problem: `_safe_resolve(_safe_resolve(workspace_root) / str(rel))` for `novelty_paths` and `required_artifacts` does not verify that the resolved path stays within `workspace_root`, enabling path traversal (e.g., `rel = "../../etc/passwd"`). — Suggestion: After resolving, assert `resolved.relative_to(workspace_root_resolved)` and reject paths that escape.

- **Severity: H** — Location: `milestone_pipeline.py` / `run_board_sync` — Problem: The command allowlist only checks `command[0] == "gh"` and `command[1] == "project"`, but arbitrary arguments after that are passed to `subprocess.run` unchecked. A malicious config could inject `gh project --exec ...` or similar. — Suggestion: Validate the full subcommand structure or use a stricter allowlist of specific `gh project` subcommands.

- **Severity: M** — Location: `milestone_pipeline.py` / `run_external_kernel` — Problem: Arbitrary commands from `command_template` in user-provided JSON config are executed via `subprocess.run` with no sandboxing or allowlist beyond the template mechanism. — Suggestion: Add an allowlist of permitted command prefixes or require explicit opt-in for external command execution.

- **Severity: M** — Location: `skill_bridge.py` / `_artifact_ref_to_path` — Problem: The method converts `file://` URIs to `Path` objects, including support for network paths (`//netloc/path`); a crafted artifact_ref could point to arbitrary filesystem or UNC paths. — Suggestion: Validate that the resolved path falls within the expected artifact root directory.

- **Severity: M** — Location: `milestone_pipeline.py` / `_append_jsonl` in `run_dual_review` — Problem: Full stdout/stderr from subprocess runs (including potentially sensitive data like API keys in error messages) is written to the trace JSONL file. — Suggestion: Truncate or sanitize stdout/stderr before persisting to trace files, or at minimum document that trace files may contain sensitive output.

## Maintainability

- **Severity: M** — Location: multiple files — Problem: `_safe_resolve`, `_write_json`, and `_append_jsonl` are duplicated across `milestone_pipeline.py`, `campaign_runner.py`, `review_audit.py`, `skill_bridge.py`, and `control_plane.py`, with slight behavioral differences (e.g., atomic write in control_plane vs. direct write elsewhere). — Suggestion: Extract these into a shared utility module with a single, consistent implementation (preferably the atomic-write version).

- **Severity: M** — Location: `milestone_pipeline.py` / `run_milestone_pipeline` — Problem: This ~60-line function does orchestration, error handling, and result assembly all in one monolithic block, making it hard to test individual stages in isolation. — Suggestion: Extract each pipeline stage (external_run, review, gate, tracker, board_sync) into individually testable helper functions.

- **Severity: L** — Location: `runtime_adapter.py` / `ToolPolicyEnforcer.is_tool_allowed` — Problem: The method has a comment about TOCTOU but the code still uses `exists()` followed by `resolve()`, creating exactly the window it warns about. — Suggestion: Either document this as accepted risk more explicitly or use `O_NOFOLLOW` style operations if available.

- **Severity: L** — Location: `orchestrator.py` / `run_team_plan` — Problem: The `stage_gated` branch reuses `_execute_parallel` but the variable name `staged` shadows the conceptual difference from the `parallel` policy, making the code harder to follow. — Suggestion: Rename the variable and add a comment clarifying that stage_gated runs each stage's roles in parallel but gates between stages.

- **Severity: L** — Location: `campaign_runner.py` / `run_campaign` — Problem: The bounds aggregation loop at the bottom silently swallows all exceptions with a bare `except Exception: continue`, hiding data corruption or type errors. — Suggestion: Use a more specific exception type (`KeyError`, `TypeError`, `ValueError`) or at least log the skipped entry.

## Performance

- **Severity: M** — Location: `control_plane.py` / `has_ledger_event` — Problem: Called from `ingest_sse_events` for every SSE event, each call re-reads and parses the entire ledger file from disk, giving O(n*m) disk I/O where n = events ingested and m = ledger size. — Suggestion: Cache ledger events in memory during an ingestion session, or maintain a hash-set index of `(session_id, event_key)` tuples.

- **Severity: L** — Location: `skill_bridge.py` / `_load_replay_index` — Problem: The entire replay index is loaded from disk on every `execute()` call, which will degrade as the index grows. — Suggestion: Consider an LRU cache or lazy-load strategy, or keep the index in memory with periodic persistence.

## Tests

- **Severity: H** — Location: all files — Problem: No test files are included in the review scope; critical paths like path traversal in `run_gate_check`, the convergence loop termination conditions, atomic write guarantees, and the env_whitelist no-op bug have no visible test coverage. — Suggestion: Add tests for: (1) path traversal rejection in gate checks, (2) convergence loop halting for each stop_reason, (3) campaign retry logic with partial failures, (4) replay index conflict detection in skill_bridge, (5) ToolPolicyEnforcer edge cases (symlinks, non-existent paths).

- **Severity: M** — Location: `runtime_adapter.py` / `ingest_sse_events` — Problem: The threading + queue architecture is inherently flaky to test; the `# pragma: no cover` on the producer's exception handler suggests this path isn't tested. — Suggestion: Add integration tests using a mock client that raises during streaming, and verify the `sse_stream_failed` ledger event is recorded.

- **Severity: M** — Location: `review_audit.py` — Problem: The `_detect_meta_format` function has fragile heuristics that should be covered by tests with both formats and edge cases (e.g., a meta file containing keys from both formats). — Suggestion: Add unit tests for format detection with overlapping key sets.

## Docs/UX

- **Severity: M** — Location: `milestone_pipeline.py` / `run_milestone_pipeline` — Problem: The expected JSON config schema is not documented anywhere; users must read the source to understand required keys like `review.claude_runner`, `gate.schema_path`, etc. — Suggestion: Add a JSON Schema file or docstring documenting the pipeline config format.

- **Severity: M** — Location: `campaign_runner.py` / `run_campaign` — Problem: The relationship between `run_external_kernel` writing `results.json` and the campaign runner checking for it is implicit; there's no documentation that the external command is expected to produce `results.json` in the case directory. — Suggestion: Document the external kernel contract (expected output files and their schema) in a docstring or README.

- **Severity: L** — Location: `control_plane.py` — Problem: The docstring says "M4 control-plane workflows" but the module-level context and milestone_pipeline refer to "M5"; the version reference is inconsistent. — Suggestion: Align version references across all modules.
