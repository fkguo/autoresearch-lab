Verdict: Build **Option D (hybrid)**—a standalone `idea-core` engine with strict artifact contracts, exposed as a first-class orchestrator phase (`C3/W_idea`) plus skill/adapters, gated by a new `A0` idea-promotion approval.

**Recommended Architecture (Q1)**
- Choose a **two-layer architecture**: domain-agnostic `idea-core` + ecosystem-specific `C3/W_idea` orchestrator wrapper.
- Keep **process/governance in orchestrator** (gates, manifests, audit), and **capability in MCP/tools** (consistent with your meta-orchestrator principle).
- Add a thin `idea-skill` only for interactive operation; do not make skill the system of record.
- Treat `idea-core` as artifact-first and transport-agnostic (CLI/MCP/API can all call same contracts).

| Option | Coupling to current stack | Cross-domain reuse | Delivery speed | Long-term maintenance | Recommendation |
|---|---:|---:|---:|---:|---|
| A Standalone service only | Low | High | Medium | Medium-High (dup ops) | Too detached for gates/SSOT |
| B Directly integrated workflow only | High | Low-Medium | High | High (tight coupling) | Good short-term, poor portability |
| C Skill-only orchestration | Medium | Medium | Very High | Fragile (not core infra) | Good prototype, not production |
| D Hybrid core + adapters | **Medium-Low** | **High** | **High** | **Medium** | **Best balance** |

**Concrete Component Boundaries**
- `idea-core`: generation/search/evaluation/ranking/provenance logic.
- `idea-domain-pack-hep`: HEP ontology, query templates, feasibility heuristics, method blueprints.
- `idea-adapter-orchestrator`: maps run manifests/gates/artifacts to core contracts.
- `idea-adapter-mcp`: calls INSPIRE/PDG/Zotero/KB tools and normalizes evidence payloads.
- `idea-ui/skill`: operator-facing campaign launch, branch triage, manual override.

**High-Level Data Flow**
```text
[C1 gaps] [KB priors] [user seeds] [anomaly detectors]
      \        |           |              /
       --------+-----------+-------------
                    |
              (C3/W_idea wrapper)
                    |
               [idea-core]
   S1 Generate -> S2 Ground -> S3 Novelty
        -> S4 Evaluate -> S5 Debate/Elo -> S6 Select
                    |
                 [A0 Gate]
             approve | reject/park
                    |
             [C2 Method Design]
                    |
               [W_compute]
                    |
          results -> L1/L2/L3 feedback
```

**Interface Contracts (Artifact SSOT)**
- `idea_campaign_request_v1.json`: domain, objective, constraints, budget, seed sources.
- `idea_seed_pack_v1.json`: normalized seeds from C1/KB/anomaly/user.
- `idea_candidates_v1.jsonl`: candidate ideas with parent/branch lineage.
- `idea_evidence_graph_v1.json`: claim-level evidence links and confidence.
- `idea_novelty_report_v1.json`: prior-art neighbors, overlap metrics, folklore risk.
- `idea_scorecards_v1.json`: novelty/feasibility/impact/tractability/grounding scores + uncertainty.
- `idea_tournament_v1.json`: pairwise outcomes, Elo trajectory, adjudication notes.
- `idea_selection_v1.json`: promoted/parked/rejected with reasons.
- `idea_handoff_c2_v1.json`: method-ready spec for C2 (question, hypotheses, observables, compute sketch).

**Idea Generation Pipeline (Q2)**
- Use a **hybrid search strategy**: divergent-convergent outer loop + bounded tree search inner loop + KG/evidence grounding at every stage.
- Pipeline stages:
  - `S0 Intake`: campaign charter + constraints.
  - `S1 Divergent Ideation`: generate candidates via 5 operators (gap-extension, cross-domain transfer, combinatorial synthesis, tension-driven, parametric conjecture).
  - `S2 Evidence Grounding`: attach claims to retrieved evidence; unresolved claims marked speculative.
  - `S3 Branch Expansion`: expand top branches with bounded factor/depth (beam/tree search).
  - `S4 Convergent Filtering`: prune by grounding, novelty floor, tractability floor.
  - `S5 Multi-Agent Debate`: independent evaluators + prosecutor/defender pass.
  - `S6 Ranking`: tournament/Elo + calibrated aggregate score.
  - `S7 Selection/Handoff`: A0 approval then C2 packet generation.

