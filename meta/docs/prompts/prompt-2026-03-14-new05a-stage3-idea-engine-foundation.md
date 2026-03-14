# Prompt: 2026-03-14 Standalone — `NEW-05a Stage 3` Foundation (`idea-engine` Store + Read-RPC Parity)

> 默认继承 `meta/docs/prompts/IMPLEMENTATION_PROMPT_CHECKLIST.md`。
>
> 本 prompt 对应一个**单独的新实现对话**。
>
> 目标：在 `EVO-01` / `EVO-02` / `EVO-03` 已完成、`NEW-LOOP-01` 与 `NEW-COMP-02` 已稳定、且 generic/domain boundary cleanup 已完成之后，正式启动 `NEW-05a Stage 3`，但只做**最小、最稳、最可验证**的第一刀：
>
> `packages/idea-engine/` 从 3 行 stub 变成一个真实的 TypeScript package，先吃下 `idea-core` 的 **store/idempotency substrate + minimal read-side RPC parity**，而不是一口气迁完整个 `IdeaCoreService`。

## 0. Why This Batch Next

当前仓库的近中期主干已经发生了实质变化：

- `NEW-LOOP-01` 已完成，单用户 / 单项目 research substrate 已落地。
- `NEW-COMP-02` 已完成，generic computation execution core 已落地。
- `EVO-01` / `EVO-02` / `EVO-03` 已完成，单用户 `idea -> compute -> feedback -> writing/review bridge` 已经闭环。
- generic/shared/core 的 HEP semantic-authority cleanup 已完成，`NEW-05a Stage 3` 不再被已知的 active HEP worldview authority 污染。

因此，从**整个项目**的角度，当前最大的结构性瓶颈已经不是 compute/writing bridge，而是：

- Python `idea-core` 仍持有 live authority；
- `packages/idea-engine/` 仍只有 stub；
- `EVO-13` 的一条硬前置仍是 `NEW-05a-stage3`；
- 如果继续把新能力堆在 Python `idea-core` 周围，后续统一到 TS runtime 的成本只会继续升高。

但下一批也**不应该**直接做：

- 全量 `NEW-05a-stage3`
- `EVO-13`
- `NEW-07`
- `trace-jsonl`
- `EVO-06/07/09/10/11/12`
- 任何 community / A2A / registry / fleet-level lane

理由：

1. `EVO-13` 仍被 `NEW-05a-stage3` 与 `NEW-07` 卡住；先跳 `EVO-13` 只会制造第二套半成品 runtime。
2. `NEW-07` 仍位于 Phase 4，且依赖 `L-06`；`scope-audit-phase1-2.md` 也明确指出当前 A2A 仍属假想需求，不应提前吸入主线。
3. `trace-jsonl` 与 evolution lane 很重要，但它们不在“统一 TS execution / 退役 Python Pipeline A”的最短关键路径上。

因此，下一批应是一个**bounded `NEW-05a Stage 3 foundation`**：

- 先把 `idea-engine` 的底座搭起来；
- 先迁 `store/idempotency substrate`；
- 先迁最小 read-side surface；
- 先建立 Python store / fixture / RPC envelope 的 parity harness；
- 明确不碰 operator families、domain pack、HEPAR orchestration、A2A/team runtime。

## 1. Hard Scope Boundary

### 1.1 In scope

本批只允许做以下工作：

1. 把 `packages/idea-engine/` 从 stub 扩成真实 package，并建立清晰的多文件结构。
2. 在 TS 中实现与 `packages/idea-core/src/idea_core/engine/store.py::EngineStore` 等价的最小 store substrate：
   - campaign/global root layout
   - `campaign.json`
   - `nodes_latest.json`
   - `nodes_log.jsonl`
   - artifact path / artifact write / artifact ref read
   - global/campaign idempotency store path
   - atomic JSON write
   - JSONL append
   - lock boundary
   - 注意：atomic write 语义先对齐 Python 现状（fd `fsync` + atomic rename），不要在本批单边升级成目录级 `fsync`
3. 在 TS 中实现最小 read-side service / handler surface，仅限：
   - `campaign.status`
   - `node.get`
   - `node.list`
