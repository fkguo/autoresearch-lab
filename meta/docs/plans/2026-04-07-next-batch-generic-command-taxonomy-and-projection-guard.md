# 2026-04-07 Next Batch Plan: Generic Command Taxonomy and Projection Guard

## Why this note exists

`M-22A` / `M-22B` 把 generic lifecycle authority 和旧 workflow schema residue 收掉之后，剩下的风险已经不再是“谁是 canonical lifecycle front door”这种一阶问题，而是两类更容易慢慢回潮的二阶问题：

1. **installable legacy shell 的 command taxonomy 仍缺独立 SSOT**
2. **operator / bridge / web / remote-like surfaces 仍需要更明确的 projection-only guard**

如果不把这两类 guard 做成明确 lane，后续很容易在小改动里把 legacy / provider-local surface 又慢慢写回 authority。

## Current source-grounded truth

### 已有 guardrail 主要是 front-door wording lock，不是 command inventory lock

当前主力 anti-drift surfaces 已经能锁住 generic-first 叙事：

- `scripts/lib/front-door-boundary-authority.mjs`
- `scripts/check-shell-boundary-anti-drift.mjs`
- `packages/hep-mcp/tests/docs/docToolDrift.test.ts`
- `packages/orchestrator/tests/package-boundary.test.ts`

但这些 guard 主要锁：

- root/package docs wording
- package boundary / import boundary
- forbidden shell/app-layer package names

它们**没有一个单独的 SSOT** 去表达：

- installable legacy shell 现在允许哪些 public commands
- 哪些命令只允许留在 internal full parser 做 maintainer/eval/regression coverage
- 哪些 support surfaces 必须保持 projection / diagnostics-only，而不是 mutation authority

### Residual Pipeline A support surfaces 仍主要靠文案与局部测试约束

从当前源码看，`packages/hep-autoresearch/src/hep_autoresearch/orchestrator_cli.py` 仍保留完整 parser authority map，其中：

- public shell 已通过 `public_main()` 收窄
- internal full parser 仍保留 `doctor`、`bridge`、`literature-gap`、residual non-computation `run` 等 support/workflow surfaces

相邻 docs 也仍保留 internal compatibility 叙事，例如：

- `packages/hep-autoresearch/docs/WORKFLOWS.md`
- `packages/hep-autoresearch/docs/ORCHESTRATOR_INTERACTION.zh.md`

这本身并不错误，但当前缺少一个更硬的 command-surface inventory fixture，去 fail-closed 地表达“public shell / internal full parser / canonical generic front door”三者的边界。

## External architecture signals worth borrowing

### Codex: single durable front door, not many equal authorities

`../codex/sdk/typescript/src/codex.ts` 很清楚地把长期 authority 固定在一个 thread abstraction 上：

- `startThread()`
- `resumeThread(id)`

它允许不同 client / runtime surface 围绕 thread 工作，但不把这些 surface 发展成多套并列 authority。

### Claude Code: remote / SDK message adapter 做 projection，不做 authority

`../claude-code-sourcemap/restored-src/src/remote/sdkMessageAdapter.ts` 明确把 remote/SDK 消息转成本地展示结构，并显式忽略很多不该被升级为本地 authority 的消息类型：

- 忽略普通 user echo
- 忽略 `auth_status`
- 忽略 `tool_use_summary`
- 只在需要时把远端 tool result 转成本地 render message

这说明成熟 agent system 的 common pattern 是：

- **single authoritative control plane**
- **remote/operator/web surfaces as projection/adaptation layers**

而不是让 remote/operator/web surface 同时拥有第二套 lifecycle/session/run authority。

## Proposed next split

### Lane A: command taxonomy / inventory authority fixture

目标：

- 建一个 checked-in SSOT，表达当前 installable public legacy shell 允许的 command taxonomy
- 同时表达 internal full parser-only surfaces
- 把 public help tests / docs drift tests / boundary checks 尽量收口到同一份 taxonomy fixture

建议优先触达：

- `scripts/lib/front-door-boundary-authority.mjs`
- `packages/hep-autoresearch/tests/test_public_cli_surface.py`
- `packages/hep-mcp/tests/docs/docToolDrift.test.ts`
- 如有必要：新增 dedicated taxonomy fixture/test

期待结果：

- 以后若有人把 `doctor` / `bridge` / retired lifecycle verbs / computation drift 回 installable public shell，会被 inventory-level guard 直接打断
- docs 不再只靠手写 snippet 间接表达 command boundary

### Lane B: projection-only support surface guard

目标：

- 把 residual `doctor` / `bridge` / web-like operator surfaces 明确约束为 projection / diagnostics / bridge layers
- 防止这些 support surfaces 重新持有 root mutation semantics、session authority、或 generic lifecycle authority

建议优先触达：

- `packages/hep-autoresearch/src/hep_autoresearch/web/app.py`
- `packages/hep-autoresearch/src/hep_autoresearch/orchestrator_cli.py`
- `packages/hep-autoresearch/docs/WORKFLOWS.md`
- `packages/hep-autoresearch/docs/ORCHESTRATOR_INTERACTION*.md`

期待结果：

- “还能留着” 与 “仍是 authority” 两件事被严格分开
- support surfaces 的长期身份更像 projection / diagnostics / compatibility shell，而不是第二 control plane

## Recommended sequencing

1. **Lane A first**: command taxonomy / inventory authority fixture
2. **Lane B second**: projection-only support surface guard
3. 之后再进入 residual non-computation `run` workflows 的 repoint / retirement continuation

原因：

- Lane A 能先把“哪些 surface 还允许存在”锁成明确 SSOT
- Lane B 才能在不反复争论 shell surface scope 的情况下，把 surviving support surfaces 定位成 projection-only
- 再往后处理 residual non-computation `run`，就不容易反复碰 front-door boundary drift

## Acceptance shape

### Lane A acceptance

- installable legacy public shell command inventory 有明确 SSOT
- public CLI tests 与 docs/front-door drift tests 对这份 inventory 有直接或单跳依赖
- retired lifecycle / computation / `doctor` / `bridge` / `literature-gap` 等 public-shell drift 有 fail-closed coverage

### Lane B acceptance

- web / doctor / bridge / adjacent support surfaces 有明确 projection-only / diagnostics-only boundary
- 没有 support surface 继续持有 generic lifecycle mutation authority
- package-local docs 不把 support surface 说成 generic/default entrypoint

## Non-goals

- 不 reopen `M-22A` / `M-22B` 已经收掉的 generic lifecycle authority judgment
- 不把 `hepar` / `hep-autoresearch` 重新包装成 generic front door
- 不在这个 lane 里顺手扩大到 fleet / remote runtime redesign
