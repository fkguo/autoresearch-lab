# Prompt: 2026-03-14 Standalone — `NEW-05a Stage 3` `search.step` Foundation Follow-up

> 默认继承 `meta/docs/prompts/IMPLEMENTATION_PROMPT_CHECKLIST.md`。
>
> 本 prompt 对应一个新的实现对话，工作目录固定为：
> `/Users/fkg/Coding/Agents/autoresearch-lab-new05a-stage3-search-step`

## 0. Goal

在已经完成的 `NEW-05a Stage 3 write-side foundation` 之上，只做一个严格受限的 bounded follow-up：

- `packages/idea-engine/`
- `search.step`
- minimal island-state mutation parity
- minimal `step_budget` fuse parity
- minimal `search.step` artifact/store parity
- minimal write-side JSON-RPC parity for `search.step`

不得扩到：

- `eval.run`
- `rank.compute`
- `node.promote`
- operator families as a migration lane
- domain pack migration lane
- `NEW-07`
- `EVO-13`

## 1. Why This Batch Next

上一批已经完成：

- `campaign.init`
- deterministic seed-node materialization
- prepared/committed global idempotency
- minimal write-side JSON-RPC parity

当前 `packages/idea-engine/` 已有真实 store/read/write substrate，但 live authority 里仍有一个最明显、也最危险的留白：

- `search.step`

这正好是下一块必须单独收束的原因：

1. 它已经直接建立在 `campaign.init`、seed nodes、campaign-scoped idempotency、budget snapshot 与 minimal RPC 上。
2. 它仍是 Python `idea-core` 中最重要的 live mutating surface 之一。
3. 它也是 scope trap 最严重的一块，因为它不只是“多写几个 node”，还夹带 island-state、`step_budget` fuse、campaign status exhaustion、domain-pack loading、operator selection、artifact writes 与 idempotency replay。

因此，下一批应先把 `search.step` 单独做成一个 bounded follow-up，而不是直接跳 `eval.run` / `rank.compute` / `node.promote` / operator-family migration / `EVO-13`。

## 2. Hard Scope Boundary

### 2.1 In scope

只允许做以下工作：

1. 在 `packages/idea-engine/` 中增加最小 `search.step` service / RPC handling。
2. 迁移 Python `search.step` 当前 slice 所需的最小 helper / authority，至少包括：
   - `_load_campaign_domain_pack`
   - `_choose_search_operator`
   - `_build_operator_node`
   - `_step_budget_exhausted`
   - `_advance_island_state_one_tick`
   - `_pick_parent_node`
   - `_mark_islands_exhausted`
   - `_set_campaign_running_if_budget_available`
   - `_island_best_score`
   - `_is_score_improved`
   - `_ensure_campaign_running`
   - `search_step`
3. 让 TS `search.step` 与 Python live authority 对齐以下最小可核对语义：
   - request params / result / error envelope
   - idempotency dedupe by `(method, campaign_id, idempotency_key)`
   - duplicate replay returns the first logical response without re-execution
   - per-tick atomicity
   - `step_budget` local fuse early-stop behavior
   - campaign status transitions caused by search execution
   - minimal island-state mutation persistence
4. 迁移 `search.step` 所需的最小 artifact/store semantics，至少覆盖：
   - `search_steps/<step_id>.json`
   - `search_steps/<step_id>-new-nodes.json` when applicable
   - any strictly necessary companion artifacts that the current live authority writes as part of the returned/referenced `search.step` result
5. 建立 Python-generated parity fixtures/tests，至少覆盖：
   - happy-path `search.step`
   - duplicate replay
   - idempotency conflict
   - `step_budget` early stop
   - island-state transition parity
   - campaign exhaustion / `campaign_not_active` edge cases
   - minimal artifact/store layout parity after `search.step`

### 2.2 Explicitly out of scope

本批明确禁止：

- `eval.run`
- `rank.compute`
- `node.promote`
- operator-family migration as a general program
- generalized operator registry redesign
- domain pack migration or generic uplift
- retrieval / novelty / reduction / compute-plan lane expansion
- `packages/idea-core/` 行为修改，除非只用于生成新的 checked-in parity fixture
- `NEW-07`
- `EVO-13`

### 2.3 Completion Lock

本批完成态至少应满足：

