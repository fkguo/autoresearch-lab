VERDICT: NOT_READY

## Blockers

### B1. No schema files included — cannot verify contract claims
The tracker claims M0.2 is DONE with `schemas/idea_core_rpc_v1.openrpc.json` and `schemas/*.schema.json` as evidence, but **no schema content is included in this review bundle**. Without inspecting the actual OpenRPC spec and JSON Schemas, I cannot confirm:
- Whether `$ref` topology is correct (M1.3 depends on this)
- Whether the claimed artifact contracts (`IdeaNode`, `IdeaCard`, `RationaleDraft`, `PromotionResult`, `BudgetSnapshot`, `SearchStepResult`) are actually defined and internally consistent
- Whether error codes referenced in M2 (`schema_validation_failed`, `budget_exhausted`, `grounding_audit_failed`, `formalism_not_in_registry`, `insufficient_eval_data`) are enumerated in the OpenRPC spec

**Action required:** Include `schemas/` directory contents verbatim, or provide a schema digest (method list + param/result type names + error code enum) so the review can verify M0 DONE status.

### B2. Architecture spec not included — design freeze unverifiable
M0.1 cites `docs/plans/2026-02-12-idea-generator-architecture-spec.md` as evidence of design freeze, but that file is not in the bundle. Key architectural decisions that downstream milestones depend on cannot be reviewed:
- `IdeaNode` lifecycle states (draft → evaluated → ranked → promoted → rejected)
- Multi-Island state machine transitions (`STAGNANT`/`REPOPULATED` — referenced in M2.5 but never defined here)
- Explain-Then-Formalize pipeline stages (M2.7 references "stage-1" without definition)
- GroundingAudit dimensions and scoring rubric
- Team/Role topology and clean-room isolation invariants

**Action required:** Include the architecture spec or at minimum its §-level TOC + all type/enum definitions.

### B3. M1.0 is under-specified — "where does code live?" is a hard prerequisite for everything below it
M1.0 says "明确每个校验脚本/CI 位于哪个仓库" but the acceptance criterion is just "写明". This is the critical path for all of M1 and transitively M2+. Without a concrete answer (e.g., "idea-core lives at `github.com/org/idea-core`, CI runs in GitHub Actions, schemas are git-subtree'd from this design repo"), every downstream task's deliverable location is undefined.

**Action required:** Resolve M1.0 *before* declaring M0 DONE. Add a `## 0.3 Repository topology` section to the tracker with concrete repo URLs / directory layout / CI platform.

### B4. No hallucination-mitigation gate defined at the operator level
M2.6 introduces operators that generate `RationaleDraft` nodes. M2.8 introduces `GroundingAudit` as a *post-hoc* gate. But there is **no specification of what happens between operator output and grounding audit** — specifically:
- How are LLM-generated physics claims in a `RationaleDraft` tagged as `needs_grounding` vs. `asserted_without_evidence`?
- What prevents an operator from emitting a node containing a fabricated reference or a non-existent experimental result that then passes a stub grounding gate?
- The stub in M2.8 ("接口桩") is explicitly a stub — meaning the entire M2 demo campaign (M2.12) can produce **ungrounded ideas that look grounded**.

**Action required:** Add a task between M2.6 and M2.8:
> **M2.6b** Claim extraction + provenance tagging in RationaleDraft  
> Acceptance: Every factual claim in a RationaleDraft is extracted into `claims[]` with `source: "operator_generated"` tag. No claim may have `evidence_uris: []` and simultaneously `grounding_status: "grounded"`.

This is an evidence-first safety requirement, not a nice-to-have.

---

## Non-blocking

### N1. Workstream dependency graph is incomplete and likely wrong
The task board shows linear chains (e.g., W3-03 depends on W3-02 depends on W3-01) but several of these are actually parallelizable:
- `retrieval recipes` (W3-03) don't depend on `Operators x3` (W3-02) — they're consumed by operators but can be developed and tested independently
- `constraints/validators` (W3-04) can be developed in parallel with operators
- `compute plan rubric` (W3-05) is a documentation/calibration task, not blocked by validators

