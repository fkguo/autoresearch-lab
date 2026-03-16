# Prompt: 2026-03-16 Standalone — `NEW-05a-stage3` Authority-Seam Bounded Repair

> 默认继承 `meta/docs/prompts/IMPLEMENTATION_PROMPT_CHECKLIST.md`。
>
> 本 prompt 对应新的实现对话，工作目录固定为：
> `/Users/fkg/Coding/Agents/autoresearch-lab-new05a-stage3-authority-repair`

## 0. Goal

重开 `NEW-05a-stage3`，只做一个严格受限的 authority-seam bounded repair：

- 修掉 generic `idea-engine` live path 上的 HEP runtime / retrieval authority 泄漏
- 保留当前 `search.step` 的 bounded behavior parity
- 不重开 broader Stage 3 migration
- 不借机推进 `eval.run` / `rank.compute` / `node.promote`

本批的成功标准不是“去掉几个 `hep` 字符串”，而是：

1. generic/service 层只保留 provider-neutral seam 与 typed contract；
2. 当前 HEP slice 仍可通过 provider-local module / registry 被加载；
3. `librarian_evidence_packet_v1` 不再把 `INSPIRE` / `PDG` 写成 core contract 闭合 authority；
4. tests 不再把“generic `idea-engine` 内联 HEP authority”当成 canonical truth。

## 1. Why This Batch Exists

`2026-03-16` enhanced rereview 对既有 `NEW-05a-stage3` closeout 给出 `NOT_CONVERGED`。

必须先读取并吸收以下结论，再开工：

- `/Users/fkg/Coding/Agents/autoresearch-lab-new05a-stage3-rereview/.review/2026-03-16-new05a-stage3-rereview/review_packet.md`
- `/Users/fkg/Coding/Agents/autoresearch-lab-new05a-stage3-rereview/.review/2026-03-16-new05a-stage3-rereview/swarm-r1/opus.json`
- `/Users/fkg/Coding/Agents/autoresearch-lab-new05a-stage3-rereview/.review/2026-03-16-new05a-stage3-rereview/swarm-r1/gemini.json`

这些 blocker 的最小公共面是：

1. `packages/idea-engine/src/service/search-operator.ts` 内联 HEP operator authority。
2. `packages/idea-engine/src/service/librarian-recipes.ts` 内联 INSPIRE/PDG retrieval authority。
3. `packages/idea-engine/src/service/domain-pack.ts` 直接指向 Python-side HEP catalog。
4. `packages/idea-core/src/idea_core/engine/schemas/librarian_evidence_packet_v1.schema.json` 仍以 `enum: ["INSPIRE", "PDG"]` 充当 generic contract authority。
5. `packages/idea-engine/tests/fixtures/search-step-rpc-golden.json` 与 parity test 目前只证明“HEP-contaminated implementation 与 HEP-contaminated fixture 一致”，没有锁住 generic/provider-local seam。

## 2. Packet Assumptions You Must Recheck

以下前提一律视为待验证，不得直接沿用旧 closeout 叙事：

1. “当前 authority slice 可以暂时住在 generic `idea-engine` 里，只要 scope 够小。”
2. “只要 parity tests 绿了，就说明 authority placement 合理。”
3. “`search.step` 仍然只是在做 bounded `search.step` follow-up，所以不需要 reopen `NEW-05a-stage3`。”

本批必须显式复核：

- `authority map -> concrete runtime/schema/fixture/test`
- `concrete runtime/schema/fixture/test -> authority map`
- generic/service 层是否还残留 inline duplicate authority
- shared entrypoint `campaign.init` + `search.step` acceptance 是否继续通过

## 3. Hard Scope Boundary

### 3.1 In scope

只允许做以下工作：

