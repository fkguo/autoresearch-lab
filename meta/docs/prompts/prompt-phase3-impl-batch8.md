# Phase 3 Implementation Batch 8: M-04 + M-07 + NEW-SKILL-01

> **前置条件**: Phase 3 Batch 7 (NEW-SKILL-WRITING + NEW-CONN-05) 已完成并通过 review-swarm 收敛（R3, 0 BLOCKING from Codex + Gemini）。

## 范围

本批次实现三个 Phase 3 item：

1. **M-04**: Zod→MCP schema 信息损失 — schema fidelity 测试 (~200 LOC)
2. **M-07**: Schema 模式过严 — `x-*` 扩展字段支持 (~50 LOC)
3. **NEW-SKILL-01**: lean4-verify Skill (~200 LOC)

总计约 ~450 LOC 新代码。

---

## 前置步骤

### 1. 读取 Serena memory，确认是否最新

用 `serena:list_memories` 列出所有记忆文件，然后读取与本批次相关的记忆：

- `architecture-decisions` — 跨组件设计决策（Zod SSOT、schema 约定）
- `task-completion-checklist` — 交付流程检查清单
- `codebase-gotchas` — 代码库陷阱（TypeScript 构建、schema 往返、JSON Schema Draft 2020-12 细节）

确认各记忆文件与 git log 的实际状态一致；若发现过时条目，先更新后再开始实现。

### 2. 前置确认

- 确认 `meta/REDESIGN_PLAN.md` 中 Batch 7 (NEW-SKILL-WRITING, NEW-CONN-05) 已标记为 ✅
- 确认 `meta/remediation_tracker_v1.json` 中 NEW-OPENALEX-01 已更新为 `"done"`
- 运行 `pnpm -r build && pnpm -r test` 确认基线通过

---

## Item 1: M-04 — Zod→MCP schema fidelity 测试

### 背景

hep-mcp 使用 Zod schema 作为 SSOT，通过 `zodToJsonSchema` 转换为 MCP tool input schema。转换可能丢失信息（default 值、description、enum 约束、嵌套 oneOf 等）。当前无自动化测试保证往返等价。

### REDESIGN_PLAN 原文

> M-04: 对 10 个关键工具添加 schema fidelity 测试（Zod → JSON Schema 往返等价）

### 变更

1. 创建 `packages/hep-mcp/tests/schema-fidelity/` 目录
2. 对 10 个关键工具（覆盖不同 schema 复杂度）添加 fidelity 测试：
   - 每个测试：获取 Zod schema → `zodToJsonSchema()` → 验证关键属性保留

### 选取的 10 个关键工具（建议，可根据实际调整）

| 工具 | 选取理由 |
|------|---------|
| `inspire_search` | 复杂参数（enum, optional, size/page） |
| `hep_project_compare_measurements` | 嵌套 array of objects（input_runs） |
| `hep_render_latex` | 深层嵌套 oneOf（SectionDraft vs ReportDraft） |
| `hep_export_paper_scaffold` | 多 optional 参数 + defaults |
| `zotero_add` | oneOf source 联合类型 |
| `pdg_get_measurements` | 多种 optional 查询路径 |
| `hep_run_build_writing_evidence` | 复杂 nested array（latex_sources） |
| `openalex_search` | 简单参数（对照组） |
| `orch_run_approve` | literal + pattern 约束 |
| `hep_run_build_measurements` | target_quantities array + optional params |

### 测试策略

```typescript
// 每个工具的 fidelity 测试结构：
describe('schema fidelity', () => {
  it('<tool_name>: required fields preserved', () => {
    const jsonSchema = zodToMcpInputSchema(zodSchema);
    expect(jsonSchema.required).toContain('key_field');
  });

  it('<tool_name>: enum values preserved', () => {
    const jsonSchema = zodToMcpInputSchema(zodSchema);
    expect(jsonSchema.properties.mode.enum).toEqual(['lexical', 'semantic']);
  });

  it('<tool_name>: nested object structure preserved', () => {
    // ...
  });
});
```

### 涉及文件

| 文件 | 变更 |
|---|---|
| `packages/hep-mcp/tests/schema-fidelity/schemaFidelity.test.ts` | 新增：10 个工具的 schema fidelity 测试 |

### 验收检查点

- [ ] `tests/schema-fidelity/schemaFidelity.test.ts` 存在且包含 10 个工具的测试
- [ ] 每个工具至少测试：required 字段保留、类型保留、enum 保留（如有）
- [ ] 含 oneOf 的工具（`hep_render_latex`, `zotero_add`）有 union type 保留测试
- [ ] `pnpm -r test` 全部通过

---

## Item 2: M-07 — Schema 模式过严（`x-*` 扩展字段）

### 背景

`idea-generator/schemas/` 中部分 schema 使用 `"additionalProperties": false`，导致 `x-*` 前缀的扩展字段无法通过验证。JSON Schema 2020-12 支持 `patternProperties` 来允许特定命名空间的扩展。

### REDESIGN_PLAN 原文

> M-07: 核心字段严格 + `x-*` 隔离命名空间 + `additionalProperties` 策略文档化

### 变更

1. 在使用 `"additionalProperties": false` 的 schema 中添加 `patternProperties` 允许 `x-*` 扩展字段
2. 添加策略文档说明 `additionalProperties` 使用约定
3. 添加验证测试：确认 `x-*` 字段不触发验证失败

### 实现方式

在 schema 中添加：
```json
{
  "patternProperties": {
    "^x-": {}
  },
  "additionalProperties": false
}
```

这允许 `x-custom-field` 等扩展字段通过验证，同时仍拒绝非 `x-` 前缀的未知字段。

