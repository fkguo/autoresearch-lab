# hep-mcp Deep Audit & Restructuring

> **作用**: 在 Phase 3 启动前，对 hep-mcp 做一次从零审视的架构审计。不预设 hep-mcp 必须
> 存在 — 完全拆分、大幅重构、甚至砍掉整个包都是可能的结论。评估每个组件在 2026 SOTA LLM
> 能力下是否仍有存在价值，产出为具体的重构方案（或替代方案），将直接影响整个项目的后续方向。
>
> **性质**: 这不是 REDESIGN_PLAN 中的 batch 实施，而是一次**架构审计**。产出可能是：
> 修订后的 Phase 3 设计、hep-mcp 的拆分/重组方案、甚至是替代 hep-mcp 的全新架构。
> 不直接写代码。
>
> **指导原则**: 项目尚未发布，无外部用户。2026 年的 frontier LLM（200K+ context,
> Claude Opus/Sonnet 4.6, GPT-5.2）已经非常强大。凡是 LLM 能力已经覆盖的、增加复杂度
> 但不增加实际价值的工程化，都应该砍掉。**不要被沉没成本束缚** — 即使某个模块花了大量
> 精力构建，如果它不再有意义，就应该删除。hep-mcp 98K LOC 本身不是成就，
> 如果 10K LOC 能做同样的事，那 88K 就是技术债。

## 前置状态

- **Phase 2**: 44/45 done, Phase 3 尚未开始
- **写作管线规模**: ~20 个 MCP 工具，~15 个 core/writing/ 模块
- **LLM 配置**: 三模式 (client/internal/passthrough)，环境变量驱动
- **最近 commit**: `3e9c768` (Phase 3 Batch 1 prompt)
- **测试基线**: 1156 TS tests

## 启动前必读

1. `serena:read_memory` — `architecture-decisions`、`style-and-conventions`
2. `CLAUDE.md` §全局约束（无向后兼容负担）
3. `packages/hep-mcp/CLAUDE.md`（Evidence-first I/O, Quality-first principle）
4. `docs/WRITING_RECIPE_DRAFT_PATH.md` + `docs/WRITING_RECIPE_CLIENT_PATH.md`

## 审计目标

### 核心问题

> 在 2026 年 frontier LLM（200K+ context, Claude Opus/Sonnet 4.6, GPT-5.2）的能力下，
> hep-mcp 中的每个组件是 **genuinely useful** 还是 **过度工程化**（增加复杂度但不增加
> 实际价值，或者 LLM 本身已经能做得更好）？
>
> 后续也构建了多个外部 skill（research-team, research-writer, paper-reviser, referee-review,
> hep-calc, deep-learning-lab 等），这些 skill 是否与 hep-mcp 内部的某些功能重叠？
> 重叠的部分是否应该从 hep-mcp 中移除？

### 具体审查维度

1. **N-best + Judge 架构**: 生成 N 个候选，由 judge 模型选择最佳
   - 对强模型是否仍有显著质量提升？
   - Judge 偏差（position bias, verbosity bias）是否抵消了收益？
   - 成本 × N 是否值得？

2. **章节碎片化 vs 整体生成**: 逐章节独立写 vs 全文一次生成
   - 连贯性损失有多大？
   - 长 context 模型是否已能处理完整论文？
   - 跨章节论证链如何保持？

3. **create_packet + submit 两步模式**: server 准备 prompt packet → client 生成 → submit 回 server
   - 这个模式是否仍需要？调用方 LLM 本身就能管理 prompting
   - 能否简化为单步 execute？

4. **client/internal/passthrough 三模式 → 统一为单模式**:
   - 项目尚未发布，无外部用户，无兼容负担
   - **决策方向已定**: 三模式合并为一种。审计需确定保留哪一种，以及如何清理另外两种的代码
   - 参考：MCP server 是工具层，不应自己调 LLM（反对 internal）；passthrough 无人使用（删除）

5. **refinement_orchestrator 作为 MCP 工具**: 编排逻辑暴露为工具
   - 编排决策应在 agent 层还是 server 层？

6. **Evidence 层**: evidence building, indexing, querying
   - 这部分是否仍是核心价值？（预判：是）
   - 是否需要调整以适应整体生成模式？