1. 在 `packages/idea-engine/` 内建立最小 provider-neutral seam，把 HEP-specific operator/runtime/recipe authority 从 generic service 文件中抽离。
2. 用最小 registry / descriptor / loader pattern 替换 `domain-pack.ts` 中对 `hep_builtin_domain_packs.json` 的直接硬编码耦合。
3. 让 `search-step-service.ts` 通过 loaded domain-pack runtime / recipe book 消费当前 HEP slice，而不是直接调用内联 HEP authority。
4. 打开 `packages/idea-core/src/idea_core/engine/schemas/librarian_evidence_packet_v1.schema.json` 的 `provider` / `api_source`。
5. 重新校正 `packages/idea-engine/tests/search-step-parity.test.ts` 与相关 fixture/test 叙事，使其明确验证 provider-local HEP slice through seam，而不是 generic core inline HEP truth。
6. 仅在为本批 acceptance 必需时，更新 Python-side tests 或 fixture generator。
7. 同步 `meta/remediation_tracker_v1.json` 与 `AGENTS.md`，把 `NEW-05a-stage3` 从旧 closeout 叙事重开为当前批次的 `in_progress` / repaired closeout 叙事。

### 3.2 Explicitly out of scope

本批明确禁止：

- `eval.run`
- `rank.compute`
- `node.promote`
- broader Stage 3 migration
- generic domain-pack platform redesign beyond the minimum seam required here
- new provider packs or non-HEP runtime features
- `NEW-07`
- `EVO-13`
- runtime/root de-HEP follow-up
- any rewrite of Python `idea-core` behavior except tightly scoped test/schema alignment

### 3.3 Completion lock

只有同时满足以下条件，本批才算完成：

1. generic service files 不再拥有 active HEP operator/retrieval/catalog authority；
2. 当前 HEP `search.step` slice 仍通过 provider-local module + seam 跑通；
3. `librarian_evidence_packet_v1` contract 对 provider / api_source 为 open string，而不是 closed HEP enum；
4. acceptance 证明 `search.step` parity 没被打破；
5. review-swarm 与 self-review 都明确确认“旧 packet assumption 已被修正，而不是换个位置继续内联”。

## 4. Authority To Read Before Coding

### 4.1 Governance / tracker / prompt

1. `AGENTS.md`
2. `meta/remediation_tracker_v1.json`
3. `meta/REDESIGN_PLAN.md`
4. `meta/docs/prompts/IMPLEMENTATION_PROMPT_CHECKLIST.md`
5. `meta/docs/prompts/prompt-2026-03-14-new05a-stage3-search-step.md`
6. 本文件

### 4.2 Mandatory rereview evidence

1. `/Users/fkg/Coding/Agents/autoresearch-lab-new05a-stage3-rereview/.review/2026-03-16-new05a-stage3-rereview/review_packet.md`
2. `/Users/fkg/Coding/Agents/autoresearch-lab-new05a-stage3-rereview/.review/2026-03-16-new05a-stage3-rereview/swarm-r1/opus.json`
3. `/Users/fkg/Coding/Agents/autoresearch-lab-new05a-stage3-rereview/.review/2026-03-16-new05a-stage3-rereview/swarm-r1/gemini.json`

### 4.3 Current TS surface under repair

1. `packages/idea-engine/src/service/domain-pack.ts`
2. `packages/idea-engine/src/service/search-operator.ts`
3. `packages/idea-engine/src/service/librarian-recipes.ts`
4. `packages/idea-engine/src/service/search-step-service.ts`
5. `packages/idea-engine/src/service/search-step-campaign.ts`
6. `packages/idea-engine/src/service/write-service.ts`
7. `packages/idea-engine/tests/search-step-parity.test.ts`
8. `packages/idea-engine/tests/fixtures/search-step-rpc-golden.json`
9. `packages/idea-engine/tests/fixtures/generate_search_step_rpc_golden.py`

### 4.4 Python reference architecture you should mirror, not re-invent

1. `packages/idea-core/src/idea_core/engine/domain_pack.py`
2. `packages/idea-core/src/idea_core/engine/hep_domain_pack.py`
3. `packages/idea-core/src/idea_core/engine/retrieval.py`
4. `packages/idea-core/src/idea_core/engine/schemas/librarian_evidence_packet_v1.schema.json`
5. `packages/idea-core/tests/engine/test_domain_pack_m30.py`
6. `packages/idea-core/tests/engine/test_retrieval_recipes_m33.py`

本批不需要发明新的架构 lane。已存在的 primary source 就是 Python side 的：

- `DomainPackDescriptor` / loader indirection
- `DomainPackAssets`
- `LibrarianRecipeBook`

TS 侧只需把同类 seam 补回来。

