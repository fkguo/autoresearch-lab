# Adjudication — skilldev-nontrivial-crosscheck-r1

## Scope

Make research-team cross-checks land on **nontrivial** audits (algorithmic / invariants / independent-method agreement), not just closed-form substitution arithmetic.

## Evidence (member reports)

- Member A (Opus): [skilldev-nontrivial-crosscheck-r1_member_a_opus.md](skilldev-nontrivial-crosscheck-r1_member_a_opus.md)
- Member B (Gemini): [skilldev-nontrivial-crosscheck-r1_member_b_gemini.md](skilldev-nontrivial-crosscheck-r1_member_b_gemini.md)
- Member C (Sonnet, non-blocking): [skilldev-nontrivial-crosscheck-r1_member_c_sonnet.md](skilldev-nontrivial-crosscheck-r1_member_c_sonnet.md)

## Convergence summary

All three members converge on the same core idea:

- **Don’t rely on “recompute the same closed-form”** as “computation replication”.
- Enforce at least one **diagnostic / cross-validation** check per milestone.
- Keep deterministic, avoid brute force; use **audit proxies** (residuals, invariants, convergence slices, boundary/limit checks).

Differences:
- Gemini pushes harder for “auto” nontrivial checks via invariants/limits (avoid doubling code).
- Opus emphasizes a staged rollout: low-effort policy first, then hard gates.
- Sonnet focuses on numerics: tiered headlines + deterministic perturbation slices.

## Adjudication (recommended staged rollout)

### P0 (immediate)

1) **Tiered headline taxonomy** in the capsule: require ≥1 Tier-2/3 headline per milestone.
   - Tier-1: direct outputs
   - Tier-2: diagnostics (residual/error/convergence)
   - Tier-3: two-method agreement metrics

2) **Triviality self-audit + escalation** in member prompts:
   - If all headlines are “TRIVIAL” (closed-form substitution), member must either add a nontrivial audit or escalate with a concrete remedy.

Acceptance criteria:
- Every cycle contains at least one diagnostic/cross-validation scalar with a tolerance and provenance pointer.

### P1 (short-term)

3) **Two-method check contract** (mixed/numerics profiles): analytic vs numeric (or solver A vs solver B); headline is the disagreement metric and must be < tolerance.

### P2 (numerics/toolkit heavy)

4) **Mandatory audit proxy** schema (structured audit slices): residual/convergence/perturbation/invariant/boundary checks, profile-aware.

5) **(Optional) Packet code inclusion** for referenced code pointers (snippet/file + execution trace) to enable real algorithm/path review.

## Immediate practical fix for the cited project pattern

When a quantity has a closed form, make the headline be a **diagnostic**, e.g.:

- max relative error between numeric discontinuity and closed-form across a scan
- near-threshold limit check (e.g. $s\\to 4m^2^+$) with stability/tolerance
- monotonicity / invariants / residual norms