**Suggested fix:** Replace the linear chain with:
```
W3-01 (registry) ← W3-02 (operators), W3-03 (retrieval), W3-04 (validators), W3-05 (rubric)
```
where W3-02..W3-05 are all children of W3-01 but siblings of each other.

### N2. M2.12 "golden demo" needs a determinism contract
The acceptance says "hash 允许浮动但结构必须稳定". This is too vague for reproducibility. Define:
- A `campaign_manifest.json` that locks: seed_pack hash, operator versions, LLM model + temperature + seed (if applicable), schema versions
- "Structure stable" means: same number of nodes, same lifecycle transitions, same eval dimensions — validated by a structural diff script

### N3. Failure library (M5.4) should be promoted to M2
A failure/rejection store is not a quality-gate concern — it's a core data structure. Rejected nodes need somewhere to go from M2.9 onward. If the `IdeaStore` is append-only (M2.1), rejected nodes are already in it, but there's no query path for "show me all rejected nodes with failure_mode X". Add an index/filter to M2.1's acceptance criteria.

### N4. Language inconsistency
The tracker is primarily in Chinese with English technical terms and section headers. This is fine for internal use, but any machine-parseable artifact (schema, OpenRPC, CI scripts, error codes) **must** be English-only. State this rule explicitly.

### N5. M4 external tasks lack a handshake protocol
M4.1–M4.4 are marked "(外部)" but there's no defined interface for how this design repo communicates requirements to the hepar repo. Suggest adding a `docs/hepar-integration-contract.md` that serves as the formal "request for changes" document, with versioned requirements that hepar maintainers can accept/reject.

### N6. Update Log has exactly one entry
The Update Log discipline is well-defined but has only the initial entry. For the progress tracking rule to be credible, the next review should show at least the M1.0 resolution entry. Consider adding a "staleness alarm" rule: if no Update Log entry for >14 days, the tracker status is automatically `STALE` and must be refreshed before any DONE claims.

---

## Real-research fit

### Strengths
1. **Evidence-first gates are structural, not aspirational.** The `node.promote` requiring `IdeaCard` (M2.7) and grounding audit (M2.8) means ideas cannot advance without formalization — this mirrors real HEP workflow where a "hunch" must become a calculation before it's taken seriously.

2. **Multi-Island search is well-motivated for HEP.** Different "islands" naturally map to different BSM approaches (extra dimensions, composite Higgs, SUSY variants, etc.). The `STAGNANT → REPOPULATED` migration prevents the system from getting stuck in one theoretical framework — a real problem in human research groups.

3. **DomainPack extensibility (M3/M6.3) is architecturally sound.** The "index + on-demand load" pattern avoids the trap of hardcoding HEP knowledge into the core engine. A condensed matter or cosmology pack should slot in without touching `idea-core`.

4. **The `novelty_delta_table` (M3.4) addresses a genuine problem.** In HEP, many "new" ideas are minor reparametrizations of existing models. Forcing an explicit delta table against known work is a meaningful novelty discipline.

### Gaps
1. **No mention of experimental constraints integration.** HEP ideas must be confronted with LHC/flavor/cosmological data. The `constraints/validators` in M3.5 are too vague — they should explicitly include: (a) collider bounds (mass limits, cross-section limits), (b) flavor/CP constraints, (c) cosmological constraints (relic density, BBN). The PDG lookup skill exists but isn't wired into the validator pipeline.

2. **The `minimal_compute_plan` (M3.6) needs calibration anchors.** "log10 compute hours" is meaningless without reference points. Provide a calibration table:
   - Tree-level cross section (MadGraph): ~0.5 (= ~3 CPU-hours)
   - 1-loop EW correction: ~2 (= ~100 CPU-hours)
   - Lattice QCD measurement: ~5–6 (= 100k–1M CPU-hours)
   - Full NNLO QCD: ~3–4 (= 1k–10k CPU-hours)

3. **No mechanism for "this idea was already explored in 1997."** The retrieval recipes (M3.3) fetch evidence, but there's no explicit "prior art search" operator that queries INSPIRE for the idea's core mechanism and flags if it's been done. This is distinct from novelty scoring — it's a hard rejection gate.

