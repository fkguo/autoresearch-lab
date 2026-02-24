VERDICT: READY

## Blockers

None identified. The seven hardening requirements are each addressed with concrete implementations in the ground-truth file mapping, and the 105-passing test suite provides baseline verification. No missing invariants rise to blocker level.

## Non-blocking

### 1. `safe_resolve_under` — symlink TOCTOU window
**File:** `src/idea_core/hepar/fs_ops.py`

The typical `safe_resolve_under(root, rel)` pattern checks `Path.resolve()` at call time, but a symlink can be swapped between the check and the subsequent open/write. This is a known TOCTOU gap. For a control-plane tool where the adversary model is "LLM-generated paths" (not a hostile concurrent process), this is acceptable — but worth documenting as a known limitation.

**Recommendation:** Add a docstring note: `# NOTE: TOCTOU — symlink can change between resolve and open. Acceptable for LLM-path-sanitization threat model.`

### 2. `file://` netloc bypass — URI scheme coverage
**File:** `src/idea_core/hepar/fs_ops.py`

Confirm that the guard also rejects `file:///etc/passwd`-style URIs where netloc is empty string (not `None`). Some `urllib.parse.urlparse` edge cases: `file:foo` has scheme `file` but no netloc; `file://localhost/etc/passwd` has netloc `localhost`. Both should be rejected.

**Recommendation:** Add explicit test cases for `file:foo`, `file://localhost/path`, and `file:///absolute` if not already present.

### 3. Atomic write — fsync semantics
**File:** `src/idea_core/hepar/fs_ops.py`

`atomic_write_text` / `atomic_write_json` presumably use `tempfile` + `os.rename`. Confirm that `os.fsync(fd)` is called before `os.rename` — without it, a crash between rename and disk flush can still lose data on ext4 (metadata journaling only). For a research control plane this is low-severity but trivially fixable.

### 4. Retry backoff — jitter
**File:** `src/idea_core/hepar/retry_ops.py`

If multiple agents hit the same reviewer/external endpoint, pure exponential backoff without jitter causes thundering-herd retry storms. Confirm that jitter (e.g., `random.uniform(0, delay)`) is included in the backoff calculation.

### 5. Ledger dedup index — index persistence across restarts
**File:** `src/idea_core/hepar/control_plane.py`

The dedup performance fix (no per-event full scan) presumably builds an in-memory index. If the control plane restarts, is the index rebuilt from the JSONL ledger on startup? If so, confirm the rebuild is O(n) single-pass, not O(n²) from repeated membership checks during rebuild.

### 6. Permission reactive loop — timeout on unresolved requests
**File:** `src/idea_core/hepar/runtime_adapter.py`

`handle_permission_request` should have a bounded timeout. If a permission request is never resolved (e.g., human approval gate with no human), the SSE ingestion loop could block indefinitely. Confirm there is a configurable timeout with a sane default (e.g., 300s).

### 7. Replay index concurrency — lock granularity
**File:** `src/idea_core/hepar/skill_bridge.py`

`_replay_index_lock` as a per-command lock is good. Confirm it's a `threading.Lock` (not `asyncio.Lock`) if the replay path can be called from sync code, or that both sync and async callers are properly handled.

### 8. Env whitelist — drift detection
**File:** `src/idea_core/hepar/runtime_adapter.py`

`_prepare_runtime_tool_policy` records the `env_whitelist` policy. Confirm that the recorded policy is compared with the actual environment keys passed to the subprocess **after** launch (not just at policy-preparation time). A post-launch assertion `assert set(actual_env.keys()) <= set(recorded_whitelist)` would close the loop.

## Real-research fit

The seven hardening items are well-chosen for a research control plane:

- **Path boundary hardening** directly mitigates the #1 risk in LLM-driven file operations: the model hallucinating or being prompted to write outside the run directory. This is critical for multi-run isolation in HEP workflows where different parameter scans must not cross-contaminate.
- **Atomic writes** protect the ledger and artifact bundles — the primary evidence chain. In a physics context, losing a partial ledger entry mid-write could silently drop a calculation result, leading to incorrect novelty assessments downstream.
- **Timeout/retry** is essential for external tool calls (Mathematica/FeynCalc via `hep-calc`, reviewer agents). HEP calculations can legitimately take minutes; the backoff policy needs tunable ceilings.
- **Ledger dedup** is a scaling concern: a typical HEP parameter scan can generate thousands of events. O(n²) dedup would make the system unusable beyond ~500 events.
- **Env whitelist consistency** prevents credential leakage to subprocesses — important when the control plane orchestrates calls to external services (arXiv, InspireHEP, Zotero).

**Extensibility note:** None of these hardening measures are HEP-specific. They operate at the control-plane layer and will transfer cleanly to broader theoretical physics domains (cosmology, condensed matter) without modification. This is the correct architectural boundary.

