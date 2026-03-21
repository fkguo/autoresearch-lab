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

### 1.0 默认工作区选择

若当前任务不是并行 lane，且不需要保留一个额外的隔离工作区，默认直接在主仓 `main` worktree 实施，不额外创建 batch worktree。

只有当满足以下任一条件时，才默认创建与主仓平行的本地 `worktree`：

1. 当前存在并行 lane / 并行分支；
2. 需要把未收敛实现与主工作区物理隔离；
3. 人类明确要求使用独立 `worktree`；
4. batch prompt 已显式指定非主 `worktree` 路径。

### 1.1 SOTA preflight 产出与归档

若该实现任务要求做 SOTA / benchmark / best-practice preflight，则默认遵循 **archive-first**：

1. canonical copy 默认落到稳定本地 archive，而不是只留在当前 `worktree` 的 `.tmp/`；推荐路径：`~/.autoresearch-lab-dev/sota-preflight/<YYYY-MM-DD>/<item-id>/preflight.md`。
2. 当前 `worktree` 下可保留便捷副本 / 指针（例如 `.tmp/<item-id>-sota-preflight.md`），但它不是唯一保留位置。
3. archive 至少应包含：`preflight.md`、`summary.md`、`manifest.json`（或等价元数据）；需记录 prompt 路径、批次 / item、关键来源、以及已提炼到哪些 checked-in SSOT。
4. `~/.autoresearch-lab-dev` 下的 archive 属于本地长期参考，不是治理 SSOT；真正约束后续实现的稳定结论仍必须同步到 `.serena/memories/architecture-decisions.md` 或其他已跟踪文档。
5. batch prompt 应显式写出 archive canonical path，以及当前 `worktree` 副本 / 指针路径。

## 2. GitNexus 生命周期要求

### 2.1 实施前

1. 读取 `gitnexus://repo/{name}/context`。
2. 若 index stale，先运行 `npx gitnexus analyze`，再重新读取 context。
3. 若当前 `worktree` 是 dirty 的，尤其包含新增文件 / 新符号 / helper callsites，默认改用 `npx gitnexus analyze --force`；不要把普通 `analyze` 的 `Already up to date` 当成当前工作树已入图的证据。
4. 读取匹配任务的 GitNexus skill。
5. 在改代码前，用 GitNexus 明确关键符号、调用方、受影响 execution flows。

### 2.2 审核前

若实现新增/重命名符号、修改关键调用链、或当前 index 已不反映工作树：

1. 再次刷新 GitNexus；dirty `worktree` 默认运行 `npx gitnexus analyze --force`。
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

实现 prompt 默认必须包含正式 `review-swarm` 收尾，且审核必须深入而非蜻蜓点水。默认 reviewer 固定为 `Opus` + `Gemini-3.1-Pro-Preview` + `OpenCode(zhipuai-coding-plan/glm-5)`；若其中任一模型本地不可用，必须记录失败原因并由人类明确确认 fallback reviewer。至少要求 reviewer：

1. 检查实现代码本身，而非只看 diff 摘要。
2. 检查调用链、关键 execution flows、下游消费者。
3. 检查 tests、eval fixtures、baselines、holdout gate。
4. 检查 packet / prompt 前提是否成立；任何“已收口”“已锁定”“pre-existing unrelated debt”“out of scope”的分类都不是默认可信，必须结合实际代码、shared entrypoint、acceptance failure 与 downstream surface 重新判断。
5. 对 shared/canonical authority 迁移类任务，检查 authority completeness，而不只是看命名或局部 diff：至少核对 authority map -> concrete artifact/template、artifact/template -> authority map、是否仍有 inline duplicate authority、以及 shared entrypoint / canonical acceptance 是否真的通过。
6. 检查 scope discipline，确认未顺手拉入 lane 外工作；但 shared entrypoint 或 canonical acceptance failure 默认先视为 packet assumption breach，而不是自动降级为 lane 外 debt，除非 reviewer 明确给出反证。
7. 对每个 blocking issue / amendment 给出文件级或测试级证据。

### 收敛判定

