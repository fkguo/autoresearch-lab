# Phase 3 Implementation Standalone: `NEW-RT-07`

> **状态**: `main` 已恢复为绿 CI（orchestrator `zod` 直依赖回归已独立修复并转绿），Batch 14（`NEW-SEM-10` + `NEW-SEM-13`）已完成并合并到 `main`。编写本 prompt 时 main 已绿；执行前需自行确认工作树与远端状态，`origin/main` 位于 `5281c927e61123c557148d0ac50e930cc00d0581`。
> **本 prompt 定位**: 这是一个 **Phase 3 standalone implementation prompt**，用于补齐 `NEW-RT-07`，而不是把它强行塞进 `Batch 15–16` 的 `NEW-LOOP-01` lane。原因：`NEW-RT-07` 是清晰独立的 host-side sampling routing closeout；若与 `NEW-LOOP-01` 混做，会把 runtime substrate、routing policy、workspace/task graph 三类问题打包，降低可验证性。
> **SOTA 对齐说明**: 本 prompt 已吸收 `meta/docs/2026-02-19-opencode-openclaw-design-adoption.md` 与最新 OpenClaw（2026-03 官方 docs + GitHub repo）可直接映射到本项的高价值模式：**server 仅发稳定 metadata，host 保持 route authority；route policy 与 auth/profile failover 分层；route/fallback attempts 必须可审计**。OpenClaw 式 per-agent workspace / session store / actor queue / session tools / pre-compaction memory flush 仍主要留给 `NEW-LOOP-01` / `EVO-13`，本 prompt 不得越界实现这些长期 substrate。
> **作用域澄清**: 本 prompt **只覆盖 `NEW-RT-07`**。不得顺手并入 `NEW-DISC-01` D4/D5、`NEW-LOOP-01`、`NEW-SEM-06b/d/e`，也不得回写/重做已完成的 `NEW-RT-06` Plane 1 routing。
> **通用硬门禁继承**: 本 prompt 默认继承 `AGENTS.md` 与 `meta/docs/prompts/IMPLEMENTATION_PROMPT_CHECKLIST.md`；若下述条目与 checklist 同时覆盖同一主题，以更严格者为准。

---

## 0. 执行定位

这是一个 **单工作面、host-side sampling routing** prompt：

### `NEW-RT-07` — `MCP Sampling Host Routing Registry`

目标是在 **host / MCP client** 一侧补齐 `ctx.createMessage` 的路由治理：

- routing authority 保持在 host，而不是 MCP server；
- MCP server 只发送 **稳定 metadata**（如 `module` / `tool` / `prompt_version` / `risk_level` / `cost_class`），不得自选模型；
- host 基于 routing registry 把 sampling 请求映射到具体 backend/model/policy；
- 对 metadata 缺失、schema 非法、未知 route / backend、未知 feature key 等情况 **fail-closed**，不得静默漂移到错误模型；
- route policy / feature routing 与 auth-profile rotation / cooldown / billing-disable 必须严格分层；本批只实现前者，后者最多保留扩展点，不得顺手扩成 OpenClaw 全套 auth failover 子系统；
- route resolution、chosen route/model、fallback attempts、最终结果必须进入可审计 surface；
- 保持当前 `NEW-MCP-SAMPLING` 已落地的 `ctx.createMessage` consumer 能力不回退。

> **Plane 边界**:
> - `NEW-RT-06` = Plane 1, orchestrator / agent runtime routing（已完成）
> - `NEW-RT-07` = Plane 2, MCP sampling host routing（本 prompt）
> - 禁止把 server-side self-routing、provider SDK 植入 `hep-mcp`，或把 `NEW-RT-07` 做成对 `NEW-LOOP-01` 的 runtime 侵入式重构。

---

## 1. 开工前必须读取

### 治理 / 规划

1. `AGENTS.md`
2. `meta/remediation_tracker_v1.json`
3. `meta/REDESIGN_PLAN.md`
   - `NEW-RT-07`
   - `NEW-MCP-SAMPLING`
   - `NEW-RT-06` / `NEW-LOOP-01` / `NEW-DISC-01` 的边界说明
4. `meta/docs/sota-monorepo-architecture-2026-03-06.md`
5. `meta/docs/2026-02-19-opencode-openclaw-design-adoption.md`
6. `meta/docs/2026-03-07-openclaw-sota-delta.md`
7. `.serena/memories/architecture-decisions.md`
8. `meta/docs/prompts/IMPLEMENTATION_PROMPT_CHECKLIST.md`

