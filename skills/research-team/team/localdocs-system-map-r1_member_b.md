# Review: Integrated End-to-End System Map (Graphviz DOT)

- Decision: **APPROVE**
- Major issues: None. The diagram successfully integrates the previously disjointed layers into a single coherent flow using clusters effectively.
- Minor issues / nits:
  - The human lane should explicitly show “work” (writing Notes and generating Artifacts), not only decide/approve.
  - Adjudication is feedback to the human; add `Adj → U` to close the loop.
  - `ScanRules` should be connected to the human decision/configuration path.

Suggested revisions:
- Add `U → Notes` (“write/edit”) and `U → Artifacts` (“run/generate”) edges.
- Add `Adj → U` as feedback/guidance.
- Add `Decide → ScanRules` (dashed) to clarify ownership.

