# Prompt: 2026-03-16 Standalone — Bounded Repair for `@autoresearch/*-mcp/tooling` Imports in `hep-mcp`

> 适用范围：**仅**用于一个新的 bounded implementation / repair 对话。
> 默认继承 `AGENTS.md` 与 `meta/docs/prompts/IMPLEMENTATION_PROMPT_CHECKLIST.md`。
>
> 本批不是新的 retrieval/runtime/generic-entrypoint lane，也不是对 `hep-mcp` 定位的大改判。本批来自 2026-03-15 retro-closeout repair 的 residual canonical acceptance failure：`pnpm --filter @autoresearch/hep-mcp test -- tests/toolContracts.test.ts` 与 `pnpm --filter @autoresearch/hep-mcp build` 仍因 sibling provider package 的 `tooling` / shared subpath 解析失败而未收口。

## 0. Why This Batch Next

`AGENTS.md` 当前已记录：2026-03-15 retro-closeout repair 的 scoped gates 全过，但 `hep-mcp` 仍存在两个 lane 内不可继续忽略的 canonical acceptance failure：

1. `pnpm --filter @autoresearch/hep-mcp test -- tests/toolContracts.test.ts`
2. `pnpm --filter @autoresearch/hep-mcp build`

当前直接症状集中在以下 workspace import surface：

- `@autoresearch/arxiv-mcp/tooling`
- `@autoresearch/openalex-mcp/tooling`
- `@autoresearch/pdg-mcp/tooling`
- `@autoresearch/zotero-mcp/tooling`
- `@autoresearch/hepdata-mcp/tooling`
- `@autoresearch/zotero-mcp/shared/zotero`

这些 failure 已经阻塞 `hep-mcp` 的基本 contract/build closeout；继续把它们留给“以后再说”会让 closeout 叙事失真。

## 1. Design Interpretation Boundary

开始实现前，必须先区分 **设计意图** 和 **当前故障形态**：

- 仓库内已有可审计证据表明，`hep-mcp` 作为 HEP composite/broker surface，静态组合 sibling provider packages，并非偶然写法：
  - `packages/hep-mcp/src/index.ts`
  - `packages/hep-mcp/src/tool-names.ts`
  - `packages/hep-mcp/CLAUDE.md`
  - `meta/docs/prompts/prompt-new-arxiv-01-worktree.md`
  - `meta/docs/prompts/prompt-new-hepdata-01-worktree.md`
  - `meta/docs/prompts/prompt-phase3-impl-new-disc01-closeout.md`
- 因此，本批默认应先把问题视为 **workspace packaging / build-order / TS project-reference / subpath-export closure bug**，而不是先验认定“`hep-mcp` 不该聚合这些 provider”。

### 关键约束

1. **允许修实现闭环**：安装、workspace 解析、`tsconfig` references、exports、build prerequisites、test harness、最小必要 import wiring。
2. **禁止直接升级为架构重构**：不要借机把 `hep-mcp` 改造成新 generic entrypoint / routing broker / provider registry lane。
3. **若证据推翻当前前提，必须停下并记录**：
   - 只有在直接源码 + acceptance 证据证明“当前 import/build failure 不能在现有聚合设计下 bounded 修复”时，才允许把问题升级为新的架构 lane 候选；
   - 但本批 **不得**自己实现那个新架构。

## 2. Hard Scope Boundary

本批 **只允许**覆盖：

1. 让 `hep-mcp` 对 sibling provider package 的 `tooling` / shared subpath imports 可解析、可类型检查、可构建；
2. 让 `pnpm --filter @autoresearch/hep-mcp test -- tests/toolContracts.test.ts` 通过；
3. 让 `pnpm --filter @autoresearch/hep-mcp build` 通过；
4. 对实现上述目标直接必要的 workspace/package/config/test 修补；
5. tracker / `AGENTS.md` / review artifacts 的同步。

### 明确禁止

不要顺手启动或部分实现以下工作：

- 把 `hep-mcp` 改造成新的 generic broker / routing registry
- 新建 generic discovery / tooling aggregation MCP server
- 重写 provider/domain boundary 叙事
- retrieval/runtime/writing/compute lane 的顺手清理
- 无关的 full-repo build failure 大扫除
- “反正动到了就一起重构”的 import 风格整理

如果发现真正根因是 lane 外设计债，允许记录为 exact evidence，但不得在本批偷做。

## 3. 开工前必须读取

按顺序至少读取：

1. `AGENTS.md`
2. `meta/remediation_tracker_v1.json`
3. `meta/REDESIGN_PLAN.md`
4. `meta/docs/prompts/IMPLEMENTATION_PROMPT_CHECKLIST.md`
5. 本文件 `meta/docs/prompts/prompt-2026-03-16-mcp-tooling-import-repair.md`

然后读取 workspace / package boundary：

