# Prompt: 2026-03-13 EVO-01A Compute Bridge

> 默认继承 `meta/docs/prompts/IMPLEMENTATION_PROMPT_CHECKLIST.md`。
>
> 本 prompt 对应一个**单独的新实现对话**，目标是把 `EVO-01` 收敛为一个更小、更安全、可验证的 `EVO-01-A` bridge batch：`idea / method_spec -> execution_plan -> computation_manifest_v1 -> dry_run -> A3 approval packet`。
>
> **规划基线说明**：本 prompt 基于 `main` 上 `3416e5ab57b104c9224969224d29db07385edd4e` 的代码状态、GitNexus context、以及上一轮 planning/review 产物收敛结论编写。当前 worktree/`main` 可能比该基线多出 1 个 GitNexus appendix marker commit；实现对话仍必须重新做 GitNexus freshness check，不得把这里的基线说明当成免检许可。

## 0. Why This Batch Next

当前 compute lane 的上下游基础已经到位，但中间 bridge 仍缺失：

- `NEW-CONN-04` 已让 `hep_run_create_from_idea` 能创建 run 并写出 `outline_seed_v1.json`。
- `UX-02` 已让 `computation_manifest_v1.schema.json` 成为 live manifest contract。
- `NEW-COMP-01` 已把 compute surface 的安全边界锁定在 contract / containment / approval 语义上。
- `NEW-COMP-02` 已把 generic execution / approval / audit authority 收口到 `packages/orchestrator/src/computation/`，并明确 `dry_run` 与 `A3` gating 先于任何真实执行。
- `NEW-LOOP-01` 已提供 `ComputeHandoff` typed seam，但尚未接上从 staged idea 到 materialized manifest 的实际桥接逻辑。

因此，下一个批次不应是全量 `EVO-01`，也不应越级启动 `NEW-05a-stage3` 或 `EVO-13`。本批只解决最小、最关键、最可验证的 bridge 缺口。

## 1. Hard Scope Boundary

### 1.1 In scope

- 从 staged idea surface 提取可计算意图：
  - `IdeaHandoffC2`
  - `outline_seed_v1.json`
  - 若存在的 `method_spec` / compute-hint / handoff metadata
- `execution_plan` compiler
- `execution_plan` -> `computation_manifest_v1` materializer
- `dry_run` validation 接线
- `A3` approval packet enrichment / bridging
- 针对上述 bridge 的 targeted tests / contract tests / smoke tests
- 必要的 shared/provider-neutral schema/type/doc sync

### 1.2 Out of scope

- real provider execution
- compute result ingestion / feedback loop (`EVO-02`)
- writing / review mapping (`EVO-03`)
- `NEW-05a-stage3`
- `EVO-13`
- multi-provider routing / automatic provider selection policy
- 新的 packaged end-user agent
- 对 `NEW-COMP-02` generic execution core 的 lane 外重做

### 1.3 Completion Lock

本批完成态**只允许**停在以下两种状态：

1. `dry_run: true` 返回 `status: "dry_run"`，且 validation 成功。
2. `dry_run: false` 在未满足 A3 时返回 `status: "requires_approval"`，并生成 approval packet。

在本批里，**审批前零执行**是硬门禁：

- 不得执行任何真实 provider
- 不得 `spawn` / `spawnSync` 进入脚本执行路径
- 不得产出真实计算结果
- 不得把 trivial provider / echo execution 包装成“不是 execution”

若为满足 manifest self-consistency 需要 staged script/config stub，它们可以被**写入** `run_dir/computation/`，但不得被**执行**。

## 2. 开工前必须读取

按顺序至少读取：

1. `AGENTS.md`
2. `meta/remediation_tracker_v1.json`
3. `meta/REDESIGN_PLAN.md`
4. `meta/docs/prompts/IMPLEMENTATION_PROMPT_CHECKLIST.md`
5. 本文件 `meta/docs/prompts/prompt-2026-03-13-evo01a-compute-bridge.md`
6. `/Users/fkg/Coding/Agents/autoresearch-lab/.review/2026-03-12-evo01a-planning-review-opus-r1.txt`
7. `/Users/fkg/Coding/Agents/autoresearch-lab/.review/2026-03-12-evo01a-planning-review-gemini-r1.txt`