## 5. GitNexus Hard Gate

### 5.1 Pre-implementation

1. 读取 `gitnexus://repo/autoresearch-lab-new05a-stage3-authority-repair/context`。
2. 若当前 worktree 与 index 不一致，运行 `npx gitnexus analyze --force`。
3. 在开工前至少对齐以下符号/调用面：
   - `loadSearchDomainPackRuntime`
   - `buildLibrarianEvidencePacket`
   - `IdeaEngineSearchStepService`
   - `resolveDomainPackForCharter`
4. 若 GitNexus 的 `impact` / `context` 再次 `Transport closed`，必须明确记录，并回退到 exact source inspection + targeted tests；禁止把 partial graph coverage 写成 complete evidence。

### 5.2 Pre-review

因为本批会修改 live search-step call path：

1. 再跑一次 `npx gitnexus analyze --force`
2. 使用 `detect_changes`
3. 尝试 `context` / `impact`
4. 若 `impact` / `context` 继续 `Transport closed`，在 review packet 与 self-review 里明确记录该失败

## 6. Implementation Constraints

### 6.1 Keep the repair bounded

允许引入少量新文件，但每个新文件都必须是单一职责、清楚表达 seam：

- generic registry / seam
- provider-local HEP runtime
- provider-local HEP librarian recipe book

不要把新文件命名成 `utils.ts` / `helpers.ts` / `common.ts`。

### 6.2 What “fixed” means for each blocker

#### A. `search-operator.ts`

修复后 generic 文件里不应再直接拥有：

- `hep.anomaly_abduction.v1`
- `hep.symmetry_operator.v1`
- `hep.limit_explorer.v1`
- HEP-specific thesis / claim / evidence-URI templates
- `entry.operator_source !== 'hep_operator_families_m32'` 这种 generic hard gate

允许的终态：

- generic `SearchDomainPackRuntime` types / selection policy helpers 仍在 generic 层
- 当前 HEP operator specs 位于 provider-local module
- runtime loader 通过 registry / descriptor seam 被 `search-step-service` 消费

#### B. `librarian-recipes.ts`

修复后 generic 文件里不应再直接拥有：

- `INSPIRE` / `PDG` provider switch
- HEP family -> template inline mapping
- HEP fallback recipe ids

允许的终态：

- generic `LibrarianRecipeTemplate` / `LibrarianRecipeBook` types 与 packet-building helper 位于 generic 层
- provider-local HEP recipe templates / landing-uri resolver 位于 provider-local module
- `search-step-service` 用 loaded recipe book 构造 packet

#### C. `domain-pack.ts`

修复后 generic 文件里不应再直接把 Python HEP catalog path 当作 built-in truth。

允许的终态：

- generic 层定义 `DomainPackDescriptor`-like metadata contract / registry seam
- provider-local HEP module 注册其 built-in catalog
- `resolveDomainPackForCharter` 仍保持当前 bounded behavior

#### D. `librarian_evidence_packet_v1`

修复后：

- `provider`
- `api_source`

都必须是 open string contract，而不是 closed HEP enum。

如果测试仍断言当前 HEP runtime 发出 `INSPIRE` / `PDG`，可以保留这些 runtime assertions；但 schema validation 本身必须允许 non-HEP provider。

#### E. Goldens / parity tests

修复后 tests 必须表达清楚：

- 当前 golden fixture 是 provider-local HEP slice through seam 的 parity fixture
- 它不再被当成“generic engine 必须内联这些 HEP strings”的证据

最小可接受方式：

1. 保留或重生成当前 golden fixture；
2. 补一个 seam-focused test，锁住 generic files 不再直接承载 HEP authority，或锁住 loader/recipe-book delegation；
3. review packet / self-review 必须显式说明 fixture 现在验证的是什么，不验证的是什么。

## 7. Suggested Minimal File Surface

优先在以下范围内完成，不要扩散：

