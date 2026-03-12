# Prompt: 2026-03-12 Standalone — `NEW-COMP-02` Generic Computation Execution Core + First Host Adapter

> 适用范围：**仅**用于一个新的 bounded implementation 对话。
> 默认继承 `meta/docs/prompts/IMPLEMENTATION_PROMPT_CHECKLIST.md`。
>
> 本批基于当前 `main` 的真实状态重选，不沿用旧的 Phase 3 bundling 草稿。`UX-02`、`NEW-COMP-01`、`NEW-R15-impl`、`NEW-CONN-04`、`NEW-RT-04`、`NEW-IDEA-01`、`NEW-LOOP-01` 均已在 live code / tracker note 上收口；当前 compute critical path 缺的不是再一次 retro-closeout，也不是再造一个 HEP-local authority，而是 **真正可执行的 generic computation execution core + first host adapter**。

## 0. Why This Batch Next

截至当前 `main`（`b403b56979e70c68c5071e870ea0068683a56397`）：

- `computation_manifest_v1` contract 已存在，且 schema-level acceptance 已补齐；
- `hep_run_ingest_skill_artifacts` 已存在，计算证据摄取路径已打通；
- `orch_run_*` / `orch_policy_query` 已存在，A3 gate 与 run-state control-plane 已落地；
- `RunManifestManager` / durable execution 已存在；
- `create_from_idea` / `research_workflow_v1` / `ResearchLoopRuntime` 已存在，idea→run 与 loop substrate 已不再是 blocker。

因此，当前最合适的下一批是：

**`NEW-COMP-02` standalone implementation**
目标是把 `computation_manifest_v1` 落成一个真实可提交、可审批、可执行、可审计的 **generic computation execution core**，并只在当前 `main` 确有需要时暴露一个 **thin first host adapter**。

### 当前批必须先承认的真实 drift

repo 里有两处会直接污染实现边界的 drift：

- `meta/REDESIGN_PLAN.md` 仍把 `NEW-COMP-02` 写成 `compute_run_card_v2` / `compute_status` / `compute_resolve_gate`
- `meta/docs/computation-mcp-design.md` 与上一版 prompt 草稿都把 `hep_run_execute_manifest` 叙述成主要 execution surface，容易把 host package 误读成 authority
- live code 搜索未发现 `compute_run_card_v2` / `compute_status` / `compute_resolve_gate` 的 TS consumer；这些名称只残留在旧 planning / audit 叙事与 legacy Python computation 路径中
- live code 同时表明 authority 与 host 可以分离：run-state / durable execution primitives 在 `packages/orchestrator/`，当前 project-extension tool hosting 在 `packages/hep-mcp/`

本批必须收敛到一条明确的 authority chain，而不是继续把 host tool 名称、generic execution semantics、以及 provider 示例揉成同一层：

1. `computation_manifest_v1` + provider-neutral execution / approval / audit semantics
2. provider-neutral execution core（优先落在 orchestrator runtime/service 层；shared 仅承载 typed contract）
3. 当前 `main` 若仍需要，则在 `hep-mcp` 上暴露一个 thin first host adapter

## 1. Why Not Adjacent Batches

### 1.1 为什么不是 `EVO-01`

不是因为 `EVO-01` 不重要，而是它现在**过大且上层**：

- `EVO-01` 要处理 idea / method_spec → execution_plan handoff、provider routing、loop integration
- 这些都应建立在已存在的 compute execution MCP surface 之上，而不是倒过来在缺 substrate 时直接开闭环自动化
- 当前 `NEW-COMP-02` 是 `EVO-01` 的最小直接 unblocker

### 1.2 为什么不是 `NEW-05a-stage3`

- `NEW-05a-stage3` 是 TS 迁移 / 统一编排的独立大 lane
- 它更直接服务 `EVO-13` / 长期统一运行时，而不是当前已经被 rebaseline 校准后的 compute critical path
- 现在启动它，会把 compute execution 缺口与大迁移混成一个高风险 batch

### 1.3 为什么不是 `NEW-SKILL-01`

- `NEW-SKILL-01` 独立、低优先级、且不 unblock 当前主干
- `REDESIGN_PLAN` 也已把它放在较晚位置；它不应先于 compute execution substrate

### 1.4 为什么不是旧的 Phase 3 Batch 4 组合批

- 旧草稿把 `UX-03/UX-04 + NEW-COMP-02` 打包
- 但当前 `main` 上 `UX-03/UX-04` 已完成，这个 bundling 已过期
- 因此本批必须是 **standalone `NEW-COMP-02`**，而不是机械恢复旧 batch 结构

