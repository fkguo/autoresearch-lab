# Phase 3 — Implementation Batch 2

> **作用**: 本文件是 Phase 3 Batch 2 的实施提示词。上一轮 NEW-06 Batch 3 已收敛通过，
> 本批次聚焦 Phase 3 的结构化重构与跨组件契约落地。

## 启动前同步

在开始实现前，先更新 `meta/REDESIGN_PLAN.md` 的完成状态（按本次已收敛结果）：

- `NEW-06` 下 Batch 3 相关验收项标记为 `[x]`
- `NEW-MCP-SAMPLING` 验收项（`theoreticalConflicts.ts` 迁移 + context plumbing）标记为 `[x]`
- 若 Batch 4（测试清理 + 验证）已在当前分支完成并通过，`NEW-06` 对应验收项一并勾掉

---

## Batch 2 实施内容

本批次包含 **2 个核心项**：

| 项目 | 路径 | LOC 估计 | 依赖 |
|------|------|---------|------|
| NEW-R11 | `packages/hep-mcp/src/tools/registry/` | ~500-800 | NEW-06 ✅ |
| NEW-R12 | `meta/` + `packages/hep-mcp/tests/` + `packages/idea-core/`(只读参考) | ~200-350 | EVO-05(概念依赖) |

---

## Item 1: NEW-R11 — `registry.ts` 领域拆分

### 背景

`packages/hep-mcp/src/tools/registry.ts` 当前承载全量工具注册，体量与职责过于集中。`REDESIGN_PLAN` 已将其列为 Phase 3 深度重构项。

### 目标

将 registry 按领域拆分，降低单文件复杂度，同时保持运行时行为与工具契约稳定。

### 实施要点

1. 新建目录：`packages/hep-mcp/src/tools/registry/`
2. 建议拆分文件（按现有工具分组，名称可微调但需稳定语义）：
   - `shared.ts`（共享类型、公共 helper、导出聚合入口）
   - `inspire.ts`
   - `zotero.ts`
   - `pdg.ts`
   - `project.ts`（含 run/project/writing-export 等 hep_* core）
3. `packages/hep-mcp/src/tools/registry.ts` 降为轻量聚合层（或直接改为 re-export 入口）
4. 保证以下不变：
   - 工具名、schema、exposure、handler 行为
   - `getTools('standard')=56`、`getTools('full')=72`（如本批次未引入额外 tool 变更）
   - `toolContracts.test.ts` 全通过

### 验收标准

- [ ] registry 按领域拆分完成，主入口清晰
- [ ] 每个拆分文件保持可维护规模（目标 ≤500 LOC，允许小幅波动）
- [ ] 工具数量与 contract tests 无回归

---

## Item 2: NEW-R12 — `idea-runs` 集成契约

### 背景

Phase 3 需要将 idea 侧产物与 run 侧产物的契约显式化，避免跨组件数据漂移与隐式耦合。

### 目标

交付一套可执行（可测试）的“idea-runs integration contract”最小闭环：

1. 契约文档（字段、命名、artifact 位置、交叉引用规则）
2. 契约测试（CI 可执行），验证最关键的 schema/路径/引用约束

### 实施要点

1. 在 `meta/` 下新增/更新契约文档（建议位置：`meta/docs/`，命名体现 `idea-runs-contract`）
2. 在 TS 测试侧增加契约测试（建议放在 `packages/hep-mcp/tests/contracts/` 或最贴近消费方的位置）
3. 测试至少覆盖：
   - run artifact 命名/路径约束
   - idea handoff → run seed 的关键字段映射
   - 关键 cross-reference 字段完整性（如 source uri / id / checksum 等已存在字段）

### 验收标准

- [ ] 契约文档存在且可被实现方直接使用
- [ ] CI 中有自动化契约测试并通过
- [ ] 与现有 NEW-CONN-04（`hep_run_create_from_idea`）行为一致，无破坏性回归

---

## 实施规范

- 遵循 `CLAUDE.md`：无向后兼容包袱、禁止临时性命名、commit 不加 Co-Authored-By
- 优先最小改动达成目标，不做额外重构
- 所有相对 import 使用 NodeNext 规则（`.js` 后缀）

## 测试与验证

每轮提交前至少执行：

```bash
pnpm --filter @autoresearch/hep-mcp test -- tests/toolContracts.test.ts
pnpm --filter @autoresearch/hep-mcp test
pnpm -r build
pnpm -r test
```

若涉及工具数量变更风险，附加校验：

```bash
node --input-type=module -e "import('./packages/hep-mcp/dist/tools/index.js').then(({getTools})=>console.log('standard',getTools('standard').length,'full',getTools('full').length))"
```

## 多模型收敛要求

按 `CLAUDE.md` 的双模型收敛规则执行 `review-swarm`，并满足：

- 全模型 0 BLOCKING 才可视为收敛
- 收敛轮必须是完整 packet（非 delta-only）

## 收敛后操作

1. commit
2. push
3. 更新 `meta/REDESIGN_PLAN.md` 对应 checkboxes
4. 生成下一批 prompt：`meta/docs/prompts/prompt-phase3-impl-batch3.md`
