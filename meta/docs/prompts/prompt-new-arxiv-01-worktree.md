# NEW-ARXIV-01 — arxiv-mcp 独立 MCP Server (worktree)

## 模型选择

**主力模型：Opus 4.6**（全程）

理由：这是**跨组件架构迁移**——同时改动 hep-mcp（10+ import 站点 + backward compat alias）
和新建 arxiv-mcp，regression 风险高。按 AGENTS.md 矩阵："跨组件架构变更 → Opus 4.6"。
SWE-bench 75.6% vs Sonnet ~71%，在这类任务上差距被放大。

子 agent 分派（Explore/搜索类）可用 Haiku/Sonnet，但主会话保持 Opus。

---

## 背景

你正在 autoresearch-lab monorepo 的独立 worktree（`feat/arxiv-mcp`）中实现 `arxiv-mcp`（NEW-ARXIV-01）。

**目标**：将 hep-mcp 中嵌入的 arXiv 访问层提取为 `@autoresearch/arxiv-mcp` 独立包，
并新增两个领域无关工具（`arxiv_search` + `arxiv_get_metadata`）。
完成后向 main 发 PR，合并时同步更新 hep-mcp 聚合引用。

---

## 执行流程（必须按顺序）

```
Phase A: 探索 → 方案 → 双模型审核（不写代码）
Phase B: 实现阶段 1（arxiv-mcp 脚手架 + API client）→ 阶段审核
Phase C: 实现阶段 2（工具注册 + hep-mcp 集成）→ 最终全量审核
Phase D: PR
```

**不允许跳过 Phase A 直接写代码。**

---

## Phase A：探索与方案

### A-1 必读文件

按顺序读取（可用子 agent 并行读多个）：

1. `AGENTS.md` + `CLAUDE.md` — 全局约束（200 LOC 硬限制、Zod SSOT、禁止 `as any`）
2. `packages/hep-mcp/CLAUDE.md` — MCP 开发规范
3. `packages/pdg-mcp/` — 参照模式：
   - `package.json`, `src/index.ts`, `src/tooling.ts`
   - `src/tools/registry.ts`, `src/tools/dispatcher.ts`
   - `tests/toolContracts.test.ts`
4. hep-mcp 中待提取的源文件（读完整内容）：
   - `packages/hep-mcp/src/tools/research/arxivSource.ts`（301 LOC）
   - `packages/hep-mcp/src/tools/research/downloadUrls.ts`（152 LOC）
   - `packages/hep-mcp/src/tools/research/paperContent.ts`（475 LOC — **超 200 LOC 硬限制**）
   - `packages/hep-mcp/src/tools/research/paperSource.ts`（168 LOC）
   - `packages/hep-mcp/src/api/rateLimiter.ts`（仅 `ArxivRateLimiter` + `arxivFetch()` 部分）
5. hep-mcp 中需要更新 import 的文件（**GitNexus blast radius 分析结果，比直觉多**）：

   **直接 import 源文件（arxivSource/paperContent/paperSource/downloadUrls）**：
   - `packages/hep-mcp/src/tools/research/deepAnalyze.ts`
   - `packages/hep-mcp/src/tools/research/measurementExtractor.ts`
   - `packages/hep-mcp/src/tools/research/parseLatexContent.ts`
   - `packages/hep-mcp/src/tools/research/extractBibliography.ts`
   - `packages/hep-mcp/src/tools/research/extractTables.ts`
   - `packages/hep-mcp/src/tools/research/index.ts`
   - `packages/hep-mcp/src/tools/writing/claimsTable/extractor.ts`（calls `getPaperContent`）
   - `packages/hep-mcp/src/tools/registry.ts`（dynamic import `paperSource`）

   **直接 import `arxivFetch` from rateLimiter（原始 prompt 遗漏）**：
   - `packages/hep-mcp/src/core/evidence.ts`（calls `getPaperContent`）
   - `packages/hep-mcp/src/core/writing/evidenceIndex.ts`（calls `arxivFetch` + `getPaperContent`）
   - `packages/hep-mcp/src/corpora/style/downloader.ts`（calls `arxivFetch` + `resolveArxivId`）

   合计 **11 个文件**需要更新 import（不含内部相互依赖的 4 个源文件）。
   GitNexus 总 blast radius：`getPaperContent` = **CRITICAL**（17 符号，5 模块，20 执行流）。

### A-2 参考实现调研