### 1.5 为什么不是再做一轮 generic rebaseline

- 仓库里仍可能存在其他 false-pending / plan drift
- 但它们不在当前 compute critical path 的最短 unblock 链上
- 本批只记录额外 drift，**不**顺手升级成全仓 rebaseline

## 2. Hard Scope Boundary

### 2.1 In Scope

本批只允许做以下工作：

1. **收敛 `NEW-COMP-02` 的 authority layering**
   - authority 必须是 `computation_manifest_v1` + provider-neutral execution / approval / audit semantics，而不是某个 `hep_*` tool 名
   - generic execution core 优先落在 provider-neutral layer（优先 `packages/orchestrator/`；shared 仅承载 typed contract / codegen）
   - `packages/hep-mcp/` 只允许承载首个 host adapter / tool registration，不得拥有 execution semantics authority
   - 除非源码审计发现真实 live consumer，否则**不要**再引入一套并行 `compute_status` / `compute_resolve_gate` public API
2. **实现 generic execution core，并在当前 `main` 需要时接一个 thin host adapter**
   - 若保留 host-local MCP entrypoint，则 `hep_run_execute_manifest` 是本批新增/落地物；`orch_run_status` / `orch_run_approve` / `orch_run_reject` 是既有复用物
   - host-local MCP entrypoint 可以仍是 `hep_run_execute_manifest`，但它只能是 adapter，不得成为 architecture authority
   - 若保留该 host tool，则需要在 `packages/hep-mcp/src/tool-names.ts` 与 `packages/hep-mcp/src/tool-risk.ts` 中完成 host-local wiring
   - execution 行为、状态迁移、approval 语义、result contract 不得被 host adapter 私有化
3. **对 `computation_manifest_v1` 做真实 validation + C-02 containment**
   - 路径必须收敛在当前 run 的稳定子目录内
   - 仅允许 schema 中已有的解释器族（`mathematica` / `julia` / `python` / `bash`）
   - 明确 blocked command / unsafe path 的 fail-closed 行为
4. **接上 A3 approval flow**
   - `dry_run=true` 时只做 validation / planning，不执行
   - 非 dry-run 时若未满足 A3，必须生成 approval packet 并 fail-closed 返回 `requires_approval`
   - 不得在 approval 之前发生部分执行
5. **实现 approved execution path**
   - 在通过 approval 的前提下实际执行 manifest
   - run-state / manifest mutation 必须复用既有 `RunManifestManager` 与 `StateManager`，不得在 host adapter 内平行复制一套状态迁移逻辑
   - 写入 provider-neutral、可审计的 execution/status artifacts
   - host adapter 输出必须能被后续 `hep_run_ingest_skill_artifacts` 使用，或至少能明确告诉调用方应该 ingest 哪个目录
6. **补齐 deterministic tests / contract tests / regression tests**
7. **同步必要 SSOT**
   - 至少 `meta/remediation_tracker_v1.json` + `AGENTS.md`
   - 若 authority wording 被确认改变，必须同步 `meta/REDESIGN_PLAN.md` 与 `meta/docs/computation-mcp-design.md`

### 2.2 Explicitly Out Of Scope

本批明确禁止：

- `EVO-01` / `EVO-02` / `EVO-03`
- `NEW-05a-stage3`
- `EVO-13`
- provider registry / domain-pack 扩展
- 新建一个新的 generic MCP host/package / namespace，只为本批追求命名纯度
- 第二套 public `compute_*` 工具族（除非发现 live caller，且必须先记录 blocker 再行动）
- 把 generic execution core 下沉进 `packages/hep-mcp/`
- 在 generic/shared/orchestrator 层引入 `hep-calc` 专属字段、默认值、provider enum 或其他 HEP-only authority
- 把 legacy Python `run_card v2` 重新提升为当前 authority
- generic tracker cleanup / 全仓 rebaseline
- 引入新的外部执行后端矩阵或 feature flag
- 顺手把 `hep-calc` 之外的 provider 一并产品化

## 3. 开工前必须读取

### 3.1 治理 / 规划 / 预读

