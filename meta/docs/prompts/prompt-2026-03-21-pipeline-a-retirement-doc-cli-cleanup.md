# Prompt: 2026-03-21 `Pipeline A` Retirement Doc/CLI Cleanup

> **作用**: 这是 2026-03-23 立即执行的 post-repoint operator-facing cleanup slice。`@autoresearch/orchestrator` 的 `autoresearch` 已成为 canonical generic lifecycle entrypoint，但 repoint 之后仍有少量 doc / tutorial / workflow / help wording 会误导 operator 继续把 `hepar` / `hep-autoresearch` 当作默认 generic 入口。本批只做最小同步收口，不重开 runtime / CLI capability 设计。

## 当前 authority map

- generic lifecycle authority = `autoresearch`
- scaffold authority = `project-contracts`
- transitional Pipeline A legacy lifecycle surface = `hepar` / `hep-autoresearch` / `hep-autopilot`
- unrepointed commands = `run` / `doctor` / `bridge`

## 当前批次前提

本批前提已经满足：

1. `autoresearch` 已 live，且当前只覆盖 `init/status/approve/pause/resume/export`
2. `autoresearch init` 仍是对既有 scaffold authority 的 thin composition，不是第二套 scaffold authority
3. `hepar` / `hep-autoresearch` / `hep-autopilot` 仍是同一条 transitional Pipeline A legacy surface
4. `run` / `doctor` / `bridge` 仍未 repoint，因此本批必须只收口 operator-facing wording，不能顺手做 run-shell parity

## 问题定义

当前问题不是 retirement 要不要发生，而是：lifecycle verbs 已经 repoint 到 `autoresearch`，但仓库里仍有少量 operator-facing surface 把 `hepar` / `hep-autoresearch` / 旧脚本路径写成默认 generic lifecycle 入口，或把 legacy / unrepointed commands 与 canonical lifecycle authority 混写。若不立即收口，operator 会被现有 README / tutorial / workflow / help wording 误导成“双入口都可以”。

本 prompt 的目标是做一次 **source-grounded post-repoint doc/help cleanup**，把所有仍在暗示“默认 generic lifecycle 入口 = hepar / hep-autoresearch”的残余 surface 统一改成当前真实语义。

## In Scope

1. 只处理 repoint 之后仍会误导 operator 的 doc / tutorial / workflow / help wording：
   - canonical prompt 本身
   - package README / docs index / beginner tutorial
   - workflow docs
   - operator-facing help / warning text
2. 所有 touched surface 必须明确写成：
   - `autoresearch` = canonical lifecycle entrypoint
   - `hepar` / `hep-autoresearch` / `hep-autopilot` = transitional legacy Pipeline A surface
   - `run` / `doctor` / `bridge` = unrepointed commands
3. 对仍然使用 legacy surface 的 workflow / help 示例，必须写清这是 unrepointed command 语境，不能再暗示 lifecycle verbs 也默认走 legacy surface
4. 补充最小 grep / CLI acceptance，确保不会再留下明显默认入口冲突

## Out Of Scope

1. 不在本批决定 retirement / repoint 本身的架构结论
2. 不在本批引入 alias、fallback wrapper、hidden alias、第二套 authority 或 mutation seam
3. 不在本批推进 `run` / `doctor` / `bridge` runtime repoint、run-shell parity、HEP provider-pack cleanup、EVO-14、EVO-15
4. 不做全仓大清洗或 unrelated docs polish

## 建议读取

1. `AGENTS.md`
2. `meta/remediation_tracker_v1.json`
3. `meta/REDESIGN_PLAN.md`
4. `.serena/memories/architecture-decisions.md`
5. `meta/docs/prompts/IMPLEMENTATION_PROMPT_CHECKLIST.md`
6. 当前实际受影响的 README / tutorial / workflows / help surface

## 建议输出

1. 一份“canonical lifecycle vs transitional legacy vs unrepointed commands” map
2. 一份最小 touched-surface 清单
3. 更新后的 docs / workflow / help text
4. tracker closeout note，明确：
   - 哪些页面已同步到 canonical lifecycle authority map
   - 哪些 surface 仍保留 legacy command 语义
   - 为什么本批仍未碰 `run` / `doctor` / `bridge` repoint

## 建议 acceptance

至少包含：

```bash
git diff --check
node packages/orchestrator/dist/cli.js --help
PYTHONPATH=packages/hep-autoresearch/src python3 -m hep_autoresearch.orchestrator_cli --help
rg -n "hep-autoresearch init|hep-autoresearch status|hep-autoresearch approve|hepar status|hepar approve|run hep-autoresearch init" \
  packages/hep-autoresearch/README.zh.md \
  packages/hep-autoresearch/docs/INDEX.md \
  packages/hep-autoresearch/docs/BEGINNER_TUTORIAL.md \
  packages/hep-autoresearch/docs/BEGINNER_TUTORIAL.zh.md \
  packages/hep-autoresearch/docs/WORKFLOWS.md \
  packages/hep-autoresearch/workflows/paper_reviser.md \
  packages/hep-autoresearch/workflows/paper_reviser.zh.md \
  packages/hep-autoresearch/docs/ORCHESTRATOR_INTERACTION.zh.md \
  packages/hep-autoresearch/src/hep_autoresearch/web/app.py
pytest packages/hep-autoresearch/tests/test_doctor_entrypoints_cli.py -q
```

如实现时改动了额外 user-facing hint，可补最小 targeted test；否则不要为了“名字统一”制造无意义测试 churn。

## 完成判据

只有当以下问题都能被明确回答时，才算完成：

1. `autoresearch` 是否已在所有 touched operator-facing surface 上被写成 canonical lifecycle entrypoint？
2. `hepar` / `hep-autoresearch` / `hep-autopilot` 是否在所有 touched surface 上被一致降格为同一条 transitional legacy surface？
3. `run` / `doctor` / `bridge` 是否仍被明确标成 unrepointed commands，而没有被本批顺手 repoint？
