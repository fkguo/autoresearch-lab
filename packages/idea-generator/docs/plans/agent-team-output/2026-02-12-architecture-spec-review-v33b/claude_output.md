VERDICT: NOT_READY

## Blockers

### B1. `ProblemReduction` operator lacks a "reduction validity" gate distinct from grounding audit

The `ProblemReduction` operator (§2.12 of the operators doc) is the highest-leverage cross-disciplinary mechanism in this spec, but it has a critical gap: the reduction itself can be wrong (wrong problem class, violated preconditions) in ways that grounding audit won't catch. Grounding audit checks "are citations real and do numbers match?" — it does **not** check "is the reduction map mathematically valid?" A physically-grounded but mathematically-incorrect reduction (e.g., claiming a non-convex problem is convex, or mapping a problem to a graph class where the known algorithm requires properties the physical system doesn't have) will sail through grounding audit and produce a C2-ready handoff that wastes downstream compute.

**Required fix**: Add an explicit `reduction_validity` gate (or evaluator dimension) that is distinct from `grounding`. This gate must check:
1. The `abstract_problem` type classification is consistent with the `reduction_map` (e.g., if you claim "convex optimization", the mapped objective must actually be convex under the stated assumptions).
2. The `known_solutions` preconditions are satisfied by the reduction (or explicitly flagged as unverified).
3. The `minimal_toy_check` actually exercises the reduction, not just the downstream solver.

Without this, `ProblemReduction` will be the single largest source of "confident but wrong" ideas entering C2.

### B2. No schema or contract for `TeamPolicy` / `RoleSpec` — Team/Role topology is unimplementable

