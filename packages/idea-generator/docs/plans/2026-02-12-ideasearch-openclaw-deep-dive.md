# Idea-Generator 深度调研：IdeaSearch（论文+开源框架）与 OpenClaw（工程化多 Agent 框架）

> 日期：2026-02-12  
> 目标：把“能执行的机制”抽取出来，反哺 `idea-generator` 的可扩展架构（HEP-first → 理论物理泛化）。  
> 原则：研究质量优先（优先一手资料：论文 LaTeX 源码、开源仓库代码与文档）。

---

## 0. 为什么这份补充很关键

此前设计文档已把 IdeaSearch 作为“可迁移原则”引用，但仍缺两块 **高杠杆信息**：

1. **IdeaSearch 不是单篇论文，而是一个“迭代代理框架”**：`IdeaSearchFitter` 只是其中一个 module（符号回归/拟合）。要借鉴的不是“SR 任务细节”，而是 **抽象后的搜索-评估-存储-再投喂** 的工程架构。
2. **IdeaSearch 公开了可复用的“分配器/多岛/两阶段生成/仓库模式”细节**：这些细节可以直接映射到我们要构建的 `idea-core`（DomainPack/StrategyPlugin 的可扩展接口）。

---

## 1. IdeaSearchFitter（arXiv:2510.08317）深读要点（来自 LaTeX 源码；含 Appendix 证据摘录）

论文标题：*Iterated Agent for Symbolic Regression*（IdeaSearch Collaboration）

### 1.0 证据与可复现抓取（audit notes）

为保证“研究质量优先”与可追溯性，本节记录一手证据的抓取方式（**不把源文件提交进本 repo**，只记录可复现入口与哈希）：

- arXiv：`https://arxiv.org/abs/2510.08317`（v1，published 2025-10-09）
- LaTeX 源码抓取：使用 `hep-research-mcp` 工具 `inspire_paper_source(prefer=latex, extract=true)` 下载并解包
  - 本机路径（仅作审计，不入库）：`local arXiv source checkout (not checked in)`
  - `main.tex` sha256：`d4027ebba45fe450fa3e6d3d923f4758534696066d55101f975587bf9b5afdca`
  - `cite.bib` sha256：`8e77cfff16420842744ad8b23418c989fef58fe0fc4224a3749a4478c47f302a`
- 论文 bib 中给出的开源仓库（同样建议按需克隆到 `/tmp/...` 做代码审计）：
  - IdeaSearch framework：`https://github.com/IdeaSearch/IdeaSearch-framework`
  - IdeaSearch-fit（Fitter module）：`https://github.com/IdeaSearch/IdeaSearch-fit`

### 1.1 核心抽象：用语义算子替换语法算子

- 论文明确区分 `T_syntactic`（传统遗传编程：随机突变/交叉）与 `T_semantic`（LLM 通过自然语言理据生成“概念一致”的候选）。
- 关键不是“怎么搜索”，而是“在什么假设空间里搜索”：他们把空间改造成 **interpretable ansatz space**，并让 LLM 充当“语义变异/交叉算子”。

> 对 idea-generator 的映射：我们应该把“idea 空间”建模为 **受约束的研究计划/假说空间**，而不是无约束 brainstorm 文本空间；LLM 负责提出语义变异，但必须在可审查的约束中运行。

### 1.2 Explain-Then-Formalize（两阶段生成协议）

论文 Appendix 明确给出两阶段协议伪码（核心点；可直接迁移为我们 `RationaleDraft → IdeaCard` 的硬策略）：

- **Stage 1（高温）**：生成 *rationale + sketches*（语义探索）
- **Stage 2（低温、约束）**：把 sketch 抽取成 **canonical、可解析** 的表达（语法/格式保证 + bounded retries）

Appendix 伪码（摘录）：

```python
def generate_ansatz(context, top_K_ideas, seed):
    # Stage 1: Proposal Generation (higher temperature)
    prompt = build_prompt(context, top_K_ideas, seed)
    rationale, sketches = llm.generate(prompt, model=distributor.select())

    # Stage 2: Ansatz Extraction (lower temperature, constrained)
    for sketch in sketches:
        canonical_expr, metadata = llm.extract(sketch, rationale)
        if parse_and_validate(canonical_expr):  # bounded retries
            return canonical_expr, metadata
    return None
```

