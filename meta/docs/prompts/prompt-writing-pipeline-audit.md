# Writing Pipeline Deep Audit & Restructuring

> **作用**: 在 Phase 3 启动前，深入审查 hep-mcp 写作管线，评估哪些部分在当前 LLM 能力下
> 仍有价值、哪些过度工程化需要简化或删除。产出为具体的重构方案，将直接影响 NEW-06 的实施范围。
>
> **性质**: 这不是 REDESIGN_PLAN 中的 batch 实施，而是一次**架构审计**。产出是修订后的
> NEW-06 设计 + 可能的新 REDESIGN_PLAN 条目。不直接写代码。

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

> 在 2026 年 frontier LLM（200K+ context, Claude Opus/Sonnet 4.6, GPT-5）的能力下，
> 当前写作管线的每个组件是 **genuinely useful** 还是 **net negative**（增加复杂度、
> 降低连贯性、增加成本但不提升质量）？

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

4. **client/internal/passthrough 三模式**:
   - `internal` 模式的实际使用频率？是否有用户在用？
   - 是否应该统一为一种模式？
   - MCP server 自己调 LLM 是否违反 "MCP server 是工具层非 agent 层" 原则？

5. **refinement_orchestrator 作为 MCP 工具**: 编排逻辑暴露为工具
   - 编排决策应在 agent 层还是 server 层？

6. **Evidence 层**: evidence building, indexing, querying
   - 这部分是否仍是核心价值？（预判：是）
   - 是否需要调整以适应整体生成模式？

7. **质量门禁**: citation verification, LaTeX compilation, consistency checks
   - 确定性检查是否仍有价值？（预判：是）
   - 是否需要调整检查时机？

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
├── clients/                 — 各 provider 客户端实现
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

### Phase 3: 竞品/研究对比

回顾当前学术写作 AI 系统的做法：
- 单次长 context 生成（如直接用 Claude/GPT 写论文）
- RAG + 单次生成（如 Elicit, Consensus）
- 多 agent 协作写作（如 AI Scientist）
- 哪些有 N-best + judge？效果如何？

### Phase 4: 输出重构方案

产出一份具体的重构提案，包含：

1. **保留清单**: 哪些模块/工具保留（附理由）
2. **简化清单**: 哪些模块需要简化（附具体方案）
3. **删除清单**: 哪些模块应该删除（附理由 + 影响分析）
4. **新增清单**: 是否需要新增任何东西（如全文生成工具）
5. **LLM 配置方案**: client/internal/passthrough 三模式如何调整
6. **修订后的 NEW-06 设计**: 基于审计结论重新定义 NEW-06 的范围和目标
7. **迁移路径**: 从当前状态到目标状态的步骤（可跨多个 batch）
8. **对 REDESIGN_PLAN 的影响**: 哪些 Phase 3 条目需要修改/新增/删除

## 约束

- **不写代码** — 这是审计和设计，不是实施
- **Evidence-first 不动** — evidence building/indexing/querying 是核心价值，不在审查范围
- **确定性检查不动** — LaTeX 编译、引用验证、一致性检查保留
- **Quality-first 原则** — 任何简化必须不降低学术写作质量
- **无向后兼容负担** — 可以 breaking change，不需要旧工具保留

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
