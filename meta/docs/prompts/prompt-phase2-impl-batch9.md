# Phase 2 — Implementation Batch 9

> **作用**: 本文件是 batch 9 的实施提示词。实施前，先将 batch 8 已实现的条目在
> `meta/REDESIGN_PLAN.md` 中勾掉。

## 勾掉 Batch 8 已完成的条目

在开始实现前，将以下条目的验收检查点全部标记为 `[x]`：

- **NEW-RT-01** (`packages/orchestrator/src/agent-runner.ts`): 找到 NEW-RT-01 的三个 `[ ]` 验收项并勾掉
- **NEW-RT-04** (`packages/orchestrator/src/run-manifest.ts`): 找到 NEW-RT-04 的三个 `[ ]` 验收项并勾掉
- **NEW-COMP-01** (`meta/docs/wcompute-mcp-design.md`): 找到 NEW-COMP-01 的三个 `[ ]` 验收项并勾掉
- 在 Progress 进度树中将 NEW-RT-01、NEW-RT-04、NEW-COMP-01 加上 ✅

---

## Batch 9 实施内容

本批次包含 **2 个核心项**：

| 项目 | 路径 | LOC 估计 | 依赖 |
|------|------|---------|------|
| NEW-IDEA-01 | `packages/idea-mcp/` (新包) | ~400–600 LOC | H-01 ✅, H-02 ✅, H-03 ✅, H-16a ✅ |
| NEW-CONN-03 | `packages/hep-mcp/src/tools/` + schema | ~250 LOC | NEW-COMP-01 ✅, NEW-01 ✅ |

---

## Item 1: NEW-IDEA-01 — idea-core MCP 桥接

### 背景

idea-core 是现有 Python 包 (`packages/idea-core/`)，提供 stdio JSON-RPC server (`packages/idea-core/src/idea_core/rpc/server.py`)。它暴露了以下方法（via `IdeaCoreService.handle`）：

- `campaign.init`, `campaign.status`, `campaign.topup`, `campaign.pause`, `campaign.resume`, `campaign.complete`
- `search.step`
- `eval.run`

NEW-IDEA-01 新建 `@autoresearch/idea-mcp` TS 包，作为 MCP server，通过 child process 启动 idea-core JSON-RPC server，将上述方法桥接为 MCP 工具。

### 新包结构

```
packages/idea-mcp/
├── package.json           # name: @autoresearch/idea-mcp, bin: idea-mcp
├── tsconfig.json          # 参照 packages/orchestrator/tsconfig.json
├── src/
│   ├── index.ts           # 导出公共 API
│   ├── rpc-client.ts      # idea-core stdio JSON-RPC client (child_process)
│   └── server.ts          # MCP server (stdio transport)
└── tests/
    └── rpc-client.test.ts # 单元测试 (mock child process)
```

### `rpc-client.ts` 设计

- 启动 `uv run python -m idea_core.rpc.server` (在 `packages/idea-core` 目录下)
- 通过 stdin/stdout 发送 JSON-RPC 2.0 请求 (换行分隔)
- 内部维护 pending requests map (`id → deferred`) 解析响应
- 超时处理 (默认 30s)
- `McpError` 映射: RPC error code → `McpError('retryable', ...)` 或 `McpError('INTERNAL_ERROR', ...)`
- 错误隔离: child process crash → emit `McpError` to all pending, attempt restart
- 使用 `@autoresearch/shared` 的 `McpError`

### MCP 工具列表

全部工具使用 `idea_` 前缀：

| MCP 工具名 | JSON-RPC method | 核心参数 |
|-----------|----------------|---------|
| `idea_campaign_init` | `campaign.init` | `topic: string, budget?: number` |
| `idea_campaign_status` | `campaign.status` | `campaign_id: string` |
| `idea_campaign_topup` | `campaign.topup` | `campaign_id: string, budget: number` |
| `idea_campaign_pause` | `campaign.pause` | `campaign_id: string` |
| `idea_campaign_resume` | `campaign.resume` | `campaign_id: string` |
| `idea_campaign_complete` | `campaign.complete` | `campaign_id: string` |
| `idea_search_step` | `search.step` | `campaign_id: string, query?: string` |
| `idea_eval_run` | `eval.run` | `campaign_id: string` |

### Zod schema 约定

