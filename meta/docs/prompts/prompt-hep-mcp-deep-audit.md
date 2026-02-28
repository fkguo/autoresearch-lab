# hep-mcp Deep Audit & Restructuring

> **作用**: 在 Phase 3 启动前，对 hep-mcp 做一次从零审视的架构审计。不预设 hep-mcp 必须
> 存在 — 完全拆分、大幅重构、甚至砍掉整个包都是可能的结论。评估每个组件在 2026 SOTA LLM
> 能力下是否仍有存在价值，产出为具体的重构方案（或替代方案），将直接影响整个项目的后续方向。
>
> **性质**: 这不是 REDESIGN_PLAN 中的 batch 实施，而是一次**架构审计 + 双模型收敛审核**。
> 产出可能是：修订后的 Phase 3 设计、hep-mcp 的拆分/重组方案、甚至是替代 hep-mcp 的全新架构。
> 不直接写代码。
>
> **指导原则**: 项目尚未发布，无外部用户。2026 年的 frontier LLM（200K+ context,
> Claude Opus/Sonnet 4.6, GPT-5.2）已经非常强大。凡是 LLM 能力已经覆盖的、增加复杂度
> 但不增加实际价值的工程化，都应该砍掉。**不要被沉没成本束缚** — 即使某个模块花了大量
> 精力构建，如果它不再有意义，就应该删除。hep-mcp 98K LOC 本身不是成就，
> 如果 10K LOC 能做同样的事，那 88K 就是技术债。

## 前置状态

- **Phase 2**: 44/45 done, Phase 3 尚未开始
- **hep-mcp 规模**: 98K LOC TS, standard 79 tools / full 102 tools
- **写作管线占比**: core/writing 18.5K LOC + tools/writing 16.5K LOC = **35K LOC（36% of total）**
- **LLM 客户端基础设施**: 935 LOC, 7+ provider 客户端, 三模式 (client/internal/passthrough)
- **core/writing 模块数**: 37 个 `.ts` 文件
- **写作相关工具**: ~25 个（含 outline/section/judge/review/integrate/token 等）
- **最近 commit**: `f2d6add`
- **测试基线**: 1156 TS tests

### 外部 skill 已覆盖的能力

以下 skill 均**完全独立于 hep-mcp**（零 MCP 工具依赖），各自已形成完整工作流：

| Skill | 能力 | 与 hep-mcp 重叠 |
|-------|------|-----------------|
| `research-writer` | RevTeX 论文 scaffold + 可选节级起草 + hygiene 检查 | 重叠 hep-mcp Client Path 写作管线 |
| `paper-reviser` | 内容修订 + tracked changes + Codex 深度验证 | 重叠 `refinement_orchestrator` + `revision_plan` |
| `referee-review` | 离线审稿意见生成 | 重叠 `submit_review` |
| `research-team` | 双 agent 收敛研究 + 可复现 capsule | 理念上重叠 N-best+judge（多视角质量保证） |
| `hep-calc` | 符号/数值 HEP 计算 + FeynCalc/FeynArts | 互补 computation evidence ingestion |

### 外部 MCP server 已覆盖的能力

| MCP Server | 能力 | hep-mcp 中的角色 |
|------------|------|-----------------|
| `arxiv-mcp` | arXiv 搜索/元数据/源文件下载 | hep-mcp 聚合暴露（3 tools） |
| `pdg-mcp` | PDG 粒子数据离线查询 | hep-mcp 聚合暴露（9 tools） |
| `zotero-mcp` | Zotero Local API | hep-mcp 聚合暴露（7 tools） |
| `hepdata-mcp` | HEPData 测量数据 | hep-mcp 聚合暴露 |

## 启动前必读

1. `serena:read_memory` — `architecture-decisions`、`style-and-conventions`
2. `CLAUDE.md` §全局约束（无向后兼容负担）
3. `packages/hep-mcp/CLAUDE.md`（Evidence-first I/O, Quality-first principle）
4. `docs/WRITING_RECIPE_DRAFT_PATH.md` + `docs/WRITING_RECIPE_CLIENT_PATH.md`

## 预审结论（基于代码考古 + 能力对比）

以下是在审计启动前已形成的初步判断，审计需**验证、修正或推翻**这些判断。

### 预判：应删除的部分（~35K LOC, ~25 tools）

**写作生成管线（整体删除）** — 2026 SOTA LLM + research-writer skill 已完全覆盖：

