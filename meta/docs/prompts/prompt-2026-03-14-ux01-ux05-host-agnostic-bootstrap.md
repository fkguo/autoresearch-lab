# Prompt: 2026-03-14 Standalone — `UX-01` + `UX-05`：统一新建项目规则，直接正名脚手架命名

> 默认继承 `meta/docs/prompts/IMPLEMENTATION_PROMPT_CHECKLIST.md`。
>
> 本文件对应一个单独的新实现对话。
>
> 本文件里不再使用“project bootstrap semantics”这类术语。这里说的就是一件事：
>
> “从空目录开始新建研究项目时，到底应该生成什么、每个文件各干什么、哪些先建、哪些以后再建，这套唯一规则。”
>
> 下面统一把它叫作：`新建项目规则`。
>
> `hepar init`、`research-team scaffold`、未来的 TS 命令行入口、以及任何宿主入口，都只能调用同一套`新建项目规则`；它们不是规则本身。

## 0. 本批要解决什么

当前主干已经把单用户研究闭环的大骨架打通了：

- `NEW-LOOP-01` 已完成
- `EVO-01` 已完成
- `EVO-02` 已完成
- `EVO-03` 已完成

所以现在最卡“单用户能不能真的顺手用起来”的，不是再造一层运行时，而是项目入口层还很乱：

1. `hepar init` 和 `research-team scaffold` 各有一套新建项目逻辑。
2. `Draft_Derivation.md` 这个名字既误导人，也误导代码：
   - `Draft` 像人类草稿
   - `Derivation` 又太窄，不只覆盖机器合同
3. 脚手架里还有一批类似问题的名字，继续留着只会让后面的重构越来越难。

因为本仓已经明确：

- 没有外部用户
- 不需要向后兼容
- 当前就是重构期

所以这一批默认策略不是“保留旧名再慢慢迁”，而是：

- 先在脚手架面做一次有边界的命名深扫
- 对明显不合适的名字直接正名
- 不为旧名字保留兼容别名、镜像文件或过渡层

## 1. 为什么这批现在做

这批是当前最值得做的下一步，因为它直接决定以后每一批开发是在干净地基上继续，还是继续背着错误命名和双套入口往前走。

如果现在不改：

- `hepar init` 会继续被误当成“真正入口”
- `Draft_Derivation.md` 会继续把“人看的笔记”和“机器读的合同”混在一起
- 后续 `NEW-05a-stage3`、更晚的统一控制面、甚至未来 leaf product，都会被旧命名污染

所以这批不是“又做一层抽象”。
这批是在清掉后面所有实现都会反复踩到的入口层错误。

## 2. 这批的硬边界

### 2.1 本批允许做的事

本批只允许做以下工作：

1. 定义唯一的`新建项目规则`。
2. 让 `hepar init` 和 `research-team scaffold` 都只调用这套规则，而不是各自维护一套脚手架。
3. 直接正名“人看的文件”和“机器读的文件”：
   - 人类主入口：`research_notebook.md`
   - 机器主合同：`research_contract.md`
4. 在脚手架这一层直接删除错误命名，不保留旧名兼容别名。
5. 默认只创建最小项目骨架，把 `prompts/`、`computation/`、额外工作流目录改成按需创建。
6. 更新当前对用户可见的文档、模板、脚本和冒烟测试，使它们都跟新名字和新规则一致。
7. 对脚手架命名做一次有边界的深扫，并在本批内直接处理明显不合适的名字。

### 2.2 本批明确禁止

本批明确禁止：

- 打包成终端用户产品的 agent
- 仓库根目录总代理
- 仓库根目录总 MCP
- 动态注册 / 动态生成平台
- `NEW-07`
- `EVO-13`
- `EVO-14`
- 全仓无边界大扫除
- 因为改名而顺手重做写作运行时、审稿运行时、team 运行时
- 继续保留 `Draft_Derivation.md` 这类旧名字作为“短期兼容”

### 2.3 本批完成态至少要满足

1. 新建项目时只认一套规则，不再有两套脚手架权威来源。
2. `hepar init` 和 `research-team scaffold` 生成出来的核心项目结构一致。
3. 人类入口明确是 `research_notebook.md`。
4. 机器入口明确是 `research_contract.md`。
5. 脚手架面不再出现 `Draft_Derivation.md` 这种旧名字。
6. 默认最小骨架收紧成功，按需目录真正改成“用到时再创建”。