若 6-7 在当前机器上不存在：

- 明确记录缺失
- 继续以本 prompt 第 6.2 节已固化的 planning 收敛结论作为 authority
- 不得把“没找到 planning review 文件”当成放松 scope / safety gate 的理由

然后继续读取以下设计/合同/代码/测试：

8. `meta/docs/computation-mcp-design.md`
9. `meta/docs/idea-runs-integration-contract.md`
10. `meta/schemas/computation_manifest_v1.schema.json`
11. `packages/hep-mcp/src/tools/create-from-idea.ts`
12. `packages/hep-mcp/src/tools/execute-manifest.ts`
13. `packages/orchestrator/src/computation/index.ts`
14. `packages/orchestrator/src/computation/manifest.ts`
15. `packages/orchestrator/src/computation/approval.ts`
16. `packages/orchestrator/src/computation/types.ts`
17. `packages/orchestrator/src/research-loop/handoff-types.ts`
18. `packages/hep-mcp/tests/core/createFromIdea.test.ts`
19. `packages/hep-mcp/tests/contracts/ideaRunsIntegrationContract.test.ts`
20. `packages/hep-mcp/tests/core/computationManifestSchema.test.ts`
21. `packages/hep-mcp/tests/contracts/executeManifestAdapterContract.test.ts`
22. `packages/hep-mcp/tests/contracts/executeManifestApprovalContract.test.ts`
23. `packages/orchestrator/tests/execute-manifest-core.test.ts`
24. `packages/orchestrator/tests/research-loop-types.test.ts`
25. `packages/orchestrator/tests/research-loop-smoke.test.ts`

## 3. GitNexus Hard Gate

### 3.1 实施前

1. 读取 `gitnexus://repo/{name}/context`
2. 若 index stale，先运行 `npx gitnexus analyze`
3. 再读一次 context
4. 至少用 GitNexus 对齐以下 surface：
   - `createFromIdea`
   - `executeComputationManifest`
   - `ensureA3Approval`
   - `ComputeHandoff`

### 3.2 审核前

若实现新增/重命名符号、改变关键调用链、或当前 index 已不反映工作树：

1. 再次运行 `npx gitnexus analyze`
2. 使用 `detect_changes`
3. 必要时补 `impact` / `context`

若有候选实现可能把 compiler + materializer 重新揉回同一个 authority surface：

4. 必须先对该候选函数/模块运行 `impact`
5. 在 review/self-review 中明确记录 blast radius 与最终未采用该合并路径的理由

若 GitNexus 对新文件 / 新 helper callsites 再次漏报或 MCP 异常：

- 明确记录失败
- 改用 direct source inspection + targeted tests 作为 exact verification
- 不得假装 graph evidence 已成功获取

## 4. 目标架构

### 4.1 两段式 bridge 是硬要求

本批必须显式拆成两个独立职责：

1. `execution_plan` compiler
2. `manifest` materializer

禁止把两者揉成一个黑盒函数，或让 materializer 重新把 `IdeaHandoffC2` 当 authority 读一遍。

要求：

- compiler 的 authority input 是 staged idea surface（`outline_seed_v1.json` + 可用 handoff/method hints）
- materializer 的 authority input 是**已验证通过的** `execution_plan`
- materializer 不得跳过 plan 直接从 idea/handoff 生成 manifest

### 4.2 `execution_plan` 必须是最小可扩展 IR

`execution_plan` 是本批的最小、可审计、可扩展中间表示。它必须：

- provider-neutral
- capability-first / task-first
- 不把未来 provider / routing / toolchain 选择写死为长期 authority
- 允许后续扩展到多步 / DAG / conditional / richer method decomposition

可以最小，但不能把未来路由直接封死。最低要求：

