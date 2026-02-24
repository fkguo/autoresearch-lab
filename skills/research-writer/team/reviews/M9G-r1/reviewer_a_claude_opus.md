VERDICT: READY

## Blockers

(none)

## Non-blocking

1. **Anchor detection for inline citations without locators**: The linter requires *both* a locator (Table/Fig/Eq/Sec) AND a `\cite{}`. Some legitimate anchors are purely citation-based (e.g., "as shown in Ref.~\cite{...}"). Consider a `--citation-only-ok` flag for workflows where this is acceptable.

2. **Path-like regex may false-positive on URLs**: The `_RE_PATHLIKE` pattern would match URLs like `arxiv.org/abs/...`, which is fine for evidence but may be unintentional. Document this behavior or tighten the pattern.

3. **Smoke test output is terse**: The excerpt shows only `[smoke] ok`. Including one line showing the "flags risky unanchored revadd" test actually ran with expected failure/pass states would strengthen auditability.

## Real-research fit

- **Appropriate strictness**: The evidence gate is advisory by default (`--fail` opt-in), which respects real drafting workflows where authors iteratively refine anchors.
- **Keyword coverage is sensible**: The risky-term list (uncertainty, error, weighting, digitiz*, etc.) targets the most common hallucination vectors in physics manuscripts without over-flagging routine prose.
- **TODO workflow integration**: The guardrails prompt's instruction to "leave unchanged and add TODO" aligns with human-in-the-loop revision practice.
- **Macro configurability**: Supporting `--macro` for custom addition macros (e.g., `added`, `newtext`) accommodates varied LaTeX revision styles.

## Robustness & safety

- **Deterministic and offline**: The linter uses only regex heuristics—no model calls, no network, no mutation of source files.
- **Skill vs Agent boundary respected**: Tooling provides checks and prompt templates; it does not auto-edit the playbook or manuscript content.
- **Graceful degradation**: Unbalanced braces stop scanning rather than crashing or infinite-looping.
- **Exit codes are clear**: 0 = pass/warn, 2 = fail with `--fail`, matching CI conventions.

## Specific patch suggestions

1. **`check_latex_evidence_gate.py` line ~120**: Add a brief docstring or inline comment clarifying that `_has_anchor` returns `True` if *either* a path-like string is present *or* (cite AND locator). The current code is correct but the OR-logic is non-obvious on first read.

2. **`research_writer_guardrails_system_prompt.txt`**: Consider adding a one-line example of a well-anchored claim vs. a poorly-anchored claim to make the rule concrete for the agent:
   ```
   Good: "The systematic uncertainties are taken from Table~II of Ref.~\cite{Arndt:2006bf}."
   Bad:  "The systematic uncertainties are estimated at 5\%." (no anchor → add TODO)
   ```

3. **`writing_voice_system_prompt.txt`**: The excerpt mentions `[TODO: ...]` while the guardrails prompt says `TODO/question`. Standardize on one format (suggest `% TODO: ...` for LaTeX comments or `[TODO: ...]` in prose) to ease downstream grep/lint.

4. **Smoke harness**: If not already present, add a negative test case that contains a risky keyword *with* a valid anchor to confirm the linter does **not** flag it (avoids false-positive regressions).