| 模块/工具 | LOC | 删除理由 |
|-----------|-----|---------|
| N-best 候选 + Judge 选择（outline + section） | ~3K | 对 Opus 4.6 级模型收益递减；judge 有 position bias (~40%) + verbosity bias (~15%)；成本 ×N 不值得；research-team 双 agent 收敛是更好的多视角方案 |
| 章节碎片化写作（section candidates/write packets） | ~4K | 200K context 足以整篇生成；碎片化破坏叙事连贯性、论证链、符号一致性；research-writer 已支持整篇起草 |
| create_packet + submit 两步模式 | ~3K | LLM agent 自己管理 prompting 比 server 准备 packet 更灵活；该模式是 2023 年"LLM 需要精确引导"思维的遗产 |
| Token budget planning + gating | ~2K | 2026 LLM 原生理解篇幅分配，不需要 server 端的 token 预算强制 |
| `refinement_orchestrator` | ~1.5K | 编排逻辑属于 agent/skill 层；paper-reviser skill 已有更好的修订工作流 |
| `submit_review` / `revision_plan` | ~1.5K | referee-review + paper-reviser skill 已覆盖 |
| `outlinePlanner` / `outlineJudge` | ~2K | LLM 直接生成大纲比 N-best+judge 更连贯；大纲不是独立优化目标 |
| `papersetPlanner` / `papersetCuration` | ~1K | 论文集筛选是 LLM 已能直接完成的任务 |
| `deepWriter` / `deepWriterAgent` | ~1.5K | 生成逻辑不属于 MCP server |
| LLM 客户端基础设施（7 provider clients） | ~1K | MCP server 不应自己调 LLM；删除 internal + passthrough 模式 |
| Style corpus 工具（8 tools） | ~2K | 风格学习属于 skill 层（research-writer 已有 corpus learning） |
| `sectionQualityEvaluator` / `qualityPolicy` | ~1K | 质量评估由 LLM agent 直接判断 |
| `staging.ts` / `candidatePool.ts` | ~1K | 为两步提交模式服务的基础设施，随主体一起删除 |

**删除后估算**: 98K → ~60K LOC, 102 tools → ~65 tools

### 预判：应保留的部分（hep-mcp 真正的核心价值）

以下是 LLM **做不到或不应做**的确定性操作和数据访问：

| 类别 | 工具/模块 | 保留理由 |
|------|-----------|---------|
| **INSPIRE 数据访问** | `inspire_search`, `inspire_search_next`, `inspire_literature`, `inspire_resolve_citekey` | 唯一的 INSPIRE API 接口；LLM 无法直接查数据库 |
| **INSPIRE 高级研究** | `inspire_paper_source`, `inspire_research_navigator`, `inspire_critical_research`, `inspire_find_crossover_topics`, `inspire_analyze_citation_stance` | 结构化研究工具，调用 INSPIRE API + 本地分析 |
| **arxiv/pdg/zotero 聚合** | 19 tools (3+9+7) | 外部 MCP server 聚合，纯数据访问 |
| **Evidence 层** | `build_evidence`, `query_evidence`, `query_evidence_semantic`, `playback_evidence`, `build_pdf_evidence`, `build_evidence_index_v1` | 核心价值：BM25 索引、语义搜索、PDF 提取 — LLM 无法替代 |
| **Citation 验证** | `build_citation_mapping`, `citationVerifier`, `validate_bibliography` | 确定性验证：INSPIRE recid 解析、allowlist 检查 — 必须精确 |
| **Measurements** | `build_measurements`, `compare_measurements`, `build_writing_critical` | 数值提取 + tension 检测 — 确定性分析 |
| **Project/Run 状态** | `project_create/get/list`, `run_create`, `read_artifact_chunk`, `clear_manifest_lock`, `stage_content`, `health` | 状态管理 + artifact 存储骨架 |
| **Export/Import** | `export_project`, `export_paper_scaffold`, `import_paper_bundle`, `import_from_zotero` | 确定性打包 + LaTeX 编译 |
| **LaTeX 渲染 + 验证** | `render_latex`, `integrate_sections`, `parse_latex` | 确定性 LaTeX 处理 + 编译门禁 |
| **Skill 集成** | `ingest_skill_artifacts`, `create_from_idea` | 跨组件桥接 |
| **Evidence selection (RAG)** | `build_evidence_packet_section_v2`, `submit_rerank_result_v1`, `llmReranker` | BM25 + LLM rerank 是有价值的 RAG — **但需评估是否简化** |

