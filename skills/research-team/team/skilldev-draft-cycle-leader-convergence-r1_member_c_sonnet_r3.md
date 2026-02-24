I'll review this draft-cycle enhancement for correctness, usability, and failure-mode clarity.

**DECISION: ACCEPT**

**BLOCKERS:**
- (none)

**NONBLOCKING:**
- Counting rule ambiguity: "indentation <= 2 spaces" for top-level items could mismatch common Markdown renderers (which often use visual nesting). Consider documenting exact test cases in check_draft_convergence.py docstring.
- Missing rollback path: If convergence gate is enabled mid-project, users might have historical runs without C reports. Document expected behavior (gate should skip/warn on missing files, not crash).
- Verdict line flexibility: "ready for review cycle | needs revision" is fragile to typos. Consider allowing normalized variants (case-insensitive, extra whitespace) to reduce exit-2 friction.
- Config migration: Changing default `require_convergence: true` could surprise existing users upgrading scaffold. Add migration note to CHANGELOG or upgrade guide.

**NOTES:**

**Correctness audit (answers to Q1-Q4):**

1. **Is convergence gate strict enough?** YES with caveats:
   - Exit-code contract (0/1/2) is sound.
   - Declared count vs. bullet count check prevents sloppiness.
   - CAVEAT: Nested bullets are allowed but not counted—this is correct for structure but could hide reviewer laziness (e.g., stuffing all issues under one top-level bullet with 10 sub-items). Consider logging a WARNING if any top-level item has >3 nested children.

2. **Can run_draft_cycle exit 0 incorrectly or skip gate?**
   - Reviewed shell script flow: gate runs IFF `--require-convergence` is true AND all three reports exist.
   - If gate exits non-zero, script propagates via `|| exit $?`.
   - EDGE CASE: If `--member-c-runner` fails before writing output, gate won't run but script might exit 0 from earlier success. FIX: Add explicit check that all three report files exist before calling gate, otherwise fail early.

3. **Output filenames/LATEST pointers consistent?** YES:
   - Naming: `<tag>_draft_member_{a,b,c_leader}.md` is clear.
   - LATEST template lists all expected artifacts.
   - Navigation chain: tag → runs/<tag>/ → individual reports + convergence log.

4. **Is contract too brittle?**
   - Current risk: Exact string match on "Verdict: ready for review cycle | needs revision" will cause exit-2 on trivial variations.
   - MINIMAL SAFE RELAXATION:
     - Allow `Verdict:` line to contain either substring (case-insensitive): "ready" XOR "needs revision" (not both).
     - Trim whitespace before parsing `Blocking issues count: N`.
     - Log parse errors to convergence log BEFORE exiting 2, so users see what failed.

**Failure modes to watch:**

- **Missing Member C in historical runs:** Gate will fail if enabled retroactively. Need graceful skip or clear error.
- **Malformed Markdown from LLMs:** Real-world reviewer output might have extra headers, broken bullets, Unicode. The counting logic should be tested against messy input.
- **Exit-2 vs Exit-1 confusion:** Users might not distinguish "contract broken" from "not converged." convergence_log should prefix contract violations with `[CONTRACT VIOLATION]`.

**Usability observations:**

- `next_draft_tag.py` is excellent for reducing user friction.
- Convergence log + summary separation is clean.
- Stub-runner test coverage for PASS/FAIL is thorough.

**Readability:**

- Shell script grew significantly but remains linear.
- Python gate script is single-responsibility and well-factored.
- Config template change is high-impact—needs bold callout in upgrade docs.

**Recommendation:**
Accept with strong suggestion to add:
1. Existence check for A/B/C reports before gate runs (hard fail if missing when required).
2. Relaxed Verdict parsing (substring match, whitespace-tolerant).
3. Migration note for `require_convergence: true` default change.

These are improvements, not blockers—the core design is sound and correctly implements strict iteration semantics.
