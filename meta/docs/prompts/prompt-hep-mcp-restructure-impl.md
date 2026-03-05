# Implementation Prompt — hep-mcp Restructuring (NEW-06 + NEW-MCP-SAMPLING)

> **适用范围**: 从 `packages/hep-mcp/` 启动的 Claude Code 会话
> **前置**: `meta/docs/hep-mcp-restructuring-proposal.md` (R8 converged, dual-model reviewed)

## 任务

执行 hep-mcp 写作流水线移除。删除 ~40K LOC、30 个工具，保留数据访问 + 确定性操作工具。唯一 LLM 客户端迁移到 MCP sampling。

**这是一个跨多会话的大型重构。** 每个会话只执行分配给它的 batch，不要越界。

## 核心参考文件

| 文件 | 用途 |
|------|------|
| `meta/docs/hep-mcp-restructuring-proposal.md` | 完整重构方案（§3 工具清单, §4 提取表, §5 LLM 分析, §7 执行计划） |
| `meta/docs/hep-mcp-restructure-tracker.md` | **跨会话进度追踪** — 每个步骤的完成状态 |
| `meta/REDESIGN_PLAN.md` §NEW-06, §NEW-MCP-SAMPLING | REDESIGN_PLAN 条目 |

## 会话启动协议

**每个新会话开始时必须执行**：

1. 读取 `meta/docs/hep-mcp-restructure-tracker.md` — 确认当前进度
2. 读取 `meta/docs/hep-mcp-restructuring-proposal.md` §7 — 获取当前 batch 的详细步骤
3. 运行 `pnpm -r build` — 确认基线编译通过
4. 确认上一个 batch 的 build gate 已通过（如适用）

## 会话分配

### Session 1: Batch 1 — Extractions + Corpora 删除

**工作内容**:
- 提取 3 个新文件: `utils/latex.ts`, `utils/bibtex.ts`, `core/writing/writingTypes.ts`
- 更新 KEEP 模块的 import 路径
- 移除 `verifyCitations` + `exportProject.ts` 验证 artifact 可选化
- 清理 `resources.ts` 的 `hep://corpora/` handlers
- 中和 `StyleIdSchema` import
- 删除 `corpora/` 目录 (16 files) + 8 个 registry 条目

**Build gate**: `pnpm -r build` 通过
**Review**: 双模型代码审核 (review-swarm, `gpt-5.3-codex` + `gemini-3.1-pro-preview`)
**完成标志**: Commit + push + tracker 更新

**估计复杂度**: 低。纯提取 + 死代码删除，无行为变更。

### Session 2: Batch 2 — 写作流水线核心删除

**工作内容**:
- `deepResearch.ts` 移除 `mode='write'` + ~50 个 writing imports
- 删除 `deepWriterAgent.ts` + `llm/index.ts` re-export
- 删除 `core/writing/` 32 个文件（保留 6 个）
- 删除 `tools/writing/` 大部分目录（保留 `llm/` + `types.ts`）
- 清理 `registry.ts` ~28 个工具注册 + 相关 imports

**Build gate**: `pnpm -r build` 通过
**Review**: 双模型代码审核
**完成标志**: Commit + push + tracker 更新

**估计复杂度**: 中。最大量删除，但依赖图已完全映射。关键是步骤顺序：mode='write' 移除 → deepWriterAgent 删除 → 目录删除 → registry 清理。

**特别注意**:
- `HepRunBuildCitationMappingToolSchema` 的 `allowed_citations_primary`/`include_mapped_references` 参数 **不要删除** — 它们被 handler 活跃消费
- `tools/writing/types.ts` **不要删除** — `llm/` 依赖它，延后到 Batch 3
- Batch 2 完成后 `tools/writing/` 应只剩 `llm/` 和 `types.ts`

### Session 3: Batch 3 + Batch 4 — LLM 迁移 + 测试清理 + 最终验证