- 有 checked-in、versioned schema（默认放在 `meta/schemas/`；若路径不同，必须仍是 checked-in canonical schema，而不是 runtime-only object）
- 有明确 `schema_version`
- 有来源 provenance（至少 run / outline seed / source handoff）
- 有 task 列表
- task 能表达：
  - 来自哪些 hypothesis / claim / method hints
  - 需要哪些能力（capabilities）
  - 预期产物（expected artifacts）
  - 仅供 materializer 使用的 lowering hints（如确有必要）

明确禁止：

- 在 `execution_plan` 里把 provider authority 固定成 `hep-calc` 或当前四个 manifest tool enum
- 直接把 `mathematica|julia|python|bash` 视为 plan-level canonical ontology
- 先把 provider route 猜死，再把这个猜测伪装成 generic plan

### 4.3 `computation_manifest_v1` 仍是 materialized execution surface

本批的 materializer 负责把 validated `execution_plan` lower 到当前 live execution contract：

- 目标 surface = `computation_manifest_v1`
- 目标位置 = `run_dir/computation/manifest.json`（或等价 canonical path）

若同时保留审计副本：

- 必须明确哪个路径是 canonical authority
- 副本必须与 canonical manifest byte-identical 或有明确 provenance linkage

### 4.4 Fail-Closed Validation Chain

本批必须把以下验证链锁成 fail-closed：

1. staged idea input validation
2. `execution_plan` validation
3. materialization validation
4. `computation_manifest_v1` schema validation
5. `prepareManifest(...)` dry-run readiness validation

只有在 1-5 全部通过后，non-dry-run 路径才允许进入 A3 request。

任何一层失败时都必须：

- 明确返回 deterministic error
- 保留 machine-readable diagnostics（至少包含 validation layer 标识、failure reason、以及底层 validator/issues payload 若可用）
- 不生成 approval request
- 不进入 execution path
- 不产出假阳性的 “validated” / “ready_for_approval”
- 不得把 validation diagnostics 静默丢弃

### 4.5 `hep_run_create_from_idea` 应保持 pure staging

`createFromIdea()` 当前语义是 pure staging。默认应保持这一点：

- 它可以继续创建 run 并写 `outline_seed_v1.json`
- 它可以返回后续 `next_actions`
- 但不应悄悄顺手把整个 plan/materialization pipeline 隐藏进去，除非这样做仍能保持 bridge artifact boundary 显式、可审计、可单独测试

更推荐的形态是：

- 保留 `hep_run_create_from_idea`
- 增加一个显式的薄 host surface（例如 `hep_run_plan_computation`，名称可审查后微调）
- 由该 host surface 调用 generic/provider-neutral compiler + materializer authority

不管最终 host tool 命名为何，**authority** 不能落在 `hep-mcp` 本地。

## 5. 预期实现形状

### 5.1 Authority placement

优先把以下 authority 放到 provider-neutral 层：

- `execution_plan` types / schema / validator
- compiler logic
- materializer logic
- bridge-specific dry-run / approval prep semantics

`hep-mcp` 只应保留：

- MCP tool registration
- input schema / risk wiring
- thin delegation
- run/path containment checks

### 5.2 Artifact boundary

至少要有两类清晰产物：

1. audited `execution_plan` artifact
2. materialized manifest / computation workspace surface

推荐最小产物链：

- `outline_seed_v1.json`
- `computation/execution_plan_v1.json`
- `computation/manifest.json`

其中：

- `computation/execution_plan_v1.json` 应作为 run-local canonical audited plan artifact
- 该 artifact 必须明确记录与 `outline_seed_v1.json` / source handoff 的 provenance linkage

### 5.3 Method-spec handling

若 source handoff 中存在足够结构化的 `method_spec` / compute hints，可被 compiler 消费。

若缺失：

- 可以退化为由 thesis / claims / hypotheses 构成的最小 task extraction
- 也可以 deterministic fail-closed

但不允许：

- 为了让流程“看起来能跑”而幻觉出虚假的 provider-specific steps
- 在 materializer 阶段补发明原本不存在的 method authority

