**VERDICT:** Adopt a **Hybrid Architecture** where `idea-generator` is a distinct **Stateful Search Engine** (exposed via MCP) driven by a new **Phase C0 (Ideation)** workflow, ensuring strict separation between stochastic creativity (exploration) and deterministic execution (research).

---

# Architecture & Design Analysis: Idea-Generator

## 1. Architectural Strategy: The Hybrid "Engine + Phase" Model

**Recommendation:** Option D (Hybrid).
Structure `idea-generator` not as a simple script, but as a persistent **"Idea Engine"** (Stateful Service/MCP Server) orchestrated by a new **Phase C0 (Ideation)** workflow within `hep-autoresearch`.

### Justification
- **State Separation:** Ideation is a *divergent, tree-search process* that generates massive amounts of "waste" (rejected ideas). The main orchestrator is designed for *convergent, linear execution* (reproduce, revise, compute). Mixing these polutes the execution ledger.
- **Async Lifecycle:** Ideas need to "marinate." An Idea Engine can run background evolution/ranking processes independently of active research runs.
- **Evidence-First Consistency:** By exposing the engine via MCP, the orchestrator can query it ("Get top 3 ranked ideas for QFT") and treat the result as an external evidence artifact, preserving the `manifest + summary + analysis` triple pattern.

### High-Level Components
1.  **Idea Engine (MCP Server)**: Manages the "Idea Graph" (database of potential ideas, relations, and scores). Implements the search algorithms (BFTS/MCTS).
2.  **Phase C0 (Ideation Workflow)**: The orchestrator process that triggers the engine, manages the "Session," and pulls selected ideas into the ecosystem.
3.  **Domain Adapters**: Pluggable modules (Prompts + Toolsets) for HEP, Condensed Matter, etc.

---

## 2. Pipeline Design: "The Funnel of Validity"

The pipeline must filter noise early to save compute on expensive verification.

### ASCII Data Flow Diagram

```text
[ Trigger ] (C1 Gap / User / Data Anomaly)
     |
     v
[ 1. Expansion Layer ] <--- (LLM + Domain Knowledge/Priors)
     |  -> Generates N=50+ raw candidates (Context-Free Grammar or Template)
     |
[ 2. Fast Filter ] <--- (Embedding Check / Basic Heuristics)
     |  -> Reject duplicates, nonsense, off-topic
     |  -> Keep N=10
     |
[ 3. Grounding Layer ] <--- (INSPIRE / arXiv Tools)
     |  -> "Does this contradict known physics?"
     |  -> "Is this trivially solved?" (Novelty Check Level 1)
     |  -> Annotate with citations (Provenance)
     |
[ 4. Deep Evaluation ] <--- (Multi-Agent Debate / Referee-Review Skill)
     |  -> Feasibility Assessment (Can W_compute handle this?)
     |  -> Impact Scoring
     |
[ 5. Selection Gate (A0) ] <--- (Human in Loop)
     |
     v
[ Output Artifact ] -> "Research Proposal" (JSON+Markdown)
     |
     +-> [ Phase C2: Method Design ]
```

### Key Mechanisms
- **Expansion:** Use **Evolutionary Prompts**. Take a known paper/method, apply mutation operators ("Change Metric", "Apply to new Particle", "Invert Assumptions").
- **Grounding:** Mandatory step. An idea is not an object until it has a bibliography. The system must find $k$ nearest papers. If similarity > 0.9, reject as "Already Done." If similarity < 0.1, reject as "Hallucination/Unrelated."
- **Deep Eval:** Re-use the `referee-review` skill but configured for *proposals* instead of *papers*.

---

## 3. Novelty Assessment Strategy

Novelty is the hardest metric. Do not rely on one signal. Use a **Composite Novelty Score (CNS)**.

1.  **Semantic Distance ($S_{emb}$)**: Cosine distance of the idea's abstract embedding vs. the nearest 50 papers in the specific sub-field (retrieved via INSPIRE).
    - *Target:* "Goldilocks Zone" (Novel but adjacent).
