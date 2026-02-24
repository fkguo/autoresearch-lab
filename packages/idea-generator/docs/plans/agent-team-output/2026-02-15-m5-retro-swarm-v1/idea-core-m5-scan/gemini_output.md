The Hepar control-plane implementation provides a structured evidence-first workflow but contains critical O(N^2) scaling bottlenecks in ledger ingestion, lacks a reactive event loop for runtime permissions, and has gaps in path-traversal protection for gate/audit components.

### Correctness
- Severity: H | Location: `runtime_adapter.py` / `OpenCodeRuntimeAdapter` | Problem: `execute_work_order` calls `ingest_sse_events` sequentially after `post_message`, which prevents reactive handling of `permission_request` events during an active agent turn. | Suggestion: Run `ingest_sse_events` in a separate thread or use an async event loop to process and respond to permissions while `post_message` is pending.
- Severity: M | Location: `milestone_pipeline.py` / `_run_command` | Problem: The `env_whitelist` is used for manifest reporting but not applied to the actual subprocess `env`, leading to environment leakage and reproducibility drift. | Suggestion: Filter the subprocess environment using the whitelist before execution.
- Severity: L | Location: `milestone_pipeline.py` / `_epoch_seconds` | Problem: Uses `time.time()` for wall-clock delta calculations, which is susceptible to system clock jumps or NTP adjustments. | Suggestion: Use `time.monotonic()` for all duration and timeout-based logic.

### Reliability
- Severity: H | Location: `runtime_adapter.py` / `ingest_sse_events` | Problem: Calls `has_ledger_event` in a loop, which parses the entire ledger file from disk for every incoming SSE event, leading to O(N^2) performance degradation. | Suggestion: Maintain an in-memory set of processed event keys to avoid redundant disk I/O and parsing.
- Severity: M | Location: `milestone_pipeline.py` / `append_tracker_entries` | Problem: Tracker file updates lack atomic safety (direct `write_text`), which can result in a corrupted or truncated tracker if the process is interrupted. | Suggestion: Implement a temporary-file-and-replace pattern to ensure atomic updates.
- Severity: M | Location: `skill_bridge.py` / `execute` | Problem: The `replay_index.json` is fully re-read and re-written for every RPC call, which will not scale as the project history grows. | Suggestion: Switch to an append-only ledger or a more efficient key-value storage for replay records.

### Security
- Severity: H | Location: `milestone_pipeline.py` / `run_gate_check` | Problem: Novelty and robustness artifact path validation resolves paths but does not verify they remain within the `workspace_root` boundary. | Suggestion: Enforce a sandbox boundary by checking that resolved artifact paths are relative to the workspace root.
- Severity: H | Location: `review_audit.py` / `audit_review_items` | Problem: Path resolution for meta files lacks a boundary check against `workspace_root`, potentially allowing an attacker to audit sensitive files outside the workspace. | Suggestion: Verify that resolved meta and output paths are contained within the designated workspace directory.

### Maintainability
- Severity: M | Location: All `hepar` files | Problem: `_write_json` is duplicated across multiple files with inconsistent safety guarantees (some use `fsync`/`replace`, others do not). | Suggestion: Consolidate JSON I/O into a shared utility module with standard atomic write semantics.
- Severity: L | Location: `milestone_pipeline.py` / `run_dual_review` | Problem: Reviewer model names (`opus`, `gemini-3-pro-preview`) are hardcoded, making it difficult to upgrade or switch models without code changes. | Suggestion: Allow model names to be overridden via the pipeline configuration.

### Performance
- Severity: L | Location: `milestone_pipeline.py` / `run_dual_review` | Problem: Claude and Gemini reviews are executed serially despite being independent, which unnecessarily doubles the duration of review rounds. | Suggestion: Parallelize the execution of the two reviewer commands using a thread pool or async subprocesses.

### Tests
- Severity: M | Location: `milestone_pipeline.py` / `run_milestone_pipeline` | Problem: The pipeline executes complex operations without first validating the input configuration against a schema. | Suggestion: Add a pre-flight schema validation step for the pipeline configuration file using the `Draft202012Validator`.

### Docs/UX
- Severity: L | Location: `milestone_pipeline.py` / `run_board_sync` | Problem: Command failure details for GitHub project sync are hidden in log files, providing poor visibility to the user during CLI runs. | Suggestion: Surface a summary of stdout/stderr or a direct link to the log file upon command failure.
