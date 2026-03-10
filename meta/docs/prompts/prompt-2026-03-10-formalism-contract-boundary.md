# Prompt: 2026-03-10 Follow-up — Formalism Contract Boundary / De-instancing

> 默认继承 `meta/docs/prompts/IMPLEMENTATION_PROMPT_CHECKLIST.md`
>
> 前置：`prompt-2026-03-09-batch1-shared-boundary.md` 已完成；`prompt-2026-03-09-batch2-idea-core-domain-boundary.md` 已完成其局部代码清理，但 closeout 暂停。  
> 目标：把 `formalism` 从 repo 级 public authority / mandatory gate / shipped concrete worldview 中降级出去，重建 `question -> method/approach -> execution/provider` 的边界。

## 0. 开工前必读

1. `AGENTS.md`
2. `packages/idea-core/AGENTS.md`
3. `meta/remediation_tracker_v1.json`
4. `meta/REDESIGN_PLAN.md`（至少 `NEW-05a` / `EVO-01` / `NEW-LOOP-01` / `P5A`）
5. `meta/docs/2026-03-10-formalism-boundary-sota-memo.md`
6. `meta/docs/2026-03-09-root-ecosystem-boundary-adr.md`
7. `meta/docs/prompts/prompt-2026-03-09-batch2-idea-core-domain-boundary.md`
8. `meta/docs/prompts/prompt-2026-03-09-batch3-runtime-root-dehep.md`
9. `packages/idea-generator/schemas/idea_card_v1.schema.json`
10. `packages/idea-generator/schemas/formalism_registry_v1.schema.json`
11. `packages/idea-generator/schemas/idea_handoff_c2_v1.schema.json`
12. `packages/idea-core/src/idea_core/engine/coordinator.py`
13. `packages/idea-core/src/idea_core/engine/domain_pack.py`
14. `packages/idea-core/src/idea_core/engine/formalism_registry.py`
15. `packages/shared/src/graph-viz/adapters/idea-map.ts`
16. `packages/hep-mcp/src/tools/create-from-idea.ts`

## 1. 范围

### 1.1 In scope

- `packages/idea-generator/schemas/idea_card_v1.schema.json`
- `packages/idea-generator/schemas/formalism_registry_v1.schema.json`
- `packages/idea-generator/schemas/idea_handoff_c2_v1.schema.json`
- 相关 `promotion_result` / OpenRPC / vendored snapshot 同步
- `packages/idea-core/src/idea_core/engine/{coordinator,domain_pack,formalism_registry,operators,retrieval}.py`
- `packages/idea-core/src/idea_core/engine/hep_*`
- `packages/shared/src/graph-viz/adapters/idea-map.ts`
- 必要时 `packages/hep-mcp/src/tools/create-from-idea.ts`
- 相邻 tests / docs / snapshot regeneration

### 1.2 Out of scope

- 完整实现 `method_spec -> execution_plan`
- 引入第二个真实非 HEP domain pack
- 构建 formalism/global knowledge base
- 顺手推进 `EVO-13` 或 packaged agent
- root README / orchestrator env/path 命名清理（那是 `batch3`）

## 2. 问题定义

当前 repo 仍把以下内容制度化为 public authority：

- `IdeaCard.candidate_formalisms[]` 必填
- `formalism_registry` 必须非空
- `campaign.init` 默认挑选第一个 formalism 进入 seed/search
- `node.promote` 必须输出 `formalism_check: pass`
- HEP built-ins 继续 shipped concrete ids，如 `hep/toy` / `hep/eft` / `hep/lattice`

这与当前 repo 的长期方向冲突：

- `autoresearch` 的 core 应围绕问题、evidence、artifact、approval、runtime
- 方法 / formalism 应是可选、可迭代、可替换的 project/run-local 内容
- HEP pack 应提供 capability/provider seam，而不是 concrete worldview authority

## 3. 目标状态

