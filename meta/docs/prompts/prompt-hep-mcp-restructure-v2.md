# hep-mcp 完整重构：从头设计 + Codex 审核

> **用途**: 新 Claude Code 会话的启动 prompt
> **前置**: 已有深度审计 (R1-R4) + SOTA 调研。本次不是"继续修补"，而是**站在整个生态圈高度从头设计**。

## 背景

`packages/hep-mcp/` 是 98K LOC 的 MCP server。上一轮审计 (2026-03-01) 发现大量过度工程化问题——根因是 hep-mcp 在 skill 层出现之前设计，写作编排逻辑无处安放，累积在 MCP server 内。

上一轮产出了审计报告和重构提案，但那是**增量 patch 的产物** (R1→R4 四轮修正)，不是从头设计。每轮发现新问题就打补丁，缺乏全局一致性。

## 本次任务

### Phase A: 全量代码调研 + SOTA 验证

1. **读取上一轮材料**（作为输入，不作为约束）:
   - `meta/docs/hep-mcp-audit-report.md` — 审计报告（含 §7 post-audit corrections）
   - `meta/docs/hep-mcp-restructuring-proposal.md` — 重构提案 R4
   - `meta/REDESIGN_PLAN.md` — 总重构计划（搜索 NEW-06, NEW-MCP-SAMPLING, NEW-SKILL-WRITING）
   - `memory: hep-mcp-audit/session-handoff` — 上一轮会话交接

2. **全量代码审视** — 不要只看上一轮标记的文件。从 `packages/hep-mcp/src/` 根目录开始，自上而下理解：
   - 哪些模块是纯数据访问（INSPIRE API、PDG、Zotero、arXiv、HEPData）
   - 哪些模块是确定性操作（LaTeX 解析/渲染、evidence 提取、BM25 检索）
   - 哪些模块嵌入了 LLM 调用或编排逻辑（应移至 skill 层）
   - 哪些模块看似有价值但实际无调用者或设计有缺陷
   - `tools/registry.ts` 的每个工具注册——逐个判断保留/删除/合并

3. **SOTA 验证** — 对任何"LLM 能/不能做 X"的判断，联网搜索 2025-2026 最新研究：
   - 长文生成能力（EQ-Bench longform, WritingBench 最新排名）
   - Section-by-section vs single-shot 最新对比
   - MCP 架构最佳实践（sampling protocol 成熟度）
   - RAG vs long-context 最新成本/质量权衡
   - Agentic paper writing workflows（AI Scientist, LitLLM, XtraGPT 等）

4. **审视现有 skill 生态** — 理解已有能力覆盖：
   - `skills/research-writer/` — 做了什么，缺什么
   - `skills/paper-reviser/` — 修订能力
   - `skills/referee-review/` — 审稿能力
   - `skills/research-team/` — 双 agent 收敛研究
   - `skills/hep-calc/` — 计算能力
   - skill 与 hep-mcp 工具之间的调用关系

### Phase B: 从头设计重构方案

基于 Phase A 的完整理解，产出一份**全新的**重构提案（不是在旧提案上打补丁）：

1. **设计原则**:
   - MCP server = 确定性数据访问 + 确定性操作。零 LLM 调用。
   - 一切编排/生成/判断逻辑 → skill 层
   - 保留的每个工具必须有明确的不可替代理由
   - 无向后兼容负担（见 CLAUDE.md §全局约束）

2. **产出结构**:
   - 最终保留工具清单（逐个列出 + 理由）
   - 最终删除工具清单（逐个列出 + 确认无 KEEP 依赖）
   - 目录结构 after restructuring
   - 分 batch 执行计划（extraction before deletion）
   - research-writer skill 增强方案（承接写作能力）
   - LLM 客户端迁移方案（→ MCP sampling）
   - 测试影响评估

3. **写入位置**: 覆盖 `meta/docs/hep-mcp-restructuring-proposal.md`（旧版本 git 可追溯）

### Phase C: Codex 双模型审核

重构提案完成后，执行双模型收敛审核：

1. **准备 review packet**: 写入 `~/.autoresearch-lab-dev/batch-reviews/hep-mcp-restructure-v2-review-r1.md`
2. **执行 review-swarm**:
   ```bash
   python3 skills/review-swarm/scripts/bin/run_multi_task.py \
     --out-dir ~/.autoresearch-lab-dev/batch-reviews/hep-mcp-restructure-v2-r1-review \
     --system <system-prompt> \
     --prompt <review-packet>
   ```
3. **Review points**:
   - 依赖链完整性（每个 KEEP 文件的 imports 都指向 KEEP 目标）
   - LLM 能力声明的独立验证（web search）
   - 分 batch 执行顺序正确性（extraction before deletion）
   - Skill 覆盖完整性（写作能力无损失）
   - 工具数量合理性
4. **迭代至收敛**: 0 BLOCKING from all models
5. 注意: Codex CLI 上一轮全部失败（stream disconnect）。如果仍然失败，记录并尝试替代方案（如降低 packet 大小、分段审核）

### Phase D: 更新 REDESIGN_PLAN

收敛后，将最终方案写入 `meta/REDESIGN_PLAN.md`:
- 更新 NEW-06 (写作管线移除)
- 更新 NEW-MCP-SAMPLING (LLM 客户端迁移)
- 更新 NEW-SKILL-WRITING (research-writer 增强)
- 更新 Phase 3 checklist

## 上一轮关键发现（供参考，不作为约束）

1. **Citation verification 设计缺陷**: allowlist 要求 .bib 文件 → 新论文无法工作 → 已从 renderLatex 移除
2. **candidatePool.ts 孤立**: 唯一调用者是 deepResearch mode='write'（将被删除）
3. **allowed_citations_v1.json 孤立**: renderLatex 不再消费
4. **hep_run_stage_content 误判 KEEP**: 所有调用者在 DELETE 列表
5. **deepResearch analyze/synthesize 不重叠**: 与 fieldSurvey 入口和目标不同，不应合并
6. **SOTA**: Claude 4.6 退化=0.000, GPT-5 13K tokens 退化=0.036, 但 50K+ 仍需 section-by-section
7. **根因**: hep-mcp 在 skill 层出现之前设计，写作编排无处安放

## 约束

- 遵守 `CLAUDE.md` 全局约束（无向后兼容、SOTA 原则、commit 无 Co-Authored-By）
- 遵守 `packages/hep-mcp/CLAUDE.md` 子包约束
- Review 产物存放 `~/.autoresearch-lab-dev/batch-reviews/`，不放入仓库
- 设计文档存放 `meta/docs/`
