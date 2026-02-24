VERDICT: NOT_READY

## Blockers

### B1. `ProblemReduction` operator lacks a "reduction validity" gate before downstream promotion

The `ProblemReduction` operator (§2.12 of the operators doc) specifies `reduction_map`, `known_solutions`, and `minimal_toy_check` — but there is no **formal gate** that validates the reduction itself is sound before the transfer plan is allowed to proceed. The spec says "必做验证" includes checking that `reduction_map` is consistent with hard constraints, but this is described only as prose guidance to the Checker role, not as a machine-enforceable gate analogous to the `grounding_audit` gate in §4.2.1 of the architecture spec.

**Why this blocks**: A faulty reduction (e.g., mapping a non-convex problem to a convex solver, or ignoring a symmetry-breaking boundary condition) propagated into `IdeaCard.candidate_formalisms[]` would pass the existing grounding audit (citations resolve, data is consistent) but produce a structurally wrong method plan at C2. This is the single highest-risk failure mode for the cross-disciplinary workflow.

**Required fix**: Add a `reduction_audit` gate (parallel to `grounding_audit`) with machine-checkable fields: `assumptions_satisfied: bool[]`, `toy_check_result: pass|fail|skipped`, `reduction_type_valid: bool`. The `node.promote` precondition must include `reduction_audit.status == pass` when `operator_family ∈ {ProblemReduction, TechniqueTransplant}`.

### B2. No schema or artifact contract for the "math/CS solved" workflow discipline

Section 7 of the architecture spec says the system "should优先启用 `ProblemReduction`/`TechniqueTransplant`" when a bottleneck can be reduced to a standard problem, but there is no artifact type, no schema, and no SearchPolicy hook that would make this actually happen. The `known_solutions` field in the operator output is described narratively but has no schema entry in the §5.1 SSOT artifacts list.

**Required fix**: (a) Add `schemas/reduction_report_v1.schema.json` to the SSOT list. (b) Define a `SearchPolicy` predicate (e.g., `should_attempt_reduction(node, domain_pack) -> bool`) that fires before more expensive generative operators, giving `ProblemReduction` priority when the node's bottleneck matches a registered abstract problem type. (c) Add `reduction_report` as an optional field on `IdeaNode` (alongside `grounding_audit`).

### B3. Distributor factorization strategy is underspecified for the joint `backend × operator × island × team` space

The stat-phys doc (§5 note 1) recommends factorized distributions but the architecture spec (§3.3) describes the Distributor as allocating across both LLM backends and operators/islands without specifying whether factorization is mandatory or optional, or what the default is. The `distributor_policy_config_v1.json` artifact (statphys §4.1) includes `factorization` as a field but the architecture spec's `search.step` RPC has no parameter or return field that surfaces which factorization was used.

**Why this blocks**: Without a declared factorization strategy in the RPC/artifact contract, two independent implementations (e.g., Claude adapter vs. Gemini adapter) could produce incompatible distributor logs, breaking replay and audit.

**Required fix**: (a) Add `distributor_factorization: "joint" | "factorized"` to `campaign.init` params (or `CampaignCharter`). (b) Add `distributor_policy_config_ref` to `SearchStepResult` so the audit trail links each step to its policy config. (c) The OpenRPC spec must reference `distributor_policy_config_v1.schema.json`.

### B4. `BanditPolicy` plug-in interface is not defined

The architecture spec (§3.3) says "建议将 Distributor 设计为 BanditPolicy 可插拔" and the bandit doc provides excellent theory, but there is **no interface definition** for `BanditPolicy` — no method signatures, no lifecycle hooks, no state contract. The `Operator` has `OperatorSpec` (operators doc §1), `SearchPolicy` has state machine + predicates (arch spec §3.2.1), but `Distributor`/`BanditPolicy` has nothing comparable.

**Required fix**: Define a minimal `BanditPolicySpec` interface:
```
BanditPolicySpec:
  policy_id: string
  policy_family: enum  # annealed_gibbs | replicator_mw | ucb_v | thompson | ...
  select(eligible_arms, context_features, budget_snapshot) -> ArmSelection
  update(arm_id, reward, cost, metadata) -> void
  state() -> BanditPolicyState  # for snapshot/replay
  config() -> DistributorPolicyConfig  # the §4.1 artifact
```
This must live in the architecture spec §3.3, not only in the supplementary docs.

