# Prompt: 2026-03-15 Standalone — Retro-Closeout Repair for `NEW-RT-04` / `NEW-COMP-01`

> 适用范围：**仅**用于一个新的 bounded implementation / repair 对话。
> 默认继承 `meta/docs/prompts/IMPLEMENTATION_PROMPT_CHECKLIST.md`。
>
> 本批不是新的 compute lane，也不是新的 retro-closeout rereview。`.review/2026-03-15-retro-closeout-rereview/` 已完成增强 rereview，并在 baseline `dafbfca` 上识别出两个不能再维持 closeout 的 blocker：
>
> - `NEW-RT-04`: durable execution 目前只有 library/test 路径，没有 shared entrypoint / production call path
> - `NEW-COMP-01`: `meta/docs/computation-mcp-design.md` 与 live risk / confirmation authority 不一致
>
> 本批目标是做一次 **bounded repair + closeout re-judgment**：只修复这两个 blocker，并在必要时同步 `NEW-CONN-04` 的文档漂移；不得扩成新的实现 lane。

## 0. Why This Batch Next

当前 `.review/2026-03-15-retro-closeout-rereview/` 的 formal review 与 self-review 已明确：

- `NEW-R15-impl`、`UX-02`、`NEW-CONN-04`、`NEW-IDEA-01` 仍可维持 closeout；
- `NEW-RT-04` 与 `NEW-COMP-01` 不能继续按 2026-03-12 的 retro-closeout note 保持 `done`；
- 若不修复或重算这两个项，tracker / AGENTS / 规划叙事将继续建立在错误前提上。

因此，下一步不是重跑 rereview，而是一个 **有边界的 repair batch**：

1. 修补或下调 `NEW-RT-04` 的 closeout 前提；
2. 修补或对齐 `NEW-COMP-01` 的 authority mismatch；
3. 顺手吸收 `NEW-CONN-04` 已确认的低风险文档漂移；
4. 重新跑 formal review / self-review，重算这三个项的 closeout judgment。

## 1. Hard Scope Boundary

本批 **只允许**覆盖：

1. `NEW-RT-04`
2. `NEW-COMP-01`
3. 必要的 `NEW-CONN-04` 文档同步
4. tracker / `AGENTS.md` / closeout artifacts 同步

### 明确禁止

不要启动、顺手吸收、或部分实现以下 lane：

- `NEW-COMP-02`
- `EVO-*`
- `NEW-LOOP-01`
- `NEW-05a-*`
- `NEW-R15-impl` / `UX-02` / `NEW-IDEA-01` 的新实现
- generic migration
- research-loop lane
- 全仓 build failure 大扫除

若发现 baseline 外问题，只允许记录为 out-of-scope evidence，不得借机扩批。

## 2. 开工前必须读取

按顺序至少读取：

1. `AGENTS.md`
2. `meta/remediation_tracker_v1.json`
3. `meta/docs/prompts/IMPLEMENTATION_PROMPT_CHECKLIST.md`
4. `meta/REDESIGN_PLAN.md`
5. 本文件 `meta/docs/prompts/prompt-2026-03-15-retro-closeout-repair.md`

然后继续读取当前 rereview 产物（mandatory，不是可选）：

6. `.review/2026-03-15-retro-closeout-rereview/review_packet.md`
7. `.review/2026-03-15-retro-closeout-rereview/formal_review_closeout.md`
8. `.review/2026-03-15-retro-closeout-rereview/self_review.md`
9. `.review/2026-03-15-retro-closeout-rereview/out/agent_1_claude_opus.txt`
10. `.review/2026-03-15-retro-closeout-rereview/out/agent_2_gemini_gemini-3.1-pro-preview.txt`
11. `.review/2026-03-15-retro-closeout-rereview/out/agent_3_kimi-for-coding_k2p5.txt`

再读取直接相关代码 / 测试 / 文档：

### `NEW-RT-04`

12. `packages/orchestrator/src/agent-runner.ts`
13. `packages/orchestrator/src/agent-runner-ops.ts`
14. `packages/orchestrator/src/run-manifest.ts`
15. `packages/orchestrator/tests/run-manifest.test.ts`
16. `packages/orchestrator/tests/agent-runner-manifest.test.ts`
17. repo 内所有 `new AgentRunner(` 与 `new RunManifestManager(` callsites

