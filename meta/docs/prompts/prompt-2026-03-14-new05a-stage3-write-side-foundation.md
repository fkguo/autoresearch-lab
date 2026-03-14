# Prompt: 2026-03-14 Standalone — `NEW-05a Stage 3` Write-Side Foundation (`campaign.init` + Seed Node + Idempotency + Minimal Write RPC)

> 默认继承 `meta/docs/prompts/IMPLEMENTATION_PROMPT_CHECKLIST.md`。
>
> 本 prompt 对应一个新的实现对话，工作目录固定为：
> `/Users/fkg/Coding/Agents/autoresearch-lab-new05a-stage3-write-side-foundation`

## 0. Goal

在已经完成的 `NEW-05a Stage 3 foundation first slice` 之上，只做一个严格受限的 bounded follow-up：

- `packages/idea-engine/`
- `campaign.init`
- seed-node materialization
- prepared/committed idempotency
- minimal write-side JSON-RPC parity

不得扩到：

- `search.step`
- `eval.run`
- `rank.compute`
- `node.promote`
- operator families
- domain pack migration lane
- `NEW-07`
- `EVO-13`

## 1. Why This Batch Next

上一批已完成：

- TS store substrate
- read-side `campaign.status` / `node.get` / `node.list`
- minimal JSON-RPC read envelope
- JCS/RFC 8785 `payload_hash` parity
- Python-generated golden fixtures for read parity

authority 已明确给出下一批建议：应先做 `campaign.init + seed-node + write-side idempotency`，而不是直接跳到 `search.step` / operator families / domain pack / `EVO-13`。

## 2. Hard Scope Boundary

### 2.1 In scope

只允许做以下工作：

1. 在 `packages/idea-engine/` 中增加最小 write-side service，支持 `campaign.init`。
2. 迁移 Python `campaign.init` 所需的最小结构性 helper：
   - `_record_or_replay`
   - `_store_idempotency`
   - `_prepared_side_effects_committed` 中 `campaign.init` 分支
   - `_response_idempotency`
   - `_merge_registry_entries`
   - `_resolve_initial_island_count`
   - `_initial_island_states`
   - `_sanitize_evidence_uris`
   - `_formalize_rationale_to_idea_card`
   - `_seed_node`
   - `_refresh_island_population_sizes`
3. 让 TS `campaign.init` 与 Python live authority 对齐以下可核对结果：
   - `campaign.json`
   - `nodes_latest.json`
   - `nodes_log.jsonl`
   - global idempotency store prepared→committed state machine
   - JSON-RPC success/error envelope
4. 建立 Python-generated parity fixtures/tests，至少覆盖：
   - happy-path `campaign.init`
   - duplicate replay
   - idempotency conflict
   - prepared record recovery when side effects are absent
   - invalid request / invalid params / method-not-found / RPC error envelope parity

### 2.2 Explicitly out of scope

本批明确禁止：

- `search.step`
- `eval.run`
- `rank.compute`
- `node.promote`
- 任何 search/eval/rank/promote artifact semantics
- operator execution
- retrieval / novelty / reduction / compute-plan semantics
- 领域 pack 重构或 generic uplift
- `packages/idea-core/` 行为修改，除非只用于生成新的 checked-in parity fixture
- `NEW-07`
- `EVO-13`

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
   - `_record_or_replay`
   - `_store_idempotency`
   - `_prepared_side_effects_committed`
   - `_hash_without_idempotency`
   - `_response_idempotency`
   - `_merge_registry_entries`
   - `_resolve_initial_island_count`
   - `_initial_island_states`
   - `_resolve_domain_pack_for_charter`
   - `_sanitize_evidence_uris`
   - `_formalize_rationale_to_idea_card`
   - `_seed_node`
   - `campaign_init`
2. `packages/idea-core/src/idea_core/engine/store.py`
3. `packages/idea-core/src/idea_core/rpc/server.py`
4. `packages/idea-core/src/idea_core/contracts/catalog.py`
5. `packages/idea-core/contracts/idea-generator-snapshot/schemas/idea_core_rpc_v1.openrpc.json`
6. `packages/idea-core/src/idea_core/demo/m2_12_replay.py`

### 3.3 Current TS surface

1. `packages/idea-engine/src/index.ts`
2. `packages/idea-engine/src/store/engine-store.ts`
3. `packages/idea-engine/src/hash/payload-hash.ts`
4. `packages/idea-engine/src/service/read-service.ts`
5. `packages/idea-engine/src/service/validators.ts`
6. `packages/idea-engine/src/rpc/jsonrpc.ts`
7. `packages/idea-engine/tests/*.test.ts`

## 4. Narrow SOTA Preflight

Use the already-prepared preflight as authority guardrail:

- canonical archive:
  `/Users/fkg/.autoresearch-lab-dev/sota-preflight/2026-03-14/new-05a-stage3-write-side-foundation/preflight.md`
- worktree copy:
  `.tmp/new-05a-stage3-write-side-foundation-sota-preflight/preflight.md`

The preflight scope is intentionally narrow:

- RFC 8785 / JCS canonical JSON
- JSON-RPC 2.0 + OpenRPC
- Node.js file durability primitives for `fsync(file) + rename`

Do not use this preflight as a pretext to reopen operator/domain/runtime architecture.

## 5. GitNexus Hard Gate

### 5.1 Pre-implementation

1. Read `gitnexus://repo/autoresearch-lab/context`
2. If stale, run `npx gitnexus analyze`
3. Re-check key Python symbols:
   - `IdeaCoreService`
   - `EngineStore`
   - `handle_request`
   - `campaign_init`
   - `_hash_without_idempotency`
