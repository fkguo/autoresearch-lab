# Prompt: 2026-03-25 `EVO-18` — `rep-sdk` Event-Native Signals And Selector

> 适用范围：**仅**用于一个新的 bounded implementation 对话。
> 默认继承 `meta/docs/prompts/IMPLEMENTATION_PROMPT_CHECKLIST.md`。
>
> 本批不是 `EVO-06` / `EVO-07` runtime 落地，不是 `EVO-11` handoff，不是 `EVO-20` shared persistence 接线，也不是 HTTP transport / broader Track A productization。目标只有一个：把 `EVO-18` 收敛成 `packages/rep-sdk` 内部一个 **event-native core** first deliverable，并保持研究信号空间开放、domain-neutral，而不是把首批 detector 列表误当成研究范围本身。

## 0. Worktree Requirement

本 prompt **不得**在当前 planning worktree 实施：

- `/Users/fkg/Coding/Agents/autoresearch-lab-rep-sdk-evo18-plan`

实现必须在主协调对话明确开的未来 dedicated `rep-sdk` implementation lane 上进行；不要回到主仓 `main` 直接实施。本 prompt 故意不在这里预先硬编码最终 worktree 绝对路径，但必须满足：

1. 不要在 planning-only worktree 上写实现代码。
2. 不要在主仓 `main` 直接实施本批。
3. 不要 `commit` / `push`，除非人类在未来 implementation 对话中再次明确授权。
4. 若实现过程中证明本批与 `EVO-06` / `EVO-07` / `EVO-11` / `EVO-20` 或更广 Track A productization 不可分离，必须停止并回报主协调对话，而不是静默扩批。

## 1. Why This Batch Next

截至 2026-03-25，当前 checked-in reality 已经是：

1. `EVO-17` 已在 `packages/rep-sdk` 落地 core REP authority：model/protocol/validation/transport/client/server。
2. `EVO-04` 的 first deliverable 也已在 `packages/rep-sdk` 落地 bounded discovery authority：`@autoresearch/rep-sdk/discovery`。
3. `meta/schemas/research_signal_v1.schema.json` 与 `meta/docs/track-a-evo18-signal-engine-design.md` 已提供 `EVO-18` 的 schema/design authority。
4. 但 `packages/rep-sdk` 还没有 package-local `research_signal_v1` schema snapshot、没有 `signals` 子路径导出，也没有 event-native signal extraction / selector runtime。
5. `EVO-06` / `EVO-07` 仍是 `design_complete`，`EVO-11` 仍 pending，`EVO-20` 虽然已 live，但它属于 shared substrate，而不是 `rep-sdk` 当前可直接依赖的 runtime authority。

因此，本批的正确目标不是一次性照搬旧 `EVO-18` 大设计，而是：

1. 在 `packages/rep-sdk` 内补上 `ResearchSignal` 的 package-local schema/runtime/type authority。
2. 提供一个 **pure-library** `signals` surface：`extractSignals(events, options?)` + `selectStrategy(input)`。
3. 只实现当前 live `ResearchEvent` contract 足以无歧义支撑的 detector。
4. 明确后续 detector 的正规扩展路径，而不是把“defer”误写成研究范围缩窄。

相邻 lane 当前都不该先启动：

- 不是 `EVO-06` / `EVO-07`：它们的 report/runtime seam 还没有 become live authority。
- 不是 `EVO-11`：本批 selector 只选 strategy preset，不产出 bandit handoff public contract。
- 不是 `EVO-20` 接线：`@autoresearch/rep-sdk` 必须继续守住 PLUG-01，不能引入 `@autoresearch/*` runtime dependency。
- 不是 HTTP transport / broader Track A productization：本批只做 local library surface。
- 不是 `EVO-19`：Track B 不在本批。

## 2. Hard Scope Boundary

### 2.1 In scope

本批只允许覆盖：

1. `packages/rep-sdk/package.json`
2. `packages/rep-sdk/schemas/research_signal_v1.schema.json`
3. `packages/rep-sdk/src/model/` 下为 `ResearchSignal` 补齐的最小 type surface
4. `packages/rep-sdk/src/signals/` 下的 bounded signal extraction / selector 模块
5. `packages/rep-sdk/src/index.ts` 与相关 model export surface
6. `packages/rep-sdk/tests/**` 中与 signals/export/schema-parity/fail-closed 行为直接相关的新测试

