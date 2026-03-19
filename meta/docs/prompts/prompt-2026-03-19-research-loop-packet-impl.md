# Prompt: 2026-03-19 Research Loop Packet Contract Follow-up

> 适用范围：**仅**用于一个新的 bounded implementation 对话。
> 默认继承 `meta/docs/prompts/IMPLEMENTATION_PROMPT_CHECKLIST.md`。
>
> 本批不是重开 `NEW-LOOP-01`，也不是 `EVO-13` 提前实现。目标只有一个：在已经 closeout 的 single-project substrate 之上，补齐一个显式、typed、single-project-scoped 的 `research_loop_packet_v1` contract，使 loop/task boundary 从隐含约定升级为可验证 contract。

## 0. Worktree Requirement

本批默认**必须**在以下 worktree 中实施：

- `/Users/fkg/Coding/Agents/autoresearch-lab-research-loop-packet`

原因：

- 本批会同时触碰 `meta/schemas/`、`packages/orchestrator/src/research-loop/`、tests，属于窄但跨 surface 的 contract follow-up；
- 当前对话已积累大量 planning / consultation 上下文，不适合与实施细节混在同一工作区；
- `NEW-LOOP-01` 已 closeout，本批必须以“新 follow-up”而不是“回头改旧 item”的方式保持边界清晰。

若当前不在上述 worktree：

1. 先切换到该 worktree；
2. 再开始实施；
3. 不得在主 worktree 直接落代码并与本批混写。

## 1. Why This Batch Next

当前收敛结论已经很清楚：

- `NEW-LOOP-01` 已 closeout，且 substrate mechanics 已落地：`ResearchWorkspace`、task/event/checkpoint/intervention、typed handoffs、dual-mode、legal backtracks、nonlinear smoke path 都已存在；
- `AGENTS.md` 与 `.serena/memories/architecture-decisions.md` 都要求：single-project substrate 必须先于 `EVO-13` team runtime 稳定；
- 2026-03-19 external-systems absorption preflight 的 Layer 1 也明确指出：`NEW-LOOP-01` 还值得吸收的主要内容，是显式 loop contract / loop packet，而不是继续把 runtime 扩成 multi-agent/team runtime；
- 本轮额外 planning consultation（Opus + Gemini-3.1-Pro-Preview + OpenCode GLM-5）同样收敛到同一结论：**不要重开 `NEW-LOOP-01`；只做一个很窄的 contract follow-up。**

因此，本批的定位必须是：

- `NEW-LOOP-01` follow-up contract hardening
- 不改写 `NEW-LOOP-01` closeout judgment
- 不拉入 `EVO-13`
- 不顺手重做 workflow shell / operator UX / compute backend policy

## 2. Hard Scope Boundary

### 2.1 In scope

本批只允许覆盖：

1. `research_loop_packet_v1` checked-in schema
2. `packages/orchestrator/src/research-loop/` 内与 packet contract 直接相关的最小 typed surface
3. `ResearchLoopRuntime` 的最小 wiring，使 packet contract 能与现有 substrate 对齐
4. 针对 packet contract 的 contract tests / runtime tests / smoke tests
5. 为本批 closeout 必需的 tracker / prompt / docs 同步

### 2.2 Explicitly out of scope

以下内容一律禁止顺手吸收：

- 重开 `NEW-LOOP-01` 本体
- `EVO-13`
- multi-agent orchestration / delegation graph / A2A
- agent lifecycle / health / cascade stop / team checkpoint
- chat/session transcript authority
- workflow template / operator shell 反向定义 substrate contract
- debate-centered validation semantics
- compute lane 的 fixed-metric optimization worldview
- 新的 policy mode
- 新的 handoff kind
- `focus_stack`
- workflow shell / product shell / packaged agent

若发现相邻缺口，只允许记录为 out-of-scope evidence，不得扩批。

## 3. Canonical Naming And Authority Rules

### 3.1 One canonical top-level contract name only

本批必须使用**单一**顶层 contract 名称，避免同时引入两套平行抽象。

推荐：

- schema 文件：`meta/schemas/research_loop_packet_v1.schema.json`
- TS 类型：`ResearchLoopPacketV1`
- 运行时内部可简写为 `ResearchLoopPacket`

禁止：

- 同时再引入第二个平行顶层概念，如 `LoopTaskContract` 作为独立 authority
- packet / contract / constitution 三套并存

若需要 task-level 子结构：

- 作为 `ResearchLoopPacketV1` 的内嵌字段存在
- 不得成为独立顶层 authority surface

### 3.2 Existing substrate remains the SSOT

以下现有 surface 继续保持 single-project SSOT：