---

## Non-blocking

### N1. Elo `max_rounds` without a convergence criterion risks wasted budget or unstable rankings

`rank.compute(method=elo, elo_config={max_rounds, seed})` is specified but there's no convergence check (e.g., `max_rating_change < δ` over last `k` rounds). Recommendation: add optional `convergence_threshold` to `elo_config`; if omitted, run all `max_rounds`.

### N2. Entropy floor `ε` and temperature `T` are not campaign-level auditable parameters

The statphys doc recommends `ε ∈ [0, 0.2]` and various `T` schedules, but neither appears in `campaign.init` params or `CampaignCharter`. They should be first-class campaign parameters (with defaults) so that different campaigns are reproducibly comparable.

### N3. `folklore_risk_score` threshold is undefined

§4.2.1 says "超过阈值则必须走 `A0-folklore` 人类裁定" but no default threshold is given, and the threshold is not a campaign parameter. Suggest: default `0.7`, configurable in `CampaignCharter.folklore_threshold`.

### N4. `novelty_delta_table` schema is not in the SSOT list

§6.2 defines `novelty_delta_table` with 5 required sub-fields but it's not listed in §5.1 as a schema to deliver. Add `schemas/novelty_delta_table_v1.schema.json`.

### N5. Replicator policy (Policy B) importance-weighted estimator has known high-variance issues

The `1/max(p_i, p_min)` clipping is mentioned but `p_min` has no default or guidance. For a system where `N` can be 20+ (backends × operators × islands), `p_min` needs to be at least `1/(10N)` to avoid explosive variance. Document this as a hard lower bound.

### N6. `CrossDomainAnalogy` requires "at least 5 mapping items" — this is arbitrary and may be too rigid for early-stage exploration

During divergent phase, requiring 5 items per mapping table could kill valuable but nascent analogies. Suggest: 5 items for convergent phase / promote gate; 3 items minimum during divergent phase, flagged as `mapping_completeness: partial`.

### N7. Team cost multiplier accounting is vague

§3.4.3 says `BudgetEnvelope.extensions` can carry `team_cost_multiplier` but doesn't specify how the Distributor consumes it. The statphys doc's `C_i` (cost EMA) should explicitly incorporate team topology cost. Add a formula: `C_i = base_model_cost_i * team_cost_multiplier(team_policy_id)`.

### N8. Idempotency JCS canonicalization for floating-point fields

RFC 8785 JCS has specific rules for floating-point serialization. If `temperature`, `score_weights`, or other floats appear in RPC params, the spec should note that JCS float serialization (IEEE 754 → shortest decimal) must be used consistently. This is a subtle source of `idempotency_key_conflict` false positives.

### N9. `distributor_events_v1.jsonl` should be cross-referenced in the architecture spec's SSOT artifact list (§5.1)

Currently the distributor artifacts only appear in the statphys doc. They need to be promoted to the main artifact list with stable names.

### N10. Missing error code for `reduction_audit_failed`

If B1 is adopted, add `reduction_audit_failed` to the error code list in §2.3.

---

## Real-research fit

### Strengths

1. **The operator taxonomy is genuinely useful for HEP research**. `AnomalyAbduction`, `SymmetryOperator`, `LimitExplorer`, and `ProtectiveBeltPatch` map directly to how theoretical physicists actually think. The requirement for kill criteria and explicit verification plans per operator is exactly right — it mirrors what a good advisor demands of a postdoc's proposal.

2. **`ProblemReduction` addresses a real blind spot**. Many HEP bottlenecks (parameter fitting, signal extraction, lattice inversion) are instances of well-studied math/CS problems. Making "check if math already solved this" a first-class operator is high-leverage and rarely done systematically in physics research.

3. **The `novelty_delta_table` with `non-novelty flags` is excellent**. The explicit enumeration of what does NOT count as novelty (parameter tuning, symbol renaming, narrative reframing) addresses a real failure mode of LLM-based ideation where superficial variation is scored as innovation.

