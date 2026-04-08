# 可执行的“科学发现算子库”（首个 domain pack 落地版，面向 idea-core / DomainPack）

> 日期：2026-02-12  
> 目标：把科学史/科学哲学中的“发现路径”翻译成 **可执行、可审计、可组合** 的 `Operator`（算子）与 `SearchPolicy` 组件；为后续“物理学家社区/组团探索（Team/Role）”提供统一的工作语言。  
> 约束：所有算子输出必须能落到 `RationaleDraft → IdeaCard`，并能通过 `Grounding Audit Gate` 与 A0 门禁；避免把 prompt 技巧当成架构。

---

## 0. 为什么必须做成“算子库”

科学发现史里常见的策略（abduction、假设反转、原则化约束、类比迁移、表述变换、极限/对偶等）之所以高杠杆，是因为它们不是“随机灵感”，而是可复用的**生成-筛选-修正**操作。

如果不把这些策略落到 `Operator`：
- 系统会退化成“单一 brainstorm prompt + 评分器”，很快进入模式坍缩；
- novelty 容易被“措辞变化/参数微调”污染；
- 评审与复核无法事件化与 artifact 化（不可审计）。

---

## 1. OperatorSpec：最小可执行契约（建议）

这不是最终 schema（避免过早冻结），但建议首个 `DomainPack` 内部先用同形对象描述算子，后续再升级为稳定 schema：

```text
OperatorSpec:
  operator_id: string                      # 稳定 ID（用于 provenance）
  family: enum                             # 算子族（见下）
  seed_kinds: [enum]                       # 允许的输入 seed 类型
  requires_roles: [RoleId]                 # 推荐/必需角色（Librarian/Derivation/…）
  hard_constraints: [ConstraintId]         # 必须执行的 validators（量纲/对称性/引用可解析…）
  output_kind: "RationaleDraftV1"          # v0.x 固定
  trace_schema: object                     # operator_trace 的最小字段集（可审计）
  prompt_templates: {prologue, examples, epilogue, extractor?}
  knobs: {temperature, max_variants, ...}  # 可调参数（进化/多岛可学习）
```

**硬纪律**：
- 任意 `Operator.apply()` 生成的候选必须带 `operator_trace`（参数/随机种子/引用证据 URI/父代节点）。
- `Operator` 只负责“生成与局部变异”；是否保留/晋升由 `SearchPolicy + Evaluator + Gates` 决定。

---

## 2. 可执行算子族（从科学哲学/历史抽取 → 直接可落地）

每个算子族都给出：**输入 seed → 输出约束 → 必做验证 → 常见误判**。首个 domain pack 的 MVP 建议先实现其中 4–6 个（用 Multi-Island 保多样性）。

### 2.1 `AnomalyAbduction`（反常→解释；Peirce/Kuhn 风格）

- **Seed**：张力/反常（PDG tension、实验异常、理论不自洽边界条件）
- **输出必须包含**：
  - 最小“解释机制”候选（不超过 3 条）
  - 每条机制的 *kill criteria*（1–3 条可证伪条件）
  - 最小证据计划：哪些观测量/哪些综述/哪些关键测量能否定或支持
- **必做验证**：引用可解析（grounding）、“解释对象”是否被准确表述（不要造假反常）
- **常见误判**：把“尚未复现/系统误差”当成新物理；或把“模型换个名”当机制增量

适配 Team/Role：`Librarian → Ideator → Referee → Checker`

---

### 2.2 `AssumptionInversion`（假设反转；Popper 的可证伪性杠杆）

- **Seed**：某个默认假设（locality、naturalness、flavor universality、thermal history…）
- **输出必须包含**：
  - 被反转的假设（显式列出）
  - 反转后产生的“新可检验预测”（≥1）
  - 新增自由度/代价（复杂度/可行性）与最小化路径
- **必做验证**：新预测必须能映射到 `IdeaCard.required_observables[]`
- **常见误判**：反转假设但没有任何新预测；或预测不可触达（不可证伪）