### 2.2 Explicitly out of scope

以下内容一律禁止顺手吸收：

- `packages/shared/src/memory-graph/**` 接线
- 对 `@autoresearch/shared` 的 runtime 依赖
- `EVO-11` `StrategyContext` / `BanditSelection` public contract
- `signal_engine_config_v1` / `strategy_context_v1` 新 schema
- HTTP / network transport
- 新的 REP envelope message type
- `report` envelope 自动写回
- `EVO-06` / `EVO-07` runtime 或 resolver layer
- provider-specific/domain-pack loader runtime
- `EVO-19`
- broader Track A productization

如果发现这些 lane 才能真正解决问题，必须停止并记录为 packet assumption breach，而不是继续扩批。

## 3. Required Reads Before Coding

至少按顺序读取：

1. `AGENTS.md`
2. `meta/remediation_tracker_v1.json`
3. `meta/REDESIGN_PLAN.md`
4. `meta/docs/prompts/IMPLEMENTATION_PROMPT_CHECKLIST.md`
5. 本文件 `meta/docs/prompts/prompt-2026-03-25-evo18-rep-sdk-event-native-signals-and-selector.md`
6. `meta/docs/track-a-evo17-rep-sdk-design.md`
7. `meta/docs/track-a-evo18-signal-engine-design.md`
8. `meta/schemas/research_signal_v1.schema.json`
9. `packages/rep-sdk/package.json`
10. `packages/rep-sdk/src/index.ts`
11. `packages/rep-sdk/src/model/index.ts`
12. `packages/rep-sdk/src/model/research-event.ts`
13. `packages/rep-sdk/src/model/research-strategy.ts`
14. `packages/rep-sdk/tests/package-contract.test.ts`
15. `packages/rep-sdk/tests/schema-parity.test.ts`
16. `packages/rep-sdk/tests/fixtures.ts`
17. `packages/shared/src/memory-graph/index.ts`
18. `packages/shared/src/memory-graph/types.ts`

禁止只看 schema 名称或旧设计文档摘要就动手；必须同时看 live `rep-sdk` surface 和 deferred shared boundary。

## 4. GitNexus Hard Gate

### 4.1 实施前

当前 repo context 已经表明 GitNexus index 落后 `HEAD` 14 commits，因此未来 implementation lane 开工前必须重新对齐。

1. 读取 `gitnexus://repo/autoresearch-lab/context`
2. 当前 implementation lane 若是 dirty worktree，默认运行：

```bash
npx gitnexus analyze --force
```

3. 至少对以下符号做 `context` / `impact`：
   - `ResearchEvent`
   - `ResearchStrategy`
   - `FileTransport`

### 4.2 审核前

本批预期会新增 `signals` 模块、schema snapshot 与 tests，并改变 `rep-sdk` public export surface，因此正式审核前默认必须：

```bash
npx gitnexus analyze --force
```

然后至少：

1. 运行 `detect_changes`
2. 必要时补 `impact` / `context`
3. 把 `package.json`、`src/model/**`、`src/signals/**`、相关 tests 一并纳入 review packet

## 5. Current Reality To Fix

当前 live `rep-sdk` path 存在五个明确缺口：

1. `ResearchSignal` 只存在于 `meta/schemas/`，还没有 package-local schema snapshot。
2. `packages/rep-sdk` 当前 exports 只有 `root/client/server/transport/validation/discovery`，没有 `signals` 子路径。
3. `ResearchEvent` live enum 已包含 `signal_detected` / `stagnation_detected` / `diagnostic_emitted`，但 `rep-sdk` 还没有明确定义这些 derived/diagnostic events 在 signal extraction 中如何 fail-closed 或跳过。
4. `ResearchStrategy` 已有 `explore/deepen/verify/consolidate` preset，但还没有 selector runtime 把 signals 映射到这些 preset。
5. 旧 `EVO-18` 详设默认把 `EVO-06` / `EVO-07` / `EVO-11` / `EVO-20` 当成可直接接线的 live seam；当前 repo reality 还不支持这样做。

本批真正要补上的是：

