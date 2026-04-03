# NEW-R05 Shared Evidence Authority Convergence First (PDF→Writing/Semantic + Measurements)

## Intent

This is the approved implementation charter for the **smallest next `NEW-R05` slice** after the 2026-03-30 paper-identity fail-closed lane.

The goal is **shared evidence authority convergence** (not a PDF subsystem rewrite):

- converge the **live PDF → writing/semantic boundary** onto shared generated evidence contracts (`EvidenceType`, `PdfLocatorV1`, `EvidenceCatalogItemV1`);
- remove the most direct remaining **consumer-local evidence authority** in `hep/measurements.ts`;
- preserve the already-locked invariants:
  - LaTeX-first authority for a paper;
  - same-paper PDF skip **before** `buildRunPdfEvidence`;
  - fail-closed PDF paper identity (no synthetic fallbacks).

## Read First (Hard Gate)

Implementation lane must read, in order:

1. `AGENTS.md`
2. `meta/remediation_tracker_v1.json`
3. the full `NEW-R05` section in `meta/REDESIGN_PLAN.md`
4. `meta/docs/plans/2026-03-31-new-r05-shared-evidence-authority-convergence-plan.md`
5. `meta/docs/prompts/IMPLEMENTATION_PROMPT_CHECKLIST.md`
6. the previous bounded lane prompt (do not regress its invariants):
   - `meta/docs/prompts/prompt-2026-03-30-new-r05-paper-identity-fail-closed-first.md`
7. current residual seam sources:
   - `packages/hep-mcp/src/core/pdf/evidence.ts`
   - `packages/hep-mcp/src/core/writing/evidence.ts`
   - `packages/hep-mcp/src/core/evidenceSemantic.ts` (context only; edit only if strictly required)
   - `packages/hep-mcp/src/core/hep/measurements.ts`
   - shared authority reference: `packages/shared/src/generated/evidence-catalog-item-v1.ts`
8. directly affected tests:
   - `packages/hep-mcp/tests/core/writingEvidence.test.ts`
   - `packages/hep-mcp/tests/core/pdfEvidence.test.ts`
   - `packages/hep-mcp/tests/core/evidenceCatalog.test.ts`
   - `packages/hep-mcp/tests/core/hepMeasurements.test.ts`

## Scope

### In scope

**A) PDF → writing/semantic boundary convergence**

1. Stop importing / using hep-mcp local PDF evidence authority types in writing evidence:
   - remove dependency on `PdfEvidenceCatalogItemV1` / `PdfEvidenceType` / local `PdfLocatorV1` from `packages/hep-mcp/src/core/pdf/evidence.ts`.
2. Treat shared generated contracts as the authority for the **writing/semantic surfaces**:
   - use shared `EvidenceType` (including `pdf_page`/`pdf_region`) and shared `EvidenceCatalogItemV1` for the PDF writing/semantic catalog.
3. Keep `hep_run_build_pdf_evidence` as an internal producer step, but **do not treat its raw catalog as the writing/semantic authority surface**:
   - after `buildRunPdfEvidence`, read the raw run PDF catalog and materialize a new **shared-authority PDF catalog** artifact that includes a real `paper_id`.
   - set `writing_evidence_meta_v1.json` `pdf.catalog_uri` to the shared-authority catalog artifact (so semantic loading uses the converged surface).

**B) Measurements shared-authority convergence**

4. Remove `packages/hep-mcp/src/core/hep/measurements.ts` local:
   - LaTeX-only `EvidenceType` union,
   - `EvidenceCatalogItemV1Like` interface,
   and consume shared generated evidence authority instead.
5. Preserve measurements semantics as *LaTeX-only* by explicit guards:
   - only accept items where `locator.kind === 'latex'`,
   - keep `include_types` limited to the LaTeX subset (tool schema already enforces this; TS types must not accidentally widen behavior).

### Out of scope

- Do **not** redesign `meta/schemas/evidence_catalog_item_v1.schema.json`.
- Do **not** reopen `NEW-CONN-03` / computation evidence (`ComputationEvidenceCatalogItemV1`).
- Do **not** change the public tool schemas for:
  - `hep_run_build_pdf_evidence`,
  - `hep_run_build_writing_evidence`,
  - `hep_project_query_evidence_semantic`.
