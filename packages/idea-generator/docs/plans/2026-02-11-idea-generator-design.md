# Idea-Generator 设计分析报告

> 三方 Agent Team 会商综合报告 (Claude Opus + Gemini 3 Pro + GPT-5.3 Codex)
>
> 日期: 2026-02-11 | 生态圈: HEP-Autoresearch M82+
>
> 更新 (2026-02-12): 架构规格 SSOT 迁移到 `docs/plans/2026-02-12-idea-generator-architecture-spec.md`；IdeaSearch/OpenClaw 深读见 `docs/plans/2026-02-12-ideasearch-openclaw-deep-dive.md`；本文保留为 2026-02-11 会商综合报告。

---

## 目录

1. [现状诊断：已有工具与缺口](#1-现状诊断已有工具与缺口)
2. [外部前沿调研](#2-外部前沿调研)
3. [架构方案比较与推荐](#3-架构方案比较与推荐)
4. [推荐方案详解：混合架构](#4-推荐方案详解混合架构)
5. [Idea 生成管线设计](#5-idea-生成管线设计)
6. [新颖性评估体系](#6-新颖性评估体系)
7. [与现有生态圈的集成策略](#7-与现有生态圈的集成策略)
8. [多领域扩展设计](#8-多领域扩展设计)
9. [溯源与可追溯性](#9-溯源与可追溯性)
10. [分阶段实施路线图](#10-分阶段实施路线图)
11. [风险分析与缓解](#11-风险分析与缓解)
12. [方案对比总表](#12-方案对比总表)
13. [Agent Team 会商记录](#13-agent-team-会商记录)
14. [参考文献](#14-参考文献)

---

## 1. 现状诊断：已有工具与缺口

### 1.1 可直接复用的能力 (~60%)

| 能力 | 现有组件 | 复用方式 |
|------|---------|---------|
| 文献检索 | INSPIRE MCP (14 工具) + Semantic Scholar | 直接调用进行先验检索和新颖性检查 |
| 粒子数据 | PDG MCP (8 工具) | 实验输入/实验约束/张力/反常识别 |
| 文献管理 | Zotero MCP (7 工具) | 参考文献管理和导出 |
| 文献缺口分析 | Phase C1 (`literature_survey.py`) | 作为种子源之一消费其输出 |
| 方法设计脚手架 | Phase C2 (`method_design.py`) | idea 通过 A0 后下游消费 |
| 通用计算 DAG | W_compute (`w_compute.py`) | 最终执行计算 |
| 多 Agent 团队 | review-swarm + research-team | 复用收敛门禁模式用于 idea 评审 |
| 审批门禁 | A1-A5 系统 | 新增 A0 门禁，复用现有基础设施 |
| 知识库 | KB (25 篇笔记 + methodology traces + priors) | 双向读写 |
| 自演化 | L1-L3 框架 | 接入 idea 成功/失败信号 |
| 产物契约 | manifest + summary + analysis 三件套 | idea 产物遵循同一模式 |
| 审计账本 | append-only ledger | idea 事件追加到账本 |

### 1.2 需要新建的核心能力 (~40%)

| 能力 | 说明 | 现有生态中的最近邻 |
|------|------|-----------------|
| **Idea 搜索引擎** | BFTS/MCTS 树搜索，发散-收敛循环 | 无（C1 是线性的 discover→analyze） |
| **新颖性评估管线** | 4 层渐进式新颖性检查 | 部分（INSPIRE 检索可用，但缺评估逻辑） |
| **Elo/锦标赛排名** | 多 idea 竞争排序 | 无 |
| **Idea Store** | append-only idea 存储 + IdeaCard schema | 无 |
| **溯源图 (Provenance DAG)** | claim 级别证据链 | 部分（ledger 有事件追踪，但无 DAG） |
| **种子生成器** | 张力/反常/跨域/参数化种子 | 部分（C1 gap 种子可用） |
| **评审 rubric** | idea 专用 5 维评分框架 | 部分（referee-review 可适配） |
| **Domain Pack 插件** | HEP 本体/提示词/可行性估算器 | 无 |
| **idea-generator skill** | hepar 适配器 | 无 |
| **A0 审批门禁** | idea 审批逻辑 | 可基于现有 A1 扩展 |

### 1.3 关键洞察

三方 Agent 一致认为：**idea 生成是随机搜索/回溯过程，与现有确定性 DAG 工作流有根本不同的生命周期动力学。** 将其强行塞入线性工作流模型要么会削弱搜索能力，要么需要大量特例处理。

---

## 2. 外部前沿调研

### 2.1 关键系统对比

| 系统 | 核心创新 | 与我们的关系 |
|------|---------|------------|
| **AI Scientist v2** (Sakana, 2025) | Agentic Tree Search (BFTS)，文献整合 ideation，4 阶段实验 | 树搜索策略可借鉴；首个 AI 生成论文通过同行评审 |
| **AI-Researcher** (HKU, NeurIPS 2025) | 发散-收敛发现框架，多维评估 Agent | 发散-收敛结构和多 Agent 评估可复用 |
| **Google AI Co-Scientist** (2025) | 基于文献的假说生成，Elo 自动评估 | Elo 排名和测试时间计算缩放思路 |
| **PhysMaster** (2025) | 理论物理自主 Agent，MCTS + LANDAU 知识库 | LANDAU 三层知识库与我们的 KB 高度同构；MCTS 调度可参考 |
| **Chain of Ideas** (EMNLP 2025) | 主题多样性和新颖性自动度量 | 新颖性评估指标可借鉴 |
| **KG-CoI** (2025) | 知识图谱约束的 idea 生成 + 幻觉检测 | 基于 KG 的 grounding 验证器，非生成器 |
| **HypoGeniC** (Chicago HAI) | 文献+数据整合假说生成 | 数据驱动 + 文献驱动的融合思路 |
| **AgenticHypothesis** (ICLR WS 2025) | 多 Agent + 迭代精炼 + 评估 | 综合调查框架参考 |

### 2.2 共识趋势

1. **多 Agent 协作**成为标准：独立评审+辩论比单 Agent 更可靠
2. **文献整合 ideation** 取代纯参数化生成：在生成过程中实时查询文献
3. **树搜索/beam search** 优于平面 brainstorm：可控探索深度
4. **Elo/tournament** 排名逐渐标准化：比简单加权评分更鲁棒
5. **证据 grounding** 是核心挑战：幻觉问题在科学领域尤为严重

---

## 3. 架构方案比较与推荐

### 3.1 四方案对比（三方 Agent 一致分析）

| 准则 | A: 纯独立服务 | B: 新工作流 (W_idea) | C: 纯 Skill | **D: 混合架构** |
|------|-------------|-------------------|------------|--------------|
| **耦合度** | 无——但失去 KB/门禁访问 | 高——绑定 hepar 内部 | 中——薄但逻辑嵌入提示词 | **低核心耦合，薄适配器** |
| **跨域复用** | 优秀 | 差——hepar 专用 | 差——Claude 专用 | **核心优秀，HEP 适配器薄** |
| **开发速度** | 慢（需构建所有集成） | 初期快，后期技术债 | 初期快，天花板快到 | **中等起步，持续高速** |
| **维护负担** | 独立代码库 | 与编排器纠缠 | 提示词漂移风险 | **边界清晰，可测试** |
| **领域扩展** | 容易 | 需改编排器 | 需重写 skill | **核心插件架构** |
| **证据优先合规** | 需重新实现 | 继承 | 继承 | **核心强制，适配器映射** |

### 3.2 三方共识：推荐方案 D（混合架构）

> **Verdict (三方一致)**: 构建**独立的 `idea-core` 引擎**，通过严格的 artifact 契约与生态圈交互，以 `C0/C3/W_idea` 阶段形式暴露给编排器，通过新的 `A0` 审批门禁控制 idea 晋升。

---

## 4. 推荐方案详解：混合架构

### 4.1 组件边界

```
┌─────────────────────────────────────────────────────────────┐
│                    Human / hepar 编排器                       │
│                                                              │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌────────────┐  │
│  │ A0 Gate  │  │ A1..A5   │  │ L1-L3    │  │ KB Manager │  │
│  │ (新增)    │  │ Gates    │  │ 自演化    │  │            │  │
│  └────┬─────┘  └──────────┘  └─────┬────┘  └─────┬──────┘  │
└───────┼────────────────────────────┼──────────────┼─────────┘
        │                            │              │
        ▼                            ▼              ▼
┌───────────────────────────────────────────────────────────┐
│              idea-generator skill (薄适配器)                │
│  ┌──────────────────────────────────────────────────────┐ │
│  │  hepar 命令 ↔ idea-generator API 翻译               │ │
│  │  KB notes → seed 上下文映射                          │ │
│  │  已批准 ideas → C2 Method Design 路由               │ │
│  └──────────────────────────────────────────────────────┘ │
└──────────────────────────┬────────────────────────────────┘
                           │ JSON / stdio
                           ▼
┌──────────────────────────────────────────────────────────────┐
│              idea-core (独立引擎)                               │
│                                                                │
│  ┌─────────┐  ┌──────────┐  ┌──────────┐  ┌──────────────┐  │
│  │ Ideation │→│ Ground   │→│ Evaluate │→│ Rank/Select  │   │
│  │ Engine   │  │ & Verify │  │ (多Agent) │  │ (Elo + Gate) │  │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘  └──────┬───────┘  │
│       │              │              │               │           │
│  ┌────┴──────────────┴──────────────┴───────────────┴────────┐│
│  │              Idea Store (append-only, JSONL)               ││
│  │              + Provenance Graph (DAG)                       ││
│  └────────────────────────────────────────────────────────────┘│
│       │              │                                         │
│  ┌────┴────┐    ┌────┴─────┐                                  │
│  │ Domain  │    │ Strategy │  ← 按领域加载                      │
│  │ Packs   │    │ Plugins  │  (HEP, 凝聚态, ...)              │
│  └─────────┘    └──────────┘                                   │
└──────────────────────────────────────────────────────────────┘
        │                    │
        ▼                    ▼
  MCP 工具层            外部 API
  (INSPIRE, PDG,        (Semantic Scholar,
   Zotero, KB)           OpenAlex)
```

### 4.2 五大组件职责

| 组件 | 职责 | 核心约束 |
|------|------|---------|
| `idea-core` | 生成/搜索/评估/排名/溯源逻辑 | **零 hepar 依赖**；artifact-first |
| `idea-domain-pack-hep` | HEP 本体、查询模板、可行性启发式、方法蓝图 | 可独立安装 |
| `idea-adapter-orchestrator` | 映射 run manifest/gates/artifacts 到 core 契约 | 薄层，~200 行 |
| `idea-adapter-mcp` | 调用 INSPIRE/PDG/Zotero/KB 工具，归一化证据载荷 | 处理工具命名漂移 |
| `idea-skill` | 操作员界面：campaign 启动、分支分诊、手动覆盖 | 非 SSOT；仅交互便利 |

### 4.3 产物契约（SSOT Artifacts）

核心引擎产出 9 类 JSON 产物：

| 产物 | 用途 |
|------|------|
| `idea_campaign_v1.json` | 领域、目标、约束、预算、种子源 |
| `idea_seed_pack_v1.json` | 来自 C1/KB/anomaly/用户的归一化种子 |
| `idea_candidates_v1.jsonl` | 候选 ideas，含 parent/branch 谱系 |
| `idea_evidence_graph_v1.json` | claim 级别证据链接和置信度 |
| `idea_novelty_report_v1.json` | 先验艺术邻居、重叠度量、folklore 风险 |
| `idea_scorecards_v1.json` | 5 维评分 + 不确定度 |
| `idea_tournament_v1.json` | 配对结果、Elo 轨迹、裁定说明 |
| `idea_selection_v1.json` | 晋升/暂存/拒绝 + 理由 |
| `idea_handoff_c2_v1.json` | C2 就绪规格（问题、假说、可观测量、计算草图） |

---

## 5. Idea 生成管线设计

### 5.1 推荐策略：基于证据的混合树搜索

融合最强要素：
- AI Scientist v2 的**树搜索**用于系统探索
- AI-Researcher 的**发散-收敛**用于阶段纪律
- KG-CoI 的**知识图谱 grounding** 用于幻觉预防
- HypoGeniC 的**数据整合**用于张力驱动 ideas

### 5.2 六阶段管线

```
阶段 1: SEED (发散)
│
├── 文献缺口种子 ←── C1 输出（现有）
├── 张力/反常种子 ←── PDG + 实验数据 vs. 理论
├── 跨域种子 ←── 嵌入相似度跨子领域
├── 参数化种子 ←── LLM brainstorm（标记为未 grounded）
│
▼
阶段 2: EXPAND (树搜索)
│
│  对每个种子，展开为具体研究问题
│  使用 BFTS (Best-First Tree Search):
│
│  root: 种子 idea
│  ├── child_1: 具体表述 A
│  │   ├── grandchild_1a: 计算方法
│  │   └── grandchild_1b: 解析方法
│  ├── child_2: 具体表述 B
│  └── child_3: 具体表述 C
│
│  展开算子: LLM 对每个节点生成 N 个子节点
│  选择: score(novelty, feasibility, impact) → 最优优先
│  终止: max_depth=4, max_nodes=50/seed, 时间预算
│
▼
阶段 3: GROUND (收敛)
│
│  对每个叶节点（具体 idea）:
│  ├── INSPIRE 检索: 找到 5 篇最接近的现有论文
│  ├── Semantic Scholar: 引用上下文分析
│  ├── PDG 查找: 相关实验约束
│  ├── KB 检查: 现有知识库是否已覆盖？
│  └── 溯源标注: 每个 claim 标记为
│      {literature_grounded, data_grounded, llm_inferred, gap_derived}
│
▼
阶段 4: EVALUATE (多 Agent)
│
│  独立评分 (≥2 agents: Claude + Gemini):
│  ├── 新颖性 [0-10] + 理由 + 先验引用
│  ├── 可行性 [0-10] + 资源估计
│  ├── 影响力 [0-10] + 受影响子领域
│  ├── 可追踪性 [0-10] + 预估人月
│  └── 证据扎实度 [0-10] + 未 grounded claim 数
│
│  收敛门禁: agents 须在每维 ±2 内一致
│  否则进入结构化辩论 (最多 3 轮)
│
▼
阶段 5: RANK & SELECT
│
│  ├── Elo 锦标赛: 配对比较（新鲜 LLM judge）
│  ├── Pareto 前沿: 在 (novelty, feasibility) 上非支配 ideas
│  ├── 投资组合构建: 跨子领域/方法多样化
│  └── → A0 Gate: 人类审查 top-K ideas（带完整溯源）
│
▼
阶段 6: HANDOFF
│
│  已批准 ideas → IdeaCard (结构化输出)
│  IdeaCard → C2 Method Design → W_compute run_card
```

### 5.3 BFTS 评分函数

```
score(node) = 0.30 × novelty_estimate
            + 0.20 × feasibility_estimate
            + 0.20 × impact_estimate
            + 0.15 × tractability_estimate
            + 0.15 × grounding_score
            - overlap_penalty
            + exploration_bonus
```

**`exploration_bonus` 必须非零**以避免模式坍缩到保守 ideas。权重通过 domain pack 可配置。

### 5.4 IdeaCard Schema（idea 的 SSOT）

```yaml
idea_id: "idea-2026-001"
version: 1
status: "proposed"  # proposed | evaluating | approved | rejected | executing | completed

# ── 核心内容 ──
title: "暗光子产生中核跃迁的单圈修正"
abstract: |
  计算 M1 核磁跃迁中暗光子发射的完整 NLO QED+BSM 修正，
  解决理论预测与 ATOMKI 反常测量之间 O(10%) 的张力。

research_questions:
  - "NLO 修正对 M1 跃迁率的量级是多少？"
  - "圈修正能否移动预测的不变质量峰值？"

# ── 溯源 ──
seeds:
  - type: "tension"
    source: "PDG:dark_photon_limits vs ATOMKI:2023"
    description: "8Be 跃迁中持续的 6.8σ 反常"
  - type: "literature_gap"
    source: "C1:gap-2026-003"
    description: "该过程不存在完整 NLO 计算"
  - type: "llm_inferred"
    model: "claude-opus-4-6"
    prompt_hash: "sha256:abc123..."
    confidence: "medium"
    description: "核形状因子效应可能比假设的更大"

parent_ideas: []
child_ideas: []

# ── 评估 ──
scores:
  novelty: {value: 8, justification: "...", prior_art: [...]}
  feasibility: {value: 7, justification: "...", resources: {compute_hours: 50}}
  impact: {value: 9, justification: "..."}
  tractability: {value: 7, justification: "..."}
  grounding: {value: 8, ungrounded_claims: 1}

evaluation_agents: [...]
convergence: {achieved: true, rounds: 1}
elo_rating: 1847
pareto_rank: 2

# ── 审批 ──
approval: {gate: "A0", status: "pending"}

# ── 下游链接 ──
method_design: null   # → C2 输出
run_card: null        # → W_compute run_card
results: null         # → 计算结果
```

---

## 6. 新颖性评估体系

### 6.1 四层渐进式新颖性管线

```
层 1: 词汇去重 (快速, 低成本)
│  ├── TF-IDF 或 BM25 匹配 INSPIRE 标题+摘要语料
│  ├── 阈值: top-1 相似度 > 0.85 → 标记"可能已存在"
│  └── 成本: ~10ms/idea
│
▼
层 2: 语义相似度 (中等成本)
│  ├── SPECTER2/SciBERT 嵌入
│  ├── k-NN 搜索 (k=20)
│  ├── 对每个邻居: LLM 判断重叠度
│  └── 成本: ~$0.02/idea
│
▼
层 3: 结构化先验检索 (较高成本, 高精度)
│  ├── INSPIRE 构造查询 (关键词/引用/作者)
│  ├── top-10 结果: LLM 全摘要比较
│  └── 成本: ~$0.10/idea
│
▼
层 4: 多 Agent 新颖性辩论 (最高成本, 仅 top 候选)
│  ├── Agent A (Claude): 论证新颖性，引用先验空白
│  ├── Agent B (Gemini): 论证非新颖，引用潜在重叠
│  ├── Judge Agent: 评估论点，给出最终新颖性分数
│  ├── 特殊提示: "考虑未发表但众所周知的结果"
│  └── 成本: ~$0.50/idea
```

### 6.2 处理"众所周知但未发表"问题

这是最难的问题。**三方 Agent 一致的缓解措施**:

1. **会议论文搜索**: arXiv 有大量 proceedings，INSPIRE 索引会议报告
2. **引用上下文分析**: "众所周知"的结果常在综述文章中被随口提及
3. **LLM 参数化知识 + 校准**: 询问 LLM "这是否是社区共识？"；与结构化检索交叉验证
4. **社区启发式**: 如果 ≥3 个独立 LLM agents 都说"已知"，即使无具体引文也视为"可能已知"
5. **folklore_risk 评分**: 高风险需要 A0 门禁人类明确签字
6. **教科书/讲义摄入** (Gemini 特别建议): 包含"标准模型一致性检查"步骤

### 6.3 新颖性标签输出

`incremental` | `adjacent-novel` | `high-novel` | `speculative-high-risk`

---

## 7. 与现有生态圈的集成策略

### 7.1 集成地图

```
                    ┌──────────────┐
                    │ idea-generator │
                    │     core       │
                    └───────┬────────┘
                            │
              ┌─────────────┼─────────────┐
              │             │             │
              ▼             ▼             ▼
    ┌─────────────┐ ┌────────────┐ ┌───────────┐
    │  读取来源    │ │  写入目标   │ │  触发下游   │
    ├─────────────┤ ├────────────┤ ├───────────┤
    │ KB (25 笔记) │ │ KB (idea   │ │ C2 Method │
    │ C1 gap 列表 │ │  笔记)     │ │  Design   │
    │ PDG 数据    │ │ Idea Store │ │ W_compute │
    │ INSPIRE API │ │ Provenance │ │ A0 门禁    │
    │ L1 记忆     │ │  Graph     │ │ L1 记忆    │
    │ 历史 ideas  │ │ Elo 评级   │ │           │
    └─────────────┘ └────────────┘ └───────────┘
```

### 7.2 各组件集成契约

#### C1 (Literature Gap) → idea-generator

**关系: 互补，非替代。** C1 保持为系统性缺口发现者。idea-generator 消费 C1 输出作为种子源之一。

```
C1 输出: gap_analysis.json (gap_id, description, evidence, severity)
     ↓ 适配器转换
idea-generator 输入: IdeaSeed {
  seed_type: "literature_gap",
  source_id: "C1:gap-2026-003",
  context: "...",
  evidence: [...],
  priority_hint: float
}
```

#### idea-generator → C2 (Method Design)

**交接协议: IdeaCard → idea_handoff_c2_v1.json**

必要字段 (Codex 特别强调):
- `idea_id`, `branch_id`, `thesis_statement`
- `testable_hypotheses[]`
- `required_observables[]`
- `candidate_formalisms[]` (如 EFT/lattice/perturbative/QCD sum-rule)
- `minimal_compute_plan[]` (含预估运行时间量级)
- `risk_register[]`, `evidence_uris[]`

**非直接对接 W_compute**: ideas 必须经过 C2 验证才能触达 W_compute。

```
idea-generator →[A0 gate]→ C2 Method Design →[A2 gate]→ W_compute
```

#### 审批门禁: A0

**新增门禁，位于 A1 之前**:

```
门禁层次结构 (更新):
  A0.1: Campaign charter (范围/预算)     ← 新
  A0.2: Idea promotion (C2 之前)          ← 新
  A1: mass_search (大规模检索)
  A2: code_changes (代码变更)
  A3: compute_runs (计算运行)
  A4: paper_edits (论文编辑)
  A5: final_conclusions (最终结论)
```

#### 自演化集成 (L1-L3)

```
L1 (记忆):
  - 存储: 哪种种子类型产出了被批准的 ideas
  - 存储: 哪些 ideas 被拒绝及原因
  - 存储: 评估校准数据 (agent 评分 vs. 人类决策)

L2 (策略提案):
  - 分析 L1 模式: "张力型种子产出批准 ideas 的概率是参数化的 3 倍"
  - 提案: 调整种子权重、修改评分函数权重
  - 提案: 基于成功模式添加新种子源

L3 (代码自修改):
  - 自动调优 BFTS 参数 (基于批准率)
  - 添加新的 domain plugins
  - 修改评估 rubrics (基于校准数据)
```

---

## 8. 多领域扩展设计

### 8.1 Domain Pack 插件接口

```python
class DomainPlugin(ABC):
    @abstractmethod
    def get_seed_sources(self) -> List[SeedSource]:
        """返回该领域可用的种子生成器"""

    @abstractmethod
    def get_evaluation_rubric(self) -> EvaluationRubric:
        """返回领域特定评分标准和权重"""

    @abstractmethod
    def get_feasibility_checker(self) -> FeasibilityChecker:
        """返回计算可行性估算器"""

    @abstractmethod
    def get_concept_ontology(self) -> ConceptOntology:
        """返回领域概念层次结构（用于跨域交叉授粉）"""

    @abstractmethod
    def get_prompt_templates(self) -> Dict[str, str]:
        """返回管线各阶段的领域专用提示词模板"""

    def get_tree_search_params(self) -> TreeSearchParams:
        """领域专用 BFTS 调优参数"""
        return TreeSearchParams.default()

    def get_prior_art_sources(self) -> List[PriorArtSource]:
        """领域专用文献数据库"""
        return [InspireSource()]
```

### 8.2 扩展点（Codex 建议仅保留 4 个初始扩展点）

| 扩展点 | 说明 | HEP 实现 |
|--------|------|---------|
| `seed_enrichers` | 种子丰富化 | INSPIRE + PDG + ATOMKI tensions |
| `query_expanders` | 查询扩展 | HEP 术语本体 + arXiv 分类 |
| `feasibility_estimators` | 可行性估算 | FeynCalc/LoopTools 可用性检查 |
| `method_compilers` | 方法编译 | QFT/EFT/lattice 蓝图 → run_card |

### 8.3 原则

1. **先深度，后广度**: HEP 插件必须*出色*才考虑添加凝聚态。接口应从 HEP 实现中涌现。
2. **提示词是主要知识载体**: 多数物理知识存在于 LLM 提示词模板中。
3. **共享评估框架**: 5 维评分 (novelty/feasibility/impact/tractability/grounding) 跨领域通用，仅 rubric 细节变化。
4. **跨域种子是核心特性，非插件特性**: `cross_domain_seed_generator` 接收两个 `ConceptOntology` 实例寻找类比。

---

## 9. 溯源与可追溯性

### 9.1 Claim 级别溯源（非 idea 级别）

每个 claim 存储:

```json
{
  "claim_id": "uuid",
  "claim_text": "NLO 修正量级为 O(10%)",
  "support_type": "literature | derived | transfer | parametric",
  "source_uri": ["inspire:2301.12345", "pdg:dark_photon"],
  "support_strength": 0.85,
  "uncertainty": 0.15,
  "llm_contribution": {
    "model": "claude-opus-4-6",
    "prompt_hash": "sha256:...",
    "timestamp": "2026-02-11T10:00:00Z"
  }
}
```

### 9.2 Provenance Graph (JSONL DAG)

不使用图数据库（v1）。使用 JSONL 邻接表:

```jsonl
{"id": "prov-001", "type": "paper", "data": {"inspire_id": "2301.12345"}}
{"id": "prov-002", "type": "gap", "data": {"gap_id": "C1:gap-2026-003"}, "edges": [{"target": "prov-001", "rel": "derived_from"}]}
{"id": "prov-003", "type": "seed", "data": {"seed_type": "literature_gap"}, "edges": [{"target": "prov-002", "rel": "inspired_by"}]}
{"id": "prov-004", "type": "idea_node", "data": {"depth": 0}, "edges": [{"target": "prov-003", "rel": "expanded_from"}]}
```

可用 `jq` 查询，可用 git 版本控制，以后可升级到图存储。

### 9.3 端到端审计链

```
论文/缺口证据 → idea claim → 选中 idea
→ C2 方法规格 → W_compute run_card → 计算产物
→ 结果摘要 → 反馈到 L1/L2/L3
```

### 9.4 Ledger 事件（追加到现有 ledger.jsonl）

```
idea.campaign_started, idea.generated, idea.evidence_attached,
idea.novelty_assessed, idea.rank_updated, idea.promoted,
idea.rejected, idea.handoff_c2, idea.compute_started,
idea.result_closed
```

---

## 10. 分阶段实施路线图

### Phase 0: 基础契约

- 定义所有 JSON schemas (IdeaCard, 9 类产物)
- 实现 A0 门禁逻辑
- 最小 C0/W_idea wrapper
- 交付: 手动创建 ideas 可流入 C2

### Phase 1: MVP 生成 + Grounding

- IdeaCard schema + Idea Store (JSONL)
- Provenance graph (JSONL DAG)
- 种子生成器:
  - C1 gap 适配器
  - 参数化 brainstorm (LLM + HEP 提示词)
- 平面展开（暂无树搜索）
- INSPIRE grounding 管线
- 单 Agent 评估 (Claude, 5 维)
- idea-generator skill (基础 hepar 集成)
- **交付**: 从 5 个种子生成 20 个 ideas，top-5 呈现给人类审查者
- **验证**: 至少 1 个 idea 被领域专家批准为"值得追求"

### Phase 2: 深度搜索 + 多 Agent 评估

- BFTS 树搜索
- 多 Agent 评估 (Claude + Gemini, 收敛门禁)
- Elo 锦标赛排名
- 张力/反常种子生成器 (PDG + 实验数据)
- 4 层新颖性管线
- KB 回写 (idea 笔记)
- L1 记忆集成
- C2 交接 (已批准 ideas → 方法设计)
- **交付**: 完整管线 seeds → 树搜索 → 评估 → 排名 → A0 → C2
- **验证**: 端到端: idea 生成 → 批准 → C2 方法规格 → W_compute run_card

### Phase 3: 智能 + 扩展性

- 跨域种子生成器
- 嵌入索引 (SPECTER2) 用于语义新颖性
- Domain plugin 系统 (从 HEP 硬编码中抽取)
- L2/L3 自演化集成 (自动调优搜索参数)
- 投资组合构建 (多样化 idea 选择)
- 并行 idea 探索 (idea 分支)
- **交付**: 发现物理学家自己可能不会考虑的 ideas
- **验证**: 至少 1 个跨域 idea 被领域专家批准

### Phase 4: 生产成熟度

- 第二领域插件 (凝聚态或天体物理)
- MCTS/evolutionary 搜索替代
- 校准系统 (预测 vs. 结果对比)
- 批量 ideation 模式 (每周 idea 报告)
- 仪表板/可视化

---

## 11. 风险分析与缓解

| 风险 | 可能性 | 影响 | 缓解 |
|------|--------|------|------|
| **LLM 幻觉产生貌似合理但错误的物理** | 高 | 致命 | 4 层新颖性检查 + grounding 阈值 + 对抗 Agent + A0 人类门禁 |
| **新颖性评估遗漏已有工作** | 高 | 高 | 保守方案: 标记不确定性; folklore 启发式; 人类审查者兜底 |
| **分支爆炸/计算消耗** | 中 | 高 | 硬预算 (max_nodes, 时间预算, $ 预算); 快速估计用于展开 |
| **"新颖但琐碎"的 ideas** | 高 | 中 | impact 评分维度; Elo 自然惩罚; 领域专家提示词 |
| **过早过度设计插件系统** | 中 | 中 | Phase 1-2 硬编码 HEP; Phase 3 才抽取插件接口 |
| **多 Agent 辩论退化为共识** | 中 | 低 | 结构化对抗提示; 显式 devil's advocate; temperature 变化 |
| **与 hepar 紧耦合** | 低 | 高 | 薄适配器 skill; core 零 hepar 导入; 通过 IdeaCard schema 通信 |
| **Agent 打分博弈** | 中高 | 中高 | 盲配对判断、角色分离、随机审计提示词 |
| **保守模式坍缩** | 中高 | 中 | exploration_bonus + 排名中的多样性约束 |

### 关键风险深入: 物理幻觉

这是 #1 风险。LLM 可以生成听起来正确但违反守恒律、规范不变性或已知实验约束的研究 idea。缓解分层:

1. **结构性**: 每个 idea 必须通过 GROUND 阶段
2. **评估性**: 可行性评分器显式检查: "能否表述为良定义的计算？"
3. **对抗性**: 多 Agent 评估中，一个 agent 显式提示: "寻找物理错误"
4. **人类兜底**: A0 门禁。系统呈现 ideas 为*提案*，非结论
5. **反馈**: 因物理错误被拒绝的 ideas 回馈 L1，允许系统学习常见失败模式

---

## 12. 方案对比总表

| 特性 | **我们的设计** | AI Scientist v2 | AI-Researcher | Co-Scientist | KG-CoI | PhysMaster |
|------|-------------|-----------------|---------------|-------------|--------|------------|
| **搜索策略** | BFTS + 发散-收敛 | BFTS | 发散-收敛 | 迭代精炼 | KG 引导 | MCTS |
| **Grounding** | 4 层渐进式 | 文献综述 | 文献 grounding | 文献+网络 | 知识图谱 | 文献+KB |
| **评估** | 多 Agent 5维 + Elo | 自动审稿 | 多 Agent 辩论 | Elo 锦标赛 | 一致性评分 | 奖励模型 |
| **领域特异性** | 插件架构 (HEP 首选) | ML 实验 | 通用科学 | 生物医学 | 通用 | 理论物理 |
| **溯源** | **claim 级 DAG** | 部分 (论文引用) | 部分 | 部分 | KG 谱系 | 轨迹记录 |
| **人类在环** | **A0 门禁 (强制)** | 可选 | 可选 | Elo 含人类 | 无 | 可选 |
| **幻觉缓解** | grounding 分数 + 对抗 Agent + 物理检查 | 实验验证 | 多 Agent 交叉检查 | 锦标赛过滤 | KG 一致性 | 数值验证 |
| **生态集成** | **深度 (KB, C1, C2, W_compute, L1-L3)** | 自包含 | 自包含 | 自包含 | 自包含 | 自包含 |
| **成本控制** | 预算上限 + 快速估计 | Token 限制 | 固定轮数 | 固定锦标赛 | 固定 KG 操作 | 固定管线 |

**核心差异化**: 我们不是构建一个独立的 idea 生成器，而是为**已有的研究自动化平台添加创造性智能**。这是一个根本不同的集成挑战，但回报是一个可以从 idea → 已发表结果的端到端系统。

---

## 13. Agent Team 会商记录

### 13.1 三方共识点

1. **架构选择**: 三方一致推荐 Option D (混合架构)
2. **管线结构**: 三方均建议多阶段发散-收敛 + 树搜索
3. **A0 门禁**: 三方一致建议新增 idea 审批门禁
4. **C1 关系**: 三方一致认为互补非替代
5. **溯源粒度**: 三方均强调 claim 级别/DAG 溯源
6. **Elo 排名**: 三方均推荐锦标赛/Elo 排名机制
7. **Domain Pack 插件**: 三方均建议插件化但从 HEP 硬编码开始

### 13.2 各方独到见解

**Claude (Opus):**
- 最详细的 IdeaCard YAML schema 设计（含完整示例）
- 强调 BFTS 树搜索的 4 大优势: depth/pruning/provenance/budget
- "idea 生成的生命周期与确定性 DAG 根本不同"这一关键洞察
- 最完整的代码目录结构设计

**Gemini (3 Pro):**
- 建议将 idea-core 实现为 **MCP Server** 而非纯 CLI
- "漏斗验证" (Funnel of Validity) 概念: 早期快速过滤以节省昂贵的深度验证计算
- **进化突变算子**: 对已知方法应用 "Change Metric"/"Apply to new Particle"/"Invert Assumptions"
- 强调异步生命周期: ideas 需要"发酵"
- 建议教科书/讲义摄入用于 folklore 检测

**Codex (GPT-5.3):**
- 最精细的**9 类产物契约**列表
- 独到的 `A0.1` (Campaign charter) + `A0.2` (Idea promotion) 双层门禁
- **晋升策略**: grounding ratio 低于阈值时禁止 A0.2
- 最详细的风险矩阵（8 项风险 + 缓解）
- 明确的"交接到 C2 的必需字段"清单
- `folklore_risk` 评分 + 专门的 `A0-folklore` 裁定流程

### 13.3 分歧点及决议

| 点 | Claude | Gemini | Codex | 决议 |
|----|--------|--------|-------|------|
| idea-core 形式 | CLI + Library | MCP Server | CLI + Library | **Phase 1: CLI; Phase 3+: 可选 MCP** |
| 初期搜索策略 | 平面 brainstorm → Phase 2 加树搜索 | 进化突变 + 树搜索 | 混合从一开始 | **Phase 1 平面, Phase 2 BFTS** |
| A0 细分 | 单层 A0 | 单层 A0 | 双层 A0.1+A0.2 | **采用 Codex 双层设计** |
| Embedding 需求 | Phase 2-3 | Phase 1 (必要) | Phase 1 optional | **Phase 1 optional, Phase 2 必需** |
| Schema 语言 | YAML | JSON | JSON | **JSON Schema (JSON), 可读视图用 YAML** |

---

## 14. 参考文献

### 14.1 核心系统

- [AI Scientist v2](https://arxiv.org/abs/2504.08066) (Sakana AI, 2025) - Agentic Tree Search
- [AI-Researcher](https://github.com/HKUDS/AI-Researcher) (HKU, NeurIPS 2025) - Divergent-Convergent Discovery
- [Google AI Co-Scientist](https://collimateur.uqam.ca/wp-content/uploads/sites/11/2025/03/2502.18864v1.pdf) (2025) - Elo-based hypothesis generation
- [PhysMaster](https://arxiv.org/abs/2512.19799) (2025) - Autonomous AI Physicist
- [Chain of Ideas](https://aclanthology.org/2025.findings-emnlp.477.pdf) (EMNLP 2025) - Topic diversity metrics
- [HypoGeniC](https://chicagohai.github.io/hypogenic-demo/) (Chicago HAI) - Literature+data hypothesis generation

### 14.2 调研与评估

- [Hypothesis Generation Survey](https://arxiv.org/abs/2504.05496) (2025) - LLM hypothesis generation taxonomy
- [AgenticHypothesis](https://openreview.net/forum?id=UeeyfR4CUg) (ICLR WS 2025) - Multi-agent hypothesis survey
- [TruthHypo](https://www.ijcai.org/proceedings/2025/0873.pdf) (IJCAI 2025) - Truthfulness benchmark
- [Agentic AI for Scientific Discovery](https://arxiv.org/abs/2503.08979) (2025) - Comprehensive survey

### 14.3 HEP 相关

- [LLM-Powered HEP Agents](https://arxiv.org/abs/2512.07785) (2025) - Snakemake + Agent architecture
- [AI-Driven Research in Physics](https://ui.adsabs.harvard.edu/abs/2024NatRP...6..546H) (Nature Reviews Physics, 2024)

### 14.4 KB 已有笔记（可直接支撑本项目）

- `recid-3090360-llm-powered-hep-agents.md` - Agent + workflow manager 分工
- `arxiv-2512.19799-physmaster.md` - MCTS + LANDAU 知识库架构
- `arxiv-2305.14325-multiagent-debate.md` - 多 Agent 辩论
- `arxiv-2308.00352-metagpt.md` - MetaGPT 框架
- `arxiv-2305.10601-tree-of-thoughts.md` - 思维树推理
- `arxiv-2005.11401-rag.md` - 检索增强生成
- `recid-2968660-agents-of-discovery.md` - 发现代理

---

## 附录: 是否应集成到 hep-autoresearch 还是独立开发？

### 推荐: 独立 repo + skill 桥接

| 考量 | 集成到 hep-autoresearch | 独立 repo + skill |
|------|------------------------|-------------------|
| **模块性** | 差 — 增加 orchestrator 复杂度 | 好 — 清晰边界 |
| **可测试性** | 中 — 需 hepar 环境 | 好 — 独立测试 |
| **跨域复用** | 差 — HEP 绑定 | 好 — 任何领域 |
| **部署灵活性** | 差 — 捆绑 | 好 — 独立或嵌入 |
| **开发速度** | 中 — 受 hepar 约束 | 好 — 独立迭代 |
| **生态集成深度** | 优秀 — 直接访问内部 | 良好 — 通过 skill/MCP |
| **维护负担** | 高 — 纠缠 | 低 — 各自演化 |

**结论: idea-generator 作为独立项目开发 (`idea-generator/`)，通过 skill + JSON 契约与 hep-autoresearch 桥接。这保持了强大的插拔能力，同时不牺牲集成深度。**

---

*本报告由 Claude Opus 4.6、Gemini 3 Pro Preview、GPT-5.3 Codex 三方独立分析后综合生成。所有建议均经交叉验证。*
