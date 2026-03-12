# Prompt: 2026-03-12 Standalone — `NEW-R15-impl` Reality-Audit / Retro-Closeout

> 默认继承 `meta/docs/prompts/IMPLEMENTATION_PROMPT_CHECKLIST.md`
>
> `NEW-R15-impl` 不是从零开始的新实现项：`packages/hep-mcp/src/tools/orchestrator/tools.ts` 与相关 contract tests 已在更早的 Phase 2 Batch 7 落地，且 `meta/REDESIGN_PLAN.md` 将其记为 `✅`；但 `meta/remediation_tracker_v1.json` 仍把它标成 `pending`。本 prompt 的目标是做一次 **reality-audit + bounded retro-closeout**，而不是把旧 Batch 7 prompt 原样再执行一遍。
>
> 作用域硬约束：本批只覆盖 `NEW-R15-impl`。不要启动或顺手吸收 `UX-02`、`NEW-COMP-01/02`、`EVO-13`、`NEW-IDEA-01`、generic migration、research-loop lane、或任何与 orchestrator MCP 工具 surface 无直接关系的 lane。

## 0. 本批定位

这是一个 **单工作面、retro-closeout / reality-audit prompt**：

- 先确认当前 `orch_run_*` + `orch_policy_query` 工具是否已经真实满足 `NEW-R15-impl` 的 live acceptance，而不是只看“代码存在 / REDESIGN_PLAN 写过 ✅”；
- 若已经满足，则只补最小缺失的 tests / evidence / SSOT sync，完成 retro-closeout；
- 若存在真实 acceptance gap，则只修补 **阻止 `NEW-R15-impl` closeout 的最小缺口**；
- 不得借机把 orchestrator MCP 工具层扩展成 research-loop runtime、compute substrate、或更大的 control-plane 重构。

## 1. 开工前必须读取

### 1.1 治理 / 规划

1. `AGENTS.md`
2. `meta/remediation_tracker_v1.json`
3. `meta/REDESIGN_PLAN.md`
   - `NEW-R15-impl` 完整描述与验收检查点
   - `NEW-R15-spec` 对应的规格文档指针
   - `NEW-RT-01`、`NEW-COMP-01`、`UX-04`（只为理解依赖边界，不实现）
4. `meta/docs/prompts/IMPLEMENTATION_PROMPT_CHECKLIST.md`
5. `meta/docs/prompts/prompt-phase2-impl-batch7.md`（历史首次实现 prompt，仅作对照，不重跑）
6. `meta/docs/orchestrator-mcp-tools-spec.md`
7. `.serena/memories/architecture-decisions.md`

### 1.2 代码 / contract / tests

1. `packages/hep-mcp/src/tools/orchestrator/tools.ts`
2. `packages/hep-mcp/src/tools/index.ts`
3. `packages/hep-mcp/src/tools/registry.ts`
4. `packages/hep-mcp/src/tools/mcpSchema.ts`
5. `packages/hep-mcp/src/tool-names.ts`
6. `packages/hep-mcp/src/tool-risk.ts`
7. `packages/orchestrator/src/state-manager.ts`
8. `packages/hep-mcp/tests/contracts/orchRunApprove.test.ts`
9. `packages/hep-mcp/tests/toolContracts.test.ts`

> 若阅读中发现 `NEW-R15-impl` 的 live authority 不止这些文件，必须继续补读，再动手。禁止只看 `tools.ts` 就直接判定 closeout。

## 2. tracker / baseline 对齐

开工前先把 `meta/remediation_tracker_v1.json` 中 `NEW-R15-impl` 更新为：

- `status: "in_progress"`
- `assignee`: 当前实际执行模型

并在 note 中明确这是一次 **retro-closeout reality audit**，不是“第一次实现”。

## 3. 现实审计的硬问题

本批必须先回答以下问题，再决定是否改代码：

1. **工具目录完整性**：当前 `tools.ts` 是否暴露了 REDESIGN_PLAN 要求的全部 10 个工具？
   - `orch_run_create`
   - `orch_run_status`
   - `orch_run_list`
   - `orch_run_approve`
   - `orch_run_reject`
   - `orch_run_export`
   - `orch_run_pause`
   - `orch_run_resume`
   - `orch_run_approvals_list`
   - `orch_policy_query`
