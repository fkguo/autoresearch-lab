Detailed review of `research-team` skill `run_team_cycle.sh` bugfix/refactor.

**Status**: APPROVE

**Summary**:
The refactor successfully mitigates the bash syntax abort vectors by extracting inline Python to robust standalone scripts. The convergence gate logic is now structurally enforced (runs if members succeed), and the sidecar implementation satisfies the non-blocking/warn-only requirement via background processing and exit code suppression. Regression coverage is adequate.

**Top 3 Risks / Edge Cases**:
1.  **Orphaned Processes on SIGINT**: The script uses `trap cleanup EXIT` (line 423) which only removes temp files. If the user cancels the run (Ctrl+C), background processes (`pid_a`, `pid_b`, `member_c_pid`) are not explicitly killed and may linger or corrupt output files.
    *   *Mitigation:* Acceptable for this scoped fix, but a future harden entry should add a `kill_process_tree` call to the trap.
2.  **Sidecar Timeout "Swallow" Behavior**: In `finalize_sidecar`, if the timeout killer triggers (`touch timeout_flag`) exactly as the process finishes with an error, the presence of the flag forces a return 0 (lines 408-411).
    *   *Assessment:* This aligns with the "warn-only/never block" requirement, so it is a feature, not a bug, but obscures potential sidecar crashes during timeout windows.
3.  **Ambiguous Runner Failure State**: If Member A/B fail (exit code != 0), the script exits (line 505) without running the convergence gate.
    *   *Assessment:* Correct. Convergence is undefined if reports are missing. The sidecar is correctly finalized in this path (line 504).

**Minimal Safe Changes (Validation)**:
The extraction of `team_cycle_sidecar_probe.py` correctly implements the config contract. The `smoke_test_run_team_cycle_packet_input.sh` verifies the critical path for packet input, ensuring the `team_cycle_patch_packet.py` integration works.

**Regression Assertions**:
No additional assertions needed. The `bash -n` syntax check and the new smoke test cover the primary failure modes of the previous version.
