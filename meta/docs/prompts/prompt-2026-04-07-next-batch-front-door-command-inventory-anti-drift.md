# Prompt: Front-door Command Inventory Anti-Drift

## Why this lane exists

`M-22A` / `M-22B` 之后，generic lifecycle authority 与旧 workflow graph residue 已经基本收口。下一批更值得做的，不是继续零散追着删命令，而是把当前 command taxonomy / inventory boundary 做成 fail-closed guard：

- `autoresearch` 作为 canonical generic front door，需要 exact command inventory guard
- installable `hep-autoresearch` / `hepar` public shell，需要 exact public legacy inventory guard
- `orch_*` docs/tool-surface truth，需要和 live registry 一起 fail-closed，而不是允许 stale spec 慢慢漂移

如果不补这一层，legacy / provider-local surface 很容易在局部文档或 parser 改动里重新长成 authority。

## Scope

只做 bounded command-inventory / anti-drift lane：

1. 为 `autoresearch` 建一个 single-source command inventory seam
2. 为 installable `hepar` public shell 建 exact public inventory contract
3. 把 `orch_*` doc surface 纳入 live tool-registry drift guard，并处理 stale orchestrator MCP spec authority

## Source-grounded files to inspect first

- `packages/orchestrator/src/cli-args.ts`
- `packages/orchestrator/src/cli-help.ts`
- `packages/orchestrator/src/cli.ts`
- `packages/orchestrator/tests/autoresearch-cli.test.ts`
- `packages/hep-autoresearch/src/hep_autoresearch/orchestrator_cli.py`
- `packages/hep-autoresearch/tests/test_public_cli_surface.py`
- `packages/hep-autoresearch/README.md`
- `packages/hep-autoresearch/README.zh.md`
- `packages/hep-autoresearch/docs/ORCHESTRATOR_INTERACTION.md`
- `scripts/lib/front-door-boundary-authority.mjs`
- `scripts/check-shell-boundary-anti-drift.mjs`
- `packages/hep-mcp/tests/docs/docToolDrift.test.ts`
- `packages/hep-mcp/tests/toolContracts.test.ts`
- `packages/hep-mcp/tests/contracts/crossComponentToolSubset.test.ts`
- `meta/docs/orchestrator-mcp-tools-spec.md`

## Non-goals

- 不 reopen `M-22A` / `M-22B`
- 不在本 lane 里继续 repoint residual non-computation `run` workflows
- 不把 `doctor` / `bridge` / `web` projection-only guard扩大成 runtime redesign
- 不做整仓文档翻修

## Desired outcome

### `autoresearch`

- command inventory 不再同时散落在 parser / help / dispatch 多处而无人核对
- exact public command set 有直接测试锁
- help truth 与 parser truth 同步

### installable legacy public shell

- `hepar` public surface 有 exact allowed command inventory，而不只是若干 retired command 的负向断言
- README / README.zh 的 public inventory 与 parser truth 同步
- 若有人把 retired lifecycle / computation / `doctor` / `bridge` drift 回 installable public shell，会 fail-closed

### `orch_*` docs

- docs drift guard 能识别 `orch_*` live surface，而不是只盯 `hep_` / `inspire_` / `zotero_` / `pdg_`
- `meta/docs/orchestrator-mcp-tools-spec.md` 不再把已经退役或改名的 `orch_*` surface 当 live truth

## Acceptance

- `pnpm --filter @autoresearch/orchestrator test -- tests/autoresearch-cli.test.ts tests/package-boundary.test.ts`
- `python3 -m pytest packages/hep-autoresearch/tests/test_public_cli_surface.py -q`
- `pnpm --filter @autoresearch/hep-mcp test -- tests/docs/docToolDrift.test.ts tests/toolContracts.test.ts tests/contracts/crossComponentToolSubset.test.ts`
- `node scripts/check-shell-boundary-anti-drift.mjs`
- `git diff --check`

## Review requirements

- formal review 必须显式 challenge：command inventory SSOT 是否真的 single-sourced，还是只是把字符串挪了位置
- 必须检查 `autoresearch`、installable `hepar` public shell、以及 `orch_*` docs 三个面是否都被纳入 front-door surface audit
- 若 reviewer 发现 stale spec / package doc 仍在陈述 live tool truth，不得按“文档噪音”降级
