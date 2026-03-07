# Implementation Prompt Checklist

适用于 `meta/docs/prompts/prompt-*-impl-*.md` 与任何“按之前惯例执行”的实现任务。
本文件是实现 prompt 的通用硬门禁清单；若某个 batch prompt 未显式重复，也默认继承本清单。

## 1. 开工前必须读取

至少包含：

1. `AGENTS.md`
2. `meta/remediation_tracker_v1.json`
3. `meta/REDESIGN_PLAN.md` 中目标项完整描述、依赖、验收条件、lane 边界
4. 相关架构 / memory 文档
5. 目标代码与相邻测试

## 2. GitNexus 生命周期要求

### 2.1 实施前

1. 读取 `gitnexus://repo/{name}/context`。
2. 若 index stale，先运行 `npx gitnexus analyze`，再重新读取 context。
3. 读取匹配任务的 GitNexus skill。
4. 在改代码前，用 GitNexus 明确关键符号、调用方、受影响 execution flows。

### 2.2 审核前

若实现新增/重命名符号、修改关键调用链、或当前 index 已不反映工作树：

1. 再次运行 `npx gitnexus analyze`。
2. 使用 `detect_changes`，必要时配合 `impact` / `context`。
3. 把受影响 callers / flows / downstream surface 纳入 review packet。

## 3. tracker 生命周期要求

- 开工前：目标项标记为 `in_progress`，填写当前实际模型。
- 完成后：只有在验收 + review-swarm 收敛后才能标记 `done`。
- 阻塞时：标 `blocked` 并写明原因。

## 4. Eval / 验收门禁

1. 若目标项缺专项 eval/tests，必须先创建并锁定 baseline，再实施。
2. 不得以“暂无测试”为由跳过验证。
3. prompt 中必须列出本批 acceptance commands。
4. 对 shared schema / type / contract 变更，必须补跑相邻 package 的 test/build。

## 5. Review-Swarm / Self-Review 门禁

实现 prompt 默认必须包含正式 `review-swarm` 收尾，且审核必须深入而非蜻蜓点水。至少要求 reviewer：

1. 检查实现代码本身，而非只看 diff 摘要。
2. 检查调用链、关键 execution flows、下游消费者。
3. 检查 tests、eval fixtures、baselines、holdout gate。
4. 检查 scope discipline，确认未顺手拉入 lane 外工作。
5. 对每个 blocking issue / amendment 给出文件级或测试级证据。

### 收敛判定

- 只有当双审都达到 `CONVERGED` / `CONVERGED_WITH_AMENDMENTS`，且 `blocking_issues = 0` 时，才算审核收敛。
- 任一 reviewer 有 blocking issue，就必须修正并重跑下一轮。
- 低风险 amendments 应优先吸收；deferred 项必须记录原因。

### 5.2 自审 (`self-review`) 门禁

外部 `review-swarm` 收敛后，当前执行 agent 仍必须再做一轮正式自审，至少覆盖：

1. 实现代码本身与关键调用链 / 下游 surface。
2. GitNexus post-change 证据（`detect_changes`，必要时 `impact` / `context`）。
3. tests、eval fixtures、baselines、holdout gate 是否真的守住新行为。
4. scope discipline 与 adopted / deferred amendments 是否记录完整。

自审若发现 blocking issue，必须先修复再进入完成态；不得以“外部双审已通过”为由跳过。

## 6. 完成态与版本控制门禁

只有在以下条件全部满足后，实施项才可视为完成：

1. acceptance commands 全部通过；
2. `review-swarm` 已收敛且双审 `0 blocking`；
3. `self-review` 已完成且无未处理 blocking issue；
4. tracker / `.serena/memories/architecture-decisions.md` / `AGENTS.md` 已同步；
5. review amendments 与 deferred 原因已记录。
6. 完成汇报已给出**条件化的下一批建议**：必须基于本批 closeout 的实际结果，说明推荐的下一个 prompt / batch 是什么、为什么是它、以及为什么不是相邻但当前不该启动的 lane。

`git commit` / `git push` 规则：

- 默认不执行；需要人类在当前任务中明确授权。
- 一旦授权，也只能在上述完成态满足后执行。
- `git push` 前必须再次确认工作树只包含本批应交付内容。
- `.review/` 产物保持 gitignored，不进入提交。

## 7. 推荐在 batch prompt 中显式写出的几段

1. `GitNexus`：实施前 freshness check + 审核前 conditional refresh
2. `总验收命令`：列出 eval/test/build gates
3. `Review-Swarm`：写明 mandatory reviewers、深审要求、收敛标准
4. `Self-Review`：写明 agent 自审也是 mandatory gate，且需绑定代码 / GitNexus / eval / scope 证据
5. `交付后必须同步`：tracker / memory / AGENTS / amendments / deferred
6. `版本控制门禁`：说明 commit/push 只有在收敛后且已获授权时才允许