4. 为上述 read surface 实现最小 JSON-RPC envelope / dispatch compatibility：
   - success result 结构
   - error code / error data 结构
   - method/params/result shape 以 `idea_core_rpc_v1.openrpc.json` 为结构性 source of truth，并结合 `rpc/server.py` 校对 live envelope 行为
   - 与当前 `idea-core` RPC server 的 method/result/error shape 保持可核对的一致性
5. 为 future write-side migration 预埋**确有必要**的最小 helper，仅限：
   - payload hash without idempotency
   - idempotency key / payload hash parity
   - `payload_hash` 必须与 Python `idea-core` 当前 live authority 保持一致：以 RFC 8785 / JCS canonical JSON 为输入后再做 SHA-256；不得退化为普通 `JSON.stringify`、对象插入顺序依赖、或其他 ad hoc canonicalization
   - read-path required validation / filtering helpers
   - 这些 helper 必须是纯结构性/协议性逻辑，不得包含任何 HEP/domain heuristic、rubric、taxonomy 或 closed semantic authority
   - 绝不提前迁入 mutating semantics
6. 建立 parity harness：
   - 让 TS `idea-engine` 能读 Python 生成的 store/fixture/snapshot
   - 至少一条测试使用 Python-style on-disk fixture，而不是纯 TS 手工伪造 layout
   - 至少一条 golden/read-compat smoke 覆盖 RPC envelope
   - 至少一条 cross-language payload-hash parity 断言覆盖 key ordering / nested object / Unicode / representative numeric formatting case；优先使用 Python reference helper 生成的 checked-in golden fixture，而不是只测 TS 自己的期望值
7. 补齐 `packages/idea-engine` 自身的 build/test 入口，不允许继续保留 “no tests yet” 占位状态。

### 1.2 Explicitly out of scope

本批明确禁止：

- `campaign.init`
- `search.step`
- `eval.run`
- `rank.compute`
- `node.promote`
- operator families 迁移
- domain pack 迁移
- retrieval / novelty / reduction / formalization / compute-plan semantics 迁移
- HEPAR orchestration 迁移
- `EVO-13`
- `NEW-07`
- A2A / agent registry / team runtime / delegation / lifecycle / checkpoint / heartbeat
- `trace-jsonl`
- evolution / integrity / reproducibility lane
- lane 外大规模重构
- 把 `idea-core` 直接 big-bang 改写为 TS

### 1.3 Completion Lock

本批完成态至少应满足：

1. `packages/idea-engine/` 不再是 stub。
2. TS store 层能读写与 Python `EngineStore` 等价的最小目录/文件布局。
3. TS read surface 至少能对 Python-generated fixture/store 成功返回：
   - `campaign.status`
   - `node.get`
   - `node.list`
4. JSON-RPC envelope 与错误码/错误数据形状可被现有 contract/fixture/targeted tests 核对。
5. 本批没有误把 domain-specific bootstrap / heuristic / worldview authority 搬进 generic TS layer。
6. 本批没有偷带 mutating campaign semantics，也没有借机开启 `EVO-13` / `NEW-07`。

## 2. Historical Drift Guard

以下 checked-in 文档**不是**当前 `NEW-05a-stage3` 的实施 authority：

- `meta/docs/prompts/prompt-new05a-stage3a.md`
- `meta/docs/prompts/prompt-new05a-stage3b.md`
- `meta/docs/prompts/prompt-new05a-stage3c.md`

这些文件描述的是更早期的 TS orchestrator state-manager parity 工作，不是当前 pending 的 `idea-core -> idea-engine` 迁移。

当前 `NEW-05a-stage3` 的 authority 以以下 SSOT 为准：

- `AGENTS.md`
- `meta/remediation_tracker_v1.json`
- `meta/REDESIGN_PLAN.md`
- `meta/docs/scope-audit-dual-mode-converged.md`
- `meta/docs/2026-03-09-root-ecosystem-boundary-adr.md`
- `meta/docs/2026-03-10-hep-semantic-authority-deep-audit.md`

若本批发现上述旧 prompt 仍会误导实现方向，只能在 closeout note 中记录其“历史 prompt”地位；不要回到那些 prompt 的 scope 上。