1. `AGENTS.md`
2. `meta/remediation_tracker_v1.json`
3. `meta/REDESIGN_PLAN.md`
4. `meta/docs/prompts/IMPLEMENTATION_PROMPT_CHECKLIST.md`
5. 本文件 `meta/docs/prompts/prompt-2026-03-12-new-comp-02-compute-mcp.md`
6. `meta/docs/prompts/prompt-2026-03-12-phase2-compute-lane-rebaseline.md`
7. `meta/docs/computation-mcp-design.md`
8. `.tmp/new-comp-02-contract-preflight.md`
9. `.tmp/new-comp-02-generic-boundary-preflight.md`

### 3.2 相关 schema / 合同 / 旧实现参考

10. `meta/schemas/computation_manifest_v1.schema.json`
11. `meta/schemas/examples/computation_manifest_example.json`
12. `meta/schemas/computation_evidence_catalog_item_v1.schema.json`
13. `packages/hep-autoresearch/src/hep_autoresearch/toolkit/computation.py`
14. `packages/hep-autoresearch/workflows/computation.md`
15. `packages/hep-autoresearch/tests/test_orchestrator_computation_cli.py`
16. `/Users/fkg/Coding/Agents/Autoresearch/skills/hep-calc/SKILL.md`
17. `/Users/fkg/Coding/Agents/Autoresearch/skills/hep-calc/references/output_contract.md`

> `13-15` 只作为 legacy behavior/oracle 参考：
> - **可以借鉴**：path validation / trust / approval sequencing / artifact layout / failure semantics
> - **不得回灌**：命名、`run_card v2` schema authority、旧 CLI surface、跨语言 contract 设计
> - 若实现中需要“和旧 Python 行为一致”，必须先说明是一致于哪一类**行为**，而不是回退到旧 public naming

### 3.3 目标代码 / 相邻测试

18. `packages/hep-mcp/src/tools/registry/projectExtensions.ts`
19. `packages/hep-mcp/src/tools/registry/projectSchemas.ts`
20. `packages/hep-mcp/src/tool-names.ts`
21. `packages/hep-mcp/src/tool-risk.ts`
22. `packages/hep-mcp/src/tools/ingest-skill-artifacts.ts`
23. `packages/hep-mcp/src/tools/orchestrator/tools.ts`
24. `packages/hep-mcp/src/core/paths.ts`
25. `packages/hep-mcp/src/core/runs.ts`
26. `packages/orchestrator/src/state-manager.ts`
27. `packages/orchestrator/src/run-manifest.ts`
28. `packages/orchestrator/src/research-loop/handoff-types.ts`
29. `packages/orchestrator/src/research-loop/runtime.ts`
30. `packages/hep-mcp/tests/core/computationManifestSchema.test.ts`
31. `packages/hep-mcp/tests/core/ingestSkillArtifacts.test.ts`
32. `packages/hep-mcp/tests/contracts/orchRunApprove.test.ts`
33. `packages/orchestrator/tests/agent-runner-manifest.test.ts`

## 4. GitNexus Hard Gate

### 4.1 实施前

1. 读取 `gitnexus://repo/autoresearch-lab/context`
2. 若 stale，运行 `npx gitnexus analyze`
3. 再读一次 context
4. 在动手前至少用 GitNexus / source inspection 对齐这些 surface：
   - `RAW_PROJECT_EXTENSION_TOOL_SPECS`
   - `ORCH_TOOL_SPECS`
   - `HepRunIngestSkillArtifactsToolSchema`
   - `RunManifestManager`
   - `StateManager`
   - `ResearchLoopRuntime`
   - `ComputeHandoff`
5. 明确 generic execution semantics 落在哪一层、哪些现有 tool / run-state surface 被复用，以及 host adapter 只保留多薄的一层
6. 明确检查 `packages/hep-mcp/src/tools/orchestrator/tools.ts` 是否仍然只是 registration/spec surface；若其中已潜入 execution logic，本批必须把该逻辑迁回 generic core，而不是继续留在 host layer

### 4.2 审核前

若本批新增/重命名符号、改变关键调用链、或当前 index 已不反映工作树：

1. 再次运行 `npx gitnexus analyze`
2. 执行 `detect_changes`
3. 必要时补 `impact` / `context`
4. 将 post-change evidence 写入 formal review packet 与 self-review

若 GitNexus 对新符号覆盖不完整，必须明确记录，并改用精确源码 grep + acceptance tests；不得假装 graph evidence 完整。

## 5. Targeted Preflight Requirement

本批**必须**先消费两份已落盘的 targeted repo-local preflight：

- contract reconciliation archive:
  `/Users/fkg/.autoresearch-lab-dev/sota-preflight/2026-03-12/NEW-COMP-02-contract-reconciliation/`
