# Prompt Pack: 2026-03-09 Re-baseline Batches

> 用于后续新开实现对话。默认继承 `meta/docs/prompts/IMPLEMENTATION_PROMPT_CHECKLIST.md`。
>
> 本批 prompt pack 的目标不是直接实现 `P5A`，而是先清理会污染 `NEW-05a Stage 3` 与后续 product boundary 的 generic-layer / core-layer 历史漂移。

## 推荐顺序

1. `prompt-2026-03-09-batch1-shared-boundary.md`
2. `prompt-2026-03-09-batch2-idea-core-domain-boundary.md`
3. `prompt-2026-03-10-formalism-contract-boundary.md`
4. `prompt-2026-03-09-batch3-runtime-root-dehep.md`

> GitNexus refresh is required **before Batch 1 implementation starts**, not for this doc-only prompt/ADR review batch.

## 为什么是这个顺序

- `Batch 1` 先处理 `packages/shared/` 的 authority 漂移；这是当前最大 blast radius，也是 `NEW-05a Stage 3` 的直接污染源。
- `Batch 2` 先处理 `idea-core` 的 HEP compute/domain 假设；它已经完成局部清理，但在 closeout 前暴露出更深的 repo-level `formalism` public-contract 问题。
- `2026-03-10 formalism follow-up` 专门处理 `candidate_formalisms[]` / `formalism_registry` / `formalism_check` 与 shipped concrete formalism ids 的去实例化；这是 batch2 closeout 与后续 tool-ecology 边界净化的前置条件。
- `Batch 3` 最后处理 runtime/provider/root 的命名与入口去 HEP 占位；它重要，但不解决 `formalism` contract leakage，因此应在 follow-up 之后执行。

## 当前设计结论锚点

- ADR: `meta/docs/2026-03-09-root-ecosystem-boundary-adr.md`
- `formalism` 边界 memo: `meta/docs/2026-03-10-formalism-boundary-sota-memo.md`
- `NEW-05a` product-boundary constraint: `meta/REDESIGN_PLAN.md:223`
- `P5A/P5B` productization constraint: `meta/REDESIGN_PLAN.md:2555`
- `EVO-13` non-product-agent constraint: `meta/REDESIGN_PLAN.md:2803`

## 多模型评审状态

- `Opus`: `.review/2026-03-09-root-ecosystem-boundary/out/opus.json`
- `Kimi K2.5`: `.review/2026-03-09-root-ecosystem-boundary/out/k2p5.json`
- R2: `.review/2026-03-09-root-ecosystem-boundary/r2/out/opus_r2.json`, `.review/2026-03-09-root-ecosystem-boundary/r2/out/k2p5_r2.json`
- `Gemini-3.1-Pro-Preview`: 本轮本地 reviewer 挂起，无有效产出；见 `.review/2026-03-09-root-ecosystem-boundary/out/trace.jsonl`