此外，本批必须机械验证：

- active code/test/import path 中不得继续引用这些旧 prompt 作为当前 authority
- 若 `packages/` 下仍出现对这些旧 prompt 的活跃引用，必须先解释并清理，再继续实施

## 3. 开工前必须读取

按顺序至少读取：

1. `AGENTS.md`
2. `meta/remediation_tracker_v1.json`
3. `meta/REDESIGN_PLAN.md` 中：
   - `NEW-05a`
   - `NEW-07`
   - `EVO-13`
   - `P5A/P5B` lane 划分
4. `meta/docs/prompts/IMPLEMENTATION_PROMPT_CHECKLIST.md`
5. 本文件 `meta/docs/prompts/prompt-2026-03-14-new05a-stage3-idea-engine-foundation.md`
6. `meta/docs/scope-audit-dual-mode-converged.md`
7. `meta/docs/scope-audit-phase1-2.md`
8. `meta/docs/2026-03-09-root-ecosystem-boundary-adr.md`
9. `meta/docs/2026-03-10-hep-semantic-authority-deep-audit.md`
10. `packages/idea-engine/package.json`
11. `packages/idea-engine/src/index.ts`
12. `packages/idea-core/src/idea_core/engine/store.py`
13. `packages/idea-core/src/idea_core/engine/coordinator.py`
    - 重点读取：
      - `_hash_without_idempotency`
      - `_response_idempotency`
      - `_load_campaign_or_error`
      - `campaign_status`
      - `node_get`
      - `node_list`
      - `_filter_nodes`
14. `packages/idea-core/src/idea_core/rpc/server.py`
15. `packages/idea-core/src/idea_core/contracts/catalog.py`
16. `packages/idea-core/src/idea_core/demo/m2_12_replay.py`
17. `packages/idea-core/contracts/idea-generator-snapshot/schemas/idea_core_rpc_v1.openrpc.json`
18. `packages/idea-core/tests/engine/test_node_read_methods.py`
19. `packages/idea-core/tests/engine/test_service_rank_and_idempotency.py`
20. `packages/idea-core/tests/contracts/test_validate_contracts.py`
21. `packages/idea-core/tests/engine/test_m2_12_demo_replay.py`

若本批需要新增 fixture 或 replay helper：

- 先优先复用现有 Python demo/store snapshot
- 仅在复用不足时新增最小 checked-in fixture
- fixture 必须 portable，不得含机器本地绝对路径

### 3.1 Narrow SOTA Preflight

开工前先做一轮**窄范围** SOTA / primary-source preflight，但只允许覆盖本批直接触及的协议与持久化边界：

1. RFC 8785 / JCS canonical JSON
   - 用于确认 TS `payload_hash` 与 Python `idea-core` 的跨语言 canonicalization parity
2. JSON-RPC 2.0 + OpenRPC
   - 用于确认 request/result/error envelope 的字段与错误码边界，而不是只按 TS 本地类型随意生成 shape
3. Node.js 文件写入 durability primitives
   - 用于确认本批只做 Python 现状对齐（fd `fsync` + rename）而不误报更强 crash-consistency 语义

要求：

- 只使用 primary sources：RFC / 官方 Node.js 文档 / OpenRPC 官方文档（必要时再辅以 POSIX `fsync(2)` / `rename(2)` 文档解释 crash semantics）
- 将使用到的来源 URL 记录进实现执行记录或 formal review packet，便于后续 closeout / self-review 复核
- 这轮 preflight 只用于补协议/持久化 guardrail，不得借机重新放大 scope 到 operator/domain/retrieval/semantic lane
- 若 preflight 发现的是“应在后续 lane 解决”的更强 durability / retrieval / runtime 架构问题，本批只能记录为 follow-up，不得在 foundation slice 中偷做范围升级

## 4. GitNexus Hard Gate

### 4.1 实施前

1. 读取 `gitnexus://repo/autoresearch-lab/context`
2. 若 index stale，先运行 `npx gitnexus analyze`
3. 再次读取 context；若 resource 短暂仍显示 stale，但 CLI 已明确成功更新，则把 CLI 输出纳入审查证据
4. 至少对齐以下 symbol / surface：
   - `IdeaCoreService`
   - `EngineStore`
   - `handle_request`
   - `campaign_status`
   - `node_get`
   - `node_list`
   - `_filter_nodes`
   - `_hash_without_idempotency`
