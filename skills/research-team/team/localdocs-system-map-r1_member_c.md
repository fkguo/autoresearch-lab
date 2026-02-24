# Audit: Integrated End-to-End System Map (Graphviz DOT)

**Verdict: CONCERNS** (non-blocking)

Key concerns:
- Missing feedback loops (adjudication → notes, KB discovery → prework, trajectory → config tuning).
- Ambiguity about what is manual vs automated (e.g., artifacts → notes headline numbers).
- Missing explicit “BLOCK / intervention” paths for preflight failures.
- Preflight mega-node could hide ordering/conditionality; splitting improves readability.
- Claim/evidence validation should be explicit (validate KG before enabling claim gates).

Suggested follow-ups:
- Add explicit loop edges for adjudication-driven edits and discovery-driven prework updates.
- Add a small legend distinguishing solid/dashed/dotted edges.
- Split preflight into doc/evidence/claims phases.