### 预判：需要简化但保留的部分

| 模块 | 当前问题 | 简化方向 |
|------|---------|---------|
| `inspire_deep_research` | 太重的编排工具（mode=write 是整个 Client Path） | 拆分：数据收集保留，写作编排删除 |
| `integrate_sections` | 目前为碎片化写作服务 | 简化为 LaTeX 编译 + 验证门禁（不管内容怎么来的） |
| Evidence selection (RAG) | 为章节级写作设计的 evidence packet | 简化为通用 evidence retrieval（不绑定写作工具链） |
| `build_writing_evidence` | 名字暗示仅为写作服务 | 重命名为通用 evidence building |

### 预判：LLM 配置统一方案

**决定**: 删除 internal + passthrough 模式，仅保留 **client 模式**。

理由：
- MCP server 是**工具层**，不应自己调用 LLM（internal 模式违反这一原则）
- passthrough 模式无人使用
- client 模式 = 调用方 LLM 负责生成，MCP server 只提供数据 + 验证 — 这是正确的分层

**清理范围**:
- 删除 `packages/hep-mcp/src/tools/writing/llm/clients/` (7 provider 实现)
- 删除 `getWritingModeConfig()` 中的 internal/passthrough 分支
- 删除 `WRITING_LLM_PROVIDER`, `WRITING_LLM_MODEL` 等环境变量
- 删除 `deepWriterAgent.ts`

## 审计任务

### 任务 1: 验证预审结论

> **联网验证**: 对于涉及"2026 LLM 能否做 X"的判断，**必须联网搜索最新的基准测试、
> 论文和实践报告**来验证，不能仅凭模型训练数据中的旧知识。例如搜索
> "Best-of-N sampling frontier models 2025 2026"、"LLM academic writing benchmark"、
> "long context paper generation" 等。

逐一读取"应删除"清单中的每个模块源码，验证：

1. **确认无遗漏价值**: 该模块是否有某个子功能是有独立价值的（不应随整体删除）？
2. **确认 skill 层替代可行**: 对应的外部 skill 是否真正覆盖了该功能？
3. **确认 LLM 能力覆盖**: 2026 SOTA LLM 是否确实能直接做好这件事？**（联网搜索验证）**
4. **识别依赖影响**: 删除该模块后，保留模块是否有断裂的依赖？

对于"应保留"清单，验证：
1. **确认不可替代性**: LLM 确实做不到或不应做？**（联网搜索反例）**
2. **识别简化空间**: 保留模块中是否有为被删除模块服务的子功能？

### 任务 2: 产出重构方案

基于验证后的结论，产出具体方案：

1. **最终删除清单**: 模块名 + 文件路径 + 估算 LOC + 影响分析
2. **最终保留清单**: 模块名 + 保留理由（必须是 LLM 做不好的）
3. **简化清单**: 具体的简化方案（代码级）
4. **LLM 配置清理方案**: 统一为 client 模式的具体步骤
5. **工具合并方案**: 102 → 目标数量, 哪些工具可以合并
6. **重命名/重组方案**: 删除后的目录结构调整
7. **迁移路径**: 从当前状态到目标状态的实施步骤（可跨多个 batch）
8. **修订后的 REDESIGN_PLAN 影响**: 哪些 Phase 3 条目需要修改/新增/删除

### 任务 3: 重构方案双模型审核（GPT-5.2 + Gemini-3.1-pro-preview）

重构方案完成后，**必须**通过双模型收敛审核再定稿。

**审核模型**: 这是方案审核（非代码审核），使用：
- `gpt-5.2`（Codex CLI, `--model gpt-5.2`）
- `gemini-3.1-pro-preview`（Gemini CLI）

**审核流程**:

1. **准备 review packet**:
   ```
   ~/.autoresearch-lab-dev/batch-reviews/hep-mcp-audit-review-system.md  — system prompt
   ~/.autoresearch-lab-dev/batch-reviews/hep-mcp-audit-review-r1.md     — review packet
   ```

2. **Review packet 内容**:
   - 重构提案全文（保留/删除/简化清单 + 理由）
   - 关键审查点:
     - 删除清单中是否有误杀（有独立价值但被连带删除的功能）？
     - 保留清单中是否有遗漏（应该删除但被保留的功能）？
     - LLM 能力判断是否准确（是否高估了 2026 LLM 在某些任务上的能力）？
     - 迁移路径是否可行（依赖关系是否正确处理）？
     - 对项目整体研究能力的影响评估