5. 若 GitNexus 对 Python method 粒度 coverage 不足，必须补 direct source inspection；不得假装 graph evidence 完整。

### 4.2 审核前

若新增/重命名符号、改变关键调用链、或当前 index 已不反映工作树：

1. 再次运行 `npx gitnexus analyze`
2. 使用 `detect_changes`
3. 必要时补 `impact` / `context`

至少要给出：

- `packages/idea-engine` 新增 authority surface
- 与 `packages/idea-core` fixture/test surface 的对应关系
- 是否影响 `NEW-IDEA-01` bridge 或后续 `EVO-13` 准备工作的证据

若 GitNexus 对新 helper / 新 callsite 继续漏报：

- 明确记录失败
- 改用 direct source inspection + targeted tests 作为 exact verification
- 不得把“partial graph coverage”包装成完整 post-change evidence

## 5. Current Live Authority Surfaces

### 5.1 Store authority

当前 live store authority 是：

- `packages/idea-core/src/idea_core/engine/store.py::EngineStore`

本批 TS 迁移必须先对齐这里，而不是自己发明新目录布局或新 artifact ontology。

### 5.2 Read-side engine authority

当前 live read-side authority 主要在：

- `packages/idea-core/src/idea_core/engine/coordinator.py::campaign_status`
- `packages/idea-core/src/idea_core/engine/coordinator.py::node_get`
- `packages/idea-core/src/idea_core/engine/coordinator.py::node_list`
- 以及它们依赖的最小 helper

本批只能迁这些 read surfaces，不得借机把 mutating/semantic methods 一起带进来。

### 5.3 RPC authority

当前 live JSON-RPC envelope authority 在：

- `packages/idea-core/src/idea_core/rpc/server.py`
- `packages/idea-core/contracts/idea-generator-snapshot/schemas/idea_core_rpc_v1.openrpc.json`

本批必须把它们视为协议与 envelope 参考，而不是另起一套只对 TS 自己成立的 ad hoc shape。

### 5.4 Boundary constraint

`idea-engine` 是 future generic/core authority 的候选实现，因此本批必须继续遵守：

- generic layer 不得重新吸入 domain-specific bootstrap ids
- 不得重新吸入 HEP-only rubric / taxonomy / worldview authority
- 有价值的 domain 内容只能通过 provider-local seam 或 provider-neutral typed contract 进入

## 6. Implementation Constraints

1. **先迁 substrate，再迁 semantics**
   本批优先级是 store / idempotency / read parity，不是 operator/domain logic。

2. **先建立 fixture parity，再扩功能**
   如果 TS package 还不能稳定读 Python fixture/store，本批就不应继续扩到 mutating methods。

3. **不为假设性未来过度抽象**
   只为本批直接需要的 read-side surface 建模块；不要预先做 full service plugin system。

4. **真实启动 `idea-engine` test surface**
   `packages/idea-engine/package.json` 里的占位 `test`/`lint` 不能继续留空壳。若本批结束后仍是 `"no tests yet"`，直接视为失败。

5. **保持文件粒度可维护**
   不要在 TS 侧复制一个新的 2000+ 行 god file。按职责拆文件，避免再次造出 `coordinator.py` 级别单点。

6. **内部 breaking change 允许，但跨 pipeline parity 不可破坏**
   本仓无外部 backward-compat burden，但 `NEW-05a-stage3` 的使命之一就是吸收当前 Python authority，因此对现有 in-repo fixture/store/RPC contract 的可核对一致性仍是硬要求。

## 7. Acceptance Commands

至少运行：

```bash
pnpm --filter @autoresearch/idea-engine build
pnpm --filter @autoresearch/idea-engine test
pnpm --filter @autoresearch/idea-engine test -- tests/read-rpc-parity.test.ts
cd packages/idea-core && pytest tests/engine/test_node_read_methods.py tests/engine/test_service_rank_and_idempotency.py tests/contracts/test_validate_contracts.py tests/engine/test_m2_12_demo_replay.py -q
! rg -n 'prompt-new05a-stage3[abc]' packages
! rg -n --glob '*.{ts,tsx}' 'hep\\.bootstrap|bootstrap_default|toy_laptop|HEP_COMPUTE_RUBRIC_RULES' packages/idea-engine/src
git diff --check
```