## 3. 命名规则：按角色命名，不按历史命名

这批一律按第一性原理命名。

一个名字至少要让人一眼知道三件事：

1. 这是给谁用的
2. 它在项目里扮演什么角色
3. 它覆盖的内容边界是什么

如果一个名字做不到这三点，就直接改。

### 3.1 本批必须直接正名的名字

以下名字本批直接改，不留兼容别名：

- `Draft_Derivation.md` -> `research_contract.md`
- `PROJECT_CHARTER.md` -> `project_charter.md`
- `RESEARCH_PLAN.md` -> `research_plan.md`
- `PROJECT_MAP.md` -> `project_index.md`
- `PREWORK.md` -> `research_preflight.md`
- `INITIAL_INSTRUCTION.md` -> `project_brief.md`
- `INNOVATION_LOG.md` -> `idea_log.md`

理由：

- `Draft_Derivation` 同时在“对象”“角色”“范围”上都误导
- 全大写文件名没有必要，且会继续把历史模板味道带进长期结构
- `PREWORK`、`INITIAL_INSTRUCTION`、`INNOVATION_LOG` 都是历史过程名，不是稳定角色名
- `PROJECT_MAP` 太泛，不如 `project_index` 直接表达“导航索引”

### 3.2 本批必须深扫并做决定的名字

以下名字本批必须做一次有边界的深扫，并在收尾记录里给出明确结论：

- `knowledge_base/`
- `prompts/`
- `team/`
- `research_team_config.json`
- `references/`
- `.hep/` 下与项目根目录直接耦合的名字

要求：

1. 逐项判断这些名字是不是通用项目根目录应该直接暴露给用户的概念。
2. 如果名字明显错误、过窄、带宿主入口泄漏、或只是历史过程名，就直接改名。
3. 如果暂时不改，必须给出一句明确理由，不能因为“先这样也能跑”就跳过。

注意：

- 这不是让你全仓扫一遍命名。
- 只扫“新建项目脚手架直接创建出来的东西”和“脚手架文档直接要求用户接触的东西”。
- 这次审计默认包含 `project_scaffold.py`、`scaffold_research_workflow.sh` 和直接产出模板文件里的硬编码名字。

## 4. `hepar init` 和 `research-team scaffold` 的正确角色

这两个入口都只是“调用新建项目规则的方式”。

它们不是：

- 真正规则
- 产品名
- 长期唯一入口

因此本批必须做到：

1. 规则先被定义，再让两个入口去调用。
2. 两个入口不能各有一套默认文件名和目录名。
3. 入口自身可以保留很薄的差异：
   - 参数名
   - 输出提示
   - 入口自己的可选开关
4. 入口不得继续决定通用项目根目录长什么样。

## 5. 人类文件和机器文件怎么分

本批必须把“人类阅读/编辑”和“机器读取/校验”彻底拆开。

### 5.1 人类文件

人类主入口固定为：

- `research_notebook.md`

它负责：

- 推导说明
- 结果解释
- 图表
- 外链
- 人类可读的研究过程

### 5.2 机器文件

机器主合同固定为：

- `research_contract.md`

它负责：

- 机器检查门
- 可审计结构
- 标题摘要 / 指针 / 可复现约束
- 其他必须给脚本稳定读取的内容

### 5.3 本批硬要求

1. 不再让人手写机器结构。
2. `research_contract.md` 必须由确定性生成/刷新逻辑产出。
3. 机器检查器、revision、context pack、research-team 相关检查门必须改成消费 `research_contract.md`，而不是旧名。
4. 不能把 `research_notebook.md` 重新塞成新的机器胶囊文件。

## 6. 现在必须处理的漂移

实施时至少要处理这些已知漂移：

1. `packages/hep-autoresearch/src/hep_autoresearch/toolkit/project_scaffold.py`
   - 直接写旧名字
   - 直接把旧名字讲成 notebook
2. `skills/research-team/scripts/bin/scaffold_research_workflow.sh`
   - 直接复制旧模板
   - 直接创建一堆带历史味道的名字
3. `skills/research-team/assets/`
   - 模板文件仍可能把旧名字继续注入新项目