**Ranking Formula (practical default)**
- `priority = 0.30 novelty + 0.20 feasibility + 0.20 impact + 0.15 tractability + 0.15 grounding - overlap_penalty + exploration_bonus`
- Keep `exploration_bonus` nonzero to avoid mode collapse into conservative ideas.

**Approach Comparison (Pipeline Strategy)**
| Strategy | Strength | Weakness | Use in your system |
|---|---|---|---|
| Pure BFTS (AI Scientist-like) | Strong exploration | Compute-expensive, branch explosion | Use bounded in `S3` only |
| Pure Divergent-Convergent | Easy to operate | Can miss deep branch opportunities | Use as outer control loop |
| Pure KG-CoI style grounding | Hallucination resistance | Can under-generate truly novel hypotheses | Use as grounding verifier, not generator |
| Recommended hybrid | Balanced novelty + rigor | More moving parts | Best fit for evidence-first HEP |

**Novelty Assessment (Q3)**
- Implement a **4-layer novelty stack**:
  - `N1 Retrieval novelty`: INSPIRE-first; Semantic Scholar for cross-domain spillover.
  - `N2 Embedding/structure novelty`: abstract+equation-token similarity, citation neighborhood overlap.
  - `N3 Claim novelty debate`: agent prosecutor tries to prove “already known”.
  - `N4 Folklore risk`: “known but unpublished” estimate.
- Output labels: `incremental`, `adjacent-novel`, `high-novel`, `speculative-high-risk`.
- Add a `folklore_risk` score; if high, require explicit human sign-off at A0.

**Handling “Well-Known but Not Published”**
- Mine review articles/textbooks/proceedings as non-primary prior-art sources.
- Force evaluators to provide “earliest known mention candidate” even if non-refereed.
- Penalize unsupported novelty claims when only parametric LLM memory supports them.
- Route unresolved cases to manual `A0-folklore` adjudication rather than auto-promote.

**Integration with Existing Ecosystem (Q4)**
- **C1 (Literature Gap)**: keep and **embed as one seed channel**, not replacement.
- **C2 (Method Design)**: consume `idea_handoff_c2_v1.json`; reject if required fields absent.
- **W_compute**: generate `run_card v2` skeleton only after C2 validation.
- **Knowledge Base**:
  - Read: priors, failed methods, unresolved tensions, benchmark problems.
  - Write: idea lineage notes, rejection reasons, post-execution outcomes.
- **Approval Gates**:
  - Add `A0.1` Campaign charter (scope/budget).
  - Add `A0.2` Idea promotion (before C2).
  - Keep A1-A5 unchanged downstream.
- **Self-evolution L1-L3**:
  - L1 stores idea outcome metrics.
  - L2 proposes strategy/weight updates.
  - L3 code changes only via existing controlled self-mod pipeline.

**Handoff Contract to C2 (must-have fields)**
- `idea_id`, `branch_id`, `thesis_statement`
- `testable_hypotheses[]`
- `required_observables[]`
- `candidate_formalisms[]` (e.g., EFT/lattice/perturbative/QCD sum-rule)
- `minimal_compute_plan[]` with expected runtime class
- `risk_register[]` and `evidence_uris[]`

**Multi-Domain Extensibility (Q5)**
- Use **Domain Pack** plugins, but keep only 4 extension points initially:
  - `seed_enrichers`
  - `query_expanders`
  - `feasibility_estimators`
  - `method_compilers`
