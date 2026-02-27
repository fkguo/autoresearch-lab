# NEW-HEPDATA-01 — hepdata-mcp 独立 MCP Server (worktree)

## 背景

你正在 autoresearch-lab monorepo 的一个**独立 worktree** 中实现 `hepdata-mcp`（NEW-HEPDATA-01）。
目标：从零构建 `@autoresearch/hepdata-mcp` — 一个访问 [HEPData](https://www.hepdata.net/) 实验测量数据的独立 stdio MCP server，遵循 pdg-mcp 模式。

HEPData 是 HEP 实验测量数据的权威仓库，存储 LHC 及其他对撞机实验的截面、衰变宽度、分支比等数值结果（YAML/JSON 格式），每条记录关联 INSPIRE recid 和 arXiv 论文。

**数据层耦合说明**：HEPData 与 INSPIRE 在数据层有耦合（INSPIRE recid 是主要检索键），但在代码层**无耦合**——hepdata-mcp 只接受 recid 字符串作为输入参数，不调用任何 INSPIRE 代码。hep-mcp 聚合层负责工作流连通（`inspire_search` → recid → `hepdata_search`）。

完成后向 main 分支发 PR，合并时需在 hep-mcp 中添加聚合和 next_actions hints。

---

## 执行前必读（按顺序）

1. `AGENTS.md` — 全局约束，重点：200 LOC 硬限制、模块化强制、禁止 `as any`
2. `CLAUDE.md` — monorepo 路径映射、开发命令
3. `packages/hep-mcp/CLAUDE.md` — MCP 开发规范（Zod SSOT、stdio-only、evidence-first）
4. `packages/pdg-mcp/` — 参照模式，读以下文件：
   - `package.json`（结构模板）
   - `src/index.ts`（stdio server 入口模式）
   - `src/tooling.ts`（聚合导出模式）
   - `src/tools/registry.ts`（ToolSpec SSOT + Zod schema 模式）
   - `src/tools/dispatcher.ts`（参数校验 + 分发模式）
   - `tests/toolContracts.test.ts`（contract test 模式）
5. 用 `snag` 了解 HEPData REST API：
   ```bash
   snag --quiet "https://hepdata.readthedocs.io/en/latest/api.html"
   snag --quiet "https://www.hepdata.net/api/"
   ```
   关键 endpoints：
   - `GET /api/search/?q=<query>&page=1&size=10` — 全文搜索
   - `GET /api/search/?inspire_id=<recid>` — 按 INSPIRE recid 查找
   - `GET /api/search/?arxiv_id=<arxiv_id>` — 按 arXiv ID 查找
   - `GET /api/records/<hepdata_id>?format=json` — 获取 record 详情
   - `GET /api/<hepdata_id>/tables/<table_id>?format=json|yaml` — 获取数据表
   - `GET /api/download/submission/<hepdata_id>/original` — 下载完整数据包（zip）

---

## 目标目录结构

```
packages/hepdata-mcp/
├── package.json              # @autoresearch/hepdata-mcp, version 0.1.0
├── tsconfig.json
├── vitest.config.ts
├── src/
│   ├── index.ts              # stdio MCP server 入口（≤100 LOC）
│   ├── tooling.ts            # 聚合导出（供 hep-mcp 消费）
│   ├── api/
│   │   ├── rateLimiter.ts    # HEPDataRateLimiter + hepdataFetch()（≤80 LOC）
│   │   └── client.ts         # HEPData REST API 客户端（搜索/record/table/下载）（≤200 LOC）
│   └── tools/
│       ├── registry.ts       # ToolSpec SSOT（4 个工具 Zod schema + handler）（≤200 LOC）
│       ├── dispatcher.ts     # 参数校验 + 分发（≤80 LOC）
│       ├── mcpSchema.ts      # Zod → MCP inputSchema 转换（≤50 LOC）
│       └── index.ts          # re-export（≤30 LOC）
└── tests/
    └── toolContracts.test.ts  # contract tests（工具名/schema/handler 存在性）
```

---

## 工具规格（Zod SSOT，经 registry.ts 注册）

### 1. `hepdata_search`

```typescript
{
  // 至少提供一个检索条件
  inspire_recid: z.number().int().positive().optional(),   // INSPIRE record ID
  arxiv_id: z.string().optional(),                          // e.g. "2101.00001"
  doi: z.string().optional(),
  query: z.string().optional(),                             // 关键词全文搜索
  page: z.number().int().positive().default(1),
  size: z.number().int().positive().max(25).default(10),
}
```

返回：`{ total: number, results: [{ hepdata_id, title, inspire_recid, arxiv_id, collaborations[], data_tables_count, doi }] }`

实现：`GET /api/search/` 带相应查询参数

### 2. `hepdata_get_record`

```typescript
{
  hepdata_id: z.number().int().positive(),
}
```

返回：`{ hepdata_id, title, inspire_recid, arxiv_id, doi, collaborations[], abstract, data_tables: [{ id, name, title, doi }] }`

实现：`GET /api/records/<hepdata_id>?format=json`

### 3. `hepdata_get_table`

```typescript
{
  hepdata_id: z.number().int().positive(),
  table_id: z.number().int().positive(),
  format: z.enum(["json", "yaml"]).default("json"),
}
```

返回：数值数据（x/y 列、误差、单位、qualifier）；JSON 格式解析后返回结构化对象，YAML 格式返回原始字符串

实现：`GET /api/<hepdata_id>/tables/<table_id>?format=json|yaml`

### 4. `hepdata_download`

```typescript
{
  hepdata_id: z.number().int().positive(),
  _confirm: z.literal(true),  // destructive（写入 artifacts）必须确认
}
```

返回：`{ uri: "hep://artifacts/<hepdata_id>/hepdata_submission.zip", size_bytes: number, tables_count: number }`

实现：`GET /api/download/submission/<hepdata_id>/original`，写入 artifacts 目录，返回 `hep://` URI

---

## API 客户端设计（api/client.ts）

```typescript
// 封装 HEPData REST API，复用 hepdataFetch()（带速率限制）

export interface HepDataSearchResult { ... }
export interface HepDataRecord { ... }
export interface HepDataTable { ... }

export async function searchRecords(params: SearchParams): Promise<HepDataSearchResult>
export async function getRecord(hepdataId: number): Promise<HepDataRecord>
export async function getTable(hepdataId: number, tableId: number, format: "json" | "yaml"): Promise<HepDataTable | string>
export async function downloadSubmission(hepdataId: number): Promise<ArrayBuffer>
```

速率限制：HEPData 为公共 REST API，建议 1 秒间隔（保守）。

---

## tooling.ts 导出（供 hep-mcp 聚合）

```typescript
export { TOOL_SPECS, getTools, getToolSpecs, type ToolExposureMode, type ToolSpec } from './tools/index.js';
// hepdata-mcp 无需导出低级 client 函数（与 pdg-mcp 相同）
```

---

## hep-mcp 侧变更

完成 hepdata-mcp 独立包后，在**同一 PR 中**更新 hep-mcp：

1. `packages/hep-mcp/package.json` — 添加依赖：
   ```json
   "@autoresearch/hepdata-mcp": "workspace:*"
   ```

2. `packages/hep-mcp/src/index.ts` — 参照 PDG 聚合模式，聚合 hepdata-mcp 工具

3. **next_actions hints**（NEW-CONN 层）：在 `inspire_search` 等工具的返回摘要中，当结果包含 INSPIRE recid 时，在 `next_actions` 字段中追加：
   ```
   "hepdata_search(inspire_recid=<recid>)"
   ```
   参考 NEW-CONN-02 在 review feedback 中添加 hints 的实现模式。

---

## 验收检查点

- [ ] `packages/hepdata-mcp/` 独立构建通过（`pnpm build`）
- [ ] `hepdata_search` 可按 INSPIRE recid 和 arXiv ID 查找 record
- [ ] `hepdata_get_table` 返回数值数据（x/y 列 + 误差 + 单位）
- [ ] `hepdata_download` 写入 artifacts 并返回 `hep://` URI
- [ ] hep-mcp 聚合 `hepdata-mcp` 工具，`hepdata_*` 工具可用
- [ ] hep-mcp `inspire_search` 结果中包含 `next_actions` hint
- [ ] `pnpm -r build` + `pnpm -r test` 全部通过
- [ ] 每个文件 ≤ 200 LOC
- [ ] 无 `as any`、`@ts-ignore`、空 catch

---

## 验收命令

```bash
pnpm -r build
pnpm -r test
make smoke     # MCP server 冒烟测试（从 repo 根目录）
```

---

## 关键注意事项

- HEPData REST API base: `https://www.hepdata.net/api/`（HTTPS）
- `hepdata_id` 是 HEPData 内部 ID（整数），不同于 INSPIRE recid；`hepdata_search` 通过 recid 查找后返回 `hepdata_id`
- YAML 格式的数据表是 HEPData 的原生格式，包含完整的误差信息；JSON 格式是简化的结构化表示
- `hepdata_download` 写入路径：`${HEP_DATA_DIR}/artifacts/hepdata/<hepdata_id>/hepdata_submission.zip`，原子写入（.tmp → rename）
- hepdata-mcp **不导入任何 INSPIRE 代码**；与 INSPIRE 的工作流协作完全在 hep-mcp 聚合层处理
- HEPData 有分页（page/size 参数），`size` 建议 ≤ 25 避免超时
- 数据表的 YAML 格式示例：`independent_variables: [x], dependent_variables: [y, errors]`；解析时注意 `errors: [{symerror: ..., label: ...}]` 结构
