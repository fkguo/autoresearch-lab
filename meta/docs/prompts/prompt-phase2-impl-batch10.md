# Phase 2 — Implementation Batch 10

> **作用**: 本文件是 batch 10 的实施提示词。实施前，先将 batch 9 已实现的条目在
> `meta/REDESIGN_PLAN.md` 中勾掉。

## 勾掉 Batch 9 已完成的条目

在开始实现前，将以下条目的验收检查点全部标记为 `[x]`：

- **NEW-IDEA-01** (`packages/idea-mcp/`): 找到 NEW-IDEA-01 的验收项并勾掉
- **NEW-CONN-03** (`packages/hep-mcp/src/tools/ingest-skill-artifacts.ts`): 找到 NEW-CONN-03 的验收项并勾掉
- 在 Progress 进度树中将 NEW-IDEA-01、NEW-CONN-03 加上 ✅（如尚未标记）

### 补勾遗漏的 Phase 2 验收检查点

以下 Phase 2 总验收检查点（位于 REDESIGN_PLAN ~line 1640 附近）在前批次完成后遗漏了勾选：

- `[ ] NEW-R15 编排器 MCP 工具实现` → `[x]`（Batch 7 完成）
- `[ ] research-team 工具访问: full 模式 MCP 工具 + 溯源 clean-room + hard-fail 门禁 (RT-02)` → `[x]`（Batch 6 完成）
- `[ ] research-team runner 抽象: 自定义 runner + API 可配置 + key 脱敏 (RT-03)` → `[x]`（Batch 6 完成）
- `[ ] Graph Visualization Layer (NEW-VIZ-01)` → `[x]`（Batch 6 完成）
- `[ ] arxiv-mcp (NEW-ARXIV-01)` → `[x]`（已合并 main）

---

## Batch 10 实施内容

本批次包含 **2 个核心项**，完成后 Phase 2 达 44/45（仅 NEW-R14 因 NEW-06 阻塞延后）：

| 项目 | 路径 | LOC 估计 | 依赖 |
|------|------|---------|------|
| NEW-CONN-04 | `packages/hep-mcp/src/tools/` | ~150 LOC | NEW-IDEA-01 ✅ |
| NEW-WF-01 | `meta/schemas/` + `packages/shared/` | ~100 LOC | UX-04（schema 部分可独立） |

**Phase 2 剩余被阻塞项（本批次不实施）**：

| 项目 | 阻塞原因 | 说明 |
|------|---------|------|
| NEW-R14 | NEW-06 (Phase 3) | hep-mcp 内部包拆分（~98.6K LOC 重组织），等 NEW-06 稳定后执行 |

---

## Item 1: NEW-CONN-04 — Idea → Run Creation

### 背景

idea-core 通过 `idea_campaign_complete` 生成 IdeaHandoffC2 artifact（`idea_handoff_c2_v1.schema.json`）。该 artifact 包含：
- `idea_card.thesis_statement` — 研究命题
- `idea_card.claims` — 可测试声明列表（每条含 `statement`, `type`, `evidence_pointers`）
- `idea_card.testable_hypotheses` — 可测试假设
- `idea_card.minimal_compute_plan` — 计算步骤
- `grounding_audit` / `formalism_check` — 质量门禁通过证明

NEW-CONN-04 在 `hep-mcp` 中新增 `hep_run_create_from_idea` 工具，接收 IdeaHandoffC2 URI，创建 project + run，stage thesis/claims 为 outline seed。

### 工具设计

**工具名**: `hep_run_create_from_idea`（需在 `packages/shared/src/tool-names.ts` 新增常量）

**输入 schema**:
```typescript
{
  handoff_uri: z.string(),      // hep:// URI 指向 IdeaHandoffC2 artifact
  project_id: z.string().optional(), // 可选：现有 project；为空时自动创建
  run_label: z.string().optional(),  // 可选：run 标签
}
```

**实现要点**:
1. 读取 `handoff_uri` 指向的 IdeaHandoffC2 JSON artifact
2. 如无 `project_id`，用 `idea_card.thesis_statement` 前 80 字符作为 project title 创建 project
3. 调用现有 `createRun()` 创建 run（参照 `packages/hep-mcp/src/core/runs.ts`）
4. Stage outline seed artifact（写入 `<run_dir>/outline_seed_v1.json`）：
   - `thesis`: `idea_card.thesis_statement`
   - `claims`: `idea_card.claims`（保持原始结构）
   - `hypotheses`: `idea_card.testable_hypotheses`
   - `source_handoff_uri`: 原始 `handoff_uri`（溯源）
