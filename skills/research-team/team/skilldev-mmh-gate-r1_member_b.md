# Review packet: research-team skill — markdown math hygiene + team cycle hardening

- Decision: **APPROVE**
- Major issues: None.
- Minor issues / nits:
  - **Code Duplication:** The validation logic `_validate_markdown_math_hygiene` is duplicated in `scripts/gates/check_markdown_math_hygiene.py` and `scripts/gates/check_knowledge_layers.py`. While this ensures `check_knowledge_layers.py` remains standalone, it creates a maintenance burden (divergence risk).
  - **Fixer Conservatism:** `fix_markdown_math_hygiene.py` skips lines containing backticks. This is a safe default to avoid mangling code examples, but it means valid math hazards on lines that also happen to reference code may not be autofixed and will require manual intervention.
- Suggested additional tests:
  - **Blockquote interaction:** Verify that `fix_markdown_math_hygiene.py` does not mangle `> $$` blockquoted math (common in replies/notes).
  - **Indented continuation:** Verify split-equation merging works correctly when the second block is indented differently than the first.

## Rationale

The patch directly addresses the stability/hygiene issues in the team cycle. The regex logic for `\[` vs `\\[` is correct (negative lookbehind handles escaped backslashes). The preflight insertion in `run_team_cycle.sh` correctly implements the fail-fast requirement, preventing late-stage crashes in the cycle. The autofix script is appropriately conservative (skipping ambiguous inline/code-mixed lines).