## 6. Amendment Intake Discipline

本节是本批的硬门禁，不是可选建议。

### 6.1 默认立场

对 reviewer amendments 的默认立场是：

- **先假设应该吸收**
- 只有在给出充分、repo-grounded、可验证理由后，才允许不吸收

### 6.2 本批已确认必须吸收的高价值 amendment

以下结论已经在 planning/review 中收敛，本批默认视为**预先 adopted**，不是“实现时再看情况”：

1. batch 明确拆成 `execution_plan` compiler + manifest materializer
2. 完成态锁定为 `dry_run` + `requires_approval`，审批前零执行
3. `execution_plan` 使用最小可扩展 IR，不把未来 provider/routing 写死
4. plan/materialization 必须 fail-closed，通过 schema/validator 校验后才允许进入 A3

若实现者认为其中任一条无法吸收，必须：

- 明确指出冲突的 repo 事实
- 给出替代方案
- 解释为什么替代方案不会破坏本批 scope / safety / future extensibility
- 在 checked-in prompt / tracker / self-review 中记录，而不是只写在临时聊天里

### 6.3 Disposition ledger

对每条 amendment 必须记录 disposition：

- `adopted`
- `deferred`
- `declined`
- `closed`

并满足：

- `deferred` / `declined` / `closed` 必须给出 repo-grounded 理由
- 不允许写“主观上感觉不值得”这类理由
- 仍有后续价值的 `deferred` 必须同步到持久 SSOT
- 低价值、已无必要、或已被现有实现覆盖的项可以 `declined/closed`，但也必须给证据

## 7. Tests And Acceptance Commands

至少跑以下命令；若本批引入新的 shared schema / codegen / generated contract，还要补相邻 regeneration 与 shared package tests/build。

```bash
pnpm --filter @autoresearch/shared build
pnpm --filter @autoresearch/shared test
pnpm --filter @autoresearch/orchestrator build
pnpm --filter @autoresearch/orchestrator test -- tests/execute-manifest-core.test.ts
pnpm --filter @autoresearch/orchestrator test -- tests/research-loop-types.test.ts tests/research-loop-smoke.test.ts
pnpm --filter @autoresearch/hep-mcp build
pnpm --filter @autoresearch/hep-mcp test -- tests/core/createFromIdea.test.ts
pnpm --filter @autoresearch/hep-mcp test -- tests/core/computationManifestSchema.test.ts
pnpm --filter @autoresearch/hep-mcp test -- tests/contracts/ideaRunsIntegrationContract.test.ts
pnpm --filter @autoresearch/hep-mcp test -- tests/contracts/executeManifestAdapterContract.test.ts
pnpm --filter @autoresearch/hep-mcp test -- tests/contracts/executeManifestApprovalContract.test.ts
pnpm --filter @autoresearch/orchestrator test -- tests/compute-bridge.test.ts
pnpm --filter @autoresearch/hep-mcp test -- tests/contracts/compute-bridge-contract.test.ts
git diff --check
```

如果 `tests/compute-bridge.test.ts` 或 `tests/contracts/compute-bridge-contract.test.ts` 当前不存在，本批必须创建。

最低测试语义要求：

1. success path:
   - staged idea -> validated `execution_plan`
   - `execution_plan` -> valid `computation_manifest_v1`
   - `dry_run` 返回 `status: "dry_run"`
   - non-dry-run 返回 `status: "requires_approval"` + `gate_id: "A3"`
2. fail-closed path:
   - invalid staged input / insufficient plan / invalid materialization 任一路径都不会产生 approval request
3. zero-execution path:
   - 进入 `requires_approval` 前没有脚本被执行
   - 没有真实输出 / logs / execution status 被误产出成“已跑过”
   - 必须有 process-level 断言证明 dry-run 与 pre-approval path 不会触发 child process spawn（例如对 `child_process` 入口做 spy/stub 或等价机制）

## 8. Review-Swarm / Self-Review

### 8.1 Formal review