- 只有当三审都达到 `CONVERGED` / `CONVERGED_WITH_AMENDMENTS`，且 `blocking_issues = 0` 时，才算审核收敛。
- 任一 reviewer 有 blocking issue，就必须修正并重跑下一轮。
- 凡当前 batch 直接相关、高价值、低风险、可独立验证且不依赖后续 phase / lane 的 amendments，默认必须本轮吸收；不得仅因 `non-blocking` 就顺延。
- deferred 仅允许用于 lane 外工作、依赖后续 phase / lane（或当前 batch 之外的后续工作）、pre-existing unrelated debt、需要人类架构裁决、或修复风险明显大于收益的项；但只有在 reviewer / self-review 已明确说明该项为何不推翻 packet 前提、shared entrypoint closeout 或 authority completeness judgment 后，才可按 unrelated debt deferred。仅仍有后续价值的 deferred 项必须记录原因，并同步到持久 SSOT（至少 `meta/remediation_tracker_v1.json` 条目或 checked-in 的后续 prompt 文件），临时 chat prompt、review/self-review 输出与 scratch notes 不算 SSOT。
- 低价值或已判定不值得跟进的 non-blocking amendments 应记录为 declined/closed，而非 deferred；不得把所有 nit 机械推进 backlog。

### 5.2 自审 (`self-review`) 门禁

外部 `review-swarm` 收敛后，当前执行 agent 仍必须再做一轮正式自审，至少覆盖：

1. 实现代码本身与关键调用链 / 下游 surface。
2. GitNexus post-change 证据（`detect_changes`，必要时 `impact` / `context`）。
3. tests、eval fixtures、baselines、holdout gate 是否真的守住新行为。
4. packet / prompt 前提是否被实际代码、shared entrypoint failure 或 authority residue 推翻；若被推翻，必须回写为 blocking issue，而不是沿用 packet 叙事。
5. scope discipline 与 adopted / deferred amendments 是否记录完整。

自审若发现 blocking issue，必须先修复再进入完成态；不得以“外部三审已通过”为由跳过。

### 5.3 Review-Health Telemetry

为避免只凭“最近基本都是 0 blocking”主观判断审查质量，每个 formal closeout 都应按 `meta/docs/review-health-metrics.md` 记录最小 per-batch telemetry。

最低要求：

1. 在持久 SSOT 中记录 `review_rounds`、`first_round_blocking`、`final_zero_blocking`
2. 记录 `amendments_total` 及其 `adopted / deferred / declined_closed` disposition
3. 记录 `reviewer_disagreement`、`packet_assumption_breach`、`self_review_caught_new_issue`
4. 若出现 reviewer 运行故障，记录失败原因以及是否通过 same-model rerun 或 fallback 解决
5. `reopened_later` 与 `post_closeout_escape` 可在后续事实出现时回填，但不应省略该字段定义

## 6. 完成态与版本控制门禁

只有在以下条件全部满足后，实施项才可视为完成：

1. acceptance commands 全部通过；
2. `review-swarm` 已收敛且三审 `0 blocking`；
3. `self-review` 已完成且无未处理 blocking issue；
4. 必需 SSOT 已同步：`meta/remediation_tracker_v1.json` 与 `AGENTS.md` 当前进度摘要；
5. 若本批产出新的长期稳定架构不变量，`.serena/memories/architecture-decisions.md` 已同步；否则明确说明“无新增稳定不变量，不更新 memory”；
6. 若本批改变了 phase 约束、lane 边界、依赖关系、unblock 顺序或 closeout 叙事，`meta/REDESIGN_PLAN.md` 已同步；否则明确说明“无设计层变更，不更新 REDESIGN_PLAN”；
7. 若本批包含 SOTA preflight，则 canonical archive 已落到稳定本地目录（默认 `~/.autoresearch-lab-dev/sota-preflight/...`），且 worktree 清理前已确认可回溯；
8. review amendments 与 deferred 原因已记录，且仍有后续价值的 deferred 项已同步到持久 SSOT。
9. 完成汇报已给出**条件化的下一批建议**：必须基于本批 closeout 的实际结果，说明推荐的下一个 prompt / batch 是什么、为什么是它、以及为什么不是相邻但当前不该启动的 lane。
10. review-health telemetry 已按 `meta/docs/review-health-metrics.md` 记录到持久 SSOT，或明确说明本次为何不适用。