## Robustness & safety

### Hallucination mitigation
The path boundary hardening is the primary anti-hallucination defense at the filesystem level. The combination of absolute-path rejection + traversal rejection + symlink-escape rejection + URI-scheme rejection covers the four main attack surfaces for LLM-generated paths.

**Gap:** There is no mention of **filename sanitization** (e.g., rejecting null bytes, control characters, or excessively long filenames). LLMs can generate filenames like `"idea\x00.json"` which some OS APIs truncate at the null byte. Consider adding `\x00` rejection to `safe_resolve_under`.

### Provenance
Atomic writes + ledger dedup together ensure that the evidence chain is consistent: every recorded event was fully written, and no event is double-counted. This is a solid provenance foundation.

### Concurrency safety
The replay index lock and ledger dedup index together handle the two main concurrent-access points. The permission reactive loop adds a third concurrent concern (SSE ingestion + permission resolution). Confirm that the permission resolution callback does not hold the ledger lock while waiting for human approval — this would be a deadlock risk.

### Failure modes
- **Atomic write failure:** If `os.rename` fails (cross-device, permissions), confirm the temp file is cleaned up in a `finally` block.
- **Retry exhaustion:** When all retries are exhausted, confirm the error is propagated with full context (original exception, number of attempts, total elapsed time) rather than a generic "retry failed" message.
- **Dedup index corruption:** If the in-memory index diverges from the JSONL ledger (e.g., due to a partial write that was rolled back), confirm there is a `--rebuild-index` recovery path.

## Specific patch suggestions

### Patch 1: Null-byte rejection in path guard
**File:** `src/idea_core/hepar/fs_ops.py`
**Location:** `safe_resolve_under()` function, at the top of the validation chain
**Change:** Add null-byte check before any path resolution:
```python
def safe_resolve_under(root: Path, rel: str) -> Path:
    if "\x00" in rel:
        raise ValueError(f"Null byte in path component: {rel!r}")
    # ... existing checks ...
```

### Patch 2: Document TOCTOU limitation
**File:** `src/idea_core/hepar/fs_ops.py`
**Location:** `safe_resolve_under()` docstring
**Change:** Append to docstring:
```python
    Note:
        Symlink-escape detection is point-in-time (TOCTOU). This is acceptable
        for the LLM-path-sanitization threat model but not for adversarial
        concurrent filesystem modification.
```

### Patch 3: Ensure fsync before rename in atomic writes
**File:** `src/idea_core/hepar/fs_ops.py`
**Location:** `atomic_write_text()` and `atomic_write_json()`
**Change:** If not already present, add `os.fsync()` before rename:
```python
def atomic_write_text(path: Path, content: str, ...) -> None:
    tmp = path.with_suffix(path.suffix + ".tmp")
    try:
        with open(tmp, "w", encoding="utf-8") as f:
            f.write(content)
            f.flush()
            os.fsync(f.fileno())  # <-- ensure this line exists
        tmp.rename(path)
    except BaseException:
        tmp.unlink(missing_ok=True)
        raise
```

### Patch 4: Add jitter to retry backoff
**File:** `src/idea_core/hepar/retry_ops.py`
**Location:** Backoff delay calculation
**Change:** If not already present, add jitter:
```python
import random

def _backoff_delay(attempt: int, base: float = 1.0, max_delay: float = 60.0) -> float:
    delay = min(base * (2 ** attempt), max_delay)
    return random.uniform(0, delay)  # full jitter
```

### Patch 5: Env whitelist post-launch assertion
**File:** `src/idea_core/hepar/runtime_adapter.py`
**Location:** After subprocess launch in `_prepare_runtime_tool_policy` or the calling function
**Change:** Add a post-launch consistency check:
```python
# After constructing actual_env for subprocess:
recorded_keys = set(policy.get("env_whitelist", []))
actual_keys = set(actual_env.keys()) - _ALWAYS_ALLOWED_ENV_KEYS
leaked = actual_keys - recorded_keys
if leaked:
    raise RuntimeError(
        f"Env whitelist policy violation: keys {leaked} passed to subprocess "
        f"but not in recorded whitelist {recorded_keys}"
    )
```

### Patch 6: Permission request timeout
**File:** `src/idea_core/hepar/runtime_adapter.py`
**Location:** `handle_permission_request()` or the SSE ingestion loop where it awaits resolution
**Change:** Add configurable timeout:
```python
PERMISSION_TIMEOUT_S: float = float(os.environ.get("HEPAR_PERMISSION_TIMEOUT", "300"))

# In the permission wait loop:
start = time.monotonic()
while not resolved:
    if time.monotonic() - start > PERMISSION_TIMEOUT_S:
        raise TimeoutError(
            f"Permission request {request_id} not resolved within {PERMISSION_TIMEOUT_S}s"
        )
    # ... existing poll/wait logic ...
```
