# Prompt: 2026-03-11 Standalone — `NEW-IDEA-01` Retro-Closeout

> 默认继承 `meta/docs/prompts/IMPLEMENTATION_PROMPT_CHECKLIST.md`
>
> 当前基线：本 prompt 同步到 `main` 时，本地 `main` 头位于 `e9187bd`。`Batch 15 = NEW-SEM-08` 与 `Batch 16 = NEW-SEM-11 + NEW-SEM-12` 已吸收；`2026-03-11 standalone research-team full_access workspace fix` 仍只作为独立 baseline `7ce4a17` 存在；不要重做。
>
> `NEW-IDEA-01` 不是从零开始的新实现项：`packages/idea-mcp/` 已在更早的 Batch 9 落地（历史实现 commit `7e074e5`），且后续在 `meta/REDESIGN_PLAN.md` 中被机械勾成了完成态；但 `meta/remediation_tracker_v1.json` 仍把它标成 `pending`。本 prompt 的目标是做一次 **reality-audit + bounded retro-closeout**，而不是把旧 batch9 prompt 原样再执行一遍。
>
> 作用域硬约束：本批只覆盖 `NEW-IDEA-01`。不要启动或顺手吸收 `NEW-R15-impl`、`UX-02`、`NEW-02/03/04`、`NEW-COMP-01/02`、`EVO-13`、generic LLM API migration、research-team lane，或任何与当前 idea-core MCP bridge 无直接关系的 lane。

## 0. 本批定位

这是一个 **单工作面、retro-closeout / reality-audit prompt**：

- 先确认当前 `@autoresearch/idea-mcp` 是否已经真实满足 `NEW-IDEA-01` 的 live acceptance，而不是只看“包存在 / 代码存在 / 当年 prompt 里写过已完成”；
- 若已经满足，则只补最小缺失的 tests / evidence / SSOT sync，完成 retro-closeout；
- 若存在真实 acceptance gap，则只修补 **阻止 `NEW-IDEA-01` closeout 的最小缺口**；
- 不得借机把 `idea-core` 重写成 TS `idea-engine`，也不得把本批升级成新的架构 redesign。

## 1. 开工前必须读取

### 1.1 治理 / 规划

1. `AGENTS.md`
2. `meta/remediation_tracker_v1.json`
3. `meta/REDESIGN_PLAN.md`
   - `NEW-IDEA-01`
   - `NEW-COMP-01`
   - `NEW-CONN-04`
   - `NEW-05a Stage 3` 附近关于 idea-engine TS 重写的叙事
4. `meta/docs/prompts/IMPLEMENTATION_PROMPT_CHECKLIST.md`
5. `meta/docs/prompts/prompt-phase2-impl-batch9.md`
6. `meta/docs/prompts/prompt-phase2-impl-batch10.md`
7. `.serena/memories/architecture-decisions.md`

### 1.2 代码 / contract / tests

1. `packages/idea-mcp/package.json`
2. `packages/idea-mcp/src/server.ts`
3. `packages/idea-mcp/src/rpc-client.ts`
4. `packages/idea-mcp/src/index.ts`
5. `packages/idea-mcp/tests/rpc-client.test.ts`
6. `packages/idea-core/src/idea_core/rpc/server.py`
7. `packages/idea-core/src/idea_core/engine/coordinator.py`
8. `packages/idea-core/contracts/idea-generator-snapshot/schemas/idea_core_rpc_v1.openrpc.json`
9. `packages/idea-core/src/idea_core/hepar/skill_bridge.py`
10. `packages/idea-core/tests/hepar/test_skill_bridge_m43.py`
11. `packages/shared/src/tool-names.ts`
12. `packages/shared/src/tool-risk.ts`

> 若阅读中发现 `NEW-IDEA-01` 的 live authority 不止这些文件，必须继续补读，再动手。禁止只看 `packages/idea-mcp/` 就直接判定 closeout。

## 2. tracker / baseline 对齐

开工前先把 `meta/remediation_tracker_v1.json` 中 `NEW-IDEA-01` 更新为：

- `status: "in_progress"`
- `assignee`: 当前实际执行模型

并在 note 中明确这是一次 **retro-closeout reality audit**，不是“第一次实现”。

## 3. 现实审计的硬问题

本批必须先回答以下问题，再决定是否改代码：

1. 当前 `packages/idea-mcp/` 暴露的 MCP 工具，是否仍与 `REDESIGN_PLAN` 对 `NEW-IDEA-01` 的 acceptance 对齐？
2. 当前 `packages/idea-mcp/src/server.ts` 的 Zod 输入 schema，是否与 **现行** `idea_core_rpc_v1.openrpc.json` 对齐，而不是只符合 Batch 9 当时的简化假设？
3. 当前错误传播，是否保留了 live idea-core JSON-RPC contract 的 machine-readable error semantics，而不是被桥接层过度压扁？
4. 当前测试是否只证明了 mock child-process happy path，却没有锁住真实 MCP -> JSON-RPC -> idea-core round-trip？
5. 当前 `idea-mcp` 是否还留有与 earlier shared-boundary closeout 相关的直接缺口，例如 concrete idea-tool risk authority 无本地归属；若有，这是否已经直接阻塞 `NEW-IDEA-01` 的现实 closeout？

