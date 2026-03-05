# NEW-06 Batch 3: LLM 客户端迁移至 MCP Sampling + `tools/writing/llm/` 删除

## 背景

NEW-06 (MCP 写作流水线移除) 4-batch migration 进度：
- **Batch 1** ✅ `c8c5a01` — 提取 utils, 删除 verifyCitations + corpora/
- **Batch 2** ✅ `33c2448` — 写作管线核心删除 (~34K LOC, 22 tools)
- **Batch 4** ✅ `095887e` — 测试清理 + 文档修复 + CI 通过
- **Batch 3** ← **本次任务**

当前 CI 绿色（run `22544285726`），918 tests pass, 0 failures。

## 本次任务

执行 REDESIGN_PLAN 中 **NEW-MCP-SAMPLING** 条目，编排为 NEW-06 Batch 3。

### 核心变更

1. **Plumb MCP sampling into ToolHandlerContext**

   当前 `ToolHandlerContext`（`packages/hep-mcp/src/tools/registry.ts:90`）只有 `reportProgress` 和 `rawArgs`。需要添加 MCP SDK 的 sampling 能力。

   MCP SDK（v1.27.0）的 `McpServer` 已提供 `server.server.createMessage(params)` 方法（`packages/hep-mcp/node_modules/@modelcontextprotocol/sdk/dist/esm/server/index.d.ts`）。

   变更链路：
   - `src/index.ts` (line 193): `CallToolRequestSchema` handler 中已有 `extra` 对象（含 `requestId`, `sendNotification`）。需要将 `server.server` (底层 `Server` 实例) 的 `createMessage` 传入 context
   - `src/tools/registry.ts`: `ToolHandlerContext` 添加可选的 `createMessage` 方法
   - `src/tools/dispatcher.ts`: `handleToolCall()` 需接受并传递 `createMessage` 到 handler 的 ctx

2. **迁移 `theoreticalConflicts.ts` 到 MCP sampling**

   当前文件（1033 LOC）在 `performTheoreticalConflicts()` 中：
   - Line 13: `import { createLLMClient } from '../writing/llm/clients/index.js'`
   - Line 14: `import { getLLMConfigFromEnv } from '../writing/llm/config.js'`
   - Line 89: `type LlmMode = 'passthrough' | 'client' | 'internal'`
   - Line 369: `const llmMode: LlmMode = params.options.llm_mode ?? 'passthrough'`
   - Line 739-786: `createLLMClient(cfg)` → `client.generate(req.prompt)` 的 internal mode 实现
   - Line 727-870: `llm_mode` 三路分发（passthrough/client/internal）

   迁移方案：
   - **移除 `internal` mode**：不再嵌入 LLM 客户端。`llm_mode='internal'` 改为使用 `ctx.createMessage`（如果 MCP client 支持 sampling）
   - **保留 `passthrough` mode**：纯规则检测，无 LLM 调用
   - **保留 `client` mode**：client 提供 LLM responses（现有行为不变）
   - **新增**: 当 `ctx.createMessage` 可用时，`internal` mode 改为调用 `ctx.createMessage` 而非嵌入式客户端
   - 删除 `createLLMClient` 和 `getLLMConfigFromEnv` 的 import

   `performTheoreticalConflicts()` 函数签名需要接受 ctx（或至少接受 `createMessage`）。调用链：
   - `registry.ts` handler → `criticalResearch.ts:performCriticalResearch()` → `theoreticalConflicts.ts:performTheoreticalConflicts()`
   - 需要把 `ctx` 或 `createMessage` 沿调用链传递

3. **删除 `tools/writing/llm/` 目录（8 files, ~545 LOC）**

   ```
   packages/hep-mcp/src/tools/writing/llm/clients/anthropic.ts  (109)
   packages/hep-mcp/src/tools/writing/llm/clients/google.ts     (98)
   packages/hep-mcp/src/tools/writing/llm/clients/openai.ts     (138)
   packages/hep-mcp/src/tools/writing/llm/clients/index.ts      (31)
   packages/hep-mcp/src/tools/writing/llm/config.ts             (101)
   packages/hep-mcp/src/tools/writing/llm/types.ts              (61)
   packages/hep-mcp/src/tools/writing/llm/index.ts              (7)
   ```

4. **删除 `tools/writing/types.ts`（627 LOC）**

   已无 importer（`core/writing/writingTypes.ts` 是独立提取的副本，仅有注释引用）。