5. 返回 hint-only `next_actions` 建议后续 pipeline 步骤：
   - `inspire_search` — 文献检索
   - `hep_project_build_evidence` — 构建 evidence
   - `hep_run_ingest_skill_artifacts` — 如果有计算结果

**纯 staging 操作**：无网络调用，无 LLM 调用。仅读取 artifact + 创建文件。

**Risk level**: `write`（创建 project/run + 写文件，但不需要 `_confirm`）

### 新增文件

```
packages/hep-mcp/src/tools/create-from-idea.ts  # 工具实现 (~120 LOC)
packages/hep-mcp/tests/core/createFromIdea.test.ts  # 测试 (~80 LOC)
```

### 验收标准

- [ ] 从 IdeaHandoffC2 URI 创建 run
- [ ] outline seed 包含 thesis/claims
- [ ] next_actions 建议后续 pipeline 步骤
- [ ] 工具注册到 `registry.ts`，通过 `toolContracts.test.ts`
- [ ] `tool-names.ts` 包含 `HEP_RUN_CREATE_FROM_IDEA` 常量

---

## Item 2: NEW-WF-01 — Research Workflow Schema

### 背景

NEW-WF-01 定义 `research_workflow_v1.schema.json`，描述声明式研究工作流图。虽然运行时实现依赖 UX-04（Phase 3），但 schema 设计本身是独立的——定义 nodes/edges/gates 的 JSON Schema，提供模板 JSON 文件。

### Schema 设计

**文件**: `meta/schemas/research_workflow_v1.schema.json`

**核心结构**:
```json
{
  "workflow_id": "string (uuid)",
  "template": "enum: review | original_research | reproduction",
  "entry_point": {
    "variant": "enum: from_literature | from_idea | from_computation | from_existing_paper",
    "params": { ... }
  },
  "nodes": [
    {
      "id": "string",
      "type": "enum: tool_call | gate | human_review | parallel_group",
      "tool_name": "string (optional, for tool_call nodes)",
      "gate_spec": { ... }
    }
  ],
  "edges": [
    {
      "from": "node_id",
      "to": "node_id",
      "condition": "string (optional, gate outcome)"
    }
  ],
  "state_model": {
    "current_node": "string",
    "completed_nodes": ["string"],
    "gate_outcomes": { "node_id": "approved | rejected | pending" }
  }
}
```

### 模板文件

在 `meta/schemas/workflow-templates/` 下提供 3 个示例 JSON 模板：

```
meta/schemas/workflow-templates/
├── review.json              # 综述论文工作流
├── original_research.json   # 原创研究工作流
└── reproduction.json        # 复现/验证工作流
```

每个模板是一个合法的 `research_workflow_v1.schema.json` instance，包含预定义的 nodes/edges 序列。

### Entry Point Variants

| Variant | 说明 | 连通的 CONN 项 |
|---------|------|---------------|
| `from_literature` | 从文献检索开始 | NEW-CONN-01 |
| `from_idea` | 从 IdeaHandoffC2 开始 | NEW-CONN-04 |
| `from_computation` | 从计算结果开始 | NEW-CONN-03 |
| `from_existing_paper` | 从已有论文导入开始 | `hep_import_paper_bundle` |

### 验收标准

- [ ] `research_workflow_v1.schema.json` 定义完成，含 nodes/edges/gates/entry_points
- [ ] 至少 3 个模板: review, original_research, reproduction
- [ ] entry point variants 覆盖 4 种起点
- [ ] 模板 JSON 通过 schema 校验（Ajv 或 `ajv-cli`）

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
| `packages/hep-mcp/src/tools/create-from-idea.ts` | NEW-CONN-04 工具实现 |
| `packages/hep-mcp/tests/core/createFromIdea.test.ts` | NEW-CONN-04 测试 |
| `packages/shared/src/tool-names.ts` | 新增 `HEP_RUN_CREATE_FROM_IDEA` 常量 |
| `meta/schemas/research_workflow_v1.schema.json` | NEW-WF-01 workflow schema |
| `meta/schemas/workflow-templates/*.json` | 3 个 workflow 模板 |
| `meta/REDESIGN_PLAN.md` | Batch 9 checkboxes → `[x]` + 补勾遗漏项 |

## Backlog 备注

以下项已完成但文档暂未添加（等 npm publish 流程建立或 NEW-R14 拆分后统一处理）：

- `packages/arxiv-mcp/` 独立使用文档
- `packages/hepdata-mcp/` 独立使用文档
- MCP server 安装/配置指南（独立使用 vs hep-mcp 聚合使用）
