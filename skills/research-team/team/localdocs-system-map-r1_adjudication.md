# Adjudication — localdocs-system-map-r1

Date: 2026-01-21  
Scope: localdocs diagrams (clarify “blocks vs coupling”; add a fully connected end-to-end system map)

## Decision list

1) Keep “data-layer” diagrams grouped by clusters
- Decision: Treat blocks as directory/layer clusters for readability, not as isolated subsystems.
- Rationale: Large graphs become unreadable without grouping; coupling is expressed via edges.

2) Provide a single “everything connected” end-to-end System Map
- Decision: Add a zoomable Graphviz SVG that connects intent → docs/config → controlled sourcing → artifacts/evidence → preflight gates → packet → A/B(/C) → convergence → trajectory/plan → rerun loops.
- Rationale: Addresses the user request for a fully linked view across all aspects of the workflow.

3) Make manual vs automatic paths explicit
- Decision: Add explicit human “work” edges (write/edit Notes; run/generate Artifacts) and mark manual/conditional edges as dashed.
- Rationale: Avoid implying automation that does not exist; make responsibilities clear.

4) Make feedback loops explicit
- Decision: Add adjudication feedback edges and discovery/planning feedback loops (KB → Prework; Plan/Prework → Charter; Convergence → Decisions; Trajectory → Config tuning).
- Rationale: Reflects real project iteration and avoids “one-way pipeline” misconception.

5) Split preflight into phases and add KG validation
- Decision: Represent preflight as three phases (docs/evidence/claims) and include explicit claim/evidence validation.
- Rationale: Improves readability and reflects gating semantics more accurately.

## Changes landed (localdocs)

- `/Users/fkg/Nutstore Files/Coding/research-team/localdocs/research_team_architecture_diagrams_v1.md`
  - Mermaid diagram labels no longer use `\n` line breaks (use `<br/>`).
  - Added explanation of clusters vs coupling.
  - Added the new end-to-end System Map (Graphviz) links + embedded SVG.
- `/Users/fkg/Nutstore Files/Coding/research-team/localdocs/research_team_system_map_v1.dot`
- `/Users/fkg/Nutstore Files/Coding/research-team/localdocs/research_team_system_map_v1.svg` (rendered via `dot -Tsvg`)
- `/Users/fkg/Nutstore Files/Coding/research-team/localdocs/README.md` (assets index)

## Deterministic checks

- Graphviz render: `dot -Tsvg research_team_system_map_v1.dot > research_team_system_map_v1.svg` ✅

## Member reviews

- Member A (Claude Opus): **APPROVE** (minor improvements suggested)
- Member B (Gemini): **APPROVE** (suggested explicit human-work edges + loop closure)
- Member C (Claude Sonnet, non-blocking): **CONCERNS** (missing loops/ambiguity; incorporated key fixes)

## Adjudication

- Accept the diagram set with the incorporated fixes (A+B approve; C concerns addressed in-map via explicit loops/legend/splitting preflight).

## Next step

- If needed, add a “minimal novice” version of the system map (fewer nodes) plus a legend-first explanation for onboarding.

