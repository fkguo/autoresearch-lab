# Prompt: 2026-03-16 NEW-05a idea-core domain-boundary repair

> 默认继承 `meta/docs/prompts/IMPLEMENTATION_PROMPT_CHECKLIST.md`
>
> 当前工作目录应为：
> `/Users/fkg/Coding/Agents/autoresearch-lab-new05a-idea-core-domain-boundary-repair`
>
> 这是一个**新的 implementation batch**。不要沿用旧 closeout 叙事；必须以 live code、exact tests、以及 2026-03-16 formal rereview 结论为权威输入。

## 0. 背景与目标

`NEW-05a-idea-core-domain-boundary` 在 `main` 上经过 enhanced rereview + formal three-model rereview 后，已收敛为 `NOT_CONVERGED`，因此当前 checked-in `done` 结论不成立。

本批目标：

1. 修复 `idea-core` generic/default path 上仍然存活的 active HEP authority
2. 补齐能真正守住该边界的 tests
3. 在实现收敛后，再决定如何回写 tracker / `AGENTS.md`

本批不是“写一段解释”，而是**真正修代码并收口 formal review blocker**。

## 1. 开工前必读

### 1.1 仓库内 SSOT / 约束

1. `AGENTS.md`
2. `packages/idea-core/AGENTS.md`
3. `meta/remediation_tracker_v1.json`
4. `meta/REDESIGN_PLAN.md`
5. `meta/ECOSYSTEM_DEV_CONTRACT.md`
6. `meta/docs/prompts/IMPLEMENTATION_PROMPT_CHECKLIST.md`
7. `meta/docs/prompts/prompt-2026-03-09-batch2-idea-core-domain-boundary.md`
8. `meta/docs/prompts/prompt-2026-03-10-hep-semantic-deep-cleanup.md`

### 1.2 本轮 rereview 产物（绝对路径；位于主 worktree）

必须阅读：

1. `/Users/fkg/Coding/Agents/autoresearch-lab/.review/2026-03-16-new05a-idea-core-domain-boundary-rereview/formal_review_closeout.md`
2. `/Users/fkg/Coding/Agents/autoresearch-lab/.review/2026-03-16-new05a-idea-core-domain-boundary-rereview/self_review.md`
3. `/Users/fkg/Coding/Agents/autoresearch-lab/.review/2026-03-16-new05a-idea-core-domain-boundary-rereview/review_packet.md`
4. `/Users/fkg/Coding/Agents/autoresearch-lab/.review/2026-03-16-new05a-idea-core-domain-boundary-rereview/review_packet_r2.md`
5. `/Users/fkg/Coding/Agents/autoresearch-lab/.review/2026-03-16-new05a-idea-core-domain-boundary-rereview/swarm-r2/opus_review.json`
6. `/Users/fkg/Coding/Agents/autoresearch-lab/.review/2026-03-16-new05a-idea-core-domain-boundary-rereview/swarm-r2/k2p5_review.json`
7. `/Users/fkg/Coding/Agents/autoresearch-lab/.review/2026-03-16-new05a-idea-core-domain-boundary-rereview/swarm-r2-gemini-flat/gemini_review.json`

注意：

- `swarm-r2/` aggregate run 的 Gemini output 缺失是 harness-level failure，不是 reviewer 缺席。
- Gemini 的有效 R2 结论来自 `swarm-r2-gemini-flat/gemini_review.json`。

### 1.3 必读代码与 tests

代码：

1. `packages/idea-core/src/idea_core/engine/coordinator.py`
2. `packages/idea-core/src/idea_core/engine/domain_pack.py`
3. `packages/idea-core/src/idea_core/engine/hep_domain_pack.py`
4. `packages/idea-core/src/idea_core/engine/operators.py`
5. `packages/idea-core/src/idea_core/engine/retrieval.py`
6. `packages/idea-core/src/idea_core/engine/hep_constraint_policy.py`
7. `packages/idea-core/src/idea_core/engine/hep_builtin_domain_packs.json`
8. `packages/idea-core/src/idea_core/rpc/server.py`
9. `packages/idea-core/src/idea_core/engine/schemas/librarian_evidence_packet_v1.schema.json`

Tests：

1. `packages/idea-core/tests/engine/test_domain_pack_m30.py`
2. `packages/idea-core/tests/engine/test_search_step_operator_families_m32.py`
3. `packages/idea-core/tests/engine/test_retrieval_recipes_m33.py`
4. `packages/idea-core/tests/engine/test_novelty_delta_m34.py`
5. `packages/idea-core/tests/engine/test_hep_constraints_m35.py`
6. `packages/idea-core/tests/engine/test_compute_plan_rubric_m36.py`
7. 相邻 default-service callers / engine tests（必要时）

## 2. 已收敛 blocking findings

本批必须修复以下三类 blocker；它们已经由 formal review 收敛，不再是可选解释项。

### 2.1 Default runtime 仍以 HEP 为 generic/default authority