### 代码 / 测试（必须读）

#### Host / orchestrator side

- `packages/orchestrator/src/mcp-client.ts`
- `packages/orchestrator/src/agent-runner.ts`
- `packages/orchestrator/src/routing/types.ts`
- `packages/orchestrator/src/routing/schema.ts`
- `packages/orchestrator/src/routing/loader.ts`
- `packages/orchestrator/src/backends/chat-backend.ts`
- `packages/orchestrator/src/backends/backend-factory.ts`
- `packages/orchestrator/src/index.ts`
- `packages/orchestrator/tests/agent-runner.test.ts`
- `packages/orchestrator/tests/orchestrator.test.ts`

#### Sampling consumers / metadata wrappers / downstream surfaces

- `packages/hep-mcp/src/tools/registry/types.ts`
- `packages/hep-mcp/src/tools/dispatcher.ts`
- `packages/hep-mcp/src/tools/registry/inspireResearch.ts`
- `packages/hep-mcp/src/tools/registry/projectCore.ts`
- `packages/hep-mcp/src/index.ts`
- `packages/hep-mcp/src/core/semantics/claimExtraction.ts`
- `packages/hep-mcp/src/core/semantics/evidenceClaimGrading.ts`
- `packages/hep-mcp/src/core/semantics/claimBundleAdjudicator.ts`
- `packages/hep-mcp/src/core/semantics/quantityAdjudicator.ts`
- `packages/hep-mcp/src/tools/research/theoreticalConflicts.ts`
- `packages/hep-mcp/src/tools/research/criticalResearch.ts`
- `packages/hep-mcp/src/tools/research/evidenceGrading.ts`
- `packages/hep-mcp/src/core/hep/compareMeasurements.ts`
- `packages/hep-mcp/src/core/semantics/quantityClustering.ts`
- `packages/hep-mcp/tests/research/evidenceClaimGrading.test.ts`
- `packages/hep-mcp/tests/research/theoreticalConflicts.test.ts`
- `packages/hep-mcp/tests/tools.test.ts`

#### Shared contracts（若触及）

- `packages/shared/src/tool-risk.ts`
- `packages/shared/src/index.ts`
- `packages/shared/src/__tests__/gate-registry.test.ts`

> **注意 1**: 目前 `NEW-RT-07` 没有独立 eval plane。不得因此跳过验证；若现有测试对 host-side sampling routing 无法直接兜住，必须**先补 targeted tests / fixture-like route cases，再实施**。本项可以以 unit + integration-style regression 为主，不强制新建 `test:eval`，但必须有明确的 pre-implementation red test 覆盖路由解析、metadata contract 与 fail-closed 行为。
>
> **注意 2（foundation verification）**: 开工后第一件事不是写实现，而是**验证 `NEW-MCP-SAMPLING` 的地基是否真实存在**。至少确认：
> 1. `ToolHandlerContext` / handler chain 上存在 `createMessage` surface；
> 2. 现有 sampling consumers 至少有一条真实 host→server→consumer 调用链；
> 3. metadata 确实能从 server callsite 传到 host sampling caller；
> 4. 若当前 orchestrator host 侧尚无对应 sampling plumbing，应明确判定这是否属于 `NEW-RT-07` scope 内“补齐 host wrapper”，还是已超出本批基础前提。
>
> 若以上任一基础不成立或与 tracker/plan 描述不符，必须立刻停下并报告 blocker，而不是在错误前提上继续做 `NEW-RT-07`。
>
> **注意 3**: 直接 `createMessage(...)` sampling callsites 当前主要是 `claimExtraction` / `evidenceClaimGrading` / `claimBundleAdjudicator` / `quantityAdjudicator` / `theoreticalConflicts`；其余文件是 metadata wrapper / downstream / transitive consumer surface，也必须读，避免只修直接 callsite 却漏掉 contract 传播面。

### GitNexus

开始前按 `AGENTS.md` 硬门禁：

1. 先读取 `gitnexus://repo/autoresearch-lab/context`，检查 index freshness。
2. 若 stale，先运行 `npx gitnexus analyze`，然后重新读取 context；禁止带 stale index 开工。
3. 读取 `.claude/skills/gitnexus/exploring/SKILL.md`，必要时读取 `.claude/skills/gitnexus/impact-analysis/SKILL.md`。
4. 用 GitNexus 理解至少这些符号 / 调用链：
   - `McpClient`
   - `loadRoutingConfig` / `resolveChatRoute`
   - `ToolHandlerContext`
   - `claimExtraction` / `gradeClaimAgainstEvidenceBundle` / `adjudicateClaimBundle` / `adjudicateQuantityPair` / `performTheoreticalConflicts`
   - 它们各自的调用方、execution flows、下游 surface