Section 3.4 introduces Team/Role as a first-class runtime concept that directly affects cost estimation (§3.4.3 cost-aware constraint), Distributor budgeting, and operator execution. But there is **zero schema** for `TeamPolicy` or `RoleSpec`. The spec says `team_policy_id: parallel|sequential|stage_gated` in `IslandArchetype` but doesn't define:
- What a `RoleSpec` object contains (tool permissions, model constraints, output contract, clean-room enforcement flag).
- How `TeamPolicy` composes roles (ordering, gating conditions, artifact handoff between roles).
- How `team_cost_multiplier` is computed from role composition (the spec says Distributor "must" account for it, but there's no computable definition).

This blocks implementation because the Distributor cannot estimate per-step cost without knowing team topology, and the `search.step` tick semantics say a tick "runs the corresponding Team/Role topology" without defining what that means operationally.

**Required fix**: Add at minimum:
- `schemas/role_spec_v1.schema.json` with fields: `role_id`, `model_constraints`, `tool_permissions[]`, `output_schema_ref`, `clean_room: bool`, `max_tokens_per_invocation`.
- `schemas/team_policy_v1.schema.json` with fields: `team_policy_id`, `coordination_mode: parallel|sequential|stage_gated`, `role_sequence[]` (for sequential/stage_gated), `gating_conditions[]`, `cost_formula` (how to compute team cost from constituent role costs).
- Wire `IslandArchetype.team_policy_id` to reference a concrete `TeamPolicy` instance.

### B3. Distributor factorized vs. joint — no contract for when factorization is valid

The statphys doc (§5 note 1) recommends factorized distributions `p_backend × p_operator × p_island` as default, and the bandit doc is agnostic. But the spec provides **no criterion for when factorization is valid** (i.e., when the reward is approximately separable across factors). In practice, backend×operator interactions are strong (e.g., a model that's great at `SymmetryOperator` may be terrible at `CrossDomainAnalogy`). Using factorized distributions when interactions dominate will lead to systematically suboptimal allocation that no amount of UCB bonuses can fix.

**Required fix**: Add to the Distributor contract:
1. A `factorization_mode` field in `distributor_policy_config_v1.json` with values `joint | factorized | hybrid` (hybrid = factorized with interaction correction terms).
2. A diagnostic: track `reward_residual_interaction` = observed reward minus factorized prediction; if this exceeds a threshold over a window, emit a `factorization_invalid` warning in `distributor_events_v1.jsonl` and (optionally) switch to joint or hybrid.
3. For v0.2 baseline, default to `factorized` but log the interaction diagnostic so v0.3 can make an informed decision.

### B4. `node.promote` preconditions are incomplete — no `formalism_not_in_registry` in the state machine

The spec says (§7): "`candidate_formalisms[]` must come from the registry; otherwise `node.promote` must fail (`formalism_not_in_registry`)." And §2.3 lists `formalism_not_in_registry` as an error code. But:
- The campaign state machine (§2.4) doesn't mention this check in the promote flow.
- The grounding audit gate (§4.2.1) doesn't include formalism registry validation as one of its checks.
- It's unclear whether formalism validation happens *inside* `eval.run` (when `grounding` dimension is active), inside `node.promote` as a separate pre-check, or both.

**Required fix**: Add to §4.2.1 (Grounding Audit Gate) a step 5:
> 5. **Formalism registry check**: Every entry in `candidate_formalisms[]` must resolve to a valid `formalism_id` in the active DomainPack's formalism registry. Unresolvable formalisms must be recorded in `grounding_audit.failures[]` with `failure_type=formalism_not_in_registry`.

And explicitly state in §2.4 (or a new §2.5 "promote preconditions") that `node.promote` checks, in order: (1) `grounding_audit.status == pass`, (2) `idea_card` schema validation passes, (3) all `candidate_formalisms` are in registry. Any failure returns the corresponding error code.

---

## Non-blocking

### N1. EMA decay rate `α` has no recommended default or bounds

The statphys doc (§2.2) uses `Q_i ← (1-α) Q_i + α r` but never specifies a recommended range for `α`, its relationship to `T_max/T_min`, or how it interacts with the sliding-window UCB alternative from the bandit doc. Implementers will pick arbitrary values. Suggest adding: `α ∈ [0.05, 0.3]` as a sane range, with `α = 0.1` as default, and noting that `α` and `discount_factor` (from Discounted UCB) serve overlapping roles — pick one, not both.

### N2. `folklore_risk_score` has no operational definition

§4.2.1 and §6.2 mention `folklore_risk_score ∈ [0,1]` but never define how it's computed. Is it a classifier output? A heuristic based on INSPIRE citation patterns? A Referee role judgment? This will be implemented inconsistently. Suggest adding a brief operational definition: e.g., "computed by the `novelty` evaluator dimension as `1 - min(semantic_distance_to_top3_prior_art)` where semantic distance uses the embedding model specified in `EvaluatorConfig`."

### N3. Replicator/MW policy (Policy B) importance weighting is numerically unstable for small `p_min`

§3.1 of the statphys doc uses `Â_{i_t} = (r_t - b_t) / max(p_{i_t}, p_min)` — standard but dangerous. If `p_min` is too small, the importance weight explodes and a single observation can dominate the entire weight vector. Suggest: (a) explicitly cap the importance weight at `1/p_min ≤ 20` (i.e., `p_min ≥ 0.05`), and (b) note that this cap introduces bias but is necessary for practical stability.

### N4. `operator_trace.prompt_snapshot_hash` is specified but never defined

`IdeaNode` requires `operator_trace.prompt_snapshot_hash` (§5.2), but there's no specification of what's hashed (the full prompt? the template + variables separately? the system prompt only?), which hash algorithm, or where the full prompt is stored for replay. Suggest: "hash = sha256 of the concatenated `[system_prompt, user_prompt]` after template variable substitution; full prompt stored in `artifacts/{campaign_id}/prompts/{prompt_snapshot_hash}.json`."

### N5. The "math/CS solved" workflow for `ProblemReduction` needs an explicit "prior art search" step

§7 says the system "should prioritize" `ProblemReduction` when a bottleneck can be abstracted to a standard problem, but there's no mechanism to **trigger** this prioritization. The SearchPolicy doesn't know when a problem is reducible — only the operator itself discovers this. Suggest: add a lightweight `ReducibilityScreen` as a pre-filter that runs before full operator execution, checking if the seed's `minimal_formalization` matches known abstract problem signatures (a lookup table in the DomainPack). If it matches, boost the `ProblemReduction` operator weight in the Distributor for that island/step.

### N6. `distributor_events_v1.jsonl` will be enormous for long campaigns

Logging per-action stats for every decision point means `O(N_actions × N_steps)` data. With factorized distributions over, say, 5 backends × 12 operators × 4 islands = 240 joint actions and 1000+ steps, this is manageable. But if joint distributions are used, or if the action space grows, this becomes a storage/replay bottleneck. Suggest: add an optional `log_level: full | summary | minimal` field to `distributor_policy_config_v1.json`, where `summary` logs only the chosen action + top-3 alternatives + aggregate diagnostics (H, N_eff, F), and `full` logs everything.

### N7. No versioning strategy for `DomainPack` artifacts

The spec says DomainPacks provide `formalism_id → {c2_schema_ref, validator, compiler}` but doesn't version the registry itself. If a DomainPack is updated mid-campaign (new formalisms added, validators changed), existing nodes may become invalid or, worse, silently change semantics. Suggest: DomainPack must declare a `pack_version` that is recorded in `campaign_init` and immutable for the campaign's lifetime. Pack updates require a new campaign or an explicit `campaign.migrate_pack` RPC (v1.0+).

### N8. `CrossDomainAnalogy` and `TechniqueTransplant` overlap significantly

Both operators take a target-domain bottleneck as seed, both require mapping tables, both require toy checks. The distinction ("analogy" vs "method transplant") is blurry — many real transplants start as analogies. Suggest: merge into a single `CrossDomainTransfer` operator family with a `transfer_type: analogy | method | phenomenon | hybrid` discriminator, rather than maintaining two operators with near-identical contracts that will diverge in implementation.

---

## Real-research fit

### Strengths

1. **The `ProblemReduction` operator is genuinely high-value for HEP**. Many stalled calculations in BSM phenomenology are stuck on what are essentially known mathematical problems (multi-loop integral reduction → algebraic geometry, parameter fitting → constrained optimization, model selection → information-theoretic inference). Making this a first-class operator with explicit `reduction_map` + `known_solutions` is exactly right.

2. **The `novelty_delta_table` (§6.2) is a real contribution**. The #1 failure mode of AI-assisted ideation in physics is "rephrasing known results." Forcing the Referee to produce `closest_prior` + `delta_type` + `delta_statement` + `non-novelty_flags` directly addresses this. The `non-novelty_flags` list (parameter tuning, symbol substitution, narrative change, trivial combination) is well-calibrated to HEP failure modes.

3. **Kill criteria as first-class artifacts** throughout the spec (operators, grounding audit, evaluation) mirrors how experienced physicists actually filter ideas. The insistence on "≥1 kill criterion per claim" is the single most important anti-hallucination mechanism in this design.

4. **The multi-island architecture maps well to real research group dynamics**: different subgroups pursuing different strategies (anomaly-driven, symmetry-driven, computational-method-driven) with periodic cross-pollination (repopulate/migrate). This is how productive HEP theory groups actually operate.

### Concerns

1. **The `Checker` role's clean-room property is essential but fragile in LLM-based implementation**. Real clean-room checking requires not just separate sessions but genuinely independent reasoning paths. Two instances of the same model with similar prompts will often converge on the same errors. The spec should recommend (or require for high-stakes checks) using **different model families** for Checker vs Ideator, not just different sessions.

2. **The formalism registry assumption may be too rigid for genuinely novel work**. Breakthrough ideas in HEP often involve formalisms that don't yet exist in any registry (e.g., the amplituhedron, or the conformal bootstrap revival). The current design would block promotion of such ideas via `formalism_not_in_registry`. Need an escape hatch: `candidate_formalisms` can include `{formalism_id: "NEW", description: "...", provisional_validator: "..."}` that triggers mandatory human review at A0.2 rather than automatic rejection.

3. **Cost of the full Team/Role pipeline per tick is high**. Running `Librarian → Ideator → Formalizer → Derivation → Checker → Referee` (as `ProblemReduction` suggests) is 6+ LLM calls per tick. At ~$0.10-0.50 per call, a 1000-step campaign costs $600-3000 just for one island. The spec's `degradation_order[]` mechanism (§3.3) is the right mitigation, but needs concrete defaults (e.g., "drop Coder first, then Derivation, then merge Formalizer+Editor").

---

## Robustness & safety

### Evidence-first / hallucination mitigation

1. **The grounding audit gate (§4.2.1) is well-designed but missing a temporal check**: citations can be real but retracted, superseded, or have known errata. Add: `evidence_status` field (from INSPIRE API: `published | withdrawn | superseded | erratum`) and treat `withdrawn/superseded` as grounding failures unless explicitly acknowledged.

2. **Phantom citation risk is addressed but not tested**: the spec says "active lookup" for URI resolution, but there's no mention of a test fixture. Add a requirement: the grounding audit must have a test mode with known-bad URIs (fabricated INSPIRE IDs, non-existent arXiv IDs) to verify that the active resolution actually rejects them. This is the #1 LLM failure mode in scientific contexts.

3. **The A0.2 promotion invariant is strong but the "partial grounding" path is unclear**: §4.2.1 says `partial/fail` blocks promotion, but what happens to nodes that are `partial` (some claims grounded, some not)? Can they be revised and re-audited? The spec should explicitly allow `eval.run` → fix → `eval.run` cycles for `partial` nodes, with a maximum retry count to prevent infinite loops.

### Distributor safety

4. **The budget circuit breaker (§3.3) is necessary but the `degradation_order[]` needs to be a required field, not suggested**. Without it, the system has no graceful degradation path — it just stops. Make `degradation_order[]` a required field in `CampaignCharter` with a sensible default (e.g., `[reduce_eval_rounds, reduce_islands, disable_cross_domain, reduce_team_roles, emergency_stop]`).

5. **The entropy floor `ε` in the statphys policy needs a hard upper bound**: the spec says `ε ∈ [0, 0.2]` but this is only a suggestion. If `ε` is set too high (e.g., 0.5), the Distributor becomes essentially random, wasting half the budget. Make `ε_max = 0.2` a schema-enforced constraint in `distributor_policy_config_v1.json`.

### Replay / auditability

6. **The idempotency system is thorough but the JCS canonicalization requirement (§2.3) adds a non-trivial dependency**. RFC 8785 implementations exist but vary in edge cases (Unicode normalization, number serialization). Specify the exact library or test vectors to use, or provide a reference implementation. Otherwise two implementations of the same spec may disagree on `payload_hash`, breaking idempotency across adapter versions.

---

## Specific patch suggestions

### Patch 1: `docs/plans/2026-02-12-executable-discovery-operators.md` — Add `reduction_validity` gate to `ProblemReduction`

**File**: `docs/plans/2026-02-12-executable-discovery-operators.md`  
**Location**: §2.12, after the `- **必做验证**:` block  
**Change**: Add a new bullet:

```markdown
- **归约有效性门禁（reduction validity gate，独立于 grounding audit）**：
  - `abstract_problem` 分类必须与 `reduction_map` 中的结构一致（例如声明"凸优化"则映射后的目标函数必须满足凸性条件，或将凸性标注为 `unverified_assumption`）
  - `known_solutions` 的前提条件必须与 `reduction_map` 的输出域逐条对比：满足标 `verified`，不满足标 `violated`（直接拒绝），未知标 `unverified`（必须写入 `kill_criteria`）
  - 此门禁由 `Derivation` 或 `Checker` 角色执行，不得与 grounding audit 合并（两者检查不同维度）
```

### Patch 2: `docs/plans/2026-02-12-idea-generator-architecture-spec.md` — Add `RoleSpec` and `TeamPolicy` schema requirements

**File**: `docs/plans/2026-02-12-idea-generator-architecture-spec.md`  
**Location**: §3.4.2, after the role list, add a new subsection:

```markdown
#### 3.4.2.1 最小 Schema 要求（v0.2 必须交付）

- `schemas/role_spec_v1.schema.json`：
  - `role_id: string`
  - `display_name: string`
  - `model_constraints: {allowed_models?: string[], forbidden_models?: string[], min_context_length?: int}`
  - `tool_permissions: string[]`（MCP tool IDs）
  - `output_schema_ref: string`（$ref to the role's output artifact schema）
  - `clean_room: bool`（default true；false 仅用于 Editor 等汇总角色）
  - `max_tokens_per_invocation: int`
  - `estimated_cost_per_invocation: {tokens: int, cost_usd: float}`（用于 Distributor 成本估算）

- `schemas/team_policy_v1.schema.json`：
  - `team_policy_id: string`
  - `coordination_mode: enum(parallel | sequential | stage_gated)`
  - `roles: RoleSpec[]`（有序；sequential/stage_gated 按此顺序执行）
  - `gating_conditions?: {before_role_id: string, condition: string}[]`
  - `cost_formula: "sum" | "max_parallel"`（sum 用于 sequential，max 用于 parallel 中最贵的角色）
  - `estimated_cost_per_tick: {tokens: int, cost_usd: float}`（从 roles + cost_formula 计算）
```

### Patch 3: `docs/plans/2026-02-12-idea-generator-architecture-spec.md` — Add formalism escape hatch for genuinely novel work

**File**: `docs/plans/2026-02-12-idea-generator-architecture-spec.md`  
**Location**: §7, after "formalism registry" paragraph  
**Change**: Add:

```markdown
**新形式主义逃生口（genuinely novel formalism escape hatch）**：
- `candidate_formalisms[]` 允许包含 `{formalism_id: "NEW:<provisional_name>", description: string, provisional_validator: string?, provisional_c2_notes: string}`。
- 含 `NEW:` 前缀的 formalism **不得**通过自动 `node.promote`；必须触发 `A0.2-novel-formalism` 人工裁定（hepar 门禁层负责路由）。
- 一旦人工批准，hepar 应将该 formalism 注册到 DomainPack（含临时 validator），使同一 campaign 内后续节点可引用。
```

### Patch 4: `docs/plans/2026-02-12-statphys-distributor-policies.md` — Add factorization validity diagnostic

**File**: `docs/plans/2026-02-12-statphys-distributor-policies.md`  
**Location**: §5 (Implementation notes), after item 1  
**Change**: Expand item 1:

```markdown
1. Prefer **factorized** distributions (`p_backend × p_operator × p_island`) unless you have enough data for joint stats. This reduces variance and makes logs smaller.
   - **Factorization validity diagnostic（必须）**：每 `W` 步（建议 `W=50`）计算 `interaction_residual = mean(|r_observed - r_factorized_prediction|)`，其中 `r_factorized_prediction = Q_backend(b) + Q_operator(o) + Q_island(s) - 2*Q_global_mean`（加法分解）。
   - 若 `interaction_residual > δ_interaction`（建议 `δ_interaction = 0.15 * reward_range`）持续 `2W` 步，在 `distributor_events_v1.jsonl` 写入 `factorization_warning` 事件。
   - v0.3+ 可据此自动切换为 joint 或 hybrid 分布。
```

### Patch 5: `docs/plans/2026-02-12-idea-generator-architecture-spec.md` — Make `degradation_order[]` required in CampaignCharter

**File**: `docs/plans/2026-02-12-idea-generator-architecture-spec.md`  
**Location**: §3.3, Budget Circuit Breaker paragraph  
**Change**: Replace "建议提供 `degradation_order[]`" with:

```markdown
- **`degradation_order[]`（必须；CampaignCharter 的 required 字段）**：当预算紧张时的降级顺序。默认值（若 charter 省略则使用）：`["reduce_eval_rounds", "reduce_islands_to_top_k", "disable_cross_domain_operators", "reduce_team_to_minimal_roles", "emergency_stop"]`。每个降级步骤必须有对应的可执行语义（由 engine 实现），且降级事件必须写入 ledger。
```

### Patch 6: `docs/plans/2026-02-12-idea-generator-architecture-spec.md` — Add `evidence_status` to grounding audit

**File**: `docs/plans/2026-02-12-idea-generator-architecture-spec.md`  
**Location**: §4.2.1, after item 1 (URI 可解析)  
**Change**: Add item 1b:

```markdown
1b. **证据时效性（evidence currency）**：对已解析的 URI，必须检查 `evidence_status`（来自 INSPIRE API 的 `publication_info.status` 或 arXiv 的 withdrawal/supersession 元数据）。`withdrawn` 或 `superseded`（且未被 claim 显式标注为"已知已取代，用于历史对比"）的引用必须标记为 `stale_evidence` 并写入 `grounding_audit.failures[]`。`erratum` 则标记为 `evidence_with_erratum`（warning，不自动 fail，但必须在 `IdeaCard.claims[]` 中标注）。
```

### Patch 7: `docs/plans/2026-02-12-idea-generator-architecture-spec.md` — Require different model families for Checker role

**File**: `docs/plans/2026-02-12-idea-generator-architecture-spec.md`  
**Location**: §3.4.2, in the `Checker` role description  
**Change**: Append:

```markdown
- **Clean-room 模型多样性约束（SHOULD，v0.3 升为 MUST）**：`Checker` 角色的 `model_constraints.allowed_models` 应当排除 `Ideator` 所使用的模型族（例如 Ideator 用 Claude 则 Checker 用 Gemini，反之亦然），以避免"同一模型、同一盲点"的伪独立验证。v0.2 若因成本/可用性限制使用同模型，必须在 `operator_trace` 中标注 `checker_model_diversity: false`，并在 `eval_info` 中降低该检查的置信权重。
```

### Patch 8: `docs/plans/2026-02-12-executable-discovery-operators.md` — Merge `CrossDomainAnalogy` + `TechniqueTransplant` into `CrossDomainTransfer`

**File**: `docs/plans/2026-02-12-executable-discovery-operators.md`  
**Location**: §2.7 and §2.11  
**Change**: This is non-blocking but recommended. If keeping both, at minimum add a disambiguation note to §2.11:

```markdown
> **与 `CrossDomainAnalogy`（§2.7）的关系**：`TechniqueTransplant` 专注于 **method transfer**（可执行方法的移植），而 `CrossDomainAnalogy` 覆盖更广（结构/现象/方法的类比映射）。当 `CrossDomainAnalogy` 的 `transfer_type=method` 时，其输出契约应等价于 `TechniqueTransplant` 的输出（即必须包含 `source_method`/`transfer_plan`/`compatibility_checks`/`minimal_toy_check`）。实现时建议共享相同的 output schema + validators，仅在 prompt templates 和 seed routing 上区分。
```

### Patch 9: `docs/plans/2026-02-12-statphys-distributor-policies.md` — Cap importance weights and enforce `ε_max`

**File**: `docs/plans/2026-02-12-statphys-distributor-policies.md`  
**Location**: §3.1, after the importance-weighted estimator formula  
**Change**: Add:

```markdown
**数值稳定性硬约束**：
- importance weight 上界：`1/max(p_{i_t}, p_min) ≤ 1/p_min`；`p_min` 必须 `≥ 0.05`（即 importance weight ≤ 20）。低于此值在 schema 校验时拒绝。
- `ε_floor` 在 `distributor_policy_config_v1.json` 中的 schema 约束：`minimum: 0.0, maximum: 0.2`（硬上界；超过 0.2 意味着 >20% 随机探索，预算效率不可接受）。
```

### Patch 10: `docs/plans/2026-02-12-idea-generator-architecture-spec.md` — Add `partial` node re-audit workflow

**File**: `docs/plans/2026-02-12-idea-generator-architecture-spec.md`  
**Location**: §4.2.1, after item 5 (晋升门禁)  
**Change**: Add:

```markdown
6. **`partial` 状态的修正-重审工作流**：`grounding_audit.status=partial` 的节点允许通过以下路径修复：
   - `eval.run` 返回的 `eval_info.fix_suggestions[]` 必须针对每个 `grounding_audit.failures[]` 条目给出具体修复建议（补引用/修正数值/补 verification_plan）。
   - 修复后可再次调用 `eval.run`（新 `idempotency_key`）触发重新审计。
   - **重审上限（MUST）**：同一 `node_id` 的 grounding audit 重试次数不得超过 `max_grounding_retries`（默认 3，CampaignCharter 可配置）。超过后节点状态锁定为 `fail`，不得再审。
   - 每次重审必须写入 `grounding_audit.history[]`（append-only），记录 `{attempt, timestamp, status, failures[], fix_applied[]}`。
```
