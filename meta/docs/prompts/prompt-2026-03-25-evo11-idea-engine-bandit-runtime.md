# Prompt: 2026-03-25 `EVO-11` — TS `idea-engine` Bandit Distributor Runtime

> 适用范围：**仅**用于一个新的 bounded implementation 对话。
> 默认继承 `meta/docs/prompts/IMPLEMENTATION_PROMPT_CHECKLIST.md`。
>
> 本批不是 `idea-core retire-all`，不是 `Pipeline A` repoint/delete， 不是 `EVO-19` / `EVO-21`，也不是更广的 `idea-engine` redesign。目标只有一个：把已存在的 distributor schema / contract seam 连接到 live TS `packages/idea-engine/` `search.step` authority path，并保持 scope 严格收敛在 `EVO-09` 之后的同一 TS lane。

## 0. Worktree Requirement

本 prompt **不得**在当前 planning worktree 实施：

- `/Users/fkg/Coding/Agents/autoresearch-lab-idea-engine-evo11-plan`

实现必须在主协调对话明确开的未来 dedicated TS `idea-engine` 实施 lane 上进行；不要回到主仓 `main` 直接实施。本 prompt 故意不在这里预先硬编码最终 worktree 绝对路径，但必须满足：

1. 不要在 planning-only worktree 上写实现代码。
2. 不要在主仓 `main` 直接实施本批。
3. 不要 `commit` / `push`，除非人类在未来 implementation 对话中再次明确授权。
4. 若实现过程中证明本批与 `idea-core retire-all`、`EVO-19`、`EVO-21` 或更广 `idea-engine` redesign 不可分离，必须停止并回报主协调对话，而不是静默扩批。

## 1. Why This Batch Next

截至 2026-03-25，当前 checked-in reality 已经是：

1. `NEW-05a-stage3` 已完成，live `search.step` authority 在 TS `packages/idea-engine/`
2. `NEW-R10` 已被 `cut`，不得重新打开 Python `service.py` decomposition lane
3. `EVO-09` 已在 TS `search.step` path 完成首个 bounded deliverable
4. `campaign_charter_v1`、`idea_campaign_v1`、`campaign_init_result_v1`、`search_step_result_v1`、`distributor_policy_config_v1`、`distributor_event_v1`、`distributor_state_snapshot_v1` 这些 checked-in schema seam 已存在
5. 但 live TS runtime 仍未把 distributor seam materialize 到 `campaign.init` / `search.step`

因此，本批的正确目标不是重新实现一套 Python bandit，也不是推进 Track B，而是：

1. 在 TS `campaign.init` 里 materialize campaign-scoped immutable `distributor_policy_config_v1.json`
2. 在 TS `search.step` 里把当前 tick 的 operator/backend 选择接到 bandit policy/state/event seam
3. 保持 `search.step` 仍是唯一 live authority path，不回切 Python

相邻 lane 当前都不该先启动：

- 不是 `idea-core retire-all`：那是后续 same-lane closeout，不是本批
- 不是 `EVO-19`：Gene Library / blast radius 不在本批
- 不是 `EVO-21`：主动进化 / 策略进化不在本批
- 不是 full factorized/joint redesign：首批只锁最小 live slice

## 2. Hard Scope Boundary

### 2.1 In scope

本批只允许覆盖：

1. `packages/idea-engine/src/service/write-service.ts`
2. `packages/idea-engine/src/service/search-step-service.ts`
3. `packages/idea-engine/src/service/` 下与 distributor 直接相关的新内部模块
4. `packages/idea-engine/tests/**` 中与 distributor runtime / replay / fail-closed guardrails 直接相关的新测试
5. 如有必要，为 schema contract 复核补跑现有 Python schema test，但不在 Python 侧新增 runtime authority

### 2.2 Explicitly out of scope

以下内容一律禁止顺手吸收：

- `packages/idea-core/src/idea_core/engine/distributor.py`
- `packages/idea-core/src/idea_core/engine/service.py`
- Python-first distributor runtime
- island selection bandit 化
- `joint` action-space runtime
- multi-axis factorized runtime beyond current-island-only operator/backend selection
- `idea-core` parity / MCP bridge delete
- `EVO-19`
- `EVO-21`
- broader `search.step` redesign unrelated to distributor
- 新 JSON-RPC method
- 新 schema / schema redesign

如果发现这些 lane 才能真正解决问题，必须停止并记录为 packet assumption breach，而不是继续扩批。

## 3. Required Reads Before Coding

至少按顺序读取：

