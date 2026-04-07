# 2026-04-07 Next Batch Plan: Front-Door Authority Map and Projection Guard

## Why this note exists

当前 command-inventory / `orch_*` spec follow-up 落地之后，下一步风险已经不再是“谁是 canonical lifecycle front door”这种一阶问题，而是两类更容易慢慢回潮的二阶问题：

1. **front-door authority 仍缺一个 typed authority map，而不只是若干 wording locks**
2. **operator / bridge / web / remote-like surfaces 仍需要更明确的 projection-only guard**

如果不把这两类 guard 做成明确 seam，后续很容易在小改动里把 legacy / provider-local surface 又慢慢写回 authority。

## Current source-grounded truth

### 当前 closeout 已落地三条 exact seam，但还没有 typed authority map

当前 worktree 已经把三条 exact authority seam 分别锁住：

- `packages/orchestrator/src/cli-command-inventory.ts`
  - top-level `autoresearch` public command inventory，并直接驱动 parser/help
- `packages/hep-autoresearch/src/hep_autoresearch/orchestrator_cli.py`
  - installable legacy public shell exact inventory + fail-closed assert
- `meta/docs/orchestrator-mcp-tools-spec.md`
  - exact `orch_*` MCP tool inventory，必须 exact-match live registry

这说明正确方向不是再造一个跨 TS/Python 的“大总表”，而是把这些 exact seam 提升成能驱动 docs/tests 的 typed authority map。

现有主力 anti-drift surfaces 已经能锁住 generic-first 叙事：

- `scripts/lib/front-door-boundary-authority.mjs`
- `scripts/check-shell-boundary-anti-drift.mjs`
- `packages/hep-mcp/tests/docs/docToolDrift.test.ts`
- `packages/orchestrator/tests/package-boundary.test.ts`

但这些 guard 仍主要锁：

- root/package docs wording
- package boundary / import boundary
- forbidden shell/app-layer package names

它们**还没有一个单独的 typed authority map** 去表达：

- 哪个 exact surface 才允许列 public inventory
- 哪些命令只允许留在 internal full parser 做 maintainer/eval/regression coverage
- 哪些 support surfaces 必须保持 projection / diagnostics-only，而不是 mutation authority

### Residual Pipeline A support surfaces 仍主要靠局部 fixture，而不是分类 authority map

从当前源码看，`packages/hep-autoresearch/src/hep_autoresearch/orchestrator_cli.py` 仍保留完整 parser authority map，其中：

- public shell 已通过 `public_main()` 收窄
- internal full parser 仍保留 `doctor`、`bridge`、`literature-gap`、residual non-computation `run` 等 support/workflow surfaces

相邻 docs 也仍保留 internal compatibility 叙事，例如：

- `packages/hep-autoresearch/docs/WORKFLOWS.md`
- `packages/hep-autoresearch/docs/ORCHESTRATOR_INTERACTION.zh.md`

这本身并不错误，但当前缺少一个更硬的 authority-map fixture，去 fail-closed 地表达“canonical front door / compatibility public / internal full parser”三者的边界。

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

### Seam A: front-door authority map

目标：

- 建一个 checked-in typed authority map，表达当前 front-door authority taxonomy
- 同时覆盖 `autoresearch` public commands、installable `hepar` public shell、internal full parser-only surfaces、exact `orch_*` spec truth
- 把 public help tests / docs drift tests / boundary checks 尽量收口到同一份 authority fixture

建议优先触达：

- `scripts/lib/front-door-boundary-authority.mjs`
- `packages/hep-autoresearch/tests/test_public_cli_surface.py`
- `packages/hep-mcp/tests/docs/docToolDrift.test.ts`
- 如有必要：新增 dedicated taxonomy fixture/test

期待结果：

- 以后若有人把 `doctor` / `bridge` / retired lifecycle verbs / computation drift 回 installable public shell，会被 authority-map-level guard 直接打断
- broader docs 不再自己维护 exact command/tool subsets，而是只做 family-level summary + link-out

### Seam C: projection-only support surface guard

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
2. **Seam B second**: residual Pipeline A support-surface retirement / classification
3. **Seam C third**: projection-only support surface guard
4. 之后再让 `idea-engine` default-host authority first cut 接上

原因：

- `Seam A` 能先把“哪些 surface 还允许存在”锁成 machine-readable authority
- `Seam B/C` 才能在不反复争论 shell surface scope 的情况下做 retire/repoint 和 projection-only guard
- `idea-engine` first cut 应发生在 front-door taxonomy 已清楚之后，而不是再混入 legacy shell 文案争论

## Acceptance shape

### Seam A acceptance

- front-door authority map 明确表达 `canonical_public` / `compatibility_public` / `internal_only`
- public CLI tests 与 docs/front-door drift tests 对这份 authority map 有直接或单跳依赖
- retired lifecycle / computation / `doctor` / `bridge` / `literature-gap` / stale `orch_*` subset drift 都有 fail-closed coverage

### Seam C acceptance

- web / doctor / bridge / adjacent support surfaces 有明确 projection-only / diagnostics-only boundary
- 没有 support surface 继续持有 generic lifecycle mutation authority
- package-local docs 不把 support surface 说成 generic/default entrypoint

## Non-goals

- 不 reopen `M-22A` / `M-22B` 已经收掉的 generic lifecycle authority judgment
- 不把 `hepar` / `hep-autoresearch` 重新包装成 generic front door
- 不把 authority map 误做成跨 TS/Python 的伪统一“大总表”
- 不在这个 note 里顺手扩大到 fleet / remote runtime redesign