实施完成后、正式 review 前：

5. 若新增/重命名符号、改动关键调用链、或索引已失真，必须再次运行 `npx gitnexus analyze`。
6. 用 `detect_changes`，必要时配合 `impact` / `context`，为最终审查提供 post-change evidence；禁止用 stale index 做最终审核。

---

## 2. tracker 开工要求

开始实现前：

- 将 `meta/remediation_tracker_v1.json` 中 `NEW-RT-07` 更新为 `in_progress`
- `assignee` 填当前实际模型
- note 写明本次为 **standalone host-side sampling routing closeout**，并再次声明：
  - 不启动 `NEW-DISC-01` D4/D5
  - 不启动 `NEW-LOOP-01`
  - 不启动 `NEW-SEM-06b/d/e`
  - 不回填 `NEW-RT-06`

完成后，只有在 acceptance + `review-swarm` + `self-review` 全部通过后，才能标 `done`。

---

## 3. 工作目标与完成定义

### 3.1 Host-side routing registry（核心 gate）

在 **orchestrator host** 建立与 Plane 1 分离的 sampling routing registry / resolver。目标能力至少包括：

1. **typed routing schema / loader / resolver**
   - 针对 sampling/createMessage 单独建模，而不是偷用 `NEW-RT-06` 的 chat route 类型强行塞进去；
   - 使用 **Zod** 定义 routing schema，与 `packages/orchestrator/src/routing/schema.ts` 的现有风格保持一致；
   - 推荐落在 `packages/orchestrator/src/routing/` 下的新 sampling-specific 模块（例如 `sampling.ts` / `sampling-schema.ts` / `sampling-loader.ts`）；
   - 支持 default route、per-feature override、fallback chain、预算/成本分级；
   - schema 校验失败必须 fail-closed。

2. **metadata-driven route selection**
   - host 仅根据稳定 metadata 选路；
   - 至少覆盖 `module`、`tool`、`prompt_version`、`risk_level`、`cost_class`；
   - 路由键应来源于这些稳定字段或其受控映射，而不是 server 直接给出具体 model name。

3. **sampling request wrapper in host client**
   - 在 `packages/orchestrator/src/mcp-client.ts`（或等价 host-only 模块）补齐或包裹 `createMessage`/sampling 请求能力；
   - 若 `NEW-MCP-SAMPLING` 已经提供 host-side `createMessage` path，本批任务是**在其外层包裹/拦截并接入 route resolution**，而不是从零重建 sampling plumbing；
   - 若 host 侧根本不存在 `createMessage` path，则应按 §1 注意 2 视为 blocker，而不是悄悄把 `NEW-MCP-SAMPLING` 整体重做一遍；
   - 由 host 负责把 route 解析结果映射为具体 backend/model/policy，并把 route/model/prompt version/fallback 尝试信息记录到可审计 surface；
   - 未知 route / backend / metadata contract 违规必须 fail-closed，错误信息可测试。

4. **route policy 与 auth failover 分层**
   - 本批允许实现 routing registry / sampling wrapper / fallback chain；
   - 本批**不实现** OpenClaw 式 auth profile rotation / cooldown / billing disable 子系统；
   - 若未来需要 provider/profile failover，必须保留明确扩展点，而不是把它与 route selection 混在同一抽象里。

5. **no server self-selection**
   - `hep-mcp` 等 server 侧不得读取 routing config，不得自行决定模型；
   - server 仅发稳定 metadata，host 才持有 routing authority。

### 3.2 Stable sampling metadata contract（server-side narrow support）

为现有 `ctx.createMessage` consumers 建立**最小但明确**的 metadata contract：

1. 把当前零散 metadata 整理为一致 shape；
2. 直接 sampling callsites 至少覆盖：
   - `claimExtraction`
   - `gradeClaimAgainstEvidenceBundle`
   - `adjudicateClaimBundle`
   - `adjudicateQuantityPair`
   - `performTheoreticalConflicts`
3. 同时检查并对齐 wrapper / downstream surface：
   - `criticalResearch.ts`
   - `evidenceGrading.ts`
   - `compareMeasurements.ts`
   - `quantityClustering.ts`
   - `inspireResearch.ts`
   - `projectCore.ts`
   - `dispatcher.ts`