1. `AGENTS.md`
2. `meta/remediation_tracker_v1.json`
3. `meta/REDESIGN_PLAN.md`
4. `meta/docs/prompts/IMPLEMENTATION_PROMPT_CHECKLIST.md`
5. 本文件 `meta/docs/prompts/prompt-2026-03-25-evo11-idea-engine-bandit-runtime.md`
6. `packages/idea-engine/src/service/rpc-service.ts`
7. `packages/idea-engine/src/service/write-service.ts`
8. `packages/idea-engine/src/service/search-step-service.ts`
9. `packages/idea-engine/src/service/search-operator.ts`
10. `packages/idea-engine/src/service/domain-pack-registry.ts`
11. `packages/idea-engine/src/service/hep-search-runtime.ts`
12. `packages/idea-engine/src/store/engine-store.ts`
13. `packages/idea-engine/tests/search-step-parity.test.ts`
14. `packages/idea-engine/tests/search-step-failure-library.test.ts`
15. `packages/idea-generator/schemas/campaign_charter_v1.schema.json`
16. `packages/idea-generator/schemas/campaign_init_result_v1.schema.json`
17. `packages/idea-generator/schemas/idea_campaign_v1.schema.json`
18. `packages/idea-generator/schemas/search_step_result_v1.schema.json`
19. `packages/idea-generator/schemas/distributor_policy_config_v1.schema.json`
20. `packages/idea-generator/schemas/distributor_event_v1.schema.json`
21. `packages/idea-generator/schemas/distributor_state_snapshot_v1.schema.json`
22. `packages/idea-generator/docs/plans/2026-02-12-idea-generator-architecture-spec.md`
23. `packages/idea-generator/docs/plans/2026-02-12-bandit-distributor-alternatives.md`
24. `packages/idea-generator/docs/plans/2026-02-12-statphys-distributor-policies.md`

禁止只看一个 schema 或一个 service 文件就动手。

## 4. GitNexus Hard Gate

### 4.1 实施前

1. 读取 `gitnexus://repo/{implementation-repo-name}/context`
2. 当前 implementation lane 若是 dirty worktree，默认运行：

```bash
npx gitnexus analyze --force
```

3. 至少对以下符号做 `impact` / `context`：
   - `IdeaEngineWriteService`
   - `IdeaEngineSearchStepService`
   - `IdeaEngineRpcService`

### 4.2 审核前

本批预期会新增 distributor 模块与 tests，并改变 live `campaign.init` / `search.step` 调用链，因此正式审核前默认必须：

```bash
npx gitnexus analyze --force
```

然后至少：

1. 运行 `detect_changes`
2. 必要时补 `impact` / `context`
3. 把 `write-service`、`search-step-service`、新的 distributor 模块、相关 tests 一并纳入 review packet

## 5. Current Reality To Fix

当前 live TS path 存在三个明确缺口：

1. `CampaignCharter.distributor` 已存在，但 `campaign.init` 还没有 materialize `distributor_policy_config_v1.json`
2. `idea_campaign_v1` / `campaign_init_result_v1` / `search_step_result_v1` 已有 `distributor_policy_config_ref`，但 TS runtime 仍未返回这些 ref
3. `search.step` 当前仍使用硬编码 selection policy (`round_robin_v1` / `island_index_v1`)；没有 decision event、state snapshot、replay seed、reward update 闭环

本批真正要补上的是：

1. distributor-enabled campaign 的 immutable config artifact
2. current-island-only operator/backend bandit selection
3. per-step `distributor_event_v1.jsonl` 审计日志
4. bounded `distributor_state_snapshot_v1.json` 状态落盘与重启恢复
5. fail-closed guardrails，防止外部 `policy_config_ref` 或未知 policy 把 authority 变成双入口

## 6. Locked Implementation Decisions

以下决策在本批中**已经锁定**，implementer 不得再自行改：

1. **Config source = runtime-synthesized**
   - `campaign.init` 根据 `charter.distributor.policy_id`、`factorization` 和 live action space materialize `distributor_policy_config_v1.json`
   - 首批不支持外部预置 config 作为 live authority
2. **`charter.distributor.policy_config_ref` = unsupported in slice 1**
   - 如果调用方显式提供该字段，本批必须 fail closed
   - 不允许同时支持 “运行时合成 + 外部 ref” 双模式
3. **Bandit scope = current-island-only operator/backend selection**
   - island 调度逻辑保持当前实现
   - 本批不做 `(backend, operator, island)` joint action，也不做三轴 factorized runtime
4. **No-distributor campaign preserves current behavior exactly**
   - 未配置 `charter.distributor` 时，`search.step` 结果、trace、store 布局与现有行为保持一致
5. **Built-in TS policy only**
   - live runtime 仅支持 checked-in 内建 TS policy
   - 可在测试/benchmark 中与 `softmax_ema` 对照，但不要把 `softmax_ema` 暴露为第二条生产 authority path

## 7. Preferred Implementation Shape

### 7.1 `campaign.init` responsibilities

`write-service.ts` 应负责：

1. 解析并校验 `charter.distributor`
2. 在 distributor enabled 时：
   - 校验 `policy_id`
   - 拒绝 `policy_config_ref`
   - 生成 campaign-scoped `distributor_policy_config_v1.json`
   - 将 `distributor_policy_config_ref` 持久化到 campaign state
   - 在 `campaign.init` result 中返回该 ref
3. 在 distributor disabled 时：
   - 不生成 config artifact
   - 不返回 `distributor_policy_config_ref`
   - 保持现有结果 shape