2. **命名空间隔离**：`orch_run_*` 是否与 `hep_run_*` 完全无冲突？`packages/hep-mcp/src/tool-names.ts` 和 `packages/shared/src/tool-names.ts` 的 re-export 关系是否与实际注册一致？
3. **`orch_run_approve` 安全三重验证**：当前实现是否满足 `_confirm: true` + `approval_id` match + `approval_packet_sha256` hash match？`orchRunApprove.test.ts` 是否锁住了全部关键失败路径？
4. **`orch_policy_query` 是否有实质行为**：当前代码是否真能查询 policy/precedent，而不是空 stub 或仅返回静态壳？
5. **risk level 对齐**：各工具的 risk level（`read` / `write` / `destructive`）是否与 `meta/docs/orchestrator-mcp-tools-spec.md` 和 `packages/hep-mcp/src/tool-risk.ts` 一致？`destructive` 工具是否都强制 `_confirm`？
6. **Zod schema → MCP inputSchema**：当前 Zod schema 是否能被 `packages/hep-mcp/src/tools/mcpSchema.ts` 正确导出，且与 spec 中的参数约束一致？
7. **测试覆盖**：除 `orchRunApprove.test.ts` 外，其它工具至少有没有 registry/contract/regression 覆盖？缺口是否构成 closeout blocker？
8. **downstream 现实性**：历史 acceptance 说 “CLI 可通过 `orch_run_*` MCP 工具操作”，当前树里到底是“共享同一状态机逻辑”还是“CLI 真实经由 MCP 路径调用”？这点必须按源码和测试给出准确结论，不能沿用旧叙事。

### 3.1 现实约束

基于当前代码树，优先假设：

- `NEW-R15-impl` 很可能已经基本完成；
- 真实 gap 更可能是 tracker drift、acceptance evidence 漂移、测试覆盖缺口、或 closeout 叙事不精确；
- 本批默认不应该做大规模实现。

因此：

- 若审计确认 10 个工具都已注册、主要安全路径已锁定、下游 control-plane 行为已存在，则 closeout 的主要工作应是 **补最小 test/evidence gap + tracker/AGENTS sync**；
- 不允许因为 tracker 仍是 `pending` 就把已落地代码重写。

## 4. Targeted Official-Doc / Contract Preflight（条件性，archive-first）

本批是 retro-closeout，不是新架构设计。**仅当现实审计暴露以下情况时**才需要做 targeted preflight：

1. 当前 MCP SDK / tool handler 形状与 `tools.ts` 的实现存在 API drift
2. `_confirm` destructive 防护模式与当前 `dispatcher` / shared error contract 不一致
3. Zod schema 导出到 MCP inputSchema 的行为出现语义漂移
4. orchestrator state / approval packet contract 与历史 spec 明显不一致，且需要查官方/主文档确认

若审计发现无 drift，则显式记录：

- `preflight skipped — no relevant official-doc / contract drift detected`

若需要做 preflight：

- canonical archive：`~/.autoresearch-lab-dev/sota-preflight/2026-03-12/NEW-R15-impl/`
- worktree 指针：`.tmp/new-r15-impl-sota-preflight.md`
- 结论必须在 closeout note / self-review 中有明确 disposition：`adopted` / `deferred` / `declined`

## 5. GitNexus 硬门禁

### 5.1 实施前

1. 先读 `gitnexus://repo/autoresearch-lab/context`
2. 若 index stale，先运行 `npx gitnexus analyze`
3. 至少对齐以下符号：
   - `ORCH_TOOL_SPECS`
   - `handleOrchRunApprove`
   - `handleOrchPolicyQuery`
   - `StateManager`
   - `createRun`
   - `approveRun`
   - `pauseRun`
   - `resumeRun`
4. 在改代码前明确：
   - 当前 `orch_run_*` 工具的 d=1 下游 consumer / caller 有哪些
   - `registry.ts` / `toolContracts.test.ts` 是否已把这些工具视为正式注册 surface
   - 若要补 test / fix gap，blast radius 是否安全

### 5.2 审核前

若本批新增/重命名符号、改变关键调用链、或当前 index 已不反映工作树：

1. 再次运行 `npx gitnexus analyze`
2. 执行 `detect_changes`
3. 视需要补 `context(...)` / `impact(...)`
4. 将 post-change 证据带入 `review-swarm` 与 `self-review`

## 6. 实现要求

### 6.1 In scope

1. 审计并确认全部 10 个工具在 `packages/hep-mcp/src/tools/orchestrator/tools.ts` 中是否真实注册
2. 审计 `packages/hep-mcp/src/tool-names.ts` / `packages/hep-mcp/src/tool-risk.ts` 与 registry 的一致性
3. 审计 `packages/orchestrator/src/state-manager.ts` 与 MCP handlers 的对应关系
4. 补齐缺失的 contract / regression tests，至少覆盖：
   - `orch_run_approve` 三重验证
   - `orch_run_create` 幂等性
   - `orch_run_export` `_confirm` 门禁
   - `orch_policy_query` 基本行为
   - 命名空间 / risk-level 无冲突断言
5. 同步 tracker / `AGENTS.md`，必要时同步 `meta/REDESIGN_PLAN.md`

### 6.2 最小完备交付要求

至少做到：

1. 全部 10 个工具在正式 registry surface 中可见
2. `orch_run_approve` 的 `approval_id` + `approval_packet_sha256` + `_confirm` 三重验证通过 contract test
3. `destructive` 工具全部强制 `_confirm: true`
4. 命名空间 `orch_run_*` 与 `hep_run_*` 无冲突，且有断言测试
5. `orch_policy_query` 至少有基本功能，不能是空 stub
6. closeout note 必须对“CLI 可通过 `orch_run_*` MCP 工具操作”给出严格、基于源码的现状表述；若历史 acceptance 叙事过强，需收敛为真实版本