- public schema 不再把 `formalism` 设为 mandatory gate
- generic core 不再依赖默认 formalism 才能创建 seed / search / handoff
- built-in shipped pack authority 中不再携带 concrete formalism instance catalog
- 如果当前 workflow 仍需要方法提示，只能是 optional、non-authoritative、run-local metadata
- downstream `create-from-idea` 这类 consumer 继续围绕 thesis/claims/hypotheses 工作，不因为 formalism 降级而退化

## 4. 变更清单

1. 重新定义 `IdeaCard` / handoff 的最小必需信息
2. 将 `candidate_formalisms[]` 从 mandatory core field 降级或移除
3. 将 `formalism_registry_v1` / `formalism_check` 从 public mainline contract 中降级或移除
4. 去掉 `campaign.init` / `search.step` 对 default formalism 的依赖
5. 去掉 shipped concrete formalism ids 作为 built-in authority
6. 调整 graph-viz / docs，避免把 formalism 当一等公共节点类型默认升格
7. 保留 stable `domain_pack_id` 作为引用键，但不让其承载具体实例世界观

## 5. 明确禁止

- 不要把 `formalism` 简单改名成 `framework` / `approach` / `method_family` 然后继续保持 mandatory gate
- 不要把 concrete HEP names 换成 generic placeholder ids 继续写进 core/public schemas
- 不要新建 root-level canonical formalism registry
- 不要为了这批顺手实现完整 execution-planning stack
- 不要用“占位符实例”来维持 shipped worldview

## 6. 设计约束

- `question / claim / hypothesis / observables / evidence needs` 才是 core
- 方法信息若保留，必须满足：
  - optional
  - non-gating
  - user/project/run-local
  - 可以 absent

- provider/domain pack 若仍保留局部模板，必须满足：
  - provider-local
  - non-authoritative
  - 不自动进入 generic default path

## 7. 验收命令

建议先跑 targeted，再跑全量：

- `PYTHONPYCACHEPREFIX=/tmp/pycache python3 -m pytest packages/idea-core/tests/engine -q`
- `PYTHONPYCACHEPREFIX=/tmp/pycache make -C packages/idea-core test`
- `pnpm --filter @autoresearch/shared test`
- `pnpm --filter @autoresearch/shared build`
- 若修改了 schema snapshot / generated contract：
  - 运行对应 snapshot / bundle regeneration
  - 验证变更后的 generated artifacts 与 schema 同步
- `git diff --check`

## 8. 完成定义

- `IdeaCard` / handoff 的主线不再依赖 formalism registry membership
- 代码里不存在“默认取第一 formalism 作为 seed/search authority”的路径
- shipped HEP built-ins 不再带 concrete formalism instances
- graph / docs / tool ecology 不再把 formalism 当默认一等 authority
- `batch2` 可以在新边界上重新 closeout，`batch3` 再继续

## 9. 收尾要求

- `review-swarm` 必须重点检查：是否真的消除了 repo-level worldview leakage，而不是只改了字段名
- `self-review` 必须明确回答：
  - 现在哪些内容是 core mandatory
  - 哪些内容降级为 optional run-local metadata
  - 哪些 concrete names 被移出了 shipped tool ecology

## 10. SSOT 同步要求

- `meta/remediation_tracker_v1.json`：将 `NEW-05a-idea-core-domain-boundary` 与本 follow-up 的关系写清楚；若本 prompt 对应的新 standalone 条目已存在，按实际 closeout 更新
- `AGENTS.md`：同步 “batch2 暂停 closeout，formalism contract follow-up 先行” 的状态
- `meta/REDESIGN_PLAN.md`：仅当本批实质改变 `NEW-05a Stage 3` 或 `EVO-01` 的长期边界表述时再同步；不要写流水账
- `.serena/memories/architecture-decisions.md`：若本批最终落实了 “formalism 非 core mandatory contract” 这一不变量，则同步沉淀
