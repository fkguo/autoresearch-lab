# Code Review: run-team-cycle-bugfix-r1

## Decision: **APPROVE** (with minor recommendations)

The refactor correctly addresses the root cause (heredoc syntax fragility) and maintains the critical invariant: once member A/B reports exist, convergence gate + trajectory updates must complete.

---

## Top 3 Risks / Edge Cases

### 1. **Helper script import failures silently swallowed**
`team_cycle_find_config_path.py` and `team_cycle_autofill_enabled.py` catch `Exception` broadly and return `0`/"0" on import failure. If `team_config.py` is missing or broken, the script proceeds with degraded behavior (no config discovery, no autofill) without any stderr warning.

**Risk level:** Low (fail-safe direction), but debugging production issues becomes harder.

### 2. **`set +e` window around convergence gate**
```bash
set +e
python3 "${GATE_SCRIPT}" --member-a "${member_a_out}" --member-b "${member_b_out}"
gate_code=$?
set -e
```
If any command *between* `set +e` and `set -e` fails silently (e.g., variable expansion error, missing file), it won't abort—but could leave `gate_code` unset or stale. Current code looks safe, but this pattern is fragile under future edits.

**Risk level:** Low now; medium under maintenance.

### 3. **Sidecar background PID race on fast exit**
If the sidecar process exits immediately (e.g., model config error), `${member_c_pid:-}` may reference a dead process before `finalize_sidecar` runs. The existing `wait` + timeout logic should handle this, but there's no explicit check that the PID is still valid before waiting.

**Risk level:** Low (WARN-only path), but could produce confusing log noise.

---

## Minimal Safe Improvements

1. **Add stderr warnings for import failures** in `team_cycle_find_config_path.py` and `team_cycle_autofill_enabled.py`:
   ```python
   except Exception as e:
       print(f"WARN: config discovery failed: {e}", file=sys.stderr)
       return 0
   ```

2. **Narrow the `set +e` window** or use subshell isolation:
   ```bash
   gate_code=$(set +e; python3 "${GATE_SCRIPT}" ... ; echo $?)
   ```
   Or simply ensure `gate_code` is explicitly initialized before the block.

3. **Add a 1-line existence check** in `finalize_sidecar` before `wait`:
   ```bash
   kill -0 "${pid}" 2>/dev/null || { echo "[sidecar] process already exited"; return 0; }
   ```

---

## Regression Test Recommendation

**Current coverage is adequate** for the specific bug. However, consider adding one assertion to the existing `smoke_test_convergence_gate_sidecar.sh`:

```bash
# Assert: trajectory_index.json contains stage="converged" or "not_converged" (never empty/missing)
grep -qE '"stage":\s*"(converged|not_converged)"' "${TEAM_DIR}/trajectory_index.json" \
  || fail "trajectory_index.json missing valid stage after full cycle"
```

This locks the invariant that the bugfix was designed to protect.

---

## Summary

| Aspect | Assessment |
|--------|------------|
| Root cause addressed | ✅ Heredocs eliminated |
| Convergence invariant preserved | ✅ Gate runs after A/B reports |
| Sidecar non-blocking | ✅ WARN-only, runs after gate |
| Behavior stability | ✅ No CLI/output changes |
| Test coverage | ✅ Sufficient (minor addition suggested) |

**Ship it.**