- generic boundary reconciliation archive:
  `/Users/fkg/.autoresearch-lab-dev/sota-preflight/2026-03-12/NEW-COMP-02-generic-boundary-reconciliation/`
- worktree pointers:
  `.tmp/new-comp-02-contract-preflight.md`
  `.tmp/new-comp-02-generic-boundary-preflight.md`

其中：

- 两个 `.tmp/*.md` 都只是摘要指针
- 真正的 canonical 内容都在各自 archive 的 `preflight.md` / `summary.md` / `manifest.json`
- 开工时必须阅读两个 canonical archive，而不是只看 pointer
- 若当前执行环境无法直接访问 `~/.autoresearch-lab-dev/` archive，必须先把 archive 显式挂载/复制到可读位置，或按下方四个检查点做独立 source inspection 重建，并在 closeout 中记录 fallback

开工时必须先确认：

1. 是否仍无 live `compute_run_card_v2` / `compute_status` / `compute_resolve_gate` consumer
2. 当前 `main` 是否仍最适合采用“generic core + thin host adapter”，而不是把 host tool 名称当 authority
3. 既有 `orch_run_*` 是否足以承担 status / gate resolution，避免新 wrapper 蔓延
4. 若仍需 `hep_run_execute_manifest`，它是否能保持 thin adapter，而不是重新吞回 execution semantics authority

除非实现过程中又发现新的**外部** API / official-doc drift，否则本批**不再额外触发外部 official-doc lookup**。如果没有触发，closeout 时必须明确记录：

- `external official-doc preflight skipped — repo-local reconciliation only`

## 6. Implementation Intent

### 6.1 Authority / Host Boundary Decision

默认实施策略：

- authority 必须按以下顺序收敛：
  1. `computation_manifest_v1` + provider-neutral execution / approval / audit semantics
  2. provider-neutral execution core
  3. host-local MCP adapter
- `status` 与 `approval resolution` 默认复用既有：
  - `orch_run_status`
  - `orch_run_approve`
  - `orch_run_reject`
- 当前 `main` 如仍需在 `hep-mcp` 暴露 execution tool，可保留 `hep_run_execute_manifest` 作为首个 host adapter
- 但该 host tool 只能 thinly delegate 到 generic core，不得成为 architecture authority

只有当源码审计发现真实 live caller 明确依赖 `compute_*` 公共名称时，才允许挑战这个结论；一旦发现这类 caller，必须先停止实施，将该 caller 记录为 blocking evidence，提交 prompt amendment 请求，并等待人类明确是否扩 scope 或先重构 caller。不得在发现 caller 后自行决定扩 scope。

若源码审计表明当前 `main` 已存在足够自然的 host-neutral entrypoint，可在不扩 scope 的前提下复用；否则不要为了命名纯度在本批额外发明第二个 host surface。

### 6.2 Execution Model Boundary

本批执行模型必须满足：

1. `computation_manifest_v1` 是唯一 manifest authority
2. 执行范围限定在当前 run 的稳定子目录内
3. 初版只支持 schema 里已枚举的解释器族；不要引入新的 backend enum
4. generic core 必须返回 provider-neutral 的 execution/result semantics；host adapter 不得私有化结果语义
5. 可以执行 project-local wrapper/script，因此 **可**承载 `hep-calc` 作为首个 provider path
6. 但工具本身**不得**把 `hep-calc` 硬编码成唯一执行家族
7. 不要在本批里设计 provider registry、pack marketplace 或 generalized routing matrix
8. 不得给 `computation_manifest_v1` 再补一层 provider enum / registry table；schema 现有 `tool` discriminator 仍是唯一 execution-type discriminator
9. 不得新增新的 Python-side computation authority 或跨语言 computation contract，从而给 `NEW-05a-stage3` / `EVO-13` 制造额外迁移包袱

### 6.3 Approval / Audit Semantics

必须保证：

1. `dry_run=true` 只返回 validated execution summary，不实际执行
2. 非 dry-run 且未满足 A3 时：
   - 生成 approval packet
   - 返回 `requires_approval`
   - 不中途执行任何 step
3. approval 通过后，实际执行路径必须有稳定状态记录
4. 失败时也要有 fail-closed artifact / status，而不是只抛异常离场
5. 不要自动把 execution 结果偷偷 ingest 到 evidence catalog；如需后续 ingest，应通过显式 output / next action 指向 `hep_run_ingest_skill_artifacts`