4. `risk_level` 必须与 tool/operation 语义一致，`cost_class` 必须是有限枚举而非自由文本；
5. server metadata 中不得直接出现具体 route/model 选择；
6. 若需要 helper/type，优先做 **最小共用抽象**。若必须落到 shared contract，优先复用 `packages/shared/src/tool-risk.ts` 一带已存在的治理语义，而不是无端新建多个共享文件。

> **范围约束**: 这里只允许补齐 metadata contract 与 callsite 一致性；不得借机大规模重构 `hep-mcp` semantics 层。

### 3.3 Route audit / observability（SOTA 对齐要求）

本批必须把 **route resolution 本身** 纳入可验证/可审查 surface。至少要求：

- 输入 metadata 可在测试或结构化日志中断言；
- resolved route key / backend / model 可断言；
- fallback attempts 可断言；
- fail-closed 时的 reason 可断言；
- 审计 surface 应优先复用 orchestrator 现有结构化模式（如 ledger / manifest / typed diagnostics）；至少要落到**可测试的结构化 JSON/JSONL 或 typed artifact/log**，不得只靠 `console.log`；
- 不允许出现“实际偷偷 fallback 了，但外部看不见”的黑盒行为。

### 3.4 Future reuse boundary（面向 `NEW-LOOP-01`，但本批不实现）

若本批新增 queue / route / session-adjacent helper：

- 设计上应尽量让 `NEW-LOOP-01` 可复用；
- 但**不得**在本批提前实现 OpenClaw 式 per-agent workspace / per-agent session store / `sessions_spawn` / `sessions_send` / actor queue / memory flush substrate；
- 这些长期 substrate 明确留给 `NEW-LOOP-01` / `EVO-13`，本批最多写明 extension point / TODO / note，不得越界落地。

### 3.5 完成定义

- [ ] host-side sampling routing registry / resolver 存在，且与 `NEW-RT-06` Plane 1 边界清晰
- [ ] `McpClient`（或等价 host-side sampling wrapper）具备 metadata-driven route resolution
- [ ] sampling metadata contract 有 typed/validated surface，而不是 callsite 各自发明字段
- [ ] 现有 `createMessage` consumers 全部改用稳定 metadata contract
- [ ] route resolution / fallback attempts / fail-closed reason 进入可审计 surface
- [ ] invalid metadata / unknown route / unknown backend / bad config 有 targeted regression tests
- [ ] server 不读取 routing config，不自选模型
- [ ] 已先验证 `NEW-MCP-SAMPLING` foundation 存在；若 foundation 缺失，则本批应以 blocker 结束而不是假装完成
- [ ] 未启动 `NEW-DISC-01` D4/D5、`NEW-LOOP-01`、`NEW-SEM-06b/d/e`

---

## 4. Eval-first / test-first 顺序（硬要求）

本项虽然不是 retrieval/semantic eval 项，但仍必须 **test-first**：

### 4.1 先补 targeted tests（先红后绿）

在写实现代码前，先补至少两类测试：

1. **Host routing tests**（orchestrator）
   - routing schema parse / validation
   - default route
   - per-feature override
   - fallback chain
   - unknown route / backend / malformed metadata fail-closed
   - route resolution 不污染 `NEW-RT-06` 已有 chat routing
   - Plane 1 / Plane 2 不互相串味

2. **Sampling metadata emission tests**（hep-mcp）
   - 核对每个 migrated sampling callsite 发出的 metadata 至少含：
     `module`, `tool`, `prompt_version`, `risk_level`, `cost_class`
   - hard-code route/model name 不得出现在 server metadata
   - 至少覆盖一个 low-cost/low-risk case 与一个 higher-cost case

3. **Route audit tests**（若与上面分文件更清晰）
   - chosen route / backend / model 可被断言
   - fallback attempts 可被断言
   - fail-closed reason 可被断言

> 若现有测试文件不适合承载，可新增小而专用的测试文件；遵守 200 LOC / SRP 约束，并沿用 `packages/orchestrator/tests/*.test.ts` / `packages/hep-mcp/tests/**/*.test.ts` 的现有命名风格，避免发明新的测试命名体系。

### 4.2 再做最小实现

实现时优先顺序：