- `IdeaCoreService.__init__` 在未注入 `domain_pack_index` 时回退到 `build_builtin_domain_pack_index()`
- `build_builtin_domain_pack_index()` 当前只加载 HEP built-ins
- `default_service()` 与 `rpc/server.py:main()` 都直接走这条默认路径

这意味着 HEP 仍是 generic/default runtime worldview。

### 2.2 Generic `DomainPackAssets` 默认 retrieval 仍然是 HEP

- `DomainPackAssets.librarian_recipes` 仍默认指向 `build_default_librarian_recipe_book()`
- 该 recipe book 在 generic `retrieval.py` 中硬编码：
  - `INSPIRE`
  - `PDG`
  - `inspire.generic.hep.v1`
  - `pdg.generic.hep.v1`
  - `primarch:{domain}` 等 HEP-shaped query

formal rereview 的 live reproduction 已证明：

- 自定义非 HEP `math.alpha` pack 若未显式覆盖 `librarian_recipes`
- `search.step` 仍会生成 HEP recipes/providers

这不是 inert residue，而是 active authority leakage。

### 2.3 当前 tests 掩盖边界问题

- `m32/m33/m35/m36` 直接实例化默认 `IdeaCoreService`
- `m33` 把 `INSPIRE/PDG` 当作 canonical provider
- `m33` 对非 HEP provider 的“支持”只是 post-hoc mutate packet
- `m30` 注入了 custom pack index，但没有检查 evidence packet，从而漏掉默认 HEP retrieval fallback

## 3. 本批必须达成的目标状态

### 3.1 Generic/default path 不再默认带 HEP worldview

允许的修法：

- `IdeaCoreService` 强制要求显式注入 `domain_pack_index`
- 或默认使用 truly neutral / fail-closed index

不允许的修法：

- 继续把 HEP 作为 generic default，只是换个名字
- 用另一个 placeholder built-in worldview 替代 HEP

### 3.2 Generic `DomainPackAssets` 不再默认携带 HEP retrieval authority

允许的修法：

- `librarian_recipes` 改为必填显式注入
- 或 default 改成 neutral / fail-closed implementation
- HEP recipe book 仅能在 `hep_domain_pack.py` 中显式注入

不允许的修法：

- 把当前 HEP recipe book 仅改名为 `default` / `generic`
- 在 generic 层保留 `INSPIRE/PDG` default，只靠 docs 声明“其实是 provider-local”

### 3.3 Tests 必须真正守住边界

至少要新增/调整到能证明：

1. non-HEP pack 不会在 runtime 上隐式继承 HEP retrieval
2. HEP behavior 只在 explicit HEP pack/index 注入时出现
3. 默认 path 若仍存在，则必须是 neutral / fail-closed，不得 silently HEP

### 3.4 Novelty delta 争议必须被解决，而不是略过

formal reviewers 对 novelty path 的严重程度并非完全一致：

- `Opus` 认为它是 non-blocking domain-shaped heuristic
- `Gemini` / `Kimi` 把它也视作 blocker

本批不能靠“忽略分歧”来 closeout。你必须在实现中二选一：

1. 把 domain-shaped novelty heuristic / wording（含固定 `observable-1` 叙事）下沉到 domain-pack seam；或
2. 给出 reviewer-grade exact evidence，证明保留在 generic coordinator 中的部分确属 provider-neutral stable invariant，并以 tests / packet 明确锁定

如果做不到其一，就不要重新 close 该条目。

## 4. 建议实现方向

这是建议方向，不是唯一代码结构，但必须满足上面的目标状态。

### 4.1 Default assembly

优先考虑：

- `IdeaCoreService.__init__` 不再自行决定 built-in provider
- 将 built-in HEP index 的装配下沉到更外层的 explicit host/bootstrap path
- `default_service()` / `rpc/server.py` 若仍需 current local behavior，必须显式声明其 provider choice，而不是借 generic constructor fallback 偷渡

### 4.2 Retrieval seam

优先考虑：

- `DomainPackAssets` 将 `librarian_recipes` 变为显式 seam
- 当前 HEP recipe book 迁到 `hep_domain_pack.py` 明确注入
- generic 层最多保留空对象 / fail-closed object / typed protocol，不保留 HEP providers/queries

### 4.3 Tests

至少补一类真实 runtime test：

- 自定义 non-HEP pack
- 运行 `campaign.init` + `search.step`
- 直接检查生成的 evidence packet
- 断言没有 `INSPIRE` / `PDG` / `inspire.generic.hep.v1` / `pdg.generic.hep.v1`

同时保留一类 HEP explicit path test：

- 当 pack/index 明确为 HEP 时
- HEP operator/retrieval/constraint behavior 仍工作

## 5. 明确禁止

