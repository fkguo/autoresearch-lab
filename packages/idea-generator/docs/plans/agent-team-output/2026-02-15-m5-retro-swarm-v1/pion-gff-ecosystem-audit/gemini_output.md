The Pion GFF Bootstrap project demonstrates a high-fidelity control-plane (reproducible campaigns, dual-review, and sync) but suffers from significant "method drift" in the compute-plane, where a toy Monte Carlo sampler is misrepresented as a modern bootstrap feasibility study.

Method Fidelity
- Severity: H | Component: compute-plane | Location: `research/pion_gff_bootstrap/src/PionGFFBootstrap.jl` | Problem: Randomized polynomial ansatz with sigmoid mapping is a toy phase model, not a bootstrap feasibility/optimization study as claimed. | Suggestion: Require a `method_fidelity_contract` that validates the solver type (e.g., SDPB or constrained optimization) against the claimed methodology.
- Severity: M | Component: workflow | Location: `docs/research/pion-gff-bootstrap/m0.2-design.md` | Problem: Design explicitly allows "single-channel / elastic-only" which ignores crossing symmetry, a core requirement of the modern bootstrap. | Suggestion: Add a `theoretical_consistency_gate` that flags if claimed bootstrap bounds ignore known analyticity/crossing constraints from the seed literature.

Literature & Evidence
- Severity: M | Component: idea-core | Location: `artifacts/literature/search_evidence.json` | Problem: Literature expansion identified relevant quark models and holographic QCD papers, but the compute-plane failed to integrate them as comparison baselines. | Suggestion: Add an `evidence_integration_gate` requiring `results.json` to include a `comparison` field mapping current bounds against identified literature results.
- Severity: L | Component: workflow | Location: `artifacts/literature/seed_papers.json` | Problem: All seed papers are static and repo-provided; no autonomous discovery of foundational papers occurred to update or improve the seed set. | Suggestion: Implement a `seed_promotion_gate` where the system must justify adding at least one discovered paper to the seed set before M0.5.

Numerics
- Severity: M | Component: compute-plane | Location: `research/pion_gff_bootstrap/src/PionGFFBootstrap.jl:48` | Problem: Fixed-grid trapezoidal integration is used for a 1/t^2 kernel, which is prone to inaccuracy near the threshold. | Suggestion: Enforce a `numerical_best_practices_gate` requiring adaptive quadrature (e.g., QuadGK) and a convergence check artifact (N_grid vs result).
- Severity: M | Component: compute-plane | Location: `research/pion_gff_bootstrap/src/PionGFFBootstrap.jl` | Problem: Radius results are derived from random samples rather than an extremum search over the feasible space. | Suggestion: Update the `results.json` schema to require a `search_protocol` field distinguishing between `sampling`, `grid_search`, and `optimization`.

Gates & Contracts
- Severity: H | Component: idea-core | Location: `docs/research/pion-gff-bootstrap/runs/**/pipeline.json` | Problem: `MilestoneGateV1` only validates artifact existence and counts, permitting a "READY" verdict on a technically hollow toy model. | Suggestion: Upgrade to `MilestoneGateV2` with `logic_check` fields that verify numeric stability (e.g., standard deviation of bounds across campaigns < threshold).
- Severity: M | Component: hepar | Location: `src/idea_core/hepar/campaign_runner.py` | Problem: Retry/Resume logic is verified but there is no gate enforcing "numeric convergence" of the Monte Carlo samples within a campaign. | Suggestion: Add a `stability_contract` requirement to the campaign spec that fails if the aggregate bounds do not stabilize within a specified sample count.

Repo UX
- Severity: L | Component: repo-UX | Location: Root Directory | Problem: Fragmented run locations (`docs/research/.../runs/` vs `artifacts/runs/`) complicate the audit trail. | Suggestion: Standardize on a single `runs/` root in `idea-core` with project-id subdirectories, symlinking to `docs/` only for reporting.
- Severity: L | Component: repo-UX | Location: `docs/research/pion-gff-bootstrap/` | Problem: The human-readable report was missing until the final milestone, violating "transparency-first" goals. | Suggestion: Require a `draft_paper_v1.md` artifact at M0.2 that is incrementally updated and checked by the `MilestoneGate`.

Idea Generation
- Severity: M | Component: idea-core | Location: `AGENTS.md` | Problem: No explicit artifact records the rejection of alternative ansatzes during the design phase. | Suggestion: Add a `reduction_audit_v1` requirement to M0.2 where the system must list alternative approaches and the evidence-based reason for their rejection.

Risks
- Severity: H | Component: workflow | Location: `docs/research/pion-gff-bootstrap/m5-skill-policy.md` | Problem: System relies on absolute paths for runners (e.g., `/Users/fkg/...`), breaking portability for clean replays. | Suggestion: Implement a `portability_gate` that checks for absolute paths in `pipeline.json` and requires resolution via environment variables or relative paths.
- Severity: H | Component: workflow | Location: `pion-gff-bootstrap-paper.zh.md` | Problem: The report uses a "toy model disclaimer" to bypass technical rigor, which the current gate system allowed. | Suggestion: Add a `rigor_gate` that prohibits keywords like "toy model" or "disclaimer" in the final M0.5 report for "research" type projects.
