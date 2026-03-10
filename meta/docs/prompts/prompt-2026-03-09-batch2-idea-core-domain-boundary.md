# Prompt: 2026-03-09 Batch 2 — Idea-Core Domain Boundary Re-baseline

> 默认继承 `meta/docs/prompts/IMPLEMENTATION_PROMPT_CHECKLIST.md`
>
> 前置：`Batch 1` 已完成并收口。  
> 目标：在 `NEW-05a Stage 3` 前，把 `idea-core` 中 generic core 不应持有的 HEP compute/domain 假设下沉到 domain-pack/provider seam。
>
> **状态注记 (2026-03-10, Batch F downstream recovery)**：本 prompt 的 residual scope 已被 `meta/docs/prompts/prompt-2026-03-10-hep-semantic-deep-cleanup.md` 的 Batch A 实质吸收，并已以 `NEW-05a-idea-core-domain-boundary` closeout 正式收口。当前 `idea-core` live boundary 仅保留 provider-local `hep.operators.v1` pack catalog 与 explicit capability/task-first constraint policy；`hep.bootstrap` / `bootstrap_default` / `HEP_COMPUTE_RUBRIC_RULES` / `toy_laptop` 不再位于 generic/default authority path。除非后续出现新的 blocking regression，否则不要重新开启本 prompt；下一条独立 prompt 是 `meta/docs/prompts/prompt-2026-03-09-batch3-runtime-root-dehep.md`，但不属于本批。

## 0. 开工前必读

1. `AGENTS.md`
2. `packages/idea-core/AGENTS.md`
3. `meta/remediation_tracker_v1.json`
4. `meta/REDESIGN_PLAN.md`（至少 `NEW-05a` / `P5A` / `EVO-13`）
5. `meta/docs/2026-03-09-root-ecosystem-boundary-adr.md`
6. `meta/docs/prompts/prompt-2026-03-09-batch1-shared-boundary.md`
7. `packages/idea-core/src/idea_core/engine/coordinator.py`
8. `packages/idea-core/src/idea_core/engine/domain_pack.py`
9. `packages/idea-core/src/idea_core/engine/hep_constraint_policy.py`
10. 相邻测试：
   - `packages/idea-core/tests/engine/test_domain_pack_m30.py`
   - `packages/idea-core/tests/engine/test_formalism_registry_m31.py`
   - `packages/idea-core/tests/engine/test_compute_plan_rubric_m36.py`

## 1. 范围

### 1.1 In scope

- `packages/idea-core/src/idea_core/engine/coordinator.py`
- `packages/idea-core/src/idea_core/engine/domain_pack.py`
- `packages/idea-core/src/idea_core/engine/formalism_registry.py`
- 必要时新增/调整相邻 domain-pack helper 文件
- 相邻 engine tests

### 1.2 Out of scope

- TS `idea-engine` 实现本身
- root docs / metadata 去 HEP 占位
- orchestrator env var 改名
- `openalex-mcp` path fallback
- 引入第二个真实非 HEP domain pack

## 2. 目标状态

- generic core 不再内嵌：
  - `HEP_INFRASTRUCTURE_TIERS`
  - `HEP_COMPUTE_RUBRIC_RULES`
  - `_infer_hep_compute_rubric(...)`
  - built-in default pack = `hep.default` 这种“HEP as generic default”语义
- HEP-specific compute/domain heuristics 被显式放到 domain-pack/provider seam
- `NEW-05a Stage 3` 可在更干净的边界上迁移，而不是机械 port HEP leakage

## 3. 变更清单

1. 识别 core 中哪些是 generic invariant，哪些是 HEP-specific heuristic
2. 把 HEP compute rubric / infrastructure tier 迁出 core 主逻辑
3. 把 default pack 语义改成不把 HEP 表达成 generic built-in default authority
4. 调整测试，使其验证：
   - generic core 仍工作
   - HEP pack 仍能提供原有 HEP behavior
   - core/provider 边界变清晰

## 4. 明确禁止

- 不要为了“泛化”而在 core 里硬塞 package/tool 枚举
- 不要把 HEP-specific 逻辑简单改名成 generic 名字继续放在 core
- 不要提前写 TS `idea-engine`
- 不要顺手推进 `EVO-13`

## 5. 验收命令

建议先跑 targeted，再跑全量：

- `PYTHONPYCACHEPREFIX=/tmp/pycache python3 -m pytest packages/idea-core/tests/engine/test_domain_pack_m30.py -q`
- `PYTHONPYCACHEPREFIX=/tmp/pycache python3 -m pytest packages/idea-core/tests/engine/test_formalism_registry_m31.py -q`
- `PYTHONPYCACHEPREFIX=/tmp/pycache python3 -m pytest packages/idea-core/tests/engine/test_compute_plan_rubric_m36.py -q`
- `make -C packages/idea-core validate`
- `make -C packages/idea-core test`
- `git diff --check`

## 6. 完成定义

- generic core 不再以 HEP rubric/default pack 充当默认世界观
- HEP behavior 仍保留，但通过 domain-pack/provider seam 提供
- `NEW-05a Stage 3` 的“zero domain-specific symbol in generic layer”约束更接近可验证

## 7. 收尾要求

- `review-swarm` 必须特别看 boundary，而不是只看测试是否通过
- `self-review` 必须明确说明：哪些符号仍允许在 generic layer，哪些已被下沉

## 8. SSOT 同步要求

- `meta/remediation_tracker_v1.json`：更新本批对应条目状态、commit hash、adopted/deferred dispositions；若当前 tracker 尚无独立条目，先补最小可审计条目再 closeout
- `AGENTS.md`：同步当前进度摘要，明确 `idea-core` generic core 与 domain-pack seam 的净化结果
- `meta/REDESIGN_PLAN.md`：若本批实质推进了 `NEW-05a Stage 3` 的前置去污染，或改变了 TS `idea-engine` 迁移的 unblock 关系，应同步 closeout 说明；不要写文件级改动流水账
- `.serena/memories/architecture-decisions.md`：仅当本批沉淀出新的长期稳定不变量时更新；本批预期可写入的不变量类型是“generic core 不得把某 domain pack 当默认世界观，domain heuristics 必须经 domain-pack/provider seam 提供”
