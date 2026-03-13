# Prompt: 2026-03-13 Standalone — `EVO-01` Minimal Single-User Closed Loop

> 默认继承 `meta/docs/prompts/IMPLEMENTATION_PROMPT_CHECKLIST.md`。
>
> 本 prompt 对应一个**单独的新实现对话**。
>
> 目标：在既有 `NEW-LOOP-01` substrate、`NEW-COMP-02` generic execution core、以及已完成的 `EVO-01-A` pre-approval bridge 之上，尽快做出一个**单用户可用**的最小闭环：
>
> `staged idea/run -> execution_plan_v1 -> A3 approval -> approved execution -> canonical computation outcome -> workspace feedback / next task`

## 0. Why This Batch Next

当前主干已经具备三个关键前置：

- `NEW-LOOP-01` 已完成，单用户 / 单项目 substrate 已落地。
- `NEW-COMP-02` 已完成，generic execution / approval / audit core 已落地。
- `EVO-01-A` 已完成，`idea / method_spec -> execution_plan_v1 -> computation_manifest_v1 -> dry_run / requires_approval` 的最小 bridge 已落地。

因此，下一个批次不应：

- 重做 `EVO-01-A`
- 提前启动 `EVO-13`
- 提前启动 `NEW-05a-stage3`
- 提前做 full `EVO-02`
- 提前做 full `EVO-03`
- 提前做 `NEW-07` / `EVO-04` / `EVO-14` / `EVO-15/16`

本批只解决最短主干的剩余缺口：**真实 approved execution + canonical outcome + 回到 substrate 的最小 feedback path**。

## 1. Hard Scope Boundary

### 1.1 In scope

本批只允许做以下工作：

1. 复用既有 `EVO-01-A` bridge，不回退到跳过 `execution_plan_v1` 的直接执行。
2. 打通 A3 已批准后的真实 execution path。
3. 产出 provider-neutral、可审计的 canonical computation outcome artifact。
4. 把 outcome 回写到 `NEW-LOOP-01` substrate：
   - 至少更新 `compute` task / `compute_attempt` 相关 event
   - success path 至少产出一个 `finding` follow-up
   - failure path 至少产出一个回到 `idea` / `literature` / method refinement 的 follow-up
5. 形成一条单用户 deterministic smoke path。
6. 补齐相邻 tests / contract tests / smoke tests。
7. 仅在必要时同步最小 SSOT。

### 1.2 Explicitly out of scope

本批明确禁止：

- 重做 `EVO-01-A`
- full `EVO-02`
- full `EVO-03`
- `EVO-13`
- `EVO-14`
- `NEW-05a-stage3`
- `NEW-07`
- A2A / registry / cross-instance sync
- Agent-arXiv / community / publication / reputation
- multi-provider automatic routing policy
- packaged end-user agent
- `TeamExecutionState`
- team-local checkpoint / lifecycle / heartbeat / cascade stop
- 把任一 shell / worker surface 写成 core authority
- 用 transcript / chat history / shell log 替代 workspace graph

### 1.3 Single-user clarification

`single-user` 指单一人类 owner / 单项目控制面，**不等于** `single-agent`。

本批允许单用户通过以下任意 worker surface 指挥执行：

- `Codex CLI`
- `Claude CLI`
- `Kimi-code CLI`
- `OpenClaw`
- 当前 repo 内已存在的多 agent workflow（如 `research-team`）

但必须守住：

- 它们只是 replaceable execution surface / worker surface
- 它们不是项目状态 SSOT
- 本批不得把“单用户可指挥多 agents”偷写成 `EVO-13` 已启动

## 2. 开工前必须读取

至少完整读取：

1. `AGENTS.md`
2. `meta/remediation_tracker_v1.json`
3. `meta/REDESIGN_PLAN.md`
4. `meta/docs/prompts/IMPLEMENTATION_PROMPT_CHECKLIST.md`
5. 本文件
6. `meta/docs/prompts/prompt-2026-03-13-evo01a-compute-bridge.md`
7. `meta/docs/prompts/prompt-phase3-impl-new-loop01.md`
8. `meta/docs/2026-03-07-evo13-single-project-multi-agent-runtime-memo.md`
9. `meta/docs/computation-mcp-design.md`
10. `meta/docs/idea-runs-integration-contract.md`
11. `meta/schemas/computation_manifest_v1.schema.json`
12. `packages/orchestrator/src/computation/`
13. `packages/orchestrator/src/research-loop/`
14. `packages/hep-mcp/src/tools/create-from-idea.ts`
15. `packages/hep-mcp/src/tools/plan-computation.ts`
16. `packages/hep-mcp/src/tools/execute-manifest.ts`
17. 相邻 orchestrator / hep-mcp tests

若本批最终复用 `research-team` 或其他现有 worker surface：

