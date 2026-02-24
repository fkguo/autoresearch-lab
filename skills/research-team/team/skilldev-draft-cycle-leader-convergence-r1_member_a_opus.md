I'll analyze this draft-cycle enhancement proposal systematically, focusing on semantic correctness, gate enforcement, and contract enforceability.

---

**DECISION: REQUEST_CHANGES**

**BLOCKERS:**

1. **Convergence gate bypass when `--no-require-convergence` is set but gate still runs** — The spec says the gate produces artifacts (`*_convergence_log.md`, `*_converged_summary.md`) regardless of `--require-convergence`, but doesn't clarify whether exit code propagation is suppressed or just logged. If the gate runs, writes "not_converged" to the log, but the script exits 0 because `require_convergence=false`, downstream consumers reading `*_convergence_log.md` will see a non-converged state with a successful exit. **Fix:** Either (a) don't write `*_converged_summary.md` when not converged (only write `*_convergence_log.md`), or (b) add a `converged: true|false` machine-readable line to the summary so consumers don't rely on exit code alone.

2. **Contract mismatch tolerance undefined for "## Blocking …" section parsing** — The gate counts list items under "## Blocking …" and compares to declared `Blocking issues count: N`. Spec says mismatch → exit 2, but doesn't define: (a) what counts as a list item (` - `, `* `, `1. `?), (b) whether nested bullets count, (c) whether `(none)` under the heading counts as 0 items or 1 item containing the string "(none)". **Fix:** `check_draft_convergence.py` must specify exact regex for item counting (e.g., `^[ ]*[-*][ ]` at line start, excluding lines matching `^\s*[-*]\s*\(none\)\s*$`). Document in docstring.

3. **Member C runner invocation path ambiguous** — Spec lists `--member-c-runner` flag but doesn't specify the default. Member A uses `claude`, Member B uses `gemini_runner.py`. If Member C (Leader) defaults to `claude` but the leader prompt expects tool access patterns different from Member A's, the runner mismatch could cause silent failures. **Fix:** Explicitly state default in spec (likely `claude`) and confirm `system_draft_member_c_leader.txt` prompt is compatible with that runner's tool semantics.

4. **Trajectory stage `draft_member_reports` written before all three reports complete** — If Member C fails mid-run, does `draft_member_reports` still get written? A partial stage marker could mislead recovery logic. **Fix:** Rename to `draft_member_reports_complete` and write only after all three succeed, or use `draft_member_a_complete`, `draft_member_b_complete`, `draft_member_c_complete` individually.

5. **`next_draft_tag.py` collision with manual tags** — Script scans `*_draft_member_*.md` to suggest next tag, but if user manually creates `D0-r3` after `D0-r1` (skipping r2), the script would suggest `D0-r2`, causing collision. **Fix:** Scan for highest `-rN` suffix numerically, not just count of files.

**NONBLOCKING:**

- **Verdict line regex fragility** — Requiring exact `Verdict: ready for review cycle | needs revision` means a reviewer outputting `Verdict: Ready for review cycle` (capital R) fails. Consider case-insensitive match for the verdict value portion only (not the key).

- **`--member-c-output-format` flag undocumented** — Listed in flags but no explanation of valid values or default. Presumably `md` but should be explicit.

- **`team/LATEST_DRAFT.md` update timing** — Spec says `update_project_map.py` adds links to convergence artifacts, but doesn't clarify whether this happens before or after convergence gate runs. If before, links point to nonexistent files on first run.

- **Config key `draft_review.leader_system_prompt` vs flag `--member-c-system`** — Two names for the same thing (config vs CLI). Document that CLI overrides config.

**NOTES:**

- The decision to default `require_convergence: true` in the scaffold template but `false` in lib is reasonable for progressive adoption—new projects get strict semantics, existing projects must opt in. Document this asymmetry in the scaffold's README.

- Exit code 2 for contract violation is a good choice (distinct from "not converged" = 1), but consider whether repeated exit-2 failures warrant a `--strict-contract` flag to downgrade to exit 1 + warning during initial adoption.

- The question "Is the contract too brittle?" — Yes, slightly. The `(none)` edge case and list-item regex ambiguity (BLOCKER #2) are the main risks. Once those are fixed with explicit parsing rules, the contract is appropriately strict.

- Consider adding a `--dry-run` mode to `check_draft_convergence.py` that parses and validates contract format without checking convergence, useful for prompt iteration.