### 3.1 已确认的 live contract 漂移证据

以 `packages/idea-core/contracts/idea-generator-snapshot/schemas/idea_core_rpc_v1.openrpc.json` 为准，以下参数约束已是 live reality：

- `campaign.init`: `charter`, `seed_pack`, `budget`, `idempotency_key`
- `campaign.status`: `campaign_id`
- `campaign.topup`: `campaign_id`, `topup`, `idempotency_key`
- `campaign.pause`: `campaign_id`, `idempotency_key`
- `campaign.resume`: `campaign_id`, `idempotency_key`
- `campaign.complete`: `campaign_id`, `idempotency_key`
- `search.step`: `campaign_id`, `n_steps`, optional `step_budget`, `idempotency_key`
- `eval.run`: `campaign_id`, `node_ids`, `evaluator_config`, `idempotency_key`

因此：

- 如果当前 `idea-mcp` 仍暴露 Batch 9 风格的简化 schema（例如 `topic`, `query`, `budget` shorthand），并导致 live bridge 实际上无法按现行 contract 调用 `idea-core`，这属于 **blocking gap**，必须修复；
- 不允许因为“batch9 当时这么写过”就继续沿用过期参数面；
- 修复时优先对齐现行 OpenRPC / runtime contract，而不是维护对旧简化 prompt 的兼容层。

## 4. Targeted Integration SOTA / Official-Doc Preflight（必做，archive-first）

本批不是算法选型或学术路线判断，不需要重新做大范围研究型 SOTA；但它涉及 **MCP bridge / JSON-RPC contract / Node transport / current SDK behavior**，这些实现面有明显时效性，因此必须先做一轮 **targeted integration SOTA / official-doc preflight**，并 archive-first 落盘：

- canonical archive：`~/.autoresearch-lab-dev/sota-preflight/2026-03-12/NEW-IDEA-01/`
- worktree 指针：`.tmp/new-idea-01-sota-preflight.md`

### 4.1 必查来源

至少包含以下 primary / official sources：

1. 当前 MCP SDK 官方文档或官方 release notes
   - tool registration
   - `CallTool` / `ListTools` handler shape
   - `isError` 返回约定
   - stdio transport 边界
2. JSON-RPC 2.0 官方规范或等价 primary source
   - request / response framing
   - error object semantics
   - parse / invalid-request / invalid-params / internal-error 的边界
3. 本仓 live contract authority
   - `packages/idea-core/contracts/idea-generator-snapshot/schemas/idea_core_rpc_v1.openrpc.json`
   - 若有必要，连带读取相邻 result / error schema
4. 当前 Node / TypeScript / `zod` runtime reality
   - `toJSONSchema` 或等价导出能力
   - ESM `import.meta` 行为
   - `child_process` + line-delimited stdio 的稳定性边界

### 4.2 preflight 至少回答

1. 当前 MCP SDK 对 tool schema 和 error response 的真实要求是什么？
2. 当前 `idea-mcp` 写法与这些要求相比，是否存在 API/drift 风险？
3. 当前 `idea-core` OpenRPC live contract 与 Batch 9 prompt 的简化参数面有哪些明确漂移？
4. 是否需要对 `zod`/JSON Schema 导出、Node ESM 路径解析或 child-process restart/error handling 做同步修正？
5. 哪些是本批必须吸收的 low-risk contract alignment，哪些属于 lane 外 redesign，不应在本批开启？

### 4.3 结论要求

- 不得用二手博客或过期记忆替代 official / primary source。
- 不得把“看起来能跑”当作 contract evidence。
- preflight 结论必须在 closeout note / self-review 中有明确 disposition：`adopted` / `deferred` / `declined`。

## 5. GitNexus 硬门禁

### 5.1 实施前

1. 先读 `gitnexus://repo/{name}/context`
2. 若 index stale，先运行 `npx gitnexus analyze`
3. 至少对齐以下符号：
   - `IdeaRpcClient`
   - `startServer`
   - `IdeaCoreService`
   - `handle_request`
   - `HeparSkillBridge`
4. 在改代码前明确：
   - `idea-mcp` 当前是否有真实下游 consumer / authority path
   - `idea-core` live contract surface 与 `idea-mcp` bridge 的差异点
   - 若要补 tool-risk / registry，本地 authority 应落在哪里

### 5.2 正式审核前

若本批新增/重命名符号、改变关键调用链、或当前 index 已不反映工作树：

1. 再次运行 `npx gitnexus analyze`
2. 执行 `detect_changes`
3. 视需要补 `context(...)` / `impact(...)`
4. 将 post-change 证据带入 `review-swarm` 与 `self-review`

## 6. 实现要求

### 6.1 In scope