1. TS `search.step` 能在 Python-generated fixture / store 上完成最小 parity verification。
2. `search.step` replay / conflict / early-stop / campaign status behavior 被 targeted tests 锁住，而不是“看起来差不多”。
3. island-state mutation 已最小落地，但没有顺手把 `eval.run` / `rank.compute` / `node.promote` 拉进来。
4. search operator / domain-pack handling 仍停留在实现当前 `search.step` 所需的最小 authority，而没有扩成 broader operator/domain migration。
5. GitNexus blind spot 若仍存在，closeout 明确记录并以 direct source inspection + targeted tests 作为 exact verification。

## 3. Authority To Read Before Coding

### 3.1 SSOT / governance

1. `AGENTS.md`
2. `meta/remediation_tracker_v1.json`
3. `meta/REDESIGN_PLAN.md`
4. `meta/docs/prompts/IMPLEMENTATION_PROMPT_CHECKLIST.md`
5. 本文件
6. `meta/docs/2026-03-09-root-ecosystem-boundary-adr.md`
7. `meta/docs/2026-03-10-hep-semantic-authority-deep-audit.md`

### 3.2 Live Python authority

1. `packages/idea-core/src/idea_core/engine/coordinator.py`
   - `search_step`
   - `_load_campaign_domain_pack`
   - `_choose_search_operator`
   - `_build_operator_node`
   - `_step_budget_exhausted`
   - `_advance_island_state_one_tick`
   - `_pick_parent_node`
   - `_mark_islands_exhausted`
   - `_set_campaign_running_if_budget_available`
   - `_island_best_score`
   - `_is_score_improved`
   - `_ensure_campaign_running`
2. `packages/idea-core/src/idea_core/engine/domain_pack.py`
3. `packages/idea-core/src/idea_core/rpc/server.py`
4. `packages/idea-core/src/idea_core/contracts/catalog.py`
5. `packages/idea-core/contracts/idea-generator-snapshot/schemas/idea_core_rpc_v1.openrpc.json`
6. `packages/idea-core/tests/engine/test_search_step_operator_m26.py`
7. `packages/idea-core/tests/engine/test_search_step_island_state_machine.py`
8. `packages/idea-core/tests/engine/test_m2_12_demo_replay.py`

### 3.3 Current TS surface

1. `packages/idea-engine/src/contracts/catalog.ts`
2. `packages/idea-engine/src/contracts/openrpc.ts`
3. `packages/idea-engine/src/hash/payload-hash.ts`
4. `packages/idea-engine/src/index.ts`
5. `packages/idea-engine/src/rpc/jsonrpc.ts`
6. `packages/idea-engine/src/service/budget-snapshot.ts`
7. `packages/idea-engine/src/service/domain-pack.ts`
8. `packages/idea-engine/src/service/errors.ts`
9. `packages/idea-engine/src/service/filter-nodes.ts`
10. `packages/idea-engine/src/service/idempotency.ts`
11. `packages/idea-engine/src/service/read-service.ts`
12. `packages/idea-engine/src/service/rpc-service.ts`
13. `packages/idea-engine/src/service/seed-node.ts`
14. `packages/idea-engine/src/service/validators.ts`
15. `packages/idea-engine/src/service/write-service.ts`
16. `packages/idea-engine/src/store/engine-store.ts`
17. `packages/idea-engine/src/store/file-io.ts`
18. `packages/idea-engine/src/store/file-lock.ts`
19. `packages/idea-engine/tests/*.test.ts`
20. `packages/idea-engine/tests/fixtures/*`

## 4. Narrow SOTA Preflight

本批必须先做 archive-first 的 narrow SOTA preflight，路径固定为：

- canonical archive:
  `/Users/fkg/.autoresearch-lab-dev/sota-preflight/2026-03-14/new-05a-stage3-search-step/preflight.md`
- worktree copy:
  `.tmp/new-05a-stage3-search-step-sota-preflight/preflight.md`

scope 只允许覆盖：

- RFC 8785 / JCS canonical JSON
- JSON-RPC 2.0 + OpenRPC
- Node.js file durability primitives for `fsync(file) + rename`

本轮 preflight 只用于确认：

- `search.step` request/result/error envelope 仍然遵守现有 contract
- idempotency replay 与 payload hash 不会漂移
- 本批对 crash/durability 的描述不超过当前 Python/TS substrate 已实际实现的语义

