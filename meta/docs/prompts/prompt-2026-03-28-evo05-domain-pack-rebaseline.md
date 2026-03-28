# Prompt: 2026-03-28 `EVO-05` — Domain Pack Rebaseline / Runtime-Backed First Deliverable

> 适用范围：**仅**用于一个新的 bounded implementation 对话。
> 默认继承 `meta/docs/prompts/IMPLEMENTATION_PROMPT_CHECKLIST.md`。
>
> 本批不是 `EVO-12` reopen，不是 `skills-market` runtime redesign，也不是把 Track A / REP 的 `domain_pack_manifest_v1` 强行套回当前 `idea-core` loader。目标只有一个：先把 `EVO-05` 从旧的 stale `pack_spec.py` / `autoresearch-meta` 叙事 rebaseline 到今天 repo 中真实存在的 authority，并锁定一个最小、可验证、不会误伤相邻 lane 的 first deliverable。

## 0. Worktree Requirement

本 prompt 不得在当前 planning worktree 实施：

- `/Users/fkg/Coding/Agents/autoresearch-lab-evo05-rebaseline-plan`

未来实现必须放到新的 dedicated implementation lane；不要在这个 governance-only worktree 上写 `packages/**` runtime 代码。

## 1. Why This Batch Next

截至 2026-03-28，`EVO-05` 的 checked-in planning truth 已经明显漂移：

1. `meta/REDESIGN_PLAN.md` 旧 file table 仍指向不存在的 `idea-core/src/idea_core/plugins/pack_spec.py` 与旧 monorepo 时代的 `autoresearch-meta/...` 路径。
2. 当前 repo 中真正活着的 runtime-facing domain-pack substrate 仍在 `packages/idea-core/src/idea_core/engine/`：
   - `domain_pack.py`
   - `default_domain_pack.py`
   - `hep_domain_pack.py`
   - `hep_builtin_domain_packs.json`
   - `coordinator.py` / `rpc/server.py` 的消费链
3. `meta/schemas/domain_pack_manifest_v1.schema.json` 确实是 live checked-in schema，但它现在服务的是 Track A / REP 侧的 domain-pack manifest semantics（integrity checks / scoring config / taxonomy expansion 等），并不是当前 `idea-core` 的 loader / installer contract。
4. `packages/skills-market/**` 现在已经形成单独的 install-side lifecycle authority，但它只覆盖 `market-package` taxonomy 与 installer flow；当前 schema / README / package set 里都没有 `domain-pack` package type，也没有 domain-pack install path。

因此，本批正确目标不是补写一个“独立安装已存在”的假故事，而是先锁定：

1. 哪些才是 today’s live EVO-05 authority；
2. 哪些只是 adjacent schema/design truth；
3. 哪些已经属于 `EVO-12` 的 install-side boundary；
4. 最小 first deliverable 应该先做什么，才能让后续 implementation 不建立在错误前提上。

## 2. Required Reads Before Coding

至少读取并重新对齐：

1. `AGENTS.md`
2. `meta/remediation_tracker_v1.json`
3. `meta/REDESIGN_PLAN.md`
4. `meta/docs/prompts/IMPLEMENTATION_PROMPT_CHECKLIST.md`
5. 本文件
6. `meta/schemas/domain_pack_manifest_v1.schema.json`
7. `packages/idea-core/src/idea_core/engine/domain_pack.py`
8. `packages/idea-core/src/idea_core/engine/default_domain_pack.py`
9. `packages/idea-core/src/idea_core/engine/hep_domain_pack.py`
10. `packages/idea-core/src/idea_core/engine/hep_builtin_domain_packs.json`
11. `packages/idea-core/src/idea_core/engine/coordinator.py`
12. `packages/idea-core/src/idea_core/rpc/server.py`
13. `packages/idea-core/tests/engine/test_domain_pack_m30.py`
14. `packages/skills-market/README.md`
15. `packages/skills-market/schemas/market-package.schema.json`
16. `packages/skills-market/packages/idea-core.json`
17. `meta/docs/prompts/prompt-2026-03-25-evo12-slice2-real-skill-pack-onboarding.md`

## 3. Locked Current Authority

### 3.1 Live runtime authority today

当前真正活着的 domain-pack runtime-facing authority 是：

1. `packages/idea-core/src/idea_core/engine/domain_pack.py`
   - `DomainPackAssets`
   - `DomainPackDescriptor`
   - `DomainPackIndex`
2. `packages/idea-core/src/idea_core/engine/default_domain_pack.py`
   - 当前 provider-neutral built-in default descriptor surface
   - `generic.default.v1`