4. `skills/research-team/SKILL.md`
5. `skills/research-team/README.md`
6. `packages/hep-autoresearch/README.md`
7. `packages/hep-autoresearch/docs/BEGINNER_TUTORIAL.md`
8. 相关冒烟测试 / 检查脚本 / 辅助脚本
   - 只要它们还在要求用户面向旧名字操作，就都属于本批范围

## 7. 开工前必须读取

至少完整读取：

1. `AGENTS.md`
2. `meta/remediation_tracker_v1.json`
3. `meta/REDESIGN_PLAN.md`
4. `meta/docs/prompts/IMPLEMENTATION_PROMPT_CHECKLIST.md`
5. 本文件
6. `meta/docs/2026-03-09-root-ecosystem-boundary-adr.md`
7. `meta/docs/user-stories-ux-gaps.md`
8. `README.md`
9. `meta/protocols/session_protocol_v1.md`
10. `packages/hep-autoresearch/src/hep_autoresearch/toolkit/project_scaffold.py`
11. `packages/hep-autoresearch/src/hep_autoresearch/toolkit/context_pack.py`
12. `packages/hep-autoresearch/src/hep_autoresearch/toolkit/revision.py`
13. `packages/hep-autoresearch/src/hep_autoresearch/orchestrator_cli.py`
14. `packages/hep-autoresearch/README.md`
15. `packages/hep-autoresearch/docs/BEGINNER_TUTORIAL.md`
16. `skills/hepar/SKILL.md`
17. `skills/research-team/SKILL.md`
18. `skills/research-team/README.md`
19. `skills/research-team/scripts/bin/scaffold_research_workflow.sh`
20. `skills/research-team/assets/derivation_notes_template.md`
21. `skills/research-team/assets/research_plan_template.md`
22. `skills/research-team/assets/project_map_template.md`
23. `skills/research-team/assets/PREWORK_template.md`
24. `skills/research-team/assets/INITIAL_INSTRUCTION_template.md`
25. `skills/research-team/assets/innovation_log_template.md`
26. `skills/research-team/assets/PROJECT_CHARTER_template.md`
27. `skills/research-team/scripts/dev/check_scaffold_output_contract.sh`
28. `skills/research-team/scripts/dev/smoke/smoke_test_scaffold_output_contract.sh`
29. `skills/research-team/scripts/dev/smoke/smoke_test_scaffold_minimal.sh`
30. `skills/research-team/scripts/dev/smoke/smoke_test_prune_optional_scaffold.sh`
31. `skills/research-team/scripts/dev/smoke/smoke_test_notebook_integrity_gate.sh`
32. `skills/research-team/scripts/gates/check_notebook_integrity.py`
33. `skills/research-writer/SKILL.md`

## 8. GitNexus Hard Gate

### 8.1 实施前

1. 读取 `gitnexus://repo/autoresearch-lab/context`
2. 若 index stale，运行 `npx gitnexus analyze`
3. analyze 后重新读取 context
4. 至少对齐以下符号/文件/流：
   - `ensure_project_scaffold`
   - `build_context_pack`
   - `revision.py` 中 notebook / contract 的消费路径
   - `scaffold_research_workflow.sh`
   - `check_notebook_integrity.py`

### 8.2 审核前

若新增/重命名符号、改变关键调用链、或当前 index 已不反映工作树：

1. 再跑 `npx gitnexus analyze --force`
2. 跑 `detect_changes`
3. 必要时补 `impact` / `context`

若 GitNexus 对 shell 脚本、模板、或新 helper 仍覆盖不完整：

- 必须明说
- 改用直接读源码 + 定点测试 / 冒烟测试作为精确核验

## 9. 实现要求

### 9.1 直接改名，不留旧名

因为当前明确没有向后兼容负担，本批默认规则是：

- 直接改旧名字
- 直接改消费者
- 直接改文档
- 不生成旧名镜像
- 不保留过渡别名

只有当实现者能给出明确证据，说明“直接改会显著提高本批失败风险，且这种风险大于继续保留旧名的长期成本”，才允许例外。

默认不允许这种例外。

### 9.2 最小新建项目结构

本批要产出的默认最小项目结构，应围绕“人类入口 + 机器入口 + 最小规则文档”来设计。

至少应包含：