> 对 idea-generator 的映射：  
> - Stage 1 输出：`IdeaRationale`（WHY/直觉/机制/类比映射/风险）  
> - Stage 2 输出：`IdeaCard` / `idea_handoff_c2_v1.json`（结构化、可验证、可下游消费）

### 1.3 Distributor：softmax bandit 式异构模型分配

论文 Appendix 给出模型分配公式（softmax bandit）：

- 为每个 backend 维护 EMA 得分 `s_i`
- 按 `p_i = exp(s_i/T) / Σ exp(s_j/T)` 分配请求（bandit-like）

> 对 idea-generator 的映射：不仅要对 **LLM 后端** 做 bandit，也要对 **策略岛屿/算子族** 做 bandit（哪个 operator 近期更能产生“通过 A0 的 idea”）。

### 1.4 Multi-Island（repopulation-only）进化生命周期

论文 Appendix 以 “repopulation-only multi-island” 的方式描述生命周期：

- 8–12 个 islands 并行
- 每个 epoch：
  1) 按岛屿配额生成（分配器+岛屿上下文）
  2) 评估并入库
  3) 每隔若干 epoch：**repopulate** 最差 islands（用全局最好 ideas 采样替换/注入）

> 对 idea-generator 的映射：  
> - islands ≈ 不同“发现策略”群体（反常追踪/假设反转/对称性操作/跨域类比/组合创新…）  
> - repopulate ≈ 定期把“证据充分+可执行”的 ideas 注入其他策略群体，防止早熟收敛或孤岛化。

### 1.5 Repository Schema（候选对象的最小 SSOT）

论文 Appendix 给出中心仓库存储字段（最小 SSOT）：

- `expression`（canonical）
- `params`
- `chi2/ndf`
- `complexity`
- `rationale`
- `origin`（LLM ID, epoch, island）

> 对 idea-generator 的映射：我们的 `IdeaStore` 也应是“中心仓库”，且 **origin/provenance 必须一等公民**：模型、提示词 hash、策略岛、父代链路、证据 URI、评审记录，都必须可追溯。

### 1.6 关键的“可迁移增量”：动态表型（phenotype）评估

论文把 LLM 的表现从静态准确率转为“迭代轨迹”表型：快速收敛者 vs 持久探索者等（Iter@k / epochs 分布 / word-count 等过程指标）。

> 对 idea-generator 的映射：  
> - 我们可以对 LLM 进行 **ideation phenotype profiling**：谁更适合作“探索器”(divergent)，谁更适合作“形式化/审查器”(convergent/critic)。  
> - 这能反哺 bandit/调度器，形成“结构化异构协作”，而不是随机多模型堆叠。

把 Appendix 的 “dynamic evaluation metrics” 迁移到 ideation（建议最小指标集）：

- **Speed（快速收敛）**：`A0_pass@1 / A0_pass@10 / A0_pass@100`（或等价 step/epoch 版本）
- **Persistence（持续探索）**：`epochs_to_first_pass` 分布 + 3/4 分位（是否能在后期继续攻坚）
- **Efficiency（成本）**：`tokens_used_per_promoted_node` / `tokens_per_grounded_claim`
- **Grounding attachment**：`grounded_claim_ratio` 随 epoch 的上升速率（谁更会“先证据后扩展”）
- **Counterexample skill**：`checker_disagreement_rate` / `found_kill_criteria_rate`（谁更擅长发现反例/杀手条件）

> 关键点：phenotype profiling 不只是“选哪个模型更强”，而是把模型分配到 **不同 Role**（Ideator vs Formalizer vs Referee/Checker），并把这些过程指标写入 `origin`/`eval_info` 以便回放分析。

---

## 2. IdeaSearch 代码级架构抽取（以 PyPI 发行版为一手证据；GitHub 映射待核对）

**命名/仓库映射存在潜在“反直觉”风险**：论文 `cite.bib` 的引用指向（需用 README/Docs 进一步核对）：

- `IdeaSearch` → `https://github.com/IdeaSearch/IdeaSearch-fit`
- `IdeaSearchFitter` → `https://github.com/IdeaSearch/IdeaSearch-framework`

