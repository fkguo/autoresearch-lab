# NEW-R05 Remove Live Raw-PDF Producer Path

## Intent

This is the canonical implementation prompt for the **next bounded `NEW-R05` slice** after the already-landed:

- 2026-03-30 paper-identity fail-closed slice;
- 2026-04-02 shared writing/semantic authority convergence slice; and
- 2026-04-04 raw-producer naming-boundary slice.

That earlier 2026-04-04 boundary slice is already reflected in checked-in tracker / plan truth: the remaining `packages/hep-mcp/src/core/pdf/evidence.ts` surface is no longer a shared-authority naming problem. It is now an explicit **raw producer**.

The next question is no longer "should we clarify that raw boundary?" but rather:

- should `hep-mcp` keep a live repo-owned raw PDF parsing / page-region evidence production path at all?

For this slice, the architectural answer is **no**.

The target runtime posture is:

- if a paper has LaTeX, LaTeX remains authoritative;
- if a paper does not have LaTeX, direct PDF reading should happen through model/runtime multimodal capability at the agent layer, not by maintaining a separate in-repo raw-PDF evidence production pipeline inside `hep-mcp`;
- therefore `hep_run_build_pdf_evidence` and the `pdf_source` branch of `hep_run_build_writing_evidence` should stop being live default workflow surfaces.

This slice should remove that live raw-PDF producer path in a bounded way, without reopening settled `NEW-R05` authority work and without inventing a new repo-internal multimodal ingestion stack.

## Read First

Implementation lane must read, in order:

1. `/Users/fkg/Coding/Agents/autoresearch-lab/AGENTS.md`
2. `/Users/fkg/Coding/Agents/autoresearch-lab/meta/remediation_tracker_v1.json`
3. the full `NEW-R05` section in `/Users/fkg/Coding/Agents/autoresearch-lab/meta/REDESIGN_PLAN.md`
4. `/Users/fkg/Coding/Agents/autoresearch-lab/meta/docs/prompts/IMPLEMENTATION_PROMPT_CHECKLIST.md`
5. current live source surfaces:
   - `/Users/fkg/Coding/Agents/autoresearch-lab/packages/hep-mcp/src/core/pdf/evidence.ts`
   - `/Users/fkg/Coding/Agents/autoresearch-lab/packages/hep-mcp/src/core/writing/evidence.ts`
   - `/Users/fkg/Coding/Agents/autoresearch-lab/packages/hep-mcp/src/core/evidenceSemantic.ts`
   - `/Users/fkg/Coding/Agents/autoresearch-lab/packages/hep-mcp/src/tools/registry/projectCore.ts`
   - `/Users/fkg/Coding/Agents/autoresearch-lab/packages/hep-mcp/src/tools/registry/projectSchemas.ts`
   - `/Users/fkg/Coding/Agents/autoresearch-lab/packages/hep-mcp/src/tools/registry/shared.ts`
   - `/Users/fkg/Coding/Agents/autoresearch-lab/packages/hep-mcp/src/tool-names.ts`
   - `/Users/fkg/Coding/Agents/autoresearch-lab/packages/hep-mcp/src/tool-risk.ts`
6. directly affected tests / locks:
   - `/Users/fkg/Coding/Agents/autoresearch-lab/packages/hep-mcp/tests/core/pdfEvidence.test.ts`
   - `/Users/fkg/Coding/Agents/autoresearch-lab/packages/hep-mcp/tests/core/writingEvidence.test.ts`
   - `/Users/fkg/Coding/Agents/autoresearch-lab/packages/hep-mcp/tests/toolContracts.test.ts`
   - `/Users/fkg/Coding/Agents/autoresearch-lab/packages/hep-mcp/tests/core/evidenceCatalog.test.ts`
7. front-door live docs / inventories:
   - `/Users/fkg/Coding/Agents/autoresearch-lab/docs/ARCHITECTURE.md`
   - `/Users/fkg/Coding/Agents/autoresearch-lab/docs/TESTING_GUIDE.md`
   - `/Users/fkg/Coding/Agents/autoresearch-lab/docs/TOOL_CATEGORIES.md`
   - `/Users/fkg/Coding/Agents/autoresearch-lab/packages/hep-mcp/tool_catalog.standard.json`
   - `/Users/fkg/Coding/Agents/autoresearch-lab/packages/hep-mcp/tool_catalog.full.json`
   - `/Users/fkg/Coding/Agents/autoresearch-lab/packages/hep-autoresearch/references/hep-research-mcp/tool_inventory.md`
   - `/Users/fkg/Coding/Agents/autoresearch-lab/packages/hep-autoresearch/references/hep-research-mcp/tool_inventory.json`

## GitNexus And Serena

- Activate Serena on the implementation worktree before using Serena output as authority.
- Run onboarding check before Serena-guided navigation.
- Read GitNexus repo context before coding.
- Once the worktree is dirty, refresh with `npx gitnexus analyze --force` before relying on graph evidence or assembling review packets.
- Before formal review, rerun GitNexus freshness and capture `detect_changes`; use `impact` if removal blast radius is larger than the expected tool/writing/docs surfaces.

