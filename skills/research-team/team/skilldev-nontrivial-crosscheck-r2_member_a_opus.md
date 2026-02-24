# R2 Audit: Spec/Gate Semantics Review

## 1) Findings

### Gate Semantics & Edge Cases

- **Config override precedence is underspecified.** If a user sets `min_nontrivial_headlines: 0` in their config but the prompt-level escalation rule says "fail unless `Min nontrivial headlines: 0` is explicitly declared"—which source of truth wins? The capsule text or the JSON config? This needs a single canonical location, or explicit documentation that capsule-embedded value overrides JSON config (or vice versa).

- **Tier tag parsing fragility.** The spec implies headlines must contain tier tags (e.g., `[T2]`), but the regex/parsing logic is not shown. Edge cases:
  - `[T2/T3]` (dual-tier headline)—counted as T2, T3, both, or rejected?
  - `[t2]` (lowercase)—case sensitivity?
  - `Headline [T2] with suffix text`—tag placement flexibility?
  - Missing colon/malformed headline—silent ignore or hard fail?

- **"All checked headlines" ambiguity in prompt escalation.** The rule "if all checked headlines are TRIVIAL, computation replication must be `fail`" assumes reviewers check a subset. If a reviewer checks only 1 headline and it's trivial, immediate fail? Or is there an implicit minimum sample size? This could cause false-positive failures on capsules with many nontrivial headlines where the reviewer happened to spot-check one trivial one.

- **T1-only capsules with `min_nontrivial_headlines: 0`.** This is a valid escape hatch, but the prompt escalation wording ("unless explicitly declared") could cause confusion: does the reviewer check the JSON config or expect a capsule header line? The smoke test `smoke_test_capsule_headline_tiers.sh` should include a T1-only + `min_nontrivial_headlines: 0` **pass** case to confirm this path works.

- **Empty headline list.** If `headlines: []`, does that pass (vacuously satisfies "at least 1 nontrivial" = false → fail) or is it a parse error? The smoke tests don't cover this.

### Prompt-Level Escalation Calibration

- **Fail vs. warn is binary.** Current spec has no "warn" state—only pass/fail. This is appropriate for P0 strictness but should be documented as intentional (no soft failures).

- **Triviality classification lacks rubric.** Reviewers must record `TRIVIAL / NONTRIVIAL`, but the definition is implicit ("closed-form arithmetic" vs. "algorithmic correctness or numerical stability"). A one-sentence rubric in the system prompt would reduce inter-reviewer variance.

### Regression Test Sufficiency

- **Positive coverage is minimal.** Only one-T2 pass case exists. Consider adding:
  - T3-only pass
  - Mixed T1+T2+T3 pass
  - `min_nontrivial_headlines: 2` with exactly 2 nontrivial (boundary)

- **Negative edge cases missing:**
  - Malformed tier tag (e.g., `[T4]`, `[TX]`)
  - Empty headline list
  - `min_nontrivial_headlines: 0` with all-T1 (should pass)

- **Determinism confirmed.** The new smoke test is shell-based with static fixtures—no flakiness risk from LLM calls.

---

## 2) Recommendation

**REVISE** — minor spec clarifications and one additional smoke case required before P0 is complete.

---

## 3) Required Fixes

| File | Change | Rationale |
|------|--------|-----------|
| `assets/AGENTS_template.md` | Add explicit note: "The `Min nontrivial headlines` value in the capsule header is authoritative; JSON config provides the default." | Resolves config-vs-capsule precedence ambiguity |
| `assets/system_member_a.txt` / `system_member_b.txt` | Add one-line rubric: "TRIVIAL = result reproducible via closed-form algebra or single-step calculator; NONTRIVIAL = requires iterative algorithm, numerical method, or multi-step pipeline." | Reduces classification variance |
| `scripts/dev/smoke/smoke_test_capsule_headline_tiers.sh` | Add case: all-T1 + `min_nontrivial_headlines: 0` → **pass** | Confirms escape-hatch path works |

---

## 4) Optional Improvements (Nice-to-Have)

- Document tier-tag parsing rules (case sensitivity, placement) in `AGENTS_template.md`.
- Add smoke case for empty headline list (expect fail with clear error message).
- Add smoke case for `min_nontrivial_headlines: 2` boundary.

---

**Summary:** Core semantics are sound; the gaps are documentation/edge-coverage. Three targeted patches close the spec and make P0 shippable.