4. **Evidence-first grounding audit with active URI resolution** is the right level of rigor. Phantom citations are the #1 hallucination risk in LLM-assisted literature work; requiring active INSPIRE/DOI lookup before promotion is essential.

5. **Multi-island evolution with repopulation** maps well to how research communities actually work — parallel groups pursuing different strategies with occasional cross-pollination at conferences/workshops.

### Gaps for real research use

1. **No "literature saturation" signal**. In real research, you often discover that an idea is already explored (not just "similar" but "exactly this, published 2019"). The grounding audit checks citation validity but not "has this exact approach been tried and reported." Need a `prior_art_saturation` check that goes beyond novelty scoring to explicit "this was done by X, here's the paper" identification.

2. **The "Derivation" role is underspecified for HEP**. In practice, a quick consistency check in HEP means: check Ward identities, check decoupling limits, check unitarity bounds, check anomaly cancellation. These are domain-specific and should be enumerable in the HEP DomainPack's `constraints_and_validators`, not left as a generic "推导/一致性检查."

3. **No mechanism for incorporating failed attempts**. Real research heavily benefits from knowing "we tried X and it failed because Y." The seed sources (§8.1) mention "KB priors（已有笔记/失败记录）" but there's no structured artifact for failure records, and no operator that specifically exploits them (e.g., a `FailureAnalysis` operator that takes a failed approach and diagnoses what specifically broke).

---

## Robustness & safety

### Hallucination mitigation

**Good**: The grounding audit with active URI resolution, mandatory `verification_plan` for LLM inferences, and clean-room evaluation are strong safeguards.

**Gap**: The spec doesn't address **self-consistent hallucination loops** where the Ideator generates a plausible-sounding mechanism, the Librarian finds real papers that seem related (but don't actually support the claim), and the Formalizer packages it with valid-looking citations. The grounding audit checks URI resolution and data consistency but not **semantic relevance** (does the cited paper actually support this specific claim?).

**Recommendation**: Add a `claim_support_relevance` check to the grounding audit: for each `(claim, evidence_uri)` pair, verify that the cited source actually discusses the claimed phenomenon/mechanism/result, not just a topically related paper. This can be a lightweight LLM check with clean-room isolation from the Ideator.

### Provenance integrity

**Good**: Append-only ledger, `operator_trace` with `prompt_snapshot_hash`, idempotency with JCS canonicalization.

**Gap**: No integrity check on the ledger itself. If the ledger is JSONL on disk, there's no mechanism to detect tampering or corruption. For research reproducibility, consider adding a hash chain (each entry includes `prev_entry_hash`) or periodic Merkle root checkpoints.

### Budget safety

**Good**: Circuit breaker, degradation order, step-level fuse, multi-dimensional budget envelope.

**Gap**: The `team_cost_multiplier` interaction with the budget circuit breaker is unspecified. A team with 6 roles could burn 6× the expected budget in a single tick. The tick atomicity requirement (§2.3 note 3) means you can't interrupt mid-tick. Recommendation: before starting a tick, the engine must check `estimated_tick_cost(team_topology) <= budget_remaining` and refuse to start if not (returning `budget_exhausted` with `reason: insufficient_for_minimum_tick`).

### A0.2 promotion invariants

**Good**: `grounding_audit.status == pass` as hard gate, `formalism_not_in_registry` rejection, schema validation.

**Missing invariant**: No check that `IdeaCard.testable_hypotheses[]` is non-empty. An idea with no testable hypotheses should never be promoted. Add `len(testable_hypotheses) >= 1` as a `node.promote` precondition.

---

## Specific patch suggestions

### Patch 1: `docs/plans/2026-02-12-idea-generator-architecture-spec.md` — Add `BanditPolicySpec` interface to §3.3

**Location**: After the paragraph "建议将 Distributor 设计为 **BanditPolicy 可插拔**" (approx line in §3.3)

