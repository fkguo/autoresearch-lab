# Prompt: 2026-03-21 `EVO-13` Batch 4 — Src/Dist Anti-Drift Cleanup

> 适用范围：**仅**用于一个新的 bounded implementation 对话。
> 默认继承 `meta/docs/prompts/IMPLEMENTATION_PROMPT_CHECKLIST.md`。
>
> 本批是一个明确的 cleanup slice，不是 `EVO-14`，也不是新的 team-runtime feature lane。目标只有一个：消除 `packages/orchestrator/src` 改动需要依赖手工 `build` 才能让下游 `@autoresearch/orchestrator` 消费面与 host-path contract 保持一致的漂移风险，把它从“已知历史隐患”收束成有源码、测试、acceptance 证据的 anti-drift contract。

## 1. Why This Batch Next

`EVO-13 Batch 3` 已明确证明：

1. `packages/orchestrator` 与 `@autoresearch/orchestrator` 不是两套实现。
2. 真正的历史遗留风险是 workspace 源码与 built `dist` 的漂移，会让下游 host contract 看到陈旧 surface。
3. 该风险已经影响实际 acceptance 策略，因此不能继续只靠口头提醒保留。

因此下一批应先做一个独立 cleanup slice，把这条 anti-drift contract 显式落下，再继续后续 runtime feature slice。

## 2. Hard Scope Boundary

### 2.1 In scope

1. `packages/orchestrator` 的 package surface anti-drift contract
2. `@autoresearch/orchestrator` 被下游 host（至少 hep-mcp）消费时的 build/export freshness gate
3. 必要的 host-path acceptance / test harness / helper 更新
4. 与上述 anti-drift 直接相关的 prompt / tracker / closeout 同步

### 2.2 Out of scope

- 新的 runtime feature
- `EVO-14` scheduler / fleet health
- team-local intervention / lifecycle 新语义
- 无关的 monorepo build 系统重写

## 3. Required Reads

至少读取：

1. `AGENTS.md`
2. `meta/remediation_tracker_v1.json`
3. `meta/REDESIGN_PLAN.md`
4. `meta/docs/prompts/IMPLEMENTATION_PROMPT_CHECKLIST.md`
5. 本文件
6. `meta/docs/prompts/prompt-2026-03-21-evo13-batch3-task-interventions-approval-bridge.md`
7. `packages/orchestrator/package.json`
8. `packages/orchestrator/src/index.ts`
9. `packages/hep-mcp/src/tools/orchestrator/tools.ts`
10. `packages/hep-mcp/src/tools/dispatcher.ts`
11. `.serena/memories/architecture-decisions.md`
12. 当前涉及 shared orchestrator package surface 的 build / contract tests

## 4. Acceptance Direction

至少应包含：

```bash
git diff --check
pnpm --filter @autoresearch/orchestrator build
pnpm --filter @autoresearch/hep-mcp test -- tests/contracts/orchRunApprove.test.ts tests/contracts/orchRunExecuteAgent.base.test.ts tests/contracts/orchRunExecuteAgent.team.test.ts tests/contracts/orchRunExecuteAgent.team-view.test.ts
pnpm --filter @autoresearch/hep-mcp build
```

若引入新的 anti-drift acceptance helper，应把其纳入本批最终命令。
最终 acceptance 应显式包含至少一个冷态 stale-`dist` 检测负例或等价 gate，证明陈旧 package output 不会再造成 host-path 假通过。

## 5. Completion Target

本批成功的标志不是“记得 build 一下”，而是：

1. `src -> package surface -> downstream host contract` 的 anti-drift 路径有明确源码级门禁。
2. 测试/acceptance 能在冷态下证明不会因为陈旧 `dist` 而产生假通过。
3. 该隐患在 tracker / closeout 中被正式视为已收口，而不是继续作为口头提醒存在。
