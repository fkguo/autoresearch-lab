# NEW-HEPDATA-01 — hepdata-mcp 独立 MCP Server (worktree)

## 模型选择

**主力模型：Sonnet 4.6**（全程）

理由：新建单组件（无迁移、无 regression 风险），~800 LOC，中等复杂度。
按 AGENTS.md 矩阵："单组件 complexity=medium → Sonnet 4.6"，成本效益更优。

如遇复杂架构决策或设计分歧，可临时切换 Opus 4.6，完成后切回。
子 agent 分派（Explore/搜索类）可用 Haiku。

---

## 背景

你正在 autoresearch-lab monorepo 的独立 worktree（`feat/hepdata-mcp`）中从零实现 `hepdata-mcp`（NEW-HEPDATA-01）。

**目标**：构建 `@autoresearch/hepdata-mcp` — 访问 [HEPData](https://www.hepdata.net/) 实验测量数据的独立 stdio MCP server。

HEPData 是 LHC 等对撞机实验测量数据的权威仓库，存储截面、衰变宽度、分支比等数值结果（YAML/JSON），每条记录关联 INSPIRE recid 和 arXiv 论文。

**数据层耦合说明**：INSPIRE recid 是 HEPData 的主要检索键，但 hepdata-mcp **代码层无 INSPIRE 依赖**——recid 只是字符串输入参数。工作流协作（`inspire_search` → recid → `hepdata_search`）在 hep-mcp 聚合层通过 `next_actions` hints 实现。

**HEPData 上没有现成 MCP 实现**（GitHub 搜索 "hepdata mcp" 返回 0 结果），这是新领域。

---

## 执行流程（必须按顺序）

```
Phase A: 探索 → 方案 → 双模型审核（不写代码）
Phase B: 实现（API client → 工具 → hep-mcp 集成）→ 分阶段审核
Phase C: 最终全量双模型审核
Phase D: PR
```

---

## Phase A：探索与方案

### A-1 必读文件

1. `AGENTS.md` + `CLAUDE.md` — 全局约束
2. `packages/hep-mcp/CLAUDE.md` — MCP 规范
3. `packages/pdg-mcp/` — 参照模式：
   - `package.json`, `src/index.ts`, `src/tooling.ts`
   - `src/tools/registry.ts`, `src/tools/dispatcher.ts`
   - `tests/toolContracts.test.ts`
4. `packages/hep-mcp/src/index.ts` — PDG 聚合模式（了解 hep-mcp 如何 import pdg-mcp/tooling）

### A-2 HEPData API 调研

用 `snag` 调研 HEPData API（**必须执行**，建立对 API 的第一手理解）：

```bash
snag --quiet "https://hepdata.readthedocs.io/en/latest/api.html"
snag --quiet "https://hepdata.readthedocs.io/en/latest/terms.html"
```

核心 endpoints（已预研，供参考）：

| Endpoint | 说明 |
|----------|------|
| `GET /api/search/?inspire_id=<recid>&size=10` | 按 INSPIRE recid 搜索 |
| `GET /api/search/?arxiv_id=<id>&size=10` | 按 arXiv ID 搜索 |
| `GET /api/search/?q=<query>&page=1&size=10` | 关键词搜索 |
| `GET /api/records/<hepdata_id>?format=json` | 获取 record 详情 |
| `GET /api/<hepdata_id>/tables/<table_id>?format=json` | 获取数据表（JSON） |
| `GET /api/<hepdata_id>/tables/<table_id>?format=yaml` | 获取数据表（原生 YAML） |
| `GET /api/download/submission/<hepdata_id>/original` | 下载完整数据包（zip） |

用 curl 测试一个真实查询（先确认 API 可用）：

```bash
# 按知名论文的 INSPIRE recid 搜索（例如 Higgs 发现论文 recid=1124337）
https_proxy=http://127.0.0.1:7890 curl -s "https://www.hepdata.net/api/search/?inspire_id=1124337&format=json" | python3 -m json.tool | head -60
```

理解 API 返回结构后，记录到方案文档。

### A-3 输出方案文档

写出详细方案（存为 `plan.md` 在 worktree 根目录），包含：

1. **目录结构**（每个文件职责 + LOC 估计）
2. **API client 设计**（函数签名、返回类型接口）
3. **工具规格**（4 个工具的 Zod schema 草稿）
4. **`hepdata_id` vs INSPIRE recid 的关系说明**（搜索返回 hepdata_id，后续操作用 hepdata_id）
5. **速率限制策略**（HEPData 公共 API，建议间隔）
6. **hep-mcp 变更**（聚合 + next_actions hints 实现位置）
7. **测试策略**（contract tests + mock API 测试）

### A-4 方案双模型审核

```bash
cat > /tmp/hepdata-plan-review-system.md << 'EOF'
你是一位资深 TypeScript MCP 工程师，正在对 hepdata-mcp 实现方案进行审核。
重点检查：
- 架构合理性（文件划分、职责分离、200 LOC 约束）
- Zod SSOT 合规性
- HEPData REST API 集成的正确性（hepdata_id 与 INSPIRE recid 的区别）
- hep-mcp 聚合层的 next_actions hints 实现方案
- 错误处理完整性（API 不可用、record 不存在、表数据格式错误）

输出格式（严格 JSON）：
{"verdict": "PASS|FAIL", "blocking_issues": ["..."], "amendments": [{"target":"...","change":"..."}], "positive_findings": ["..."]}
EOF

cat > /tmp/hepdata-plan-review-r1.md << 'EOF'
## 审核对象
hepdata-mcp (NEW-HEPDATA-01) 实现方案

## 方案文件
见 worktree 根目录 plan.md

## 核心设计决策
[将 plan.md 中的关键章节粘贴在此]

## 审核重点
1. hepdata_id（HEPData 内部 ID）与 INSPIRE recid 的区分是否清晰
2. 4 个工具的 Zod schema 是否覆盖所有边界情况
3. hep-mcp next_actions hints 的实现位置是否合理
4. 速率限制策略是否合适（HEPData 是公共 API）
5. YAML 格式数据表的解析策略
EOF

python3 skills/review-swarm/scripts/bin/run_multi_task.py \
  --out-dir ~/.autoresearch-lab-dev/batch-reviews/hepdata-plan-r1 \
  --system /tmp/hepdata-plan-review-system.md \
  --prompt /tmp/hepdata-plan-review-r1.md \
  --fallback-mode auto
```

---

## Phase B：实现

### B-1 实现顺序

```
packages/hepdata-mcp/
├── package.json + tsconfig.json + vitest.config.ts
├── src/api/
│   ├── rateLimiter.ts    # HEPDataRateLimiter（参照 pdg-mcp，≤80 LOC）
│   └── client.ts         # HEPData REST API 客户端（≤200 LOC）
└── src/tools/
    ├── registry.ts       # 4 个工具 Zod schema + handler（≤200 LOC）
    ├── dispatcher.ts
    ├── mcpSchema.ts
    └── index.ts
├── src/index.ts          # stdio server 入口
└── src/tooling.ts        # 聚合导出
tests/toolContracts.test.ts
```

**每个文件 ≤ 200 LOC。**

### B-2 阶段审核（API client 完成后）

API client 完成（`src/api/` 两个文件）后，在继续工具实现之前：

```bash
cat > /tmp/hepdata-stage1-review-r1.md << 'EOF'
## 审核对象：hepdata-mcp API client 层

## 文件（直接读取）
- packages/hepdata-mcp/src/api/rateLimiter.ts
- packages/hepdata-mcp/src/api/client.ts

## 审核重点
1. searchRecords() 是否正确处理 inspire_id / arxiv_id / q 三种模式
2. getTable() 是否正确处理 YAML 格式（返回原始字符串）和 JSON 格式（解析为结构化对象）
3. 速率限制是否合理
4. 错误处理：HTTP 4xx/5xx、record 不存在、网络超时
5. TypeScript 类型定义是否准确（HepDataRecord、HepDataTable 接口）
EOF

python3 skills/review-swarm/scripts/bin/run_multi_task.py \
  --out-dir ~/.autoresearch-lab-dev/batch-reviews/hepdata-stage1-r1 \
  --system /tmp/hepdata-plan-review-system.md \
  --prompt /tmp/hepdata-stage1-review-r1.md \
  --fallback-mode auto
```

修复所有 BLOCKING 后继续。

### B-3 hep-mcp 聚合集成

工具完成、`pnpm -r build` + `pnpm -r test` 通过后：

1. `packages/hep-mcp/package.json` → 添加 `@autoresearch/hepdata-mcp: workspace:*`
2. `packages/hep-mcp/src/index.ts` → 聚合 hepdata-mcp 工具（仿 PDG 模式）
3. **next_actions hints**：在 `inspire_search` 工具返回包含 INSPIRE recid 时，在摘要末尾附加：
   ```
   next_actions: ["hepdata_search(inspire_recid=<recid>) — 查找该论文的实验数据"]
   ```
   参考 `NEW-CONN-02` 在 review feedback 中添加 hints 的实现位置。

---

## Phase C：最终全量双模型审核

```bash
cat > /tmp/hepdata-final-review-r1.md << 'EOF'
## 审核对象：hepdata-mcp (NEW-HEPDATA-01) 完整实现

## 新增文件（packages/hepdata-mcp/）
- src/api/rateLimiter.ts
- src/api/client.ts
- src/tools/registry.ts, dispatcher.ts, mcpSchema.ts, index.ts
- src/index.ts, src/tooling.ts
- tests/toolContracts.test.ts
- package.json, tsconfig.json, vitest.config.ts

## 修改文件（packages/hep-mcp/）
- package.json（新依赖）
- src/index.ts（聚合 hepdata 工具）
- src/tools/registry.ts（inspire_search next_actions hints）

## 验收检查点
- [ ] packages/hepdata-mcp/ 独立构建通过
- [ ] hepdata_search 可按 INSPIRE recid 和 arXiv ID 查找 record
- [ ] hepdata_get_table 返回数值数据（x/y 列 + 误差 + 单位）
- [ ] hepdata_download 写入 artifacts 并返回 hep:// URI（原子写入）
- [ ] hep-mcp 聚合通过，hepdata_* 工具可用
- [ ] inspire_search 返回包含 next_actions hint
- [ ] pnpm -r build + pnpm -r test 全部通过
- [ ] 每个文件 ≤200 LOC，无 as any, @ts-ignore, 空 catch
EOF

python3 skills/review-swarm/scripts/bin/run_multi_task.py \
  --out-dir ~/.autoresearch-lab-dev/batch-reviews/hepdata-final-r1 \
  --system /tmp/hepdata-plan-review-system.md \
  --prompt /tmp/hepdata-final-review-r1.md \
  --fallback-mode auto
```

**收敛要求**：Codex + Gemini 均 0 blocking，最多 5 轮。

---

## Phase D：PR

```bash
git push -u origin feat/hepdata-mcp
# 在 GitHub 创建 PR → main
```

---

## 工具规格参考（Zod SSOT）

### `hepdata_search`
```typescript
{
  inspire_recid: z.number().int().positive().optional(),
  arxiv_id: z.string().optional(),
  doi: z.string().optional(),
  query: z.string().optional(),
  page: z.number().int().positive().default(1),
  size: z.number().int().positive().max(25).default(10),
}
// 至少提供 inspire_recid / arxiv_id / doi / query 之一（用 z.refine 验证）
```

### `hepdata_get_record`
```typescript
{ hepdata_id: z.number().int().positive() }
// 返回: { hepdata_id, title, inspire_recid, arxiv_id, doi, collaborations[], abstract, data_tables: [{id, name, title}] }
```

### `hepdata_get_table`
```typescript
{
  hepdata_id: z.number().int().positive(),
  table_id: z.number().int().positive(),
  format: z.enum(["json", "yaml"]).default("json"),
}
// JSON: 解析后的结构化对象（x/y 列 + 误差 + 单位）
// YAML: 原始字符串（HEPData 原生格式，保留完整误差信息）
```

### `hepdata_download`
```typescript
{
  hepdata_id: z.number().int().positive(),
  _confirm: z.literal(true),   // destructive，必须显式确认
}
// 原子写入到 ${HEP_DATA_DIR}/artifacts/hepdata/<id>/submission.zip
// 返回: { uri: "hep://artifacts/hepdata/<id>/submission.zip", size_bytes, tables_count }
```

---

## 关键技术注意事项

1. **hepdata_id ≠ INSPIRE recid**：`hepdata_search` 输入 recid，返回 `hepdata_id`（整数）；后续 `get_record/get_table/download` 都用 `hepdata_id`
2. **YAML 数据表格式**：
   ```yaml
   independent_variables: [{header: {name: "x"}, values: [{value: 1.0}]}]
   dependent_variables:   [{header: {name: "y"}, values: [{value: 2.0, errors: [{symerror: 0.1, label: "stat"}]}]}]
   ```
3. **速率限制**：HEPData 公共 API，建议 1 秒间隔（保守）
4. **原子写入**：`hepdata_download` 必须 `.tmp` → `fsync` → `rename`
5. **hepdata-mcp 零 INSPIRE 代码依赖**：recid 只是整数/字符串，无需 import 任何 INSPIRE 相关模块