1. `ResearchSignal` package-local schema/type/runtime authority
2. bounded `@autoresearch/rep-sdk/signals` public library surface
3. event-native detector + dedup + stagnation core
4. pure-library selector with scored result and reasoning
5. 明确“研究信号空间开放，但首批 detector implementation 受现有 contract 约束”的边界

## 6. Locked Implementation Decisions

以下决策在本批中**已经锁定**，implementer 不得再自行改：

1. **`ResearchSignal` schema authority = meta -> package-local snapshot**
   - 从 `meta/schemas/research_signal_v1.schema.json` 派生 `packages/rep-sdk/schemas/research_signal_v1.schema.json`
   - 必须有 parity test
   - 不允许在 package-local snapshot 中自创第二套 authority
2. **Public runtime surface = new `./signals` subpath only**
   - `@autoresearch/rep-sdk/signals` 暴露 library helpers
   - root package 允许补 `ResearchSignal` type export，但不要把 signals helpers 散回 root runtime surface
3. **Pure-library only**
   - 本批只提供 `extractSignals(events, options?)` 与 `selectStrategy(input)`
   - 不自动写 transport、不自动 append `report` envelope、不创建后台循环
4. **No internal package dependency**
   - `@autoresearch/rep-sdk` 继续保持 zero internal runtime dependency
   - 不引入 `@autoresearch/shared` 或任何 `@autoresearch/*` dependency
5. **Event-native core, contract-gated detectors**
   - 首批只实现当前 checked-in `ResearchEvent` contract 足以直接支撑的 detector
   - 当前推荐 shipped detectors = `method_plateau`、`cross_check_opportunity`、`stagnation`
   - `parameter_sensitivity` / `calculation_divergence` / `integrity_violation` / `known_result_match` / `gap_detected` 不在本批实现
6. **Defer != narrow research scope**
   - 上述 detector 被 defer，是因为所需事件枚举、report runtime、或 shared/provider seam 还未 become live authority
   - 不是因为 `EVO-18` 只服务某几类研究问题
7. **No recursive signal ingestion**
   - `signal_detected` / `stagnation_detected` / `diagnostic_emitted` 不得再次触发 detector pipeline，避免自我回路
8. **No public plugin/registration API in slice 1**
   - 本批不实现 domain-pack loader / registry runtime
   - 但内部结构必须避免写死 HEP-only semantics，为未来 event-type expansion 或 domain-pack seam 留出 clean path
9. **No `EVO-11` handoff contract in slice 1**
   - selector 只返回 strategy selection result
   - 不新增 `StrategyContext` / `BanditSelection` public contract

## 7. Preferred Implementation Shape

### 7.1 Model and schema surface

必须补齐：

1. `packages/rep-sdk/src/model/research-signal.ts`
2. `packages/rep-sdk/src/model/index.ts` 对 `ResearchSignal` type 的导出
3. `packages/rep-sdk/src/index.ts` 对 `ResearchSignal` type 的根导出
4. `packages/rep-sdk/schemas/research_signal_v1.schema.json`

### 7.2 `signals` module shape

推荐按以下最小模块拆分，避免单文件过大：

1. `packages/rep-sdk/src/signals/index.ts`
2. `packages/rep-sdk/src/signals/types.ts`
3. `packages/rep-sdk/src/signals/extract-signals.ts`
4. `packages/rep-sdk/src/signals/dedup.ts`
5. `packages/rep-sdk/src/signals/stagnation.ts`
6. `packages/rep-sdk/src/signals/select-strategy.ts`
7. `packages/rep-sdk/src/signals/event-native-detectors.ts`

如果实现时需要调整文件名，也必须保持：

1. 单文件职责单一
2. `index.ts` 只做 re-export
3. 不出现万能文件名
4. signals helpers 只从 `./signals` 暴露

### 7.3 `extractSignals(events, options?)`

必须满足：

1. 输入是 `ResearchEvent[]`
2. 输出只包含 SSOT-compliant `ResearchSignal[]`
3. 先按 live event contract 做 detector 路由，再做 fingerprint dedup，再做 stagnation synthesis
4. derived/diagnostic events 必须跳过，不得递归产出新 signal
5. dedup 必须 deterministic，默认以 `signal_type + fingerprint_key` 为基础
6. options 只允许最小 bounded config：
   - dedup window
   - stagnation threshold
   - current strategy / goal for stagnation context