- `ResearchWorkspace`
- `ResearchTask`
- `ResearchEvent`
- `ResearchCheckpoint`
- `LoopIntervention`
- typed handoffs

`research_loop_packet_v1` 的角色是：

- 将既有 loop/task invariant 显式化
- 对现有 substrate 提供 contract-shaped view / boundary declaration
- 绝不是新的平行 project-state model

### 3.3 Packet fields must stay single-project scoped

`research_loop_packet_v1` 至少应覆盖：

- `objective`
- `mutable_surfaces`
- `immutable_authority_refs`
- `gate_conditions`
- `advancement`
- `rollback`
- `stop_conditions`

硬约束：

- `mutable_surfaces` / `immutable_authority_refs` 必须绑定到现有 `ResearchWorkspace` node/edge/task/handoff/artifact refs，不得变成 environment/backend/chat surface
- 若引用 artifact，优先复用现有 `ArtifactRefV1` 语义，禁止发明 shadow artifact ref
- `gate_conditions` 必须是 declarative boundary，指向现有 gate/handoff/acceptance seam；不得发明新的 debate / consensus / team adjudication semantics
- `advancement` / `rollback` 只表达 single-project task-graph traversal 与合法 backtrack surface
- `stop_conditions` 只允许表达当前 workspace / task / checkpoint / packet 级终止语义；不得出现 cascade-stop、team halt、cross-agent health、fleet control

### 3.4 Reasoning/execution seam stays intact

`NEW-LOOP-01` follow-up 只允许表达：

- typed intent
- typed boundary
- typed result ref / artifact ref

不允许表达：

- backend authority
- environment authority
- shell orchestration details
- provider-specific runtime policy

## 4. Required Reads Before Coding

至少按顺序读取：

1. `AGENTS.md`
2. `meta/remediation_tracker_v1.json`
3. `meta/REDESIGN_PLAN.md`
4. `meta/docs/prompts/IMPLEMENTATION_PROMPT_CHECKLIST.md`
5. 本文件 `meta/docs/prompts/prompt-2026-03-19-research-loop-packet-impl.md`
6. `~/.autoresearch-lab-dev/sota-preflight/2026-03-19/external-research-systems-absorption-map/preflight.md`
7. `.serena/memories/architecture-decisions.md`

然后继续读取以下直接相关代码与测试：

8. `packages/orchestrator/src/research-loop/workspace-types.ts`
9. `packages/orchestrator/src/research-loop/task-types.ts`
10. `packages/orchestrator/src/research-loop/event-types.ts`
11. `packages/orchestrator/src/research-loop/checkpoint-types.ts`
12. `packages/orchestrator/src/research-loop/handoff-types.ts`
13. `packages/orchestrator/src/research-loop/runtime.ts`
14. `packages/orchestrator/src/research-loop/policy.ts`
15. `packages/orchestrator/src/research-loop/workspace-validation.ts`
16. `packages/orchestrator/src/index.ts`
17. `packages/orchestrator/tests/research-loop-types.test.ts`
18. `packages/orchestrator/tests/research-loop-runtime.test.ts`
19. `packages/orchestrator/tests/research-loop-smoke.test.ts`

作为 contract/style 参考，再读取：

20. `meta/schemas/artifact_ref_v1.schema.json`
21. `meta/schemas/execution_plan_v1.schema.json`
22. `packages/shared/src/artifact-ref.ts`

禁止只看单文件就动手。

## 5. GitNexus Hard Gate

### 5.1 实施前

1. 读取 `gitnexus://repo/{name}/context`
2. 若 index stale，先运行 `npx gitnexus analyze`
3. 若当前 worktree dirty，默认执行 `npx gitnexus analyze --force`
4. 在改代码前，至少对以下符号做 `impact` / `context` 对齐：
   - `ResearchLoopRuntime`
   - `ResearchLoopPolicy`
   - `ResearchWorkspace`
   - `ComputeHandoff`

### 5.2 审核前

若本批新增/重命名符号或改变关键调用链：

1. 再次刷新 GitNexus（dirty worktree 默认 `--force`）
2. 运行 `detect_changes`
3. 必要时补 `impact` / `context`

若 GitNexus MCP 再次不可用：

- 必须明确记录失败
- 改用 direct source inspection + targeted tests
- 不得假装已经拿到成功的 graph-backed evidence

## 6. Preferred Implementation Shape

### 6.1 Minimal deliverable shape

优先实现形态：