### 6.4 Thin Host Adapter Constraint

若本批保留 `hep_run_execute_manifest` 作为当前 host-local MCP entrypoint，则：

1. adapter 只负责 MCP 参数解析、host-local schema/registry/risk wiring、以及把请求委托给 generic core
2. adapter 不得拥有独立的 state-transition logic、approval packet semantics、provider routing policy、或 artifact/result authority
3. adapter 不得偷偷补入 HEP-only 默认参数、隐式 provider 选择、或 `hep-calc` 专属 contract 字段
4. adapter 必须薄到未来非 HEP host 可以复用 generic core，而不需要 copy-paste 其内部逻辑

### 6.5 Legacy Reuse Constraint

可以复用 legacy Python computation 的：

- containment / trust / approval 语义
- deterministic artifact 习惯
- failure / resume 叙事

不可以复用为当前 authority 的：

- `run_card v2` public naming
- `compute_run_card_v2` 叙事
- 旧 Python CLI 作为当前 TS surface 的规范来源

`packages/hep-autoresearch/src/hep_autoresearch/toolkit/computation.py` 在本批中仅作为 reference-only oracle：

- 不在本批里为它追加新 feature、命名同步或 authority 扩张
- 是否加 deprecated marker / 何时移除，留待后续专门 lane 决定；不得在本批顺手处理

## 7. Tests / Acceptance

若当前树里没有专项 `NEW-COMP-02` tests，必须**先创建再实现**。至少应有：

- 这里的“先创建”指：先落下完整 test file + `describe`/`it` cases + expected behavior 断言骨架，再开始实现代码；不是留一个 TODO 文件占位。

1. `packages/orchestrator/tests/execute-manifest-core.test.ts`
   - `dry_run`
   - successful local execution
   - unsafe path rejection
   - blocked command rejection
   - no partial execution before approval
2. `packages/hep-mcp/tests/contracts/executeManifestAdapterContract.test.ts`
   - host adapter delegates to generic core
   - no HEP-specific parameter expansion / defaulting
   - reuse of `orch_run_*` semantics / packet fields
3. `packages/hep-mcp/tests/contracts/executeManifestApprovalContract.test.ts`
   - A3 gate required before execution
   - no partial execution before approval
4. 现有回归继续覆盖：
   - `computationManifestSchema.test.ts`
   - `ingestSkillArtifacts.test.ts`
   - `orchRunApprove.test.ts`
   - `agent-runner-manifest.test.ts`（若本批触及 run-manifest / checkpoint semantics）

若 generic execution core 或 host adapter 需要新增 execution status / result / packet-adjacent schema，必须：

- 先把 schema 写入 `meta/schemas/`
- 通过 `NEW-01` 既有 codegen 路径生成 TS 类型
- 不得手写一套绕过 codegen 的 shared contract

### 7.1 Mandatory Acceptance Commands

```bash
pnpm --filter @autoresearch/shared build
pnpm --filter @autoresearch/orchestrator build
pnpm --filter @autoresearch/hep-mcp build

pnpm --filter @autoresearch/orchestrator test -- tests/execute-manifest-core.test.ts
pnpm --filter @autoresearch/hep-mcp test -- tests/core/computationManifestSchema.test.ts
pnpm --filter @autoresearch/hep-mcp test -- tests/core/ingestSkillArtifacts.test.ts
pnpm --filter @autoresearch/hep-mcp test -- tests/contracts/executeManifestAdapterContract.test.ts
pnpm --filter @autoresearch/hep-mcp test -- tests/contracts/executeManifestApprovalContract.test.ts
pnpm --filter @autoresearch/hep-mcp test -- tests/contracts/orchRunApprove.test.ts

pnpm --filter @autoresearch/orchestrator test -- tests/agent-runner-manifest.test.ts

git diff --check
```

若本批触及 `packages/orchestrator/src/state-manager.ts`、approval packet 生成、或 run status semantics，再追加：

```bash
pnpm --filter @autoresearch/orchestrator test
```

若本批触及 tool registry / risk / tool-name authority，再追加：

```bash
pnpm --filter @autoresearch/hep-mcp test -- tests/toolContracts.test.ts
pnpm --filter @autoresearch/shared test
```

若 authority reconciliation 触及 docs / README / design narrative 中的旧 `compute_*` 命名，也必须同步这些文档，并在 closeout note 中说明已对齐哪些文档入口。

## 8. Formal Review / Self-Review

本批必须按仓库规则完成正式三审与自审。