`git commit` / `git push` 规则：

- 默认不执行；需要人类在当前任务中明确授权。
- 一旦授权，也只能在上述完成态满足后执行。
- 若正在提交某个 implementation batch，而该 batch 对应的 canonical prompt 文件（即应被 checked in 的 `meta/docs/prompts/...` prompt）已在当前 `worktree` 本地存在但尚未随实现入库（例如未跟踪、遗漏于前序提交），默认必须与该 batch 的实现同次 commit 提交；只有在人类明确说明该 prompt 不属于本批 canonical deliverable，或该文件只是临时 / 替代 prompt 而非本批 canonical prompt 时，才允许排除。
- 若人类在当前任务中同时明确授权“合入 `main` + 清理该 batch `worktree`”，默认应在同轮 closeout 内连续完成，但只有在 completion gate、commit gate、以及下述 worktree 清理前 migration/archive 门禁全部满足后才允许执行。
- 合入 `main` 前必须再次确认目标分支状态与待交付范围：只允许带着本批应交付内容进入 merge；若出现 merge conflict、目标分支非预期脏改动、或无法确认本批边界，必须停止并记录原因，而不是继续半自动合并。
- 清理该 batch `worktree` 前，必须先完成既有 Serena memory 迁移与 SOTA preflight 迁档门禁；只有在 merge 已完成到人类指定的长期分支（默认 `main`）时，才可执行目录清理。若人类明确要求保留未合入 worktree，则不得清理。
- `git push` 前必须再次确认工作树只包含本批应交付内容。
- `.review/` 产物保持 gitignored，不进入提交。

## 7. 推荐在 batch prompt 中显式写出的几段

1. `GitNexus`：实施前 freshness check + 审核前 conditional refresh
2. `总验收命令`：列出 eval/test/build gates
3. `Packet assumptions`：列出本批依赖的前提（例如“前置 lane 已收口”“某 failures 属于 lane 外 debt”），并为每条前提附上 exact evidence；若没有 exact evidence，只能标成待验证假设，不能写成既定事实
4. `Review-Swarm`：写明 mandatory reviewers（默认 `Opus` + `Gemini-3.1-Pro-Preview` + `OpenCode(zhipuai-coding-plan/glm-5)`）、深审要求、收敛标准，以及 reviewer 必须显式回答“packet 对 blocker / debt / out-of-scope 的分类是否成立”
5. `Self-Review`：写明 agent 自审也是 mandatory gate，且需绑定代码 / GitNexus / eval / scope 证据，并显式复核 packet assumptions 是否被推翻
6. `Authority completeness`：若任务涉及 shared/canonical authority 迁移，prompt 必须明确要求 `map -> artifact`、`artifact -> map`、`no inline duplicate authority`、`shared entrypoint acceptance` 四项检查
7. `交付后必须同步`：至少写明 tracker / `AGENTS.md` 必更；`architecture-decisions` 与 `REDESIGN_PLAN` 何时需要更新、何时明确不更新；以及 amendments / deferred 的持久 SSOT 去向
8. `版本控制门禁`：说明 commit/push 只有在收敛后且已获授权时才允许；若本批对应的 canonical prompt 文件已在当前 `worktree` 存在但尚未入库，必须与同批实现同次 commit 提交，除非人类明确排除或该文件并非本批 canonical prompt
9. `Post-closeout merge / cleanup`：若人类授权合入 `main` 并清理 batch worktree，说明 merge 只可在 completion + commit gate 满足后执行，且清理前必须先完成 Serena memory / SOTA archive 迁移门禁；若 merge 冲突或边界不明，必须停止而非半自动推进
10. `SOTA preflight / archive`：写明 canonical archive path（默认 `~/.autoresearch-lab-dev/sota-preflight/...`）以及当前 `worktree` 副本 / 指针路径