4. Record clearly that GitNexus currently under-reports `packages/idea-engine` TS symbols, so direct source inspection remains mandatory.

### 5.2 Pre-review

Because this batch adds new TS write-side symbols and changes the call path:

1. run `npx gitnexus analyze`
2. run `detect_changes`
3. try `context` / `impact` on changed TS symbols
4. if GitNexus still misses them, explicitly record that failure and fall back to direct source inspection + targeted tests

## 6. Critical Boundary Notes

### 6.1 `campaign.init` is not purely storage

Python `campaign.init` currently also performs:

- init-time domain pack selection
- abstract problem registry merge
- deterministic idea-card formalization for seeds

This is the main scope trap.

For this batch:

- init-time `domain_pack` persistence may be carried only as the minimum metadata needed for parity
- do not expand this into domain-pack migration or generic domain semantics
- seed formalization may be migrated only because it is currently deterministic, local, and required to create valid seed nodes

### 6.2 No semantic lane smuggling

The TS generic layer must not reintroduce:

- `hep.bootstrap`
- `bootstrap_default`
- `toy_laptop`
- `HEP_COMPUTE_RUBRIC_RULES`
- any HEP-only rubric, taxonomy, lexicon, or worldview authority

### 6.3 Durability claim discipline

Match Python's current semantics only:

- temp file write
- file `fsync`
- atomic rename

Do not claim stronger directory-durable crash consistency in this batch.

## 7. Implementation Plan

1. Add a write-side contract/validation layer in `packages/idea-engine/` that reuses vendored OpenRPC/schema authority for `campaign.init` params/result and seed-node schema checks.
2. Introduce a dedicated write service rather than folding mutation semantics into the existing read service.
3. Generalize JSON-RPC dispatch from read-only handling to a minimal service interface that can route `campaign.init` while preserving current read behavior unchanged.
4. Reuse existing `hashWithoutIdempotency()` for write-side idempotency; do not fork a second hashing implementation.
5. Implement global-scope idempotency for `campaign.init`, including:
   - initial replay lookup
   - conflict rejection
   - prepared record write
   - side-effect commit
   - replay-on-duplicate with `is_replay: true`
6. Materialize valid seed nodes and persist:
   - `campaign.json`
   - `nodes_latest.json`
   - `nodes_log.jsonl`
7. Create Python-generated parity fixtures for write-side RPC/store behavior.
8. Expand tests before touching broader method surface.

## 8. Suggested File Surface

The exact file split may differ, but keep it small and SRP-compliant. A reasonable bounded shape is:

- `packages/idea-engine/src/service/write-service.ts`
- `packages/idea-engine/src/service/idempotency.ts`
- `packages/idea-engine/src/service/seed-node.ts`
- `packages/idea-engine/src/service/contracts.ts` or equivalent narrow schema helper
- targeted updates to:
  - `packages/idea-engine/src/index.ts`
  - `packages/idea-engine/src/rpc/jsonrpc.ts`
  - `packages/idea-engine/src/contracts/openrpc.ts`

Avoid creating a new god file.

## 9. Acceptance Commands

At minimum run:

```bash
pnpm --filter @autoresearch/idea-engine build
pnpm --filter @autoresearch/idea-engine test
pnpm --filter @autoresearch/idea-engine test -- tests/read-rpc-parity.test.ts
pnpm --filter @autoresearch/idea-engine test -- tests/payload-hash-parity.test.ts
cd packages/idea-core && pytest tests/engine/test_node_read_methods.py tests/engine/test_service_rank_and_idempotency.py tests/contracts/test_validate_contracts.py tests/engine/test_m2_12_demo_replay.py -q
! rg -n --glob '*.{ts,tsx}' 'hep\\.bootstrap|bootstrap_default|toy_laptop|HEP_COMPUTE_RUBRIC_RULES' packages/idea-engine/src
git diff --check
```

Add one or more new targeted tests for:

- `campaign.init` JSON-RPC parity
- write-side idempotency replay/conflict
- prepared record recovery
- store layout parity after init

If fixture generation needs Python helper scripts, record the exact refresh command in the implementation closeout.

## 10. Formal Review / Self-Review Questions

Formal review and self-review must explicitly answer:

1. Why is this still the right bounded second slice of `NEW-05a Stage 3`, rather than `search.step` or `EVO-13`?
2. Did the batch stay inside `campaign.init + seed-node + prepared/committed idempotency + minimal write RPC`?
3. Did the implementation truly align to Python live authority, not a TS-only approximation?
4. Did init-time `domain_pack` handling remain metadata-only rather than reopening the domain-pack lane?
5. Did any domain-specific authority leak back into generic TS?
6. Does the resulting code leave a cleaner entry point for a later `search.step` follow-up instead of a more tangled one?

## 11. Completion / SSOT Sync

After implementation:

- update `meta/remediation_tracker_v1.json`
- update `AGENTS.md`
- update `meta/REDESIGN_PLAN.md` only if lane sequencing or dependency narration materially changes
- do not update `.serena/memories/architecture-decisions.md` unless a new stable invariant truly emerged

The closeout note must explicitly state:

- what this batch completed
- what write-side authority still remains in Python
- why `search.step`, `NEW-07`, and `EVO-13` remain unstarted

## 12. Conditional Next Batch Recommendation

If this batch succeeds and parity is stable, the next batch should be:

- `search.step` as a separate bounded follow-up

It should still not jump directly to:

- operator family migration as a whole
- domain pack migration lane
- `EVO-13`

If this batch instead exposes contract/store drift around `campaign.init`, the next batch should be a smaller reconciliation follow-up rather than method-surface expansion.
