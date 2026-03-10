# Prompt: 2026-03-09 Batch 3 — Runtime / Provider / Root De-HEP Occupancy

> 默认继承 `meta/docs/prompts/IMPLEMENTATION_PROMPT_CHECKLIST.md`
>
> 前置：`Batch 1` 已完成并收口；semantic-authority deep cleanup A-E 与 residual `Batch 2` closeout 已完成。
> 目标：清理 runtime/provider/root 的 HEP 占位与命名漂移，使 repo face 与 control-plane face 不再误导后续实现。
>
> **状态注记 (2026-03-10, 更新)**：`formalism` mandatory-contract / shipped instance leakage 已被清理，但这还不足以启动本批。执行本 prompt 前，先完成 `meta/docs/prompts/prompt-2026-03-10-hep-semantic-deep-cleanup.md` 的 A-E 批次，并完成 residual `Batch 2` closeout；否则本批只会做表层改名，同时把 active semantic authority leakage 留在 provider/core seam 里。

## 0. 开工前必读

1. `AGENTS.md`
2. `meta/remediation_tracker_v1.json`
3. `meta/REDESIGN_PLAN.md`
4. `meta/docs/2026-03-09-root-ecosystem-boundary-adr.md`
5. `README.md`
6. `docs/README_zh.md`
7. `package.json`
8. `packages/orchestrator/src/ledger-writer.ts`
9. `packages/orchestrator/src/state-manager.ts`
10. `packages/openalex-mcp/src/api/client.ts`

## 1. 范围

### 1.1 In scope

- `README.md`
- `docs/README_zh.md`
- root `package.json`
- `packages/orchestrator/src/ledger-writer.ts`
- `packages/orchestrator/src/state-manager.ts`
- `packages/openalex-mcp/src/api/client.ts`
- 必要时相邻 tests / docs / config 文档

### 1.2 Out of scope

- `shared` tool/URI authority 重构
- `idea-core` HEP rubric/domain-pack 下沉
- 新建 packaged agent
- root-level heavy registry/materializer

## 2. 目标状态

- root face 不再把整个 monorepo 表述成 `HEP Research MCP`
- orchestrator 不再暴露 `HEP_AUTORESEARCH_DIR` 这类 domain-bound env name
- OpenAlex provider 不再 fallback 到 `~/.hep-mcp/openalex`
- 整个 repo 的“generic theory-research substrate, HEP-first provider”叙事变一致

## 3. 变更清单

1. root README / 中文 README / root `package.json` 改成 ecosystem framing
2. orchestrator 的 domain-bound env 名称改成 domain-neutral control-plane 名称
3. `openalex-mcp` data dir fallback 改成 domain-neutral 默认路径或显式 provider config
4. 必要时同步相邻文档，避免旧说明残留

## 4. 明确禁止

- 不要把 root 改写成 super-agent / super-MCP 入口
- 不要把这批顺手扩成 root profile/materializer 平台实现
- 不要在本批里创建 `packages/agent/` / `packages/autoresearch-agent/`
- 不要回写 Batch 1/2 的结构性工作

## 5. 验收命令

- `pnpm --filter @autoresearch/orchestrator test`
- `pnpm --filter @autoresearch/orchestrator build`
- `pnpm --filter @autoresearch/openalex-mcp test`
- `pnpm --filter @autoresearch/openalex-mcp build`
- `pnpm --filter @autoresearch/openalex-mcp lint`
- `pnpm --filter @autoresearch/hep-mcp test`
- `pnpm -r test`
- `git diff --check`

## 6. 完成定义

- root 不再被 `hep-mcp` 占位
- runtime/provider 的明显 HEP 命名漂移被移除
- 后续 contributor 再读 repo 时，不会自然把 root/orchestrator 误判为 HEP-specialized product

## 7. 收尾要求

- `review-swarm` 必须检查：这些改动是否只是改名，还是确实修正了 repo face / control-plane face
- `self-review` 必须说明为何这批仍然不是 product-agent 实现，而只是边界净化

## 8. SSOT 同步要求

- `meta/remediation_tracker_v1.json`：更新本批对应条目状态、commit hash、adopted/deferred dispositions；若当前 tracker 尚无独立条目，先补最小可审计条目再 closeout
- `AGENTS.md`：同步当前进度摘要，明确 root face / orchestrator face / provider fallback 已去掉哪些 HEP 占位
- `meta/REDESIGN_PLAN.md`：若本批实质收紧了 root / orchestrator / provider 的长期边界，应同步 closeout 说明，尤其是与 `P5A/P5B`、`EVO-13` product-boundary 相关的叙事；不要写实现流水账
- `.serena/memories/architecture-decisions.md`：仅当本批沉淀出新的长期稳定不变量时更新；本批预期可写入的不变量类型是“root 只做 ecosystem/workbench，orchestrator/control-plane 不携带 domain-bound env/path naming”