---

## Robustness & safety

### S1. Grounding gate stub is a safety hazard in M2
As noted in B4, the M2 grounding gate is explicitly a stub. Any demo campaign output from M2.12 will carry an implicit "grounded" status that is actually unverified. **Mitigation:** All M2 artifacts must carry a `grounding_status: "stub_only"` watermark that is structurally incompatible with the M5 promotion gate. This prevents anyone from mistaking M2 demo output for research-quality output.

### S2. Budget circuit breaker (M2.4) needs a kill-switch, not just a counter
The current spec only mentions `steps_used` and `budget_exhausted` error. But in a multi-agent setting (M4/M6), a runaway agent could exhaust budget before the circuit breaker fires (race condition between step execution and budget check). Add:
- **Pre-flight budget check:** Before each `search.step`, verify `remaining >= estimated_step_cost`. If not, return `budget_insufficient_for_step` (distinct from `budget_exhausted`).
- **Hard wallclock timeout:** Independent of step counting, enforce a wallclock limit at the RPC server level.

### S3. Append-only IdeaStore (M2.1) needs integrity guarantees
JSONL append-only is good for auditability but fragile:
- No mention of file locking for concurrent access (relevant when M4 introduces parallel agents)
- No mention of checksums or content-addressing for individual entries
- No mention of compaction/archival strategy

**Minimum fix for M2.1:** Each JSONL line must include a `line_hash` (SHA-256 of the entry content) and a `prev_hash` (hash of the previous line), creating a hash chain. This is cheap to implement and provides tamper evidence.

### S4. Clean-room isolation (M6.2) needs a formal definition
"Clean-room" is mentioned multiple times but never defined. In this context it should mean:
- Agent A cannot read Agent B's intermediate outputs during an evaluation round
- Both agents receive identical input (same IdeaNode snapshot, same evidence packet)
- Outputs are collected by the orchestrator, not exchanged between agents
- Divergence is measured structurally (e.g., Jaccard on cited evidence URIs, agreement on pass/fail per dimension)

Add this as a definition in the architecture spec or as a new `## 0.4 Definitions` section in the tracker.

---

## Specific patch suggestions

### Patch 1: `AGENTS.md` — Add repository topology rule
**File:** `AGENTS.md`  
**Location:** After "## Where to write things"  
**Add:**
```markdown
## Repository topology (rules)

- **This repo** (`idea-generator`): design docs, schemas (SSOT), architecture specs, review outputs. No implementation code.
- **`idea-core`** (external, TBD): engine implementation, RPC server, tests, CI with schema validation. Schemas are synced from this repo (git subtree or CI fetch).
- **`hepar`** (external): control plane changes (WorkOrder/WorkResult/TeamPlan, runtime adapter). Integration contracts are defined in `docs/hepar-integration-contract.md` in this repo.
- **Language rule:** All machine-parseable artifacts (schemas, OpenRPC, error codes, CI scripts, artifact field names) must be in English. Design prose may be in any language.
```

### Patch 2: `docs/plans/2026-02-12-implementation-plan-tracker.md` — Resolve B4 (claim extraction task)
**File:** `docs/plans/2026-02-12-implementation-plan-tracker.md`  
**Location:** After M2.6 checkbox, before M2.7  
**Add:**
```markdown
- [ ] **M2.6b** Claim extraction + provenance tagging in RationaleDraft  
  - Acceptance: Every factual claim in a RationaleDraft is extracted into `claims[]` with `source: "operator_generated"` and `grounding_status: "unverified"`. Invariant: no claim may have `evidence_uris: []` AND `grounding_status: "grounded"` simultaneously. Schema enforces this via a conditional `if/then` constraint.
```

### Patch 3: Tracker — Add M2 artifact watermark requirement
**File:** `docs/plans/2026-02-12-implementation-plan-tracker.md`  
**Location:** M2.12 acceptance criteria, append:
```markdown
  - All M2 campaign artifacts must carry `grounding_mode: "stub"` in their metadata. This field is structurally incompatible with M5 promotion gates (which require `grounding_mode: "active"`), preventing accidental use of demo artifacts as research outputs.
```

