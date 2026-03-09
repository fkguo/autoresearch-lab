# Prompt: 2026-03-09 Batch 1 — Shared Boundary Re-baseline

> 默认继承 `meta/docs/prompts/IMPLEMENTATION_PROMPT_CHECKLIST.md`
>
> 目标：先清理 `packages/shared/` 中把 HEP provider 当成 ecosystem authority 的历史漂移，避免其继续污染 `NEW-05a Stage 3` 与未来 leaf-package productization。

## 0. 开工前必读

1. `AGENTS.md`
2. `meta/remediation_tracker_v1.json`
3. `meta/REDESIGN_PLAN.md`（至少 `NEW-05a`, `P5A/P5B`, `EVO-13` 三处约束）
4. `meta/docs/2026-03-09-root-ecosystem-boundary-adr.md`
5. `.review/2026-03-09-root-ecosystem-boundary/out/opus.json`
6. `.review/2026-03-09-root-ecosystem-boundary/out/k2p5.json`
7. `.review/2026-03-09-root-ecosystem-boundary/r2/out/opus_r2.json`
8. `.review/2026-03-09-root-ecosystem-boundary/r2/out/k2p5_r2.json`

## 1. 范围

### 1.1 In scope

- `packages/shared/src/tool-names.ts`
- `packages/shared/src/tool-risk.ts`
- `packages/shared/src/artifact-ref.ts`
- `packages/shared/src/index.ts`
- `packages/shared/src/__tests__/*`（若需调整/新增）
- `packages/hep-mcp/src/**` 中直接依赖上述 shared HEP authority 的入口
- 必要时相邻 consumer 的 compile/test 修复（最小必要范围）

### 1.2 Out of scope

- `idea-core` 的 HEP compute rubric / domain pack 默认值
- orchestrator 的 `HEP_AUTORESEARCH_DIR`（见 `prompt-2026-03-09-batch3-runtime-root-dehep.md`，该项留待 Batch 3）
- root README / `package.json` 去 HEP 占位
- 动态 registry/materializer 平台
- 新建 `packages/agent/` / `packages/autoresearch-agent/`

## 2. 目标状态

- `packages/shared/` 不再持有 HEP-specific tool-name authority
- `packages/shared/` 不再把 `hep://` 单一 scheme 作为 generic artifact URI authority
- shared 保留：
  - 稳定 typed seams
  - provider-agnostic risk-level type / lookup seam
  - provider-agnostic artifact URI helper seam
- HEP-specific 常量/封装迁到 HEP 侧（通常是 `packages/hep-mcp/`）

## 3. 变更清单

1. 把 `tool-names.ts` 的 HEP authority 从 shared 移走；shared 只保留 generic seam，而不是 concrete HEP enum
2. 让 `tool-risk.ts` 不再以 shared 内的 HEP 常量表为 authority
3. 把 `artifact-ref.ts` 从单一 `hep://` helper 改为 scheme-aware / provider-parametric helper
4. 在 HEP 侧补 convenience wrappers / local authority，避免把 concrete HEP 名字继续留在 shared
5. 补相邻 tests，锁定 shared 不再回归到 domain-authority 角色

## 4. 明确禁止

- 不要把 shared 中的 HEP 常量简单重命名成更泛的名字后继续留在 shared
- 不要删除 shared 文件后改成全仓 inline string
- 不要顺手引入动态 registry/runtime discovery 平台
- 不要顺手拉入 Batch 2/3 工作

## 5. 验收命令

至少执行：

- `pnpm --filter @autoresearch/shared test`
- `pnpm --filter @autoresearch/shared build`
- `pnpm --filter @autoresearch/shared lint`
- `pnpm --filter @autoresearch/hep-mcp test`
- `pnpm --filter @autoresearch/hep-mcp build`
- `pnpm --filter @autoresearch/hep-mcp lint`
- `pnpm --filter @autoresearch/orchestrator test`
- `pnpm --filter @autoresearch/orchestrator build`
- `pnpm --filter @autoresearch/openalex-mcp test`
- `pnpm --filter @autoresearch/openalex-mcp build`
- `pnpm -r build`
- `pnpm -r test`
- `git diff --check`

## 6. 完成定义

- shared 层不再以 HEP tool names / HEP risk map / `hep://` helper 作为 ecosystem authority
- HEP consumer 行为不回退
- `NEW-05a Stage 3` 的 generic-layer 污染面明显下降

## 7. 收尾要求

- 正式 `review-swarm`：默认 `Opus` + `Gemini-3.1-Pro-Preview` + `OpenCode(kimi-for-coding/k2p5)`；若 `Gemini` 本地仍不可用，必须记录失败并等待人类确认 fallback
- `self-review` 必须特别检查 shared boundary 是否真的变成 provider-agnostic seam，而不是换皮保留

## 8. SSOT 同步要求

- `meta/remediation_tracker_v1.json`：更新本批对应条目状态、commit hash、adopted/deferred dispositions；若当前 tracker 尚无独立条目，先补最小可审计条目再 closeout
- `AGENTS.md`：同步当前进度摘要，明确 shared-layer authority 漂移已被清理到什么程度
- `meta/REDESIGN_PLAN.md`：仅在本批实际改变了 `NEW-05a Stage 3` 的 closeout 约束或 unblock 叙事时更新；不要写实现流水账
- `.serena/memories/architecture-decisions.md`：仅当本批沉淀出新的长期稳定不变量时更新；本批预期可写入的不变量类型是“shared 只保留 provider-agnostic typed seam，不再持有 provider authority”