### 6.3 明确禁止

- 不要把本批升级成 research-loop 集成、compute substrate 实现、或多 Agent runtime 改造
- 不要顺手实现 `UX-02`、`NEW-COMP-01/02`、`EVO-13`
- 不要把 `NEW-RT-01` 的已有实现拉进本批做全面二次审查
- 不要新增新的 `orch_run_*` 工具（如 `orch_run_checkpoint`, `orch_run_branch_*`）；若发现它们已落地，只做现实审计，不把它们纳入 closeout acceptance
- 不要因为“代码已经存在”就跳过 reality-audit / acceptance / review
- 不要把环境未安装依赖误记录为实现失败；先区分环境问题与代码问题

## 7. 验收命令

至少执行：

```bash
pnpm --filter @autoresearch/hep-mcp build
pnpm --filter @autoresearch/shared build
pnpm --filter @autoresearch/orchestrator build

pnpm --filter @autoresearch/hep-mcp test -- tests/contracts/orchRunApprove.test.ts
pnpm --filter @autoresearch/hep-mcp test -- tests/toolContracts.test.ts

git diff --check
```

如果本批触及 `packages/orchestrator/**`，追加：

```bash
pnpm --filter @autoresearch/orchestrator test
```

如果本批触及 `packages/hep-mcp/src/tool-risk.ts`、`packages/hep-mcp/src/tool-names.ts`、或 registry surface，追加：

```bash
pnpm --filter @autoresearch/hep-mcp test
pnpm --filter @autoresearch/shared test
```

如果新增了专项 contract / integration test，必须显式单跑一次该专项命令，并在 closeout note 中写清楚它锁定了什么行为。

## 8. Formal Review / Self-Review

按 `IMPLEMENTATION_PROMPT_CHECKLIST.md` 执行正式三审与自审：

- `Opus`
- `Gemini-3.1-Pro-Preview`
- `OpenCode(kimi-for-coding/k2p5)`

若任一 reviewer 本地不可用，必须记录失败原因，并由人类明确确认 fallback reviewer；禁止静默降级。

审查重点：

1. 全部 10 个工具是否已注册、可调用、且 risk level 正确
2. `orch_run_approve` 三重验证是否被 contract test 锁死
3. `orch_policy_query` 是否有实质功能而非空 stub
4. 命名空间隔离是否有断言覆盖
5. 历史 acceptance 叙事里“CLI 通过 MCP 工具操作”是否真实，还是需要更精确表述
6. scope 是否严格停留在 `NEW-R15-impl`，未拉入 `UX-02` / `NEW-COMP-*` / `EVO-13`
7. 若有 adopted / deferred / declined amendments，是否已同步到持久 SSOT

## 9. SSOT 同步要求

完成后必须同步：

1. `meta/remediation_tracker_v1.json`
   - 将 `NEW-R15-impl` 标为 `done`
   - `completed_at` 写入日期
   - note 必须写清楚：这是对 Phase 2 Batch 7 既有实现的 retro-closeout，最终 implementation/hash 是什么，本轮补了哪些 acceptance gap（或“无 gap，仅 tracker sync”）
2. `AGENTS.md`
   - 更新当前进度摘要中 Phase 2 完成数，至少说明 `NEW-R15-impl` 的 tracker drift 已被 reality-audit + retro-closeout 收口
3. `meta/REDESIGN_PLAN.md`
   - 仅在本批实质改变了 `NEW-R15-impl` 的 acceptance narrative、工具 surface、或后续 unblock 叙事时更新；若仅为 tracker sync + test gap 补齐，则不更新，但需明确记录“无设计层变更，不更新 REDESIGN_PLAN”
4. `.serena/memories/architecture-decisions.md`
   - 仅当本批沉淀出新的长期稳定不变量时更新；否则明确记录“无新增稳定不变量”

## 10. 完成汇报中的下一批建议

本批完成汇报必须给出 **条件化** 下一批建议：

- 若 `NEW-R15-impl` 只是 tracker drift + bounded test/evidence gap，默认下一条 prompt 应优先考虑仍为 `pending` 的相邻 Phase 2 control-plane / substrate reality-audit 项，而不是跳去新的 lane；
- 若 `NEW-R15-impl` 暴露出 orchestrator MCP 工具层的更深问题（如 spec 与实现显著不匹配、关键工具缺失、approval 路径存在安全 gap），先给出一个更小的 bounded follow-up prompt，不要直接跳去 `UX-02`、`NEW-COMP-01` 或 `EVO-13`；
- 无论哪种情况，都不要因为“项目大方向上还有很多事”就跳过相邻 pending Phase 2 tracker drift 收口。
