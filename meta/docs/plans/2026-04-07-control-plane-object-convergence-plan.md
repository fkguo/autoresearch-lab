# 2026-04-07 Control-Plane Object Convergence Plan

## Why this plan exists

当前 mainline 已经把一批高价值但局部的闭环补起来了：

- `autoresearch` 作为 generic lifecycle / workflow-plan / computation front door 的真相已基本锁定
- `NEW-SHELL-01` 的 front-door / package-doc anti-drift 守卫已经形成
- post-runtime eval 的 bounded bundle 已 landed，并通过 tracker-only umbrella `POST-RT-EVAL-01` ratify

接下来的高价值工作，不应该继续停留在零散的 docs cleanup 或单点 runtime 小修。

真正的结构性缺口是：`packages/orchestrator/` 里已经存在多套并行的 `run / session / turn / event / task / approval / checkpoint` 表达，但还没有一个统一、generic、可持续扩展的 control-plane object model。

如果继续在这个状态上叠加更多 workflow、更多 docs 或更多 runtime feature，只会把 authority 分裂进一步固化。

## Source-grounded motivation

### 当前 autoresearch 的分裂点

源码现状已经显示出对象模型分裂，而不是能力缺失：

- project-level run state：`packages/orchestrator/src/types.ts`、`packages/orchestrator/src/state-manager.ts`
- delegated runtime manifest：`packages/orchestrator/src/run-manifest.ts`
- agent loop turn/runtime markers：`packages/orchestrator/src/agent-runner.ts`、`packages/orchestrator/src/agent-runner-runtime-state.ts`
- runtime diagnostics projection：`packages/orchestrator/src/runtime-diagnostics-bridge.ts`
- team assignment/session/event view：`packages/orchestrator/src/team-execution-types.ts`、`packages/orchestrator/src/team-execution-scoping.ts`、`packages/orchestrator/src/team-execution-view.ts`
- substrate task/event/checkpoint layer：`packages/orchestrator/src/research-loop/task-types.ts`、`packages/orchestrator/src/research-loop/event-types.ts`、`packages/orchestrator/src/research-loop/runtime.ts`

这些对象之间目前存在明显的“重复表达 + projection 修补 + 字符串约定”问题，例如：

- `run` 同时以 `RunState`、`RunManifest`、team runtime synthetic runtime id 等形式存在
- `session` 在 team runtime 中更像 repair/projection，而不是统一的 execution object
- `turn` 主要存在于 agent loop 内部，不是稳定持久对象
- `event` 分散为 `LedgerEvent`、`AgentEvent`、team-local event、research-loop event
- `task` 与 `assignment` 的边界不清；当前 assignment 实际上承担了 job/execution unit 的大部分语义

### 从 Codex 值得吸收的模式

只吸收对 generic substrate 有价值的部分，不照搬其 conversation-first worldview。

高价值模式：

- durable container 与 execution boundary 分离
  - `../codex/sdk/typescript/src/thread.ts`
  - `../codex/sdk/typescript/src/events.ts`
- append-only event / item normalization
  - `../codex/codex-rs/exec/src/event_processor_with_jsonl_output.rs`
- parent-child runtime lineage 是 first-class relation，而不是字符串拼接
  - `../codex/codex-rs/analytics/src/events.rs`
- job / job-item substrate 独立于 thread transcript
  - `../codex/codex-rs/state/src/runtime/agent_jobs.rs`

明确不照搬的部分：

- 顶层对象不能直接变成 `thread`
- 不能把 research substrate 降格成 chat/session transcript system
- 不能把 UI/session baggage 混进 generic control plane

### 从 Claude Code 值得吸收的模式

高价值模式：

- control sideband 与 message stream 分离
  - `../claude-code-sourcemap/restored-src/src/remote/RemoteSessionManager.ts`
- session-state / tool-progress / task-progress 是 typed protocol signal
  - `../claude-code-sourcemap/restored-src/src/entrypoints/sdk/coreSchemas.ts`