已有开源 arXiv MCP 实现，读取以下关键内容以汲取经验：

**blazickjp/arxiv-mcp-server**（2228 stars, Python）关键发现：
- arXiv Atom API 有 URL encoding 陷阱：`submittedDate:[YYYYMMDD+TO+YYYYMMDD]`
  中的 `+TO+` **不能被 URL encode**，否则日期过滤失效
- 正确 endpoint：`https://export.arxiv.org/api/query`（HTTPS，非 HTTP）
- XML 需处理两个命名空间：`atom:` (`http://www.w3.org/2005/Atom`) 和 `arxiv:` (`http://arxiv.org/schemas/atom`)
- 有效分类前缀：`cs`, `math`, `physics`, `hep-th`, `hep-ph`, `hep-ex`, `hep-lat`,
  `astro-ph`, `cond-mat`, `gr-qc`, `math-ph`, `nlin`, `nucl-ex`, `nucl-th`, `quant-ph` 等

**takashiishida/arxiv-latex-mcp**（106 stars）关键发现：
- 基于 `arxiv-to-prompt` 库处理 LaTeX 源码，提供 section-level 访问
- 工具面：`get_paper_prompt`（全文 LaTeX）、`list_paper_sections`、`get_paper_section`
- 这与我们现有的 `paperContent.ts`（LaTeX 下载 + tar 解包）功能互补，可参考其 section 提取思路

### A-3 输出方案文档

探索完成后，**写出详细方案**（存为 `plan.md` 在 worktree 根目录），必须包含：

1. **目录结构**（每个文件的职责，含 LOC 估计）
2. **paperContent.ts 拆分方案**（475 LOC → 具体拆分为哪几个文件，各含什么函数）
3. **工具规格**（3 个工具的 Zod schema 草稿）
4. **hep-mcp 变更列表**（逐文件：哪行 import 改成什么）
5. **`inspire_paper_source` alias 实现方式**
6. **测试策略**（unit tests + contract tests 各测什么）
7. **风险点**（URL encoding、tar 解包边界情况、regression 风险等）

### A-4 方案双模型审核

方案完成后，立即提交审核（**不写代码**）：

```bash
# 1. 写 system prompt
cat > /tmp/arxiv-plan-review-system.md << 'EOF'
你是一位资深 TypeScript MCP 工程师，正在对 arxiv-mcp 实现方案进行代码审查前的方案审核。
重点检查：
- 架构合理性（文件划分、职责分离、200 LOC 约束）
- Zod SSOT 合规性（工具参数以 Zod schema 为单一事实来源）
- arXiv API 集成的正确性（URL encoding、速率限制、XML 解析）
- hep-mcp backward compatibility（inspire_paper_source alias 不能断）
- 迁移风险（hep-mcp 内部 10+ import 站点更新的完整性）

输出格式（严格 JSON）：
{"verdict": "PASS|FAIL", "blocking_issues": ["..."], "amendments": [{"target":"...","change":"..."}], "positive_findings": ["..."]}
EOF

# 2. 写 review packet（引用 plan.md + 关键设计决策）
cat > /tmp/arxiv-plan-review-r1.md << 'EOF'
## 审核对象
arxiv-mcp (NEW-ARXIV-01) 实现方案

## 方案文件
见 worktree 根目录 plan.md

## 核心设计决策
[将 plan.md 中的关键章节粘贴在此]

## 审核重点
1. paperContent.ts 拆分方案是否合理
2. Zod schema 是否覆盖所有边界情况（arxiv_id 格式、分类前缀验证）
3. hep-mcp 中 10+ import 站点的更新策略是否完整
4. inspire_paper_source alias 的 backward compat 是否充分
5. URL encoding 陷阱是否在实现方案中明确标注
EOF

# 3. 运行审核
python3 skills/review-swarm/scripts/bin/run_multi_task.py \
  --out-dir ~/.autoresearch-lab-dev/batch-reviews/arxiv-plan-r1 \
  --system /tmp/arxiv-plan-review-system.md \
  --prompt /tmp/arxiv-plan-review-r1.md \
  --fallback-mode auto
```

审核结果判定：
- **PASS**（0 blocking）→ 进入 Phase B 实现
- **FAIL**（有 blocking）→ 修正方案，重新提交 R+1，直至收敛

---

## Phase B：实现阶段 1（arxiv-mcp 包体 + API client）

方案审核通过后开始实现。

### B-1 实现顺序