### `NEW-COMP-01`

18. `meta/docs/computation-mcp-design.md`
19. `packages/hep-mcp/src/tool-risk.ts`
20. `packages/hep-mcp/src/tools/registry/projectSchemas.ts`
21. `packages/hep-mcp/src/tools/dispatcher.ts`
22. `packages/hep-mcp/src/tools/registry/projectExtensions.ts`
23. `packages/hep-mcp/tests/core/ingestSkillArtifacts.test.ts`
24. `packages/hep-mcp/tests/toolContracts.test.ts`

### `NEW-CONN-04` 文档同步

25. `packages/hep-mcp/src/tools/create-from-idea.ts`
26. `packages/hep-mcp/tests/core/createFromIdea.test.ts`
27. `packages/hep-mcp/tests/contracts/ideaRunsIntegrationContract.test.ts`
28. `meta/docs/idea-runs-integration-contract.md`

若阅读中发现 live authority 还分布在别处，必须继续补读；禁止只看单文件就动手。

## 3. GitNexus Hard Gate

先按 checklist 尝试 GitNexus freshness / context：

1. 读 `gitnexus://repo/{name}/context`
2. 若 stale 或 dirty worktree 需要当前源码证据，运行 `npx gitnexus analyze --force`
3. 对齐至少以下符号 / surface：
   - `AgentRunner`
   - `RunManifestManager`
   - `handleToolCall`
   - `HEP_RUN_INGEST_SKILL_ARTIFACTS`
   - `createFromIdea`

若 GitNexus MCP 仍报 `Transport closed`：

- 必须明确记录失败；
- 改用 direct source inspection + targeted tests；
- 不得假装已获得成功的 post-change graph evidence。

## 4. Repair Intent

### 4.1 `NEW-RT-04`

当前 blocker 不是“library 代码不存在”，而是 **closeout claim 超过了真实 shared entrypoint**。

本批必须先判定哪条 bounded 收口路径成立：

#### 路径 A: 补 shared entrypoint

如果能在本批范围内，以低风险方式把 durable execution 真正接到一个 live shared entrypoint / production call path，并用针对性测试锁住：

- 可以修代码；
- 但必须保持 strictly bounded，不得顺手启动新的 runtime lane。

#### 路径 B: 下调 closeout 叙事

如果本批不适合接入 shared entrypoint：

- 不要伪装 closeout；
- 必须把 `NEW-RT-04` 的 tracker / AGENTS / REDESIGN_PLAN / note 下调为真实状态；
- 明确它目前只是 library-level foundation，而不是 live runtime capability；
- 给出更小的 follow-up 收口方式。

**禁止第三条路**：继续把 test-only 行为写成 live capability。

### 4.2 `NEW-COMP-01`

当前 blocker 是 **design SSOT 与 live authority 不一致**。

本批必须明确回答：

1. `hep_run_ingest_skill_artifacts` 按当前真实安全模型到底应该是 `write` 还是 `destructive`？
2. 为什么？
3. 哪一侧才是 authority：
   - design doc 应改成 live code；
   - 还是 live code / schema / tests 应改成 design doc？

允许的 bounded 修法只有两类：

#### 路径 A: 修 live authority

若判定 ingestion 应属 `destructive`：

- 同步修改 `tool-risk.ts`
- 补 `_confirm` schema
- 补 dispatcher / contract tests / docs

#### 路径 B: 修 design SSOT

若判定 ingestion 应属 `write`：

- 修改 `meta/docs/computation-mcp-design.md`
- 明确写出为什么 C-02 containment + current write semantics 足够
- 同步相关 acceptance / note / review artifacts

**禁止**只做一句“文档漂移”解释然后继续保留冲突。

### 4.3 `NEW-CONN-04`

本批不重做实现，只允许吸收已确认的低风险文档漂移：

- `meta/REDESIGN_PLAN.md` 中 `next_actions` 叙事与 live code / tests 对齐

