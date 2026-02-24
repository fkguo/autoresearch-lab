# Idea-Generator Design Consultation Packet

## Context

We have built an end-to-end automated research platform called **HEP-Autoresearch** for high-energy physics. It currently supports:

- **W1 Ingest**: Paper ingestion (INSPIRE/arXiv/DOI -> KB notes + references)
- **W2 Reproduce**: Numerical reproduction of paper results
- **W3 Paper Reviser**: Evidence-first A-E pipeline for paper revision
- **W_compute**: Generic computation DAG with run_card v2
- **Phase C1 Literature Gap**: Discover literature gaps via INSPIRE tools
- **Phase C2 Method Design**: Scaffold runnable W_compute projects from gap analysis
- **Knowledge Base**: 25 literature notes, methodology traces, priors
- **Self-Evolution**: L1 memory -> L2 strategy proposals -> L3 code self-modification
- **MCP Tool Layer**: 72 tools (INSPIRE, PDG, Zotero, LaTeX, writing orchestration)
- **Multi-Agent Team**: Claude + Gemini dual review with convergence gates
- **Ecosystem Bundle**: Full deployment package with skills + MCP + orchestrator

### Architecture Principles
- Evidence-first: All conclusions must point to artifacts/derivations
- Reproducible: manifest + summary + analysis triple as SSOT
- Auditable: append-only ledger for all decisions
- Safe-by-default: A1-A5 approval gates
- Meta-orchestrator pattern: "process & constraints are ours, capability & execution belong to MCP"

### Current Gap
The system excels at **executing** research given a defined target (paper to reproduce, gap to analyze, method to implement). What it lacks is the **upstream creative intelligence**: the ability to autonomously generate novel, promising research ideas, evaluate their novelty/feasibility/impact, and select the best candidates for execution.

Phase C1 (Literature Gap) partially addresses this by discovering gaps in existing literature, but it is reactive (analyzing what's missing) rather than creative (proposing what could be). It also requires human seed selection.

## What We Want to Build: idea-generator

An AI-powered research idea generation, evaluation, and selection system that:

1. **Generates** novel research ideas through:
   - Literature-driven gap analysis (building on C1)
   - Cross-domain knowledge transfer (e.g., techniques from condensed matter applied to HEP)
   - LLM parametric knowledge with provenance tracking
   - Combinatorial exploration of existing theories/methods
   - Anomaly/tension identification in experimental data vs. theory

2. **Evaluates** ideas across multiple dimensions:
   - Novelty (vs. existing literature, using INSPIRE/Semantic Scholar)
   - Feasibility (computational/experimental requirements)
   - Impact potential (field significance)
   - Tractability (can we actually compute/derive this?)
   - Evidence grounding (is the motivation based on real data/gaps?)

3. **Selects and Prioritizes** via:
   - Multi-agent debate/ranking (different LLMs score independently)
   - Elo-based or tournament-style ranking
   - Human-in-the-loop approval gates (consistent with A1-A5 system)

4. **Feeds back** into the ecosystem:
   - Selected ideas -> C2 Method Design -> W_compute execution
   - Maintains idea branches for parallel exploration
   - Tracks idea provenance (which papers/gaps inspired it)

### Domain Scope
- Start with HEP (theory focus: QFT, nuclear physics, BSM, phenomenology)
- Design for extensibility to all theoretical physics branches
- Eventually: condensed matter, astrophysics, mathematical physics, AMO

## Key Design Questions

Please address each question with detailed analysis:

### Q1: Architecture - Standalone vs. Integrated
Should idea-generator be:
- (A) A standalone tool/service that communicates with hep-autoresearch via well-defined interfaces
- (B) A new workflow (W_idea or Phase C3) integrated directly into the orchestrator
- (C) A new skill that orchestrates existing tools
- (D) A hybrid: standalone core with skill/adapter integration

Analyze: coupling risks, reusability across domains, development velocity, maintenance burden.

### Q2: Idea Generation Pipeline Design
What should the idea generation pipeline look like? Consider:
- Multi-stage: brainstorm -> filter -> deepen -> evaluate -> rank
- Tree search (like AI Scientist v2's BFTS approach)
- Divergent-convergent (like AI-Researcher's framework)
- Knowledge-graph-grounded (like KG-CoI)
- How to handle provenance tracking for LLM-generated vs. literature-grounded ideas

### Q3: Novelty Assessment
How should we assess idea novelty?
- INSPIRE/Semantic Scholar integration for prior art check
- Embedding-based similarity to existing papers
- Multi-agent debate on novelty claims
- How to handle the "well-known but not published" problem

### Q4: Integration with Existing Ecosystem
How should idea-generator integrate with:
- Phase C1 (Literature Gap) - complement or replace?
- Phase C2 (Method Design) - handoff protocol?
- W_compute - auto-generate run_cards from ideas?
- Knowledge Base - read from and write to?
- Approval Gates - new A0 gate for idea approval?
- Self-evolution (L1-L3) - can the system learn from past idea success/failure?

### Q5: Multi-Domain Extensibility
How to design for domain extensibility without:
- Over-engineering domain abstractions
- Losing HEP-specific depth
- Making the physics knowledge pluggable

### Q6: Provenance and Traceability
How to ensure every generated idea has clear provenance:
- Which papers/results motivated it
- Which LLM knowledge contributed (with uncertainty)
- Which gap analysis triggered it
- Audit trail from idea -> method -> computation -> result

### Q7: What Exists vs. What's Missing
Based on the current ecosystem, what components can be reused and what needs to be built new?

## Reference: State of the Art (2025-2026)

Key systems to consider:
- **AI Scientist v2** (Sakana): Agentic tree search, literature-integrated ideation, 4-stage experimentation
- **AI-Researcher** (HKU, NeurIPS 2025): Divergent-Convergent Discovery Framework, multi-agent evaluation
- **Google AI Co-Scientist**: Novel hypothesis generation grounded in literature, Elo auto-evaluation
- **PhysMaster**: Autonomous AI physicist for theoretical physics
- **Chain of Ideas** (EMNLP 2025): Topic diversity and novelty metrics
- **KG-CoI**: Knowledge graph grounded chain-of-idea generation with hallucination detection
- **HypoGeniC**: Literature + data integrated hypothesis generation

## Deliverable

Provide a structured analysis covering:
1. Recommended architecture with justification
2. Detailed pipeline design
3. Integration strategy with existing ecosystem
4. Phased implementation roadmap
5. Risk analysis
6. Comparison of approaches (table format preferred)