### 7.2 `search.step` responsibilities

`search-step-service.ts` 应负责：

1. 读取 campaign 中的 `distributor_policy_config_ref`
2. 对当前已经选定的 island 构造 eligible operator/backend action set
3. 调用新的 TS distributor policy/state seam 选择 action
4. 将本次 decision 写入 `distributor_events_v1.jsonl`
5. 在 operator 执行后执行 reward / realized_cost update
6. 周期性或每步落 `distributor_state_snapshot_v1.json`
7. 在 distributor enabled 时，把 `distributor_policy_config_ref` 回写到 `search.step` result

### 7.3 Provider-local boundary

必须保持以下边界：

1. generic distributor layer 只看 action ids、reward、cost、budget、diagnostics
2. HEP runtime/operator authority 仍留在 `hep-search-runtime.ts`
3. generic bandit layer 不得吸收 HEP-specific semantics、taxonomy、recipe logic 或 operator content generation

## 8. Acceptance And Tests

最终 acceptance command set：

```bash
git diff --check
pnpm --filter @autoresearch/idea-engine lint
pnpm --filter @autoresearch/idea-engine test -- tests/search-step-parity.test.ts
pnpm --filter @autoresearch/idea-engine test -- tests/search-step-distributor.test.ts
pnpm --filter @autoresearch/idea-engine test -- tests/distributor-policy.test.ts
pnpm --filter @autoresearch/idea-engine test
PYTHONPYCACHEPREFIX=/tmp/pycache python3 -m pytest packages/idea-core/tests/engine/test_reduction_and_schema_contracts.py -q
```

最低必须新增并证明：

1. distributor absent 时，`search.step` 与当前行为完全一致
2. distributor enabled 时，`campaign.init` 生成并返回 `distributor_policy_config_ref`
3. `search.step` 每个 tick 追加一条 `distributor_event_v1` 记录
4. 重启后 `distributor_state_snapshot_v1` 可恢复并继续决策
5. `policy_config_ref` 显式输入、未知 `policy_id`、action-space 不一致等情况 fail closed
6. replay determinism：相同 config/state/seed/event log 下结果可复现
7. synthetic benchmark / regression proof：所选 bandit policy 对 `softmax_ema` baseline 的 cumulative regret 更低

## 9. Review Packet Boundary

formal review packet 至少应包含：

1. `packages/idea-engine/src/service/write-service.ts`
2. `packages/idea-engine/src/service/search-step-service.ts`
3. 新增的 distributor policy/state/event helper files
4. `packages/idea-engine/src/service/search-operator.ts`
5. `packages/idea-engine/src/service/hep-search-runtime.ts`
6. 新增的 `idea-engine` distributor tests
7. 相关 schema authority 与 contract-loading surface

默认排除：

- Python runtime implementation files
- `idea-core retire-all`
- `EVO-19`
- `EVO-21`
- 不相关 `idea-engine` redesign

## 10. Formal Review-Swarm And Self-Review

### 10.1 Formal review-swarm

必须使用固定 reviewer trio：

- `Opus`
- `Gemini-3.1-Pro-Preview`
- `OpenCode(zhipuai-coding-plan/glm-5)`

reviewers 必须显式检查：

1. live authority 是否完全落在 TS `packages/idea-engine/`
2. 是否错误重新打开了 Python-first path
3. `campaign.init` 合成 config 是否造成第二条 authority
4. `search.step` 是否只在 current-island scope 内做 operator/backend selection
5. `policy_config_ref` unsupported guardrail 是否真的 fail closed
6. 是否顺手吸入了 retire-all、Track B、或更广 redesign

### 10.2 Self-review

当前执行 agent 还必须显式复核：

1. schema 已存在，本批是否只是在 live TS path 激活 seam，而不是擅自扩 schema
2. `search.step` 结果 shape 是否保持 backward-compatible with current checked-in contract
3. built-in TS policy 是否仍然只有一条 live authority path
4. amendments / deferred 是否都已落到持久 SSOT

## 11. Deliverables And Closeout

完成时至少要同步：

1. `meta/remediation_tracker_v1.json`
2. `meta/REDESIGN_PLAN.md`
3. 本 canonical prompt（若 implementation 对其做了 batch-local clarifying corrections）

closeout 必须明确写出：

1. `EVO-11` 是否仍为 pending larger lane，还是已有首个 bounded deliverable closeout
2. 当前还剩哪些同-lane follow-up
3. 为什么这些 follow-up 仍然不是 `idea-core retire-all`、`EVO-19`、或 `EVO-21`

## 12. One Recommended Next Batch After Closeout

若本批成功收口，唯一推荐的下一方向只能是：

- 同一 TS `idea-engine` lane 上，继续做 `EVO-11` 的下一条 bounded follow-up，或在其后进入同-lane `idea-core retire-all` closeout preparation

不要从本批直接跳去：

- `EVO-19`
- `EVO-21`
- broader `idea-engine` redesign
- Python-first cleanup lane