1. `packages/arxiv-mcp/` 脚手架（package.json、tsconfig.json、vitest.config.ts）
2. `src/api/rateLimiter.ts` — 从 hep-mcp 提取 `ArxivRateLimiter` + `arxivFetch()`
3. `src/api/searchClient.ts` — arXiv Atom API 搜索（新增，参考上述 URL encoding 注意事项）
4. `src/source/` — 提取并拆分（arxivSource、downloadUrls、paperFetcher、tarExtractor、paperContent、paperSource）
5. `src/tools/` — registry.ts（Zod SSOT）、dispatcher.ts、mcpSchema.ts、index.ts
6. `src/index.ts` + `src/tooling.ts`
7. `tests/toolContracts.test.ts`

**每个文件 ≤ 200 LOC，严格执行。**

### B-2 阶段审核（API client + source 层完成后）

API client 和 source 层完成后，在继续 tools 实现之前做一次中间审核：

```bash
# 写 review packet（指向实际文件，不要粘贴代码）
cat > /tmp/arxiv-stage1-review-r1.md << 'EOF'
## 审核对象
arxiv-mcp Phase B-1 完成的 API + source 层

## 文件列表（Codex/Gemini 可直接读取）
- packages/arxiv-mcp/src/api/rateLimiter.ts
- packages/arxiv-mcp/src/api/searchClient.ts
- packages/arxiv-mcp/src/source/arxivSource.ts
- packages/arxiv-mcp/src/source/downloadUrls.ts
- packages/arxiv-mcp/src/source/paperFetcher.ts
- packages/arxiv-mcp/src/source/tarExtractor.ts
- packages/arxiv-mcp/src/source/paperContent.ts
- packages/arxiv-mcp/src/source/paperSource.ts

## 审核重点
1. arXiv Atom API URL encoding 是否正确（+TO+ 不被 encode）
2. ArxivRateLimiter 速率限制逻辑是否与 hep-mcp 原版一致
3. paperContent.ts 拆分后每个文件是否 ≤200 LOC
4. 类型安全（无 as any、无 @ts-ignore）
5. 错误处理是否充分（网络错误、XML 解析错误、tar 解包错误）
EOF

python3 skills/review-swarm/scripts/bin/run_multi_task.py \
  --out-dir ~/.autoresearch-lab-dev/batch-reviews/arxiv-stage1-r1 \
  --system /tmp/arxiv-plan-review-system.md \
  --prompt /tmp/arxiv-stage1-review-r1.md \
  --fallback-mode auto
```

修复所有 BLOCKING，通过后继续。

---

## Phase C：实现阶段 2（工具注册 + hep-mcp 集成）

### C-1 实现顺序

1. 完成 `packages/arxiv-mcp/src/tools/` 中的工具注册（3 个工具完整 Zod schema + handler）
2. 更新 hep-mcp：
   - `package.json` — 添加 `@autoresearch/arxiv-mcp: workspace:*`
   - `src/index.ts` — 聚合 arxiv-mcp 工具（仿 PDG 模式）
   - `src/tools/registry.ts` — `inspire_paper_source` 改为 alias
   - 更新 **11 个 import 站点**（见 Phase A-1 完整列表，不得遗漏）
   - 删除已迁移的 4 个源文件 + rateLimiter.ts 中的 ArxivRateLimiter 部分
3. `pnpm -r build` 通过
4. `pnpm -r test` 通过（含 regression）

### C-2 最终全量双模型审核

所有代码完成、测试通过后，提交完整实现审核：