## Current Source Truth

Before implementation, the lane must explicitly verify and preserve these facts:

1. The 2026-04-04 raw-producer naming cleanup is already closed:
   `core/pdf/evidence.ts` is not the remaining shared-authority drift problem.
2. The current live raw-PDF path is still real:
   - `buildRunPdfEvidence(...)` still exists and is still exposed as `hep_run_build_pdf_evidence`;
   - `buildRunWritingEvidence(...)` still accepts `pdf_source` and still calls `buildRunPdfEvidence(...)`;
   - front-door docs / tool catalogs still advertise `hep_run_build_pdf_evidence`.
3. Shared consumer authority convergence is already closed:
   - project / LaTeX evidence authority;
   - writing / semantic PDF promotion authority;
   - measurements consumer authority.
4. The next slice must therefore be framed as **removal of a live optional producer path**, not as another authority-convergence rename/refactor.

## Exact Scope

### In scope

1. Remove the live public raw-PDF producer tool surface from `hep-mcp`:
   - remove `HEP_RUN_BUILD_PDF_EVIDENCE` from live registry / tool-name / risk-map / ordering logic if no remaining runtime caller needs it;
   - remove the `projectCore` registration / schema / catalog presence for `hep_run_build_pdf_evidence`;
   - update checked-in tool catalogs and any mirrored tool inventories that still present it as a live tool.
2. Remove `hep_run_build_writing_evidence`'s dependency on the raw-PDF producer:
   - remove the `pdf_source` input surface from the live writing-evidence front door;
   - remove the `buildRunPdfEvidence(...)` call path from `core/writing/evidence.ts`;
   - remove PDF-source-only status / meta / artifact production that exists only because of that live raw-PDF branch.
3. Keep LaTeX-first writing / semantic flow intact:
   - `latex_sources` and bridge artifacts remain the supported writing-evidence inputs;
   - the tool must still work for LaTeX-backed runs and bridge-only cases that are already source-proven today.
4. Keep generic downstream consumers bounded:
   - shared `EvidenceType` members such as `pdf_page` / `pdf_region` may remain if they are still generic evidence-surface vocabulary or eval-fixture inputs;
   - do **not** widen this slice into deleting every `pdf_page` / `pdf_region` consumer from shared contracts, localization, fusion, or eval harnesses unless source proof shows a direct, unavoidable dependency on the removed raw producer.
5. Update directly affected tests and docs so public truth matches runtime truth.

### Out of scope

- Do not introduce a new in-repo OCR / parser / page-image / region-extraction replacement.
- Do not add a new direct multimodal PDF-reading framework inside `hep-mcp`.
- Do not reopen the settled paper-identity fail-closed or shared-authority convergence work.
- Do not redesign shared `EvidenceCatalogItemV1`, shared `PdfLocatorV1`, or shared `EvidenceType`.
- Do not widen into a repo-wide `SEM-06f` redesign or shared multimodal strategy rewrite.
- Do not claim that "PDF handling is solved" after this slice; the claim is only that the repo-owned raw-PDF evidence production path has been removed from the current live `hep-mcp` loop.

## Required Design Constraints

1. **LaTeX-first remains authoritative**:
   if LaTeX exists, this slice must not degrade that path.
2. **No hidden raw-PDF fallback may remain**:
   after this slice, `hep-mcp` should not silently keep reparsing PDF through a renamed private helper while pretending the producer path was removed.
3. **Fail closed rather than grow a replacement stack**:
   if a current workflow depended on `pdf_source` / `hep_run_build_pdf_evidence`, the bounded fix is to remove that workflow surface and update docs/tests truthfully, not to sneak in a new parser or multimodal surrogate.
4. **Front-door truth must match runtime truth**:
   tool catalogs, reference inventories, and docs must not keep advertising `hep_run_build_pdf_evidence` or `pdf_source` after code removal.
5. **Keep blast radius bounded**:
   the lane is not allowed to opportunistically re-architect shared multimodal retrieval just because some eval fixtures still mention `pdf_page` / `pdf_region`.

## Independent Review Targets

Formal reviewers must independently inspect at least:

- `/Users/fkg/Coding/Agents/autoresearch-lab/packages/hep-mcp/src/core/writing/evidence.ts`
- `/Users/fkg/Coding/Agents/autoresearch-lab/packages/hep-mcp/src/core/evidenceSemantic.ts`
- `/Users/fkg/Coding/Agents/autoresearch-lab/packages/hep-mcp/src/tools/registry/projectCore.ts`
- `/Users/fkg/Coding/Agents/autoresearch-lab/packages/hep-mcp/src/tools/registry/projectSchemas.ts`
- `/Users/fkg/Coding/Agents/autoresearch-lab/packages/hep-mcp/src/tools/registry/shared.ts`
- `/Users/fkg/Coding/Agents/autoresearch-lab/packages/hep-mcp/src/tool-names.ts`
- `/Users/fkg/Coding/Agents/autoresearch-lab/packages/hep-mcp/src/tool-risk.ts`
- the listed docs / tool-catalog / reference-inventory files
- the listed tests / contracts