这与 repo 名称直觉（framework vs fit）可能相反。后续调研必须：
1) 以 README/Docs 的“自我描述”为准；  
2) 固化 **我们借鉴的对象** 是哪一层（框架层 vs fitter module），避免把 repo 名字当真源。

**本节的代码级证据来源（可离线复现）**：
- PyPI：`IdeaSearch==0.1.1`（框架层，`.idea` 文件对象、multi-island、prompt 模块化、(score, info)、Boltzmann choice 等）
- PyPI：`ideasearch-fit==0.0.5.1`（fitter helper，fuzzy 生成、auto polish、unit validation、数值优化等）

> 进度追踪 SSOT：把“仓库映射核对 + prompt 模板抽取”写入 `docs/plans/2026-02-12-implementation-plan-tracker.md`（不要在本文维护状态）。

### 2.1 关键工程特征（对我们最有用的）

1. **Idea 作为文件对象**：`.idea` 扩展名，系统围绕文件/目录组织数据与备份（工程上非常直观）。
2. **Evaluator 允许返回 `(score, info)`**：不仅“打分”，还携带解释性信息，随后可被写入 prompt 作为下一轮上下文（`include_info_in_prompt`）。
3. **prologue/epilogue prompt 模块化**：把 prompt 的固定骨架拆成可配置块；也允许完全自定义 `generate_prompt_func`。
4. **多岛并行 + repopulate**：核心 API 就有 `add_island()` / `repopulate_islands()`。
5. **模型选择 softmax（Boltzmann choice）**：`get_model()` 以 `softmax(model_score / T_sample)` 采样；`update_model_score()` 维护“窗口化近期评分”并用 `p`-norm 或 `max` 聚合成 `model_score`（作为能量/energy）。
6. **generation bonus（探索激励）**：采样/mutation/crossover 的能量可包含 `idea.score + generation_bonus * idea.level`，对新想法给予加成以避免早熟收敛。
7. **相似度阈值与提示**：提供 similarity distance/threshold，并可按“相似数量分段阈值”注入系统提示（把“太像了”变成可编排信号）。
8. **fitter helper 的“fuzzy generation/auto-polish”**（来自 `ideasearch-fit`）：先生成自然语言理论/机制，再由 translator 译成严格表达；并可用 auto-polish 自动补齐变量/单位语义，用于构造更“语义富集”的 prompt。

> 对 idea-generator 的映射：  
> - 我们的 prompt 体系应该同样具备 **骨架模块化**（prologue/seed/evidence/constraints/output schema/epilogue）。  
> - 评估必须返回 **可再利用的“诊断信息”**（不然无法形成真正的迭代搜索，只会变成“多次独立 brainstorm”）。

### 2.2 他们的“最小可复用抽象”是什么

IdeaSearch（framework）的最小闭环是：

1) **Sampler**：用历史 top ideas + prompt 骨架生成新 idea  
2) **Evaluator**：打分 + info  
3) **Island**：维护局部种群与 best idea  
4) **IdeaSearcher**：跨岛协调（并发、repopulate、模型选择、全局评估曲线）

> 对 idea-generator 的映射：  
> 我们也应把 `idea-core` 拆成类似 4 层，但把“idea”换成 `IdeaCard/IdeaNode`，把“评估”换成 novelty/feasibility/impact/grounding/tractability 的多目标体系，把“prompt”换成 domain pack 的模板集。

### 2.3 他们的局限（对我们是设计机会）

1. `.idea` 文件非常灵活，但 **缺少强 schema**（我们要的是可下游消费的结构化产物契约）。
2. `evaluate_func` 是用户自定义黑盒：缺少统一的 **证据链/溯源图** 与“硬过滤器”。
3. 通用框架层面对“科学真实约束”（守恒/对称性/量纲/实验约束）没有内建概念。

> 这正是我们要超越之处：**IdeaSearch 的“搜索骨架” + HEP-Autoresearch 的“证据/门禁/可复现执行链”**。

---

## 3. OpenClaw（Docs）可借鉴的工程化多 Agent/技能系统（Broadcast Groups / Tools / 隔离语义）