- `packages/idea-engine/src/service/domain-pack.ts`
- `packages/idea-engine/src/service/search-operator.ts`
- `packages/idea-engine/src/service/librarian-recipes.ts`
- `packages/idea-engine/src/service/search-step-service.ts`
- `packages/idea-engine/src/service/write-service.ts`
- `packages/idea-engine/src/service/` 下新增的少量 seam/provider-local 文件
- `packages/idea-engine/tests/search-step-parity.test.ts`
- `packages/idea-engine/tests/fixtures/search-step-rpc-golden.json`
- `packages/idea-engine/tests/fixtures/generate_search_step_rpc_golden.py`
- `packages/idea-core/src/idea_core/engine/schemas/librarian_evidence_packet_v1.schema.json`
- 与 schema seam 直接相关的最小 Python test
- `meta/remediation_tracker_v1.json`
- `AGENTS.md`

`meta/REDESIGN_PLAN.md` 仅当本批改变了 lane 边界或 closeout 叙事时才更新；若只是修正实现 closeout 而不改设计层边界，可明确记录“本批不更新 `REDESIGN_PLAN.md`”。

## 8. Exact Acceptance Commands

至少运行并记录以下命令：

```bash
git diff --check
pnpm install --frozen-lockfile
pnpm --filter @autoresearch/idea-engine build
pnpm --filter @autoresearch/idea-engine test -- tests/search-step-parity.test.ts
pnpm --filter @autoresearch/idea-engine test
PYTHONPYCACHEPREFIX=/tmp/pycache python3 -m pytest \
  packages/idea-core/tests/engine/test_domain_pack_m30.py \
  packages/idea-core/tests/engine/test_retrieval_recipes_m33.py -q
PYTHONPYCACHEPREFIX=/tmp/pycache make -C packages/idea-core validate
```

如果更新了 golden fixture，额外运行：

```bash
PYTHONPYCACHEPREFIX=/tmp/pycache python3 packages/idea-engine/tests/fixtures/generate_search_step_rpc_golden.py
pnpm --filter @autoresearch/idea-engine test -- tests/search-step-parity.test.ts
```

如果你新增了 seam-focused targeted test，也要单独记录它。

## 9. Review-Swarm Hard Gate

本批是 boundary / authority migration repair，formal review 不得省略。

默认 reviewer：

- `Opus`
- `Gemini-3.1-Pro-Preview`
- `OpenCode(kimi-for-coding/k2p5)`

reviewer 必须显式回答：

1. generic service 层是否仍残留 active HEP authority？
2. `librarian_evidence_packet_v1` 是否已从 closed HEP provider authority 变成 open contract？
3. parity fixture 现在锁的是“provider-local slice through seam”，还是仍在锁“generic inline HEP truth”？
4. 本批是否确实没有扩到 `eval.run` / `rank.compute` / `node.promote` 或 broader Stage 3 migration？

## 10. Self-Review Hard Gate

外部 review 收敛后，self-review 必须再核对一次：

1. `map -> artifact`
2. `artifact -> map`
3. no inline duplicate authority left
4. shared entrypoint acceptance still passes
5. tracker / `AGENTS.md` 叙事是否已从旧 closeout 切换到当前 repair 状态

## 11. Required SSOT Sync

### 11.1 Start of batch

开工前：

- 将 `meta/remediation_tracker_v1.json` 中 `NEW-05a-stage3` 调整为 `in_progress`
- `assignee` 填当前实际模型
- note 明确写出：`2026-03-16` rereview reopened the item because prior closeout was `NOT_CONVERGED` on authority placement
- `AGENTS.md` 当前进度摘要同步改成 reopened / in-progress 叙事，不能继续保留“已完成且 0 blocking”的旧表述

### 11.2 End of batch

只有在 acceptance + formal review + self-review 全通过后，才可：

- 把 `NEW-05a-stage3` 标回 `done`
- 在 note 中记录本批 absorbed 的 blocker / amendment / exact commands / GitNexus evidence limits
- 更新 `AGENTS.md` 当前进度摘要

若本批没有引入新的长期稳定架构不变量，应明确记录：

- 不更新 `.serena/memories/architecture-decisions.md`
- 不更新 `meta/REDESIGN_PLAN.md`

## 12. Next-Step Discipline

完成汇报必须给出条件化下一步建议，但默认不得直接接着启动：

- `eval.run`
- `rank.compute`
- `node.promote`
- broader Stage 3 migration

除非本批 review / self-review 证据证明这些面已被本批直接 unblock；否则只允许把它们作为“后续候选 lane”，不能在本对话顺手实现。