适配 Team/Role：`Ideator → Formalizer → Referee`

---

### 2.3 `ProtectiveBeltPatch`（Lakatos：保持 hard core，改辅助带）

- **Seed**：一个研究纲领（hard core + auxiliary hypotheses），或一个已知方案的失败点
- **输出必须包含**：
  - hard core（不可动的核心承诺）列表
  - protective belt（允许改动）列表 + 改动提案
  - “为何这不是 ad hoc”：至少给出一个独立可检验后果
- **必做验证**：对已知成功现象的回归约束（不破坏已知结果）
- **常见误判**：为适配一个点而引入不可控自由度；或者补丁无法产生新预测

适配 Team/Role：`Librarian → Ideator → Derivation → Referee`

---

### 2.4 `SymmetryOperator`（对称性操作：破缺/恢复/推广/对偶）

- **Seed**：某个对称性结构或其破缺模式（global/gauge、flavor、C/P/T、SUSY、dual symmetry…）
- **输出必须包含**：
  - 操作类型：`break | restore | extend | gauge | dualize | anomaly_match`
  - 新的选择规则/禁戒/允许通道（至少一条可检验）
  - 与已有约束的冲突点（潜在 kill criteria）
- **必做验证**：量纲一致性、对称性一致性（最小推导/极限检查）
- **常见误判**：只改“表述”不改物理；或忽略 anomaly/consistency

适配 Team/Role：`Ideator → Derivation → Checker → Referee`

---

### 2.5 `LimitExplorer`（极限与能标：强/弱耦合、IR/UV、large-N、维数延拓）

- **Seed**：某个理论/模型/方法在极限下的行为或已知可解角落
- **输出必须包含**：
  - 选择的极限（参数→0/∞、能标→IR/UV）
  - 极限下可计算的量与对全域的外推假说
  - 极限之间的插值/匹配计划（最小 compute plan）
- **必做验证**：极限可计算性（至少给出一个可执行/可手算的 check）
- **常见误判**：把“极限下成立”误推广到一般点；或没有任何可验证插值路径

适配 Team/Role：`Derivation → Coder → Checker`

---

### 2.6 `RepresentationShift`（表述变换：变量/规范/基底/对偶表述）

- **Seed**：当前表述导致的困难（非局域、强耦合、非线性、发散结构…）
- **输出必须包含**：
  - 变换类型：变量替换/规范选择/基底旋转/对偶表示
  - 变换后“更容易计算/更透明的量”（至少一项）
  - 不变性声明（哪些量必须保持不变）
- **必做验证**：同一物理量在两表述下的一致性 check（toy check 也可）
- **常见误判**：把重写当创新；没有任何新可计算/新可检验后果

适配 Team/Role：`Derivation → Formalizer → Referee`

---

### 2.7 `CrossDomainAnalogy`（结构/方法/现象类比；要求显式 mapping table）

- **Seed**：目标域问题的“抽象结构”（弱信号探测/多尺度/网络效应/相变/噪声抑制…）
- **输出必须包含**：
  - 源域→目标域 mapping table（至少 5 个对应项）
  - 迁移对象类型：`structure | method | phenomenon`
  - 目标域/源域声明：`target_domain`（用于验收与硬约束）+ `source_domain`（用于检索与类比的知识域）
  - 目标域硬约束（守恒/对称性/量纲/实验可得性）列表
  - invariants（不变性）清单：迁移过程中哪些量/结构必须保持（否则类比无效）
- **必做验证**：mapping table 与约束一致性（不满足直接拒绝）
- **常见误判**：类比停留在隐喻；或者引入违反物理约束的“好点子”

适配 Team/Role：`Librarian → Ideator → Derivation → Referee`

> 备注（跨学科的一等公民）：  
> - `CrossDomainAnalogy` 不只是“从别的物理分支借直觉”，也包括 **跨学科借方法**（例如信息论/统计学习/优化/数值分析/网络科学）。  
> - 对“method transfer”必须强制输出：源方法的最小可复现描述（含引用）+ 在目标域的 toy check（哪怕是最小极限/维度分析/一致性检验），否则一律视为“隐喻”并拒绝晋升。