仓库：`https://github.com/openclaw/openclaw`（MIT License）  
文档（权威）：`https://docs.openclaw.ai`  

> 说明：OpenClaw 不是科研 ideation 系统，但它把“多 agent 产品化运行时”里最难的一块（并行/隔离/权限/路由/工具）工程化落地得很完整；这些语义可以抽象迁移到 `Physicist Community / TeamPolicy`。

OpenClaw 不是科研 ideation 系统，但它在“长期运行的 agent 产品”上提供了很多 **可移植的工程解法**：

### 3.1 “控制平面 vs 能力平面”分离（对标 hepar）

- OpenClaw 的 Gateway 是 control plane（路由、权限、运行时、可视化、工具接入、频道接入）。
- 实际能力由 skills / tools / nodes 提供。

> 对 idea-generator 的映射：  
> hepar 已经是控制平面；我们应坚持 `idea-core` 不直接依赖 orchestrator 内部实现，通过 artifact 契约通信（与 2026-02-11 方案一致）。

### 3.2 Skills 平台的几个关键点

1. **skills 列表只注入“索引”**（name/description/path），正文按需读取（降低上下文常驻成本）。  
2. Skills 有**可发现性**与**安装/启用 gating**概念（把“能力开关”从 prompt 中抽离出来）。
3. 多 agent routing / broadcast group：在某些 channel 场景让多个 agent 并行回答（“独立视角”工程化落地）。

> 对 idea-generator 的映射：  
> - DomainPack / StrategyPlugin 也应具备“索引 + 按需加载”，并支持显式启用/禁用。  
> - 多 agent 评审（Claude+Gemini）应像广播组一样 **默认隔离上下文**，直到进入“结构化辩论”阶段才允许受控信息流。

### 3.3 Broadcast Groups：把“多 agent 团队”从概念变成可执行运行时

OpenClaw 的 Broadcast Groups 是一个非常值得借鉴的工程机制：**同一条消息被广播给多个 agent**，每个 agent 以 **隔离 session/工作区/工具权限** 运行，最后由人类/上层系统消费这些并行输出。

从官方文档抽取的“硬语义”（直接可迁移）：

1. **broadcast 是顶层配置**：`broadcast: { strategy?: "parallel"|"sequential", [peerId]: agentIds[] }`
2. **触发顺序与门禁**：broadcast 在 allowlists / group activation（例如 mention gating）之后评估；broadcast 不绕过门禁，只改变“哪些 agents 被运行”。
3. **隔离边界**（默认 clean-room）：每个 agent 独立维护 session key / history / workspace / tool access / memory；但**共享 peer 的 group context buffer**（即：所有 broadcast agents 看到同一份上游对话上下文，但看不到彼此的草稿/中间推理）。
4. **并行/串行**：parallel 默认；sequential 按数组顺序执行；并行回复顺序不保证。
5. **失败独立**：某 agent 失败不阻塞其他 agent。

可迁移的设计规则（抽象后）：

1. **Team = roles[] + activation + isolation**  
   - 不是“多模型堆叠”，而是“多个明确角色并行工作”。  
   - 每个角色有独立上下文（避免互相污染），并可以配置不同工具权限（只读/可写/无工具）。
2. **并行/串行策略可配置**  
   - “并行”用于发散（多个专家同时给方案）。  
   - “串行”用于收敛（先 librarian 拉证据 → 再 ideator 生成 → 再 formalizer 结构化 → 再 critic 审查）。
3. **共享的只是输入上下文，不共享中间推理**  
   - 所有角色看到同一份“上游上下文包”（seed/约束/历史 top-k/证据索引），但彼此看不到对方草稿。  
   - 只有当触发“结构化辩论/仲裁”时才允许受控信息流（以结构化 point/counterpoint 的 artifacts 形式发生）。

> 对 idea-generator 的映射：我们需要一个可插拔的 “Physicist Community / Team Policy” 层，把 **multi-island** 从“策略分组”进一步升级为“**团队式并行探索**”：每个 island/方向都不是单个生成器，而是一个由角色组成的团队（ideator/coder/derivation/checker/referee…），以可审计 artifacts 协作。

### 3.4 Tools / profiles：把“工具权限”从 prompt 中抽离