不得把这轮 preflight 作为借口去重开 operator/domain/runtime architecture。

## 5. GitNexus Hard Gate

### 5.1 Pre-implementation

1. Read `gitnexus://repo/autoresearch-lab/context`
2. If stale, run `npx gitnexus analyze`
3. Re-check key Python symbols:
   - `IdeaCoreService`
   - `EngineStore`
   - `handle_request`
   - `search_step`
   - `_choose_search_operator`
   - `_advance_island_state_one_tick`
4. Record clearly that GitNexus currently under-reports new `packages/idea-engine` TS symbols / helper callsites, so direct source inspection remains mandatory.

### 5.2 Pre-review

Because this batch adds new TS write-side symbols and changes the mutating call path:

1. run `npx gitnexus analyze`
2. run `detect_changes`
3. try `context` / `impact` on changed TS symbols
4. if GitNexus still misses them, explicitly record that failure and fall back to direct source inspection + targeted tests

Do not present partial graph coverage as complete post-change evidence.

## 6. Critical Boundary Notes

### 6.1 `search.step` is not “just more node writes”

当前 Python `search.step` 同时承担：

- campaign-scoped idempotency
- island-state machine updates
- `step_budget` fuse behavior
- campaign running/exhausted active-state checks
- domain-pack loading
- operator selection
- operator node materialization
- search-step / operator-trace / evidence-packet artifact writes

这是本批最大的 scope trap。

### 6.2 Migrate only the minimum live slice

本批允许迁移的 search/operator/domain 逻辑，仅限“为了让 `search.step` 当前 live authority 在 TS 中最小成立所必需”的那一部分。

这意味着：

- 允许最小 domain-pack metadata consumption
- 允许最小 operator selection / node materialization
- 允许最小 island-state persistence

但这不意味着：

- operator family migration
- domain-pack lane migration
- generalized operator registry redesign
- retrieval/eval/rank/promotion lane expansion

### 6.3 Idempotency semantics are part of the feature, not a wrapper

`search.step` 的 replay 不是外围 RPC 装饰，而是方法本身的活跃语义：

- same `idempotency_key` + same payload must replay the first result
- same `idempotency_key` + different payload must reject with conflict
- if the first call early-stopped after partial progress, replay must return that same partial result rather than generating fresh work

不得把 replay 简化为“再跑一遍试试”。

### 6.4 Do not smuggle semantic authority back into generic TS

generic `idea-engine` layer 仍然不得重新引入：

- `hep.bootstrap`
- `bootstrap_default`
- `toy_laptop`
- `HEP_COMPUTE_RUBRIC_RULES`
- any HEP-only taxonomy / lexicon / rubric / worldview authority

如果某段 search operator / domain-pack code 仍依赖 provider-local HEP semantics，必须清楚地把它限制在 provider-local current-authority slice，而不是升级成 generic default。

## 7. Minimal OpenRPC Parity Requirements

`search.step` 至少要对齐当前 OpenRPC / live authority 的这些边界：

- params:
  - `campaign_id`
  - `n_steps`
  - optional `step_budget`
  - `idempotency_key`
- result:
  - follow `search_step_result_v1.schema.json`
- normative errors:
  - `budget_exhausted` `(-32001)`
  - `campaign_not_found` `(-32003)`
  - `campaign_not_active` `(-32015)`

同时要保住当前 method description 中已经写死的行为：

- only permitted when campaign status is `running`
- per-tick atomicity
- overall call may early-stop with partial progress
- campaign status transitions caused during the call are part of the idempotency-protected side effects

## 8. Implementation Plan

1. Extend `packages/idea-engine/` with a dedicated `search.step` service rather than shoving everything into the current write service.
2. Reuse existing TS idempotency / payload-hash / RPC substrate; do not fork duplicate machinery.
3. Introduce the minimum operator-selection + node-materialization logic required for current `search.step` parity.
4. Persist the minimum island-state mutations and campaign status updates needed for parity.
5. Materialize only the minimal `search.step` artifacts required by current live authority / returned refs.
6. Generate Python-based checked-in fixtures for `search.step` RPC/store parity.
7. Add targeted TS tests before broadening method surface.

## 9. Suggested File Surface

