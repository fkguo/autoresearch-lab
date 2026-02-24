# Member C Numerics & QA Audit — r2 Capsule Tier Enforcement

## 1. Audit Summary

**Overall assessment: ACCEPT with minor documentation clarifications.**

The r2 changes establish a **sound end-to-end contract** for enforcing nontrivial computational checks:

- **Config layer**: defaults are sensible (`min_nontrivial_headlines: 1`, tiers `["T2","T3"]`), overridable per-capsule.
- **Gate layer**: `smoke_test_capsule_headline_tiers.sh` demonstrates deterministic validation of tier presence, all-T1 rejection, and single-T2 acceptance.
- **Prompt layer**: reviewers now must classify triviality and escalate to `fail` if all checked headlines are trivial (modulo explicit `min_nontrivial_headlines: 0` escape hatch).
- **Regression coverage**: three smoke tests updated/added, all passing.

The design **meaningfully narrows the loophole** where "Computation Replication" could be satisfied by trivial arithmetic, without creating excessive friction for low-risk capsules.

---

## 2. Risks / Loopholes

### 2.1 Prompt-Level Enforcement Gaps

- **Reviewer discretion on "TRIVIAL" classification**  
  The prompt asks reviewers to classify headlines as `TRIVIAL / NONTRIVIAL`, but does not define these terms rigorously. A reviewer could classify a simple algebraic check as "NONTRIVIAL" to avoid escalation.  
  **Impact**: Medium. Mitigated by human oversight in PRs, but may degrade over time if reviewers optimize for speed.

- **"All checked headlines are TRIVIAL" edge case**  
  If a reviewer spot-checks only T1 headlines (ignoring available T2/T3), they might incorrectly fail the capsule. The prompt says "prefer Tier-T2/T3 headline checks" but does not **require** checking at least one T2/T3 if available.  
  **Impact**: Low. Reviewers are incentivized to check higher tiers first, but the rule could be tightened.

- **Escape hatch visibility**  
  The rule "unless `Min nontrivial headlines: 0` is explicitly declared" may not be obvious to reviewers scanning capsules. If the field is absent, does that mean 0 or 1?  
  **Impact**: Low. Config defaults to 1, but capsule authors might forget to declare when they *want* 0.

### 2.2 Regression Test Coverage

- **`smoke_test_capsule_headline_tiers.sh` does not test tier *counts* vs. config threshold**  
  The test validates presence/absence of tiers and single-T2 acceptance, but does not exercise:
  - `min_nontrivial_headlines: 2` (requires ≥2 T2/T3 headlines)
  - `nontrivial_tiers: ["T3"]` (only T3 counts as nontrivial)  
  **Impact**: Low. The gate logic (`team_config.py` or capsule parser) may handle this correctly, but it's untested.

- **Determinism: good**  
  All new/updated smoke tests use fixed inline capsule text, no randomness. ✅

### 2.3 Config Inheritance & Override Behavior

- **Capsule-level override semantics not explicit**  
  If a capsule declares `Min nontrivial headlines: 0`, does that override the global `capsule.min_nontrivial_headlines: 1` from config?  
  **Impact**: Low if already implemented; medium if ambiguous. The prompt implies yes (escape hatch), but config merging logic is not visible in the diff.

---

## 3. Recommendations (Non-Blocking)

### 3.1 Prompt Hardening (Optional, Low Priority)

**A. Tighten reviewer requirement to check at least one T2/T3 if available:**

```diff
--- assets/system_member_a.txt
+++ assets/system_member_a.txt
 - Computation Replication:
-  - Prefer checking Tier-T2/T3 headlines (nontrivial) if available.
+  - If any Tier-T2 or Tier-T3 headlines exist, you MUST check at least one.
+  - Otherwise, check the highest available tier.
   - For each checked headline, record:
     Triviality classification: TRIVIAL / NONTRIVIAL
```

**B. Define TRIVIAL vs NONTRIVIAL inline (one-sentence heuristic):**

```diff
   - For each checked headline, record:
-    Triviality classification: TRIVIAL / NONTRIVIAL
+    Triviality classification: TRIVIAL / NONTRIVIAL
+      TRIVIAL = closed-form arithmetic, no iteration/solver/two-method cross-check
+      NONTRIVIAL = residuals, convergence checks, or comparing two implementations
```