6. `package.json`
7. `pnpm-workspace.yaml`
8. `tsconfig.json`
9. `packages/hep-mcp/CLAUDE.md`
10. `packages/hep-mcp/package.json`
11. `packages/hep-mcp/tsconfig.json`
12. 以下 provider packages 的 `package.json`、`tsconfig.json`、`src/tooling.ts`
   - `packages/arxiv-mcp/`
   - `packages/openalex-mcp/`
   - `packages/pdg-mcp/`
   - `packages/zotero-mcp/`
   - `packages/hepdata-mcp/`

再读取 `hep-mcp` 中的直接 import sites（至少）：

13. `packages/hep-mcp/src/index.ts`
14. `packages/hep-mcp/src/tools/registry/zotero.ts`
15. `packages/hep-mcp/src/tools/registry/pdg.ts`
16. `packages/hep-mcp/src/tools/registry/openalex.ts`
17. `packages/hep-mcp/src/tools/registry/projectExtensions.ts`
18. `packages/hep-mcp/src/tools/registry/shared.ts`
19. `packages/hep-mcp/src/tools/registry/inspireResearch.ts`
20. `packages/hep-mcp/src/utils/arxivCompat.ts`
21. `packages/hep-mcp/src/utils/resolveArxivId.ts`
22. `packages/hep-mcp/src/tools/research/index.ts`
23. `packages/hep-mcp/src/tools/research/conflictDetector.ts`
24. `packages/hep-mcp/src/tools/research/discovery/providerExecutors.ts`
25. `packages/hep-mcp/src/tools/research/discovery/candidateAdapters.ts`

再读取直接相关测试：

26. `packages/hep-mcp/tests/toolContracts.test.ts`
27. `packages/hep-mcp/tests/tools.test.ts`
28. `packages/hep-mcp/tests/research/providerExecutors.test.ts`
29. `packages/hep-mcp/tests/research/conflictDetectorPdg.test.ts`

若阅读中发现 provider tooling 的 authority 还分散在别处，必须补读；禁止只看一两个 import site 就凭印象动手。

## 4. GitNexus Hard Gate

先按 checklist 尝试 GitNexus freshness / context：

1. 读取 `gitnexus://repo/{name}/context`
2. 若 stale，先运行 `npx gitnexus analyze`
3. 若当前 `worktree` 已 dirty（新增 prompt 之外还有实现改动），默认运行 `npx gitnexus analyze --force`
4. 至少对齐以下符号 / surface：
   - `getTools`
   - `handleToolCall`
   - provider `TOOL_SPECS` / `getToolSpec` / `getToolSpecs`
   - `cleanupOldPdgArtifacts`
   - `listPdgResources`
   - `listPdgResourceTemplates`
   - `readPdgResource`

若 GitNexus 对 subpath export / tooling import coverage 仍不足：

- 必须明确记录；
- 改用 direct source inspection + exact acceptance；
- 不得假装已获得完整 graph 证据。

## 5. Known Starting Evidence (Treat As Hypotheses To Verify)

以下是开工前已观察到的事实或高概率疑点；实现时必须复核，不得盲信：

1. provider packages 已声明 `./tooling` export，且源码中存在 `src/tooling.ts`；
2. `packages/zotero-mcp/package.json` 还声明了 `./shared/zotero` export；
3. 当前新 worktree 中这些 provider package 的 `dist/` 目录为空，不应假定 build artifacts 已存在；
4. 当前新 worktree 缺少 `node_modules`，`vitest` 尚不可直接运行；
5. `packages/hep-mcp/tsconfig.json` 当前 references 含 `shared` / `orchestrator` / `hepdata-mcp` / `arxiv-mcp` / `openalex-mcp`，但未显式包含 `pdg-mcp` / `zotero-mcp`；这只是当前高价值可疑点，不是既定根因。

本批必须把这些 starting points 重新验证为：

- 真根因
- 次级因素
- 或仅是噪声

## 6. Repair Intent

### 6.1 第一原则：先恢复最小可验证环境

如果当前 worktree 缺少 workspace install / build prerequisites：

- 先恢复最小可验证环境；
- 再判断源码 / config 是否仍需修改；
- 不得在 `node_modules` 缺失、provider package 尚未 build、或 test runner 不可用的前提下，过早得出架构结论。

### 6.2 第二原则：优先修 closure，不重写设计

优先检查并最小修复以下闭环面：

1. workspace install / lockfile / link state
2. package subpath exports
3. TypeScript project references / build order
4. test/build 对 sibling package dist/types 的前置假设
5. `hep-mcp` 对 provider tooling/shared import path 的最小正确性

只有在上述闭环都成立后 failure 仍存在，才允许进一步改 import wiring 或 package contract。

### 6.3 第三原则：拒绝“用架构讨论替代修 bug”

如果你认为“更 generic 的入口更合理”，可以在 review packet / self-review 里记录为后续可能方向，但本批必须先回答：