## 5. Packet-Assumption Recheck

本批必须显式反审以下旧前提，不能默认接受：

1. `NEW-RT-04` 只是 tracker drift / local test gap
2. `NEW-COMP-01` 只是文档 drift
3. `NEW-CONN-04` 的 drift 不影响 closeout completeness

任何 shared entrypoint failure 或 authority mismatch，默认先视为 packet assumption breach，而不是 lane 外 debt。

## 6. Acceptance Commands

至少跑与实际改动直接相关的 scoped gates，并在 closeout note 中区分：

- `scoped gates passed`
- `canonical baseline gates still failing outside scope`

最低要求：

```bash
git diff --check
```

若改动 `NEW-RT-04` 相关代码或叙事：

```bash
pnpm --filter @autoresearch/orchestrator test -- tests/run-manifest.test.ts tests/agent-runner-manifest.test.ts
```

若新增 production/shared-entrypoint wiring，再补对应最小 integration / regression gate。

若改动 `NEW-COMP-01` live authority 或其测试：

```bash
pnpm --filter @autoresearch/hep-mcp test -- tests/core/ingestSkillArtifacts.test.ts
pnpm --filter @autoresearch/hep-mcp test -- tests/toolContracts.test.ts
```

若改动 `NEW-CONN-04` 文档 / contract narrative：

```bash
pnpm --filter @autoresearch/hep-mcp test -- tests/core/createFromIdea.test.ts tests/contracts/ideaRunsIntegrationContract.test.ts
```

若当前 worktree 允许，也尽量补跑相邻 scoped builds；但若 full build / full test 仍因 baseline 外问题失败，必须清楚记录失败点和是否与本批无关。

## 7. Formal Review / Self-Review

本批必须重新产出新的 `.review/...` 修订产物：

- `review_packet`
- `review_system`
- `formal review-swarm`
- `formal_review_closeout`
- `self_review`

默认 reviewer 仍为：

- `Opus`
- `Gemini-3.1-Pro-Preview`
- `OpenCode(kimi-for-coding/k2p5)`

审查重点：

1. `NEW-RT-04` blocker 是否真正消除，还是只是改写叙事
2. `NEW-COMP-01` authority mismatch 是否真正消除
3. `NEW-CONN-04` drift 是否仅剩文档同步
4. scoped acceptance 与 canonical baseline failure 是否被清楚区分
5. 是否严格没有扩成新 lane

## 8. 必须同步的 SSOT

完成后至少同步：

1. `meta/remediation_tracker_v1.json`
2. `AGENTS.md`

按需同步：

3. `meta/REDESIGN_PLAN.md`
4. `meta/docs/computation-mcp-design.md`

若某项本轮仍不能恢复 closeout：

- 必须在 tracker note 中明确写清 blocker 仍然存在；
- 不能含糊维持 `done`。

## 9. 完成态定义

只有以下条件全部满足，本批才算完成：

1. 两个 blocker 的 disposition 已明确：
   - 要么真正修复；
   - 要么明确下调 closeout 并同步 SSOT；
2. 所有 scoped acceptance 命令已执行并记录；
3. formal review 已完成；
4. self-review 已完成；
5. tracker / `AGENTS.md` / 必要文档已同步；
6. 最终汇报明确说明：
   - 哪些项恢复 closeout
   - 哪些项仍不能 closeout
   - 为什么

## 10. Do Not Do

- 不要把本批升级成 `NEW-COMP-02`
- 不要顺手做 `EVO-*`
- 不要扩到 `NEW-R15-impl` / `UX-02` / `NEW-IDEA-01` 的新实现
- 不要把 baseline 外 build failure 当成本批 blocker
- 不要为了“让 closeout 看起来成立”而回避 shared entrypoint / authority completeness 事实

## 11. 期望结果

理想结果之一：

- `NEW-RT-04` 与 `NEW-COMP-01` 都被 bounded 修复并重新 closeout；

或者更保守但仍正确的结果：

- 至少其中一项被明确下调为非-closeout状态，SSOT 不再继续撒谎；

无论哪种结果，都必须比当前状态更真实，而不是更好看。
