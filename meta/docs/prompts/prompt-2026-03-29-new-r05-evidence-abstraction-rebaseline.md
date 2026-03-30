# NEW-R05 Evidence Abstraction Rebaseline

## Intent

This is the canonical implementation prompt for the next truthful `NEW-R05` slice after the 2026-03-30 governance rebaseline.

The goal is not to re-implement evidence schemas or reopen computation evidence. The goal is to finish the smallest real runtime authority seam still left open:

- complete shared evidence authority at the PDF -> writing / semantic boundary;
- remove synthetic PDF paper identity fallback from the semantic path;
- replace residual consumer-local evidence-like types where the input already matches the shared contract.

## Read First

Implementation lane must read, in order:

1. `AGENTS.md`
2. `meta/remediation_tracker_v1.json`
3. the full `NEW-R05` section in `meta/REDESIGN_PLAN.md`
4. `meta/docs/prompts/IMPLEMENTATION_PROMPT_CHECKLIST.md`
5. shared evidence substrate:
   - `meta/schemas/evidence_catalog_item_v1.schema.json`
   - `packages/shared/src/generated/evidence-catalog-item-v1.ts`
   - `meta/generated/python/evidence_catalog_item_v1.py`
6. current live LaTeX/shared authority:
   - `packages/hep-mcp/src/core/evidence.ts`
7. current pending PDF / consumer seams:
   - `packages/hep-mcp/src/core/pdf/evidence.ts`
   - `packages/hep-mcp/src/core/writing/evidence.ts`
   - `packages/hep-mcp/src/core/evidenceSemantic.ts`
   - `packages/hep-mcp/src/core/hep/measurements.ts`
8. targeted tests:
   - `packages/hep-mcp/tests/core/evidenceCatalog.test.ts`
   - `packages/hep-mcp/tests/core/pdfEvidence.test.ts`
   - `packages/hep-mcp/tests/core/writingEvidence.test.ts`
   - `packages/hep-mcp/tests/core/hepMeasurements.test.ts`

## GitNexus And Serena

- Activate Serena on the current implementation worktree before using Serena output as authority.
- Run onboarding check before Serena-guided navigation.
- Read GitNexus repo context before coding.
- If the worktree is dirty or contains new symbols/callsites, refresh with `npx gitnexus analyze --force` before relying on graph evidence.
- Before formal review, rerun GitNexus freshness and capture `detect_changes`; use `impact` / `context` if the changed authority map is not obvious from direct source inspection.

## Exact Scope

### In scope

- Add `paper_id?: string` to `WritingPdfSourceInput`.
- When PDF evidence is promoted into writing / semantic artifacts, require a real paper identity from either:
  - explicit `pdf_source.paper_id`, or
  - exactly one successful LaTeX source paper in the same run.
- If neither source of paper identity exists, fail closed instead of fabricating `run_pdf`.
- Use shared generated `EvidenceCatalogItemV1` and shared `PdfLocatorV1` for PDF items that enter writing / semantic catalogs, embeddings, and semantic-query candidate flow.
- Replace `EvidenceCatalogItemV1Like` with the shared generated type wherever the input is already LaTeX catalog-shaped.
- Replace the local `EvidenceType` union in `packages/hep-mcp/src/core/hep/measurements.ts` with the shared generated `EvidenceType` (or a compatible subset derived from it) so that measurements no longer carries a second evidence-type authority.
- Update or add targeted tests that prove the new fail-closed paper identity behavior and the shared-type consumer boundary.

### Out of scope

- Do not edit `meta/schemas/evidence_catalog_item_v1.schema.json`.
- Do not edit `ComputationEvidenceCatalogItemV1`, `meta/schemas/computation_evidence_catalog_item_v1.schema.json`, or `NEW-CONN-03`.
- Do not redesign the standalone `hep_run_build_pdf_evidence` storage format.
- Do not broaden this slice into a full evidence-index redesign, computation-evidence bridge redesign, or semantic ranking overhaul.
- Do not mark `NEW-R05` done unless the real runtime authority evidence justifies it.

## Required Design Constraints

1. Shared generated evidence types remain the only new canonical authority for the consumer surfaces touched in this slice.
2. Do not introduce a second fallback paper identity source after removing `run_pdf`.
3. If a compatibility adapter is still needed, it must be visibly derived from shared generated evidence truth rather than a new hand-maintained local interface.
4. Do not reopen computation evidence. `ComputationEvidenceCatalogItemV1` stays parallel and already closed under `NEW-CONN-03`.
5. Keep the change bounded to the PDF -> writing / semantic boundary plus directly affected tests.

## Public Interface Change

- `WritingPdfSourceInput.paper_id?: string`

## Acceptance Commands

Minimum acceptance for the implementation lane:

- `git diff --check`
- `pnpm --filter @autoresearch/hep-mcp test -- tests/core/evidenceCatalog.test.ts`
- `pnpm --filter @autoresearch/hep-mcp test -- tests/core/pdfEvidence.test.ts`
- `pnpm --filter @autoresearch/hep-mcp test -- tests/core/writingEvidence.test.ts`
- `pnpm --filter @autoresearch/hep-mcp test -- tests/core/hepMeasurements.test.ts`
- `rg -n "@autoresearch/shared|EvidenceCatalogItemV1|LatexLocatorV1|PdfLocatorV1" packages/hep-mcp/src/core/evidence.ts`
- `rg -n "PdfEvidenceCatalogItemV1|EvidenceCatalogItemV1Like|run_pdf|ComputationEvidenceCatalogItemV1|type EvidenceType =" packages/hep-mcp/src/core/pdf/evidence.ts packages/hep-mcp/src/core/writing/evidence.ts packages/hep-mcp/src/core/hep/measurements.ts packages/hep-mcp/src/core/evidenceSemantic.ts packages/hep-mcp/src/tools/ingest-skill-artifacts.ts`

## Review Requirements

Formal trio review is mandatory:

- `Opus`
- `Gemini-3.1-Pro-Preview`
- `OpenCode(zhipuai-coding-plan/glm-5.1)`

Rules:

- No fallback reviewer substitution without explicit human approval.
- Reviewers must check source, callers, tests, and whether shared evidence authority actually replaced the remaining local consumer authority on this boundary.
- If Gemini or OpenCode initial runs fail to produce a usable source-grounded verdict, prefer same-model rerun with an embedded-source packet rather than shrinking to diff-only review.
- Formal self-review is also required after trio convergence.

## Expected Closeout Claim

If this slice succeeds, the truthful claim is narrow:

- PDF evidence that enters writing / semantic artifacts now carries a real paper identity or fails closed.
- The touched writing / semantic / measurement consumers now derive evidence shape from shared generated authority instead of residual local evidence-like interfaces.
- Standalone PDF evidence storage format and computation evidence remain unchanged and outside this slice.