- Do not abstract everything now; only extract interfaces proven by HEP + one second domain.
- Keep HEP depth by shipping `hep-theory-pack` with concrete ontologies (QFT/BSM/nuclear/phenomenology).
- Add new domains by adding pack + tests, not by modifying `idea-core`.

**Provenance and Traceability (Q6)**
- Make provenance **claim-level**, not idea-level.
- Each claim stores:
  - `claim_id`, `claim_text`
  - `support_type` (`literature`, `derived`, `transfer`, `parametric`)
  - `source_uri[]` (artifact pointers)
  - `support_strength`, `uncertainty`
  - `llm_contribution` (model, prompt hash, timestamp)
- Enforce promotion policy: no `A0.2` if grounding ratio below threshold.
- Maintain append-only ledger events:
  - `idea.generated`, `evidence.attached`, `novelty.assessed`, `rank.updated`, `idea.promoted`, `handoff.c2`, `run.compute.started`, `result.closed`.

**End-to-End Audit Chain**
```text
paper/gap evidence -> idea claim -> selected idea
-> C2 method spec -> W_compute run_card -> compute artifacts
-> result summary -> feedback to L1/L2/L3
```

**What Exists vs What’s Missing (Q7)**
| Capability | Reuse now | Build new |
|---|---|---|
| Evidence tooling | MCP INSPIRE/PDG/Zotero/LaTeX stack | Evidence normalization for ideation claims |
| Orchestration/governance | A1-A5 gates, manifests, ledger, run lifecycle | `A0` gate logic + idea campaign state machine |
| Literature gap input | C1 phase | Multi-source seed fusion (C1 + anomaly + transfer + KB priors) |
| Method execution path | C2 + W_compute | Idea→C2 handoff schema/validator |
| Multi-agent infrastructure | Claude+Gemini convergence pattern | Ideation-specific debate roles + Elo/tournament engine |
| Knowledge memory | Existing KB + traces | Idea lineage graph + success/failure analytics |
| Self-evolution | L1-L3 scaffolding | Reward signals tied to idea outcomes |

**Phased Implementation Roadmap**
- **Phase 0 (1–2 weeks)**: define schemas + `A0` gate + minimal `C3/W_idea` wrapper.
- **Phase 1 (2–4 weeks)**: MVP generation/grounding/novelty with INSPIRE-first retrieval.
- **Phase 2 (2–3 weeks)**: multi-agent debate + tournament/Elo ranking + branch manager.
- **Phase 3 (2–3 weeks)**: C2 handoff compiler + `run_card v2` skeleton generation.
- **Phase 4 (2–3 weeks)**: learning loop (idea outcome metrics → L1/L2 tuning).
- **Phase 5 (later)**: second domain pack pilot (e.g., condensed matter) to validate abstractions.

**Implementation Priorities (Strict Order)**
- P0: contracts, provenance, A0 gate (foundation).
- P1: novelty pipeline + folklore-risk controls.
- P2: ranking/debate robustness.
- P3: C2/W_compute handoff automation.
- P4: adaptive strategy learning.

**Risk Matrix and Mitigation**
| Risk | Impact | Mitigation |
|---|---|---|
| Hallucinated novelty | High | Multi-layer novelty stack + prosecutor agent + folklore gate |
| Branch explosion / compute burn | High | Hard campaign budgets, bounded beam/depth, early pruning |
| Conservative mode collapse | Medium-High | Exploration bonus + diversity constraints in ranking |
| Weak provenance on creative ideas | High | Claim-level provenance schema + grounding threshold for promotion |
| Tool/API instability | Medium | Adapter isolation + retry/backoff + cached retrieval artifacts |
| Score gaming by agents | Medium-High | Blind pairwise judging, role separation, random audit prompts |
| Domain drift beyond HEP quality | Medium | Domain-pack acceptance tests + phased rollout per domain |
| Self-evolution regressions | High | Keep L3 under existing approval/testing gates only |

If useful, I can next draft the **exact JSON schemas** for the 9 artifacts and a **minimal `W_idea` state machine spec** you can drop into the orchestrator.