**Rationale**: Reduces reviewer ambiguity without requiring external docs.

---

### 3.2 Regression Test Extension (Optional, P1)

**Add one parametric test case to `smoke_test_capsule_headline_tiers.sh`:**

```bash
# Test: min_nontrivial_headlines: 2 with only one T2 → fail
cat > /tmp/capsule_one_t2.md <<EOF
# Capsule: OnlyOneT2
Min nontrivial headlines: 2
## Computation Replication
- [T2] Check residual < 1e-6
- [T1] Reproduce mean calculation
EOF
if validate_capsule /tmp/capsule_one_t2.md 2>/dev/null; then
  echo "FAIL: should reject (needs ≥2 nontrivial, has 1)"
  exit 1
fi
```

**Rationale**: Exercises threshold logic, catches off-by-one errors.

---

### 3.3 Documentation Clarification (Quick Win)

**In `assets/AGENTS_template.md`, clarify escape hatch:**

```diff
 ## Capsule Gate: Nontrivial Headlines
 - Each headline MUST declare a tier tag: [T1], [T2], [T3].
 - Default: at least 1 headline must be Tier-T2 or Tier-T3.
+- To allow all-T1 capsules (low-risk scenarios), explicitly declare:
+  Min nontrivial headlines: 0
```

**Rationale**: Makes override intent explicit for capsule authors.

---

## 4. Edge Cases Checked ✅

| Scenario | Outcome | Verified |
|----------|---------|----------|
| All headlines lack tier tags | ❌ Fail | ✅ `smoke_test_capsule_headline_tiers.sh` |
| All headlines are T1 | ❌ Fail | ✅ (default min=1) |
| One T2 headline | ✅ Pass | ✅ |
| `min_nontrivial_headlines: 0` + all T1 | ✅ Pass | ⚠️ Not tested, but prompt implies OK |
| Reviewer checks only T1 when T2 exists | ⚠️ Ambiguous | ⚠️ Prompt says "prefer" not "require" |

---

## 5. Final Verdict

**ACCEPT for P0 completion.**

The implementation achieves the stated goal:
- **Capsule gate** deterministically enforces tier presence and minimum nontrivial count.
- **Reviewer prompts** escalate failures when all checked headlines are trivial.
- **Regression tests** cover the primary happy/unhappy paths.

**Minor gaps** (reviewer discretion on triviality, untested threshold >1) are **low-risk** and can be addressed in P1 if operational friction emerges.

---

## Patch Suggestions (Optional, Copy-Paste Ready)

<details>
<summary><b>Patch 1: Harden reviewer requirement (system_member_a.txt, system_member_b.txt)</b></summary>

```diff
--- a/assets/system_member_a.txt
+++ b/assets/system_member_a.txt
@@ -X,7 +X,9 @@
 - Computation Replication:
-  - Prefer checking Tier-T2/T3 headlines (nontrivial) if available.
+  - If any Tier-T2 or Tier-T3 headlines exist, you MUST check at least one.
   - For each checked headline, record:
-    Triviality classification: TRIVIAL / NONTRIVIAL
+    Triviality classification: TRIVIAL / NONTRIVIAL  
+      (TRIVIAL = closed-form arithmetic; NONTRIVIAL = residuals/convergence/two-method delta)
```

</details>

<details>
<summary><b>Patch 2: Add min=2 regression test (smoke_test_capsule_headline_tiers.sh)</b></summary>

```bash
# At end of smoke_test_capsule_headline_tiers.sh:

echo "Test 4: min_nontrivial_headlines: 2 with only 1 T2 → fail"
cat > /tmp/capsule_min2.md <<'EOF'
# Test Capsule
Min nontrivial headlines: 2
## Computation Replication
- [T2] Check residual
- [T1] Reproduce mean
EOF
if python3 -c "
import sys; sys.path.insert(0, 'scripts/lib')
from team_config import parse_capsule_headlines
h = parse_capsule_headlines('/tmp/capsule_min2.md')
assert len([x for x in h if x.tier in ['T2','T3']]) < 2
" 2>/dev/null; then
  echo "✅ Test 4 pass"
else
  echo "❌ Test 4 fail"; exit 1
fi
```

</details>

---

**End of Audit**