1. 将 `packages/idea-mcp/` 的工具 schema / RPC mapping / error mapping 对齐到 **当前** `idea-core` OpenRPC contract
2. 为 `NEW-IDEA-01` 补齐真正能证明 closeout 的 tests / fixtures / regression evidence
3. 在必要且足够 bounded 的前提下，补齐与本 item 直接相关的本地 authority 缺口
4. 同步 tracker / `AGENTS.md`，必要时同步 `meta/REDESIGN_PLAN.md`

### 6.2 最小完备交付要求

至少做到：

1. `idea_campaign_*`, `idea_search_step`, `idea_eval_run` 的输入面与 live OpenRPC 保持一致
2. side-effecting 方法的 `idempotency_key` 语义不被桥接层吃掉
3. 至少有一类测试能证明真实 round-trip，而不是只 mock `spawn()`：
   - 可以是 MCP handler -> `IdeaRpcClient` -> real `idea_core.rpc.server`
   - 也可以是等价的 deterministic integration harness
4. error path 要能锁定至少一类 live JSON-RPC error 到 MCP error surface 的传播
5. 若补 tool-risk / local registry，必须是最小本地 authority 收束；不要扩大成跨包 tool governance 重构

### 6.3 明确禁止

- 不要把本批升级成 `idea-engine` TS 重写
- 不要顺手重做 `NEW-CONN-04`、`NEW-R15-impl`、`UX-02` 或 compute substrate
- 不要引入兼容旧 Batch 9 简化参数的双轨 schema，除非有明确 live consumer 证据且确属本批必需
- 不要因为“代码已经存在”就跳过 reality-audit / acceptance / review
- 不要把环境未安装依赖（例如缺 `node_modules`）误记录为实现失败；先区分环境问题与代码问题

## 7. 验收命令

至少执行：

```bash
pnpm --filter @autoresearch/idea-mcp build
pnpm --filter @autoresearch/idea-mcp test
uv run --project packages/idea-core pytest \
  packages/idea-core/tests/hepar/test_skill_bridge_m43.py \
  packages/idea-core/tests/engine/test_search_step_island_state_machine.py -q
git diff --check
```

如果本批触及 `packages/shared/**`，还必须追加相邻 gate：

```bash
pnpm --filter @autoresearch/shared build
pnpm --filter @autoresearch/shared test
```

如果新增了 `idea-mcp` integration test / fixture，必须显式单跑一次该专项命令，并在 closeout note 中写清楚它锁定了什么行为。

## 8. Formal Review / Self-Review

按 `IMPLEMENTATION_PROMPT_CHECKLIST.md` 执行正式三审与自审：

- `Opus`
- `Gemini-3.1-Pro-Preview`
- `OpenCode(kimi-for-coding/k2p5)`

若任一 reviewer 本地不可用，必须记录失败原因，并由人类明确确认 fallback reviewer；禁止静默降级。

审查重点：

1. 当前 bridge 是否真的对齐 live OpenRPC contract
2. tests 是否锁住了 round-trip / idempotency / error propagation，而不是只测 mock shell
3. preflight 是否真的引用了当前 official / primary sources，而不是沿用旧 prompt 假设
4. scope 是否严格停留在 `NEW-IDEA-01`
5. 若有 adopted / deferred / declined amendments，是否已同步到持久 SSOT

## 9. SSOT 同步要求

完成后必须同步：

1. `meta/remediation_tracker_v1.json`
   - 将 `NEW-IDEA-01` 标为 `done`
   - note 必须写清楚：这是对 Batch 9 既有实现的 retro-closeout，最终 implementation/hash 是什么，本轮补了哪些 acceptance gap
2. `AGENTS.md`
   - 更新当前进度摘要，至少说明 `NEW-IDEA-01` 的 tracker drift 已被 reality-audit + retro-closeout 收口
3. `meta/REDESIGN_PLAN.md`
   - 仅在本批实质改变了 `NEW-IDEA-01` 的 acceptance narrative、bridge boundary 或后续 unblock 叙事时更新；不要写流水账
4. `.serena/memories/architecture-decisions.md`
   - 仅当本批沉淀出新的长期稳定不变量时更新；否则明确记录“无新增稳定不变量”

如果 earlier shared-boundary note 中提到的 `idea-mcp` local tool-risk authority 问题在本批被采纳或明确拒绝，也必须在 tracker note 或 checked-in prompt/closeout 文档中留下 disposition。

## 10. 完成汇报中的下一批建议

本批完成汇报必须给出 **条件化** 下一批建议：

- 若 `NEW-IDEA-01` 只是 tracker drift + bounded contract/test gap，默认下一条 prompt 应优先考虑 `NEW-R15-impl` 的 reality-audit / retro-closeout，因为它是 Phase 2 pending 项里更核心的 runtime MCP surface；
- 若 `NEW-IDEA-01` 暴露出更深的 idea-core / idea-mcp contract 边界问题，先给出一个更小的 bounded follow-up，不要直接跳去 `UX-02`、`NEW-COMP-01` 或 `EVO-13`；
- 无论哪种情况，都不要因为“项目大方向上还有很多事”就跳过相邻 pending Phase 2 tracker drift 收口。
