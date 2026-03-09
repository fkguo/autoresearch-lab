# Idea-Generator 补充文献调研与设计扩展

> 补充调研日期: 2026-02-12
> 在 2026-02-11 设计报告基础上扩展

---

## 目录

1. [补充文献综述](#1-补充文献综述)
2. [跨领域类比 Idea 生成机制](#2-跨领域类比-idea-生成机制)
3. [科学变革范式与 Idea 生成策略](#3-科学变革范式与-idea-生成策略)
4. [用户种子文件设计](#4-用户种子文件设计)
5. [更新后的管线架构](#5-更新后的管线架构)
6. [关键设计原则总结](#6-关键设计原则总结)
7. [参考文献](#7-参考文献)

---

## 1. 补充文献综述

### 1.1 IdeaSearch / IdeaSearchFitter (arXiv: 2510.08317)

**核心贡献**: 将 FunSearch/AlphaEvolve 的进化搜索范式应用于符号回归，用 LLM 作为**语义算子**替代传统遗传编程的随机突变。

**关键架构特征**:
- **多岛进化循环**: 8-12 个独立子群体并行演化，周期性用全局最优替换最差岛屿，维持语义谱系多样性
- **Explain-Then-Formalize 两阶段生成**: 先高温创意生成自然语言理据 + 草图，再低温精确提取规范化表达式（提取阶段强约束为“可解析/可验证”的 canonical 表达，并带 bounded retries）
- **异构 LLM 集成**: 使用 10 种不同 LLM 后端 (gpt-5-mini, grok-4, qwen3, gemini-2.5-flash 等)，通过 softmax bandit 策略自适应分配（实现细节：维护每个后端的 EMA 评分 $s_i$，用 $p_i=\exp(s_i/T)/\sum_j\exp(s_j/T)$ 分配生成配额）
- **Pareto 选择**: 在多目标 (精度 vs 复杂度) Pareto 前沿上选择候选者
- **仓库模式**: 中心仓库存储每个 idea 的 canonical 表达、参数、评分、复杂度、自然语言理据、以及来源元数据（LLM ID / epoch / island）
- **动态表型评估**: 用 Iter@k / epoch 分布 / word-count 等过程指标刻画“快速收敛者 vs 持久探索者”，反哺异构协作与调度
- **开源框架化**: `IdeaSearchFitter` 是迭代代理框架 `IdeaSearch` 的一个模块；框架层提供多岛并行、prompt prologue/epilogue 模块化、评估返回 `(score, info)` 等可复用工程抽象（文档：`https://www.ideasearch.cn/`；仓库引用见论文 `cite.bib`，存在 “IdeaSearch ↔ IdeaSearch-fit / IdeaSearchFitter ↔ IdeaSearch-framework” 的命名映射风险，需以 README/Docs 自述为准）

**可迁移原则**:
1. 语义搜索优于语法搜索 — idea 应在"语义空间"中生成
2. 先解释再形式化 — 先阐述 WHY，再形式化 HOW
3. 多岛多样性维护 — 多个独立 idea 线程防止过早收敛
4. 异构 Agent 集成 — 不同 LLM 具有互补的"推理表型"(快速收敛 vs 持久探索)
5. 自适应资源分配 — softmax bandit 策略倾向近期表现好的模型
6. 评估必须返回“可再投喂诊断” — 不止分数，还要能解释/指出可修复方向（score + info / fix suggestions）

### 1.2 Deep Ideation (arXiv: 2511.02238)

**核心贡献**: 在科学概念网络上进行 LLM 驱动的 idea 迭代精化。

**关键架构特征**:
- **科学概念网络 G=(V,E)**: 从约 10 万篇论文（论文附录给出 107,443 规模）提取关键词为节点，共现关系为边，边特征保留论文中的语境关系（不仅是共现计数）
- **Explore-Expand-Evolve 工作流**:
  - **Explore**: 对每个关键词检索网络邻居，分析关系语义
  - **Expand**: 选择最有影响力的新关键词加入集合，综合当前关键词集生成 idea
  - **Evolve**: Router 决定替换关键词还是重写 idea（根据瓶颈在哪）
- **Idea Stack**: 累积日志记录每轮迭代的关键词集、idea、评分、决策理由
- **Critic 模型**: 用 4278 条模拟同行评审数据微调的 Qwen3-8B，提供 novelty/feasibility 评分
- **最短路径作为 novelty-feasibility 权衡信号**: 网络中关键词间最短路径越长 → 越新颖；越短 → 越可行

**关键结果**: 整体表现超过已发表论文的水准 (3.82 vs 3.81)，比最佳基线提升 10.25%。

**可迁移原则**:
1. **概念网络导航** — 在物理概念网络上进行有引导的探索
2. **自适应 novelty-feasibility 调节** — 当 novelty 低时偏好远距离概念，feasibility 低时偏好近距离概念
3. **Critic 驱动进化** — 去掉 Critic 后性能下降 6%，方向性反馈至关重要

### 1.3 VirSci / Virtual Scientists (ACL 2025 Main, arXiv: 2410.09403)

**核心贡献**: 基于 35M+ 真实科学家档案的多 Agent 团队协作 idea 生成。

**关键架构特征**:
- **五步管线**: 合作者选择 → 主题讨论 → Idea 生成 → 新颖性评估 → 摘要生成
- **邀请机制 (Inter-team)**: Agent 在讨论中可动态召唤外部专家临时 Agent（不永久加入团队）
- **50% freshness 最优**: 50% 新成员 + 50% 老成员的团队产出最高 novelty，与 Science of Science 研究一致
- **盲审投票**: 新颖性评估阶段不共享对话记忆，确保独立判断
- **自审查门控**: 摘要生成后与过去文献对比，太相似则重启

**关键结果**: 在人工评估中 novelty 5.24/10, feasibility 4.52/10, effectiveness 4.95/10，显著优于 AI Scientist 和 HypoGen。

**可迁移原则**:
1. **Explore-exploit 团队组建** — 平衡熟悉和新鲜的 Agent 组合
2. **多阶段不同讨论模式** — 共识寻求/归档扩展/盲审投票/迭代精化各用不同信息流
3. **5 轮讨论最优** — 过多轮次导致疲劳效应
4. **自适应轮数** — 团队 leader 决定何时停止，比固定轮数效率高 22-28%

### 1.4 SciMON (ACL 2024, arXiv: 2305.14259)

**核心贡献**: 第一个系统性的文献驱动 + novelty 优化的科学 idea 生成框架。

**关键架构特征**:
- **三通道灵感检索**:
  - 语义邻居 (SN): SentenceBERT 嵌入相似度图中检索相似问题的解决方案
  - 知识图谱邻居 (KG): 全语料提取的实体关系图中检索结构关联概念
  - 引用邻居 (CT): 引用网络中检索相关论文标题作为灵感
- **迭代 Novelty Boosting**: retrieve-compare-update 循环
  1. 用当前 idea 检索 k=20 最近邻
  2. 如果任一相似度 > μ=0.6，告诉 LLM 其 idea 与哪些现有工作重叠
  3. LLM 修改 idea 使之"显著不同"
  4. 重复直到所有相似度 < μ
- **对比学习**: InfoNCE 损失减少从输入上下文的直接复制行为

**关键结果/警示**:
- GPT-4 生成的 idea **在 85% 的情况下技术深度和 novelty 显著低于真实论文**
- Novelty boosting 第一轮改善 55.6% 的 idea，但深层技术创新仍超出当前能力
- 该系统最适合作为**头脑风暴助手**，而非自主研究者

**可迁移原则**:
1. **三通道灵感检索** — 语义相似度 + 知识图谱 + 引用网络提供互补灵感类型
2. **迭代 novelty boosting** — 通过显式对比现有文献逐步提升新颖性
3. **结构化证据域的优势**: 当前首个 HEP domain pack 拥有 PDG / INSPIRE / HEPData 等结构化资源；这说明应把 structured evidence sources 建模为 pack/provider capability，而不是写死成 core 假设

### 1.5 ResearchBench (arXiv: 2503.21248)

**核心贡献**: 首个大规模基准，将科学发现分解为灵感检索 + 假设合成 + 假设排序三个子任务。

**关键发现**:
- LLM 在**灵感检索**上表现惊人（GPT-4o 在 top-4% 选择中达到 45.65% 命中率）— 这是一个 OOD 任务，说明 LLM 具有潜在的"知识关联直觉"
- 灵感检索能力在 ~70B 参数处饱和，而假设排序能力持续随模型规模提升
- **严重的位置偏差**: LLaMA-3.1-8B 在排序中 91.67% 自相矛盾；Claude 3.5 Sonnet 仅 19.17%
- 覆盖 12 个学科 (含 Physics, Chemistry, Math, Astronomy)，1386 篇论文

**可迁移原则**:
1. **灵感检索是关键瓶颈** — 取决于预训练数据广度而非推理能力
2. **三级负样本设计** — 引用邻近/同领域/跨领域三层距离的负样本构建
3. **进化假设合成** — mutate/refine/recombine 操作优于单次生成
4. **排序必须做位置偏差缓解** — 双向比较 + reversed positions

### 1.6 LacMaterial (arXiv: 2510.22312) — 跨领域类比

**核心贡献**: 证明**显式结构化类比推理**将 LLM 从保守模式匹配器转变为创造性假设生成器。

**关键架构**: 三层提示结构:
1. **抽象跨领域类比** (如"数据中心骨干网冗余设计")
2. **类比引导范例** (来自另一子领域的具体案例)
3. **约束生成** (在类比框架内生成，强制维持物理约束)

**关键结果**: 标准提示生成的候选物仅是已知数据库条目的微小变体；跨领域类比引导下的候选物出现多位点/多元素修改，产生数据库中不存在的全新组合。

**可迁移原则**:
1. **远类比用于探索，近类比用于利用** — exploration-exploitation 框架
2. **显式类比映射表** — 要求 LLM 产生源域→目标域映射表，使推理可审查
3. **物理约束作为硬过滤器** — 在类比生成中强制维持守恒律/对称性/量纲一致性
4. **多轮多数投票** — 10 轮独立生成 + 多数投票过滤噪声

### 1.7 Novelty 评估: 多工作流比较 (arXiv: 2601.09714)

**核心发现**:

| 架构类型 | Novelty (0-5) | 核心机制 |
|---------|:---:|---------|
| **Google Co-Scientist** (多 Agent 对抗辩论) | **4.17** | 专门的"怀疑者"Agent 挑战衍生性 idea |
| **Gemini 3 Pro** (长上下文) | **4.17** | "负空间"分析 + 链式加密提示 |
| **GPT Deep Research** (递归分解) | 3.83 | 子问题树 + 并行检索增强 |
| **Sakana AI v2** (进化搜索) | 3.50 | 种群突变 + 跨域迁移 |
| **Reflection** (自我反思) | 2.17 | 自我批评 + 迭代精化 |

**关键设计教训**:
1. **分解 > 反思** — 自下而上构建优于自上而下打磨，结构性减少抄袭倾向
2. **对抗 Agent 是高杠杆设计** — 专门检测衍生性的"怀疑者"显著提升 novelty
3. **Novelty 与 feasibility 不矛盾** (r=0.23) — 精心设计可同时实现两者
4. **领域感知工作流选择** — 数据丰富领域用分解，约束重领域用结构化审查

### 1.8 ResearchAgent (NAACL 2025)

**核心贡献**: 通过实体中心知识存储 + 多 Agent 审稿人迭代精化生成研究 idea。

**关键特征**:
- 从全部可用论文中提取实体构建**实体中心知识存储**
- 学术图谱连接提供跨领域有意义的概念关联
- 多个 LLM ReviewingAgents 提供类似同行评审的反馈
- 跨学科验证有效性

### 1.9 "Can LLMs Generate Novel Research Ideas?" (Si et al., ICLR 2025)

**大规模人类研究** (100+ NLP 研究者):
- LLM 生成的 idea 被评为**比人类专家 idea 更新颖** (p < 0.05)
- 但 LLM idea 的 feasibility 略弱
- **关键警示**: LLM 在 scale up 时缺乏 idea 多样性，且不能作为可靠评估者

---

## 2. 跨领域类比 Idea 生成机制

基于 LacMaterial、SciMON、Deep Ideation 等论文的综合分析，我们提出以下跨领域类比 idea 生成方案:

### 2.1 类比生成的三种模式

```
┌──────────────────────────────────────────────────┐
│              跨领域类比 Idea 生成器                 │
├──────────────────────────────────────────────────┤
│                                                    │
│  模式 A: 结构类比 (Structure Mapping)              │
│  ─────────────────────────────────                │
│  "一个领域中的拓扑保护边界模 → 另一个理论 setting   │
│   中是否存在同构的保护态?"                         │
│  机制: 提取源域的数学/对称性结构，映射到目标域        │
│                                                    │
│  模式 B: 方法迁移 (Method Transfer)                │
│  ─────────────────────────────────                │
│  "蒙特卡洛树搜索在围棋中的成功 → 能否用于            │
│   费曼图拓扑的自动搜索?"                            │
│  机制: 提取源域的算法/方法论，应用于目标域的问题       │
│                                                    │
│  模式 C: 现象映射 (Phenomenon Mapping)              │
│  ─────────────────────────────────                │
│  "BEC 中的声学黑洞类比 → 是否有新的                  │
│   Hawking 辐射类比系统?"                            │
│  机制: 寻找不同物理系统中的共同数学描述               │
│                                                    │
└──────────────────────────────────────────────────┘
```

### 2.2 跨领域类比管线

```
输入: 目标域问题 (如 "某类弱信号/高维约束问题出现性能平台")
  │
  ▼
[Step 1: 抽象化]
  LLM 提取问题的核心数学/概念结构
  → "信号在大量背景噪声中的弱信号探测"
  │
  ▼
[Step 2: 跨域检索]
  在其他领域中检索具有相同抽象结构的成功方案:
  - 引力波探测中的模板匹配技术
  - 脑科学中的 EEG 弱信号提取
  - 通信工程中的扩频码技术
  │
  ▼
[Step 3: 类比引导范例]
  选择最佳跨域范例，构建显式映射表:
  │ 源域 (引力波)         │ 目标域 (暗物质)        │
  │ 匹配滤波器           │ ?                      │
  │ 波形模板库           │ 暗物质信号模型库        │
  │ 检测器网络冗余       │ 多探测器联合分析        │
  │
  ▼
[Step 4: 约束生成]
  在类比框架内生成具体 idea，同时强制满足:
  - 物理约束 (守恒律、对称性、量纲)
  - 实验约束 (现有探测器能力、数据可用性)
  - 可行性约束 (计算资源、时间框架)
  │
  ▼
[Step 5: Novelty 检查]
  SciMON 式迭代 novelty boosting:
  检索 INSPIRE → 比较 → 如果太相似则修改 → 重复
```

### 2.3 LLM 参数知识利用

LLM 训练数据中包含大量跨领域知识，可通过以下方式激活:

1. **显式跨域提示**: "这个问题在 [凝聚态/天体物理/数学/信息论] 中有没有类似的已解决问题?"
2. **概念网络探索** (Deep Ideation 模式): 从当前目标域或首个 domain pack 的概念出发，在科学概念网络中探索跨域邻居
3. **Few-shot 类比示范**: 提供成功的历史跨域类比案例 (如 AdS/CFT, 信息黑洞悖论)

---

## 3. 科学变革范式与 Idea 生成策略

基于 Kuhn 的科学革命结构和更现代的科学哲学，我们提出 8 种 idea 生成策略:

### 3.1 策略总览

| # | 策略名称 | 灵感来源 | 核心操作 | 示例 |
|---|---------|---------|---------|------|
| S1 | **反常追踪** | Kuhn (反常积累) | 系统搜索不同表述/预测/观测之间的偏差 | 预测与观测不一致、边界条件冲突、跨 formalism 张力 |
| S2 | **假设反转** | Popper (可证伪性) | 系统反转主流理论的关键假设 | "如果主导近似并不主导，结论会如何重排?" |
| S3 | **跨域迁移** | 科学史 (类比发现) | 将另一领域的成功方法/概念迁移 | Maxwell 的场类比、AdS/CFT |
| S4 | **统一推广** | 物理学统一传统 | 寻找看似不相关现象的共同描述 | 电弱统一、弦论 |
| S5 | **极限外推** | 物理标度论 | 将已知理论推到极端参数区间 | 极高能、极低温、极大/极小尺度 |
| S6 | **对称性操作** | 对称性与守恒律 | 系统探索对称性的破缺/恢复/推广 | 超对称、宇称破缺、味对称性 |
| S7 | **组合创新** | 进化算法 | 交叉组合已有方法/理论的子模块 | EFT + lattice, ML + MC |
| S8 | **约束放松** | Sakana AI v2 | 系统放松标准计算/理论中的近似假设 | 重新审视常用近似的适用范围 |

### 3.2 各策略的详细实现

#### S1: 反常追踪 (Anomaly Hunter)

**对应 Kuhn 范式**: 反常积累 → 危机 → 革命

**实现**:
```yaml
trigger: 自动扫描领域文献索引/结构化证据源/benchmark
signal: |
  - 观测值与主流预测偏差持续扩大
  - 多个独立来源给出一致偏离
  - 偏差随精度提升增大而非缩小
action: |
  1. 汇总所有相关张力的证据记录
  2. 搜索文献中已提出的解释或归因
  3. 用 LLM 提出未被覆盖的新解释路径
  4. 检查新解释是否同时解释多个相关张力
```

#### S2: 假设反转 (Assumption Inverter)

**对应 Popper**: 通过反转使假说更可证伪

**实现**:
```yaml
input: 一篇论文或理论框架
action: |
  1. LLM 提取论文中的所有隐含假设
     (如: "假设领头阶近似主导", "假设两个表述在当前精度下等价")
  2. 系统性地反转每个假设
  3. 评估反转后的理论是否自洽
  4. 搜索支持反转假设的实验证据
```

#### S3: 跨域迁移 (Cross-Domain Transfer)

见第 2 节详细描述。

#### S4: 统一推广 (Unification Seeker)

**实现**:
```yaml
input: 两个看似无关的理论现象/形式化问题
action: |
  1. LLM 分析两者的数学结构
  2. 寻找共同的对称性/代数结构
  3. 构造统一描述的有效框架或等效结构
  4. 预测统一框架的新现象/新约束
```

#### S5: 极限外推 (Limit Explorer)

**实现**:
```yaml
input: 一个已知有效的理论/方法
action: |
  1. 识别理论或方法的有效参数范围
  2. 系统探索极限情况:
     - 能量 → ∞ 或 → 0
     - 维度 → 高维 或 → 低维
     - 耦合常数 → 强耦合 或 → 弱耦合
     - 粒子数 → ∞ (热力学极限)
  3. 分析极限行为是否揭示新的结构、失效模式或可检验效应
```

#### S6: 对称性操作 (Symmetry Operator)

**实现**:
```yaml
input: 一个物理系统或理论
action: |
  1. 枚举系统的所有已知对称性
  2. 对每个对称性进行操作:
     - 自发破缺: 什么新态/相会出现?
     - 显式破缺: 什么新现象可观测?
     - 推广: 能否嵌入更大的对称群?
     - 对偶: 是否存在对偶描述?
  3. 搜索每种操作的可检验后果或形式化约束
```

#### S7: 组合创新 (Combinatorial Innovation)

类似 IdeaSearch 的进化方法:
```yaml
input: 方法库 A = {symbolic reasoning, numerical simulation, ML surrogates, variational methods, bootstrap, ...}
       理论库 B = {effective theories, strongly coupled systems, topological phases, spectral problems, ...}
action: |
  1. 对 (A_i, B_j) 对进行系统交叉
  2. LLM 评估每种组合的新颖性和可行性
  3. 保留 Pareto 前沿上的组合
  4. 迭代: 对最佳组合进行变异和再组合
```

#### S8: 约束放松 (Constraint Relaxer)

**实现**:
```yaml
input: 标准计算/分析中使用的近似
action: |
  1. LLM 列出领域中常用的近似:
     - 线性化/微扰截断
     - 连续极限或无限体积近似
     - 局域/平衡/均匀性假设
     - 单尺度主导近似
  2. 系统放松每个近似
  3. 评估: 放松后结果是否显著不同?
  4. 如果是 → 新的物理效应可能隐藏其中
```

---

## 4. 用户种子文件设计

### 4.1 Seed 文件格式: `seeds.yaml`

用户可以通过编辑简单的 YAML 文件来添加 idea 种子:

```yaml
# idea-generator/seeds.yaml
# 用户可以自由编辑此文件添加 idea 种子
# 每个种子将被送入 Idea 生成管线进行扩展和评估

seeds:
  # ---- 种子类型 1: 自由文本 idea ----
  - type: freeform
    title: "用自洽性约束收紧一个有效理论参数空间"
    description: |
      若某类理论同时满足对称性、解析性和已知低能约束，
      能否把这些条件提升为 typed consistency constraints，
      用来系统压缩参数空间并暴露最脆弱的假设?
    domain: theory-physics
    priority: high  # high | medium | low
    tags: [consistency-search, EFT, constraints]

  # ---- 种子类型 2: 文献驱动 (INSPIRE RecID) ----
  - type: paper_seed
    inspire_recid: 2882456
    question: |
      这篇论文提出的方法能否推广到另一类理论设置或边界条件?
    strategy: S3  # 跨域迁移

  # ---- 种子类型 3: 反常/张力 ----
  - type: anomaly
    name: "Cross-formalism scaling tension"
    theory_value: "formalism_A predicts monotonic scaling"
    experiment_value: "formalism_B requires a turnover"
    deviation: "persistent model mismatch"
    question: "哪一组隐藏假设导致两个表述对同一问题给出不兼容结论?"

  # ---- 种子类型 4: 跨域类比 ----
  - type: analogy
    source_domain: "condensed matter"
    source_concept: "topological edge protection"
    target_domain: "quantum field theory"
    question: "另一类理论 setting 中是否存在同构的保护态或边界模?"

  # ---- 种子类型 5: 方法组合 ----
  - type: combination
    methods: ["symbolic search", "numerical bootstrap"]
    target: "tighten consistency bounds for an effective model"

  # ---- 种子类型 6: 假设反转 ----
  - type: assumption_inversion
    paper_or_theory: "Baseline effective-theory truncation"
    assumption_to_invert: "Leading-order terms dominate the observable hierarchy"
    alternative: "Subleading structure reorganizes the hierarchy"

# ---- 全局配置 ----
config:
  default_domain: theory-physics
  max_ideas_per_seed: 10
  strategies: [S1, S2, S3, S4, S5, S6, S7, S8]  # 启用的策略
  novelty_threshold: 0.6  # SciMON 式 novelty 阈值
```

### 4.2 简化输入: `ideas.md` (Markdown 格式)

对于偏好简单文本的用户，也支持 Markdown 格式:

```markdown
# Ideas / 研究想法

## High Priority

- [ ] 用自洽性约束收紧一个有效理论参数空间
  - 背景: 多类理论问题都可以转写为“约束是否彼此相容”
  - 问题: 能否把这些约束提升为 typed artifacts 并系统压缩参数空间?
  - Tags: consistency-search, EFT, constraints

- [ ] 把跨 formalism 张力转写为可检索的约束冲突图
  - 偏差: 不同表述对同一允许区域给出不一致结论
  - 策略: 追踪隐藏假设并寻找最小修正路径

## Medium Priority

- [ ] 将 tensor-network 压缩引入高维状态空间搜索
- [ ] 用 normalizing flow 改进受约束采样效率

## Seeds from Papers

- INSPIRE:2882456 — 能否推广到另一类边界条件?
- arXiv:2501.12345 — 方法是否适用于另一类 strongly coupled system?
```

### 4.3 文件监控与热加载

```
idea-generator/
├── seeds.yaml          # 结构化种子 (YAML)
├── ideas.md            # 简化种子 (Markdown)
├── seeds/              # 种子目录 (每个文件一个种子)
│   ├── consistency-constraint.yaml
│   └── g2-w-mass.yaml
└── .idea-generator.yaml  # 本地配置
```

系统启动时和周期性地扫描这些文件，新增/修改的种子自动进入管线。

---

## 5. 更新后的管线架构

综合所有文献调研，更新后的 idea 生成管线:

```
┌─────────────────────────────────────────────────────────────┐
│                    SEED LAYER (输入层)                        │
│                                                               │
│  [seeds.yaml/ideas.md]  [C1 Gap 输出]  [反常数据库]           │
│  [INSPIRE 扫描]          [KB priors]   [LLM 跨域知识]        │
│         │                    │              │                 │
│         └────────────┬───────┘──────────────┘                │
│                      ▼                                        │
├─────────────────────────────────────────────────────────────┤
│               EXPANSION LAYER (扩展层)                        │
│                                                               │
│  ┌─── Multi-Island Evolutionary Loop (IdeaSearch 模式) ──┐   │
│  │                                                         │  │
│  │  Island 1: S1 反常追踪     Island 2: S3 跨域迁移      │  │
│  │  Island 3: S6 对称操作     Island 4: S7 组合创新      │  │
│  │  Island 5: S2 假设反转     Island 6: 自由探索         │  │
│  │                                                         │  │
│  │  Each island: Explain → Formalize → Score → Archive    │  │
│  │  Heterogeneous LLMs: Claude + Gemini + Codex + ...     │  │
│  │                                                         │  │
│  │  每 N 轮: 最差岛屿从全局最优重新填充                    │  │
│  └─────────────────────────────────────────────────────────┘ │
│  生成 ~50 个候选 idea                                        │
│                                                               │
├─────────────────────────────────────────────────────────────┤
│               GROUNDING LAYER (接地层)                        │
│                                                               │
│  对每个 idea:                                                 │
│  1. INSPIRE 文献检索 → 找到 k 近邻论文                       │
│  2. SciMON 式 novelty boosting (retrieve-compare-update)     │
│  3. PDG 数据检查 → 是否与实验数据矛盾?                      │
│  4. 物理约束验证 → 守恒律/对称性/量纲                        │
│  保留 ~10 个                                                  │
│                                                               │
├─────────────────────────────────────────────────────────────┤
│               EVALUATION LAYER (评估层)                       │
│                                                               │
│  Deep Evaluation (复用 referee-review 技能):                  │
│  1. Novelty: 4 层评估 (lexical → semantic → structured → debate)│
│  2. Feasibility: 计算资源映射 + 方法可用性                    │
│  3. Impact: 领域重要性评估                                    │
│                                                               │
│  Adversarial Agent (怀疑者): 专门挑战衍生性 idea              │
│                                                               │
│  Critic Model: 类似 Deep Ideation 的评估反馈                  │
│  → 驱动 EVOLVE: 替换概念 或 重写 idea                        │
│                                                               │
├─────────────────────────────────────────────────────────────┤
│               RANKING LAYER (排序层)                          │
│                                                               │
│  Multi-objective Pareto selection:                             │
│  axes: [novelty, feasibility, impact, clarity]                │
│                                                               │
│  Blind multi-agent voting (VirSci 模式):                     │
│  不同 LLM 独立评分 + 反转位置偏差缓解                        │
│                                                               │
│  输出: top-5 ranked ideas                                     │
│                                                               │
├─────────────────────────────────────────────────────────────┤
│               A0 GATE → HANDOFF                               │
│                                                               │
│  A0.1: Campaign Approval (人类确认研究方向)                   │
│  A0.2: Idea Promotion (人类选择具体 idea 投入资源)            │
│  → Phase C2 (Method Design) → computation execution          │
│                                                               │
│  Rejected ideas → rejected_ideas KB (防止重复生成)            │
│  Successful ideas → feedback loop to L1-L3 self-evolution     │
└─────────────────────────────────────────────────────────────┘
```

---

## 6. 关键设计原则总结

综合 8+ 篇最新论文的证据，我们确立以下设计原则:

| # | 原则 | 证据来源 | 影响 |
|---|------|---------|------|
| P1 | **分解优于反思** — 自下而上构建 idea | Novelty Eval (4.17 vs 2.17) | 管线用多层分解而非反思循环 |
| P2 | **Explain-Then-Formalize** — 先理由后形式化 | IdeaSearch (82.5% 恢复率) | 每个 idea 必须先有自然语言理据 |
| P3 | **多岛多样性** — 独立子群体并行探索 | IdeaSearch (无单一模型覆盖所有) | 6 个策略岛屿 + 周期性重填 |
| P4 | **异构 Agent 集成** — 不同 LLM 互补 | IdeaSearch + VirSci | Claude + Gemini + Codex 集成 |
| P5 | **迭代 Novelty Boosting** — 显式对比文献 | SciMON (55.6% novelty 提升) | 每个 idea 经过 retrieve-compare-update |
| P6 | **跨域类比** — 远类比探索 + 近类比利用 | LacMaterial (新组合生成) | 三模式类比: 结构/方法/现象 |
| P7 | **对抗 Agent** — 专门挑战衍生性 | Novelty Eval (Co-Scientist 4.17) | 管线中的"怀疑者"角色 |
| P8 | **概念网络导航** — 利用图结构 | Deep Ideation (+10.25%) | 在当前目标域概念网络上 explore-expand-evolve |
| P9 | **用户种子** — 简单文件添加 | 用户需求 | seeds.yaml + ideas.md |
| P10 | **物理约束硬过滤** — 守恒律/对称性 | LacMaterial + physics review | 所有 idea 必须满足基本物理约束 |
| P11 | **50% freshness** — 平衡新旧组合 | VirSci (Science of Science) | Agent 团队组建的 explore-exploit 平衡 |
| P12 | **Pareto 多目标选择** — 非单一指标 | IdeaSearch + 多论文 | [novelty, feasibility, impact, clarity] 前沿 |

---

## 7. 参考文献

### 已深度分析的论文

1. **IdeaSearch/IdeaSearchFitter** — Song et al. (2025). "Iterated Agent for Symbolic Regression." [arXiv:2510.08317](https://arxiv.org/abs/2510.08317)
2. **Deep Ideation** — Zhao et al. (2025). "Designing LLM Agents to Generate Novel Research Ideas on Scientific Concept Network." [arXiv:2511.02238](https://arxiv.org/abs/2511.02238)
3. **VirSci** — Su, Chen et al. (2025). "Many Heads Are Better Than One." ACL 2025 Main. [arXiv:2410.09403](https://arxiv.org/abs/2410.09403)
4. **SciMON** — Wang et al. (2024). "Scientific Inspiration Machines Optimized for Novelty." ACL 2024. [arXiv:2305.14259](https://arxiv.org/abs/2305.14259)
5. **ResearchBench** — (2025). "Benchmarking LLMs in Scientific Discovery via Inspiration-Based Task Decomposition." [arXiv:2503.21248](https://arxiv.org/abs/2503.21248)
6. **LacMaterial** — Guo (2025). "Large Language Models as Analogical Chemists for Materials Discovery." [arXiv:2510.22312](https://arxiv.org/abs/2510.22312)
7. **Multi-Workflow Novelty Evaluation** — Saraogi et al. (2025). "Evaluating Novelty in AI-Generated Research Plans." [arXiv:2601.09714](https://arxiv.org/abs/2601.09714)
8. **ResearchAgent** — Baek et al. (2025). "Iterative Research Idea Generation over Scientific Literature." NAACL 2025. [arXiv:2404.07738](https://arxiv.org/abs/2404.07738)

### 补充检索的论文

9. **Can LLMs Generate Novel Research Ideas?** — Si et al. (2025). ICLR 2025. [arXiv:2409.04109](https://arxiv.org/abs/2409.04109)
10. **IdeaBench** — KDD 2025. [ACM DL](https://dl.acm.org/doi/10.1145/3711896.3737419)
11. **Chain of Ideas** — EMNLP 2025 Findings. [ACL Anthology](https://aclanthology.org/2025.findings-emnlp.477.pdf)
12. **Can Theoretical Physics Benefit from Language Agents?** — (2025). [arXiv:2506.06214](https://arxiv.org/abs/2506.06214)
13. **Large Physics Models** — (2025). European Physical Journal C. [Springer](https://link.springer.com/article/10.1140/epjc/s10052-025-14707-8)
14. **KG-CoI** — PMC 2025. [PMC](https://pmc.ncbi.nlm.nih.gov/articles/PMC11923747/)
15. **Paradigm Shifts in AI** — CACM. [ACM](https://cacm.acm.org/research/the-paradigm-shifts-in-artificial-intelligence/)
16. **Computational Creativity & Kuhn** — arXiv 2025. [arXiv:2504.18687](https://arxiv.org/pdf/2504.18687)