- `research_notebook.md`
- `research_contract.md`
- `project_charter.md`
- `project_index.md`
- `research_plan.md`
- `.mcp.json` 或等价的本地 MCP 配置入口

其他目录如：

- `prompts/`
- `computation/`
- 部分入口自身配置

都应优先改成按需生成，而不是默认铺满。

### 9.3 对脚手架面做一次命名审计

本批必须新增一个明确的“脚手架命名审计”子步骤。

至少输出：

1. 哪些名字直接改了
2. 改成了什么
3. 为什么新名字更贴合角色
4. 哪些名字扫描后决定暂不改，以及为什么

这个审计只覆盖脚手架面，不做全仓无限扩张。

## 10. 验收与测试

如果缺少直测，必须先补测试，再继续。

本批最少验收命令必须包括：

```bash
PYTHONPYCACHEPREFIX=/tmp/pycache python3 -m pytest packages/hep-autoresearch/tests -q
PYTHONPYCACHEPREFIX=/tmp/pycache python3 -m pytest skills/research-team/tests -q
bash skills/research-team/scripts/dev/smoke/smoke_test_scaffold_output_contract.sh
bash skills/research-team/scripts/dev/smoke/smoke_test_scaffold_minimal.sh
bash skills/research-team/scripts/dev/smoke/smoke_test_prune_optional_scaffold.sh
bash skills/research-team/scripts/dev/smoke/smoke_test_notebook_integrity_gate.sh
git diff --check
```

此外，必须新增并运行至少这些直测：

```bash
PYTHONPYCACHEPREFIX=/tmp/pycache python3 -m pytest packages/hep-autoresearch/tests/test_scaffold_naming_contract.py -q
PYTHONPYCACHEPREFIX=/tmp/pycache python3 -m pytest packages/hep-autoresearch/tests/test_notebook_contract_split.py -q
bash skills/research-team/scripts/dev/smoke/smoke_test_notebook_contract_roundtrip.sh
```

还必须加一类负向检查：

- 脚手架面不应再创建或要求旧名字

例如：

```bash
rg -n 'Draft_Derivation|PROJECT_MAP|PREWORK|INITIAL_INSTRUCTION|INNOVATION_LOG' \
  packages/hep-autoresearch/src/hep_autoresearch/toolkit \
  skills/research-team/scripts/bin \
  skills/research-team/assets \
  skills/research-team/README.md \
  skills/research-team/SKILL.md \
  packages/hep-autoresearch/README.md \
  packages/hep-autoresearch/docs/BEGINNER_TUTORIAL.md && exit 1 || true
```

## 11. 正式三审与自审

本批收尾必须做正式 `review-swarm`，固定 reviewer：

- `Opus`
- `Gemini-3.1-Pro-Preview`
- `OpenCode(kimi-for-coding/k2p5)`

审查重点：

1. 是否真的统一了`新建项目规则`
2. 是否真的去掉了双套脚手架权威来源
3. 是否真的把 `Draft_Derivation.md` 之类旧名直接清掉，而不是换个地方继续留
4. 是否真的有边界地做了脚手架命名深扫，而不是无边界扩张
5. 是否守住了根目录边界，没有借机启动打包产品 agent / `NEW-07` / `EVO-13`

外部三审收敛后，当前执行 agent 仍必须做正式 self-review。

## 12. 完成后必须同步

完成态至少同步：

- `meta/remediation_tracker_v1.json`
- `AGENTS.md` 当前进度摘要
- `meta/REDESIGN_PLAN.md`

原因：

- 本批不只是实现细节变化
- 它还改变了 `UX-01` / `UX-05` 对文件命名和新建项目结构的长期叙事

若本批没有新增比当前 ADR 更高层级的长期架构不变量，则：

- 不更新 `AGENTS.md` 的治理规则正文
- 但应把稳定命名决策写入 `.serena/memories/architecture-decisions.md`

## 13. 本批之后的推荐顺序

这批之后，推荐顺序仍然是：

1. 继续 `NEW-05a-stage3` 的下一刀，但仍保持有边界
2. 再看 `rank.compute` / `node.promote`
3. 更晚再看 `NEW-07`
4. 最后才是 `EVO-13`

理由不变：

- 先把入口层和命名层清干净
- 再继续控制面和运行时
- 不要把错误名字和错误入口一并固化进更深层结构