- lineage / transcript / parent session 是 first-class
  - `../claude-code-sourcemap/restored-src/src/entrypoints/agentSdkTypes.ts`
  - `../claude-code-sourcemap/restored-src/src/types/logs.ts`

明确不照搬的部分：

- 不把 transcript 提升成 project-state SSOT
- 不引入 UI-first / remote-first 的整体架构包袱
- 不把 Claude 的庞大消息 schema 直接复制成 autoresearch 的 shared contract

## Planning judgment

下一批最合适的主轴不是“大一统重写”，而是一个窄而关键的 bounded program：

`CP-OBJ-01 — Orchestrator Control-Plane Object Convergence`

它的目标不是重写 runtime，而是：

1. 先把 canonical object language 写清楚
2. 再把 execution identity / session-turn projection / read model 收口
3. 最后把 research-task seam 接回 live execution path

## Proposed bounded slices

### `CP-OBJ-01A` — Object map / authority spec

**Goal**

用 checked-in spec 文档把 `project run / task / execution session / turn / event / approval / checkpoint / job` 的 canonical 语义与现状映射写清。

**Likely files**

- new checked-in design doc under `meta/docs/prompts/` or `meta/docs/plans/`
- `meta/REDESIGN_PLAN.md` only if the slice is later ratified

**Must include**

- 当前对象来源图：`RunState`、`RunManifest`、`TeamDelegateAssignment`、`TeamAssignmentSession`、`ResearchTask`、`AgentEvent`、`LedgerEvent`
- 哪些是 authority，哪些只是 derived projection
- 哪些字段/objects 目前属于技术债，而不是未来 canonical contract

**Non-goals**

- no runtime rewrites
- no schema/codegen changes
- no new CLI/API surface

**Acceptance**

- 形成 source-grounded object map 文档
- 文档明确指出不该继续存在的 parallel authority
- reviewer 能据此判断后续实现 slice 是否越界

### `CP-OBJ-01B` — Typed execution identity seam

**Goal**

把当前散落的 `run_id / runtime_run_id / assignment_id / task_id / session_id / approval_id / checkpoint_id` 收束到一套 typed refs / identity helpers。

**Likely files**

- `packages/orchestrator/src/team-execution-scoping.ts`
- `packages/orchestrator/src/team-execution-types.ts`
- `packages/orchestrator/src/run-manifest.ts`
- new shared helper module in `packages/orchestrator/src/`

**Non-goals**

- no behavior rewrite
- no fleet scheduler changes
- no user-facing command additions

**Acceptance**

- delegated child runtime relation 不再主要靠 ad hoc string conventions 表达
- key ids 有统一 typed seam
- existing host-path tests stay green

### `CP-OBJ-01C` — Delegated runtime session/turn projection

**Goal**

把 delegated runtime 的 session/turn summary 变成显式 projection artifact 或 stable projection seam，而不是只靠 `AgentEvent[]` 和 team synthetic session repair 推断。

**Likely files**

- `packages/orchestrator/src/research-loop/delegated-agent-runtime.ts`
- `packages/orchestrator/src/runtime-diagnostics-bridge.ts`
- `packages/orchestrator/src/agent-runner.ts`
- `packages/orchestrator/src/team-unified-runtime-support.ts`

**Non-goals**

- no new generic eval stack
- no transcript-as-SSOT migration
- no remote/server surface

**Acceptance**

- delegated runtime produces a stable session/turn summary seam
- runtime diagnostics bridge consumes the projection rather than re-inventing state from scattered markers only
- team scoping stops relying on synthetic session repair for the common happy path

### `CP-OBJ-01D` — Unified operator read model

**Goal**

把 current run read model、team execution view、runtime diagnostics summary 收口为同一套 control-plane projection family，而不是多套独立解释器。

**Likely files**

- `packages/orchestrator/src/orch-tools/run-read-model.ts`
- `packages/orchestrator/src/team-execution-view.ts`
- `packages/orchestrator/src/runtime-diagnostics-bridge.ts`
- related orchestrator/hep-mcp contract tests

**Non-goals**