默认 reviewer 固定为：

- `Opus`
- `Gemini-3.1-Pro-Preview`
- `OpenCode(kimi-for-coding/k2p5)`

如有 reviewer 不可用，必须记录失败原因并由人类明确确认 fallback reviewer。

review packet 必须检查：

- 是否真的实现了 compiler / materializer split
- `execution_plan` schema 是否已 checked in、versioned，且带明确 `schema_version`
- `execution_plan` 是否保持最小可扩展 IR，而非 provider-locked object
- 是否在任何 approval 前保持零执行
- `hep-mcp` 是否只是 thin host surface，而非 bridge authority
- fail-closed validation 是否覆盖 input/plan/materialization/dry-run readiness
- tests 是否真实锁住 success + fail-closed + zero-execution 三条主路径
- 是否误把本批扩大成 `EVO-02` / `EVO-03` / `NEW-05a-stage3` / `EVO-13`

### 8.2 Self-review

self-review 必须明确回答：

1. `execution_plan` 的 authority 在哪里
2. materializer 的 authority 在哪里
3. `hep-mcp` 还剩哪些 host-local 责任
4. 为什么本批完成后依然不是 full `EVO-01`
5. 哪些 amendments 被 `adopted / deferred / declined / closed`
6. GitNexus post-change evidence 是否成功获取；若失败，exact verification 由什么替代

## 9. SSOT Sync Requirements

完成后至少同步：

1. `meta/remediation_tracker_v1.json`
2. `AGENTS.md`

按需同步：

3. `meta/REDESIGN_PLAN.md`
4. `.serena/memories/architecture-decisions.md`

### 9.1 Tracker discipline

本批是 `EVO-01-A` bridge，不是 full `EVO-01` closeout。

因此：

- 不得把 full `EVO-01` 误标为已全部完成，除非 real provider execution / feedback / writing mapping 也一并完成
- 若 tracker 仍只有 `EVO-01` 主条目，至少要在 note 中明确：
  - `EVO-01-A` bridge 已完成了什么
  - full `EVO-01` 还剩什么
- 若 tracker schema/现有条目结构已经支持明确的子项或 linked follow-up，可在不制造第二套 SSOT 的前提下把 `EVO-01-A` bridge 记录为受控子范围；否则保留在现有 `EVO-01` 条目 note 中
- 若需要新增更细粒度跟踪，必须保持 SSOT 清晰，不要制造第二套漂移叙事

### 9.2 Potential long-lived invariant

若本批最终收敛出新的稳定不变量，最可能需要沉淀的是：

- `execution_plan` 是 provider-neutral audited IR
- `computation_manifest_v1` 是 materialized execution surface
- pre-approval path is validation-only, zero-execution

若这些不变量已在实现中稳定成立，应考虑同步到 `.serena/memories/architecture-decisions.md`。

## 10. Do Not Do

- 不要顺手实现 real provider execution
- 不要把本批扩成 feedback ingestion
- 不要把本批扩成 writing/review mapping
- 不要启动 `NEW-05a-stage3`
- 不要启动 `EVO-13`
- 不要把 provider routing 硬编码进 `execution_plan`
- 不要把 bridge authority 留在 `packages/hep-mcp/`
- 不要为了“先跑通”而绕过 schema/validator
- 不要通过 fake approval satisfaction 绕过 A3

## 11. Done Means

只有以下条件全部满足，本批才算完成：

1. staged idea surface 能稳定生成 validated `execution_plan`
2. validated `execution_plan` 能稳定 materialize 为 valid `computation_manifest_v1`
3. `dry_run: true` 返回 `status: "dry_run"`
4. `dry_run: false` 在未批准 A3 时返回 `status: "requires_approval"`
5. tests 证明审批前零执行
6. formal review `0 blocking`
7. self-review `0 blocking`
8. tracker / `AGENTS.md` 已同步
9. full `EVO-01` 没有被错误 closeout

本批一旦在 approval 前发生真实执行，即视为越界失败，而不是“额外完成了更多工作”。