7. **质量门禁**: citation verification, LaTeX compilation, consistency checks
   - 确定性检查是否仍有价值？（预判：是）
   - 是否需要调整检查时机？

8. **hep-mcp 整体架构合理性**: 不局限于写作管线
   - 项目未发布，无外部用户，可以大幅调整
   - 工具层级（core/writing/research/...）的划分是否合理？
   - 哪些架构决策是早期遗留、在当前 LLM 能力下已不合适？
   - 工具数量（standard 79 / full 102）是否过多？哪些可以合并或删除？

9. **与外部 skill 的功能重叠**:
   - `research-writer` skill 已能 scaffold + 写作 RevTeX 论文 — 与 hep-mcp 写作管线重叠多少？
   - `paper-reviser` skill 已能内容修订 — 与 `refinement_orchestrator` / `revision_plan` 重叠？
   - `referee-review` skill 已能生成审稿意见 — 与 `submit_review` 重叠？
   - `research-team` skill 已有多 agent 写作协作 — 与 N-best + judge 理念重叠？
   - `hep-calc` skill 处理计算 — 与 computation evidence ingestion 的关系？
   - 重叠功能应该保留在 hep-mcp 还是移到 skill 层？原则是什么？

10. **"LLM 已经能做"的功能识别**:
    - 2026 SOTA LLM 已能直接处理哪些任务，不再需要 MCP server 端的复杂编排？
    - 例如：token budget planning（LLM 本身就知道如何分配篇幅）、
      outline generation（LLM 直接写大纲比 N-best+judge 更连贯）、
      section-level prompting（LLM 理解全文结构，不需要 server 拆分章节）
    - 这些功能的 server 端实现是否属于"用 2023 年的思路解决 2026 年的问题"？

## 审查方法

### Phase 1: 代码考古（理解现状）

逐一读取以下文件并理解其角色：

**写作工具注册**:
```
packages/hep-mcp/src/tools/registry.ts  — 搜索所有 hep_run_writing_* 工具
```

**核心写作模块**:
```
packages/hep-mcp/src/core/writing/
├── outlinePlanner.ts        — 大纲生成（N-best + judge）
├── outlineCandidates.ts     — 大纲候选
├── outlineJudge.ts          — 大纲评审
├── papersetPlanner.ts       — Paperset 规划
├── sectionCandidates.ts     — 章节候选生成
├── sectionJudge.ts          — 章节评审选择
├── submitSection.ts         — 章节提交
├── submitOutlinePlan.ts     — 大纲提交
├── submitReview.ts          — 审稿提交
├── submitRevisionPlan.ts    — 修订计划提交
├── submitPapersetCuration.ts — Paperset 提交
├── nbestJudgeSchemas.ts     — N-best judge schema 定义
├── reproducibility.ts       — 可复现性检查
└── integrateSections.ts     — 章节集成
```

**LLM 配置与客户端**:
```
packages/hep-mcp/src/tools/writing/llm/
├── config.ts                — getWritingModeConfig, client/internal 模式
├── types.ts                 — LLMClient 接口
├── clients/                 — 各 provider 客户端实现（7+ providers）
└── deepWriterAgent.ts       — Deep writer agent
```

**RAG / Evidence**:
```
packages/hep-mcp/src/tools/writing/rag/
├── llmReranker.ts           — LLM 重排序
├── evidencePacketBuilder.ts — Evidence packet 构建
└── types.ts
```

**验证器**:
```
packages/hep-mcp/src/tools/writing/verifier/
└── citationVerifier.ts      — 引用验证
```

**Deep Research Writer (Draft Path)**:
```
packages/hep-mcp/src/tools/writing/deepWriter/
├── writer.ts                — inspire_deep_research(mode=write) 实现
└── types.ts
```

**外部 skill（检查功能重叠）**:
```
skills/research-writer/SKILL.md   — RevTeX 论文 scaffold + 写作
skills/paper-reviser/SKILL.md     — 内容修订 + tracked changes
skills/referee-review/SKILL.md    — 审稿意见生成
skills/research-team/SKILL.md     — 多 agent 协作研究
skills/hep-calc/SKILL.md          — 计算复现/审计
```

### Phase 2: 使用模式分析

