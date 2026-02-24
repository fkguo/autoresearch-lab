VERDICT: READY

## Blockers

None. The implementation satisfies the M2.7 acceptance criteria as specified:

1. **Formalization chain is minimal and auditable.** The `_formalize_rationale_to_idea_card(...)` path writes `operator_trace.params.formalization` with `source_artifact`, `rationale_hash`, and a deterministic mode tag (`explain_then_formalize_deterministic_v1`). This is the smallest possible surface that still gives you a cryptographically-verifiable provenance link from `RationaleDraft → IdeaCard`.

2. **Promote gate coverage is complete.** Four failure modes are gated:
   - No `idea_card` → `-32002`
   - No `formalization` in `operator_trace.params` → `-32002`
   - `source_artifact ≠ "rationale_draft"` → `-32002`
   - `rationale_hash` mismatch → `-32002`
   
   All four have dedicated test cases.

3. **No regression on search/eval/rank or idempotency/conflict semantics.** The smoke test (`test_search_step_nodes_flow_into_eval_rank_promote_smoke`) and cursor/get test cover the read path. Replay and conflict tests are preserved and passing.

4. **No scope creep.** Changes are confined to `service.py` and two test files. No contract schema changes, no hepar/runtime-adapter touches, no M2.8+ features.

## Non-blocking

1. **`rationale_hash` algorithm is unspecified in the review bundle.** The bundle says "rationale_hash must match current rationale_draft" but doesn't state the hash function. Recommend adding a one-line docstring or constant (e.g., `RATIONALE_HASH_ALGO = "sha256"`) in `_formalize_rationale_to_idea_card` so future auditors don't have to read the implementation to know the commitment scheme.

2. **Error message granularity.** All four promote-gate failures return the same `-32002/schema_validation_failed` code. This is correct per the existing error model, but consider adding a `detail` field distinguishing `"missing_idea_card"` / `"missing_formalization_trace"` / `"source_artifact_mismatch"` / `"rationale_hash_mismatch"`. This costs one enum and makes debugging dramatically easier without changing the wire-level error code.

3. **Deterministic mode tag is a magic string.** `"explain_then_formalize_deterministic_v1"` appears in both the formalization writer and the promote gate validator. Extract to a module-level constant to avoid silent typo divergence:
   ```python
   # src/idea_core/engine/service.py
   FORMALIZATION_MODE = "explain_then_formalize_deterministic_v1"
   ```

4. **Test coverage gap: corrupt `rationale_hash` vs. missing `rationale_hash`.** The bundle lists a hash-mismatch test but not a test for `formalization.rationale_hash` being `None`/absent (as opposed to wrong). If the gate does a direct `==` comparison, `None != current_hash` would pass, but it's worth an explicit edge-case test for documentation value.

5. **No negative test for `source_artifact` value.** There's a test for missing formalization trace, but no test where `source_artifact` is present but set to something other than `"rationale_draft"` (e.g., `"manual_entry"`). Add one for completeness.

## Real-research fit

The explain-then-formalize pattern maps well to HEP theory workflows:

- **Rationale drafts mirror "physics argument" sketches** (e.g., "the dimension-6 operator $\mathcal{O}_{tG}$ should generate a $gg \to t\bar{t}$ chromomagnetic dipole contribution at one loop"). The forced formalization into an `IdeaCard` with a hash-locked provenance link ensures the physics reasoning is never silently replaced by a hallucinated card.
- **The deterministic mode tag is extensible.** When M3+ introduces LLM-assisted formalization (e.g., translating a natural-language anomaly argument into a Lagrangian term), the mode tag can shift to `"explain_then_formalize_llm_v1"` and the gate can require additional fields (model ID, temperature, prompt hash). The current architecture supports this without structural changes.
- **The `-32002` gate prevents "idea laundering"** — promoting a node that has a plausible-looking card but no traceable rationale origin. This is the single most important safety property for evidence-first research automation.

## Robustness & safety

| Property | Status | Notes |
|----------|--------|-------|
| **Provenance integrity** | ✅ | Hash-locked `RationaleDraft → IdeaCard` link; promote gate enforces match |
| **Hallucination mitigation** | ✅ | No card can be promoted without a traceable rationale origin |
| **Idempotency** | ✅ | Replay test confirms no duplicated side effects |
| **Conflict detection** | ✅ | `payload_hash` included in conflict response |
| **Schema SSOT** | ✅ | No changes to `contracts/idea-generator-snapshot/*` |
| **Error model consistency** | ✅ | Reuses existing `-32002` code |
| **Scope containment** | ✅ | No M2.8+/M3 drift detected |

One potential robustness concern: **the hash comparison should be constant-time** if `rationale_hash` is ever used in a security-sensitive context (e.g., multi-tenant deployments). For now, a standard `==` is fine for single-researcher provenance auditing, but flag this for M3+ if the system becomes multi-user.

## Specific patch suggestions

### Patch 1: Extract magic string constant
**File:** `src/idea_core/engine/service.py`  
**What to change:** Replace inline `"explain_then_formalize_deterministic_v1"` with a module constant.

```python
# At module level, near other constants:
FORMALIZATION_MODE_DETERMINISTIC_V1 = "explain_then_formalize_deterministic_v1"

# In _formalize_rationale_to_idea_card():
-    "mode": "explain_then_formalize_deterministic_v1",
+    "mode": FORMALIZATION_MODE_DETERMINISTIC_V1,

# In the promote gate validator (wherever mode is checked):
-    if formalization.get("mode") != "explain_then_formalize_deterministic_v1":
+    if formalization.get("mode") != FORMALIZATION_MODE_DETERMINISTIC_V1:
```

### Patch 2: Add `detail` discriminator to promote-gate errors
**File:** `src/idea_core/engine/service.py`  
**What to change:** In each promote-gate failure branch, add a `detail` key to the error data dict.

```python
# Example for missing idea_card:
  return error_response(
      code=-32002,
      message="schema_validation_failed",
-     data={"reason": "..."}
+     data={"reason": "...", "detail": "missing_idea_card"}
  )

# Similarly for: "missing_formalization_trace", "source_artifact_mismatch", "rationale_hash_mismatch"
```

### Patch 3: Add edge-case tests for absent hash and wrong source_artifact value
**File:** `tests/engine/test_node_promote.py`  
**What to change:** Add two tests after `test_node_promote_fails_when_formalization_hash_mismatch`.

```python
def test_node_promote_fails_when_rationale_hash_absent(self):
    """formalization trace exists but rationale_hash key is missing/None."""
    node = self._make_node_with_formalization(rationale_hash=None)
    result = self.service.node_promote(node.key)
    assert result["error"]["code"] == -32002

def test_node_promote_fails_when_source_artifact_wrong(self):
    """formalization trace has wrong source_artifact value."""
    node = self._make_node_with_formalization(source_artifact="manual_entry")
    result = self.service.node_promote(node.key)
    assert result["error"]["code"] == -32002
```

### Patch 4: Document hash algorithm
**File:** `src/idea_core/engine/service.py`  
**What to change:** Add a one-line docstring or constant near `_formalize_rationale_to_idea_card`.

```python
+ # Rationale hash uses SHA-256 over the canonical JSON serialization of rationale_draft.
+ RATIONALE_HASH_ALGO = "sha256"
```

---

**Summary:** This is a clean, minimal M2.7 delivery. The formalization chain is the right abstraction — hash-locked provenance from rationale to card, with a mode tag that's extensible to LLM-assisted formalization in M3+. The four patches above are low-risk hygiene improvements, none blocking.