3. `packages/idea-core/src/idea_core/engine/hep_domain_pack.py`
   - 当前 built-in HEP pack catalog loader
   - `hep.operators.v1`
4. `packages/idea-core/src/idea_core/engine/coordinator.py`
   - `campaign.init` 解析 `enable_domain_packs` / `disable_domain_packs` / `domain_pack_id`
   - `search.step` 消费 `search_operators` / `librarian_recipes` / `operator_selection_policy`
   - `eval.run` / downstream constraint diagnostics 消费 `constraint_policy`
5. `packages/idea-core/src/idea_core/rpc/server.py`
   - 当前 stdio JSON-RPC front door 直接启动 `build_builtin_hep_domain_pack_index()`
   - 该 front door 当前只暴露 HEP descriptors；`generic.default.v1` 不在这个 stdio index 中
6. `packages/idea-core/tests/engine/test_domain_pack_m30.py`
   - 当前 runtime pack selection / caching / failure semantics 的 regression anchor

补充说明：

- `generic.default.v1` 当前来自 `packages/idea-core/src/idea_core/engine/domain_pack.py` 里的 `build_builtin_domain_pack_index()` fallback path，而不是 `rpc/server.py` 的 stdio front door
- `hep.operators.v1` 当前来自 `build_builtin_hep_domain_pack_index()` / `hep_builtin_domain_packs.json`
- 因此 “already-live packs” 目前跨越两个不同的 index constructor；未来 first deliverable 若要把它们都纳入一个 runtime-backed catalog/export authority，需要统一或显式暴露这两个现有 catalog surface，而不是假设 stdio front door 已经覆盖两者

### 3.2 Adjacent but different authority

`meta/schemas/domain_pack_manifest_v1.schema.json` 现在是 live checked-in schema authority，但它的语义是 Track A / REP 侧的 domain-pack manifest：

- integrity check metadata
- scoring config
- taxonomy expansion
- literature service id

它**不是**当前 `idea-core` `DomainPackDescriptor` / `DomainPackAssets` / built-in HEP catalog 的 runtime loader contract。

### 3.3 Not live authority anymore

以下内容不得再被写成当前 EVO-05 live authority：

1. `idea-core/src/idea_core/plugins/pack_spec.py`
2. `autoresearch-meta/schemas/domain_pack_manifest_v1.schema.json`
3. “HEP domain pack 已可独立打包/安装/升级”的旧 acceptance wording

## 4. EVO-05 vs EVO-12 Boundary

### 4.1 What belongs to EVO-05

`EVO-05` 当前只应拥有：

1. domain-pack 的 runtime-backed descriptor / catalog / loader boundary
2. `idea-core` 如何识别、选择、加载、并把 pack assets 交给 runtime path
3. 如果未来要谈“独立分发”，前提必须先有一个 truthful、可枚举、可导出的 domain-pack packaging source of truth

### 4.2 What already belongs to EVO-12

`EVO-12` 已关闭的 authority 仍然只在 `packages/skills-market/**`：

1. `market-package.schema.json`
2. `validate_market_runtime/package_checks.py`
3. `install_skill_runtime/{cli,install_flow,package_contracts}.py`
4. `.market_install.json` / `.auto_safe_install_audit.json`

当前 `skills-market` taxonomy 只有：

- `skill-pack`
- `tool-pack`
- `engine-pack`
- `workflow-pack`
- `contract-pack`
- `skill-pack-index`

没有 `domain-pack` package type，也没有 domain-pack install semantics。`packages/skills-market/packages/idea-core.json` 分发的是 `idea-core` engine-pack，本身不是 domain-pack catalog/install authority。

因此：

1. 本项不得 reopen `EVO-12`
2. 不得把 `--auto-safe` 或现有 market installer 叙述成“domain-pack install 已存在”
3. 若未来真的要让 domain-pack 进入 `skills-market`，那必须是后续明确 slice，在 EVO-05 先定义好 consumer contract 之后再谈

## 5. Smallest Truthful First Deliverable

当前最小、真实、可独立验证的 first deliverable 应该是：

### 5.1 目标

先建立一个 **runtime-backed domain-pack catalog / export authority**，把今天已经存在的 pack truth 从“隐含在 loader wiring 里”收敛成“可被独立枚举和审查的 checked-in surface”。

### 5.2 This slice must do

1. 以当前 `idea-core` runtime pack substrate 为唯一 implementation authority
2. 让当前 active built-in packs 至少可从一个清晰、checked-in、runtime-backed surface 被列举/描述：
   - `generic.default.v1`
   - `hep.operators.v1`
