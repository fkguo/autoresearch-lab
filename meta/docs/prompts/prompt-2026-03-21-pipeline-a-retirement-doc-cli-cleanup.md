# Prompt: 2026-03-21 `Pipeline A` Retirement Doc/CLI Cleanup

> **作用**: 这是一个未来的治理 / 文档 cleanup slice，不是当前要立即启动的实现批次。它只在 `hep-autoresearch` / `hepar` 的生命周期状态从“当前仍可用的过渡态”继续推进到 `deprecated` / `retired` / `repointed` 时启用，用来清理残余说明页、help 文案、skills/docs 入口叙事与默认入口表述，避免仓库继续同时存在“已经退役”和“仍是默认入口”的冲突文案。

## 触发条件

满足以下任一条件时再启动本 prompt：

1. `meta/REDESIGN_PLAN.md` 或 tracker 已把 `Pipeline A` 的生命周期推进到明确的 `deprecated` / `retired` / `repointed`
2. `hep-autoresearch` / `hepar` 的实际运行时 authority 已不再是推荐默认入口
3. 某个 closeout 已经改变 package / CLI 生命周期语义，并触发 `IMPLEMENTATION_PROMPT_CHECKLIST.md` 的生命周期同步门禁

若上述条件尚未满足，则本 prompt 只作为已登记的 future cleanup slice 保留，不应提前大扫除。

## 问题定义

当前仓库允许同时存在两类文案：

- **现状文案**：说明 `hep-autoresearch` / `hepar` 目前仍可使用
- **目标架构文案**：说明 `Pipeline A` 将随 TS orchestrator 收束而退役

这类双状态在主 SSOT 已可共存，但一旦生命周期继续推进，如果残余页面、README、tutorial、skill docs、help 文案、脚手架说明或历史 memo 不同步，就会再次出现语义漂移。

本 prompt 的目标不是决定要不要退役，而是在退役 / repoint 决策已经明确后，做一次 **source-grounded lifecycle doc sweep**，把所有仍在暗示“默认入口 = hepar / hep-autoresearch”的残余 surface 统一收口。

## In Scope

1. 扫描并分类所有 `hep-autoresearch` / `hepar` / `Pipeline A` 相关文案 surface：
   - root governance/docs
   - package README / tutorials / workflows
   - relevant skill docs
   - CLI help / doctor / update scripts / user-facing warnings
   - scaffold/readme comments
2. 把残余 surface 归类为：
   - 现役过渡说明（保留，但必须带 lifecycle banner）
   - 历史/归档说明（移动到 archive/legacy 语义）
   - 默认入口说明（必须改写、删除或 repoint）
3. 若 `hepar` 名字被保留但改挂到 TS orchestrator，需要显式写清：
   - 这是 repoint 后的新 authority
   - 不再等同于旧 Python CLI
4. 补充最小 grep / contract / docs acceptance，确保不会再留下明显默认入口冲突

## Out Of Scope

1. 不在本批决定 retirement / repoint 本身的架构结论
2. 不在本批重写 TS orchestrator product shell / CLI 设计
3. 不在本批做 Python runtime 删除、package removal、shim removal，除非当前 retirement batch 已明确要求
4. 不顺手做 unrelated docs polish

## 建议读取

1. `AGENTS.md`
2. `meta/remediation_tracker_v1.json`
3. `meta/REDESIGN_PLAN.md`
4. `.serena/memories/architecture-decisions.md`
5. `meta/docs/prompts/IMPLEMENTATION_PROMPT_CHECKLIST.md`
6. 当时实际受影响的 README / tutorial / workflows / skills / CLI docs

## 建议输出

1. 一份“当前 vs 目标” lifecycle map
2. 一份残余 surface 分类清单
3. 更新后的 docs/help/skill text
4. tracker closeout note，明确：
   - 哪些页面改为 transitional/deprecated/retired/repointed
   - 哪些页面被归档
   - 是否仍保留 `hepar` 作为名字；若保留，它现在指向什么 authority

## 建议 acceptance

至少包含：

```bash
git diff --check
rg -n "hepar|hep-autoresearch|Pipeline A" AGENTS.md meta/REDESIGN_PLAN.md meta/remediation_tracker_v1.json .serena/memories/architecture-decisions.md packages/hep-autoresearch packages/hep-autoresearch/docs skills
```

若当时存在对应的 CLI help / docs snapshot / smoke tests，也应补跑。

## 完成判据

只有当以下问题都能被明确回答时，才算完成：

1. `hepar` 现在到底还是旧 Python CLI、已经 retired、还是 repoint 到新 TS orchestrator？
2. 仓库中是否仍有任何主入口文档把 `hepar` / `hep-autoresearch` 当作默认长期 authority？
3. “当前仍可用”与“长期将退役/已退役”是否在所有主入口 docs 上被一致地区分？