**Add**:
```markdown
#### 3.3.1 BanditPolicy 接口（最小可实现规格）

```text
BanditPolicySpec:
  policy_id: string
  policy_family: enum    # annealed_gibbs | replicator_mw | ucb_v | bayes_ucb | thompson | exp3 | softmax_ema_baseline
  action_space: ActionSpaceSpec  # factorization + enumeration
  select(eligible_arms: ArmId[], context: ContextFeatures, budget: BudgetSnapshot) -> ArmSelection
  update(arm_id: ArmId, reward: float, cost: CostVector, metadata: object) -> void
  state() -> BanditPolicyState     # serializable; sufficient for replay
  config() -> DistributorPolicyConfig  # immutable per campaign; = §4.1 artifact in statphys doc

ArmSelection:
  chosen_arm: ArmId
  selection_logits: {ArmId: float}   # pre-normalization scores (for audit)
  selection_probs: {ArmId: float}    # post-normalization + floor
  rng_seed_used: string | null       # null if deterministic policy
  diagnostics: {entropy_H, N_eff, free_energy_F, kl_to_prev}
```

**硬纪律**：
- `select()` 的全部输入与输出必须写入 `distributor_events_v1.jsonl`（一条 per tick）。
- `config()` 在 campaign 生命周期内不可变；变更必须通过新 campaign 或显式 `campaign.reconfigure`（v1.0+）。
- `action_space.factorization` 必须在 `campaign.init` 的 charter 中声明（`"joint" | "factorized"`），且写入 `distributor_policy_config_v1.json`。
```

### Patch 2: `docs/plans/2026-02-12-idea-generator-architecture-spec.md` — Add `reduction_audit` to promotion invariants in §4.2.1

**Location**: After item 5 ("晋升门禁") in §4.2.1

**Add**:
```markdown
6. **归约审计（reduction_audit，条件性强约束）**：当 `IdeaNode.operator_family ∈ {ProblemReduction, TechniqueTransplant}` 时，`node.promote` 的成功条件**额外**要求 `reduction_audit.status == pass`。审计最小检查项：
   - `assumptions_satisfied[]`：归约所需的每条前提是否被验证或标注为 `pending_verification`（全部 `pending` 则 `partial`，任一 `false` 则 `fail`）
   - `toy_check_result: pass | fail | skipped`（`skipped` 仅在 `Coder` 角色不可用时允许，且必须标注 `skip_reason`）
   - `reduction_type_valid: bool`（抽象问题类型是否在 DomainPack 的 `abstract_problem_registry` 中注册）
   - 审计输出写入 `IdeaNode.reduction_audit`
```

### Patch 3: `docs/plans/2026-02-12-idea-generator-architecture-spec.md` — Add distributor artifacts to §5.1 SSOT list

**Location**: §5.1 artifact list, after `idea_handoff_c2_v1.json`

**Add**:
```markdown
- `distributor_policy_config_v1.json`（每 campaign 一份；不可变）
- `distributor_events_v1.jsonl`（append-only；每 tick 一行）
- `distributor_state_snapshot_v1.json`（可选；周期性快照）
- `distributor_diagnostics_v1.json`（可选；run 结束汇总）
- `reduction_report_v1.json`（条件性；ProblemReduction/TechniqueTransplant 算子产出）
- `novelty_delta_table_v1.json`（每次 novelty 评审产出）
```

### Patch 4: `docs/plans/2026-02-12-idea-generator-architecture-spec.md` — Add `reduction_audit_failed` error code and `testable_hypotheses` invariant to §2.3

**Location**: Error code list in §2.3

**Add to error codes**: `reduction_audit_failed`

**Location**: §4.2.1 item 5 (晋升门禁), add to the promotion precondition list:

```markdown
- `IdeaCard.testable_hypotheses` 必须非空（`len >= 1`），否则返回 `schema_validation_failed`（`reason=no_testable_hypotheses`）
```

### Patch 5: `docs/plans/2026-02-12-idea-generator-architecture-spec.md` — Add `claim_support_relevance` to grounding audit §4.2.1

**Location**: After item 1 (URI 可解析) in §4.2.1

**Insert as new item 1.5**:
```markdown
1b. **Claim-evidence 语义相关性（anti-hallucination）**：对每个 `(claim, evidence_uri)` 对，必须验证所引文献**实际讨论**了该 claim 所涉及的现象/机制/结果（而非仅话题相关）。验证方式：clean-room LLM 判断（与 Ideator 隔离）或摘要关键词匹配。相关性不足的 `(claim, uri)` 对必须标记为 `weak_support`，并在 `grounding_audit.warnings[]` 中记录；若某 claim 的所有 evidence_uris 均为 `weak_support`，则该 claim 降级为 `support_type=llm_inference`（必须补充 `verification_plan`）。
```