- 只读与当前 execution chain 直接相关的最小代码与测试
- 不得顺手把整个 workflow lane 升格成统一 team runtime 改造

## 3. GitNexus Hard Gate

### 3.1 实施前

1. 读取 `gitnexus://repo/autoresearch-lab/context`
2. 若 index stale，运行 `npx gitnexus analyze`
3. 再次读取 context
4. 至少对齐以下 symbol / flow：
   - `createFromIdea`
   - `planComputation`
   - `executeComputationManifest`
   - `ensureA3Approval`
   - `ComputeHandoff`
   - `FeedbackHandoff`
   - `ResearchLoopRuntime`

### 3.2 审核前

若新增/重命名符号、改变关键调用链或 index 已不反映工作树：

1. 再跑 `npx gitnexus analyze`
2. 跑 `detect_changes`
3. 必要时补 `impact` / `context`

若 GitNexus 对新 helper / 新 callsite 继续漏报：

- 必须记录失败
- 改用 direct source inspection + targeted tests 作为 exact verification
- 不得伪装成“graph evidence 已完整获取”

## 4. 目标架构

### 4.1 Authority placement

以下 authority 必须继续留在 provider-neutral 层：

- approved execution semantics
- outcome artifact contract
- outcome validation
- outcome -> workspace feedback lowering 主线
- approval sequencing

`hep-mcp` 或其他 host/provider layer 只允许保留：

- MCP tool registration
- input schema / risk wiring
- run/path containment
- thin delegation
- provider-local adapter glue

### 4.2 Canonical outcome artifact

优先复用已有 checked-in provider-neutral schema。

若现有 checked-in schema 不能无歧义承载本批 outcome，允许新增一个最小 checked-in schema；命名必须直接表达语义，例如 `computation_result_v1`，不要引入与当前 batch 强绑定的临时命名。

无论复用还是新增，最小 outcome contract 必须能表达：

- `schema_version`
- `run_id`
- `manifest_ref`
- `execution_status`
- `produced_artifact_refs[]`
- `started_at`
- `finished_at`
- `summary`
- `next_actions[]`
- `executor_provenance`
- `failure_reason?`

硬约束：

- outcome contract 必须 provider-neutral
- 不得把 `hep-calc` / `openclaw` / `codex` / `claude` / `kimi` 写成 canonical ontology

### 4.3 Minimal feedback loop

本批不是 full `EVO-02`，但必须落下最小 feedback path。

最低要求：

1. **success path**
   - `compute` task 完成
   - outcome artifact 与 `compute_attempt` / 相关 task/event 建立可审计 linkage
   - 至少创建一个 `finding` follow-up task

2. **failure path**
   - outcome artifact 明确失败
   - 不得静默结束
   - 必须创建一个回到 substrate 的 follow-up
   - 优先复用现有 `FeedbackHandoff`

3. **backtrack path**
   - 能把用户带回 `idea refinement`、`branch idea` 或 `literature follow-up`
   - 不得借机跳进 full writing/review lane

### 4.4 Feedback lowering rule

outcome -> feedback lowering 必须 deterministic-first：

- 依据 execution status、artifact availability、validator result、已知 failure reason 生成 follow-up
- 不以“再让 LLM 自由总结一次”作为主线 authority

若确实需要 LLM / agent 辅助总结：

- 只能是 bounded / advisory
- 主线状态迁移仍由 deterministic contract 决定
- 必须记录 provenance

## 5. 预期实现形状

### 5.1 推荐最小产物链

- `outline_seed_v1.json`
- `computation/execution_plan_v1.json`
- `computation/manifest.json`
- canonical computation outcome artifact

必要时可附：

- stdout/stderr artifact refs
- provider-local raw logs
- generated result files

### 5.2 推荐最小 smoke path

至少锁住一条真实闭环：

1. 从 staged idea / existing run 出发
2. 使用 validated `execution_plan_v1`
3. materialize valid `computation_manifest_v1`
4. 非 dry-run 进入 `requires_approval`
5. approval satisfied 后真实执行
6. 产生 canonical outcome artifact
7. workspace 中 `compute` task 状态更新
8. success -> `finding` follow-up
9. failure -> `FeedbackHandoff` / refine follow-up

### 5.3 Single-user usability rule

如果 end-to-end 仍需要用户手动拼多段内部 artifact 路径或手写内部状态机，不能算“单用户可用闭环”。

允许：

- 复用现有 host tools 组合
- 新增一个**薄** helper surface 改善 usability

不允许：

- 借 usability 之名做 packaged product shell
- 在 helper surface 内偷埋新的 authority

## 6. Tests And Acceptance Commands

至少运行：

