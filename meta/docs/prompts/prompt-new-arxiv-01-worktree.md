# NEW-ARXIV-01 — arxiv-mcp 独立 MCP Server (worktree)

## 背景

你正在 autoresearch-lab monorepo 的一个**独立 worktree** 中实现 `arxiv-mcp`（NEW-ARXIV-01）。
目标：将 hep-mcp 中嵌入的 arXiv 访问层提取为 `@autoresearch/arxiv-mcp` 独立包，并新增两个领域无关工具。

完成后向 main 分支发 PR，合并时需同步更新 hep-mcp 的聚合引用。

---

## 执行前必读（按顺序）

1. `AGENTS.md` — 全局约束，重点：200 LOC 硬限制、模块化强制、禁止 `as any`
2. `CLAUDE.md` — monorepo 路径映射、开发命令
3. `packages/hep-mcp/CLAUDE.md` — MCP 开发规范（Zod SSOT、stdio-only、evidence-first）
4. `packages/pdg-mcp/` — 参照模式，读以下文件：
   - `package.json`
   - `src/index.ts`（stdio server 入口模式）
   - `src/tooling.ts`（聚合导出模式，供 hep-mcp 消费）
   - `src/tools/registry.ts`（ToolSpec SSOT 模式）
5. 以下 hep-mcp 源文件（待提取）：
   - `packages/hep-mcp/src/tools/research/arxivSource.ts`（301 LOC）
   - `packages/hep-mcp/src/tools/research/downloadUrls.ts`（152 LOC）
   - `packages/hep-mcp/src/tools/research/paperContent.ts`（475 LOC — **超 200 LOC 硬限制，需拆分**）
   - `packages/hep-mcp/src/tools/research/paperSource.ts`（168 LOC）
   - `packages/hep-mcp/src/api/rateLimiter.ts` — 仅 `ArxivRateLimiter` + `arxivFetch()` 部分
6. `packages/hep-mcp/src/tools/research/index.ts` — 了解现有导出列表
7. `packages/hep-mcp/src/tools/registry.ts` — 搜索 `inspire_paper_source`，了解待转换为 alias 的工具定义

---

## 需要更新导入的 hep-mcp 文件

提取后，以下文件的 arXiv imports 需改为来自 `@autoresearch/arxiv-mcp`：

| 文件 | 现有 import |
|------|-------------|
| `tools/research/deepAnalyze.ts` | `paperContent.js`, `arxivSource.js` |
| `tools/research/measurementExtractor.ts` | `paperContent.js`, `arxivSource.js` |
| `tools/research/parseLatexContent.ts` | `paperContent.js` |
| `tools/research/extractBibliography.ts` | `paperContent.js` |
| `tools/research/extractTables.ts` | `paperContent.js` |
| `tools/research/downloadUrls.ts` | `arxivSource.js` |
| `tools/research/paperSource.ts` | `downloadUrls.js`, `paperContent.js`, `arxivSource.js` |
| `tools/research/index.ts` | 所有 4 个文件 |
| `writing/claimsTable/generator.ts` | `paperSource.js` |
| `tools/registry.ts` | 动态 import `paperSource.js` |

---

## 目标目录结构

```
packages/arxiv-mcp/
├── package.json              # @autoresearch/arxiv-mcp, version 0.1.0
├── tsconfig.json
├── vitest.config.ts
├── src/
│   ├── index.ts              # stdio MCP server 入口
│   ├── tooling.ts            # 聚合导出（工具面 + 低级函数，供 hep-mcp 消费）
│   ├── api/
│   │   ├── rateLimiter.ts    # ArxivRateLimiter + arxivFetch()（从 hep-mcp 提取）
│   │   └── searchClient.ts   # arXiv Atom API 搜索（新增，≤200 LOC）
│   ├── source/
│   │   ├── arxivSource.ts    # resolveArxivId, getArxivSource（从 hep-mcp 提取）
│   │   ├── downloadUrls.ts   # getDownloadUrls（从 hep-mcp 提取）
│   │   ├── paperFetcher.ts   # HTTP 下载逻辑（paperContent.ts 拆分）
│   │   ├── tarExtractor.ts   # tar.gz 解包逻辑（paperContent.ts 拆分）
│   │   ├── paperContent.ts   # getPaperContent 主函数（≤200 LOC，协调上两个模块）
│   │   └── paperSource.ts    # accessPaperSource 统一入口
│   └── tools/
│       ├── registry.ts       # ToolSpec SSOT（3 个工具的 Zod schema + handler）
│       ├── dispatcher.ts     # 参数校验 + 分发
│       ├── mcpSchema.ts      # Zod → MCP inputSchema 转换
│       └── index.ts          # re-export
└── tests/
    └── toolContracts.test.ts
```

---

## 工具规格（Zod SSOT，经 registry.ts 注册）

### 1. `arxiv_paper_source`（迁移自 `inspire_paper_source`）

参数：
```typescript
{
  arxiv_id: z.string(),
  mode: z.enum(["urls", "content", "metadata", "auto"]).default("auto"),
  max_content_kb: z.number().int().positive().max(2048).optional(),
}
```

