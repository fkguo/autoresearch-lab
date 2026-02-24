VERDICT: READY

## Blockers
- None.

## Non-blocking
- `HeparControlPlaneStore._append_jsonl` rewrites the entire ledger file on every event, which ensures atomicity but may become a performance bottleneck for very large ledgers; consider an append-only strategy with periodic rotation if ledger size scales significantly.
- `HeparSkillBridge._load_replay_index` and `_save_replay_index` read and write the entire `replay_index.json` file per command execution; for high-frequency RPC scenarios, an incremental or database-backed index might be preferable.

## Real-research fit
- The generic path hardening and environment whitelisting are essential for running research code in diverse environments while preventing unauthorized access to the host system.
- Replay concurrency safety ensures that parallel research workflows (e.g., parallel search steps) do not corrupt the execution history or artifact mapping.

## Robustness & safety
- `safe_resolve_under` provides strong protection against directory traversal and path escape by combining `resolve()` with relative path verification.
- Atomic writes via `os.replace` and `fsync` prevent partial or corrupted state files in the event of a system crash or process interruption.
- Reactive permission handling allows for human-in-the-loop or automated gatekeeping of high-risk tools (shell, fs, mcp) without blocking the entire event stream.

## Specific patch suggestions
- None.
