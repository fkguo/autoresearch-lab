# Phase 3 Implementation Batch 7: NEW-SKILL-WRITING + NEW-CONN-05

> **前置条件**: Phase 3 Batch 5 (RT-05 Information Membrane) 已完成并通过 review-swarm 收敛。

## 范围

本批次实现两个小型 Phase 3 item：

1. **NEW-SKILL-WRITING**: 增强 research-writer Skill (~200 LOC)
2. **NEW-CONN-05**: Cross-validation → Pipeline Feedback (~100 LOC)

总计约 ~300 LOC 新代码。

---

## 前置步骤

### 1. 读取 Serena memory，确认是否最新

用 `serena:list_memories` 列出所有记忆文件，然后读取与本批次相关的记忆：

- `architecture-decisions` — 跨组件设计决策（hep-mcp measurements、research-writer skill 集成模式）
- `task-completion-checklist` — 交付流程检查清单
- `codebase-gotchas` — 代码库陷阱（TypeScript 构建、Zod SSOT 约定）

确认各记忆文件与 git log 的实际状态一致；若发现过时条目，先更新后再开始实现。

### 2. 前置确认

- 确认 `meta/REDESIGN_PLAN.md` 中 RT-05 已标记为 ✅
- 确认 NEW-06 (写作管线移除) 已完成（NEW-SKILL-WRITING 的依赖）
- 确认 NEW-CONN-03 已完成（NEW-CONN-05 的依赖）
- 确认 `meta/remediation_tracker_v1.json` 中上述依赖项 `status` 均为 `"done"`

---

## Item 1: NEW-SKILL-WRITING — 增强 research-writer Skill

### 背景

research-writer 已实现 RevTeX scaffold + outline + section generation + LaTeX compilation。但缺少与 hep-mcp evidence catalog 的集成。

### 变更

1. 修订 `skills/research-writer/SKILL.md` — 添加 hep-mcp evidence 工具调用流程
2. 添加 evidence grounding 步骤: `hep_project_query_evidence` / `hep_project_query_evidence_semantic` → 每节写作前检索相关 evidence
3. Citation 来源从 evidence catalog 获取（INSPIRE recid + arXiv ID），非硬编码 allowlist
4. 通过 `hep_render_latex` 渲染 + `hep_export_project` 打包
5. Section-by-section 写作策略在 skill 层显式化

### 涉及文件

| 文件 | 变更 |
|---|---|
| `skills/research-writer/SKILL.md` | 修订：添加 evidence 工具调用流程、grounding 步骤 |
| `skills/research-writer/scripts/bin/*.sh` | 如需：脚本增强以支持 evidence 检索 |

### 验收检查点

- [ ] `SKILL.md` 包含 hep-mcp evidence 工具调用流程
- [ ] 每节写作前检索 evidence (BM25 或 semantic)
- [ ] 调用 `hep_render_latex` + `hep_export_project`
- [ ] 端到端: evidence → outline → section draft → render → export

---

## Item 2: NEW-CONN-05 — Cross-validation → Pipeline Feedback

### 背景

`hep_run_build_measurements` 和 `hep_project_compare_measurements` 在发现 tension 时需要返回 `next_actions` 到 review/revision，实现交叉验证与管线的反馈连通。

### 变更

扩展 measurements 消费工具返回 `next_actions` 字段，当检测到 tension（σ ≥ 指定阈值）时建议后续操作。

### 涉及文件

| 文件 | 变更 |
|---|---|
| `packages/hep-mcp/src/core/measurements/compareMeasurements.ts` | 添加 `next_actions` 生成逻辑 |
| `packages/hep-mcp/tests/core/compareMeasurements.test.ts` | 添加 next_actions 测试 |

### 验收检查点

- [ ] tension 发现时 next_actions 非空
- [ ] next_actions 包含建议操作（如 "review evidence", "check systematic uncertainties"）

---

## 实现顺序

1. **先** NEW-SKILL-WRITING（纯 Markdown/脚本修改，低风险）
2. **后** NEW-CONN-05（TypeScript 代码修改，需要测试）

## 交付与 Review 流程

1. 实现完成后运行相关测试确认通过
2. 提交至 `main` 并推送
3. 创建 review packet 并执行 `review-swarm`
4. 按 CLAUDE.md §多模型收敛检查 迭代至收敛

### 收敛后必须执行（每次 batch 交付的标准结束步骤）

5. **更新 REDESIGN_PLAN 验收检查点** — 将 NEW-SKILL-WRITING 和 NEW-CONN-05 对应 `[ ]` 改为 `[x]`

6. **更新 `meta/remediation_tracker_v1.json`** — 将对应 item 的 `status` 改为 `"done"`，`note` 字段补充实现摘要（LOC、关键设计决策、测试数量）

7. **更新 Serena memory** — 用 `serena:write_memory` 写入本批次的关键经验：
   - `architecture-decisions`：若有跨组件设计决策（如 hep-mcp measurements 接口变更、evidence catalog 调用约定）
   - `codebase-gotchas`：若发现代码库隐式约定或陷阱
   - `task-completion-checklist`：若本批次执行中发现流程需要补充

   写入格式（CLAUDE.md §跨 Session 知识保留）：
   ```markdown
   ## [YYYY-MM-DD] 类别: 简短标题
   **上下文**: Phase 3 Batch 6
   **发现**: 具体结论
   **影响**: 对后续工作的指导意义
   **关联项**: NEW-SKILL-WRITING / NEW-CONN-05
   ```

8. **生成 `prompt-phase3-impl-batch7.md`**（按 `meta/docs/prompts/` 命名约定）