**Batch 3 工作内容**:
- 为 `ToolHandlerContext` 添加 `sendRequest`/`createMessage`（plumbing: `index.ts` → `dispatcher.ts` → handlers）
- 迁移 `theoreticalConflicts.ts`: `createLLMClient()` → `ctx.createMessage()`
  - 需要穿透 handler chain: registry handler → `performCriticalResearch()` → `performTheoreticalConflicts()`
- 删除 `tools/writing/llm/` + `tools/writing/types.ts` + 剩余 `tools/writing/`
- 清理 stale `next_actions` hints

**Batch 4 工作内容**:
- 删除已移除模块的测试文件 (~38 files, ~260 tests)
- 更新 `toolContracts.test.ts`
- 验证 tool count: 72 full / 56 standard
- `make smoke` 冒烟测试
- 更新 `docs/ARCHITECTURE.md` + `packages/hep-mcp/CLAUDE.md`
- 删除写作 recipe docs

**Build gate**: `pnpm -r build && pnpm -r test` 通过
**Review**: 双模型代码审核（覆盖 Batch 3 + Batch 4）
**完成标志**: Commit + push + tracker 更新 + 最终验收检查

**估计复杂度**: 低-中。Batch 3 的 sampling plumbing 是新代码（~100 LOC），Batch 4 纯清理。

## 执行规则

### 步骤顺序

**严格按照 proposal §7 的步骤顺序执行。** 顺序背后是 8 轮双模型审核发现的依赖链：
- 提取必须在删除之前
- `mode='write'` 移除必须在 `deepWriter/` 删除之前
- `deepWriterAgent.ts` 删除必须在 `llm/index.ts` re-export 移除之后
- MCP sampling plumbing 必须在 `theoreticalConflicts.ts` 迁移之前
- `llm/` 删除必须在 sampling 迁移之后
- `types.ts` 删除必须在 `llm/` 删除之后

### Build Gate

每个 batch 完成后，**必须** `pnpm -r build` 通过 0 errors。如果不通过，修复后再继续。

### 代码审核

每个 batch 实施完成后，执行双模型代码审核：

```bash
# 代码实现审核使用 gpt-5.3-codex（不是方案审核的 gpt-5.2）
python3 skills/review-swarm/scripts/bin/run_multi_task.py \
  --out-dir ~/.autoresearch-lab-dev/batch-reviews/new06-batch{N}-r{M}-review \
  --system ~/.autoresearch-lab-dev/batch-reviews/new06-batch{N}-review-system.md \
  --prompt ~/.autoresearch-lab-dev/batch-reviews/new06-batch{N}-review-r{M}.md
```

Review system prompt 应聚焦：
- `tsc` 编译正确性（所有 `src/**/*` 文件都编译）
- 无遗漏的 KEEP → DELETE import 路径
- registry handler/schema 一致性
- 无意外删除 KEEP 模块

收敛标准：两个模型 0 BLOCKING findings。

### Tracker 更新

每完成一个步骤，**立即**更新 `meta/docs/hep-mcp-restructure-tracker.md`：
- `[ ]` → `[x]` 标记已完成步骤
- 填写 build gate 结果
- 填写 review 结果
- 记录任何偏离计划的情况（deviations）
- 填写 commit hash
- 填写 session 标识

### 不要做的事

- **不要合并 batch** — 每个 session 只做分配的 batch
- **不要跳过步骤** — 即使看起来不需要
- **不要删除 KEEP 模块** — 反复确认 proposal §3.2 的 KEEP 列表
- **不要修改不在计划中的文件** — 除非是修复因删除产生的编译错误
- **不要手动修改测试来让它通过** — 如果测试失败，分析原因（可能是遗漏了什么）
- **不要在 Batch 1/2 运行 `pnpm -r test`** — 已删除模块的测试会失败，这是预期的，测试清理在 Batch 4

## 最终验收

所有 batch 完成后，对照 tracker 底部的 "Final Acceptance" 清单逐项验证。全部通过 → NEW-06 + NEW-MCP-SAMPLING 完成。
