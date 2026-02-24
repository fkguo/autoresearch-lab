VERDICT: READY

## Blockers

(none)

## Non-blocking

1. **Anchor detection is strict on locator+cite co-occurrence.** A claim like `\revadd{Following Ref.~\cite{Smith:2020ab}, we adopt their reported uncertainty.}` lacks an explicit "Table/Fig/Eq/Sec" locator and would be flagged, even though the citation alone may be sufficient evidence for some claims. Consider an optional `--allow-cite-only` flag for projects that prefer looser anchoring.

2. **Path-like regex may false-positive on URLs or LaTeX paths.** Strings such as `tikz/plots/foo.pdf` or `https://example.com/data/file` could unintentionally satisfy the anchor requirement. Low risk for now, but worth noting.

3. **No TODO-format linter.** The guardrails prompt specifies a strict `[TODO: ... | source: ...]` format, but the current linter does not verify that the agent actually emits this format when it leaves text unchanged. A complementary grep-based check in the smoke harness would close the loop.

## Real-research fit

- The evidence-gate addresses a genuine pain point: LLM-generated "plausible but unsourced" quantitative details in physics manuscripts.
- The scope rule ("you may improve English … only by rephrasing existing claims") is well-calibrated—it permits useful editorial work while blocking invented numbers.
- Keyword list (uncertainties, error models, provenance verbs) is domain-appropriate for experimental/phenomenological physics papers and covers common hallucination vectors.
- The warn-only default (`--fail` opt-in) lets teams adopt gradually without blocking CI on day one—good for research repos with legacy content.

## Robustness & safety

- **Deterministic & offline:** No network calls, no LLM in the loop—pure regex/string matching. Safe for air-gapped or sensitive projects.
- **Graceful degradation:** Unbalanced braces halt scanning early rather than looping infinitely; escaped braces (`\{`, `\}`) are now handled.
- **False-negative risk is acceptable:** The linter is heuristic and explicitly documented as such; it catches a *common* failure mode, not all possible hallucinations.
- **No secret/credential exposure:** Script reads only `.tex` files; no risk of leaking sensitive data.

## Specific patch suggestions

1. **scripts/bin/check_latex_evidence_gate.py, ~line 82** – Consider adding `Ref\.` to `_RE_LOCATOR` so that `Ref.~\cite{...}` alone (without Table/Fig) can optionally satisfy the anchor when combined with an explicit locator later in the sentence:
   ```python
   _RE_LOCATOR = re.compile(
       r"\b(Table|Tab\.|Figure|Fig\.|Equation|Eq\.|Section|Sec\.|Appendix|Ref\.)\b",
       flags=re.I,
   )
   ```
   (Or gate this behind a flag if stricter semantics are preferred.)

2. **assets/style/research_writer_guardrails_system_prompt.txt, line 17** – Tiny typo/style nit: "OR a project-local evidence file path" could add "(relative or absolute)" for clarity, since the regex accepts both.

3. **smoke harness** – Add a minimal negative-test case for the TODO format to ensure future refactors don't silently drop the format requirement:
   ```bash
   # Expect the agent to emit [TODO: ... | source: ...] when leaving text unchanged
   grep -q '\[TODO:.*|.*source:' "$EXPECTED_OUTPUT" || echo "[smoke] WARN: TODO format not verified"
   ```