3. **Review system prompt 必须包含联网验证要求**:
   ```
   你在审核一份 MCP server 架构重构提案。提案中的核心判断依赖于"2026 SOTA LLM 能否
   替代某功能"。你 **必须联网搜索** 最新的基准测试、研究论文和实践报告来验证这些判断，
   不能仅凭训练数据中的知识。特别是：
   - Best-of-N sampling / LLM-as-a-Judge 在强模型上的最新评测
   - 长 context 学术写作的最新能力边界
   - MCP server 架构的最新最佳实践
   如果你的搜索结果与提案中的判断矛盾，这是 BLOCKING finding。
   ```

3. **运行 review-swarm**:
   ```bash
   python3 skills/review-swarm/scripts/bin/run_multi_task.py \
     --out-dir ~/.autoresearch-lab-dev/batch-reviews/hep-mcp-audit-r{M}-review \
     --system ~/.autoresearch-lab-dev/batch-reviews/hep-mcp-audit-review-system.md \
     --prompt ~/.autoresearch-lab-dev/batch-reviews/hep-mcp-audit-review-r{M}.md
   ```
   注意: Codex 需要 `--model gpt-5.2` 覆盖默认的 `gpt-5.3-codex`（这是方案审核，不是代码审核）。

4. **收敛判定**: 遵循 `CLAUDE.md` §多模型收敛检查流程
   - 0 BLOCKING from both models = CONVERGED
   - 任一 BLOCKING → 修正后 R+1
   - 最大 5 轮

5. **收敛后**: 修订 REDESIGN_PLAN，更新 Phase 3 内容

## 原则与分工线

### MCP server 应该做什么（hep-mcp 的正确定位）

- **数据访问**: INSPIRE API, arXiv, PDG, Zotero, HEPData — 唯一接口
- **确定性操作**: LaTeX 编译、引用验证、BM25 索引、PDF 提取、数值比较
- **状态管理**: Project/Run 生命周期、artifact 存储、manifest 锁
- **Evidence 检索**: BM25 + semantic search + LLM rerank（RAG 管道）

### MCP server 不应该做什么（应在 agent/skill 层）

- **LLM 调用**: MCP server 不应内置 LLM 客户端或管理 LLM 生成
- **编排逻辑**: N-best 选择、修订循环、质量评分 — 属于 agent 决策
- **内容生成**: 大纲写作、章节写作、审稿意见 — 属于 LLM 直接能力
- **Token 预算**: LLM 自己管理篇幅分配，不需要外部约束
- **风格学习**: 属于 skill 层（research-writer 已有 corpus learning）

### 判断标准

对每个功能问三个问题：
1. **LLM 能否直接做？** → 如果是，删除 server 端实现
2. **外部 skill 是否已覆盖？** → 如果是，从 hep-mcp 移除
3. **是否需要确定性/精确性？** → 如果是（引用验证、LaTeX 编译），保留

## 约束

- **不写代码** — 这是审计和设计，不是实施
- **Quality-first 原则** — 任何简化必须不降低学术写作质量
- **无向后兼容负担** — 可以 breaking change，不需要旧工具/模式保留
- **无外部用户** — 项目尚未发布，只有作者在用，可以大幅重构
- **过度工程化即负债** — 凡是 2026 SOTA LLM 已经能直接做好的，server 端的复杂编排就是负债而非资产
- **Skill 层 vs MCP 层分工** — MCP server 应提供数据访问和确定性操作；编排/生成逻辑属于 agent/skill 层
- **双模型审核必须收敛** — 重构方案在 GPT-5.2 + Gemini 双模型审核收敛前不得定稿

## 输出物

| 文件 | 说明 |
|------|------|
| `meta/docs/hep-mcp-audit-report.md` | 审计报告（验证结果 + 发现） |
| `meta/docs/hep-mcp-restructuring-proposal.md` | 重构提案（最终方案，双模型收敛后） |
| `~/.autoresearch-lab-dev/batch-reviews/hep-mcp-audit-*` | 审核产物（system prompt, packets, reviews） |
| `meta/REDESIGN_PLAN.md` | 修订 Phase 3 + 受影响条目 |
| `serena:write_memory` | 架构决策记录 |

## 审计完成后

1. 双模型审核收敛 → 定稿重构提案
2. 修订 REDESIGN_PLAN（Phase 3 内容可能大幅调整）
3. 然后再启动 Phase 3 实施（Batch 1 内容可能需要调整以适应新设计）