### 8.1 Formal Review

固定 reviewers：

- `Opus`
- `Gemini-3.1-Pro-Preview`
- `OpenCode(kimi-for-coding/k2p5)`

若任一 reviewer 不可用，必须：

1. 记录失败原因
2. 由人类明确确认 fallback reviewer
3. 禁止静默降级

review packet 必须重点检查：

1. 是否把 authority 真正收敛在 generic execution core / contract，而不是 HEP host tool 名
2. `packages/hep-mcp/` 是否只保留了 thin adapter，而没有吞回 execution semantics authority
3. 是否错误引入了并行 `compute_*` public family 或新的 host surface
4. `C-02 containment` 与 `A3 gate` 是否真实 fail-closed
5. `orch_run_*` 复用是否足够、是否避免 wrapper duplication
6. legacy Python computation 是否只被当作 reference，而不是 authority 回流
7. tests / fixtures / contract coverage 是否真的锁住了 generic-core / host-adapter 边界
8. scope discipline 是否守住，没有顺手拉入 `EVO-01` / migration / provider-registry lane

### 8.2 Self-Review

外部三审收敛后，当前执行 agent 仍必须完成正式自审，并明确记录：

- adopted amendments
- deferred amendments
- declined/closed amendments
- GitNexus post-change evidence 是否成功获取
- 若没有引入新稳定不变量，明确写 `no new stable invariant`

## 9. Mandatory SSOT Sync

完成后至少同步：

1. `meta/remediation_tracker_v1.json`
   - `NEW-COMP-02` 状态 / note / completed_at
   - note 中必须写清最终 authority layering：generic core / contract 在哪里，host adapter 是否保留以及它有多薄
2. `AGENTS.md`
   - 当前进度摘要

3. `meta/REDESIGN_PLAN.md`
   - 本批起点已确认该文件存在已知 drift；若本批按 prompt 完成 authority reconciliation，则该文件**必须同步**
   - 若 authority reconciliation 后发现 `NEW-COMP-02` 的规模/estimate 已显著偏离当前 plan（`~500 LOC`）叙事，也必须在 closeout note 中记录并按需同步计划表述
4. `meta/docs/computation-mcp-design.md`
   - 本批若落地的是 generic core + thin host adapter 边界，则该设计文档**必须同步**；不得继续让 design narrative 把 host-local MCP tool 名称写成 computation authority
5. `.serena/memories/architecture-decisions.md`
   - 仅当本批提炼出新的长期稳定不变量时更新；否则明确记录“不更新 memory”

本批若产出了新的 review amendments / deferred items，仍有后续价值的项必须进入持久 SSOT，而不是只留在 chat / `.review/` 临时产物里。

## 10. Version-Control Gate

本批默认：

- 不执行 `git commit`
- 不执行 `git push`

只有当以下条件全部满足，且人类在当前任务里明确授权后，才允许版本控制动作：

1. acceptance commands 全部通过
2. formal review 收敛且 `0 blocking`
3. self-review `0 blocking`
4. tracker / `AGENTS.md` / 必要时 `REDESIGN_PLAN.md` 已同步
5. preflight archive 与 dispositions 已记录完整

`.review/` 与 `meta/.review/` 产物保持 gitignored，不进提交面。

## 11. Done Definition

只有以下条件全部满足，本批才可标记完成：

- generic computation execution core 已落地
- 若保留 `hep_run_execute_manifest`，它已被验证为 thin host adapter，而不是 authority
- `computation_manifest_v1` execution path 可 validation / approval / execution / audit
- `C-02` 与 `A3` 的关键失败路径有测试锁定
- 没有引入第二套平行 public surface，也没有把 generic authority 再塞回 HEP host
- acceptance commands 全部通过
- formal review `0 blocking`
- self-review `0 blocking`
- tracker / `AGENTS.md` 已同步
- `meta/docs/computation-mcp-design.md` 已按最终边界同步
- 若 authority wording 被修正，`meta/REDESIGN_PLAN.md` 已同步

## 12. Next-Batch Recommendation Requirement

本批 closeout 时必须给出**条件化**的下一批建议：

- 若 `NEW-COMP-02` clean closeout，默认推荐下一批为 `EVO-01`
- 若本批暴露的是 authority / contract 继续漂移，而不是 execution gap，则下一批应是一个更小的 contract-reconciliation / follow-up prompt
- 不要机械推荐 `NEW-05a-stage3` 或 `NEW-SKILL-01`