### 7.4 `selectStrategy(input)`

必须满足：

1. 仅返回 strategy preset 级别选择
2. 复用当前 `ResearchStrategy` 的 `preset` 枚举：`explore/deepen/verify/consolidate`
3. 输出至少包含：
   - `selected_strategy`
   - `score`
   - `all_scores`
   - `reasoning`
   - `decisive_signals`
4. score breakdown 必须可测试且 deterministic
5. 不引入 `EVO-11` handoff 或 operator/backend 概念

## 8. Acceptance And Tests

最终 acceptance command set：

```bash
git diff --check
pnpm --filter @autoresearch/rep-sdk lint
pnpm --filter @autoresearch/rep-sdk test
pnpm --filter @autoresearch/rep-sdk build
cd packages/rep-sdk && npm pack --dry-run
```

最低必须新增并证明：

1. `@autoresearch/rep-sdk/signals` 可独立 import
2. `ResearchSignal` package-local schema snapshot 与 `meta/schemas` parity 通过
3. `package-contract` 继续证明 `@autoresearch/rep-sdk` 无 `@autoresearch/*` runtime dependencies
4. current live event-native detectors 可从 `ResearchEvent` 序列中提取出正确 signals
5. dedup 对相同 fingerprint deterministic merge
6. stagnation threshold 超过时产生 `stagnation` signal
7. `signal_detected` / `stagnation_detected` / `diagnostic_emitted` 不会递归触发新的 detector output
8. `selectStrategy(input)` 返回 deterministic preset + score breakdown + reasoning
9. 本批未引入 `@autoresearch/shared` 依赖、`EVO-11` handoff contract、或 transport side effect

## 9. Review Packet Boundary

formal review packet 至少应包含：

1. `packages/rep-sdk/package.json`
2. `packages/rep-sdk/schemas/research_signal_v1.schema.json`
3. `packages/rep-sdk/src/model/research-signal.ts`
4. `packages/rep-sdk/src/model/index.ts`
5. `packages/rep-sdk/src/index.ts`
6. `packages/rep-sdk/src/signals/**`
7. `packages/rep-sdk/tests/**` 中本批新增/变更的 signals tests
8. `meta/schemas/research_signal_v1.schema.json`

默认排除：

- `packages/shared/src/memory-graph/**` implementation changes
- `packages/idea-engine/**`
- Python runtime surfaces
- `EVO-06` / `EVO-07` / `EVO-11` / `EVO-19`
- 不相关 REP transport/productization work

## 10. Formal Review-Swarm And Self-Review

### 10.1 Formal review-swarm

必须使用固定 reviewer trio：

- `Opus`
- `Gemini-3.1-Pro-Preview`
- `OpenCode(zhipuai-coding-plan/glm-5)`

review packet 必须要求 reviewer 显式复核：

1. 本批是否真的保持 `rep-sdk` zero-internal-dependency boundary
2. `ResearchSignal` authority 是否只有 `meta schema -> package snapshot -> runtime type` 这一条路径
3. 首批 detector defer boundary 是否仍然是 contract-gated，而不是把研究范围写窄
4. 是否误把 `signal_detected` / `stagnation_detected` 当成 detector input
5. 是否误引入了 `EVO-11` / `EVO-20` / HTTP transport / broader productization

### 10.2 Self-review

self-review 也必须显式复核：

1. package export surface 是否只新增 `./signals`
2. signals runtime 是否 pure-library、无 transport side effect
3. `defer != narrow research scope` 是否在代码、测试、closeout 叙事中都说得一致
4. tracker / `REDESIGN_PLAN.md` / canonical prompt 是否仍与最终实现事实对齐

## 11. Deliverables And Closeout

本批 closeout 至少必须同步：

1. 本 canonical prompt（若 implementation 对其做了 batch-local clarifying corrections）
2. `meta/remediation_tracker_v1.json`
3. `meta/REDESIGN_PLAN.md`
4. 如无新的长期稳定架构不变量，明确写明 `.serena/memories/architecture-decisions.md` 无需更新

条件化下一批建议必须明确写出：

1. 推荐下一步优先继续 `EVO-18` deferred detectors，还是转去 `EVO-06` / `EVO-07` / `EVO-11`
2. 为什么是该 lane
3. 为什么不是相邻但当前不该启动的 lane
