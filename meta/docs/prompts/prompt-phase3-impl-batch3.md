# Phase 3 — Implementation Batch 3

> **作用**: 本文件是 Phase 3 Batch 3 的实施提示词。Batch 2（NEW-R11 + NEW-R12）已收敛并落地，
> 本批次聚焦 Phase 3 的用户工作流能力补齐：论文版本追踪（UX-03）与结构化编排（UX-04）。

> **通用硬门禁继承**: 本 prompt 默认继承 `meta/docs/prompts/IMPLEMENTATION_PROMPT_CHECKLIST.md`；若本文件与 checklist 同时覆盖同一主题，以更严格者为准。


## 启动前同步

在开始实现前，先对齐当前状态（以仓库现状为准）：

- 确认 `meta/REDESIGN_PLAN.md` 中 NEW-R11 / NEW-R12 已标记为 `[x]`
- 确认 `meta/remediation_tracker_v1.json` 中 NEW-R11 / NEW-R12 状态为 `done`
- 保持 NEW-06 / NEW-MCP-SAMPLING 的已完成状态，不回退

---

## Batch 3 实施内容

本批次包含 **2 个核心项**：

| 项目 | 路径 | LOC 估计 | 依赖 |
|------|------|---------|------|
| UX-03 | `packages/hep-mcp/src/core/export/` + `skills/research-writer/` + `meta/schemas/` | ~250-450 | NEW-06 ✅ |
| UX-04 | `meta/schemas/` + `meta/recipes/` + `packages/hep-mcp/src/tools/registry/` | ~250-500 | NEW-06 ✅, H-16a ✅, NEW-R15-impl ✅ |

---

## Item 1: UX-03 — 论文版本追踪 + 输出路径统一

### 背景

当前 `hep_export_paper_scaffold` 默认输出 `paper/`，research-writer 的 consume 脚本也按单版本目录处理。
Phase 3 目标是形成可审计的 `v1/v2/...` 论文版本链，并让 skill 与 MCP 工具路径语义一致。

### 目标

1. `hep_export_paper_scaffold` 支持版本化输出目录（`paper/v{N}/`）
2. 自动生成相邻版本差异文件（`changes_v{N-1}_to_v{N}.diff`）
3. `paper_manifest_v2.schema.json` 定义版本字段
4. research-writer consume 流程可消费版本化 manifest（仍保持确定性，无 LLM/网络）

### 实施要点

1. 在 `exportPaperScaffold` 中新增可选版本参数（建议 `version`），并用于输出路径决策
2. 当 `version > 1` 且上一个版本存在时，生成 `changes_v{N-1}_to_v{N}.diff`
3. 在 `meta/schemas/` 新增 `paper_manifest_v2.schema.json`：至少包含
   - `version`
   - `parent_version`
   - `review_ref`
4. 更新 research-writer consume 脚本：
   - 优先读取版本化 manifest 路径
   - 保持对 v1 manifest 的兼容读取（若项目已有 v1 资产）
5. 避免破坏现有默认路径：未传 version 时保持当前行为

### 验收标准

- [ ] `hep_export_paper_scaffold --version 2` 输出至 `paper/v2/`
- [ ] 自动生成 `changes_v1_to_v2.diff`
- [ ] `paper_manifest_v2.schema.json` 存在且可被消费脚本识别
- [ ] research-writer consume 流程可处理版本化 manifest

---

## Item 2: UX-04 — 结构化工具编排 Recipe + inspire 工具合并

### 背景

已有 `research_workflow_v1.schema.json` 和 `workflow-templates/`，但 UX-04 仍要求 recipe 层与工具层收敛：
- 需要独立 recipe schema + recipe 文件目录
- 需要将 `inspire_search` 与 `hep_inspire_search_export` 收敛为单一入口（保留 `inspire_search` 名称）

### 目标

1. 交付 `workflow_recipe_v1.schema.json`
2. 交付至少 3 个标准 recipe（literature / derivation / review）
3. 合并 inspire 搜索与导出能力到 `inspire_search`（通过可选参数控制导出）
4. 保持工具契约稳定并补齐测试

### 实施要点

1. 在 `meta/schemas/` 新增 `workflow_recipe_v1.schema.json`
2. 新建 `meta/recipes/` 并提供至少 3 个 recipe JSON：
   - `literature_to_evidence.json`
   - `derivation_cycle.json`
   - `review_cycle.json`
3. 在 `packages/hep-mcp/src/tools/registry/inspireSearch.ts` 中扩展 `inspire_search` 参数（例如 `export_mode` / `run_id` / 导出相关字段）以覆盖原 `hep_inspire_search_export`
4. 对 `hep_inspire_search_export` 处理策略二选一（优先不破坏现有调用）：
   - 作为兼容薄包装转发到 `inspire_search` 新实现，或
   - 明确标记为 deprecated 并保持行为一致（直到后续批次删除）
5. 增加/更新契约测试，确保：
   - `inspire_search` 新参数路径可用
   - 导出能力可达
   - tool count / exposure 无意外回归

### 验收标准

- [ ] `workflow_recipe_v1.schema.json` 定义完成
- [ ] 至少 3 个标准 recipe 文件存在并通过 schema 校验
- [ ] `inspire_search` 覆盖导出能力（原 `hep_inspire_search_export` 语义可达）
- [ ] Agent 可加载 recipe JSON 执行标准工作流（至少有解析/装载测试）

---

## 实施规范

- 遵循 `CLAUDE.md`：无向后兼容负担、禁止临时性命名、commit 不加 Co-Authored-By
- 优先最小改动达成目标，不做额外重构
- 所有本地相对 import 使用 NodeNext 规则（`.js` 后缀）
- 不回滚与本批次无关的脏工作区改动

## 测试与验证

每轮提交前至少执行：

```bash
pnpm --filter @autoresearch/hep-mcp test -- tests/toolContracts.test.ts
pnpm --filter @autoresearch/hep-mcp test
pnpm -r build
pnpm -r test
```

若涉及工具数量或暴露层变化，附加校验：

```bash
node --input-type=module -e "import('./packages/hep-mcp/dist/tools/index.js').then(({getTools})=>console.log('standard',getTools('standard').length,'full',getTools('full').length))"
```

## 多模型收敛要求

按 `CLAUDE.md` 双模型收敛规则执行 `review-swarm`（固定模型：`claude/opus` + `gemini/gemini-3.1-pro-preview`），并满足：

- 全模型 0 BLOCKING 才可视为收敛
- 收敛轮必须是完整 packet（非 delta-only）
- 每轮需处理所有模型的全部 BLOCKING finding

## 收敛后操作

1. commit
2. push
3. 更新 `meta/REDESIGN_PLAN.md` 对应 checkboxes
4. 若 UX-03/UX-04 完成，生成下一批 prompt：`meta/docs/prompts/prompt-phase3-impl-batch4.md`