1. checked-in schema：`meta/schemas/research_loop_packet_v1.schema.json`
2. 对应 TS surface：`packages/orchestrator/src/research-loop/packet-types.ts`（名称可审查后微调，但职责必须单一）
3. 最小 runtime wiring：
   - packet 能与现有 task/workspace/handoff surface 对齐
   - packet 能在 runtime state 中被读取或生成
   - 不新增新的 runtime mode
4. 对应 contract/runtime/smoke tests

### 6.2 Packet should refine, not replace

packet 应当：

- augment 现有 `ResearchTask` / `ResearchLoopRuntimeState`
- 或提供对既有 substrate 的 contract-shaped wrapper

packet 不应当：

- 取代 `ResearchTask`
- 变成新的唯一 project state
- 复制一份平行 task graph

### 6.3 Compact replay guidance

本批允许在 packet / checkpoint 上增加最小 compact digest，但只允许在以下条件下进行：

- 它直接服务于 typed replay / checkpoint compaction
- 它不引入新的长期 memory platform
- 它不把本批扩大成“checkpoint summary productization”

若实现中发现该 digest 不是 closeout blocker：

- 可以明确 deferred
- 不得为了“顺手做完”而扩大 batch

### 6.4 Explicit non-goals

本批不做：

- `current_focus`
- `focus_stack`
- 新的 UI-stage state
- worker-local runtime
- new shell/operator vocabulary

若确实需要可视视图：

- 只能从现有 task graph 派生
- 不得写回 core contract authority

## 7. Acceptance Requirements

最低 acceptance：

```bash
git diff --check
make codegen-check
pnpm --filter @autoresearch/shared test -- tests/artifact-ref.test.ts
pnpm --filter @autoresearch/shared build
pnpm --filter @autoresearch/orchestrator test -- tests/research-loop-types.test.ts tests/research-loop-runtime.test.ts tests/research-loop-smoke.test.ts
pnpm --filter @autoresearch/orchestrator build
```

若新增了专门的 packet contract test / runtime test，应把它们加入上述 orchestrator test slice，而不是只靠现有 smoke 测试掩护通过。

验收必须明确证明：

- packet contract 使用单一 canonical name，而非双顶层抽象
- packet 没有引入第二套 project-state authority
- `mutable_surfaces` / `immutable_authority_refs` 受现有 workspace/task/artifact refs 约束
- `advancement` / `rollback` / `stop_conditions` 没有偷带 team/delegation semantics
- interactive/autonomous dual-mode 与 legal backtrack 不回退

## 8. Review Packet Expectations

formal review / self-review 必须显式回答：

1. 本批是否仍保持 `NEW-LOOP-01` 为 closeout-done，而不是被 reopen
2. `research_loop_packet_v1` 是否只是现有 substrate 的 contract hardening，而不是新的平行 state model
3. packet fields 是否保持 single-project scope，而未偷带 `EVO-13` semantics
4. 是否错误引入了新的 handoff kind / runtime mode / workflow shell authority
5. `mutable_surfaces` / `immutable_authority_refs` / artifact refs 是否复用了现有 authority，而未发明 shadow contract
6. compact replay / digest 若被 deferred，理由是否成立

正式 review-swarm 仍按 `AGENTS.md` 的默认 reviewer lineup 执行；本 prompt 编写时参考的 GLM-5 planning consultation 只算 planning convergence evidence，不替代正式 closeout 审核。

## 9. Tracker / Docs Sync Rules

本批若落地实现：

- 不得把 `NEW-LOOP-01` 从 `done` 改回 `in_progress`
- 若需要 bookkeeping，新增一个**窄的、语义化的** follow-up 条目，而不是篡改原 closeout 叙事
- 不得重写 `NEW-LOOP-01` 原 acceptance / review history
- 只有在 phase counts / 依赖边界真的改变时，才更新 `AGENTS.md` 当前进度摘要
- 若没有新增稳定架构不变量，应明确说明“不更新 `.serena/memories/architecture-decisions.md`”

## 10. Required Deliverables

最少交付：

1. `research_loop_packet_v1` checked-in schema
2. orchestrator-side typed packet surface
3. 最小 runtime wiring
4. contract/runtime/smoke tests
5. tracker / prompt / 必要 docs 同步
6. formal review / self-review artifacts

## 11. Suggested Closeout Language

若本批成功收口，结论应接近：

- `NEW-LOOP-01` 保持 closeout-done；
- single-project substrate mechanics 未被重开或改写；
- 新增 `research_loop_packet_v1` contract 将 objective / mutable surface / immutable authority / gate / advancement / rollback / stop semantics 显式化；
- packet contract 仍严格 single-project scoped，未拉入 `EVO-13` / team runtime；
- 本批未启动 multi-agent runtime、workflow shell authority、或 compute backend policy 扩张。