The exact split may differ, but keep it small and SRP-compliant. A reasonable bounded shape is:

- `packages/idea-engine/src/service/search-step-service.ts`
- `packages/idea-engine/src/service/island-state.ts`
- `packages/idea-engine/src/service/search-operator.ts`
- `packages/idea-engine/tests/search-step-parity.test.ts` or equivalent
- `packages/idea-engine/tests/search-step-island-state.test.ts` or equivalent
- targeted updates to:
  - `packages/idea-engine/src/service/rpc-service.ts`
  - `packages/idea-engine/src/service/idempotency.ts`
  - `packages/idea-engine/src/service/domain-pack.ts`
  - `packages/idea-engine/src/store/engine-store.ts`
  - `packages/idea-engine/src/contracts/catalog.ts`
  - `packages/idea-engine/src/contracts/openrpc.ts`
  - `packages/idea-engine/tests/fixtures/*`

Avoid creating a new god file.

## 10. Acceptance Commands

At minimum run:

```bash
pnpm --filter @autoresearch/idea-engine build
pnpm --filter @autoresearch/idea-engine test
pnpm --filter @autoresearch/idea-engine test -- tests/write-rpc-parity.test.ts
pnpm --filter @autoresearch/idea-engine test -- tests/read-rpc-parity.test.ts
pnpm --filter @autoresearch/idea-engine test -- tests/payload-hash-parity.test.ts
cd packages/idea-core && pytest tests/engine/test_search_step_operator_m26.py tests/engine/test_search_step_island_state_machine.py tests/contracts/test_validate_contracts.py tests/engine/test_m2_12_demo_replay.py -q
! rg -n --glob '*.{ts,tsx}' 'hep\\.bootstrap|bootstrap_default|toy_laptop|HEP_COMPUTE_RUBRIC_RULES' packages/idea-engine/src
git diff --check
```

Add one or more new targeted tests for:

- `search.step` JSON-RPC parity
- idempotency replay/conflict
- `step_budget` early-stop behavior
- island-state transition parity
- artifact/store layout parity after `search.step`

Do not rely on aggregate `pnpm --filter @autoresearch/idea-engine test` alone: explicitly invoke the new TS `search.step` targeted test file(s) by path in the final acceptance run, and record the exact filenames in the implementation closeout if they differ from the suggested names above.

If fixture generation needs Python helper scripts, record the exact refresh command in the implementation closeout.

## 11. Formal Review / Self-Review Questions

Formal review and self-review must explicitly answer:

1. Why is `search.step` the right bounded next slice after write-side foundation, rather than `eval.run` or `EVO-13`?
2. Did the batch stay inside `search.step + minimal island-state + minimal step-budget + minimal artifact/store parity`?
3. Did the implementation truly align to Python live authority, not a TS-only approximation?
4. Did operator/domain-pack handling remain the minimum current-authority slice rather than reopening their migration lanes?
5. Did any domain-specific worldview authority leak back into generic TS?
6. If GitNexus still missed new TS symbols, was that failure explicitly recorded and replaced with exact direct verification?
7. Does the resulting code leave a cleaner entry point for a later bounded `eval.run` follow-up instead of a more tangled one?

## 12. Completion / SSOT Sync

After implementation:

- update `meta/remediation_tracker_v1.json`
- update `AGENTS.md`
- update `meta/REDESIGN_PLAN.md` only if lane sequencing or dependency narration materially changes
- do not update `.serena/memories/architecture-decisions.md` unless a new stable invariant truly emerged

The closeout note must explicitly state:

- what this batch completed
- what `search.step` authority still remains in Python, if any
- why `eval.run`, `rank.compute`, `node.promote`, `NEW-07`, and `EVO-13` remain unstarted
- whether GitNexus exact verification still required direct source inspection + targeted tests

## 13. Conditional Next Batch Recommendation

If this batch succeeds and parity is stable, the next batch should be:

- `eval.run` as a separate bounded follow-up

It should still not jump directly to:

- `rank.compute`
- `node.promote`
- operator-family migration as a whole
- domain-pack migration lane
- `NEW-07`
- `EVO-13`

If this batch instead exposes search/operator/artifact drift inside `search.step`, the next batch should be a smaller reconciliation follow-up rather than method-surface expansion.