OpenClaw 文档强调 “typed tools + allow/deny + profiles”：

- 全局 `tools.allow/tools.deny`（deny wins；支持通配符）
- `tools.profile` 作为基线 allowlist（例如 `minimal`/`coding`/`messaging`），并支持 per-agent override

> 对 idea-generator 的映射：Team/Role 的 `tool_policy` 必须是结构化、可审计的权限配置（不是“请小心使用 shell”这种 prompt 约定），并且要能落到 runtime adapter（OpenCode/opencode-style）里执行。

#### 3.4.1 Sandbox vs Tool Policy vs Elevated（工程上必须拆开三件事）

OpenClaw 把三件经常被混在一起的“安全控制”拆开定义（这对我们后续的 Team/Role 很关键）：

1. **Sandbox（在哪里跑）**：决定工具运行在 host 还是容器（`agents.*.sandbox.*`）。
2. **Tool policy（能不能用）**：决定哪些工具可用（`tools.allow/deny`；以及 sandbox 内的 `tools.sandbox.tools.*`；deny 优先；`allow` 非空则进入严格白名单模式）。
3. **Elevated（仅 exec 的逃生舱）**：当处于 sandbox 时，允许 `exec` 以“run on host”方式执行，但**不会**绕过 tool policy（被 deny 的 `exec` 依然不可用）。

此外，OpenClaw 的 tool policy 支持 `group:*` 这种“工具组”缩写（例如 `group:runtime`/`group:fs`/`group:memory`），可以显著降低 Team/Role 配置的重复度。

> 对 idea-generator/hepar 的映射：  
> - 我们的 `tool_policy`/`budget`/`gate` 也必须分层：**沙箱位置**、**工具可用性**、**审批（A0/A1…）** 彼此独立，避免“为了跑一个命令就把整个 sandbox 关掉”。  
> - 对 `Coder/Derivation/Checker` 这类角色，最常见的安全落点是：sandbox=on、tool_policy=严格 allowlist、elevated=默认 off（只有在 hepar 审批后才临时开）。

来源（OpenClaw docs）：`/gateway/sandbox-vs-tool-policy-vs-elevated`（以及相关 config reference）。

#### 3.4.2 Gateway protocol 的“硬语义”：idempotency + approvals + capability claims

从 OpenClaw 的 gateway protocol 文档（WS 协议层）还能抽取几个**必须前置到契约层**的工程纪律：

- **Side-effecting 方法必须带 idempotency key**（重试不会重复落盘/重复产物）  
  - 这类纪律已经被我们吸收进 `idea-core` 的 JSON-RPC（`search.step`/`eval.run`/`rank.compute`/`node.promote` 等的 `idempotency_key`）。
- **Exec approvals 事件化**：当执行需要批准时，gateway 发出 `exec.approval.requested` 事件；operator 以 `exec.approval.resolve` 结构化回应。  
  - 对我们意味着：外部 runtime 的 permission/approval 必须映射到 hepar 的 A0/A1… gate，并写入 ledger（不能口头“同意一下”）。
- **Node capability claims**：capability hosts（OpenClaw 里叫 node）在 connect 时声明 `caps/commands/permissions`，gateway 视为“claims”并做 server-side allowlists。  
  - 对我们意味着：Role/Team 的 tool surface 必须是“可声明、可裁定、可审计”的（不是 prompt 里的免责声明）。
- **Version negotiation + schema generation**：protocol 有 `minProtocol/maxProtocol`；schemas 从 TypeBox 生成并有 check 命令（避免协议漂移）。

> 对 idea-generator 的映射：  
> - `idea-core`/hepar/runtime-adapter 三者之间也应该有最小版本协商与“契约校验命令”（M1 里程碑）。  
> - permission/approval 必须事件化 + artifact 化，才能支撑“多团队并行 + clean-room 审查”。

来源（OpenClaw docs）：`/gateway/protocol`（roles/scopes、idempotency、approvals、versioning）。

### 3.5 安全提醒：skills/插件生态是供应链攻击面

OpenClaw 的“skills marketplace/扩展”在工程上很强，但对 evidence-first 科研生态来说也是高风险面：