---

### 2.8 `CombinatorialSynthesis`（模块组合：把“可复用组件”当基因片段）

这是对 IdeaSearch/进化框架的“物理研究计划版”迁移：

- **Seed**：组件库（方法模块/理论模块/观测量/数据源/近似技术）
- **输出必须包含**：
  - 组合清单（模块 A×B×C）
  - 组合产生的“新可检验结论”（而不是模块并列）
  - 冲突/不兼容点与修复路径
- **必做验证**：最小一致性（量纲/对称性/极限）+ novelty delta table（避免“拼装即创新”）
- **常见误判**：纯拼装无新预测；或只产生工程差异不产生科学差异

适配 Team/Role：`Ideator → Formalizer → Referee → Checker`

---

### 2.9 `ConjectureGeneralization`（从例子到猜想：模式提炼→可证伪外推）

- **Seed**：已知一组可计算例子/已知 theorem/已知分类
- **输出必须包含**：
  - 猜想的精确定义（条件/结论）
  - 至少一个潜在反例搜索策略（kill criteria）
  - 最小验证集（多例子 cross-check）
- **必做验证**：反例优先（由 `Checker/Referee` 角色尝试击杀）
- **常见误判**：过拟合少数例子；没有反例/边界条件意识

适配 Team/Role：`Derivation → Checker → Referee`

---

### 2.10 `FalsificationPressure`（反证压力测试：专门生成“击杀路径”）

这是把 Popper 的精神变成可执行算子：**不是产生新 idea，而是产生杀手测试**。

- **Seed**：已有候选 `IdeaNode`（通常来自其他算子）
- **输出必须包含**：
  - 1–5 条 kill criteria（越短越好）
  - 每条 kill criteria 的证据来源或可执行检查路径
  - 若 kill criteria 不成立，说明“如何修复”（形成可迭代的 fix suggestion）
- **必做验证**：grounding（kill criteria 的依据必须可追溯）
- **常见误判**：泛泛而谈“需要更多数据”；或提出不可执行的反证

适配 Team/Role：`Checker → Referee`（clean-room 默认）

---

### 2.11 `TechniqueTransplant`（跨学科方法移植：把“方法”当可执行资产）

这是把跨学科突破的常见路径（“方法迁移”而非“结果照搬”）做成显式算子：从源学科挑选一项可复用方法，并在目标域给出**可执行的最小落地**。

- **Seed**：目标域的瓶颈（不可计算/不可辨识/噪声强/维度高/参数不可约…）+ 允许的约束（预算/可解释性/可证伪性）
- **输出必须包含**：
  - `source_method`：方法名称 + 一句话核心机制 + ≥1 条一手引用（文献/书/讲义 URI）
  - `transfer_plan`：迁移步骤（如何把输入/输出/损失/近似对应到目标域）
  - `compatibility_checks`：至少 2 条“必须过”的一致性检查（量纲/极限/对称性/可解释性/可复现性）
  - `minimal_toy_check`：一个最小可执行验证（toy model/极限/已知结果回归），用于快速击杀“看似有效但不落地”的移植
  - `kill_criteria`：若方法不适用，最短的否决条件（避免陷入工程细节）
- **必做验证**：引用可解析（grounding）+ toy check 可执行（由 `Coder/Checker` 角色验证）
- **常见误判**：把“方法名”当迁移；没有具体 transfer plan；或方法只是在工程上更方便但不产生新可检验结论

适配 Team/Role：`Librarian → Ideator → Coder → Checker → Referee`

---

### 2.12 `ProblemReduction`（问题抽象与归约：优先挖掘“数学/CS 已成熟解法”）

很多物理研究的“难点”并不在物理本体，而是隐藏在一个更通用的抽象问题里（优化、统计推断、图算法、PDE、几何/拓扑对象、数值稳定性等）。一旦归约成立，常常能直接借用数学/CS 的成熟工具链。