```bash
cat > /tmp/arxiv-final-review-r1.md << 'EOF'
## 审核对象
arxiv-mcp (NEW-ARXIV-01) 完整实现

## 新增/修改文件

### packages/arxiv-mcp/（全新包）
- src/api/rateLimiter.ts
- src/api/searchClient.ts
- src/source/arxivSource.ts, downloadUrls.ts, paperFetcher.ts, tarExtractor.ts, paperContent.ts, paperSource.ts
- src/tools/registry.ts, dispatcher.ts, mcpSchema.ts, index.ts
- src/index.ts, src/tooling.ts
- tests/toolContracts.test.ts
- package.json, tsconfig.json, vitest.config.ts

### packages/hep-mcp/（修改）
- package.json（新依赖）
- src/index.ts（聚合 arxiv-mcp 工具）
- src/tools/registry.ts（inspire_paper_source alias）
- src/tools/research/deepAnalyze.ts（import 更新）
- src/tools/research/measurementExtractor.ts（import 更新）
- src/tools/research/parseLatexContent.ts（import 更新）
- src/tools/research/extractBibliography.ts（import 更新）
- src/tools/research/extractTables.ts（import 更新）
- src/tools/research/index.ts（import 更新）
- src/tools/writing/claimsTable/extractor.ts（import 更新）
- src/core/evidence.ts（import 更新）
- src/core/writing/evidenceIndex.ts（import arxivFetch 更新）
- src/corpora/style/downloader.ts（import arxivFetch + resolveArxivId 更新）
- src/api/rateLimiter.ts（删除 ArxivRateLimiter/arxivFetch 部分）
- [删除] src/tools/research/arxivSource.ts, downloadUrls.ts, paperContent.ts, paperSource.ts
- src/tools/research/extractBibliography.ts（import 更新）
- src/tools/research/extractTables.ts（import 更新）
- src/tools/research/index.ts（import 更新）
- src/api/rateLimiter.ts（删除 ArxivRateLimiter 部分）
- [删除] src/tools/research/arxivSource.ts, downloadUrls.ts, paperContent.ts, paperSource.ts

## 验收检查点
- [ ] 所有文件 ≤200 LOC
- [ ] arxiv_search 支持 query + categories + date_from/to
- [ ] arxiv_paper_source 支持 urls/content/metadata/auto
- [ ] arxiv_get_metadata 返回完整元数据
- [ ] inspire_paper_source alias 可用，原有测试通过
- [ ] pnpm -r build + pnpm -r test 全部通过
- [ ] 无 as any, @ts-ignore, 空 catch
EOF

python3 skills/review-swarm/scripts/bin/run_multi_task.py \
  --out-dir ~/.autoresearch-lab-dev/batch-reviews/arxiv-final-r1 \
  --system /tmp/arxiv-plan-review-system.md \
  --prompt /tmp/arxiv-final-review-r1.md \
  --fallback-mode auto
```

**收敛要求**：Codex + Gemini 均 0 blocking = CONVERGED，最多 5 轮。

---

## Phase D：PR

```bash
git push -u origin feat/arxiv-mcp
# 然后在 GitHub 创建 PR → main
```

---

## 工具规格参考（Zod SSOT）

### `arxiv_paper_source`（从 `inspire_paper_source` 迁移）
```typescript
{ arxiv_id: z.string(), mode: z.enum(["urls","content","metadata","auto"]).default("auto"), max_content_kb: z.number().int().positive().max(2048).optional() }
```

### `arxiv_search`（新增）
```typescript
{ query: z.string().min(1), categories: z.array(z.string()).optional(), max_results: z.number().int().positive().max(50).default(10), start: z.number().int().nonneg().default(0), date_from: z.string().optional(), date_to: z.string().optional(), sort_by: z.enum(["relevance","date"]).default("relevance") }
```

### `arxiv_get_metadata`（新增）
```typescript
{ arxiv_id: z.string() }
// 返回: title, authors[], abstract, categories[], doi, published, updated, journal_ref
```

---

## tooling.ts 导出设计

```typescript
// MCP 聚合接口
export { TOOL_SPECS, getTools, ... } from './tools/index.js';
// 低级 client（供 hep-mcp 内部工具继续使用）
export { resolveArxivId, getArxivSource } from './source/arxivSource.js';
export { getDownloadUrls } from './source/downloadUrls.js';
export { getPaperContent } from './source/paperContent.js';
export { accessPaperSource } from './source/paperSource.js';
```

---

## 关键技术注意事项

1. **arXiv API HTTPS**：endpoint 必须用 `https://export.arxiv.org/api/query`
2. **URL encoding 陷阱**：日期过滤 `submittedDate:[YYYYMMDD+TO+YYYYMMDD]` 中的 `+TO+` 不能 URL encode；用字符串拼接而非 `URLSearchParams`
3. **XML 命名空间**：解析 Atom feed 需处理 `atom:` 和 `arxiv:` 两个 ns
4. **paperContent.ts 拆分**（475 → ≤200）：建议拆为 `paperFetcher.ts`（HTTP 下载）、`tarExtractor.ts`（tar 解包）、`paperContent.ts`（协调入口）
5. **arxiv-mcp 不知道 INSPIRE**：INSPIRE recid → arXiv ID 映射保留在 hep-mcp 层
6. **速率限制**：3 秒间隔，迁移时保持行为不变