- 每个工具的 input schema 用 Zod 定义，转换为 JSON Schema 注册到 MCP server
- 参照 `packages/hep-mcp/src/tools/` 中现有工具的 Zod 模式
- 错误用 `McpError` 包装后通过 MCP `isError: true` 返回 (不 throw)

### 验收标准

- `idea_campaign_init` 可创建 campaign，返回 campaign_id
- `idea_search_step` 可执行搜索步骤
- `idea_eval_run` 可运行评估
- 错误通过 `McpError(retryable)` 传播（JSON-RPC error → MCP error）
- 单元测试 mock child process，覆盖 happy path + RPC error + process crash

---

## Item 2: NEW-CONN-03 — Computation Evidence Ingestion

### 背景

NEW-COMP-01 (已完成) 定义了 `hep_run_ingest_skill_artifacts` 工具规格 (见 `meta/docs/wcompute-mcp-design.md`)。
NEW-CONN-03 在 `packages/hep-mcp/` 中实现该工具，并：
1. 完成 `ComputationEvidenceCatalogItemV1` JSON Schema 的 Zod codegen 集成
2. 实现 `hep_run_ingest_skill_artifacts` MCP 工具
3. 扩展 `buildRunEvidenceIndexV1` 合并计算 evidence 到 BM25 index

### JSON Schema 已有基础

`meta/schemas/computation_evidence_catalog_item_v1.schema.json` 已在 Batch 8 创建。
Zod codegen (NEW-01) 的集成方式参照 `packages/hep-mcp/src/types/` 中的现有 schema → Zod 模式。

### `hep_run_ingest_skill_artifacts` 工具

输入 schema (参照 `meta/docs/wcompute-mcp-design.md`):
```typescript
{
  run_id: z.string(),
  skill_artifacts_dir: z.string(),  // 绝对路径, 在 run_dir 内
  manifest_path: z.string().optional(),
  tags: z.array(z.string()).max(20).optional(),
}
```

实现要点：
- 验证 `skill_artifacts_dir` 在 `run_dir` 内 (路径白名单, C-02)
- 读取 skill artifacts, 计算 sha256
- 写入 `<run_dir>/computation_evidence_catalog_v1.jsonl` (追加模式)
- 每条记录符合 `ComputationEvidenceCatalogItemV1` schema
- `riskLevel: 'destructive'` (写文件操作), `requiresApproval: false`
- 返回写入的 item 数量

### BM25 index 扩展

在现有 `buildRunEvidenceIndexV1` 调用链中 (~30 LOC):
- 如果 `computation_evidence_catalog_v1.jsonl` 存在，读取并合并到 BM25 index
- 计算证据条目的文本来自 `skill_id` + `notes` + `tags` 字段
- 通过 `source_type: "computation"` 字段区分（已在 schema 中定义）

### 验收标准

- `ComputationEvidenceCatalogItemV1` Zod schema 通过 codegen 生成并在 CI 验证
- `hep_run_ingest_skill_artifacts` 可写入 catalog JSONL, 路径白名单验证通过
- BM25 index 包含计算 evidence 条目

---

## 实施规范

### 一般约束

- 遵循 `CLAUDE.md` §全局约束（无向后兼容负担、禁止临时命名）
- 模块解析使用 NodeNext，所有相对 import 加 `.js` 后缀
- 错误用 `McpError` (from `@autoresearch/shared`)
- 测试用 Vitest (`vi.fn()`, `describe/it/expect`)

### 代码量限制

- 代码量限制见 `meta/REDESIGN_PLAN.md` 中每项的 LOC 估计
- 过大的 LOC 说明设计过度，需简化

### 多模型审核

实现完成后，按 `CLAUDE.md` §多模型收敛检查流程，用 `review-swarm` skill 运行双模型审核。

### 测试运行

每次审核前运行：
```bash
pnpm -r build
pnpm -r test
```
确认无回归。

---

## 输出物清单

| 文件/目录 | 说明 |
|-----------|------|
| `packages/idea-mcp/` | 新 TS 包 (全部文件) |
| `packages/hep-mcp/src/tools/ingest-skill-artifacts.ts` | NEW-CONN-03 工具实现 |
| `packages/hep-mcp/src/types/` | ComputationEvidenceCatalogItemV1 Zod codegen |
| `packages/hep-mcp/src/tools/build-evidence-index.ts` | BM25 扩展 (~30 LOC) |
| `meta/REDESIGN_PLAN.md` | Batch 8 checkboxes → `[x]` |
