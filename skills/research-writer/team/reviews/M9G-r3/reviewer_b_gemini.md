VERDICT: READY

## Blockers

## Non-blocking

## Real-research fit
The addition of page/chapter locators (`p.`, `pp.`, `Page`, `Chapter`) significantly improves usability for referencing books or long review papers, addressing the primary concern from r2. The strict requirement for an anchor (Locator + Citation) inside the `\revadd` block effectively forces the agent to bind claims to evidence immediately, which is excellent for auditability in diffs.

## Robustness & safety
The brace-counting logic in `_extract_macro_blocks` correctly handles nested LaTeX macros (e.g., `\revadd{\textbf{...}}`), preventing common regex-based linter failures. The linter is read-only and deterministic.

## Specific patch suggestions
