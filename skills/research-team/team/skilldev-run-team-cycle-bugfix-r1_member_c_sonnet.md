Using the **code-review** skill to perform systematic QA audit of this bash refactor/bugfix.

<details>
<summary>Invoking skill: code-review</summary>

I need to systematically review this bash portability and robustness refactor, focusing on the specific concerns mentioned (set -euo pipefail hazards, background process handling, sidecar failure isolation, regression coverage).

</details>

---

## Verdict: **CONCERNS** (non-blocking)

This refactor substantially improves robustness by eliminating heredoc fragility, but introduces **3 moderate risks** around error propagation and edge-case handling that should be mitigated before merge.

---

## Top 3 Risks / Edge Cases

### 1. **Silent Python helper failures can corrupt packet patching** ⚠️ HIGH
```bash
# Current code (inferred from wiring):
NOTEBOOK_PATH=$(python3 "${EXTRACT_NOTEBOOK_FROM_PACKET_SCRIPT}" --packet "${PACKET_PATH}")
```

**Problem**: If `team_cycle_extract_primary_notebook.py` exits 2 (file not found), bash `set -e` terminates **before** convergence gate runs. No trajectory stage gets written.

**Evidence from helper**:
```python
if not args.packet.is_file():
    print(f"ERROR: packet not found: {args.packet}", file=sys.stderr)
    return 2  # <-- Triggers set -e abort
```

**Mitigation**:
```bash
set +e
NOTEBOOK_PATH=$(python3 "${EXTRACT_NOTEBOOK_FROM_PACKET_SCRIPT}" --packet "${PACKET_PATH}")
extract_rc=$?
set -e
if [[ $extract_rc -ne 0 ]]; then
    log_error "Packet extraction failed (rc=$extract_rc)"
    # Still write trajectory with stage=failed?
    exit 1
fi
```

---

### 2. **Sidecar timeout race: `wait -n` portability + zombie reaping** ⚠️ MEDIUM
```bash
finalize_sidecar "${member_c_pid:-}" "${member_c_timeout_secs}" "${RESOLVED_TAG:-unknown}"
```

**Concerns**:
- `wait -n` (bash 4.3+) not portable to macOS default bash 3.2
- Timeout mechanism using `sleep` + `kill` can create race:
  ```bash
  # Typical pattern (not shown in excerpt):
  ( sleep $timeout; kill $pid ) &
  wait $pid  # <-- If sidecar exits 1ms before timeout, kill fires anyway
  ```
- If sidecar exits non-zero **after** convergence gate but **before** `finalize_sidecar`, does script still see `$?` from sidecar?

**Bash 3.2 safe pattern**:
```bash
# Poll-based timeout (portable):
elapsed=0
while kill -0 "$member_c_pid" 2>/dev/null; do
    if [[ $elapsed -ge $timeout ]]; then
        kill -TERM "$member_c_pid" 2>/dev/null || true
        sleep 0.5
        kill -KILL "$member_c_pid" 2>/dev/null || true
        break
    fi
    sleep 1
    elapsed=$((elapsed + 1))
done
wait "$member_c_pid" 2>/dev/null || true  # Reap zombie
```

---

### 3. **Regex injection in `team_cycle_patch_packet.py`** ⚠️ LOW-MEDIUM
```python
if re.match(r"^Tag:\s*", line):
    out.append(f"Tag: {tag}\n")  # <-- {tag} user-controlled
```

**Attack vector**: If `--tag` contains backslashes/newlines from malicious filename:
```bash
--tag "M42\n## Malicious Section\nExploit"
```

**Result**: Injected markdown sections in patched packet (low severity, but breaks traceability).

**Mitigation**:
```python
tag_safe = tag.replace("\\", "\\\\").replace("\n", " ").replace("\r", " ")
out.append(f"Tag: {tag_safe}\n")
```

---

## Additional Edge Cases (Lower Priority)

### 4. **Missing `SCRIPT_DIR` validation**
```bash
EXTRACT_NOTEBOOK_FROM_PACKET_SCRIPT="${SCRIPT_DIR}/team_cycle_extract_primary_notebook.py"
```
If `SCRIPT_DIR` unset (malformed caller), `set -u` aborts. Add early:
```bash
: "${SCRIPT_DIR:?SCRIPT_DIR must be set}"
```