- **Seed**：目标域瓶颈 + 最小形式化信息（变量/约束/目标/可观测量）+ 明确允许的近似（若有）
- **输出必须包含**：
  - `abstract_problem`：抽象问题类型（例如 `optimization | inference | graph | pde | geometry | algebra | control | signal_processing | numerics`）
  - `reduction_map`：目标域 → 抽象域的映射表（变量/目标/约束/对称性/不变性；至少 8 个对应项）
  - `assumptions_and_limits`：归约成立的条件与边界（哪些近似是必需的；失败会如何显现）
  - `known_solutions`：≥2 个候选成熟解法（每个包含：前提条件、复杂度/代价、典型 failure modes、≥1 条一手引用 URI）
  - `transfer_plan`：把“成熟解法”落到目标域的最小步骤（含数据接口/可计算量/可验收输出）
  - `minimal_toy_check` + `kill_criteria`：最小可执行验证与否决条件（尽量短）
- **必做验证**：
  - `reduction_map` 与目标域硬约束一致（量纲/对称性/守恒/可证伪性）
  - `known_solutions` 的引用可解析（grounding）且前提条件被显式满足或被标注为待验证
  - `minimal_toy_check` 可执行（由 `Coder/Checker` 角色验证）
- **常见误判**：
  - 抽象错类（看似像优化/图问题但关键结构不满足）
  - 忽略适用前提（凸性/独立性/平稳性/边界条件等）
  - 把“借用成熟方法”误当“科学创新”（应由 `novelty_delta_table` 明确 delta 与 prior art）

适配 Team/Role：`Librarian → Ideator → Formalizer → Coder → Checker → Referee`

---

## 3. 与 Multi-Island / TeamPolicy 的组合方式（可扩展架构关键）

建议把“岛屿”定义为 **算子组合 + 评估权重 + 团队拓扑** 的 bundle：

```text
IslandArchetype:
  island_id
  operator_weights: {family -> weight}
  novelty_weight / feasibility_weight / grounding_weight
  team_policy_id: parallel|sequential|stage_gated
  required_roles: [...]
```

示例（首个 domain pack）：
- `S1_anomaly`: `AnomalyAbduction` + `FalsificationPressure`
- `S2_symmetry`: `SymmetryOperator` + `LimitExplorer`
- `S3_analogy`: `CrossDomainAnalogy` + `TechniqueTransplant` + `CombinatorialSynthesis`
- `S4_formalism`: `RepresentationShift` + `ConjectureGeneralization`

> 关键纪律：同一 island 的“生成”与“审查”必须角色隔离（Ideator vs Referee/Checker），否则会出现自评偏差与模式坍缩。

---

## 4. 需要写回契约/实现的最小接口点

把本算子库接入 `idea-core`/hepar，需要至少补齐三类“可被实现侧读取”的接口：

1. **Operator registry**（DomainPack 提供）：`operator_id/family/seed_kinds/hard_constraints`
2. **Operator trace**（写入 IdeaNode）：最小字段（operator params、父代链路、引用证据 URI）
3. **TeamPolicy/RoleSpec**（控制平面承载）：把“谁做什么、能用什么工具、是否 clean-room”结构化表达
4. **SearchPolicy reduction-priority predicate**（SearchPolicy 提供）：`should_attempt_reduction(node: IdeaNode, bottleneck_type: string, domain_pack: DomainPack) -> bool`
   - 当节点的瓶颈（从 `eval_info.failure_modes[]` 或 `RationaleDraft` 中提取）可映射到 `domain_pack.abstract_problem_registry` 中的标准问题类型时，SearchPolicy 应优先调度 `ProblemReduction` 算子（在其他生成算子之前），以避免在目标域内重新发明已有数学工具。
   - 此谓词不阻断其他算子（只调整优先级/预算分配权重）。

若后续实现影响公开契约或架构边界，应写回架构规格 / schemas；局部实施 TODO 与 next actions 保留在本地 maintainer 材料。