- 任何可写文件/可执行命令的扩展，都可能绕过研究质量门禁，污染 artifacts 或注入不可审计行为。

> 对 idea-generator / hepar 的设计结论：  
> - 默认 **只允许本地、可审计、可版本锁定** 的能力包（DomainPack / runtime tool profiles）。  
> - 外部 skill/插件的启用必须走 hepar gate（A0/A1…）并记录到 ledger；不可“自动安装并执行”。

---

## 4. 对 idea-generator 架构的直接反哺（可执行设计结论）

把上述三部分抽取成我们可以直接落到 `idea-core` 的可扩展接口：

### 4.1 把“搜索”统一成 Operator + SearchPolicy

- `Operator`：语义变异/交叉/扩展（哲学策略/历史套路/跨域类比都在这里实现）
- `SearchPolicy`：BFTS / MCTS / Evolution / Multi-Island（可以互换）
- `Distributor`：对 `LLMBackend` 与 `OperatorFamily` 做 bandit 分配

### 4.2 强制两阶段：Rationale → Canonical IdeaCard

把 Explain-Then-Formalize 设为 **硬策略**（不是可选最佳实践）：

1) `RationaleDraft`：允许自由、发散、类比、隐喻  
2) `IdeaCard`：必须结构化、可验证、可下游消费（C2-ready）

### 4.3 “Evaluator 必须返回诊断信息”

参考 IdeaSearch（framework）的 `(score, info)` 设计：  
我们的评估器对每个维度输出：

- `score`（数值）
- `justification`（文本）
- `evidence_uris[]`（可点击引用）
- `fix_suggestions[]`（可用于下一轮 prompt 的可操作修复建议）

这使得搜索能形成真正的“迭代改进”，而不是每次从零开始。

---

## 5. Ideasearch 后续调研任务清单（布置）

为了把借鉴变成“可实现的设计”，建议把后续工作拆成 6 个研究/实现任务（每个任务都要产出可审计文档或原型代码，不能停在口头总结）。

**进度追踪规则**：本文只描述任务与验收口径；状态与 next action 统一写入 SSOT：`docs/plans/2026-02-12-implementation-plan-tracker.md`。

1. **Prompt 骨架抽取**：从 `IdeaSearch-fit` 的提示词（含 fuzzy 模式）抽出可迁移结构（prologue/examples/epilogue + extractor 模式），形成我们的 `PromptTemplateSpec v1`。
2. **多岛策略映射**：把我们已有的 S1–S8（反常追踪/假设反转/对称性操作…）映射到 island taxonomy，明确每个岛的：
   - 输入 seed 类型
   - operator 集合
   - 硬约束/软约束
   - 评估权重
3. **Bandit 调度器设计**：定义 model/operator 的 reward 信号（短期：grounding ratio、novelty proxy；长期：A0 通过率、C2 成功率）。
4. **仓库与谱系（genealogy）最小实现**：对齐我们已有的 `IdeaStore JSONL + provenance DAG` 方案，补齐字段：`origin`、`operator_trace`、`debate_trace`、`evidence_graph_ref`。
5. **与 A0 门禁耦合的“repopulate”规则**：探索“把 A0 通过的 ideas 注入所有岛”的节奏与注入量（防止破坏多样性）。
6. **把 IdeaSearch 的“表型评估”迁移到 ideation**：定义 `ideation phenotype` 指标集（探索深度、改写幅度、证据附着速度、反例发现能力等），用于调度与回放分析。

---

## 6. 这份深读补充对现有文档的改动建议

建议在下一轮设计文档迭代中，把：

- `docs/plans/2026-02-11-idea-generator-design.md` 的“多岛/异构模型/Explain-Then-Formalize”从“原则”提升为：
  - 可测试的接口（Operator/SearchPolicy/Distributor）
  - 可落地的 artifact schema 字段（origin/operator_trace/eval_info）
- `docs/plans/2026-02-12-literature-supplement.md` 的 IdeaSearch 部分补齐：
  - softmax bandit 公式与两阶段协议
  - IdeaSearch（framework）的工程特征（score+info、prompt 模块化、多岛 API）
  - OpenClaw 的“按需加载 skills 索引”启发（用于 DomainPack/StrategyPlugin）