- no fleet/EVO-14 widening
- no new dashboard/server
- no extra persistence authority

**Acceptance**

- operator-facing views can share one core projection vocabulary
- approval/session/status semantics no longer diverge silently between run view and team view
- current contract tests remain green or are updated in one bounded surface

### `CP-OBJ-01E` — Research-task bridge into live execution

**Goal**

把 `ResearchTask.task_id` 稳定接到 live execution path，让 task 不是“被 assignment 附带的字符串”，而是 canonical work unit。

**Likely files**

- `packages/orchestrator/src/research-loop/runtime.ts`
- `packages/orchestrator/src/computation/feedback-state.ts`
- `packages/orchestrator/src/computation/feedback-followups.ts`
- `packages/orchestrator/src/team-unified-runtime-support.ts`
- `packages/orchestrator/src/research-loop/delegated-agent-runtime.ts`

**Non-goals**

- no full migration to `ResearchLoopRuntime`
- no EVO-13 / EVO-14 reopen
- no workflow-level redesign

**Acceptance**

- task identity survives from follow-up seed into assignment and delegated runtime result
- team execution path stops treating task as purely decorative metadata
- computation / writing-review follow-up chains preserve canonical task refs

## Why this should come before other tempting work

### Why not “just keep retiring more hepar surface” first

Pipeline A retirement should continue, but if we keep shrinking legacy shells without converging the generic object model, we risk ending up with a thinner front door that still sits on fragmented authority underneath.

### Why not “rewrite runtime into research-loop” first

当前 live execution 主链仍主要在 delegated/team runtime path，而不是 `ResearchLoopRuntime` 本身。现在硬迁，只会把未显式建模的耦合搬到更深处。

### Why not “go build server/remote control plane” first

在 `run/session/turn/event/job` 语言未统一前，remote surface 只会把当前分裂对象模型固化成 API 契约。

## Parallelizable side lanes

这些可以并行准备，但不应抢主轴：

1. root/front-door docs follow-up
   - `DOCS-FRONTDOOR-01` 已在当前 worktree 上完成 formal closeout：`README.md`、`docs/README_zh.md`、`docs/PROJECT_STATUS.md`、`docs/QUICKSTART.md` 现为 generic-first first-touch ordering，order-aware anti-drift 也已通过 review/self-review 收口
   - 后续只保留维护义务：若 root front-door truth 变化，需要继续通过 shared guard/test 同步；不再作为 `CP-OBJ-01` 的并行未闭环 lane
2. residual Pipeline A shrink follow-up
   - 继续审 residual non-computation `run` / support surface
   - 但不要在 object-model 收口前重新把 `hepar` 抬成 authority
3. post-runtime eval consumer expansion
   - 继续沿 `POST-RT-EVAL-01` 的 bounded path 做 richer diagnostics/consumers
   - 但不创建 orchestrator-local generic eval stack

## Hard boundaries

- `autoresearch` remains the generic first front door and long-term control plane
- HEP stays as the strongest current domain pack, not the product root identity
- `hepar` / `hep-autoresearch` continue toward retirement together
- no new orchestrator-local generic eval stack
- no transcript-as-SSOT pivot
- no fleet/server/remote-first leap before object convergence
- no HEP-specific taxonomy in the generic object model

## Immediate next step

The first two concrete deliverables are now already checked in:

- `CP-OBJ-01A`: object-map / authority-spec bundle
- `CP-OBJ-01B`: typed delegated execution identity seam

The next runtime slice is now explicitly staged as:

- `meta/docs/prompts/prompt-2026-04-07-cp-obj-01c-delegated-runtime-session-turn-projection.md`

That prompt keeps `CP-OBJ-01C` narrowly on source-recorded delegated runtime projection, nullable session attachment, and diagnostics-bridge convergence.

The parallel root-docs lane is now separately staged as:

- `meta/docs/prompts/prompt-2026-04-07-docs-frontdoor-01-root-first-touch-ordering.md`

That prompt keeps first-touch ordering / anti-drift work out of the runtime main axis.