2.  **Claims Search ($S_{claim}$)**: Extract specific claims (e.g., "Axion mass > 1eV"). Search these specific scalar/logical constraints in the Knowledge Base and INSPIRE metadata.
3.  **Agent Debate ($S_{qual}$)**:
    - **Agent A (Proposer)**: Argues why this is new.
    - **Agent B (Devil's Advocate)**: searches specifically for "Why is X known?" or "X derived from Y".
    - *Verdict:* The debate transcript becomes part of the evidence artifact.

**Handling "Well-known but unpublished":**
- This requires **Textbook/Lecture Note ingestion**.
- *Mitigation:* Include a specific "Standard Model Consistency Check" step using the `hep-calc` skill or `PDG` tools. If a standard calculation rules it out, it's likely "folk knowledge" that it doesn't work.

---

## 4. Ecosystem Integration

| Component | Integration Strategy |
| :--- | :--- |
| **Phase C1 (Gaps)** | **Upstream Feeder**. C1 outputs `gap_analysis.json`. Phase C0 inputs this as the "Seed" for the Expansion Layer. |
| **Phase C2 (Method)** | **Downstream Consumer**. C0 outputs `proposal.json` (Objective, Hypothesis, Context). C2 consumes this to generate the execution plan. |
| **W_compute** | **Indirect Target**. C2 converts the proposal into a `run_card`. Idea-generator *never* touches W_compute directly (separation of concerns). |
| **Knowledge Base** | **Read/Write**. Reads `methodology_traces` for "what we can do". Writes `rejected_ideas` to prevent re-generation of failures. |
| **Approval Gates** | **New Gate A0 (Proposal Approval)**. Placed between C0 (Ideation) and C2 (Method). Requires human sign-off on the "Research Direction" before resource allocation. |

---

## 5. Multi-Domain Extensibility (The "Adapter" Pattern)

Avoid hardcoding HEP. Structure the logic as:

```python
class ResearchDomainAdapter:
    def get_literature_tools(self) -> List[Tool]: ... # INSPIRE vs PubMed
    def get_validity_constraints(self) -> List[Constraint]: ... # Gauge Inv vs Energy Conserv
    def get_template_library(self) -> Path: ... # QFT Templates vs Material Templates
```

- **Core Logic:** Tree search, ranking, debate, provenance (Universal).
- **Plugins:** The actual prompts and verification tools (Domain Specific).
- **Implementation:** Start with `HEPDomainAdapter`. Later add `CondensedMatterAdapter`.

---

## 6. Provenance & Traceability (The "Genealogy" Graph)

We must treat Ideas as **DAGs** (Directed Acyclic Graphs).

- **Root Nodes:** Existing Papers (RecIDs), C1 Gap Artifacts, Experimental Anomalies.
- **Operation Nodes:** "Mutation: Cross-Domain", "Mutation: Refinement".
- **Child Nodes:** The Generated Idea.

**Artifact Schema (`idea_manifest.json`):**
```json
{
  "idea_id": "UUID",
  "genealogy": {
    "parents": ["INSPIRE:12345", "GAP:C1-2025-01"],
    "generation_method": "evolutionary_mutation",
    "mutation_operator": "apply_technique_X_to_system_Y"
  },
  "content": {
    "title": "...",
    "hypothesis": "...",
    "derivation_sketch": "..."
  },
  "evidence": {
    "supporting_papers": [...],
    "novelty_score": 0.85,
    "feasibility_score": 0.7
  },
  "status": "A0_PENDING"
}
```
*This ensures that if an idea is successful, we can trace exactly which paper or gap inspired it.*

---

## 7. Gap Analysis: Build vs. Reuse

| Capability | Status | Action |
| :--- | :--- | :--- |
| **Literature Search** | **Existing** (INSPIRE Tools) | Reuse. |
| **Novelty/Similarity** | **Partial** (Embeddings exist?) | **Build** robust semantic search & debate protocol. |
| **Feasibility Check** | **Missing** | **Build** "Tractability Heuristic" (maps idea -> required compute). |
| **Tree Search** | **Missing** | **Build** the "Idea Engine" Core (BFTS/MCTS). |
| **Debate/Review** | **Existing** (`referee-review`) | **Adapt** existing skill for proposals. |
| **Prompt Library** | **Missing** | **Build** domain-specific mutation prompts. |

---

## 8. Implementation Roadmap

1.  **Phase 0: The "Idea Object" (Week 1-2)**
    - Define the JSON schema for an `Idea` and `Proposal`.
    - Implement the `IdeaNode` graph storage (simple JSONL or SQLite).
    - **Deliverable:** A static registry of manually created ideas that flows into C2.

2.  **Phase 1: The Evaluator (Week 3-4)**
    - Build the "Novelty & Feasibility" agent loop.
    - Integrate INSPIRE for novelty checks.
    - **Deliverable:** A tool that takes a human idea and scores it.

3.  **Phase 2: The Generator (Week 5-6)**
    - Implement the Expansion Layer (Tree Search).
    - Create the Mutation Prompt Library for HEP.
    - **Deliverable:** End-to-end "Button press -> 10 ranked ideas".

4.  **Phase 3: Integration (Week 7-8)**
    - Connect C1 -> Idea Gen -> A0 -> C2.
    - Deploy as Phase C0 in the orchestrator.

## Risks & Mitigations

-   **Risk:** **Hallucinated Physics**. LLMs inventing gauge groups or particles that don't make sense.
    -   *Mitigation:* Strict "Grounding" step. Every term used must be mapped to a Wikidata entity or INSPIRE keyword.
-   **Risk:** **Triviality**. Generating homework problems.
    -   *Mitigation:* The "Textbook Check" using `hep-calc` / `referee-review` specifically instructed to look for standard results.
-   **Risk:** **Loop Explosion**. Generating infinite variations.
    -   *Mitigation:* Fixed budget (Token/Cost) per Idea Session. strict MCTS limitations.

---

**Next Step:** Initialize the `idea-generator` repository as a standalone TypeScript/Python package (to act as the MCP server) within the ecosystem, defining the `Idea` schema first.
