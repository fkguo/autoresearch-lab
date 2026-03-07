# Phase 3 — Implementation Batch 1

> **作用**: 本文件是 Phase 3 首批实施提示词。Phase 2 完成 44/45（仅 NEW-R14 被 NEW-06 阻塞），
> 转入 Phase 3: 扩展性与治理。

> **通用硬门禁继承**: 本 prompt 默认继承 `meta/docs/prompts/IMPLEMENTATION_PROMPT_CHECKLIST.md`；若本文件与 checklist 同时覆盖同一主题，以更严格者为准。


## 前置状态

- **Phase 2**: 44/45 done（NEW-R14 被 Phase 3 NEW-06 阻塞，不影响启动 Phase 3）
- **Total**: 74/137 done
- **最近 commit**: `c63697d feat(batch10): idea→run creation tool + research workflow schema`
- **测试基线**: 1156 TS tests pass (727 hep-mcp, 170 orchestrator, 142 shared, 41 pdg-mcp, 18 zotero-mcp, 6 idea-mcp, 52 other)

## 启动前必读

1. `serena:read_memory` — `dual-model-review-protocol`、`style-and-conventions`、`architecture-decisions`
2. `CLAUDE.md` §全局约束（无向后兼容负担、禁止临时性命名）
3. `packages/hep-mcp/CLAUDE.md`（Evidence-first I/O, Zod SSOT）

## Batch 1 实施内容

本批次包含 **4 个独立项**，全部为 TS，无内部依赖，可并行实施：

| 项目 | 路径 | LOC 估计 | 依赖 |
|------|------|---------|------|
| M-04 | `packages/hep-mcp/tests/schema-fidelity/` | ~100 | 无 |
| M-13 | `packages/hep-mcp/src/tools/registry.ts` | ~200 | 无 |
| M-17 | `packages/shared/src/network.ts` | ~150 | 无 |
| NEW-CONN-05 | `packages/hep-mcp/src/tools/` | ~100 | NEW-CONN-03 ✅ |

**总计**: ~550 LOC

> **降优先级**: NEW-SKILL-01 (lean4-verify) 移至最后批次。Lean4 在 HEP 理论中实用场景有限
> （路径积分/重整化无法形式化、mathlib 缺物理结构、投入产出比差）。
> 如有需要，后续可替换为更实用的 skill（如 latex-math-audit 或 hep-calc 扩展）。

---

## Item 1: M-04 — Zod→MCP Schema Fidelity Tests

### 背景

`zodToMcpInputSchema()` 将 Zod schema 转换为 MCP JSON Schema `inputSchema`。转换过程可能丢失信息（description、default、constraints 等）。需要 fidelity tests 验证往返等价性。

### 实现要点

1. 新建 `packages/hep-mcp/tests/schema-fidelity/` 目录
2. 选取 10 个关键工具（覆盖不同 schema 复杂度）：
   - 简单参数: `inspire_search`, `hep_health`
   - 嵌套对象: `inspire_deep_research`, `hep_run_writing_create_section_write_packet_v1`
   - 可选+默认: `hep_project_query_evidence`, `hep_run_create`
   - 枚举+union: `inspire_research_navigator`, `inspire_critical_research`
   - 数组: `hep_run_writing_submit_section_candidates_v1`
   - 复杂: `hep_run_create_from_idea`
3. 对每个工具的 Zod schema 调用 `zodToMcpInputSchema()` 并验证：
   - 所有 required 字段在 JSON Schema `required` 数组中
   - 所有 description 保留
   - 枚举值完整
   - default 值保留（如适用）
   - nested object 结构正确

### 新增文件

```
packages/hep-mcp/tests/schema-fidelity/zodMcpFidelity.test.ts  (~100 LOC)
```

### 验收标准

- [ ] 10 个关键工具的 schema fidelity 测试通过
- [ ] 测试验证 required、description、enum、default 等字段保留

---

## Item 2: M-13 — MCP Tool Grouping Labels

### 背景

`registry.ts` 中 ~80 个工具没有逻辑分组。需要添加 `group` 标签支持按领域过滤。

### 实现要点

1. 在 `ToolSpec` 接口中添加 `group` 字段（可选或 required，取决于是否所有工具都应有分组）
2. 定义分组常量:
   ```typescript
   type ToolGroup = 'inspire' | 'project' | 'run' | 'writing' | 'evidence' | 'citation' | 'pdg' | 'zotero' | 'system';
   ```
3. 为 registry 中每个工具添加 `group` 属性
4. 在 `getTools()` 中支持 `group` 过滤:
   ```typescript
   getTools(exposure: string, opts?: { group?: ToolGroup }): ToolSpec[]
   ```
5. 添加测试验证 `getTools('standard', { group: 'writing' })` 仅返回写作工具

### 修改文件

```
packages/hep-mcp/src/tools/registry.ts       — ToolSpec 扩展 + group 标签
packages/hep-mcp/src/tools/dispatcher.ts     — 如需转发 group 信息
packages/hep-mcp/tests/toolGroups.test.ts    — 分组过滤测试 (~60 LOC)
```

### 验收标准

- [ ] `ToolSpec` 含 `group` 字段
- [ ] 所有工具有 group 标签
- [ ] `getTools('standard', { group: 'writing' })` 仅返回写作相关工具
- [ ] contract tests (`toolContracts.test.ts`) 仍通过

---

## Item 3: M-17 — Network Egress Governance

### 背景

当前 `inspireFetch()` 仅限速但不限域名。需要白名单机制防止意外外联。

### 实现要点