1. foundation verification + red tests
2. host-side routing types/schema/loader
3. host-side sampling request path (`McpClient` or helper)
4. metadata contract helper / narrow shared type（若需要）
5. sampling consumer callsites 对齐
6. regression / negative-path tightening

### 4.3 若触及 shared type/contract

若 `packages/shared/` 新增或修改了跨包 contract/type：

- 必须补跑 `pnpm --filter @autoresearch/shared test`
- 必须补跑 `pnpm --filter @autoresearch/shared build`
- review 中必须明确说明为何 shared 化是必要而非过度工程

---

## 5. 明确禁止事项

本批禁止：

- 把 `NEW-RT-07` 与 `NEW-LOOP-01` 合并成一个大 prompt
- 把 `NEW-RT-07` 变成 server-side self-routing / model self-selection
- 在本批实现 OpenClaw 式 auth profile rotation / cooldown / billing-disable 整套机制
- 顺手 close `NEW-DISC-01` D4/D5
- 顺手启动 `NEW-SEM-06b/d/e`
- 回写历史 prompt 或重做 `NEW-RT-06`
- 用 `as any` / `@ts-ignore` / 静默吞错 通过测试

---

## 6. 总验收命令

至少运行：

```bash
pnpm --filter @autoresearch/orchestrator test
pnpm --filter @autoresearch/orchestrator build
pnpm --filter @autoresearch/hep-mcp test
pnpm --filter @autoresearch/hep-mcp build
pnpm lint
pnpm -r test
pnpm -r build
```

若触及 `packages/shared/`：

```bash
pnpm --filter @autoresearch/shared test
pnpm --filter @autoresearch/shared build
```

> `pnpm -r build` 是必跑项，因为本批本质上是 host/server contract 面的 routing 变更。

---

## 7. review-swarm / self-review（硬门禁）

### 7.1 外部正式双审

实现完成且 acceptance 通过后，必须执行正式 `review-swarm`：

- **必须显式使用 `review-swarm` skill / `skills/review-swarm/SKILL.md` 的流程**；不得手工模拟“双审已做过”
- reviewer 固定：`Opus` + `OpenCode(kimi-for-coding/k2p5)`
- 若本地 `review-swarm` 默认配置与上述 reviewer 不一致，必须显式 override 为这对 reviewer；不要编辑 `meta/review-swarm.json` 来偷渡全局默认，优先使用 `run_multi_task.py --models claude/opus,kimi-for-coding/k2p5`（或等价 override）
- 必须深审：实现代码、关键调用链、execution flows、tests、negative-path regressions、scope boundary
- 每个 blocking issue / amendment 都必须绑定代码、测试、或 GitNexus 证据
- 任一 reviewer 有 blocking issue，必须修复并进入下一轮，直到双审 `0 blocking` 收敛
- 若 `run_multi_task.py --models ...` 的 reviewer override 语法与本地 runner 期望不一致，先查 `skills/review-swarm/SKILL.md`，不要猜测、更不要编辑 `meta/review-swarm.json` 来偷渡默认 reviewer

### 7.2 自审

外部双审收敛后，当前执行 agent 必须再做正式 `self-review`，至少覆盖：

- host-side routing registry 与 `McpClient` sampling path
- sampling metadata contract 与 migrated callsites
- route resolution / fallback attempts / fail-closed reason 的审计证据
- GitNexus post-change `detect_changes` / `impact` / `context` 证据
- tests / negative paths / fail-closed 行为
- scope boundary 与 adopted / deferred amendments 记录

---

## 8. 交付后必须同步

交付前必须同步：

- `meta/remediation_tracker_v1.json`
- `.serena/memories/architecture-decisions.md`
- `AGENTS.md`
- adopted / deferred amendments 及原因

若完成实现并获授权提交：

- commit / push 只能发生在 acceptance + `review-swarm` + `self-review` + tracker/memory/AGENTS sync 全部完成之后
- `.review/` 产物保持 gitignored，不进入提交

---

## 9. 给下一位 agent 的起始纪律

1. 先在干净 worktree 开工，不要在旧会话/旧脏工作区继续堆叠。
2. 开工即先做 GitNexus freshness check。
3. 先验证 `NEW-MCP-SAMPLING` foundation，再补 tests，再补实现。
4. 不要把 `NEW-LOOP-01` 提前混进来。
5. 如果实现需要 shared contract，务必说明为什么这是最小必要共享面。
6. 如果发现自己开始写 actor queue / session store / workspace graph / memory flush，就说明已经越界，应立即停下回到 `NEW-RT-07` 主线。