### Patch 6: `docs/plans/2026-02-12-executable-discovery-operators.md` — Add `SearchPolicy` priority hook for `ProblemReduction`

**Location**: §4 (需要写回契约的最小接口点), add a 4th interface point

**Add**:
```markdown
4. **SearchPolicy reduction-priority predicate**（SearchPolicy 提供）：`should_attempt_reduction(node: IdeaNode, bottleneck_type: string, domain_pack: DomainPack) -> bool`
   - 当节点的瓶颈（从 `eval_info.failure_modes[]` 或 `RationaleDraft` 中提取）可映射到 `domain_pack.abstract_problem_registry` 中的标准问题类型时，SearchPolicy 应优先调度 `ProblemReduction` 算子（在其他生成算子之前），以避免在目标域内重新发明已有数学工具。
   - 此谓词不阻断其他算子（只调整优先级/预算分配权重）。
```

### Patch 7: `docs/plans/2026-02-12-statphys-distributor-policies.md` — Add team topology cost integration

**Location**: §2.3 (cost-aware energy), after the definition of `C_i`

**Add**:
```markdown
When the chosen arm includes a team topology (multiple roles), the cost estimate must incorporate team structure:

`C_i = C_base_i * team_cost_multiplier(team_policy_id_i)`

where `team_cost_multiplier` is derived from the team's role count and per-role cost table (see architecture spec §3.4.3). The Distributor **must not** start a tick if `estimated_tick_cost(team_topology) > budget_remaining` (pre-tick budget check; return `budget_exhausted` with `reason=insufficient_for_minimum_tick`).
```

### Patch 8: `docs/plans/2026-02-12-idea-generator-architecture-spec.md` — Add `abstract_problem_registry` to DomainPack §7

**Location**: After the `formalism_id → {c2_schema_ref, validator, compiler}` mapping in §7

**Add**:
```markdown
7. `abstract_problem_registry`（用于 `ProblemReduction` 算子的归约目标）：
   - 注册 `abstract_problem_type → {description, known_solution_families[], prerequisite_checklist[], reference_uris[]}`
   - HEP DomainPack 最小注册集（v0.2）：`optimization_convex`, `optimization_nonconvex`, `statistical_inference`, `spectral_analysis`, `pde_elliptic`, `pde_hyperbolic`, `graph_matching`, `tensor_decomposition`, `monte_carlo_sampling`
   - `ProblemReduction` 算子的 `abstract_problem` 字段必须引用此 registry；未注册类型必须失败（`schema_validation_failed`, `reason=abstract_problem_not_in_registry`）
```

### Patch 9: `docs/plans/2026-02-12-bandit-distributor-alternatives.md` — Add `p_min` default guidance

**Location**: End of §2 (Concise recommendation)

**Add**:
```markdown
### Safety bounds for importance weighting

When using replicator/EXP3-style policies with importance-weighted estimators, `p_min` (the floor for `1/p_i` clipping) **must** satisfy `p_min >= 1/(10*N)` where `N` is the number of arms. For typical idea-generator deployments (`N ∈ [10, 50]`), this gives `p_min ∈ [0.002, 0.01]`. Values below this threshold produce explosive variance that defeats the purpose of structured exploration. Log `p_min` in `distributor_policy_config_v1.json`.
```

### Patch 10: `docs/plans/2026-02-12-idea-generator-architecture-spec.md` — Add `failed_approaches` seed source and artifact

**Location**: §8.1 (seed sources), add to the list:

```markdown
- failed approaches（结构化失败记录：`failed_approach_v1.jsonl`，含 `approach_summary`, `failure_mode`, `failure_evidence_uris[]`, `lessons[]`, `reuse_potential`）
```

**Location**: §5.1 SSOT artifacts list, add:

```markdown
- `failed_approach_v1.jsonl`（可选；来自 KB/人类/前序 campaign 的结构化失败记录）
```
