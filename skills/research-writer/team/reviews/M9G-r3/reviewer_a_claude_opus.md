VERDICT: READY

## Blockers

(none)

## Non-blocking

1. **Locator regex may miss less common patterns.** The regex now covers `Table`, `Fig.`, `Eq.`, `Sec.`, `Appendix`, `Page`, `p.`, `pp.`, `Chapter`, `Chap.`, which is comprehensive, but fields with nonstandard conventions (e.g., "Algorithm 1", "Listing 2", "Box 3") will not trigger an anchor match. Consider a future extension or a flag to whitelist additional locator terms.

2. **Risk keyword list is domain-skewed.** Terms like `nno?line`, `said`, `pwa` are specific to the particle-physics/nuclear context. For broader adoption, these could be refactored into a separate "physics risky terms" set versus a generic baseline.

3. **Guardrails prompt TODO format is strict but not validated.** The prescribed format `[TODO: <what> | source: <path>]` is good for grep-ability but the linter doesn't check agent output for compliance. A complementary linter/hook could verify TODO markers follow the expected schema.

## Real-research fit

- **Low false-positive burden.** The gate only fires when risky keywords appear inside `\revadd{}` *without* an anchor. In typical workflows, most additions that discuss uncertainty/provenance will naturally include a citation+locator or a local path, so legitimate edits pass silently.
- **Graceful degradation.** The linter defaults to warn-only (`--fail` is opt-in), which lets authors run it informatively before enforcing. This matches iterative manuscript drafting where strictness is tightened as the paper matures.
- **User can extend risky keywords.** The `--risk-keyword` flag allows project-specific additions without modifying source, which helps domain-specific repos.
- **TODO mechanism preserves momentum.** When evidence is absent, the instruction to leave text unchanged and emit a TODO keeps the draft valid and avoids phantom regressions while explicitly surfacing data gaps.

## Robustness & safety

- **Deterministic heuristic scope.** The linter acknowledges it cannot *prove* correctness; its role is to catch a frequent failure mode (unanchored plausible-sounding claims). This honest framing avoids over-reliance on the check as a completeness guarantee.
- **Brace-matching edge cases.** The parser counts braces but does not handle escaped braces (`\{`, `\}`) correctly inside macro bodies—it only checks the immediately preceding character, so sequences like `\\{` or `\text{\{}` may mis-parse. In practice, such constructs inside `\revadd{}` are rare, and the failure mode is a skipped block (false-negative), which is safer than a false-positive.
- **Regex-based path detector is conservative.** Requiring at least one `/` plus alphanumeric tail reduces false matches but could miss Windows-style paths. Document Linux/macOS-centric assumption.

## Specific patch suggestions

1. **scripts/bin/check_latex_evidence_gate.py (line ~80-85):**  
   Consider handling double-backslash escapes:
   ```python
   # current:
   if j > 0 and text[j - 1] == "\\":
   # could become:
   if _is_escaped(text, j):
   ```
   where `_is_escaped` counts contiguous preceding backslashes and returns `True` if odd.

2. **assets/style/research_writer_guardrails_system_prompt.txt:**  
   Add a short note that the TODO schema is greppable (e.g., "Search for `[TODO:` to find open evidence gaps.") so users know how to audit.

3. **scripts/dev/run_all_smoke_tests.sh (not shown but referenced):**  
   If not already present, include both a passing case (anchor present) and a failure case (anchor absent) to cover the two exit-code branches. (Smoke excerpt suggests this exists; confirm both branches are exercised.)