5. **清理 stale references**
   - 确认 `deepResearch.ts` 中无 `mode='write'`（Batch 2 已删除，需确认）
   - 确认 `hep://corpora/` resource namespace 已完全移除（Batch 1 已删除，需确认）
   - 检查 registry.ts 中 `inspire_critical_research` 的 `llm_mode` 参数是否需要更新（移除 `internal` 选项说明，或保留但改为 sampling 语义）
   - 检查 `docs/` 中是否还有对 `llm_mode='internal'` + `WRITING_LLM_PROVIDER` 的引用

## 确认清单（Batch 3 完成后必须全部通过）

### NEW-06 全局验收
- [ ] `pnpm -r build` 通过 0 errors
- [ ] `pnpm -r test` 通过（~489 tests in hep-mcp）
- [ ] `getTools('full')` = 72, `getTools('standard')` = 56（工具数不变，本 batch 不删工具）
- [ ] `deepResearch.ts` 中无 `mode='write'`（确认 Batch 2 已完成）
- [ ] `hep://corpora/` resource namespace 完全移除（确认 Batch 1 已完成）

### NEW-MCP-SAMPLING 验收
- [ ] `tools/writing/llm/` 目录完全删除（8 files）
- [ ] `tools/writing/types.ts` 删除
- [ ] 无 `createLLMClient` 调用残留（`grep -r createLLMClient packages/hep-mcp/src/` 返回空）
- [ ] 无 `getLLMConfigFromEnv` 调用残留
- [ ] `ToolHandlerContext` 包含可选 `createMessage`
- [ ] `theoreticalConflicts.ts` 使用 `ctx.createMessage`（MCP sampling）替代嵌入式 LLM 客户端
- [ ] `src/index.ts` 的 `CallToolRequestSchema` handler 将 `createMessage` 传入 dispatcher
- [ ] `WRITING_LLM_PROVIDER` / `WRITING_LLM_API_KEY` 环境变量不再被 hep-mcp 使用

### 文档/代码卫生
- [ ] 无 `tools/writing/` 目录下残留文件（`ls packages/hep-mcp/src/tools/writing/` 应返回空或目录不存在）
- [ ] `docs/` 中无对 `WRITING_LLM_PROVIDER` / `WRITING_LLM_API_KEY` 的引用
- [ ] `registry.ts` 中 `inspire_critical_research` 的 schema description 更新（`llm_mode` 语义变化）

## 技术参考

### MCP SDK sampling API

```typescript
// McpServer (v1.27.0) 暴露的 createMessage
server.server.createMessage(params: CreateMessageRequestParamsBase, options?: RequestOptions): Promise<CreateMessageResult>;

// CreateMessageRequestParamsBase 核心字段
{
  messages: Array<{ role: 'user' | 'assistant'; content: TextContent | ImageContent }>;
  modelPreferences?: { hints?: Array<{ name?: string }>; costPriority?: number; speedPriority?: number; intelligencePriority?: number };
  systemPrompt?: string;
  maxTokens: number;
}

// CreateMessageResult
{
  role: 'assistant';
  content: TextContent | ImageContent;
  model: string;
  stopReason?: string;
}
```

### 当前调用链

```
src/index.ts (CallToolRequestSchema handler)
  └─ handleToolCall(name, args, mode, dispatchContext)
       └─ dispatcher.ts: spec.handler(parsed, ctx)
            └─ registry.ts: inspire_critical_research handler
                 └─ criticalResearch.ts: performCriticalResearch(params)
                      └─ theoreticalConflicts.ts: performTheoreticalConflicts(params)
                           └─ createLLMClient(cfg).generate(prompt)  ← 要替换为 ctx.createMessage
```

### 环境变量（将移除）

```
WRITING_LLM_PROVIDER   — 'anthropic' | 'openai' | 'google'
WRITING_LLM_API_KEY    — API key
WRITING_LLM_MODEL      — model name override
WRITING_LLM_BASE_URL   — base URL override
```

## 执行约束

- **不需要多模型审核**：本 batch 是机械性删除 + 已定义的接口变更，无架构决策
- 遵循 `CLAUDE.md` 全局约束（无临时命名、无向后兼容负担、commit 不加 Co-Authored-By）
- 完成后 `pnpm -r build && pnpm -r test` 全绿，然后 commit + push，等待 CI 通过