- Do **not** weaken the paper-identity / LaTeX-first behavior that just landed.
- Do **not** broaden this slice into a repo-wide evidence cleanup.

## Required Design Constraints (Must Preserve Invariants)

1. **LaTeX-first**: if a paper has successful LaTeX authority in the run, LaTeX remains the only writing/semantic authority for that paper in this slice.
2. **Same-paper PDF skip happens before build**: if the PDF source resolves to a paper that already has successful LaTeX authority in the same run, the code must skip **before** calling `buildRunPdfEvidence`.
3. **Fail-closed PDF paper identity**: PDF writing/semantic surfaces must have a real `paper_id` and must not fabricate any synthetic identity (no `run_pdf`-style fallback).
4. **No behavior drift**: changes are typing/marshalling/authority convergence; preserve output semantics (hit counts, skip behavior, error codes) except where explicitly intended by this prompt.

## Implementation Notes (Recommended Decisions)

These decisions keep the slice small and low-risk:

- Keep `buildRunPdfEvidence` runtime behavior unchanged (it can keep emitting its existing run-local catalog artifact).
- Materialize a new shared-authority PDF writing catalog artifact **in `buildRunWritingEvidence`**, after paper identity is resolved:
  - each item must include `paper_id` (from the already-resolved `pdfIdentity.paper_id`);
  - use shared `EvidenceType` and shared `PdfLocatorV1` shape for `locator`;
  - do not attempt to reinterpret/standardize bbox coordinate spaces in this slice:
    - prefer `locator: { kind: 'pdf', page }` (omit bbox/char offsets),
    - preserve existing bbox/visual coordinates in `meta` (`bbox_pixels`, `region_uri`, `page_render_uri`) for future localization work.
- Do not re-materialize / change `evidence_id` in this slice; keep IDs stable to avoid hidden retrieval drift.

## Acceptance Commands

Minimum acceptance:

- `git diff --check`
- `pnpm --filter @autoresearch/hep-mcp build`
- `pnpm --filter @autoresearch/hep-mcp test -- tests/core/writingEvidence.test.ts`
- `pnpm --filter @autoresearch/hep-mcp test -- tests/core/pdfEvidence.test.ts`
- `pnpm --filter @autoresearch/hep-mcp test -- tests/core/evidenceCatalog.test.ts`
- `pnpm --filter @autoresearch/hep-mcp test -- tests/core/hepMeasurements.test.ts`

Source-proof sanity checks (post-change):

- `rg -n "PdfEvidenceCatalogItemV1|PdfEvidenceType|EvidenceCatalogItemV1Like" packages/hep-mcp/src/core || true`
- `rg -n "run_pdf" packages/hep-mcp/src/core packages/hep-mcp/tests || true`

## Review Requirements

Formal trio review is mandatory:

- `Opus`
- `Gemini-3.1-Pro-Preview`
- `OpenCode(zhipuai-coding-plan/glm-5.1)`

Reviewers must explicitly confirm:

1. LaTeX-first and same-paper PDF skip still occurs *before* `buildRunPdfEvidence`.
2. PDF paper identity remains fail-closed (no synthetic identity leakage).
3. The semantic path reads a shared-authority PDF catalog that includes real per-item `paper_id` (not a guessed default-only surface).
4. Measurements remains LaTeX-only while consuming shared generated evidence types.

Gemini reviewer handling:

- No reviewer substitution without explicit human approval.
- If Gemini cannot produce a usable source-grounded verdict, prefer same-model rerun with an embedded-source packet rather than shrinking to diff-only review.

Self-review after trio convergence is mandatory.

## Expected Truthful Closeout Claim

If this slice succeeds, the truthful claim is:

- PDF evidence that reaches writing/semantic retrieval surfaces is now represented by shared generated evidence contracts (`EvidenceCatalogItemV1`/`EvidenceType`/`PdfLocatorV1`) and carries a real `paper_id`.
- `hep_run_build_measurements` consumes shared generated evidence authority without widening behavior beyond LaTeX.
- LaTeX-first + same-paper PDF skip + fail-closed PDF paper identity behavior remains unchanged.