1. 当前 intentional aggregation 设计下，问题是否能 bounded 修复？
2. 如果能，是否已用 acceptance 证据证明？
3. 如果不能，具体卡在哪条 exact contract，而不是抽象地说“耦合太高”？

## 7. Packet-Assumption Recheck

本批必须显式反审以下前提，不能默认接受：

1. 当前 failure 只是 “没跑 install/build” 的假阳性
2. 当前 failure 只是 “某个 package 少了 export” 的单点问题
3. 当前 failure 已足以证明 `hep-mcp` 的聚合设计本身错误
4. `pdg-mcp` / `zotero-mcp` 在 `tsconfig` references 中缺席只是无关噪声

任何一条若被 acceptance / source inspection 推翻，都必须在 review packet 中显式改写。

## 8. Acceptance Commands

至少跑与实际改动直接相关的 scoped gates，并清楚区分：

- `environment restored`
- `scoped gates passed`
- `canonical baseline still failing outside scope`

### 8.1 环境恢复

若当前 `node_modules` 缺失，先执行：

```bash
pnpm install --frozen-lockfile
```

### 8.2 Provider prerequisites

至少对所有被 `hep-mcp` 直接导入的 provider packages 跑 build：

```bash
pnpm --filter @autoresearch/arxiv-mcp build
pnpm --filter @autoresearch/openalex-mcp build
pnpm --filter @autoresearch/pdg-mcp build
pnpm --filter @autoresearch/zotero-mcp build
pnpm --filter @autoresearch/hepdata-mcp build
```

若本批实际修改了上述 package 的源码或 package contract，还必须补跑对应 package 的 test。

### 8.3 Hep-MCP closeout gates

必须通过：

```bash
pnpm --filter @autoresearch/hep-mcp test -- tests/toolContracts.test.ts
pnpm --filter @autoresearch/hep-mcp build
git diff --check
```

### 8.4 若改动触及相关 import consumer/test surface

补跑最小 regression gates：

```bash
pnpm --filter @autoresearch/hep-mcp test -- tests/tools.test.ts
pnpm --filter @autoresearch/hep-mcp test -- tests/research/providerExecutors.test.ts
pnpm --filter @autoresearch/hep-mcp test -- tests/research/conflictDetectorPdg.test.ts
```

若仍有失败，必须精确标注：

- 失败命令
- 第一处真实报错
- 是否与本批范围直接相关
- 为什么不能同批继续修

## 9. Formal Review / Self-Review

本批必须重新产出新的 `.review/...` 收尾产物：

- `review_packet`
- `review_system`
- `formal review-swarm`
- `formal_review_closeout`
- `self_review`

默认 reviewer 固定为：

- `Opus`
- `Gemini-3.1-Pro-Preview`
- `OpenCode(kimi-for-coding/k2p5)`

审查重点必须包含：

1. 当前 failure 是否已在 **现有 intentional aggregation 设计** 下真正收口；
2. 是否只是靠手工 build 顺序/本地缓存“跑过一次”，但 contract 仍不稳；
3. `package.json` exports、`tsconfig` references、workspace build prerequisites、test/build entrypoint 之间是否真的闭环；
4. `hep-mcp` 是否仍在不恰当地依赖未声明或未构建的 sibling surface；
5. 是否严格没有借机扩成 generic-entrypoint / broker refactor lane；
6. 若 reviewer 认为应升级为新架构 lane，是否给出了 acceptance 级别的反证，而不是抽象偏好。

## 10. 必须同步的 SSOT

完成后至少同步：

1. `meta/remediation_tracker_v1.json`
2. `AGENTS.md`

若本批只修 package/build/test closure、没有引入新的长期稳定架构不变量：

- 明确记录“无新增稳定不变量，不更新 `.serena/memories/architecture-decisions.md`”
- 明确记录“无设计层边界变更，不更新 `meta/REDESIGN_PLAN.md`”

若 review / self-review 认定当前问题其实需要新的 generic-entrypoint lane：

- 本批不得直接实现；
- 但必须把该结论同步到持久 SSOT（至少 tracker 条目或新的 checked-in prompt），不能只留在 chat 或 `.review/` 临时产物中。

## 11. 完成态判定

只有同时满足以下条件，才可视为本批完成：

1. workspace 环境已恢复到可验证状态；
2. provider prerequisite builds 已按需要通过；
3. `pnpm --filter @autoresearch/hep-mcp test -- tests/toolContracts.test.ts` 通过；
4. `pnpm --filter @autoresearch/hep-mcp build` 通过；
5. `review-swarm` 收敛且三审 `0 blocking`；
6. `self-review` `0 blocking`；
7. tracker / `AGENTS.md` 已同步；
8. 已明确写出下一步建议：
   - 若问题已完全收口，说明为什么不需要立刻开启 generic-entrypoint lane；
   - 若问题只暴露了更深设计债，说明下一条应开的 prompt 是什么，以及为什么它是新 lane 而不是本批继续做。
