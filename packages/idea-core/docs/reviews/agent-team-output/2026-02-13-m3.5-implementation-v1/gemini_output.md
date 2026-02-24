VERDICT: READY
## Blockers
None.

## Non-blocking
1.  **Regex Robustness:** The regex for branching ratios (`r"(?:branching ratio|branching fraction|\bbr\b)[^0-9+-]{0,10}([+-]?\d+(?:\.\d+)?)\s*(%)?"`) might be a bit fragile for complex sentences, but it suffices for M3.5 heuristic checks. Future iterations might benefit from an NLP-based parser or a more robust grammar.
2.  **Unit Normalization:** The current check for units is a simple token presence check (`_contains_unit_token`). It doesn't validate if the unit is appropriate for the *value* (e.g. 1000000 MeV vs 1 TeV), but this is acceptable for a "missing unit" check.
3.  **"Massless" Logic:** The check for "massless" with a positive mass value is a good consistency check. However, it relies on the string "massless" being present. A claim like "photon mass is 5 GeV" without the word "massless" would not trigger this specific check (though it would be physically wrong). This is fine for a heuristic.

## Real-research fit
The implemented constraints map well to real-world HEP research hygiene:
-   **Dimensional Analysis:** Enforcing units is the first line of defense against hallucinated or sloppy numbers.
-   **Feasibility:** flagging "cluster" scale compute on "laptop" infrastructure is a common issue in proposal-stage ideas.
-   **Physical Bounds:** Branching ratios > 1 are a classic sign of unnormalized or nonsensical predictions.

## Robustness & safety
-   **Deterministic:** The checks use deterministic logic (regex, string matching) and do not rely on LLM calls, ensuring reproducibility.
-   **Fail-safe:** The `node.promote` gate defaults to blocking on "critical" failures, which is the safe default.
-   **Schema Compliance:** The error data structures match the defined schemas (RpcError with structured data).

## Specific patch suggestions
None required for acceptance.