若本批触及 shared schema / generated bindings / shared helper：

```bash
bash meta/scripts/codegen.sh
pnpm --filter @autoresearch/shared build
pnpm --filter @autoresearch/shared test
```

若本批新增 fixture generation helper：

- 必须把对应生成/refresh命令补进执行记录
- 并证明 checked-in fixture 结果 portable
- 若把上述负向 shell gate 收编进脚本/测试 harness，必须改写为显式断言，不要依赖 shell negation 语义本身作为唯一可读性来源

硬门禁：

- 若 `pnpm --filter @autoresearch/idea-engine test` 仍只是 placeholder echo，本批失败
- 若没有至少一条 Python-fixture parity test，本批失败
- 若 `tests/read-rpc-parity.test.ts` 未实际对 Python-generated fixture/store 的 `campaign.status` / `node.get` / `node.list` 做 cross-language parity 断言，本批失败
- 若没有显式 cross-language `payload_hash` parity 断言，且未覆盖至少一个 key-order 变化样例与一个非 ASCII / Unicode 样例，本批失败
- 若 `packages/idea-engine/src` 出现 `hep.bootstrap` / `bootstrap_default` / `toy_laptop` / `HEP_COMPUTE_RUBRIC_RULES` 等已降级 authority token，本批失败

## 8. Formal Review And Self-Review

实现完成前必须完成：

1. formal review
   - `Opus`
   - `Gemini-3.1-Pro-Preview`
   - `OpenCode(kimi-for-coding/k2p5)`
2. self-review

formal review 与 self-review 都必须显式回答：

- 为什么这批是 `NEW-05a Stage 3` 的正确第一刀，而不是 `EVO-13` / `NEW-07` / `trace-jsonl`
- 是否把 batch 锁在 store/idempotency/read-side parity，而没有偷带 mutating/semantic methods
- 是否真正对齐了 Python fixture/store/RPC authority，而不是只做一个 TS-only mock layer
- 是否重新引入了 domain-specific authority 到 generic TS layer
- TS store / helper 层是否仍然只包含结构性 authority，而没有把任何 closed semantic authority 带回 generic layer
- 是否为后续 `campaign.init` / write-side migration 留下了清晰而不是更混乱的接入面

## 9. Tracker / SSOT Sync

完成后：

- 更新 `meta/remediation_tracker_v1.json`
- 同步 `AGENTS.md` 当前进度摘要
- 若本批仅是 `NEW-05a-stage3` 的 bounded first slice，必须在 tracker note 中明确：
  - 本批完成了什么
  - 哪些 live authority 仍留在 Python `idea-core`
  - 为什么 `EVO-13` / `NEW-07` 仍未启动
- 若本批没有新增稳定架构不变量，不要为了形式主义更新 `.serena/memories/architecture-decisions.md`
- 若本批改变了 `NEW-05a-stage3` 的 lane sequencing / dependency narration，才更新 `meta/REDESIGN_PLAN.md`

## 10. Suggested Outcome

理想最小 outcome：

- `packages/idea-engine` 从 stub 进入真实可测试状态
- TS `idea-engine` 可对 Python fixture/store 提供：
  - `campaign.status`
  - `node.get`
  - `node.list`
  的 parity read surface
- store / idempotency / RPC envelope 的第一个 TS authority slice 落地
- operator/domain/HEPAR/team-runtime lane 全部保持未启动

完成汇报必须给出**条件化的下一批建议**：

- 若 read-side parity 与 fixture harness 已稳定，下一批应是 `campaign.init + seed-node + write-side idempotency` 的 bounded follow-up，而不是直接跳到 `search.step` / operator families / domain pack / `EVO-13`
- 若 read-side parity 暴露的是 contract/store drift，则下一批应先做更小的 reconciliation follow-up，而不是继续扩方法面
