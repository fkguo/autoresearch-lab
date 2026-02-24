VERDICT: READY

## Blockers

## Non-blocking
- Consider specifying which model is writer vs auditor by default (or if it's configurable).
- The `--no-audit` flag name could be misread as "don't log"; consider `--skip-auditor` instead.

## Real-research fit
Good. Single coherent draft output matches how physicists actually want to receive generated text. Keeping raw intermediates supports reproducibility.

## Robustness & safety
The evidence gate linter as a hard gate on promotion is the right call. The `.unsafe.tex` rename pattern is a nice fail-visible mechanism.

## Specific patch suggestions
- In the acceptance criteria, add: "Trace logs must include wall-clock timestamps and model version strings" for reproducibility.
- For the optional (B) mode, document that the synthesizer prompt must include the evidence-gate system prompt, not just the writer voice prompt.