### 涉及文件

| 文件 | 变更 |
|---|---|
| `packages/idea-generator/schemas/*.schema.json` | 在有 `additionalProperties: false` 的 schema 中添加 `"^x-"` patternProperties |
| `packages/idea-generator/scripts/validate_schemas.py` 或等效 | 添加测试：带 `x-foo` 字段的实例通过验证 |
| `packages/idea-generator/README.md` 或 `CLAUDE.md` | 文档化 `additionalProperties` 策略 |

### 验收检查点

- [ ] 所有使用 `additionalProperties: false` 的 schema 允许 `^x-` 前缀字段
- [ ] 验证测试：`x-custom-field` 通过验证
- [ ] 验证测试：`unknown_field`（非 `x-` 前缀）仍被拒绝
- [ ] 策略文档存在

---

## Item 3: NEW-SKILL-01 — lean4-verify Skill

### 背景

Lean4 是交互式定理证明器，可用于验证数学推导的正确性。本 skill 封装 `lake build` 命令，作为无状态验证节点集成到研究管线中。

### REDESIGN_PLAN 原文

> NEW-SKILL-01: `SKILL.md` + `run_lean4.sh` + `status.json`。Lean4 作为无状态验证节点: `lake build` 作为 subprocess，输入 `.lean` 定理文件，输出 PASS/FAIL + proved theorems list。

### 变更

| 文件 | 变更 |
|---|---|
| `skills/lean4-verify/SKILL.md` | 新增：skill 契约文档 |
| `skills/lean4-verify/scripts/bin/run_lean4.sh` | 新增：运行 `lake build` 的 wrapper |
| `skills/lean4-verify/scripts/bin/parse_lean4_output.py` | 新增：解析 Lean4 输出，提取 proved theorems |

### `SKILL.md` 契约

```markdown
---
name: lean4-verify
description: Run Lean4 formal verification on .lean theorem files via `lake build`. Outputs PASS/FAIL + proved theorems list.
---

# lean4-verify

Stateless verification node: given a Lean4 project directory, run `lake build` and report results.

## Prereqs

- `lake` (Lean4 build tool, part of elan/lean4 install)
- A valid `lakefile.lean` or `lakefile.toml` in the project

## Quick start

```bash
bash scripts/bin/run_lean4.sh --project /path/to/lean4-project --out status.json
```

## Outputs

- `status.json`: `{ "result": "PASS"|"FAIL", "proved_theorems": [...], "errors": [...], "build_log": "..." }`

## Out of scope

- Interactive tactic development (use VS Code + Lean4 extension)
- Installing/managing elan/lean4 toolchain
```

### `run_lean4.sh` 设计

```bash
#!/usr/bin/env bash
# 1. Validate --project exists and has lakefile.lean or lakefile.toml
# 2. Run `lake build` in project dir, capture stdout+stderr
# 3. Parse output via parse_lean4_output.py
# 4. Write status.json to --out
# Exit codes: 0=PASS, 1=FAIL, 2=env error (lake not found)
```

### `parse_lean4_output.py` 设计

```python
# Parse lake build output:
# - Extract proved theorems from "✓ compiled <module>" lines
# - Extract errors from "error:" lines
# - Determine PASS (0 errors) or FAIL (any error)
# Output: JSON { result, proved_theorems, errors, build_log }
```

### 验收检查点

- [ ] `skills/lean4-verify/SKILL.md` 存在且格式正确
- [ ] `run_lean4.sh --project <path>` 可执行 Lean4 验证（如 `lake` 可用）
- [ ] `run_lean4.sh` 在 `lake` 不可用时 exit 2（graceful degradation）
- [ ] `status.json` 包含 `result` (PASS/FAIL) + `proved_theorems` + `errors`
- [ ] `parse_lean4_output.py` 有基本单元测试（mock `lake build` 输出）

---

## 实现顺序

1. **先** M-07（最小变更，JSON Schema 修改 + 验证）
2. **然后** M-04（TS 测试文件，依赖了解当前 schema 转换机制）
3. **最后** NEW-SKILL-01（独立 skill，不依赖其他修改）

## 交付与 Review 流程

1. 实现完成后运行相关测试确认通过
2. 提交至 `main` 并推送
3. 创建 review packet 并执行 `review-swarm`
4. 按 CLAUDE.md §多模型收敛检查 迭代至收敛

### 收敛后必须执行（每次 batch 交付的标准结束步骤）

5. **更新 REDESIGN_PLAN 验收检查点** — 将 M-04、M-07、NEW-SKILL-01 对应 `[ ]` 改为 `[x]`

6. **更新 `meta/remediation_tracker_v1.json`** — 将对应 item 的 `status` 改为 `"done"`，`note` 字段补充实现摘要（LOC、关键设计决策、测试数量）

7. **更新 Serena memory** — 用 `serena:write_memory` 写入本批次的关键经验：
   - `architecture-decisions`：若有跨组件设计决策（如 schema fidelity 测试约定、x-* 扩展策略）
   - `codebase-gotchas`：若发现代码库隐式约定或陷阱
   - `task-completion-checklist`：若本批次执行中发现流程需要补充

   写入格式（CLAUDE.md §跨 Session 知识保留）：
   ```markdown
   ## [YYYY-MM-DD] 类别: 简短标题
   **上下文**: Phase 3 Batch 8
   **发现**: 具体结论
   **影响**: 对后续工作的指导意义
   **关联项**: M-04 / M-07 / NEW-SKILL-01
   ```

8. **生成 `prompt-phase3-impl-batch9.md`**（按 `meta/docs/prompts/` 命名约定）