```bash
bash meta/scripts/codegen.sh
pnpm --filter @autoresearch/shared build
pnpm --filter @autoresearch/shared test
pnpm --filter @autoresearch/orchestrator build
pnpm --filter @autoresearch/orchestrator test -- tests/execute-manifest-core.test.ts
pnpm --filter @autoresearch/orchestrator test -- tests/research-loop-types.test.ts tests/research-loop-runtime.test.ts tests/research-loop-smoke.test.ts
pnpm --filter @autoresearch/orchestrator test -- tests/compute-loop-execution.test.ts tests/compute-loop-feedback.test.ts
pnpm --filter @autoresearch/hep-mcp build
pnpm --filter @autoresearch/hep-mcp test -- tests/core/createFromIdea.test.ts
pnpm --filter @autoresearch/hep-mcp test -- tests/contracts/ideaRunsIntegrationContract.test.ts
pnpm --filter @autoresearch/hep-mcp test -- tests/contracts/executeManifestAdapterContract.test.ts
pnpm --filter @autoresearch/hep-mcp test -- tests/contracts/executeManifestApprovalContract.test.ts
pnpm --filter @autoresearch/hep-mcp test -- tests/contracts/compute-loop-contract.test.ts
git diff --check
```

若新增的测试文件当前不存在，本批必须创建。

最低测试语义：

1. pre-approval path 仍然 zero-execution
2. approved execution success：
   - 真实执行发生
   - outcome artifact 写出
   - workspace success follow-up 写出
3. approved execution failure：
   - failure outcome 写出
   - failure follow-up 写出
   - 不出现假阳性 success
4. no-state-split：
   - worker shell / CLI / provider log 不会替代 workspace 成为主状态
5. single-user usability：
   - 至少一条 deterministic smoke path，无需手动拼内部状态机

## 7. Review-Swarm / Self-Review

### 7.1 Formal review

默认 reviewer：

- `Opus`
- `Gemini-3.1-Pro-Preview`
- `OpenCode(kimi-for-coding/k2p5)`

review packet 必查：

- `EVO-01-A` 是否被正确复用，而非重做
- approved execution authority 是否仍在 provider-neutral layer
- outcome artifact 是否 provider-neutral
- minimal feedback loop 是否真的回到 `NEW-LOOP-01` substrate
- “单用户可指挥多 agents”是否只是 worker surface，而未偷带 `EVO-13`
- 是否错误引入 team state / registry / A2A / packaged agent
- 是否误把本批扩大成 full `EVO-02` / `EVO-03`

### 7.2 Self-review

self-review 必须明确回答：

1. 本批完成后，单用户闭环具体是哪条 path
2. 哪些多 agent / worker surface 被允许存在
3. 为什么这些 surface 不是 `EVO-13`
4. outcome artifact 的 authority 在哪里
5. feedback lowering 的 authority 在哪里
6. `EVO-01` 是否可以 closeout；若否，还剩哪些**仍属于 `EVO-01` 本身**的 gap
7. `EVO-02` 是否只落了 alpha / smoke，而非 full closeout
8. GitNexus post-change evidence 是否成功；若失败，exact verification 由什么替代

## 8. SSOT Sync Requirements

完成后至少同步：

1. `meta/remediation_tracker_v1.json`
2. `AGENTS.md`

按需同步：

3. `meta/REDESIGN_PLAN.md`
4. `.serena/memories/architecture-decisions.md`

### 8.1 关于 `REDESIGN_PLAN`

本批默认**不需要**结构性修改 `REDESIGN_PLAN`。

只有在以下情况才允许同步：

- checked-in 叙事仍把 `EVO-02` / `EVO-03` 的剩余工作误写成 `EVO-01` 的完成条件
- 需要纠正 `EVO-01` / `EVO-02` / `EVO-03` 的边界漂移

如果只是实现既有路线，不要写流水账式更新。

## 9. Do Not Do

- 不要重做 `EVO-01-A`
- 不要提前实现 `EVO-13`
- 不要新增 `TeamExecutionState`
- 不要做 agent registry / A2A / cross-instance
- 不要把 `Codex CLI` / `Claude CLI` / `Kimi-code CLI` / `OpenClaw` 写成 canonical runtime authority
- 不要把 transcript / shell log 变成项目状态 SSOT
- 不要顺手扩到 full `EVO-03`
- 不要顺手启动 `NEW-05a-stage3`
- 不要把 full `EVO-02` 混进来
- 不要为了“用户可用”而造一个 repo-root super-agent

## 10. Done Means

只有以下条件全部满足，本批才算完成：

1. `EVO-01-A` 的 zero-execution pre-approval 语义保持成立
2. approval satisfied 后真实执行可发生
3. canonical outcome artifact 已落地
4. workspace feedback / next task 已落地
5. 单用户已有一条 deterministic 可用闭环
6. 多 agent worker surface 若存在，仍只是 replaceable consumer
7. formal review `0 blocking`
8. self-review `0 blocking`
9. tracker / `AGENTS.md` 已同步
10. 未错误宣称 `EVO-13` 或 full `EVO-02/03` 已完成