- 不要只改 closeout 叙事而不改代码
- 不要只补 grep 或 post-hoc packet mutation test 来“证明” non-HEP support
- 不要把 HEP default 改称 generic/default/provider-neutral 后继续保留
- 不要顺手扩到 TS `idea-engine` / `NEW-05a-stage3` 更广 scope
- 不要顺手启动 `batch3` runtime/root de-HEP
- 不要只因为 `22 passed` 就重新标 done

## 6. GitNexus 硬要求

实施前：

1. 读取 `gitnexus://repo/autoresearch-lab/context`
2. 若 stale，运行 `npx gitnexus analyze`
3. 若当前 worktree 进入 dirty 状态并新增文件/新符号，正式审核前使用 `npx gitnexus analyze --force`
4. 至少检查：
   - `IdeaCoreService`
   - `build_builtin_domain_pack_index`
   - `build_default_librarian_recipe_book`
   - `default_service`
   - `rpc/server.py:main`

若 GitNexus follow-up 再次失败或输出不一致，必须明确记录失败，并回退到 direct source inspection + exact tests。禁止静默跳过。

## 7. 验收命令

### 7.1 必跑 targeted

- `PYTHONPYCACHEPREFIX=/tmp/pycache python3 -m pytest packages/idea-core/tests/engine/test_domain_pack_m30.py -q`
- `PYTHONPYCACHEPREFIX=/tmp/pycache python3 -m pytest packages/idea-core/tests/engine/test_search_step_operator_families_m32.py -q`
- `PYTHONPYCACHEPREFIX=/tmp/pycache python3 -m pytest packages/idea-core/tests/engine/test_retrieval_recipes_m33.py -q`
- `PYTHONPYCACHEPREFIX=/tmp/pycache python3 -m pytest packages/idea-core/tests/engine/test_novelty_delta_m34.py -q`
- `PYTHONPYCACHEPREFIX=/tmp/pycache python3 -m pytest packages/idea-core/tests/engine/test_hep_constraints_m35.py -q`
- `PYTHONPYCACHEPREFIX=/tmp/pycache python3 -m pytest packages/idea-core/tests/engine/test_compute_plan_rubric_m36.py -q`

### 7.2 必跑 package-level

- `PYTHONPYCACHEPREFIX=/tmp/pycache make -C packages/idea-core validate`
- `PYTHONPYCACHEPREFIX=/tmp/pycache make -C packages/idea-core test`
- `git diff --check`

### 7.3 建议的 exact negative checks

按你的最终实现可调整，但必须保留“exact verification”精神；例如：

- 确认 generic/default path 不再隐式装配 HEP built-ins
- 确认 generic retrieval default 不再内置 `INSPIRE` / `PDG` / `inspire.generic.hep.v1` / `pdg.generic.hep.v1`
- 确认 non-HEP runtime test 直接检查 packet，而不是 mutate packet

## 8. Formal review / self-review 硬要求

本批修复完成后，必须重新做正式三模型 review：

- `Opus`
- `Gemini-3.1-Pro-Preview`
- `OpenCode(kimi-for-coding/k2p5)`

review packet 必须包含：

1. 本轮 formal rereview 的完整结论与关键 blocker
2. adopted fix list
3. exact tests 结果
4. GitNexus evidence 或 failure note
5. 对 novelty delta 争议的明确处置
6. reviewer 必答：
   - 当前 live code 是否仍有 active generic/default HEP authority
   - `done` 是否可恢复

任何 reviewer 仍给 blocking issue，都不得重新 close。

## 9. SSOT 更新规则

在代码 + 验收 + formal review + self-review 全部通过前：

- 不要先把 tracker / `AGENTS.md` 改回 done

收敛后必须同步：

1. `meta/remediation_tracker_v1.json`
2. `AGENTS.md`
3. 如有必要，`meta/REDESIGN_PLAN.md`

若本批只是修正 reality mismatch、没有新增稳定架构不变量，可不更新 `.serena/memories/architecture-decisions.md`，但必须在 closeout 里明确写出原因。

## 10. 完成定义

只有同时满足以下条件，`NEW-05a-idea-core-domain-boundary` 才可重新 close：

1. generic/default runtime 不再隐式以 HEP 为 worldview
2. generic `DomainPackAssets` 不再默认携带 HEP retrieval authority
3. tests 直接守住 non-HEP boundary，而不是通过 mutate/未检查路径掩盖问题
4. novelty delta 争议已被代码 + tests + review packet 解决
5. acceptance commands 全绿
6. formal review 三审 `0 blocking`
7. self-review `0 blocking`

## 11. 新对话启动建议

建议在新对话里直接贴下面这句作为启动指令：

> 请在 `/Users/fkg/Coding/Agents/autoresearch-lab-new05a-idea-core-domain-boundary-repair` 中按 `meta/docs/prompts/prompt-2026-03-16-new05a-idea-core-domain-boundary-repair.md` 实施修复。先读 prompt 与其中列出的 formal rereview artifacts，再做 GitNexus freshness check、计划、实现、验收、formal review 和 self-review。不要依赖旧 closeout 叙事。