3. 明确处理当前 split reality：
   - `generic.default.v1` 走 provider-neutral fallback index constructor
   - `hep.operators.v1` 走当前 stdio / default service 所用的 HEP-only index constructor
4. 保持 `campaign.init` / `search.step` / `eval.run` 现有 runtime semantics 不变
5. 继续把 HEP-specific pack truth 留在 provider-local pack surface，而不是提升到 generic core worldview

### 5.3 This slice must not do

1. 不把 `domain_pack_manifest_v1.schema.json` 强绑成当前 `idea-core` loader schema
2. 不发明独立 installer / upgrade flow
3. 不扩成 `skills-market` package-type 或 installer redesign
4. 不把 `idea-core` engine-pack distribution 与 domain-pack distribution 混成一件事
5. 不 widen 到 broader idea-core migration / retire-all / EVO-12a / runtime redesign

## 6. Preferred Implementation Shape

未来 implementation lane 应优先选择：

1. `packages/idea-core/src/idea_core/engine/` 内的最小 runtime-backed catalog/export seam
2. 必要时仅新增一个 adjacent read-only metadata / registry surface，用于枚举当前 built-in packs
3. 仅在确有必要时触碰 `packages/idea-core/src/idea_core/rpc/server.py`，且只能为了暴露/消费该 read-only seam，不得改写核心 runtime behavior
4. `packages/idea-core/tests/engine/test_domain_pack_m30.py` 或相邻 narrow tests 负责锁住新 surface 与 runtime boundary

## 7. Acceptance Lock

未来 first deliverable 至少必须证明：

1. active built-in pack catalog truth 可从 runtime-backed surface 被独立枚举/描述，而不是只存在于隐式 loader wiring
2. `campaign.init` 仍按 domain prefix / explicit `domain_pack_id` 解析 pack
3. `search.step` 仍消费 selected pack 的 operators / recipes
4. `packages/skills-market/**` 完全不变
5. `meta/schemas/domain_pack_manifest_v1.schema.json` 不被误写成当前 `idea-core` loader contract
6. no new install/upgrade lifecycle claim

最低 acceptance commands 应至少包含：

```bash
git diff --check
PYTHONPYCACHEPREFIX=/tmp/pycache python3 -m pytest packages/idea-core/tests/engine/test_domain_pack_m30.py -q
git diff --name-only -- packages/skills-market
```

若实现新增 read-only catalog/export seam，应补与之直接相关的 targeted tests，但不得顺手扩大到 `skills-market`、REP runtime、或 broader `idea-core` rewrite。

## 8. Review Packet Lock

formal review packet 至少必须带上：

1. `meta/schemas/domain_pack_manifest_v1.schema.json`
2. `packages/idea-core/src/idea_core/engine/domain_pack.py`
3. `packages/idea-core/src/idea_core/engine/default_domain_pack.py`
4. `packages/idea-core/src/idea_core/engine/hep_domain_pack.py`
5. `packages/idea-core/src/idea_core/engine/hep_builtin_domain_packs.json`
6. `packages/idea-core/src/idea_core/engine/coordinator.py`
7. `packages/idea-core/src/idea_core/rpc/server.py`
8. `packages/idea-core/tests/engine/test_domain_pack_m30.py`
9. `packages/skills-market/README.md`
10. `packages/skills-market/schemas/market-package.schema.json`
11. `packages/skills-market/packages/idea-core.json`
12. `meta/docs/prompts/prompt-2026-03-25-evo12-slice2-real-skill-pack-onboarding.md`
13. all touched files

formal reviewers for this prompt:

- `Opus`
- `Gemini-3.1-Pro-Preview`
- `OpenCode(zhipuai-coding-plan/glm-5.1)`

formal self-review is also mandatory.

## 9. Completion Boundary

这个 prompt 对应的 future deliverable 只有在以下条件全部满足时才允许 closeout：

1. EVO-05 的 live authority 已从 stale `pack_spec.py` / `autoresearch-meta` 叙事切换到 today’s runtime-backed pack substrate
2. first deliverable 只建立 runtime-backed catalog / export authority，不伪造 install lifecycle
3. `skills-market` boundary 保持不变，`EVO-12` 不被 reopen
4. trio review 0 blocking
5. self-review 0 blocking
6. tracker / `REDESIGN_PLAN.md` / current code truth 再次三方对齐

若这些条件不满足，不要把本批误写成“domain pack 已可独立安装/升级”；它最多只是 bounded first deliverable。
