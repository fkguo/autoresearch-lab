I'll analyze this design consultation systematically. Let me first check for relevant skills.

**Verdict: Option D (Hybrid) — standalone idea-generation core with thin skill/adapter integration into the existing hepar orchestrator, implemented in three phases starting with a literature-grounded pipeline before adding creative exploration.**

---

# Idea-Generator Design Analysis

## Table of Contents

1. [Recommended Architecture (Q1)](#1-recommended-architecture)
2. [Pipeline Design (Q2)](#2-pipeline-design)
3. [Novelty Assessment (Q3)](#3-novelty-assessment)
4. [Ecosystem Integration (Q4)](#4-ecosystem-integration)
5. [Multi-Domain Extensibility (Q5)](#5-multi-domain-extensibility)
6. [Provenance & Traceability (Q6)](#6-provenance--traceability)
7. [Reuse vs. Build-New Inventory (Q7)](#7-reuse-vs-build-new-inventory)
8. [Phased Implementation Roadmap](#8-phased-implementation-roadmap)
9. [Risk Analysis](#9-risk-analysis)
10. [Approach Comparison Matrix](#10-approach-comparison-matrix)

---

## 1. Recommended Architecture

### Decision: **Option D — Hybrid (Standalone Core + Skill/Adapter Integration)**

#### Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                    Human / Orchestrator                      │
│                     (hepar meta-orchestrator)                │
│                                                             │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌────────────┐ │
│  │ A0 Gate  │  │ A1..A5   │  │ L1-L3    │  │ KB Manager │ │
│  │ (new)    │  │ Gates    │  │ Self-Evo │  │            │ │
│  └────┬─────┘  └──────────┘  └─────┬────┘  └─────┬──────┘ │
└───────┼────────────────────────────┼──────────────┼────────┘
        │                            │              │
        ▼                            ▼              ▼
┌───────────────────────────────────────────────────────────┐
│              idea-generator skill (thin adapter)           │
│  ┌──────────────────────────────────────────────────────┐ │
│  │  Translates hepar commands ↔ idea-generator API      │ │
│  │  Maps KB notes → seed contexts                       │ │
│  │  Routes approved ideas → C2 Method Design            │ │
│  └──────────────────────────────────────────────────────┘ │
└──────────────────────────┬────────────────────────────────┘
                           │ JSON-RPC / stdio
                           ▼
┌──────────────────────────────────────────────────────────────┐
│              idea-generator core (standalone)                  │
│                                                                │
│  ┌─────────┐  ┌──────────┐  ┌──────────┐  ┌──────────────┐ │
│  │ Ideation │→│ Deepen   │→│ Evaluate │→│ Rank/Select  │  │
│  │ Engine   │  │ & Ground │  │ (multi-  │  │ (Elo + Gate) │ │
│  │          │  │          │  │  agent)  │  │              │  │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘  └──────┬───────┘ │
│       │              │              │               │          │
│  ┌────┴──────────────┴──────────────┴───────────────┴───────┐│
│  │              Idea Store (append-only, JSONL)              ││
│  │              + Provenance Graph (DAG)                      ││
│  └───────────────────────────────────────────────────────────┘│
│       │              │                                        │
│  ┌────┴────┐    ┌────┴─────┐                                 │
│  │ Domain  │    │ Strategy │  ← loaded per-domain            │
│  │ Plugins │    │ Plugins  │  (HEP, condensed matter, ...)   │
│  └─────────┘    └──────────┘                                 │
└──────────────────────────────────────────────────────────────┘
        │                    │
        ▼                    ▼
  MCP Tool Layer        External APIs
  (INSPIRE, PDG,        (Semantic Scholar,
   Zotero, KB)           OpenAlex, arXiv)
```

#### Justification — Option-by-Option Analysis

| Criterion | A (Standalone) | B (New Workflow) | C (Skill Only) | **D (Hybrid)** |
|-----------|---------------|-----------------|----------------|----------------|
| **Coupling** | None — but loses KB/gate access | High — tied to hepar internals | Medium — skill is thin but logic embedded in prompt | **Low core coupling, thin adapter** |
| **Reusability** | Excellent across domains | Poor — hepar-specific | Poor — Claude-specific | **Excellent core, HEP adapter is thin** |
| **Dev velocity** | Slow (must build all integrations) | Fast initially, debt later | Fast initially, ceiling fast | **Moderate start, sustained velocity** |
| **Maintenance** | Separate codebase | Entangled with orchestrator | Prompt drift risk | **Clean boundaries, testable** |
| **Domain extensibility** | Easy | Requires orchestrator changes | Requires skill rewrites | **Plugin architecture in core** |
| **Evidence-first compliance** | Must be reimplemented | Inherited | Inherited | **Core enforces, adapter maps** |

**Key insight**: The idea-generator has fundamentally different lifecycle dynamics than a reproducibility workflow. Workflows like W2 (Reproduce) are deterministic DAGs: input → steps → output. Idea generation is *stochastic search with backtracking* — more like a tree search than a pipeline. Forcing this into the existing linear workflow model would either cripple the search or require so many special cases that the workflow abstraction becomes meaningless.

The hybrid lets the core use whatever search strategy works (BFTS, MCTS, evolutionary) while the skill adapter presents a clean interface to hepar: `generate(seed_context) → ranked_ideas[]`.

---

## 2. Pipeline Design

### Recommended: **Grounded Tree Search with Divergent-Convergent Phases**

This combines the strongest elements from the SOTA:
- **AI Scientist v2's** tree search for systematic exploration
- **AI-Researcher's** divergent-convergent framing for phase discipline
- **KG-CoI's** knowledge-graph grounding for hallucination prevention
- **HypoGeniC's** data-integration for tension-driven ideas

### Pipeline Architecture

```
Phase 1: SEED (Divergent)
│
├── Literature Gap Seeds ←── C1 output (existing)
├── Tension/Anomaly Seeds ←── PDG + experimental data vs. theory
├── Cross-Domain Seeds ←── embedding similarity across subfields
├── Parametric Seeds ←── LLM brainstorm (marked as ungrounded)
│
▼
Phase 2: EXPAND (Tree Search)
│
│  For each seed, expand into concrete research questions.
│  Use BFTS (Best-First Tree Search):
│
│  root: seed idea
│  ├── child_1: specific formulation A
│  │   ├── grandchild_1a: computation approach
│  │   └── grandchild_1b: analytical approach
│  ├── child_2: specific formulation B
│  │   └── ...
│  └── child_3: specific formulation C
│
│  Expansion operator: LLM generates N children per node
│  Selection:  score(novelty, feasibility, impact) → pick best-first
│  Termination: max_depth=4, max_nodes=50 per seed, time budget
│
▼
Phase 3: GROUND (Convergent)
│
│  For each leaf node (concrete idea):
│  ├── INSPIRE search: find 5 closest existing papers
│  ├── Semantic Scholar: citation context analysis
│  ├── PDG lookup: relevant experimental constraints
│  ├── KB check: does our existing knowledge base cover this?
│  └── Provenance annotation: tag each claim as
│      {literature_grounded, data_grounded, llm_inferred, gap_derived}
│
▼
Phase 4: EVALUATE (Multi-Agent)
│
│  Independent scoring by ≥2 agents (Claude + Gemini):
│  ├── Novelty score [0-10] + justification + prior art refs
│  ├── Feasibility score [0-10] + resource estimate
│  ├── Impact score [0-10] + affected subfields
│  ├── Tractability score [0-10] + estimated person-months
│  └── Grounding score [0-10] + ungrounded claim count
│
│  Convergence gate: agents must agree within ±2 on each dimension
│  or enter structured debate (max 3 rounds)
│
▼
Phase 5: RANK & SELECT
│
│  ├── Elo tournament: pairwise comparison by fresh LLM judge
│  ├── Pareto frontier: non-dominated ideas on (novelty, feasibility)
│  ├── Portfolio construction: diversify across subfields/methods
│  └── → A0 Gate: human reviews top-K ideas with full provenance
│
▼
Phase 6: HANDOFF
│
│  Approved ideas → IdeaCard (structured output)
│  IdeaCard → C2 Method Design → W_compute run_card
```

### IdeaCard Schema (the SSOT for an idea)

```yaml
# idea_card.yaml — Single Source of Truth for one research idea
idea_id: "idea-2025-001"
version: 1
status: "proposed"  # proposed | evaluating | approved | rejected | executing | completed

# ── Core Content ──────────────────────────────────────────
title: "One-loop corrections to dark photon production in nuclear transitions"
abstract: |
  We propose computing the full one-loop QED+BSM corrections to dark photon
  emission in nuclear magnetic transitions, addressing the O(10%) tension
  between theoretical predictions and the ATOMKI anomaly measurements.

research_questions:
  - "What is the magnitude of NLO corrections to the M1 transition rate?"
  - "Can loop corrections shift the predicted invariant mass peak?"

# ── Provenance ────────────────────────────────────────────
seeds:
  - type: "tension"
    source: "PDG:dark_photon_limits vs ATOMKI:2023"
    description: "Persistent 6.8σ anomaly in 8Be transitions"
  - type: "literature_gap"
    source: "C1:gap-2025-003"
    description: "No complete NLO calculation exists for this process"
  - type: "llm_inferred"
    model: "claude-sonnet-4-20250514"
    prompt_hash: "sha256:abc123..."
    confidence: "medium"
    description: "Suggested nuclear form factor effects may be larger than assumed"

parent_ideas: []  # tree search lineage
child_ideas: []

# ── Evaluation ────────────────────────────────────────────
scores:
  novelty:
    value: 8
    justification: "No published NLO calculation. Closest: [2301.12345] does LO only."
    prior_art:
      - {inspire_id: "2301.12345", relevance: "high", overlap: "LO only"}
      - {inspire_id: "2205.67890", relevance: "medium", overlap: "different transition"}
  feasibility:
    value: 7
    justification: "Standard FeynCalc/LoopTools workflow. Nuclear matrix elements from [2103.xxxxx]."
    resources: {compute_hours: 50, human_months: 0.5}
  impact:
    value: 9
    justification: "Direct relevance to ATOMKI anomaly. ~200 citations/year in this area."
  tractability:
    value: 7
    justification: "One-loop with known techniques. Main challenge: nuclear form factors."
  grounding:
    value: 8
    ungrounded_claims: 1
    ungrounded_details: ["Nuclear form factor assumption needs validation"]

evaluation_agents:
  - {agent: "claude-sonnet-4-20250514", timestamp: "2025-07-13T10:00:00Z"}
  - {agent: "gemini-2.5-pro", timestamp: "2025-07-13T10:05:00Z"}
convergence: {achieved: true, rounds: 1, max_disagreement: 1.5}

elo_rating: 1847
pareto_rank: 2  # on novelty-feasibility frontier

# ── Approval ──────────────────────────────────────────────
approval:
  gate: "A0"
  status: "pending"  # pending | approved | rejected | deferred
  reviewer: null
  timestamp: null
  notes: null

# ── Downstream ────────────────────────────────────────────
method_design: null   # link to C2 output when created
run_card: null        # link to W_compute run_card when generated
results: null         # link to computation results

# ── Metadata ──────────────────────────────────────────────
created: "2025-07-13T09:45:00Z"
modified: "2025-07-13T10:10:00Z"
tags: ["BSM", "dark_photon", "nuclear", "NLO", "ATOMKI"]
domain: "hep-ph"
```

### Tree Search Details

The BFTS approach is preferred over flat brainstorming because:

1. **Depth**: Flat brainstorming produces surface-level ideas. Tree search forces deepening.
2. **Pruning**: Bad branches are abandoned early, saving LLM calls.
3. **Provenance**: The tree structure IS the provenance — each node records its parent and expansion reasoning.
4. **Budget control**: `max_nodes` and `time_budget` give deterministic cost bounds.

```
Scoring function for BFTS node selection:
  score(node) = w_n * novelty_estimate(node) 
              + w_f * feasibility_estimate(node)
              + w_d * depth_bonus(node)      # encourage depth
              - w_r * redundancy_penalty(node) # penalize siblings too similar

Default weights: w_n=0.35, w_f=0.25, w_d=0.15, w_r=0.25
(configurable per domain in domain plugin)
```

**Quick estimates** at expand-time use a single LLM call with few-shot prompting (cheap). Full multi-agent evaluation (Phase 4) is reserved for leaf nodes that survive to the grounding phase.

---

## 3. Novelty Assessment

### Multi-Layer Novelty Pipeline

```
Layer 1: LEXICAL DEDUP (fast, cheap)
│  ├── TF-IDF or BM25 against INSPIRE title+abstract corpus
│  ├── Threshold: if top-1 similarity > 0.85, flag as "likely exists"
│  └── Cost: ~10ms per idea, local index
│
▼
Layer 2: SEMANTIC SIMILARITY (moderate cost)
│  ├── Embed idea abstract using SPECTER2 or SciBERT
│  ├── k-NN search against paper embedding index (k=20)
│  ├── For each neighbor: LLM judges "does this paper already do what the idea proposes?"
│  ├── Output: {similar_papers: [...], max_overlap_score: float}
│  └── Cost: ~$0.02 per idea (embedding + 20 short LLM calls)
│
▼
Layer 3: STRUCTURED PRIOR ART CHECK (higher cost, high precision)
│  ├── INSPIRE search with constructed queries:
│  │   ├── keyword-based: extract 3-5 key physics concepts
│  │   ├── citation-based: who cites the seed papers?
│  │   └── author-based: who works on this exact topic?
│  ├── For top-10 results: full abstract comparison via LLM
│  ├── Output: {prior_art: [...], novelty_assessment: str, confidence: float}
│  └── Cost: ~$0.10 per idea
│
▼
Layer 4: MULTI-AGENT NOVELTY DEBATE (highest cost, for top candidates only)
│  ├── Agent A (Claude): argue FOR novelty, citing gaps in prior art
│  ├── Agent B (Gemini): argue AGAINST novelty, citing potential overlaps
│  ├── Judge Agent: evaluate arguments, produce final novelty score
│  ├── Special prompt: "Consider unpublished but well-known results,
│  │   conference talks, and community knowledge"
│  └── Cost: ~$0.50 per idea
```

### Handling "Well-Known but Not Published"

This is the hardest problem in automated novelty assessment. Mitigations:

1. **Conference proceedings search**: arXiv has many proceedings-only results. INSPIRE indexes talks. Query both.
2. **Citation context analysis**: If a result is "well-known," it's often mentioned in passing in review papers or introductions. Search for phrases like "it is well known that..." or "as shown by..." in citing contexts.
3. **LLM parametric knowledge with calibration**: Ask the LLM: "Is this a well-known result in the community? Rate your confidence." Cross-reference with the structured search. If LLM says "well-known" but no papers found, flag for human review.
4. **Community heuristic**: If >3 independent LLM agents (different providers/temperatures) all say "this is known," treat as likely known even without a specific citation. Log this as `provenance: community_knowledge, confidence: medium, needs_human_verification: true`.
5. **A0 gate as safety net**: The human reviewer is the final backstop. The system should surface its uncertainty: "We found no published prior art, but 2/3 agents believe this may be community knowledge."

---

## 4. Ecosystem Integration

### Integration Map

```
                    ┌──────────────┐
                    │  idea-generator │
                    │     core       │
                    └───────┬────────┘
                            │
              ┌─────────────┼─────────────┐
              │             │             │
              ▼             ▼             ▼
    ┌─────────────┐ ┌────────────┐ ┌───────────┐
    │ READS FROM  │ │ WRITES TO  │ │ TRIGGERS  │
    ├─────────────┤ ├────────────┤ ├───────────┤
    │ KB (25 notes)│ │ KB (idea   │ │ C2 Method │
    │ C1 gap list │ │  notes)    │ │  Design   │
    │ PDG data    │ │ Idea Store │ │ W_compute │
    │ INSPIRE API │ │ Provenance │ │ A0 gate   │
    │ L1 memory   │ │  graph     │ │ L1 memory │
    │ Prior ideas │ │ Elo ratings│ │           │
    └─────────────┘ └────────────┘ └───────────┘
```

### Specific Integration Contracts

#### C1 (Literature Gap) → idea-generator

**Relationship: Complement, not replace.** C1 remains the systematic gap-finder. idea-generator consumes C1 output as one seed source among several.

```typescript
// C1 produces:
interface GapAnalysis {
  gap_id: string;
  description: string;
  evidence: { paper_id: string; relevant_quote: string }[];
  severity: "minor" | "moderate" | "significant" | "critical";
  subfield: string;
}

// idea-generator consumes:
interface IdeaSeed {
  seed_type: "literature_gap" | "tension" | "cross_domain" | "parametric" | "anomaly";
  source_id: string;       // e.g., "C1:gap-2025-003"
  context: string;         // natural language description
  evidence: Evidence[];    // grounding references
  priority_hint: number;   // from C1 severity or other heuristic
}

// Adapter: gap_to_seed(GapAnalysis) → IdeaSeed
```

#### idea-generator → C2 (Method Design)

**Handoff protocol: IdeaCard → MethodSpec**

```typescript
// idea-generator produces (on A0 approval):
interface ApprovedIdea {
  idea_card: IdeaCard;     // full provenance
  suggested_approach: string;  // from tree search leaf node
  estimated_resources: ResourceEstimate;
  key_references: string[];    // INSPIRE IDs for method papers
}

// C2 consumes and produces:
interface MethodSpec {
  idea_id: string;         // back-link
  computation_type: "symbolic" | "numerical" | "mixed";
  tools_required: string[];  // e.g., ["FeynCalc", "LoopTools"]
  run_card_template: RunCardV2;
  validation_criteria: ValidationCriterion[];
}
```

#### idea-generator → W_compute

**Not direct.** Ideas flow through C2 first. This enforces the evidence-first principle: no computation without a validated method design.

```
idea-generator →[A0 gate]→ C2 Method Design →[A2 gate]→ W_compute
```

#### Knowledge Base Integration

**Bidirectional:**

```
READ:
  - idea-generator queries KB for existing notes on relevant topics
  - Uses KB methodology traces to assess feasibility
  - Reads prior idea notes to avoid regenerating rejected ideas

WRITE:
  - Each evaluated idea becomes a KB note (type: "idea_note")
  - Provenance graph stored alongside
  - Rejection reasons stored for future reference
  
KB Note Schema for Ideas:
  type: "idea_note"
  idea_id: "idea-2025-001"
  status: "proposed|approved|rejected|completed"
  tags: [...]
  content: {idea_card_yaml}
  linked_notes: [inspire_ids, gap_ids, other_idea_ids]
```

#### Approval Gate: A0

**New gate, inserted before A1:**

```
Gate Hierarchy (updated):
  A0: Idea Approval       ← NEW (human reviews idea before any execution)
  A1: Calculation Plan
  A2: Intermediate Results
  A3: Final Results
  A4: Paper Draft
  A5: Submission
```

A0 Gate Contract:
```yaml
a0_gate:
  input:
    - ranked_idea_list: IdeaCard[]  # top-K from ranking
    - provenance_summary: string     # human-readable provenance
    - novelty_report: NoveltyReport  # from Layer 3-4 assessment
    - risk_flags: string[]           # any concerns from evaluation
  
  output:
    - decisions: {idea_id: string, decision: "approve"|"reject"|"defer"|"modify", notes: string}[]
  
  constraints:
    - at least one idea must be explicitly approved or all rejected
    - rejection requires a reason (feeds back to L1 memory)
    - "modify" returns to expand phase with human guidance
```

#### Self-Evolution Integration (L1-L3)

```
L1 (Memory):
  - Store: which seed types produced approved ideas
  - Store: which ideas were rejected and why
  - Store: evaluation calibration data (agent scores vs. human decisions)

L2 (Strategy Proposals):
  - Analyze L1 patterns: "tension-based seeds produce 3x more approved ideas than parametric"
  - Propose: adjust seed weights, modify scoring function weights
  - Propose: add new seed sources based on successful patterns

L3 (Code Self-Modification):
  - Auto-tune BFTS parameters (w_n, w_f, w_d, w_r) based on approval rates
  - Add new domain plugins when patterns emerge
  - Modify evaluation rubrics based on calibration data
```

---

## 5. Multi-Domain Extensibility

### Plugin Architecture

```
idea-generator/
├── core/
│   ├── pipeline.py          # domain-agnostic orchestration
│   ├── tree_search.py       # BFTS implementation
│   ├── idea_store.py        # append-only storage
│   ├── provenance.py        # DAG tracking
│   ├── ranking.py           # Elo + Pareto
│   └── interfaces.py        # abstract types
│
├── domains/
│   ├── __init__.py
│   ├── base.py              # DomainPlugin ABC
│   ├── hep/
│   │   ├── __init__.py
│   │   ├── plugin.py        # HEPPlugin(DomainPlugin)
│   │   ├── seed_sources.py  # INSPIRE, PDG, ATOMKI tensions...
│   │   ├── feasibility.py   # FeynCalc/LoopTools availability checks
│   │   ├── ontology.py      # HEP concept hierarchy
│   │   └── prompts/         # HEP-specific LLM prompts
│   │       ├── brainstorm.md
│   │       ├── evaluate_novelty.md
│   │       └── evaluate_feasibility.md
│   │
│   └── condensed_matter/    # future
│       ├── plugin.py
│       ├── seed_sources.py  # materials databases, band structures...
│       └── prompts/
│
├── strategies/
│   ├── base.py              # SearchStrategy ABC
│   ├── bfts.py              # Best-First Tree Search
│   ├── evolutionary.py      # Future: genetic algorithm over ideas
│   └── mcts.py              # Future: Monte Carlo Tree Search
│
└── adapters/
    ├── hepar_skill.py       # hepar orchestrator adapter
    ├── mcp_bridge.py        # MCP tool access
    └── cli.py               # standalone CLI
```

### DomainPlugin Interface

```python
from abc import ABC, abstractmethod
from typing import List

class DomainPlugin(ABC):
    """
    Minimal interface a domain must implement.
    Everything else is inherited from the core.
    """
    
    @abstractmethod
    def get_seed_sources(self) -> List[SeedSource]:
        """Return available seed generators for this domain."""
        ...
    
    @abstractmethod
    def get_evaluation_rubric(self) -> EvaluationRubric:
        """Return domain-specific scoring criteria and weights."""
        ...
    
    @abstractmethod
    def get_feasibility_checker(self) -> FeasibilityChecker:
        """Return a callable that estimates computational feasibility."""
        ...
    
    @abstractmethod
    def get_concept_ontology(self) -> ConceptOntology:
        """Return domain concept hierarchy for cross-pollination."""
        ...
    
    @abstractmethod
    def get_prompt_templates(self) -> Dict[str, str]:
        """Return domain-specific prompt templates for each pipeline stage."""
        ...
    
    # Optional overrides with sensible defaults:
    def get_tree_search_params(self) -> TreeSearchParams:
        """Domain-specific BFTS tuning. Defaults to core params."""
        return TreeSearchParams.default()
    
    def get_prior_art_sources(self) -> List[PriorArtSource]:
        """Domain-specific literature databases."""
        return [InspireSource()]  # default for HEP
```

### Extensibility Principles

1. **Depth first, width later**: The HEP plugin should be *excellent* before adding condensed matter. The plugin interface should emerge from the HEP implementation, not be designed top-down.

2. **Prompts are the primary domain knowledge carrier**: Most physics knowledge lives in the LLM prompt templates. Domain ontology and seed sources are lightweight; the prompts do the heavy lifting.

3. **Shared evaluation framework**: The 5-dimension scoring (novelty, feasibility, impact, tractability, grounding) is domain-agnostic. Only the rubric details change per domain.

4. **Cross-domain seeds are a core feature, not a plugin feature**: The core's `cross_domain_seed_generator` takes two `ConceptOntology` instances and finds analogies. This requires at least 2 domain plugins to be loaded, but the logic is in the core.

---

## 6. Provenance & Traceability

### Provenance Graph Model

```
ProvenanceNode:
  id: UUID
  type: "paper" | "gap" | "tension" | "seed" | "idea_node" | "evaluation" | "decision"
  content: {...}
  timestamp: ISO8601
  agent: string          # which LLM/human created this

ProvenanceEdge:
  source: UUID
  target: UUID
  relation: "inspired_by" | "expanded_from" | "grounded_by" | 
            "evaluated_by" | "approved_by" | "rejected_for" |
            "refined_into" | "contradicted_by"
  metadata: {...}
  timestamp: ISO8601
```

### Provenance Enforcement Rules

1. **No orphan ideas**: Every idea node must have at least one `inspired_by` edge to a paper, gap, or tension node.
2. **LLM claims tagged**: Every claim from LLM parametric knowledge must include `{model, prompt_hash, confidence}`.
3. **Grounding ratio tracked**: `grounding_score = grounded_claims / total_claims`. Ideas with `grounding_score < 0.5` are flagged.
4. **Append-only ledger**: Provenance graph is append-only. Corrections add new edges (`corrected_by`), never delete existing ones.
5. **Audit trail on demand**: Given any idea, the system can reconstruct the full path: `papers → gaps → seeds → tree expansion → evaluation → decision`.

### Implementation: Lightweight DAG

Don't use a graph database for v1. Use a JSONL file with adjacency list:

```jsonl
{"id": "prov-001", "type": "paper", "data": {"inspire_id": "2301.12345"}}
{"id": "prov-002", "type": "gap", "data": {"gap_id": "C1:gap-2025-003"}, "edges": [{"target": "prov-001", "rel": "derived_from"}]}
{"id": "prov-003", "type": "seed", "data": {"seed_type": "literature_gap"}, "edges": [{"target": "prov-002", "rel": "inspired_by"}]}
{"id": "prov-004", "type": "idea_node", "data": {"depth": 0, "title": "..."}, "edges": [{"target": "prov-003", "rel": "expanded_from"}]}
{"id": "prov-005", "type": "idea_node", "data": {"depth": 1, "title": "..."}, "edges": [{"target": "prov-004", "rel": "expanded_from"}]}
```

This is queryable with `jq`, versionable with git, and upgradeable to a proper graph store later.

---

## 7. Reuse vs. Build-New Inventory

| Component | Status | Reuse Strategy |
|-----------|--------|---------------|
| **INSPIRE MCP tools** | ✅ Exists (72 tools) | Direct reuse for prior art search, citation analysis |
| **PDG lookup** | ✅ Exists | Direct reuse for tension/anomaly identification |
| **Zotero integration** | ✅ Exists | Direct reuse for reference management |
| **C1 Literature Gap** | ✅ Exists | Consume output as seed source; don't modify C1 |
| **C2 Method Design** | ✅ Exists | Handoff target; may need minor schema extension |
| **Multi-agent team** | ✅ Exists (Claude+Gemini) | Reuse convergence gate pattern for evaluation |
| **KB Manager** | ✅ Exists | Add `idea_note` type; otherwise reuse as-is |
| **Approval gates** | ✅ Exists (A1-A5) | Add A0; reuse gate infrastructure |
| **L1-L3 Self-evolution** | ✅ Exists | Wire in idea success/failure signals |
| **run_card v2** | ✅ Exists | Auto-generate from IdeaCard + C2 output |
| **hepar orchestrator** | ✅ Exists | Add `idea-generator` as new phase; thin integration |
| **Idea Store** | 🔨 Build new | Append-only JSONL + IdeaCard schema |
| **Provenance Graph** | 🔨 Build new | JSONL DAG (lightweight) |
| **Tree Search (BFTS)** | 🔨 Build new | Core algorithm; no existing equivalent |
| **Novelty Assessment** | 🔨 Build new (reuses INSPIRE) | 4-layer pipeline; Layers 1-2 use existing tools |
| **Elo Ranking** | 🔨 Build new | Simple implementation (~200 LOC) |
| **Domain Plugin System** | 🔨 Build new | HEP plugin first; interface extracted later |
| **Seed Generators** | 🔨 Build new (partially) | Gap seeds from C1; tension/cross-domain/parametric new |
| **Evaluation Rubric** | 🔨 Build new | Prompt templates + scoring framework |
| **idea-generator skill** | 🔨 Build new | Thin adapter between hepar and core |
| **Embedding Index** | 🔨 Build new (or defer) | Optional for Phase 1; SPECTER2 embeddings for novelty |

**Summary: ~60% reuse, ~40% new code. The new code is concentrated in the search/evaluation core — the ecosystem integration is mostly wiring.**

---

## 8. Phased Implementation Roadmap

### Phase 1: Grounded Ideation MVP (4-6 weeks)

**Goal**: Literature-driven idea generation with manual evaluation.

```
Build:
  ├── IdeaCard schema + Idea Store (JSONL)
  ├── Provenance graph (JSONL DAG)
  ├── Seed generators:
  │   ├── C1 gap adapter (consume existing output)
  │   └── Parametric brainstorm (LLM with HEP prompts)
  ├── Flat expansion (no tree search yet — just N ideas per seed)
  ├── Grounding pipeline (INSPIRE search for each idea)
  ├── Single-agent evaluation (Claude only, 5 dimensions)
  ├── A0 gate (CLI-based human review)
  └── idea-generator skill (basic hepar integration)

Skip:
  ├── Tree search (use flat brainstorm)
  ├── Multi-agent evaluation (single agent)
  ├── Elo ranking (simple score sort)
  ├── Cross-domain seeds
  ├── Domain plugin system (hardcode HEP)
  └── Embedding-based novelty
  
Deliverable: Generate 20 ideas from 5 seeds, ground against INSPIRE,
  present top-5 to human reviewer with provenance.
Validation: At least 1 idea approved by domain expert as "worth pursuing."
```

### Phase 2: Deep Search + Multi-Agent Evaluation (4-6 weeks)

**Goal**: Tree search for deeper ideas, multi-agent evaluation with convergence.

```
Build:
  ├── BFTS tree search
  ├── Multi-agent evaluation (Claude + Gemini, convergence gate)
  ├── Elo tournament ranking
  ├── Tension/anomaly seed generator (PDG + experimental data)
  ├── 4-layer novelty pipeline (lexical + semantic + INSPIRE + debate)
  ├── KB write-back (idea notes)
  ├── L1 memory integration (track approvals/rejections)
  └── C2 handoff (approved ideas → method design)

Deliverable: Full pipeline from seeds → tree search → evaluation → ranking → A0 → C2.
Validation: End-to-end: idea generated → approved → C2 method spec → W_compute run_card.
```

### Phase 3: Intelligence + Extensibility (6-8 weeks)

**Goal**: Cross-domain creativity, self-tuning, domain plugins.

```
Build:
  ├── Cross-domain seed generator
  ├── Embedding index (SPECTER2) for semantic novelty
  ├── Domain plugin system (extract from HEP hardcoding)
  ├── L2/L3 self-evolution integration (auto-tune search params)
  ├── Portfolio construction (diversified idea selection)
  ├── Parallel idea exploration (idea branches)
  └── Comprehensive provenance visualization

Deliverable: System that discovers ideas a physicist wouldn't have considered,
  grounded in cross-domain analogies.
Validation: At least 1 cross-domain idea approved by domain expert.
```

### Phase 4: Production Maturity (ongoing)

```
Build:
  ├── Second domain plugin (condensed matter or astrophysics)
  ├── MCTS/evolutionary search alternatives
  ├── Calibration system (compare predictions vs. outcomes)
  ├── Batch ideation mode (weekly idea reports)
  └── Dashboard / visualization for idea portfolio
```

---

## 9. Risk Analysis

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| **LLM hallucination produces plausible but wrong physics** | High | Critical | 4-layer novelty check; grounding score threshold; A0 human gate; never skip grounding phase |
| **Novelty assessment misses existing work** | High | High | Conservative approach: flag uncertainty; "well-known" heuristic; human reviewer as backstop |
| **Tree search explodes in cost** | Medium | Medium | Hard budget caps (max_nodes, time_budget, $ budget); quick estimates for expansion, full eval only at leaves |
| **Ideas are "novel but trivial"** | High | Medium | Impact scoring dimension; Elo ranking naturally penalizes; domain expert prompts that emphasize non-triviality |
| **Over-engineering domain plugin system too early** | Medium | Medium | Phase 1-2: hardcode HEP. Extract plugin interface in Phase 3 only after two concrete domains need it |
| **Multi-agent debate degenerates into agreement** | Medium | Low | Structured adversarial prompts; one agent explicitly prompted to argue against; temperature variation |
| **Integration with hepar creates tight coupling** | Low | High | Thin adapter skill; core has zero imports from hepar; all communication via IdeaCard schema |
| **Idea store grows unboundedly** | Low | Low | Archival policy: ideas older than 6 months with status "rejected" moved to archive; provenance preserved |
| **Users ignore A0 gate and auto-approve** | Medium | High | A0 gate requires structured justification (not just "approve"); audit log; periodic meta-review of approval quality |
| **Cross-domain seeds produce nonsensical analogies** | High | Low | Low risk because cross-domain is Phase 3; by then, grounding pipeline is mature; always requires literature grounding |

### Critical Risk Deep-Dive: Hallucination in Physics Ideas

This is the #1 risk. An LLM can generate a research idea that sounds correct but violates conservation laws, gauge invariance, or known experimental constraints. Mitigations are layered:

1. **Structural**: Every idea must pass through the GROUND phase, which queries INSPIRE/PDG for consistency.
2. **Evaluative**: The feasibility scorer explicitly checks: "Can this be formulated as a well-defined calculation?" If not, feasibility score drops.
3. **Adversarial**: In multi-agent evaluation, one agent is explicitly prompted: "Find physics errors in this idea. Check conservation laws, symmetries, and experimental constraints."
4. **Human**: A0 gate. The system should present ideas as *proposals*, not conclusions. The human physicist is the final arbiter.
5. **Feedback**: Rejected ideas (especially those rejected for physics errors) feed into L1 memory, allowing the system to learn common failure modes.

---

## 10. Approach Comparison Matrix

| Feature | **Our Design** | AI Scientist v2 | AI-Researcher | Co-Scientist | KG-CoI | HypoGeniC |
|---------|---------------|-----------------|---------------|-------------|--------|-----------|
| **Search** | BFTS with domain plugins | BFTS (Agentic) | Flat divergent-convergent | Iterative refinement | KG-guided | Data-driven |
| **Grounding** | 4-layer (lexical→semantic→INSPIRE→debate) | Literature review | Literature grounding | Literature + web | Knowledge graph | Literature + experimental data |
| **Evaluation** | Multi-agent 5-dim + Elo | Automated review | Multi-agent debate | Elo tournament | Coherence scoring | Expert scoring |
| **Domain specificity** | Plugin architecture (HEP first) | ML experiments | General science | Biomedicine | General | Biomedicine |
| **Provenance** | Full DAG with typed edges | Partial (paper refs) | Partial | Partial | KG lineage | Data lineage |
| **Human-in-loop** | A0 gate (mandatory) | Optional | Optional | Elo includes human | None | Expert review |
| **Hallucination mitigation** | Grounding score + adversarial agent + physics checks | Experiment validation | Multi-agent cross-check | Tournament filtering | KG consistency check | Data consistency |
| **Ecosystem integration** | Deep (KB, C1, C2, W_compute, L1-L3) | Self-contained | Self-contained | Self-contained | Self-contained | Self-contained |
| **Extensibility** | Domain plugins | Hardcoded for ML | Moderate | Hardcoded for bio | Requires KG per domain | Hardcoded for bio |
| **Cost control** | Budget caps + quick estimates | Token limits | Fixed rounds | Fixed tournament | Fixed KG ops | Fixed pipeline |

### Why Our Approach Differs

The key differentiator is **ecosystem integration**. Every existing system (AI Scientist, Co-Scientist, etc.) is self-contained — they generate, evaluate, and execute ideas in isolation. Our design leverages:

1. **72 existing MCP tools** for grounding (no other system has this)
2. **25 KB notes** of accumulated domain knowledge
3. **C1 gap analysis** as a structured seed source
4. **C2 → W_compute** as a validated execution pipeline
5. **L1-L3 self-evolution** for continuous improvement
6. **Multi-agent convergence gates** already battle-tested

We're not building a standalone idea generator — we're adding *creative intelligence* to an existing research automation platform. This is a fundamentally different (and harder) integration challenge, but the payoff is a system that can go from idea → published result with minimal human intervention.

---

## Summary of Recommendations

1. **Architecture**: Hybrid (D). Standalone core, thin skill adapter. No hepar imports in core.
2. **Pipeline**: 6-phase (Seed → Expand → Ground → Evaluate → Rank → Handoff) with BFTS tree search.
3. **Novelty**: 4-layer progressive deepening (lexical → semantic → structured → debate).
4. **Integration**: Complement C1 (don't replace), feed C2 via IdeaCard, add A0 gate, wire L1-L3.
5. **Extensibility**: Domain plugins, but don't build the plugin system until Phase 3. HEP hardcoded in Phase 1-2.
6. **Provenance**: Append-only JSONL DAG. Every idea traceable to sources. Grounding score as first-class metric.
7. **Start with Phase 1**: Flat brainstorm + INSPIRE grounding + single-agent eval + A0 gate. Validate with a domain expert. Then add depth.