- 功能与原 `inspire_paper_source` 相同，去掉 INSPIRE recid 兼容逻辑
- `mode: "urls"` → 返回 PDF/LaTeX 下载链接
- `mode: "content"` → 返回 LaTeX 源码内容
- `mode: "metadata"` → 返回元数据
- `mode: "auto"` → 优先 LaTeX，降级 PDF

### 2. `arxiv_search`（新增）

参数：
```typescript
{
  query: z.string().min(1),
  categories: z.array(z.string()).optional(),  // e.g. ["hep-th", "cs.LG"]
  max_results: z.number().int().positive().max(50).default(10),
  start: z.number().int().nonneg().default(0),
  date_from: z.string().optional(),  // YYYYMMDD
}
```

- 调用 arXiv Atom API: `http://export.arxiv.org/api/query`
- 返回结果列表：`{ arxiv_id, title, authors[], abstract, categories[], published, updated }`
- 速率限制：复用 `ArxivRateLimiter`（3 秒间隔）
- `categories` 过滤通过 Atom API `cat:` 参数实现

### 3. `arxiv_get_metadata`（新增）

参数：
```typescript
{
  arxiv_id: z.string(),
}
```

- 调用 arXiv Atom API 单条查询（`id_list=<arxiv_id>`）
- 返回完整元数据：title, authors, abstract, categories, doi, published, updated, journal_ref, primary_category

---

## hep-mcp 侧变更

完成 arxiv-mcp 独立包后，在**同一 PR 中**更新 hep-mcp：

1. `packages/hep-mcp/package.json` — 添加依赖：
   ```json
   "@autoresearch/arxiv-mcp": "workspace:*"
   ```

2. `packages/hep-mcp/src/index.ts` — 参照 PDG 聚合模式，从 `@autoresearch/arxiv-mcp/tooling` import 并聚合工具面

3. `packages/hep-mcp/src/tools/registry.ts` — `inspire_paper_source` handler 改为：
   ```typescript
   // Compat alias → arxiv_paper_source (Phase 3 删除)
   handler: async (args) => arxivMcp.accessPaperSource({ arxiv_id: args.arxiv_id ?? args.inspire_id, ...args })
   ```
   在 description 末尾追加 `(deprecated alias → use arxiv_paper_source)`

4. 将上述"需要更新导入的文件"中的 relative imports 改为 `@autoresearch/arxiv-mcp` imports

5. 删除 hep-mcp 中已迁移的源文件（`arxivSource.ts`、`downloadUrls.ts`、`paperContent.ts`、`paperSource.ts`），同时从 `api/rateLimiter.ts` 删除 `ArxivRateLimiter`/`arxivFetch` 部分

---

## 工具导出设计（tooling.ts）

`tooling.ts` 需导出两类内容：

```typescript
// 1. MCP 聚合接口（供 hep-mcp 注册工具）
export { TOOL_SPECS, getTools, getToolSpecs, type ToolExposureMode, type ToolSpec } from './tools/index.js';

// 2. 低级 client 函数（供 hep-mcp 内部工具继续使用）
export { resolveArxivId, getArxivSource } from './source/arxivSource.js';
export { getDownloadUrls, type GetDownloadUrlsResult } from './source/downloadUrls.js';
export { getPaperContent, type GetPaperContentResult } from './source/paperContent.js';
export { accessPaperSource, type AccessPaperSourceResult } from './source/paperSource.js';
```

---

## 验收检查点

- [ ] `packages/arxiv-mcp/` 独立构建通过（`pnpm build`）
- [ ] `arxiv_search` 可按 query + categories 搜索（不依赖 INSPIRE）
- [ ] `arxiv_paper_source` 支持 urls/content/metadata/auto 四模式
- [ ] `arxiv_get_metadata` 返回完整元数据（title, authors, abstract, categories, doi）
- [ ] hep-mcp 中 `inspire_paper_source` 别名可用，原有测试通过
- [ ] hep-mcp 的 `deepAnalyze`、`measurementExtractor` 等工具功能不变（无 regression）
- [ ] `pnpm -r build` + `pnpm -r test` 全部通过
- [ ] 每个文件 ≤ 200 LOC（`paperContent.ts` 475 LOC 须拆分为 3 个文件）
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

- arXiv Atom API endpoint: `http://export.arxiv.org/api/query`（HTTP，非 HTTPS）
- arXiv ID 格式多样：`2101.00001`、`hep-th/9901001`、`abs/2101.00001`、带/不带版本号 — `resolveArxivId` 已处理，迁移后保留逻辑
- `paperContent.ts`（475 LOC）**必须**拆分，建议：
  - `paperFetcher.ts` — HTTP 下载、streaming、重试（~150 LOC）
  - `tarExtractor.ts` — tar.gz 解包、文件列举（~120 LOC）
  - `paperContent.ts` — `getPaperContent` 协调入口（~120 LOC）
- arxiv-mcp **不知道 INSPIRE 存在**；INSPIRE recid → arXiv ID 的映射保留在 hep-mcp 层
- 速率限制：3 秒间隔，`ArxivRateLimiter` 迁移时保持行为不变