### Patch 4: Tracker — Fix workstream dependency graph
**File:** `docs/plans/2026-02-12-implementation-plan-tracker.md`  
**Location:** Task board, rows W3-02 through W3-05  
**Change "Depends" column:**
```
| W3-02 | HEP Pack | Operators x3 | operator implementations | TODO | W3-01 |  |
| W3-03 | HEP Pack | retrieval recipes | query templates | TODO | W3-01 | parallel with W3-02 |
| W3-04 | HEP Pack | constraints/validators | validator outputs | TODO | W3-01 | parallel with W3-02 |
| W3-05 | HEP Pack | compute plan rubric | resource rubric | TODO | W3-01 | calibration table required |
```

### Patch 5: Tracker — Add staleness rule to §1.1
**File:** `docs/plans/2026-02-12-implementation-plan-tracker.md`  
**Location:** End of §1.1 状态约定  
**Add:**
```markdown
- **Staleness rule**: If no Update Log entry for >14 calendar days, the tracker status is `STALE`. No task may be marked `DONE` while the tracker is `STALE`. To exit `STALE`, add an Update Log entry with current status assessment.
```

### Patch 6: Tracker — Add IdeaStore integrity requirement to M2.1
**File:** `docs/plans/2026-02-12-implementation-plan-tracker.md`  
**Location:** M2.1 acceptance criteria, replace with:
```markdown
  - Acceptance:能写入/读取 `IdeaNode`；`node.list` 可分页遍历全部节点（cursor/total_count）。Each JSONL entry includes `entry_hash` (SHA-256 of content) and `prev_hash` (hash of previous entry) for tamper-evidence. Concurrent-write safety: file lock or single-writer invariant documented.
```

### Patch 7: Tracker — Add §0.3 Repository Topology (resolves B3)
**File:** `docs/plans/2026-02-12-implementation-plan-tracker.md`  
**Location:** After §0.2, before §1  
**Add:**
```markdown
### 0.3 仓库拓扑（Repository Topology）

| Repo | Purpose | CI | Schema sync |
|---|---|---|---|
| `idea-generator` (this repo) | Design docs, schemas (SSOT), architecture specs | Schema lint only | — (origin) |
| `idea-core` (TBD) | Engine implementation, RPC server, tests | Full: schema validate + unit + integration + demo replay | git subtree from `idea-generator/schemas/` |
| `hepar` (external) | Control plane, runtime adapter, ledger | Existing hepar CI + new integration tests | Fetches OpenRPC at CI time |

**Rule:** M1.0 is not DONE until this table has concrete repo URLs (not "TBD").
```

### Patch 8: Tracker — Add prior-art search gate to M3
**File:** `docs/plans/2026-02-12-implementation-plan-tracker.md`  
**Location:** After M3.4, before M3.5  
**Add:**
```markdown
- [ ] **M3.4b** Prior-art hard rejection gate (INSPIRE-based)  
  - Acceptance: Before any node reaches `eval.run`, an automated INSPIRE query checks whether the core mechanism has been published. If a match with >0.8 similarity is found, the node is flagged `prior_art_detected` with the matching paper's INSPIRE ID, and `node.promote` is blocked unless the `novelty_delta_table` explicitly addresses the difference. This is distinct from novelty scoring — it is a binary gate.
```

### Patch 9: Tracker — Add clean-room definition
**File:** `docs/plans/2026-02-12-implementation-plan-tracker.md`  
**Location:** End of §0 (after new §0.3), as new subsection  
**Add:**
```markdown
### 0.4 定义（Definitions）

- **Clean-room evaluation**: An evaluation protocol where (1) each evaluating agent receives an identical, frozen snapshot of the artifact under review plus the same evidence packet; (2) no agent can observe another agent's intermediate or final output during the evaluation round; (3) outputs are collected by the orchestrator after all agents complete; (4) divergence is measured structurally (e.g., agreement on pass/fail per eval dimension, Jaccard similarity on cited evidence URIs). Violation of any condition invalidates the evaluation round.
```