1. 在 `packages/shared/src/` 新增网络治理模块
2. 定义白名单:
   ```typescript
   const ALLOWED_DOMAINS = [
     'inspirehep.net',
     'arxiv.org',
     'pdg.lbl.gov',
     '127.0.0.1',
     'localhost',
   ];
   ```
3. 包装 `fetch` 调用，在请求前检查域名
4. 非白名单域名请求抛出 `McpError`
5. 确保 `inspireFetch()`、`arxivFetch()` 等现有封装通过白名单

### 新增/修改文件

```
packages/shared/src/networkGovernance.ts      — 白名单 + 域名检查 (~80 LOC)
packages/shared/tests/networkGovernance.test.ts — 测试 (~70 LOC)
```

### 验收标准

- [ ] 白名单包含 inspirehep.net, arxiv.org, pdg.lbl.gov, 127.0.0.1
- [ ] 非白名单域名请求被拒绝（抛出 McpError）
- [ ] 现有 `inspireFetch` / `arxivFetch` 通过白名单

---

## Item 4: NEW-CONN-05 — Cross-validation → Pipeline Feedback

### 背景

`hep_run_build_measurements` 和 `hep_project_compare_measurements` 在发现 tension 时应返回 `next_actions` 引导后续 review/revision。同时扩展 measurements 消费计算 evidence（`ComputationEvidenceCatalogItemV1`，由 NEW-CONN-03 引入）。

### 实现要点

1. 读取现有 measurements 工具的实现:
   - `packages/hep-mcp/src/tools/` 中搜索 `build_measurements` 和 `compare_measurements`
2. 在 tension 检测结果中添加 `next_actions`:
   ```typescript
   next_actions: [
     { tool: 'hep_run_writing_create_revision_plan_packet_v1', reason: 'Tension detected — revise affected sections' },
   ]
   ```
3. 扩展 measurements 输入源，支持 `ComputationEvidenceCatalogItemV1` 格式
4. 添加测试

### 验收标准

- [ ] tension 发现时 `next_actions` 非空
- [ ] measurements 可消费 `ComputationEvidenceCatalogItemV1`

---

## 实施规范

### 一般约束

- 遵循 `CLAUDE.md` §全局约束（无向后兼容负担、禁止临时命名）
- 模块解析使用 NodeNext，所有相对 import 加 `.js` 后缀
- 错误用 `McpError` (from `@autoresearch/shared`)
- 测试用 Vitest (`vi.fn()`, `describe/it/expect`)
- **注意**: REDESIGN_PLAN 中的旧路径 `hep-research-mcp/` 已重命名为 `hep-mcp/`（NEW-R13）

### 代码量限制

- 代码量限制见上方各 item 的 LOC 估计
- 过大的 LOC 说明设计过度，需简化

### 多模型审核

实现完成后，按 `CLAUDE.md` §多模型收敛检查流程，用 `review-swarm` skill 运行双模型审核。

Review artifact 命名规范:
- System prompt: `~/.autoresearch-lab-dev/batch-reviews/phase3-batch1-review-system.md`
- Review packet: `~/.autoresearch-lab-dev/batch-reviews/phase3-batch1-review-r{M}.md`
- Output dir: `~/.autoresearch-lab-dev/batch-reviews/phase3-batch1-r{M}-review/`

### 测试运行

每次审核前运行：
```bash
pnpm -r build
pnpm -r test
```
确认无回归。

---

## 收敛后操作

1. **Commit**: `feat(phase3-batch1): <summary>`
2. **Push**: `git push`
3. **REDESIGN_PLAN 更新**:
   - 勾掉 M-04, M-13, M-17, NEW-CONN-05 验收项
   - 更新 Phase 3 进度计数
   - 更新总进度: 74 → 78
4. **NON-BLOCKING 处置**: 对每条 NON-BLOCKING finding 做显式处置（见 MEMORY.md 规则）
5. **Serena 记忆更新**: 如有跨组件架构决策或新 codebase gotcha，写入对应记忆
6. **Auto-generate NEXT batch prompt**: 读取 REDESIGN_PLAN 识别下一批可实施项，写入 `meta/docs/prompts/prompt-phase3-impl-batch2.md`

---

## 输出物清单

| 文件/目录 | 说明 |
|-----------|------|
| `packages/hep-mcp/tests/schema-fidelity/zodMcpFidelity.test.ts` | M-04 fidelity tests |
| `packages/hep-mcp/src/tools/registry.ts` | M-13 group 标签 |
| `packages/hep-mcp/tests/toolGroups.test.ts` | M-13 分组测试 |
| `packages/shared/src/networkGovernance.ts` | M-17 网络治理 |
| `packages/shared/tests/networkGovernance.test.ts` | M-17 测试 |
| `packages/hep-mcp/src/tools/` (measurements 相关) | NEW-CONN-05 pipeline feedback |
| `meta/REDESIGN_PLAN.md` | 进度更新 |

## Phase 3 后续批次预览

| 批次 | 内容 | LOC |
|------|------|-----|
| Batch 2 | NEW-06 (MCP tool consolidation — keystone item) | ~400 |
| Batch 3 | NEW-R11 (registry split, depends on M-13), NEW-R12 (idea-runs contract) | ~700 |
| Batch 4 | UX-03/UX-04 (depends on NEW-06), NEW-COMP-02 | ~1000 |
| Batch 5+ | RT-01, RT-04, NEW-RT-05, remaining M-* | TBD |
| Late | NEW-SKILL-01 (lean4-verify, 低优先级) | ~200 |