1. 读取 `docs/WRITING_RECIPE_DRAFT_PATH.md` 和 `docs/WRITING_RECIPE_CLIENT_PATH.md`
   - 理解两条路径的实际用户旅程
   - 识别哪些步骤是必经的、哪些是可选的

2. 读取测试文件，理解哪些写作功能有测试覆盖
   ```
   packages/hep-mcp/tests/writing/
   packages/hep-mcp/tests/core/
   ```

3. 统计工具调用链长度：一篇完整论文需要多少次工具调用？

### Phase 3: 2026 SOTA 能力评估 + 竞品对比

1. **2026 LLM 能力基线**:
   - Claude Opus/Sonnet 4.6, GPT-5.2 在学术写作上的实际能力
   - 200K+ context 能放下什么？（完整证据库？多篇论文？）
   - 结构化输出、工具调用、多步推理的可靠性
   - 搜索相关研究和基准测试

2. **竞品做法**:
   - 单次长 context 生成（如直接用 Claude/GPT 写论文）
   - RAG + 单次生成（如 Elicit, Consensus）
   - 多 agent 协作写作（如 AI Scientist, AIME）
   - 哪些有 N-best + judge？效果如何？

3. **本项目的外部 skill 已覆盖哪些能力**:
   - research-writer 已能做什么？与 hep-mcp Client Path 的对比
   - research-team 的多 agent 写作与 N-best+judge 哪个更有效？
   - 哪些功能应该从 hep-mcp 移到 skill 层？

### Phase 4: 输出重构方案

产出一份具体的重构提案，包含：

1. **保留清单**: 哪些模块/工具保留（附理由 — 必须是 LLM 做不好或不应做的）
2. **简化清单**: 哪些模块需要简化（附具体方案）
3. **删除清单**: 哪些模块应该删除（附理由 + 影响分析 — 重点标注"LLM 已能做"的）
4. **移至 skill 层清单**: 哪些功能应从 hep-mcp 移到外部 skill（附理由）
5. **新增清单**: 是否需要新增任何东西（如全文生成工具）
6. **LLM 配置方案**: 三模式统一为单模式（确定保留哪一种 + 清理方案）
7. **修订后的 NEW-06 设计**: 基于审计结论重新定义 NEW-06 的范围（可能远超原始 scope）
8. **hep-mcp 架构调整建议**: 超出写作管线的整体架构改进
9. **迁移路径**: 从当前状态到目标状态的步骤（可跨多个 batch）
10. **对 REDESIGN_PLAN 的影响**: 哪些 Phase 3 条目需要修改/新增/删除

## 约束

- **不写代码** — 这是审计和设计，不是实施
- **Evidence-first 不动** — evidence building/indexing/querying 是核心价值，不在审查范围
- **确定性检查不动** — LaTeX 编译、引用验证、一致性检查保留
- **Quality-first 原则** — 任何简化必须不降低学术写作质量
- **无向后兼容负担** — 可以 breaking change，不需要旧工具/模式保留
- **无外部用户** — 项目尚未发布，只有作者在用，可以大幅重构
- **不怕动大手术** — 如果 hep-mcp 的某些架构根基不合适，现在是调整的最佳时机
- **过度工程化即负债** — 凡是 2026 SOTA LLM 已经能直接做好的，server 端的复杂编排就是负债而非资产
- **Skill 层 vs MCP 层分工** — MCP server 应提供数据访问和确定性操作；编排逻辑和生成逻辑属于 agent/skill 层

## 输出物

| 文件 | 说明 |
|------|------|
| `meta/docs/writing-pipeline-audit-report.md` | 审计报告（Phase 1-3 发现） |
| `meta/docs/writing-pipeline-restructuring-proposal.md` | 重构提案（Phase 4） |
| `meta/REDESIGN_PLAN.md` | 修订 NEW-06 + 受影响的 Phase 3 条目 |
| `serena:write_memory` | 架构决策记录 |

## 审计完成后

1. 将重构提案作为 review packet 提交双模型审核（方案审核用 `gpt-5.2`，非代码审核）
2. 收敛后修订 REDESIGN_PLAN
3. 然后再启动 Phase 3 Batch 1（或调整 Batch 1 内容以适应新设计）