Reviewers must explicitly challenge, not assume:

- whether `hep_run_build_pdf_evidence` is truly gone from the live public surface;
- whether `hep_run_build_writing_evidence` still has any effective raw-PDF branch after implementation;
- whether docs / tool catalogs / inventories stayed truthful;
- whether the lane stayed bounded instead of expanding into a multimodal-retrieval redesign;
- whether leaving shared `pdf_page` / `pdf_region` vocabulary in place remains source-grounded and non-misleading after producer removal.

## Front-door Surface Audit

Because this slice removes a public tool surface and a live writing-evidence input surface, the review packet must include a front-door audit covering at least:

- `/Users/fkg/Coding/Agents/autoresearch-lab/docs/ARCHITECTURE.md`
- `/Users/fkg/Coding/Agents/autoresearch-lab/docs/TESTING_GUIDE.md`
- `/Users/fkg/Coding/Agents/autoresearch-lab/docs/TOOL_CATEGORIES.md`
- `/Users/fkg/Coding/Agents/autoresearch-lab/packages/hep-mcp/tool_catalog.standard.json`
- `/Users/fkg/Coding/Agents/autoresearch-lab/packages/hep-mcp/tool_catalog.full.json`
- `/Users/fkg/Coding/Agents/autoresearch-lab/packages/hep-autoresearch/references/hep-research-mcp/tool_inventory.md`
- `/Users/fkg/Coding/Agents/autoresearch-lab/packages/hep-autoresearch/references/hep-research-mcp/tool_inventory.json`

If the lane finds other live front-door surfaces still claiming that `hep_run_build_pdf_evidence` or `pdf_source` is part of the current workflow, update them in-batch or explicitly justify why they are not live / not authoritative.

## Acceptance Commands

Minimum acceptance for the implementation lane:

- `git diff --check`
- `pnpm --filter @autoresearch/hep-mcp build`
- `pnpm --filter @autoresearch/hep-mcp test -- tests/core/writingEvidence.test.ts`
- `pnpm --filter @autoresearch/hep-mcp test -- tests/core/evidenceCatalog.test.ts`
- `pnpm --filter @autoresearch/hep-mcp test -- tests/toolContracts.test.ts`
- `pnpm --filter @autoresearch/hep-mcp test -- tests/eval/evalCoverage.test.ts tests/eval/evalEvidence.test.ts tests/eval/evalSem06EvidenceRetrieval.test.ts`
- `pnpm --filter @autoresearch/hep-mcp catalog`
- `pnpm --filter @autoresearch/hep-mcp docs:tool-counts:check`
- `rg -n "hep_run_build_pdf_evidence|pdf_source" /Users/fkg/Coding/Agents/autoresearch-lab/packages/hep-mcp/src /Users/fkg/Coding/Agents/autoresearch-lab/packages/hep-mcp/tests /Users/fkg/Coding/Agents/autoresearch-lab/docs /Users/fkg/Coding/Agents/autoresearch-lab/packages/hep-autoresearch/references/hep-research-mcp`

At closeout, any remaining matches from the final `rg` must be explicitly justified as historical prompt/docs material or generic future-facing vocabulary rather than live runtime/front-door authority.

## Review Requirements

Formal trio review is mandatory:

- `Opus`
- `Gemini(auto)`
- `OpenCode(zhipuai-coding-plan/glm-5.1)`

Rules:

- No fallback reviewer substitution without explicit human approval.
- Reviewers must inspect source, callers, tests, tool catalogs, and live docs.
- Reviewers must verify that this lane removed the live raw-PDF producer surface rather than merely renaming it.
- Reviewers must verify that the lane did **not** silently replace it with a new parser / OCR / multimodal stack.
- Reviewers must explicitly assess whether leaving generic `pdf_page` / `pdf_region` consumer/eval vocabulary in place is still truthful and bounded after removal.
- If `Gemini(auto)` or OpenCode initial runs fail to produce a usable source-grounded verdict, prefer same-model rerun with an embedded-source widened packet rather than shrinking to diff-only review.
- Formal self-review is also required after trio convergence.

## Expected Closeout Claims

If this slice succeeds, the truthful closeout claim is:

- `hep_run_build_pdf_evidence` is no longer part of the live `hep-mcp` public tool surface;
- `hep_run_build_writing_evidence` no longer accepts or consumes `pdf_source` as a live raw-PDF branch;
- the supported in-repo writing-evidence path is now LaTeX-first plus bridge-artifact inputs only;
- direct PDF reading, when needed, is intentionally left to agent/runtime multimodal capability rather than maintained here as a raw-PDF evidence production pipeline;
- any remaining `pdf_page` / `pdf_region` vocabulary is now only generic shared/eval consumer surface, not proof that a live raw-PDF producer still exists in `hep-mcp`.