### 5. **Convergence gate stderr swallowed**
```bash
python3 "${GATE_SCRIPT}" --member-a "${member_a_out}" --member-b "${member_b_out}"
gate_code=$?
```
If gate crashes (ImportError, etc.), stderr visible but not captured for trajectory metadata. Consider:
```bash
gate_stderr=$(mktemp)
python3 "${GATE_SCRIPT}" ... 2>"$gate_stderr" || gate_code=$?
# Log gate_stderr content if gate_code != 0
```

### 6. **Race: `AUTOFILL_ENABLED` check vs concurrent config modification**
```bash
autofill_flag=$(python3 "${AUTOFILL_ENABLED_SCRIPT}" --notes "${NOTEBOOK_PATH}")
```
If `.research_team.toml` modified between this check and later autofill execution, behavior unpredictable. Low-probability in single-user repos, but violates determinism goal.

**Mitigation**: Cache config content hash in `team/` artifact at cycle start; verify unchanged before autofill.

---

## Regression Coverage Assessment

### ✅ **Adequate for primary bug**
- `smoke_test_convergence_gate_sidecar.sh` covers "sidecar failure → still reach convergence gate"
- `smoke_test_run_team_cycle_packet_input.sh` covers packet patching stability

### ⚠️ **Gaps**
1. **No test for Python helper exit codes** → Add minimal test:
   ```bash
   # smoke_test_helper_failures.sh
   echo "bogus" > /tmp/bad_packet.txt
   ! python3 scripts/bin/team_cycle_extract_primary_notebook.py --packet /tmp/bad_packet.txt
   # Verify exit 2, not crash
   ```

2. **No test for background process cleanup** → Existing sidecar test doesn't verify zombie reaping. Add:
   ```bash
   # After sidecar test completes:
   ! pgrep -f "member_c.*${TAG}" || { echo "Zombie detected"; exit 1; }
   ```

---

## Minimal Safe Improvements

### **Immediate (before merge)**:
1. **Wrap all helper invocations in `set +e; ...; set -e` blocks** with explicit error handling (fixes Risk #1)
2. **Add tag sanitization** to `team_cycle_patch_packet.py` (fixes Risk #3)
3. **Document bash 3.2 incompatibility** in script header if using `wait -n`, OR rewrite with portable poll loop (fixes Risk #2)

### **Short-term (post-merge)**:
4. Add `scripts/dev/smoke/smoke_test_helper_failures.sh` covering Python helper error paths
5. Add zombie-process assertion to existing sidecar smoke test

---

## Answers to Specific Questions

> 1) Is extracting the heredoc Python into standalone scripts a good minimal fix?

**YES** — This is the right call. Heredocs inside complex bash control flow are a maintenance nightmare. The extracted helpers are testable/lintable in isolation.

**Alternative considered**: Escaping heredoc delimiters more carefully → **Rejected** (doesn't scale; next refactor reintroduces same bug).

---

> 2) Any remaining `set -e` / background-process edge cases?

**YES** — See Risks #1 and #2 above. Key mitigations:
- Helper exit codes must be explicitly checked (`set +e` wrappers)
- Sidecar finalization needs zombie reaping guarantees

---

> 3) Is regression coverage adequate?

**MOSTLY** — Covers the reported bug scenario. **Gaps**:
- Helper script error paths untested
- Zombie process cleanup unverified
- Add 2 minimal tests (see "Regression Coverage Assessment" above)

---

## Summary Recommendation

**Status**: APPROVE with **mandatory pre-merge fixes** for Risks #1 and #3.  
**Timeline**: ~30 min to add error handling wrappers + tag sanitization.  
**Post-merge**: Add 2 smoke tests (helper failures + zombie check) within 1 sprint.

This refactor is a **substantial quality improvement** — the heredoc extraction alone prevents an entire class of parse errors. The identified risks are **fixable with localized changes** that don't require re-architecting the approach.
